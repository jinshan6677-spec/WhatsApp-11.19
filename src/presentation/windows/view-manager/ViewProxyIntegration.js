'use strict';

/**
 * ViewProxyIntegration - 视图代理集成（安全增强版）
 * 
 * 实现企业级IP安全防护，采用零信任网络模型：
 * - 所有网络请求必须通过代理
 * - 代理失败时阻断网络而非回退直连
 * - 实时健康监控和自动重连
 * 
 * 核心安全原则：
 * 1. 打开前失败 → 不创建视图，显示错误
 * 2. 运行中失败 → 保持视图，阻断网络，显示重连UI
 * 3. 永不回退到直连
 * 
 * @module presentation/windows/view-manager/ViewProxyIntegration
 */

const ProxyService = require('../../../application/services/ProxyService');
const IPProtectionInjector = require('../../../infrastructure/proxy/IPProtectionInjector');
const ReconnectionOverlay = require('../../../infrastructure/proxy/ui/ReconnectionOverlay');

/**
 * ViewProxyIntegration class - 安全增强版
 */
class ViewProxyIntegration {
  /**
   * Create ViewProxyIntegration instance
   * @param {Object} [options] - Configuration options
   * @param {Function} [options.logger] - Logger function
   * @param {Function} [options.notifyRenderer] - Function to notify renderer
   * @param {Object} [options.eventBus] - Event bus for publishing events
   * @param {ProxyService} [options.proxyService] - Proxy service instance
   */
  constructor(options = {}) {
    this.options = options;
    this.log = options.logger || this._createLogger();
    this.notifyRenderer = options.notifyRenderer || (() => {});
    this.eventBus = options.eventBus || null;
    
    // Initialize components
    this.proxyService = options.proxyService || new ProxyService({
      logger: this.log,
      eventBus: this.eventBus
    });
    
    this.ipProtectionInjector = options.ipProtectionInjector || new IPProtectionInjector({
      logger: this.log
    });
    
    this.reconnectionOverlay = options.reconnectionOverlay || new ReconnectionOverlay({
      logger: this.log
    });
    
    // Track view states
    this._viewStates = new Map(); // accountId -> ViewProxyState
    
    // Bind event handlers
    this._onHealthCheckFailed = this._onHealthCheckFailed.bind(this);
    this._onKillSwitchActivated = this._onKillSwitchActivated.bind(this);
    this._onReconnectionAttempt = this._onReconnectionAttempt.bind(this);
    this._onReconnectionSuccess = this._onReconnectionSuccess.bind(this);
    this._onReconnectionFailed = this._onReconnectionFailed.bind(this);
    
    // Subscribe to events
    this._subscribeToEvents();
  }

  /**
   * Create logger function
   * @private
   * @returns {Function}
   */
  _createLogger() {
    return (level, message, ...args) => {
      const timestamp = new Date().toISOString();
      const logMessage = `[${timestamp}] [ViewProxyIntegration] [${level.toUpperCase()}] ${message}`;
      
      if (level === 'error') {
        console.error(logMessage, ...args);
      } else if (level === 'warn') {
        console.warn(logMessage, ...args);
      } else {
        console.log(logMessage, ...args);
      }
    };
  }

  /**
   * Subscribe to proxy events
   * @private
   */
  _subscribeToEvents() {
    if (!this.eventBus) return;
    
    this.eventBus.subscribe('proxy:health-check-failed', this._onHealthCheckFailed);
    this.eventBus.subscribe('proxy:kill-switch-activated', this._onKillSwitchActivated);
    this.eventBus.subscribe('proxy:reconnection-attempt', this._onReconnectionAttempt);
    this.eventBus.subscribe('proxy:reconnection-success', this._onReconnectionSuccess);
    this.eventBus.subscribe('proxy:reconnection-failed', this._onReconnectionFailed);
  }

  // ==================== 核心安全方法 ====================

