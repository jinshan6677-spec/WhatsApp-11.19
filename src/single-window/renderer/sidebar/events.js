/**
 * IPC Event Handlers Module for Sidebar
 * Handles all IPC events from the main process
 * 
 * @module sidebar/events
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

// ============================================================================
// Constants
// ============================================================================

/** Debounce delay for high-frequency updates */
const DEBOUNCE_DELAY = 100;

/** Map to track update timers for debouncing (events module) */
const eventsUpdateTimers = new Map();

// ============================================================================
// Event Setup
// ============================================================================

/**
 * Setup all IPC event listeners
 * This should be called once during sidebar initialization
 */
function setupEventListeners() {
  if (typeof window === 'undefined' || !window.electronAPI) {
    console.warn('[Events] electronAPI not available, skipping event setup');
    return;
  }

  // Listen for account updates from main process
  window.electronAPI.on('accounts-updated', handleAccountsUpdated);
  window.electronAPI.on('account-switched', handleAccountSwitched);
  window.electronAPI.on('account-status-changed', handleAccountStatusChanged);
  window.electronAPI.on('account:active-changed', handleActiveAccountChanged);

  // View manager events (login/connection status)
  window.electronAPI.on('view-manager:view-loading', handleViewLoading);
  window.electronAPI.on('view-manager:view-ready', handleViewReady);
  window.electronAPI.on('view-manager:view-error', handleViewError);
  window.electronAPI.on('view-manager:login-status-changed', handleLoginStatusChanged);
  window.electronAPI.on('view-manager:view-crashed', handleViewCrashed);
  window.electronAPI.on('view-manager:connection-status-changed', handleConnectionStatusChanged);
  window.electronAPI.on('view-manager:account-profile-updated', handleAccountProfileUpdated);
  window.electronAPI.on('view-manager:unread-count-updated', handleUnreadCountUpdated);

  // Manual account control events (open/close account)
  window.electronAPI.on('view-manager:account-opening', handleAccountOpening);
  window.electronAPI.on('view-manager:account-opened', handleAccountOpened);
  window.electronAPI.on('view-manager:account-open-failed', handleAccountOpenFailed);
  window.electronAPI.on('view-manager:account-closing', handleAccountClosing);
  window.electronAPI.on('view-manager:account-closed', handleAccountClosed);
  window.electronAPI.on('view-manager:account-close-failed', handleAccountCloseFailed);

  console.log('[Events] IPC event listeners setup complete');
}

// ============================================================================
// Account Update Handlers
// ============================================================================

/**
 * Handle accounts updated event from main process
 * Optimized: incremental update, only fetch IP info for new accounts
 * @param {Array<Object>} accountsData - Updated accounts data
 */
