/**
 * Translation Proxy Adapter
 * 
 * Manages proxy configuration for translation services.
 * Supports three modes: 'always', 'auto', 'never'
 * 
 * - always: Always use proxy for translation requests
 * - auto: Automatically detect if translation service is blocked and use proxy if needed
 * - never: Never use proxy for translation requests
 * 
 * @module environment/TranslationProxyAdapter
 */

'use strict';

const LocalProxyManager = require('./LocalProxyManager');

/**
 * Translation proxy modes
 */
const ProxyMode = {
    ALWAYS: 'always',
    AUTO: 'auto',
    NEVER: 'never'
};

/**
 * Valid proxy modes array for validation
 */
const VALID_MODES = [ProxyMode.ALWAYS, ProxyMode.AUTO, ProxyMode.NEVER];

/**
 * Default configuration
 */
const DEFAULT_CONFIG = {
    mode: ProxyMode.AUTO,
    timeout: 10000,
    testUrl: 'https://translate.googleapis.com'
};

/**
 * Translation Proxy Adapter
 * Handles proxy configuration for translation services
 */
class TranslationProxyAdapter {
    /**
     * Current proxy configuration
     * @private
     */
    static _proxyConfig = null;

    /**
     * Current proxy mode
     * @private
     */
    static _mode = DEFAULT_CONFIG.mode;

    /**
     * Cached blocked status
     * @private
     */
    static _isBlocked = null;

    /**
     * Last blocked check timestamp
     * @private
     */
    static _lastBlockedCheck = null;

    /**
     * Blocked check cache duration (5 minutes)
     * @private
     */
    static _blockedCheckCacheDuration = 5 * 60 * 1000;

    /**
     * Configure translation service proxy settings
     * @param {Object|null} proxyConfig - Proxy configuration
     * @param {string} proxyConfig.host - Proxy host
     * @param {number} proxyConfig.port - Proxy port
     * @param {string} [proxyConfig.protocol] - Protocol (default: http)
     * @param {string} [proxyConfig.username] - Username (optional)
     * @param {string} [proxyConfig.password] - Password (optional)
     * @param {string} mode - Proxy mode: 'always', 'auto', 'never'
     * @returns {{success: boolean, error?: string}} Configuration result
     */
    static configure(proxyConfig, mode) {
        // Validate mode
        if (!mode || typeof mode !== 'string') {
            return {
                success: false,
                error: '代理模式不能为空'
            };
        }

        const normalizedMode = mode.toLowerCase().trim();
        
        if (!VALID_MODES.includes(normalizedMode)) {
            return {
                success: false,
                error: `无效的代理模式: ${mode}，有效值为: ${VALID_MODES.join(', ')}`
            };
        }

        // For 'never' mode, proxy config is not required
        if (normalizedMode === ProxyMode.NEVER) {
            this._proxyConfig = null;
            this._mode = normalizedMode;
            this._resetBlockedCache();
            return { success: true };
        }

        // For 'always' and 'auto' modes, validate proxy config
        if (!proxyConfig || !proxyConfig.host || !proxyConfig.port) {
            return {
                success: false,
                error: '代理配置无效：需要提供 host 和 port'
            };
        }

        // Validate proxy configuration
        const validation = LocalProxyManager.validateLocalProxy(
            proxyConfig.host,
            proxyConfig.port
        );

        if (!validation.valid) {
            return {
                success: false,
                error: '代理配置验证失败: ' + validation.errors.join(', ')
            };
        }

        // Store configuration
        this._proxyConfig = {
            host: proxyConfig.host,
            port: proxyConfig.port,
            protocol: proxyConfig.protocol || 'http',
            username: proxyConfig.username,
            password: proxyConfig.password
        };
        this._mode = normalizedMode;
        this._resetBlockedCache();

        return { success: true };
    }

    /**
     * Get current proxy configuration
     * @returns {Object|null} Current proxy configuration
     */
    static getProxyConfig() {
        return this._proxyConfig ? { ...this._proxyConfig } : null;
    }

    /**
     * Get current proxy mode
     * @returns {string} Current proxy mode
     */
    static getMode() {
        return this._mode;
    }

    /**
     * Check if proxy should be used for translation requests
     * Based on current mode and blocked status
     * @returns {Promise<boolean>} Whether to use proxy
     */
    static async shouldUseProxy() {
        switch (this._mode) {
            case ProxyMode.ALWAYS:
                return true;
            
            case ProxyMode.NEVER:
                return false;
            
            case ProxyMode.AUTO:
                // In auto mode, check if translation service is blocked
                return await this.detectBlocked();
            
            default:
                return false;
        }
    }

