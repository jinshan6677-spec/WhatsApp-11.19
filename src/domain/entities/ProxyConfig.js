'use strict';

const crypto = require('crypto');

/**
 * Proxy Protocol Enum
 * @readonly
 * @enum {string}
 */
const ProxyProtocol = {
  HTTP: 'http',
  HTTPS: 'https',
  SOCKS5: 'socks5'
};

/**
 * Default security settings
 * @readonly
 */
const SecurityDefaults = {
  KILL_SWITCH_ENABLED: true,
  VERIFY_IP_BEFORE_CONNECT: true,
  HEALTH_CHECK_INTERVAL: 30000, // 30 seconds
  MAX_CONSECUTIVE_FAILURES: 3
};

/**
 * Generate a UUID v4
 * @returns {string}
 */
function uuidv4() {
  return crypto.randomUUID();
}

/**
 * ProxyConfig Domain Entity
 * 
 * Represents a proxy server configuration with validation, security settings,
 * and connection statistics.
 */
class ProxyConfig {
  /**
   * Creates a ProxyConfig instance
   * @param {Object} config - Proxy configuration
   */
  constructor(config = {}) {
    // ==================== Core Properties ====================
    this.id = config.id || uuidv4();
    this.enabled = config.enabled !== undefined ? config.enabled : true;
    this.protocol = config.protocol || ProxyProtocol.SOCKS5;
    this.host = config.host || '';
    this.port = config.port || 0;
    this.username = config.username || null;
    this.password = config.password || null;
    this.bypass = config.bypass || null;
    this.name = config.name || this._generateDefaultName();
    this.createdAt = config.createdAt ? new Date(config.createdAt) : new Date();
    this.lastUsedAt = config.lastUsedAt ? new Date(config.lastUsedAt) : null;

    // ==================== Security Properties ====================
    this.killSwitchEnabled = config.killSwitchEnabled !== undefined 
      ? config.killSwitchEnabled 
      : SecurityDefaults.KILL_SWITCH_ENABLED;
    this.verifyIPBeforeConnect = config.verifyIPBeforeConnect !== undefined 
      ? config.verifyIPBeforeConnect 
      : SecurityDefaults.VERIFY_IP_BEFORE_CONNECT;
    this.healthCheckInterval = config.healthCheckInterval !== undefined 
      ? config.healthCheckInterval 
      : SecurityDefaults.HEALTH_CHECK_INTERVAL;
    this.maxConsecutiveFailures = config.maxConsecutiveFailures !== undefined 
      ? config.maxConsecutiveFailures 
      : SecurityDefaults.MAX_CONSECUTIVE_FAILURES;

    // ==================== Statistics Properties ====================
    this.connectionCount = config.connectionCount || 0;
    this.successCount = config.successCount || 0;
    this.failureCount = config.failureCount || 0;
    this.lastConnectedAt = config.lastConnectedAt ? new Date(config.lastConnectedAt) : null;
    this.lastVerifiedIP = config.lastVerifiedIP || null;
  }

  /**
   * Generates a default name based on protocol, host and port
   * @private
   * @returns {string}
   */
  _generateDefaultName() {
    const protocol = (this.protocol || 'socks5').toUpperCase();
    const host = this.host || 'unknown';
    const port = this.port || 0;
    return `${protocol} - ${host}:${port}`;
  }

  // ==================== Domain Methods ====================

  /**
   * Gets the full proxy URL
   * @returns {string}
   */
  getUrl() {
    let url = `${this.protocol}://`;
    
    if (this.username && this.password) {
      url += `${encodeURIComponent(this.username)}:${encodeURIComponent(this.password)}@`;
    } else if (this.username) {
      url += `${encodeURIComponent(this.username)}@`;
    }
    
    url += `${this.host}:${this.port}`;
    return url;
  }

  /**
   * Enables the proxy
   */
  enable() {
    this.enabled = true;
  }

  /**
   * Disables the proxy
   */
  disable() {
    this.enabled = false;
  }

  /**
   * Updates the last used timestamp
   */
  updateLastUsed() {
    this.lastUsedAt = new Date();
  }

  /**
   * Checks if authentication is configured
   * @returns {boolean}
   */
  hasAuthentication() {
    return !!(this.username && this.password);
  }

  // ==================== Security Methods ====================

  /**
   * Enables the kill-switch
   */
  enableKillSwitch() {
    this.killSwitchEnabled = true;
  }

