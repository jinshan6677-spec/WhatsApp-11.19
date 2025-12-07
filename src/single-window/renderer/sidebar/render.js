/**
 * Render Module for Sidebar
 * Handles all DOM rendering operations for the account list
 * 
 * @module sidebar/render
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
// DOM Element Accessors
// ============================================================================

/**
 * Get the account list container element
 * @returns {HTMLElement|null} Account list element
 */
function getAccountList() {
  if (typeof document !== 'undefined') {
    return document.getElementById('account-list');
  }
  return null;
}

/**
 * Get the empty state element
 * @returns {HTMLElement|null} Empty state element
 */
function getEmptyState() {
  if (typeof document !== 'undefined') {
    return document.getElementById('empty-state');
  }
  return null;
}

// ============================================================================
// Status Rendering
// ============================================================================

/**
 * Render the status dot for an account
 * @param {Object} account - Account object
 * @param {HTMLElement} dotElement - Status dot element
 */
function renderStatusDot(account, dotElement) {
  if (!dotElement || !account) return;

  const statusValue = account.status || account.connectionStatus || 'offline';
  const loginStatus = account.loginStatus;
  const hasQRCode = account.hasQRCode;
  const details = account.connectionDetails;
  const error = account.connectionError;

  // Reset classes
  dotElement.className = 'status-dot';

  // Apply status class based on account state
  if (statusValue === 'offline' && (loginStatus === false || hasQRCode || (details && details.needsQRScan))) {
    dotElement.classList.add('warning');
    dotElement.title = '需要登录';
  } else if (statusValue === 'online') {
    dotElement.classList.add('online');
    dotElement.title = '';
  } else if (statusValue === 'loading') {
    dotElement.classList.add('loading');
    dotElement.title = '';
  } else if (statusValue === 'error') {
    dotElement.classList.add('error');
    dotElement.title = (error && error.message) || '连接错误';
  } else {
    dotElement.classList.add('offline');
    dotElement.title = '';
  }
}

/**
 * Render quick action buttons for an account
 * @param {Object} account - Account object
 * @param {HTMLElement} container - Container element for actions
 */
function renderQuickActions(account, container) {
  if (!container || !account) return;

  container.innerHTML = '';

  const runningStatus = account.runningStatus || 'not_started';
  const isRunning = !!account.isRunning;

  const actionBtn = document.createElement('button');
  actionBtn.className = 'action-btn';

  if (runningStatus === 'not_started' || !isRunning) {
    actionBtn.innerHTML = '▶';
    actionBtn.title = '打开账号';
    actionBtn.classList.add('start');
    container.appendChild(actionBtn);
  } else if (runningStatus === 'loading') {
    const spinner = document.createElement('div');
    spinner.className = 'mini-spinner';
    container.appendChild(spinner);
  } else if (runningStatus === 'connected' || isRunning) {
    actionBtn.innerHTML = '⏹';
    actionBtn.title = '关闭账号';
    actionBtn.classList.add('stop');
    container.appendChild(actionBtn);
  } else if (runningStatus === 'error') {
    actionBtn.innerHTML = '↻';
    actionBtn.title = '重试';
    actionBtn.classList.add('retry');
    container.appendChild(actionBtn);
  }
}

/**
 * Render unread message badge
 * @param {Object} account - Account object
 * @param {HTMLElement} container - Avatar container element
 */
function renderUnreadBadge(account, container) {
  if (!account || !container) return;

  let badge = container.querySelector('.unread-badge');
  const unreadCount = parseInt(account.unreadCount || 0, 10);

  if (unreadCount > 0) {
    if (!badge) {
      badge = document.createElement('div');
      badge.className = 'unread-badge';
      container.appendChild(badge);
    }
    badge.textContent = unreadCount > 99 ? '99+' : unreadCount;
    badge.style.display = 'flex';
  } else if (badge) {
    badge.style.display = 'none';
  }
}

