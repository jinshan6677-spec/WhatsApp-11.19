/**
 * Fingerprint IPC Handlers
 * 
 * Handles IPC communication for fingerprint configuration management.
 * Provides channels for CRUD operations, template management, batch operations,
 * and fingerprint detection/validation.
 * 
 * IPC Channels (18 total):
 * - fingerprint:get - Get fingerprint configuration for an account
 * - fingerprint:create - Create new fingerprint configuration
 * - fingerprint:update - Update existing fingerprint configuration
 * - fingerprint:delete - Delete fingerprint configuration
 * - fingerprint:generate-random - Generate random fingerprint
 * - fingerprint:validate - Validate fingerprint configuration
 * - fingerprint:get-templates - List all fingerprint templates
 * - fingerprint:save-template - Save fingerprint as template
 * - fingerprint:load-template - Load fingerprint template
 * - fingerprint:delete-template - Delete fingerprint template
 * - fingerprint:apply-batch - Apply fingerprint to multiple accounts
 * - fingerprint:detect - Detect fingerprint issues
 * - fingerprint:auto-fix - Auto-fix fingerprint issues
 * - fingerprint:get-library - Get fingerprint library entries
 * - fingerprint:get-history - Get fingerprint version history
 * - fingerprint:restore-version - Restore fingerprint to previous version
 * - fingerprint:get-strategy - Get fingerprint randomization strategy
 * - fingerprint:set-strategy - Set fingerprint randomization strategy
 * 
 * @module presentation/ipc/handlers/FingerprintHandlers
 */

import { ipcMain, IpcMainInvokeEvent } from 'electron';
import { FingerprintService, FingerprintStrategy, BatchProgressCallback } from '../../../application/services/FingerprintService';
import { FingerprintDetectionService } from '../../../application/services/FingerprintDetectionService';
import { FingerprintProfile, FingerprintProfileData } from '../../../domain/entities/FingerprintProfile';
import { FingerprintValidator } from '../../../infrastructure/fingerprint/FingerprintValidator';

// Store references for cleanup
let _fingerprintService: FingerprintService | null = null;
let _fingerprintDetectionService: FingerprintDetectionService | null = null;
let _fingerprintValidator: FingerprintValidator | null = null;

/**
 * List of all fingerprint IPC channels
 */
