/**
 * User Actions Module for Sidebar
 * Handles all user-initiated actions like account CRUD, open/close, batch operations
 * 
 * @module sidebar/actions
 */

'use strict';

// ============================================================================
// Module Dependencies
// ============================================================================

/**
 * Get the state module
 * @returns {Object} State module
 */
function getState() {
  if (typeof window !== 'undefined' && window.SidebarState) {
    return window.SidebarState;
  }
  if (typeof require !== 'undefined') {
    return require('./state');
  }
  throw new Error('State module not available');
}

/**
 * Get the render module
 * @returns {Object} Render module
 */
function getRender() {
  if (typeof window !== 'undefined' && window.SidebarRender) {
    return window.SidebarRender;
  }
  if (typeof require !== 'undefined') {
    return require('./render');
  }
  throw new Error('Render module not available');
}

/**
 * Get the utils module
 * @returns {Object} Utils module
 */
function getUtils() {
  if (typeof window !== 'undefined' && window.SidebarUtils) {
    return window.SidebarUtils;
  }
  if (typeof require !== 'undefined') {
    return require('./utils');
  }
  throw new Error('Utils module not available');
}

/**
 * Get the events module
 * @returns {Object} Events module
 */
function getEvents() {
  if (typeof window !== 'undefined' && window.SidebarEvents) {
    return window.SidebarEvents;
  }
  if (typeof require !== 'undefined') {
    return require('./events');
  }
  throw new Error('Events module not available');
}

// ============================================================================
// Constants
// ============================================================================

/** Map to track update timers for debouncing (actions module) */
const actionsUpdateTimers = new Map();

// ============================================================================
// Account Loading
// ============================================================================

/**
 * Load accounts from main process
 * This is the main initialization function for loading account data
 */
async function loadAccounts() {
  const state = getState();
  const render = getRender();
  const utils = getUtils();
  
  const accountList = typeof document !== 'undefined' ? document.getElementById('account-list') : null;
  
  if (typeof window === 'undefined' || !window.electronAPI || !accountList) {
    console.warn('[Actions] Cannot load accounts: electronAPI or accountList not available');
    return;
  }

  try {
    const accountsData = await window.electronAPI.invoke('get-accounts');
    state.setAccounts(accountsData || []);

    // Get active account
    const activeResult = await window.electronAPI.invoke('account:get-active');
    if (activeResult && activeResult.success && activeResult.accountId) {
      state.setActiveAccountId(activeResult.accountId);
    }

    // Get running status for all accounts
    const statusResult = await window.electronAPI.invoke('get-all-account-statuses');
    if (statusResult && statusResult.success && statusResult.statuses) {
      mergeRunningStatuses(statusResult.statuses);
    }

    // Get login status for all accounts
    await refreshLoginStatusesForAllAccounts();

    // Render the account list
    if (typeof render.renderAccountList === 'function') {
      await render.renderAccountList();
    }
  } catch (error) {
    console.error('[Actions] Failed to load accounts:', error);
    if (typeof utils.showError === 'function') {
      utils.showError('加载账号失败');
    }
  }
}

/**
 * Merge running status info into current accounts
 * @param {Object} statuses - Map of account ID to status info
 */
function mergeRunningStatuses(statuses) {
  const state = getState();
  const accounts = state.getAccounts();
  
  accounts.forEach((account) => {
    const statusInfo = statuses[account.id];
    if (statusInfo) {
      const oldStatus = account.runningStatus;
      const oldIsRunning = account.isRunning;
      const newStatus = statusInfo.status;
      const newIsRunning = !!statusInfo.isRunning;

      // Protect connected accounts from being incorrectly set to loading
      if (oldStatus === 'connected' && newStatus === 'loading') {
        console.warn(`[Actions] Protecting account ${account.id} from incorrect status change: connected -> loading`);
        return;
      }

      const statusChanged = oldStatus !== newStatus || oldIsRunning !== newIsRunning;

      if (statusChanged) {
        account.runningStatus = newStatus;
        account.isRunning = newIsRunning;

        if (oldStatus === 'connected' && newStatus !== 'connected') {
          console.warn(`[Actions] Account ${account.id} status changed from ${oldStatus} to ${newStatus}`);
        }
      }
    }
  });
}

