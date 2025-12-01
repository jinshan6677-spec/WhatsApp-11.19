/**
 * Environment Configuration Manager
 * 
 * Manages environment configurations (proxy + fingerprint) for each account.
 * Handles loading, saving, encryption, and validation of environment settings.
 * 
 * @module environment/EnvironmentConfigManager
 */

'use strict';

const Store = require('electron-store');
const { encryptFields, decryptFields } = require('../utils/encryption');

// Default environment configuration
const DEFAULT_CONFIG = {
    proxy: {
        enabled: false,
        configName: '',
        protocol: 'http',
        host: '',
        port: '',
        username: '',
        password: ''
    },
    fingerprint: {
        browser: 'chrome-108',
        os: 'windows',
        userAgent: '',
        webgl: {
            mode: 'real',
            vendor: 'Google Inc.',
            renderer: 'ANGLE (Intel, Intel(R) UHD Graphics Direct3D11 vs_5_0 ps_5_0)',
            image: 'real'
        },
        webrtc: {
            mode: 'real'
        },
        canvas: 'real',
        audio: 'real',
        clientRects: 'real',
        timezone: {
            mode: 'real',
            value: ''
        },
        geolocation: {
            mode: 'ask',
            latitude: null,
            longitude: null
        },
        language: {
            mode: 'real',
            value: ''
        },
        resolution: {
            mode: 'real',
            width: 1920,
            height: 1080
        },
        fonts: {
            mode: 'system'
        },
        deviceInfo: {
            name: {
                mode: 'real',
                value: ''
            },
            mac: {
                mode: 'real',
                value: ''
            },
            cpu: {
                mode: 'real',
                cores: 8
            },
            memory: {
                mode: 'real',
                size: 16
            }
        },
        hardware: {
            bluetooth: true,
            battery: 'real',
            portScanProtection: true
        },
        cookies: []
    }
};

// Fields to encrypt
const ENCRYPTED_FIELDS = ['password'];

/**
 * Environment Configuration Manager
 */
class EnvironmentConfigManager {
    constructor() {
        this.store = new Store({
            name: 'environment-configs',
            encryptionKey: 'whatsapp-env-config-key-v1'
        });
    }

    /**
     * Get environment configuration for an account
     * @param {string} accountId - Account ID
     * @returns {Object} Environment configuration
     */
    getConfig(accountId) {
        if (!accountId) {
            throw new Error('Account ID is required');
        }

        const config = this.store.get(`accounts.${accountId}`, null);

        if (!config) {
            return this._getDefaultConfig();
        }

        // Decrypt sensitive fields
        if (config.proxy && config.proxy.password) {
            config.proxy = decryptFields(config.proxy, ENCRYPTED_FIELDS);
        }

        // Merge with defaults to ensure all fields exist
        return this._mergeWithDefaults(config);
    }

    /**
     * Save environment configuration for an account
     * @param {string} accountId - Account ID
     * @param {Object} config - Environment configuration
     * @returns {boolean} Success status
     */
    saveConfig(accountId, config) {
        if (!accountId) {
            throw new Error('Account ID is required');
        }

        if (!config || typeof config !== 'object') {
            throw new Error('Invalid configuration object');
        }

        try {
            // Validate configuration
            this._validateConfig(config);

            // Create a copy to avoid modifying original
            const configToSave = JSON.parse(JSON.stringify(config));

            // Encrypt sensitive fields
            if (configToSave.proxy && configToSave.proxy.password) {
                configToSave.proxy = encryptFields(configToSave.proxy, ENCRYPTED_FIELDS);
            }

            // Save to store
            this.store.set(`accounts.${accountId}`, configToSave);

            console.log(`[EnvironmentConfigManager] Saved config for account ${accountId}`);
            return true;
        } catch (error) {
            console.error(`[EnvironmentConfigManager] Failed to save config for account ${accountId}:`, error);
            throw error;
        }
    }

    /**
     * Delete environment configuration for an account
     * @param {string} accountId - Account ID
     * @returns {boolean} Success status
     */
    deleteConfig(accountId) {
        if (!accountId) {
            throw new Error('Account ID is required');
        }

        try {
            this.store.delete(`accounts.${accountId}`);
            console.log(`[EnvironmentConfigManager] Deleted config for account ${accountId}`);
            return true;
        } catch (error) {
            console.error(`[EnvironmentConfigManager] Failed to delete config for account ${accountId}:`, error);
            return false;
        }
    }

    /**
     * Get all account IDs with environment configurations
     * @returns {string[]} Array of account IDs
     */
    getAllAccountIds() {
        const accounts = this.store.get('accounts', {});
        return Object.keys(accounts);
    }

    /**
     * Clear all environment configurations
     * @returns {boolean} Success status
     */
    clearAll() {
        try {
            this.store.clear();
            console.log('[EnvironmentConfigManager] Cleared all configurations');
            return true;
        } catch (error) {
            console.error('[EnvironmentConfigManager] Failed to clear configurations:', error);
            return false;
        }
    }

    /**
     * Get default configuration
     * @returns {Object} Default environment configuration
     * @private
     */
    _getDefaultConfig() {
        return JSON.parse(JSON.stringify(DEFAULT_CONFIG));
    }

    /**
     * Merge configuration with defaults
     * @param {Object} config - Configuration to merge
     * @returns {Object} Merged configuration
     * @private
     */
    _mergeWithDefaults(config) {
        const defaults = this._getDefaultConfig();

        return {
            proxy: { ...defaults.proxy, ...(config.proxy || {}) },
            fingerprint: this._deepMerge(defaults.fingerprint, config.fingerprint || {})
        };
    }

    /**
     * Deep merge two objects
     * @param {Object} target - Target object
     * @param {Object} source - Source object
     * @returns {Object} Merged object
     * @private
     */
    _deepMerge(target, source) {
        const result = { ...target };

        for (const key in source) {
            if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
                result[key] = this._deepMerge(target[key] || {}, source[key]);
            } else {
                result[key] = source[key];
            }
        }

        return result;
    }

    /**
     * Validate configuration structure
     * @param {Object} config - Configuration to validate
     * @throws {Error} If configuration is invalid
     * @private
     */
    _validateConfig(config) {
        if (!config.proxy || typeof config.proxy !== 'object') {
            throw new Error('Invalid proxy configuration');
        }

        if (!config.fingerprint || typeof config.fingerprint !== 'object') {
            throw new Error('Invalid fingerprint configuration');
        }

        // Validate proxy fields
        if (config.proxy.enabled) {
            if (config.proxy.protocol && !['http', 'https', 'socks5'].includes(config.proxy.protocol)) {
                throw new Error('Invalid proxy protocol');
            }
        }

        // Validate fingerprint fields
        if (config.fingerprint.browser && typeof config.fingerprint.browser !== 'string') {
            throw new Error('Invalid browser type');
        }

        if (config.fingerprint.os && !['windows', 'macos'].includes(config.fingerprint.os)) {
            throw new Error('Invalid OS type');
        }

        return true;
    }
}

module.exports = EnvironmentConfigManager;
