/**
 * IPC Handlers for Proxy Configuration using IPCRouter
 * 
 * Migrates proxy IPC handlers to the new IPCRouter pattern with
 * request validation and structured error handling.
 * 
 * @module ipc/proxyIPCHandlersRouter
 */

'use strict';

const { EventSchema } = require('../core/eventbus/EventSchema');

/**
 * Schema definitions for proxy IPC requests
 */
const ProxySchemas = {
  // Schema for get-config request
  getConfig: {
    type: 'object',
    properties: {
      id: { type: 'string', required: true }
    },
    required: ['id']
  },
  
  // Schema for save-config request
  saveConfig: {
    type: 'object',
    properties: {
      id: { type: 'string' },
      name: { type: 'string' },
      protocol: { type: 'string', enum: ['http', 'https', 'socks5'] },
      host: { type: 'string', required: true },
      port: { type: 'number', required: true, minimum: 1, maximum: 65535 },
      username: { type: 'string' },
      password: { type: 'string' },
      enabled: { type: 'boolean' }
    },
    required: ['host', 'port']
  },
  
  // Schema for delete-config request
  deleteConfig: {
    type: 'object',
    properties: {
      id: { type: 'string', required: true }
    },
    required: ['id']
  },
  
  // Schema for test-service request
  testService: {
    type: 'object',
    properties: {
      protocol: { type: 'string' },
      host: { type: 'string', required: true },
      port: { type: 'number', required: true },
      username: { type: 'string' },
      password: { type: 'string' }
    },
    required: ['host', 'port']
  }
};


/**
 * Register proxy IPC handlers with IPCRouter
 * @param {IPCRouter} ipcRouter - IPCRouter instance
 * @param {ProxyConfigManager} proxyConfigManager - Proxy configuration manager
 * @param {ProxyDetectionService} proxyDetectionService - Proxy detection service
 */
function registerProxyIPCHandlersWithRouter(ipcRouter, proxyConfigManager, proxyDetectionService) {
  if (!ipcRouter) {
    throw new Error('IPCRouter is required');
  }
  if (!proxyConfigManager) {
    throw new Error('ProxyConfigManager is required');
  }
  if (!proxyDetectionService) {
    throw new Error('ProxyDetectionService is required');
  }

  /**
   * Get all proxy configurations
   * Channel: proxy:get-all-configs
   */
  ipcRouter.register('proxy:get-all-configs', async (request, context) => {
    const configs = await proxyConfigManager.getAllProxyConfigs(true);
    return {
      success: true,
      configs: configs.map(config => config.toJSON ? config.toJSON() : config)
    };
  }, {
    description: 'Get all proxy configurations with decrypted passwords'
  });

  /**
   * Get a single proxy configuration
   * Channel: proxy:get-config
   */
  ipcRouter.register('proxy:get-config', async (request, context) => {
    const { id } = request.payload;
    
    if (!id) {
      return {
        success: false,
        error: 'Proxy config ID is required'
      };
    }

    const config = await proxyConfigManager.getProxyConfig(id, true);
    
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
  }, {
    description: 'Get a single proxy configuration by ID',
    schema: ProxySchemas.getConfig
  });

  /**
   * Save proxy configuration
   * Channel: proxy:save-config
   */
  ipcRouter.register('proxy:save-config', async (request, context) => {
    const config = request.payload;
    
    if (!config) {
      return {
        success: false,
        errors: ['Proxy configuration is required']
      };
    }

    const result = await proxyConfigManager.saveProxyConfig(config);
    return result;
  }, {
    description: 'Save a proxy configuration',
    schema: ProxySchemas.saveConfig
  });

  /**
   * Delete proxy configuration
   * Channel: proxy:delete-config
   */
  ipcRouter.register('proxy:delete-config', async (request, context) => {
    const { id } = request.payload;
    
    if (!id) {
      return {
        success: false,
        errors: ['Proxy config ID is required']
      };
    }

    const result = await proxyConfigManager.deleteProxyConfig(id);
    return result;
  }, {
    description: 'Delete a proxy configuration by ID',
    schema: ProxySchemas.deleteConfig
  });


  /**
   * Test proxy service
   * Channel: proxy:test-service
   */
  ipcRouter.register('proxy:test-service', async (request, context) => {
    const config = request.payload;
    
    if (!config) {
      return {
        success: false,
        error: 'Proxy configuration is required'
      };
    }

    // Validate configuration
    const validation = proxyDetectionService.validateProxyConfig(config);
    if (!validation.valid) {
      return {
        success: false,
        error: validation.errors.join(', ')
      };
    }

    // Test proxy
    const result = await proxyDetectionService.testProxy(config);
    return result;
  }, {
    description: 'Test a proxy configuration',
    schema: ProxySchemas.testService,
    defaultTimeout: 60000 // 60 second timeout for proxy testing
  });

  /**
   * Test current network
   * Channel: proxy:test-network
   */
  ipcRouter.register('proxy:test-network', async (request, context) => {
    console.log('[IPCRouter] Testing current network');
    const result = await proxyDetectionService.getCurrentNetworkInfo();
    console.log('[IPCRouter] Network test result:', JSON.stringify(result));
    return result;
  }, {
    description: 'Test current network connectivity',
    defaultTimeout: 30000
  });

  /**
   * Generate proxy config name
   * Channel: proxy:generate-name
   */
  ipcRouter.register('proxy:generate-name', async (request, context) => {
    const config = request.payload;
    
    if (!config) {
      return {
        success: false,
        error: 'Proxy configuration is required'
      };
    }

    const name = proxyConfigManager.generateConfigName(config);
    return {
      success: true,
      name
    };
  }, {
    description: 'Generate a name for a proxy configuration'
  });

  /**
   * Validate proxy config
   * Channel: proxy:validate-config
   */
  ipcRouter.register('proxy:validate-config', async (request, context) => {
    const config = request.payload;
    
    if (!config) {
      return {
        success: false,
        error: 'Proxy configuration is required'
      };
    }

    const validation = proxyConfigManager.validateProxyConfig(config);
    return {
      success: true,
      validation
    };
  }, {
    description: 'Validate a proxy configuration'
  });

  console.log('[IPCRouter] Proxy IPC handlers registered');
}

/**
 * Unregister proxy IPC handlers from IPCRouter
 * @param {IPCRouter} ipcRouter - IPCRouter instance
 */
function unregisterProxyIPCHandlersFromRouter(ipcRouter) {
  if (!ipcRouter) {
    return;
  }

  const channels = [
    'proxy:get-all-configs',
    'proxy:get-config',
    'proxy:save-config',
    'proxy:delete-config',
    'proxy:test-service',
    'proxy:test-network',
    'proxy:generate-name',
    'proxy:validate-config'
  ];

  for (const channel of channels) {
    ipcRouter.unregister(channel);
  }

  console.log('[IPCRouter] Proxy IPC handlers unregistered');
}

module.exports = {
  registerProxyIPCHandlersWithRouter,
  unregisterProxyIPCHandlersFromRouter,
  ProxySchemas
};
