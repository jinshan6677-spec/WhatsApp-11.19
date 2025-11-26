/**
 * Proxy IPC Handlers (Enhanced with Security Features)
 * 
 * Handles IPC communication for proxy configuration and security management.
 * This module integrates with the new proxy security infrastructure.
 * 
 * Existing IPC channels (8 total - preserved):
 * - proxy:get-all-configs - Get all proxy configurations
 * - proxy:get-config - Get a single proxy configuration by ID
 * - proxy:save-config - Save/update a proxy configuration
 * - proxy:delete-config - Delete a proxy configuration
 * - proxy:test-service - Test proxy connectivity (enhanced with exit IP and security checks)
 * - proxy:test-network - Test current network status
 * - proxy:generate-name - Generate a name for proxy configuration
 * - proxy:validate-config - Validate proxy configuration
 * 
 * New Security IPC channels (7 total):
 * - proxy:secure-connect - Secure connection with pre-check and IP verification
 * - proxy:secure-disconnect - Secure disconnection with cleanup
 * - proxy:health-status - Get proxy health monitoring status
 * - proxy:kill-switch-status - Get Kill-Switch activation status
 * - proxy:reconnect - Manual reconnection trigger
 * - proxy:reconnection-status - Get reconnection attempt status
 * - proxy:switch-proxy - Smooth proxy switching with rollback support
 * 
 * @module presentation/ipc/handlers/ProxyIPCHandlers
 * @requires electron
 * @requires ../../application/services/ProxyService
 * @requires ../../infrastructure/repositories/ProxyRepository
 */

'use strict';

const { ipcMain } = require('electron');

// Store references for cleanup
let _proxyConfigManager = null;
let _proxyDetectionService = null;
let _proxyService = null;
let _proxyRepository = null;
let _eventBus = null;

/**
 * Creates a structured error response
 * @private
 * @param {string} code - Error code
 * @param {string} message - Error message
 * @param {Object} [context] - Additional context
 * @returns {Object} Structured error response
 */
function createErrorResponse(code, message, context = {}) {
  return {
    success: false,
    error: {
      code,
      message,
      context,
      timestamp: new Date().toISOString()
    }
  };
}

/**
 * Creates a success response
 * @private
 * @param {Object} data - Response data
 * @returns {Object} Success response
 */
function createSuccessResponse(data = {}) {
  return {
    success: true,
    ...data,
    timestamp: new Date().toISOString()
  };
}

/**
 * Validates required parameters
 * @private
 * @param {Object} params - Parameters to validate
 * @param {string[]} required - Required parameter names
 * @returns {{valid: boolean, missing: string[]}}
 */
function validateParams(params, required) {
  const missing = required.filter(name => params[name] === undefined || params[name] === null);
  return {
    valid: missing.length === 0,
    missing
  };
}

/**
 * Register proxy IPC handlers
 * @param {Object} dependencies - Handler dependencies
 * @param {ProxyConfigManager} dependencies.proxyConfigManager - Proxy configuration manager
 * @param {ProxyDetectionService} dependencies.proxyDetectionService - Proxy detection service
 * @param {ProxyService} [dependencies.proxyService] - New proxy service (optional for backward compat)
 * @param {ProxyRepository} [dependencies.proxyRepository] - Proxy repository (optional)
 * @param {EventBus} [dependencies.eventBus] - Event bus for publishing events (optional)
 */
