'use strict';

/**
 * IP Leak Type Enum
 * @readonly
 * @enum {string}
 */
const LeakType = {
  WEBRTC: 'webrtc',
  DNS: 'dns',
  WEBSOCKET: 'websocket',
  HTTP_HEADER: 'http_header',
  BROWSER_API: 'browser_api',
  IP_VERIFICATION: 'ip_verification',
  UNKNOWN: 'unknown'
};

/**
 * Leak Severity Enum
 * @readonly
 * @enum {string}
 */
const LeakSeverity = {
  CRITICAL: 'critical',  // Real IP exposed
  HIGH: 'high',          // Potential IP exposure
  MEDIUM: 'medium',      // Metadata leak
  LOW: 'low'             // Minor information leak
};

/**
 * IPLeakDetectedEvent Domain Event
 * 
 * Emitted when an IP leak is detected through any channel.
 * This is a critical security event that should trigger immediate action.
 */
class IPLeakDetectedEvent {
  /**
   * Event name constant
   * @type {string}
   */
  static EVENT_NAME = 'proxy:ip_leak_detected';

  /**
   * Creates an IPLeakDetectedEvent instance
   * @param {Object} data - Event data
   */
  constructor(data = {}) {
    this.name = IPLeakDetectedEvent.EVENT_NAME;
    this.timestamp = new Date();
    this.accountId = data.accountId || null;
    this.proxyId = data.proxyId || null;
    this.leakType = data.leakType || LeakType.UNKNOWN;
    this.severity = data.severity || LeakSeverity.CRITICAL;
    this.expectedIP = data.expectedIP || null;
    this.leakedIP = data.leakedIP || null;
    this.leakedData = data.leakedData || null; // Additional leaked data (DNS server, etc.)
    this.source = data.source || null; // Where the leak was detected
    this.blocked = data.blocked !== undefined ? data.blocked : false;
    this.details = data.details || null;
  }

  /**
   * Creates an event for WebRTC leak
   * @param {string} accountId - Account ID
   * @param {string} proxyId - Proxy ID
   * @param {string} expectedIP - Expected exit IP
   * @param {string} leakedIP - Leaked real IP
   * @param {boolean} [blocked=false] - Whether the leak was blocked
   * @returns {IPLeakDetectedEvent}
   */
  static webrtcLeak(accountId, proxyId, expectedIP, leakedIP, blocked = false) {
    return new IPLeakDetectedEvent({
      accountId,
      proxyId,
      leakType: LeakType.WEBRTC,
      severity: LeakSeverity.CRITICAL,
      expectedIP,
      leakedIP,
      source: 'RTCPeerConnection',
      blocked,
      details: 'Real IP exposed through WebRTC STUN/TURN request'
    });
  }

  /**
   * Creates an event for DNS leak
   * @param {string} accountId - Account ID
   * @param {string} proxyId - Proxy ID
   * @param {string} leakedDNS - Leaked DNS server
   * @param {boolean} [blocked=false] - Whether the leak was blocked
   * @returns {IPLeakDetectedEvent}
   */
  static dnsLeak(accountId, proxyId, leakedDNS, blocked = false) {
    return new IPLeakDetectedEvent({
      accountId,
      proxyId,
      leakType: LeakType.DNS,
      severity: LeakSeverity.HIGH,
      leakedData: leakedDNS,
      source: 'DNS resolution',
      blocked,
      details: `DNS request bypassed proxy and used ${leakedDNS}`
    });
  }

  /**
   * Creates an event for WebSocket leak
   * @param {string} accountId - Account ID
   * @param {string} proxyId - Proxy ID
   * @param {string} targetUrl - WebSocket target URL
   * @param {boolean} [blocked=false] - Whether the leak was blocked
   * @returns {IPLeakDetectedEvent}
   */
  static websocketLeak(accountId, proxyId, targetUrl, blocked = false) {
    return new IPLeakDetectedEvent({
      accountId,
      proxyId,
      leakType: LeakType.WEBSOCKET,
      severity: LeakSeverity.HIGH,
      leakedData: targetUrl,
      source: 'WebSocket connection',
      blocked,
      details: `WebSocket attempted to bypass proxy: ${targetUrl}`
    });
  }

  /**
   * Creates an event for IP verification failure
   * @param {string} accountId - Account ID
   * @param {string} proxyId - Proxy ID
   * @param {string} expectedIP - Expected exit IP
   * @param {string} actualIP - Actual detected IP
   * @returns {IPLeakDetectedEvent}
   */
  static ipVerificationFailure(accountId, proxyId, expectedIP, actualIP) {
    return new IPLeakDetectedEvent({
      accountId,
      proxyId,
      leakType: LeakType.IP_VERIFICATION,
      severity: LeakSeverity.CRITICAL,
      expectedIP,
      leakedIP: actualIP,
      source: 'IP verification service',
      blocked: false,
      details: `Exit IP changed from ${expectedIP} to ${actualIP}`
    });
  }

  /**
   * Creates an event for browser API leak
   * @param {string} accountId - Account ID
   * @param {string} proxyId - Proxy ID
   * @param {string} apiName - Name of the leaking API
   * @param {string} leakedData - Data that was leaked
   * @param {boolean} [blocked=false] - Whether the leak was blocked
   * @returns {IPLeakDetectedEvent}
   */
  static browserApiLeak(accountId, proxyId, apiName, leakedData, blocked = false) {
    return new IPLeakDetectedEvent({
      accountId,
      proxyId,
      leakType: LeakType.BROWSER_API,
      severity: LeakSeverity.MEDIUM,
      leakedData,
      source: apiName,
      blocked,
      details: `Browser API ${apiName} leaked information`
    });
  }

  /**
   * Checks if this is a critical leak
   * @returns {boolean}
   */
  isCritical() {
    return this.severity === LeakSeverity.CRITICAL;
  }

  /**
   * Checks if the leak was successfully blocked
   * @returns {boolean}
   */
  wasBlocked() {
    return this.blocked;
  }

  /**
   * Checks if this leak exposed the real IP
   * @returns {boolean}
   */
  exposedRealIP() {
    return this.leakedIP !== null && this.leakedIP !== this.expectedIP;
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
      leakType: this.leakType,
      severity: this.severity,
      expectedIP: this.expectedIP,
      leakedIP: this.leakedIP,
      leakedData: this.leakedData,
      source: this.source,
      blocked: this.blocked,
      details: this.details
    };
  }

  /**
   * Creates an instance from JSON
   * @param {Object} json - JSON representation
   * @returns {IPLeakDetectedEvent}
   */
  static fromJSON(json) {
    const event = new IPLeakDetectedEvent(json);
    event.timestamp = json.timestamp ? new Date(json.timestamp) : new Date();
    return event;
  }

  /**
   * Returns a human-readable description
   * @returns {string}
   */
  toString() {
    const blockedStr = this.blocked ? ' (BLOCKED)' : '';
    const ipStr = this.leakedIP ? ` - Leaked IP: ${this.leakedIP}` : '';
    return `IPLeakDetectedEvent [${this.severity}]: ${this.leakType} leak for account ${this.accountId}${ipStr}${blockedStr}`;
  }
}

// Export the class and enums
IPLeakDetectedEvent.LeakType = LeakType;
IPLeakDetectedEvent.Severity = LeakSeverity;
module.exports = IPLeakDetectedEvent;
