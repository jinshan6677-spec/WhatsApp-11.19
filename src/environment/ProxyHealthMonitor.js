/**
 * Proxy Health Monitor
 * 
 * Monitors proxy connection health status with periodic checks
 * and status change notifications.
 * 
 * @module environment/ProxyHealthMonitor
 */

'use strict';

const LocalProxyManager = require('./LocalProxyManager');

/**
 * Connection status constants
 */
const ConnectionStatus = {
    CONNECTED: 'connected',
    CONNECTING: 'connecting',
    DISCONNECTED: 'disconnected',
    ERROR: 'error'
};

/**
 * Default configuration
 */
const DEFAULT_CONFIG = {
    checkInterval: 60000, // 60 seconds
    timeout: 10000        // 10 seconds for connection test
};

/**
 * Proxy Health Monitor
 * Monitors proxy connection health and notifies on status changes
 */
class ProxyHealthMonitor {
    /**
     * Create a ProxyHealthMonitor instance
     * @param {Object} options - Configuration options
     * @param {number} [options.checkInterval=60000] - Check interval in milliseconds
     * @param {Function} [options.onStatusChange] - Callback for status changes
     */
    constructor(options = {}) {
        this._checkInterval = options.checkInterval || DEFAULT_CONFIG.checkInterval;
        this._onStatusChange = options.onStatusChange || null;
        this._timeout = options.timeout || DEFAULT_CONFIG.timeout;
        
        // Internal state
        this._intervalId = null;
        this._proxyConfig = null;
        this._isRunning = false;
        
        // Current status
        this._status = {
            status: ConnectionStatus.DISCONNECTED,
            lastCheck: null,
            latency: null,
            error: null
        };
    }

    /**
     * Start monitoring proxy connection
     * @param {Object} proxyConfig - Proxy configuration to monitor
     * @param {string} proxyConfig.host - Proxy host
     * @param {number} proxyConfig.port - Proxy port
     * @param {string} [proxyConfig.protocol] - Protocol (default: http)
     */
    start(proxyConfig) {
        if (!proxyConfig || !proxyConfig.host || !proxyConfig.port) {
            throw new Error('Invalid proxy configuration');
        }

        // Stop any existing monitoring
        this.stop();

        this._proxyConfig = { ...proxyConfig };
        this._isRunning = true;
        
        // Set initial status to connecting
        this._updateStatus(ConnectionStatus.CONNECTING);

        // Perform initial check
        this.checkNow();

        // Start periodic checks
        this._intervalId = setInterval(() => {
            this.checkNow();
        }, this._checkInterval);
    }

    /**
     * Stop monitoring
     */
    stop() {
        if (this._intervalId) {
            clearInterval(this._intervalId);
            this._intervalId = null;
        }
        
        this._isRunning = false;
        this._proxyConfig = null;
        
        // Reset status
        this._status = {
            status: ConnectionStatus.DISCONNECTED,
            lastCheck: this._status.lastCheck,
            latency: null,
            error: null
        };
    }

    /**
     * Manually check connection now
     * @returns {Promise<{status: string, latency?: number, error?: string}>}
     */
    async checkNow() {
        if (!this._proxyConfig) {
            return {
                status: ConnectionStatus.DISCONNECTED,
                error: 'No proxy configuration'
            };
        }

        const previousStatus = this._status.status;

        try {
            const result = await LocalProxyManager.testLocalProxy(
                this._proxyConfig,
                this._timeout
            );

            const newStatus = result.success 
                ? ConnectionStatus.CONNECTED 
                : ConnectionStatus.ERROR;

            this._status = {
                status: newStatus,
                lastCheck: new Date(),
                latency: result.latency || null,
                error: result.error || null
            };

            // Notify if status changed
            if (previousStatus !== newStatus) {
                this._notifyStatusChange(previousStatus, newStatus);
            }

            return {
                status: newStatus,
                latency: result.latency,
                error: result.error
            };
        } catch (error) {
            this._status = {
                status: ConnectionStatus.ERROR,
                lastCheck: new Date(),
                latency: null,
                error: error.message
            };

            // Notify if status changed
            if (previousStatus !== ConnectionStatus.ERROR) {
                this._notifyStatusChange(previousStatus, ConnectionStatus.ERROR);
            }

            return {
                status: ConnectionStatus.ERROR,
                error: error.message
            };
        }
    }

    /**
     * Get current status
     * @returns {{status: string, lastCheck: Date|null, latency?: number, error?: string}}
     */
    getStatus() {
        return { ...this._status };
    }

    /**
     * Check if monitor is running
     * @returns {boolean}
     */
    isRunning() {
        return this._isRunning;
    }

    /**
     * Get current proxy configuration
     * @returns {Object|null}
     */
    getProxyConfig() {
        return this._proxyConfig ? { ...this._proxyConfig } : null;
    }

    /**
     * Update check interval
     * @param {number} interval - New interval in milliseconds
     */
    setCheckInterval(interval) {
        if (typeof interval !== 'number' || interval < 1000) {
            throw new Error('Check interval must be at least 1000ms');
        }

        this._checkInterval = interval;

        // Restart monitoring with new interval if running
        if (this._isRunning && this._proxyConfig) {
            const config = this._proxyConfig;
            this.stop();
            this.start(config);
        }
    }

    /**
     * Update status change callback
     * @param {Function} callback - New callback function
     */
    setOnStatusChange(callback) {
        this._onStatusChange = callback;
    }

    /**
     * Update internal status and timestamp
     * @private
     * @param {string} status - New status
     * @param {string} [error] - Error message (optional)
     */
    _updateStatus(status, error = null) {
        this._status = {
            status,
            lastCheck: new Date(),
            latency: this._status.latency,
            error
        };
    }

    /**
     * Notify status change via callback
     * @private
     * @param {string} previousStatus - Previous status
     * @param {string} newStatus - New status
     */
    _notifyStatusChange(previousStatus, newStatus) {
        if (typeof this._onStatusChange === 'function') {
            try {
                this._onStatusChange({
                    previousStatus,
                    currentStatus: newStatus,
                    timestamp: new Date(),
                    latency: this._status.latency,
                    error: this._status.error
                });
            } catch (error) {
                // Silently handle callback errors to prevent monitor disruption
                console.error('ProxyHealthMonitor: onStatusChange callback error:', error);
            }
        }
    }
}

// Export class and constants
ProxyHealthMonitor.ConnectionStatus = ConnectionStatus;
ProxyHealthMonitor.DEFAULT_CONFIG = DEFAULT_CONFIG;

module.exports = ProxyHealthMonitor;
