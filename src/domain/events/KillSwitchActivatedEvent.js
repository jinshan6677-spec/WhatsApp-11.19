'use strict';

/**
 * Kill-Switch Trigger Reason Enum
 * @readonly
 * @enum {string}
 */
const KillSwitchTrigger = {
  PROXY_DISCONNECTED: 'proxy_disconnected',
  CONSECUTIVE_FAILURES: 'consecutive_failures',
  IP_LEAK_DETECTED: 'ip_leak_detected',
  IP_MISMATCH: 'ip_mismatch',
  WEBRTC_LEAK: 'webrtc_leak',
  DNS_LEAK: 'dns_leak',
  HEALTH_CHECK_FAILED: 'health_check_failed',
  MANUAL: 'manual',
  UNKNOWN: 'unknown'
};

/**
 * KillSwitchActivatedEvent Domain Event
 * 
 * Emitted when the kill-switch is activated to protect user's IP.
 * This is a critical security event that blocks all network traffic.
 */
class KillSwitchActivatedEvent {
  /**
   * Event name constant
   * @type {string}
   */
  static EVENT_NAME = 'proxy:kill_switch_activated';

  /**
   * Creates a KillSwitchActivatedEvent instance
   * @param {Object} data - Event data
   */
  constructor(data = {}) {
    this.name = KillSwitchActivatedEvent.EVENT_NAME;
    this.timestamp = new Date();
    this.accountId = data.accountId || null;
    this.proxyId = data.proxyId || null;
    this.trigger = data.trigger || KillSwitchTrigger.UNKNOWN;
    this.details = data.details || null;
    this.consecutiveFailures = data.consecutiveFailures || 0;
    this.lastKnownIP = data.lastKnownIP || null;
    this.detectedIP = data.detectedIP || null;
  }

  /**
   * Creates an event for proxy disconnection trigger
   * @param {string} accountId - Account ID
   * @param {string} proxyId - Proxy ID
   * @param {string} [details] - Additional details
   * @returns {KillSwitchActivatedEvent}
   */
  static proxyDisconnected(accountId, proxyId, details = null) {
    return new KillSwitchActivatedEvent({
      accountId,
      proxyId,
      trigger: KillSwitchTrigger.PROXY_DISCONNECTED,
      details: details || 'Proxy connection lost'
    });
  }

  /**
   * Creates an event for consecutive failures trigger
   * @param {string} accountId - Account ID
   * @param {string} proxyId - Proxy ID
   * @param {number} failureCount - Number of consecutive failures
   * @param {number} threshold - Failure threshold
   * @returns {KillSwitchActivatedEvent}
   */
  static consecutiveFailures(accountId, proxyId, failureCount, threshold) {
    return new KillSwitchActivatedEvent({
      accountId,
      proxyId,
      trigger: KillSwitchTrigger.CONSECUTIVE_FAILURES,
      details: `${failureCount} consecutive failures (threshold: ${threshold})`,
      consecutiveFailures: failureCount
    });
  }

  /**
   * Creates an event for IP leak detection trigger
   * @param {string} accountId - Account ID
   * @param {string} proxyId - Proxy ID
   * @param {string} expectedIP - Expected exit IP
   * @param {string} detectedIP - Detected (leaked) IP
   * @param {string} leakType - Type of leak
   * @returns {KillSwitchActivatedEvent}
   */
  static ipLeakDetected(accountId, proxyId, expectedIP, detectedIP, leakType = 'unknown') {
    return new KillSwitchActivatedEvent({
      accountId,
      proxyId,
      trigger: KillSwitchTrigger.IP_LEAK_DETECTED,
      details: `IP leak detected via ${leakType}`,
      lastKnownIP: expectedIP,
      detectedIP
    });
  }

