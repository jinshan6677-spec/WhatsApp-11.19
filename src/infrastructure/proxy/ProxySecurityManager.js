'use strict';

const ProxyError = require('../../domain/errors/ProxyError');
const ProxyConfig = require('../../domain/entities/ProxyConfig');

/**
 * Security Policy Enum
 * @readonly
 * @enum {string}
 */
const SecurityPolicy = {
  PROXY_ONLY: 'proxy_only',      // All requests must go through proxy
  ALLOW_LOCAL: 'allow_local',    // Allow local/localhost connections
  STRICT: 'strict'               // Most restrictive - block everything without proxy
};

/**
 * Request Interception Result
 * @readonly
 * @enum {string}
 */
const InterceptionResult = {
  ALLOW: 'allow',
  BLOCK: 'block',
  REDIRECT: 'redirect'
};

/**
 * Default bypass rules for local connections
 * @readonly
 */
const DEFAULT_BYPASS_RULES = 'localhost,127.0.0.1,<local>';

/**
 * ProxySecurityManager - Zero Trust Network Security Manager
 * 
 * Implements enterprise-grade IP security protection following the zero-trust model.
 * Key principles:
 * - Never trust, always verify
 * - All network requests must go through the configured proxy
 * - No fallback to direct connections
 * - Block all requests if proxy is unavailable
 * 
 * @class
 */
class ProxySecurityManager {
  /**
   * Creates a ProxySecurityManager instance
   * @param {Object} [options={}] - Configuration options
   * @param {Function} [options.logger] - Logger function
   * @param {Object} [options.eventBus] - Event bus for publishing security events
   * @param {string} [options.policy] - Security policy (default: PROXY_ONLY)
   */
  constructor(options = {}) {
    this.options = options;
    this.log = options.logger || this._createLogger();
    this.eventBus = options.eventBus || null;
    this.policy = options.policy || SecurityPolicy.PROXY_ONLY;
    
    // Track sessions with enforced proxy
    this._enforcedSessions = new Map();
    
    // Track blocked requests for auditing
    this._blockedRequests = [];
    this._maxBlockedRequestsLog = 1000;
    
    // Track interceptors for cleanup
    this._interceptors = new Map();
  }

  /**
   * Creates a default logger
   * @private
   * @returns {Function}
   */
  _createLogger() {
    return (level, message, ...args) => {
      const timestamp = new Date().toISOString();
      const prefix = `[${timestamp}] [ProxySecurityManager] [${level.toUpperCase()}]`;
      
      if (level === 'error') {
        console.error(prefix, message, ...args);
      } else if (level === 'warn') {
        console.warn(prefix, message, ...args);
      } else {
        console.log(prefix, message, ...args);
      }
    };
  }

  // ==================== Core Security Methods ====================

  /**
   * Enforces proxy-only mode for a session
   * All network requests will be forced through the proxy with no fallback
   * 
   * @param {Electron.Session} session - Electron session to enforce
   * @param {string} [sessionId] - Optional session identifier for tracking
   * @returns {Promise<boolean>} True if enforcement was successful
   * @throws {ProxyError} If session is invalid
   */
  async enforceProxyOnly(session, sessionId = null) {
    if (!session) {
      throw ProxyError.invalidConfig('Session is required for proxy enforcement');
    }

    const id = sessionId || this._getSessionId(session);
    
    try {
      this.log('info', `Enforcing proxy-only mode for session: ${id}`);
      
      // Store session state
      this._enforcedSessions.set(id, {
        session,
        enforcedAt: new Date(),
        policy: this.policy,
        proxyConfigured: false,
        blocked: false
      });

      // Set up request interceptor to block direct connections
      await this.setupRequestInterceptor(session, id);
      
      this.log('info', `✓ Proxy-only mode enforced for session: ${id}`);
      
      // Emit event if event bus is available
      if (this.eventBus) {
        this.eventBus.publish('proxy:security:enforced', {
          sessionId: id,
          policy: this.policy,
          timestamp: new Date().toISOString()
        });
      }

      return true;
    } catch (error) {
      this.log('error', `Failed to enforce proxy-only mode: ${error.message}`);
      throw error;
    }
  }

