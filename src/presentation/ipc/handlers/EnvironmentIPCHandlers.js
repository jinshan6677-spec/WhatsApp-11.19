/**
 * Environment IPC Handlers
 * 
 * Handles IPC communication for environment settings (proxy).
 * Provides handlers for configuration management and proxy testing.
 * 
 * Note: Fingerprint IPC handlers have been removed as part of the professional
 * fingerprint system refactoring. New fingerprint IPC handlers will be added
 * when the new fingerprint system is implemented.
 * 
 * @module presentation/ipc/handlers/EnvironmentIPCHandlers
 */

'use strict';

const { ipcMain } = require('electron');
const {
    EnvironmentConfigManager,
    ProxyManager,
    ProxyConfigStore,
    ProxyValidator
} = require('../../../environment');

// Singleton instances
let envConfigManager = null;
let proxyConfigStore = null;

/**
 * Get or create EnvironmentConfigManager instance
 * @returns {EnvironmentConfigManager}
 */
function getEnvConfigManager() {
    if (!envConfigManager) {
        envConfigManager = new EnvironmentConfigManager();
    }
    return envConfigManager;
}

/**
 * Get or create ProxyConfigStore instance
 * @returns {ProxyConfigStore}
 */
function getProxyConfigStore() {
    if (!proxyConfigStore) {
        proxyConfigStore = new ProxyConfigStore();
    }
    return proxyConfigStore;
}

/**
 * Register environment IPC handlers
 * @param {Object} dependencies - Dependencies
 */
function register(dependencies) {
    console.log('[EnvironmentIPCHandlers] Registering handlers');

    // Get environment configuration for an account
    ipcMain.handle('env:get-config', async (event, accountId) => {
        try {
            if (!accountId) {
                return { success: false, error: 'Account ID is required' };
            }

            const manager = getEnvConfigManager();
            const config = manager.getConfig(accountId);

            return {
                success: true,
                config: config
            };
        } catch (error) {
            console.error('[EnvironmentIPCHandlers] env:get-config error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    });

    // Save environment configuration for an account
    ipcMain.handle('env:save-config', async (event, accountId, config) => {
        try {
            if (!accountId) {
                return { success: false, error: 'Account ID is required' };
            }

            if (!config) {
                return { success: false, error: 'Configuration is required' };
            }

            const manager = getEnvConfigManager();
            manager.saveConfig(accountId, config);

            return {
                success: true,
                message: 'Configuration saved successfully'
            };
        } catch (error) {
            console.error('[EnvironmentIPCHandlers] env:save-config error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    });

    // Test proxy connectivity
    ipcMain.handle('env:test-proxy', async (event, proxyConfig) => {
        try {
            if (!proxyConfig) {
                return { success: false, error: 'Proxy configuration is required' };
            }

            const result = await ProxyValidator.testProxy(proxyConfig, 15000);

            return result;
        } catch (error) {
            console.error('[EnvironmentIPCHandlers] env:test-proxy error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    });

    // Detect current network information
    ipcMain.handle('env:detect-network', async (event) => {
        try {
            const result = await ProxyValidator.getCurrentNetwork(15000);

            return result;
        } catch (error) {
            console.error('[EnvironmentIPCHandlers] env:detect-network error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    });

    // Note: env:generate-fingerprint handler removed as part of fingerprint system refactoring
    // New fingerprint handlers will be added in the new fingerprint system implementation

    // Get list of saved proxy configurations
    ipcMain.handle('env:get-proxy-configs', async (event) => {
        try {
            const store = getProxyConfigStore();
            const configs = store.getProxyConfigs();

            return {
                success: true,
                configs: configs
            };
        } catch (error) {
            console.error('[EnvironmentIPCHandlers] env:get-proxy-configs error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    });

    // Save a named proxy configuration
    ipcMain.handle('env:save-proxy-config', async (event, name, config) => {
        try {
            if (!name) {
                return { success: false, error: 'Configuration name is required' };
            }

            if (!config) {
                return { success: false, error: 'Proxy configuration is required' };
            }

            const store = getProxyConfigStore();
            store.saveProxyConfig(name, config);

            return {
                success: true,
                message: 'Proxy configuration saved successfully'
            };
        } catch (error) {
            console.error('[EnvironmentIPCHandlers] env:save-proxy-config error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    });

    // Delete a saved proxy configuration
    ipcMain.handle('env:delete-proxy-config', async (event, name) => {
        try {
            if (!name) {
                return { success: false, error: 'Configuration name is required' };
            }

            const store = getProxyConfigStore();
            const deleted = store.deleteProxyConfig(name);

            if (deleted) {
                return {
                    success: true,
                    message: 'Proxy configuration deleted successfully'
                };
            } else {
                return {
                    success: false,
                    error: 'Failed to delete proxy configuration'
                };
            }
        } catch (error) {
            console.error('[EnvironmentIPCHandlers] env:delete-proxy-config error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    });

    // Get IP geolocation data
    ipcMain.handle('env:get-ip-geolocation', async (event, ip) => {
        try {
            if (!ip) {
                return { success: false, error: 'IP address is required' };
            }

            const result = await ProxyValidator.getIPGeolocation(ip, 15000);

            return result;
        } catch (error) {
            console.error('[EnvironmentIPCHandlers] env:get-ip-geolocation error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    });

    // Parse proxy string (smart paste)
    ipcMain.handle('env:parse-proxy-string', async (event, proxyString) => {
        try {
            if (!proxyString) {
                return { success: false, error: 'Proxy string is required' };
            }

            const config = ProxyManager.parseProxyString(proxyString);

            if (config) {
                return {
                    success: true,
                    config: config
                };
            } else {
                return {
                    success: false,
                    error: 'Invalid proxy string format'
                };
            }
        } catch (error) {
            console.error('[EnvironmentIPCHandlers] env:parse-proxy-string error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    });

    console.log('[EnvironmentIPCHandlers] Handlers registered successfully');
}

/**
 * Unregister environment IPC handlers
 */
function unregister() {
    console.log('[EnvironmentIPCHandlers] Unregistering handlers');

    ipcMain.removeHandler('env:get-config');
    ipcMain.removeHandler('env:save-config');
    ipcMain.removeHandler('env:test-proxy');
    ipcMain.removeHandler('env:detect-network');
    // Note: env:generate-fingerprint removed as part of fingerprint system refactoring
    ipcMain.removeHandler('env:get-proxy-configs');
    ipcMain.removeHandler('env:save-proxy-config');
    ipcMain.removeHandler('env:delete-proxy-config');
    ipcMain.removeHandler('env:get-ip-geolocation');
    ipcMain.removeHandler('env:parse-proxy-string');

    console.log('[EnvironmentIPCHandlers] Handlers unregistered successfully');
}

module.exports = {
    register,
    unregister
};