function register(dependencies) {
  const { 
    proxyConfigManager, 
    proxyDetectionService, 
    proxyService, 
    proxyRepository,
    eventBus 
  } = dependencies;
  
  if (!proxyConfigManager) {
    console.warn('[IPC:Proxy] ProxyConfigManager not provided, proxy handlers will not be registered');
    return;
  }

  if (!proxyDetectionService) {
    console.warn('[IPC:Proxy] ProxyDetectionService not provided, proxy handlers will not be registered');
    return;
  }

  _proxyConfigManager = proxyConfigManager;
  _proxyDetectionService = proxyDetectionService;
  _proxyService = proxyService || null;
  _proxyRepository = proxyRepository || null;
  _eventBus = eventBus || null;

  // Log initialization status
  console.log('[IPC:Proxy] Initializing proxy handlers with:', {
    hasProxyConfigManager: !!proxyConfigManager,
    hasProxyDetectionService: !!proxyDetectionService,
    hasProxyService: !!proxyService,
    hasProxyRepository: !!proxyRepository,
    hasEventBus: !!eventBus
  });

  // ==================== Existing IPC Handlers (Preserved) ====================

  /**
   * Get all proxy configurations
   * @channel proxy:get-all-configs
   * @returns {Object} { success: boolean, configs: ProxyConfig[], error?: Object }
   */
  ipcMain.handle('proxy:get-all-configs', async () => {
    try {
      // Prefer repository if available
      if (_proxyRepository) {
        const configs = await _proxyRepository.findAll();
        return createSuccessResponse({
          configs: configs.map(config => config.toJSON ? config.toJSON() : config),
          count: configs.length
        });
      }

      // Fallback to legacy manager
      const configs = await proxyConfigManager.getAllProxyConfigs(true);
      return createSuccessResponse({
        configs: configs.map(config => config.toJSON ? config.toJSON() : config),
        count: configs.length
      });
    } catch (error) {
      console.error('[IPC:Proxy] Failed to get proxy configs:', error);
      return createErrorResponse('PROXY_GET_ALL_FAILED', error.message, { 
        operation: 'get-all-configs' 
      });
    }
  });

  /**
   * Get a single proxy configuration by ID
   * @channel proxy:get-config
   * @param {string} id - Proxy configuration ID
   * @returns {Object} { success: boolean, config?: ProxyConfig, error?: Object }
   */
  ipcMain.handle('proxy:get-config', async (event, id) => {
    try {
      // Validate required parameter
      const validation = validateParams({ id }, ['id']);
      if (!validation.valid) {
        return createErrorResponse('VALIDATION_ERROR', 'Proxy config ID is required', {
          missing: validation.missing
        });
      }

      // Prefer repository if available
      if (_proxyRepository) {
        const config = await _proxyRepository.findById(id);
        if (!config) {
          return createErrorResponse('PROXY_NOT_FOUND', 'Proxy configuration not found', { id });
        }
        return createSuccessResponse({
          config: config.toJSON ? config.toJSON() : config
        });
      }

      // Fallback to legacy manager
      const config = await proxyConfigManager.getProxyConfig(id, true);
      if (!config) {
        return createErrorResponse('PROXY_NOT_FOUND', 'Proxy configuration not found', { id });
      }

      return createSuccessResponse({
        config: config.toJSON ? config.toJSON() : config
      });
    } catch (error) {
      console.error('[IPC:Proxy] Failed to get proxy config:', error);
      return createErrorResponse('PROXY_GET_FAILED', error.message, { id });
    }
  });

  /**
   * Save/update a proxy configuration
   * @channel proxy:save-config
   * @param {Object} config - Proxy configuration to save
   * @returns {Object} { success: boolean, config?: ProxyConfig, error?: Object }
   */
  ipcMain.handle('proxy:save-config', async (event, config) => {
    try {
      // Validate required parameter
      const validation = validateParams({ config }, ['config']);
      if (!validation.valid) {
        return createErrorResponse('VALIDATION_ERROR', 'Proxy configuration is required', {
          missing: validation.missing
        });
      }

      // Validate config structure using ProxyService if available
      if (_proxyService) {
        const configValidation = _proxyService.validateConfig(config);
        if (!configValidation.valid) {
          return createErrorResponse('VALIDATION_ERROR', 'Invalid proxy configuration', {
            errors: configValidation.errors
          });
        }
      }

      const result = await proxyConfigManager.saveProxyConfig(config);
      
      // Publish event if eventBus available
      if (_eventBus && result.success) {
        await _eventBus.publish('proxy:config-saved', {
          proxyId: config.id,
          timestamp: new Date().toISOString()
        });
      }

      return result.success 
        ? createSuccessResponse({ config: result.config || config })
        : createErrorResponse('PROXY_SAVE_FAILED', result.errors?.join(', ') || 'Save failed');
    } catch (error) {
      console.error('[IPC:Proxy] Failed to save proxy config:', error);
      return createErrorResponse('PROXY_SAVE_FAILED', error.message);
    }
  });

  /**
   * Delete a proxy configuration
   * @channel proxy:delete-config
   * @param {string} id - Proxy configuration ID to delete
   * @returns {Object} { success: boolean, error?: Object }
   */
  ipcMain.handle('proxy:delete-config', async (event, id) => {
    try {
      // Validate required parameter
      const validation = validateParams({ id }, ['id']);
      if (!validation.valid) {
        return createErrorResponse('VALIDATION_ERROR', 'Proxy config ID is required', {
          missing: validation.missing
        });
      }

      const result = await proxyConfigManager.deleteProxyConfig(id);
      
      // Publish event if eventBus available
      if (_eventBus && result.success) {
        await _eventBus.publish('proxy:config-deleted', {
          proxyId: id,
          timestamp: new Date().toISOString()
        });
      }

      return result.success 
        ? createSuccessResponse({ deleted: true, id })
        : createErrorResponse('PROXY_DELETE_FAILED', result.errors?.join(', ') || 'Delete failed', { id });
    } catch (error) {
      console.error('[IPC:Proxy] Failed to delete proxy config:', error);
      return createErrorResponse('PROXY_DELETE_FAILED', error.message, { id });
    }
  });

  /**
   * Test proxy service connectivity
   * ENHANCED: Returns exit IP, latency, and security check results
   * @channel proxy:test-service
   * @param {Object} config - Proxy configuration to test
   * @returns {Object} { success: boolean, ip?: string, latency?: number, error?: Object }
   */
  ipcMain.handle('proxy:test-service', async (event, config) => {
    try {
      // Validate required parameter
      const validation = validateParams({ config }, ['config']);
      if (!validation.valid) {
        return createErrorResponse('VALIDATION_ERROR', 'Proxy configuration is required', {
          missing: validation.missing
        });
      }

      // Use new ProxyService if available for enhanced testing
      if (_proxyService) {
        const result = await _proxyService.testProxy(config);
        
        if (result.success) {
          return createSuccessResponse({
            ip: result.ip,
            ipSource: result.ipSource,
            latency: result.latency,
            connectivity: result.connectivity,
            securityCheck: {
              ipVerified: !!result.ip,
              connectivityVerified: result.connectivity?.success || false
            }
          });
        } else {
          return createErrorResponse('PROXY_TEST_FAILED', result.error, {
            step: result.step
          });
        }
      }

      // Fallback to legacy testing
      const configValidation = proxyDetectionService.validateProxyConfig(config);
      if (!configValidation.valid) {
        return createErrorResponse('VALIDATION_ERROR', configValidation.errors.join(', '));
      }

      const result = await proxyDetectionService.testProxy(config);
      return result.success 
        ? createSuccessResponse(result)
        : createErrorResponse('PROXY_TEST_FAILED', result.error || 'Test failed');
    } catch (error) {
      console.error('[IPC:Proxy] Failed to test proxy:', error);
      return createErrorResponse('PROXY_TEST_FAILED', error.message);
    }
  });

  /**
   * Test current network status
   * @channel proxy:test-network
   * @returns {Object} { success: boolean, networkInfo?: Object, error?: Object }
   */
  ipcMain.handle('proxy:test-network', async () => {
    try {
      console.log('[IPC:Proxy] Starting network test');
      const result = await proxyDetectionService.getCurrentNetworkInfo();
      console.log('[IPC:Proxy] Network test result:', JSON.stringify(result));
      
      return result.success 
        ? createSuccessResponse({ networkInfo: result })
        : createErrorResponse('NETWORK_TEST_FAILED', result.error || 'Network test failed');
    } catch (error) {
      console.error('[IPC:Proxy] Failed to test network:', error);
      return createErrorResponse('NETWORK_TEST_FAILED', error.message);
    }
  });

  /**
   * Generate a name for proxy configuration
   * @channel proxy:generate-name
   * @param {Object} config - Proxy configuration
   * @returns {Object} { success: boolean, name?: string, error?: Object }
   */
  ipcMain.handle('proxy:generate-name', async (event, config) => {
    try {
      // Validate required parameter
      const validation = validateParams({ config }, ['config']);
      if (!validation.valid) {
        return createErrorResponse('VALIDATION_ERROR', 'Proxy configuration is required', {
          missing: validation.missing
        });
      }

      const name = proxyConfigManager.generateConfigName(config);
      return createSuccessResponse({ name });
    } catch (error) {
      console.error('[IPC:Proxy] Failed to generate proxy name:', error);
      return createErrorResponse('NAME_GENERATION_FAILED', error.message);
    }
  });

  /**
   * Validate proxy configuration
   * @channel proxy:validate-config
   * @param {Object} config - Proxy configuration to validate
   * @returns {Object} { success: boolean, validation?: Object, error?: Object }
   */
  ipcMain.handle('proxy:validate-config', async (event, config) => {
    try {
      // Validate required parameter
      const validation = validateParams({ config }, ['config']);
      if (!validation.valid) {
        return createErrorResponse('VALIDATION_ERROR', 'Proxy configuration is required', {
          missing: validation.missing
        });
      }

      // Use new ProxyService if available
      if (_proxyService) {
        const configValidation = _proxyService.validateConfig(config);
        return createSuccessResponse({ validation: configValidation });
      }

      const configValidation = proxyConfigManager.validateProxyConfig(config);
      return createSuccessResponse({ validation: configValidation });
    } catch (error) {
      console.error('[IPC:Proxy] Failed to validate proxy config:', error);
      return createErrorResponse('VALIDATION_FAILED', error.message);
    }
  });


  // ==================== New Security IPC Handlers ====================

  /**
   * Secure connect with pre-check and IP verification
   * This is the main entry point for establishing a secure proxy connection.
   * @channel proxy:secure-connect
   * @param {Object} params - Connection parameters
   * @param {string} params.accountId - Account ID
   * @param {Object} params.config - Proxy configuration
   * @param {Object} [params.session] - Electron session (optional)
   * @returns {Object} { success: boolean, ip?: string, latency?: number, error?: Object }
   */
  ipcMain.handle('proxy:secure-connect', async (event, params = {}) => {
    try {
      const { accountId, config, session } = params;

      // Check ProxyService availability
      if (!_proxyService) {
        return createErrorResponse('SERVICE_UNAVAILABLE', 'ProxyService not available', {
          hint: 'ProxyService must be initialized before using secure connection features'
        });
      }

      // Validate required parameters
      const validation = validateParams({ accountId, config }, ['accountId', 'config']);
      if (!validation.valid) {
        return createErrorResponse('VALIDATION_ERROR', 'Missing required parameters', {
          missing: validation.missing
        });
      }

      console.log(`[IPC:Proxy] Secure connect requested for account: ${accountId}`);
      const result = await _proxyService.secureConnect(accountId, config, session);
      
      // Update connection stats in repository
      if (_proxyRepository && config.id) {
        try {
          await _proxyRepository.addConnectionStats(config.id, {
            success: result.success,
            ip: result.ip
          });
        } catch (statsError) {
          console.warn('[IPC:Proxy] Failed to update connection stats:', statsError.message);
        }
      }

      // Publish event if eventBus available
      if (_eventBus && result.success) {
        await _eventBus.publish('proxy:secure-connected', {
          accountId,
          proxyId: config.id,
          ip: result.ip,
          timestamp: new Date().toISOString()
        });
      }

      return result.success 
        ? createSuccessResponse({
            accountId,
            ip: result.ip,
            latency: result.latency,
            proxyId: result.proxyId
          })
        : createErrorResponse('SECURE_CONNECT_FAILED', result.error, {
            step: result.step,
            accountId
          });
    } catch (error) {
      console.error('[IPC:Proxy] Secure connect failed:', error);
      return createErrorResponse('SECURE_CONNECT_FAILED', error.message);
    }
  });

  /**
   * Secure disconnect with cleanup
   * @channel proxy:secure-disconnect
   * @param {Object} params - Disconnection parameters
   * @param {string} params.accountId - Account ID
   * @returns {Object} { success: boolean, error?: Object }
   */
  ipcMain.handle('proxy:secure-disconnect', async (event, params = {}) => {
    try {
      const { accountId } = params;

      // Check ProxyService availability
      if (!_proxyService) {
        return createErrorResponse('SERVICE_UNAVAILABLE', 'ProxyService not available');
      }

      // Validate required parameters
      const validation = validateParams({ accountId }, ['accountId']);
      if (!validation.valid) {
        return createErrorResponse('VALIDATION_ERROR', 'Account ID is required', {
          missing: validation.missing
        });
      }

      console.log(`[IPC:Proxy] Secure disconnect requested for account: ${accountId}`);
      const result = await _proxyService.secureDisconnect(accountId);

      // Publish event if eventBus available
      if (_eventBus && result.success) {
        await _eventBus.publish('proxy:secure-disconnected', {
          accountId,
          timestamp: new Date().toISOString()
        });
      }

      return result.success 
        ? createSuccessResponse({ accountId, disconnected: true })
        : createErrorResponse('SECURE_DISCONNECT_FAILED', result.error, { accountId });
    } catch (error) {
      console.error('[IPC:Proxy] Secure disconnect failed:', error);
      return createErrorResponse('SECURE_DISCONNECT_FAILED', error.message);
    }
  });

  /**
   * Get proxy health monitoring status
   * @channel proxy:health-status
   * @param {Object} params - Query parameters
   * @param {string} params.accountId - Account ID
   * @returns {Object} { success: boolean, stats?: Object, status?: string, error?: Object }
   */
  ipcMain.handle('proxy:health-status', async (event, params = {}) => {
    try {
      const { accountId } = params;

      // Check ProxyService availability
      if (!_proxyService) {
        return createErrorResponse('SERVICE_UNAVAILABLE', 'ProxyService not available');
      }

      // Validate required parameters
      const validation = validateParams({ accountId }, ['accountId']);
      if (!validation.valid) {
        return createErrorResponse('VALIDATION_ERROR', 'Account ID is required', {
          missing: validation.missing
        });
      }

      const stats = _proxyService.getHealthStats(accountId);
      const healthStatus = _proxyService.healthMonitor?.getHealthStatus(accountId);

      return createSuccessResponse({
        accountId,
        stats: stats || null,
        status: healthStatus?.status || 'unknown',
        details: healthStatus?.details || {},
        isMonitoring: !!stats
      });
    } catch (error) {
      console.error('[IPC:Proxy] Failed to get health status:', error);
      return createErrorResponse('HEALTH_STATUS_FAILED', error.message);
    }
  });

  /**
   * Get Kill-Switch activation status
   * @channel proxy:kill-switch-status
   * @param {Object} params - Query parameters
   * @param {string} params.accountId - Account ID
   * @returns {Object} { success: boolean, active?: boolean, state?: string, error?: Object }
   */
  ipcMain.handle('proxy:kill-switch-status', async (event, params = {}) => {
    try {
      const { accountId } = params;

      // Check ProxyService availability
      if (!_proxyService) {
        return createErrorResponse('SERVICE_UNAVAILABLE', 'ProxyService not available');
      }

      // Validate required parameters
      const validation = validateParams({ accountId }, ['accountId']);
      if (!validation.valid) {
        return createErrorResponse('VALIDATION_ERROR', 'Account ID is required', {
          missing: validation.missing
        });
      }

      const killSwitch = _proxyService.killSwitch;
      if (!killSwitch) {
        return createErrorResponse('COMPONENT_UNAVAILABLE', 'KillSwitch component not available');
      }

      const state = killSwitch.getState(accountId);
      const isActive = killSwitch.isActive(accountId);

      return createSuccessResponse({
        accountId,
        active: isActive,
        state: state?.state || 'unknown',
        trigger: state?.trigger || null,
        activatedAt: state?.activatedAt || null,
        resetRequested: state?.resetRequested || false
      });
    } catch (error) {
      console.error('[IPC:Proxy] Failed to get kill-switch status:', error);
      return createErrorResponse('KILL_SWITCH_STATUS_FAILED', error.message);
    }
  });

  /**
   * Manual reconnection trigger
   * @channel proxy:reconnect
   * @param {Object} params - Reconnection parameters
   * @param {string} params.accountId - Account ID
   * @returns {Object} { success: boolean, ip?: string, error?: Object }
   */
  ipcMain.handle('proxy:reconnect', async (event, params = {}) => {
    try {
      const { accountId } = params;

      // Check ProxyService availability
      if (!_proxyService) {
        return createErrorResponse('SERVICE_UNAVAILABLE', 'ProxyService not available');
      }

      // Validate required parameters
      const validation = validateParams({ accountId }, ['accountId']);
      if (!validation.valid) {
        return createErrorResponse('VALIDATION_ERROR', 'Account ID is required', {
          missing: validation.missing
        });
      }

      console.log(`[IPC:Proxy] Manual reconnect requested for account: ${accountId}`);
      const result = await _proxyService.manualReconnect(accountId);

      // Publish event if eventBus available
      if (_eventBus) {
        await _eventBus.publish('proxy:reconnect-attempted', {
          accountId,
          success: result.success,
          timestamp: new Date().toISOString()
        });
      }

      return result.success 
        ? createSuccessResponse({
            accountId,
            ip: result.ip,
            latency: result.latency,
            reconnected: true
          })
        : createErrorResponse('RECONNECT_FAILED', result.error, { accountId });
    } catch (error) {
      console.error('[IPC:Proxy] Manual reconnect failed:', error);
      return createErrorResponse('RECONNECT_FAILED', error.message);
    }
  });

  /**
   * Get reconnection attempt status
   * @channel proxy:reconnection-status
   * @param {Object} params - Query parameters
   * @param {string} params.accountId - Account ID
   * @returns {Object} { success: boolean, status?: Object, error?: Object }
   */
  ipcMain.handle('proxy:reconnection-status', async (event, params = {}) => {
    try {
      const { accountId } = params;

      // Check ProxyService availability
      if (!_proxyService) {
        return createErrorResponse('SERVICE_UNAVAILABLE', 'ProxyService not available');
      }

      // Validate required parameters
      const validation = validateParams({ accountId }, ['accountId']);
      if (!validation.valid) {
        return createErrorResponse('VALIDATION_ERROR', 'Account ID is required', {
          missing: validation.missing
        });
      }

      const status = _proxyService.getReconnectionStatus(accountId);
      
      return createSuccessResponse({
        accountId,
        status: status || { state: 'idle', attempts: 0 }
      });
    } catch (error) {
      console.error('[IPC:Proxy] Failed to get reconnection status:', error);
      return createErrorResponse('RECONNECTION_STATUS_FAILED', error.message);
    }
  });

  /**
   * Smooth proxy switching with rollback support
   * @channel proxy:switch-proxy
   * @param {Object} params - Switch parameters
   * @param {string} params.accountId - Account ID
   * @param {Object} params.newConfig - New proxy configuration
   * @returns {Object} { success: boolean, ip?: string, error?: Object }
   */
  ipcMain.handle('proxy:switch-proxy', async (event, params = {}) => {
    try {
      const { accountId, newConfig } = params;

      // Check ProxyService availability
      if (!_proxyService) {
        return createErrorResponse('SERVICE_UNAVAILABLE', 'ProxyService not available');
      }

      // Validate required parameters
      const validation = validateParams({ accountId, newConfig }, ['accountId', 'newConfig']);
      if (!validation.valid) {
        return createErrorResponse('VALIDATION_ERROR', 'Missing required parameters', {
          missing: validation.missing
        });
      }

      console.log(`[IPC:Proxy] Proxy switch requested for account: ${accountId}`);

      // Get current connection for potential rollback
      const currentConnection = _proxyService.getConnectionStatus(accountId);
      const oldConfig = currentConnection?.config || null;

      // First disconnect current proxy
      await _proxyService.secureDisconnect(accountId);

      // Then connect with new proxy
      const result = await _proxyService.secureConnect(accountId, newConfig);

      if (!result.success && oldConfig) {
        // Switch failed - attempt rollback to old config
        console.warn('[IPC:Proxy] Proxy switch failed, attempting rollback');
        const rollbackResult = await _proxyService.secureConnect(accountId, oldConfig);
        
        if (rollbackResult.success) {
          return createErrorResponse('SWITCH_FAILED_ROLLBACK_SUCCESS', result.error, {
            accountId,
            rolledBack: true,
            rollbackIp: rollbackResult.ip
          });
        } else {
          return createErrorResponse('SWITCH_FAILED_ROLLBACK_FAILED', result.error, {
            accountId,
            rolledBack: false,
            rollbackError: rollbackResult.error
          });
        }
      }

      // Publish event if eventBus available
      if (_eventBus && result.success) {
        await _eventBus.publish('proxy:switched', {
          accountId,
          oldProxyId: oldConfig?.id,
          newProxyId: newConfig.id,
          ip: result.ip,
          timestamp: new Date().toISOString()
        });
      }

      return result.success 
        ? createSuccessResponse({
            accountId,
            ip: result.ip,
            latency: result.latency,
            switched: true,
            previousProxyId: oldConfig?.id
          })
        : createErrorResponse('SWITCH_FAILED', result.error, { accountId });
    } catch (error) {
      console.error('[IPC:Proxy] Proxy switch failed:', error);
      return createErrorResponse('SWITCH_FAILED', error.message);
    }
  });

  console.log('[IPC:Proxy] Proxy handlers registered (8 existing + 7 new security handlers)');
}


