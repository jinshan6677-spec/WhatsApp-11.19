'use strict';

const ProxyConfig = require('../../domain/entities/ProxyConfig');
const ProxyHealthStats = require('../../domain/entities/ProxyHealthStats');
const ProxyPreChecker = require('./ProxyPreChecker');
const IPLeakDetector = require('./IPLeakDetector');
const KillSwitch = require('./KillSwitch');

/**
 * Default configuration for health monitoring
 * @readonly
 */
const HealthMonitorDefaults = {
  HEALTH_CHECK_INTERVAL: 30000,    // 30 seconds
  IP_VERIFICATION_INTERVAL: 300000, // 5 minutes
  LATENCY_THRESHOLD: 500,          // 500ms warning threshold
  FAILURE_THRESHOLD: 3,            // 3 consecutive failures trigger Kill-Switch
  CHECK_TIMEOUT: 5000              // 5 seconds per check
};

/**
 * Health check status
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
 * ProxyHealthMonitor - Real-time Proxy Health Monitoring
 * 
 * Provides continuous health monitoring for proxy connections including:
 * - Periodic connectivity checks
 * - Latency monitoring
 * - IP verification (to detect IP changes)
 * - Automatic Kill-Switch triggering on failures
 * 
 * Key features:
 * - Silent failure handling (no popup alerts)
 * - Automatic reconnection triggering
 * - Detailed health statistics
 * 
 * @class
 */
class ProxyHealthMonitor {
  /**
   * Creates a ProxyHealthMonitor instance
   * @param {Object} [options={}] - Configuration options
   * @param {Function} [options.logger] - Logger function
   * @param {Object} [options.eventBus] - Event bus for publishing events
   * @param {Object} [options.killSwitch] - KillSwitch instance
   * @param {Object} [options.preChecker] - ProxyPreChecker instance
   * @param {Object} [options.ipLeakDetector] - IPLeakDetector instance
   */
  constructor(options = {}) {
    this.options = options;
    this.log = options.logger || this._createLogger();
    this.eventBus = options.eventBus || null;

    // Dependencies
    this.killSwitch = options.killSwitch || null;
    this.preChecker = options.preChecker || new ProxyPreChecker({ logger: this.log });
    this.ipLeakDetector = options.ipLeakDetector || new IPLeakDetector({ 
      logger: this.log,
      eventBus: this.eventBus 
    });
    
    // Configuration
    this.healthCheckInterval = options.healthCheckInterval || HealthMonitorDefaults.HEALTH_CHECK_INTERVAL;
    this.ipVerificationInterval = options.ipVerificationInterval || HealthMonitorDefaults.IP_VERIFICATION_INTERVAL;
    this.latencyThreshold = options.latencyThreshold || HealthMonitorDefaults.LATENCY_THRESHOLD;
    this.failureThreshold = options.failureThreshold || HealthMonitorDefaults.FAILURE_THRESHOLD;
    this.checkTimeout = options.checkTimeout || HealthMonitorDefaults.CHECK_TIMEOUT;
    
    // State tracking per account
    this._monitors = new Map();  // accountId -> MonitorState
    this._stats = new Map();     // accountId -> ProxyHealthStats
  }

  /**
   * Creates a default logger
   * @private
   * @returns {Function}
   */
  _createLogger() {
    return (level, message, ...args) => {
      const timestamp = new Date().toISOString();
      const prefix = `[${timestamp}] [ProxyHealthMonitor] [${level.toUpperCase()}]`;
      
      if (level === 'error') {
        console.error(prefix, message, ...args);
      } else if (level === 'warn') {
        console.warn(prefix, message, ...args);
      } else {
        console.log(prefix, message, ...args);
      }
    };
  }

  // ==================== Core Monitoring Methods ====================

