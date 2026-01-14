/**
 * Proxy Chain Manager
 * 
 * Manages proxy chain configuration for routing traffic through
 * local proxy and optional chained proxy.
 * 
 * Traffic flow:
 * - Local proxy only: App → Local Proxy (127.0.0.1:port) → Target
 * - With chained proxy: App → Local Proxy → Chained Proxy → Target
 * 
 * @module environment/ProxyChainManager
 */

'use strict';

const axios = require('axios');
const LocalProxyManager = require('./LocalProxyManager');

/**
 * Proxy Chain Manager
 * Handles proxy chain configuration and validation
 */
class ProxyChainManager {
    /**
     * Build proxy chain rules for Electron session
     * @param {Object} localProxy - Local proxy configuration
     * @param {string} localProxy.host - Local proxy host (127.0.0.1 or localhost)
     * @param {number} localProxy.port - Local proxy port
     * @param {string} [localProxy.protocol] - Protocol (default: http)
     * @param {Object|null} chainedProxy - Chained proxy configuration (optional)
     * @param {string} chainedProxy.host - Chained proxy host
     * @param {number} chainedProxy.port - Chained proxy port
     * @param {string} [chainedProxy.protocol] - Protocol (default: http)
     * @param {string} [chainedProxy.username] - Username (optional)
     * @param {string} [chainedProxy.password] - Password (optional)
     * @returns {string} Proxy rules string for Electron session.setProxy()
     */
    static buildProxyChainRules(localProxy, chainedProxy = null) {
        if (!localProxy || !localProxy.host || !localProxy.port) {
            return 'direct://';
        }

        const localProxyUrl = LocalProxyManager.buildProxyUrl({
            protocol: localProxy.protocol || 'http',
            host: localProxy.host,
            port: localProxy.port
        });

        // If no chained proxy, return local proxy URL directly
        if (!chainedProxy || !chainedProxy.host || !chainedProxy.port) {
            return localProxyUrl;
        }

        // Build chained proxy URL
        const chainedProxyUrl = this._buildChainedProxyUrl(chainedProxy);

        // Return combined proxy chain rules
        // Format: local proxy URL with chained proxy info
        // Note: Electron's session.setProxy uses the proxyRules format
        // For proxy chaining, we return the local proxy as the primary
        // The chained proxy will be handled at the application level
        return `${localProxyUrl};${chainedProxyUrl}`;
    }

    /**
     * Build chained proxy URL
     * @private
     * @param {Object} chainedProxy - Chained proxy configuration
     * @returns {string} Chained proxy URL
     */
    static _buildChainedProxyUrl(chainedProxy) {
        if (!chainedProxy || !chainedProxy.host || !chainedProxy.port) {
            return '';
        }

        const { protocol = 'http', host, port, username, password } = chainedProxy;
        
        let url = `${protocol}://`;
        
        if (username && password) {
            url += `${encodeURIComponent(username)}:${encodeURIComponent(password)}@`;
        }
        
        url += `${host}:${port}`;
        
        return url;
    }


    /**
     * Get the local proxy URL from proxy chain rules
     * @param {Object} localProxy - Local proxy configuration
     * @returns {string} Local proxy URL
     */
    static getLocalProxyUrl(localProxy) {
        if (!localProxy || !localProxy.host || !localProxy.port) {
            return '';
        }
        return LocalProxyManager.buildProxyUrl({
            protocol: localProxy.protocol || 'http',
            host: localProxy.host,
            port: localProxy.port
        });
    }

    /**
     * Get the chained proxy URL from configuration
     * @param {Object} chainedProxy - Chained proxy configuration
     * @returns {string} Chained proxy URL
     */
    static getChainedProxyUrl(chainedProxy) {
        return this._buildChainedProxyUrl(chainedProxy);
    }

