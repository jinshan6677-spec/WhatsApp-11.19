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
 * Migration Status:
 * - ✅ Supports both legacy (ipcMain.handle) and new architecture (IPCRouter)
 * - ✅ Uses ProxyService for security features when available
 * - ✅ Falls back to ProxyConfigManager for backward compatibility
 * 
 * @module presentation/ipc/handlers/ProxyIPCHandlers
 * @requires electron
 * @requires ../../application/services/ProxyService
 * @requires ../../infrastructure/repositories/ProxyRepository
 */

'use strict';

const { ipcMain } = require('electron');
const { EventSchema } = require('../../../core/eventbus/EventSchema');

// Store references for cleanup
let _proxyConfigManager = null;
let _proxyDetectionService = null;
let _proxyService = null;
let _proxyRepository = null;
let _eventBus = null;
let _ipcRouter = null;

/**
 * List of all proxy IPC channels
 */
const EXISTING_CHANNELS = [
  'proxy:get-all-configs',
  'proxy:get-config',
  'proxy:save-config',
  'proxy:delete-config',
  'proxy:test-service',
  'proxy:test-network',
  'proxy:generate-name',
  'proxy:validate-config'
];

const SECURITY_CHANNELS = [
  'proxy:secure-connect',
  'proxy:secure-disconnect',
  'proxy:health-status',
  'proxy:kill-switch-status',
  'proxy:reconnect',
  'proxy:reconnection-status',
  'proxy:switch-proxy'
];

const ALL_CHANNELS = [...EXISTING_CHANNELS, ...SECURITY_CHANNELS];

/**
 * Request schemas for validation
 */
const schemas = {
  getConfig: new EventSchema({
    type: 'string',
    required: true
  }),
  
  saveConfig: new EventSchema({
    type: 'object',
    properties: {
      id: { type: 'string' },
      enabled: { type: 'boolean' },
      protocol: { type: 'string' },
      host: { type: 'string', required: true },
      port: { type: 'number', required: true }
    }
  }),
  
  deleteConfig: new EventSchema({
    type: 'string',
    required: true
  }),
  
  testService: new EventSchema({
    type: 'object',
    properties: {
      protocol: { type: 'string' },
      host: { type: 'string', required: true },
      port: { type: 'number', required: true }
    }
  }),
  
  validateConfig: new EventSchema({
    type: 'object',
    properties: {
      protocol: { type: 'string' },
      host: { type: 'string' },
      port: { type: 'number' }
    }
  }),
  
  secureConnect: new EventSchema({
    type: 'object',
    properties: {
      accountId: { type: 'string', required: true },
      config: { type: 'object', required: true }
    }
  }),
  
  secureDisconnect: new EventSchema({
    type: 'object',
    properties: {
      accountId: { type: 'string', required: true }
    }
  }),
  
  healthStatus: new EventSchema({
    type: 'object',
    properties: {
      accountId: { type: 'string', required: true }
    }
  }),
  
  killSwitchStatus: new EventSchema({
    type: 'object',
    properties: {
      accountId: { type: 'string', required: true }
    }
  }),
  
  reconnect: new EventSchema({
    type: 'object',
    properties: {
      accountId: { type: 'string', required: true }
    }
  }),
  
  reconnectionStatus: new EventSchema({
    type: 'object',
    properties: {
      accountId: { type: 'string', required: true }
    }
  }),
  
  switchProxy: new EventSchema({
    type: 'object',
    properties: {
      accountId: { type: 'string', required: true },
      newConfig: { type: 'object', required: true }
    }
  })
};

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
  // Remove all handlers from ipcMain
  ALL_CHANNELS.forEach(channel => {
    try {
      ipcMain.removeHandler(channel);
    } catch (error) {
      // Handler might not be registered, ignore
    }
  });
  
  // Unregister from IPCRouter if available
  if (_ipcRouter) {
    ALL_CHANNELS.forEach(channel => {
      try {
        _ipcRouter.unregister(channel);
      } catch (error) {
        // Handler might not be registered, ignore
      }
    });
  }
  
  // Clean up references
  _proxyConfigManager = null;
  _proxyDetectionService = null;
  _proxyService = null;
  _proxyRepository = null;
  _eventBus = null;
  _ipcRouter = null;
  
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
      existingCount: EXISTING_CHANNELS.length,
      securityCount: SECURITY_CHANNELS.length,
      totalCount: ALL_CHANNELS.length
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
    ipcRouter: !!_ipcRouter,
    securityFeaturesEnabled: !!_proxyService
  };
}