  /**
   * Starts health monitoring for an account
   * 
   * @param {string} accountId - Account ID
   * @param {ProxyConfig|Object} config - Proxy configuration
   * @param {string} [initialIP] - Initial verified IP (from pre-check)
   * @returns {boolean} Whether monitoring started successfully
   */
  startMonitoring(accountId, config, initialIP = null) {
    if (!accountId || !config) {
      this.log('error', 'Cannot start monitoring: accountId and config required');
      return false;
    }

    // Stop existing monitoring if any
    if (this._monitors.has(accountId)) {
      this.stopMonitoring(accountId);
    }

    const proxyConfig = config instanceof ProxyConfig ? config : new ProxyConfig(config);
    
    this.log('info', `Starting health monitoring for account ${accountId}`);

    // Initialize stats
    const stats = new ProxyHealthStats({
      accountId,
      proxyId: proxyConfig.id,
      initialIP: initialIP || null,
      startTime: new Date()
    });
    this._stats.set(accountId, stats);

    // Set expected IP for leak detection
    if (initialIP) {
      this.ipLeakDetector.setExpectedIP(accountId, initialIP);
    }

    // Create monitor state
    const monitorState = {
      accountId,
      config: proxyConfig,
      initialIP,
      consecutiveFailures: 0,
      lastCheckTime: null,
      lastIPVerificationTime: null,
      healthCheckTimer: null,
      ipVerificationTimer: null,
      isRunning: true
    };

    // Start health check timer
    monitorState.healthCheckTimer = setInterval(
      () => this._performHealthCheck(accountId),
      this.healthCheckInterval
    );

    // Start IP verification timer (less frequent)
    monitorState.ipVerificationTimer = setInterval(
      () => this._performIPVerification(accountId),
      this.ipVerificationInterval
    );

    this._monitors.set(accountId, monitorState);

    // Perform initial health check
    this._performHealthCheck(accountId);

    return true;
  }

  /**
   * Stops health monitoring for an account
   * 
   * @param {string} accountId - Account ID
   * @returns {boolean} Whether monitoring was stopped
   */
  stopMonitoring(accountId) {
    const monitor = this._monitors.get(accountId);
    if (!monitor) {
      return false;
    }

    this.log('info', `Stopping health monitoring for account ${accountId}`);

    // Clear timers
    if (monitor.healthCheckTimer) {
      clearInterval(monitor.healthCheckTimer);
    }
    if (monitor.ipVerificationTimer) {
      clearInterval(monitor.ipVerificationTimer);
    }

    monitor.isRunning = false;
    this._monitors.delete(accountId);
    
    // Clear expected IP
    this.ipLeakDetector.clearExpectedIP(accountId);

    return true;
  }


  /**
   * Performs a manual health check for an account
   * 
   * @param {string} accountId - Account ID
   * @returns {Promise<{healthy: boolean, latency?: number, error?: string}>}
   */
  async checkHealth(accountId) {
    const monitor = this._monitors.get(accountId);
    if (!monitor) {
      return {
        healthy: false,
        error: 'Account not being monitored'
      };
    }

    return this._performHealthCheck(accountId);
  }

  /**
   * Gets health statistics for an account
   * 
   * @param {string} accountId - Account ID
   * @returns {ProxyHealthStats|null}
   */
  getStats(accountId) {
    return this._stats.get(accountId) || null;
  }

  /**
   * Gets the current health status for an account
   * 
   * @param {string} accountId - Account ID
   * @returns {{status: string, details: Object}}
   */
  getHealthStatus(accountId) {
    const monitor = this._monitors.get(accountId);
    const stats = this._stats.get(accountId);

    if (!monitor || !stats) {
      return {
        status: HealthStatus.UNKNOWN,
        details: { error: 'Account not being monitored' }
      };
    }

    // Determine status based on consecutive failures and latency
    let status = HealthStatus.HEALTHY;
    
    if (monitor.consecutiveFailures >= this.failureThreshold) {
      status = HealthStatus.UNHEALTHY;
    } else if (monitor.consecutiveFailures > 0 || stats.averageLatency > this.latencyThreshold) {
      status = HealthStatus.DEGRADED;
    }

    return {
      status,
      details: {
        consecutiveFailures: monitor.consecutiveFailures,
        lastCheckTime: monitor.lastCheckTime,
        lastIPVerificationTime: monitor.lastIPVerificationTime,
        uptime: stats.getUptime(),
        averageLatency: stats.averageLatency,
        successRate: stats.getSuccessRate(),
        totalChecks: stats.totalChecks,
        failedChecks: stats.failedChecks
      }
    };
  }

