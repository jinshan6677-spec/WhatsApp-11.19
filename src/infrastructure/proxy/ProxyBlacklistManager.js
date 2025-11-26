'use strict';

/**
 * Blacklist Reason
 * @readonly
 * @enum {string}
 */
const BlacklistReason = {
  CONNECTION_FAILED: 'connection_failed',
  CONSECUTIVE_FAILURES: 'consecutive_failures',
  IP_LEAK: 'ip_leak',
  BLOCKED_403: 'blocked_403',
  BLOCKED_451: 'blocked_451',
  CAPTCHA_REQUIRED: 'captcha_required',
  RATE_LIMITED: 'rate_limited',
  AUTH_FAILED: 'auth_failed',
  MANUAL: 'manual',
  UNKNOWN: 'unknown'
};

/**
 * Default configuration
 * @readonly
 */
const BlacklistDefaults = {
  DEFAULT_DURATION: 3600000,     // 1 hour default blacklist duration
  MAX_DURATION: 86400000,        // 24 hours max duration
  AUTO_UNBLACKLIST_CHECK: 60000  // Check for expired blacklists every minute
};

/**
 * ProxyBlacklistManager - Proxy Blacklist Management
 * 
 * Manages proxy blacklisting with:
 * - Automatic blacklisting on specific error conditions
 * - Timed blacklist with automatic removal
 * - Detection of ban signals (403/451 errors, captcha)
 * 
 * @class
 */