function handleAccountsUpdated(accountsData) {
  const state = getState();
  const render = getRender();
  
  const newAccounts = accountsData || [];
  const accounts = state.getAccounts();

  // Create old account ID set and status map to identify new accounts and preserve running status
  const oldAccountIds = new Set(accounts.map(acc => acc.id));
  const oldAccountStatusMap = new Map();
  const oldAccountIPMap = new Map();

  accounts.forEach(acc => {
    oldAccountStatusMap.set(acc.id, {
      runningStatus: acc.runningStatus,
      isRunning: acc.isRunning,
      loginStatus: acc.loginStatus,
      hasQRCode: acc.hasQRCode,
      connectionStatus: acc.connectionStatus,
      status: acc.status
    });
    // Preserve existing account IP info cache
    if (acc.lastIPInfo) {
      oldAccountIPMap.set(acc.id, {
        lastIPInfo: acc.lastIPInfo,
        lastIPInfoTimestamp: acc.lastIPInfoTimestamp
      });
    }
  });

  // Identify new accounts
  const newAccountIds = [];

  // Merge new account data, preserving old account running status and IP info
  const mergedAccounts = newAccounts.map(newAccount => {
    const oldStatus = oldAccountStatusMap.get(newAccount.id);
    const oldIPInfo = oldAccountIPMap.get(newAccount.id);

    // Mark this as a new account
    if (!oldAccountIds.has(newAccount.id)) {
      newAccountIds.push(newAccount.id);
    }

    if (oldStatus) {
      // Preserve running status related fields and IP info
      return {
        ...newAccount,
        runningStatus: oldStatus.runningStatus,
        isRunning: oldStatus.isRunning,
        loginStatus: oldStatus.loginStatus !== undefined ? oldStatus.loginStatus : newAccount.loginStatus,
        hasQRCode: oldStatus.hasQRCode !== undefined ? oldStatus.hasQRCode : newAccount.hasQRCode,
        connectionStatus: oldStatus.connectionStatus || newAccount.connectionStatus,
        status: oldStatus.status || newAccount.status,
        lastIPInfo: oldIPInfo ? oldIPInfo.lastIPInfo : null,
        lastIPInfoTimestamp: oldIPInfo ? oldIPInfo.lastIPInfoTimestamp : null
      };
    }
    return newAccount;
  });

  state.setAccounts(mergedAccounts);

  if (eventsUpdateTimers.has('accountList')) {
    clearTimeout(eventsUpdateTimers.get('accountList'));
  }

  // If no new accounts and same count, only update existing DOM elements (no IP refresh)
  if (newAccountIds.length === 0 && oldAccountIds.size === mergedAccounts.length) {
    eventsUpdateTimers.set(
      'accountList',
      setTimeout(() => {
        updateExistingAccountsDOM();
        eventsUpdateTimers.delete('accountList');
      }, DEBOUNCE_DELAY)
    );
  } else {
    // Has new or deleted accounts, need full render but mark new accounts for IP fetch
    eventsUpdateTimers.set(
      'accountList',
      setTimeout(() => {
        renderAccountListIncremental(newAccountIds);
        eventsUpdateTimers.delete('accountList');
      }, DEBOUNCE_DELAY)
    );
  }
}

/**
 * Update existing accounts' DOM elements without full re-rendering
 * Only updates note, name, etc. without re-fetching IP info
 */
function updateExistingAccountsDOM() {
  const state = getState();
  const accountList = typeof document !== 'undefined' ? document.getElementById('account-list') : null;
  if (!accountList) return;

  const accounts = state.getAccounts();

  accounts.forEach(account => {
    const item = accountList.querySelector(`[data-account-id="${account.id}"]`);
    if (!item) return;

    // Update name
    const nameEl = item.querySelector('.account-name');
    if (nameEl) {
      const displayName = account.profileName || account.name || '';
      nameEl.textContent = displayName;
      if (!displayName) nameEl.innerHTML = '&nbsp;';
    }

    // Update note (only if not currently focused to avoid overwriting user input)
    const noteEl = item.querySelector('.account-note');
    if (noteEl && typeof document !== 'undefined' && document.activeElement !== noteEl) {
      noteEl.textContent = account.note || '';
    }

    // Update phone number
    const phoneEl = item.querySelector('.account-phone');
    if (phoneEl) {
      if (account.phoneNumber) {
        phoneEl.textContent = account.phoneNumber;
        phoneEl.style.display = '';
      } else {
        phoneEl.style.display = 'none';
      }
    }

    // Update collapsed display name
    const collapsedNameEl = item.querySelector('.account-collapsed-name');
    if (collapsedNameEl) {
      const txt = account.note || account.profileName || account.name || '';
      collapsedNameEl.textContent = txt;
      if (!txt) collapsedNameEl.innerHTML = '&nbsp;';
    }

    // Sync status
    if (typeof window !== 'undefined' && window.SidebarActions && window.SidebarActions.syncAccountStatusWithRunningStatus) {
      window.SidebarActions.syncAccountStatusWithRunningStatus(account);
    }
  });

  console.log(`[Events] Updated ${accounts.length} accounts' DOM without IP refresh`);
}

/**
 * Render account list with incremental IP fetching
 * Only fetches IP info for new accounts, existing accounts use cached IP info
 * @param {string[]} newAccountIds - IDs of newly added accounts
 */
