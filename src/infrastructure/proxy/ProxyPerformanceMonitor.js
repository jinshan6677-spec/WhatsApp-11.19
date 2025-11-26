'use strict';

/**
 * Warning Level
 * @readonly
 * @enum {string}
 */
const WarningLevel = {
  INFO: 'info',
  WARNING: 'warning',
  CRITICAL: 'critical'
};

/**
 * Default thresholds
 * @readonly
 */
const DefaultThresholds = {
  LATENCY_WARNING: 500,        // 500ms average latency warning
  LATENCY_CRITICAL: 1000,      // 1000ms average latency critical
  P95_LATENCY_WARNING: 800,    // 800ms P95 latency warning
  P95_LATENCY_CRITICAL: 1500,  // 1500ms P95 latency critical
  SUCCESS_RATE_WARNING: 0.9,   // 90% success rate warning
  SUCCESS_RATE_CRITICAL: 0.7,  // 70% success rate critical
  STABILITY_WARNING: 0.85,     // 85% stability warning
  STABILITY_CRITICAL: 0.7      // 70% stability critical
};

/**
 * ProxyPerformanceMonitor - Proxy Performance Monitoring
 * 
 * Monitors proxy performance metrics:
 * - Average latency
 * - P95 latency
 * - Success rate
 * - Connection stability
 * 
 * Provides threshold-based warnings and callbacks.
 * 
 * @class
 */
class ProxyPerformanceMonitor {
  /**
   * Creates a ProxyPerformanceMonitor instance
   * @param {Object} [options={}] - Configuration options
   * @param {Function} [options.logger] - Logger function
   * @param {Object} [options.eventBus] - Event bus for publishing events
   * @param {Object} [options.thresholds] - Custom thresholds
   * @param {number} [options.sampleSize=100] - Number of samples to keep
   */
  constructor(options = {}) {
    this.options = options;
    this.log = options.logger || this._createLogger();
    this.eventBus = options.eventBus || null;
    this.sampleSize = options.sampleSize || 100;
    
    // Thresholds
    this.thresholds = {
      ...DefaultThresholds,
      ...options.thresholds
    };
    
    // Track metrics per proxy: proxyId -> MetricsData
    this._metrics = new Map();
    
    // Warning callbacks
    this._warningCallbacks = [];
  }

