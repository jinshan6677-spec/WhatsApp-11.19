'use strict';

const ProxyConfig = require('../../domain/entities/ProxyConfig');
const ProxyConnectionStatus = require('../../domain/entities/ProxyConnectionStatus');
const ProxyError = require('../../domain/errors/ProxyError');
const ProxyConnectedEvent = require('../../domain/events/ProxyConnectedEvent');
const ProxyDisconnectedEvent = require('../../domain/events/ProxyDisconnectedEvent');
const KillSwitchActivatedEvent = require('../../domain/events/KillSwitchActivatedEvent');

/**
 * Failure Scenario
 * @readonly
 * @enum {string}
 */
const FailureScenario = {
  BEFORE_OPEN: 'before_open',   // Failure before BrowserView is created
  DURING_SESSION: 'during_session' // Failure while session is active
};

/**
 * ProxyConnectionManager - Secure Proxy Connection Handler
 * 
 * Manages proxy connections with zero-trust security model.
 * Key principle: NEVER fall back to direct connection.
 * 
 * Two failure scenarios:
 * 1. Before Open: Prevent view creation, show warning
 * 2. During Session: Keep view, block network, trigger reconnection
 * 
 * @class
 */
class ProxyConnectionManager {
  /**
   * Creates a ProxyConnectionManager instance
   * @param {Object} [options={}] - Configuration options
   * @param {Function} [options.logger] - Logger function
   * @param {Object} [options.eventBus] - Event bus for publishing events
   * @param {Object} [options.securityManager] - ProxySecurityManager instance
   * @param {Object} [options.killSwitch] - KillSwitch instance
   * @param {Object} [options.reconnectionManager] - ProxyReconnectionManager instance
   */
  constructor(options = {}) {
    this.options = options;
    this.log = options.logger || this._createLogger();
    this.eventBus = options.eventBus || null;
    this.securityManager = options.securityManager || null;
    this.killSwitch = options.killSwitch || null;
    this.reconnectionManager = options.reconnectionManager || null;
    
    // Track connection status per account
    this._connections = new Map();
    
    // Track sessions for each account
    this._sessions = new Map();
    
    // Set up reconnection callback if manager is available
    if (this.reconnectionManager) {
      this.reconnectionManager.setReconnectCallback(
        this._performReconnect.bind(this)
      );
    }
  }

