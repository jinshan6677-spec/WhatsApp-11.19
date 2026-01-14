/**
 * Local Proxy Manager
 * 
 * Manages local proxy port configuration for external proxy clients
 * like Clash, V2rayN, Shadowsocks, etc.
 * 
 * @module environment/LocalProxyManager
 */

'use strict';

const axios = require('axios');

/**
 * Local Proxy Manager
 * Handles local proxy port configuration and validation
 */
class LocalProxyManager {
    /**
     * Proxy client presets with default ports
     * Note: V2rayN 10808 is mixed mode (HTTP + SOCKS5), use HTTP for Electron
     * Clash 7890 is also mixed mode
     */
    static PRESETS = {
        clash: { 
            id: 'clash',
            name: 'Clash', 
            host: '127.0.0.1', 
            port: 7890, 
            protocol: 'http'  // Clash mixed port works with HTTP
        },
        v2rayn: { 
            id: 'v2rayn',
            name: 'V2rayN', 
            host: '127.0.0.1', 
            port: 10808, 
            protocol: 'http'  // V2rayN mixed port works with HTTP
        },
        shadowsocks: { 
            id: 'shadowsocks',
            name: 'Shadowsocks', 
            host: '127.0.0.1', 
            port: 1080, 
            protocol: 'socks5'  // Shadowsocks is typically SOCKS5 only
        },
        custom: { 
            id: 'custom',
            name: '自定义', 
            host: '127.0.0.1', 
            port: 0, 
            protocol: 'http' 
        }
    };

    /**
     * Valid local hosts for local proxy
     */
    static VALID_LOCAL_HOSTS = ['127.0.0.1', 'localhost'];

    /**
     * Get preset configuration by ID
     * @param {string} presetId - Preset ID (clash, v2rayn, shadowsocks, custom)
     * @returns {Object|null} Preset configuration or null if not found
     */
    static getPreset(presetId) {
        if (!presetId || typeof presetId !== 'string') {
            return null;
        }
        
        const normalizedId = presetId.toLowerCase().trim();
        
        // Use hasOwnProperty to avoid prototype pollution
        if (!Object.prototype.hasOwnProperty.call(this.PRESETS, normalizedId)) {
            return null;
        }
        
        return this.PRESETS[normalizedId];
    }

    /**
     * Get all available presets
     * @returns {Object[]} Array of preset configurations
     */
    static getAllPresets() {
        return Object.values(this.PRESETS);
    }

    /**
     * Build proxy URL from configuration
     * @param {Object} config - Proxy configuration
     * @param {string} config.protocol - Protocol (http/https)
     * @param {string} config.host - Host address
     * @param {number} config.port - Port number
     * @param {string} [config.username] - Username (optional)
     * @param {string} [config.password] - Password (optional)
     * @returns {string} Proxy URL
     */
    static buildProxyUrl(config) {
        if (!config || !config.host || !config.port) {
            return '';
        }

        const { protocol = 'http', host, port, username, password } = config;
        
        let url = `${protocol}://`;
        
        // Add authentication if provided
        if (username && password) {
            url += `${encodeURIComponent(username)}:${encodeURIComponent(password)}@`;
        }
        
        url += `${host}:${port}`;
        
        return url;
    }

    /**
     * Validate local proxy configuration
     * @param {string} host - Host address (should be 127.0.0.1 or localhost)
     * @param {number} port - Port number (1-65535)
     * @returns {{valid: boolean, errors: string[]}} Validation result
     */
    static validateLocalProxy(host, port) {
        const errors = [];

        // Validate host
        if (!host || typeof host !== 'string') {
            errors.push('主机地址不能为空');
        } else {
            const normalizedHost = host.trim().toLowerCase();
            if (!this.VALID_LOCAL_HOSTS.includes(normalizedHost)) {
                errors.push('本地代理主机必须是 127.0.0.1 或 localhost');
            }
        }

        // Validate port
        if (port === undefined || port === null) {
            errors.push('端口不能为空');
        } else {
            const portNum = typeof port === 'string' ? parseInt(port, 10) : port;
            
            if (isNaN(portNum)) {
                errors.push('端口必须是数字');
            } else if (!Number.isInteger(portNum)) {
                errors.push('端口必须是整数');
            } else if (portNum < 1 || portNum > 65535) {
                errors.push('端口范围必须在 1-65535 之间');
            }
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }

    /**
     * Test local proxy connectivity
     * @param {Object} config - Proxy configuration
     * @param {string} config.host - Host address
     * @param {number} config.port - Port number
     * @param {string} [config.protocol] - Protocol (default: http)
     * @param {number} [timeout] - Timeout in milliseconds (default: 10000)
     * @returns {Promise<{success: boolean, latency?: number, error?: string}>}
     */
    static async testLocalProxy(config, timeout = 10000) {
        if (!config || !config.host || !config.port) {
            return {
                success: false,
                error: '代理配置无效'
            };
        }

        const proxyUrl = this.buildProxyUrl(config);
        const startTime = Date.now();

        try {
            // Use a simple HTTP request to test connectivity
            // We'll try to connect to a reliable endpoint
            const testUrl = 'http://www.gstatic.com/generate_204';
            
            const response = await axios.get(testUrl, {
                proxy: {
                    protocol: config.protocol || 'http',
                    host: config.host,
                    port: config.port
                },
                timeout: timeout,
                validateStatus: (status) => status >= 200 && status < 400
            });

            const latency = Date.now() - startTime;

            return {
                success: true,
                latency,
                statusCode: response.status
            };
        } catch (error) {
            const latency = Date.now() - startTime;
            
            let errorMessage = '连接失败';
            
            if (error.code === 'ECONNREFUSED') {
                errorMessage = '无法连接到本地代理，请确认代理客户端正在运行';
            } else if (error.code === 'ETIMEDOUT' || error.code === 'ECONNABORTED') {
                errorMessage = '连接超时，请检查网络';
            } else if (error.code === 'ENOTFOUND') {
                errorMessage = '无法解析主机地址';
            } else if (error.response) {
                errorMessage = `代理返回错误状态: ${error.response.status}`;
            } else if (error.message) {
                errorMessage = error.message;
            }

            return {
                success: false,
                latency,
                error: errorMessage,
                code: error.code
            };
        }
    }

    /**
     * Create a local proxy configuration from preset
     * @param {string} presetId - Preset ID
     * @param {number} [customPort] - Custom port (only used for 'custom' preset)
     * @returns {Object|null} Proxy configuration or null if invalid
     */
    static createConfigFromPreset(presetId, customPort) {
        const preset = this.getPreset(presetId);
        if (!preset) {
            return null;
        }

        const config = {
            enabled: true,
            presetId: preset.id,
            host: preset.host,
            port: presetId === 'custom' ? (customPort || 0) : preset.port,
            protocol: preset.protocol
        };

        return config;
    }
}

module.exports = LocalProxyManager;