  /**
   * Blocks all direct connections for a session
   * This is the core security mechanism that prevents IP leaks
   * 
   * @param {Electron.Session} session - Electron session
   * @param {string} [sessionId] - Session identifier
   * @returns {Promise<boolean>} True if blocking was successful
   */
  async blockDirectConnections(session, sessionId = null) {
    if (!session) {
      throw ProxyError.invalidConfig('Session is required');
    }

    const id = sessionId || this._getSessionId(session);
    
    try {
      this.log('info', `Blocking direct connections for session: ${id}`);
      
      // Update session state
      const state = this._enforcedSessions.get(id);
      if (state) {
        state.blocked = true;
      }

      // Configure session to reject all requests without proxy
      // This is done by setting an invalid proxy that will cause all requests to fail
      // rather than falling back to direct connection
      await session.setProxy({
        proxyRules: 'http=invalid-proxy:0;https=invalid-proxy:0;socks=invalid-proxy:0',
        proxyBypassRules: '' // No bypass - block everything
      });

      this.log('info', `✓ Direct connections blocked for session: ${id}`);
      
      // Emit event
      if (this.eventBus) {
        this.eventBus.publish('proxy:security:blocked', {
          sessionId: id,
          reason: 'direct_connections_blocked',
          timestamp: new Date().toISOString()
        });
      }

      return true;
    } catch (error) {
      this.log('error', `Failed to block direct connections: ${error.message}`);
      throw error;
    }
  }

  /**
   * Configures proxy rules for a session with security enforcement
   * 
   * @param {Electron.Session} session - Electron session
   * @param {ProxyConfig|Object} config - Proxy configuration
   * @param {string} [sessionId] - Session identifier
   * @returns {Promise<Object>} Configuration result
   * @throws {ProxyError} If configuration is invalid
   */
  async configureProxyRules(session, config, sessionId = null) {
    if (!session) {
      throw ProxyError.invalidConfig('Session is required');
    }

    // Validate and normalize config
    const proxyConfig = config instanceof ProxyConfig ? config : new ProxyConfig(config);
    const validation = proxyConfig.validate();
    
    if (!validation.valid) {
      const errorDetails = validation.errors.map(e => `${e.field}: ${e.reason}`).join('; ');
      throw ProxyError.invalidConfig(errorDetails, config);
    }

    if (!proxyConfig.enabled) {
      throw ProxyError.disabled(proxyConfig.id);
    }

    const id = sessionId || this._getSessionId(session);
    
    try {
      this.log('info', `Configuring proxy rules for session: ${id}`);
      this.log('info', `  Protocol: ${proxyConfig.protocol}`);
      this.log('info', `  Host: ${proxyConfig.host}`);
      this.log('info', `  Port: ${proxyConfig.port}`);
      this.log('info', `  Auth: ${proxyConfig.hasAuthentication() ? 'Yes' : 'No'}`);

      // Build proxy rules string
      const proxyRules = this._buildProxyRules(proxyConfig);
      const bypassRules = this._buildBypassRules(proxyConfig);

      // Apply proxy configuration
      this.log('info', `[SOCKS5-DEBUG] Setting proxy rules: ${proxyRules.replace(/:([^:@]+)@/, ':***@')}`);
      this.log('info', `[SOCKS5-DEBUG] Bypass rules: ${bypassRules}`);
      
      await session.setProxy({
        proxyRules,
        proxyBypassRules: bypassRules
      });

      // Test proxy resolution
      const resolution = await this.testProxyResolution(session);
      this.log('info', `[SOCKS5-DEBUG] Proxy resolution result: ${resolution}`);

      // Test actual proxy connection using Electron's net module
      this.log('info', `[SOCKS5-DEBUG] Testing actual proxy connection...`);
      const connectionTest = await this.testProxyConnection(session);
      if (connectionTest.success) {
        this.log('info', `[SOCKS5-DEBUG] ✓ Proxy connection test passed! IP: ${connectionTest.ip || 'N/A'}`);
      } else {
        this.log('error', `[SOCKS5-DEBUG] ✗ Proxy connection test failed: ${connectionTest.error}`);
        // Don't throw here, let the BrowserView try to load and see what happens
      }

      // Set up authentication handler
      if (proxyConfig.hasAuthentication()) {
        if (proxyConfig.protocol === 'socks5' || proxyConfig.protocol === 'socks4') {
          // SOCKS proxy - use session login event for authentication
          this._setupSocksAuth(session, proxyConfig, id);
        } else {
          // HTTP/HTTPS proxy - use header-based authentication
          this._setupProxyAuth(session, proxyConfig, id);
        }
      }

      // Update or create session state
      let state = this._enforcedSessions.get(id);
      if (state) {
        state.proxyConfigured = true;
        state.proxyConfig = proxyConfig;
        state.blocked = false;
      } else {
        // Create new session state if it doesn't exist
        this._enforcedSessions.set(id, {
          session,
          enforcedAt: new Date(),
          policy: this.policy,
          proxyConfigured: true,
          proxyConfig: proxyConfig,
          blocked: false
        });
      }

      this.log('info', `✓ Proxy rules configured for session: ${id}`);

      // Emit event
      if (this.eventBus) {
        this.eventBus.publish('proxy:security:configured', {
          sessionId: id,
          proxyId: proxyConfig.id,
          protocol: proxyConfig.protocol,
          host: proxyConfig.host,
          port: proxyConfig.port,
          timestamp: new Date().toISOString()
        });
      }

      return {
        success: true,
        sessionId: id,
        proxyId: proxyConfig.id,
        proxyRules: proxyRules.replace(/:([^:@]+)@/, ':***@') // Mask password in logs
      };
    } catch (error) {
      this.log('error', `Failed to configure proxy rules: ${error.message}`);
      
      // Block all connections on failure - zero trust
      await this.blockDirectConnections(session, id);
      
      throw error;
    }
  }

