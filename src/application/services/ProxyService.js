'use strict';

const ProxyConfig = require('../../domain/entities/ProxyConfig');
const ProxyConnectionStatus = require('../../domain/entities/ProxyConnectionStatus');
const ProxyError = require('../../domain/errors/ProxyError');
const ProxyPreChecker = require('../../infrastructure/proxy/ProxyPreChecker');
const IPLeakDetector = require('../../infrastructure/proxy/IPLeakDetector');
const ProxySecurityManager = require('../../infrastructure/proxy/ProxySecurityManager');
const KillSwitch = require('../../infrastructure/proxy/KillSwitch');
const ProxyHealthMonitor = require('../../infrastructure/proxy/ProxyHealthMonitor');
const ProxyReconnectionManager = require('../../infrastructure/proxy/ProxyReconnectionManager');
const IPProtectionInjector = require('../../infrastructure/proxy/IPProtectionInjector');

/**
 * ProxyService - Application Service for Secure Proxy Management
 * 
 * This service integrates all proxy security components to provide
 * a unified, secure proxy connection interface. It implements the
 * zero-trust network model where all connections must go through
 * the proxy with no fallback to direct connections.
 * 
 * Key responsibilities:
 * - Secure connection establishment (with pre-checks and IP verification)
 * - Secure disconnection
 * - Proxy testing and validation
 * - Configuration parsing (smart fill)
 * 
 * @class
 */
class ProxyService {
  /**
   * Creates a ProxyService instance
   * @param {Object} [options={}] - Configuration options
   * @param {Function} [options.logger] - Logger function
   * @param {Object} [options.eventBus] - Event bus for publishing events
   * @param {Object} [options.container] - Dependency container
   */
  constructor(options = {}) {
    this.options = options;
    this.log = options.logger || this._createLogger();
    this.eventBus = options.eventBus || null;
    this.container = options.container || null;
    
    // Initialize components
    this.preChecker = options.preChecker || new ProxyPreChecker({ logger: this.log });
    this.ipLeakDetector = options.ipLeakDetector || new IPLeakDetector({ 
      logger: this.log,
      eventBus: this.eventBus 
    });

    this.securityManager = options.securityManager || new ProxySecurityManager({ 
      logger: this.log,
      eventBus: this.eventBus 
    });
    this.killSwitch = options.killSwitch || new KillSwitch({ 
      logger: this.log,
      eventBus: this.eventBus 
    });
    this.healthMonitor = options.healthMonitor || new ProxyHealthMonitor({
      logger: this.log,
      eventBus: this.eventBus,
      killSwitch: this.killSwitch,
      preChecker: this.preChecker,
      ipLeakDetector: this.ipLeakDetector
    });
    this.reconnectionManager = options.reconnectionManager || new ProxyReconnectionManager({
      logger: this.log,
      eventBus: this.eventBus
    });
    this.ipProtectionInjector = options.ipProtectionInjector || new IPProtectionInjector({
      logger: this.log
    });
    
    // Track active connections
    this._connections = new Map(); // accountId -> ConnectionState
  }

  /**
   * Creates a default logger
   * @private
   * @returns {Function}
   */
  _createLogger() {
    return (level, message, ...args) => {
      const timestamp = new Date().toISOString();
      const prefix = `[${timestamp}] [ProxyService] [${level.toUpperCase()}]`;
      
      if (level === 'error') {
        console.error(prefix, message, ...args);
      } else if (level === 'warn') {
        console.warn(prefix, message, ...args);
      } else {
        console.log(prefix, message, ...args);
      }
    };
  }

  // ==================== Core Connection Methods ====================