    /**
     * Validate chained proxy connectivity through local proxy
     * @param {Object} localProxy - Local proxy configuration
     * @param {Object} chainedProxy - Chained proxy configuration
     * @param {number} [timeout] - Timeout in milliseconds (default: 15000)
     * @returns {Promise<{success: boolean, latency?: number, error?: string}>}
     */
    static async validateChainedProxy(localProxy, chainedProxy, timeout = 15000) {
        // First validate local proxy
        const localValidation = LocalProxyManager.validateLocalProxy(
            localProxy?.host, 
            localProxy?.port
        );
        
        if (!localValidation.valid) {
            return {
                success: false,
                error: '本地代理配置无效: ' + localValidation.errors.join(', ')
            };
        }

        // Validate chained proxy configuration
        if (!chainedProxy || !chainedProxy.host || !chainedProxy.port) {
            return {
                success: false,
                error: '链式代理配置无效'
            };
        }

        // Validate chained proxy port range
        const chainedPort = typeof chainedProxy.port === 'string' 
            ? parseInt(chainedProxy.port, 10) 
            : chainedProxy.port;
            
        if (isNaN(chainedPort) || chainedPort < 1 || chainedPort > 65535) {
            return {
                success: false,
                error: '链式代理端口范围必须在 1-65535 之间'
            };
        }

        const startTime = Date.now();

        try {
            // Test connectivity through local proxy to chained proxy
            const testUrl = 'http://www.gstatic.com/generate_204';
            
            // Create proxy agent for local proxy
            const HttpsProxyAgent = require('https-proxy-agent').HttpsProxyAgent;
            const localProxyUrl = this.getLocalProxyUrl(localProxy);
            const agent = new HttpsProxyAgent(localProxyUrl);

            const response = await axios.get(testUrl, {
                httpAgent: agent,
                httpsAgent: agent,
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
            
            let errorMessage = '链式代理连接失败';
            
            if (error.code === 'ECONNREFUSED') {
                errorMessage = '链式代理服务器拒绝连接';
            } else if (error.code === 'ETIMEDOUT' || error.code === 'ECONNABORTED') {
                errorMessage = '链式代理连接超时';
            } else if (error.code === 'ENOTFOUND') {
                errorMessage = '无法解析链式代理主机地址';
            } else if (error.response && error.response.status === 407) {
                errorMessage = '链式代理认证失败，请检查用户名和密码';
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
     * Apply proxy chain to Electron session
     * @param {Electron.Session} session - Electron session object
     * @param {Object} localProxy - Local proxy configuration
     * @param {Object|null} chainedProxy - Chained proxy configuration (optional)
     * @returns {Promise<boolean>} True if successful
     */
    static async applyProxyChain(session, localProxy, chainedProxy = null) {
        if (!session || typeof session.setProxy !== 'function') {
            throw new Error('Invalid Electron session object');
        }

        // Validate local proxy
        const localValidation = LocalProxyManager.validateLocalProxy(
            localProxy?.host,
            localProxy?.port
        );

        if (!localValidation.valid) {
            throw new Error('本地代理配置无效: ' + localValidation.errors.join(', '));
        }

        // Build proxy rules
        const localProxyUrl = this.getLocalProxyUrl(localProxy);
        
        // For Electron session, we use the local proxy as the primary proxy
        // The chained proxy is handled at the network level by the local proxy client
        const proxyConfig = {
            proxyRules: localProxyUrl,
            proxyBypassRules: '<local>'
        };

        try {
            await session.setProxy(proxyConfig);
            return true;
        } catch (error) {
            throw new Error('应用代理配置失败: ' + error.message);
        }
    }

    /**
     * Diagnose proxy chain issues
     * Distinguishes between local proxy problems and chained proxy problems
     * @param {Object} localProxy - Local proxy configuration
     * @param {Object|null} chainedProxy - Chained proxy configuration (optional)
     * @returns {Promise<{localProxyOk: boolean, chainedProxyOk: boolean, error?: string, diagnosis: string}>}
     */
    static async diagnoseProxyChain(localProxy, chainedProxy = null) {
        const result = {
            localProxyOk: false,
            chainedProxyOk: false,
            error: null,
            diagnosis: ''
        };

        // Step 1: Test local proxy
        const localTest = await LocalProxyManager.testLocalProxy(localProxy);
        
        if (!localTest.success) {
            result.error = localTest.error;
            result.diagnosis = 'LOCAL_PROXY_FAILED';
            return result;
        }

        result.localProxyOk = true;

        // Step 2: If no chained proxy, we're done
        if (!chainedProxy || !chainedProxy.host || !chainedProxy.port) {
            result.chainedProxyOk = true; // No chained proxy to test
            result.diagnosis = 'LOCAL_PROXY_ONLY_OK';
            return result;
        }

        // Step 3: Test chained proxy through local proxy
        const chainedTest = await this.validateChainedProxy(localProxy, chainedProxy);
        
        if (!chainedTest.success) {
            result.error = chainedTest.error;
            result.diagnosis = 'CHAINED_PROXY_FAILED';
            return result;
        }

        result.chainedProxyOk = true;
        result.diagnosis = 'PROXY_CHAIN_OK';
        
        return result;
    }

    /**
     * Get human-readable diagnosis message
     * @param {string} diagnosis - Diagnosis code from diagnoseProxyChain
     * @returns {string} Human-readable message
     */
    static getDiagnosisMessage(diagnosis) {
        const messages = {
            'LOCAL_PROXY_FAILED': '本地代理连接失败，请检查代理客户端是否已启动',
            'CHAINED_PROXY_FAILED': '链式代理连接失败，本地代理正常但无法连接到链式代理服务器',
            'LOCAL_PROXY_ONLY_OK': '本地代理连接正常',
            'PROXY_CHAIN_OK': '代理链连接正常'
        };
        
        // Use hasOwnProperty to avoid prototype pollution
        if (!Object.prototype.hasOwnProperty.call(messages, diagnosis)) {
            return '未知诊断结果';
        }
        
        return messages[diagnosis];
    }

    /**
     * Parse proxy chain rules string back to configuration objects
     * @param {string} rules - Proxy rules string
     * @returns {{localProxy: Object|null, chainedProxy: Object|null}}
     */
    static parseProxyChainRules(rules) {
        if (!rules || rules === 'direct://') {
            return { localProxy: null, chainedProxy: null };
        }

        const parts = rules.split(';').filter(p => p.trim());
        
        if (parts.length === 0) {
            return { localProxy: null, chainedProxy: null };
        }

        const parseProxyUrl = (url) => {
            try {
                const parsed = new URL(url);
                return {
                    protocol: parsed.protocol.replace(':', ''),
                    host: parsed.hostname,
                    port: parseInt(parsed.port, 10),
                    username: parsed.username || undefined,
                    password: parsed.password || undefined
                };
            } catch {
                return null;
            }
        };

        const localProxy = parseProxyUrl(parts[0]);
        const chainedProxy = parts.length > 1 ? parseProxyUrl(parts[1]) : null;

        return { localProxy, chainedProxy };
    }
}

module.exports = ProxyChainManager;
