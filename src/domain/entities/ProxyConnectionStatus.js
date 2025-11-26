'use strict';

/**
 * Connection Status Enum
 * @readonly
 * @enum {string}
 */
const ConnectionState = {
  DISCONNECTED: 'disconnected',
  CONNECTING: 'connecting',
  CONNECTED: 'connected',
  RECONNECTING: 'reconnecting',
  FAILED: 'failed',
  KILL_SWITCH_ACTIVE: 'kill_switch_active'
};

/**
 * ProxyConnectionStatus Domain Entity
 * 
 * Represents the current connection status of a proxy for an account.
 * Tracks connection state, timing, and failure information.
 */
class ProxyConnectionStatus {
  /**
   * Creates a ProxyConnectionStatus instance
   * @param {Object} status - Connection status data
   */
  constructor(status = {}) {
    this.accountId = status.accountId || null;
    this.proxyId = status.proxyId || null;
    this.state = status.state || ConnectionState.DISCONNECTED;
    this.connectedAt = status.connectedAt ? new Date(status.connectedAt) : null;
    this.disconnectedAt = status.disconnectedAt ? new Date(status.disconnectedAt) : null;
    this.lastStateChange = status.lastStateChange ? new Date(status.lastStateChange) : new Date();
    this.exitIP = status.exitIP || null;
    this.latency = status.latency || null; // in milliseconds
    this.consecutiveFailures = status.consecutiveFailures || 0;
    this.lastError = status.lastError || null;
    this.reconnectAttempts = status.reconnectAttempts || 0;
    this.killSwitchReason = status.killSwitchReason || null;
  }

  // ==================== State Methods ====================

  /**
   * Checks if currently connected
   * @returns {boolean}
   */
  isConnected() {
    return this.state === ConnectionState.CONNECTED;
  }

  /**
   * Checks if kill-switch is active
   * @returns {boolean}
   */
  isKillSwitchActive() {
    return this.state === ConnectionState.KILL_SWITCH_ACTIVE;
  }

  /**
   * Checks if currently reconnecting
   * @returns {boolean}
   */
  isReconnecting() {
    return this.state === ConnectionState.RECONNECTING;
  }

  /**
   * Checks if in a failed state
   * @returns {boolean}
   */
  isFailed() {
    return this.state === ConnectionState.FAILED;
  }

  /**
   * Gets the connection uptime in milliseconds
   * @returns {number|null} Uptime in ms or null if not connected
   */
  getUptime() {
    if (!this.connectedAt || this.state !== ConnectionState.CONNECTED) {
      return null;
    }
    return Date.now() - this.connectedAt.getTime();
  }

  // ==================== State Transitions ====================

  /**
   * Transitions to connecting state
   */
  setConnecting() {
    this.state = ConnectionState.CONNECTING;
    this.lastStateChange = new Date();
    this.lastError = null;
  }

  /**
   * Transitions to connected state
   * @param {string} exitIP - The verified exit IP address
   * @param {number} [latency] - Connection latency in ms
   */
  setConnected(exitIP, latency = null) {
    this.state = ConnectionState.CONNECTED;
    this.connectedAt = new Date();
    this.lastStateChange = new Date();
    this.exitIP = exitIP;
    this.latency = latency;
    this.consecutiveFailures = 0;
    this.reconnectAttempts = 0;
    this.lastError = null;
    this.killSwitchReason = null;
  }

  /**
   * Transitions to disconnected state
   */
  setDisconnected() {
    this.state = ConnectionState.DISCONNECTED;
    this.disconnectedAt = new Date();
    this.lastStateChange = new Date();
    this.exitIP = null;
    this.latency = null;
  }

  /**
   * Transitions to reconnecting state
   */
  setReconnecting() {
    this.state = ConnectionState.RECONNECTING;
    this.lastStateChange = new Date();
    this.reconnectAttempts++;
  }

  /**
   * Transitions to failed state
   * @param {string} error - Error message
   */
  setFailed(error) {
    this.state = ConnectionState.FAILED;
    this.lastStateChange = new Date();
    this.consecutiveFailures++;
    this.lastError = error;
    this.exitIP = null;
    this.latency = null;
  }

  /**
   * Activates the kill-switch
   * @param {string} reason - Reason for activation
   */
  activateKillSwitch(reason) {
    this.state = ConnectionState.KILL_SWITCH_ACTIVE;
    this.lastStateChange = new Date();
    this.killSwitchReason = reason;
    this.exitIP = null;
    this.latency = null;
  }

  /**
   * Resets the connection status
   */
  reset() {
    this.state = ConnectionState.DISCONNECTED;
    this.connectedAt = null;
    this.disconnectedAt = null;
    this.lastStateChange = new Date();
    this.exitIP = null;
    this.latency = null;
    this.consecutiveFailures = 0;
    this.lastError = null;
    this.reconnectAttempts = 0;
    this.killSwitchReason = null;
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
      state: this.state,
      connectedAt: this.connectedAt instanceof Date ? this.connectedAt.toISOString() : this.connectedAt,
      disconnectedAt: this.disconnectedAt instanceof Date ? this.disconnectedAt.toISOString() : this.disconnectedAt,
      lastStateChange: this.lastStateChange instanceof Date ? this.lastStateChange.toISOString() : this.lastStateChange,
      exitIP: this.exitIP,
      latency: this.latency,
      consecutiveFailures: this.consecutiveFailures,
      lastError: this.lastError,
      reconnectAttempts: this.reconnectAttempts,
      killSwitchReason: this.killSwitchReason
    };
  }

  /**
   * Creates an instance from a JSON object
   * @param {Object} json - JSON representation
   * @returns {ProxyConnectionStatus}
   */
  static fromJSON(json) {
    if (!json || typeof json !== 'object') {
      throw new Error('Invalid JSON: expected an object');
    }
    return new ProxyConnectionStatus(json);
  }

  /**
   * Returns a human-readable string representation
   * @param {ProxyConnectionStatus} status - ProxyConnectionStatus instance
   * @returns {string}
   */
  static prettyPrint(status) {
    const uptime = status.getUptime();
    const uptimeStr = uptime !== null 
      ? `${Math.floor(uptime / 1000)}s` 
      : 'N/A';
    
    const lines = [
      '┌─────────────────────────────────────────────────────────────┐',
      '│                  PROXY CONNECTION STATUS                   │',
      '├─────────────────────────────────────────────────────────────┤',
      `│ Account ID:   ${(status.accountId || 'N/A').substring(0, 44).padEnd(44)} │`,
      `│ Proxy ID:     ${(status.proxyId || 'N/A').substring(0, 44).padEnd(44)} │`,
      `│ State:        ${status.state.padEnd(44)} │`,
      `│ Exit IP:      ${(status.exitIP || 'N/A').padEnd(44)} │`,
      `│ Latency:      ${(status.latency !== null ? status.latency + 'ms' : 'N/A').padEnd(44)} │`,
      `│ Uptime:       ${uptimeStr.padEnd(44)} │`,
      `│ Failures:     ${String(status.consecutiveFailures).padEnd(44)} │`,
      `│ Reconnects:   ${String(status.reconnectAttempts).padEnd(44)} │`,
      `│ Last Error:   ${(status.lastError || 'None').substring(0, 44).padEnd(44)} │`,
      `│ Kill Reason:  ${(status.killSwitchReason || 'None').substring(0, 44).padEnd(44)} │`,
      '└─────────────────────────────────────────────────────────────┘'
    ];
    return lines.join('\n');
  }
}

// Export the class and enum
ProxyConnectionStatus.State = ConnectionState;
module.exports = ProxyConnectionStatus;