/**
 * Refresh login statuses for all accounts
 */
async function refreshLoginStatusesForAllAccounts() {
  if (typeof window === 'undefined' || !window.electronAPI) return;

  const state = getState();
  const accounts = state.getAccounts();

  for (const account of accounts) {
    try {
      const loginResult = await window.electronAPI.getLoginStatus(account.id);
      if (loginResult && loginResult.success) {
        account.loginStatus = loginResult.isLoggedIn;
        account.hasQRCode = loginResult.hasQRCode;
        account.loginInfo = loginResult.loginInfo;
        console.log(`[Actions] Refreshed login status for account ${account.id}:`, {
          isLoggedIn: loginResult.isLoggedIn,
          hasQRCode: loginResult.hasQRCode
        });
      }
    } catch (error) {
      console.warn(`[Actions] Failed to get login status for account ${account.id}:`, error);
      account.loginStatus = false;
      account.hasQRCode = false;
    }
  }
}

// ============================================================================
// Account Selection
// ============================================================================

/**
 * Handle account selection (switching to an account)
 * @param {string} accountId - Account ID to select
 */
async function handleAccountSelect(accountId) {
  const state = getState();
  const render = getRender();
  const utils = getUtils();
  
  if (typeof window === 'undefined' || !window.electronAPI) return;
  
  const currentActiveId = state.getActiveAccountId();
  if (accountId === currentActiveId) {
    return;
  }

  try {
    const accountStatus = await window.electronAPI.getAccountStatus(accountId);
    if (!accountStatus || !accountStatus.isRunning) {
      console.log('[Actions] Account is not running, cannot switch');
      return;
    }

    // Optimistic UI update
    if (typeof render.setActiveAccount === 'function') {
      render.setActiveAccount(accountId);
    }

    await window.electronAPI.invoke('switch-account', accountId);
  } catch (error) {
    console.error('[Actions] Failed to switch account:', error);
    if (typeof utils.showError === 'function') {
      utils.showError('切换账号失败');
    }
    // Revert to previous active account
    if (typeof render.setActiveAccount === 'function') {
      render.setActiveAccount(currentActiveId);
    }
  }
}

// ============================================================================
// Account CRUD Operations
// ============================================================================

/**
 * Handle add account button click - Quick add with default settings
 */
async function handleAddAccount() {
  const utils = getUtils();
  
  if (typeof window === 'undefined' || !window.electronAPI) {
    if (typeof utils.showError === 'function') {
      utils.showError('无法连接到主进程');
    }
    return;
  }

  try {
    const defaultConfig = {
      name: '',
      note: '',
      autoStart: false,
      translation: {
        enabled: true,
        engine: 'google',
        targetLanguage: 'zh-CN',
        autoTranslate: false,
        translateInput: false,
        friendSettings: {}
      }
    };

    const result = await window.electronAPI.invoke('create-account', defaultConfig);
    if (result && result.success) {
      console.log('[Actions] Account created successfully:', result.account);
      // List will refresh via accounts-updated event
    } else {
      const errorMessage = result && result.errors ? result.errors.join(', ') : '创建账号失败';
      if (typeof utils.showError === 'function') {
        utils.showError(errorMessage);
      }
    }
  } catch (error) {
    console.error('[Actions] Failed to create account:', error);
    if (typeof utils.showError === 'function') {
      utils.showError(`创建账号失败: ${error.message}`);
    }
  }
}

/**
 * Handle delete account button click
 * @param {string} accountId - Account ID to delete
 */
async function handleDeleteAccount(accountId) {
  const state = getState();
  const utils = getUtils();
  
  if (typeof window === 'undefined' || !window.electronAPI) return;

  const account = state.getAccountById(accountId);
  const accountName = account ? account.name : '此账号';

  const confirmed = confirm(
    `确定要删除账号 "${accountName}" 吗？\n\n这将删除账号配置但保留会话数据。`
  );

  if (!confirmed) return;

  try {
    await window.electronAPI.invoke('delete-account', accountId);
    // List will refresh via accounts-updated event
  } catch (error) {
    console.error('[Actions] Failed to delete account:', error);
    if (typeof utils.showError === 'function') {
      utils.showError('删除账号失败');
    }
  }
}

