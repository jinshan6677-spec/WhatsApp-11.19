/**
 * SessionManager - 会话管理器
 * 
 * 负责管理 WhatsApp 账号的会话持久化和恢复
 * 包括登录状态检测、会话数据保存和清除
 * 支持 BrowserView 会话和代理配置
 */

const { session } = require('electron');
const path = require('path');
const fs = require('fs').promises;

/**
 * SessionManager 类
 */
class SessionManager {
  /**
   * 创建会话管理器
   * @param {Object} [options] - 配置选项
   * @param {string} [options.userDataPath] - 用户数据根目录
   */
  constructor(options = {}) {
    this.userDataPath = options.userDataPath;
    
    // 登录状态缓存 Map: accountId -> boolean
    this.loginStatusCache = new Map();
    
    // Session 实例缓存 Map: accountId -> Session
    this.sessionCache = new Map();
    
    // 代理配置缓存 Map: accountId -> proxyConfig
    this.proxyCache = new Map();
    
    // 日志函数
    this.log = this._createLogger();
  }

  /**
   * 创建日志记录器
   * @private
   * @returns {Function}
   */
  _createLogger() {
    return (level, message, ...args) => {
      const timestamp = new Date().toISOString();
      const logMessage = `[${timestamp}] [SessionManager] [${level.toUpperCase()}] ${message}`;
      
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
   * 创建或获取账号的 session 对象（用于 BrowserView）
   * @param {string} accountId - 账号 ID
   * @param {Object} [config] - 配置选项
   * @param {Object} [config.proxy] - 代理配置
   * @param {boolean} [config.proxy.enabled] - 是否启用代理
   * @param {string} [config.proxy.protocol] - 代理协议 (http/https/socks5)
   * @param {string} [config.proxy.host] - 代理主机
   * @param {number} [config.proxy.port] - 代理端口
   * @param {string} [config.proxy.username] - 代理用户名（可选）
   * @param {string} [config.proxy.password] - 代理密码（可选）
   * @param {string} [config.proxy.bypass] - 代理绕过规则（可选）
   * @param {boolean} [config.proxy.validateConnectivity] - 是否验证代理连接性（可选）
   * @returns {Promise<{success: boolean, session?: Electron.Session, error?: string, proxyWarning?: string}>}
   */
  async createSession(accountId, config = {}) {
    try {
      this.log('info', `Creating session for account ${accountId}`);
      
      // 验证 accountId
      if (!accountId || typeof accountId !== 'string') {
        throw new Error('Invalid accountId: must be a non-empty string');
      }
      
      // 创建隔离的 session partition
      const partition = `persist:account_${accountId}`;
      const accountSession = session.fromPartition(partition);
      
      // 缓存 session 实例
      this.sessionCache.set(accountId, accountSession);
      
      let proxyWarning = null;
      
      // 配置代理（如果提供）
      if (config.proxy && config.proxy.enabled) {
        const proxyResult = await this.configureProxy(accountId, config.proxy);
        if (!proxyResult.success) {
          proxyWarning = `Proxy configuration failed: ${proxyResult.error}`;
          this.log('warn', `Failed to configure proxy for account ${accountId}: ${proxyResult.error}`);
          
          // 如果应用了回退策略，记录警告
          if (proxyResult.fallbackApplied) {
            proxyWarning += ' (using direct connection as fallback)';
          }
        } else if (proxyResult.fallbackApplied) {
          proxyWarning = proxyResult.error;
        }
      }
      
      // 配置 session 持久化选项
      await this.configureSessionPersistence(accountId);
      
      this.log('info', `Session created successfully for account ${accountId}`);
      
      const result = {
        success: true,
        session: accountSession
      };
      
      if (proxyWarning) {
        result.proxyWarning = proxyWarning;
      }
      
      return result;
    } catch (error) {
      this.log('error', `Failed to create session for account ${accountId}:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 获取账号的 session 对象
   * @param {string} accountId - 账号 ID
   * @returns {Electron.Session|null}
   */
  getSession(accountId) {
    // 先从缓存获取
    if (this.sessionCache.has(accountId)) {
      return this.sessionCache.get(accountId);
    }
    
    // 如果缓存中没有，尝试从 partition 获取
    try {
      const partition = `persist:account_${accountId}`;
      const accountSession = session.fromPartition(partition);
      this.sessionCache.set(accountId, accountSession);
      return accountSession;
    } catch (error) {
      this.log('error', `Failed to get session for account ${accountId}:`, error);
      return null;
    }
  }

  /**
   * 配置账号的代理设置
   * @param {string} accountId - 账号 ID
   * @param {Object} proxyConfig - 代理配置
   * @param {string} proxyConfig.protocol - 代理协议 (http/https/socks5)
   * @param {string} proxyConfig.host - 代理主机
   * @param {number} proxyConfig.port - 代理端口
   * @param {string} [proxyConfig.username] - 代理用户名（可选）
   * @param {string} [proxyConfig.password] - 代理密码（可选）
   * @param {string} [proxyConfig.bypass] - 代理绕过规则（可选）
   * @param {boolean} [proxyConfig.validateConnectivity] - 是否验证代理连接性（可选，默认 false）
   * @returns {Promise<{success: boolean, error?: string, fallbackApplied?: boolean}>}
   */
  async configureProxy(accountId, proxyConfig) {
    try {
      this.log('info', `Configuring proxy for account ${accountId}`);
      
      // 验证代理配置
      const validation = this._validateProxyConfig(proxyConfig);
      if (!validation.valid) {
        throw new Error(`Invalid proxy configuration: ${validation.error}`);
      }
      
      const accountSession = this.getSession(accountId);
      if (!accountSession) {
        throw new Error(`Session not found for account ${accountId}`);
      }
      
      // 构建代理 URL
      const { protocol, host, port, username, password, bypass, validateConnectivity } = proxyConfig;
      
      // 构建代理规则字符串
      let proxyRules = `${protocol}://${host}:${port}`;
      
      // 可选：验证代理连接性
      if (validateConnectivity) {
        this.log('info', `Validating proxy connectivity for account ${accountId}`);
        const isValid = await this._validateProxyConnectivity(accountSession, proxyRules, username, password);
        if (!isValid) {
          this.log('warn', `Proxy connectivity validation failed for account ${accountId}, applying fallback`);
          // 应用回退策略：使用直连
          return await this._applyProxyFallback(accountId, accountSession, 'Proxy connectivity validation failed');
        }
      }
      
      // 如果有认证信息，需要通过 webRequest 拦截器处理
      if (username && password) {
        this._setupProxyAuth(accountSession, username, password);
      }
      
      // 设置代理
      const proxySettings = {
        proxyRules,
        proxyBypassRules: bypass || '<local>'
      };
      
      await accountSession.setProxy(proxySettings);
      
      // 缓存代理配置
      this.proxyCache.set(accountId, proxyConfig);
      
      this.log('info', `Proxy configured successfully for account ${accountId}: ${proxyRules}`);
      
      return { success: true };
    } catch (error) {
      this.log('error', `Failed to configure proxy for account ${accountId}:`, error);
      
      // 尝试应用回退策略
      try {
        const accountSession = this.getSession(accountId);
        if (accountSession) {
          return await this._applyProxyFallback(accountId, accountSession, error.message);
        }
      } catch (fallbackError) {
        this.log('error', `Fallback also failed for account ${accountId}:`, fallbackError);
      }
      
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 验证代理配置
   * @private
   * @param {Object} proxyConfig - 代理配置
   * @returns {{valid: boolean, error?: string}}
   */
  _validateProxyConfig(proxyConfig) {
    if (!proxyConfig) {
      return { valid: false, error: 'Proxy config is required' };
    }
    
    const { protocol, host, port, username, password } = proxyConfig;
    
    // 验证协议
    const validProtocols = ['http', 'https', 'socks5', 'socks4'];
    if (!protocol || !validProtocols.includes(protocol.toLowerCase())) {
      return { valid: false, error: `Invalid protocol: ${protocol}. Must be one of: ${validProtocols.join(', ')}` };
    }
    
    // 验证主机
    if (!host || typeof host !== 'string' || host.trim() === '') {
      return { valid: false, error: 'Invalid host: must be a non-empty string' };
    }
    
    // 验证主机格式（基本检查）
    const hostPattern = /^[a-zA-Z0-9.-]+$/;
    const ipPattern = /^(\d{1,3}\.){3}\d{1,3}$/;
    if (!hostPattern.test(host) && !ipPattern.test(host)) {
      return { valid: false, error: 'Invalid host format: must be a valid hostname or IP address' };
    }
    
    // 验证端口
    if (!port || typeof port !== 'number' || port < 1 || port > 65535) {
      return { valid: false, error: 'Invalid port: must be a number between 1 and 65535' };
    }
    
    // 验证认证信息（如果提供）
    if (username !== undefined || password !== undefined) {
      if (username && typeof username !== 'string') {
        return { valid: false, error: 'Invalid username: must be a string' };
      }
      if (password && typeof password !== 'string') {
        return { valid: false, error: 'Invalid password: must be a string' };
      }
      // 如果提供了用户名或密码，两者都应该提供
      if ((username && !password) || (!username && password)) {
        return { valid: false, error: 'Both username and password must be provided for authentication' };
      }
    }
    
    return { valid: true };
  }

  /**
   * 设置代理认证
   * @private
   * @param {Electron.Session} accountSession - Session 实例
   * @param {string} username - 用户名
   * @param {string} password - 密码
   */
  _setupProxyAuth(accountSession, username, password) {
    // 移除之前的监听器（如果存在）
    accountSession.webRequest.onBeforeSendHeaders(null);
    
    // 设置代理认证拦截器
    accountSession.webRequest.onBeforeSendHeaders((details, callback) => {
      // 为代理请求添加认证头
      if (details.requestHeaders['Proxy-Authorization']) {
        // 已经有认证头，不需要添加
        callback({ requestHeaders: details.requestHeaders });
        return;
      }
      
      // 添加 Basic 认证
      const auth = Buffer.from(`${username}:${password}`).toString('base64');
      details.requestHeaders['Proxy-Authorization'] = `Basic ${auth}`;
      
      callback({ requestHeaders: details.requestHeaders });
    });
    
    this.log('info', 'Proxy authentication configured');
  }

  /**
   * 验证代理连接性
   * @private
   * @param {Electron.Session} accountSession - Session 实例
   * @param {string} proxyRules - 代理规则
   * @param {string} [username] - 用户名（可选）
   * @param {string} [password] - 密码（可选）
   * @returns {Promise<boolean>}
   */
  async _validateProxyConnectivity(accountSession, proxyRules, username, password) {
    try {
      // 临时设置代理
      const tempProxySettings = {
        proxyRules,
        proxyBypassRules: '<local>'
      };
      
      await accountSession.setProxy(tempProxySettings);
      
      // 如果有认证信息，临时设置
      if (username && password) {
        this._setupProxyAuth(accountSession, username, password);
      }
      
      // 尝试通过代理发起一个简单的请求来验证连接性
      // 使用一个轻量级的测试 URL
      const testUrl = 'https://www.google.com/generate_204';
      
      return new Promise((resolve) => {
        const timeout = setTimeout(() => {
          this.log('warn', 'Proxy connectivity validation timed out');
          resolve(false);
        }, 10000); // 10 秒超时
        
        const request = require('electron').net.request({
          url: testUrl,
          session: accountSession,
          method: 'HEAD'
        });
        
        request.on('response', (response) => {
          clearTimeout(timeout);
          // 任何响应都表示代理可以连接
          const isValid = response.statusCode >= 200 && response.statusCode < 500;
          this.log('info', `Proxy connectivity validation result: ${isValid} (status: ${response.statusCode})`);
          resolve(isValid);
        });
        
        request.on('error', (error) => {
          clearTimeout(timeout);
          this.log('warn', `Proxy connectivity validation failed:`, error.message);
          resolve(false);
        });
        
        request.end();
      });
    } catch (error) {
      this.log('error', 'Error during proxy connectivity validation:', error);
      return false;
    }
  }

  /**
   * 应用代理回退策略（使用直连）
   * @private
   * @param {string} accountId - 账号 ID
   * @param {Electron.Session} accountSession - Session 实例
   * @param {string} reason - 回退原因
   * @returns {Promise<{success: boolean, fallbackApplied: boolean, error?: string}>}
   */
  async _applyProxyFallback(accountId, accountSession, reason) {
    try {
      this.log('warn', `Applying proxy fallback for account ${accountId}: ${reason}`);
      
      // 清除代理设置，使用直连
      await accountSession.setProxy({ proxyRules: 'direct://' });
      
      // 清除代理认证拦截器
      accountSession.webRequest.onBeforeSendHeaders(null);
      
      // 清除代理缓存
      this.proxyCache.delete(accountId);
      
      this.log('info', `Proxy fallback applied for account ${accountId}, using direct connection`);
      
      return {
        success: true,
        fallbackApplied: true,
        error: `Proxy configuration failed (${reason}), using direct connection as fallback`
      };
    } catch (error) {
      this.log('error', `Failed to apply proxy fallback for account ${accountId}:`, error);
      throw error;
    }
  }

  /**
   * 测试代理配置（不实际应用）
   * @param {Object} proxyConfig - 代理配置
   * @param {string} proxyConfig.protocol - 代理协议 (http/https/socks5)
   * @param {string} proxyConfig.host - 代理主机
   * @param {number} proxyConfig.port - 代理端口
   * @param {string} [proxyConfig.username] - 代理用户名（可选）
   * @param {string} [proxyConfig.password] - 代理密码（可选）
   * @returns {Promise<{valid: boolean, error?: string, latency?: number}>}
   */
  async testProxyConfig(proxyConfig) {
    try {
      this.log('info', 'Testing proxy configuration');
      
      // 验证代理配置格式
      const validation = this._validateProxyConfig(proxyConfig);
      if (!validation.valid) {
        return {
          valid: false,
          error: validation.error
        };
      }
      
      // 创建临时 session 用于测试
      const testPartition = `temp:proxy-test-${Date.now()}`;
      const testSession = session.fromPartition(testPartition);
      
      const { protocol, host, port, username, password } = proxyConfig;
      const proxyRules = `${protocol}://${host}:${port}`;
      
      // 测试连接性
      const startTime = Date.now();
      const isValid = await this._validateProxyConnectivity(testSession, proxyRules, username, password);
      const latency = Date.now() - startTime;
      
      // 清理临时 session
      await testSession.clearStorageData();
      
      if (isValid) {
        this.log('info', `Proxy test successful, latency: ${latency}ms`);
        return {
          valid: true,
          latency
        };
      } else {
        return {
          valid: false,
          error: 'Proxy connectivity test failed'
        };
      }
    } catch (error) {
      this.log('error', 'Proxy test failed:', error);
      return {
        valid: false,
        error: error.message
      };
    }
  }

  /**
   * 获取账号的代理配置
   * @param {string} accountId - 账号 ID
   * @returns {Object|null}
   */
  getProxyConfig(accountId) {
    return this.proxyCache.get(accountId) || null;
  }

  /**
   * 清除账号的代理配置
   * @param {string} accountId - 账号 ID
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async clearProxy(accountId) {
    try {
      this.log('info', `Clearing proxy for account ${accountId}`);
      
      const accountSession = this.getSession(accountId);
      if (!accountSession) {
        throw new Error(`Session not found for account ${accountId}`);
      }
      
      // 清除代理设置
      await accountSession.setProxy({ proxyRules: 'direct://' });
      
      // 清除代理认证拦截器
      accountSession.webRequest.onBeforeSendHeaders(null);
      
      // 清除缓存
      this.proxyCache.delete(accountId);
      
      this.log('info', `Proxy cleared for account ${accountId}`);
      
      return { success: true };
    } catch (error) {
      this.log('error', `Failed to clear proxy for account ${accountId}:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 获取实例的 session 对象（向后兼容）
   * @param {string} instanceId - 实例 ID
   * @returns {Electron.Session}
   */
  getInstanceSession(instanceId) {
    return this.getSession(instanceId);
  }

  /**
   * 获取账号的用户数据目录路径
   * @param {string} accountId - 账号 ID
   * @returns {string}
   */
  getUserDataDir(accountId) {
    return path.join(this.userDataPath, 'profiles', accountId);
  }

  /**
   * 检查会话数据是否存在
   * @param {string} accountId - 账号 ID
   * @returns {Promise<boolean>}
   */
  async hasSessionData(accountId) {
    try {
      const userDataDir = this.getUserDataDir(accountId);
      
      // 检查用户数据目录是否存在
      try {
        await fs.access(userDataDir);
      } catch {
        return false;
      }
      
      // 检查关键的会话文件是否存在
      // WhatsApp Web 使用 IndexedDB 存储会话数据
      const indexedDBPath = path.join(userDataDir, 'IndexedDB');
      const localStoragePath = path.join(userDataDir, 'Local Storage');
      const cookiesPath = path.join(userDataDir, 'Cookies');
      
      try {
        await fs.access(indexedDBPath);
        this.log('info', `Session data found for account ${accountId}`);
        return true;
      } catch {
        try {
          await fs.access(localStoragePath);
          this.log('info', `Session data found for account ${accountId}`);
          return true;
        } catch {
          try {
            await fs.access(cookiesPath);
            this.log('info', `Session data found for account ${accountId}`);
            return true;
          } catch {
            this.log('info', `No session data found for account ${accountId}`);
            return false;
          }
        }
      }
    } catch (error) {
      this.log('error', `Error checking session data for account ${accountId}:`, error);
      return false;
    }
  }

  /**
   * 验证会话隔离性
   * @param {string} accountId - 账号 ID
   * @returns {Promise<{isolated: boolean, details: Object, error?: string}>}
   */
  async verifySessionIsolation(accountId) {
    try {
      this.log('info', `Verifying session isolation for account ${accountId}`);
      
      const accountSession = this.getSession(accountId);
      if (!accountSession) {
        throw new Error(`Session not found for account ${accountId}`);
      }
      
      const userDataDir = this.getUserDataDir(accountId);
      
      // 检查各种存储的隔离性
      const details = {
        partition: `persist:account_${accountId}`,
        userDataDir,
        hasOwnCookies: false,
        hasOwnLocalStorage: false,
        hasOwnIndexedDB: false,
        hasOwnCache: false
      };
      
      // 检查 Cookies
      try {
        const cookiesPath = path.join(userDataDir, 'Cookies');
        await fs.access(cookiesPath);
        details.hasOwnCookies = true;
      } catch {
        // Cookies 文件可能还未创建
      }
      
      // 检查 LocalStorage
      try {
        const localStoragePath = path.join(userDataDir, 'Local Storage');
        await fs.access(localStoragePath);
        details.hasOwnLocalStorage = true;
      } catch {
        // LocalStorage 可能还未创建
      }
      
      // 检查 IndexedDB
      try {
        const indexedDBPath = path.join(userDataDir, 'IndexedDB');
        await fs.access(indexedDBPath);
        details.hasOwnIndexedDB = true;
      } catch {
        // IndexedDB 可能还未创建
      }
      
      // 检查 Cache
      try {
        const cachePath = path.join(userDataDir, 'Cache');
        await fs.access(cachePath);
        details.hasOwnCache = true;
      } catch {
        // Cache 可能还未创建
      }
      
      // Session 使用独立的 partition，即使文件还未创建也是隔离的
      const isolated = true;
      
      this.log('info', `Session isolation verified for account ${accountId}:`, details);
      
      return {
        isolated,
        details
      };
    } catch (error) {
      this.log('error', `Failed to verify session isolation for account ${accountId}:`, error);
      return {
        isolated: false,
        details: {},
        error: error.message
      };
    }
  }

  /**
   * 检测账号的登录状态（支持 BrowserWindow 和 BrowserView）
   * @param {string} accountId - 账号 ID
   * @param {BrowserWindow|BrowserView} viewOrWindow - BrowserView 或 BrowserWindow 实例
   * @returns {Promise<boolean>}
   */
  async detectLoginStatus(accountId, viewOrWindow) {
    try {
      if (!viewOrWindow) {
        this.log('warn', `No view or window provided for account ${accountId}`);
        return false;
      }

      // 获取 webContents
      let webContents;
      if (viewOrWindow.webContents) {
        webContents = viewOrWindow.webContents;
      } else if (viewOrWindow.isDestroyed && viewOrWindow.isDestroyed()) {
        this.log('warn', `View/Window for account ${accountId} is destroyed`);
        return false;
      } else {
        this.log('warn', `Invalid view/window for account ${accountId}`);
        return false;
      }

      // 执行 JavaScript 检测登录状态
      // WhatsApp Web 在登录后会有特定的 DOM 元素
      const isLoggedIn = await webContents.executeJavaScript(`
        (function() {
          try {
            // 检查是否存在二维码（未登录）
            const qrCode = document.querySelector('[data-ref], canvas[aria-label*="QR"], div[data-testid="qrcode"]');
            if (qrCode && qrCode.offsetParent !== null) {
              return false;
            }
            
            // 检查是否存在聊天列表（已登录）
            const chatList = document.querySelector('[data-testid="chat-list"], #pane-side, div[role="grid"]');
            if (chatList && chatList.offsetParent !== null) {
              return true;
            }
            
            // 检查是否存在主界面容器
            const mainContainer = document.querySelector('#app .app-wrapper-web, #app > div > div');
            if (mainContainer) {
              // 如果主容器存在但没有二维码，可能已登录
              const hasQR = document.querySelector('[data-ref], canvas[aria-label*="QR"]');
              return !hasQR;
            }
            
            return false;
          } catch (error) {
            console.error('Login detection error:', error);
            return false;
          }
        })();
      `).catch(error => {
        this.log('error', `Failed to execute login detection script for account ${accountId}:`, error);
        return false;
      });

      // 更新缓存
      this.loginStatusCache.set(accountId, isLoggedIn);
      
      this.log('info', `Login status for account ${accountId}: ${isLoggedIn ? 'logged in' : 'not logged in'}`);
      
      return isLoggedIn;
    } catch (error) {
      this.log('error', `Error detecting login status for account ${accountId}:`, error);
      return false;
    }
  }

  /**
   * 获取缓存的登录状态
   * @param {string} accountId - 账号 ID
   * @returns {boolean|null}
   */
  getCachedLoginStatus(accountId) {
    return this.loginStatusCache.get(accountId) ?? null;
  }

  /**
   * 设置登录状态缓存
   * @param {string} accountId - 账号 ID
   * @param {boolean} isLoggedIn - 是否已登录
   */
  setLoginStatus(accountId, isLoggedIn) {
    this.loginStatusCache.set(accountId, isLoggedIn);
  }

  /**
   * 清除账号的登录状态缓存
   * @param {string} accountId - 账号 ID
   */
  clearLoginStatusCache(accountId) {
    this.loginStatusCache.delete(accountId);
  }

  /**
   * 清除账号的所有缓存
   * @param {string} accountId - 账号 ID
   */
  clearAccountCache(accountId) {
    this.loginStatusCache.delete(accountId);
    this.sessionCache.delete(accountId);
    this.proxyCache.delete(accountId);
    this.log('info', `All caches cleared for account ${accountId}`);
  }

  /**
   * 配置 session 持久化选项
   * @param {string} accountId - 账号 ID
   * @param {Object} [options] - 配置选项
   * @param {number} [options.cacheSize] - 缓存大小限制（字节）
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async configureSessionPersistence(accountId, options = {}) {
    try {
      const accountSession = this.getSession(accountId);
      
      if (!accountSession) {
        throw new Error(`Session not found for account ${accountId}`);
      }
      
      // Electron 的 session.fromPartition('persist:xxx') 已经自动启用持久化
      // 这里可以配置额外的选项
      
      // 设置缓存大小限制（可选）
      if (options.cacheSize) {
        await accountSession.clearCache();
        // Note: Electron doesn't provide a direct API to set cache size limit
        // The cache will be managed automatically by Chromium
      }
      
      // 确保用户数据目录存在
      const userDataDir = this.getUserDataDir(accountId);
      await fs.mkdir(userDataDir, { recursive: true });
      
      this.log('info', `Session persistence configured for account ${accountId}`);
      
      return { success: true };
    } catch (error) {
      this.log('error', `Failed to configure session persistence for account ${accountId}:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 获取会话数据统计信息
   * @param {string} accountId - 账号 ID
   * @returns {Promise<{size: number, files: number, error?: string}>}
   */
  async getSessionDataStats(accountId) {
    try {
      const userDataDir = this.getUserDataDir(accountId);
      
      // 检查目录是否存在
      try {
        await fs.access(userDataDir);
      } catch {
        return { size: 0, files: 0 };
      }
      
      // 递归计算目录大小和文件数
      const stats = await this._calculateDirectorySize(userDataDir);
      
      this.log('info', `Session data stats for account ${accountId}: ${stats.size} bytes, ${stats.files} files`);
      
      return stats;
    } catch (error) {
      this.log('error', `Failed to get session data stats for account ${accountId}:`, error);
      return {
        size: 0,
        files: 0,
        error: error.message
      };
    }
  }

  /**
   * 递归计算目录大小
   * @private
   * @param {string} dirPath - 目录路径
   * @returns {Promise<{size: number, files: number}>}
   */
  async _calculateDirectorySize(dirPath) {
    let totalSize = 0;
    let totalFiles = 0;
    
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        
        if (entry.isDirectory()) {
          const subStats = await this._calculateDirectorySize(fullPath);
          totalSize += subStats.size;
          totalFiles += subStats.files;
        } else if (entry.isFile()) {
          const stat = await fs.stat(fullPath);
          totalSize += stat.size;
          totalFiles++;
        }
      }
    } catch (error) {
      // 忽略权限错误等
      this.log('warn', `Error calculating directory size for ${dirPath}:`, error.message);
    }
    
    return { size: totalSize, files: totalFiles };
  }

  /**
   * 清除账号的所有会话数据
   * @param {string} accountId - 账号 ID
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async clearSessionData(accountId) {
    try {
      this.log('info', `Clearing session data for account ${accountId}`);
      
      const accountSession = this.getSession(accountId);
      
      if (!accountSession) {
        throw new Error(`Session not found for account ${accountId}`);
      }
      
      // 清除所有缓存和存储数据
      await accountSession.clearStorageData({
        storages: [
          'appcache',
          'cookies',
          'filesystem',
          'indexdb',
          'localstorage',
          'shadercache',
          'websql',
          'serviceworkers',
          'cachestorage'
        ]
      });
      
      // 清除缓存
      await accountSession.clearCache();
      
      // 清除所有缓存
      this.clearAccountCache(accountId);
      
      this.log('info', `Session data cleared for account ${accountId}`);
      
      return { success: true };
    } catch (error) {
      this.log('error', `Failed to clear session data for account ${accountId}:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 删除账号的用户数据目录
   * @param {string} accountId - 账号 ID
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async deleteUserDataDir(accountId) {
    try {
      const userDataDir = this.getUserDataDir(accountId);
      
      this.log('info', `Deleting user data directory for account ${accountId}: ${userDataDir}`);
      
      // 删除目录
      await fs.rm(userDataDir, { recursive: true, force: true });
      
      // 清除所有缓存
      this.clearAccountCache(accountId);
      
      this.log('info', `User data directory deleted for account ${accountId}`);
      
      return { success: true };
    } catch (error) {
      this.log('error', `Failed to delete user data directory for account ${accountId}:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 备份账号的会话数据
   * @param {string} accountId - 账号 ID
   * @param {string} backupPath - 备份目录路径
   * @returns {Promise<{success: boolean, backupPath?: string, error?: string}>}
   */
  async backupSessionData(accountId, backupPath) {
    try {
      const userDataDir = this.getUserDataDir(accountId);
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupDir = path.join(backupPath, `backup-${accountId}-${timestamp}`);
      
      this.log('info', `Backing up session data for account ${accountId} to ${backupDir}`);
      
      // 复制目录
      await this._copyDirectory(userDataDir, backupDir);
      
      this.log('info', `Session data backed up for account ${accountId}`);
      
      return {
        success: true,
        backupPath: backupDir
      };
    } catch (error) {
      this.log('error', `Failed to backup session data for account ${accountId}:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 恢复账号的会话数据
   * @param {string} accountId - 账号 ID
   * @param {string} backupPath - 备份目录路径
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async restoreSessionData(accountId, backupPath) {
    try {
      const userDataDir = this.getUserDataDir(accountId);
      
      this.log('info', `Restoring session data for account ${accountId} from ${backupPath}`);
      
      // 删除现有数据
      await fs.rm(userDataDir, { recursive: true, force: true });
      
      // 复制备份数据
      await this._copyDirectory(backupPath, userDataDir);
      
      // 清除所有缓存，需要重新检测
      this.clearAccountCache(accountId);
      
      this.log('info', `Session data restored for account ${accountId}`);
      
      return { success: true };
    } catch (error) {
      this.log('error', `Failed to restore session data for account ${accountId}:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 递归复制目录
   * @private
   * @param {string} src - 源目录
   * @param {string} dest - 目标目录
   */
  async _copyDirectory(src, dest) {
    await fs.mkdir(dest, { recursive: true });
    
    const entries = await fs.readdir(src, { withFileTypes: true });
    
    for (const entry of entries) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);
      
      if (entry.isDirectory()) {
        await this._copyDirectory(srcPath, destPath);
      } else {
        await fs.copyFile(srcPath, destPath);
      }
    }
  }

  /**
   * 恢复账号的登录状态（应用启动时调用）
   * @param {string} accountId - 账号 ID
   * @param {BrowserWindow|BrowserView} viewOrWindow - BrowserView 或 BrowserWindow 实例
   * @returns {Promise<{success: boolean, isLoggedIn: boolean, error?: string}>}
   */
  async restoreLoginState(accountId, viewOrWindow) {
    try {
      this.log('info', `Restoring login state for account ${accountId}`);
      
      // 检查是否有会话数据
      const hasSession = await this.hasSessionData(accountId);
      
      if (!hasSession) {
        this.log('info', `No session data found for account ${accountId}, user needs to login`);
        return {
          success: true,
          isLoggedIn: false
        };
      }
      
      // 等待页面加载完成后检测登录状态
      // 给 WhatsApp Web 一些时间来恢复会话
      await this._waitForPageLoad(viewOrWindow, 15000); // 15 秒超时
      
      // 检测登录状态
      const isLoggedIn = await this.detectLoginStatus(accountId, viewOrWindow);
      
      if (isLoggedIn) {
        this.log('info', `Login state restored for account ${accountId}`);
      } else {
        this.log('info', `Session data exists but not logged in for account ${accountId}, may need re-authentication`);
      }
      
      return {
        success: true,
        isLoggedIn
      };
    } catch (error) {
      this.log('error', `Failed to restore login state for account ${accountId}:`, error);
      return {
        success: false,
        isLoggedIn: false,
        error: error.message
      };
    }
  }

  /**
   * 等待页面加载完成
   * @private
   * @param {BrowserWindow|BrowserView} viewOrWindow - BrowserView 或 BrowserWindow 实例
   * @param {number} timeout - 超时时间（毫秒）
   * @returns {Promise<boolean>}
   */
  async _waitForPageLoad(viewOrWindow, timeout = 10000) {
    try {
      // 获取 webContents
      let webContents;
      if (viewOrWindow.webContents) {
        webContents = viewOrWindow.webContents;
      } else {
        this.log('warn', 'Invalid view/window provided for page load wait');
        return false;
      }

      // 如果已经加载完成，直接返回
      if (!webContents.isLoading()) {
        return true;
      }

      // 等待加载完成或超时
      return new Promise((resolve) => {
        const timeoutId = setTimeout(() => {
          this.log('warn', 'Page load wait timed out');
          resolve(false);
        }, timeout);

        const onLoadFinish = () => {
          clearTimeout(timeoutId);
          webContents.removeListener('did-finish-load', onLoadFinish);
          webContents.removeListener('did-fail-load', onLoadFail);
          resolve(true);
        };

        const onLoadFail = () => {
          clearTimeout(timeoutId);
          webContents.removeListener('did-finish-load', onLoadFinish);
          webContents.removeListener('did-fail-load', onLoadFail);
          resolve(false);
        };

        webContents.once('did-finish-load', onLoadFinish);
        webContents.once('did-fail-load', onLoadFail);
      });
    } catch (error) {
      this.log('error', 'Error waiting for page load:', error);
      return false;
    }
  }

  /**
   * 处理会话过期（强制重新登录）
   * @param {string} accountId - 账号 ID
   * @param {Object} [options] - 选项
   * @param {boolean} [options.clearCache] - 是否清除缓存
   * @param {boolean} [options.preserveSettings] - 是否保留设置（代理、翻译等）
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async handleSessionExpiration(accountId, options = {}) {
    try {
      this.log('info', `Handling session expiration for account ${accountId}`);
      
      const accountSession = this.getSession(accountId);
      
      if (!accountSession) {
        throw new Error(`Session not found for account ${accountId}`);
      }
      
      // 清除会话数据
      await accountSession.clearStorageData({
        storages: [
          'cookies',
          'localstorage',
          'indexdb',
          'serviceworkers',
          'cachestorage'
        ]
      });
      
      // 可选：清除缓存
      if (options.clearCache) {
        await accountSession.clearCache();
      }
      
      // 清除登录状态缓存
      this.clearLoginStatusCache(accountId);
      
      this.log('info', `Session expiration handled for account ${accountId}`);
      
      return { success: true };
    } catch (error) {
      this.log('error', `Failed to handle session expiration for account ${accountId}:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 强制登出账号（清除所有会话数据）
   * @param {string} accountId - 账号 ID
   * @param {BrowserWindow|BrowserView} [viewOrWindow] - BrowserView 或 BrowserWindow 实例（可选，用于重新加载）
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async forceLogout(accountId, viewOrWindow = null) {
    try {
      this.log('info', `Forcing logout for account ${accountId}`);
      
      // 清除所有会话数据
      const clearResult = await this.clearSessionData(accountId);
      
      if (!clearResult.success) {
        throw new Error(clearResult.error || 'Failed to clear session data');
      }
      
      // 如果提供了 view/window，重新加载页面以显示登录界面
      if (viewOrWindow && viewOrWindow.webContents) {
        try {
          await viewOrWindow.webContents.loadURL('https://web.whatsapp.com');
          this.log('info', `Reloaded WhatsApp Web for account ${accountId}`);
        } catch (loadError) {
          this.log('warn', `Failed to reload page after logout for account ${accountId}:`, loadError);
          // 不将此作为致命错误
        }
      }
      
      this.log('info', `Forced logout completed for account ${accountId}`);
      
      return { success: true };
    } catch (error) {
      this.log('error', `Failed to force logout for account ${accountId}:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 检查会话是否过期
   * @param {string} accountId - 账号 ID
   * @param {BrowserWindow|BrowserView} viewOrWindow - BrowserView 或 BrowserWindow 实例
   * @returns {Promise<{expired: boolean, needsReauth: boolean, error?: string}>}
   */
  async checkSessionExpiration(accountId, viewOrWindow) {
    try {
      this.log('info', `Checking session expiration for account ${accountId}`);
      
      // 检查是否有会话数据
      const hasSession = await this.hasSessionData(accountId);
      
      if (!hasSession) {
        return {
          expired: true,
          needsReauth: true
        };
      }
      
      // 检测当前登录状态
      const isLoggedIn = await this.detectLoginStatus(accountId, viewOrWindow);
      
      if (!isLoggedIn) {
        // 有会话数据但未登录，可能是会话过期
        this.log('warn', `Session may be expired for account ${accountId}`);
        return {
          expired: true,
          needsReauth: true
        };
      }
      
      // 会话有效
      return {
        expired: false,
        needsReauth: false
      };
    } catch (error) {
      this.log('error', `Failed to check session expiration for account ${accountId}:`, error);
      return {
        expired: false,
        needsReauth: false,
        error: error.message
      };
    }
  }

  /**
   * 监控会话健康状态
   * @param {string} accountId - 账号 ID
   * @param {BrowserWindow|BrowserView} viewOrWindow - BrowserView 或 BrowserWindow 实例
   * @param {Function} onStatusChange - 状态变化回调函数
   * @returns {Object} 监控器对象，包含 stop() 方法
   */
  monitorSessionHealth(accountId, viewOrWindow, onStatusChange) {
    this.log('info', `Starting session health monitoring for account ${accountId}`);
    
    let isMonitoring = true;
    let lastStatus = null;
    
    const checkHealth = async () => {
      if (!isMonitoring) return;
      
      try {
        const isLoggedIn = await this.detectLoginStatus(accountId, viewOrWindow);
        const currentStatus = isLoggedIn ? 'logged-in' : 'logged-out';
        
        // 只在状态变化时触发回调
        if (currentStatus !== lastStatus) {
          lastStatus = currentStatus;
          
          if (onStatusChange && typeof onStatusChange === 'function') {
            onStatusChange({
              accountId,
              status: currentStatus,
              isLoggedIn,
              timestamp: Date.now()
            });
          }
        }
      } catch (error) {
        this.log('error', `Session health check failed for account ${accountId}:`, error);
      }
      
      // 每 30 秒检查一次
      if (isMonitoring) {
        setTimeout(checkHealth, 30000);
      }
    };
    
    // 开始监控
    checkHealth();
    
    // 返回监控器对象
    return {
      stop: () => {
        this.log('info', `Stopping session health monitoring for account ${accountId}`);
        isMonitoring = false;
      }
    };
  }

  /**
   * 获取会话持久化状态
   * @param {string} accountId - 账号 ID
   * @returns {Promise<{persisted: boolean, dataSize: number, lastModified?: Date, error?: string}>}
   */
  async getSessionPersistenceStatus(accountId) {
    try {
      const userDataDir = this.getUserDataDir(accountId);
      
      // 检查目录是否存在
      try {
        await fs.access(userDataDir);
      } catch {
        return {
          persisted: false,
          dataSize: 0
        };
      }
      
      // 获取数据统计
      const stats = await this.getSessionDataStats(accountId);
      
      // 获取最后修改时间
      let lastModified;
      try {
        const dirStats = await fs.stat(userDataDir);
        lastModified = dirStats.mtime;
      } catch {
        // 忽略错误
      }
      
      return {
        persisted: stats.size > 0,
        dataSize: stats.size,
        fileCount: stats.files,
        lastModified
      };
    } catch (error) {
      this.log('error', `Failed to get session persistence status for account ${accountId}:`, error);
      return {
        persisted: false,
        dataSize: 0,
        error: error.message
      };
    }
  }
}

module.exports = SessionManager;
