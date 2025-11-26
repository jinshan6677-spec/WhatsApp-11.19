'use strict';

const AppError = require('../../core/errors/AppError');

/**
 * Proxy Error Codes
 * @readonly
 * @enum {string}
 */
const ProxyErrorCode = {
  // Connection errors
  CONNECTION_FAILED: 'PROXY_CONNECTION_FAILED',
  CONNECTION_TIMEOUT: 'PROXY_CONNECTION_TIMEOUT',
  CONNECTION_REFUSED: 'PROXY_CONNECTION_REFUSED',
  CONNECTION_RESET: 'PROXY_CONNECTION_RESET',
  
  // Authentication errors
  AUTH_FAILED: 'PROXY_AUTH_FAILED',
  AUTH_REQUIRED: 'PROXY_AUTH_REQUIRED',
  AUTH_EXPIRED: 'PROXY_AUTH_EXPIRED',
  
  // Configuration errors
  INVALID_CONFIG: 'PROXY_INVALID_CONFIG',
  INVALID_PROTOCOL: 'PROXY_INVALID_PROTOCOL',
  INVALID_HOST: 'PROXY_INVALID_HOST',
  INVALID_PORT: 'PROXY_INVALID_PORT',
  
  // Security errors
  IP_LEAK_DETECTED: 'PROXY_IP_LEAK_DETECTED',
  IP_VERIFICATION_FAILED: 'PROXY_IP_VERIFICATION_FAILED',
  IP_MISMATCH: 'PROXY_IP_MISMATCH',
  WEBRTC_LEAK: 'PROXY_WEBRTC_LEAK',
  DNS_LEAK: 'PROXY_DNS_LEAK',
  
  // Kill-switch errors
  KILL_SWITCH_ACTIVATED: 'PROXY_KILL_SWITCH_ACTIVATED',
  KILL_SWITCH_BLOCKED: 'PROXY_KILL_SWITCH_BLOCKED',
  
  // Health check errors
  HEALTH_CHECK_FAILED: 'PROXY_HEALTH_CHECK_FAILED',
  CONSECUTIVE_FAILURES: 'PROXY_CONSECUTIVE_FAILURES',
  LATENCY_TOO_HIGH: 'PROXY_LATENCY_TOO_HIGH',
  
  // Network errors
  NETWORK_UNAVAILABLE: 'PROXY_NETWORK_UNAVAILABLE',
  DNS_RESOLUTION_FAILED: 'PROXY_DNS_RESOLUTION_FAILED',
  
  // Pre-check errors
  PRE_CHECK_FAILED: 'PROXY_PRE_CHECK_FAILED',
  PRE_CHECK_TIMEOUT: 'PROXY_PRE_CHECK_TIMEOUT',
  
  // General errors
  UNKNOWN: 'PROXY_UNKNOWN_ERROR',
  NOT_CONFIGURED: 'PROXY_NOT_CONFIGURED',
  DISABLED: 'PROXY_DISABLED'
};

/**
 * ProxyError Domain Error
 * 
 * Specialized error class for proxy-related errors.
 * Extends AppError with proxy-specific error codes and context.
 */
class ProxyError extends AppError {
  /**
   * Creates a ProxyError instance
   * @param {string} message - Human-readable error message
   * @param {string} code - Error code from ProxyErrorCode
   * @param {Object} [context={}] - Additional context information
   * @param {boolean} [recoverable=false] - Whether the error is recoverable
   */
  constructor(message, code, context = {}, recoverable = false) {
    super(message, code, context, recoverable);
    this.name = 'ProxyError';
    
    // Proxy-specific context
    this.proxyId = context.proxyId || null;
    this.accountId = context.accountId || null;
    this.proxyHost = context.proxyHost || null;
    this.proxyPort = context.proxyPort || null;
  }

  // ==================== Factory Methods ====================