// ============================================================================
// Account Item Rendering
// ============================================================================

/**
 * Apply account profile data to an existing item element
 * @param {Object} account - Account object
 * @param {HTMLElement} itemElement - Account item element
 */
function applyAccountProfileToItem(account, itemElement) {
  if (!account || !itemElement) return;

  const utils = getUtils();
  const displayName = account.profileName || account.name || '';

  // Update name
  const nameElement = itemElement.querySelector('.account-name');
  if (nameElement) {
    nameElement.textContent = displayName;
  }

  // Update avatar
  const avatarElement = itemElement.querySelector('.account-avatar');
  if (avatarElement) {
    // Clear old content
    avatarElement.textContent = '';
    const existingImg = avatarElement.querySelector('img');
    if (existingImg) {
      existingImg.remove();
    }
    avatarElement.style.background = '';

    if (account.avatarUrl) {
      const img = document.createElement('img');
      img.src = account.avatarUrl;
      img.alt = displayName;
      img.className = 'account-avatar-image';
      avatarElement.appendChild(img);
    } else if (displayName) {
      avatarElement.textContent = utils.getAccountInitial(displayName);
      avatarElement.style.background = utils.getAccountColor(account.id);
    } else {
      avatarElement.textContent = '';
      avatarElement.style.background = ''; // Revert to default
    }
  }

  // Update phone number and note
  const secondaryElement = itemElement.querySelector('.account-secondary');
  if (secondaryElement) {
    // Update Phone
    let phoneElement = secondaryElement.querySelector('.account-phone');
    if (!phoneElement) {
      phoneElement = document.createElement('div');
      phoneElement.className = 'account-phone';
      secondaryElement.insertBefore(phoneElement, secondaryElement.firstChild);
    }

    if (account.phoneNumber) {
      phoneElement.textContent = account.phoneNumber;
      phoneElement.style.display = '';
      phoneElement.onclick = (e) => {
        e.stopPropagation();
        utils.copyToClipboard(account.phoneNumber, phoneElement);
      };
    } else {
      phoneElement.style.display = 'none';
    }

    // Update Note (only if not currently focused to avoid overwriting user input)
    const noteElement = secondaryElement.querySelector('.account-note');
    if (noteElement && typeof document !== 'undefined' && document.activeElement !== noteElement) {
      noteElement.textContent = account.note || '';
    }
  }

  // Update collapsed display name (priority: note > profileName > name)
  const collapsedName = itemElement.querySelector('.account-collapsed-name');
  if (collapsedName) {
    const txt = account.note || account.profileName || account.name || '';
    collapsedName.textContent = txt;
    if (!txt) collapsedName.innerHTML = '&nbsp;';
  }
}

/**
 * Create an account item element
 * @param {Object} account - Account object
 * @param {Object} options - Rendering options
 * @param {boolean} options.skipIPFetch - Whether to skip IP fetching (default: false)
 * @returns {HTMLElement} Account item element
 */
