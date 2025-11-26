'use strict';

/**
 * Health Status Enum
 * @readonly
 * @enum {string}
 */
const HealthStatus = {
  HEALTHY: 'healthy',
  DEGRADED: 'degraded',
  UNHEALTHY: 'unhealthy',
  UNKNOWN: 'unknown'
};

/**
 * ProxyHealthStats Domain Entity
 * 
 * Represents health statistics and monitoring data for a proxy.
 * Tracks latency, uptime, and health check results.
 */
class ProxyHealthStats {
  /**
   * Creates a ProxyHealthStats instance
   * @param {Object} stats - Health statistics data
   */
  constructor(stats = {}) {
    this.accountId = stats.accountId || null;
    this.proxyId = stats.proxyId || null;
    this.status = stats.status || HealthStatus.UNKNOWN;
    this.lastCheckAt = stats.lastCheckAt ? new Date(stats.lastCheckAt) : null;
    this.lastSuccessAt = stats.lastSuccessAt ? new Date(stats.lastSuccessAt) : null;
    this.lastFailureAt = stats.lastFailureAt ? new Date(stats.lastFailureAt) : null;
    this.lastIPVerificationAt = stats.lastIPVerificationAt ? new Date(stats.lastIPVerificationAt) : null;
    
    // Initial values from monitoring start
    this.initialIP = stats.initialIP || null;
    this.startTime = stats.startTime ? new Date(stats.startTime) : null;
    this.lastIPVerificationTime = stats.lastIPVerificationTime ? new Date(stats.lastIPVerificationTime) : null;
    
    // Latency statistics
    this.currentLatency = stats.currentLatency || null; // in milliseconds
    this.averageLatency = stats.averageLatency || null;
    this.minLatency = stats.minLatency || null;
    this.maxLatency = stats.maxLatency || null;
    this.p95Latency = stats.p95Latency || null;
    
    // Health check counters
    this.totalChecks = stats.totalChecks || 0;
    this.successfulChecks = stats.successfulChecks || 0;
    this.failedChecks = stats.failedChecks || 0;
    this.consecutiveFailures = stats.consecutiveFailures || 0;
    this.consecutiveSuccesses = stats.consecutiveSuccesses || 0;
    
    // Uptime tracking
    this.uptimeStart = stats.uptimeStart ? new Date(stats.uptimeStart) : null;
    this.totalUptimeMs = stats.totalUptimeMs || 0;
    this.totalDowntimeMs = stats.totalDowntimeMs || 0;
    
    // IP verification
    this.expectedIP = stats.expectedIP || null;
    this.lastVerifiedIP = stats.lastVerifiedIP || null;
    this.ipMismatchCount = stats.ipMismatchCount || 0;
    
    // Latency history for calculating percentiles
    this._latencyHistory = stats._latencyHistory || [];
    this._maxHistorySize = 100;
  }

  // ==================== Health Status Methods ====================

  /**
   * Checks if the proxy is healthy
   * @returns {boolean}
   */
  isHealthy() {
    return this.status === HealthStatus.HEALTHY;
  }

  /**
   * Checks if the proxy is degraded
   * @returns {boolean}
   */
  isDegraded() {
    return this.status === HealthStatus.DEGRADED;
  }

  /**
   * Checks if the proxy is unhealthy
   * @returns {boolean}
   */
  isUnhealthy() {
    return this.status === HealthStatus.UNHEALTHY;
  }

  /**
   * Gets the success rate as a percentage
   * @returns {number} Success rate (0-100)
   */
  getSuccessRate() {
    if (this.totalChecks === 0) {
      return 0;
    }
    return Math.round((this.successfulChecks / this.totalChecks) * 100);
  }

  /**
   * Gets the uptime percentage
   * @returns {number} Uptime percentage (0-100)
   */
  getUptimePercentage() {
    const totalTime = this.totalUptimeMs + this.totalDowntimeMs;
    if (totalTime === 0) {
      return 0;
    }
    return Math.round((this.totalUptimeMs / totalTime) * 100);
  }

  /**
   * Gets the uptime duration in milliseconds
   * @returns {number} Uptime in milliseconds
   */
  getUptime() {
    if (!this.startTime) {
      return 0;
    }
    return Date.now() - this.startTime.getTime();
  }

  // ==================== Recording Methods ====================

  /**
   * Records a successful health check
   * @param {number} latency - Latency in milliseconds
   * @param {string} [verifiedIP] - The verified exit IP
   */
  recordSuccess(latency, verifiedIP = null) {
    const now = new Date();
    this.lastCheckAt = now;
    this.lastSuccessAt = now;
    this.totalChecks++;
    this.successfulChecks++;
    this.consecutiveSuccesses++;
    this.consecutiveFailures = 0;
    
    // Update latency stats
    this._recordLatency(latency);
    
    // Update IP verification
    if (verifiedIP) {
      this.lastIPVerificationAt = now;
      this.lastVerifiedIP = verifiedIP;
      
      // Check for IP mismatch
      if (this.expectedIP && verifiedIP !== this.expectedIP) {
        this.ipMismatchCount++;
      }
    }
    
    // Update status
    this._updateStatus();
  }

