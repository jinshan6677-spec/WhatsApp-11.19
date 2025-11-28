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
 * - ProxyIPCHandlers: Proxy configuration management (8 existing + 7 security = 15 handlers)
 * - FingerprintHandlers: Fingerprint configuration management (18 handlers)
 * - ProxyRelayHandlers: Proxy relay service management (10 handlers)
 * - DetectionHandlers: Fingerprint detection and validation (8 handlers)
 * 
 * Total: ~122 IPC handlers organized by domain
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
const ProxyIPCHandlers = require('./ProxyIPCHandlers');
const TranslationIPCHandlers = require('./TranslationIPCHandlers');
const TranslationServiceIPCHandlers = require('./TranslationServiceIPCHandlers');

// New fingerprint-related handlers (TypeScript)
let FingerprintHandlers = null;
let ProxyRelayHandlers = null;
let DetectionHandlers = null;

try {
  FingerprintHandlers = require('./FingerprintHandlers');
} catch (e) {
  console.warn('[IPC] FingerprintHandlers not available (TypeScript compilation may be needed)');
}

try {
  ProxyRelayHandlers = require('./ProxyRelayHandlers');
} catch (e) {
  console.warn('[IPC] ProxyRelayHandlers not available (TypeScript compilation may be needed)');
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
 * @param {ProxyConfigManager} [dependencies.proxyConfigManager] - Proxy configuration manager
 * @param {ProxyDetectionService} [dependencies.proxyDetectionService] - Proxy detection service
 * @param {ProxyService} [dependencies.proxyService] - New proxy service with security features
 * @param {ProxyRepository} [dependencies.proxyRepository] - Proxy repository for data access
 * @param {EventBus} [dependencies.eventBus] - Event bus for publishing events
 * @param {IPCRouter} [dependencies.ipcRouter] - IPCRouter instance for new architecture handlers
 * @param {Object} [dependencies.translationService] - Translation service instance
 * @param {Object} [dependencies.fingerprintService] - Fingerprint service instance
 * @param {Object} [dependencies.fingerprintDetectionService] - Fingerprint detection service instance
 * @param {Object} [dependencies.fingerprintValidator] - Fingerprint validator instance
 * @param {Object} [dependencies.proxyRelayService] - Proxy relay service instance
 */
function registerAllHandlers(dependencies) {
  const { 
    accountManager, 
    viewManager, 
    mainWindow, 
    translationIntegration,
    proxyConfigManager,
    proxyDetectionService,
    proxyService,
    proxyRepository,
    eventBus,
    ipcRouter,
    translationService,
    fingerprintService,
    fingerprintDetectionService,
    fingerprintValidator,
    proxyRelayService
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
  
  // Register proxy handlers - prefer IPCRouter with ProxyService for new architecture
  if (ipcRouter && proxyService) {
    // New architecture: Use IPCRouter with ProxyService for full security features
    ProxyIPCHandlers.registerWithRouter(ipcRouter, {
      proxyService,
      proxyConfigManager,
      proxyDetectionService,
      proxyRepository,
      eventBus
    });
    console.log('[IPC] Proxy handlers registered with IPCRouter (15 channels: 8 existing + 7 security)');
  } else if (proxyConfigManager && proxyDetectionService) {
    // Legacy fallback: Use ipcMain.handle directly
    ProxyIPCHandlers.register({ 
      proxyConfigManager, 
      proxyDetectionService,
      proxyService,      // Optional: ProxyService for security features
      proxyRepository,   // Optional: ProxyRepository for data access
      eventBus           // Optional: EventBus for event publishing
    });
    console.log('[IPC] Proxy handlers registered with legacy ipcMain (backward compatible)');
  }

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

  // Register proxy relay handlers if service is available
  if (ProxyRelayHandlers && proxyRelayService) {
    ProxyRelayHandlers.register({
      proxyRelayService
    });
    console.log('[IPC] Proxy relay handlers registered (10 channels)');
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
  
  // Log proxy security status
  if (proxyService) {
    console.log('[IPC] ✓ Proxy security features enabled (ProxyService available)');
  } else {
    console.log('[IPC] ⚠ Proxy security features limited (ProxyService not provided)');
  }

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
  ProxyIPCHandlers.unregister();

  // Unregister fingerprint-related handlers
  if (FingerprintHandlers) {
    FingerprintHandlers.unregister();
  }
  if (ProxyRelayHandlers) {
    ProxyRelayHandlers.unregister();
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
  const proxyChannels = ProxyIPCHandlers.getChannels();
  
  return {
    modules: {
      account: 'AccountIPCHandlers - Account CRUD, switching, status (25 handlers)',
      view: 'ViewIPCHandlers - View management, session, monitoring (25 handlers)',
      system: 'SystemIPCHandlers - Sidebar, window resize, layout (3 handlers)',
      translation: 'TranslationIPCHandlers - Translation panel, chat info (5 handlers)',
      proxy: `ProxyIPCHandlers - Proxy configuration and security (${proxyChannels.summary.totalCount} handlers)`,
      fingerprint: 'FingerprintHandlers - Fingerprint configuration management (18 handlers)',
      proxyRelay: 'ProxyRelayHandlers - Proxy relay service management (10 handlers)',
      detection: 'DetectionHandlers - Fingerprint detection and validation (8 handlers)'
    },
    totalModules: 8,
    proxyDetails: {
      existing: proxyChannels.summary.existingCount,
      security: proxyChannels.summary.securityCount,
      securityEnabled: ProxyIPCHandlers.isSecurityEnabled()
    },
    fingerprintAvailable: !!FingerprintHandlers,
    proxyRelayAvailable: !!ProxyRelayHandlers,
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
  ProxyIPCHandlers,
  TranslationIPCHandlers,
  TranslationServiceIPCHandlers,
  
  // New fingerprint-related handlers (may be null if TypeScript not compiled)
  FingerprintHandlers,
  ProxyRelayHandlers,
  DetectionHandlers
};
