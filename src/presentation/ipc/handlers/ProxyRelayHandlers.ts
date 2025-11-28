/**
 * Proxy Relay IPC Handlers
 * 
 * Handles IPC communication for proxy relay service management.
 * Provides channels for starting/stopping relays, status monitoring,
 * and proxy testing.
 * 
 * IPC Channels (10 total):
 * - proxy-relay:start - Start proxy relay for an account
 * - proxy-relay:stop - Stop proxy relay for an account
 * - proxy-relay:status - Get relay status for an account
 * - proxy-relay:test - Test proxy connectivity
 * - proxy-relay:get-exit-ip - Get exit IP for an account
 * - proxy-relay:reload - Hot reload proxy configuration
 * - proxy-relay:get-all-status - Get status of all relays
 * - proxy-relay:health-check - Perform health check on relay
 * - proxy-relay:get-stats - Get relay statistics
 * - proxy-relay:smart-match - Get smart match suggestions based on IP
 * 
 * @module presentation/ipc/handlers/ProxyRelayHandlers
 */

import { ipcMain, IpcMainInvokeEvent } from 'electron';
import { ProxyRelayService, ProxyRelayInfo } from '../../../application/services/ProxyRelayService';

// ProxyConfig type for IPC handlers
interface ProxyConfig {
  protocol: string;
  host: string;
  port: number;
  username?: string;
  password?: string;
}

// Store references for cleanup
let _proxyRelayService: ProxyRelayService | null = null;

/**
 * List of all proxy relay IPC channels
 */
const CHANNELS = [
  'proxy-relay:start',
  'proxy-relay:stop',
  'proxy-relay:status',
  'proxy-relay:test',
  'proxy-relay:get-exit-ip',
  'proxy-relay:reload',
  'proxy-relay:get-all-status',
  'proxy-relay:health-check',
  'proxy-relay:get-stats',
  'proxy-relay:smart-match'
];

/**
 * Creates a structured error response
 */