  /**
   * Disables the kill-switch
   */
  disableKillSwitch() {
    this.killSwitchEnabled = false;
  }

  /**
   * Checks if kill-switch is enabled
   * @returns {boolean}
   */
  isKillSwitchEnabled() {
    return this.killSwitchEnabled;
  }

  /**
   * Sets the health check interval
   * @param {number} interval - Interval in milliseconds
   */
  setHealthCheckInterval(interval) {
    if (typeof interval === 'number' && interval >= 1000) {
      this.healthCheckInterval = interval;
    }
  }

  /**
   * Sets the maximum consecutive failures before triggering kill-switch
   * @param {number} max - Maximum failures
   */
  setMaxConsecutiveFailures(max) {
    if (typeof max === 'number' && max >= 1) {
      this.maxConsecutiveFailures = max;
    }
  }

  // ==================== Statistics Methods ====================

  /**
   * Records a successful connection
   * @param {string} [verifiedIP] - The verified exit IP address
   */
  recordSuccess(verifiedIP) {
    this.connectionCount++;
    this.successCount++;
    this.lastConnectedAt = new Date();
    if (verifiedIP) {
      this.lastVerifiedIP = verifiedIP;
    }
  }

  /**
   * Records a failed connection
   */
  recordFailure() {
    this.connectionCount++;
    this.failureCount++;
  }

  /**
   * Gets the success rate as a percentage
   * @returns {number} Success rate (0-100)
   */
  getSuccessRate() {
    if (this.connectionCount === 0) {
      return 0;
    }
    return Math.round((this.successCount / this.connectionCount) * 100);
  }

  /**
   * Resets all statistics
   */
  resetStatistics() {
    this.connectionCount = 0;
    this.successCount = 0;
    this.failureCount = 0;
    this.lastConnectedAt = null;
    this.lastVerifiedIP = null;
  }

  // ==================== Validation ====================

