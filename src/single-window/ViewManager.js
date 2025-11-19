/**
 * ViewManager - BrowserView Lifecycle Manager
 * 
 * Manages BrowserView instances for each WhatsApp account in the single-window architecture.
 * Handles view creation, switching, hiding, and destruction while maintaining session isolation.
 * 
 * Bounds Management:
 * - Automatically calculates BrowserView bounds based on sidebar width and window size
 * - Handles window resize events with debouncing to prevent excessive recalculation
 * - Handles sidebar resize events to update view bounds dynamically
 * - Updates all views (visible and hidden) to ensure correct bounds when they become visible
 */

const { BrowserView } = require('electron');
const path = require('path');
const {
  validateViewCreationParams,
  validateAccountSwitch,
  handleNetworkFailure,
  handleViewCreationFailure
} = require('../utils/ValidationHelper');

/**
 * ViewManager class
 */
class ViewManager {
  /**
   * Create ViewManager instance
   * @param {MainWindow} mainWindow - MainWindow instance
   * @param {SessionManager} sessionManager - SessionManager instance
   * @param {Object} [options] - Configuration options
   * @param {number} [options.defaultSidebarWidth] - Default sidebar width in pixels
   * @param {TranslationIntegration} [options.translationIntegration] - Translation integration instance
   */
  constructor(mainWindow, sessionManager, options = {}) {
    if (!mainWindow) {
      throw new Error('MainWindow instance is required');
    }
    if (!sessionManager) {
      throw new Error('SessionManager instance is required');
    }

    this.mainWindow = mainWindow;
    this.sessionManager = sessionManager;
    this.translationIntegration = options.translationIntegration || null;
    this.options = {
      defaultSidebarWidth: options.defaultSidebarWidth || 280,
      debounceDelay: options.debounceDelay || 100,
      lazyLoadViews: options.lazyLoadViews !== false, // Default: true
      maxConcurrentViews: options.maxConcurrentViews || 10,
      viewPoolSize: options.viewPoolSize || 2,
      ...options
    };

    // Map: accountId -> ViewState
    this.views = new Map();
    
    // Currently active account ID
    this.activeAccountId = null;

    // Debounce timer for resize operations
    this.resizeDebounceTimer = null;

    // Logger
    this.log = this._createLogger();

    // Get state store from MainWindow for persistence
    this.stateStore = this.mainWindow.getStateStore();

    // Performance optimization: Bounds cache
    this.boundsCache = {
      lastSidebarWidth: null,
      lastWindowBounds: null,
      cachedBounds: null,
      cacheTimestamp: null
    };

    // Performance optimization: View pool for reuse
    this.viewPool = [];

    // Performance optimization: Track view access times for memory management
    this.viewAccessTimes = new Map();

    // Memory management: Track memory usage per view
    this.memoryUsageCache = new Map();
    this.memoryMonitorInterval = null;

    // Memory limits per BrowserView (in MB)
    this.memoryLimits = {
      warningThreshold: options.memoryWarningThreshold || 300, // MB
      maxMemory: options.maxMemoryPerView || 500, // MB
      autoCleanupEnabled: options.autoMemoryCleanup !== false // Default: true
    };

    // Start memory monitoring if enabled
    if (this.memoryLimits.autoCleanupEnabled) {
      this._startMemoryMonitoring();
    }
  }