  /**
   * Sets up request interceptor for security monitoring
   * Intercepts all requests to ensure they go through proxy
   * 
   * @param {Electron.Session} session - Electron session
   * @param {string} [sessionId] - Session identifier
   * @returns {Promise<void>}
   */
  async setupRequestInterceptor(session, sessionId = null) {
    if (!session || !session.webRequest) {
      this.log('warn', 'Session does not support webRequest API');
      return;
    }

    const id = sessionId || this._getSessionId(session);
    
    try {
      // Remove existing interceptor if any
      this._removeInterceptor(id);

      // Set up new interceptor
      const interceptor = {
        onBeforeRequest: (details, callback) => {
          const result = this._interceptRequest(details, id);
          
          if (result.action === InterceptionResult.BLOCK) {
            this._logBlockedRequest(details, id, result.reason);
            callback({ cancel: true });
          } else {
            callback({});
          }
        }
      };

      // Register the interceptor
      session.webRequest.onBeforeRequest(
        { urls: ['*://*/*'] },
        interceptor.onBeforeRequest
      );

      // Store interceptor reference for cleanup
      this._interceptors.set(id, {
        session,
        interceptor,
        createdAt: new Date()
      });

      this.log('info', `Request interceptor set up for session: ${id}`);
    } catch (error) {
      this.log('error', `Failed to set up request interceptor: ${error.message}`);
      throw error;
    }
  }

  // ==================== Helper Methods ====================

