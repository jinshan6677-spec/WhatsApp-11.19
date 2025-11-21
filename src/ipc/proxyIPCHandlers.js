/**
 * IPC Handlers for Proxy Configuration
 * 
 * Handles IPC communication for proxy configuration management and detection
 */

const { ipcMain } = require('electron');

/**
 * Register IPC handlers for proxy configuration
 * @param {ProxyConfigManager} proxyConfigManager - Proxy configuration manager
 * @param {ProxyDetectionService} proxyDetectionService - Proxy detection service
 */
function registerProxyIPCHandlers(proxyConfigManager, proxyDetectionService) {
  if (!proxyConfigManager) {
    throw new Error('ProxyConfigManager is required');
  }
  if (!proxyDetectionService) {
    throw new Error('ProxyDetectionService is required');
  }

  /**
   * Get all proxy configurations
   * Handler: proxy:get-all-configs
   */
  ipcMain.handle('proxy:get-all-configs', async () => {
    try {
      const configs = await proxyConfigManager.getAllProxyConfigs(true); // 解密密码
      return {
        success: true,
        configs: configs.map(config => config.toJSON ? config.toJSON() : config)
      };
    } catch (error) {
      console.error('[IPC] Failed to get proxy configs:', error);
      return {
        success: false,
        error: error.message,
        configs: []
      };
    }
  });

  /**
   * Get a single proxy configuration
   * Handler: proxy:get-config
   */
  ipcMain.handle('proxy:get-config', async (event, id) => {
    try {
      if (!id) {
        throw new Error('Proxy config ID is required');
      }

      const config = await proxyConfigManager.getProxyConfig(id, true); // 解密密码
      
      if (!config) {
        return {
          success: false,
          error: 'Proxy configuration not found'
        };
      }

      return {
        success: true,
        config: config.toJSON ? config.toJSON() : config
      };
    } catch (error) {
      console.error('[IPC] Failed to get proxy config:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });

  /**
   * Save proxy configuration
   * Handler: proxy:save-config
   */
  ipcMain.handle('proxy:save-config', async (event, config) => {
    try {
      if (!config) {
        throw new Error('Proxy configuration is required');
      }

      const result = await proxyConfigManager.saveProxyConfig(config);
      
      return result;
    } catch (error) {
      console.error('[IPC] Failed to save proxy config:', error);
      return {
        success: false,
        errors: [error.message]
      };
    }
  });

  /**
   * Delete proxy configuration
   * Handler: proxy:delete-config
   */
  ipcMain.handle('proxy:delete-config', async (event, id) => {
    try {
      if (!id) {
        throw new Error('Proxy config ID is required');
      }

      const result = await proxyConfigManager.deleteProxyConfig(id);
      
      return result;
    } catch (error) {
      console.error('[IPC] Failed to delete proxy config:', error);
      return {
        success: false,
        errors: [error.message]
      };
    }
  });

  /**
   * Test proxy service
   * Handler: proxy:test-service
   */
  ipcMain.handle('proxy:test-service', async (event, config) => {
    try {
      if (!config) {
        throw new Error('Proxy configuration is required');
      }

      // 验证配置
      const validation = proxyDetectionService.validateProxyConfig(config);
      if (!validation.valid) {
        return {
          success: false,
          error: validation.errors.join(', ')
        };
      }

      // 测试代理
      const result = await proxyDetectionService.testProxy(config);
      
      return result;
    } catch (error) {
      console.error('[IPC] Failed to test proxy:', error);
      return {
        success: false,
        error: error.message,
        timestamp: new Date()
      };
    }
  });

  /**
   * Test current network
   * Handler: proxy:test-network
   */
  ipcMain.handle('proxy:test-network', async () => {
    try {
      console.log('[IPC] 开始测试当前网络');
      const result = await proxyDetectionService.getCurrentNetworkInfo();
      console.log('[IPC] 网络检测结果:', JSON.stringify(result));
      
      return result;
    } catch (error) {
      console.error('[IPC] Failed to test network:', error);
      return {
        success: false,
        error: error.message,
        timestamp: new Date()
      };
    }
  });

  /**
   * Generate proxy config name
   * Handler: proxy:generate-name
   */
  ipcMain.handle('proxy:generate-name', async (event, config) => {
    try {
      if (!config) {
        throw new Error('Proxy configuration is required');
      }

      const name = proxyConfigManager.generateConfigName(config);
      
      return {
        success: true,
        name
      };
    } catch (error) {
      console.error('[IPC] Failed to generate proxy name:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });

  /**
   * Validate proxy config
   * Handler: proxy:validate-config
   */
  ipcMain.handle('proxy:validate-config', async (event, config) => {
    try {
      if (!config) {
        throw new Error('Proxy configuration is required');
      }

      const validation = proxyConfigManager.validateProxyConfig(config);
      
      return {
        success: true,
        validation
      };
    } catch (error) {
      console.error('[IPC] Failed to validate proxy config:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });

  console.log('[IPC] Proxy IPC handlers registered');
}

/**
 * Unregister IPC handlers for proxy configuration
 */
function unregisterProxyIPCHandlers() {
  ipcMain.removeHandler('proxy:get-all-configs');
  ipcMain.removeHandler('proxy:get-config');
  ipcMain.removeHandler('proxy:save-config');
  ipcMain.removeHandler('proxy:delete-config');
  ipcMain.removeHandler('proxy:test-service');
  ipcMain.removeHandler('proxy:test-network');
  ipcMain.removeHandler('proxy:generate-name');
  ipcMain.removeHandler('proxy:validate-config');
  
  console.log('[IPC] Proxy IPC handlers unregistered');
}

module.exports = {
  registerProxyIPCHandlers,
  unregisterProxyIPCHandlers
};
