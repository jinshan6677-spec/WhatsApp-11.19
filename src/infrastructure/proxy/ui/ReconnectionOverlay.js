'use strict';

/**
 * ReconnectionOverlay - 重连UI覆盖层
 * 
 * 在BrowserView中注入重连UI，用于显示代理重连状态
 * 
 * UI状态：
 * - reconnecting: 自动重连中，显示进度条和倒计时
 * - failed: 重连失败，显示手动重试、更换代理、关闭会话按钮
 * - success: 重连成功，显示成功提示（3秒后自动消失）
 * 
 * @module infrastructure/proxy/ui/ReconnectionOverlay
 */

/**
 * ReconnectionOverlay class
 */
class ReconnectionOverlay {
  /**
   * Creates a ReconnectionOverlay instance
   * @param {Object} [options={}] - Configuration options
   * @param {Function} [options.logger] - Logger function
   */
  constructor(options = {}) {
    this.options = options;
    this.log = options.logger || this._createLogger();
    this._injectedViews = new Set();
  }

  /**
   * Creates a default logger
   * @private
   * @returns {Function}
   */
  _createLogger() {
    return (level, message, ...args) => {
      const timestamp = new Date().toISOString();
      const prefix = `[${timestamp}] [ReconnectionOverlay] [${level.toUpperCase()}]`;
      
      if (level === 'error') {
        console.error(prefix, message, ...args);
      } else if (level === 'warn') {
        console.warn(prefix, message, ...args);
      } else {
        console.log(prefix, message, ...args);
      }
    };
  }

  /**
   * Gets the CSS styles for the overlay
   * @private
   * @returns {string}
   */
  _getStyles() {
    return `
      .proxy-reconnect-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.7);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 999999;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
      }
      
      .proxy-reconnect-content {
        background: #fff;
        border-radius: 12px;
        padding: 32px;
        max-width: 400px;
        width: 90%;
        text-align: center;
        box-shadow: 0 4px 24px rgba(0, 0, 0, 0.3);
      }
      
      .proxy-reconnect-icon {
        font-size: 48px;
        margin-bottom: 16px;
      }
      
      .proxy-reconnect-title {
        font-size: 18px;
        font-weight: 600;
        color: #1a1a1a;
        margin-bottom: 8px;
      }
      
      .proxy-reconnect-message {
        font-size: 14px;
        color: #666;
        margin-bottom: 24px;
        line-height: 1.5;
      }
      
      .proxy-reconnect-progress {
        width: 100%;
        height: 4px;
        background: #e0e0e0;
        border-radius: 2px;
        overflow: hidden;
        margin-bottom: 16px;
      }
      
      .proxy-reconnect-progress-bar {
        height: 100%;
        background: linear-gradient(90deg, #25D366, #128C7E);
        border-radius: 2px;
        transition: width 0.3s ease;
      }
      
      .proxy-reconnect-countdown {
        font-size: 13px;
        color: #888;
        margin-bottom: 16px;
      }
      
      .proxy-reconnect-buttons {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      
      .proxy-reconnect-btn {
        padding: 12px 24px;
        border-radius: 8px;
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        border: none;
        transition: all 0.2s ease;
      }
      
      .proxy-reconnect-btn-primary {
        background: #25D366;
        color: #fff;
      }
      
      .proxy-reconnect-btn-primary:hover {
        background: #128C7E;
      }
      
      .proxy-reconnect-btn-secondary {
        background: #f0f0f0;
        color: #333;
      }
      
      .proxy-reconnect-btn-secondary:hover {
        background: #e0e0e0;
      }
      
      .proxy-reconnect-btn-danger {
        background: #ff4444;
        color: #fff;
      }
      
      .proxy-reconnect-btn-danger:hover {
        background: #cc0000;
      }
      
      .proxy-reconnect-success {
        animation: fadeInOut 3s ease forwards;
      }
      
      @keyframes fadeInOut {
        0% { opacity: 0; transform: scale(0.9); }
        10% { opacity: 1; transform: scale(1); }
        80% { opacity: 1; }
        100% { opacity: 0; }
      }
      
      .proxy-reconnect-spinner {
        width: 40px;
        height: 40px;
        border: 3px solid #e0e0e0;
        border-top-color: #25D366;
        border-radius: 50%;
        animation: spin 1s linear infinite;
        margin: 0 auto 16px;
      }
      
      @keyframes spin {
        to { transform: rotate(360deg); }
      }
    `;
  }