async function renderAccountListIncremental(newAccountIds) {
  const state = getState();
  const render = getRender();
  const accountList = typeof document !== 'undefined' ? document.getElementById('account-list') : null;
  if (!accountList) return;

  // Increment render version to cancel any pending stale renders
  const currentRenderVersion = state.incrementRenderVersion();

  // Clear existing items
  accountList.querySelectorAll('.account-item').forEach(item => item.remove());

  // Get accounts and apply filter
  const accounts = state.getAccounts();
  const filterQuery = state.getFilterQuery();

  let filteredAccounts = accounts;
  if (filterQuery) {
    const query = filterQuery.toLowerCase();
    filteredAccounts = accounts.filter(account => {
      const name = (account.name || '').toLowerCase();
      const profileName = (account.profileName || '').toLowerCase();
      const phone = (account.phoneNumber || '').toLowerCase();
      const note = (account.note || '').toLowerCase();
      return name.includes(query) || profileName.includes(query) || phone.includes(query) || note.includes(query);
    });
  }

  // Show/hide empty state
  const emptyState = typeof document !== 'undefined' ? document.getElementById('empty-state') : null;
  if (filteredAccounts.length === 0) {
    if (emptyState) {
      emptyState.classList.remove('hidden');
      if (accounts.length > 0) {
        const emptyText = emptyState.querySelector('p');
        if (emptyText) emptyText.textContent = '没有找到匹配的账号';
      }
    }
    return;
  }

  if (emptyState) {
    emptyState.classList.add('hidden');
  }

  // Ensure running status is up-to-date
  if (typeof window !== 'undefined' && window.electronAPI) {
    try {
      const statusResult = await window.electronAPI.getAllAccountStatuses();
      if (statusResult && statusResult.success && statusResult.statuses) {
        if (typeof window.SidebarActions !== 'undefined' && window.SidebarActions.mergeRunningStatuses) {
          window.SidebarActions.mergeRunningStatuses(statusResult.statuses);
        }
        if (typeof window.SidebarActions !== 'undefined' && window.SidebarActions.syncAccountStatusesWithRunningStatus) {
          window.SidebarActions.syncAccountStatusesWithRunningStatus();
        }
      }
    } catch (error) {
      console.error('[Events] Failed to get account statuses:', error);
    }
  }

  // Check if this render is still valid
  if (currentRenderVersion !== state.getRenderVersion()) {
    console.log(`[Events] Aborting stale render (version ${currentRenderVersion}, current ${state.getRenderVersion()})`);
    return;
  }

  // Sort accounts by order
  const sortedAccounts = [...filteredAccounts].sort((a, b) => {
    const orderA = a.order !== undefined ? a.order : 999;
    const orderB = b.order !== undefined ? b.order : 999;
    return orderA - orderB;
  });

  // Final check before DOM mutation
  if (currentRenderVersion !== state.getRenderVersion()) {
    console.log(`[Events] Aborting stale render before DOM update (version ${currentRenderVersion}, current ${state.getRenderVersion()})`);
    return;
  }

  const fragment = document.createDocumentFragment();
  const newAccountIdsSet = new Set(newAccountIds);

  sortedAccounts.forEach((account) => {
    // For existing accounts with cached IP info, skip IP fetch
    const hasCachedIP = !newAccountIdsSet.has(account.id) && account.lastIPInfo;
    const accountItem = render.createAccountItem(account, { skipIPFetch: hasCachedIP });

    // For existing accounts, render cached IP info
    if (hasCachedIP && typeof window !== 'undefined' && window.SidebarIPInfo) {
      let ipContainer = accountItem.querySelector('.account-ip-info');
      if (!ipContainer) {
        ipContainer = document.createElement('div');
        ipContainer.className = 'account-ip-info';
        const infoBlock = accountItem.querySelector('.account-info');
        if (infoBlock) {
          infoBlock.appendChild(ipContainer);
        }
      }
      if (account.lastIPInfo.success !== false) {
        window.SidebarIPInfo.renderIPDetails(ipContainer, account.lastIPInfo, account);
        console.log(`[Events] Using cached IP info for account ${account.id}`);
      }
    } else if (newAccountIdsSet.has(account.id)) {
      console.log(`[Events] Fetching IP info for new account ${account.id}`);
    }

    fragment.appendChild(accountItem);
  });

  accountList.appendChild(fragment);

  // Status recovery
  setTimeout(() => {
    sortedAccounts.forEach((account) => {
      if (typeof window !== 'undefined' && window.SidebarActions && window.SidebarActions.syncAccountStatusWithRunningStatus) {
        window.SidebarActions.syncAccountStatusWithRunningStatus(account);
      }
      if (account.loginStatus === true) {
        render.updateAccountStatus(account.id, 'online');
      }
    });
    console.log(`[Events] Status recovery completed for ${sortedAccounts.length} accounts (${newAccountIds.length} new)`);
  }, 100);
}