/**
 * Save account note with debouncing
 * @param {string} accountId - Account ID
 * @param {string} note - Note content
 */
async function saveAccountNote(accountId, note) {
  if (typeof window === 'undefined' || !window.electronAPI) return;

  // Cancel existing timer for this account if any
  const timerKey = `note-${accountId}`;
  if (actionsUpdateTimers.has(timerKey)) {
    clearTimeout(actionsUpdateTimers.get(timerKey));
  }

  // Set new timer with debounce
  const timerId = setTimeout(async () => {
    try {
      await window.electronAPI.invoke('update-account', accountId, { note });
      console.log(`[Actions] Note saved for account ${accountId}`);
    } catch (error) {
      console.error('[Actions] Failed to save note:', error);
    } finally {
      actionsUpdateTimers.delete(timerKey);
    }
  }, 300);

  actionsUpdateTimers.set(timerKey, timerId);
}

// ============================================================================
// Account Open/Close Operations
// ============================================================================

/**
 * Handle open account button click
 * @param {string} accountId - Account ID to open
 */
async function handleOpenAccount(accountId) {
  const render = getRender();
  const utils = getUtils();
  
  if (typeof window === 'undefined' || !window.electronAPI) return;

  try {
    if (typeof render.updateAccountRunningStatus === 'function') {
      render.updateAccountRunningStatus(accountId, 'loading');
    }

    const result = await window.electronAPI.invoke('open-account', accountId);
    if (!result || !result.success) {
      throw new Error((result && result.error) || '打开账号失败');
    }

    console.log(`[Actions] Account ${accountId} opened successfully`);
  } catch (error) {
    console.error('[Actions] Failed to open account:', error);
    if (typeof render.updateAccountRunningStatus === 'function') {
      render.updateAccountRunningStatus(accountId, 'error');
    }
    if (typeof utils.showError === 'function') {
      utils.showError(`打开账号失败: ${error.message}`);
    }
  }
}

/**
 * Handle close account button click
 * @param {string} accountId - Account ID to close
 */
async function handleCloseAccount(accountId) {
  const render = getRender();
  const utils = getUtils();
  
  if (typeof window === 'undefined' || !window.electronAPI) return;

  try {
    if (typeof render.updateAccountRunningStatus === 'function') {
      render.updateAccountRunningStatus(accountId, 'loading');
    }

    const result = await window.electronAPI.invoke('close-account', accountId);
    if (!result || !result.success) {
      throw new Error((result && result.error) || '关闭账号失败');
    }

    console.log(`[Actions] Account ${accountId} closed successfully`);
  } catch (error) {
    console.error('[Actions] Failed to close account:', error);
    if (typeof render.updateAccountRunningStatus === 'function') {
      render.updateAccountRunningStatus(accountId, 'error');
    }
    if (typeof utils.showError === 'function') {
      utils.showError(`关闭账号失败: ${error.message}`);
    }
  }
}

/**
 * Handle retry account button click (after error)
 * @param {string} accountId - Account ID to retry
 */
async function handleRetryAccount(accountId) {
  await handleOpenAccount(accountId);
}

// ============================================================================
// Environment Panel
// ============================================================================

/**
 * Open environment settings panel for an account
 * @param {string} accountId - Account ID
 */
function openEnvironmentPanel(accountId) {
  if (typeof window === 'undefined') return;
  
  // Set the account for the environment settings panel
  if (window.EnvironmentSettingsPanel) {
    window.EnvironmentSettingsPanel.setAccount(accountId);
  }
  // Expand the environment panel using the global method
  if (window.TranslatePanelLayout && window.TranslatePanelLayout.openEnvironmentPanel) {
    window.TranslatePanelLayout.openEnvironmentPanel();
  }
}

// ============================================================================
// Status Synchronization
// ============================================================================

/**
 * Sync single account status with running status
 * Ensures status consistency based on priority: login status > running status > default
 * @param {Object} account - Account object
 */