  /**
   * Gets the HTML for reconnecting state
   * @private
   * @param {number} attempt - Current attempt number
   * @param {number} maxAttempts - Maximum attempts
   * @param {number} countdown - Countdown in seconds
   * @returns {string}
   */
  _getReconnectingHTML(attempt, maxAttempts, countdown) {
    const progress = (attempt / maxAttempts) * 100;
    return `
      <div class="proxy-reconnect-overlay" id="proxy-reconnect-overlay">
        <div class="proxy-reconnect-content">
          <div class="proxy-reconnect-spinner"></div>
          <div class="proxy-reconnect-title">代理重连中...</div>
          <div class="proxy-reconnect-message">
            正在尝试重新连接代理服务器<br>
            第 ${attempt} 次尝试，共 ${maxAttempts} 次
          </div>
          <div class="proxy-reconnect-progress">
            <div class="proxy-reconnect-progress-bar" style="width: ${progress}%"></div>
          </div>
          <div class="proxy-reconnect-countdown">
            ${countdown > 0 ? `下次重试: ${countdown}秒` : '正在连接...'}
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Gets the HTML for failed state
   * @private
   * @param {string} errorMessage - Error message
   * @returns {string}
   */
  _getFailedHTML(errorMessage) {
    return `
      <div class="proxy-reconnect-overlay" id="proxy-reconnect-overlay">
        <div class="proxy-reconnect-content">
          <div class="proxy-reconnect-icon">⚠️</div>
          <div class="proxy-reconnect-title">代理连接失败</div>
          <div class="proxy-reconnect-message">
            ${errorMessage || '无法连接到代理服务器，请检查代理配置或网络连接'}
          </div>
          <div class="proxy-reconnect-buttons">
            <button class="proxy-reconnect-btn proxy-reconnect-btn-primary" onclick="window.__proxyReconnect && window.__proxyReconnect.retry()">
              🔄 重新连接
            </button>
            <button class="proxy-reconnect-btn proxy-reconnect-btn-secondary" onclick="window.__proxyReconnect && window.__proxyReconnect.switchProxy()">
              🔀 更换代理
            </button>
            <button class="proxy-reconnect-btn proxy-reconnect-btn-danger" onclick="window.__proxyReconnect && window.__proxyReconnect.close()">
              ✕ 关闭会话
            </button>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Gets the HTML for success state
   * @private
   * @returns {string}
   */
  _getSuccessHTML() {
    return `
      <div class="proxy-reconnect-overlay proxy-reconnect-success" id="proxy-reconnect-overlay">
        <div class="proxy-reconnect-content">
          <div class="proxy-reconnect-icon">✅</div>
          <div class="proxy-reconnect-title">连接成功</div>
          <div class="proxy-reconnect-message">
            代理已重新连接，页面即将刷新
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Injects the overlay into a webContents
   * @param {Electron.WebContents} webContents - WebContents to inject into
   * @param {string} state - State: 'reconnecting', 'failed', 'success'
   * @param {Object} [options={}] - State-specific options
   * @returns {Promise<boolean>}
   */
  async inject(webContents, state, options = {}) {
    if (!webContents || webContents.isDestroyed()) {
      this.log('warn', 'Cannot inject overlay: webContents is null or destroyed');
      return false;
    }

    try {
      const styles = this._getStyles();
      let html;

      switch (state) {
        case 'reconnecting':
          html = this._getReconnectingHTML(
            options.attempt || 1,
            options.maxAttempts || 3,
            options.countdown || 0
          );
          break;
        case 'failed':
          html = this._getFailedHTML(options.errorMessage);
          break;
        case 'success':
          html = this._getSuccessHTML();
          break;
        default:
          this.log('warn', `Unknown overlay state: ${state}`);
          return false;
      }

      const script = `
        (function() {
          // Remove existing overlay
          const existing = document.getElementById('proxy-reconnect-overlay');
          if (existing) existing.remove();
          
          // Remove existing styles
          const existingStyle = document.getElementById('proxy-reconnect-styles');
          if (existingStyle) existingStyle.remove();
          
          // Inject styles
          const style = document.createElement('style');
          style.id = 'proxy-reconnect-styles';
          style.textContent = ${JSON.stringify(styles)};
          document.head.appendChild(style);
          
          // Inject HTML
          const container = document.createElement('div');
          container.innerHTML = ${JSON.stringify(html)};
          document.body.appendChild(container.firstElementChild);
          
          return true;
        })();
      `;

      await webContents.executeJavaScript(script);
      this._injectedViews.add(webContents.id);
      this.log('info', `Overlay injected with state: ${state}`);
      return true;
    } catch (error) {
      this.log('error', `Failed to inject overlay: ${error.message}`);
      return false;
    }
  }

  /**
   * Updates the countdown in the overlay
   * @param {Electron.WebContents} webContents - WebContents
   * @param {number} countdown - Countdown in seconds
   * @returns {Promise<boolean>}
   */
  async updateCountdown(webContents, countdown) {
    if (!webContents || webContents.isDestroyed()) {
      return false;
    }

    try {
      const script = `
        (function() {
          const el = document.querySelector('.proxy-reconnect-countdown');
          if (el) {
            el.textContent = ${countdown > 0 ? `'下次重试: ${countdown}秒'` : "'正在连接...'"};
          }
          return true;
        })();
      `;
      await webContents.executeJavaScript(script);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Updates the progress in the overlay
   * @param {Electron.WebContents} webContents - WebContents
   * @param {number} attempt - Current attempt
   * @param {number} maxAttempts - Maximum attempts
   * @returns {Promise<boolean>}
   */
  async updateProgress(webContents, attempt, maxAttempts) {
    if (!webContents || webContents.isDestroyed()) {
      return false;
    }

    try {
      const progress = (attempt / maxAttempts) * 100;
      const script = `
        (function() {
          const bar = document.querySelector('.proxy-reconnect-progress-bar');
          if (bar) {
            bar.style.width = '${progress}%';
          }
          const msg = document.querySelector('.proxy-reconnect-message');
          if (msg) {
            msg.innerHTML = '正在尝试重新连接代理服务器<br>第 ${attempt} 次尝试，共 ${maxAttempts} 次';
          }
          return true;
        })();
      `;
      await webContents.executeJavaScript(script);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Removes the overlay from a webContents
   * @param {Electron.WebContents} webContents - WebContents
   * @returns {Promise<boolean>}
   */
  async remove(webContents) {
    if (!webContents || webContents.isDestroyed()) {
      return false;
    }

    try {
      const script = `
        (function() {
          const overlay = document.getElementById('proxy-reconnect-overlay');
          if (overlay) overlay.remove();
          const style = document.getElementById('proxy-reconnect-styles');
          if (style) style.remove();
          return true;
        })();
      `;
      await webContents.executeJavaScript(script);
      this._injectedViews.delete(webContents.id);
      this.log('info', 'Overlay removed');
      return true;
    } catch (error) {
      this.log('error', `Failed to remove overlay: ${error.message}`);
      return false;
    }
  }

  /**
   * Sets up callback handlers in the webContents
   * @param {Electron.WebContents} webContents - WebContents
   * @param {Object} callbacks - Callback functions
   * @param {Function} callbacks.onRetry - Called when retry button is clicked
   * @param {Function} callbacks.onSwitchProxy - Called when switch proxy button is clicked
   * @param {Function} callbacks.onClose - Called when close button is clicked
   * @returns {Promise<boolean>}
   */
  async setupCallbacks(webContents, callbacks) {
    if (!webContents || webContents.isDestroyed()) {
      return false;
    }

    try {
      // Set up IPC listeners for callbacks
      const script = `
        (function() {
          window.__proxyReconnect = {
            retry: function() {
              if (window.electronAPI && window.electronAPI.send) {
                window.electronAPI.send('proxy-reconnect-retry');
              }
            },
            switchProxy: function() {
              if (window.electronAPI && window.electronAPI.send) {
                window.electronAPI.send('proxy-reconnect-switch');
              }
            },
            close: function() {
              if (window.electronAPI && window.electronAPI.send) {
                window.electronAPI.send('proxy-reconnect-close');
              }
            }
          };
          return true;
        })();
      `;
      await webContents.executeJavaScript(script);
      return true;
    } catch (error) {
      this.log('error', `Failed to setup callbacks: ${error.message}`);
      return false;
    }
  }

  /**
   * Shows success state and auto-removes after delay
   * @param {Electron.WebContents} webContents - WebContents
   * @param {number} [delay=3000] - Delay before removal in ms
   * @returns {Promise<boolean>}
   */
  async showSuccessAndRemove(webContents, delay = 3000) {
    const injected = await this.inject(webContents, 'success');
    if (!injected) return false;

    setTimeout(async () => {
      await this.remove(webContents);
    }, delay);

    return true;
  }

  /**
   * Checks if overlay is injected in a webContents
   * @param {Electron.WebContents} webContents - WebContents
   * @returns {boolean}
   */
  isInjected(webContents) {
    if (!webContents) return false;
    return this._injectedViews.has(webContents.id);
  }

  /**
   * Cleans up all injected overlays
   */
  cleanup() {
    this._injectedViews.clear();
    this.log('info', 'All overlay references cleared');
  }
}

module.exports = ReconnectionOverlay;
