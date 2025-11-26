'use strict';

const ProxyError = require('../../domain/errors/ProxyError');

/**
 * SharedProxyManager - Multi-Account Proxy Management
 * 
 * Manages proxy usage across multiple accounts, enabling:
 * - Tracking which accounts use which proxies
 * - Notifying all affected accounts when a proxy fails
 * - Independent health checks per account (avoiding cross-account interference)
 * 
 * @class
 */
class SharedProxyManager {
  /**
   * Creates a SharedProxyManager instance
   * @param {Object} [options={}] - Configuration options
   * @param {Function} [options.logger] - Logger function
   * @param {Object} [options.eventBus] - Event bus for publishing events
   * @param {Object} [options.healthMonitor] - ProxyHealthMonitor instance
   */
  constructor(options = {}) {
    this.options = options;
    this.log = options.logger || this._createLogger();
    this.eventBus = options.eventBus || null;
    this.healthMonitor = options.healthMonitor || null;
    
    // Track proxy usage: proxyId -> Set<accountId>
    this._proxyUsage = new Map();
    
    // Track account -> proxy mapping: accountId -> proxyId
    this._accountProxy = new Map();
    
    // Track proxy failure counts for shared proxies
    this._proxyFailureCounts = new Map();
  }

  /**
   * Creates a default logger
   * @private
   * @returns {Function}
   */
  _createLogger() {
    return (level, message, ...args) => {
      const timestamp = new Date().toISOString();
      const prefix = `[${timestamp}] [SharedProxyManager] [${level.toUpperCase()}]`;
      
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
   * Registers proxy usage for an account
   * @param {string} accountId - Account ID
   * @param {string} proxyId - Proxy ID
   * @returns {boolean} True if registered successfully
   */
  registerProxyUsage(accountId, proxyId) {
    if (!accountId || !proxyId) {
      this.log('error', 'Both accountId and proxyId are required');
      return false;
    }

    // Remove previous proxy association if exists
    const previousProxyId = this._accountProxy.get(accountId);
    if (previousProxyId && previousProxyId !== proxyId) {
      this._removeAccountFromProxy(accountId, previousProxyId);
    }

    // Add to proxy usage tracking
    if (!this._proxyUsage.has(proxyId)) {
      this._proxyUsage.set(proxyId, new Set());
    }
    this._proxyUsage.get(proxyId).add(accountId);
    
    // Update account -> proxy mapping
    this._accountProxy.set(accountId, proxyId);

    this.log('info', `Registered proxy usage: account ${accountId} -> proxy ${proxyId}`);
    this.log('debug', `Proxy ${proxyId} now used by ${this._proxyUsage.get(proxyId).size} account(s)`);

    return true;
  }

  /**
   * Unregisters proxy usage for an account
   * @param {string} accountId - Account ID
   * @returns {boolean} True if unregistered successfully
   */
  unregisterProxyUsage(accountId) {
    if (!accountId) {
      return false;
    }

    const proxyId = this._accountProxy.get(accountId);
    if (!proxyId) {
      return false;
    }

    this._removeAccountFromProxy(accountId, proxyId);
    this._accountProxy.delete(accountId);

    this.log('info', `Unregistered proxy usage for account: ${accountId}`);
    return true;
  }

  /**
   * Gets all accounts using a specific proxy
   * @param {string} proxyId - Proxy ID
   * @returns {string[]} Array of account IDs
   */
  getAccountsByProxy(proxyId) {
    if (!proxyId) {
      return [];
    }

    const accounts = this._proxyUsage.get(proxyId);
    return accounts ? Array.from(accounts) : [];
  }

  /**
   * Gets the proxy ID for an account
   * @param {string} accountId - Account ID
   * @returns {string|null} Proxy ID or null
   */
  getProxyForAccount(accountId) {
    return this._accountProxy.get(accountId) || null;
  }

  /**
   * Notifies all accounts using a proxy about a failure
   * Each account maintains independent health checks to avoid cross-account interference
   * 
   * @param {string} proxyId - Proxy ID
   * @param {Error|ProxyError} error - The error that occurred
   * @param {Object} [options={}] - Notification options
   * @param {string} [options.sourceAccountId] - Account that detected the failure
   * @param {boolean} [options.triggerKillSwitch=false] - Whether to trigger kill-switch
   * @returns {Promise<{notifiedAccounts: string[], failedNotifications: string[]}>}
   */
  async notifyProxyFailure(proxyId, error, options = {}) {
    if (!proxyId) {
      throw new Error('Proxy ID is required');
    }

    const accounts = this.getAccountsByProxy(proxyId);
    if (accounts.length === 0) {
      this.log('warn', `No accounts using proxy ${proxyId} to notify`);
      return { notifiedAccounts: [], failedNotifications: [] };
    }

    const proxyError = error instanceof ProxyError 
      ? error 
      : new ProxyError(error.message, ProxyError.Code.UNKNOWN, { originalError: error });

    this.log('warn', `Notifying ${accounts.length} account(s) about proxy ${proxyId} failure`);

    // Track failure count
    const failureCount = (this._proxyFailureCounts.get(proxyId) || 0) + 1;
    this._proxyFailureCounts.set(proxyId, failureCount);

    const notifiedAccounts = [];
    const failedNotifications = [];

    for (const accountId of accounts) {
      // Skip the source account (it already knows about the failure)
      if (accountId === options.sourceAccountId) {
        notifiedAccounts.push(accountId);
        continue;
      }

      try {
        // Emit event for each affected account
        if (this.eventBus) {
          await this.eventBus.publish('proxy:shared_proxy_failure', {
            accountId,
            proxyId,
            error: proxyError.getUserMessage(),
            errorCode: proxyError.code,
            sourceAccountId: options.sourceAccountId,
            failureCount,
            triggerKillSwitch: options.triggerKillSwitch,
            timestamp: new Date().toISOString()
          });
        }

        notifiedAccounts.push(accountId);
        this.log('info', `Notified account ${accountId} about proxy failure`);

      } catch (notifyError) {
        failedNotifications.push(accountId);
        this.log('error', `Failed to notify account ${accountId}: ${notifyError.message}`);
      }
    }

    return { notifiedAccounts, failedNotifications };
  }

  /**
   * Resets failure count for a proxy (called after successful reconnection)
   * @param {string} proxyId - Proxy ID
   */
  resetProxyFailureCount(proxyId) {
    this._proxyFailureCounts.delete(proxyId);
    this.log('info', `Reset failure count for proxy: ${proxyId}`);
  }

  /**
   * Gets the failure count for a proxy
   * @param {string} proxyId - Proxy ID
   * @returns {number}
   */
  getProxyFailureCount(proxyId) {
    return this._proxyFailureCounts.get(proxyId) || 0;
  }

  // ==================== Query Methods ====================

  /**
   * Gets all proxies with their usage counts
   * @returns {Array<{proxyId: string, accountCount: number, accounts: string[]}>}
   */
  getAllProxyUsage() {
    const result = [];
    for (const [proxyId, accounts] of this._proxyUsage) {
      result.push({
        proxyId,
        accountCount: accounts.size,
        accounts: Array.from(accounts)
      });
    }
    return result;
  }

  /**
   * Checks if a proxy is shared (used by multiple accounts)
   * @param {string} proxyId - Proxy ID
   * @returns {boolean}
   */
  isProxyShared(proxyId) {
    const accounts = this._proxyUsage.get(proxyId);
    return accounts ? accounts.size > 1 : false;
  }

  /**
   * Gets the number of accounts using a proxy
   * @param {string} proxyId - Proxy ID
   * @returns {number}
   */
  getProxyUsageCount(proxyId) {
    const accounts = this._proxyUsage.get(proxyId);
    return accounts ? accounts.size : 0;
  }

  // ==================== Internal Methods ====================

  /**
   * Removes an account from a proxy's usage set
   * @private
   * @param {string} accountId - Account ID
   * @param {string} proxyId - Proxy ID
   */
  _removeAccountFromProxy(accountId, proxyId) {
    const accounts = this._proxyUsage.get(proxyId);
    if (accounts) {
      accounts.delete(accountId);
      
      // Clean up empty sets
      if (accounts.size === 0) {
        this._proxyUsage.delete(proxyId);
        this._proxyFailureCounts.delete(proxyId);
      }
    }
  }

  // ==================== Lifecycle Methods ====================

  /**
   * Cleans up all resources
   */
  cleanup() {
    this.log('info', 'Cleaning up SharedProxyManager...');
    this._proxyUsage.clear();
    this._accountProxy.clear();
    this._proxyFailureCounts.clear();
    this.log('info', 'SharedProxyManager cleanup complete');
  }

  /**
   * Alias for cleanup
   */
  destroy() {
    this.cleanup();
  }
}

module.exports = SharedProxyManager;