/**
 * Unregister proxy IPC handlers
 * Removes all registered IPC handlers and cleans up references
 */
function unregister() {
  // Existing handlers (8 total)
  const existingChannels = [
    'proxy:get-all-configs',
    'proxy:get-config',
    'proxy:save-config',
    'proxy:delete-config',
    'proxy:test-service',
    'proxy:test-network',
    'proxy:generate-name',
    'proxy:validate-config'
  ];
  
  // New security handlers (7 total)
  const securityChannels = [
    'proxy:secure-connect',
    'proxy:secure-disconnect',
    'proxy:health-status',
    'proxy:kill-switch-status',
    'proxy:reconnect',
    'proxy:reconnection-status',
    'proxy:switch-proxy'
  ];

  // Remove all handlers
  [...existingChannels, ...securityChannels].forEach(channel => {
    try {
      ipcMain.removeHandler(channel);
    } catch (error) {
      // Handler might not be registered, ignore
    }
  });
  
  // Clean up references
  _proxyConfigManager = null;
  _proxyDetectionService = null;
  _proxyService = null;
  _proxyRepository = null;
  _eventBus = null;
  
  console.log('[IPC:Proxy] Proxy handlers unregistered (15 total: 8 existing + 7 security)');
}

/**
 * Get list of all registered IPC channels with descriptions
 * @returns {Object} Channel information
 */