  /**
   * 安全配置代理（打开WhatsApp前）
   * 
   * 这是创建BrowserView前的必要步骤：
   * 1. 验证代理配置
   * 2. 预检测代理连通性
   * 3. 验证出口IP
   * 4. 配置Session代理
   * 5. 启用安全防护
   * 
   * 如果任何步骤失败，将返回错误而不是回退到直连
   * 
   * @param {string} accountId - Account ID
   * @param {Electron.Session} session - Electron session
   * @param {Object} proxyConfig - Proxy configuration
   * @returns {Promise<{success: boolean, ip?: string, error?: string}>}
   */
  async secureConfigureProxy(accountId, session, proxyConfig) {
    this.log('info', `[安全代理] 开始为账户 ${accountId} 配置安全代理...`);
    
    if (!proxyConfig || !proxyConfig.enabled) {
      this.log('info', `[安全代理] 账户 ${accountId} 未启用代理`);
      return { success: true, proxyEnabled: false };
    }

    // Step 1: 使用ProxyService进行安全连接
    const result = await this.proxyService.secureConnect(accountId, proxyConfig, session);
    
    if (!result.success) {
      this.log('error', `[安全代理] 账户 ${accountId} 代理配置失败: ${result.error}`);
      
      // 通知渲染进程（不回退到直连）
      this.notifyRenderer('proxy-config-failed', {
        accountId,
        error: result.error,
        step: result.step,
        // 🔴 关键：不再有 fallbackToDirect
        canRetry: true,
        canSwitchProxy: true
      });
      
      return {
        success: false,
        error: result.error,
        step: result.step
      };
    }

    // Step 2: 存储视图状态
    this._viewStates.set(accountId, {
      accountId,
      session,
      proxyConfig,
      ip: result.ip,
      connectedAt: new Date(),
      killSwitchActive: false
    });

    this.log('info', `✓ [安全代理] 账户 ${accountId} 代理配置成功 (IP: ${result.ip})`);
    
    return {
      success: true,
      ip: result.ip,
      latency: result.latency,
      proxyEnabled: true
    };
  }

  /**
   * 注入IP保护脚本（在页面加载前）
   * 
   * 必须在BrowserView加载任何内容之前调用
   * 
   * @param {Electron.WebContents} webContents - WebContents to inject into
   * @returns {Promise<boolean>}
   */
  async injectIPProtection(webContents) {
    if (!webContents || webContents.isDestroyed()) {
      this.log('warn', '[IP保护] WebContents无效，跳过注入');
      return false;
    }

    // 检查是否已经注入过（防止重复添加监听器）
    const webContentsId = webContents.id;
    if (this._injectedWebContents && this._injectedWebContents.has(webContentsId)) {
      this.log('info', '[IP保护] 已注入过，跳过重复注入');
      return true;
    }

    // 初始化跟踪集合
    if (!this._injectedWebContents) {
      this._injectedWebContents = new Set();
    }

    try {
      const script = this.ipProtectionInjector.getProtectionScript();
      
      // 创建注入处理函数
      const injectHandler = async () => {
        try {
          if (!webContents.isDestroyed()) {
            await webContents.executeJavaScript(script);
            this.log('info', '[IP保护] 脚本已注入');
          }
        } catch (error) {
          this.log('warn', `[IP保护] 注入失败: ${error.message}`);
        }
      };

      // 在页面加载前注入（使用命名函数以便后续清理）
      webContents.on('did-start-loading', injectHandler);
      
      // 当 webContents 销毁时清理
      webContents.once('destroyed', () => {
        this._injectedWebContents.delete(webContentsId);
      });

      // 标记为已注入
      this._injectedWebContents.add(webContentsId);

      // 尝试立即注入一次（如果页面已加载）
      // 注意：如果页面还没加载，这会失败，但不影响后续的自动注入
      try {
        const url = webContents.getURL();
        if (url && url !== '' && url !== 'about:blank') {
          await webContents.executeJavaScript(script);
          this.log('info', '[IP保护] 脚本已立即注入到当前页面');
        } else {
          this.log('info', '[IP保护] 页面尚未加载，将在页面加载时注入');
        }
      } catch (immediateError) {
        // 忽略立即注入的错误，因为页面可能还没加载
        this.log('debug', `[IP保护] 立即注入跳过: ${immediateError.message}`);
      }
      
      this.log('info', '✓ [IP保护] IP保护脚本已配置');
      return true;
    } catch (error) {
      this.log('error', `[IP保护] 配置失败: ${error.message}`);
      return false;
    }
  }

  /**
   * 处理代理错误（运行中失败）
   * 
   * 🔴 关键安全逻辑：
   * - 不回退到直连
   * - 触发Kill-Switch阻断网络
   * - 显示重连UI
   * - 启动自动重连
   * 
   * @param {string} accountId - Account ID
   * @param {Object} viewState - View state object
   * @param {number} errorCode - Error code
   * @param {string} errorMessage - Error message
   * @returns {Promise<{handled: boolean, action: string}>}
   */
  async handleProxyError(accountId, viewState, errorCode, errorMessage) {
    const proxyErrorDesc = this.getProxyErrorDescription(errorCode);
    
    if (!proxyErrorDesc) {
      // 不是代理错误
      return { handled: false, action: 'none' };
    }

    this.log('error', `[代理错误] 账户 ${accountId}: ${proxyErrorDesc} (${errorCode})`);
    
    const state = this._viewStates.get(accountId);
    if (!state) {
      this.log('warn', `[代理错误] 未找到账户 ${accountId} 的状态`);
      return { handled: false, action: 'none' };
    }

    // 🔴 关键：触发Kill-Switch，不回退到直连
    this.log('info', `[代理错误] 触发Kill-Switch，阻断网络请求...`);
    await this.proxyService.killSwitch.trigger(accountId, `proxy_error_${errorCode}`);
    state.killSwitchActive = true;

    // 显示重连UI
    if (viewState.view && viewState.view.webContents) {
      await this.reconnectionOverlay.inject(viewState.view.webContents, 'reconnecting', {
        attempt: 1,
        maxAttempts: 3,
        countdown: 2
      });
      
      // 设置回调
      await this.reconnectionOverlay.setupCallbacks(viewState.view.webContents, {
        onRetry: () => this._handleManualRetry(accountId, viewState),
        onSwitchProxy: () => this._handleSwitchProxy(accountId, viewState),
        onClose: () => this._handleCloseSession(accountId, viewState)
      });
    }

    // 通知渲染进程
    this.notifyRenderer('proxy-error-kill-switch', {
      accountId,
      errorCode,
      errorMessage: proxyErrorDesc,
      killSwitchActive: true,
      autoReconnecting: true
    });

    // 启动自动重连
    this._startAutoReconnect(accountId, viewState);

    return {
      handled: true,
      action: 'kill-switch-and-reconnect'
    };
  }