  /**
   * Establishes a secure proxy connection for an account
   * 
   * This is the main entry point for connecting through a proxy.
   * It performs the following steps:
   * 1. Validate proxy configuration
   * 2. Pre-check proxy connectivity
   * 3. Verify exit IP
   * 4. Create isolated session
   * 5. Enable security protections (Kill-Switch, request interception)
   * 
   * @param {string} accountId - Account ID
   * @param {ProxyConfig|Object} config - Proxy configuration
   * @param {Object} [session] - Electron session (optional, for session configuration)
   * @returns {Promise<{success: boolean, ip?: string, latency?: number, error?: string}>}
   */
  async secureConnect(accountId, config, session = null) {
    if (!accountId) {
      return { success: false, error: 'Account ID is required' };
    }

    const proxyConfig = config instanceof ProxyConfig ? config : new ProxyConfig(config);
    
    this.log('info', `Starting secure connection for account ${accountId}`);

    // Step 1: Validate configuration
    const validation = this.validateConfig(proxyConfig);
    if (!validation.valid) {
      this.log('error', `Invalid proxy configuration: ${validation.errors.join(', ')}`);
      return {
        success: false,
        error: `Invalid configuration: ${validation.errors.join(', ')}`
      };
    }

    // Step 2: Pre-check proxy connectivity
    this.log('info', 'Step 1/5: Testing proxy connectivity...');
    const connectivityResult = await this.preChecker.testConnectivity(proxyConfig);
    if (!connectivityResult.success) {
      this.log('error', `Connectivity test failed: ${connectivityResult.error}`);
      return {
        success: false,
        error: `Proxy connectivity failed: ${connectivityResult.error}`,
        step: 'connectivity'
      };
    }
    this.log('info', `✓ Connectivity test passed (${connectivityResult.latency}ms)`);

    // Step 3: Get and verify exit IP
    this.log('info', 'Step 2/5: Verifying exit IP...');
    const ipResult = await this.preChecker.getExitIP(proxyConfig);
    if (!ipResult.success) {
      this.log('error', `IP verification failed: ${ipResult.error}`);
      return {
        success: false,
        error: `IP verification failed: ${ipResult.error}`,
        step: 'ip_verification'
      };
    }
    this.log('info', `✓ Exit IP verified: ${ipResult.ip}`);

    // Step 4: Configure session security (if session provided)
    if (session) {
      this.log('info', 'Step 3/5: Configuring session security...');
      try {
        await this.securityManager.configureProxyRules(session, proxyConfig);
        await this.securityManager.enforceProxyOnly(session);
        await this.securityManager.setupRequestInterceptor(session);
        this.log('info', '✓ Session security configured');
      } catch (error) {
        this.log('error', `Session security configuration failed: ${error.message}`);
        return {
          success: false,
          error: `Session security failed: ${error.message}`,
          step: 'session_security'
        };
      }
    } else {
      this.log('info', 'Step 3/5: Skipping session configuration (no session provided)');
    }

    // Step 5: Enable Kill-Switch
    this.log('info', 'Step 4/5: Enabling Kill-Switch...');
    await this.killSwitch.enable(accountId);
    this.log('info', '✓ Kill-Switch enabled');

    // Step 6: Start health monitoring
    this.log('info', 'Step 5/5: Starting health monitoring...');
    this.healthMonitor.startMonitoring(accountId, proxyConfig, ipResult.ip);
    this.log('info', '✓ Health monitoring started');

    // Store connection state
    this._connections.set(accountId, {
      config: proxyConfig,
      ip: ipResult.ip,
      connectedAt: new Date(),
      session
    });

    // Emit connection event
    if (this.eventBus) {
      await this.eventBus.publish('proxy:connected', {
        accountId,
        proxyId: proxyConfig.id,
        ip: ipResult.ip,
        latency: connectivityResult.latency,
        timestamp: new Date().toISOString()
      });
    }

    this.log('info', `✓ Secure connection established for ${accountId} (IP: ${ipResult.ip})`);

    return {
      success: true,
      ip: ipResult.ip,
      latency: connectivityResult.latency,
      proxyId: proxyConfig.id
    };
  }


