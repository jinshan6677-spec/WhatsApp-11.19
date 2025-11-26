'use strict';

const ProxyError = require('../../domain/errors/ProxyError');

/**
 * Auth State
 * @readonly
 * @enum {string}
 */
const AuthState = {
  VALID: 'valid',
  EXPIRING_SOON: 'expiring_soon',
  EXPIRED: 'expired',
  UNKNOWN: 'unknown'
};

/**
 * Default configuration
 * @readonly
 */
const AuthDefaults = {
  EXPIRY_WARNING_DAYS: 7,      // Warn 7 days before expiry
  CHECK_INTERVAL: 3600000,     // Check every hour
  AUTH_TIMEOUT: 10000          // 10 second timeout for auth refresh
};

/**
 * ProxyAuthManager - Proxy Authentication Management
 * 
 * Manages proxy authentication lifecycle:
 * - Tracks authentication expiry
 * - Refreshes authentication when needed
 * - Prompts users to update credentials
 * 
 * @class
 */
class ProxyAuthManager {
  /**
   * Creates a ProxyAuthManager instance
   * @param {Object} [options={}] - Configuration options
   * @param {Function} [options.logger] - Logger function
   * @param {Object} [options.eventBus] - Event bus for publishing events
   * @param {number} [options.expiryWarningDays] - Days before expiry to warn
   * @param {number} [options.checkInterval] - Auth check interval in ms
   */
  constructor(options = {}) {
    this.options = options;
    this.log = options.logger || this._createLogger();
    this.eventBus = options.eventBus || null;
    this.expiryWarningDays = options.expiryWarningDays || AuthDefaults.EXPIRY_WARNING_DAYS;
    this.checkInterval = options.checkInterval || AuthDefaults.CHECK_INTERVAL;
    
    // Track auth state per proxy: proxyId -> AuthInfo
    this._authStates = new Map();
    
    // Track auth check timers
    this._checkTimers = new Map();
    
    // Track pending auth updates: accountId -> Promise
    this._pendingUpdates = new Map();
  }