  /**
   * Creates a connection failed error
   * @param {string} host - Proxy host
   * @param {number} port - Proxy port
   * @param {Error} [originalError] - Original error
   * @returns {ProxyError}
   */
  static connectionFailed(host, port, originalError = null) {
    return new ProxyError(
      `Failed to connect to proxy ${host}:${port}`,
      ProxyErrorCode.CONNECTION_FAILED,
      { proxyHost: host, proxyPort: port, originalError },
      true // recoverable - can retry
    );
  }

  /**
   * Creates a connection timeout error
   * @param {string} host - Proxy host
   * @param {number} port - Proxy port
   * @param {number} timeout - Timeout in milliseconds
   * @returns {ProxyError}
   */
  static connectionTimeout(host, port, timeout) {
    return new ProxyError(
      `Connection to proxy ${host}:${port} timed out after ${timeout}ms`,
      ProxyErrorCode.CONNECTION_TIMEOUT,
      { proxyHost: host, proxyPort: port, timeout },
      true // recoverable - can retry
    );
  }

  /**
   * Creates an authentication failed error
   * @param {string} host - Proxy host
   * @param {string} [username] - Username used
   * @returns {ProxyError}
   */
  static authFailed(host, username = null) {
    return new ProxyError(
      `Authentication failed for proxy ${host}${username ? ` with user ${username}` : ''}`,
      ProxyErrorCode.AUTH_FAILED,
      { proxyHost: host, username },
      false // not recoverable without user action
    );
  }

  /**
   * Creates an invalid configuration error
   * @param {string} reason - Reason for invalid config
   * @param {Object} [config] - The invalid config
   * @returns {ProxyError}
   */
  static invalidConfig(reason, config = null) {
    return new ProxyError(
      `Invalid proxy configuration: ${reason}`,
      ProxyErrorCode.INVALID_CONFIG,
      { reason, config },
      false
    );
  }

  /**
   * Creates an IP leak detected error
   * @param {string} expectedIP - Expected exit IP
   * @param {string} actualIP - Actual detected IP
   * @param {string} leakType - Type of leak (webrtc, dns, etc.)
   * @returns {ProxyError}
   */
  static ipLeakDetected(expectedIP, actualIP, leakType = 'unknown') {
    return new ProxyError(
      `IP leak detected: expected ${expectedIP}, got ${actualIP} (type: ${leakType})`,
      ProxyErrorCode.IP_LEAK_DETECTED,
      { expectedIP, actualIP, leakType },
      false // critical - not recoverable
    );
  }

  /**
   * Creates an IP verification failed error
   * @param {string} reason - Reason for failure
   * @returns {ProxyError}
   */
  static ipVerificationFailed(reason) {
    return new ProxyError(
      `IP verification failed: ${reason}`,
      ProxyErrorCode.IP_VERIFICATION_FAILED,
      { reason },
      true // recoverable - can retry
    );
  }

  /**
   * Creates an IP mismatch error
   * @param {string} expectedIP - Expected exit IP
   * @param {string} actualIP - Actual detected IP
   * @returns {ProxyError}
   */
  static ipMismatch(expectedIP, actualIP) {
    return new ProxyError(
      `IP mismatch: expected ${expectedIP}, got ${actualIP}`,
      ProxyErrorCode.IP_MISMATCH,
      { expectedIP, actualIP },
      false // critical - not recoverable
    );
  }

  /**
   * Creates a kill-switch activated error
   * @param {string} reason - Reason for activation
   * @param {string} [accountId] - Account ID
   * @returns {ProxyError}
   */
  static killSwitchActivated(reason, accountId = null) {
    return new ProxyError(
      `Kill-switch activated: ${reason}`,
      ProxyErrorCode.KILL_SWITCH_ACTIVATED,
      { reason, accountId },
      false // requires user action
    );
  }

  /**
   * Creates a kill-switch blocked error
   * @param {string} operation - Operation that was blocked
   * @returns {ProxyError}
   */
  static killSwitchBlocked(operation) {
    return new ProxyError(
      `Operation blocked by kill-switch: ${operation}`,
      ProxyErrorCode.KILL_SWITCH_BLOCKED,
      { operation },
      false
    );
  }