function syncAccountStatusWithRunningStatus(account) {
  if (!account) return;

  const runningStatus = account.runningStatus || 'not_started';
  const currentStatus = account.status || 'offline';
  const loginStatus = account.loginStatus;
  const hasQRCode = account.hasQRCode;
  const connectionDetails = account.connectionDetails || {};

  let correctStatus = currentStatus;
  let statusReason = '';

  // First priority: explicit login status
  if (loginStatus === true) {
    if (account.isRunning) {
      correctStatus = 'online';
      statusReason = 'logged in';
      if (runningStatus === 'loading') {
        account.runningStatus = 'connected';
        account.isRunning = true;
        console.log(`[Actions] Updated running status for logged-in account ${account.id} to 'connected'`);
      }
    } else {
      correctStatus = 'offline';
      statusReason = 'logged in (view closed)';
      if (runningStatus !== 'not_started') {
        account.runningStatus = 'not_started';
        account.isRunning = false;
      }
    }
  } else if (loginStatus === false) {
    correctStatus = hasQRCode ? 'offline' : 'offline';
    statusReason = hasQRCode ? 'logged out with QR' : 'logged out';
  }
  // Second priority: connection details
  else if (connectionDetails.needsQRScan === true) {
    correctStatus = 'offline';
    statusReason = 'needs QR scan';
  } else if (connectionDetails.isLoggedIn === true) {
    correctStatus = 'online';
    statusReason = 'connection details show logged in';
  }
  // Third priority: running status
  else {
    switch (runningStatus) {
      case 'connected':
        correctStatus = 'online';
        statusReason = 'running status connected';
        break;
      case 'loading':
        correctStatus = 'loading';
        statusReason = 'running status loading';
        break;
      case 'error':
        correctStatus = 'error';
        statusReason = 'running status error';
        break;
      case 'not_started':
      default:
        correctStatus = 'offline';
        statusReason = 'running status not started';
    }
  }

  // Only update if status is inconsistent
  if (currentStatus !== correctStatus) {
    console.log(`[Actions] Syncing account ${account.id} status from '${currentStatus}' to '${correctStatus}' (${statusReason})`);
    account.status = correctStatus;

    const render = getRender();
    if (typeof render.updateAccountStatus === 'function') {
      render.updateAccountStatus(account.id, correctStatus);
    }
  }
}

/**
 * Sync all accounts' status with running status
 */
function syncAccountStatusesWithRunningStatus() {
  const state = getState();
  const accounts = state.getAccounts();
  
  accounts.forEach((account) => {
    syncAccountStatusWithRunningStatus(account);
  });
}

// ============================================================================
// Batch Operations
// ============================================================================

/**
 * Handle batch start all accounts
 * Starts accounts in list order (by order property ascending)
 */
async function handleBatchStartAll() {
  const state = getState();
  const render = getRender();
  
  if (typeof window === 'undefined' || !window.electronAPI) return;

  const accounts = state.getAccounts();
  
  // Get not-running accounts, sorted by order
  const notRunningAccounts = accounts
    .filter(acc => !acc.isRunning && acc.runningStatus !== 'loading')
    .sort((a, b) => {
      const orderA = a.order !== undefined ? a.order : 999;
      const orderB = b.order !== undefined ? b.order : 999;
      return orderA - orderB;
    });

  if (notRunningAccounts.length === 0) {
    console.log('[Actions] All accounts are already running');
    return;
  }

  console.log(`[Actions] Batch starting ${notRunningAccounts.length} accounts (in list order)...`);

  // Start accounts sequentially with a small delay between each
  for (const account of notRunningAccounts) {
    try {
      if (typeof render.updateAccountRunningStatus === 'function') {
        render.updateAccountRunningStatus(account.id, 'loading');
      }
      await window.electronAPI.invoke('open-account', account.id);
      console.log(`[Actions] Started account ${account.id}`);
      // Small delay between account starts
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error) {
      console.error(`[Actions] Failed to start account ${account.id}:`, error);
      if (typeof render.updateAccountRunningStatus === 'function') {
        render.updateAccountRunningStatus(account.id, 'error');
      }
    }
  }
}

/**
 * Handle batch start selected accounts
 * Starts selected accounts in list order (by order property ascending)
 */