  /**
   * 处理代理崩溃（运行中失败）
   * 
   * @param {string} accountId - Account ID
   * @param {Object} viewState - View state object
   * @param {Object} crashDetails - Crash details
   * @returns {Promise<{handled: boolean, action: string}>}
   */
  async handleProxyCrash(accountId, viewState, crashDetails) {
    const state = this._viewStates.get(accountId);
    if (!state || !state.proxyConfig || !state.proxyConfig.enabled) {
      return { handled: false, action: 'none' };
    }

    this.log('warn', `[崩溃] 账户 ${accountId} 可能是代理导致的崩溃`);

    // 🔴 关键：触发Kill-Switch，不回退到直连
    await this.proxyService.killSwitch.trigger(accountId, 'crash');
    state.killSwitchActive = true;

    // 通知渲染进程
    this.notifyRenderer('proxy-crash-kill-switch', {
      accountId,
      crashReason: crashDetails.reason,
      killSwitchActive: true
    });

    return {
      handled: true,
      action: 'kill-switch'
    };
  }

  // ==================== 重连逻辑 ====================

  /**
   * 启动自动重连
   * @private
   * @param {string} accountId - Account ID
   * @param {Object} viewState - View state
   */
  async _startAutoReconnect(accountId, viewState) {
    const state = this._viewStates.get(accountId);
    if (!state) return;

    const maxAttempts = 3;
    const delays = [2000, 3000, 5000]; // 指数退避

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      this.log('info', `[重连] 账户 ${accountId} 第 ${attempt}/${maxAttempts} 次重连尝试...`);

      // 更新UI
      if (viewState.view && viewState.view.webContents) {
        await this.reconnectionOverlay.updateProgress(
          viewState.view.webContents,
          attempt,
          maxAttempts
        );
      }

      // 等待延迟
      const delay = delays[attempt - 1] || 5000;
      await this._countdown(viewState, delay);

      // 尝试重连
      const result = await this.proxyService.manualReconnect(accountId);

      if (result.success) {
        this.log('info', `✓ [重连] 账户 ${accountId} 重连成功 (IP: ${result.ip})`);
        
        // 更新状态
        state.ip = result.ip;
        state.killSwitchActive = false;

        // 显示成功UI
        if (viewState.view && viewState.view.webContents) {
          await this.reconnectionOverlay.showSuccessAndRemove(viewState.view.webContents);
          
          // 刷新页面
          setTimeout(() => {
            if (viewState.view && viewState.view.webContents && !viewState.view.webContents.isDestroyed()) {
              viewState.view.webContents.reload();
            }
          }, 1000);
        }

        // 通知渲染进程
        this.notifyRenderer('proxy-reconnect-success', {
          accountId,
          ip: result.ip,
          attempt
        });

        return;
      }

      this.log('warn', `[重连] 账户 ${accountId} 第 ${attempt} 次重连失败: ${result.error}`);
    }

    // 所有重连尝试失败
    this.log('error', `[重连] 账户 ${accountId} 所有重连尝试失败`);
    
    // 显示失败UI
    if (viewState.view && viewState.view.webContents) {
      await this.reconnectionOverlay.inject(viewState.view.webContents, 'failed', {
        errorMessage: '无法连接到代理服务器，请检查代理配置或网络连接'
      });
    }

