/**
 * Sidebar Entry File
 * Imports all sidebar modules and exposes the public API
 * 
 * This file serves as the main entry point for the sidebar component,
 * coordinating all sub-modules and maintaining backward compatibility
 * with the original window.sidebar API.
 * 
 * @module sidebar
 */

(function () {
  'use strict';

  // ============================================================================
  // Module Loading
  // ============================================================================

  /**
   * Wait for all modules to be loaded
   * Since modules are loaded via script tags, we need to ensure they're available
   */
  function waitForModules() {
    return new Promise((resolve) => {
      const checkModules = () => {
        if (
          window.SidebarState &&
          window.SidebarUtils &&
          window.SidebarRender &&
          window.SidebarEvents &&
          window.SidebarActions &&
          window.SidebarContextMenu &&
          window.SidebarSelection &&
          window.SidebarIPInfo &&
          window.SidebarToggle
        ) {
          resolve();
        } else {
          setTimeout(checkModules, 10);
        }
      };
      checkModules();
    });
  }

  // ============================================================================
  // Initialization
  // ============================================================================

  /**
   * Initialize the sidebar component
   * Sets up event listeners and loads initial account data
   */
  async function init() {
    try {
      // Wait for all modules to be loaded
      await waitForModules();

      console.log('[Sidebar] All modules loaded, initializing...');

      // Setup DOM event listeners for buttons
      setupDOMEventListeners();

      // Setup IPC event listeners
      if (window.SidebarEvents && typeof window.SidebarEvents.setupEventListeners === 'function') {
        window.SidebarEvents.setupEventListeners();
      }

      // Load initial account data
      if (window.SidebarActions && typeof window.SidebarActions.loadAccounts === 'function') {
        await window.SidebarActions.loadAccounts();
      }

      // Restore sidebar collapsed state
      if (window.SidebarToggle && typeof window.SidebarToggle.restoreSidebarState === 'function') {
        window.SidebarToggle.restoreSidebarState();
      }

      console.log('[Sidebar] Initialization complete');
    } catch (error) {
      console.error('[Sidebar] Initialization failed:', error);
      if (window.SidebarUtils && typeof window.SidebarUtils.showError === 'function') {
        window.SidebarUtils.showError('侧边栏初始化失败: ' + error.message);
      }
    }
  }

  /**
   * Setup DOM event listeners for sidebar buttons and inputs
   */
  function setupDOMEventListeners() {
    // Add account button
    const addAccountBtn = document.getElementById('add-account');
    if (addAccountBtn && window.SidebarActions) {
      addAccountBtn.addEventListener('click', window.SidebarActions.handleAddAccount);
    }

    // Search input with debounce
    const searchInput = document.getElementById('account-search');
    if (searchInput && window.SidebarState && window.SidebarRender) {
      let searchDebounceTimer = null;
      searchInput.addEventListener('input', (e) => {
        const filterQuery = e.target.value.trim().toLowerCase();
        window.SidebarState.setFilterQuery(filterQuery);
        
        // Debounce search to prevent excessive rerenders
        if (searchDebounceTimer) {
          clearTimeout(searchDebounceTimer);
        }
        searchDebounceTimer = setTimeout(() => {
          searchDebounceTimer = null;
          window.SidebarRender.renderAccountList();
        }, 150);
      });
    }

    // Sidebar toggle button
    const sidebarToggleBtn = document.getElementById('sidebar-toggle');
    if (sidebarToggleBtn && window.SidebarToggle) {
      sidebarToggleBtn.addEventListener('click', window.SidebarToggle.toggleSidebar);
    }

    // Batch start button
    const batchStartBtn = document.getElementById('batch-start');
    if (batchStartBtn && window.SidebarActions) {
      batchStartBtn.addEventListener('click', window.SidebarActions.handleBatchStartAll);
    }

    // Selection mode button
    const selectionModeBtn = document.getElementById('selection-mode-btn');
    if (selectionModeBtn && window.SidebarSelection) {
      selectionModeBtn.addEventListener('click', window.SidebarSelection.toggleSelectionMode);
    }

    // Selection action bar buttons
    const selectionActionBar = document.getElementById('selection-action-bar');
    if (selectionActionBar && window.SidebarSelection) {
      selectionActionBar.addEventListener('click', (e) => {
        const btn = e.target.closest('.selection-btn');
        if (!btn) return;
        
        const action = btn.dataset.action;
        switch (action) {
          case 'select-all':
            window.SidebarSelection.selectAllAccounts();
            break;
          case 'start-selected':
            window.SidebarSelection.handleBatchStartSelected();
            break;
          case 'delete-selected':
            window.SidebarSelection.handleBatchDeleteSelected();
            break;
          case 'cancel':
            window.SidebarSelection.toggleSelectionMode();
            break;
        }
      });
    }

    // Account list click event delegation (for account selection, actions, etc.)
    const accountList = document.getElementById('account-list');
    if (accountList) {
      // Click event for account selection and action buttons
      accountList.addEventListener('click', (e) => {
        const accountItem = e.target.closest('.account-item');
        if (!accountItem) return;

        const accountId = accountItem.dataset.accountId;
        if (!accountId) return;

        // Handle selection checkbox click
        if (e.target.classList.contains('selection-checkbox')) {
          if (window.SidebarSelection) {
            window.SidebarSelection.handleCheckboxClick(accountId, e.target.checked);
          }
          return;
        }

        // Handle action button clicks
        const actionBtn = e.target.closest('.action-btn');
        if (actionBtn && window.SidebarActions) {
          e.stopPropagation();
          
          if (actionBtn.classList.contains('start')) {
            window.SidebarActions.handleOpenAccount(accountId);
          } else if (actionBtn.classList.contains('stop')) {
            window.SidebarActions.handleCloseAccount(accountId);
          } else if (actionBtn.classList.contains('retry')) {
            window.SidebarActions.handleRetryAccount(accountId);
          }
          return;
        }

        // Handle phone number click (copy to clipboard)
        const phoneElement = e.target.closest('.account-phone');
        if (phoneElement && window.SidebarUtils) {
          e.stopPropagation();
          const phoneNumber = phoneElement.textContent;
          if (phoneNumber) {
            window.SidebarUtils.copyToClipboard(phoneNumber, phoneElement);
          }
          return;
        }

        // Handle environment icon click
        const envIcon = e.target.closest('.account-env-icon');
        if (envIcon && window.SidebarActions) {
          e.stopPropagation();
          window.SidebarActions.openEnvironmentPanel(accountId);
          return;
        }

        // In selection mode, toggle selection on item click
        if (window.SidebarState && window.SidebarState.isSelectionMode()) {
          if (window.SidebarSelection) {
            const isSelected = window.SidebarState.isAccountSelected(accountId);
            window.SidebarSelection.handleCheckboxClick(accountId, !isSelected);
          }
          return;
        }

        // Normal click - select account (switch to it)
        if (window.SidebarActions) {
          window.SidebarActions.handleAccountSelect(accountId);
        }
      });

      // Right-click context menu
      accountList.addEventListener('contextmenu', (e) => {
        const accountItem = e.target.closest('.account-item');
        if (!accountItem) return;

        const accountId = accountItem.dataset.accountId;
        if (!accountId) return;

        e.preventDefault();

        if (window.SidebarState && window.SidebarContextMenu) {
          const account = window.SidebarState.getAccountById(accountId);
          if (account) {
            window.SidebarContextMenu.handleContextMenu(e, account);
          }
        }
      });

      // Keyboard navigation (Enter/Space to select)
      accountList.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter' && e.key !== ' ') return;

        const accountItem = e.target.closest('.account-item');
        if (!accountItem) return;

        const accountId = accountItem.dataset.accountId;
        if (!accountId) return;

        e.preventDefault();

        // In selection mode, Enter/Space toggles selection
        if (window.SidebarState && window.SidebarState.isSelectionMode()) {
          if (window.SidebarSelection) {
            const isSelected = window.SidebarState.isAccountSelected(accountId);
            window.SidebarSelection.handleCheckboxClick(accountId, !isSelected);
          }
          return;
        }

        // Normal mode - select account
        if (window.SidebarActions) {
          window.SidebarActions.handleAccountSelect(accountId);
        }
      });
    }

    console.log('[Sidebar] DOM event listeners setup complete');
  }

  // ============================================================================
  // Public API (Backward Compatibility)
  // ============================================================================

  /**
   * Export the public sidebar API to window.sidebar
   * This maintains backward compatibility with code that depends on the original API
   */
  window.sidebar = {
    /**
     * Load accounts from the main process
     * @returns {Promise<void>}
     */
    loadAccounts: function () {
      if (window.SidebarActions && typeof window.SidebarActions.loadAccounts === 'function') {
        return window.SidebarActions.loadAccounts();
      }
      return Promise.resolve();
    },

    /**
     * Render the account list
     * @returns {Promise<void>}
     */
    renderAccountList: function () {
      if (window.SidebarRender && typeof window.SidebarRender.renderAccountList === 'function') {
        return window.SidebarRender.renderAccountList();
      }
      return Promise.resolve();
    },

    /**
     * Set the active account
     * @param {string} accountId - Account ID to set as active
     */
    setActiveAccount: function (accountId) {
      if (window.SidebarRender && typeof window.SidebarRender.setActiveAccount === 'function') {
        window.SidebarRender.setActiveAccount(accountId);
      }
    },

    /**
     * Get all accounts
     * @returns {Array<Object>} Array of account objects
     */
    getAccounts: function () {
      if (window.SidebarState && typeof window.SidebarState.getAccounts === 'function') {
        return window.SidebarState.getAccounts();
      }
      return [];
    },

    /**
     * Get the active account ID
     * @returns {string|null} Active account ID or null
     */
    getActiveAccountId: function () {
      if (window.SidebarState && typeof window.SidebarState.getActiveAccountId === 'function') {
        return window.SidebarState.getActiveAccountId();
      }
      return null;
    },

    /**
     * Render quick actions for an account
     * @param {Object} account - Account object
     * @param {HTMLElement} container - Container element for actions
     */
    renderQuickActions: function (account, container) {
      if (window.SidebarRender && typeof window.SidebarRender.renderQuickActions === 'function') {
        window.SidebarRender.renderQuickActions(account, container);
      }
    },

    /**
     * Synchronize account statuses with running status
     */
    syncAccountStatusesWithRunningStatus: function () {
      if (window.SidebarActions && typeof window.SidebarActions.syncAccountStatusesWithRunningStatus === 'function') {
        window.SidebarActions.syncAccountStatusesWithRunningStatus();
      }
    },

    /**
     * Toggle sidebar collapsed/expanded state
     */
    toggleSidebar: function () {
      if (window.SidebarToggle && typeof window.SidebarToggle.toggleSidebar === 'function') {
        window.SidebarToggle.toggleSidebar();
      }
    },

    /**
     * Toggle selection mode on/off
     */
    toggleSelectionMode: function () {
      if (window.SidebarSelection && typeof window.SidebarSelection.toggleSelectionMode === 'function') {
        window.SidebarSelection.toggleSelectionMode();
      }
    },

    /**
     * Start all accounts in batch
     * @returns {Promise<void>}
     */
    handleBatchStartAll: function () {
      if (window.SidebarSelection && typeof window.SidebarSelection.handleBatchStartAll === 'function') {
        return window.SidebarSelection.handleBatchStartAll();
      }
      return Promise.resolve();
    }
  };

  // ============================================================================
  // DOM Ready Initialization
  // ============================================================================

  /**
   * Initialize when DOM is ready
   */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    // DOM is already ready, initialize immediately
    init();
  }
})();