async function handleBatchStartSelected() {
  const state = getState();
  const render = getRender();
  
  if (typeof window === 'undefined' || !window.electronAPI) return;
  
  const selectedAccountIds = state.getSelectedAccountIds();
  if (selectedAccountIds.size === 0) return;

  const accounts = state.getAccounts();
  
  // Get selected and not-running accounts, sorted by order
  const selectedAccounts = accounts
    .filter(acc =>
      selectedAccountIds.has(acc.id) && !acc.isRunning && acc.runningStatus !== 'loading'
    )
    .sort((a, b) => {
      const orderA = a.order !== undefined ? a.order : 999;
      const orderB = b.order !== undefined ? b.order : 999;
      return orderA - orderB;
    });

  if (selectedAccounts.length === 0) {
    console.log('[Actions] No selected accounts to start');
    return;
  }

  console.log(`[Actions] Batch starting ${selectedAccounts.length} selected accounts (in list order)...`);

  for (const account of selectedAccounts) {
    try {
      if (typeof render.updateAccountRunningStatus === 'function') {
        render.updateAccountRunningStatus(account.id, 'loading');
      }
      await window.electronAPI.invoke('open-account', account.id);
      console.log(`[Actions] Started account ${account.id}`);
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error) {
      console.error(`[Actions] Failed to start account ${account.id}:`, error);
      if (typeof render.updateAccountRunningStatus === 'function') {
        render.updateAccountRunningStatus(account.id, 'error');
      }
    }
  }

  // Exit selection mode after operation
  toggleSelectionMode();
}

/**
 * Handle batch delete selected accounts
 */
async function handleBatchDeleteSelected() {
  const state = getState();
  
  if (typeof window === 'undefined' || !window.electronAPI) return;
  
  const selectedAccountIds = state.getSelectedAccountIds();
  if (selectedAccountIds.size === 0) return;

  const selectedCount = selectedAccountIds.size;
  const confirmed = confirm(`确定要删除选中的 ${selectedCount} 个账号吗？\n\n这将删除账号配置但保留会话数据。`);

  if (!confirmed) return;

  console.log(`[Actions] Batch deleting ${selectedCount} accounts...`);

  const idsToDelete = [...selectedAccountIds];
  for (const accountId of idsToDelete) {
    try {
      await window.electronAPI.invoke('delete-account', accountId);
      console.log(`[Actions] Deleted account ${accountId}`);
    } catch (error) {
      console.error(`[Actions] Failed to delete account ${accountId}:`, error);
    }
  }

  // Exit selection mode after operation
  toggleSelectionMode();
}

// ============================================================================
// Selection Mode (delegated to selection module when available)
// ============================================================================

/**
 * Toggle selection mode
 * This is a placeholder that will be replaced by the selection module
 */
function toggleSelectionMode() {
  if (typeof window !== 'undefined' && window.SidebarSelection && typeof window.SidebarSelection.toggleSelectionMode === 'function') {
    window.SidebarSelection.toggleSelectionMode();
  } else {
    // Fallback: basic toggle using state
    const state = getState();
    state.toggleSelectionModeState();
    state.clearSelectedAccounts();
    
    const render = getRender();
    if (typeof render.renderAccountList === 'function') {
      render.renderAccountList();
    }
  }
}

// ============================================================================
// Exports
// ============================================================================

const actionsExports = {
  // Account loading
  loadAccounts,
  mergeRunningStatuses,
  refreshLoginStatusesForAllAccounts,
  // Account selection
  handleAccountSelect,
  // Account CRUD
  handleAddAccount,
  handleDeleteAccount,
  saveAccountNote,
  // Account open/close
  handleOpenAccount,
  handleCloseAccount,
  handleRetryAccount,
  // Environment panel
  openEnvironmentPanel,
  // Status synchronization
  syncAccountStatusWithRunningStatus,
  syncAccountStatusesWithRunningStatus,
  // Batch operations
  handleBatchStartAll,
  handleBatchStartSelected,
  handleBatchDeleteSelected,
  // Selection mode
  toggleSelectionMode
};

// Export for CommonJS (Node.js/testing)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = actionsExports;
}

// Export for browser global (IIFE pattern)
if (typeof window !== 'undefined') {
  window.SidebarActions = actionsExports;
}