/**
 * Handle account switched event from main process
 * @param {string} accountId - Account ID that was switched to
 */
function handleAccountSwitched(accountId) {
  const render = getRender();
  if (typeof render.setActiveAccount === 'function') {
    render.setActiveAccount(accountId);
  }
}

/**
 * Handle active account changed event from main process
 * @param {Object} data - Event data containing accountId
 */
function handleActiveAccountChanged(data) {
  const { accountId } = data;
  const render = getRender();
  if (typeof render.setActiveAccount === 'function') {
    render.setActiveAccount(accountId);
  }
}

/**
 * Handle account status changed event from main process
 * @param {Object} data - Event data containing accountId and status
 */
function handleAccountStatusChanged(data) {
  const { accountId, status } = data;
  const render = getRender();
  if (typeof render.updateAccountStatus === 'function') {
    render.updateAccountStatus(accountId, status);
  }
}

// ============================================================================
// View Manager Event Handlers
// ============================================================================

/**
 * Handle view loading event
 * @param {Object} data - Event data containing accountId
 */
function handleViewLoading(data) {
  const { accountId } = data || {};
  console.log(`[Events] handleViewLoading for ${accountId}`);
  const render = getRender();
  if (typeof render.updateAccountStatus === 'function') {
    render.updateAccountStatus(accountId, 'loading');
  }
}

/**
 * Handle view ready event
 * @param {Object} data - Event data containing accountId, loginStatus, connectionStatus
 */
function handleViewReady(data) {
  const { accountId, loginStatus, connectionStatus } = data || {};
  const state = getState();
  const render = getRender();

  console.log(`[Events] handleViewReady for ${accountId}:`, {
    loginStatus,
    connectionStatus
  });

  const account = state.getAccountById(accountId);
  if (account) {
    if (loginStatus !== undefined) {
      state.updateAccount(accountId, { loginStatus });
    }
    if (connectionStatus) {
      state.updateAccount(accountId, { connectionStatus });
    }
  }

  if (typeof render.updateAccountStatus === 'function') {
    if (connectionStatus) {
      render.updateAccountStatus(accountId, connectionStatus);
    } else if (loginStatus) {
      render.updateAccountStatus(accountId, 'online');
    } else {
      render.updateAccountStatus(accountId, 'offline');
    }
  }
}

/**
 * Handle view error event
 * @param {Object} data - Event data containing accountId and error
 */
function handleViewError(data) {
  const { accountId, error } = data || {};
  const state = getState();
  const render = getRender();

  const account = state.getAccountById(accountId);
  if (account) {
    state.updateAccount(accountId, {
      connectionStatus: 'error',
      connectionError: error
    });
  }

  if (typeof render.updateAccountStatus === 'function') {
    render.updateAccountStatus(accountId, 'error');
  }

  console.error(`[Events] View error for account ${accountId}:`, error);
}

/**
 * Handle login status changed event
 * @param {Object} data - Event data containing accountId, isLoggedIn, hasQRCode, loginInfo
 */
function handleLoginStatusChanged(data) {
  const { accountId, isLoggedIn, hasQRCode, loginInfo } = data || {};
  const state = getState();
  const render = getRender();

  console.log(`[Events] handleLoginStatusChanged for ${accountId}:`, {
    isLoggedIn,
    hasQRCode,
    loginInfo
  });

  const account = state.getAccountById(accountId);
  if (account) {
    state.updateAccount(accountId, {
      loginStatus: isLoggedIn,
      hasQRCode: hasQRCode,
      loginInfo: loginInfo
    });

    if (isLoggedIn) {
      // Logged in account, ensure running status is also connected
      state.updateAccount(accountId, {
        runningStatus: 'connected',
        isRunning: true
      });
    }
  }

  if (typeof render.updateAccountStatus === 'function') {
    if (isLoggedIn) {
      render.updateAccountStatus(accountId, 'online');
    } else if (hasQRCode) {
      render.updateAccountStatus(accountId, 'offline');
    } else {
      // Determine display status based on running status
      const runningStatus = account ? account.runningStatus : 'not_started';
      if (runningStatus === 'connected') {
        render.updateAccountStatus(accountId, 'online');
      } else if (runningStatus === 'loading') {
        render.updateAccountStatus(accountId, 'loading');
      } else if (runningStatus === 'error') {
        render.updateAccountStatus(accountId, 'error');
      } else {
        render.updateAccountStatus(accountId, 'offline');
      }
    }
  }
}