function createErrorResponse(code: string, message: string, context: Record<string, unknown> = {}): object {
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
 */
function createSuccessResponse(data: Record<string, unknown> = {}): object {
  return {
    success: true,
    ...data
  };
}

/**
 * Handler dependencies interface
 */
interface ProxyRelayHandlerDependencies {
  proxyRelayService: ProxyRelayService;
}

/**
 * Register proxy relay IPC handlers
 */
function register(dependencies: ProxyRelayHandlerDependencies): void {
  const { proxyRelayService } = dependencies;

  if (!proxyRelayService) {
    throw new Error('ProxyRelayService is required');
  }

  _proxyRelayService = proxyRelayService;

  // Start proxy relay for an account
  ipcMain.handle('proxy-relay:start', async (_event: IpcMainInvokeEvent, accountId: string, proxyConfig: ProxyConfig) => {
    try {
      if (!accountId) {
        return createErrorResponse('INVALID_PARAMS', 'Account ID is required');
      }
      if (!proxyConfig) {
        return createErrorResponse('INVALID_PARAMS', 'Proxy configuration is required');
      }

      const relayInfo = await _proxyRelayService!.startRelay(accountId, proxyConfig);
      return createSuccessResponse({ relay: relayInfo });
    } catch (error) {
      console.error('[ProxyRelayHandlers] start error:', error);
      return createErrorResponse('START_FAILED', (error as Error).message);
    }
  });

  // Stop proxy relay for an account
  ipcMain.handle('proxy-relay:stop', async (_event: IpcMainInvokeEvent, accountId: string) => {
    try {
      if (!accountId) {
        return createErrorResponse('INVALID_PARAMS', 'Account ID is required');
      }

      await _proxyRelayService!.stopRelay(accountId);
      return createSuccessResponse({ stopped: true, accountId });
    } catch (error) {
      console.error('[ProxyRelayHandlers] stop error:', error);
      return createErrorResponse('STOP_FAILED', (error as Error).message);
    }
  });

  // Get relay status for an account
  ipcMain.handle('proxy-relay:status', async (_event: IpcMainInvokeEvent, accountId: string) => {
    try {
      if (!accountId) {
        return createErrorResponse('INVALID_PARAMS', 'Account ID is required');
      }

      const status = await _proxyRelayService!.getRelayStatus(accountId);
      return createSuccessResponse({ status });
    } catch (error) {
      console.error('[ProxyRelayHandlers] status error:', error);
      return createErrorResponse('STATUS_FAILED', (error as Error).message);
    }
  });

  // Test proxy connectivity
  ipcMain.handle('proxy-relay:test', async (_event: IpcMainInvokeEvent, proxyConfig: ProxyConfig) => {
    try {
      if (!proxyConfig) {
        return createErrorResponse('INVALID_PARAMS', 'Proxy configuration is required');
      }

      const result = await _proxyRelayService!.testProxy(proxyConfig);
      return createSuccessResponse({ result });
    } catch (error) {
      console.error('[ProxyRelayHandlers] test error:', error);
      return createErrorResponse('TEST_FAILED', (error as Error).message);
    }
  });

  // Get exit IP for an account
  ipcMain.handle('proxy-relay:get-exit-ip', async (_event: IpcMainInvokeEvent, accountId: string) => {
    try {
      if (!accountId) {
        return createErrorResponse('INVALID_PARAMS', 'Account ID is required');
      }

      const exitIP = await _proxyRelayService!.getExitIP(accountId);
      return createSuccessResponse({ exitIP, accountId });
    } catch (error) {
      console.error('[ProxyRelayHandlers] get-exit-ip error:', error);
      return createErrorResponse('GET_EXIT_IP_FAILED', (error as Error).message);
    }
  });

  // Hot reload proxy configuration
  ipcMain.handle('proxy-relay:reload', async (_event: IpcMainInvokeEvent, accountId: string, newConfig: ProxyConfig) => {
    try {
      if (!accountId) {
        return createErrorResponse('INVALID_PARAMS', 'Account ID is required');
      }
      if (!newConfig) {
        return createErrorResponse('INVALID_PARAMS', 'New proxy configuration is required');
      }

      await _proxyRelayService!.reloadProxy(accountId, newConfig);
      return createSuccessResponse({ reloaded: true, accountId });
    } catch (error) {
      console.error('[ProxyRelayHandlers] reload error:', error);
      return createErrorResponse('RELOAD_FAILED', (error as Error).message);
    }
  });

  // Get status of all relays
  ipcMain.handle('proxy-relay:get-all-status', async () => {
    try {
      const allStatus = _proxyRelayService!.getAllRelays();
      return createSuccessResponse({ relays: allStatus });
    } catch (error) {
      console.error('[ProxyRelayHandlers] get-all-status error:', error);
      return createErrorResponse('GET_ALL_STATUS_FAILED', (error as Error).message);
    }
  });

  // Perform health check on relay
  ipcMain.handle('proxy-relay:health-check', async (_event: IpcMainInvokeEvent, accountId: string) => {
    try {
      if (!accountId) {
        return createErrorResponse('INVALID_PARAMS', 'Account ID is required');
      }

      const status = await _proxyRelayService!.getRelayStatus(accountId);
      
      if (!status) {
        return createSuccessResponse({
          healthy: false,
          status: null,
          reason: 'Relay not found'
        });
      }
      
      // Perform a quick connectivity test
      if (status.status === 'running' && status.remoteProxy) {
        const testResult = await _proxyRelayService!.testProxy(status.remoteProxy);
        return createSuccessResponse({
          healthy: testResult.success,
          status,
          testResult
        });
      }

      return createSuccessResponse({
        healthy: false,
        status,
        reason: 'Relay not running'
      });
    } catch (error) {
      console.error('[ProxyRelayHandlers] health-check error:', error);
      return createErrorResponse('HEALTH_CHECK_FAILED', (error as Error).message);
    }
  });

  // Get relay statistics
  ipcMain.handle('proxy-relay:get-stats', async (_event: IpcMainInvokeEvent, accountId: string) => {
    try {
      if (!accountId) {
        return createErrorResponse('INVALID_PARAMS', 'Account ID is required');
      }

      const status = await _proxyRelayService!.getRelayStatus(accountId);
      
      if (!status) {
        return createSuccessResponse({
          accountId,
          stats: null,
          reason: 'Relay not found'
        });
      }
      
      return createSuccessResponse({
        accountId,
        stats: {
          localPort: status.localPort,
          status: status.status,
          exitIP: status.exitIP,
          startedAt: status.startedAt,
          isRunning: status.status === 'running'
        }
      });
    } catch (error) {
      console.error('[ProxyRelayHandlers] get-stats error:', error);
      return createErrorResponse('GET_STATS_FAILED', (error as Error).message);
    }
  });

  // Get smart match suggestions based on IP geolocation
  ipcMain.handle('proxy-relay:smart-match', async (_event: IpcMainInvokeEvent, accountId: string) => {
    try {
      if (!accountId) {
        return createErrorResponse('INVALID_PARAMS', 'Account ID is required');
      }

      // Get exit IP first
      const exitIP = await _proxyRelayService!.getExitIP(accountId);
      
      if (!exitIP) {
        return createErrorResponse('NO_EXIT_IP', 'Could not determine exit IP');
      }

      // TODO: Implement IP geolocation lookup and smart matching
      // For now, return placeholder suggestions
      return createSuccessResponse({
        exitIP,
        suggestions: {
          timezone: 'UTC',
          language: 'en-US',
          geolocation: {
            latitude: 0,
            longitude: 0
          }
        },
        note: 'Smart matching based on IP geolocation is not yet fully implemented'
      });
    } catch (error) {
      console.error('[ProxyRelayHandlers] smart-match error:', error);
      return createErrorResponse('SMART_MATCH_FAILED', (error as Error).message);
    }
  });

  console.log('[ProxyRelayHandlers] Registered 10 IPC channels');
}

/**
 * Unregister all proxy relay IPC handlers
 */
function unregister(): void {
  for (const channel of CHANNELS) {
    ipcMain.removeHandler(channel);
  }

  _proxyRelayService = null;

  console.log('[ProxyRelayHandlers] Unregistered all IPC channels');
}

/**
 * Get list of registered channels
 */
function getChannels(): string[] {
  return [...CHANNELS];
}

export {
  register,
  unregister,
  getChannels,
  CHANNELS
};