  /**
   * Creates a health check failed error
   * @param {string} proxyId - Proxy ID
   * @param {string} reason - Reason for failure
   * @returns {ProxyError}
   */
  static healthCheckFailed(proxyId, reason) {
    return new ProxyError(
      `Health check failed for proxy ${proxyId}: ${reason}`,
      ProxyErrorCode.HEALTH_CHECK_FAILED,
      { proxyId, reason },
      true // recoverable - can retry
    );
  }

  /**
   * Creates a consecutive failures error
   * @param {string} proxyId - Proxy ID
   * @param {number} count - Number of consecutive failures
   * @param {number} threshold - Failure threshold
   * @returns {ProxyError}
   */
  static consecutiveFailures(proxyId, count, threshold) {
    return new ProxyError(
      `Proxy ${proxyId} has ${count} consecutive failures (threshold: ${threshold})`,
      ProxyErrorCode.CONSECUTIVE_FAILURES,
      { proxyId, count, threshold },
      false // triggers kill-switch
    );
  }

  /**
   * Creates a pre-check failed error
   * @param {string} host - Proxy host
   * @param {string} reason - Reason for failure
   * @returns {ProxyError}
   */
  static preCheckFailed(host, reason) {
    return new ProxyError(
      `Pre-connection check failed for ${host}: ${reason}`,
      ProxyErrorCode.PRE_CHECK_FAILED,
      { proxyHost: host, reason },
      true // recoverable - can retry
    );
  }

  /**
   * Creates a WebRTC leak error
   * @param {string} leakedIP - The leaked IP address
   * @returns {ProxyError}
   */
  static webrtcLeak(leakedIP) {
    return new ProxyError(
      `WebRTC leak detected: ${leakedIP}`,
      ProxyErrorCode.WEBRTC_LEAK,
      { leakedIP },
      false // critical
    );
  }

  /**
   * Creates a DNS leak error
   * @param {string} leakedDNS - The leaked DNS server
   * @returns {ProxyError}
   */
  static dnsLeak(leakedDNS) {
    return new ProxyError(
      `DNS leak detected: ${leakedDNS}`,
      ProxyErrorCode.DNS_LEAK,
      { leakedDNS },
      false // critical
    );
  }

  /**
   * Creates a proxy not configured error
   * @param {string} accountId - Account ID
   * @returns {ProxyError}
   */
  static notConfigured(accountId) {
    return new ProxyError(
      `No proxy configured for account ${accountId}`,
      ProxyErrorCode.NOT_CONFIGURED,
      { accountId },
      false
    );
  }

  /**
   * Creates a proxy disabled error
   * @param {string} proxyId - Proxy ID
   * @returns {ProxyError}
   */
  static disabled(proxyId) {
    return new ProxyError(
      `Proxy ${proxyId} is disabled`,
      ProxyErrorCode.DISABLED,
      { proxyId },
      false
    );
  }

  // ==================== Utility Methods ====================

  /**
   * Checks if this is a security-related error
   * @returns {boolean}
   */
  isSecurityError() {
    const securityCodes = [
      ProxyErrorCode.IP_LEAK_DETECTED,
      ProxyErrorCode.IP_VERIFICATION_FAILED,
      ProxyErrorCode.IP_MISMATCH,
      ProxyErrorCode.WEBRTC_LEAK,
      ProxyErrorCode.DNS_LEAK,
      ProxyErrorCode.KILL_SWITCH_ACTIVATED,
      ProxyErrorCode.KILL_SWITCH_BLOCKED
    ];
    return securityCodes.includes(this.code);
  }

  /**
   * Checks if this error should trigger the kill-switch
   * @returns {boolean}
   */
  shouldTriggerKillSwitch() {
    const killSwitchTriggers = [
      ProxyErrorCode.IP_LEAK_DETECTED,
      ProxyErrorCode.IP_MISMATCH,
      ProxyErrorCode.WEBRTC_LEAK,
      ProxyErrorCode.DNS_LEAK,
      ProxyErrorCode.CONSECUTIVE_FAILURES
    ];
    return killSwitchTriggers.includes(this.code);
  }

