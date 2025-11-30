/**
 * IPC Handlers Module - Aggregates all domain-specific IPC handlers
 * 
 * This module serves as the central entry point for all IPC handlers,
 * organizing them by functional domain for better maintainability.
 * 
 * Handler Modules:
 * - AccountIPCHandlers: Account CRUD, switching, status (25 handlers)
 * - ViewIPCHandlers: View management, session, monitoring (25 handlers)
 * - SystemIPCHandlers: Sidebar, window resize, layout (3 handlers)
 * - TranslationIPCHandlers: Translation panel, chat info (5 handlers)
 * - TranslationServiceIPCHandlers: Translation service IPC (13 handlers) - ✅ MIGRATED to IPCRouter
 * - FingerprintHandlers: Fingerprint configuration management (18 handlers)
 * - DetectionHandlers: Fingerprint detection and validation (8 handlers)
 * - DetectionHandlers: Fingerprint detection and validation (8 handlers)
 * 
 * Total: ~100+ IPC handlers organized by domain
 * 
 * Migration Status:
 * - ✅ TranslationServiceIPCHandlers: Fully migrated to IPCRouter with request validation
 * - ⏳ Other handlers: Still using legacy ipcMain.handle (backward compatible)
 * 
 * @module presentation/ipc/handlers
 */

'use strict';

const AccountIPCHandlers = require('./AccountIPCHandlers');
const ViewIPCHandlers = require('./ViewIPCHandlers');
const SystemIPCHandlers = require('./SystemIPCHandlers');
const TranslationIPCHandlers = require('./TranslationIPCHandlers');
const TranslationServiceIPCHandlers = require('./TranslationServiceIPCHandlers');

// New fingerprint-related handlers (TypeScript)
let FingerprintHandlers = null;
let DetectionHandlers = null;

try {
  FingerprintHandlers = require('./FingerprintHandlers');
} catch (e) {
  console.warn('[IPC] FingerprintHandlers not available (TypeScript compilation may be needed)');
}


try {
  DetectionHandlers = require('./DetectionHandlers');
} catch (e) {
  console.warn('[IPC] DetectionHandlers not available (TypeScript compilation may be needed)');
}

/**
 * Register all IPC handlers for single-window architecture
 * @param {Object} dependencies - Handler dependencies
 * @param {AccountConfigManager} dependencies.accountManager - Account configuration manager
 * @param {ViewManager} dependencies.viewManager - View manager for BrowserViews
 * @param {MainWindow} dependencies.mainWindow - Main window instance
 * @param {TranslationIntegration} [dependencies.translationIntegration] - Translation integration instance
 * @param {EventBus} [dependencies.eventBus] - Event bus for publishing events
 * @param {IPCRouter} [dependencies.ipcRouter] - IPCRouter instance for new architecture handlers
 * @param {Object} [dependencies.translationService] - Translation service instance
 * @param {Object} [dependencies.fingerprintService] - Fingerprint service instance
 * @param {Object} [dependencies.fingerprintDetectionService] - Fingerprint detection service instance
 * @param {Object} [dependencies.fingerprintValidator] - Fingerprint validator instance
 */
function registerAllHandlers(dependencies) {
  const { 
    accountManager, 
    viewManager, 
    mainWindow, 
    translationIntegration,
    eventBus,
    ipcRouter,
    translationService,
    fingerprintService,
    fingerprintDetectionService,
    fingerprintValidator
  } = dependencies;

  if (!accountManager) {
    throw new Error('AccountManager is required');
  }
  if (!viewManager) {
    throw new Error('ViewManager is required');
  }
  if (!mainWindow) {
    throw new Error('MainWindow is required');
  }

  // Register handlers by domain
  AccountIPCHandlers.register({ accountManager, viewManager, mainWindow });
  ViewIPCHandlers.register({ accountManager, viewManager, mainWindow });
  SystemIPCHandlers.register({ viewManager, mainWindow });
  TranslationIPCHandlers.register({ viewManager, mainWindow, translationIntegration });
  
  

  // Register translation service handlers with IPCRouter if provided
  if (ipcRouter && translationService) {
    TranslationServiceIPCHandlers.registerWithRouter(ipcRouter, { translationService });
    console.log('[IPC] Translation service handlers registered with IPCRouter (13 channels)');
  } else if (translationService) {
    console.log('[IPC] Translation service available but IPCRouter not provided - using legacy handlers');
  }

  // Register fingerprint handlers if service is available
  if (FingerprintHandlers && fingerprintService) {
    FingerprintHandlers.register({
      fingerprintService,
      fingerprintDetectionService,
      fingerprintValidator
    });
    console.log('[IPC] Fingerprint handlers registered (18 channels)');
  }

  

  // Register detection handlers
  if (DetectionHandlers) {
    DetectionHandlers.register({
      detectionService: fingerprintDetectionService,
      validator: fingerprintValidator
    });
    console.log('[IPC] Detection handlers registered (8 channels)');
  }

  console.log('[IPC] All domain handlers registered');
  
  

  // Log fingerprint status
  if (fingerprintService) {
    console.log('[IPC] ✓ Fingerprint management enabled (FingerprintService available)');
  } else {
    console.log('[IPC] ⚠ Fingerprint management not available');
  }
}

/**
 * Unregister all IPC handlers
 */
function unregisterAllHandlers() {
  AccountIPCHandlers.unregister();
  ViewIPCHandlers.unregister();
  SystemIPCHandlers.unregister();
  TranslationIPCHandlers.unregister();
  

  // Unregister fingerprint-related handlers
  if (FingerprintHandlers) {
    FingerprintHandlers.unregister();
  }
  
  if (DetectionHandlers) {
    DetectionHandlers.unregister();
  }

  console.log('[IPC] All domain handlers unregistered');
}

/**
 * Get handler statistics
 * @returns {Object} Statistics about registered handlers
 */
function getHandlerStats() {
  return {
    modules: {
      account: 'AccountIPCHandlers - Account CRUD, switching, status (25 handlers)',
      view: 'ViewIPCHandlers - View management, session, monitoring (25 handlers)',
      system: 'SystemIPCHandlers - Sidebar, window resize, layout (3 handlers)',
      translation: 'TranslationIPCHandlers - Translation panel, chat info (5 handlers)',
      fingerprint: 'FingerprintHandlers - Fingerprint configuration management (18 handlers)',
      detection: 'DetectionHandlers - Fingerprint detection and validation (8 handlers)'
    },
    totalModules: 6,
    fingerprintAvailable: !!FingerprintHandlers,
    
    detectionAvailable: !!DetectionHandlers
  };
}

module.exports = {
  // Aggregated registration
  registerAllHandlers,
  unregisterAllHandlers,
  getHandlerStats,
  
  // Individual handler modules for selective use
  AccountIPCHandlers,
  ViewIPCHandlers,
  SystemIPCHandlers,
  TranslationIPCHandlers,
  TranslationServiceIPCHandlers,
  
  // New fingerprint-related handlers (may be null if TypeScript not compiled)
  FingerprintHandlers,
  DetectionHandlers
};