/**
 * Handle view crashed event
 * @param {Object} data - Event data containing accountId and error
 */
function handleViewCrashed(data) {
  const { accountId, error } = data || {};
  const state = getState();
  const render = getRender();
  const utils = getUtils();

  const account = state.getAccountById(accountId);
  if (account) {
    state.updateAccount(accountId, {
      connectionStatus: 'error',
      connectionError: error
    });
  }

  if (typeof render.updateAccountStatus === 'function') {
    render.updateAccountStatus(accountId, 'error');
  }

  console.error(`[Events] View crashed for account ${accountId}:`, error);
  
  if (typeof utils.showError === 'function') {
    const accountName = state.getAccountName ? state.getAccountName(accountId) : accountId;
    utils.showError(`账号 "${accountName}" 已崩溃，请重新加载。`);
  }
}

/**
 * Handle connection status changed event
 * @param {Object} data - Event data containing accountId, connectionStatus, isLoggedIn, hasQRCode, details, error
 */
function handleConnectionStatusChanged(data) {
  const { accountId, connectionStatus, error, details, isLoggedIn, hasQRCode } = data || {};
  const state = getState();
  const render = getRender();

  console.log(`[Events] handleConnectionStatusChanged for ${accountId}:`, {
    connectionStatus,
    isLoggedIn,
    hasQRCode,
    details
  });

  const account = state.getAccountById(accountId);
  if (account) {
    const updates = {
      connectionStatus: connectionStatus,
      connectionError: error || null,
      connectionDetails: details || null
    };
    
    if (isLoggedIn !== undefined) {
      updates.loginStatus = isLoggedIn;
    }
    if (hasQRCode !== undefined) {
      updates.hasQRCode = hasQRCode;
    }
    
    state.updateAccount(accountId, updates);
  }

  if (typeof render.updateAccountStatus === 'function') {
    render.updateAccountStatus(accountId, connectionStatus);
  }

  console.log(
    `[Events] Connection status changed for account ${accountId}:`,
    connectionStatus,
    details
  );
}

/**
 * Handle account profile updated event (avatar / name / phone)
 * @param {Object} data - Event data containing accountId, phoneNumber, profileName, avatarUrl
 */
function handleAccountProfileUpdated(data) {
  const { accountId, phoneNumber, profileName, avatarUrl } = data || {};
  const state = getState();
  const render = getRender();

  console.log('[Events] account-profile-updated', data);

  const account = state.getAccountById(accountId);
  if (!account) {
    return;
  }

  const updates = {};
  if (phoneNumber) {
    updates.phoneNumber = phoneNumber;
  }
  if (profileName) {
    updates.profileName = profileName;
  }
  if (avatarUrl) {
    updates.avatarUrl = avatarUrl;
  }

  state.updateAccount(accountId, updates);

  if (typeof render.applyAccountProfileToItem === 'function') {
    const accountList = typeof document !== 'undefined' ? document.getElementById('account-list') : null;
    if (!accountList) return;
    
    const item = accountList.querySelector(`[data-account-id="${accountId}"]`);
    if (!item) return;

    render.applyAccountProfileToItem(account, item);
  }
}

/**
 * Handle unread count updated event
 * @param {Object} data - Event data containing accountId and unreadCount
 */
function handleUnreadCountUpdated(data) {
  const { accountId, unreadCount } = data || {};
  const state = getState();
  const render = getRender();

  const account = state.getAccountById(accountId);
  if (!account) {
    return;
  }

  state.updateAccount(accountId, { unreadCount: unreadCount });

  const accountList = typeof document !== 'undefined' ? document.getElementById('account-list') : null;
  if (!accountList) return;

  const item = accountList.querySelector(`[data-account-id="${accountId}"]`);
  if (!item) return;

  const avatarContainer = item.querySelector('.account-avatar-container');
  if (typeof render.renderUnreadBadge === 'function' && avatarContainer) {
    render.renderUnreadBadge(account, avatarContainer);
  }
}

