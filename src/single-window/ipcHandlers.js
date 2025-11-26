/**
 * IPC Handlers for Single-Window Architecture
 * 
 * This file serves as a compatibility layer that delegates to the new
 * modular IPC handlers in src/presentation/ipc/handlers/.
 * 
 * The handlers have been split into domain-specific modules:
 * - AccountIPCHandlers: Account CRUD, switching, status
 * - ViewIPCHandlers: View management, session, monitoring
 * - SystemIPCHandlers: Sidebar, window resize, layout
 * - TranslationIPCHandlers: Translation panel, chat info
 * - ProxyIPCHandlers: Proxy configuration (separate registration)
 * 
 * @module single-window/ipcHandlers
 */

'use strict';

const AccountIPCHandlers = require('../presentation/ipc/handlers/AccountIPCHandlers');
const ViewIPCHandlers = require('../presentation/ipc/handlers/ViewIPCHandlers');
const SystemIPCHandlers = require('../presentation/ipc/handlers/SystemIPCHandlers');
const { ipcMain } = require('electron');

/**
 * Register IPC handlers for single-window architecture
 * @param {AccountConfigManager} accountManager - Account configuration manager
 * @param {ViewManager} viewManager - View manager for BrowserViews
 * @param {MainWindow} mainWindow - Main window instance
 * @param {TranslationIntegration} [translationIntegration] - Translation integration instance (optional)
 */
function registerIPCHandlers(accountManager, viewManager, mainWindow, translationIntegration = null) {
  if (!accountManager) {
    throw new Error('AccountManager is required');
  }
  if (!viewManager) {
    throw new Error('ViewManager is required');
  }
  if (!mainWindow) {
    throw new Error('MainWindow is required');
  }

  const dependencies = {
    accountManager,
    viewManager,
    mainWindow,
    translationIntegration
  };

  // Register all domain handlers
  AccountIPCHandlers.register(dependencies);
  ViewIPCHandlers.register(dependencies);
  SystemIPCHandlers.register(dependencies);

  // Register translation:apply-config handler
  ipcMain.handle('translation:apply-config', async (event, accountId, config) => {
    try {
      if (!accountId) {
        return { success: false, error: 'Account ID is required' };
      }

      // Get the view for this account
      const view = viewManager.getView(accountId);
      if (!view || !view.webContents) {
        return { success: false, error: 'View not found for account' };
      }

      // Inject translation config into the view's webContents
      await view.webContents.executeJavaScript(`
        if (window.WhatsAppTranslation) {
          window.WhatsAppTranslation.updateConfig(${JSON.stringify(config)});
        }
      `);

      return { success: true };
    } catch (error) {
      console.error('[IPC] translation:apply-config error:', error);
      return { success: false, error: error.message };
    }
  });

  // Register get-translation-panel-layout handler
  ipcMain.handle('get-translation-panel-layout', async (event) => {
    try {
      const layout = mainWindow.getTranslationPanelLayout();
      return {
        success: true,
        layout: layout
      };
    } catch (error) {
      console.error('[IPC] get-translation-panel-layout error:', error);
      return { success: false, error: error.message };
    }
  });

  // Register translation:get-active-chat handler
  ipcMain.handle('translation:get-active-chat', async (event) => {
    try {
      // Get the active account's view
      const activeAccountId = viewManager.getActiveAccountId();
      if (!activeAccountId) {
        return { success: false, error: 'No active account' };
      }

      const view = viewManager.getView(activeAccountId);
      if (!view || !view.webContents) {
        return { success: false, error: 'View not found for active account' };
      }

      // Get active chat info from the WhatsApp page
      const chatInfo = await view.webContents.executeJavaScript(`
        (function() {
          try {
            // Try to get the active chat element
            const chatHeader = document.querySelector('[data-testid="conversation-header"]');
            if (!chatHeader) {
              return { contactId: null, contactName: null };
            }

            // Try to get contact name
            const nameElement = chatHeader.querySelector('[data-testid="conversation-info-header-chat-title"]');
            const contactName = nameElement ? nameElement.textContent : null;

            // Try to get contact ID from the URL or data attributes
            let contactId = null;
            const urlMatch = window.location.href.match(/chat\\/([^/]+)/);
            if (urlMatch) {
              contactId = urlMatch[1];
            }

            return {
              contactId: contactId,
              contactName: contactName,
              isGroup: chatHeader.querySelector('[data-testid="default-group"]') !== null
            };
          } catch (error) {
            console.error('[get-active-chat] Error:', error);
            return { contactId: null, contactName: null, error: error.message };
          }
        })()
      `);

      return {
        success: true,
        data: chatInfo
      };
    } catch (error) {
      console.error('[IPC] translation:get-active-chat error:', error);
      return { success: false, error: error.message };
    }
  });

  console.log('[IPC] Single-window handlers registered');
}

/**
 * Unregister IPC handlers
 */
function unregisterIPCHandlers() {
  AccountIPCHandlers.unregister();
  ViewIPCHandlers.unregister();
  SystemIPCHandlers.unregister();
  
  // Unregister translation handlers
  ipcMain.removeHandler('translation:apply-config');
  ipcMain.removeHandler('translation:get-active-chat');
  ipcMain.removeHandler('get-translation-panel-layout');
  
  console.log('[IPC] Single-window handlers unregistered');
}

module.exports = {
  registerIPCHandlers,
  unregisterIPCHandlers,
  
  // Export individual handler modules for selective use
  AccountIPCHandlers,
  ViewIPCHandlers,
  SystemIPCHandlers
};