  /**
   * Records a failed health check
   * @param {string} [error] - Error message
   */
  recordFailure(error = null) {
    const now = new Date();
    this.lastCheckAt = now;
    this.lastFailureAt = now;
    this.totalChecks++;
    this.failedChecks++;
    this.consecutiveFailures++;
    this.consecutiveSuccesses = 0;
    
    // Update status
    this._updateStatus();
  }

  /**
   * Records latency measurement
   * @private
   * @param {number} latency - Latency in milliseconds
   */
  _recordLatency(latency) {
    this.currentLatency = latency;
    
    // Add to history
    this._latencyHistory.push(latency);
    if (this._latencyHistory.length > this._maxHistorySize) {
      this._latencyHistory.shift();
    }
    
    // Update statistics
    this._calculateLatencyStats();
  }

  /**
   * Calculates latency statistics from history
   * @private
   */
  _calculateLatencyStats() {
    if (this._latencyHistory.length === 0) {
      return;
    }
    
    const sorted = [...this._latencyHistory].sort((a, b) => a - b);
    const sum = sorted.reduce((a, b) => a + b, 0);
    
    this.averageLatency = Math.round(sum / sorted.length);
    this.minLatency = sorted[0];
    this.maxLatency = sorted[sorted.length - 1];
    
    // Calculate P95
    const p95Index = Math.floor(sorted.length * 0.95);
    this.p95Latency = sorted[Math.min(p95Index, sorted.length - 1)];
  }

  /**
   * Updates the health status based on current stats
   * @private
   */
  _updateStatus() {
    // Unhealthy: 3+ consecutive failures or IP mismatch
    if (this.consecutiveFailures >= 3 || this.ipMismatchCount > 0) {
      this.status = HealthStatus.UNHEALTHY;
      return;
    }
    
    // Degraded: high latency or recent failures
    if (this.consecutiveFailures > 0 || 
        (this.averageLatency && this.averageLatency > 500)) {
      this.status = HealthStatus.DEGRADED;
      return;
    }
    
    // Healthy: no issues
    if (this.consecutiveSuccesses >= 1) {
      this.status = HealthStatus.HEALTHY;
      return;
    }
    
    this.status = HealthStatus.UNKNOWN;
  }

  /**
   * Sets the expected IP for verification
   * @param {string} ip - Expected exit IP
   */
  setExpectedIP(ip) {
    this.expectedIP = ip;
    this.ipMismatchCount = 0;
  }

  /**
   * Starts uptime tracking
   */
  startUptime() {
    this.uptimeStart = new Date();
  }

  /**
   * Stops uptime tracking and records the duration
   * @param {boolean} wasHealthy - Whether the proxy was healthy during this period
   */
  stopUptime(wasHealthy = true) {
    if (this.uptimeStart) {
      const duration = Date.now() - this.uptimeStart.getTime();
      if (wasHealthy) {
        this.totalUptimeMs += duration;
      } else {
        this.totalDowntimeMs += duration;
      }
      this.uptimeStart = null;
    }
  }

  /**
   * Resets all statistics
   */
  reset() {
    this.status = HealthStatus.UNKNOWN;
    this.lastCheckAt = null;
    this.lastSuccessAt = null;
    this.lastFailureAt = null;
    this.lastIPVerificationAt = null;
    this.currentLatency = null;
    this.averageLatency = null;
    this.minLatency = null;
    this.maxLatency = null;
    this.p95Latency = null;
    this.totalChecks = 0;
    this.successfulChecks = 0;
    this.failedChecks = 0;
    this.consecutiveFailures = 0;
    this.consecutiveSuccesses = 0;
    this.uptimeStart = null;
    this.totalUptimeMs = 0;
    this.totalDowntimeMs = 0;
    this.expectedIP = null;
    this.lastVerifiedIP = null;
    this.ipMismatchCount = 0;
    this._latencyHistory = [];
  }

  // ==================== Serialization ====================