function createAccountItem(account, options = {}) {
  const { skipIPFetch = false } = options;
  const state = getState();
  const utils = getUtils();

  const item = document.createElement('div');
  item.className = 'account-item';

  // Add logged-in class if applicable
  if (account.loginStatus === true) {
    item.classList.add('loggedin');
  }

  item.dataset.accountId = account.id;
  item.setAttribute('tabindex', '0');
  item.setAttribute('role', 'button');
  item.setAttribute('aria-label', `切换到 ${account.name || account.profileName || '账号'}`);

  // Set active state
  if (account.id === state.getActiveAccountId()) {
    item.classList.add('active');
  }

  // Selection mode checkbox
  if (state.isSelectionMode()) {
    item.classList.add('in-selection-mode');
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'selection-checkbox';
    checkbox.checked = state.getSelectedAccountIds().has(account.id);
    item.appendChild(checkbox);

    if (state.getSelectedAccountIds().has(account.id)) {
      item.classList.add('selected');
    }
  }

  // Avatar container
  const avatarContainer = document.createElement('div');
  avatarContainer.className = 'account-avatar-container';

  // Avatar
  const avatar = document.createElement('div');
  avatar.className = 'account-avatar';
  
  // Check for avatar image
  if (account.avatarUrl) {
    const avatarImg = document.createElement('img');
    avatarImg.src = account.avatarUrl;
    avatarImg.alt = account.name || account.profileName || '';
    avatarImg.className = 'account-avatar-image';
    avatarImg.onerror = function() {
      // Fallback to initial on error
      this.style.display = 'none';
      avatar.textContent = utils.getAccountInitial(account.name || account.profileName);
      avatar.style.background = utils.getAccountColor(account.id);
    };
    avatar.appendChild(avatarImg);
  } else if (account.name || account.profileName) {
    avatar.textContent = utils.getAccountInitial(account.name || account.profileName);
    avatar.style.background = utils.getAccountColor(account.id);
  }
  // Otherwise leave empty with default gray background

  // Status dot
  const statusDot = document.createElement('div');
  statusDot.className = 'status-dot';
  renderStatusDot(account, statusDot);

  avatarContainer.appendChild(avatar);
  avatarContainer.appendChild(statusDot);

  // Unread badge
  renderUnreadBadge(account, avatarContainer);

  // Account info
  const info = document.createElement('div');
  info.className = 'account-info';

  // Header with name
  const header = document.createElement('div');
  header.className = 'account-header';

  const name = document.createElement('div');
  name.className = 'account-name';
  const displayName = account.name || '';
  name.textContent = displayName;
  if (!displayName) name.innerHTML = '&nbsp;'; // Maintain height

  header.appendChild(name);

  // Secondary info (phone + note)
  const secondary = document.createElement('div');
  secondary.className = 'account-secondary';

  // Phone number with click to copy
  const phoneEl = document.createElement('div');
  phoneEl.className = 'account-phone';
  if (account.phoneNumber) {
    phoneEl.textContent = account.phoneNumber;
    phoneEl.onclick = (e) => {
      e.stopPropagation();
      utils.copyToClipboard(account.phoneNumber, phoneEl);
    };
  } else {
    phoneEl.style.display = 'none';
  }
  secondary.appendChild(phoneEl);

  // Note editor (editable)
  const noteEl = document.createElement('div');
  noteEl.className = 'account-note';
  noteEl.contentEditable = true;
  noteEl.textContent = account.note || '';
  
  // Prevent click from bubbling to account item
  noteEl.addEventListener('click', (e) => {
    e.stopPropagation();
  });

  // Handle Note Save on blur
  noteEl.addEventListener('blur', () => {
    const newNote = noteEl.textContent.trim();
    if (newNote !== (account.note || '')) {
      if (typeof window !== 'undefined' && window.SidebarActions) {
        window.SidebarActions.saveAccountNote(account.id, newNote);
      }
      account.note = newNote; // Optimistic update

      // Update collapsed display name immediately
      const collapsedNameEl = item.querySelector('.account-collapsed-name');
      if (collapsedNameEl) {
        collapsedNameEl.textContent = newNote || account.profileName || account.name || '未命名';
      }
    }
  });

  // Auto-save on mouse leave
  noteEl.addEventListener('mouseleave', () => {
    if (typeof document !== 'undefined' && document.activeElement === noteEl) {
      noteEl.blur();
    }
  });

  // Handle Enter key to save
  noteEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      noteEl.blur();
    }
  });
  
  secondary.appendChild(noteEl);

  info.appendChild(header);
  info.appendChild(secondary);

  // Collapsed display name (shows note or nickname when sidebar is collapsed)
  const collapsedName = document.createElement('div');
  collapsedName.className = 'account-collapsed-name';
  // Priority: note > profileName > name
  collapsedName.textContent = account.note || account.profileName || account.name || '';
  if (!collapsedName.textContent) collapsedName.innerHTML = '&nbsp;';
  info.appendChild(collapsedName);

  // Quick Actions
  const actions = document.createElement('div');
  actions.className = 'account-actions';

  // Ensure logged-in accounts have correct running status
  if (account.loginStatus === true && (account.runningStatus === 'loading' || account.runningStatus === 'not_started')) {
    account.runningStatus = 'connected';
    account.isRunning = true;
  }

  renderQuickActions(account, actions);

  // Assemble item
  item.appendChild(avatarContainer);
  item.appendChild(info);
  item.appendChild(actions);

  // Apply profile data
  applyAccountProfileToItem(account, item);

  // Fetch and render IP info (skip if requested to use cached IP)
  if (!skipIPFetch && typeof window !== 'undefined' && window.SidebarIPInfo) {
    setTimeout(() => {
      window.SidebarIPInfo.fetchAndRenderIPInfo(account, item);
    }, 10);
  }

  return item;
}