  /**
   * Creates a default logger
   * @private
   * @returns {Function}
   */
  _createLogger() {
    return (level, message, ...args) => {
      const timestamp = new Date().toISOString();
      const prefix = `[${timestamp}] [ProxyPerformanceMonitor] [${level.toUpperCase()}]`;
      
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
   * Records a latency sample for a proxy
   * @param {string} proxyId - Proxy ID
   * @param {number} latency - Latency in ms
   * @param {boolean} [success=true] - Whether the request was successful
   */
  recordSample(proxyId, latency, success = true) {
    if (!proxyId) return;

    let metrics = this._metrics.get(proxyId);
    if (!metrics) {
      metrics = this._createMetricsData(proxyId);
      this._metrics.set(proxyId, metrics);
    }

    // Add latency sample
    metrics.latencySamples.push(latency);
    if (metrics.latencySamples.length > this.sampleSize) {
      metrics.latencySamples.shift();
    }

    // Track success/failure
    if (success) {
      metrics.successCount++;
    } else {
      metrics.failureCount++;
    }

    // Track connection stability
    metrics.connectionAttempts.push(success);
    if (metrics.connectionAttempts.length > this.sampleSize) {
      metrics.connectionAttempts.shift();
    }

    metrics.lastUpdatedAt = new Date();

    // Check thresholds and emit warnings
    this._checkThresholds(proxyId, metrics);
  }

  /**
   * Gets performance metrics for a proxy
   * @param {string} proxyId - Proxy ID
   * @returns {Object|null}
   */
  getPerformanceMetrics(proxyId) {
    const metrics = this._metrics.get(proxyId);
    if (!metrics) return null;

    const avgLatency = this._calculateAverage(metrics.latencySamples);
    const p95Latency = this._calculatePercentile(metrics.latencySamples, 95);
    const successRate = this._calculateSuccessRate(metrics);
    const stability = this._calculateStability(metrics);

    return {
      proxyId,
      averageLatency: avgLatency,
      p95Latency: p95Latency,
      minLatency: Math.min(...metrics.latencySamples) || 0,
      maxLatency: Math.max(...metrics.latencySamples) || 0,
      successRate,
      stability,
      totalRequests: metrics.successCount + metrics.failureCount,
      successCount: metrics.successCount,
      failureCount: metrics.failureCount,
      sampleCount: metrics.latencySamples.length,
      lastUpdatedAt: metrics.lastUpdatedAt,
      health: this._determineHealth(avgLatency, p95Latency, successRate, stability)
    };
  }

  /**
   * Sets custom thresholds
   * @param {Object} thresholds - Threshold values
   */
  setThresholds(thresholds) {
    this.thresholds = {
      ...this.thresholds,
      ...thresholds
    };
    this.log('info', 'Updated thresholds:', this.thresholds);
  }

  /**
   * Registers a callback for performance warnings
   * @param {Function} callback - Callback function(warning)
   * @returns {Function} Unsubscribe function
   */
  onPerformanceWarning(callback) {
    if (typeof callback !== 'function') {
      throw new Error('Callback must be a function');
    }

    this._warningCallbacks.push(callback);

    // Return unsubscribe function
    return () => {
      const index = this._warningCallbacks.indexOf(callback);
      if (index > -1) {
        this._warningCallbacks.splice(index, 1);
      }
    };
  }

  // ==================== Calculation Methods ====================

  /**
   * Calculates average of samples
   * @private
   * @param {number[]} samples - Sample array
   * @returns {number}
   */
  _calculateAverage(samples) {
    if (samples.length === 0) return 0;
    const sum = samples.reduce((a, b) => a + b, 0);
    return Math.round(sum / samples.length);
  }

  /**
   * Calculates percentile of samples
   * @private
   * @param {number[]} samples - Sample array
   * @param {number} percentile - Percentile (0-100)
   * @returns {number}
   */
  _calculatePercentile(samples, percentile) {
    if (samples.length === 0) return 0;
    
    const sorted = [...samples].sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  }

  /**
   * Calculates success rate
   * @private
   * @param {Object} metrics - Metrics data
   * @returns {number}
   */
  _calculateSuccessRate(metrics) {
    const total = metrics.successCount + metrics.failureCount;
    if (total === 0) return 1;
    return metrics.successCount / total;
  }

  /**
   * Calculates connection stability
   * @private
   * @param {Object} metrics - Metrics data
   * @returns {number}
   */
  _calculateStability(metrics) {
    const attempts = metrics.connectionAttempts;
    if (attempts.length === 0) return 1;
    
    const successCount = attempts.filter(s => s).length;
    return successCount / attempts.length;
  }

  /**
   * Determines overall health status
   * @private
   * @param {number} avgLatency - Average latency
   * @param {number} p95Latency - P95 latency
   * @param {number} successRate - Success rate
   * @param {number} stability - Stability
   * @returns {string}
   */
  _determineHealth(avgLatency, p95Latency, successRate, stability) {
    // Critical conditions
    if (avgLatency >= this.thresholds.LATENCY_CRITICAL ||
        p95Latency >= this.thresholds.P95_LATENCY_CRITICAL ||
        successRate <= this.thresholds.SUCCESS_RATE_CRITICAL ||
        stability <= this.thresholds.STABILITY_CRITICAL) {
      return 'critical';
    }

    // Warning conditions
    if (avgLatency >= this.thresholds.LATENCY_WARNING ||
        p95Latency >= this.thresholds.P95_LATENCY_WARNING ||
        successRate <= this.thresholds.SUCCESS_RATE_WARNING ||
        stability <= this.thresholds.STABILITY_WARNING) {
      return 'degraded';
    }

    return 'healthy';
  }

  // ==================== Threshold Checking ====================

  /**
   * Checks thresholds and emits warnings
   * @private
   * @param {string} proxyId - Proxy ID
   * @param {Object} metrics - Metrics data
   */
  _checkThresholds(proxyId, metrics) {
    const avgLatency = this._calculateAverage(metrics.latencySamples);
    const p95Latency = this._calculatePercentile(metrics.latencySamples, 95);
    const successRate = this._calculateSuccessRate(metrics);
    const stability = this._calculateStability(metrics);

    const warnings = [];

    // Check average latency
    if (avgLatency >= this.thresholds.LATENCY_CRITICAL) {
      warnings.push({
        type: 'latency',
        level: WarningLevel.CRITICAL,
        message: `Average latency critical: ${avgLatency}ms`,
        value: avgLatency,
        threshold: this.thresholds.LATENCY_CRITICAL
      });
    } else if (avgLatency >= this.thresholds.LATENCY_WARNING) {
      warnings.push({
        type: 'latency',
        level: WarningLevel.WARNING,
        message: `Average latency high: ${avgLatency}ms`,
        value: avgLatency,
        threshold: this.thresholds.LATENCY_WARNING
      });
    }

    // Check P95 latency
    if (p95Latency >= this.thresholds.P95_LATENCY_CRITICAL) {
      warnings.push({
        type: 'p95_latency',
        level: WarningLevel.CRITICAL,
        message: `P95 latency critical: ${p95Latency}ms`,
        value: p95Latency,
        threshold: this.thresholds.P95_LATENCY_CRITICAL
      });
    } else if (p95Latency >= this.thresholds.P95_LATENCY_WARNING) {
      warnings.push({
        type: 'p95_latency',
        level: WarningLevel.WARNING,
        message: `P95 latency high: ${p95Latency}ms`,
        value: p95Latency,
        threshold: this.thresholds.P95_LATENCY_WARNING
      });
    }

    // Check success rate
    if (successRate <= this.thresholds.SUCCESS_RATE_CRITICAL) {
      warnings.push({
        type: 'success_rate',
        level: WarningLevel.CRITICAL,
        message: `Success rate critical: ${(successRate * 100).toFixed(1)}%`,
        value: successRate,
        threshold: this.thresholds.SUCCESS_RATE_CRITICAL
      });
    } else if (successRate <= this.thresholds.SUCCESS_RATE_WARNING) {
      warnings.push({
        type: 'success_rate',
        level: WarningLevel.WARNING,
        message: `Success rate low: ${(successRate * 100).toFixed(1)}%`,
        value: successRate,
        threshold: this.thresholds.SUCCESS_RATE_WARNING
      });
    }

    // Check stability
    if (stability <= this.thresholds.STABILITY_CRITICAL) {
      warnings.push({
        type: 'stability',
        level: WarningLevel.CRITICAL,
        message: `Connection stability critical: ${(stability * 100).toFixed(1)}%`,
        value: stability,
        threshold: this.thresholds.STABILITY_CRITICAL
      });
    } else if (stability <= this.thresholds.STABILITY_WARNING) {
      warnings.push({
        type: 'stability',
        level: WarningLevel.WARNING,
        message: `Connection stability low: ${(stability * 100).toFixed(1)}%`,
        value: stability,
        threshold: this.thresholds.STABILITY_WARNING
      });
    }

    // Emit warnings
    for (const warning of warnings) {
      this._emitWarning(proxyId, warning);
    }
  }

  /**
   * Emits a performance warning
   * @private
   * @param {string} proxyId - Proxy ID
   * @param {Object} warning - Warning object
   */
  _emitWarning(proxyId, warning) {
    const fullWarning = {
      proxyId,
      ...warning,
      timestamp: new Date().toISOString()
    };

    // Call registered callbacks
    for (const callback of this._warningCallbacks) {
      try {
        callback(fullWarning);
      } catch (error) {
        this.log('error', `Warning callback error: ${error.message}`);
      }
    }

    // Emit event
    if (this.eventBus) {
      this.eventBus.publish('proxy:performance_warning', fullWarning);
    }

    // Log warning
    if (warning.level === WarningLevel.CRITICAL) {
      this.log('error', `[${proxyId}] ${warning.message}`);
    } else {
      this.log('warn', `[${proxyId}] ${warning.message}`);
    }
  }

  // ==================== Query Methods ====================

  /**
   * Gets all monitored proxies
   * @returns {string[]}
   */
  getMonitoredProxies() {
    return Array.from(this._metrics.keys());
  }

  /**
   * Gets metrics for all proxies
   * @returns {Object}
   */
  getAllMetrics() {
    const result = {};
    for (const proxyId of this._metrics.keys()) {
      result[proxyId] = this.getPerformanceMetrics(proxyId);
    }
    return result;
  }

  /**
   * Gets proxies with health issues
   * @returns {Array<Object>}
   */
  getUnhealthyProxies() {
    const unhealthy = [];
    for (const proxyId of this._metrics.keys()) {
      const metrics = this.getPerformanceMetrics(proxyId);
      if (metrics && metrics.health !== 'healthy') {
        unhealthy.push(metrics);
      }
    }
    return unhealthy;
  }

  /**
   * Resets metrics for a proxy
   * @param {string} proxyId - Proxy ID
   * @returns {boolean}
   */
  resetMetrics(proxyId) {
    if (!this._metrics.has(proxyId)) {
      return false;
    }
    this._metrics.set(proxyId, this._createMetricsData(proxyId));
    this.log('info', `Reset metrics for proxy ${proxyId}`);
    return true;
  }

  /**
   * Removes metrics for a proxy
   * @param {string} proxyId - Proxy ID
   * @returns {boolean}
   */
  removeMetrics(proxyId) {
    return this._metrics.delete(proxyId);
  }

  // ==================== Internal Methods ====================

  /**
   * Creates initial metrics data structure
   * @private
   * @param {string} proxyId - Proxy ID
   * @returns {Object}
   */
  _createMetricsData(proxyId) {
    return {
      proxyId,
      latencySamples: [],
      connectionAttempts: [],
      successCount: 0,
      failureCount: 0,
      createdAt: new Date(),
      lastUpdatedAt: new Date()
    };
  }

  // ==================== Lifecycle Methods ====================

  /**
   * Cleans up all resources
   */
  cleanup() {
    this.log('info', 'Cleaning up ProxyPerformanceMonitor...');
    this._metrics.clear();
    this._warningCallbacks = [];
    this.log('info', 'ProxyPerformanceMonitor cleanup complete');
  }

  /**
   * Alias for cleanup
   */
  destroy() {
    this.cleanup();
  }
}

// Export class and enums
ProxyPerformanceMonitor.WarningLevel = WarningLevel;
ProxyPerformanceMonitor.DefaultThresholds = DefaultThresholds;
module.exports = ProxyPerformanceMonitor;
