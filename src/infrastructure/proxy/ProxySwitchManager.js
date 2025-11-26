'use strict';

const ProxyConfig = require('../../domain/entities/ProxyConfig');
const ProxyError = require('../../domain/errors/ProxyError');

/**
 * Switch State
 * @readonly
 * @enum {string}
 */
const SwitchState = {
  IDLE: 'idle',
  VALIDATING: 'validating',
  SWITCHING: 'switching',
  SUCCESS: 'success',
  FAILED: 'failed',
  ROLLED_BACK: 'rolled_back'
};

/**
 * ProxySwitchManager - Smooth Proxy Switching
 * 
 * Manages proxy switching with safety guarantees:
 * 1. Validate new proxy before switching
 * 2. Trigger Kill-Switch to block traffic
 * 3. Apply new proxy configuration
 * 4. Reconnect with new proxy
 * 5. Rollback on failure
 * 
 * @class
 */
class ProxySwitchManager {
  /**
   * Creates a ProxySwitchManager instance
   * @param {Object} [options={}] - Configuration options
   * @param {Function} [options.logger] - Logger function
   * @param {Object} [options.eventBus] - Event bus for publishing events
   * @param {Object} [options.killSwitch] - KillSwitch instance
   * @param {Object} [options.preChecker] - ProxyPreChecker instance
   * @param {Object} [options.connectionManager] - ProxyConnectionManager instance
   */
  constructor(options = {}) {
    this.options = options;
    this.log = options.logger || this._createLogger();
    this.eventBus = options.eventBus || null;
    this.killSwitch = options.killSwitch || null;
    this.preChecker = options.preChecker || null;
    this.connectionManager = options.connectionManager || null;
    
    // Track switch state per account
    this._switchStates = new Map();
    
    // Track previous configs for rollback
    this._previousConfigs = new Map();
  }

  /**
   * Creates a default logger
   * @private
   * @returns {Function}
   */
  _createLogger() {
    return (level, message, ...args) => {
      const timestamp = new Date().toISOString();
      const prefix = `[${timestamp}] [ProxySwitchManager] [${level.toUpperCase()}]`;
      
      if (level === 'error') {
        console.error(prefix, message, ...args);
      } else if (level === 'warn') {
        console.warn(prefix, message, ...args);
      } else {
        console.log(prefix, message, ...args);
      }
    };
  }

  // ==================== Core Methods ====================

  /**
   * Switches proxy for an account with safety guarantees
   * 
   * Flow:
   * 1. Validate new proxy (connectivity + IP verification)
   * 2. Trigger Kill-Switch (block all traffic)
   * 3. Apply new proxy configuration
   * 4. Reconnect with new proxy
   * 5. On failure: rollback to previous proxy
   * 
   * @param {string} accountId - Account ID
   * @param {ProxyConfig|Object} newConfig - New proxy configuration
   * @param {Object} [options={}] - Switch options
   * @param {Object} [options.session] - Electron session
   * @param {boolean} [options.skipValidation=false] - Skip pre-validation
   * @returns {Promise<{success: boolean, error?: string, rolledBack?: boolean}>}
   */
  async switchProxy(accountId, newConfig, options = {}) {
    if (!accountId) {
      throw new Error('Account ID is required');
    }

    if (!newConfig) {
      throw new Error('New proxy configuration is required');
    }

    // Check if already switching
    const existingState = this._switchStates.get(accountId);
    if (existingState && existingState.state === SwitchState.SWITCHING) {
      return {
        success: false,
        error: 'Proxy switch already in progress'
      };
    }

    const proxyConfig = newConfig instanceof ProxyConfig 
      ? newConfig 
      : new ProxyConfig(newConfig);

    // Validate new config
    const validation = proxyConfig.validate();
    if (!validation.valid) {
      return {
        success: false,
        error: `Invalid proxy configuration: ${validation.errors.map(e => e.reason).join(', ')}`
      };
    }

    // Initialize switch state
    const switchState = {
      accountId,
      state: SwitchState.VALIDATING,
      newConfig: proxyConfig,
      previousConfig: null,
      startedAt: new Date(),
      error: null
    };
    this._switchStates.set(accountId, switchState);

    this.log('info', `Starting proxy switch for account ${accountId}`);
    this.log('info', `  New proxy: ${proxyConfig.host}:${proxyConfig.port}`);

    // Emit switch started event
    if (this.eventBus) {
      await this.eventBus.publish('proxy:switch_started', {
        accountId,
        newProxyId: proxyConfig.id,
        timestamp: new Date().toISOString()
      });
    }

    try {
      // Step 1: Validate new proxy (unless skipped)
      if (!options.skipValidation && this.preChecker) {
        this.log('info', `Step 1: Validating new proxy...`);
        
        const validationResult = await this.preChecker.testConnectivity(proxyConfig);
        if (!validationResult.success) {
          throw ProxyError.preCheckFailed(proxyConfig.host, validationResult.error);
        }

        // Get exit IP
        const ipResult = await this.preChecker.getExitIP(proxyConfig);
        if (!ipResult.success) {
          throw ProxyError.ipVerificationFailed(ipResult.error);
        }

        this.log('info', `  ✓ New proxy validated (IP: ${ipResult.ip}, Latency: ${validationResult.latency}ms)`);
      }

      // Step 2: Store previous config and trigger Kill-Switch
      switchState.state = SwitchState.SWITCHING;
      
      // Get current config from connection manager
      if (this.connectionManager) {
        const currentStatus = this.connectionManager.getStatus(accountId);
        if (currentStatus) {
          const sessionInfo = this.connectionManager._sessions.get(accountId);
          if (sessionInfo?.proxyConfig) {
            switchState.previousConfig = sessionInfo.proxyConfig;
            this._previousConfigs.set(accountId, sessionInfo.proxyConfig);
          }
        }
      }

      this.log('info', `Step 2: Triggering Kill-Switch...`);
      if (this.killSwitch) {
        await this.killSwitch.trigger(accountId, 'proxy_switch', {
          message: 'Switching proxy configuration'
        });
      }

      // Step 3: Apply new proxy configuration
      this.log('info', `Step 3: Applying new proxy configuration...`);
      
      if (this.connectionManager) {
        // Disconnect current connection
        await this.connectionManager.disconnect(accountId, 'proxy_switch');
        
        // Connect with new config
        const connectResult = await this.connectionManager.connect(accountId, proxyConfig, {
          session: options.session,
          preCheckCallback: this.preChecker ? 
            (config) => this.preChecker.testConnectivity(config) : null,
          ipVerifyCallback: this.preChecker ?
            (config) => this.preChecker.getExitIP(config) : null
        });

        if (!connectResult.success) {
          throw new ProxyError(
            connectResult.error?.message || 'Failed to connect with new proxy',
            ProxyError.Code.CONNECTION_FAILED
          );
        }
      }

      // Step 4: Reset Kill-Switch on success
      this.log('info', `Step 4: Resetting Kill-Switch...`);
      if (this.killSwitch) {
        await this.killSwitch.reset(accountId, true);
      }

      // Success
      switchState.state = SwitchState.SUCCESS;
      this._previousConfigs.delete(accountId);

      this.log('info', `✓ Proxy switch successful for account ${accountId}`);

      // Emit success event
      if (this.eventBus) {
        await this.eventBus.publish('proxy:switch_success', {
          accountId,
          newProxyId: proxyConfig.id,
          previousProxyId: switchState.previousConfig?.id,
          timestamp: new Date().toISOString()
        });
      }

      return { success: true };

    } catch (error) {
      this.log('error', `Proxy switch failed: ${error.message}`);
      switchState.error = error.message;

      // Attempt rollback
      const rollbackResult = await this._rollback(accountId, options);
      switchState.state = rollbackResult.success ? SwitchState.ROLLED_BACK : SwitchState.FAILED;

      // Emit failure event
      if (this.eventBus) {
        await this.eventBus.publish('proxy:switch_failed', {
          accountId,
          newProxyId: proxyConfig.id,
          error: error.message,
          rolledBack: rollbackResult.success,
          timestamp: new Date().toISOString()
        });
      }

      return {
        success: false,
        error: error.message,
        rolledBack: rollbackResult.success
      };
    }
  }