// ============================================================================
// List Rendering
// ============================================================================

/**
 * Render the complete account list
 * @returns {Promise<void>}
 */
async function renderAccountList() {
  const accountList = getAccountList();
  if (!accountList) return;

  const state = getState();

  // Increment render version to cancel any pending stale renders
  const currentRenderVersion = state.incrementRenderVersion();

  // Clear existing items
  accountList.querySelectorAll('.account-item').forEach(item => item.remove());

  // Get accounts and apply filter if needed
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
      return name.includes(query) || 
             profileName.includes(query) || 
             phone.includes(query) || 
             note.includes(query);
    });
  }

  // Show/hide empty state
  const emptyState = getEmptyState();
  if (filteredAccounts.length === 0) {
    if (emptyState) {
      emptyState.classList.remove('hidden');
      // If we have accounts but filtered to 0, show "no results" state
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
        // Merge running statuses
        if (typeof window.SidebarActions !== 'undefined' && window.SidebarActions.mergeRunningStatuses) {
          window.SidebarActions.mergeRunningStatuses(statusResult.statuses);
        }
        // Sync account statuses
        if (typeof window.SidebarActions !== 'undefined' && window.SidebarActions.syncAccountStatusesWithRunningStatus) {
          window.SidebarActions.syncAccountStatusesWithRunningStatus();
        }
      }
    } catch (error) {
      console.error('[Render] Failed to get account statuses:', error);
    }
  }

  // Check if this render is still valid (not superseded by a newer render)
  if (currentRenderVersion !== state.getRenderVersion()) {
    console.log(`[Render] Aborting stale render (version ${currentRenderVersion}, current ${state.getRenderVersion()})`);
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
    console.log(`[Render] Aborting stale render before DOM update (version ${currentRenderVersion}, current ${state.getRenderVersion()})`);
    return;
  }

  // Create document fragment for efficient DOM manipulation
  const fragment = document.createDocumentFragment();

  // Create account items
  sortedAccounts.forEach(account => {
    fragment.appendChild(createAccountItem(account));
  });

  // Append all items at once
  accountList.appendChild(fragment);

  // DOM更新完成后，确保所有账号状态正确显示
  setTimeout(() => {
    sortedAccounts.forEach((account) => {
      // 确保账号状态与运行状态同步
      if (typeof window !== 'undefined' && window.SidebarActions && window.SidebarActions.syncAccountStatusWithRunningStatus) {
        window.SidebarActions.syncAccountStatusWithRunningStatus(account);
      }

      // 如果账号已登录，确保显示在线状态
      if (account.loginStatus === true) {
        updateAccountStatus(account.id, 'online');
      }
    });

    console.log(`[Render] Status recovery completed for ${sortedAccounts.length} accounts`);
  }, 100);
}

// ============================================================================
// Status Updates
// ============================================================================

/**
 * Update account status in the UI
 * @param {string} accountId - Account ID
 * @param {string} status - New status
 */
