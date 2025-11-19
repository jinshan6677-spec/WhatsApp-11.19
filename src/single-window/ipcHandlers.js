/**
 * IPC Handlers for Single-Window Architecture
 * 
 * Handles IPC communication between the main window renderer and main process
 * for account management and view switching operations.
 */

const { ipcMain, BrowserWindow } = require('electron');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const {
  validateAccountConfig,
  validateAccountId,
  handleNetworkFailure,
  validateOperationSafety
} = require('../utils/ValidationHelper');

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

  /**
   * Get a single account by ID
   * Handler: get-account
   */
  ipcMain.handle('get-account', async (event, accountId) => {
    try {
      if (!accountId) {
        throw new Error('Account ID is required');
      }

      const account = await accountManager.getAccount(accountId);
      
      if (!account) {
        return null;
      }

      return account.toJSON();
    } catch (error) {
      console.error('[IPC] Failed to get account:', error);
      return null;
    }
  });

  /**
   * Get list of all accounts
   * Handler: get-accounts
   */
  ipcMain.handle('get-accounts', async () => {
    try {
      const accounts = await accountManager.getAccountsSorted();
      return accounts.map(account => account.toJSON());
    } catch (error) {
      console.error('[IPC] Failed to get accounts:', error);
      return [];
    }
  });

  /**
   * Get list of all accounts with status
   * Handler: account:list
   */
  ipcMain.handle('account:list', async () => {
    try {
      const accounts = await accountManager.getAccountsSorted();
      
      // Attach view status information
      const accountsWithStatus = accounts.map(account => {
        const viewState = viewManager.getViewState(account.id);
        const isActive = viewManager.getActiveAccountId() === account.id;
        
        return {
          ...account.toJSON(),
          viewStatus: viewState ? viewState.status : 'not_created',
          isActive,
          isLoaded: viewState ? viewState.isLoaded : false,
          loginStatus: viewState ? viewState.loginStatus : false,
          connectionStatus: viewState ? viewState.connectionStatus : 'offline',
          connectionError: viewState ? viewState.connectionError : null
        };
      });
      
      return {
        success: true,
        accounts: accountsWithStatus
      };
    } catch (error) {
      console.error('[IPC] Failed to list accounts:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });

  /**
   * Open account dialog for creating or editing
   * Handler: open-account-dialog
   */
  ipcMain.on('account:create', () => {
    openAccountDialog(null);
  });

  ipcMain.on('account:edit', (event, accountId) => {
    openAccountDialog(accountId);
  });

  /**
   * Open account configuration dialog
   */
  function openAccountDialog(accountId = null) {
    const dialogWindow = new BrowserWindow({
      width: 700,
      height: 800,
      minWidth: 600,
      minHeight: 700,
      parent: mainWindow.getWindow(),
      modal: true,
      show: false,
      autoHideMenuBar: true,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, 'renderer', 'preload-main.js')
      }
    });

    // Build URL with account ID if editing
    let url = `file://${path.join(__dirname, 'renderer', 'accountDialog.html')}`;
    if (accountId) {
      url += `?accountId=${encodeURIComponent(accountId)}`;
    }

    dialogWindow.loadURL(url);

    // Show when ready
    dialogWindow.once('ready-to-show', () => {
      dialogWindow.show();
    });

    // Clean up on close
    dialogWindow.on('closed', async () => {
      // Refresh account list in main window
      try {
        const accounts = await accountManager.getAccountsSorted();
        const accountsData = accounts.map(account => account.toJSON());
        mainWindow.sendToRenderer('accounts-updated', accountsData);
      } catch (error) {
        console.error('[IPC] Failed to refresh account list after dialog close:', error);
      }
    });
  }

  /**
   * Create a new account
   * Handler: create-account
   */
  ipcMain.handle('create-account', async (event, config) => {
    try {
      // Validate required fields
      if (!config.name || config.name.trim() === '') {
        throw new Error('Account name is required');
      }

      // Create account configuration
      const accountConfig = {
        id: uuidv4(),
        name: config.name.trim(),
        note: config.note || '',
        proxy: config.proxy || {
          enabled: false,
          protocol: 'http',
          host: '',
          port: 0,
          username: '',
          password: '',
          bypass: ''
        },
        translation: config.translation || {
          enabled: false,
          targetLanguage: 'zh-CN',
          engine: 'google',
          autoTranslate: false,
          translateInput: false,
          friendSettings: {}
        },
        sessionDir: `session-data/account-${uuidv4()}`,
        createdAt: new Date(),
        lastActiveAt: null,
        autoStart: config.autoStart || false
      };

      // Validate account configuration before creating
      const validation = validateAccountConfig(accountConfig);
      if (!validation.valid) {
        return {
          success: false,
          errors: validation.errors
        };
      }

      // Save account (AccountManager will perform additional validation)
      const result = await accountManager.createAccount(accountConfig);
      
      if (!result.success) {
        return {
          success: false,
          errors: result.errors
        };
      }

      // Notify renderer to update account list
      const updatedAccounts = await accountManager.loadAccounts();
      mainWindow.sendToRenderer('accounts-updated', updatedAccounts.map(acc => acc.toJSON()));

      return {
        success: true,
        account: result.account.toJSON()
      };
    } catch (error) {
      console.error('[IPC] Failed to create account:', error);
      return {
        success: false,
        errors: [error.message]
      };
    }
  });

  /**
   * Update an existing account
   * Handler: update-account
   */
  ipcMain.handle('update-account', async (event, accountId, updates) => {
    try {
      // Validate account ID
      if (!accountId) {
        throw new Error('Account ID is required');
      }

      // Check if account exists
      const existingAccount = await accountManager.getAccount(accountId);
      if (!existingAccount) {
        throw new Error(`Account ${accountId} not found`);
      }

      // Validate name if provided
      if (updates.name !== undefined && updates.name.trim() === '') {
        throw new Error('Account name cannot be empty');
      }

      // Prepare updates
      const accountUpdates = {};
      
      if (updates.name !== undefined) {
        accountUpdates.name = updates.name.trim();
      }
      if (updates.note !== undefined) {
        accountUpdates.note = updates.note;
      }
      if (updates.proxy !== undefined) {
        accountUpdates.proxy = updates.proxy;
      }
      if (updates.translation !== undefined) {
        accountUpdates.translation = updates.translation;
      }
      if (updates.autoStart !== undefined) {
        accountUpdates.autoStart = updates.autoStart;
      }

      // Update account
      const result = await accountManager.updateAccount(accountId, accountUpdates);
      
      if (!result.success) {
        throw new Error(result.errors.join(', '));
      }

      // If proxy configuration changed and view exists, apply new proxy
      if (updates.proxy && viewManager.hasView(accountId)) {
        const viewState = viewManager.getViewState(accountId);
        if (viewState && updates.proxy.enabled) {
          // Note: Proxy changes require view recreation for full effect
          console.log(`[IPC] Proxy config updated for account ${accountId}. Restart view to apply changes.`);
        }
      }

      // If translation configuration changed and view exists, apply new translation config
      if (updates.translation && viewManager.hasView(accountId)) {
        try {
          const translationResult = await viewManager.updateTranslationConfig(
            accountId,
            updates.translation
          );
          
          if (translationResult.success) {
            console.log(`[IPC] Translation config updated for account ${accountId}`);
          } else {
            console.warn(`[IPC] Failed to update translation config for account ${accountId}: ${translationResult.error}`);
          }
        } catch (translationError) {
          console.error(`[IPC] Error updating translation config for account ${accountId}:`, translationError);
        }
      }

      // Notify renderer to update account list
      const updatedAccounts = await accountManager.loadAccounts();
      mainWindow.sendToRenderer('accounts-updated', updatedAccounts.map(acc => acc.toJSON()));

      return {
        success: true,
        account: result.account.toJSON()
      };
    } catch (error) {
      console.error('[IPC] Failed to update account:', error);
      return {
        success: false,
        errors: [error.message]
      };
    }
  });

  /**
   * Delete an account
   * Handler: delete-account
   */
  ipcMain.handle('delete-account', async (event, accountId, options = {}) => {
    try {
      // Validate account ID
      const idValidation = validateAccountId(accountId);
      if (!idValidation.valid) {
        throw new Error(idValidation.error);
      }

      // Check if account exists
      const account = await accountManager.getAccount(accountId);
      if (!account) {
        throw new Error(`Account ${accountId} not found`);
      }

      // Validate operation safety
      const isActive = viewManager.getActiveAccountId() === accountId;
      const viewState = viewManager.getViewState(accountId);
      const safetyCheck = validateOperationSafety('delete-account', {
        isActive,
        hasUnsavedData: viewState && viewState.isLoaded
      });

      // Log warnings but don't block operation
      if (safetyCheck.warnings.length > 0) {
        console.warn('[IPC] Delete account warnings:', safetyCheck.warnings);
      }

      // If view exists, destroy it first
      if (viewManager.hasView(accountId)) {
        await viewManager.destroyView(accountId);
      }

      // Delete account configuration
      const deleteOptions = {
        deleteUserData: options.deleteUserData !== false, // Default to true unless explicitly set to false
        userDataPath: options.userDataPath
      };
      
      const result = await accountManager.deleteAccount(accountId, deleteOptions);
      
      if (!result.success) {
        throw new Error(result.errors.join(', '));
      }

      // If this was the active account, clear active state
      if (isActive) {
        // Try to switch to another account if available
        const remainingAccounts = await accountManager.loadAccounts();
        if (remainingAccounts.length > 0) {
          // Switch to first available account
          await viewManager.showView(remainingAccounts[0].id);
        }
      }

      // Notify renderer to update account list
      const updatedAccounts = await accountManager.loadAccounts();
      mainWindow.sendToRenderer('accounts-updated', updatedAccounts.map(acc => acc.toJSON()));

      return {
        success: true
      };
    } catch (error) {
      console.error('[IPC] Failed to delete account:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });

  /**
   * Switch to a different account view
   * Handler: switch-account
   */
  ipcMain.handle('switch-account', async (event, accountId) => {
    try {
      // Validate account ID
      const idValidation = validateAccountId(accountId);
      if (!idValidation.valid) {
        throw new Error(idValidation.error);
      }

      // Check if account exists
      const account = await accountManager.getAccount(accountId);
      if (!account) {
        throw new Error(`Account ${accountId} not found`);
      }

      // Validate operation safety
      const viewCount = viewManager.getViewCount();
      const safetyCheck = validateOperationSafety('switch-account', {
        viewCount,
        accountExists: true
      });

      // Log warnings but don't block operation
      if (safetyCheck.warnings.length > 0) {
        console.warn('[IPC] Switch account warnings:', safetyCheck.warnings);
      }

      // Use ViewManager's switchView method with auto-creation
      const result = await viewManager.switchView(accountId, {
        createIfMissing: true,
        viewConfig: {
          url: 'https://web.whatsapp.com',
          proxy: account.proxy,
          translation: account.translation
        }
      });

      if (!result.success) {
        throw new Error(result.error || 'Failed to switch view');
      }

      // Update last active time
      await accountManager.updateAccount(accountId, {
        lastActiveAt: new Date()
      });

      // Notify renderer about active account change
      mainWindow.sendToRenderer('account:active-changed', {
        accountId,
        previousAccountId: result.previousAccountId
      });

      return {
        success: true,
        accountId,
        alreadyActive: result.alreadyActive || false
      };
    } catch (error) {
      console.error('[IPC] Failed to switch account:', error);
      
      // Handle network failures gracefully
      if (error.code || error.errno) {
        const failureInfo = handleNetworkFailure(error, { accountId, operation: 'switch-account' });
        console.error('[IPC] Network failure details:', failureInfo.technicalDetails);
        return {
          success: false,
          error: failureInfo.userMessage,
          retryable: failureInfo.retryable
        };
      }
      
      return {
        success: false,
        error: error.message
      };
    }
  });

  /**
   * Switch to account by index (for keyboard shortcuts)
   * Handler: switch-account-by-index
   */
  ipcMain.handle('switch-account-by-index', async (event, index) => {
    try {
      if (typeof index !== 'number' || index < 0) {
        throw new Error('Invalid index');
      }

      // Get accounts in order
      const accounts = await accountManager.getAccountsSorted();
      
      if (index >= accounts.length) {
        return {
          success: false,
          error: 'Account index out of range'
        };
      }

      const account = accounts[index];
      
      // Use the regular switch-account handler
      return await ipcMain.emit('switch-account', event, account.id);
    } catch (error) {
      console.error('[IPC] Failed to switch account by index:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });

  /**
   * Switch to next account
   * Handler: switch-to-next-account
   */
  ipcMain.handle('switch-to-next-account', async () => {
    try {
      const result = await viewManager.switchToNextView();
      
      if (result.success && result.accountId && !result.alreadyActive) {
        // Update last active time
        await accountManager.updateAccount(result.accountId, {
          lastActiveAt: new Date()
        });

        // Notify renderer
        mainWindow.sendToRenderer('account:active-changed', {
          accountId: result.accountId
        });
      }

      return result;
    } catch (error) {
      console.error('[IPC] Failed to switch to next account:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });

  /**
   * Switch to previous account
   * Handler: switch-to-previous-account
   */
  ipcMain.handle('switch-to-previous-account', async () => {
    try {
      const result = await viewManager.switchToPreviousView();
      
      if (result.success && result.accountId && !result.alreadyActive) {
        // Update last active time
        await accountManager.updateAccount(result.accountId, {
          lastActiveAt: new Date()
        });

        // Notify renderer
        mainWindow.sendToRenderer('account:active-changed', {
          accountId: result.accountId
        });
      }

      return result;
    } catch (error) {
      console.error('[IPC] Failed to switch to previous account:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });

  /**
   * Get current active account
   * Handler: account:get-active
   */
  ipcMain.handle('account:get-active', async () => {
    try {
      const activeAccountId = viewManager.getActiveAccountId();
      
      if (!activeAccountId) {
        return {
          success: true,
          accountId: null
        };
      }

      const account = await accountManager.getAccount(activeAccountId);
      
      return {
        success: true,
        accountId: activeAccountId,
        account: account ? account.toJSON() : null
      };
    } catch (error) {
      console.error('[IPC] Failed to get active account:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });

  /**
   * Reorder accounts in sidebar
   * Handler: account:reorder
   */
  ipcMain.handle('account:reorder', async (event, accountIds) => {
    try {
      // Validate input
      if (!Array.isArray(accountIds)) {
        throw new Error('Account IDs must be an array');
      }

      // Reorder accounts
      const result = await accountManager.reorderAccounts(accountIds);
      
      if (!result.success) {
        throw new Error(result.errors.join(', '));
      }

      // Notify renderer to update account list
      const updatedAccounts = await accountManager.loadAccounts();
      mainWindow.sendToRenderer('accounts-updated', updatedAccounts.map(acc => acc.toJSON()));

      return {
        success: true
      };
    } catch (error) {
      console.error('[IPC] Failed to reorder accounts:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });

  /**
   * Reorder accounts via drag and drop
   * Handler: reorder-accounts
   */
  ipcMain.handle('reorder-accounts', async (event, { accountId, targetAccountId, insertBefore }) => {
    try {
      // Validate input
      if (!accountId || !targetAccountId) {
        throw new Error('Both accountId and targetAccountId are required');
      }

      // Get all accounts in current order
      const accounts = await accountManager.getAccountsSorted();
      const accountIds = accounts.map(acc => acc.id);

      // Find indices
      const draggedIndex = accountIds.indexOf(accountId);
      const targetIndex = accountIds.indexOf(targetAccountId);

      if (draggedIndex === -1 || targetIndex === -1) {
        throw new Error('Account not found');
      }

      // Reorder the array
      accountIds.splice(draggedIndex, 1);
      const newTargetIndex = insertBefore ? targetIndex : targetIndex + 1;
      accountIds.splice(newTargetIndex > draggedIndex ? newTargetIndex - 1 : newTargetIndex, 0, accountId);

      // Update order in account manager
      const result = await accountManager.reorderAccounts(accountIds);
      
      if (!result.success) {
        throw new Error(result.errors.join(', '));
      }

      // Notify renderer to update account list
      mainWindow.sendToRenderer('accounts-updated', accounts.map(acc => acc.toJSON()));

      return {
        success: true
      };
    } catch (error) {
      console.error('[IPC] Failed to reorder accounts via drag and drop:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });

  /**
   * Get view status for an account
   * Handler: account:view-status
   */
  ipcMain.handle('account:view-status', async (event, accountId) => {
    try {
      if (!accountId) {
        throw new Error('Account ID is required');
      }

      const viewState = viewManager.getViewState(accountId);
      
      if (!viewState) {
        return {
          success: true,
          exists: false,
          status: 'not_created'
        };
      }

      return {
        success: true,
        exists: true,
        status: viewState.status,
        isVisible: viewState.isVisible,
        isLoaded: viewState.isLoaded,
        loginStatus: viewState.loginStatus,
        connectionStatus: viewState.connectionStatus,
        connectionError: viewState.connectionError,
        errorInfo: viewState.errorInfo || null
      };
    } catch (error) {
      console.error('[IPC] Failed to get view status:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });

  /**
   * Reload a view
   * Handler: account:reload-view
   */
  ipcMain.handle('account:reload-view', async (event, accountId, ignoreCache = false) => {
    try {
      if (!accountId) {
        throw new Error('Account ID is required');
      }

      // Check if view exists
      if (!viewManager.hasView(accountId)) {
        throw new Error(`View for account ${accountId} does not exist`);
      }

      // Reload the view
      const success = await viewManager.reloadView(accountId, ignoreCache);
      
      if (!success) {
        throw new Error('Failed to reload view');
      }

      return {
        success: true,
        accountId
      };
    } catch (error) {
      console.error('[IPC] Failed to reload view:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });

  /**
   * Get login status for an account
   * Handler: account:login-status
   */
  ipcMain.handle('account:login-status', async (event, accountId) => {
    try {
      if (!accountId) {
        throw new Error('Account ID is required');
      }

      const loginStatus = viewManager.getLoginStatus(accountId);
      const viewState = viewManager.getViewState(accountId);
      
      return {
        success: true,
        accountId,
        isLoggedIn: loginStatus || false,
        loginInfo: viewState ? viewState.loginInfo : null
      };
    } catch (error) {
      console.error('[IPC] Failed to get login status:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });

  /**
   * Load a specific URL in a view
   * Handler: account:load-url
   */
  ipcMain.handle('account:load-url', async (event, accountId, url) => {
    try {
      if (!accountId) {
        throw new Error('Account ID is required');
      }

      if (!url) {
        throw new Error('URL is required');
      }

      // Check if view exists
      if (!viewManager.hasView(accountId)) {
        throw new Error(`View for account ${accountId} does not exist`);
      }

      // Load URL
      const success = await viewManager.loadURL(accountId, url);
      
      if (!success) {
        throw new Error('Failed to load URL');
      }

      return {
        success: true,
        accountId,
        url
      };
    } catch (error) {
      console.error('[IPC] Failed to load URL:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });

  /**
   * Handle sidebar resize event
   * Handler: sidebar-resized
   */
  ipcMain.on('sidebar-resized', (event, sidebarWidth) => {
    try {
      if (typeof sidebarWidth !== 'number' || sidebarWidth <= 0) {
        console.warn('[IPC] Invalid sidebar width:', sidebarWidth);
        return;
      }

      // Save the new sidebar width
      mainWindow.setSidebarWidth(sidebarWidth);

      // Update all view bounds with debouncing
      viewManager.resizeViews(sidebarWidth);

      console.log(`[IPC] Sidebar resized to ${sidebarWidth}px`);
    } catch (error) {
      console.error('[IPC] Failed to handle sidebar resize:', error);
    }
  });

  /**
   * Handle window resize event from renderer
   * Handler: window-resize-complete
   */
  ipcMain.on('window-resize-complete', () => {
    try {
      // Handle window resize with debouncing
      viewManager.handleWindowResize();

      console.log('[IPC] Window resize handled');
    } catch (error) {
      console.error('[IPC] Failed to handle window resize:', error);
    }
  });

  /**
   * Get current view bounds
   * Handler: get-view-bounds
   */
  ipcMain.handle('get-view-bounds', () => {
    try {
      const window = mainWindow.getWindow();
      if (!window || window.isDestroyed()) {
        return {
          success: false,
          error: 'Window not available'
        };
      }

      const windowBounds = window.getContentBounds();
      const sidebarWidth = mainWindow.getSidebarWidth();

      const viewBounds = {
        x: sidebarWidth,
        y: 0,
        width: windowBounds.width - sidebarWidth,
        height: windowBounds.height
      };

      return {
        success: true,
        windowBounds,
        sidebarWidth,
        viewBounds
      };
    } catch (error) {
      console.error('[IPC] Failed to get view bounds:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });

  /**
   * Get saved sidebar width
   * Handler: get-sidebar-width
   */
  ipcMain.handle('get-sidebar-width', () => {
    try {
      const sidebarWidth = mainWindow.getSidebarWidth();
      return {
        success: true,
        width: sidebarWidth
      };
    } catch (error) {
      console.error('[IPC] Failed to get sidebar width:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });

  /**
   * Get saved active account ID
   * Handler: get-active-account-id
   */
  ipcMain.handle('get-active-account-id', () => {
    try {
      const activeAccountId = viewManager.getSavedActiveAccountId();
      return {
        success: true,
        accountId: activeAccountId
      };
    } catch (error) {
      console.error('[IPC] Failed to get active account ID:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });

  /**
   * Restore active account from saved state
   * Handler: restore-active-account
   */
  ipcMain.handle('restore-active-account', async () => {
    try {
      // Get saved active account ID
      const savedAccountId = viewManager.getSavedActiveAccountId();
      
      if (!savedAccountId) {
        return {
          success: false,
          reason: 'no_saved_account'
        };
      }

      // Get account configuration
      const account = await accountManager.getAccount(savedAccountId);
      
      if (!account) {
        return {
          success: false,
          reason: 'account_not_found',
          accountId: savedAccountId
        };
      }

      // Switch to the account with full configuration
      const result = await viewManager.switchView(savedAccountId, {
        createIfMissing: true,
        viewConfig: {
          url: 'https://web.whatsapp.com',
          proxy: account.proxy,
          translation: account.translation
        }
      });

      if (result.success) {
        // Update last active time
        await accountManager.updateAccount(savedAccountId, {
          lastActiveAt: new Date()
        });

        // Notify renderer
        mainWindow.sendToRenderer('account:active-changed', {
          accountId: savedAccountId
        });
        
        return {
          success: true,
          accountId: savedAccountId
        };
      } else {
        return {
          success: false,
          reason: 'switch_failed',
          error: result.error,
          accountId: savedAccountId
        };
      }
    } catch (error) {
      console.error('[IPC] Failed to restore active account:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });

  /**
   * Force logout an account (clear session data)
   * Handler: account:force-logout
   */
  ipcMain.handle('account:force-logout', async (event, accountId) => {
    try {
      if (!accountId) {
        throw new Error('Account ID is required');
      }

      // Check if account exists
      const account = await accountManager.getAccount(accountId);
      if (!account) {
        throw new Error(`Account ${accountId} not found`);
      }

      // Force logout using ViewManager
      const result = await viewManager.forceLogout(accountId);

      if (!result.success) {
        throw new Error(result.error || 'Failed to force logout');
      }

      // Notify renderer
      mainWindow.sendToRenderer('account:logged-out', {
        accountId,
        forced: true
      });

      return {
        success: true,
        accountId
      };
    } catch (error) {
      console.error('[IPC] Failed to force logout:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });

  /**
   * Handle session expiration for an account
   * Handler: account:handle-session-expiration
   */
  ipcMain.handle('account:handle-session-expiration', async (event, accountId, options = {}) => {
    try {
      if (!accountId) {
        throw new Error('Account ID is required');
      }

      // Check if account exists
      const account = await accountManager.getAccount(accountId);
      if (!account) {
        throw new Error(`Account ${accountId} not found`);
      }

      // Handle session expiration using ViewManager
      const result = await viewManager.handleSessionExpiration(accountId, options);

      if (!result.success) {
        throw new Error(result.error || 'Failed to handle session expiration');
      }

      return {
        success: true,
        accountId
      };
    } catch (error) {
      console.error('[IPC] Failed to handle session expiration:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });

  /**
   * Check session expiration for an account
   * Handler: account:check-session-expiration
   */
  ipcMain.handle('account:check-session-expiration', async (event, accountId) => {
    try {
      if (!accountId) {
        throw new Error('Account ID is required');
      }

      // Check if account exists
      const account = await accountManager.getAccount(accountId);
      if (!account) {
        throw new Error(`Account ${accountId} not found`);
      }

      // Check session expiration using ViewManager
      const result = await viewManager.checkSessionExpiration(accountId);

      return result;
    } catch (error) {
      console.error('[IPC] Failed to check session expiration:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });

  /**
   * Get session persistence status for an account
   * Handler: account:session-persistence-status
   */
  ipcMain.handle('account:session-persistence-status', async (event, accountId) => {
    try {
      if (!accountId) {
        throw new Error('Account ID is required');
      }

      // Check if account exists
      const account = await accountManager.getAccount(accountId);
      if (!account) {
        throw new Error(`Account ${accountId} not found`);
      }

      // Get session persistence status using ViewManager
      const result = await viewManager.getSessionPersistenceStatus(accountId);

      return result;
    } catch (error) {
      console.error('[IPC] Failed to get session persistence status:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });

  /**
   * Restore login states for all accounts
   * Handler: account:restore-all-login-states
   */
  ipcMain.handle('account:restore-all-login-states', async () => {
    try {
      // Restore login states using ViewManager
      const result = await viewManager.restoreAllLoginStates();

      // Notify renderer about restoration results
      mainWindow.sendToRenderer('account:login-states-restored', result);

      return {
        success: true,
        ...result
      };
    } catch (error) {
      console.error('[IPC] Failed to restore all login states:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });

  /**
   * Start session health monitoring for an account
   * Handler: account:start-session-monitoring
   */
  ipcMain.handle('account:start-session-monitoring', async (event, accountId) => {
    try {
      if (!accountId) {
        throw new Error('Account ID is required');
      }

      // Check if account exists
      const account = await accountManager.getAccount(accountId);
      if (!account) {
        throw new Error(`Account ${accountId} not found`);
      }

      // Start monitoring using ViewManager
      const monitor = viewManager.startSessionHealthMonitoring(accountId);

      if (!monitor) {
        throw new Error('Failed to start session health monitoring');
      }

      return {
        success: true,
        accountId,
        monitoring: true
      };
    } catch (error) {
      console.error('[IPC] Failed to start session monitoring:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });

  /**
   * Get connection status for an account
   * Handler: account:connection-status
   */
  ipcMain.handle('account:connection-status', async (event, accountId) => {
    try {
      if (!accountId) {
        throw new Error('Account ID is required');
      }

      const connectionStatus = viewManager.getConnectionStatus(accountId);
      const connectionError = viewManager.getConnectionError(accountId);
      const viewState = viewManager.getViewState(accountId);

      return {
        success: true,
        accountId,
        connectionStatus: connectionStatus || 'offline',
        error: connectionError,
        lastCheck: viewState ? viewState.lastConnectionCheck : null
      };
    } catch (error) {
      console.error('[IPC] Failed to get connection status:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });

  /**
   * Check connection status for an account (manual check)
   * Handler: account:check-connection-status
   */
  ipcMain.handle('account:check-connection-status', async (event, accountId) => {
    try {
      if (!accountId) {
        throw new Error('Account ID is required');
      }

      // Check if account exists
      const account = await accountManager.getAccount(accountId);
      if (!account) {
        throw new Error(`Account ${accountId} not found`);
      }

      // Check connection status
      const result = await viewManager.checkConnectionStatus(accountId);

      return result;
    } catch (error) {
      console.error('[IPC] Failed to check connection status:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });

  /**
   * Start connection monitoring for an account
   * Handler: account:start-connection-monitoring
   */
  ipcMain.handle('account:start-connection-monitoring', async (event, accountId, options = {}) => {
    try {
      if (!accountId) {
        throw new Error('Account ID is required');
      }

      // Check if account exists
      const account = await accountManager.getAccount(accountId);
      if (!account) {
        throw new Error(`Account ${accountId} not found`);
      }

      // Start monitoring
      const monitor = viewManager.startConnectionMonitoring(accountId, options);

      if (!monitor) {
        throw new Error('Failed to start connection monitoring');
      }

      return {
        success: true,
        accountId,
        monitoring: true,
        interval: monitor.interval
      };
    } catch (error) {
      console.error('[IPC] Failed to start connection monitoring:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });

  /**
   * Stop connection monitoring for an account
   * Handler: account:stop-connection-monitoring
   */
  ipcMain.handle('account:stop-connection-monitoring', async (event, accountId) => {
    try {
      if (!accountId) {
        throw new Error('Account ID is required');
      }

      const success = viewManager.stopConnectionMonitoring(accountId);

      return {
        success,
        accountId
      };
    } catch (error) {
      console.error('[IPC] Failed to stop connection monitoring:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });

  /**
   * Start connection monitoring for all accounts
   * Handler: account:start-all-connection-monitoring
   */
  ipcMain.handle('account:start-all-connection-monitoring', async (event, options = {}) => {
    try {
      const result = viewManager.startAllConnectionMonitoring(options);

      return {
        success: true,
        ...result
      };
    } catch (error) {
      console.error('[IPC] Failed to start all connection monitoring:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });

  /**
   * Stop connection monitoring for all accounts
   * Handler: account:stop-all-connection-monitoring
   */
  ipcMain.handle('account:stop-all-connection-monitoring', async () => {
    try {
      const result = viewManager.stopAllConnectionMonitoring();

      return {
        success: true,
        ...result
      };
    } catch (error) {
      console.error('[IPC] Failed to stop all connection monitoring:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });

  /**
   * Check login status for an account (manual check)
   * Handler: account:check-login-status
   */
  ipcMain.handle('account:check-login-status', async (event, accountId) => {
    try {
      if (!accountId) {
        throw new Error('Account ID is required');
      }

      // Check if account exists
      const account = await accountManager.getAccount(accountId);
      if (!account) {
        throw new Error(`Account ${accountId} not found`);
      }

      // Check login status
      const result = await viewManager.checkLoginStatus(accountId);

      return result;
    } catch (error) {
      console.error('[IPC] Failed to check login status:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });

  /**
   * Start login status monitoring for an account
   * Handler: account:start-login-status-monitoring
   */
  ipcMain.handle('account:start-login-status-monitoring', async (event, accountId, options = {}) => {
    try {
      if (!accountId) {
        throw new Error('Account ID is required');
      }

      // Check if account exists
      const account = await accountManager.getAccount(accountId);
      if (!account) {
        throw new Error(`Account ${accountId} not found`);
      }

      // Start monitoring
      const monitor = viewManager.startLoginStatusMonitoring(accountId, options);

      if (!monitor) {
        throw new Error('Failed to start login status monitoring');
      }

      return {
        success: true,
        accountId,
        monitoring: true
      };
    } catch (error) {
      console.error('[IPC] Failed to start login status monitoring:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });

  /**
   * Stop login status monitoring for an account
   * Handler: account:stop-login-status-monitoring
   */
  ipcMain.handle('account:stop-login-status-monitoring', async (event, accountId) => {
    try {
      if (!accountId) {
        throw new Error('Account ID is required');
      }

      const success = viewManager.stopLoginStatusMonitoring(accountId);

      return {
        success,
        accountId
      };
    } catch (error) {
      console.error('[IPC] Failed to stop login status monitoring:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });

  /**
   * Start login status monitoring for all accounts
   * Handler: account:start-all-login-status-monitoring
   */
  ipcMain.handle('account:start-all-login-status-monitoring', async (event, options = {}) => {
    try {
      const result = viewManager.startAllLoginStatusMonitoring(options);

      return {
        success: true,
        ...result
      };
    } catch (error) {
      console.error('[IPC] Failed to start all login status monitoring:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });

  /**
   * Stop login status monitoring for all accounts
   * Handler: account:stop-all-login-status-monitoring
   */
  ipcMain.handle('account:stop-all-login-status-monitoring', async () => {
    try {
      const result = viewManager.stopAllLoginStatusMonitoring();

      return {
        success: true,
        ...result
      };
    } catch (error) {
      console.error('[IPC] Failed to stop all login status monitoring:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });

  console.log('[IPC] Single-window handlers registered');
}

/**
 * Unregister IPC handlers
 */
function unregisterIPCHandlers() {
  ipcMain.removeHandler('get-account');
  ipcMain.removeHandler('get-accounts');
  ipcMain.removeHandler('account:list');
  ipcMain.removeHandler('create-account');
  ipcMain.removeHandler('update-account');
  ipcMain.removeHandler('delete-account');
  ipcMain.removeHandler('switch-account');
  ipcMain.removeHandler('switch-account-by-index');
  ipcMain.removeHandler('switch-to-next-account');
  ipcMain.removeHandler('switch-to-previous-account');
  ipcMain.removeHandler('account:get-active');
  ipcMain.removeHandler('account:reorder');
  ipcMain.removeHandler('reorder-accounts');
  ipcMain.removeHandler('account:view-status');
  ipcMain.removeHandler('account:reload-view');
  ipcMain.removeHandler('account:login-status');
  ipcMain.removeHandler('account:load-url');
  ipcMain.removeHandler('get-view-bounds');
  ipcMain.removeHandler('get-sidebar-width');
  ipcMain.removeHandler('get-active-account-id');
  ipcMain.removeHandler('restore-active-account');
  ipcMain.removeHandler('account:force-logout');
  ipcMain.removeHandler('account:handle-session-expiration');
  ipcMain.removeHandler('account:check-session-expiration');
  ipcMain.removeHandler('account:session-persistence-status');
  ipcMain.removeHandler('account:restore-all-login-states');
  ipcMain.removeHandler('account:start-session-monitoring');
  ipcMain.removeHandler('account:connection-status');
  ipcMain.removeHandler('account:check-connection-status');
  ipcMain.removeHandler('account:start-connection-monitoring');
  ipcMain.removeHandler('account:stop-connection-monitoring');
  ipcMain.removeHandler('account:start-all-connection-monitoring');
  ipcMain.removeHandler('account:stop-all-connection-monitoring');
  ipcMain.removeHandler('account:check-login-status');
  ipcMain.removeHandler('account:start-login-status-monitoring');
  ipcMain.removeHandler('account:stop-login-status-monitoring');
  ipcMain.removeHandler('account:start-all-login-status-monitoring');
  ipcMain.removeHandler('account:stop-all-login-status-monitoring');
  ipcMain.removeAllListeners('account:create');
  ipcMain.removeAllListeners('account:edit');
  ipcMain.removeAllListeners('sidebar-resized');
  ipcMain.removeAllListeners('window-resize-complete');
  
  console.log('[IPC] Single-window handlers unregistered');
}

module.exports = {
  registerIPCHandlers,
  unregisterIPCHandlers
};