    /**
     * Detect if translation service is blocked
     * Uses cached result if available and not expired
     * @returns {Promise<boolean>} True if blocked
     */
    static async detectBlocked() {
        // Check cache
        if (this._isBlocked !== null && this._lastBlockedCheck !== null) {
            const cacheAge = Date.now() - this._lastBlockedCheck;
            if (cacheAge < this._blockedCheckCacheDuration) {
                return this._isBlocked;
            }
        }

        // Perform actual check
        try {
            const axios = require('axios');
            
            await axios.get(DEFAULT_CONFIG.testUrl, {
                timeout: DEFAULT_CONFIG.timeout,
                validateStatus: (status) => status >= 200 && status < 500
            });

            // If we can reach the service, it's not blocked
            this._isBlocked = false;
            this._lastBlockedCheck = Date.now();
            return false;

        } catch (error) {
            // Connection errors indicate the service might be blocked
            if (error.code === 'ECONNREFUSED' || 
                error.code === 'ETIMEDOUT' || 
                error.code === 'ECONNABORTED' ||
                error.code === 'ENOTFOUND' ||
                error.code === 'ENETUNREACH') {
                this._isBlocked = true;
                this._lastBlockedCheck = Date.now();
                return true;
            }

            // Other errors (like HTTP errors) don't necessarily mean blocked
            this._isBlocked = false;
            this._lastBlockedCheck = Date.now();
            return false;
        }
    }

    /**
     * Get proxy agent for HTTP requests
     * Returns null if proxy should not be used
     * @returns {Promise<Object|null>} Proxy agent or null
     */
    static async getProxyAgent() {
        const shouldUse = await this.shouldUseProxy();
        
        if (!shouldUse || !this._proxyConfig) {
            return null;
        }

        try {
            const { HttpsProxyAgent } = require('https-proxy-agent');
            const proxyUrl = LocalProxyManager.buildProxyUrl(this._proxyConfig);
            return new HttpsProxyAgent(proxyUrl);
        } catch (error) {
            console.error('[TranslationProxyAdapter] Failed to create proxy agent:', error);
            return null;
        }
    }

    /**
     * Reset blocked status cache
     * @private
     */
    static _resetBlockedCache() {
        this._isBlocked = null;
        this._lastBlockedCheck = null;
    }