// ============================================================================
// Manual Account Control Event Handlers
// ============================================================================

/**
 * Handle account opening event
 * @param {Object} data - Event data containing accountId
 */
function handleAccountOpening(data) {
  const { accountId } = data || {};
  const render = getRender();
  
  if (typeof render.updateAccountRunningStatus === 'function') {
    render.updateAccountRunningStatus(accountId, 'loading');
  }
}

/**
 * Handle account opened event
 * @param {Object} data - Event data containing accountId
 */
function handleAccountOpened(data) {
  const { accountId } = data || {};
  const render = getRender();
  
  if (typeof render.updateAccountRunningStatus === 'function') {
    render.updateAccountRunningStatus(accountId, 'connected');
  }

  // Refresh IP info for this account after view is opened/restarted
  if (typeof window !== 'undefined' && window.SidebarIPInfo && typeof window.SidebarIPInfo.refreshAccountIPInfo === 'function') {
    window.SidebarIPInfo.refreshAccountIPInfo(accountId);
  }
}

/**
 * Handle account open failed event
 * @param {Object} data - Event data containing accountId and error
 */
function handleAccountOpenFailed(data) {
  const { accountId, error } = data || {};
  const render = getRender();
  const utils = getUtils();
  
  if (typeof render.updateAccountRunningStatus === 'function') {
    render.updateAccountRunningStatus(accountId, 'error');
  }
  
  if (typeof utils.showError === 'function') {
    utils.showError(`打开账号失败: ${error}`);
  }
}

/**
 * Handle account closing event
 * @param {Object} data - Event data containing accountId
 */
function handleAccountClosing(data) {
  const { accountId } = data || {};
  const render = getRender();
  
  if (typeof render.updateAccountRunningStatus === 'function') {
    render.updateAccountRunningStatus(accountId, 'loading');
  }
}

/**
 * Handle account closed event
 * @param {Object} data - Event data containing accountId
 */
function handleAccountClosed(data) {
  const { accountId } = data || {};
  const state = getState();
  const render = getRender();
  
  const account = state.getAccountById(accountId);
  if (account) {
    state.updateAccount(accountId, {
      loginStatus: false,
      hasQRCode: false,
      connectionStatus: 'offline',
      status: 'offline'
    });
  }
  
  if (typeof render.updateAccountRunningStatus === 'function') {
    render.updateAccountRunningStatus(accountId, 'not_started');
  }
}

/**
 * Handle account close failed event
 * @param {Object} data - Event data containing accountId and error
 */
function handleAccountCloseFailed(data) {
  const { accountId, error } = data || {};
  const render = getRender();
  const utils = getUtils();
  
  if (typeof render.updateAccountRunningStatus === 'function') {
    render.updateAccountRunningStatus(accountId, 'error');
  }
  
  if (typeof utils.showError === 'function') {
    utils.showError(`关闭账号失败: ${error}`);
  }
}

// ============================================================================
// Exports
// ============================================================================

const events = {
  // Event Setup
  setupEventListeners,
  
  // Account Update Handlers
  handleAccountsUpdated,
  handleAccountSwitched,
  handleActiveAccountChanged,
  handleAccountStatusChanged,
  
  // View Manager Event Handlers
  handleViewLoading,
  handleViewReady,
  handleViewError,
  handleLoginStatusChanged,
  handleViewCrashed,
  handleConnectionStatusChanged,
  handleAccountProfileUpdated,
  handleUnreadCountUpdated,
  
  // Manual Account Control Event Handlers
  handleAccountOpening,
  handleAccountOpened,
  handleAccountOpenFailed,
  handleAccountClosing,
  handleAccountClosed,
  handleAccountCloseFailed,
  
  // Incremental update helpers
  updateExistingAccountsDOM,
  renderAccountListIncremental
};

// Export for CommonJS (Node.js/testing)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = events;
}

// Export for browser global (IIFE pattern)
if (typeof window !== 'undefined') {
  window.SidebarEvents = events;
}