  /**
   * Converts to a JSON-serializable object
   * @returns {Object}
   */
  toJSON() {
    return {
      accountId: this.accountId,
      proxyId: this.proxyId,
      status: this.status,
      initialIP: this.initialIP,
      startTime: this.startTime instanceof Date ? this.startTime.toISOString() : this.startTime,
      lastIPVerificationTime: this.lastIPVerificationTime instanceof Date ? this.lastIPVerificationTime.toISOString() : this.lastIPVerificationTime,
      lastCheckAt: this.lastCheckAt instanceof Date ? this.lastCheckAt.toISOString() : this.lastCheckAt,
      lastSuccessAt: this.lastSuccessAt instanceof Date ? this.lastSuccessAt.toISOString() : this.lastSuccessAt,
      lastFailureAt: this.lastFailureAt instanceof Date ? this.lastFailureAt.toISOString() : this.lastFailureAt,
      lastIPVerificationAt: this.lastIPVerificationAt instanceof Date ? this.lastIPVerificationAt.toISOString() : this.lastIPVerificationAt,
      currentLatency: this.currentLatency,
      averageLatency: this.averageLatency,
      minLatency: this.minLatency,
      maxLatency: this.maxLatency,
      p95Latency: this.p95Latency,
      totalChecks: this.totalChecks,
      successfulChecks: this.successfulChecks,
      failedChecks: this.failedChecks,
      consecutiveFailures: this.consecutiveFailures,
      consecutiveSuccesses: this.consecutiveSuccesses,
      uptimeStart: this.uptimeStart instanceof Date ? this.uptimeStart.toISOString() : this.uptimeStart,
      totalUptimeMs: this.totalUptimeMs,
      totalDowntimeMs: this.totalDowntimeMs,
      expectedIP: this.expectedIP,
      lastVerifiedIP: this.lastVerifiedIP,
      ipMismatchCount: this.ipMismatchCount,
      _latencyHistory: this._latencyHistory
    };
  }

  /**
   * Creates an instance from a JSON object
   * @param {Object} json - JSON representation
   * @returns {ProxyHealthStats}
   */
  static fromJSON(json) {
    if (!json || typeof json !== 'object') {
      throw new Error('Invalid JSON: expected an object');
    }
    return new ProxyHealthStats(json);
  }

  /**
   * Returns a human-readable string representation
   * @param {ProxyHealthStats} stats - ProxyHealthStats instance
   * @returns {string}
   */
  static prettyPrint(stats) {
    const successRate = `${stats.getSuccessRate()}%`;
    const uptimePercent = `${stats.getUptimePercentage()}%`;
    
    const lines = [
      '┌─────────────────────────────────────────────────────────────┐',
      '│                    PROXY HEALTH STATS                      │',
      '├─────────────────────────────────────────────────────────────┤',
      `│ Proxy ID:     ${(stats.proxyId || 'N/A').substring(0, 44).padEnd(44)} │`,
      `│ Status:       ${stats.status.padEnd(44)} │`,
      `│ Success Rate: ${successRate.padEnd(44)} │`,
      `│ Uptime:       ${uptimePercent.padEnd(44)} │`,
      '├─────────────────────────────────────────────────────────────┤',
      '│                       LATENCY                              │',
      '├─────────────────────────────────────────────────────────────┤',
      `│ Current:      ${(stats.currentLatency !== null ? stats.currentLatency + 'ms' : 'N/A').padEnd(44)} │`,
      `│ Average:      ${(stats.averageLatency !== null ? stats.averageLatency + 'ms' : 'N/A').padEnd(44)} │`,
      `│ Min:          ${(stats.minLatency !== null ? stats.minLatency + 'ms' : 'N/A').padEnd(44)} │`,
      `│ Max:          ${(stats.maxLatency !== null ? stats.maxLatency + 'ms' : 'N/A').padEnd(44)} │`,
      `│ P95:          ${(stats.p95Latency !== null ? stats.p95Latency + 'ms' : 'N/A').padEnd(44)} │`,
      '├─────────────────────────────────────────────────────────────┤',
      '│                    HEALTH CHECKS                           │',
      '├─────────────────────────────────────────────────────────────┤',
      `│ Total:        ${String(stats.totalChecks).padEnd(44)} │`,
      `│ Successful:   ${String(stats.successfulChecks).padEnd(44)} │`,
      `│ Failed:       ${String(stats.failedChecks).padEnd(44)} │`,
      `│ Consec Fail:  ${String(stats.consecutiveFailures).padEnd(44)} │`,
      '├─────────────────────────────────────────────────────────────┤',
      '│                   IP VERIFICATION                          │',
      '├─────────────────────────────────────────────────────────────┤',
      `│ Expected IP:  ${(stats.expectedIP || 'N/A').padEnd(44)} │`,
      `│ Verified IP:  ${(stats.lastVerifiedIP || 'N/A').padEnd(44)} │`,
      `│ Mismatches:   ${String(stats.ipMismatchCount).padEnd(44)} │`,
      '└─────────────────────────────────────────────────────────────┘'
    ];
    return lines.join('\n');
  }
}

// Export the class and enum
ProxyHealthStats.Status = HealthStatus;
module.exports = ProxyHealthStats;