  /**
   * Securely disconnects a proxy connection
   * 
   * @param {string} accountId - Account ID
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async secureDisconnect(accountId) {
    if (!accountId) {
      return { success: false, error: 'Account ID is required' };
    }

    this.log('info', `Disconnecting proxy for account ${accountId}`);

    const connection = this._connections.get(accountId);

    // Stop health monitoring
    this.healthMonitor.stopMonitoring(accountId);

    // Stop any reconnection attempts
    this.reconnectionManager.stopAutoReconnect(accountId);

    // Disable Kill-Switch
    await this.killSwitch.disable(accountId);

    // Clear connection state
    this._connections.delete(accountId);

    // Emit disconnection event
    if (this.eventBus) {
      await this.eventBus.publish('proxy:disconnected', {
        accountId,
        proxyId: connection?.config?.id,
        timestamp: new Date().toISOString()
      });
    }

    this.log('info', `✓ Proxy disconnected for ${accountId}`);

    return { success: true };
  }

  /**
   * Tests a proxy configuration without establishing a full connection
   * Returns exit IP and latency information
   * 
   * @param {ProxyConfig|Object} config - Proxy configuration
   * @returns {Promise<{success: boolean, ip?: string, latency?: Object, error?: string}>}
   */
  async testProxy(config) {
    const proxyConfig = config instanceof ProxyConfig ? config : new ProxyConfig(config);
    
    this.log('info', `Testing proxy ${proxyConfig.host}:${proxyConfig.port}`);

    // Validate first
    const validation = this.validateConfig(proxyConfig);
    if (!validation.valid) {
      return {
        success: false,
        error: `Invalid configuration: ${validation.errors.join(', ')}`
      };
    }

    // Perform full pre-check
    const result = await this.preChecker.performFullCheck(proxyConfig);

    if (result.success) {
      this.log('info', `✓ Proxy test passed (IP: ${result.ip})`);
      return {
        success: true,
        ip: result.ip,
        ipSource: result.ipSource,
        latency: result.latency,
        connectivity: result.connectivity
      };
    } else {
      this.log('error', `✗ Proxy test failed: ${result.error}`);
      return {
        success: false,
        error: result.error
      };
    }
  }

  /**
   * Validates a proxy configuration
   * 
   * @param {ProxyConfig|Object} config - Proxy configuration
   * @returns {{valid: boolean, errors: string[]}}
   */
  validateConfig(config) {
    const proxyConfig = config instanceof ProxyConfig ? config : new ProxyConfig(config);
    const result = proxyConfig.validate();
    
    return {
      valid: result.valid,
      errors: result.errors ? result.errors.map(e => `${e.field}: ${e.reason}`) : []
    };
  }