  /**
   * Verifies the exit IP periodically
   * Called by the IP verification timer
   * 
   * @param {string} accountId - Account ID
   * @returns {Promise<{verified: boolean, ip?: string, error?: string}>}
   */
  async verifyIPPeriodically(accountId) {
    return this._performIPVerification(accountId);
  }

  // ==================== Internal Methods ====================

  /**
   * Performs a health check
   * @private
   * @param {string} accountId - Account ID
   * @returns {Promise<{healthy: boolean, latency?: number, error?: string}>}
   */
  async _performHealthCheck(accountId) {
    const monitor = this._monitors.get(accountId);
    const stats = this._stats.get(accountId);

    if (!monitor || !monitor.isRunning) {
      return { healthy: false, error: 'Monitor not running' };
    }

    this.log('debug', `Performing health check for ${accountId}`);

    try {
      const result = await this.preChecker.testConnectivity(monitor.config);
      monitor.lastCheckTime = new Date();

      if (result.success) {
        // Success - reset failure counter
        monitor.consecutiveFailures = 0;
        
        // Update stats
        if (stats) {
          stats.recordSuccess(result.latency);
        }

        // Log high latency warning (but don't alert)
        if (result.latency > this.latencyThreshold) {
          this.log('warn', `High latency detected for ${accountId}: ${result.latency}ms`);
        }

        return {
          healthy: true,
          latency: result.latency
        };

      } else {
        // Failure - increment counter
        monitor.consecutiveFailures++;
        
        // Update stats
        if (stats) {
          stats.recordFailure(result.error);
        }

        this.log('warn', `Health check failed for ${accountId} (${monitor.consecutiveFailures}/${this.failureThreshold}): ${result.error}`);

        // Check if we need to trigger Kill-Switch
        if (monitor.consecutiveFailures >= this.failureThreshold) {
          await this._handleConsecutiveFailures(accountId, result.error);
        }

        return {
          healthy: false,
          error: result.error,
          consecutiveFailures: monitor.consecutiveFailures
        };
      }

    } catch (error) {
      monitor.consecutiveFailures++;
      
      if (stats) {
        stats.recordFailure(error.message);
      }

      this.log('error', `Health check error for ${accountId}: ${error.message}`);

      if (monitor.consecutiveFailures >= this.failureThreshold) {
        await this._handleConsecutiveFailures(accountId, error.message);
      }

      return {
        healthy: false,
        error: error.message,
        consecutiveFailures: monitor.consecutiveFailures
      };
    }
  }


  /**
   * Performs IP verification
   * @private
   * @param {string} accountId - Account ID
   * @returns {Promise<{verified: boolean, ip?: string, error?: string}>}
   */
  async _performIPVerification(accountId) {
    const monitor = this._monitors.get(accountId);
    const stats = this._stats.get(accountId);

    if (!monitor || !monitor.isRunning) {
      return { verified: false, error: 'Monitor not running' };
    }

    // Skip if no initial IP to compare against
    if (!monitor.initialIP) {
      this.log('debug', `Skipping IP verification for ${accountId}: no initial IP`);
      return { verified: true, skipped: true };
    }

    this.log('debug', `Performing IP verification for ${accountId}`);

    try {
      const result = await this.ipLeakDetector.verifyExitIP(monitor.initialIP, monitor.config);
      monitor.lastIPVerificationTime = new Date();

      if (result.success && result.match) {
        // IP matches - all good
        if (stats) {
          stats.lastVerifiedIP = result.detectedIP;
          stats.lastIPVerificationTime = new Date();
        }

        this.log('info', `IP verification passed for ${accountId}: ${result.detectedIP}`);

        return {
          verified: true,
          ip: result.detectedIP
        };

      } else if (result.success && !result.match) {
        // IP mismatch - potential leak!
        this.log('error', `IP CHANGE DETECTED for ${accountId}! Expected: ${monitor.initialIP}, Got: ${result.detectedIP}`);

        // Trigger Kill-Switch immediately
        await this._handleIPChange(accountId, monitor.initialIP, result.detectedIP);

        return {
          verified: false,
          expectedIP: monitor.initialIP,
          actualIP: result.detectedIP,
          error: 'IP mismatch detected'
        };

      } else {
        // Verification failed (couldn't get IP)
        this.log('warn', `IP verification failed for ${accountId}: ${result.error}`);

        return {
          verified: false,
          error: result.error
        };
      }

    } catch (error) {
      this.log('error', `IP verification error for ${accountId}: ${error.message}`);

      return {
        verified: false,
        error: error.message
      };
    }
  }