function updateAccountStatus(accountId, status) {
  const state = getState();
  const account = state.getAccountById(accountId);
  if (!account) {
    console.warn(`[Render] Account ${accountId} not found when updating status to '${status}'`);
    return;
  }

  // Validate status
  const validStatuses = ['online', 'offline', 'loading', 'error'];
  if (!validStatuses.includes(status)) {
    console.error(`[Render] Invalid status '${status}' for account ${accountId}`);
    return;
  }

  // Update state
  const oldStatus = account.status;
  state.updateAccount(accountId, { status });

  if (oldStatus !== status) {
    console.log(`[Render] Account ${accountId} status changed from '${oldStatus}' to '${status}'`);
  }

  // Update DOM
  const accountList = getAccountList();
  if (!accountList) return;

  const item = accountList.querySelector(`[data-account-id="${accountId}"]`);
  if (!item) {
    console.warn(`[Render] Account item for ${accountId} not found in DOM`);
    return;
  }

  // Toggle loggedin class based on login status
  if (account.loginStatus === true) {
    item.classList.add('loggedin');
  } else {
    item.classList.remove('loggedin');
  }

  // Update status dot
  const dot = item.querySelector('.status-dot');
  if (dot) {
    renderStatusDot(account, dot);
  }
}

/**
 * Update account running status in the UI
 * @param {string} accountId - Account ID
 * @param {string} runningStatus - New running status
 */
function updateAccountRunningStatus(accountId, runningStatus) {
  const state = getState();
  const account = state.getAccountById(accountId);
  if (!account) return;

  // Update state
  state.updateAccount(accountId, {
    runningStatus,
    isRunning: runningStatus !== 'not_started' && runningStatus !== 'error'
  });

  // Update DOM
  const accountList = getAccountList();
  if (!accountList) return;

  const item = accountList.querySelector(`[data-account-id="${accountId}"]`);
  if (!item) return;

  // Update action buttons
  const actionsContainer = item.querySelector('.account-actions');
  if (actionsContainer) {
    renderQuickActions(account, actionsContainer);
  }

  // Also update status dot based on running status
  const dot = item.querySelector('.status-dot');
  if (dot) {
    renderStatusDot(account, dot);
  }
}

/**
 * Set the active account and update UI
 * @param {string} accountId - Account ID to set as active
 */
function setActiveAccount(accountId) {
  const state = getState();
  state.setActiveAccountId(accountId);

  const accountList = getAccountList();
  if (!accountList) return;

  // Update active class on all items
  accountList.querySelectorAll('.account-item').forEach(item => {
    if (item.dataset.accountId === accountId) {
      item.classList.add('active');
    } else {
      item.classList.remove('active');
    }
  });
}

/**
 * Update selection UI for all accounts
 */
function updateSelectionUI() {
  const accountList = getAccountList();
  if (!accountList) return;

  const state = getState();
  const selectedIds = state.getSelectedAccountIds();

  state.getAccounts().forEach(account => {
    const item = accountList.querySelector(`[data-account-id="${account.id}"]`);
    if (!item) return;

    const isSelected = selectedIds.has(account.id);
    item.classList.toggle('selected', isSelected);

    const checkbox = item.querySelector('.selection-checkbox');
    if (checkbox) {
      checkbox.checked = isSelected;
    }
  });
}

// ============================================================================
// Exports
// ============================================================================

const renderExports = {
  // Rendering functions
  renderAccountList,
  createAccountItem,
  renderStatusDot,
  renderQuickActions,
  renderUnreadBadge,
  applyAccountProfileToItem,
  // Status updates
  updateAccountStatus,
  updateAccountRunningStatus,
  setActiveAccount,
  updateSelectionUI,
  // DOM accessors
  getAccountList,
  getEmptyState
};

// Export for CommonJS (Node.js/testing)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = renderExports;
}

// Export for browser global (IIFE pattern)
if (typeof window !== 'undefined') {
  window.SidebarRender = renderExports;
}
