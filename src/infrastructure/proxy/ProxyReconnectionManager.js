'use strict';

const ProxyConnectionStatus = require('../../domain/entities/ProxyConnectionStatus');
const ProxyError = require('../../domain/errors/ProxyError');

/**
 * Reconnection State
 * @readonly
 * @enum {string}
 */
const ReconnectionState = {
  IDLE: 'idle',
  RECONNECTING: 'reconnecting',
  WAITING: 'waiting',
  SUCCESS: 'success',
  FAILED: 'failed',
  STOPPED: 'stopped'
};

/**
 * Default reconnection delays (exponential backoff)
 * 2s → 3s → 5s
 * @readonly
 */
const DEFAULT_DELAYS = [2000, 3000, 5000];

/**
 * ProxyReconnectionManager - Automatic Reconnection Handler
 * 
 * Manages automatic reconnection attempts when proxy connection fails.
 * Uses exponential backoff strategy: 2s → 3s → 5s
 * 
 * Key features:
 * - Automatic reconnection with exponential backoff
 * - Manual reconnection support
 * - Integration with KillSwitch (reset on success)
 * - Event emission for UI updates
 * 
 * @class
 */
class ProxyReconnectionManager {
  /**
   * Creates a ProxyReconnectionManager instance
   * @param {Object} [options={}] - Configuration options
   * @param {Function} [options.logger] - Logger function
   * @param {Object} [options.eventBus] - Event bus for publishing events
   * @param {Object} [options.killSwitch] - KillSwitch instance
   * @param {Array<number>} [options.delays] - Reconnection delays in ms
   * @param {number} [options.maxAttempts] - Maximum reconnection attempts
   */
  constructor(options = {}) {
    this.options = options;
    this.log = options.logger || this._createLogger();
    this.eventBus = options.eventBus || null;
    this.killSwitch = options.killSwitch || null;
    this.delays = options.delays || DEFAULT_DELAYS;
    this.maxAttempts = options.maxAttempts || this.delays.length;
    
    // Track reconnection state per account
    this._states = new Map();
    
    // Track active timers for cleanup
    this._timers = new Map();
    
    // Reconnection callback (set by ProxyConnectionManager)
    this._reconnectCallback = null;
  }