  /**
   * Creates an event for IP mismatch trigger
   * @param {string} accountId - Account ID
   * @param {string} proxyId - Proxy ID
   * @param {string} expectedIP - Expected exit IP
   * @param {string} actualIP - Actual detected IP
   * @returns {KillSwitchActivatedEvent}
   */
  static ipMismatch(accountId, proxyId, expectedIP, actualIP) {
    return new KillSwitchActivatedEvent({
      accountId,
      proxyId,
      trigger: KillSwitchTrigger.IP_MISMATCH,
      details: `Exit IP changed from ${expectedIP} to ${actualIP}`,
      lastKnownIP: expectedIP,
      detectedIP: actualIP
    });
  }

  /**
   * Creates an event for WebRTC leak trigger
   * @param {string} accountId - Account ID
   * @param {string} proxyId - Proxy ID
   * @param {string} leakedIP - The leaked IP address
   * @returns {KillSwitchActivatedEvent}
   */
  static webrtcLeak(accountId, proxyId, leakedIP) {
    return new KillSwitchActivatedEvent({
      accountId,
      proxyId,
      trigger: KillSwitchTrigger.WEBRTC_LEAK,
      details: 'WebRTC leak detected',
      detectedIP: leakedIP
    });
  }

  /**
   * Creates an event for DNS leak trigger
   * @param {string} accountId - Account ID
   * @param {string} proxyId - Proxy ID
   * @param {string} leakedDNS - The leaked DNS server
   * @returns {KillSwitchActivatedEvent}
   */
  static dnsLeak(accountId, proxyId, leakedDNS) {
    return new KillSwitchActivatedEvent({
      accountId,
      proxyId,
      trigger: KillSwitchTrigger.DNS_LEAK,
      details: `DNS leak detected: ${leakedDNS}`
    });
  }

  /**
   * Creates an event for health check failure trigger
   * @param {string} accountId - Account ID
   * @param {string} proxyId - Proxy ID
   * @param {string} reason - Reason for health check failure
   * @returns {KillSwitchActivatedEvent}
   */
  static healthCheckFailed(accountId, proxyId, reason) {
    return new KillSwitchActivatedEvent({
      accountId,
      proxyId,
      trigger: KillSwitchTrigger.HEALTH_CHECK_FAILED,
      details: reason
    });
  }

  /**
   * Creates an event for manual trigger
   * @param {string} accountId - Account ID
   * @param {string} proxyId - Proxy ID
   * @param {string} [reason] - Reason for manual activation
   * @returns {KillSwitchActivatedEvent}
   */
  static manual(accountId, proxyId, reason = 'Manually activated') {
    return new KillSwitchActivatedEvent({
      accountId,
      proxyId,
      trigger: KillSwitchTrigger.MANUAL,
      details: reason
    });
  }

  /**
   * Checks if this is a security-critical trigger
   * @returns {boolean}
   */
  isSecurityCritical() {
    return [
      KillSwitchTrigger.IP_LEAK_DETECTED,
      KillSwitchTrigger.IP_MISMATCH,
      KillSwitchTrigger.WEBRTC_LEAK,
      KillSwitchTrigger.DNS_LEAK
    ].includes(this.trigger);
  }

  /**
   * Converts to a JSON-serializable object
   * @returns {Object}
   */
  toJSON() {
    return {
      name: this.name,
      timestamp: this.timestamp instanceof Date ? this.timestamp.toISOString() : this.timestamp,
      accountId: this.accountId,
      proxyId: this.proxyId,
      trigger: this.trigger,
      details: this.details,
      consecutiveFailures: this.consecutiveFailures,
      lastKnownIP: this.lastKnownIP,
      detectedIP: this.detectedIP
    };
  }

  /**
   * Creates an instance from JSON
   * @param {Object} json - JSON representation
   * @returns {KillSwitchActivatedEvent}
   */
  static fromJSON(json) {
    const event = new KillSwitchActivatedEvent(json);
    event.timestamp = json.timestamp ? new Date(json.timestamp) : new Date();
    return event;
  }

  /**
   * Returns a human-readable description
   * @returns {string}
   */
  toString() {
    return `KillSwitchActivatedEvent: Account ${this.accountId} - ${this.trigger}: ${this.details}`;
  }
}

// Export the class and enum
KillSwitchActivatedEvent.Trigger = KillSwitchTrigger;
module.exports = KillSwitchActivatedEvent;