  /**
   * Handles consecutive health check failures
   * @private
   * @param {string} accountId - Account ID
   * @param {string} reason - Failure reason
   */
  async _handleConsecutiveFailures(accountId, reason) {
    this.log('error', `Consecutive failures threshold reached for ${accountId}. Triggering Kill-Switch.`);

    // Trigger Kill-Switch (silent - no popup)
    if (this.killSwitch) {
      await this.killSwitch.trigger(accountId, `Health check failures: ${reason}`);
    }

    // Emit event for reconnection manager to handle
    if (this.eventBus) {
      await this.eventBus.publish('proxy:health-failure', {
        accountId,
        reason,
        consecutiveFailures: this.failureThreshold,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Handles IP change detection
   * @private
   * @param {string} accountId - Account ID
   * @param {string} expectedIP - Expected IP
   * @param {string} actualIP - Actual detected IP
   */
  async _handleIPChange(accountId, expectedIP, actualIP) {
    this.log('error', `IP change detected for ${accountId}. Triggering Kill-Switch immediately.`);

    // Trigger Kill-Switch immediately
    if (this.killSwitch) {
      await this.killSwitch.trigger(accountId, `IP changed from ${expectedIP} to ${actualIP}`);
    }

    // Emit IP leak event
    if (this.eventBus) {
      await this.eventBus.publish('proxy:ip-change-detected', {
        accountId,
        expectedIP,
        actualIP,
        timestamp: new Date().toISOString()
      });
    }
  }

  // ==================== Query Methods ====================

  /**
   * Gets all monitored accounts
   * @returns {string[]}
   */
  getMonitoredAccounts() {
    return Array.from(this._monitors.keys());
  }

  /**
   * Checks if an account is being monitored
   * @param {string} accountId - Account ID
   * @returns {boolean}
   */
  isMonitoring(accountId) {
    const monitor = this._monitors.get(accountId);
    return monitor ? monitor.isRunning : false;
  }

  /**
   * Gets all health stats
   * @returns {Object}
   */
  getAllStats() {
    const result = {};
    for (const [accountId, stats] of this._stats) {
      result[accountId] = stats.toJSON();
    }
    return result;
  }

  /**
   * Resets consecutive failure counter for an account
   * Called after successful reconnection
   * @param {string} accountId - Account ID
   */
  resetFailureCounter(accountId) {
    const monitor = this._monitors.get(accountId);
    if (monitor) {
      monitor.consecutiveFailures = 0;
      this.log('info', `Reset failure counter for ${accountId}`);
    }
  }

  /**
   * Updates the initial IP for an account
   * Called after successful reconnection with new IP
   * @param {string} accountId - Account ID
   * @param {string} newIP - New verified IP
   */
  updateInitialIP(accountId, newIP) {
    const monitor = this._monitors.get(accountId);
    const stats = this._stats.get(accountId);
    
    if (monitor) {
      monitor.initialIP = newIP;
      this.ipLeakDetector.setExpectedIP(accountId, newIP);
      this.log('info', `Updated initial IP for ${accountId}: ${newIP}`);
    }
    
    if (stats) {
      stats.initialIP = newIP;
      stats.lastVerifiedIP = newIP;
    }
  }

  /**
   * Stops all monitoring
   */
  stopAll() {
    this.log('info', 'Stopping all health monitoring');
    
    for (const accountId of this._monitors.keys()) {
      this.stopMonitoring(accountId);
    }
  }

  /**
   * Destroys the monitor and cleans up resources
   */
  destroy() {
    this.stopAll();
    this._stats.clear();
  }
}

// Export class and constants
ProxyHealthMonitor.Defaults = HealthMonitorDefaults;
ProxyHealthMonitor.HealthStatus = HealthStatus;
module.exports = ProxyHealthMonitor;