  /**
   * Checks if this is a connection-related error
   * @returns {boolean}
   */
  isConnectionError() {
    const connectionCodes = [
      ProxyErrorCode.CONNECTION_FAILED,
      ProxyErrorCode.CONNECTION_TIMEOUT,
      ProxyErrorCode.CONNECTION_REFUSED,
      ProxyErrorCode.CONNECTION_RESET,
      ProxyErrorCode.NETWORK_UNAVAILABLE
    ];
    return connectionCodes.includes(this.code);
  }

  /**
   * Checks if this is an authentication error
   * @returns {boolean}
   */
  isAuthError() {
    const authCodes = [
      ProxyErrorCode.AUTH_FAILED,
      ProxyErrorCode.AUTH_REQUIRED,
      ProxyErrorCode.AUTH_EXPIRED
    ];
    return authCodes.includes(this.code);
  }

  /**
   * Gets a user-friendly message for this error
   * @param {string} [locale='en'] - Locale for the message
   * @returns {string}
   */
  getUserMessage(locale = 'en') {
    // Simplified localization - can be extended
    const messages = {
      en: {
        [ProxyErrorCode.CONNECTION_FAILED]: 'Unable to connect to the proxy server. Please check your proxy settings.',
        [ProxyErrorCode.CONNECTION_TIMEOUT]: 'Connection to proxy timed out. The proxy server may be slow or unavailable.',
        [ProxyErrorCode.AUTH_FAILED]: 'Proxy authentication failed. Please check your username and password.',
        [ProxyErrorCode.IP_LEAK_DETECTED]: 'Security alert: Your real IP may have been exposed. Connection has been blocked.',
        [ProxyErrorCode.KILL_SWITCH_ACTIVATED]: 'Connection blocked for your protection. Please reconnect or change proxy.',
        [ProxyErrorCode.HEALTH_CHECK_FAILED]: 'Proxy health check failed. The proxy may be unstable.',
        [ProxyErrorCode.NOT_CONFIGURED]: 'No proxy is configured for this account.',
        [ProxyErrorCode.DISABLED]: 'The proxy is currently disabled.'
      },
      zh: {
        [ProxyErrorCode.CONNECTION_FAILED]: '无法连接到代理服务器。请检查您的代理设置。',
        [ProxyErrorCode.CONNECTION_TIMEOUT]: '代理连接超时。代理服务器可能较慢或不可用。',
        [ProxyErrorCode.AUTH_FAILED]: '代理认证失败。请检查您的用户名和密码。',
        [ProxyErrorCode.IP_LEAK_DETECTED]: '安全警告：您的真实IP可能已暴露。连接已被阻止。',
        [ProxyErrorCode.KILL_SWITCH_ACTIVATED]: '为保护您的安全，连接已被阻止。请重新连接或更换代理。',
        [ProxyErrorCode.HEALTH_CHECK_FAILED]: '代理健康检查失败。代理可能不稳定。',
        [ProxyErrorCode.NOT_CONFIGURED]: '此账号未配置代理。',
        [ProxyErrorCode.DISABLED]: '代理当前已禁用。'
      }
    };

    const localeMessages = messages[locale] || messages.en;
    return localeMessages[this.code] || this.message;
  }

  /**
   * Serializes the error to JSON
   * @returns {Object}
   */
  toJSON() {
    return {
      ...super.toJSON(),
      proxyId: this.proxyId,
      accountId: this.accountId,
      proxyHost: this.proxyHost,
      proxyPort: this.proxyPort
    };
  }

  /**
   * Creates a ProxyError from JSON
   * @param {Object} json - JSON representation
   * @returns {ProxyError}
   */
  static fromJSON(json) {
    const error = new ProxyError(
      json.message,
      json.code,
      json.context,
      json.recoverable
    );
    error.timestamp = json.timestamp;
    error.proxyId = json.proxyId;
    error.accountId = json.accountId;
    error.proxyHost = json.proxyHost;
    error.proxyPort = json.proxyPort;
    if (json.stack) {
      error.stack = json.stack;
    }
    return error;
  }
}

// Export the class and error codes
ProxyError.Code = ProxyErrorCode;
module.exports = ProxyError;
