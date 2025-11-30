/**
 * ViewFactory - 视图创建工厂
 * 
 * 负责创建和配置BrowserView实例
 * 
 * @module presentation/windows/view-manager/ViewFactory
 */

const { BrowserView } = require('electron');
const path = require('path');

/**
 * ViewFactory class
 */
class ViewFactory {
  /**
   * Create ViewFactory instance
   * @param {Object} options - Configuration options
   * @param {Function} [options.logger] - Logger function
   */
  constructor(options = {}) {
    this.options = options;
    this.log = options.logger || this._createLogger();
  }

  /**
   * Create logger function
   * @private
   * @returns {Function}
   */
  _createLogger() {
    return (level, message, ...args) => {
      const timestamp = new Date().toISOString();
      const logMessage = `[${timestamp}] [ViewFactory] [${level.toUpperCase()}] ${message}`;
      
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
   * Create a new BrowserView for an account
   * @param {string} accountId - Unique account identifier
   * @param {Electron.Session} accountSession - Isolated session for the account
   * @param {Object} [config] - View configuration
   * @param {string} [config.userAgent] - Custom user agent
   * @returns {BrowserView} Created BrowserView instance
   */
  createView(accountId, accountSession, config = {}) {
    if (!accountId) {
      throw new Error('Account ID is required');
    }

    if (!accountSession) {
      throw new Error('Account session is required');
    }

    this.log('info', `Creating BrowserView for account ${accountId}`);

    // Create BrowserView with isolated session
    // Set account ID in environment for preload script
    process.env.ACCOUNT_ID = accountId;
    
    // Remove CSP to allow script injection for translation
    accountSession.webRequest.onHeadersReceived((details, callback) => {
      if (details.url.includes('web.whatsapp.com')) {
        const headers = details.responseHeaders;
        
        // Remove CSP entirely to allow our translation script
        delete headers['content-security-policy'];
        delete headers['content-security-policy-report-only'];
        
        this.log('info', `CSP removed for translation injection: ${details.url}`);
        
        callback({ responseHeaders: headers });
      } else {
        callback({ responseHeaders: details.responseHeaders });
      }
    });
    
    // IMPORTANT: Do NOT set both 'partition' and 'session' - they are mutually exclusive!
    // When both are set, 'session' is ignored and a new session is created from 'partition'.
    
    
    const view = new BrowserView({
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: false, // Must be false to allow preload script to inject content
        session: accountSession,
        webSecurity: true,
        allowRunningInsecureContent: false,
        preload: path.join(__dirname, '../../../preload-view.js'),
        additionalArguments: [`--account-id=${accountId}`]
      }
    });


    // Set user agent if provided, otherwise use default WhatsApp-compatible UA
    const userAgent = config.userAgent || this._getDefaultUserAgent();
    view.webContents.setUserAgent(userAgent);

    // Enable DevTools for debugging
    // This allows F12 to work on the BrowserView
    view.webContents.on('before-input-event', (event, input) => {
      // F12 or Ctrl+Shift+I to toggle DevTools
      if (input.key === 'F12' || 
          (input.control && input.shift && input.key === 'I')) {
        if (view.webContents.isDevToolsOpened()) {
          view.webContents.closeDevTools();
        } else {
          view.webContents.openDevTools({ mode: 'detach' });
        }
      }
    });

    // Auto-open DevTools in development mode for debugging
    if (process.env.NODE_ENV === 'development' || process.env.DEBUG_TRANSLATION === 'true') {
      view.webContents.once('did-finish-load', () => {
        this.log('info', `Auto-opening DevTools for account ${accountId} (development mode)`);
        view.webContents.openDevTools({ mode: 'detach' });
      });
    }

    this.log('info', `BrowserView created for account ${accountId}`);

    return view;
  }

  /**
   * Get default user agent for WhatsApp Web compatibility
   * @private
   * @returns {string}
   */
  _getDefaultUserAgent() {
    // Use a modern Chrome user agent that WhatsApp Web accepts
    return 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
  }

  /**
   * Create initial view state object
   * @param {string} accountId - Account ID
   * @param {BrowserView} view - BrowserView instance
   * @param {Electron.Session} session - Session instance
   * @param {Object} [config] - Configuration
   * @returns {Object} View state object
   */
  createViewState(accountId, view, session, config = {}) {
    return {
      accountId,
      view,
      session,
      isVisible: false,
      isLoaded: false,
      bounds: null,
      status: 'created',
      connectionStatus: 'offline', // online/offline/error
      loginStatus: false,
      config: { ...config },
      lastConnectionCheck: null,
      connectionError: null,
      intervals: [],
      connectionMonitor: null,
      loginStatusMonitor: null,
      phoneNumber: null,
      profileName: null,
      avatarUrl: null
    };
  }

  /**
   * Validate session isolation for an account
   * @param {string} accountId - Account ID
   * @param {Electron.Session} accountSession - Account session
   * @param {Map} existingViews - Map of existing views
   * @returns {Promise<{valid: boolean, message?: string}>}
   */
  async validateSessionIsolation(accountId, accountSession, existingViews) {
    try {
      // Check if session has correct partition
      const expectedPartition = `persist:account_${accountId}`;
      const actualPartition = accountSession.partition;
      
      if (actualPartition !== expectedPartition) {
        return {
          valid: false,
          message: `Partition mismatch: expected ${expectedPartition}, got ${actualPartition}`
        };
      }

      // Check if session has storage path (indicates persistence)
      const storagePath = accountSession.getStoragePath();
      if (!storagePath || storagePath.length === 0) {
        return {
          valid: false,
          message: 'Session does not have a storage path'
        };
      }

      // Verify session is not shared with other accounts
      for (const [existingAccountId, viewState] of existingViews) {
        if (existingAccountId !== accountId && viewState.session === accountSession) {
          return {
            valid: false,
            message: `Session is shared with account ${existingAccountId}`
          };
        }
      }

      this.log('debug', `Session isolation validated for ${accountId}: partition=${actualPartition}, storagePath=${storagePath}`);

      return { valid: true };
    } catch (error) {
      this.log('error', `Failed to validate session isolation for ${accountId}:`, error);
      return {
        valid: false,
        message: error.message
      };
    }
  }
}

module.exports = ViewFactory;
