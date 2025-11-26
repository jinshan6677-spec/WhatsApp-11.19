'use strict';

/**
 * Network State
 * @readonly
 * @enum {string}
 */
const NetworkState = {
  ONLINE: 'online',
  OFFLINE: 'offline',
  UNSTABLE: 'unstable',
  UNKNOWN: 'unknown'
};

/**
 * Default configuration
 * @readonly
 */
const NetworkDefaults = {
  STABILITY_DELAY: 3000,       // Wait 3 seconds after network change before re-verifying
  CHECK_INTERVAL: 5000,        // Check network every 5 seconds when unstable
  MAX_INSTABILITY_COUNT: 3,    // Max changes before marking as unstable
  INSTABILITY_WINDOW: 30000    // Time window for counting changes (30 seconds)
};

/**
 * NetworkChangeDetector - Network Change Detection and Handling
 * 
 * Monitors network connectivity changes and coordinates with proxy health monitoring:
 * - Detects network online/offline transitions
 * - Pauses health checks during network instability
 * - Re-verifies proxy connections after network stabilizes
 * 
 * @class
 */
class NetworkChangeDetector {
  /**
   * Creates a NetworkChangeDetector instance
   * @param {Object} [options={}] - Configuration options
   * @param {Function} [options.logger] - Logger function
   * @param {Object} [options.eventBus] - Event bus for publishing events
   * @param {Object} [options.healthMonitor] - ProxyHealthMonitor instance
   * @param {number} [options.stabilityDelay] - Delay before re-verification
   * @param {number} [options.checkInterval] - Network check interval
   */
  constructor(options = {}) {
    this.options = options;
    this.log = options.logger || this._createLogger();
    this.eventBus = options.eventBus || null;
    this.healthMonitor = options.healthMonitor || null;
    this.stabilityDelay = options.stabilityDelay || NetworkDefaults.STABILITY_DELAY;
    this.checkInterval = options.checkInterval || NetworkDefaults.CHECK_INTERVAL;
    this.maxInstabilityCount = options.maxInstabilityCount || NetworkDefaults.MAX_INSTABILITY_COUNT;
    this.instabilityWindow = options.instabilityWindow || NetworkDefaults.INSTABILITY_WINDOW;
    
    // Current network state
    this._currentState = NetworkState.UNKNOWN;
    this._isMonitoring = false;
    
    // Track network changes for instability detection
    this._changeHistory = [];
    
    // Track paused accounts
    this._pausedAccounts = new Set();
    
    // Timers
    this._stabilityTimer = null;
    this._checkTimer = null;
    
    // Bound handlers for cleanup
    this._boundOnlineHandler = this._handleOnline.bind(this);
    this._boundOfflineHandler = this._handleOffline.bind(this);
  }