  /**
   * Validates the proxy configuration
   * @returns {{valid: boolean, errors: Array<{field: string, reason: string, value: any}>}}
   */
  validate() {
    const errors = [];

    // Validate ID
    if (!this.id || typeof this.id !== 'string' || this.id.trim().length === 0) {
      errors.push({ field: 'id', reason: 'Proxy ID is required and must be a non-empty string', value: this.id });
    }

    // Validate enabled
    if (typeof this.enabled !== 'boolean') {
      errors.push({ field: 'enabled', reason: 'enabled must be a boolean', value: this.enabled });
    }

    // Validate protocol
    if (!Object.values(ProxyProtocol).includes(this.protocol)) {
      errors.push({ field: 'protocol', reason: `Protocol must be one of: ${Object.values(ProxyProtocol).join(', ')}`, value: this.protocol });
    }

    // Validate host
    if (!this.host || typeof this.host !== 'string' || this.host.trim().length === 0) {
      errors.push({ field: 'host', reason: 'Host is required and must be a non-empty string', value: this.host });
    } else if (this.host.length > 255) {
      errors.push({ field: 'host', reason: 'Host must not exceed 255 characters', value: this.host });
    }

    // Validate port
    if (typeof this.port !== 'number' || !Number.isInteger(this.port) || this.port < 1 || this.port > 65535) {
      errors.push({ field: 'port', reason: 'Port must be an integer between 1 and 65535', value: this.port });
    }

    // Validate username (optional)
    if (this.username !== null && this.username !== undefined) {
      if (typeof this.username !== 'string') {
        errors.push({ field: 'username', reason: 'Username must be a string', value: this.username });
      } else if (this.username.length > 255) {
        errors.push({ field: 'username', reason: 'Username must not exceed 255 characters', value: this.username });
      }
    }

    // Validate password (optional)
    if (this.password !== null && this.password !== undefined) {
      if (typeof this.password !== 'string') {
        errors.push({ field: 'password', reason: 'Password must be a string', value: this.password });
      }
    }

    // Validate bypass (optional)
    if (this.bypass !== null && this.bypass !== undefined) {
      if (typeof this.bypass !== 'string') {
        errors.push({ field: 'bypass', reason: 'Bypass must be a string', value: this.bypass });
      }
    }

    // Validate name
    if (!this.name || typeof this.name !== 'string' || this.name.trim().length === 0) {
      errors.push({ field: 'name', reason: 'Name is required and must be a non-empty string', value: this.name });
    }

    // Validate createdAt
    if (!(this.createdAt instanceof Date) || isNaN(this.createdAt.getTime())) {
      errors.push({ field: 'createdAt', reason: 'createdAt must be a valid Date', value: this.createdAt });
    }

    // ==================== Security Property Validation ====================

    // Validate killSwitchEnabled
    if (typeof this.killSwitchEnabled !== 'boolean') {
      errors.push({ field: 'killSwitchEnabled', reason: 'killSwitchEnabled must be a boolean', value: this.killSwitchEnabled });
    }

    // Validate verifyIPBeforeConnect
    if (typeof this.verifyIPBeforeConnect !== 'boolean') {
      errors.push({ field: 'verifyIPBeforeConnect', reason: 'verifyIPBeforeConnect must be a boolean', value: this.verifyIPBeforeConnect });
    }

    // Validate healthCheckInterval
    if (typeof this.healthCheckInterval !== 'number' || !Number.isInteger(this.healthCheckInterval) || this.healthCheckInterval < 1000) {
      errors.push({ field: 'healthCheckInterval', reason: 'healthCheckInterval must be an integer >= 1000 (milliseconds)', value: this.healthCheckInterval });
    }

    // Validate maxConsecutiveFailures
    if (typeof this.maxConsecutiveFailures !== 'number' || !Number.isInteger(this.maxConsecutiveFailures) || this.maxConsecutiveFailures < 1) {
      errors.push({ field: 'maxConsecutiveFailures', reason: 'maxConsecutiveFailures must be an integer >= 1', value: this.maxConsecutiveFailures });
    }

    // ==================== Statistics Property Validation ====================

    // Validate connectionCount
    if (typeof this.connectionCount !== 'number' || !Number.isInteger(this.connectionCount) || this.connectionCount < 0) {
      errors.push({ field: 'connectionCount', reason: 'connectionCount must be a non-negative integer', value: this.connectionCount });
    }

    // Validate successCount
    if (typeof this.successCount !== 'number' || !Number.isInteger(this.successCount) || this.successCount < 0) {
      errors.push({ field: 'successCount', reason: 'successCount must be a non-negative integer', value: this.successCount });
    }

    // Validate failureCount
    if (typeof this.failureCount !== 'number' || !Number.isInteger(this.failureCount) || this.failureCount < 0) {
      errors.push({ field: 'failureCount', reason: 'failureCount must be a non-negative integer', value: this.failureCount });
    }

    // Validate lastConnectedAt (optional)
    if (this.lastConnectedAt !== null && (!(this.lastConnectedAt instanceof Date) || isNaN(this.lastConnectedAt.getTime()))) {
      errors.push({ field: 'lastConnectedAt', reason: 'lastConnectedAt must be a valid Date or null', value: this.lastConnectedAt });
    }

    // Validate lastVerifiedIP (optional)
    if (this.lastVerifiedIP !== null && typeof this.lastVerifiedIP !== 'string') {
      errors.push({ field: 'lastVerifiedIP', reason: 'lastVerifiedIP must be a string or null', value: this.lastVerifiedIP });
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  // ==================== Serialization ====================

  /**
   * Converts the proxy config to a JSON-serializable object
   * @returns {Object}
   */
  toJSON() {
    return {
      // Core properties
      id: this.id,
      enabled: this.enabled,
      protocol: this.protocol,
      host: this.host,
      port: this.port,
      username: this.username,
      password: this.password,
      bypass: this.bypass,
      name: this.name,
      createdAt: this.createdAt instanceof Date ? this.createdAt.toISOString() : this.createdAt,
      lastUsedAt: this.lastUsedAt instanceof Date ? this.lastUsedAt.toISOString() : this.lastUsedAt,
      // Security properties
      killSwitchEnabled: this.killSwitchEnabled,
      verifyIPBeforeConnect: this.verifyIPBeforeConnect,
      healthCheckInterval: this.healthCheckInterval,
      maxConsecutiveFailures: this.maxConsecutiveFailures,
      // Statistics properties
      connectionCount: this.connectionCount,
      successCount: this.successCount,
      failureCount: this.failureCount,
      lastConnectedAt: this.lastConnectedAt instanceof Date ? this.lastConnectedAt.toISOString() : this.lastConnectedAt,
      lastVerifiedIP: this.lastVerifiedIP
    };
  }

  /**
   * Creates a ProxyConfig instance from a JSON object
   * @param {Object} json - JSON representation
   * @returns {ProxyConfig}
   */
  static fromJSON(json) {
    if (!json || typeof json !== 'object') {
      throw new Error('Invalid JSON: expected an object');
    }
    return new ProxyConfig({
      // Core properties
      id: json.id,
      enabled: json.enabled,
      protocol: json.protocol,
      host: json.host,
      port: json.port,
      username: json.username,
      password: json.password,
      bypass: json.bypass,
      name: json.name,
      createdAt: json.createdAt,
      lastUsedAt: json.lastUsedAt,
      // Security properties
      killSwitchEnabled: json.killSwitchEnabled,
      verifyIPBeforeConnect: json.verifyIPBeforeConnect,
      healthCheckInterval: json.healthCheckInterval,
      maxConsecutiveFailures: json.maxConsecutiveFailures,
      // Statistics properties
      connectionCount: json.connectionCount,
      successCount: json.successCount,
      failureCount: json.failureCount,
      lastConnectedAt: json.lastConnectedAt,
      lastVerifiedIP: json.lastVerifiedIP
    });
  }

  /**
   * Returns a human-readable string representation for debugging
   * @param {ProxyConfig} config - ProxyConfig instance
   * @returns {string}
   */
  static prettyPrint(config) {
    const maskedPassword = config.password ? '********' : 'None';
    const successRate = config.connectionCount > 0 
      ? `${config.getSuccessRate()}%` 
      : 'N/A';
    const lines = [
      '┌─────────────────────────────────────────────────────────────┐',
      '│                      PROXY CONFIG                          │',
      '├─────────────────────────────────────────────────────────────┤',
      `│ ID:           ${(config.id || 'N/A').padEnd(44)} │`,
      `│ Name:         ${(config.name || 'N/A').substring(0, 44).padEnd(44)} │`,
      `│ Enabled:      ${String(config.enabled).padEnd(44)} │`,
      `│ Protocol:     ${(config.protocol || 'N/A').padEnd(44)} │`,
      `│ Host:         ${(config.host || 'N/A').substring(0, 44).padEnd(44)} │`,
      `│ Port:         ${String(config.port).padEnd(44)} │`,
      `│ Username:     ${(config.username || 'None').substring(0, 44).padEnd(44)} │`,
      `│ Password:     ${maskedPassword.padEnd(44)} │`,
      `│ Bypass:       ${(config.bypass || 'None').substring(0, 44).padEnd(44)} │`,
      `│ Created:      ${(config.createdAt instanceof Date ? config.createdAt.toISOString() : String(config.createdAt)).substring(0, 44).padEnd(44)} │`,
      `│ Last Used:    ${(config.lastUsedAt instanceof Date ? config.lastUsedAt.toISOString() : String(config.lastUsedAt || 'Never')).substring(0, 44).padEnd(44)} │`,
      '├─────────────────────────────────────────────────────────────┤',
      '│                    SECURITY SETTINGS                       │',
      '├─────────────────────────────────────────────────────────────┤',
      `│ Kill-Switch:  ${String(config.killSwitchEnabled).padEnd(44)} │`,
      `│ Verify IP:    ${String(config.verifyIPBeforeConnect).padEnd(44)} │`,
      `│ Health Check: ${(config.healthCheckInterval + 'ms').padEnd(44)} │`,
      `│ Max Failures: ${String(config.maxConsecutiveFailures).padEnd(44)} │`,
      '├─────────────────────────────────────────────────────────────┤',
      '│                      STATISTICS                            │',
      '├─────────────────────────────────────────────────────────────┤',
      `│ Connections:  ${String(config.connectionCount).padEnd(44)} │`,
      `│ Successes:    ${String(config.successCount).padEnd(44)} │`,
      `│ Failures:     ${String(config.failureCount).padEnd(44)} │`,
      `│ Success Rate: ${successRate.padEnd(44)} │`,
      `│ Last Connect: ${(config.lastConnectedAt instanceof Date ? config.lastConnectedAt.toISOString() : String(config.lastConnectedAt || 'Never')).substring(0, 44).padEnd(44)} │`,
      `│ Verified IP:  ${(config.lastVerifiedIP || 'None').substring(0, 44).padEnd(44)} │`,
      '└─────────────────────────────────────────────────────────────┘'
    ];
    return lines.join('\n');
  }
}

// Export the class and enums
ProxyConfig.Protocol = ProxyProtocol;
ProxyConfig.SecurityDefaults = SecurityDefaults;
module.exports = ProxyConfig;
