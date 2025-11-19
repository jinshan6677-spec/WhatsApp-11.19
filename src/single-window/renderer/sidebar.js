/**
 * Sidebar component for account management
 * Handles account list rendering, selection, and CRUD operations
 */

(function() {
  'use strict';

  // State
  let accounts = [];
  let activeAccountId = null;

  // DOM elements
  const accountList = document.getElementById('account-list');
  const emptyState = document.getElementById('empty-state');
  const addAccountBtn = document.getElementById('add-account');

  // OPTIMIZATION: Debounce timers for high-frequency updates
  const updateTimers = new Map();
  const DEBOUNCE_DELAY = 100; // ms

  /**
   * Initialize the sidebar component
   */
  function init() {
    setupEventListeners();
    loadAccounts();
  }

  /**
   * Setup event listeners
   */
  function setupEventListeners() {
    // Add account button
    if (addAccountBtn) {
      addAccountBtn.addEventListener('click', handleAddAccount);
    }

    // Listen for account updates from main process
    if (window.electronAPI) {
      window.electronAPI.on('accounts-updated', handleAccountsUpdated);
      window.electronAPI.on('account-switched', handleAccountSwitched);
      window.electronAPI.on('account-status-changed', handleAccountStatusChanged);
      window.electronAPI.on('account:active-changed', handleActiveAccountChanged);
      
      // Listen for view manager events
      window.electronAPI.on('view-manager:view-loading', handleViewLoading);
      window.electronAPI.on('view-manager:view-ready', handleViewReady);
      window.electronAPI.on('view-manager:view-error', handleViewError);
      window.electronAPI.on('view-manager:login-status-changed', handleLoginStatusChanged);
      window.electronAPI.on('view-manager:view-crashed', handleViewCrashed);
      window.electronAPI.on('view-manager:connection-status-changed', handleConnectionStatusChanged);
      
      // Listen for manual account control events
      window.electronAPI.on('view-manager:account-opening', handleAccountOpening);
      window.electronAPI.on('view-manager:account-opened', handleAccountOpened);
      window.electronAPI.on('view-manager:account-open-failed', handleAccountOpenFailed);
      window.electronAPI.on('view-manager:account-closing', handleAccountClosing);
      window.electronAPI.on('view-manager:account-closed', handleAccountClosed);
      window.electronAPI.on('view-manager:account-close-failed', handleAccountCloseFailed);
    }
  }

  /**
   * Load accounts from main process
   */
  async function loadAccounts() {
    try {
      if (window.electronAPI) {
        const accountsData = await window.electronAPI.invoke('get-accounts');
        accounts = accountsData || [];
        
        // Get active account
        const activeResult = await window.electronAPI.invoke('account:get-active');
        if (activeResult && activeResult.success && activeResult.accountId) {
          activeAccountId = activeResult.accountId;
        }
        
        // Get running status for all accounts
        const statusResult = await window.electronAPI.invoke('get-all-account-statuses');
        if (statusResult && statusResult.success && statusResult.statuses) {
          // Merge status information into accounts
          accounts.forEach(account => {
            const statusInfo = statusResult.statuses[account.id];
            if (statusInfo) {
              account.runningStatus = statusInfo.status;
              account.isRunning = statusInfo.isRunning;
            }
          });
        }
        
        renderAccountList();
      }
    } catch (error) {
      console.error('Failed to load accounts:', error);
      showError('加载账号失败');
    }
  }

  /**
   * Render the account list
   * OPTIMIZED: Uses document fragment for batch DOM updates
   */
  async function renderAccountList() {
    // Clear existing items (except empty state)
    const existingItems = accountList.querySelectorAll('.account-item');
    existingItems.forEach(item => item.remove());

    // Show/hide empty state
    if (accounts.length === 0) {
      if (emptyState) {
        emptyState.classList.remove('hidden');
      }
      return;
    } else {
      if (emptyState) {
        emptyState.classList.add('hidden');
      }
    }

    // Get current running status for all accounts
    if (window.electronAPI) {
      try {
        const statusResult = await window.electronAPI.getAllAccountStatuses();
        if (statusResult && statusResult.success && statusResult.statuses) {
          // Update accounts with current running status
          // statusResult.statuses is an object: { 'account-id': { status, isRunning } }
          accounts.forEach(account => {
            const statusData = statusResult.statuses[account.id];
            if (statusData) {
              account.runningStatus = statusData.status;
              account.isRunning = statusData.isRunning;
            }
          });
        }
      } catch (error) {
        console.error('Failed to get account statuses:', error);
      }
    }

    // Sort accounts by order field
    const sortedAccounts = [...accounts].sort((a, b) => {
      const orderA = a.order !== undefined ? a.order : 999;
      const orderB = b.order !== undefined ? b.order : 999;
      return orderA - orderB;
    });

    // OPTIMIZATION: Use document fragment for batch DOM updates
    // This reduces reflows and improves performance with many accounts
    const fragment = document.createDocumentFragment();

    // Render each account
    sortedAccounts.forEach(account => {
      const accountItem = createAccountItem(account);
      fragment.appendChild(accountItem);
    });

    // Single DOM update
    accountList.appendChild(fragment);
  }

  /**
   * Create an account item element
   */
  function createAccountItem(account) {
    const item = document.createElement('div');
    item.className = 'account-item';
    item.dataset.accountId = account.id;
    item.setAttribute('tabindex', '0');
    item.setAttribute('role', 'button');
    item.setAttribute('aria-label', `切换到 ${account.name}`);

    // Mark as active if this is the active account
    if (account.id === activeAccountId) {
      item.classList.add('active');
    }

    // Create avatar with first letter of account name
    const avatar = document.createElement('div');
    avatar.className = 'account-avatar';
    avatar.textContent = getAccountInitial(account.name);
    avatar.style.background = getAccountColor(account.id);

    // Create account info section
    const info = document.createElement('div');
    info.className = 'account-info';

    const name = document.createElement('div');
    name.className = 'account-name';
    name.textContent = account.name || '未命名账号';
    name.title = account.name || '未命名账号';

    // Add note if available
    if (account.note) {
      const note = document.createElement('div');
      note.className = 'account-note';
      note.textContent = account.note;
      note.title = account.note;
      info.appendChild(name);
      info.appendChild(note);
    } else {
      info.appendChild(name);
    }

    // Add status indicator
    const status = document.createElement('div');
    const statusValue = account.connectionStatus || account.status || 'offline';
    const loginStatus = account.loginStatus !== undefined ? account.loginStatus : null;
    
    status.className = `account-status ${statusValue}`;
    
    // Set status text and tooltip based on login and connection status
    if (loginStatus === false && statusValue === 'offline') {
      // Not logged in - show login prompt
      status.textContent = '需要登录';
      status.title = '点击扫描二维码登录';
      status.classList.add('login-required');
    } else {
      status.textContent = getStatusText(statusValue);
      
      // Set tooltip based on connection status
      if (account.connectionError) {
        status.title = `错误: ${account.connectionError.message || '未知错误'}`;
      } else if (statusValue === 'online') {
        status.title = '已连接并登录';
      } else if (statusValue === 'offline') {
        status.title = '未连接';
      } else if (statusValue === 'loading') {
        status.title = '加载中...';
      }
    }
    
    info.appendChild(status);

    // Create actions section
    const actions = document.createElement('div');
    actions.className = 'account-actions';

    // Determine account running status
    const runningStatus = account.runningStatus || 'not_started';
    const isRunning = account.isRunning || false;

    // Add open/close button based on running status
    if (runningStatus === 'not_started' || !isRunning) {
      // Show open button
      const openBtn = document.createElement('button');
      openBtn.className = 'open-btn';
      openBtn.innerHTML = '<span class="icon">▶</span><span class="text">打开</span>';
      openBtn.title = '打开账号';
      openBtn.setAttribute('aria-label', '打开账号');
      openBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        handleOpenAccount(account.id);
      });
      actions.appendChild(openBtn);
    } else if (runningStatus === 'loading') {
      // Show loading indicator
      const loadingIndicator = document.createElement('div');
      loadingIndicator.className = 'loading-indicator';
      loadingIndicator.innerHTML = '<span class="spinner"></span><span class="text">加载中...</span>';
      actions.appendChild(loadingIndicator);
    } else if (runningStatus === 'connected' || isRunning) {
      // Show close button
      const closeBtn = document.createElement('button');
      closeBtn.className = 'close-btn';
      closeBtn.innerHTML = '<span class="icon">⏹</span><span class="text">关闭</span>';
      closeBtn.title = '关闭账号';
      closeBtn.setAttribute('aria-label', '关闭账号');
      closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        handleCloseAccount(account.id);
      });
      actions.appendChild(closeBtn);
    } else if (runningStatus === 'error') {
      // Show retry button
      const retryBtn = document.createElement('button');
      retryBtn.className = 'retry-btn';
      retryBtn.innerHTML = '<span class="icon">⟳</span><span class="text">重试</span>';
      retryBtn.title = '重试打开账号';
      retryBtn.setAttribute('aria-label', '重试打开账号');
      retryBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        handleRetryAccount(account.id);
      });
      actions.appendChild(retryBtn);
    }

    const editBtn = document.createElement('button');
    editBtn.className = 'edit-btn';
    editBtn.innerHTML = '⚙️';
    editBtn.title = '编辑账号';
    editBtn.setAttribute('aria-label', '编辑账号');
    editBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      handleEditAccount(account.id);
    });

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'delete-btn';
    deleteBtn.innerHTML = '🗑️';
    deleteBtn.title = '删除账号';
    deleteBtn.setAttribute('aria-label', '删除账号');
    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      handleDeleteAccount(account.id);
    });

    actions.appendChild(editBtn);
    actions.appendChild(deleteBtn);

    // Assemble the item
    item.appendChild(avatar);
    item.appendChild(info);
    item.appendChild(actions);

    // Add click handler for account selection
    item.addEventListener('click', () => handleAccountSelect(account.id));
    
    // Add keyboard support
    item.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleAccountSelect(account.id);
      }
    });

    return item;
  }

  /**
   * Get the first letter of account name for avatar
   */
  function getAccountInitial(name) {
    if (!name) return '?';
    return name.charAt(0).toUpperCase();
  }

  /**
   * Generate a consistent color for an account based on its ID
   */
  function getAccountColor(accountId) {
    const colors = [
      'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
      'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
      'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
      'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
      'linear-gradient(135deg, #30cfd0 0%, #330867 100%)',
      'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)',
      'linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)',
      'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)',
      'linear-gradient(135deg, #ff6e7f 0%, #bfe9ff 100%)'
    ];

    // Use account ID to consistently select a color
    let hash = 0;
    for (let i = 0; i < accountId.length; i++) {
      hash = accountId.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % colors.length;
    return colors[index];
  }

  /**
   * Get human-readable status text
   */
  function getStatusText(status) {
    const statusMap = {
      online: '在线',
      offline: '离线',
      error: '错误',
      loading: '加载中...'
    };
    return statusMap[status] || '未知';
  }

  /**
   * Handle account selection
   */
  async function handleAccountSelect(accountId) {
    if (accountId === activeAccountId) {
      return; // Already active
    }

    try {
      // Check if account is running
      const accountStatus = await window.electronAPI.getAccountStatus(accountId);
      
      if (!accountStatus || !accountStatus.isRunning) {
        // Account is not running, don't switch
        console.log('Account is not running, cannot switch');
        return;
      }

      // Update UI immediately for responsiveness
      setActiveAccount(accountId);

      // Send switch request to main process
      if (window.electronAPI) {
        await window.electronAPI.invoke('switch-account', accountId);
      }
    } catch (error) {
      console.error('Failed to switch account:', error);
      showError('切换账号失败');
      // Revert UI change
      setActiveAccount(activeAccountId);
    }
  }

  /**
   * Set the active account in the UI
   */
  function setActiveAccount(accountId) {
    activeAccountId = accountId;

    // Update active class on all items
    const items = accountList.querySelectorAll('.account-item');
    items.forEach(item => {
      if (item.dataset.accountId === accountId) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });
  }

  /**
   * Handle add account button click - Quick add with default settings
   */
  async function handleAddAccount() {
    try {
      if (!window.electronAPI) {
        showError('无法连接到主进程');
        return;
      }

      // Generate default account name
      const defaultAccountName = generateDefaultAccountName();

      // Default account configuration
      const defaultConfig = {
        name: defaultAccountName,
        note: '',
        autoStart: false,
        proxy: {
          enabled: false,
          protocol: 'http',
          host: '',
          port: 0,
          username: '',
          password: '',
          bypass: ''
        },
        translation: {
          enabled: true,
          engine: 'google',
          targetLanguage: 'zh-CN',
          autoTranslate: false,
          translateInput: false,
          friendSettings: {}
        }
      };

      // Create account directly
      const result = await window.electronAPI.invoke('create-account', defaultConfig);

      if (result.success) {
        console.log('Account created successfully:', result.account);
        // Account list will be updated via 'accounts-updated' event
      } else {
        const errorMessage = result.errors ? result.errors.join(', ') : '创建账号失败';
        showError(errorMessage);
      }
    } catch (error) {
      console.error('Failed to create account:', error);
      showError(`创建账号失败: ${error.message}`);
    }
  }

  /**
   * Generate default account name in format "账号 N"
   */
  function generateDefaultAccountName() {
    const existingNames = accounts.map(acc => acc.name);
    let counter = 1;
    let defaultName = `账号 ${counter}`;

    while (existingNames.includes(defaultName)) {
      counter++;
      defaultName = `账号 ${counter}`;
    }

    return defaultName;
  }

  /**
   * Handle edit account button click
   */
  function handleEditAccount(accountId) {
    if (window.electronAPI) {
      window.electronAPI.send('account:edit', accountId);
    }
  }

  /**
   * Handle delete account button click
   */
  async function handleDeleteAccount(accountId) {
    const account = accounts.find(acc => acc.id === accountId);
    const accountName = account ? account.name : '此账号';

    // Confirm deletion
    const confirmed = confirm(`确定要删除账号"${accountName}"吗？\n\n这将删除账号配置但保留会话数据。`);
    
    if (!confirmed) {
      return;
    }

    try {
      if (window.electronAPI) {
        await window.electronAPI.invoke('delete-account', accountId);
        // Account list will be updated via 'accounts-updated' event
      }
    } catch (error) {
      console.error('Failed to delete account:', error);
      showError('删除账号失败');
    }
  }

  /**
   * Handle open account button click
   */
  async function handleOpenAccount(accountId) {
    try {
      // Update UI immediately to show loading state
      updateAccountRunningStatus(accountId, 'loading');

      if (window.electronAPI) {
        const result = await window.electronAPI.invoke('open-account', accountId);
        
        if (!result.success) {
          throw new Error(result.error || '打开账号失败');
        }

        // Success - UI will be updated via events
        console.log(`Account ${accountId} opened successfully`);
      }
    } catch (error) {
      console.error('Failed to open account:', error);
      updateAccountRunningStatus(accountId, 'error');
      showError(`打开账号失败: ${error.message}`);
    }
  }

  /**
   * Handle close account button click
   */
  async function handleCloseAccount(accountId) {
    try {
      // Update UI immediately to show loading state
      updateAccountRunningStatus(accountId, 'loading');

      if (window.electronAPI) {
        const result = await window.electronAPI.invoke('close-account', accountId);
        
        if (!result.success) {
          throw new Error(result.error || '关闭账号失败');
        }

        // Success - UI will be updated via events
        console.log(`Account ${accountId} closed successfully`);
      }
    } catch (error) {
      console.error('Failed to close account:', error);
      updateAccountRunningStatus(accountId, 'error');
      showError(`关闭账号失败: ${error.message}`);
    }
  }

  /**
   * Handle retry account button click (after error)
   */
  async function handleRetryAccount(accountId) {
    // Retry is the same as opening
    await handleOpenAccount(accountId);
  }

  /**
   * Update account running status in UI
   * OPTIMIZED: Only updates the action buttons, not the entire item
   */
  function updateAccountRunningStatus(accountId, runningStatus) {
    // Update the account in our local state
    const account = accounts.find(acc => acc.id === accountId);
    if (account) {
      account.runningStatus = runningStatus;
      account.isRunning = runningStatus !== 'not_started' && runningStatus !== 'error';
    }

    // Find the account item
    const item = accountList.querySelector(`[data-account-id="${accountId}"]`);
    if (!item || !account) {
      return;
    }

    // Find the actions container
    const actions = item.querySelector('.account-actions');
    if (!actions) {
      return;
    }

    // Clear existing actions
    actions.innerHTML = '';

    // Add appropriate button based on running status
    if (runningStatus === 'not_started' || !account.isRunning) {
      // Show open button
      const openBtn = document.createElement('button');
      openBtn.className = 'open-btn';
      openBtn.innerHTML = '<span class="icon">▶</span><span class="text">打开</span>';
      openBtn.title = '打开账号';
      openBtn.setAttribute('aria-label', '打开账号');
      openBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        handleOpenAccount(account.id);
      });
      actions.appendChild(openBtn);
    } else if (runningStatus === 'loading') {
      // Show loading indicator
      const loadingIndicator = document.createElement('div');
      loadingIndicator.className = 'loading-indicator';
      loadingIndicator.innerHTML = '<span class="spinner"></span><span class="text">加载中...</span>';
      actions.appendChild(loadingIndicator);
    } else if (runningStatus === 'connected' || account.isRunning) {
      // Show close button
      const closeBtn = document.createElement('button');
      closeBtn.className = 'close-btn';
      closeBtn.innerHTML = '<span class="icon">⏹</span><span class="text">关闭</span>';
      closeBtn.title = '关闭账号';
      closeBtn.setAttribute('aria-label', '关闭账号');
      closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        handleCloseAccount(account.id);
      });
      actions.appendChild(closeBtn);
    } else if (runningStatus === 'error') {
      // Show retry button
      const retryBtn = document.createElement('button');
      retryBtn.className = 'retry-btn';
      retryBtn.innerHTML = '<span class="icon">⟳</span><span class="text">重试</span>';
      retryBtn.title = '重试打开账号';
      retryBtn.setAttribute('aria-label', '重试打开账号');
      retryBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        handleRetryAccount(account.id);
      });
      actions.appendChild(retryBtn);
    }

    // Re-add edit and delete buttons
    const editBtn = document.createElement('button');
    editBtn.className = 'edit-btn';
    editBtn.innerHTML = '⚙️';
    editBtn.title = '编辑账号';
    editBtn.setAttribute('aria-label', '编辑账号');
    editBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      handleEditAccount(account.id);
    });

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'delete-btn';
    deleteBtn.innerHTML = '🗑️';
    deleteBtn.title = '删除账号';
    deleteBtn.setAttribute('aria-label', '删除账号');
    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      handleDeleteAccount(account.id);
    });

    actions.appendChild(editBtn);
    actions.appendChild(deleteBtn);
  }

  /**
   * Handle accounts updated event from main process
   * OPTIMIZED: Debounces rapid updates to avoid excessive re-renders
   */
  function handleAccountsUpdated(accountsData) {
    accounts = accountsData || [];
    
    // OPTIMIZATION: Debounce rapid account list updates
    if (updateTimers.has('accountList')) {
      clearTimeout(updateTimers.get('accountList'));
    }
    
    updateTimers.set('accountList', setTimeout(() => {
      renderAccountList();
      updateTimers.delete('accountList');
    }, DEBOUNCE_DELAY));
  }

  /**
   * Handle account switched event from main process
   */
  function handleAccountSwitched(accountId) {
    setActiveAccount(accountId);
  }

  /**
   * Handle active account changed event from main process
   */
  function handleActiveAccountChanged(data) {
    const { accountId } = data;
    setActiveAccount(accountId);
  }

  /**
   * Handle account status changed event from main process
   */
  function handleAccountStatusChanged(data) {
    const { accountId, status } = data;
    
    // Update the account in our local state
    const account = accounts.find(acc => acc.id === accountId);
    if (account) {
      account.status = status;
    }

    // Update the status indicator in the UI
    const item = accountList.querySelector(`[data-account-id="${accountId}"]`);
    if (item) {
      const statusElement = item.querySelector('.account-status');
      if (statusElement) {
        statusElement.className = `account-status ${status}`;
        statusElement.textContent = getStatusText(status);
      }
    }
  }

  /**
   * Handle view loading event
   */
  function handleViewLoading(data) {
    const { accountId } = data;
    console.log(`[Sidebar] handleViewLoading for ${accountId}`);
    updateAccountStatus(accountId, 'loading');
  }

  /**
   * Handle view ready event
   */
  function handleViewReady(data) {
    const { accountId, loginStatus, connectionStatus } = data;
    
    console.log(`[Sidebar] handleViewReady for ${accountId}:`, { loginStatus, connectionStatus });
    
    // Update status based on connection status if available, otherwise use login state
    if (connectionStatus) {
      updateAccountStatus(accountId, connectionStatus);
    } else if (loginStatus) {
      updateAccountStatus(accountId, 'online');
    } else {
      updateAccountStatus(accountId, 'offline');
    }
  }

  /**
   * Handle view error event
   */
  function handleViewError(data) {
    const { accountId, error } = data;
    updateAccountStatus(accountId, 'error');
    
    // Show error details in console
    console.error(`View error for account ${accountId}:`, error);
    
    // Add error indicator to account item
    const item = accountList.querySelector(`[data-account-id="${accountId}"]`);
    if (item) {
      const statusElement = item.querySelector('.account-status');
      if (statusElement && error) {
        statusElement.title = `Error: ${error.message || 'Unknown error'}`;
      }
    }
  }

  /**
   * Handle login status changed event
   */
  function handleLoginStatusChanged(data) {
    const { accountId, isLoggedIn, hasQRCode, loginInfo } = data;
    
    console.log(`[Sidebar] handleLoginStatusChanged for ${accountId}:`, { isLoggedIn, hasQRCode, loginInfo });
    
    // Update the account in our local state
    const account = accounts.find(acc => acc.id === accountId);
    if (account) {
      account.loginStatus = isLoggedIn;
      account.hasQRCode = hasQRCode;
      account.loginInfo = loginInfo;
    }
    
    // Update status based on login state
    if (isLoggedIn) {
      updateAccountStatus(accountId, 'online');
    } else if (hasQRCode) {
      updateAccountStatus(accountId, 'offline');
    }
    // Don't update status if both are false - keep current status (loading)
    
    // Update account item to show login status
    const item = accountList.querySelector(`[data-account-id="${accountId}"]`);
    if (item) {
      const statusElement = item.querySelector('.account-status');
      if (statusElement) {
        if (hasQRCode) {
          // Show login required prompt
          statusElement.textContent = '需要登录';
          statusElement.title = '点击扫描二维码登录';
          statusElement.classList.add('login-required');
          statusElement.classList.remove('online', 'error', 'loading');
          statusElement.classList.add('offline');
        } else if (isLoggedIn) {
          // Show logged in status
          statusElement.textContent = '在线';
          statusElement.title = '已连接并登录';
          statusElement.classList.remove('login-required', 'offline', 'error', 'loading');
          statusElement.classList.add('online');
        } else {
          // Loading or unclear status - only update if not already showing a definitive status
          const currentClasses = statusElement.classList;
          if (!currentClasses.contains('online') && !currentClasses.contains('login-required')) {
            statusElement.textContent = '加载中...';
            statusElement.title = '加载中...';
            statusElement.classList.remove('login-required', 'online', 'error', 'offline');
            statusElement.classList.add('loading');
          }
        }
      }
    }
  }

  /**
   * Handle view crashed event
   */
  function handleViewCrashed(data) {
    const { accountId, error } = data;
    updateAccountStatus(accountId, 'error');
    
    console.error(`View crashed for account ${accountId}:`, error);
    
    // Show error message to user
    showError(`账号"${getAccountName(accountId)}"已崩溃，请重新加载。`);
  }

  /**
   * Handle connection status changed event
   */
  function handleConnectionStatusChanged(data) {
    const { accountId, connectionStatus, error, details, isLoggedIn, hasQRCode } = data;
    
    console.log(`[Sidebar] handleConnectionStatusChanged for ${accountId}:`, { connectionStatus, isLoggedIn, hasQRCode, details });
    
    // Update the account in our local state
    const account = accounts.find(acc => acc.id === accountId);
    if (account) {
      account.connectionStatus = connectionStatus;
      if (isLoggedIn !== undefined) {
        account.loginStatus = isLoggedIn;
      }
      if (hasQRCode !== undefined) {
        account.hasQRCode = hasQRCode;
      }
    }
    
    // Update account status in UI
    updateAccountStatus(accountId, connectionStatus);
    
    // Update status element with additional details
    const item = accountList.querySelector(`[data-account-id="${accountId}"]`);
    if (item) {
      const statusElement = item.querySelector('.account-status');
      if (statusElement) {
        // Set text and tooltip based on connection details and login status
        if (connectionStatus === 'online') {
          statusElement.textContent = '在线';
          statusElement.title = '已连接并登录';
          statusElement.classList.remove('login-required', 'offline', 'error');
          statusElement.classList.add('online');
        } else if (connectionStatus === 'offline') {
          if (hasQRCode || (details && details.needsQRScan)) {
            // Show login required prompt
            statusElement.textContent = '需要登录';
            statusElement.title = '点击扫描二维码登录';
            statusElement.classList.add('login-required');
            statusElement.classList.remove('online', 'error');
          } else if (details && details.phoneDisconnected) {
            statusElement.textContent = '离线';
            statusElement.title = '手机未连接';
            statusElement.classList.remove('login-required', 'online', 'error');
          } else if (details && details.loading) {
            statusElement.textContent = '加载中...';
            statusElement.title = '加载中...';
            statusElement.classList.remove('login-required', 'online', 'error');
          } else {
            statusElement.textContent = '离线';
            statusElement.title = '未连接';
            statusElement.classList.remove('login-required', 'online', 'error');
          }
        } else if (connectionStatus === 'error') {
          const errorMsg = error ? error.message : '连接错误';
          statusElement.textContent = '错误';
          statusElement.title = `错误: ${errorMsg}`;
          statusElement.classList.remove('login-required', 'online', 'offline');
          statusElement.classList.add('error');
        }
      }
    }
    
    // Log connection status change
    console.log(`Connection status changed for account ${accountId}:`, connectionStatus, details);
  }

  /**
   * Update account status in UI
   * OPTIMIZED: Updates only the specific element, avoiding full re-render
   */
  function updateAccountStatus(accountId, status) {
    // Update the account in our local state
    const account = accounts.find(acc => acc.id === accountId);
    if (account) {
      account.status = status;
    }

    // OPTIMIZATION: Update only the specific status element
    // This avoids re-rendering the entire list
    const item = accountList.querySelector(`[data-account-id="${accountId}"]`);
    if (item) {
      const statusElement = item.querySelector('.account-status');
      if (statusElement) {
        // Use classList for better performance than className replacement
        statusElement.classList.remove('online', 'offline', 'error', 'loading');
        statusElement.classList.add(status);
        statusElement.textContent = getStatusText(status);
      }
    }
  }

  /**
   * Get account name by ID
   */
  function getAccountName(accountId) {
    const account = accounts.find(acc => acc.id === accountId);
    return account ? account.name : '未知账号';
  }

  /**
   * Handle account opening event
   */
  function handleAccountOpening(data) {
    const { accountId } = data;
    updateAccountRunningStatus(accountId, 'loading');
  }

  /**
   * Handle account opened event
   */
  function handleAccountOpened(data) {
    const { accountId } = data;
    updateAccountRunningStatus(accountId, 'connected');
  }

  /**
   * Handle account open failed event
   */
  function handleAccountOpenFailed(data) {
    const { accountId, error } = data;
    updateAccountRunningStatus(accountId, 'error');
    showError(`打开账号失败: ${error}`);
  }

  /**
   * Handle account closing event
   */
  function handleAccountClosing(data) {
    const { accountId } = data;
    updateAccountRunningStatus(accountId, 'loading');
  }

  /**
   * Handle account closed event
   */
  function handleAccountClosed(data) {
    const { accountId } = data;
    updateAccountRunningStatus(accountId, 'not_started');
  }

  /**
   * Handle account close failed event
   */
  function handleAccountCloseFailed(data) {
    const { accountId, error } = data;
    updateAccountRunningStatus(accountId, 'error');
    showError(`关闭账号失败: ${error}`);
  }

  /**
   * Show error message to user
   */
  function showError(message) {
    // Simple error display - could be enhanced with a toast/notification system
    console.error(message);
    alert(message);
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Export for testing or external access
  window.sidebar = {
    loadAccounts,
    renderAccountList,
    setActiveAccount,
    getAccounts: () => accounts,
    getActiveAccountId: () => activeAccountId
  };

})();