class ProxyBlacklistManager {
  /**
   * Creates a ProxyBlacklistManager instance
   * @param {Object} [options={}] - Configuration options
   * @param {Function} [options.logger] - Logger function
   * @param {Object} [options.eventBus] - Event bus for publishing events
   * @param {number} [options.defaultDuration] - Default blacklist duration in ms
   * @param {boolean} [options.autoUnblacklist=true] - Enable automatic unblacklisting
   */
  constructor(options = {}) {
    this.options = options;
    this.log = options.logger || this._createLogger();
    this.eventBus = options.eventBus || null;
    this.defaultDuration = options.defaultDuration || BlacklistDefaults.DEFAULT_DURATION;
    this.autoUnblacklist = options.autoUnblacklist !== false;
    
    // Track blacklisted proxies: proxyId -> BlacklistEntry
    this._blacklist = new Map();
    
    // Track scheduled unblacklist timers: proxyId -> timerId
    this._unblacklistTimers = new Map();
    
    // Auto-unblacklist check timer
    this._checkTimer = null;
    
    // Start auto-unblacklist if enabled
    if (this.autoUnblacklist) {
      this._startAutoUnblacklistCheck();
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
      const prefix = `[${timestamp}] [ProxyBlacklistManager] [${level.toUpperCase()}]`;
      
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
   * Adds a proxy to the blacklist
   * @param {string} proxyId - Proxy ID
   * @param {string} reason - Blacklist reason
   * @param {number} [duration] - Duration in ms (0 for permanent)
   * @param {Object} [details={}] - Additional details
   * @returns {boolean} True if added successfully
   */
  addToBlacklist(proxyId, reason, duration = null, details = {}) {
    if (!proxyId) {
      this.log('error', 'Proxy ID is required');
      return false;
    }

    const blacklistDuration = duration ?? this.defaultDuration;
    const expiresAt = blacklistDuration > 0 
      ? new Date(Date.now() + blacklistDuration)
      : null; // null means permanent

    const entry = {
      proxyId,
      reason: reason || BlacklistReason.UNKNOWN,
      duration: blacklistDuration,
      addedAt: new Date(),
      expiresAt,
      details,
      permanent: blacklistDuration === 0
    };

    // Clear any existing timer
    this._clearUnblacklistTimer(proxyId);

    // Add to blacklist
    this._blacklist.set(proxyId, entry);

    this.log('warn', `Blacklisted proxy ${proxyId} (reason: ${reason}, duration: ${blacklistDuration}ms)`);

    // Schedule automatic unblacklist if not permanent
    if (blacklistDuration > 0) {
      this.scheduleUnblacklist(proxyId, blacklistDuration);
    }

    // Emit event
    if (this.eventBus) {
      this.eventBus.publish('proxy:blacklisted', {
        proxyId,
        reason,
        duration: blacklistDuration,
        expiresAt: expiresAt?.toISOString(),
        permanent: entry.permanent,
        details,
        timestamp: new Date().toISOString()
      });
    }

    return true;
  }

  /**
   * Checks if a proxy is blacklisted
   * @param {string} proxyId - Proxy ID
   * @returns {{blacklisted: boolean, entry?: Object}}
   */
  isBlacklisted(proxyId) {
    const entry = this._blacklist.get(proxyId);
    
    if (!entry) {
      return { blacklisted: false };
    }

    // Check if expired
    if (entry.expiresAt && new Date() >= entry.expiresAt) {
      this._removeFromBlacklist(proxyId, 'expired');
      return { blacklisted: false };
    }

    return {
      blacklisted: true,
      entry: {
        proxyId: entry.proxyId,
        reason: entry.reason,
        addedAt: entry.addedAt,
        expiresAt: entry.expiresAt,
        permanent: entry.permanent,
        remainingMs: entry.expiresAt 
          ? Math.max(0, entry.expiresAt.getTime() - Date.now())
          : null
      }
    };
  }

  /**
   * Schedules automatic unblacklist after specified time
   * @param {string} proxyId - Proxy ID
   * @param {number} afterMs - Time in ms until unblacklist
   * @returns {boolean} True if scheduled
   */
  scheduleUnblacklist(proxyId, afterMs) {
    if (!proxyId || afterMs <= 0) {
      return false;
    }

    // Clear existing timer
    this._clearUnblacklistTimer(proxyId);

    // Cap duration
    const duration = Math.min(afterMs, BlacklistDefaults.MAX_DURATION);

    const timerId = setTimeout(() => {
      this._removeFromBlacklist(proxyId, 'scheduled');
    }, duration);

    this._unblacklistTimers.set(proxyId, timerId);
    this.log('info', `Scheduled unblacklist for proxy ${proxyId} in ${duration}ms`);

    return true;
  }

  /**
   * Manually removes a proxy from the blacklist
   * @param {string} proxyId - Proxy ID
   * @returns {boolean} True if removed
   */
  removeFromBlacklist(proxyId) {
    return this._removeFromBlacklist(proxyId, 'manual');
  }

  // ==================== Ban Signal Detection ====================

  /**
   * Detects if an error indicates a ban signal
   * @param {Error|Object} error - The error to analyze
   * @returns {{isBanSignal: boolean, reason?: string, suggestedDuration?: number}}
   */
  detectBanSignal(error) {
    const errorMessage = error?.message?.toLowerCase() || '';
    const statusCode = error?.statusCode || error?.status || error?.code;

    // 403 Forbidden - likely IP blocked
    if (statusCode === 403 || errorMessage.includes('403') || errorMessage.includes('forbidden')) {
      return {
        isBanSignal: true,
        reason: BlacklistReason.BLOCKED_403,
        suggestedDuration: 3600000 // 1 hour
      };
    }

    // 451 Unavailable For Legal Reasons - geo-blocked or banned
    if (statusCode === 451 || errorMessage.includes('451')) {
      return {
        isBanSignal: true,
        reason: BlacklistReason.BLOCKED_451,
        suggestedDuration: 86400000 // 24 hours
      };
    }

    // Captcha/verification required
    if (errorMessage.includes('captcha') || 
        errorMessage.includes('verification') ||
        errorMessage.includes('challenge')) {
      return {
        isBanSignal: true,
        reason: BlacklistReason.CAPTCHA_REQUIRED,
        suggestedDuration: 1800000 // 30 minutes
      };
    }

    // Rate limiting
    if (statusCode === 429 || 
        errorMessage.includes('rate limit') || 
        errorMessage.includes('too many requests')) {
      return {
        isBanSignal: true,
        reason: BlacklistReason.RATE_LIMITED,
        suggestedDuration: 900000 // 15 minutes
      };
    }

    // Authentication failure
    if (statusCode === 407 || 
        errorMessage.includes('proxy auth') ||
        errorMessage.includes('authentication required')) {
      return {
        isBanSignal: true,
        reason: BlacklistReason.AUTH_FAILED,
        suggestedDuration: 0 // Permanent until auth is fixed
      };
    }

    return { isBanSignal: false };
  }

  /**
   * Processes an error and automatically blacklists if ban signal detected
   * @param {string} proxyId - Proxy ID
   * @param {Error|Object} error - The error
   * @returns {{blacklisted: boolean, reason?: string}}
   */
  processError(proxyId, error) {
    const detection = this.detectBanSignal(error);
    
    if (detection.isBanSignal) {
      this.addToBlacklist(proxyId, detection.reason, detection.suggestedDuration, {
        originalError: error?.message
      });
      
      return {
        blacklisted: true,
        reason: detection.reason
      };
    }

    return { blacklisted: false };
  }

  // ==================== Query Methods ====================

  /**
   * Gets all blacklisted proxies
   * @returns {Array<Object>}
   */
  getBlacklist() {
    const result = [];
    const now = Date.now();

    for (const [proxyId, entry] of this._blacklist) {
      // Skip expired entries
      if (entry.expiresAt && now >= entry.expiresAt.getTime()) {
        continue;
      }

      result.push({
        proxyId: entry.proxyId,
        reason: entry.reason,
        addedAt: entry.addedAt,
        expiresAt: entry.expiresAt,
        permanent: entry.permanent,
        remainingMs: entry.expiresAt 
          ? Math.max(0, entry.expiresAt.getTime() - now)
          : null
      });
    }

    return result;
  }

  /**
   * Gets blacklist statistics
   * @returns {Object}
   */
  getStats() {
    const blacklist = this.getBlacklist();
    const byReason = {};

    for (const entry of blacklist) {
      byReason[entry.reason] = (byReason[entry.reason] || 0) + 1;
    }

    return {
      totalBlacklisted: blacklist.length,
      permanentCount: blacklist.filter(e => e.permanent).length,
      temporaryCount: blacklist.filter(e => !e.permanent).length,
      byReason
    };
  }

  /**
   * Clears all blacklist entries
   * @returns {number} Number of entries cleared
   */
  clearAll() {
    const count = this._blacklist.size;
    
    // Clear all timers
    for (const proxyId of this._unblacklistTimers.keys()) {
      this._clearUnblacklistTimer(proxyId);
    }
    
    this._blacklist.clear();
    this.log('info', `Cleared all ${count} blacklist entries`);
    
    return count;
  }

  // ==================== Internal Methods ====================

  /**
   * Removes a proxy from the blacklist
   * @private
   * @param {string} proxyId - Proxy ID
   * @param {string} reason - Removal reason
   * @returns {boolean}
   */
  _removeFromBlacklist(proxyId, reason) {
    const entry = this._blacklist.get(proxyId);
    if (!entry) {
      return false;
    }

    this._clearUnblacklistTimer(proxyId);
    this._blacklist.delete(proxyId);

    this.log('info', `Removed proxy ${proxyId} from blacklist (reason: ${reason})`);

    // Emit event
    if (this.eventBus) {
      this.eventBus.publish('proxy:unblacklisted', {
        proxyId,
        removalReason: reason,
        originalReason: entry.reason,
        wasBlacklistedFor: Date.now() - entry.addedAt.getTime(),
        timestamp: new Date().toISOString()
      });
    }

    return true;
  }

  /**
   * Clears unblacklist timer for a proxy
   * @private
   * @param {string} proxyId - Proxy ID
   */
  _clearUnblacklistTimer(proxyId) {
    const timerId = this._unblacklistTimers.get(proxyId);
    if (timerId) {
      clearTimeout(timerId);
      this._unblacklistTimers.delete(proxyId);
    }
  }

  /**
   * Starts automatic unblacklist checking
   * @private
   */
  _startAutoUnblacklistCheck() {
    this._checkTimer = setInterval(() => {
      this._checkExpiredEntries();
    }, BlacklistDefaults.AUTO_UNBLACKLIST_CHECK);
  }

  /**
   * Checks and removes expired blacklist entries
   * @private
   */
  _checkExpiredEntries() {
    const now = Date.now();
    const expired = [];

    for (const [proxyId, entry] of this._blacklist) {
      if (entry.expiresAt && now >= entry.expiresAt.getTime()) {
        expired.push(proxyId);
      }
    }

    for (const proxyId of expired) {
      this._removeFromBlacklist(proxyId, 'expired');
    }
  }

  // ==================== Lifecycle Methods ====================

  /**
   * Cleans up all resources
   */
  cleanup() {
    this.log('info', 'Cleaning up ProxyBlacklistManager...');
    
    // Clear check timer
    if (this._checkTimer) {
      clearInterval(this._checkTimer);
      this._checkTimer = null;
    }
    
    // Clear all unblacklist timers
    for (const proxyId of this._unblacklistTimers.keys()) {
      this._clearUnblacklistTimer(proxyId);
    }
    
    this._blacklist.clear();
    
    this.log('info', 'ProxyBlacklistManager cleanup complete');
  }

  /**
   * Alias for cleanup
   */
  destroy() {
    this.cleanup();
  }
}

// Export class and enums
ProxyBlacklistManager.Reason = BlacklistReason;
ProxyBlacklistManager.Defaults = BlacklistDefaults;
module.exports = ProxyBlacklistManager;