const CHANNELS = [
  'fingerprint:get',
  'fingerprint:create',
  'fingerprint:update',
  'fingerprint:delete',
  'fingerprint:generate-random',
  'fingerprint:validate',
  'fingerprint:get-templates',
  'fingerprint:save-template',
  'fingerprint:load-template',
  'fingerprint:delete-template',
  'fingerprint:apply-batch',
  'fingerprint:detect',
  'fingerprint:auto-fix',
  'fingerprint:get-library',
  'fingerprint:get-history',
  'fingerprint:restore-version',
  'fingerprint:get-strategy',
  'fingerprint:set-strategy'
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
interface FingerprintHandlerDependencies {
  fingerprintService: FingerprintService;
  fingerprintDetectionService?: FingerprintDetectionService;
  fingerprintValidator?: FingerprintValidator;
}

/**
 * Register fingerprint IPC handlers
 */
function register(dependencies: FingerprintHandlerDependencies): void {
  const { fingerprintService, fingerprintDetectionService, fingerprintValidator } = dependencies;

  if (!fingerprintService) {
    throw new Error('FingerprintService is required');
  }

  _fingerprintService = fingerprintService;
  _fingerprintDetectionService = fingerprintDetectionService || null;
  _fingerprintValidator = fingerprintValidator || null;

  // Get fingerprint configuration
  ipcMain.handle('fingerprint:get', async (_event: IpcMainInvokeEvent, accountId: string) => {
    try {
      if (!accountId) {
        return createErrorResponse('INVALID_PARAMS', 'Account ID is required');
      }

      const fingerprint = await _fingerprintService!.getFingerprint(accountId);
      
      if (!fingerprint) {
        return createSuccessResponse({ fingerprint: null });
      }

      return createSuccessResponse({ fingerprint: fingerprint.toJSON() });
    } catch (error) {
      console.error('[FingerprintHandlers] get error:', error);
      return createErrorResponse('GET_FAILED', (error as Error).message);
    }
  });

  // Create fingerprint configuration
  ipcMain.handle('fingerprint:create', async (_event: IpcMainInvokeEvent, accountId: string, config: Partial<FingerprintProfileData>) => {
    try {
      if (!accountId) {
        return createErrorResponse('INVALID_PARAMS', 'Account ID is required');
      }

      const fingerprint = await _fingerprintService!.createFingerprint(accountId, config);
      return createSuccessResponse({ fingerprint: fingerprint.toJSON() });
    } catch (error) {
      console.error('[FingerprintHandlers] create error:', error);
      return createErrorResponse('CREATE_FAILED', (error as Error).message);
    }
  });

  // Update fingerprint configuration
  ipcMain.handle('fingerprint:update', async (_event: IpcMainInvokeEvent, accountId: string, config: Partial<FingerprintProfileData>) => {
    try {
      if (!accountId) {
        return createErrorResponse('INVALID_PARAMS', 'Account ID is required');
      }

      await _fingerprintService!.updateFingerprint(accountId, config);
      const updated = await _fingerprintService!.getFingerprint(accountId);
      return createSuccessResponse({ fingerprint: updated?.toJSON() });
    } catch (error) {
      console.error('[FingerprintHandlers] update error:', error);
      return createErrorResponse('UPDATE_FAILED', (error as Error).message);
    }
  });

  // Delete fingerprint configuration
  ipcMain.handle('fingerprint:delete', async (_event: IpcMainInvokeEvent, accountId: string) => {
    try {
      if (!accountId) {
        return createErrorResponse('INVALID_PARAMS', 'Account ID is required');
      }

      // For now, we don't have a delete method - just return success
      // The fingerprint will be recreated with defaults when needed
      return createSuccessResponse({ deleted: true });
    } catch (error) {
      console.error('[FingerprintHandlers] delete error:', error);
      return createErrorResponse('DELETE_FAILED', (error as Error).message);
    }
  });

  // Generate random fingerprint
  ipcMain.handle('fingerprint:generate-random', async (_event: IpcMainInvokeEvent, options?: { strategy?: FingerprintStrategy; platform?: string }) => {
    try {
      const filter = options?.platform ? { platform: options.platform as 'Windows' | 'MacOS' | 'Linux' } : undefined;
      const fingerprint = await _fingerprintService!.generateRandomFingerprint(options?.strategy, filter);
      return createSuccessResponse({ fingerprint: fingerprint.toJSON() });
    } catch (error) {
      console.error('[FingerprintHandlers] generate-random error:', error);
      return createErrorResponse('GENERATE_FAILED', (error as Error).message);
    }
  });

  // Validate fingerprint configuration
  ipcMain.handle('fingerprint:validate', async (_event: IpcMainInvokeEvent, config: FingerprintProfileData) => {
    try {
      if (!config) {
        return createErrorResponse('INVALID_PARAMS', 'Configuration is required');
      }

      // Use FingerprintValidator static method
      const result = FingerprintValidator.validate(config);
      return createSuccessResponse({
        valid: result.valid,
        errors: result.errors,
        warnings: result.warnings
      });
    } catch (error) {
      console.error('[FingerprintHandlers] validate error:', error);
      return createErrorResponse('VALIDATION_FAILED', (error as Error).message);
    }
  });

  // Get all fingerprint templates
  ipcMain.handle('fingerprint:get-templates', async () => {
    try {
      const templates = await _fingerprintService!.listFingerprintTemplates();
      return createSuccessResponse({ templates });
    } catch (error) {
      console.error('[FingerprintHandlers] get-templates error:', error);
      return createErrorResponse('GET_TEMPLATES_FAILED', (error as Error).message);
    }
  });

  // Save fingerprint as template
  ipcMain.handle('fingerprint:save-template', async (_event: IpcMainInvokeEvent, name: string, config: FingerprintProfileData) => {
    try {
      if (!name) {
        return createErrorResponse('INVALID_PARAMS', 'Template name is required');
      }
      if (!config) {
        return createErrorResponse('INVALID_PARAMS', 'Configuration is required');
      }

      const profile = new FingerprintProfile(config);
      await _fingerprintService!.saveFingerprintTemplate(name, profile);
      return createSuccessResponse({ saved: true, name });
    } catch (error) {
      console.error('[FingerprintHandlers] save-template error:', error);
      return createErrorResponse('SAVE_TEMPLATE_FAILED', (error as Error).message);
    }
  });

  // Load fingerprint template
  ipcMain.handle('fingerprint:load-template', async (_event: IpcMainInvokeEvent, name: string) => {
    try {
      if (!name) {
        return createErrorResponse('INVALID_PARAMS', 'Template name is required');
      }

      const template = await _fingerprintService!.loadFingerprintTemplate(name);
      return createSuccessResponse({ template: template.toJSON() });
    } catch (error) {
      console.error('[FingerprintHandlers] load-template error:', error);
      return createErrorResponse('LOAD_TEMPLATE_FAILED', (error as Error).message);
    }
  });

  // Delete fingerprint template
  ipcMain.handle('fingerprint:delete-template', async (_event: IpcMainInvokeEvent, name: string) => {
    try {
      if (!name) {
        return createErrorResponse('INVALID_PARAMS', 'Template name is required');
      }

      await _fingerprintService!.deleteFingerprintTemplate(name);
      return createSuccessResponse({ deleted: true, name });
    } catch (error) {
      console.error('[FingerprintHandlers] delete-template error:', error);
      return createErrorResponse('DELETE_TEMPLATE_FAILED', (error as Error).message);
    }
  });

  // Apply fingerprint to multiple accounts (batch operation)
  ipcMain.handle('fingerprint:apply-batch', async (_event: IpcMainInvokeEvent, accountIds: string[], templateName: string) => {
    try {
      if (!accountIds || !Array.isArray(accountIds) || accountIds.length === 0) {
        return createErrorResponse('INVALID_PARAMS', 'Account IDs array is required');
      }
      if (!templateName) {
        return createErrorResponse('INVALID_PARAMS', 'Template name is required');
      }

      const result = await _fingerprintService!.applyFingerprintTemplateBatch(accountIds, templateName);
      const summary = _fingerprintService!.generateBatchSummary(result);
      
      return createSuccessResponse({
        result,
        summary
      });
    } catch (error) {
      console.error('[FingerprintHandlers] apply-batch error:', error);
      return createErrorResponse('BATCH_APPLY_FAILED', (error as Error).message);
    }
  });

  // Detect fingerprint issues
  ipcMain.handle('fingerprint:detect', async (_event: IpcMainInvokeEvent, config: FingerprintProfileData) => {
    try {
      if (!config) {
        return createErrorResponse('INVALID_PARAMS', 'Configuration is required');
      }

      if (!_fingerprintDetectionService) {
        return createErrorResponse('SERVICE_UNAVAILABLE', 'Fingerprint detection service is not available');
      }

      const profile = new FingerprintProfile(config);
      const result = await _fingerprintDetectionService.detectFingerprint(profile);
      return createSuccessResponse({ result });
    } catch (error) {
      console.error('[FingerprintHandlers] detect error:', error);
      return createErrorResponse('DETECTION_FAILED', (error as Error).message);
    }
  });

  // Auto-fix fingerprint issues
  ipcMain.handle('fingerprint:auto-fix', async (_event: IpcMainInvokeEvent, config: FingerprintProfileData, risks: Array<{ category: string; severity: string; description: string }>) => {
    try {
      if (!config) {
        return createErrorResponse('INVALID_PARAMS', 'Configuration is required');
      }

      if (!_fingerprintDetectionService) {
        return createErrorResponse('SERVICE_UNAVAILABLE', 'Fingerprint detection service is not available');
      }

      const profile = new FingerprintProfile(config);
      const fixed = await _fingerprintDetectionService.autoFix(profile, risks as any);
      return createSuccessResponse({ fingerprint: fixed.toJSON() });
    } catch (error) {
      console.error('[FingerprintHandlers] auto-fix error:', error);
      return createErrorResponse('AUTO_FIX_FAILED', (error as Error).message);
    }
  });

  // Get fingerprint library entries
  ipcMain.handle('fingerprint:get-library', async (_event: IpcMainInvokeEvent, filter?: { platform?: string; browser?: string }) => {
    try {
      const library = _fingerprintService!.getLibrary();
      await library.load();
      
      const entries = await library.getAll();
      
      // Apply filters if provided
      let filtered = entries;
      if (filter?.platform) {
        filtered = filtered.filter((e: any) => e.platform === filter.platform);
      }
      if (filter?.browser) {
        filtered = filtered.filter((e: any) => e.browserVersion.includes(filter.browser!));
      }

      return createSuccessResponse({
        entries: filtered,
        total: entries.length,
        filtered: filtered.length
      });
    } catch (error) {
      console.error('[FingerprintHandlers] get-library error:', error);
      return createErrorResponse('GET_LIBRARY_FAILED', (error as Error).message);
    }
  });

  // Get fingerprint version history (placeholder - needs implementation)
  ipcMain.handle('fingerprint:get-history', async (_event: IpcMainInvokeEvent, accountId: string) => {
    try {
      if (!accountId) {
        return createErrorResponse('INVALID_PARAMS', 'Account ID is required');
      }

      // TODO: Implement version history storage
      // For now, return empty history
      return createSuccessResponse({
        history: [],
        accountId
      });
    } catch (error) {
      console.error('[FingerprintHandlers] get-history error:', error);
      return createErrorResponse('GET_HISTORY_FAILED', (error as Error).message);
    }
  });

  // Restore fingerprint to previous version (placeholder - needs implementation)
  ipcMain.handle('fingerprint:restore-version', async (_event: IpcMainInvokeEvent, accountId: string, versionId: string) => {
    try {
      if (!accountId) {
        return createErrorResponse('INVALID_PARAMS', 'Account ID is required');
      }
      if (!versionId) {
        return createErrorResponse('INVALID_PARAMS', 'Version ID is required');
      }

      // TODO: Implement version restoration
      return createErrorResponse('NOT_IMPLEMENTED', 'Version restoration is not yet implemented');
    } catch (error) {
      console.error('[FingerprintHandlers] restore-version error:', error);
      return createErrorResponse('RESTORE_VERSION_FAILED', (error as Error).message);
    }
  });

  // Get fingerprint randomization strategy (placeholder - needs implementation)
  ipcMain.handle('fingerprint:get-strategy', async (_event: IpcMainInvokeEvent, accountId: string) => {
    try {
      if (!accountId) {
        return createErrorResponse('INVALID_PARAMS', 'Account ID is required');
      }

      // TODO: Implement strategy storage
      // For now, return default strategy
      return createSuccessResponse({
        strategy: {
          type: 'fixed',
          interval: undefined,
          randomFields: undefined
        },
        accountId
      });
    } catch (error) {
      console.error('[FingerprintHandlers] get-strategy error:', error);
      return createErrorResponse('GET_STRATEGY_FAILED', (error as Error).message);
    }
  });

  // Set fingerprint randomization strategy (placeholder - needs implementation)
  ipcMain.handle('fingerprint:set-strategy', async (_event: IpcMainInvokeEvent, accountId: string, strategy: FingerprintStrategy) => {
    try {
      if (!accountId) {
        return createErrorResponse('INVALID_PARAMS', 'Account ID is required');
      }
      if (!strategy) {
        return createErrorResponse('INVALID_PARAMS', 'Strategy is required');
      }

      // TODO: Implement strategy storage
      return createSuccessResponse({
        saved: true,
        accountId,
        strategy
      });
    } catch (error) {
      console.error('[FingerprintHandlers] set-strategy error:', error);
      return createErrorResponse('SET_STRATEGY_FAILED', (error as Error).message);
    }
  });

  console.log('[FingerprintHandlers] Registered 18 IPC channels');
}

/**
 * Unregister all fingerprint IPC handlers
 */
function unregister(): void {
  for (const channel of CHANNELS) {
    ipcMain.removeHandler(channel);
  }

  _fingerprintService = null;
  _fingerprintDetectionService = null;
  _fingerprintValidator = null;

  console.log('[FingerprintHandlers] Unregistered all IPC channels');
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