  /**
   * Parses a proxy string into a ProxyConfig object
   * Supports multiple formats:
   * - host:port
   * - protocol://host:port
   * - protocol://user:pass@host:port
   * - Smart fill (auto-detect from pasted text)
   * 
   * @param {string} input - Proxy string to parse
   * @returns {{success: boolean, config?: ProxyConfig, error?: string}}
   */
  parseProxyString(input) {
    if (!input || typeof input !== 'string') {
      return { success: false, error: 'Input is required' };
    }

    const trimmed = input.trim();
    
    try {
      // Try URL format first: protocol://[user:pass@]host:port
      const urlPattern = /^(https?|socks5?):\/\/(?:([^:@]+):([^@]+)@)?([^:\/]+):(\d+)$/i;
      let match = trimmed.match(urlPattern);
      
      if (match) {
        const [, protocol, username, password, host, port] = match;
        const config = new ProxyConfig({
          protocol: protocol.toLowerCase().replace('socks', 'socks5'),
          host,
          port: parseInt(port, 10),
          username: username || undefined,
          password: password || undefined,
          enabled: true
        });
        
        return { success: true, config };
      }

      // Try simple format: host:port
      const simplePattern = /^([^:]+):(\d+)$/;
      match = trimmed.match(simplePattern);
      
      if (match) {
        const [, host, port] = match;
        const config = new ProxyConfig({
          protocol: 'socks5', // Default to SOCKS5
          host,
          port: parseInt(port, 10),
          enabled: true
        });
        
        return { success: true, config };
      }

      // Try smart fill: extract from various formats
      return this._smartFillParse(trimmed);

    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Smart fill parsing for various proxy formats
   * @private
   * @param {string} input - Input text
   * @returns {{success: boolean, config?: ProxyConfig, error?: string}}
   */
  _smartFillParse(input) {
    // Try to extract host:port from anywhere in the text
    const hostPortPattern = /(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}):(\d{1,5})/;
    const match = input.match(hostPortPattern);
    
    if (match) {
      const [, host, port] = match;
      
      // Try to detect protocol
      let protocol = 'socks5';
      if (/https?/i.test(input)) {
        protocol = 'http';
      } else if (/socks/i.test(input)) {
        protocol = 'socks5';
      }

      // Try to extract credentials
      let username, password;
      const credPattern = /(?:user(?:name)?|login)[:\s=]+([^\s:]+)/i;
      const passPattern = /(?:pass(?:word)?)[:\s=]+([^\s]+)/i;
      
      const userMatch = input.match(credPattern);
      const passMatch = input.match(passPattern);
      
      if (userMatch) username = userMatch[1];
      if (passMatch) password = passMatch[1];

      const config = new ProxyConfig({
        protocol,
        host,
        port: parseInt(port, 10),
        username,
        password,
        enabled: true
      });

      return { success: true, config };
    }

    return { success: false, error: 'Could not parse proxy information from input' };
  }


  // ==================== Query Methods ====================

  /**
   * Gets the connection status for an account
   * 
   * @param {string} accountId - Account ID
   * @returns {ProxyConnectionStatus|null}
   */
  getConnectionStatus(accountId) {
    const connection = this._connections.get(accountId);
    if (!connection) {
      return null;
    }

    const healthStatus = this.healthMonitor.getHealthStatus(accountId);
    const killSwitchStatus = this.killSwitch.getStatus(accountId);

    return new ProxyConnectionStatus({
      accountId,
      proxyId: connection.config?.id,
      connected: true,
      ip: connection.ip,
      connectedAt: connection.connectedAt,
      healthStatus: healthStatus.status,
      killSwitchActive: killSwitchStatus?.active || false,
      lastHealthCheck: healthStatus.details?.lastCheckTime
    });
  }

  /**
   * Gets all active connections
   * 
   * @returns {Object} Map of accountId to connection status
   */
  getAllConnections() {
    const result = {};
    for (const accountId of this._connections.keys()) {
      result[accountId] = this.getConnectionStatus(accountId);
    }
    return result;
  }

  /**
   * Checks if an account has an active proxy connection
   * 
   * @param {string} accountId - Account ID
   * @returns {boolean}
   */
  isConnected(accountId) {
    return this._connections.has(accountId);
  }

  /**
   * Gets the IP protection script for injection
   * 
   * @returns {string} JavaScript code to inject
   */
  getIPProtectionScript() {
    return this.ipProtectionInjector.getProtectionScript();
  }

  /**
   * Gets health statistics for an account
   * 
   * @param {string} accountId - Account ID
   * @returns {Object|null}
   */
  getHealthStats(accountId) {
    const stats = this.healthMonitor.getStats(accountId);
    return stats ? stats.toJSON() : null;
  }

  // ==================== Reconnection Methods ====================

  /**
   * Manually triggers a reconnection attempt
   * 
   * @param {string} accountId - Account ID
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async manualReconnect(accountId) {
    const connection = this._connections.get(accountId);
    if (!connection) {
      return { success: false, error: 'No active connection for this account' };
    }

    this.log('info', `Manual reconnection requested for ${accountId}`);

    // Reset Kill-Switch first
    await this.killSwitch.reset(accountId);

    // Attempt reconnection
    const result = await this.secureConnect(accountId, connection.config, connection.session);

    if (result.success) {
      // Reset health monitor failure counter
      this.healthMonitor.resetFailureCounter(accountId);
      this.healthMonitor.updateInitialIP(accountId, result.ip);
    }

    return result;
  }

  /**
   * Gets reconnection status for an account
   * 
   * @param {string} accountId - Account ID
   * @returns {Object|null}
   */
  getReconnectionStatus(accountId) {
    return this.reconnectionManager.getReconnectionStatus(accountId);
  }

  // ==================== Lifecycle Methods ====================

  /**
   * Destroys the service and cleans up resources
   */
  destroy() {
    this.log('info', 'Destroying ProxyService...');

    // Disconnect all accounts
    for (const accountId of this._connections.keys()) {
      this.secureDisconnect(accountId);
    }

    // Destroy components
    this.healthMonitor.destroy();
    this.reconnectionManager.destroy();
    this.killSwitch.destroy();

    this._connections.clear();

    this.log('info', 'ProxyService destroyed');
  }
}

module.exports = ProxyService;