  /**
   * Creates a default logger
   * @private
   * @returns {Function}
   */
  _createLogger() {
    return (level, message, ...args) => {
      const timestamp = new Date().toISOString();
      const prefix = `[${timestamp}] [ProxyAuthManager] [${level.toUpperCase()}]`;
      
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
   * Registers authentication info for a proxy
   * @param {string} proxyId - Proxy ID
   * @param {Object} authInfo - Authentication information
   * @param {string} [authInfo.username] - Username
   * @param {string} [authInfo.password] - Password
   * @param {Date} [authInfo.expiresAt] - Expiration date
   * @param {string} [authInfo.authType='basic'] - Auth type (basic, digest, etc.)
   * @returns {boolean}
   */
  registerAuth(proxyId, authInfo = {}) {
    if (!proxyId) {
      this.log('error', 'Proxy ID is required');
      return false;
    }

    const state = {
      proxyId,
      username: authInfo.username || null,
      hasPassword: !!authInfo.password,
      expiresAt: authInfo.expiresAt ? new Date(authInfo.expiresAt) : null,
      authType: authInfo.authType || 'basic',
      registeredAt: new Date(),
      lastCheckedAt: null,
      lastRefreshedAt: null,
      state: AuthState.UNKNOWN
    };

    // Determine initial state
    state.state = this._determineAuthState(state);

    this._authStates.set(proxyId, state);
    this.log('info', `Registered auth for proxy ${proxyId} (state: ${state.state})`);

    // Start periodic check if expiry is set
    if (state.expiresAt) {
      this._startAuthCheck(proxyId);
    }

    return true;
  }

  /**
   * Checks if authentication is expired for a proxy
   * @param {string} proxyId - Proxy ID
   * @returns {{expired: boolean, expiresAt?: Date, daysRemaining?: number, state: string}}
   */
  isAuthExpired(proxyId) {
    const state = this._authStates.get(proxyId);
    
    if (!state) {
      return {
        expired: false,
        state: AuthState.UNKNOWN,
        message: 'No auth info registered'
      };
    }

    // Update state
    state.state = this._determineAuthState(state);
    state.lastCheckedAt = new Date();

    const result = {
      expired: state.state === AuthState.EXPIRED,
      expiresAt: state.expiresAt,
      state: state.state
    };

    if (state.expiresAt) {
      const now = new Date();
      const daysRemaining = Math.ceil((state.expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      result.daysRemaining = daysRemaining;
    }

    return result;
  }

  /**
   * Refreshes authentication for a proxy
   * This is typically called when auth is about to expire or has expired
   * 
   * @param {string} proxyId - Proxy ID
   * @param {Object} [newAuthInfo] - New authentication info (if available)
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async refreshAuth(proxyId, newAuthInfo = null) {
    if (!proxyId) {
      throw new Error('Proxy ID is required');
    }

    const state = this._authStates.get(proxyId);
    if (!state) {
      return {
        success: false,
        error: 'No auth info registered for this proxy'
      };
    }

    this.log('info', `Refreshing auth for proxy: ${proxyId}`);

    try {
      if (newAuthInfo) {
        // Update with new auth info
        if (newAuthInfo.username) state.username = newAuthInfo.username;
        if (newAuthInfo.password) state.hasPassword = true;
        if (newAuthInfo.expiresAt) state.expiresAt = new Date(newAuthInfo.expiresAt);
        if (newAuthInfo.authType) state.authType = newAuthInfo.authType;
      }

      state.lastRefreshedAt = new Date();
      state.state = this._determineAuthState(state);

      // Emit refresh event
      if (this.eventBus) {
        await this.eventBus.publish('proxy:auth_refreshed', {
          proxyId,
          state: state.state,
          expiresAt: state.expiresAt?.toISOString(),
          timestamp: new Date().toISOString()
        });
      }

      this.log('info', `✓ Auth refreshed for proxy ${proxyId} (new state: ${state.state})`);

      return { success: true };

    } catch (error) {
      this.log('error', `Failed to refresh auth: ${error.message}`);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Prompts user to update authentication for an account
   * @param {string} accountId - Account ID
   * @param {string} proxyId - Proxy ID
   * @param {string} [reason='expired'] - Reason for prompt
   * @returns {Promise<{prompted: boolean, error?: string}>}
   */
  async promptAuthUpdate(accountId, proxyId, reason = 'expired') {
    if (!accountId || !proxyId) {
      throw new Error('Account ID and Proxy ID are required');
    }

    // Check if already prompting
    if (this._pendingUpdates.has(accountId)) {
      return {
        prompted: false,
        error: 'Auth update already pending for this account'
      };
    }

    this.log('info', `Prompting auth update for account ${accountId}, proxy ${proxyId}`);

    try {
      // Create pending update tracker
      let resolveUpdate;
      const updatePromise = new Promise(resolve => {
        resolveUpdate = resolve;
      });
      this._pendingUpdates.set(accountId, { promise: updatePromise, resolve: resolveUpdate });

      // Emit prompt event for UI
      if (this.eventBus) {
        await this.eventBus.publish('proxy:auth_update_required', {
          accountId,
          proxyId,
          reason,
          timestamp: new Date().toISOString()
        });
      }

      return { prompted: true };

    } catch (error) {
      this.log('error', `Failed to prompt auth update: ${error.message}`);
      this._pendingUpdates.delete(accountId);
      return {
        prompted: false,
        error: error.message
      };
    }
  }

  /**
   * Completes a pending auth update (called by UI after user provides new credentials)
   * @param {string} accountId - Account ID
   * @param {Object} newAuthInfo - New authentication info
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async completeAuthUpdate(accountId, newAuthInfo) {
    const pending = this._pendingUpdates.get(accountId);
    if (!pending) {
      return {
        success: false,
        error: 'No pending auth update for this account'
      };
    }

    try {
      // Resolve the pending promise
      pending.resolve({ success: true, authInfo: newAuthInfo });
      this._pendingUpdates.delete(accountId);

      this.log('info', `Auth update completed for account: ${accountId}`);

      // Emit completion event
      if (this.eventBus) {
        await this.eventBus.publish('proxy:auth_update_completed', {
          accountId,
          timestamp: new Date().toISOString()
        });
      }

      return { success: true };

    } catch (error) {
      this.log('error', `Failed to complete auth update: ${error.message}`);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Cancels a pending auth update
   * @param {string} accountId - Account ID
   * @returns {boolean}
   */
  cancelAuthUpdate(accountId) {
    const pending = this._pendingUpdates.get(accountId);
    if (!pending) {
      return false;
    }

    pending.resolve({ success: false, cancelled: true });
    this._pendingUpdates.delete(accountId);
    this.log('info', `Auth update cancelled for account: ${accountId}`);

    return true;
  }

  // ==================== Query Methods ====================

  /**
   * Gets auth state for a proxy
   * @param {string} proxyId - Proxy ID
   * @returns {Object|null}
   */
  getAuthState(proxyId) {
    const state = this._authStates.get(proxyId);
    if (!state) return null;

    return {
      proxyId: state.proxyId,
      username: state.username,
      hasPassword: state.hasPassword,
      expiresAt: state.expiresAt,
      authType: state.authType,
      state: state.state,
      registeredAt: state.registeredAt,
      lastCheckedAt: state.lastCheckedAt,
      lastRefreshedAt: state.lastRefreshedAt
    };
  }

  /**
   * Gets all proxies with expiring auth
   * @param {number} [withinDays] - Days until expiry (default: expiryWarningDays)
   * @returns {Array<{proxyId: string, expiresAt: Date, daysRemaining: number}>}
   */
  getExpiringAuth(withinDays = null) {
    const days = withinDays ?? this.expiryWarningDays;
    const result = [];
    const now = new Date();
    const threshold = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

    for (const [proxyId, state] of this._authStates) {
      if (state.expiresAt && state.expiresAt <= threshold) {
        const daysRemaining = Math.ceil((state.expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        result.push({
          proxyId,
          expiresAt: state.expiresAt,
          daysRemaining,
          state: state.state
        });
      }
    }

    return result.sort((a, b) => a.daysRemaining - b.daysRemaining);
  }

  /**
   * Checks if there's a pending auth update for an account
   * @param {string} accountId - Account ID
   * @returns {boolean}
   */
  hasPendingUpdate(accountId) {
    return this._pendingUpdates.has(accountId);
  }

  // ==================== Internal Methods ====================

  /**
   * Determines the auth state based on expiry
   * @private
   * @param {Object} state - Auth state object
   * @returns {string} AuthState value
   */
  _determineAuthState(state) {
    if (!state.expiresAt) {
      // No expiry set - assume valid if has credentials
      return (state.username || state.hasPassword) ? AuthState.VALID : AuthState.UNKNOWN;
    }

    const now = new Date();
    const warningThreshold = new Date(
      state.expiresAt.getTime() - this.expiryWarningDays * 24 * 60 * 60 * 1000
    );

    if (now >= state.expiresAt) {
      return AuthState.EXPIRED;
    } else if (now >= warningThreshold) {
      return AuthState.EXPIRING_SOON;
    } else {
      return AuthState.VALID;
    }
  }

  /**
   * Starts periodic auth check for a proxy
   * @private
   * @param {string} proxyId - Proxy ID
   */
  _startAuthCheck(proxyId) {
    // Clear existing timer
    this._stopAuthCheck(proxyId);

    const timer = setInterval(() => {
      this._performAuthCheck(proxyId);
    }, this.checkInterval);

    this._checkTimers.set(proxyId, timer);
  }

  /**
   * Stops periodic auth check for a proxy
   * @private
   * @param {string} proxyId - Proxy ID
   */
  _stopAuthCheck(proxyId) {
    const timer = this._checkTimers.get(proxyId);
    if (timer) {
      clearInterval(timer);
      this._checkTimers.delete(proxyId);
    }
  }

  /**
   * Performs auth check and emits events if needed
   * @private
   * @param {string} proxyId - Proxy ID
   */
  async _performAuthCheck(proxyId) {
    const state = this._authStates.get(proxyId);
    if (!state) return;

    const previousState = state.state;
    state.state = this._determineAuthState(state);
    state.lastCheckedAt = new Date();

    // Emit event if state changed
    if (state.state !== previousState) {
      this.log('info', `Auth state changed for proxy ${proxyId}: ${previousState} -> ${state.state}`);

      if (this.eventBus) {
        await this.eventBus.publish('proxy:auth_state_changed', {
          proxyId,
          previousState,
          newState: state.state,
          expiresAt: state.expiresAt?.toISOString(),
          timestamp: new Date().toISOString()
        });
      }

      // Emit warning if expiring soon
      if (state.state === AuthState.EXPIRING_SOON) {
        const daysRemaining = Math.ceil(
          (state.expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
        );
        
        if (this.eventBus) {
          await this.eventBus.publish('proxy:auth_expiring_soon', {
            proxyId,
            expiresAt: state.expiresAt.toISOString(),
            daysRemaining,
            timestamp: new Date().toISOString()
          });
        }
      }
    }
  }

  // ==================== Lifecycle Methods ====================

  /**
   * Unregisters auth for a proxy
   * @param {string} proxyId - Proxy ID
   * @returns {boolean}
   */
  unregisterAuth(proxyId) {
    this._stopAuthCheck(proxyId);
    return this._authStates.delete(proxyId);
  }

  /**
   * Cleans up all resources
   */
  cleanup() {
    this.log('info', 'Cleaning up ProxyAuthManager...');
    
    // Clear all timers
    for (const proxyId of this._checkTimers.keys()) {
      this._stopAuthCheck(proxyId);
    }
    
    // Cancel all pending updates
    for (const [accountId, pending] of this._pendingUpdates) {
      pending.resolve({ success: false, cancelled: true });
    }
    
    this._authStates.clear();
    this._pendingUpdates.clear();
    
    this.log('info', 'ProxyAuthManager cleanup complete');
  }

  /**
   * Alias for cleanup
   */
  destroy() {
    this.cleanup();
  }
}

// Export class and enums
ProxyAuthManager.State = AuthState;
ProxyAuthManager.Defaults = AuthDefaults;
module.exports = ProxyAuthManager;
