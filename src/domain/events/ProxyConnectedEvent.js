'use strict';

/**
 * ProxyConnectedEvent Domain Event
 * 
 * Emitted when a proxy connection is successfully established.
 */
class ProxyConnectedEvent {
  /**
   * Event name constant
   * @type {string}
   */
  static EVENT_NAME = 'proxy:connected';

  /**
   * Creates a ProxyConnectedEvent instance
   * @param {Object} data - Event data
   */
  constructor(data = {}) {
    this.name = ProxyConnectedEvent.EVENT_NAME;
    this.timestamp = new Date();
    this.accountId = data.accountId || null;
    this.proxyId = data.proxyId || null;
    this.exitIP = data.exitIP || null;
    this.latency = data.latency || null;
    this.protocol = data.protocol || null;
    this.host = data.host || null;
    this.port = data.port || null;
  }

  /**
   * Creates an event from proxy config and connection details
   * @param {string} accountId - Account ID
   * @param {Object} proxyConfig - Proxy configuration
   * @param {string} exitIP - Verified exit IP
   * @param {number} [latency] - Connection latency in ms
   * @returns {ProxyConnectedEvent}
   */
  static create(accountId, proxyConfig, exitIP, latency = null) {
    return new ProxyConnectedEvent({
      accountId,
      proxyId: proxyConfig.id,
      exitIP,
      latency,
      protocol: proxyConfig.protocol,
      host: proxyConfig.host,
      port: proxyConfig.port
    });
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
      exitIP: this.exitIP,
      latency: this.latency,
      protocol: this.protocol,
      host: this.host,
      port: this.port
    };
  }

  /**
   * Creates an instance from JSON
   * @param {Object} json - JSON representation
   * @returns {ProxyConnectedEvent}
   */
  static fromJSON(json) {
    const event = new ProxyConnectedEvent(json);
    event.timestamp = json.timestamp ? new Date(json.timestamp) : new Date();
    return event;
  }

  /**
   * Returns a human-readable description
   * @returns {string}
   */
  toString() {
    return `ProxyConnectedEvent: Account ${this.accountId} connected via ${this.host}:${this.port} (IP: ${this.exitIP}, Latency: ${this.latency}ms)`;
  }
}

module.exports = ProxyConnectedEvent;