  /**
   * Create logger function
   * @private
   * @returns {Function}
   */
  _createLogger() {
    return (level, message, ...args) => {
      const timestamp = new Date().toISOString();
      const logMessage = `[${timestamp}] [ViewManager] [${level.toUpperCase()}] ${message}`;
      
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
   * Save active account ID to persistent storage
   * @private
   */
  _saveActiveAccountId() {
    try {
      if (this.activeAccountId) {
        this.stateStore.set('activeAccountId', this.activeAccountId);
        this.log('debug', `Saved active account ID: ${this.activeAccountId}`);
      } else {
        this.stateStore.delete('activeAccountId');
        this.log('debug', 'Cleared active account ID');
      }
    } catch (error) {
      this.log('error', 'Failed to save active account ID:', error);
    }
  }

  /**
   * Get saved active account ID from persistent storage
   * @returns {string|null} Saved active account ID
   */
  getSavedActiveAccountId() {
    try {
      const savedAccountId = this.stateStore.get('activeAccountId', null);
      if (savedAccountId) {
        this.log('debug', `Retrieved saved active account ID: ${savedAccountId}`);
      }
      return savedAccountId;
    } catch (error) {
      this.log('error', 'Failed to get saved active account ID:', error);
      return null;
    }
  }

  /**
   * Restore active account from saved state
   * @param {Array} availableAccounts - List of available account IDs
   * @returns {Promise<Object>} Result object with success status
   */
  async restoreActiveAccount(availableAccounts = []) {
    try {
      const savedAccountId = this.getSavedActiveAccountId();
      
      if (!savedAccountId) {
        this.log('info', 'No saved active account to restore');
        return {
          success: false,
          reason: 'no_saved_account'
        };
      }

      // Check if saved account still exists
      const accountExists = availableAccounts.includes(savedAccountId);
      
      if (!accountExists) {
        this.log('warn', `Saved account ${savedAccountId} no longer exists`);
        this.stateStore.delete('activeAccountId');
        return {
          success: false,
          reason: 'account_not_found',
          accountId: savedAccountId
        };
      }

      this.log('info', `Restoring active account: ${savedAccountId}`);

      // Switch to the saved account
      const result = await this.switchView(savedAccountId, {
        createIfMissing: true
      });

      if (result.success) {
        this.log('info', `Successfully restored active account: ${savedAccountId}`);
        
        // Restore login state for the account
        await this._restoreAccountLoginState(savedAccountId);
        
        return {
          success: true,
          accountId: savedAccountId
        };
      } else {
        this.log('error', `Failed to restore active account: ${result.error}`);
        return {
          success: false,
          reason: 'switch_failed',
          error: result.error,
          accountId: savedAccountId
        };
      }
    } catch (error) {
      this.log('error', 'Failed to restore active account:', error);
      return {
        success: false,
        reason: 'exception',
        error: error.message
      };
    }
  }

  /**
   * Restore login state for an account
   * @private
   * @param {string} accountId - Account ID
   * @returns {Promise<void>}
   */
  async _restoreAccountLoginState(accountId) {
    try {
      const viewState = this.views.get(accountId);
      if (!viewState) {
        this.log('warn', `Cannot restore login state: view for account ${accountId} not found`);
        return;
      }

      this.log('info', `Restoring login state for account ${accountId}`);

      // Use SessionManager to restore login state
      const restoreResult = await this.sessionManager.restoreLoginState(
        accountId,
        viewState.view
      );

      if (restoreResult.success) {
        viewState.loginStatus = restoreResult.isLoggedIn;
        
        // Notify renderer about login status
        this._notifyRenderer('login-status-restored', {
          accountId,
          isLoggedIn: restoreResult.isLoggedIn
        });

        if (restoreResult.isLoggedIn) {
          this.log('info', `Login state restored for account ${accountId}: logged in`);
        } else {
          this.log('info', `Login state restored for account ${accountId}: not logged in`);
        }
      } else {
        this.log('error', `Failed to restore login state for account ${accountId}: ${restoreResult.error}`);
      }
    } catch (error) {
      this.log('error', `Error restoring login state for account ${accountId}:`, error);
    }
  }

  /**
   * Restore login states for all accounts
   * @returns {Promise<Object>} Restoration results
   */
  async restoreAllLoginStates() {
    this.log('info', 'Restoring login states for all accounts');

    const results = {
      total: this.views.size,
      restored: 0,
      failed: 0,
      details: []
    };

    for (const [accountId, viewState] of this.views) {
      try {
        const restoreResult = await this.sessionManager.restoreLoginState(
          accountId,
          viewState.view
        );

        if (restoreResult.success) {
          viewState.loginStatus = restoreResult.isLoggedIn;
          results.restored++;
          results.details.push({
            accountId,
            status: 'restored',
            isLoggedIn: restoreResult.isLoggedIn
          });
        } else {
          results.failed++;
          results.details.push({
            accountId,
            status: 'failed',
            error: restoreResult.error
          });
        }
      } catch (error) {
        results.failed++;
        results.details.push({
          accountId,
          status: 'error',
          error: error.message
        });
      }
    }

    this.log('info', `Login state restoration complete: ${results.restored} restored, ${results.failed} failed`);

    return results;
  }

  /**
   * Create a new BrowserView for an account
   * @param {string} accountId - Unique account identifier
   * @param {Object} [config] - View configuration
   * @param {string} [config.url] - URL to load (default: WhatsApp Web)
   * @param {string} [config.userAgent] - Custom user agent
   * @param {Object} [config.proxy] - Proxy configuration
   * @returns {Promise<BrowserView>} Created BrowserView instance
   */
  async createView(accountId, config = {}) {
    try {
      if (!accountId) {
        throw new Error('Account ID is required');
      }

      // Validate view creation parameters
      const validation = validateViewCreationParams(accountId, config);
      if (!validation.valid) {
        const errorMsg = `Invalid view creation parameters: ${validation.errors.join(', ')}`;
        this.log('error', errorMsg);
        throw new Error(errorMsg);
      }

      // Check if view already exists
      if (this.views.has(accountId)) {
        this.log('warn', `View for account ${accountId} already exists`);
        return this.views.get(accountId).view;
      }

      this.log('info', `Creating view for account ${accountId}`);

      // Get isolated session for this account
      const accountSession = this.sessionManager.getInstanceSession(accountId);

      // Validate session isolation
      const isolationValidation = await this._validateSessionIsolation(accountId, accountSession);
      if (!isolationValidation.valid) {
        this.log('warn', `Session isolation validation warning for ${accountId}: ${isolationValidation.message}`);
      }

      // Configure proxy if provided
      if (config.proxy && config.proxy.enabled) {
        await this._configureProxy(accountId, accountSession, config.proxy);
      }

      // Create BrowserView with isolated session
      const view = new BrowserView({
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          sandbox: true,
          partition: `persist:account_${accountId}`,
          session: accountSession,
          webSecurity: true,
          allowRunningInsecureContent: false,
          preload: path.join(__dirname, '../preload.js')
        }
      });

      // Verify the view's session matches the expected session
      if (view.webContents.session !== accountSession) {
        throw new Error(`Session mismatch: BrowserView session does not match expected session for account ${accountId}`);
      }

      this.log('info', `Session isolation verified for account ${accountId}`);

      // Set user agent if provided, otherwise use default WhatsApp-compatible UA
      const userAgent = config.userAgent || this._getDefaultUserAgent();
      view.webContents.setUserAgent(userAgent);

      // Initialize view state
      const viewState = {
        accountId,
        view,
        session: accountSession,
        isVisible: false,
        isLoaded: false,
        bounds: null,
        status: 'created',
        connectionStatus: 'offline', // online/offline/error
        loginStatus: false,
        config: { ...config },
        lastConnectionCheck: null,
        connectionError: null
      };

      // Store view state
      this.views.set(accountId, viewState);

      // Set up view event handlers
      this._setupViewEventHandlers(accountId, view);

      // Inject translation scripts if TranslationIntegration is available
      // Always inject translation scripts, use default config if not provided
      if (this.translationIntegration) {
        try {
          this.log('info', `Injecting translation scripts for account ${accountId}`);
          
          // Use provided translation config or default
          const translationConfig = config.translation || {
            enabled: true,
            targetLanguage: 'zh-CN',
            engine: 'google',
            apiKey: '',
            autoTranslate: false,
            translateInput: false,
            friendSettings: {}
          };
          
          const injectionResult = await this.translationIntegration.injectScripts(
            accountId,
            view,
            translationConfig
          );
          
          if (injectionResult.success) {
            this.log('info', `Translation scripts injected for account ${accountId}`);
          } else {
            this.log('warn', `Failed to inject translation scripts for account ${accountId}: ${injectionResult.error}`);
          }
        } catch (injectionError) {
          this.log('error', `Error injecting translation scripts for account ${accountId}:`, injectionError);
        }
      }

      // Load URL if provided, otherwise load WhatsApp Web
      const url = config.url || 'https://web.whatsapp.com';
      
      try {
        viewState.status = 'loading';
        
        // Notify renderer that view is being created
        this._notifyRenderer('view-created', { accountId, url });
        
        await view.webContents.loadURL(url);
        
        this.log('info', `View created and loading for account ${accountId}`);
      } catch (loadError) {
        this.log('error', `Failed to load URL for account ${accountId}:`, loadError);
        viewState.status = 'error';
        viewState.errorInfo = {
          message: loadError.message,
          code: loadError.code,
          timestamp: Date.now()
        };
        
        // Still return the view even if initial load fails
        // User can retry later
        this._notifyRenderer('view-error', {
          accountId,
          status: 'error',
          error: {
            message: loadError.message,
            code: loadError.code
          }
        });
      }

      this.log('info', `View created for account ${accountId}`);

      return view;
    } catch (error) {
      this.log('error', `Failed to create view for account ${accountId}:`, error);
      
      // Handle view creation failure with user-friendly message
      const failureInfo = handleViewCreationFailure(error, accountId);
      this.log('error', `View creation failure details: ${failureInfo.technicalDetails}`);
      this.log('info', `Suggested action: ${failureInfo.suggestedAction}`);
      
      // Clean up if view was partially created
      if (this.views.has(accountId)) {
        const viewState = this.views.get(accountId);
        if (viewState && viewState.view && !viewState.view.webContents.isDestroyed()) {
          try {
            viewState.view.webContents.destroy();
          } catch (destroyError) {
            this.log('error', `Failed to destroy view during cleanup:`, destroyError);
          }
        }
        this.views.delete(accountId);
      }
      
      // Notify renderer with user-friendly error
      this._notifyRenderer('view-creation-failed', {
        accountId,
        userMessage: failureInfo.userMessage,
        suggestedAction: failureInfo.suggestedAction,
        timestamp: Date.now()
      });
      
      throw error;
    }
  }

  /**
   * Validate session isolation for an account
   * @private
   * @param {string} accountId - Account ID
   * @param {Electron.Session} accountSession - Account session
   * @returns {Promise<{valid: boolean, message?: string}>}
   */
  async _validateSessionIsolation(accountId, accountSession) {
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
      for (const [existingAccountId, viewState] of this.views) {
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

  /**
   * Configure proxy for account session
   * @private
   * @param {string} accountId - Account ID
   * @param {Electron.Session} accountSession - Account session
   * @param {Object} proxyConfig - Proxy configuration
   */
  async _configureProxy(accountId, accountSession, proxyConfig) {
    try {
      const { protocol, host, port, username, password, bypass } = proxyConfig;

      if (!host || !port) {
        throw new Error('Proxy host and port are required');
      }

      // Build proxy rules
      let proxyRules = `${protocol || 'http'}://${host}:${port}`;
      
      // Set proxy configuration
      await accountSession.setProxy({
        proxyRules,
        proxyBypassRules: bypass || 'localhost,127.0.0.1'
      });

      // Handle proxy authentication if credentials provided
      if (username && password) {
        accountSession.webRequest.onBeforeSendHeaders((details, callback) => {
          const authHeader = Buffer.from(`${username}:${password}`).toString('base64');
          details.requestHeaders['Proxy-Authorization'] = `Basic ${authHeader}`;
          callback({ requestHeaders: details.requestHeaders });
        });
      }

      this.log('info', `Proxy configured for account ${accountId}: ${proxyRules}`);
    } catch (error) {
      this.log('error', `Failed to configure proxy for account ${accountId}:`, error);
      throw error;
    }
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
   * Set up event handlers for a BrowserView
   * @private
   * @param {string} accountId - Account ID
   * @param {BrowserView} view - BrowserView instance
   */
  _setupViewEventHandlers(accountId, view) {
    const viewState = this.views.get(accountId);
    if (!viewState) return;

    // Handle page load start
    view.webContents.on('did-start-loading', () => {
      viewState.status = 'loading';
      viewState.isLoaded = false;
      this.log('info', `View started loading for account ${accountId}`);
      
      // Notify renderer about loading state
      this._notifyRenderer('view-loading', { accountId, status: 'loading' });
    });

    // Handle page load completion
    view.webContents.on('did-finish-load', async () => {
      viewState.isLoaded = true;
      viewState.status = 'ready';
      this.log('info', `View loaded for account ${accountId}`);
      
      // Detect login status (QR code vs logged in)
      await this._detectLoginStatus(accountId, view);
      
      // Detect connection status
      await this._detectConnectionStatus(accountId, view);
      
      // Notify renderer about ready state
      this._notifyRenderer('view-ready', { 
        accountId, 
        status: 'ready',
        loginStatus: viewState.loginStatus,
        connectionStatus: viewState.connectionStatus
      });
    });

    // Handle load failures
    view.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
      // Ignore certain error codes that are not critical
      const ignoredErrors = [
        -3,   // ERR_ABORTED (user navigation)
        -27,  // ERR_BLOCKED_BY_CLIENT (ad blockers, etc)
      ];
      
      if (ignoredErrors.includes(errorCode)) {
        this.log('debug', `Ignoring non-critical error for account ${accountId}: ${errorCode}`);
        return;
      }

      viewState.status = 'error';
      viewState.connectionStatus = 'error';
      viewState.connectionError = {
        code: errorCode,
        description: errorDescription,
        url: validatedURL,
        timestamp: Date.now()
      };
      viewState.errorInfo = viewState.connectionError;
      
      this.log('error', `View load failed for account ${accountId}: ${errorDescription} (${errorCode}) at ${validatedURL}`);
      
      // Notify renderer about error
      this._notifyRenderer('view-error', { 
        accountId, 
        status: 'error',
        connectionStatus: 'error',
        error: {
          code: errorCode,
          message: errorDescription,
          url: validatedURL
        }
      });
      
      // Notify about connection status change
      this._notifyRenderer('connection-status-changed', {
        accountId,
        connectionStatus: 'error',
        error: {
          code: errorCode,
          message: errorDescription
        }
      });
    });

    // Handle navigation
    view.webContents.on('did-navigate', (_event, url) => {
      this.log('info', `View navigated for account ${accountId}: ${url}`);
      
      // Notify renderer about navigation
      this._notifyRenderer('view-navigated', { accountId, url });
    });

    // Handle navigation in page (SPA routing)
    view.webContents.on('did-navigate-in-page', async (_event, url) => {
      this.log('debug', `View navigated in page for account ${accountId}: ${url}`);
      
      // Re-detect login status on navigation
      await this._detectLoginStatus(accountId, view);
      
      // Re-detect connection status on navigation
      await this._detectConnectionStatus(accountId, view);
    });

    // Handle console messages (for debugging)
    view.webContents.on('console-message', (_event, _level, message) => {
      if (process.env.NODE_ENV === 'development') {
        this.log('debug', `[Account ${accountId} Console] ${message}`);
      }
    });

    // Handle crashes
    view.webContents.on('render-process-gone', (_event, details) => {
      viewState.status = 'error';
      viewState.connectionStatus = 'error';
      viewState.connectionError = {
        reason: details.reason,
        exitCode: details.exitCode,
        timestamp: Date.now()
      };
      viewState.errorInfo = viewState.connectionError;
      
      this.log('error', `View render process gone for account ${accountId}:`, details);
      
      // Notify renderer about crash
      this._notifyRenderer('view-crashed', { 
        accountId, 
        status: 'error',
        connectionStatus: 'error',
        error: {
          reason: details.reason,
          exitCode: details.exitCode
        }
      });
      
      // Notify about connection status change
      this._notifyRenderer('connection-status-changed', {
        accountId,
        connectionStatus: 'error',
        error: {
          reason: details.reason,
          exitCode: details.exitCode
        }
      });
    });

    // Handle unresponsive page
    view.webContents.on('unresponsive', () => {
      this.log('warn', `View became unresponsive for account ${accountId}`);
      
      // Notify renderer
      this._notifyRenderer('view-unresponsive', { accountId });
    });

    // Handle page becoming responsive again
    view.webContents.on('responsive', () => {
      this.log('info', `View became responsive again for account ${accountId}`);
      
      // Notify renderer
      this._notifyRenderer('view-responsive', { accountId });
    });
  }

  /**
   * Detect WhatsApp login status (QR code vs logged in)
   * @private
   * @param {string} accountId - Account ID
   * @param {BrowserView} view - BrowserView instance
   * @returns {Promise<boolean>} Login status (true if logged in)
   */
  async _detectLoginStatus(accountId, view) {
    try {
      const viewState = this.views.get(accountId);
      if (!viewState) return false;

      // Execute script to detect QR code or chat interface
      const loginStatus = await view.webContents.executeJavaScript(`
        (function() {
          // Check for QR code canvas (not logged in)
          const qrCode = document.querySelector('canvas[aria-label*="QR"]') || 
                         document.querySelector('canvas[aria-label*="Code"]') ||
                         document.querySelector('[data-ref][data-ref*="qr"]') ||
                         document.querySelector('div[data-ref="qr-code"]');
          
          // Check for chat interface (logged in)
          const chatPane = document.querySelector('[data-testid="chat-list"]') ||
                          document.querySelector('#pane-side') ||
                          document.querySelector('[data-testid="conversation-panel-wrapper"]') ||
                          document.querySelector('div[data-testid="chat"]');
          
          // Check for main app container
          const appContainer = document.querySelector('#app') || document.querySelector('[data-testid="app"]');
          
          // Check for login prompt text
          const loginPrompt = document.querySelector('[data-testid="qrcode-container"]') ||
                             document.querySelector('div[data-ref="qr-code-container"]');
          
          // Check if QR code is visible (not just present in DOM)
          const qrCodeVisible = qrCode && qrCode.offsetParent !== null;
          
          // Check if chat pane is visible
          const chatPaneVisible = chatPane && chatPane.offsetParent !== null;
          
          return {
            hasQRCode: !!qrCode,
            qrCodeVisible: qrCodeVisible,
            hasChatPane: !!chatPane,
            chatPaneVisible: chatPaneVisible,
            hasAppContainer: !!appContainer,
            hasLoginPrompt: !!loginPrompt,
            isLoggedIn: chatPaneVisible && !qrCodeVisible
          };
        })();
      `);

      const wasLoggedIn = viewState.loginStatus;
      viewState.loginStatus = loginStatus.isLoggedIn;
      viewState.loginInfo = {
        hasQRCode: loginStatus.hasQRCode,
        qrCodeVisible: loginStatus.qrCodeVisible,
        hasChatPane: loginStatus.hasChatPane,
        chatPaneVisible: loginStatus.chatPaneVisible,
        hasAppContainer: loginStatus.hasAppContainer,
        hasLoginPrompt: loginStatus.hasLoginPrompt,
        detectedAt: Date.now()
      };

      // Update connection status based on login status
      if (loginStatus.isLoggedIn) {
        viewState.connectionStatus = 'online';
        viewState.connectionError = null;
      } else if (loginStatus.qrCodeVisible || loginStatus.hasLoginPrompt) {
        viewState.connectionStatus = 'offline';
        viewState.connectionError = null;
      }

      if (loginStatus.qrCodeVisible || loginStatus.hasLoginPrompt) {
        this.log('info', `Account ${accountId} showing QR code (not logged in)`);
      } else if (loginStatus.isLoggedIn) {
        this.log('info', `Account ${accountId} is logged in`);
      } else {
        this.log('debug', `Account ${accountId} login status unclear, may still be loading`);
      }

      // Notify renderer about login status with detailed information
      this._notifyRenderer('login-status-changed', {
        accountId,
        isLoggedIn: loginStatus.isLoggedIn,
        hasQRCode: loginStatus.qrCodeVisible || loginStatus.hasLoginPrompt,
        loginInfo: viewState.loginInfo
      });

      // Notify about connection status change if login status changed
      if (wasLoggedIn !== loginStatus.isLoggedIn) {
        this._notifyRenderer('connection-status-changed', {
          accountId,
          connectionStatus: viewState.connectionStatus,
          isLoggedIn: loginStatus.isLoggedIn,
          hasQRCode: loginStatus.qrCodeVisible || loginStatus.hasLoginPrompt
        });
      }

      return loginStatus.isLoggedIn;
    } catch (error) {
      this.log('error', `Failed to detect login status for account ${accountId}:`, error);
      return false;
    }
  }

  /**
   * Get login status for an account
   * @param {string} accountId - Account ID
   * @returns {boolean|null} Login status (true if logged in, false if not, null if unknown)
   */
  getLoginStatus(accountId) {
    const viewState = this.views.get(accountId);
    if (!viewState) return null;
    return viewState.loginStatus;
  }

  /**
   * Get login info for an account
   * @param {string} accountId - Account ID
   * @returns {Object|null} Login info object or null if not available
   */
  getLoginInfo(accountId) {
    const viewState = this.views.get(accountId);
    if (!viewState) return null;
    return viewState.loginInfo || null;
  }

  /**
   * Detect WhatsApp Web connection status
   * @private
   * @param {string} accountId - Account ID
   * @param {BrowserView} view - BrowserView instance
   * @returns {Promise<string>} Connection status (online/offline/error)
   */
  async _detectConnectionStatus(accountId, view) {
    try {
      const viewState = this.views.get(accountId);
      if (!viewState) return 'offline';

      // Execute script to detect connection status
      const connectionInfo = await view.webContents.executeJavaScript(`
        (function() {
          // Check for connection status indicators
          const connectionBanner = document.querySelector('[data-testid="alert-phone-connection"]') ||
                                   document.querySelector('[data-testid="alert-computer-connection"]');
          
          // Check for "Phone not connected" or similar messages
          const phoneNotConnected = document.querySelector('[data-testid="alert-phone-connection"]');
          
          // Check for error messages
          const errorMessage = document.querySelector('[data-testid="alert-error"]') ||
                              document.querySelector('.landing-window.error');
          
          // Check if chat interface is present and functional
          const chatPane = document.querySelector('[data-testid="chat-list"]') ||
                          document.querySelector('#pane-side');
          
          // Check for loading indicators
          const loadingIndicator = document.querySelector('[data-testid="startup-progress-bar"]') ||
                                  document.querySelector('.landing-window.loading');
          
          // Check for QR code (not connected yet)
          const qrCode = document.querySelector('canvas[aria-label*="QR"]') || 
                        document.querySelector('canvas[aria-label*="Code"]');
          
          // Determine connection status
          let status = 'offline';
          let details = {};
          
          if (errorMessage) {
            status = 'error';
            details.hasError = true;
            details.errorText = errorMessage.textContent || 'Unknown error';
          } else if (phoneNotConnected) {
            status = 'offline';
            details.phoneDisconnected = true;
          } else if (qrCode) {
            status = 'offline';
            details.needsQRScan = true;
          } else if (chatPane && !loadingIndicator) {
            status = 'online';
            details.connected = true;
          } else if (loadingIndicator) {
            status = 'offline';
            details.loading = true;
          }
          
          return {
            status,
            details,
            timestamp: Date.now()
          };
        })();
      `);

      const previousStatus = viewState.connectionStatus;
      viewState.connectionStatus = connectionInfo.status;
      viewState.lastConnectionCheck = Date.now();

      // Update connection error if status is error
      if (connectionInfo.status === 'error') {
        viewState.connectionError = {
          message: connectionInfo.details.errorText || 'Connection error',
          timestamp: connectionInfo.timestamp
        };
      } else {
        viewState.connectionError = null;
      }

      this.log('info', `Connection status for account ${accountId}: ${connectionInfo.status}`, connectionInfo.details);

      // Notify renderer if status changed
      if (previousStatus !== connectionInfo.status) {
        this._notifyRenderer('connection-status-changed', {
          accountId,
          connectionStatus: connectionInfo.status,
          details: connectionInfo.details,
          error: viewState.connectionError
        });
      }

      return connectionInfo.status;
    } catch (error) {
      this.log('error', `Failed to detect connection status for account ${accountId}:`, error);
      
      // Set error status
      const viewState = this.views.get(accountId);
      if (viewState) {
        viewState.connectionStatus = 'error';
        viewState.connectionError = {
          message: error.message,
          timestamp: Date.now()
        };
        
        this._notifyRenderer('connection-status-changed', {
          accountId,
          connectionStatus: 'error',
          error: viewState.connectionError
        });
      }
      
      return 'error';
    }
  }

  /**
   * Notify renderer process about view events
   * @private
   * @param {string} channel - Event channel
   * @param {Object} data - Event data
   */
  _notifyRenderer(channel, data) {
    try {
      const window = this.mainWindow.getWindow();
      if (window && !window.isDestroyed() && window.webContents) {
        window.webContents.send(`view-manager:${channel}`, data);
      }
    } catch (error) {
      this.log('error', `Failed to notify renderer on channel ${channel}:`, error);
    }
  }

  /**
   * Show (attach and display) a BrowserView for an account
   * @param {string} accountId - Account ID to show
   * @param {Object} [options] - Show options
   * @param {boolean} [options.skipTransition] - Skip transition animation
   * @returns {Promise<boolean>} Success status
   */
  async showView(accountId, options = {}) {
    try {
      if (!accountId) {
        throw new Error('Account ID is required');
      }

      const viewState = this.views.get(accountId);
      if (!viewState) {
        throw new Error(`View for account ${accountId} does not exist`);
      }

      const window = this.mainWindow.getWindow();
      if (!window || window.isDestroyed()) {
        throw new Error('Main window is not available');
      }

      // Check if already active
      if (this.activeAccountId === accountId && viewState.isVisible) {
        this.log('info', `View for account ${accountId} is already active`);
        return true;
      }

      this.log('info', `Showing view for account ${accountId}`);

      // Notify renderer about switching start (for visual feedback)
      this._notifyRenderer('view-switching', {
        fromAccountId: this.activeAccountId,
        toAccountId: accountId,
        timestamp: Date.now()
      });

      // Get previous active view for transition
      const previousAccountId = this.activeAccountId;
      const previousViewState = previousAccountId ? this.views.get(previousAccountId) : null;

      // Calculate bounds for the view
      const bounds = this._calculateViewBounds();
      viewState.bounds = bounds;

      // Set view bounds before attaching
      viewState.view.setBounds(bounds);

      // Attach new view to window first (but it won't be visible yet)
      window.addBrowserView(viewState.view);

      // Transition handling to prevent flicker
      if (!options.skipTransition && previousViewState && previousViewState.isVisible) {
        // Brief delay to ensure new view is ready before hiding old one
        // This creates a smoother transition
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      // Set as top view (makes it visible)
      window.setTopBrowserView(viewState.view);

      // Update state for new view
      viewState.isVisible = true;
      const oldActiveAccountId = this.activeAccountId;
      this.activeAccountId = accountId;

      // Save active account ID to persistent storage
      this._saveActiveAccountId();

      // Hide previously active view after new one is shown
      if (previousAccountId && previousAccountId !== accountId && previousViewState) {
        await this.hideView(previousAccountId);
      }

      this.log('info', `View shown for account ${accountId}`);

      // Notify renderer about successful switch
      this._notifyRenderer('view-switched', {
        fromAccountId: oldActiveAccountId,
        toAccountId: accountId,
        timestamp: Date.now()
      });

      return true;
    } catch (error) {
      this.log('error', `Failed to show view for account ${accountId}:`, error);
      
      // Notify renderer about switch failure
      this._notifyRenderer('view-switch-failed', {
        accountId,
        error: {
          message: error.message
        },
        timestamp: Date.now()
      });
      
      return false;
    }
  }

  /**
   * Hide (detach but keep alive) a BrowserView for an account
   * @param {string} accountId - Account ID to hide
   * @returns {Promise<boolean>} Success status
   */
  async hideView(accountId) {
    try {
      if (!accountId) {
        throw new Error('Account ID is required');
      }

      const viewState = this.views.get(accountId);
      if (!viewState) {
        this.log('warn', `View for account ${accountId} does not exist`);
        return false;
      }

      if (!viewState.isVisible) {
        this.log('info', `View for account ${accountId} is already hidden`);
        return true;
      }

      const window = this.mainWindow.getWindow();
      if (!window || window.isDestroyed()) {
        throw new Error('Main window is not available');
      }

      this.log('info', `Hiding view for account ${accountId}`);

      // Remove view from window (but keep it alive)
      window.removeBrowserView(viewState.view);

      // Update state
      viewState.isVisible = false;

      // Clear active account if this was the active one
      if (this.activeAccountId === accountId) {
        this.activeAccountId = null;
        // Save the cleared state
        this._saveActiveAccountId();
      }

      this.log('info', `View hidden for account ${accountId}`);

      return true;
    } catch (error) {
      this.log('error', `Failed to hide view for account ${accountId}:`, error);
      return false;
    }
  }

  /**
   * Destroy a BrowserView for an account
   * @param {string} accountId - Account ID to destroy
   * @returns {Promise<boolean>} Success status
   */
  async destroyView(accountId) {
    try {
      if (!accountId) {
        throw new Error('Account ID is required');
      }

      const viewState = this.views.get(accountId);
      if (!viewState) {
        this.log('warn', `View for account ${accountId} does not exist`);
        return false;
      }

      this.log('info', `Destroying view for account ${accountId}`);

      // Hide view first if visible
      if (viewState.isVisible) {
        await this.hideView(accountId);
      }

      // Destroy the BrowserView
      if (viewState.view && !viewState.view.webContents.isDestroyed()) {
        viewState.view.webContents.destroy();
      }

      // Remove from views map
      this.views.delete(accountId);

      this.log('info', `View destroyed for account ${accountId}`);

      return true;
    } catch (error) {
      this.log('error', `Failed to destroy view for account ${accountId}:`, error);
      return false;
    }
  }

  /**
   * Calculate bounds for BrowserView based on sidebar width
   * OPTIMIZED: Uses caching to avoid recalculation
   * @private
   * @param {number} [sidebarWidth] - Sidebar width (uses saved width if not provided)
   * @param {boolean} [forceRecalculate] - Force recalculation even if cached
   * @returns {Object} Bounds {x, y, width, height}
   */
  _calculateViewBounds(sidebarWidth, forceRecalculate = false) {
    const window = this.mainWindow.getWindow();
    if (!window || window.isDestroyed()) {
      return { x: 0, y: 0, width: 0, height: 0 };
    }

    const windowBounds = window.getContentBounds();
    const sidebar = sidebarWidth || this.mainWindow.getSidebarWidth();

    // Check if we can use cached bounds
    if (!forceRecalculate && this.boundsCache.cachedBounds) {
      const cacheAge = Date.now() - (this.boundsCache.cacheTimestamp || 0);
      const isCacheValid = 
        this.boundsCache.lastSidebarWidth === sidebar &&
        this.boundsCache.lastWindowBounds &&
        this.boundsCache.lastWindowBounds.width === windowBounds.width &&
        this.boundsCache.lastWindowBounds.height === windowBounds.height &&
        cacheAge < 1000; // Cache valid for 1 second

      if (isCacheValid) {
        this.log('debug', 'Using cached bounds');
        return { ...this.boundsCache.cachedBounds };
      }
    }

    // Calculate new bounds
    const bounds = {
      x: sidebar,
      y: 0,
      width: windowBounds.width - sidebar,
      height: windowBounds.height
    };

    // Update cache
    this.boundsCache = {
      lastSidebarWidth: sidebar,
      lastWindowBounds: { ...windowBounds },
      cachedBounds: { ...bounds },
      cacheTimestamp: Date.now()
    };

    this.log('debug', 'Calculated and cached new bounds');
    return bounds;
  }

  /**
   * Resize all views based on new sidebar width
   * @param {number} sidebarWidth - New sidebar width in pixels
   * @param {Object} [options] - Resize options
   * @param {boolean} [options.immediate] - Skip debouncing and resize immediately
   */
  resizeViews(sidebarWidth, options = {}) {
    // Clear existing debounce timer
    if (this.resizeDebounceTimer) {
      clearTimeout(this.resizeDebounceTimer);
      this.resizeDebounceTimer = null;
    }

    // If immediate resize requested, execute now
    if (options.immediate) {
      this._performResize(sidebarWidth);
      return;
    }

    // Otherwise, debounce the resize operation
    this.resizeDebounceTimer = setTimeout(() => {
      this._performResize(sidebarWidth);
      this.resizeDebounceTimer = null;
    }, this.options.debounceDelay);
  }

  /**
   * Perform the actual resize operation
   * @private
   * @param {number} sidebarWidth - New sidebar width in pixels
   */
  _performResize(sidebarWidth) {
    try {
      this.log('info', `Resizing views for sidebar width: ${sidebarWidth}`);

      const bounds = this._calculateViewBounds(sidebarWidth);

      // Update bounds for all views
      for (const [accountId, viewState] of this.views) {
        viewState.bounds = bounds;
        
        // Update all views, not just visible ones
        // This ensures hidden views have correct bounds when they become visible
        if (viewState.view && !viewState.view.webContents.isDestroyed()) {
          viewState.view.setBounds(bounds);
        }
      }

      this.log('info', `Views resized to bounds: ${JSON.stringify(bounds)}`);
    } catch (error) {
      this.log('error', `Failed to resize views:`, error);
    }
  }

  /**
   * Get a specific view by account ID
   * @param {string} accountId - Account ID
   * @returns {BrowserView|null}
   */
  getView(accountId) {
    const viewState = this.views.get(accountId);
    return viewState ? viewState.view : null;
  }

  /**
   * Get view state for an account
   * @param {string} accountId - Account ID
   * @returns {Object|null} View state
   */
  getViewState(accountId) {
    return this.views.get(accountId) || null;
  }

  /**
   * Get all views
   * @returns {Map<string, Object>} Map of accountId to ViewState
   */
  getAllViews() {
    return new Map(this.views);
  }

  /**
   * Get currently active view
   * @returns {BrowserView|null}
   */
  getActiveView() {
    if (!this.activeAccountId) {
      return null;
    }
    return this.getView(this.activeAccountId);
  }

  /**
   * Get currently active account ID
   * @returns {string|null}
   */
  getActiveAccountId() {
    return this.activeAccountId;
  }

  /**
   * Check if a view exists for an account
   * @param {string} accountId - Account ID
   * @returns {boolean}
   */
  hasView(accountId) {
    return this.views.has(accountId);
  }

  /**
   * Get count of managed views
   * @returns {number}
   */
  getViewCount() {
    return this.views.size;
  }

  /**
   * Switch to a different account view
   * This is a high-level method that handles the complete switching flow
   * OPTIMIZED: Implements lazy loading - creates views only on first access
   * @param {string} accountId - Account ID to switch to
   * @param {Object} [options] - Switch options
   * @param {boolean} [options.createIfMissing] - Create view if it doesn't exist
   * @param {Object} [options.viewConfig] - Configuration for view creation
   * @returns {Promise<Object>} Result object with success status
   */
  async switchView(accountId, options = {}) {
    try {
      if (!accountId) {
        throw new Error('Account ID is required');
      }

      // Update access time for memory management
      this.viewAccessTimes.set(accountId, Date.now());

      // Validate account switch (check if account exists in views or can be created)
      if (!options.createIfMissing && !this.options.lazyLoadViews) {
        const availableAccountIds = Array.from(this.views.keys());
        const switchValidation = validateAccountSwitch(accountId, availableAccountIds);
        if (!switchValidation.valid) {
          this.log('error', `Invalid account switch: ${switchValidation.error}`);
          return {
            success: false,
            error: switchValidation.error,
            accountId
          };
        }
      }

      // Check if already active
      if (this.activeAccountId === accountId) {
        this.log('info', `Account ${accountId} is already active`);
        return {
          success: true,
          accountId,
          alreadyActive: true
        };
      }

      this.log('info', `Switching to account ${accountId}`);

      // OPTIMIZATION: Lazy loading - create view on first access
      if (!this.hasView(accountId)) {
        if (options.createIfMissing || this.options.lazyLoadViews) {
          this.log('info', `Lazy loading: Creating view for account ${accountId} on first access`);
          
          // Check if we need to free up memory before creating new view
          await this._enforceViewLimit();
          
          await this.createView(accountId, options.viewConfig || {});
        } else {
          throw new Error(`View for account ${accountId} does not exist`);
        }
      }

      // Show the view (this handles hiding the previous view)
      const success = await this.showView(accountId);

      if (!success) {
        throw new Error('Failed to show view');
      }

      return {
        success: true,
        accountId,
        previousAccountId: this.activeAccountId !== accountId ? this.activeAccountId : null
      };
    } catch (error) {
      this.log('error', `Failed to switch to account ${accountId}:`, error);
      return {
        success: false,
        error: error.message,
        accountId
      };
    }
  }

  /**
   * Switch to account by index (for keyboard shortcuts)
   * @param {number} index - Account index (0-based)
   * @returns {Promise<Object>} Result object with success status
   */
  async switchViewByIndex(index) {
    try {
      if (typeof index !== 'number' || index < 0) {
        throw new Error('Invalid index');
      }

      // Get all account IDs in order
      const accountIds = Array.from(this.views.keys());
      
      if (index >= accountIds.length) {
        this.log('warn', `No account at index ${index} (only ${accountIds.length} accounts)`);
        return {
          success: false,
          error: 'Account index out of range'
        };
      }

      const accountId = accountIds[index];
      return await this.switchView(accountId);
    } catch (error) {
      this.log('error', `Failed to switch to account by index ${index}:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Switch to next account in the list
   * @returns {Promise<Object>} Result object with success status
   */
  async switchToNextView() {
    try {
      const accountIds = Array.from(this.views.keys());
      
      if (accountIds.length === 0) {
        return {
          success: false,
          error: 'No accounts available'
        };
      }

      if (accountIds.length === 1) {
        return {
          success: true,
          accountId: accountIds[0],
          alreadyActive: true
        };
      }

      // Find current index
      const currentIndex = this.activeAccountId 
        ? accountIds.indexOf(this.activeAccountId)
        : -1;

      // Calculate next index (wrap around)
      const nextIndex = (currentIndex + 1) % accountIds.length;
      const nextAccountId = accountIds[nextIndex];

      return await this.switchView(nextAccountId);
    } catch (error) {
      this.log('error', 'Failed to switch to next view:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Switch to previous account in the list
   * @returns {Promise<Object>} Result object with success status
   */
  async switchToPreviousView() {
    try {
      const accountIds = Array.from(this.views.keys());
      
      if (accountIds.length === 0) {
        return {
          success: false,
          error: 'No accounts available'
        };
      }

      if (accountIds.length === 1) {
        return {
          success: true,
          accountId: accountIds[0],
          alreadyActive: true
        };
      }

      // Find current index
      const currentIndex = this.activeAccountId 
        ? accountIds.indexOf(this.activeAccountId)
        : -1;

      // Calculate previous index (wrap around)
      const previousIndex = currentIndex <= 0 
        ? accountIds.length - 1 
        : currentIndex - 1;
      const previousAccountId = accountIds[previousIndex];

      return await this.switchView(previousAccountId);
    } catch (error) {
      this.log('error', 'Failed to switch to previous view:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Reload a view (useful for error recovery)
   * @param {string} accountId - Account ID
   * @param {boolean} [ignoreCache=false] - Whether to ignore cache
   * @returns {Promise<boolean>} Success status
   */
  async reloadView(accountId, ignoreCache = false) {
    try {
      if (!accountId) {
        throw new Error('Account ID is required');
      }

      const viewState = this.views.get(accountId);
      if (!viewState) {
        throw new Error(`View for account ${accountId} does not exist`);
      }

      this.log('info', `Reloading view for account ${accountId} (ignoreCache: ${ignoreCache})`);

      // Reset error state
      viewState.status = 'loading';
      viewState.errorInfo = null;
      viewState.isLoaded = false;

      // Reload the view
      if (ignoreCache) {
        await viewState.view.webContents.reloadIgnoringCache();
      } else {
        await viewState.view.webContents.reload();
      }

      this.log('info', `View reloaded for account ${accountId}`);

      return true;
    } catch (error) {
      this.log('error', `Failed to reload view for account ${accountId}:`, error);
      return false;
    }
  }

  /**
   * Load a specific URL in a view
   * @param {string} accountId - Account ID
   * @param {string} url - URL to load
   * @returns {Promise<boolean>} Success status
   */
  async loadURL(accountId, url) {
    try {
      if (!accountId) {
        throw new Error('Account ID is required');
      }

      if (!url) {
        throw new Error('URL is required');
      }

      const viewState = this.views.get(accountId);
      if (!viewState) {
        throw new Error(`View for account ${accountId} does not exist`);
      }

      this.log('info', `Loading URL for account ${accountId}: ${url}`);

      // Reset state
      viewState.status = 'loading';
      viewState.errorInfo = null;
      viewState.isLoaded = false;

      // Load URL
      await viewState.view.webContents.loadURL(url);

      this.log('info', `URL loaded for account ${accountId}`);

      return true;
    } catch (error) {
      this.log('error', `Failed to load URL for account ${accountId}:`, error);
      return false;
    }
  }

  /**
   * Get login status for an account
   * @param {string} accountId - Account ID
   * @returns {boolean|null} Login status (null if unknown)
   */
  getLoginStatus(accountId) {
    const viewState = this.views.get(accountId);
    return viewState ? viewState.loginStatus : null;
  }

  /**
   * Get error info for an account
   * @param {string} accountId - Account ID
   * @returns {Object|null} Error info
   */
  getErrorInfo(accountId) {
    const viewState = this.views.get(accountId);
    return viewState ? viewState.errorInfo : null;
  }

  /**
   * Check if view is loading
   * @param {string} accountId - Account ID
   * @returns {boolean}
   */
  isViewLoading(accountId) {
    const viewState = this.views.get(accountId);
    return viewState ? viewState.status === 'loading' : false;
  }

  /**
   * Check if view has error
   * @param {string} accountId - Account ID
   * @returns {boolean}
   */
  hasViewError(accountId) {
    const viewState = this.views.get(accountId);
    return viewState ? viewState.status === 'error' : false;
  }

  /**
   * Handle window resize event
   * Updates all view bounds based on new window size
   * @param {Object} [options] - Resize options
   * @param {boolean} [options.immediate] - Skip debouncing and resize immediately
   */
  handleWindowResize(options = {}) {
    try {
      const window = this.mainWindow.getWindow();
      if (!window || window.isDestroyed()) {
        return;
      }

      // Get current sidebar width
      const sidebarWidth = this.mainWindow.getSidebarWidth();

      // Resize all views with the current sidebar width
      this.resizeViews(sidebarWidth, options);

      this.log('debug', 'Window resize handled');
    } catch (error) {
      this.log('error', 'Failed to handle window resize:', error);
    }
  }

  /**
   * Destroy all views
   * @returns {Promise<void>}
   */
  async destroyAllViews() {
    this.log('info', 'Destroying all views');

    // Stop memory monitoring
    this.stopMemoryMonitoring();

    // Clear any pending resize operations
    if (this.resizeDebounceTimer) {
      clearTimeout(this.resizeDebounceTimer);
      this.resizeDebounceTimer = null;
    }

    // Stop all connection and login status monitoring
    this.stopAllConnectionMonitoring();
    this.stopAllLoginStatusMonitoring();

    const accountIds = Array.from(this.views.keys());
    
    for (const accountId of accountIds) {
      await this.destroyView(accountId);
    }

    // Clear view pool
    this.clearViewPool();

    // Clear memory cache
    this.memoryUsageCache.clear();
    this.viewAccessTimes.clear();

    this.activeAccountId = null;
    this.log('info', 'All views destroyed');
  }

  /**
   * Verify session isolation for all views
   * @returns {Promise<Object>} Verification results
   */
  async verifyAllSessionIsolation() {
    this.log('info', 'Verifying session isolation for all views');

    const results = {
      totalViews: this.views.size,
      verified: 0,
      failed: 0,
      details: []
    };

    for (const [accountId, viewState] of this.views) {
      try {
        const validation = await this._validateSessionIsolation(accountId, viewState.session);
        
        if (validation.valid) {
          results.verified++;
          results.details.push({
            accountId,
            status: 'verified',
            partition: viewState.session.partition,
            storagePath: viewState.session.getStoragePath()
          });
        } else {
          results.failed++;
          results.details.push({
            accountId,
            status: 'failed',
            message: validation.message
          });
        }
      } catch (error) {
        results.failed++;
        results.details.push({
          accountId,
          status: 'error',
          message: error.message
        });
      }
    }

    this.log('info', `Session isolation verification complete: ${results.verified} verified, ${results.failed} failed`);

    return results;
  }

  /**
   * Test session isolation by setting and retrieving test data
   * @param {string} accountId - Account ID to test
   * @returns {Promise<Object>} Test results
   */
  async testSessionIsolation(accountId) {
    try {
      const viewState = this.views.get(accountId);
      if (!viewState) {
        throw new Error(`View for account ${accountId} does not exist`);
      }

      this.log('info', `Testing session isolation for account ${accountId}`);

      const testResults = {
        accountId,
        partition: viewState.session.partition,
        tests: {}
      };

      // Test 1: Cookie isolation
      try {
        const testCookieValue = `test-${Date.now()}`;
        await viewState.session.cookies.set({
          url: 'https://test.example.com',
          name: 'isolation-test',
          value: testCookieValue,
          expirationDate: Math.floor(Date.now() / 1000) + 60
        });

        const cookies = await viewState.session.cookies.get({
          url: 'https://test.example.com',
          name: 'isolation-test'
        });

        testResults.tests.cookies = {
          passed: cookies.length === 1 && cookies[0].value === testCookieValue,
          details: `Set and retrieved cookie: ${testCookieValue}`
        };
      } catch (error) {
        testResults.tests.cookies = {
          passed: false,
          error: error.message
        };
      }

      // Test 2: Storage path uniqueness
      try {
        const storagePath = viewState.session.getStoragePath();
        const isUnique = storagePath.includes(accountId);
        
        testResults.tests.storagePath = {
          passed: isUnique,
          details: `Storage path: ${storagePath}`
        };
      } catch (error) {
        testResults.tests.storagePath = {
          passed: false,
          error: error.message
        };
      }

      // Test 3: Session uniqueness
      try {
        let sharedWith = null;
        for (const [otherId, otherState] of this.views) {
          if (otherId !== accountId && otherState.session === viewState.session) {
            sharedWith = otherId;
            break;
          }
        }

        testResults.tests.uniqueness = {
          passed: sharedWith === null,
          details: sharedWith 
            ? `Session shared with ${sharedWith}` 
            : 'Session is unique'
        };
      } catch (error) {
        testResults.tests.uniqueness = {
          passed: false,
          error: error.message
        };
      }

      const allPassed = Object.values(testResults.tests).every(t => t.passed);
      testResults.success = allPassed;

      this.log('info', `Session isolation test for ${accountId}: ${allPassed ? 'PASSED' : 'FAILED'}`);

      return testResults;
    } catch (error) {
      this.log('error', `Failed to test session isolation for ${accountId}:`, error);
      return {
        accountId,
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Handle session expiration for an account
   * @param {string} accountId - Account ID
   * @param {Object} [options] - Options
   * @param {boolean} [options.clearCache] - Whether to clear cache
   * @returns {Promise<Object>} Result object
   */
  async handleSessionExpiration(accountId, options = {}) {
    try {
      if (!accountId) {
        throw new Error('Account ID is required');
      }

      const viewState = this.views.get(accountId);
      if (!viewState) {
        throw new Error(`View for account ${accountId} does not exist`);
      }

      this.log('info', `Handling session expiration for account ${accountId}`);

      // Use SessionManager to handle expiration
      const result = await this.sessionManager.handleSessionExpiration(accountId, options);

      if (result.success) {
        // Update view state
        viewState.loginStatus = false;
        viewState.status = 'ready';

        // Reload the view to show login screen
        await this.reloadView(accountId, true);

        // Notify renderer
        this._notifyRenderer('session-expired', {
          accountId,
          timestamp: Date.now()
        });

        this.log('info', `Session expiration handled for account ${accountId}`);

        return {
          success: true,
          accountId
        };
      } else {
        throw new Error(result.error || 'Failed to handle session expiration');
      }
    } catch (error) {
      this.log('error', `Failed to handle session expiration for account ${accountId}:`, error);
      return {
        success: false,
        error: error.message,
        accountId
      };
    }
  }

  /**
   * Force logout an account (clear all session data)
   * @param {string} accountId - Account ID
   * @returns {Promise<Object>} Result object
   */
  async forceLogout(accountId) {
    try {
      if (!accountId) {
        throw new Error('Account ID is required');
      }

      const viewState = this.views.get(accountId);
      if (!viewState) {
        throw new Error(`View for account ${accountId} does not exist`);
      }

      this.log('info', `Forcing logout for account ${accountId}`);

      // Use SessionManager to force logout
      const result = await this.sessionManager.forceLogout(accountId, viewState.view);

      if (result.success) {
        // Update view state
        viewState.loginStatus = false;
        viewState.status = 'ready';

        // Notify renderer
        this._notifyRenderer('account-logged-out', {
          accountId,
          forced: true,
          timestamp: Date.now()
        });

        this.log('info', `Forced logout completed for account ${accountId}`);

        return {
          success: true,
          accountId
        };
      } else {
        throw new Error(result.error || 'Failed to force logout');
      }
    } catch (error) {
      this.log('error', `Failed to force logout for account ${accountId}:`, error);
      return {
        success: false,
        error: error.message,
        accountId
      };
    }
  }

  /**
   * Check session expiration for an account
   * @param {string} accountId - Account ID
   * @returns {Promise<Object>} Expiration check result
   */
  async checkSessionExpiration(accountId) {
    try {
      if (!accountId) {
        throw new Error('Account ID is required');
      }

      const viewState = this.views.get(accountId);
      if (!viewState) {
        throw new Error(`View for account ${accountId} does not exist`);
      }

      this.log('info', `Checking session expiration for account ${accountId}`);

      // Use SessionManager to check expiration
      const result = await this.sessionManager.checkSessionExpiration(accountId, viewState.view);

      if (result.expired && result.needsReauth) {
        this.log('warn', `Session expired for account ${accountId}, re-authentication needed`);
        
        // Update view state
        viewState.loginStatus = false;

        // Notify renderer
        this._notifyRenderer('session-check-expired', {
          accountId,
          needsReauth: true,
          timestamp: Date.now()
        });
      }

      return {
        success: true,
        accountId,
        expired: result.expired,
        needsReauth: result.needsReauth
      };
    } catch (error) {
      this.log('error', `Failed to check session expiration for account ${accountId}:`, error);
      return {
        success: false,
        error: error.message,
        accountId
      };
    }
  }

  /**
   * Start monitoring session health for an account
   * @param {string} accountId - Account ID
   * @returns {Object|null} Monitor object with stop() method
   */
  startSessionHealthMonitoring(accountId) {
    try {
      if (!accountId) {
        throw new Error('Account ID is required');
      }

      const viewState = this.views.get(accountId);
      if (!viewState) {
        throw new Error(`View for account ${accountId} does not exist`);
      }

      this.log('info', `Starting session health monitoring for account ${accountId}`);

      // Use SessionManager to monitor health
      const monitor = this.sessionManager.monitorSessionHealth(
        accountId,
        viewState.view,
        (statusUpdate) => {
          // Update view state
          viewState.loginStatus = statusUpdate.isLoggedIn;

          // Notify renderer about status change
          this._notifyRenderer('session-health-update', {
            accountId: statusUpdate.accountId,
            status: statusUpdate.status,
            isLoggedIn: statusUpdate.isLoggedIn,
            timestamp: statusUpdate.timestamp
          });

          this.log('info', `Session health update for ${accountId}: ${statusUpdate.status}`);
        }
      );

      return monitor;
    } catch (error) {
      this.log('error', `Failed to start session health monitoring for account ${accountId}:`, error);
      return null;
    }
  }

  /**
   * Get session persistence status for an account
   * @param {string} accountId - Account ID
   * @returns {Promise<Object>} Persistence status
   */
  async getSessionPersistenceStatus(accountId) {
    try {
      if (!accountId) {
        throw new Error('Account ID is required');
      }

      this.log('info', `Getting session persistence status for account ${accountId}`);

      // Use SessionManager to get status
      const status = await this.sessionManager.getSessionPersistenceStatus(accountId);

      return {
        success: true,
        accountId,
        ...status
      };
    } catch (error) {
      this.log('error', `Failed to get session persistence status for account ${accountId}:`, error);
      return {
        success: false,
        error: error.message,
        accountId
      };
    }
  }

  /**
   * Update translation configuration for an account
   * @param {string} accountId - Account ID
   * @param {Object} translationConfig - Translation configuration
   * @returns {Promise<Object>} Result object
   */
  async updateTranslationConfig(accountId, translationConfig) {
    try {
      if (!accountId) {
        throw new Error('Account ID is required');
      }

      if (!translationConfig) {
        throw new Error('Translation configuration is required');
      }

      this.log('info', `Updating translation config for account ${accountId}`);

      // Check if TranslationIntegration is available
      if (!this.translationIntegration) {
        this.log('warn', 'TranslationIntegration not available');
        return {
          success: false,
          error: 'Translation integration not available',
          accountId
        };
      }

      // Check if view exists
      const viewState = this.views.get(accountId);
      if (!viewState) {
        this.log('warn', `View for account ${accountId} does not exist`);
        return {
          success: false,
          error: 'View does not exist',
          accountId
        };
      }

      // Update translation configuration
      const result = await this.translationIntegration.configureTranslation(
        accountId,
        translationConfig,
        viewState.view
      );

      if (result.success) {
        this.log('info', `Translation config updated for account ${accountId}`);
        
        // Notify renderer about config update
        this._notifyRenderer('translation-config-updated', {
          accountId,
          config: translationConfig,
          timestamp: Date.now()
        });

        return {
          success: true,
          accountId
        };
      } else {
        throw new Error(result.error || 'Failed to update translation config');
      }
    } catch (error) {
      this.log('error', `Failed to update translation config for account ${accountId}:`, error);
      return {
        success: false,
        error: error.message,
        accountId
      };
    }
  }

  /**
   * Get translation configuration for an account
   * @param {string} accountId - Account ID
   * @returns {Object|null} Translation configuration
   */
  getTranslationConfig(accountId) {
    if (!this.translationIntegration) {
      return null;
    }

    return this.translationIntegration.getTranslationConfig(accountId);
  }

  /**
   * Check if translation is enabled for an account
   * @param {string} accountId - Account ID
   * @returns {boolean}
   */
  isTranslationEnabled(accountId) {
    const config = this.getTranslationConfig(accountId);
    return config ? config.enabled : false;
  }

  /**
   * Get connection status for an account
   * @param {string} accountId - Account ID
   * @returns {string|null} Connection status (online/offline/error) or null if view doesn't exist
   */
  getConnectionStatus(accountId) {
    const viewState = this.views.get(accountId);
    return viewState ? viewState.connectionStatus : null;
  }

  /**
   * Get connection error for an account
   * @param {string} accountId - Account ID
   * @returns {Object|null} Connection error info
   */
  getConnectionError(accountId) {
    const viewState = this.views.get(accountId);
    return viewState ? viewState.connectionError : null;
  }

  /**
   * Start monitoring connection status for an account
   * @param {string} accountId - Account ID
   * @param {Object} [options] - Monitoring options
   * @param {number} [options.interval] - Check interval in milliseconds (default: 30000)
   * @returns {Object|null} Monitor object with stop() method
   */
  startConnectionMonitoring(accountId, options = {}) {
    try {
      if (!accountId) {
        throw new Error('Account ID is required');
      }

      const viewState = this.views.get(accountId);
      if (!viewState) {
        throw new Error(`View for account ${accountId} does not exist`);
      }

      // Stop existing monitor if any
      if (viewState.connectionMonitor) {
        clearInterval(viewState.connectionMonitor.intervalId);
      }

      const interval = options.interval || 30000; // Default: 30 seconds

      this.log('info', `Starting connection monitoring for account ${accountId} (interval: ${interval}ms)`);

      // Perform initial check
      this._detectConnectionStatus(accountId, viewState.view);

      // Set up periodic monitoring
      const intervalId = setInterval(async () => {
        try {
          // Only check if view is loaded and not destroyed
          if (viewState.isLoaded && !viewState.view.webContents.isDestroyed()) {
            await this._detectConnectionStatus(accountId, viewState.view);
          }
        } catch (error) {
          this.log('error', `Connection monitoring error for account ${accountId}:`, error);
        }
      }, interval);

      // Store monitor info
      const monitor = {
        accountId,
        intervalId,
        interval,
        startedAt: Date.now(),
        stop: () => {
          clearInterval(intervalId);
          if (viewState.connectionMonitor === monitor) {
            viewState.connectionMonitor = null;
          }
          this.log('info', `Stopped connection monitoring for account ${accountId}`);
        }
      };

      viewState.connectionMonitor = monitor;

      return monitor;
    } catch (error) {
      this.log('error', `Failed to start connection monitoring for account ${accountId}:`, error);
      return null;
    }
  }

  /**
   * Stop monitoring connection status for an account
   * @param {string} accountId - Account ID
   * @returns {boolean} Success status
   */
  stopConnectionMonitoring(accountId) {
    try {
      const viewState = this.views.get(accountId);
      if (!viewState || !viewState.connectionMonitor) {
        return false;
      }

      viewState.connectionMonitor.stop();
      return true;
    } catch (error) {
      this.log('error', `Failed to stop connection monitoring for account ${accountId}:`, error);
      return false;
    }
  }

  /**
   * Start monitoring connection status for all accounts
   * @param {Object} [options] - Monitoring options
   * @returns {Object} Result with count of monitors started
   */
  startAllConnectionMonitoring(options = {}) {
    this.log('info', 'Starting connection monitoring for all accounts');

    let started = 0;
    let failed = 0;

    for (const accountId of this.views.keys()) {
      const monitor = this.startConnectionMonitoring(accountId, options);
      if (monitor) {
        started++;
      } else {
        failed++;
      }
    }

    this.log('info', `Connection monitoring started: ${started} succeeded, ${failed} failed`);

    return {
      started,
      failed,
      total: this.views.size
    };
  }

  /**
   * Stop monitoring connection status for all accounts
   * @returns {Object} Result with count of monitors stopped
   */
  stopAllConnectionMonitoring() {
    this.log('info', 'Stopping connection monitoring for all accounts');

    let stopped = 0;

    for (const accountId of this.views.keys()) {
      if (this.stopConnectionMonitoring(accountId)) {
        stopped++;
      }
    }

    this.log('info', `Connection monitoring stopped for ${stopped} accounts`);

    return {
      stopped,
      total: this.views.size
    };
  }

  /**
   * Manually check connection status for an account
   * @param {string} accountId - Account ID
   * @returns {Promise<Object>} Connection status result
   */
  async checkConnectionStatus(accountId) {
    try {
      if (!accountId) {
        throw new Error('Account ID is required');
      }

      const viewState = this.views.get(accountId);
      if (!viewState) {
        throw new Error(`View for account ${accountId} does not exist`);
      }

      this.log('info', `Manually checking connection status for account ${accountId}`);

      const status = await this._detectConnectionStatus(accountId, viewState.view);

      return {
        success: true,
        accountId,
        connectionStatus: status,
        error: viewState.connectionError,
        timestamp: Date.now()
      };
    } catch (error) {
      this.log('error', `Failed to check connection status for account ${accountId}:`, error);
      return {
        success: false,
        accountId,
        error: error.message
      };
    }
  }

  /**
   * Manually check login status for an account
   * @param {string} accountId - Account ID
   * @returns {Promise<Object>} Login status result
   */
  async checkLoginStatus(accountId) {
    try {
      if (!accountId) {
        throw new Error('Account ID is required');
      }

      const viewState = this.views.get(accountId);
      if (!viewState) {
        throw new Error(`View for account ${accountId} does not exist`);
      }

      this.log('info', `Manually checking login status for account ${accountId}`);

      const isLoggedIn = await this._detectLoginStatus(accountId, viewState.view);

      return {
        success: true,
        accountId,
        isLoggedIn,
        loginInfo: viewState.loginInfo,
        timestamp: Date.now()
      };
    } catch (error) {
      this.log('error', `Failed to check login status for account ${accountId}:`, error);
      return {
        success: false,
        accountId,
        error: error.message
      };
    }
  }

  /**
   * Start monitoring login status for an account
   * @param {string} accountId - Account ID
   * @param {Object} [options] - Monitoring options
   * @param {number} [options.interval] - Check interval in milliseconds (default: 30000)
   * @returns {Object|null} Monitor object with stop() method
   */
  startLoginStatusMonitoring(accountId, options = {}) {
    try {
      const viewState = this.views.get(accountId);
      if (!viewState) {
        throw new Error(`View for account ${accountId} does not exist`);
      }

      // Stop existing monitor if any
      if (viewState.loginStatusMonitor) {
        viewState.loginStatusMonitor.stop();
      }

      const interval = options.interval || 30000; // 30 seconds default
      let isMonitoring = true;
      let timeoutId = null;

      const checkStatus = async () => {
        if (!isMonitoring) return;

        try {
          await this._detectLoginStatus(accountId, viewState.view);
        } catch (error) {
          this.log('error', `Login status check failed for account ${accountId}:`, error);
        }

        // Schedule next check
        if (isMonitoring) {
          timeoutId = setTimeout(checkStatus, interval);
        }
      };

      // Start monitoring
      checkStatus();

      const monitor = {
        stop: () => {
          isMonitoring = false;
          if (timeoutId) {
            clearTimeout(timeoutId);
            timeoutId = null;
          }
          this.log('info', `Stopped login status monitoring for account ${accountId}`);
        }
      };

      viewState.loginStatusMonitor = monitor;

      this.log('info', `Started login status monitoring for account ${accountId} (interval: ${interval}ms)`);

      return monitor;
    } catch (error) {
      this.log('error', `Failed to start login status monitoring for account ${accountId}:`, error);
      return null;
    }
  }

  /**
   * Stop monitoring login status for an account
   * @param {string} accountId - Account ID
   * @returns {boolean} Success status
   */
  stopLoginStatusMonitoring(accountId) {
    try {
      const viewState = this.views.get(accountId);
      if (!viewState || !viewState.loginStatusMonitor) {
        return false;
      }

      viewState.loginStatusMonitor.stop();
      viewState.loginStatusMonitor = null;
      return true;
    } catch (error) {
      this.log('error', `Failed to stop login status monitoring for account ${accountId}:`, error);
      return false;
    }
  }

  /**
   * Start monitoring login status for all accounts
   * @param {Object} [options] - Monitoring options
   * @returns {Object} Result with count of monitors started
   */
  startAllLoginStatusMonitoring(options = {}) {
    this.log('info', 'Starting login status monitoring for all accounts');

    let started = 0;
    let failed = 0;

    for (const accountId of this.views.keys()) {
      const monitor = this.startLoginStatusMonitoring(accountId, options);
      if (monitor) {
        started++;
      } else {
        failed++;
      }
    }

    this.log('info', `Login status monitoring started: ${started} succeeded, ${failed} failed`);

    return {
      started,
      failed,
      total: this.views.size
    };
  }

  /**
   * Stop monitoring login status for all accounts
   * @returns {Object} Result with count of monitors stopped
   */
  stopAllLoginStatusMonitoring() {
    this.log('info', 'Stopping login status monitoring for all accounts');

    let stopped = 0;

    for (const accountId of this.views.keys()) {
      if (this.stopLoginStatusMonitoring(accountId)) {
        stopped++;
      }
    }

    this.log('info', `Login status monitoring stopped for ${stopped} accounts`);

    return {
      stopped,
      total: this.views.size
    };
  }

  // ============================================================================
  // PERFORMANCE OPTIMIZATION METHODS
  // ============================================================================

  /**
   * Enforce view limit by destroying least recently used views
   * OPTIMIZATION: Memory management - keep only N most recently used views
   * @private
   * @returns {Promise<void>}
   */
  async _enforceViewLimit() {
    if (this.views.size < this.options.maxConcurrentViews) {
      return; // Under limit, no action needed
    }

    this.log('info', `Enforcing view limit: ${this.views.size}/${this.options.maxConcurrentViews}`);

    // Get views sorted by last access time (oldest first)
    const viewsByAccessTime = Array.from(this.views.keys())
      .map(accountId => ({
        accountId,
        accessTime: this.viewAccessTimes.get(accountId) || 0,
        isActive: accountId === this.activeAccountId
      }))
      .filter(v => !v.isActive) // Never destroy active view
      .sort((a, b) => a.accessTime - b.accessTime);

    // Calculate how many views to destroy
    const viewsToDestroy = this.views.size - this.options.maxConcurrentViews + 1;

    // Destroy oldest views
    for (let i = 0; i < Math.min(viewsToDestroy, viewsByAccessTime.length); i++) {
      const { accountId } = viewsByAccessTime[i];
      this.log('info', `Destroying least recently used view: ${accountId}`);
      
      // Try to pool the view before destroying
      await this._poolView(accountId);
    }
  }

  /**
   * Pool a view for potential reuse
   * OPTIMIZATION: View pooling to reduce creation overhead
   * @private
   * @param {string} accountId - Account ID
   * @returns {Promise<boolean>} Success status
   */
  async _poolView(accountId) {
    try {
      const viewState = this.views.get(accountId);
      if (!viewState) {
        return false;
      }

      // Check if pool is full
      if (this.viewPool.length >= this.options.viewPoolSize) {
        // Pool is full, remove oldest pooled view and destroy it
        const oldestPooled = this.viewPool.shift();
        if (oldestPooled && oldestPooled.view && !oldestPooled.view.webContents.isDestroyed()) {
          try {
            oldestPooled.view.webContents.destroy();
            this.log('info', 'Destroyed oldest pooled view to make room');
          } catch (error) {
            this.log('error', 'Failed to destroy oldest pooled view:', error);
          }
        }
      }

      this.log('info', `Pooling view for potential reuse: ${accountId}`);

      // Stop any monitoring for this view
      this.stopConnectionMonitoring(accountId);
      this.stopLoginStatusMonitoring(accountId);

      // Hide the view
      await this.hideView(accountId);

      // Clear view content to reduce memory
      if (viewState.view && !viewState.view.webContents.isDestroyed()) {
        try {
          // Clear cache first
          await this.clearViewCache(accountId);
          
          // Navigate to blank page to free memory
          await viewState.view.webContents.loadURL('about:blank');
          
          // Force garbage collection if available
          await this.forceGarbageCollection(accountId);
        } catch (error) {
          this.log('warn', `Failed to clean view before pooling: ${error.message}`);
        }
      }

      // Add to pool
      this.viewPool.push({
        view: viewState.view,
        session: viewState.session,
        pooledAt: Date.now(),
        originalAccountId: accountId // Track for debugging
      });

      // Remove from active views
      this.views.delete(accountId);
      this.viewAccessTimes.delete(accountId);
      this.memoryUsageCache.delete(accountId);

      this.log('info', `View pooled: ${accountId} (pool size: ${this.viewPool.length})`);

      return true;
    } catch (error) {
      this.log('error', `Failed to pool view ${accountId}:`, error);
      // Fallback to destroying
      await this.destroyView(accountId);
      return false;
    }
  }

  /**
   * Get a view from the pool or create a new one
   * OPTIMIZATION: Reuse pooled views to reduce creation overhead
   * @private
   * @returns {Object|null} Pooled view object or null
   */
  _getPooledView() {
    if (this.viewPool.length === 0) {
      return null;
    }

    // Get the most recently pooled view
    const pooledView = this.viewPool.pop();
    
    // Check if view is still valid
    if (pooledView.view && !pooledView.view.webContents.isDestroyed()) {
      this.log('info', `Reusing pooled view (pool size: ${this.viewPool.length})`);
      return pooledView;
    }

    // View is destroyed, try next one
    return this._getPooledView();
  }

  /**
   * Clear the view pool and destroy all pooled views
   * @returns {number} Number of views destroyed
   */
  clearViewPool() {
    this.log('info', `Clearing view pool (${this.viewPool.length} views)`);

    let destroyed = 0;

    while (this.viewPool.length > 0) {
      const pooledView = this.viewPool.pop();
      
      if (pooledView.view && !pooledView.view.webContents.isDestroyed()) {
        try {
          pooledView.view.webContents.destroy();
          destroyed++;
        } catch (error) {
          this.log('error', 'Failed to destroy pooled view:', error);
        }
      }
    }

    this.log('info', `View pool cleared: ${destroyed} views destroyed`);

    return destroyed;
  }

  /**
   * Get memory usage statistics for all views
   * @returns {Promise<Object>} Memory usage statistics
   */
  async getMemoryUsage() {
    const stats = {
      totalViews: this.views.size,
      pooledViews: this.viewPool.length,
      activeView: this.activeAccountId,
      viewDetails: [],
      totalMemory: 0,
      timestamp: Date.now()
    };

    for (const [accountId, viewState] of this.views) {
      try {
        if (viewState.view && !viewState.view.webContents.isDestroyed()) {
          // Get process memory info
          const processId = viewState.view.webContents.getOSProcessId();
          
          // Get detailed memory info from the renderer process
          let memoryInfo = null;
          try {
            memoryInfo = await viewState.view.webContents.executeJavaScript(`
              (function() {
                if (performance && performance.memory) {
                  return {
                    usedJSHeapSize: Math.round(performance.memory.usedJSHeapSize / 1024 / 1024), // MB
                    totalJSHeapSize: Math.round(performance.memory.totalJSHeapSize / 1024 / 1024), // MB
                    jsHeapSizeLimit: Math.round(performance.memory.jsHeapSizeLimit / 1024 / 1024) // MB
                  };
                }
                return null;
              })();
            `);
          } catch (error) {
            // Ignore errors from destroyed or unresponsive views
            this.log('debug', `Could not get memory info for ${accountId}:`, error.message);
          }

          const viewInfo = {
            accountId,
            isVisible: viewState.isVisible,
            isActive: accountId === this.activeAccountId,
            status: viewState.status,
            processId,
            lastAccess: this.viewAccessTimes.get(accountId) || 0,
            memory: memoryInfo
          };

          // Calculate total memory if available
          if (memoryInfo && memoryInfo.usedJSHeapSize) {
            stats.totalMemory += memoryInfo.usedJSHeapSize;
            
            // Cache memory usage
            this.memoryUsageCache.set(accountId, {
              usage: memoryInfo.usedJSHeapSize,
              timestamp: Date.now()
            });
          }

          stats.viewDetails.push(viewInfo);
        }
      } catch (error) {
        this.log('error', `Failed to get memory info for ${accountId}:`, error);
      }
    }

    return stats;
  }

  /**
   * Get memory usage for a specific view
   * @param {string} accountId - Account ID
   * @returns {Promise<Object|null>} Memory usage info or null
   */
  async getViewMemoryUsage(accountId) {
    try {
      const viewState = this.views.get(accountId);
      if (!viewState || !viewState.view || viewState.view.webContents.isDestroyed()) {
        return null;
      }

      const memoryInfo = await viewState.view.webContents.executeJavaScript(`
        (function() {
          if (performance && performance.memory) {
            return {
              usedJSHeapSize: Math.round(performance.memory.usedJSHeapSize / 1024 / 1024), // MB
              totalJSHeapSize: Math.round(performance.memory.totalJSHeapSize / 1024 / 1024), // MB
              jsHeapSizeLimit: Math.round(performance.memory.jsHeapSizeLimit / 1024 / 1024) // MB
            };
          }
          return null;
        })();
      `);

      if (memoryInfo) {
        // Cache the result
        this.memoryUsageCache.set(accountId, {
          usage: memoryInfo.usedJSHeapSize,
          timestamp: Date.now()
        });

        return {
          accountId,
          ...memoryInfo,
          timestamp: Date.now()
        };
      }

      return null;
    } catch (error) {
      this.log('error', `Failed to get memory usage for ${accountId}:`, error);
      return null;
    }
  }

  /**
   * Start monitoring memory usage for all views
   * @private
   * @param {number} [interval=60000] - Monitoring interval in milliseconds (default: 1 minute)
   */
  _startMemoryMonitoring(interval = 60000) {
    if (this.memoryMonitorInterval) {
      clearInterval(this.memoryMonitorInterval);
    }

    this.log('info', `Starting memory monitoring (interval: ${interval}ms)`);

    this.memoryMonitorInterval = setInterval(async () => {
      try {
        await this._checkMemoryUsage();
      } catch (error) {
        this.log('error', 'Memory monitoring error:', error);
      }
    }, interval);
  }

  /**
   * Stop monitoring memory usage
   */
  stopMemoryMonitoring() {
    if (this.memoryMonitorInterval) {
      clearInterval(this.memoryMonitorInterval);
      this.memoryMonitorInterval = null;
      this.log('info', 'Memory monitoring stopped');
    }
  }

  /**
   * Check memory usage for all views and take action if needed
   * @private
   * @returns {Promise<Object>} Check results
   */
  async _checkMemoryUsage() {
    const results = {
      checked: 0,
      warnings: [],
      actionsToken: []
    };

    for (const [accountId, viewState] of this.views) {
      try {
        // Skip destroyed views
        if (!viewState.view || viewState.view.webContents.isDestroyed()) {
          continue;
        }

        results.checked++;

        const memoryInfo = await this.getViewMemoryUsage(accountId);
        
        if (!memoryInfo) {
          continue;
        }

        const usage = memoryInfo.usedJSHeapSize;

        // Check if memory usage exceeds warning threshold
        if (usage >= this.memoryLimits.warningThreshold) {
          this.log('warn', `View ${accountId} memory usage high: ${usage}MB (threshold: ${this.memoryLimits.warningThreshold}MB)`);
          
          results.warnings.push({
            accountId,
            usage,
            threshold: this.memoryLimits.warningThreshold
          });

          // Notify renderer about high memory usage
          this._notifyRenderer('memory-warning', {
            accountId,
            usage,
            threshold: this.memoryLimits.warningThreshold,
            timestamp: Date.now()
          });
        }

        // Check if memory usage exceeds maximum limit
        if (usage >= this.memoryLimits.maxMemory) {
          this.log('error', `View ${accountId} memory usage critical: ${usage}MB (max: ${this.memoryLimits.maxMemory}MB)`);
          
          results.actionsToken.push({
            accountId,
            action: 'reload',
            usage,
            maxMemory: this.memoryLimits.maxMemory
          });

          // Take action: reload the view to free memory
          if (this.memoryLimits.autoCleanupEnabled) {
            this.log('info', `Auto-reloading view ${accountId} due to high memory usage`);
            
            // Notify renderer before reload
            this._notifyRenderer('memory-critical', {
              accountId,
              usage,
              maxMemory: this.memoryLimits.maxMemory,
              action: 'reloading',
              timestamp: Date.now()
            });

            // Reload the view
            await this.reloadView(accountId, true); // Ignore cache
          }
        }
      } catch (error) {
        this.log('error', `Failed to check memory for ${accountId}:`, error);
      }
    }

    if (results.warnings.length > 0 || results.actionsToken.length > 0) {
      this.log('info', `Memory check complete: ${results.warnings.length} warnings, ${results.actionsToken.length} actions taken`);
    }

    return results;
  }

  /**
   * Set memory limits for views
   * @param {Object} limits - Memory limits
   * @param {number} [limits.warningThreshold] - Warning threshold in MB
   * @param {number} [limits.maxMemory] - Maximum memory per view in MB
   * @param {boolean} [limits.autoCleanupEnabled] - Enable automatic cleanup
   */
  setMemoryLimits(limits) {
    if (limits.warningThreshold !== undefined) {
      this.memoryLimits.warningThreshold = limits.warningThreshold;
    }
    if (limits.maxMemory !== undefined) {
      this.memoryLimits.maxMemory = limits.maxMemory;
    }
    if (limits.autoCleanupEnabled !== undefined) {
      this.memoryLimits.autoCleanupEnabled = limits.autoCleanupEnabled;
      
      // Start or stop monitoring based on setting
      if (limits.autoCleanupEnabled && !this.memoryMonitorInterval) {
        this._startMemoryMonitoring();
      } else if (!limits.autoCleanupEnabled && this.memoryMonitorInterval) {
        this.stopMemoryMonitoring();
      }
    }

    this.log('info', 'Memory limits updated:', this.memoryLimits);
  }

  /**
   * Get current memory limits
   * @returns {Object} Memory limits
   */
  getMemoryLimits() {
    return { ...this.memoryLimits };
  }

  /**
   * Force garbage collection for a view (if available)
   * @param {string} accountId - Account ID
   * @returns {Promise<boolean>} Success status
   */
  async forceGarbageCollection(accountId) {
    try {
      const viewState = this.views.get(accountId);
      if (!viewState || !viewState.view || viewState.view.webContents.isDestroyed()) {
        return false;
      }

      this.log('info', `Forcing garbage collection for view ${accountId}`);

      // Try to trigger garbage collection
      await viewState.view.webContents.executeJavaScript(`
        (function() {
          if (window.gc) {
            window.gc();
            return true;
          }
          return false;
        })();
      `);

      return true;
    } catch (error) {
      this.log('error', `Failed to force garbage collection for ${accountId}:`, error);
      return false;
    }
  }

  /**
   * Clear memory cache for a view
   * @param {string} accountId - Account ID
   * @returns {Promise<boolean>} Success status
   */
  async clearViewCache(accountId) {
    try {
      const viewState = this.views.get(accountId);
      if (!viewState || !viewState.view || viewState.view.webContents.isDestroyed()) {
        return false;
      }

      this.log('info', `Clearing cache for view ${accountId}`);

      // Clear various caches
      const session = viewState.session;
      
      // Clear cache
      await session.clearCache();
      
      // Clear storage data (but keep cookies for login state)
      await session.clearStorageData({
        storages: ['appcache', 'serviceworkers', 'cachestorage', 'websql', 'indexdb']
      });

      this.log('info', `Cache cleared for view ${accountId}`);

      return true;
    } catch (error) {
      this.log('error', `Failed to clear cache for ${accountId}:`, error);
      return false;
    }
  }

  /**
   * Optimize memory by cleaning up inactive views
   * @param {Object} [options] - Optimization options
   * @param {number} [options.inactiveThreshold] - Time in ms after which a view is considered inactive (default: 5 minutes)
   * @returns {Promise<Object>} Optimization results
   */
  async optimizeMemory(options = {}) {
    const inactiveThreshold = options.inactiveThreshold || 5 * 60 * 1000; // 5 minutes
    const now = Date.now();

    this.log('info', 'Starting memory optimization');

    const results = {
      checked: 0,
      destroyed: 0,
      pooled: 0,
      kept: 0
    };

    for (const [accountId, viewState] of this.views) {
      results.checked++;

      // Never optimize active view
      if (accountId === this.activeAccountId) {
        results.kept++;
        continue;
      }

      const lastAccess = this.viewAccessTimes.get(accountId) || 0;
      const inactiveTime = now - lastAccess;

      if (inactiveTime > inactiveThreshold) {
        this.log('info', `View ${accountId} inactive for ${Math.round(inactiveTime / 1000)}s, optimizing`);
        
        // Try to pool first
        const pooled = await this._poolView(accountId);
        
        if (pooled) {
          results.pooled++;
        } else {
          results.destroyed++;
        }
      } else {
        results.kept++;
      }
    }

    this.log('info', `Memory optimization complete: ${results.destroyed} destroyed, ${results.pooled} pooled, ${results.kept} kept`);

    return results;
  }

  /**
   * Pre-render a view in the background for faster switching
   * OPTIMIZATION: Pre-render next likely view to reduce switching latency
   * @param {string} accountId - Account ID to pre-render
   * @returns {Promise<boolean>} Success status
   */
  async preRenderView(accountId) {
    try {
      if (!accountId) {
        return false;
      }

      // Don't pre-render if already exists
      if (this.hasView(accountId)) {
        this.log('debug', `View ${accountId} already exists, skipping pre-render`);
        return true;
      }

      this.log('info', `Pre-rendering view for ${accountId}`);

      // Create the view but don't show it
      await this.createView(accountId, {});

      this.log('info', `View pre-rendered for ${accountId}`);

      return true;
    } catch (error) {
      this.log('error', `Failed to pre-render view ${accountId}:`, error);
      return false;
    }
  }

  /**
   * Invalidate bounds cache
   * Call this when you know bounds need to be recalculated
   */
  invalidateBoundsCache() {
    this.log('debug', 'Invalidating bounds cache');
    this.boundsCache = {
      lastSidebarWidth: null,
      lastWindowBounds: null,
      cachedBounds: null,
      cacheTimestamp: null
    };
  }

  /**
   * Get performance statistics
   * @returns {Object} Performance statistics
   */
  getPerformanceStats() {
    return {
      totalViews: this.views.size,
      activeView: this.activeAccountId,
      pooledViews: this.viewPool.length,
      maxConcurrentViews: this.options.maxConcurrentViews,
      lazyLoadEnabled: this.options.lazyLoadViews,
      memoryMonitoring: {
        enabled: !!this.memoryMonitorInterval,
        limits: this.memoryLimits,
        cachedUsage: this.memoryUsageCache.size
      },
      boundsCache: {
        isValid: !!this.boundsCache.cachedBounds,
        age: this.boundsCache.cacheTimestamp 
          ? Date.now() - this.boundsCache.cacheTimestamp 
          : null
      },
      viewAccessTimes: Array.from(this.viewAccessTimes.entries()).map(([accountId, time]) => ({
        accountId,
        lastAccess: time,
        timeSinceAccess: Date.now() - time
      })),
      poolDetails: this.viewPool.map(pooled => ({
        pooledAt: pooled.pooledAt,
        age: Date.now() - pooled.pooledAt,
        originalAccountId: pooled.originalAccountId
      }))
    };
  }

  /**
   * Get view pool statistics
   * @returns {Object} Pool statistics
   */
  getPoolStats() {
    return {
      size: this.viewPool.length,
      maxSize: this.options.viewPoolSize,
      views: this.viewPool.map(pooled => ({
        pooledAt: pooled.pooledAt,
        age: Date.now() - pooled.pooledAt,
        originalAccountId: pooled.originalAccountId,
        isDestroyed: pooled.view.webContents.isDestroyed()
      }))
    };
  }

  /**
   * Clean up stale pooled views
   * Removes views that have been in the pool for too long
   * @param {number} [maxAge=300000] - Maximum age in milliseconds (default: 5 minutes)
   * @returns {number} Number of views cleaned up
   */
  cleanupStalePooledViews(maxAge = 300000) {
    const now = Date.now();
    let cleaned = 0;

    this.viewPool = this.viewPool.filter(pooled => {
      const age = now - pooled.pooledAt;
      
      // Remove if too old or destroyed
      if (age > maxAge || pooled.view.webContents.isDestroyed()) {
        if (!pooled.view.webContents.isDestroyed()) {
          try {
            pooled.view.webContents.destroy();
          } catch (error) {
            this.log('error', 'Failed to destroy stale pooled view:', error);
          }
        }
        cleaned++;
        return false;
      }
      
      return true;
    });

    if (cleaned > 0) {
      this.log('info', `Cleaned up ${cleaned} stale pooled views`);
    }

    return cleaned;
  }

  /**
   * Get memory statistics summary
   * @returns {Promise<Object>} Memory statistics summary
   */
  async getMemoryStats() {
    const memoryUsage = await this.getMemoryUsage();
    
    return {
      totalViews: memoryUsage.totalViews,
      totalMemoryMB: memoryUsage.totalMemory,
      averageMemoryMB: memoryUsage.totalViews > 0 
        ? Math.round(memoryUsage.totalMemory / memoryUsage.totalViews) 
        : 0,
      limits: this.memoryLimits,
      highMemoryViews: memoryUsage.viewDetails
        .filter(v => v.memory && v.memory.usedJSHeapSize >= this.memoryLimits.warningThreshold)
        .map(v => ({
          accountId: v.accountId,
          memoryMB: v.memory.usedJSHeapSize,
          isActive: v.isActive
        })),
      timestamp: memoryUsage.timestamp
    };
  }
}

module.exports = ViewManager;