  /**
   * Creates a default logger
   * @private
   * @returns {Function}
   */
  _createLogger() {
    return (level, message, ...args) => {
      const timestamp = new Date().toISOString();
      const prefix = `[${timestamp}] [ProxyConnectionManager] [${level.toUpperCase()}]`;
      
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
   * This method performs pre-checks before allowing connection.
   * 
   * @param {string} accountId - Account ID
   * @param {ProxyConfig|Object} config - Proxy configuration
   * @param {Object} [options={}] - Connection options
   * @param {Electron.Session} [options.session] - Electron session
   * @param {Function} [options.preCheckCallback] - Pre-check callback
   * @param {Function} [options.ipVerifyCallback] - IP verification callback
   * @returns {Promise<{success: boolean, status: ProxyConnectionStatus, error?: ProxyError}>}
   */
  async connect(accountId, config, options = {}) {
    if (!accountId) {
      throw new Error('Account ID is required');
    }

    // Validate and normalize config
    const proxyConfig = config instanceof ProxyConfig ? config : new ProxyConfig(config);
    const validation = proxyConfig.validate();
    
    if (!validation.valid) {
      const errorDetails = validation.errors.map(e => `${e.field}: ${e.reason}`).join('; ');
      const error = ProxyError.invalidConfig(errorDetails, config);
      return this._createFailureResult(accountId, proxyConfig.id, error);
    }

    if (!proxyConfig.enabled) {
      const error = ProxyError.disabled(proxyConfig.id);
      return this._createFailureResult(accountId, proxyConfig.id, error);
    }

    this.log('info', `Connecting account ${accountId} via proxy ${proxyConfig.host}:${proxyConfig.port}`);

    // Initialize connection status
    const status = new ProxyConnectionStatus({
      accountId,
      proxyId: proxyConfig.id
    });
    status.setConnecting();
    this._connections.set(accountId, status);

    try {
      // Step 1: Pre-check (connectivity test)
      if (proxyConfig.verifyIPBeforeConnect && options.preCheckCallback) {
        this.log('info', `Running pre-check for account: ${accountId}`);
        const preCheckResult = await options.preCheckCallback(proxyConfig);
        
        if (!preCheckResult.success) {
          const error = ProxyError.preCheckFailed(proxyConfig.host, preCheckResult.error);
          return await this._handleConnectionFailure(
            accountId, proxyConfig, error, FailureScenario.BEFORE_OPEN
          );
        }
      }

      // Step 2: IP Verification (if callback provided)
      let verifiedIP = null;
      if (proxyConfig.verifyIPBeforeConnect && options.ipVerifyCallback) {
        this.log('info', `Verifying exit IP for account: ${accountId}`);
        const ipResult = await options.ipVerifyCallback(proxyConfig);
        
        if (!ipResult.success) {
          const error = ProxyError.ipVerificationFailed(ipResult.error);
          return await this._handleConnectionFailure(
            accountId, proxyConfig, error, FailureScenario.BEFORE_OPEN
          );
        }
        verifiedIP = ipResult.ip;
      }

      // Step 3: Configure session proxy (if session provided)
      if (options.session && this.securityManager) {
        const sessionId = `account_${accountId}`;
        
        // Enforce proxy-only mode
        await this.securityManager.enforceProxyOnly(options.session, sessionId);
        
        // Configure proxy rules
        await this.securityManager.configureProxyRules(options.session, proxyConfig, sessionId);
        
        // Store session reference
        this._sessions.set(accountId, {
          session: options.session,
          sessionId,
          proxyConfig
        });
      }

      // Step 4: Enable kill-switch
      if (this.killSwitch && proxyConfig.killSwitchEnabled) {
        this.killSwitch.enable(accountId, {
          proxyId: proxyConfig.id,
          sessionId: `account_${accountId}`
        });
      }

      // Step 5: Update status to connected
      const latency = options.latency || null;
      status.setConnected(verifiedIP, latency);
      
      // Record success in config
      proxyConfig.recordSuccess(verifiedIP);

      // Emit connected event
      if (this.eventBus) {
        const event = ProxyConnectedEvent.create(accountId, proxyConfig, verifiedIP, latency);
        await this.eventBus.publish(ProxyConnectedEvent.EVENT_NAME, event.toJSON());
      }

      this.log('info', `✓ Account ${accountId} connected via proxy (IP: ${verifiedIP || 'unknown'})`);

      return {
        success: true,
        status: status.toJSON(),
        exitIP: verifiedIP
      };

    } catch (error) {
      this.log('error', `Connection failed for account ${accountId}: ${error.message}`);
      
      const proxyError = error instanceof ProxyError 
        ? error 
        : ProxyError.connectionFailed(proxyConfig.host, proxyConfig.port, error);
      
      return await this._handleConnectionFailure(
        accountId, proxyConfig, proxyError, FailureScenario.BEFORE_OPEN
      );
    }
  }

  /**
   * Safely disconnects a proxy connection
   * @param {string} accountId - Account ID
   * @param {string} [reason='user_initiated'] - Disconnection reason
   * @returns {Promise<boolean>} True if disconnected successfully
   */
  async disconnect(accountId, reason = 'user_initiated') {
    if (!accountId) {
      throw new Error('Account ID is required');
    }

    const status = this._connections.get(accountId);
    if (!status) {
      this.log('warn', `No connection found for account: ${accountId}`);
      return false;
    }

    this.log('info', `Disconnecting account: ${accountId} (reason: ${reason})`);

    try {
      // Calculate session duration
      const sessionDuration = status.connectedAt 
        ? Date.now() - status.connectedAt.getTime()
        : null;

      // Stop any reconnection attempts
      if (this.reconnectionManager) {
        this.reconnectionManager.stopAutoReconnect(accountId);
      }

      // Disable kill-switch
      if (this.killSwitch) {
        this.killSwitch.disable(accountId);
      }

      // Release security enforcement
      const sessionInfo = this._sessions.get(accountId);
      if (sessionInfo && this.securityManager) {
        this.securityManager.releaseEnforcement(sessionInfo.sessionId);
      }

      // Update status
      status.setDisconnected();

      // Emit disconnected event
      if (this.eventBus) {
        const event = ProxyDisconnectedEvent.userInitiated(
          accountId, status.proxyId, sessionDuration
        );
        await this.eventBus.publish(ProxyDisconnectedEvent.EVENT_NAME, event.toJSON());
      }

      // Clean up
      this._sessions.delete(accountId);
      this._connections.delete(accountId);

      this.log('info', `✓ Account ${accountId} disconnected`);
      return true;

    } catch (error) {
      this.log('error', `Error during disconnect: ${error.message}`);
      return false;
    }
  }

  /**
   * Initiates reconnection for an account
   * @param {string} accountId - Account ID
   * @param {Object} [newConfig] - Optional new proxy configuration
   * @returns {Promise<boolean>} True if reconnection initiated
   */
  async reconnect(accountId, newConfig = null) {
    if (!accountId) {
      throw new Error('Account ID is required');
    }

    const sessionInfo = this._sessions.get(accountId);
    const config = newConfig || sessionInfo?.proxyConfig;

    if (!config) {
      throw ProxyError.notConfigured(accountId);
    }

    this.log('info', `Initiating reconnection for account: ${accountId}`);

    if (this.reconnectionManager) {
      return await this.reconnectionManager.manualReconnect(accountId, config);
    }

    // Fallback: direct reconnect attempt
    return await this._performReconnect(accountId, config);
  }

  /**
   * Gets the connection status for an account
   * @param {string} accountId - Account ID
   * @returns {Object|null} Connection status or null
   */
  getStatus(accountId) {
    const status = this._connections.get(accountId);
    if (!status) return null;

    const reconnectionStatus = this.reconnectionManager?.getReconnectionStatus(accountId);
    const killSwitchState = this.killSwitch?.getState(accountId);

    return {
      ...status.toJSON(),
      reconnection: reconnectionStatus,
      killSwitch: killSwitchState
    };
  }

  // ==================== Failure Handling ====================

  /**
   * Handles connection/session failures
   * This is the core security method - NEVER falls back to direct connection
   * 
   * @param {string} accountId - Account ID
   * @param {Error|ProxyError} error - The error that occurred
   * @param {string} [scenario] - Failure scenario (before_open or during_session)
   * @returns {Promise<void>}
   */
  async handleFailure(accountId, error, scenario = FailureScenario.DURING_SESSION) {
    if (!accountId) {
      throw new Error('Account ID is required');
    }

    const proxyError = error instanceof ProxyError 
      ? error 
      : new ProxyError(error.message, ProxyError.Code.UNKNOWN, { originalError: error });

    this.log('error', `Handling failure for account ${accountId}: ${proxyError.message}`);
    this.log('error', `  Scenario: ${scenario}`);
    this.log('error', `  Error Code: ${proxyError.code}`);

    const status = this._connections.get(accountId);
    const sessionInfo = this._sessions.get(accountId);

    if (scenario === FailureScenario.BEFORE_OPEN) {
      // ==================== BEFORE OPEN FAILURE ====================
      // Do NOT create BrowserView, show warning to user
      
      this.log('warn', `🔴 PRE-OPEN FAILURE: Blocking view creation for account ${accountId}`);
      
      if (status) {
        status.setFailed(proxyError.message);
      }

      // Emit failure event for UI
      if (this.eventBus) {
        await this.eventBus.publish('proxy:connection_blocked', {
          accountId,
          proxyId: sessionInfo?.proxyConfig?.id,
          error: proxyError.getUserMessage(),
          errorCode: proxyError.code,
          scenario: FailureScenario.BEFORE_OPEN,
          timestamp: new Date().toISOString()
        });
      }

    } else {
      // ==================== DURING SESSION FAILURE ====================
      // Keep BrowserView, block network, trigger reconnection
      
      this.log('warn', `🔴 SESSION FAILURE: Blocking network for account ${accountId}`);

      // Step 1: Trigger kill-switch (blocks all network requests)
      if (this.killSwitch && sessionInfo?.proxyConfig?.killSwitchEnabled) {
        const trigger = this._determineKillSwitchTrigger(proxyError);
        await this.killSwitch.trigger(accountId, trigger, {
          message: proxyError.message,
          errorCode: proxyError.code
        });
      }

      // Step 2: Block network via security manager
      if (this.securityManager && sessionInfo?.sessionId) {
        try {
          const state = this.securityManager._enforcedSessions.get(sessionInfo.sessionId);
          if (state && state.session) {
            await this.securityManager.blockDirectConnections(state.session, sessionInfo.sessionId);
          }
        } catch (blockError) {
          this.log('error', `Failed to block network: ${blockError.message}`);
        }
      }

      // Step 3: Update status
      if (status) {
        status.setFailed(proxyError.message);
        status.activateKillSwitch(proxyError.message);
      }

      // Step 4: Start auto-reconnection (silent - no popup)
      if (this.reconnectionManager && sessionInfo?.proxyConfig) {
        await this.reconnectionManager.startAutoReconnect(accountId, sessionInfo.proxyConfig);
      }

      // Step 5: Emit event for UI to show reconnection overlay (not popup)
      if (this.eventBus) {
        await this.eventBus.publish('proxy:session_failure', {
          accountId,
          proxyId: sessionInfo?.proxyConfig?.id,
          error: proxyError.getUserMessage(),
          errorCode: proxyError.code,
          scenario: FailureScenario.DURING_SESSION,
          killSwitchActive: true,
          reconnecting: true,
          timestamp: new Date().toISOString()
        });
      }
    }

    // Record failure in config
    if (sessionInfo?.proxyConfig) {
      sessionInfo.proxyConfig.recordFailure();
    }
  }

  // ==================== Internal Methods ====================

  /**
   * Performs the actual reconnection (used by reconnection manager)
   * @private
   * @param {string} accountId - Account ID
   * @param {Object} config - Proxy configuration
   * @returns {Promise<boolean>} True if successful
   */
  async _performReconnect(accountId, config) {
    const sessionInfo = this._sessions.get(accountId);
    
    if (!sessionInfo) {
      this.log('warn', `No session info for reconnection: ${accountId}`);
      return false;
    }

    try {
      this.log('info', `Performing reconnection for account: ${accountId}`);

      // Re-configure proxy on existing session
      if (this.securityManager && sessionInfo.session) {
        await this.securityManager.configureProxyRules(
          sessionInfo.session, 
          config, 
          sessionInfo.sessionId
        );
      }

      // Update status
      const status = this._connections.get(accountId);
      if (status) {
        status.setConnected(null, null);
      }

      // Update session config
      sessionInfo.proxyConfig = config;

      this.log('info', `✓ Reconnection successful for account: ${accountId}`);
      return true;

    } catch (error) {
      this.log('error', `Reconnection failed: ${error.message}`);
      return false;
    }
  }

  /**
   * Handles connection failure and returns result
   * @private
   * @param {string} accountId - Account ID
   * @param {ProxyConfig} config - Proxy configuration
   * @param {ProxyError} error - The error
   * @param {string} scenario - Failure scenario
   * @returns {Promise<Object>} Failure result
   */
  async _handleConnectionFailure(accountId, config, error, scenario) {
    await this.handleFailure(accountId, error, scenario);

    const status = this._connections.get(accountId);
    
    return {
      success: false,
      status: status?.toJSON() || null,
      error: error.toJSON(),
      scenario
    };
  }

  /**
   * Creates a failure result object
   * @private
   * @param {string} accountId - Account ID
   * @param {string} proxyId - Proxy ID
   * @param {ProxyError} error - The error
   * @returns {Object} Failure result
   */
  _createFailureResult(accountId, proxyId, error) {
    return {
      success: false,
      status: {
        accountId,
        proxyId,
        state: ProxyConnectionStatus.State.FAILED,
        lastError: error.message
      },
      error: error.toJSON()
    };
  }

  /**
   * Determines the kill-switch trigger from an error
   * @private
   * @param {ProxyError} error - The error
   * @returns {string} Kill-switch trigger
   */
  _determineKillSwitchTrigger(error) {
    const Trigger = KillSwitchActivatedEvent.Trigger;
    
    switch (error.code) {
      case ProxyError.Code.IP_LEAK_DETECTED:
        return Trigger.IP_LEAK_DETECTED;
      case ProxyError.Code.IP_MISMATCH:
        return Trigger.IP_MISMATCH;
      case ProxyError.Code.WEBRTC_LEAK:
        return Trigger.WEBRTC_LEAK;
      case ProxyError.Code.DNS_LEAK:
        return Trigger.DNS_LEAK;
      case ProxyError.Code.CONSECUTIVE_FAILURES:
        return Trigger.CONSECUTIVE_FAILURES;
      case ProxyError.Code.HEALTH_CHECK_FAILED:
        return Trigger.HEALTH_CHECK_FAILED;
      case ProxyError.Code.CONNECTION_FAILED:
      case ProxyError.Code.CONNECTION_TIMEOUT:
      case ProxyError.Code.CONNECTION_REFUSED:
        return Trigger.PROXY_DISCONNECTED;
      default:
        return Trigger.UNKNOWN;
    }
  }

  // ==================== Query Methods ====================

  /**
   * Checks if an account is connected
   * @param {string} accountId - Account ID
   * @returns {boolean}
   */
  isConnected(accountId) {
    const status = this._connections.get(accountId);
    return status?.isConnected() || false;
  }

  /**
   * Checks if kill-switch is active for an account
   * @param {string} accountId - Account ID
   * @returns {boolean}
   */
  isKillSwitchActive(accountId) {
    return this.killSwitch?.isActive(accountId) || false;
  }

  /**
   * Gets all active connections
   * @returns {Array} Array of connection statuses
   */
  getActiveConnections() {
    const connections = [];
    for (const [accountId, status] of this._connections) {
      if (status.isConnected()) {
        connections.push({
          accountId,
          ...status.toJSON()
        });
      }
    }
    return connections;
  }

  // ==================== Lifecycle Methods ====================

  /**
   * Cleans up all resources
   */
  cleanup() {
    this.log('info', 'Cleaning up ProxyConnectionManager...');
    
    // Disconnect all accounts
    for (const accountId of this._connections.keys()) {
      this.disconnect(accountId, 'cleanup').catch(() => {});
    }
    
    this._connections.clear();
    this._sessions.clear();
    
    this.log('info', 'ProxyConnectionManager cleanup complete');
  }
}

// Export class and enums
ProxyConnectionManager.FailureScenario = FailureScenario;
module.exports = ProxyConnectionManager;