function getChannels() {
  return {
    existing: {
      'proxy:get-all-configs': 'Get all proxy configurations',
      'proxy:get-config': 'Get a single proxy configuration by ID',
      'proxy:save-config': 'Save/update a proxy configuration',
      'proxy:delete-config': 'Delete a proxy configuration',
      'proxy:test-service': 'Test proxy connectivity (enhanced with exit IP)',
      'proxy:test-network': 'Test current network status',
      'proxy:generate-name': 'Generate a name for proxy configuration',
      'proxy:validate-config': 'Validate proxy configuration'
    },
    security: {
      'proxy:secure-connect': 'Secure connection with pre-check and IP verification',
      'proxy:secure-disconnect': 'Secure disconnection with cleanup',
      'proxy:health-status': 'Get proxy health monitoring status',
      'proxy:kill-switch-status': 'Get Kill-Switch activation status',
      'proxy:reconnect': 'Manual reconnection trigger',
      'proxy:reconnection-status': 'Get reconnection attempt status',
      'proxy:switch-proxy': 'Smooth proxy switching with rollback support'
    },
    summary: {
      existingCount: 8,
      securityCount: 7,
      totalCount: 15
    }
  };
}

/**
 * Check if ProxyService is available for security features
 * @returns {boolean}
 */
function isSecurityEnabled() {
  return !!_proxyService;
}

/**
 * Get current service status
 * @returns {Object} Service availability status
 */
function getServiceStatus() {
  return {
    proxyConfigManager: !!_proxyConfigManager,
    proxyDetectionService: !!_proxyDetectionService,
    proxyService: !!_proxyService,
    proxyRepository: !!_proxyRepository,
    eventBus: !!_eventBus,
    securityFeaturesEnabled: !!_proxyService
  };
}

module.exports = {
  register,
  unregister,
  getChannels,
  isSecurityEnabled,
  getServiceStatus
};
