/**
 * ViewFactory - 视图创建工厂
 * 
 * 负责创建和配置BrowserView实例
 * 
 * @module presentation/windows/view-manager/ViewFactory
 * 
 * Requirements:
 * - 24.1: Inject account's fingerprint configuration when creating BrowserView
 * - 32.3: Apply fingerprint configuration through existing ViewFactory injection point
 * - 1.4: Route all WhatsApp traffic through local proxy port
 * - 2.4: Support per-account chained proxy configuration
 */

const { BrowserView } = require('electron');
const path = require('path');
const { FingerprintInjector } = require('../../../infrastructure/fingerprint');
const ProxyManager = require('../../../environment/ProxyManager');
const LocalProxyManager = require('../../../environment/LocalProxyManager');
const ProxyChainManager = require('../../../environment/ProxyChainManager');

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
   * Apply proxy configuration to session
   * Supports both traditional proxy and local proxy with optional chained proxy
   * 
   * @private
   * @param {string} accountId - Account identifier
   * @param {Electron.Session} accountSession - Account session
   * @param {Object} config - View configuration
   * @param {Object} [config.proxy] - Traditional proxy configuration
   * @param {Object} [config.localProxy] - Local proxy configuration
   * @param {Object} [config.chainedProxy] - Chained proxy configuration
   * @returns {Promise<void>}
   * 
   * **Validates: Requirements 1.4, 2.4**
   */
  async _applyProxyConfiguration(accountId, accountSession, config) {
    this.log('info', `[PROXY_DEBUG] _applyProxyConfiguration called for ${accountId}`);
    this.log('info', `[PROXY_DEBUG] config.localProxy:`, JSON.stringify(config.localProxy || null));
    this.log('info', `[PROXY_DEBUG] config.proxy:`, JSON.stringify(config.proxy || null));
    this.log('info', `[PROXY_DEBUG] config.chainedProxy:`, JSON.stringify(config.chainedProxy || null));

    // Check if local proxy is configured (takes priority over traditional proxy)
    if (config.localProxy && config.localProxy.enabled) {
      this.log('info', `[PROXY_DEBUG] Using local proxy for ${accountId}`);
      await this._applyLocalProxy(accountId, accountSession, config.localProxy, config.chainedProxy);
      return;
    }

    // Fall back to traditional proxy configuration
    if (config.proxy && config.proxy.enabled) {
      this.log('info', `[PROXY_DEBUG] Using traditional proxy for ${accountId}`);
      await this._applyTraditionalProxy(accountId, accountSession, config.proxy);
      return;
    }

    // No proxy configured - ensure direct connection
    this.log('info', `[PROXY_DEBUG] No proxy enabled for ${accountId}, using direct connection`);
    try {
      await accountSession.setProxy({ mode: 'direct' });
      this.log('info', `Proxy disabled for ${accountId}, using direct connection`);
    } catch (error) {
      this.log('error', `Failed to clear proxy for ${accountId}:`, error);
    }
  }

  /**
   * Apply local proxy configuration with optional chained proxy
   * 
   * @private
   * @param {string} accountId - Account identifier
   * @param {Electron.Session} accountSession - Account session
   * @param {Object} localProxyConfig - Local proxy configuration
   * @param {Object} [chainedProxyConfig] - Optional chained proxy configuration
   * @returns {Promise<void>}
   * 
   * **Validates: Requirements 1.4, 2.4**
   */
  async _applyLocalProxy(accountId, accountSession, localProxyConfig, chainedProxyConfig = null) {
    try {
      // Validate local proxy configuration
      const validation = LocalProxyManager.validateLocalProxy(
        localProxyConfig.host,
        localProxyConfig.port
      );

      if (!validation.valid) {
        this.log('error', `Invalid local proxy config for ${accountId}: ${validation.errors.join(', ')}`);
        return;
      }

      // Determine if we have a chained proxy
      const hasChainedProxy = chainedProxyConfig && 
        chainedProxyConfig.enabled && 
        chainedProxyConfig.host && 
        chainedProxyConfig.port;

      // Build proxy rules in Electron format
      const host = localProxyConfig.host;
      const port = localProxyConfig.port;
      const protocol = localProxyConfig.protocol || 'http';
      
      // Electron proxy rules format:
      // - For SOCKS5: "socks5://host:port"
      // - For HTTP: "http://host:port" (handles both HTTP and HTTPS traffic via CONNECT)
      let proxyRules;
      if (protocol === 'socks5' || protocol === 'socks4') {
        proxyRules = `${protocol}://${host}:${port}`;
      } else {
        // HTTP proxy - use URL format
        proxyRules = `http://${host}:${port}`;
      }

      this.log('info', `Applying local proxy for ${accountId}: ${proxyRules} (protocol: ${protocol})`);

      // Apply proxy to session
      await accountSession.setProxy({
        mode: 'fixed_servers',
        proxyRules: proxyRules,
        proxyBypassRules: '<local>'
      });

      this.log('info', `Local proxy applied successfully for ${accountId}`);

      if (hasChainedProxy) {
        this.log('info', `Chained proxy configured for ${accountId}: ${chainedProxyConfig.host}:${chainedProxyConfig.port}`);

        // Handle chained proxy authentication if provided
        if (chainedProxyConfig.username && chainedProxyConfig.password) {
          accountSession.removeAllListeners('login');
          accountSession.on('login', (event, webContents, authenticationResponseDetails, authInfo, callback) => {
            if (authInfo.isProxy) {
              event.preventDefault();
              callback(chainedProxyConfig.username, chainedProxyConfig.password);
              this.log('info', `Chained proxy authentication provided for ${accountId}`);
            }
          });
        }
      }
    } catch (error) {
      this.log('error', `Failed to apply local proxy for ${accountId}:`, error);
    }
  }

  /**
   * Apply traditional proxy configuration
   * 
   * @private
   * @param {string} accountId - Account identifier
   * @param {Electron.Session} accountSession - Account session
   * @param {Object} proxyConfig - Proxy configuration
   * @returns {Promise<void>}
   */
  async _applyTraditionalProxy(accountId, accountSession, proxyConfig) {
    try {
      // Sanitize host: remove protocol prefix if user accidentally included it
      let host = proxyConfig.host.replace(/^https?:\/\//, '');
      const port = proxyConfig.port;
      const protocol = proxyConfig.protocol || 'http';

      // Electron expects format like: "http=host:port;https=host:port" or "socks5://host:port"
      let proxyRules;
      if (protocol === 'socks5' || protocol === 'socks4') {
        proxyRules = `${protocol}://${host}:${port}`;
      } else {
        // For HTTP/HTTPS proxies, use the standard format
        proxyRules = `http=${host}:${port};https=${host}:${port}`;
      }

      this.log('info', `Applying proxy for ${accountId}: ${proxyRules}`);

      await accountSession.setProxy({
        mode: 'fixed_servers',
        proxyRules,
        proxyBypassRules: '<local>'
      });

      this.log('info', `Proxy applied successfully for ${accountId}`);
    } catch (error) {
      this.log('error', `Failed to apply proxy for ${accountId}:`, error);
    }
  }

  /**
   * Create a new BrowserView for an account
   * @param {string} accountId - Unique account identifier
   * @param {Electron.Session} accountSession - Isolated session for the account
   * @param {Object} [config] - View configuration
   * @param {string} [config.userAgent] - Custom user agent
   * @param {Object} [config.proxy] - Proxy configuration
   * @returns {Promise<BrowserView>} Created BrowserView instance
   */
  async createView(accountId, accountSession, config = {}) {
    if (!accountId) {
      throw new Error('Account ID is required');
    }

    if (!accountSession) {
      throw new Error('Account session is required');
    }

    this.log('info', `Creating BrowserView for account ${accountId}`);

    // Apply proxy configuration to session if provided
    // Supports both traditional proxy and local proxy with optional chained proxy
    await this._applyProxyConfiguration(accountId, accountSession, config);

    // Set account ID in environment for preload script
    process.env.ACCOUNT_ID = accountId;

    if (accountSession && accountSession.webRequest && typeof accountSession.webRequest.onHeadersReceived === 'function') {
      accountSession.webRequest.onHeadersReceived((details, callback) => {
        if (details.url.includes('web.whatsapp.com')) {
          const headers = details.responseHeaders;
          delete headers['content-security-policy'];
          delete headers['content-security-policy-report-only'];
          this.log('info', `CSP removed for translation injection: ${details.url}`);
          callback({ responseHeaders: headers });
        } else {
          callback({ responseHeaders: details.responseHeaders });
        }
      });
    }

    if (accountSession && accountSession.webRequest && typeof accountSession.webRequest.onBeforeRequest === 'function') {
      accountSession.webRequest.onBeforeRequest((details, callback) => {
        const url = details.url || '';
        if (url.startsWith('https://crashlogs.whatsapp.net/')) {
          this.log('debug', `Blocked crashlog request: ${url}`);
          callback({ cancel: true });
          return;
        }
        if (url.includes('/wa_fls_upload_check') && url.includes('crashlogs.whatsapp.net')) {
          this.log('debug', `Blocked crashlog upload check: ${url}`);
          callback({ cancel: true });
          return;
        }
        callback({});
      });
    }

    // IMPORTANT: Do NOT set both 'partition' and 'session' - they are mutually exclusive!
    // When both are set, 'session' is ignored and a new session is created from 'partition'.


    const additionalArgs = [`--account-id=${accountId}`];
    if (config.fingerprint) {
      try {
        const fpArg = Buffer.from(JSON.stringify(config.fingerprint)).toString('base64');
        additionalArgs.push(`--fp-config=${fpArg}`);
      } catch (e) {
        this.log('warn', `Failed to encode fingerprint for ${accountId}:`, e);
      }
    }

    const view = new BrowserView({
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: false,
        session: accountSession,
        webSecurity: true,
        allowRunningInsecureContent: false,
        preload: path.join(__dirname, '../../../preload-view.js'),
        additionalArguments: additionalArgs
      }
    });


    const userAgent = (config.fingerprint && config.fingerprint.userAgent) || config.userAgent || this._getDefaultUserAgent();
    view.webContents.setUserAgent(userAgent);

    const buildAcceptLanguage = () => {
      const langs = (config.fingerprint && (
        (config.fingerprint.navigator && config.fingerprint.navigator.languages) ||
        (config.fingerprint.language && config.fingerprint.language.list)
      )) || [];

      // 使用系统语言作为默认值，而不是硬编码 'en-US'
      const { app } = require('electron');
      const systemLocale = app.getLocale() || 'zh-CN';

      const primary = (config.fingerprint && (
        (config.fingerprint.navigator && config.fingerprint.navigator.language) ||
        (config.fingerprint.language && config.fingerprint.language.primary)
      )) || (langs[0] || systemLocale);

      const uniq = [];
      for (const l of [primary, ...langs]) { if (l && !uniq.includes(l)) uniq.push(l); }
      const parts = uniq.map((l, i) => i === 0 ? l : `${l};q=${Math.max(0.1, (0.9 - i * 0.1)).toFixed(1)}`);
      return parts.join(', ');
    };
    const acceptLanguage = buildAcceptLanguage();

    try {
      accountSession.webRequest.onBeforeSendHeaders((details, callback) => {
        const headers = details.requestHeaders || {};
        headers['User-Agent'] = userAgent;
        headers['Accept-Language'] = acceptLanguage;
        callback({ requestHeaders: headers });
      });
    } catch (_) { }

    if (
      config.proxy &&
      config.proxy.enabled &&
      config.proxy.username &&
      config.proxy.password &&
      !config.localProxy?.enabled // Only handle traditional proxy auth if local proxy is not enabled
    ) {
      view.webContents.on('login', (event, request, authInfo, callback) => {
        event.preventDefault();
        this.log('info', `Providing proxy credentials for ${accountId}`);
        callback(config.proxy.username, config.proxy.password);
      });
    }

    // Fingerprint injection is handled in preload-view.js using --fp-config
    // Avoid double injection to reduce risk of conflicts
    if (config.fingerprint) {
      this.log('info', `Fingerprint injection delegated to preload for ${accountId}`);
    }

    // Stall recovery: if the page stays in loading state, clear SW/cache and reload
    let stallTimer = null;
    const scheduleStallRecovery = () => {
      if (stallTimer) clearTimeout(stallTimer);
      stallTimer = setTimeout(async () => {
        try {
          if (!view.webContents.isLoading()) {
            return;
          }
          const currentUrl = view.webContents.getURL() || '';
          if (!/web\.whatsapp\.com/i.test(currentUrl)) {
            return;
          }
          this.log('warn', `Stall detected, attempting recovery for ${accountId}`);
          await accountSession.clearCache();
          try {
            await accountSession.clearStorageData({ storages: ['serviceworkers', 'cachestorage'], origin: 'https://web.whatsapp.com' });
          } catch (e) {
            this.log('warn', `Clear storage data failed for ${accountId}:`, e);
          }
          try {
            await view.webContents.executeJavaScript(`(async()=>{try{if(location&&/web\\.whatsapp\\.com$/i.test(location.hostname)){const regs=await navigator.serviceWorker.getRegistrations();regs.forEach(r=>r.unregister());}}catch(e){}})();`, true);
          } catch (e) {
            this.log('debug', `SW unregister script skipped for ${accountId}`);
          }
          view.webContents.reloadIgnoringCache();
        } catch (e) {
          this.log('error', `Stall recovery failed for ${accountId}:`, e);
        }
      }, 45000);
    };

    view.webContents.on('dom-ready', () => scheduleStallRecovery());
    view.webContents.on('did-finish-load', () => { if (stallTimer) { clearTimeout(stallTimer); stallTimer = null; } });
    view.webContents.on('did-fail-load', () => scheduleStallRecovery());

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

    // Reduce noisy ErrorUtils logs from WhatsApp Web
    view.webContents.on('dom-ready', async () => {
      try {
        await view.webContents.executeJavaScript(
          `(() => {
            try {
              const _origErr = console.error;
              console.error = function(...args) {
                const s = (args && args[0] && typeof args[0] === 'string') ? args[0] : '';
                if (s.includes('ErrorUtils caught an error') || s.includes('Missing catch or finally after try') || s.includes('fburl.com/debugjs')) {
                  return;
                }
                return _origErr.apply(this, args);
              };

              window.addEventListener('error', function(ev) {
                const msg = ev && ev.message ? ev.message : '';
                if (msg && msg.includes('Missing catch or finally after try')) {
                  if (ev.preventDefault) ev.preventDefault();
                }
              }, true);
            } catch (_) {}
          })();`,
          true
        );
      } catch (_) { }
    });

    this.log('info', `BrowserView created for account ${accountId}`);

    // Network/load diagnostics
    view.webContents.on('did-fail-provisional-load', (event, errorCode, errorDescription, validatedURL) => {
      this.log('error', `Provisional load failed for ${accountId}: ${errorCode} ${errorDescription} ${validatedURL}`);
    });

    view.webContents.on('did-start-navigation', (event, url, isInPlace, isMainFrame) => {
      if (isMainFrame) this.log('info', `Main navigation started for ${accountId}: ${url}`);
    });

    view.webContents.on('did-stop-loading', () => {
      this.log('info', `Stopped loading for ${accountId}`);
    });

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
   * Inject fingerprint configuration into BrowserView
   * 
   * This method creates a FingerprintInjector instance and injects the fingerprint
   * spoofing script into the BrowserView before any page scripts execute.
   * 
   * @private
   * @param {BrowserView} view - The BrowserView to inject fingerprint into
   * @param {string} accountId - Account identifier for logging
   * @param {Object} fingerprintConfig - Fingerprint configuration object
   * @returns {Promise<{success: boolean, error?: string, generationTime?: number}>}
   * 
   * **Validates: Requirements 24.1, 32.3**
   */
  async _injectFingerprint(view, accountId, fingerprintConfig) {
    const startTime = Date.now();

    try {
      this.log('info', `Injecting fingerprint for account ${accountId}`);

      // Create FingerprintInjector instance
      const injector = new FingerprintInjector(fingerprintConfig, {
        minify: false,
        includeWorkerInterceptor: false,
        includeIframeProtection: true,
        strictMode: true
      });

      // Validate the injector configuration
      const validation = injector.validate();
      if (validation.warnings.length > 0) {
        this.log('warn', `Fingerprint config warnings for ${accountId}:`, validation.warnings);
      }

      // Get the injection script
      const essentialModules = ['navigator', 'browserBehavior', 'webgl', 'canvas', 'fonts', 'clientRects', 'timezone', 'geolocation', 'mediaDevices', 'webrtc', 'screen'];
      const injectionScript = injector.getInjectionScript({ includeWorkerInterceptor: false, include: essentialModules });
      const generationTime = injector.getGenerationTime();

      this.log('debug', `Fingerprint script generated for ${accountId} in ${generationTime}ms`);

      // Set up injection on page load
      // We need to inject the script as early as possible, before any page scripts run
      view.webContents.on('dom-ready', async () => {
        try {
          await view.webContents.executeJavaScript(injectionScript, true);
          this.log('info', `Fingerprint injected successfully for account ${accountId}`);
        } catch (execError) {
          this.log('error', `Failed to execute fingerprint script for ${accountId}:`, execError);
        }
      });

      // Also inject on navigation to handle SPA navigation
      view.webContents.on('did-navigate', async () => {
        try {
          await view.webContents.executeJavaScript(injectionScript, true);
          this.log('debug', `Fingerprint re-injected after navigation for account ${accountId}`);
        } catch (execError) {
          this.log('warn', `Failed to re-inject fingerprint after navigation for ${accountId}:`, execError);
        }
      });

      // Inject on in-page navigation as well
      view.webContents.on('did-navigate-in-page', async () => {
        try {
          await view.webContents.executeJavaScript(injectionScript, true);
          this.log('debug', `Fingerprint re-injected after in-page navigation for account ${accountId}`);
        } catch (execError) {
          // In-page navigation failures are less critical
          this.log('debug', `In-page fingerprint injection skipped for ${accountId}`);
        }
      });

      const totalTime = Date.now() - startTime;
      this.log('info', `Fingerprint injection setup completed for ${accountId} in ${totalTime}ms`);

      return {
        success: true,
        generationTime,
        totalTime
      };
    } catch (error) {
      this.log('error', `Failed to inject fingerprint for ${accountId}:`, error);

      // Continue without fingerprint injection - don't break the view creation
      // **Validates: Requirement 24.5** - Log error and continue with default browser behavior
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Update fingerprint configuration for an existing BrowserView
   * 
   * This method allows updating the fingerprint configuration for an active view
   * without recreating the entire BrowserView.
   * 
   * @param {BrowserView} view - The BrowserView to update
   * @param {string} accountId - Account identifier for logging
   * @param {Object} fingerprintConfig - New fingerprint configuration
   * @returns {Promise<{success: boolean, error?: string}>}
   * 
   * **Validates: Requirement 24.2**
   */
  async updateFingerprint(view, accountId, fingerprintConfig) {
    try {
      this.log('info', `Updating fingerprint for account ${accountId}`);

      // Create new injector with updated config
      const injector = new FingerprintInjector(fingerprintConfig, {
        minify: false,
        includeWorkerInterceptor: false,
        includeIframeProtection: true,
        strictMode: true
      });

      // Get the injection script
      const essentialModules = ['navigator', 'webgl', 'canvas', 'fonts', 'clientRects', 'timezone', 'geolocation', 'mediaDevices', 'webrtc', 'screen'];
      const injectionScript = injector.getInjectionScript({ includeWorkerInterceptor: false, include: essentialModules });

      // Execute the updated script immediately
      await view.webContents.executeJavaScript(injectionScript, true);

      this.log('info', `Fingerprint updated successfully for account ${accountId}`);

      return { success: true };
    } catch (error) {
      this.log('error', `Failed to update fingerprint for ${accountId}:`, error);
      return {
        success: false,
        error: error.message
      };
    }
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