// ==================== IPCRouter Integration ====================

/**
 * Handler implementations for IPCRouter
 * These handlers use ProxyService as the primary service
 */
const routerHandlers = {
  /**
   * Get all proxy configurations
   */
  async getAllConfigs(request) {
    if (_proxyRepository) {
      const configs = await _proxyRepository.findAll();
      return createSuccessResponse({
        configs: configs.map(config => config.toJSON ? config.toJSON() : config),
        count: configs.length
      });
    }
    
    if (_proxyConfigManager) {
      const configs = await _proxyConfigManager.getAllProxyConfigs(true);
      return createSuccessResponse({
        configs: configs.map(config => config.toJSON ? config.toJSON() : config),
        count: configs.length
      });
    }
    
    return createErrorResponse('SERVICE_UNAVAILABLE', 'No proxy service available');
  },

  /**
   * Get a single proxy configuration by ID
   */
  async getConfig(request) {
    const id = request.payload;
    
    if (_proxyRepository) {
      const config = await _proxyRepository.findById(id);
      if (!config) {
        return createErrorResponse('PROXY_NOT_FOUND', 'Proxy configuration not found', { id });
      }
      return createSuccessResponse({
        config: config.toJSON ? config.toJSON() : config
      });
    }
    
    if (_proxyConfigManager) {
      const config = await _proxyConfigManager.getProxyConfig(id, true);
      if (!config) {
        return createErrorResponse('PROXY_NOT_FOUND', 'Proxy configuration not found', { id });
      }
      return createSuccessResponse({
        config: config.toJSON ? config.toJSON() : config
      });
    }
    
    return createErrorResponse('SERVICE_UNAVAILABLE', 'No proxy service available');
  },

  /**
   * Save/update a proxy configuration
   */
  async saveConfig(request) {
    const config = request.payload;
    
    // Validate config using ProxyService if available
    if (_proxyService) {
      const validation = _proxyService.validateConfig(config);
      if (!validation.valid) {
        return createErrorResponse('VALIDATION_ERROR', 'Invalid proxy configuration', {
          errors: validation.errors
        });
      }
    }
    
    if (_proxyConfigManager) {
      const result = await _proxyConfigManager.saveProxyConfig(config);
      
      if (_eventBus && result.success) {
        await _eventBus.publish('proxy:config-saved', {
          proxyId: config.id,
          timestamp: new Date().toISOString()
        });
      }
      
      return result.success 
        ? createSuccessResponse({ config: result.config || config })
        : createErrorResponse('PROXY_SAVE_FAILED', result.errors?.join(', ') || 'Save failed');
    }
    
    return createErrorResponse('SERVICE_UNAVAILABLE', 'No proxy service available');
  },

  /**
   * Delete a proxy configuration
   */
  async deleteConfig(request) {
    const id = request.payload;
    
    if (_proxyConfigManager) {
      const result = await _proxyConfigManager.deleteProxyConfig(id);
      
      if (_eventBus && result.success) {
        await _eventBus.publish('proxy:config-deleted', {
          proxyId: id,
          timestamp: new Date().toISOString()
        });
      }
      
      return result.success 
        ? createSuccessResponse({ deleted: true, id })
        : createErrorResponse('PROXY_DELETE_FAILED', result.errors?.join(', ') || 'Delete failed', { id });
    }
    
    return createErrorResponse('SERVICE_UNAVAILABLE', 'No proxy service available');
  },

  /**
   * Test proxy service connectivity (enhanced with exit IP)
   */
  async testService(request) {
    const config = request.payload;
    
    // Use ProxyService for enhanced testing
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
    if (_proxyDetectionService) {
      const configValidation = _proxyDetectionService.validateProxyConfig(config);
      if (!configValidation.valid) {
        return createErrorResponse('VALIDATION_ERROR', configValidation.errors.join(', '));
      }
      
      const result = await _proxyDetectionService.testProxy(config);
      return result.success 
        ? createSuccessResponse(result)
        : createErrorResponse('PROXY_TEST_FAILED', result.error || 'Test failed');
    }
    
    return createErrorResponse('SERVICE_UNAVAILABLE', 'No proxy service available');
  },

  /**
   * Test current network status
   */
  async testNetwork(request) {
    if (_proxyDetectionService) {
      const result = await _proxyDetectionService.getCurrentNetworkInfo();
      return result.success 
        ? createSuccessResponse({ networkInfo: result })
        : createErrorResponse('NETWORK_TEST_FAILED', result.error || 'Network test failed');
    }
    
    return createErrorResponse('SERVICE_UNAVAILABLE', 'ProxyDetectionService not available');
  },

  /**
   * Generate a name for proxy configuration
   */
  async generateName(request) {
    const config = request.payload;
    
    if (_proxyConfigManager) {
      const name = _proxyConfigManager.generateConfigName(config);
      return createSuccessResponse({ name });
    }
    
    return createErrorResponse('SERVICE_UNAVAILABLE', 'ProxyConfigManager not available');
  },

  /**
   * Validate proxy configuration
   */
  async validateConfig(request) {
    const config = request.payload;
    
    if (_proxyService) {
      const validation = _proxyService.validateConfig(config);
      return createSuccessResponse({ validation });
    }
    
    if (_proxyConfigManager) {
      const validation = _proxyConfigManager.validateProxyConfig(config);
      return createSuccessResponse({ validation });
    }
    
    return createErrorResponse('SERVICE_UNAVAILABLE', 'No proxy service available');
  },

  // ==================== Security Handlers ====================

  /**
   * Secure connect with pre-check and IP verification
   */
  async secureConnect(request) {
    const { accountId, config, session } = request.payload;
    
    if (!_proxyService) {
      return createErrorResponse('SERVICE_UNAVAILABLE', 'ProxyService not available', {
        hint: 'ProxyService must be initialized before using secure connection features'
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
  },

  /**
   * Secure disconnect with cleanup
   */
  async secureDisconnect(request) {
    const { accountId } = request.payload;
    
    if (!_proxyService) {
      return createErrorResponse('SERVICE_UNAVAILABLE', 'ProxyService not available');
    }
    
    console.log(`[IPC:Proxy] Secure disconnect requested for account: ${accountId}`);
    const result = await _proxyService.secureDisconnect(accountId);
    
    if (_eventBus && result.success) {
      await _eventBus.publish('proxy:secure-disconnected', {
        accountId,
        timestamp: new Date().toISOString()
      });
    }
    
    return result.success 
      ? createSuccessResponse({ accountId, disconnected: true })
      : createErrorResponse('SECURE_DISCONNECT_FAILED', result.error, { accountId });
  },

  /**
   * Get proxy health monitoring status
   */
  async healthStatus(request) {
    const { accountId } = request.payload;
    
    if (!_proxyService) {
      return createErrorResponse('SERVICE_UNAVAILABLE', 'ProxyService not available');
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
  },

  /**
   * Get Kill-Switch activation status
   */
  async killSwitchStatus(request) {
    const { accountId } = request.payload;
    
    if (!_proxyService) {
      return createErrorResponse('SERVICE_UNAVAILABLE', 'ProxyService not available');
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
  },

  /**
   * Manual reconnection trigger
   */
  async reconnect(request) {
    const { accountId } = request.payload;
    
    if (!_proxyService) {
      return createErrorResponse('SERVICE_UNAVAILABLE', 'ProxyService not available');
    }
    
    console.log(`[IPC:Proxy] Manual reconnect requested for account: ${accountId}`);
    const result = await _proxyService.manualReconnect(accountId);
    
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
  },

  /**
   * Get reconnection attempt status
   */
  async reconnectionStatus(request) {
    const { accountId } = request.payload;
    
    if (!_proxyService) {
      return createErrorResponse('SERVICE_UNAVAILABLE', 'ProxyService not available');
    }
    
    const status = _proxyService.getReconnectionStatus(accountId);
    
    return createSuccessResponse({
      accountId,
      status: status || { state: 'idle', attempts: 0 }
    });
  },

  /**
   * Smooth proxy switching with rollback support
   */
  async switchProxy(request) {
    const { accountId, newConfig } = request.payload;
    
    if (!_proxyService) {
      return createErrorResponse('SERVICE_UNAVAILABLE', 'ProxyService not available');
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
  }
};

/**
 * Wraps a handler with error handling
 * @param {Function} handler - Handler function
 * @param {string} name - Handler name for logging
 * @returns {Function} Wrapped handler
 */
function wrapHandler(handler, name) {
  return async (request, context) => {
    try {
      return await handler(request, context);
    } catch (error) {
      console.error(`[IPC:Proxy] ${name} error:`, error);
      return createErrorResponse('HANDLER_ERROR', error.message, { handler: name });
    }
  };
}

/**
 * Registers proxy IPC handlers with IPCRouter AND ipcMain
 * This is the new architecture integration method.
 * 
 * @param {IPCRouter} router - IPCRouter instance
 * @param {Object} dependencies - Handler dependencies
 * @param {ProxyService} dependencies.proxyService - Proxy service instance (required for security features)
 * @param {ProxyConfigManager} [dependencies.proxyConfigManager] - Legacy proxy config manager
 * @param {ProxyDetectionService} [dependencies.proxyDetectionService] - Legacy proxy detection service
 * @param {ProxyRepository} [dependencies.proxyRepository] - Proxy repository for data access
 * @param {EventBus} [dependencies.eventBus] - Event bus for publishing events
 */
function registerWithRouter(router, dependencies) {
  const { 
    proxyService, 
    proxyConfigManager, 
    proxyDetectionService, 
    proxyRepository, 
    eventBus 
  } = dependencies;
  
  // Store references
  _ipcRouter = router;
  _proxyService = proxyService || null;
  _proxyConfigManager = proxyConfigManager || null;
  _proxyDetectionService = proxyDetectionService || null;
  _proxyRepository = proxyRepository || null;
  _eventBus = eventBus || null;
  
  console.log('[IPC:Proxy] Registering proxy handlers with IPCRouter:', {
    hasProxyService: !!proxyService,
    hasProxyConfigManager: !!proxyConfigManager,
    hasProxyDetectionService: !!proxyDetectionService,
    hasProxyRepository: !!proxyRepository,
    hasEventBus: !!eventBus
  });
  
  // Register existing handlers (8 total)
  router.register('proxy:get-all-configs', wrapHandler(routerHandlers.getAllConfigs, 'getAllConfigs'), {
    description: 'Get all proxy configurations',
    defaultTimeout: 10000
  });
  
  router.register('proxy:get-config', wrapHandler(routerHandlers.getConfig, 'getConfig'), {
    schema: schemas.getConfig,
    description: 'Get a single proxy configuration by ID',
    defaultTimeout: 5000
  });
  
  router.register('proxy:save-config', wrapHandler(routerHandlers.saveConfig, 'saveConfig'), {
    schema: schemas.saveConfig,
    description: 'Save/update a proxy configuration',
    defaultTimeout: 10000
  });
  
  router.register('proxy:delete-config', wrapHandler(routerHandlers.deleteConfig, 'deleteConfig'), {
    schema: schemas.deleteConfig,
    description: 'Delete a proxy configuration',
    defaultTimeout: 5000
  });
  
  router.register('proxy:test-service', wrapHandler(routerHandlers.testService, 'testService'), {
    schema: schemas.testService,
    description: 'Test proxy connectivity (enhanced with exit IP and security checks)',
    defaultTimeout: 30000
  });
  
  router.register('proxy:test-network', wrapHandler(routerHandlers.testNetwork, 'testNetwork'), {
    description: 'Test current network status',
    defaultTimeout: 15000
  });
  
  router.register('proxy:generate-name', wrapHandler(routerHandlers.generateName, 'generateName'), {
    description: 'Generate a name for proxy configuration',
    defaultTimeout: 5000
  });
  
  router.register('proxy:validate-config', wrapHandler(routerHandlers.validateConfig, 'validateConfig'), {
    schema: schemas.validateConfig,
    description: 'Validate proxy configuration',
    defaultTimeout: 5000
  });
  
  // Register security handlers (7 total)
  router.register('proxy:secure-connect', wrapHandler(routerHandlers.secureConnect, 'secureConnect'), {
    schema: schemas.secureConnect,
    description: 'Secure connection with pre-check and IP verification',
    defaultTimeout: 60000
  });
  
  router.register('proxy:secure-disconnect', wrapHandler(routerHandlers.secureDisconnect, 'secureDisconnect'), {
    schema: schemas.secureDisconnect,
    description: 'Secure disconnection with cleanup',
    defaultTimeout: 10000
  });
  
  router.register('proxy:health-status', wrapHandler(routerHandlers.healthStatus, 'healthStatus'), {
    schema: schemas.healthStatus,
    description: 'Get proxy health monitoring status',
    defaultTimeout: 5000
  });
  
  router.register('proxy:kill-switch-status', wrapHandler(routerHandlers.killSwitchStatus, 'killSwitchStatus'), {
    schema: schemas.killSwitchStatus,
    description: 'Get Kill-Switch activation status',
    defaultTimeout: 5000
  });
  
  router.register('proxy:reconnect', wrapHandler(routerHandlers.reconnect, 'reconnect'), {
    schema: schemas.reconnect,
    description: 'Manual reconnection trigger',
    defaultTimeout: 60000
  });
  
  router.register('proxy:reconnection-status', wrapHandler(routerHandlers.reconnectionStatus, 'reconnectionStatus'), {
    schema: schemas.reconnectionStatus,
    description: 'Get reconnection attempt status',
    defaultTimeout: 5000
  });
  
  router.register('proxy:switch-proxy', wrapHandler(routerHandlers.switchProxy, 'switchProxy'), {
    schema: schemas.switchProxy,
    description: 'Smooth proxy switching with rollback support',
    defaultTimeout: 120000
  });
  
  console.log('[IPC:Proxy] ✓ Proxy handlers registered with IPCRouter (15 channels)');
  
  // ========== CRITICAL: Register with ipcMain ==========
  // The IPCRouter is an internal router, but we need to connect it to Electron's ipcMain
  // so that renderer processes can actually invoke these handlers
  
  for (const channel of ALL_CHANNELS) {
    // Remove existing handler if any (to avoid duplicate registration errors)
    try {
      ipcMain.removeHandler(channel);
    } catch (e) {
      // Ignore - handler might not exist
    }
    
    // Register the handler with ipcMain
    ipcMain.handle(channel, async (event, ...args) => {
      // Build request object for IPCRouter
      const request = {
        payload: args.length === 1 ? args[0] : args,
        requestId: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      };
      
      // Route through IPCRouter
      const response = await router.handle(channel, request);
      
      if (response.success) {
        return response.data;
      } else {
        // Return error response instead of throwing
        // This allows the renderer to handle errors gracefully
        return {
          success: false,
          error: response.error
        };
      }
    });
  }
  
  console.log(`[IPC:Proxy] ✓ All ${ALL_CHANNELS.length} channels registered with ipcMain`);
  
  // Log security status
  if (proxyService) {
    console.log('[IPC:Proxy] ✓ Security features enabled (ProxyService available)');
  } else {
    console.warn('[IPC:Proxy] ⚠ Security features limited (ProxyService not provided)');
  }
}

/**
 * Unregisters proxy IPC handlers from IPCRouter and ipcMain
 * @param {IPCRouter} router - IPCRouter instance
 */
function unregisterFromRouter(router) {
  for (const channel of ALL_CHANNELS) {
    // Unregister from IPCRouter
    try {
      router.unregister(channel);
    } catch (e) {
      // Ignore - handler might not exist
    }
    
    // Unregister from ipcMain
    try {
      ipcMain.removeHandler(channel);
    } catch (e) {
      // Ignore - handler might not exist
    }
  }
  
  _ipcRouter = null;
  console.log('[IPC:Proxy] Proxy handlers unregistered from IPCRouter and ipcMain');
}

module.exports = {
  // Legacy registration (backward compatible)
  register,
  unregister,
  
  // New architecture registration (IPCRouter)
  registerWithRouter,
  unregisterFromRouter,
  
  // Query functions
  getChannels,
  isSecurityEnabled,
  getServiceStatus,
  
  // Expose handlers and schemas for testing
  handlers: routerHandlers,
  schemas,
  
  // Channel lists
  EXISTING_CHANNELS,
  SECURITY_CHANNELS,
  ALL_CHANNELS
};
