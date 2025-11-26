/**
 * SessionValidator - Session validation and proxy configuration
 * Handles proxy setup, validation, and authentication
 */

class SessionValidator {
  constructor(sessionStorage, logger) {
    this.sessionStorage = sessionStorage;
    this.log = logger;
    this.proxyCache = new Map();
  }

  /**
   * Validate proxy configuration
   * @private
   * @param {Object} proxyConfig - Proxy configuration
   * @returns {{valid: boolean, error?: string}}
   */
  _validateProxyConfig(proxyConfig) {
    if (!proxyConfig) {
      return { valid: false, error: 'Proxy config is required' };
    }

    const { protocol, host, port } = proxyConfig;

    if (!protocol || !['http', 'https', 'socks5'].includes(protocol.toLowerCase())) {
      return { valid: false, error: 'Invalid protocol: must be http, https, or socks5' };
    }

    if (!host || typeof host !== 'string') {
      return { valid: false, error: 'Invalid host: must be a non-empty string' };
    }

    if (!port || typeof port !== 'number' || port < 1 || port > 65535) {
      return { valid: false, error: 'Invalid port: must be a number between 1 and 65535' };
    }

    return { valid: true };
  }

  /**
   * Setup proxy authentication
   * @private
   * @param {Electron.Session} accountSession - Account session
   * @param {string} username - Username
   * @param {string} password - Password
   */
  _setupProxyAuth(accountSession, username, password) {
    // Remove previous listener if exists
    accountSession.webRequest.onBeforeSendHeaders(null);

    // Add authentication header
    accountSession.webRequest.onBeforeSendHeaders((details, callback) => {
      if (details.url.startsWith('http://') || details.url.startsWith('https://')) {
        const auth = Buffer.from(`${username}:${password}`).toString('base64');
        details.requestHeaders['Proxy-Authorization'] = `Basic ${auth}`;
      }
      callback({ requestHeaders: details.requestHeaders });
    });

    this.log('info', 'Proxy authentication configured');
  }

  /**
   * Configure proxy for account
   * @param {string} accountId - Account ID
   * @param {Object} proxyConfig - Proxy configuration
   * @returns {Promise<{success: boolean, error?: string, fallbackApplied?: boolean}>}
   */
  async configureProxy(accountId, proxyConfig) {
    try {
      this.log('info', `Configuring proxy for account ${accountId}`);

      // Validate proxy configuration
      const validation = this._validateProxyConfig(proxyConfig);
      if (!validation.valid) {
        throw new Error(`Invalid proxy configuration: ${validation.error}`);
      }

      const accountSession = this.sessionStorage.getSession(accountId);
      if (!accountSession) {
        throw new Error(`Session not found for account ${accountId}`);
      }

      const { protocol, host, port, username, password, bypass } = proxyConfig;

      // Build proxy rules string
      let scheme = protocol.toLowerCase();
      if (scheme === 'socks5') {
        scheme = 'socks5';
      }

      let proxyRules = `${scheme}://${host}:${port}`;

      // Configure proxy
      const proxySettings = {
        proxyRules: proxyRules
      };

      if (bypass) {
        proxySettings.proxyBypassRules = bypass;
      }

      await accountSession.setProxy(proxySettings);

      // Setup authentication if provided
      if (username && password) {
        this._setupProxyAuth(accountSession, username, password);
      }

      // Cache proxy configuration
      this.proxyCache.set(accountId, proxyConfig);

      this.log('info', `Proxy configured successfully for account ${accountId}`);

      return { success: true };
    } catch (error) {
      this.log('error', `Failed to configure proxy for account ${accountId}:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get proxy configuration
   * @param {string} accountId - Account ID
   * @returns {Object|null}
   */
  getProxyConfig(accountId) {
    return this.proxyCache.get(accountId) || null;
  }

  /**
   * Clear proxy configuration
   * @param {string} accountId - Account ID
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async clearProxy(accountId) {
    try {
      this.log('info', `Clearing proxy for account ${accountId}`);

      const accountSession = this.sessionStorage.getSession(accountId);
      if (!accountSession) {
        throw new Error(`Session not found for account ${accountId}`);
      }

      // Clear proxy settings
      await accountSession.setProxy({ proxyRules: '' });

      // Remove from cache
      this.proxyCache.delete(accountId);

      this.log('info', `Proxy cleared successfully for account ${accountId}`);

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
   * Validate proxy connectivity
   * @private
   * @param {Electron.Session} accountSession - Account session
   * @param {string} proxyRules - Proxy rules
   * @param {string} username - Username
   * @param {string} password - Password
   * @returns {Promise<boolean>}
   */
  async _validateProxyConnectivity(accountSession, proxyRules, username, password) {
    try {
      // This is a placeholder for proxy connectivity validation
      // In a real implementation, you would make a test request through the proxy
      this.log('info', 'Validating proxy connectivity...');

      // For now, assume proxy is valid
      return true;
    } catch (error) {
      this.log('error', 'Proxy connectivity validation failed:', error);
      return false;
    }
  }
}

module.exports = SessionValidator;
