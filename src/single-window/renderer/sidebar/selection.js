/**
 * Selection Module
 * Handles batch selection and operations for accounts
 */

(function () {
  'use strict';

  // Import dependencies
  function getState() {
    if (typeof require !== 'undefined') {
      return require('./state.js');
    }
    return window.SidebarState || {};
  }

  function getActions() {
    if (typeof require !== 'undefined') {
      return require('./actions.js');
    }
    return window.SidebarActions || {};
  }

  function getRender() {
    if (typeof require !== 'undefined') {
      return require('./render.js');
    }
    return window.SidebarRender || {};
  }

  /**
   * Toggle selection mode on/off
   */
  function toggleSelectionMode() {
    const state = getState();
    const render = getRender();
    
    // Toggle selection mode state
    const newMode = state.toggleSelectionModeState();
    
    // Clear selected accounts when toggling
    state.clearSelectedAccounts();

    // Update UI elements
    const selectionModeBtn = document.getElementById('selection-mode-btn');
    const selectionActionBar = document.getElementById('selection-action-bar');

    if (selectionModeBtn) {
      selectionModeBtn.classList.toggle('active', newMode);
    }

    if (selectionActionBar) {
      selectionActionBar.classList.toggle('hidden', !newMode);
    }

    // Re-render account list to show/hide checkboxes
    if (render.renderAccountList) {
      render.renderAccountList();
    }

    console.log(`[Sidebar] Selection mode: ${newMode ? 'ON' : 'OFF'}`);
  }

  /**
   * Select all accounts
   */
  function selectAllAccounts() {
    const state = getState();
    const accounts = state.getAccounts();
    const selectedIds = state.getSelectedAccountIds();

    const allSelected = selectedIds.size === accounts.length;

    if (allSelected) {
      // Deselect all
      state.clearSelectedAccounts();
    } else {
      // Select all
      accounts.forEach(account => {
        state.addSelectedAccount(account.id);
      });
    }

    // Update UI
    updateSelectionUI();
  }

  /**
   * Update selection UI for all accounts
   */
  function updateSelectionUI() {
    const state = getState();
    const accountList = document.getElementById('account-list');
    
    if (!accountList) return;

    const accounts = state.getAccounts();
    const selectedIds = state.getSelectedAccountIds();

    accounts.forEach(account => {
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

  /**
   * Handle checkbox click for account selection
   * @param {string} accountId - Account ID
   * @param {boolean} checked - Whether the checkbox is checked
   */
  function handleCheckboxClick(accountId, checked) {
    const state = getState();
    
    if (checked) {
      state.addSelectedAccount(accountId);
    } else {
      state.removeSelectedAccount(accountId);
    }

    // Update UI for this specific account
    const accountList = document.getElementById('account-list');
    if (accountList) {
      const item = accountList.querySelector(`[data-account-id="${accountId}"]`);
      if (item) {
        item.classList.toggle('selected', checked);
        const checkbox = item.querySelector('.selection-checkbox');
        if (checkbox) {
          checkbox.checked = checked;
        }
      }
    }
  }

  /**
   * Handle batch start all accounts
   * Starts accounts in list order (by order property ascending)
   */
  async function handleBatchStartAll() {
    if (!window.electronAPI) return;

    const state = getState();
    const render = getRender();
    const accounts = state.getAccounts();

    // Get accounts that are not running, sorted by order
    const notRunningAccounts = accounts
      .filter(acc => !acc.isRunning && acc.runningStatus !== 'loading')
      .sort((a, b) => {
        const orderA = a.order !== undefined ? a.order : 999;
        const orderB = b.order !== undefined ? b.order : 999;
        return orderA - orderB;
      });

    if (notRunningAccounts.length === 0) {
      console.log('[Sidebar] All accounts are already running');
      return;
    }

    console.log(`[Sidebar] Batch starting ${notRunningAccounts.length} accounts (in list order)...`);

    // Start accounts sequentially with a small delay between each
    for (const account of notRunningAccounts) {
      try {
        if (render.updateAccountRunningStatus) {
          render.updateAccountRunningStatus(account.id, 'loading');
        }
        await window.electronAPI.invoke('open-account', account.id);
        console.log(`[Sidebar] Started account ${account.id}`);
        // Small delay between account starts to avoid overwhelming the system
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        console.error(`[Sidebar] Failed to start account ${account.id}:`, error);
        if (render.updateAccountRunningStatus) {
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
    if (!window.electronAPI) return;

    const state = getState();
    const render = getRender();
    const accounts = state.getAccounts();
    const selectedIds = state.getSelectedAccountIds();

    if (selectedIds.size === 0) {
      console.log('[Sidebar] No selected accounts to start');
      return;
    }

    // Get selected accounts that are not running, sorted by order
    const selectedAccounts = accounts
      .filter(acc =>
        selectedIds.has(acc.id) && !acc.isRunning && acc.runningStatus !== 'loading'
      )
      .sort((a, b) => {
        const orderA = a.order !== undefined ? a.order : 999;
        const orderB = b.order !== undefined ? b.order : 999;
        return orderA - orderB;
      });

    if (selectedAccounts.length === 0) {
      console.log('[Sidebar] No selected accounts to start');
      return;
    }

    console.log(`[Sidebar] Batch starting ${selectedAccounts.length} selected accounts (in list order)...`);

    for (const account of selectedAccounts) {
      try {
        if (render.updateAccountRunningStatus) {
          render.updateAccountRunningStatus(account.id, 'loading');
        }
        await window.electronAPI.invoke('open-account', account.id);
        console.log(`[Sidebar] Started account ${account.id}`);
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        console.error(`[Sidebar] Failed to start account ${account.id}:`, error);
        if (render.updateAccountRunningStatus) {
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
    if (!window.electronAPI) return;

    const state = getState();
    const selectedIds = state.getSelectedAccountIds();

    if (selectedIds.size === 0) {
      console.log('[Sidebar] No selected accounts to delete');
      return;
    }

    const selectedCount = selectedIds.size;
    const confirmed = confirm(`确定要删除选中的 ${selectedCount} 个账号吗？\n\n这将删除账号配置但保留会话数据。`);

    if (!confirmed) return;

    console.log(`[Sidebar] Batch deleting ${selectedCount} accounts...`);

    const idsToDelete = [...selectedIds];
    for (const accountId of idsToDelete) {
      try {
        await window.electronAPI.invoke('delete-account', accountId);
        console.log(`[Sidebar] Deleted account ${accountId}`);
      } catch (error) {
        console.error(`[Sidebar] Failed to delete account ${accountId}:`, error);
      }
    }

    // Exit selection mode after operation
    toggleSelectionMode();
  }

  // Export functions
  const selectionExports = {
    toggleSelectionMode,
    selectAllAccounts,
    updateSelectionUI,
    handleCheckboxClick,
    handleBatchStartAll,
    handleBatchStartSelected,
    handleBatchDeleteSelected
  };

  // Export for CommonJS (Node.js/testing)
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = selectionExports;
  }

  // Export for browser (window object)
  if (typeof window !== 'undefined') {
    window.SidebarSelection = selectionExports;
  }
})();