  /**
   * Creates a default logger
   * @private
   * @returns {Function}
   */
  _createLogger() {
    return (level, message, ...args) => {
      const timestamp = new Date().toISOString();
      const prefix = `[${timestamp}] [ProxyReconnectionManager] [${level.toUpperCase()}]`;
      
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
   * Sets the reconnection callback
   * @param {Function} callback - Async function(accountId, config) that performs reconnection
   */
  setReconnectCallback(callback) {
    this._reconnectCallback = callback;
  }

  // ==================== Core Methods ====================

  /**
   * Starts automatic reconnection for an account
   * @param {string} accountId - Account ID
   * @param {Object} config - Proxy configuration
   * @returns {Promise<void>}
   */
  async startAutoReconnect(accountId, config) {
    if (!accountId) {
      throw new Error('Account ID is required');
    }

    if (!config) {
      throw new Error('Proxy configuration is required');
    }

    // Check if already reconnecting
    const existingState = this._states.get(accountId);
    if (existingState && existingState.state === ReconnectionState.RECONNECTING) {
      this.log('info', `Already reconnecting for account: ${accountId}`);
      return;
    }

    // Initialize state
    const state = {
      accountId,
      config,
      state: ReconnectionState.RECONNECTING,
      attempt: 0,
      maxAttempts: this.maxAttempts,
      startedAt: new Date(),
      lastAttemptAt: null,
      nextAttemptAt: null,
      error: null
    };

    this._states.set(accountId, state);
    this.log('info', `Starting auto-reconnect for account: ${accountId}`);

    // Emit event
    if (this.eventBus) {
      await this.eventBus.publish('proxy:reconnection_started', {
        accountId,
        proxyId: config.id,
        maxAttempts: this.maxAttempts,
        timestamp: new Date().toISOString()
      });
    }

    // Start first attempt
    await this._attemptReconnect(accountId);
  }

  /**
   * Stops automatic reconnection for an account
   * @param {string} accountId - Account ID
   * @returns {boolean} True if stopped
   */
  stopAutoReconnect(accountId) {
    const state = this._states.get(accountId);
    if (!state) {
      return false;
    }

    // Clear any pending timer
    this._clearTimer(accountId);

    // Update state
    state.state = ReconnectionState.STOPPED;
    this.log('info', `Stopped auto-reconnect for account: ${accountId}`);

    // Emit event
    if (this.eventBus) {
      this.eventBus.publish('proxy:reconnection_stopped', {
        accountId,
        attempt: state.attempt,
        timestamp: new Date().toISOString()
      });
    }

    return true;
  }

  /**
   * Performs a manual reconnection attempt
   * @param {string} accountId - Account ID
   * @param {Object} [config] - Optional new proxy configuration
   * @returns {Promise<boolean>} True if reconnection successful
   */
  async manualReconnect(accountId, config = null) {
    if (!accountId) {
      throw new Error('Account ID is required');
    }

    const state = this._states.get(accountId);
    const proxyConfig = config || state?.config;

    if (!proxyConfig) {
      throw ProxyError.notConfigured(accountId);
    }

    this.log('info', `Manual reconnect requested for account: ${accountId}`);

    // Stop any ongoing auto-reconnect
    this._clearTimer(accountId);

    // Update or create state
    if (state) {
      state.state = ReconnectionState.RECONNECTING;
      state.attempt = 0; // Reset attempts for manual
      if (config) {
        state.config = config;
      }
    } else {
      this._states.set(accountId, {
        accountId,
        config: proxyConfig,
        state: ReconnectionState.RECONNECTING,
        attempt: 0,
        maxAttempts: 1, // Manual is single attempt
        startedAt: new Date(),
        lastAttemptAt: null,
        nextAttemptAt: null,
        error: null
      });
    }

    // Emit event
    if (this.eventBus) {
      await this.eventBus.publish('proxy:manual_reconnect_started', {
        accountId,
        proxyId: proxyConfig.id,
        timestamp: new Date().toISOString()
      });
    }

    // Perform reconnection
    return await this._performReconnect(accountId, proxyConfig);
  }

  /**
   * Gets the reconnection status for an account
   * @param {string} accountId - Account ID
   * @returns {Object|null} Reconnection status or null
   */
  getReconnectionStatus(accountId) {
    const state = this._states.get(accountId);
    if (!state) return null;

    const now = Date.now();
    const nextAttemptIn = state.nextAttemptAt 
      ? Math.max(0, state.nextAttemptAt.getTime() - now)
      : null;

    return {
      accountId: state.accountId,
      proxyId: state.config?.id,
      state: state.state,
      attempt: state.attempt,
      maxAttempts: state.maxAttempts,
      startedAt: state.startedAt,
      lastAttemptAt: state.lastAttemptAt,
      nextAttemptAt: state.nextAttemptAt,
      nextAttemptIn,
      error: state.error
    };
  }

  /**
   * Checks if reconnection is in progress for an account
   * @param {string} accountId - Account ID
   * @returns {boolean}
   */
  isReconnecting(accountId) {
    const state = this._states.get(accountId);
    return state?.state === ReconnectionState.RECONNECTING || 
           state?.state === ReconnectionState.WAITING;
  }

  // ==================== Internal Methods ====================

  /**
   * Attempts reconnection with retry logic
   * @private
   * @param {string} accountId - Account ID
   */
  async _attemptReconnect(accountId) {
    const state = this._states.get(accountId);
    if (!state || state.state === ReconnectionState.STOPPED) {
      return;
    }

    state.attempt++;
    state.lastAttemptAt = new Date();
    state.state = ReconnectionState.RECONNECTING;

    this.log('info', `Reconnection attempt ${state.attempt}/${state.maxAttempts} for account: ${accountId}`);

    // Emit attempt event
    if (this.eventBus) {
      await this.eventBus.publish('proxy:reconnection_attempt', {
        accountId,
        proxyId: state.config?.id,
        attempt: state.attempt,
        maxAttempts: state.maxAttempts,
        timestamp: new Date().toISOString()
      });
    }

    // Perform the reconnection
    const success = await this._performReconnect(accountId, state.config);

    if (success) {
      await this._handleReconnectSuccess(accountId);
    } else {
      await this._handleReconnectFailure(accountId);
    }
  }

  /**
   * Performs the actual reconnection
   * @private
   * @param {string} accountId - Account ID
   * @param {Object} config - Proxy configuration
   * @returns {Promise<boolean>} True if successful
   */
  async _performReconnect(accountId, config) {
    if (!this._reconnectCallback) {
      this.log('error', 'No reconnect callback set');
      return false;
    }

    try {
      const result = await this._reconnectCallback(accountId, config);
      return result === true;
    } catch (error) {
      const state = this._states.get(accountId);
      if (state) {
        state.error = error.message;
      }
      this.log('error', `Reconnection failed: ${error.message}`);
      return false;
    }
  }

  /**
   * Handles successful reconnection
   * @private
   * @param {string} accountId - Account ID
   */
  async _handleReconnectSuccess(accountId) {
    const state = this._states.get(accountId);
    if (!state) return;

    state.state = ReconnectionState.SUCCESS;
    state.error = null;

    this.log('info', `✓ Reconnection successful for account: ${accountId}`);

    // Reset kill-switch if active
    if (this.killSwitch && this.killSwitch.isActive(accountId)) {
      this.log('info', `Resetting kill-switch for account: ${accountId}`);
      await this.killSwitch.reset(accountId, true); // Auto-confirm on successful reconnect
    }

    // Emit success event
    if (this.eventBus) {
      await this.eventBus.publish('proxy:reconnection_success', {
        accountId,
        proxyId: state.config?.id,
        attempt: state.attempt,
        timestamp: new Date().toISOString()
      });
    }

    // Clean up state after short delay
    setTimeout(() => {
      const currentState = this._states.get(accountId);
      if (currentState?.state === ReconnectionState.SUCCESS) {
        this._states.delete(accountId);
      }
    }, 5000);
  }

  /**
   * Handles failed reconnection attempt
   * @private
   * @param {string} accountId - Account ID
   */
  async _handleReconnectFailure(accountId) {
    const state = this._states.get(accountId);
    if (!state) return;

    // Check if we have more attempts
    if (state.attempt < state.maxAttempts) {
      // Schedule next attempt with exponential backoff
      const delay = this.delays[state.attempt - 1] || this.delays[this.delays.length - 1];
      state.state = ReconnectionState.WAITING;
      state.nextAttemptAt = new Date(Date.now() + delay);

      this.log('info', `Scheduling next reconnection attempt in ${delay}ms for account: ${accountId}`);

      // Emit waiting event
      if (this.eventBus) {
        await this.eventBus.publish('proxy:reconnection_waiting', {
          accountId,
          proxyId: state.config?.id,
          attempt: state.attempt,
          nextAttemptIn: delay,
          timestamp: new Date().toISOString()
        });
      }

      // Schedule next attempt
      const timer = setTimeout(() => {
        this._attemptReconnect(accountId);
      }, delay);

      this._timers.set(accountId, timer);
    } else {
      // All attempts exhausted
      state.state = ReconnectionState.FAILED;
      state.nextAttemptAt = null;

      this.log('warn', `All reconnection attempts exhausted for account: ${accountId}`);

      // Emit failure event
      if (this.eventBus) {
        await this.eventBus.publish('proxy:reconnection_failed', {
          accountId,
          proxyId: state.config?.id,
          attempts: state.attempt,
          error: state.error,
          timestamp: new Date().toISOString()
        });
      }
    }
  }

  /**
   * Clears the timer for an account
   * @private
   * @param {string} accountId - Account ID
   */
  _clearTimer(accountId) {
    const timer = this._timers.get(accountId);
    if (timer) {
      clearTimeout(timer);
      this._timers.delete(accountId);
    }
  }

  // ==================== Lifecycle Methods ====================

  /**
   * Cleans up all resources
   */
  cleanup() {
    this.log('info', 'Cleaning up ProxyReconnectionManager...');
    
    // Clear all timers
    for (const [accountId, timer] of this._timers) {
      clearTimeout(timer);
    }
    this._timers.clear();
    
    // Clear all states
    this._states.clear();
    
    this.log('info', 'ProxyReconnectionManager cleanup complete');
  }

  /**
   * Alias for cleanup - destroys the manager instance
   */
  destroy() {
    this.cleanup();
  }
}

// Export class and enums
ProxyReconnectionManager.State = ReconnectionState;
ProxyReconnectionManager.DEFAULT_DELAYS = DEFAULT_DELAYS;
module.exports = ProxyReconnectionManager;
