'use strict';

/**
 * Disconnection Reason Enum
 * @readonly
 * @enum {string}
 */
const DisconnectionReason = {
  USER_INITIATED: 'user_initiated',
  PROXY_FAILURE: 'proxy_failure',
  NETWORK_ERROR: 'network_error',
  TIMEOUT: 'timeout',
  AUTH_FAILURE: 'auth_failure',
  KILL_SWITCH: 'kill_switch',
  ACCOUNT_CLOSED: 'account_closed',
  PROXY_SWITCHED: 'proxy_switched',
  UNKNOWN: 'unknown'
};

/**
 * ProxyDisconnectedEvent Domain Event
 * 
 * Emitted when a proxy connection is terminated.
 */
class ProxyDisconnectedEvent {
  /**
   * Event name constant
   * @type {string}
   */
  static EVENT_NAME = 'proxy:disconnected';

  /**
   * Creates a ProxyDisconnectedEvent instance
   * @param {Object} data - Event data
   */
  constructor(data = {}) {
    this.name = ProxyDisconnectedEvent.EVENT_NAME;
    this.timestamp = new Date();
    this.accountId = data.accountId || null;
    this.proxyId = data.proxyId || null;
    this.reason = data.reason || DisconnectionReason.UNKNOWN;
    this.error = data.error || null;
    this.sessionDuration = data.sessionDuration || null; // in milliseconds
    this.wasHealthy = data.wasHealthy !== undefined ? data.wasHealthy : true;
  }

  /**
   * Creates an event for user-initiated disconnection
   * @param {string} accountId - Account ID
   * @param {string} proxyId - Proxy ID
   * @param {number} [sessionDuration] - Session duration in ms
   * @returns {ProxyDisconnectedEvent}
   */
  static userInitiated(accountId, proxyId, sessionDuration = null) {
    return new ProxyDisconnectedEvent({
      accountId,
      proxyId,
      reason: DisconnectionReason.USER_INITIATED,
      sessionDuration,
      wasHealthy: true
    });
  }

  /**
   * Creates an event for proxy failure
   * @param {string} accountId - Account ID
   * @param {string} proxyId - Proxy ID
   * @param {string} error - Error message
   * @param {number} [sessionDuration] - Session duration in ms
   * @returns {ProxyDisconnectedEvent}
   */
  static proxyFailure(accountId, proxyId, error, sessionDuration = null) {
    return new ProxyDisconnectedEvent({
      accountId,
      proxyId,
      reason: DisconnectionReason.PROXY_FAILURE,
      error,
      sessionDuration,
      wasHealthy: false
    });
  }

  /**
   * Creates an event for network error
   * @param {string} accountId - Account ID
   * @param {string} proxyId - Proxy ID
   * @param {string} error - Error message
   * @returns {ProxyDisconnectedEvent}
   */
  static networkError(accountId, proxyId, error) {
    return new ProxyDisconnectedEvent({
      accountId,
      proxyId,
      reason: DisconnectionReason.NETWORK_ERROR,
      error,
      wasHealthy: false
    });
  }

  /**
   * Creates an event for kill-switch activation
   * @param {string} accountId - Account ID
   * @param {string} proxyId - Proxy ID
   * @param {string} killSwitchReason - Reason for kill-switch
   * @returns {ProxyDisconnectedEvent}
   */
  static killSwitch(accountId, proxyId, killSwitchReason) {
    return new ProxyDisconnectedEvent({
      accountId,
      proxyId,
      reason: DisconnectionReason.KILL_SWITCH,
      error: killSwitchReason,
      wasHealthy: false
    });
  }

  /**
   * Creates an event for proxy switch
   * @param {string} accountId - Account ID
   * @param {string} oldProxyId - Old proxy ID
   * @param {number} [sessionDuration] - Session duration in ms
   * @returns {ProxyDisconnectedEvent}
   */
  static proxySwitched(accountId, oldProxyId, sessionDuration = null) {
    return new ProxyDisconnectedEvent({
      accountId,
      proxyId: oldProxyId,
      reason: DisconnectionReason.PROXY_SWITCHED,
      sessionDuration,
      wasHealthy: true
    });
  }

  /**
   * Checks if disconnection was due to an error
   * @returns {boolean}
   */
  isErrorDisconnection() {
    return [
      DisconnectionReason.PROXY_FAILURE,
      DisconnectionReason.NETWORK_ERROR,
      DisconnectionReason.TIMEOUT,
      DisconnectionReason.AUTH_FAILURE,
      DisconnectionReason.KILL_SWITCH
    ].includes(this.reason);
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
      reason: this.reason,
      error: this.error,
      sessionDuration: this.sessionDuration,
      wasHealthy: this.wasHealthy
    };
  }

  /**
   * Creates an instance from JSON
   * @param {Object} json - JSON representation
   * @returns {ProxyDisconnectedEvent}
   */
  static fromJSON(json) {
    const event = new ProxyDisconnectedEvent(json);
    event.timestamp = json.timestamp ? new Date(json.timestamp) : new Date();
    return event;
  }

  /**
   * Returns a human-readable description
   * @returns {string}
   */
  toString() {
    const duration = this.sessionDuration 
      ? ` after ${Math.round(this.sessionDuration / 1000)}s` 
      : '';
    return `ProxyDisconnectedEvent: Account ${this.accountId} disconnected from proxy ${this.proxyId} (reason: ${this.reason}${duration})`;
  }
}

// Export the class and enum
ProxyDisconnectedEvent.Reason = DisconnectionReason;
module.exports = ProxyDisconnectedEvent;