    // 通知渲染进程
    this.notifyRenderer('proxy-reconnect-failed', {
      accountId,
      attempts: maxAttempts
    });
  }

  /**
   * 倒计时
   * @private
   */
  async _countdown(viewState, totalMs) {
    const seconds = Math.ceil(totalMs / 1000);
    for (let i = seconds; i > 0; i--) {
      if (viewState.view && viewState.view.webContents) {
        await this.reconnectionOverlay.updateCountdown(viewState.view.webContents, i);
      }
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  /**
   * 处理手动重试
   * @private
   */
  async _handleManualRetry(accountId, viewState) {
    this.log('info', `[手动重试] 账户 ${accountId}`);
    await this._startAutoReconnect(accountId, viewState);
  }

  /**
   * 处理切换代理
   * @private
   */
  async _handleSwitchProxy(accountId, viewState) {
    this.log('info', `[切换代理] 账户 ${accountId}`);
    
    // 通知渲染进程打开代理设置
    this.notifyRenderer('open-proxy-settings', {
      accountId
    });
  }

  /**
   * 处理关闭会话
   * @private
   */
  async _handleCloseSession(accountId, viewState) {
    this.log('info', `[关闭会话] 账户 ${accountId}`);
    
    // 断开代理连接
    await this.proxyService.secureDisconnect(accountId);
    
    // 移除状态
    this._viewStates.delete(accountId);
    
    // 通知渲染进程关闭视图
    this.notifyRenderer('close-view', {
      accountId
    });
  }

  // ==================== 事件处理 ====================

  /**
   * 健康检查失败事件处理
   * @private
   */
  async _onHealthCheckFailed(event) {
    const { accountId, consecutiveFailures } = event;
    this.log('warn', `[健康检查] 账户 ${accountId} 连续失败 ${consecutiveFailures} 次`);
  }

  /**
   * Kill-Switch激活事件处理
   * @private
   */
  async _onKillSwitchActivated(event) {
    const { accountId, reason } = event;
    this.log('warn', `[Kill-Switch] 账户 ${accountId} 已激活，原因: ${reason}`);
    
    const state = this._viewStates.get(accountId);
    if (state) {
      state.killSwitchActive = true;
    }
  }

  /**
   * 重连尝试事件处理
   * @private
   */
  async _onReconnectionAttempt(event) {
    const { accountId, attempt, maxAttempts } = event;
    this.log('info', `[重连] 账户 ${accountId} 尝试 ${attempt}/${maxAttempts}`);
  }

  /**
   * 重连成功事件处理
   * @private
   */
  async _onReconnectionSuccess(event) {
    const { accountId, ip } = event;
    this.log('info', `[重连] 账户 ${accountId} 成功，IP: ${ip}`);
    
    const state = this._viewStates.get(accountId);
    if (state) {
      state.ip = ip;
      state.killSwitchActive = false;
    }
  }

  /**
   * 重连失败事件处理
   * @private
   */
  async _onReconnectionFailed(event) {
    const { accountId, error } = event;
    this.log('error', `[重连] 账户 ${accountId} 失败: ${error}`);
  }

  // ==================== 工具方法 ====================

  /**
   * 获取代理错误描述
   * @param {number} errorCode - Error code
   * @returns {string|null}
   */
  getProxyErrorDescription(errorCode) {
    const proxyErrors = {
      '-120': 'SOCKS 代理连接失败',
      '-130': '代理连接失败',
      '-125': '代理隧道连接失败',
      '-106': '无法连接到代理服务器',
      '-118': '代理认证失败',
      '-21': '网络访问被拒绝（可能是代理问题）',
      '-7': '连接超时',
      '-2': '网络错误'
    };
    
    return proxyErrors[errorCode.toString()] || null;
  }

  /**
   * 验证代理配置
   * @param {Object} proxyConfig - Proxy configuration
   * @returns {{valid: boolean, errors: string[]}}
   */
  validateProxyConfig(proxyConfig) {
    return this.proxyService.validateConfig(proxyConfig);
  }

  /**
   * 获取账户的代理状态
   * @param {string} accountId - Account ID
   * @returns {Object|null}
   */
  getProxyState(accountId) {
    return this._viewStates.get(accountId) || null;
  }

  /**
   * 检查Kill-Switch是否激活
   * @param {string} accountId - Account ID
   * @returns {boolean}
   */
  isKillSwitchActive(accountId) {
    const state = this._viewStates.get(accountId);
    return state ? state.killSwitchActive : false;
  }

  /**
   * 安全断开代理连接
   * @param {string} accountId - Account ID
   * @returns {Promise<boolean>}
   */
  async secureDisconnect(accountId) {
    const result = await this.proxyService.secureDisconnect(accountId);
    this._viewStates.delete(accountId);
    return result.success;
  }

  /**
   * 清理资源
   */
  destroy() {
    // 断开所有连接
    for (const accountId of this._viewStates.keys()) {
      this.proxyService.secureDisconnect(accountId);
    }
    
    this._viewStates.clear();
    this.reconnectionOverlay.cleanup();
    
    this.log('info', 'ViewProxyIntegration destroyed');
  }
}

module.exports = ViewProxyIntegration;