  /**
   * Builds proxy rules string from config
   * @private
   * @param {ProxyConfig} config - Proxy configuration
   * @returns {string} Proxy rules string
   */
  _buildProxyRules(config) {
    const { protocol, host, port, username, password } = config;
    
    // For SOCKS5 proxies with authentication:
    // Chromium supports username:password in SOCKS5 URLs
    // Format: socks5://username:password@host:port
    // 
    // IMPORTANT: Chromium/Electron SOCKS5 authentication notes:
    // 1. URL-embedded credentials: socks5://user:pass@host:port
    //    - This is the most reliable method for SOCKS5 auth in Chromium
    //    - The 'login' event does NOT trigger for SOCKS5 proxies
    // 2. socks5h:// vs socks5://
    //    - socks5:// - DNS resolution happens locally
    //    - socks5h:// - DNS resolution happens through the proxy (more secure)
    //    - Chromium may not support socks5h:// in all versions
    // 3. Special characters in credentials must be URL-encoded
    
    let proxyUrl;
    if (config.hasAuthentication() && (protocol === 'socks5' || protocol === 'socks4')) {
      // URL-encode username and password to handle special characters
      // Use double encoding for characters that might cause issues
      const encodedUsername = this._encodeProxyCredential(username);
      const encodedPassword = this._encodeProxyCredential(password);
      
      // Try socks5:// first (most compatible)
      proxyUrl = `${protocol}://${encodedUsername}:${encodedPassword}@${host}:${port}`;
      
      this.log('info', `[SOCKS5-AUTH] Building SOCKS proxy URL with embedded credentials`);
      this.log('info', `[SOCKS5-AUTH] Protocol: ${protocol}`);
      this.log('info', `[SOCKS5-AUTH] Host: ${host}:${port}`);
      this.log('info', `[SOCKS5-AUTH] Username length: ${username.length}`);
      this.log('info', `[SOCKS5-AUTH] Password length: ${password.length}`);
      this.log('info', `[SOCKS5-AUTH] Encoded username: ${encodedUsername}`);
      this.log('info', `[SOCKS5-AUTH] URL (masked): ${protocol}://${encodedUsername}:***@${host}:${port}`);
    } else {
      proxyUrl = `${protocol}://${host}:${port}`;
      this.log('info', `[SOCKS5-AUTH] Building SOCKS proxy URL without credentials: ${proxyUrl}`);
    }

    return proxyUrl;
  }