    /**
     * Translate text using proxy
     * @param {string} text - Text to translate
     * @param {string} targetLang - Target language code
     * @param {Object} proxyConfig - Proxy configuration
     * @param {string} proxyConfig.host - Proxy host
     * @param {number} proxyConfig.port - Proxy port
     * @param {string} [proxyConfig.protocol] - Protocol (default: http)
     * @param {string} [proxyConfig.username] - Username (optional)
     * @param {string} [proxyConfig.password] - Password (optional)
     * @param {string} [sourceLang='auto'] - Source language code
     * @returns {Promise<{success: boolean, translatedText?: string, detectedLang?: string, error?: string}>}
     */
    static async translateWithProxy(text, targetLang, proxyConfig, sourceLang = 'auto') {
        // Validate inputs
        if (!text || typeof text !== 'string') {
            return {
                success: false,
                error: '翻译文本不能为空'
            };
        }

        if (!targetLang || typeof targetLang !== 'string') {
            return {
                success: false,
                error: '目标语言不能为空'
            };
        }

        if (!proxyConfig || !proxyConfig.host || !proxyConfig.port) {
            return {
                success: false,
                error: '代理配置无效：需要提供 host 和 port'
            };
        }

        // Validate proxy configuration
        const validation = LocalProxyManager.validateLocalProxy(
            proxyConfig.host,
            proxyConfig.port
        );

        if (!validation.valid) {
            return {
                success: false,
                error: '代理配置验证失败: ' + validation.errors.join(', ')
            };
        }

        try {
            const { HttpsProxyAgent } = require('https-proxy-agent');
            const https = require('https');
            const querystring = require('querystring');

            // Build proxy URL
            const proxyUrl = LocalProxyManager.buildProxyUrl(proxyConfig);
            const agent = new HttpsProxyAgent(proxyUrl);

            // Build Google Translate API request
            const params = {
                client: 'gtx',
                sl: sourceLang === 'auto' ? 'auto' : sourceLang,
                tl: targetLang,
                dt: 't',
                q: text
            };

            const path = `/translate_a/single?${querystring.stringify(params)}`;

            return new Promise((resolve) => {
                const options = {
                    hostname: 'translate.googleapis.com',
                    path: path,
                    method: 'GET',
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                    },
                    agent: agent,
                    timeout: DEFAULT_CONFIG.timeout
                };

                const req = https.request(options, (res) => {
                    let data = '';

                    res.on('data', (chunk) => {
                        data += chunk;
                    });

                    res.on('end', () => {
                        try {
                            if (res.statusCode !== 200) {
                                resolve({
                                    success: false,
                                    error: `HTTP ${res.statusCode}: ${data.substring(0, 100)}`
                                });
                                return;
                            }

                            const parsed = JSON.parse(data);
                            
                            // Google Translate API response format: [[["translated","original",null,null,3]],null,"en"]
                            let translatedText = '';
                            if (parsed && parsed[0]) {
                                for (const item of parsed[0]) {
                                    if (item[0]) {
                                        translatedText += item[0];
                                    }
                                }
                            }

                            // Decode HTML entities
                            translatedText = this._decodeHTMLEntities(translatedText);

                            const detectedLang = parsed[2] || sourceLang;

                            resolve({
                                success: true,
                                translatedText: translatedText || text,
                                detectedLang: detectedLang
                            });

                        } catch (error) {
                            resolve({
                                success: false,
                                error: `解析响应失败: ${error.message}`
                            });
                        }
                    });
                });

                req.on('error', (error) => {
                    let errorMessage = '网络错误';
                    if (error.code === 'ECONNREFUSED') {
                        errorMessage = '无法连接到代理服务器，请检查代理客户端是否已启动';
                    } else if (error.code === 'ETIMEDOUT' || error.code === 'ECONNABORTED') {
                        errorMessage = '连接超时，请检查网络';
                    } else if (error.code === 'ENOTFOUND') {
                        errorMessage = '无法解析代理服务器地址';
                    } else {
                        errorMessage = `网络错误: ${error.message}`;
                    }
                    
                    resolve({
                        success: false,
                        error: errorMessage
                    });
                });

                req.setTimeout(DEFAULT_CONFIG.timeout, () => {
                    req.destroy();
                    resolve({
                        success: false,
                        error: '请求超时'
                    });
                });

                req.end();
            });

        } catch (error) {
            return {
                success: false,
                error: `翻译请求失败: ${error.message}`
            };
        }
    }

    /**
     * Decode HTML entities in text
     * @private
     * @param {string} text - Text with HTML entities
     * @returns {string} Decoded text
     */
    static _decodeHTMLEntities(text) {
        if (!text) return text;
        
        let decoded = text;
        let prevDecoded;
        let iterations = 0;
        const maxIterations = 3;
        
        do {
            prevDecoded = decoded;
            decoded = decoded
                .replace(/&amp;/g, '&')
                .replace(/&lt;/g, '<')
                .replace(/&gt;/g, '>')
                .replace(/&quot;/g, '"')
                .replace(/&#x27;/g, "'")
                .replace(/&#39;/g, "'")
                .replace(/&#x2F;/g, '/')
                .replace(/&#47;/g, '/')
                .replace(/&apos;/g, "'");
            
            iterations++;
        } while (decoded !== prevDecoded && iterations < maxIterations);
        
        return decoded;
    }

    /**
     * Reset all configuration to defaults
     */
    static reset() {
        this._proxyConfig = null;
        this._mode = DEFAULT_CONFIG.mode;
        this._resetBlockedCache();
    }

    /**
     * Get configuration summary for display
     * @returns {Object} Configuration summary
     */
    static getConfigSummary() {
        return {
            mode: this._mode,
            hasProxyConfig: this._proxyConfig !== null,
            proxyHost: this._proxyConfig?.host || null,
            proxyPort: this._proxyConfig?.port || null,
            isBlocked: this._isBlocked,
            lastBlockedCheck: this._lastBlockedCheck
        };
    }
}

// Export class and constants
TranslationProxyAdapter.ProxyMode = ProxyMode;
TranslationProxyAdapter.VALID_MODES = VALID_MODES;
TranslationProxyAdapter.DEFAULT_CONFIG = DEFAULT_CONFIG;

module.exports = TranslationProxyAdapter;