  /**
   * Gets the switch status for an account
   * @param {string} accountId - Account ID
   * @returns {Object|null}
   */
  getSwitchStatus(accountId) {
    const state = this._switchStates.get(accountId);
    if (!state) return null;

    return {
      accountId: state.accountId,
      state: state.state,
      newProxyId: state.newConfig?.id,
      previousProxyId: state.previousConfig?.id,
      startedAt: state.startedAt,
      error: state.error
    };
  }

  /**
   * Checks if a switch is in progress for an account
   * @param {string} accountId - Account ID
   * @returns {boolean}
   */
  isSwitching(accountId) {
    const state = this._switchStates.get(accountId);
    return state?.state === SwitchState.VALIDATING || 
           state?.state === SwitchState.SWITCHING;
  }

  // ==================== Internal Methods ====================

  /**
   * Rolls back to previous proxy configuration
   * @private
   * @param {string} accountId - Account ID
   * @param {Object} options - Options including session
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async _rollback(accountId, options = {}) {
    const previousConfig = this._previousConfigs.get(accountId);
    
    if (!previousConfig) {
      this.log('warn', `No previous config to rollback to for account: ${accountId}`);
      return { success: false, error: 'No previous configuration available' };
    }

    this.log('info', `Rolling back to previous proxy for account: ${accountId}`);

    try {
      if (this.connectionManager) {
        // Disconnect current (failed) connection
        await this.connectionManager.disconnect(accountId, 'rollback');
        
        // Reconnect with previous config
        const connectResult = await this.connectionManager.connect(accountId, previousConfig, {
          session: options.session,
          preCheckCallback: this.preChecker ? 
            (config) => this.preChecker.testConnectivity(config) : null,
          ipVerifyCallback: this.preChecker ?
            (config) => this.preChecker.getExitIP(config) : null
        });

        if (!connectResult.success) {
          throw new Error(connectResult.error?.message || 'Rollback connection failed');
        }
      }

      // Reset Kill-Switch after successful rollback
      if (this.killSwitch) {
        await this.killSwitch.reset(accountId, true);
      }

      this._previousConfigs.delete(accountId);
      this.log('info', `✓ Rollback successful for account: ${accountId}`);

      return { success: true };

    } catch (error) {
      this.log('error', `Rollback failed: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  // ==================== Lifecycle Methods ====================

  /**
   * Cleans up all resources
   */
  cleanup() {
    this.log('info', 'Cleaning up ProxySwitchManager...');
    this._switchStates.clear();
    this._previousConfigs.clear();
    this.log('info', 'ProxySwitchManager cleanup complete');
  }

  /**
   * Alias for cleanup
   */
  destroy() {
    this.cleanup();
  }
}

// Export class and enums
ProxySwitchManager.State = SwitchState;
module.exports = ProxySwitchManager;