  /**
   * Encodes a proxy credential for use in URL
   * @private
   * @param {string} credential - Username or password
   * @returns {string} Encoded credential
   */
  _encodeProxyCredential(credential) {
    if (!credential) return '';
    
    // Standard URL encoding
    let encoded = encodeURIComponent(credential);
    
    // Additional encoding for characters that might cause issues in proxy URLs
    // Some proxy implementations have trouble with certain characters even when encoded
    encoded = encoded
      .replace(/!/g, '%21')
      .replace(/'/g, '%27')
      .replace(/\(/g, '%28')
      .replace(/\)/g, '%29')
      .replace(/\*/g, '%2A');
    
    return encoded;
  }

  /**
   * Builds bypass rules string from config
   * @private
   * @param {ProxyConfig} config - Proxy configuration
   * @returns {string} Bypass rules string
   */
  _buildBypassRules(config) {
    // In strict mode, no bypass is allowed
    if (this.policy === SecurityPolicy.STRICT) {
      return '';
    }
    
    // Allow local connections if policy permits
    if (this.policy === SecurityPolicy.ALLOW_LOCAL) {
      return config.bypass || DEFAULT_BYPASS_RULES;
    }
    
    // Default: minimal bypass for localhost only
    return config.bypass || DEFAULT_BYPASS_RULES;
  }

  /**
   * Sets up proxy authentication for HTTP/HTTPS proxies
   * @private
   * @param {Electron.Session} session - Electron session
   * @param {ProxyConfig} config - Proxy configuration
   * @param {string} sessionId - Session identifier
   */
  _setupProxyAuth(session, config, sessionId) {
    if (!session.webRequest) {
      this.log('warn', 'Session does not support webRequest API for auth');
      return;
    }

    const { username, password } = config;
    const authHeader = Buffer.from(`${username}:${password}`).toString('base64');

    // Remove existing auth handler
    session.webRequest.onBeforeSendHeaders(null);

    // Set up new auth handler
    session.webRequest.onBeforeSendHeaders((details, callback) => {
      details.requestHeaders['Proxy-Authorization'] = `Basic ${authHeader}`;
      callback({ requestHeaders: details.requestHeaders });
    });

    this.log('info', `Proxy authentication configured for session: ${sessionId}`);
  }

  /**
   * Sets up SOCKS proxy authentication using session login event
   * @private
   * @param {Electron.Session} session - Electron session
   * @param {ProxyConfig} config - Proxy configuration
   * @param {string} sessionId - Session identifier
   */
  _setupSocksAuth(session, config, sessionId) {
    const { username, password, host, port } = config;
    
    // Remove existing login handler if any
    session.removeAllListeners('login');
    
    // Store credentials for this session
    const proxyHost = host;
    const proxyPort = port;
    
    this.log('info', `[SOCKS5-AUTH] Setting up authentication handler for session: ${sessionId}`);
    this.log('info', `[SOCKS5-AUTH] Proxy: ${proxyHost}:${proxyPort}`);
    this.log('info', `[SOCKS5-AUTH] Has credentials: ${!!(username && password)}`);
    
    // Set up login event handler for SOCKS authentication
    // Note: Electron's session 'login' event signature is:
    // (event, webContents, authenticationResponseDetails, authInfo, callback)
    // But for session (not app), it's: (event, details, authInfo, callback)
    session.on('login', (event, details, authInfo, callback) => {
      this.log('info', `[SOCKS5-AUTH] === LOGIN EVENT RECEIVED ===`);
      this.log('info', `[SOCKS5-AUTH] Session: ${sessionId}`);
      this.log('info', `[SOCKS5-AUTH] URL: ${details?.url || 'N/A'}`);
      this.log('info', `[SOCKS5-AUTH] AuthInfo: ${JSON.stringify(authInfo)}`);
      this.log('info', `[SOCKS5-AUTH] isProxy: ${authInfo.isProxy}`);
      this.log('info', `[SOCKS5-AUTH] scheme: ${authInfo.scheme}`);
      this.log('info', `[SOCKS5-AUTH] host: ${authInfo.host}`);
      this.log('info', `[SOCKS5-AUTH] port: ${authInfo.port}`);
      this.log('info', `[SOCKS5-AUTH] realm: ${authInfo.realm}`);
      
      // Check if this is a proxy authentication request
      if (authInfo.isProxy) {
        this.log('info', `[SOCKS5-AUTH] Proxy authentication requested`);
        this.log('info', `[SOCKS5-AUTH] Expected: ${proxyHost}:${proxyPort}`);
        this.log('info', `[SOCKS5-AUTH] Received: ${authInfo.host}:${authInfo.port}`);
        
        // Provide credentials - must call event.preventDefault() first
        event.preventDefault();
        callback(username, password);
        
        this.log('info', `[SOCKS5-AUTH] ✓ Credentials provided for session: ${sessionId}`);
      } else {
        // Not a proxy auth request, cancel it (don't provide credentials for non-proxy auth)
        this.log('info', `[SOCKS5-AUTH] Non-proxy auth request, cancelling`);
        callback();
      }
    });

    this.log('info', `[SOCKS5-AUTH] ✓ Authentication handler registered for session: ${sessionId}`);
  }

  /**
   * Test proxy resolution for debugging
   * @param {Electron.Session} session - Electron session
   * @param {string} testUrl - URL to test proxy resolution
   * @returns {Promise<string>} Proxy resolution result
   */
  async testProxyResolution(session, testUrl = 'https://web.whatsapp.com/') {
    try {
      const result = await session.resolveProxy(testUrl);
      this.log('info', `[SOCKS5-DEBUG] Proxy resolution for ${testUrl}: ${result}`);
      return result;
    } catch (error) {
      this.log('error', `[SOCKS5-DEBUG] Proxy resolution failed: ${error.message}`);
      return `ERROR: ${error.message}`;
    }
  }

  /**
   * Perform a comprehensive proxy test using Electron's net module
   * @param {Electron.Session} session - Electron session
   * @param {string} testUrl - URL to test
   * @returns {Promise<{success: boolean, ip?: string, error?: string, latency?: number}>}
   */
  async testProxyConnection(session, testUrl = 'https://api.ipify.org?format=json') {
    const { net } = require('electron');
    
    this.log('info', `[SOCKS5-TEST] Testing proxy connection with ${testUrl}`);
    
    return new Promise((resolve) => {
      const startTime = Date.now();
      const timeout = setTimeout(() => {
        this.log('error', `[SOCKS5-TEST] Connection timeout after 10s`);
        resolve({ success: false, error: 'Connection timeout' });
      }, 10000);

      try {
        const request = net.request({
          url: testUrl,
          session: session,
          method: 'GET'
        });

        let responseData = '';

        request.on('response', (response) => {
          this.log('info', `[SOCKS5-TEST] Response status: ${response.statusCode}`);
          
          response.on('data', (chunk) => {
            responseData += chunk.toString();
          });

          response.on('end', () => {
            clearTimeout(timeout);
            const latency = Date.now() - startTime;
            
            try {
              const data = JSON.parse(responseData);
              this.log('info', `[SOCKS5-TEST] ✓ Success! IP: ${data.ip}, Latency: ${latency}ms`);
              resolve({ success: true, ip: data.ip, latency });
            } catch (e) {
              this.log('info', `[SOCKS5-TEST] ✓ Success! Response: ${responseData.substring(0, 100)}, Latency: ${latency}ms`);
              resolve({ success: true, latency });
            }
          });
        });

        request.on('error', (error) => {
          clearTimeout(timeout);
          this.log('error', `[SOCKS5-TEST] ✗ Request error: ${error.message}`);
          resolve({ success: false, error: error.message });
        });

        request.end();
      } catch (error) {
        clearTimeout(timeout);
        this.log('error', `[SOCKS5-TEST] ✗ Exception: ${error.message}`);
        resolve({ success: false, error: error.message });
      }
    });
  }

  /**
   * Intercepts and evaluates a request
   * @private
   * @param {Object} details - Request details
   * @param {string} sessionId - Session identifier
   * @returns {Object} Interception result
   */
  _interceptRequest(details, sessionId) {
    const state = this._enforcedSessions.get(sessionId);
    
    // If session is blocked, reject all requests
    if (state && state.blocked) {
      return {
        action: InterceptionResult.BLOCK,
        reason: 'Session is blocked - proxy unavailable'
      };
    }

    // Check for suspicious direct connection attempts
    const url = new URL(details.url);
    
    // Block WebRTC-related requests (potential IP leak)
    if (this._isWebRTCRequest(details)) {
      return {
        action: InterceptionResult.BLOCK,
        reason: 'WebRTC request blocked - potential IP leak'
      };
    }

    // Allow the request (it will go through the configured proxy)
    return {
      action: InterceptionResult.ALLOW,
      reason: null
    };
  }

  /**
   * Checks if a request is WebRTC-related
   * @private
   * @param {Object} details - Request details
   * @returns {boolean}
   */
  _isWebRTCRequest(details) {
    const webrtcPatterns = [
      /stun:/i,
      /turn:/i,
      /\.stun\./i,
      /\.turn\./i,
      /webrtc/i
    ];

    return webrtcPatterns.some(pattern => pattern.test(details.url));
  }

  /**
   * Logs a blocked request for auditing
   * @private
   * @param {Object} details - Request details
   * @param {string} sessionId - Session identifier
   * @param {string} reason - Block reason
   */
  _logBlockedRequest(details, sessionId, reason) {
    const record = {
      timestamp: new Date().toISOString(),
      sessionId,
      url: details.url,
      method: details.method,
      reason
    };

    this._blockedRequests.push(record);
    
    // Trim log if too large
    if (this._blockedRequests.length > this._maxBlockedRequestsLog) {
      this._blockedRequests = this._blockedRequests.slice(-this._maxBlockedRequestsLog / 2);
    }

    this.log('warn', `Blocked request: ${details.url} - ${reason}`);

    // Emit event
    if (this.eventBus) {
      this.eventBus.publish('proxy:security:request_blocked', record);
    }
  }

  /**
   * Removes an interceptor for a session
   * @private
   * @param {string} sessionId - Session identifier
   */
  _removeInterceptor(sessionId) {
    const interceptorInfo = this._interceptors.get(sessionId);
    
    if (interceptorInfo && interceptorInfo.session && interceptorInfo.session.webRequest) {
      try {
        interceptorInfo.session.webRequest.onBeforeRequest(null);
        this._interceptors.delete(sessionId);
        this.log('info', `Removed interceptor for session: ${sessionId}`);
      } catch (error) {
        this.log('warn', `Failed to remove interceptor: ${error.message}`);
      }
    }
  }

  /**
   * Generates a unique session ID
   * @private
   * @returns {string}
   */
  _generateSessionId() {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Gets or generates session ID
   * @private
   * @param {Electron.Session} session - Electron session
   * @returns {string}
   */
  _getSessionId(session) {
    // Try to find existing session ID
    for (const [id, state] of this._enforcedSessions) {
      if (state.session === session) {
        return id;
      }
    }
    return this._generateSessionId();
  }

  // ==================== Public Utility Methods ====================

  /**
   * Gets the current security policy
   * @returns {string}
   */
  getPolicy() {
    return this.policy;
  }

  /**
   * Sets the security policy
   * @param {string} policy - New policy
   */
  setPolicy(policy) {
    if (!Object.values(SecurityPolicy).includes(policy)) {
      throw new Error(`Invalid security policy: ${policy}`);
    }
    this.policy = policy;
    this.log('info', `Security policy changed to: ${policy}`);
  }

  /**
   * Gets blocked requests log
   * @param {number} [limit=100] - Maximum number of records to return
   * @returns {Array} Blocked requests
   */
  getBlockedRequests(limit = 100) {
    return this._blockedRequests.slice(-limit);
  }

  /**
   * Clears blocked requests log
   */
  clearBlockedRequests() {
    this._blockedRequests = [];
    this.log('info', 'Blocked requests log cleared');
  }

  /**
   * Gets enforced sessions info
   * @returns {Array} Session info array
   */
  getEnforcedSessions() {
    const sessions = [];
    for (const [id, state] of this._enforcedSessions) {
      sessions.push({
        sessionId: id,
        enforcedAt: state.enforcedAt,
        policy: state.policy,
        proxyConfigured: state.proxyConfigured,
        blocked: state.blocked
      });
    }
    return sessions;
  }

  /**
   * Checks if a session has proxy enforced
   * @param {string} sessionId - Session identifier
   * @returns {boolean}
   */
  isEnforced(sessionId) {
    return this._enforcedSessions.has(sessionId);
  }

  /**
   * Checks if a session is blocked
   * @param {string} sessionId - Session identifier
   * @returns {boolean}
   */
  isBlocked(sessionId) {
    const state = this._enforcedSessions.get(sessionId);
    return state ? state.blocked : false;
  }

  /**
   * Releases enforcement for a session
   * @param {string} sessionId - Session identifier
   * @returns {boolean} True if released
   */
  releaseEnforcement(sessionId) {
    if (!this._enforcedSessions.has(sessionId)) {
      return false;
    }

    // Remove interceptor
    this._removeInterceptor(sessionId);
    
    // Remove session state
    this._enforcedSessions.delete(sessionId);
    
    this.log('info', `Released enforcement for session: ${sessionId}`);

    // Emit event
    if (this.eventBus) {
      this.eventBus.publish('proxy:security:released', {
        sessionId,
        timestamp: new Date().toISOString()
      });
    }

    return true;
  }

  /**
   * Cleans up all resources
   */
  cleanup() {
    this.log('info', 'Cleaning up ProxySecurityManager...');
    
    // Remove all interceptors
    for (const sessionId of this._interceptors.keys()) {
      this._removeInterceptor(sessionId);
    }
    
    // Clear session states
    this._enforcedSessions.clear();
    
    // Clear blocked requests
    this._blockedRequests = [];
    
    this.log('info', 'ProxySecurityManager cleanup complete');
  }
}

// Export class and enums
ProxySecurityManager.SecurityPolicy = SecurityPolicy;
ProxySecurityManager.InterceptionResult = InterceptionResult;
module.exports = ProxySecurityManager;