  /**
   * Creates a default logger
   * @private
   * @returns {Function}
   */
  _createLogger() {
    return (level, message, ...args) => {
      const timestamp = new Date().toISOString();
      const prefix = `[${timestamp}] [NetworkChangeDetector] [${level.toUpperCase()}]`;
      
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
   * Starts monitoring network changes
   * @returns {boolean} True if monitoring started
   */
  startMonitoring() {
    if (this._isMonitoring) {
      this.log('warn', 'Network monitoring already active');
      return false;
    }

    this.log('info', 'Starting network change monitoring');

    // Check if we're in a browser/Electron environment
    if (typeof window !== 'undefined') {
      window.addEventListener('online', this._boundOnlineHandler);
      window.addEventListener('offline', this._boundOfflineHandler);
      
      // Set initial state
      this._currentState = navigator.onLine ? NetworkState.ONLINE : NetworkState.OFFLINE;
    } else if (typeof process !== 'undefined') {
      // Node.js environment - use periodic checking
      this._startPeriodicCheck();
      this._currentState = NetworkState.ONLINE; // Assume online initially
    }

    this._isMonitoring = true;
    this.log('info', `Network monitoring started (initial state: ${this._currentState})`);

    return true;
  }

  /**
   * Stops monitoring network changes
   * @returns {boolean} True if monitoring stopped
   */
  stopMonitoring() {
    if (!this._isMonitoring) {
      return false;
    }

    this.log('info', 'Stopping network change monitoring');

    // Remove event listeners
    if (typeof window !== 'undefined') {
      window.removeEventListener('online', this._boundOnlineHandler);
      window.removeEventListener('offline', this._boundOfflineHandler);
    }

    // Clear timers
    this._clearTimers();

    // Resume any paused accounts
    for (const accountId of this._pausedAccounts) {
      this._resumeHealthCheck(accountId);
    }
    this._pausedAccounts.clear();

    this._isMonitoring = false;
    this._currentState = NetworkState.UNKNOWN;
    this._changeHistory = [];

    this.log('info', 'Network monitoring stopped');
    return true;
  }

  /**
   * Handles network change for a specific account
   * Pauses health checks and schedules re-verification
   * 
   * @param {string} accountId - Account ID
   * @returns {Promise<void>}
   */
  async handleNetworkChange(accountId) {
    if (!accountId) {
      throw new Error('Account ID is required');
    }

    this.log('info', `Handling network change for account: ${accountId}`);

    // Pause health check for this account
    this._pauseHealthCheck(accountId);

    // Emit event
    if (this.eventBus) {
      await this.eventBus.publish('network:change_detected', {
        accountId,
        networkState: this._currentState,
        timestamp: new Date().toISOString()
      });
    }

    // Schedule re-verification after stability delay
    this._scheduleReVerification(accountId);
  }

  /**
   * Gets the current network state
   * @returns {{state: string, isOnline: boolean, isStable: boolean}}
   */
  getNetworkState() {
    return {
      state: this._currentState,
      isOnline: this._currentState === NetworkState.ONLINE,
      isStable: this._currentState !== NetworkState.UNSTABLE,
      pausedAccounts: Array.from(this._pausedAccounts),
      recentChanges: this._changeHistory.length
    };
  }

  /**
   * Checks if network is currently online
   * @returns {boolean}
   */
  isOnline() {
    if (typeof navigator !== 'undefined') {
      return navigator.onLine;
    }
    return this._currentState === NetworkState.ONLINE;
  }

  /**
   * Checks if network is stable (not experiencing frequent changes)
   * @returns {boolean}
   */
  isStable() {
    return this._currentState !== NetworkState.UNSTABLE;
  }

  // ==================== Internal Methods ====================

  /**
   * Handles online event
   * @private
   */
  async _handleOnline() {
    this.log('info', 'Network came online');
    this._recordChange('online');
    
    const previousState = this._currentState;
    this._currentState = this._isNetworkUnstable() ? NetworkState.UNSTABLE : NetworkState.ONLINE;

    await this._notifyStateChange(previousState, this._currentState);

    // If stable, trigger re-verification for all paused accounts
    if (this._currentState === NetworkState.ONLINE) {
      this._scheduleAllReVerifications();
    }
  }

  /**
   * Handles offline event
   * @private
   */
  async _handleOffline() {
    this.log('warn', 'Network went offline');
    this._recordChange('offline');
    
    const previousState = this._currentState;
    this._currentState = NetworkState.OFFLINE;

    await this._notifyStateChange(previousState, this._currentState);

    // Pause all health checks
    if (this.healthMonitor) {
      const monitoredAccounts = this.healthMonitor.getMonitoredAccounts();
      for (const accountId of monitoredAccounts) {
        this._pauseHealthCheck(accountId);
      }
    }
  }

  /**
   * Records a network change for instability detection
   * @private
   * @param {string} type - Change type ('online' or 'offline')
   */
  _recordChange(type) {
    const now = Date.now();
    this._changeHistory.push({ type, timestamp: now });

    // Remove old entries outside the instability window
    const cutoff = now - this.instabilityWindow;
    this._changeHistory = this._changeHistory.filter(c => c.timestamp > cutoff);
  }

  /**
   * Checks if network is unstable (frequent changes)
   * @private
   * @returns {boolean}
   */
  _isNetworkUnstable() {
    return this._changeHistory.length >= this.maxInstabilityCount;
  }

  /**
   * Notifies about state change
   * @private
   * @param {string} previousState - Previous state
   * @param {string} newState - New state
   */
  async _notifyStateChange(previousState, newState) {
    if (previousState === newState) return;

    this.log('info', `Network state changed: ${previousState} -> ${newState}`);

    if (this.eventBus) {
      await this.eventBus.publish('network:state_changed', {
        previousState,
        newState,
        isOnline: newState === NetworkState.ONLINE,
        isStable: newState !== NetworkState.UNSTABLE,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Pauses health check for an account
   * @private
   * @param {string} accountId - Account ID
   */
  _pauseHealthCheck(accountId) {
    if (this._pausedAccounts.has(accountId)) {
      return;
    }

    this._pausedAccounts.add(accountId);
    this.log('info', `Paused health check for account: ${accountId}`);

    // Note: We don't actually stop the health monitor here
    // Instead, we track paused accounts and the health monitor
    // should check with us before performing checks
  }

  /**
   * Resumes health check for an account
   * @private
   * @param {string} accountId - Account ID
   */
  _resumeHealthCheck(accountId) {
    if (!this._pausedAccounts.has(accountId)) {
      return;
    }

    this._pausedAccounts.delete(accountId);
    this.log('info', `Resumed health check for account: ${accountId}`);
  }

  /**
   * Schedules re-verification for an account after stability delay
   * @private
   * @param {string} accountId - Account ID
   */
  _scheduleReVerification(accountId) {
    this.log('info', `Scheduling re-verification for account ${accountId} in ${this.stabilityDelay}ms`);

    setTimeout(async () => {
      // Check if still paused and network is online
      if (!this._pausedAccounts.has(accountId)) {
        return;
      }

      if (this._currentState !== NetworkState.ONLINE) {
        this.log('info', `Network not stable yet, delaying re-verification for ${accountId}`);
        this._scheduleReVerification(accountId);
        return;
      }

      // Resume and trigger re-verification
      this._resumeHealthCheck(accountId);

      if (this.eventBus) {
        await this.eventBus.publish('network:reverification_triggered', {
          accountId,
          timestamp: new Date().toISOString()
        });
      }

      // Trigger health check
      if (this.healthMonitor && this.healthMonitor.isMonitoring(accountId)) {
        this.log('info', `Triggering health check for account: ${accountId}`);
        await this.healthMonitor.checkHealth(accountId);
      }
    }, this.stabilityDelay);
  }

  /**
   * Schedules re-verification for all paused accounts
   * @private
   */
  _scheduleAllReVerifications() {
    for (const accountId of this._pausedAccounts) {
      this._scheduleReVerification(accountId);
    }
  }

  /**
   * Starts periodic network checking (for Node.js environment)
   * @private
   */
  _startPeriodicCheck() {
    this._checkTimer = setInterval(async () => {
      // In Node.js, we can't easily detect network changes
      // This is a placeholder for potential DNS-based checking
      try {
        // Simple connectivity check could be added here
        // For now, we assume stable connection
      } catch (error) {
        if (this._currentState !== NetworkState.OFFLINE) {
          await this._handleOffline();
        }
      }
    }, this.checkInterval);
  }

  /**
   * Clears all timers
   * @private
   */
  _clearTimers() {
    if (this._stabilityTimer) {
      clearTimeout(this._stabilityTimer);
      this._stabilityTimer = null;
    }
    if (this._checkTimer) {
      clearInterval(this._checkTimer);
      this._checkTimer = null;
    }
  }

  // ==================== Query Methods ====================

  /**
   * Checks if health check is paused for an account
   * @param {string} accountId - Account ID
   * @returns {boolean}
   */
  isHealthCheckPaused(accountId) {
    return this._pausedAccounts.has(accountId);
  }

  /**
   * Gets all paused accounts
   * @returns {string[]}
   */
  getPausedAccounts() {
    return Array.from(this._pausedAccounts);
  }

  /**
   * Checks if monitoring is active
   * @returns {boolean}
   */
  isMonitoring() {
    return this._isMonitoring;
  }

  // ==================== Lifecycle Methods ====================

  /**
   * Cleans up all resources
   */
  cleanup() {
    this.log('info', 'Cleaning up NetworkChangeDetector...');
    this.stopMonitoring();
    this.log('info', 'NetworkChangeDetector cleanup complete');
  }

  /**
   * Alias for cleanup
   */
  destroy() {
    this.cleanup();
  }
}

// Export class and enums
NetworkChangeDetector.State = NetworkState;
NetworkChangeDetector.Defaults = NetworkDefaults;
module.exports = NetworkChangeDetector;
