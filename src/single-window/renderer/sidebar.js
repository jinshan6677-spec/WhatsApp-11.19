/**
 * Sidebar component for account management
 * Handles account list rendering, selection, and CRUD operations
 *
 * 设计目标：
 * - KISS：集中管理账号状态和视图渲染，避免散落的 DOM 操作
 * - DRY：账号行的操作按钮和状态展示只实现一份渲染逻辑
 * - 单一职责：事件 -> 更新内存状态 -> 渲染 UI
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

  // Debounce for high-frequency updates (e.g. accounts-updated)
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

      // View manager events（登录/连接状态）
      window.electronAPI.on('view-manager:view-loading', handleViewLoading);
      window.electronAPI.on('view-manager:view-ready', handleViewReady);
      window.electronAPI.on('view-manager:view-error', handleViewError);
      window.electronAPI.on('view-manager:login-status-changed', handleLoginStatusChanged);
      window.electronAPI.on('view-manager:view-crashed', handleViewCrashed);
      window.electronAPI.on('view-manager:connection-status-changed', handleConnectionStatusChanged);

      // Manual account control events（打开/关闭账号）
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
    if (!window.electronAPI || !accountList) return;

    try {
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
        mergeRunningStatuses(statusResult.statuses);
      }

      await renderAccountList();
    } catch (error) {
      console.error('Failed to load accounts:', error);
      showError('加载账号失败');
    }
  }

  /**
   * Merge running status info into current accounts
   */
  function mergeRunningStatuses(statuses) {
    accounts.forEach((account) => {
      const statusInfo = statuses[account.id];
      if (statusInfo) {
        account.runningStatus = statusInfo.status;
        account.isRunning = !!statusInfo.isRunning;
      }
    });
  }

  /**
   * Render the account list
   * 使用 document fragment 做批量更新，减少重排
   */
  async function renderAccountList() {
    if (!accountList) return;

    // Clear existing items
    const existingItems = accountList.querySelectorAll('.account-item');
    existingItems.forEach((item) => item.remove());

    // Show/hide empty state
    if (accounts.length === 0) {
      if (emptyState) {
        emptyState.classList.remove('hidden');
      }
      return;
    }

    if (emptyState) {
      emptyState.classList.add('hidden');
    }

    // Ensure running status is up-to-date
    if (window.electronAPI) {
      try {
        const statusResult = await window.electronAPI.getAllAccountStatuses();
        if (statusResult && statusResult.success && statusResult.statuses) {
          mergeRunningStatuses(statusResult.statuses);
        }
      } catch (error) {
        console.error('Failed to get account statuses:', error);
      }
    }

    // Sort accounts by order
    const sortedAccounts = [...accounts].sort((a, b) => {
      const orderA = a.order !== undefined ? a.order : 999;
      const orderB = b.order !== undefined ? b.order : 999;
      return orderA - orderB;
    });

    const fragment = document.createDocumentFragment();

    sortedAccounts.forEach((account) => {
      const accountItem = createAccountItem(account);
      fragment.appendChild(accountItem);
    });

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

    if (account.id === activeAccountId) {
      item.classList.add('active');
    }

    // Avatar
    const avatar = document.createElement('div');
    avatar.className = 'account-avatar';
    avatar.textContent = getAccountInitial(account.name);
    avatar.style.background = getAccountColor(account.id);

    // Info
    const info = document.createElement('div');
    info.className = 'account-info';

    const name = document.createElement('div');
    name.className = 'account-name';
    name.textContent = account.name || '未命名账号';
    name.title = account.name || '未命名账号';

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

    // Status
    const status = document.createElement('div');
    status.className = 'account-status';
    renderAccountStatusForAccount(account, status);
    info.appendChild(status);

    // Actions
    const actions = document.createElement('div');
    actions.className = 'account-actions';
    renderAccountActions(account, actions);

    // Assemble
    item.appendChild(avatar);
    item.appendChild(info);
    item.appendChild(actions);

    // Selection handlers
    item.addEventListener('click', () => handleAccountSelect(account.id));
    item.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleAccountSelect(account.id);
      }
    });

    return item;
  }

  /**
   * 渲染账号的状态展示（文本 + class + tooltip）
   * 统一处理 loginStatus / connectionStatus / hasQRCode / error 等字段
   */
  function renderAccountStatusForAccount(account, statusElement) {
    if (!statusElement || !account) return;

    // 基础 class
    statusElement.className = 'account-status';

    // 派生状态值：逻辑状态优先于连接状态
    const statusValue = account.status || account.connectionStatus || 'offline';
    const loginStatus = account.loginStatus;
    const hasQRCode = account.hasQRCode;
    const details = account.connectionDetails;
    const error = account.connectionError;

    // 清理额外状态 class
    statusElement.classList.remove('online', 'offline', 'error', 'loading', 'login-required');

    // 登录相关特殊处理
    if (
      statusValue === 'offline' &&
      (loginStatus === false || hasQRCode || (details && details.needsQRScan))
    ) {
      statusElement.classList.add('offline', 'login-required');
      statusElement.textContent = '需要登录';
      statusElement.title = '点击扫描二维码登录';
      return;
    }

    if (statusValue === 'online') {
      statusElement.classList.add('online');
      statusElement.textContent = '在线';
      statusElement.title = '已连接并登录';
      return;
    }

    if (statusValue === 'loading') {
      statusElement.classList.add('loading');
      statusElement.textContent = '加载中...';
      statusElement.title = '加载中...';
      return;
    }

    if (statusValue === 'error') {
      statusElement.classList.add('error');
      const msg = (error && error.message) || '连接错误';
      statusElement.textContent = '错误';
      statusElement.title = `错误: ${msg}`;
      return;
    }

    // 默认离线态
    statusElement.classList.add('offline');
    statusElement.textContent = '离线';

    if (details && details.phoneDisconnected) {
      statusElement.title = '手机未连接';
    } else {
      statusElement.title = '未连接';
    }
  }

  /**
   * 渲染账号的操作按钮（打开 / 关闭 / 重试 + 编辑 / 删除）
   * DRY：用于首屏渲染和运行状态更新
   */
  function renderAccountActions(account, actions) {
    if (!actions || !account) return;

    actions.innerHTML = '';

    const runningStatus = account.runningStatus || 'not_started';
    const isRunning = !!account.isRunning;

    if (runningStatus === 'not_started' || !isRunning) {
      // 打开
      const openBtn = document.createElement('button');
      openBtn.className = 'open-btn';
      openBtn.innerHTML = '<span class="icon">➕</span><span class="text">打开</span>';
      openBtn.title = '打开账号';
      openBtn.setAttribute('aria-label', '打开账号');
      openBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        handleOpenAccount(account.id);
      });
      actions.appendChild(openBtn);
    } else if (runningStatus === 'loading') {
      // 加载中
      const loadingIndicator = document.createElement('div');
      loadingIndicator.className = 'loading-indicator';
      loadingIndicator.innerHTML =
        '<span class="spinner"></span><span class="text">加载中...</span>';
      actions.appendChild(loadingIndicator);
    } else if (runningStatus === 'connected' || isRunning) {
      // 关闭
      const closeBtn = document.createElement('button');
      closeBtn.className = 'close-btn';
      closeBtn.innerHTML = '<span class="icon">✖</span><span class="text">关闭</span>';
      closeBtn.title = '关闭账号';
      closeBtn.setAttribute('aria-label', '关闭账号');
      closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        handleCloseAccount(account.id);
      });
      actions.appendChild(closeBtn);
    } else if (runningStatus === 'error') {
      // 重试
      const retryBtn = document.createElement('button');
      retryBtn.className = 'retry-btn';
      retryBtn.innerHTML = '<span class="icon">↻</span><span class="text">重试</span>';
      retryBtn.title = '重试打开账号';
      retryBtn.setAttribute('aria-label', '重试打开账号');
      retryBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        handleRetryAccount(account.id);
      });
      actions.appendChild(retryBtn);
    }

    // 通用编辑按钮
    const editBtn = document.createElement('button');
    editBtn.className = 'edit-btn';
    editBtn.innerHTML = '⚙️';
    editBtn.title = '编辑账号';
    editBtn.setAttribute('aria-label', '编辑账号');
    editBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      handleEditAccount(account.id);
    });

    // 通用删除按钮
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
   * Get the first letter of account name for avatar
   */
  function getAccountInitial(name) {
    if (!name) return '?';
    return String(name).charAt(0).toUpperCase();
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

    if (!accountId) {
      return colors[0];
    }

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
    if (!window.electronAPI) return;
    if (accountId === activeAccountId) {
      return;
    }

    try {
      const accountStatus = await window.electronAPI.getAccountStatus(accountId);
      if (!accountStatus || !accountStatus.isRunning) {
        console.log('Account is not running, cannot switch');
        return;
      }

      // Optimistic UI
      setActiveAccount(accountId);

      await window.electronAPI.invoke('switch-account', accountId);
    } catch (error) {
      console.error('Failed to switch account:', error);
      showError('切换账号失败');
      setActiveAccount(activeAccountId);
    }
  }

  /**
   * Set the active account in the UI
   */
  function setActiveAccount(accountId) {
    activeAccountId = accountId;

    if (!accountList) return;

    const items = accountList.querySelectorAll('.account-item');
    items.forEach((item) => {
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
    if (!window.electronAPI) {
      showError('无法连接到主进程');
      return;
    }

    try {
      const defaultAccountName = generateDefaultAccountName();

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

      const result = await window.electronAPI.invoke('create-account', defaultConfig);
      if (result && result.success) {
        console.log('Account created successfully:', result.account);
        // 列表会通过 accounts-updated 事件刷新
      } else {
        const errorMessage = result && result.errors ? result.errors.join(', ') : '创建账号失败';
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
    const existingNames = accounts.map((acc) => acc.name);
    let counter = 1;
    let defaultName = `账号 ${counter}`;

    while (existingNames.includes(defaultName)) {
      counter += 1;
      defaultName = `账号 ${counter}`;
    }

    return defaultName;
  }

  /**
   * Handle edit account button click
   */
  function handleEditAccount(accountId) {
    if (!window.electronAPI) return;
    window.electronAPI.send('account:edit', accountId);
  }

  /**
   * Handle delete account button click
   */
  async function handleDeleteAccount(accountId) {
    if (!window.electronAPI) return;

    const account = accounts.find((acc) => acc.id === accountId);
    const accountName = account ? account.name : '此账号';

    const confirmed = confirm(
      `确定要删除账号 "${accountName}" 吗？\n\n这将删除账号配置但保留会话数据。`
    );

    if (!confirmed) return;

    try {
      await window.electronAPI.invoke('delete-account', accountId);
      // 列表会通过 accounts-updated 事件刷新
    } catch (error) {
      console.error('Failed to delete account:', error);
      showError('删除账号失败');
    }
  }

  /**
   * Handle open account button click
   */
  async function handleOpenAccount(accountId) {
    if (!window.electronAPI) return;

    try {
      updateAccountRunningStatus(accountId, 'loading');

      const result = await window.electronAPI.invoke('open-account', accountId);
      if (!result || !result.success) {
        throw new Error((result && result.error) || '打开账号失败');
      }

      console.log(`Account ${accountId} opened successfully`);
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
    if (!window.electronAPI) return;

    try {
      updateAccountRunningStatus(accountId, 'loading');

      const result = await window.electronAPI.invoke('close-account', accountId);
      if (!result || !result.success) {
        throw new Error((result && result.error) || '关闭账号失败');
      }

      console.log(`Account ${accountId} closed successfully`);
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
    await handleOpenAccount(accountId);
  }

  /**
   * Update account running status in UI（只更新按钮区，不重渲染整行）
   */
  function updateAccountRunningStatus(accountId, runningStatus) {
    const account = accounts.find((acc) => acc.id === accountId);
    if (!account) return;

    account.runningStatus = runningStatus;
    account.isRunning = runningStatus !== 'not_started' && runningStatus !== 'error';

    if (!accountList) return;

    const item = accountList.querySelector(`[data-account-id="${accountId}"]`);
    if (!item) return;

    const actions = item.querySelector('.account-actions');
    if (!actions) return;

    renderAccountActions(account, actions);
  }

  /**
   * Handle accounts updated event from main process
   * 使用防抖避免频繁重渲染
   */
  function handleAccountsUpdated(accountsData) {
    accounts = accountsData || [];

    if (updateTimers.has('accountList')) {
      clearTimeout(updateTimers.get('accountList'));
    }

    updateTimers.set(
      'accountList',
      setTimeout(() => {
        renderAccountList();
        updateTimers.delete('accountList');
      }, DEBOUNCE_DELAY)
    );
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
    updateAccountStatus(accountId, status);
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

    console.log(`[Sidebar] handleViewReady for ${accountId}:`, {
      loginStatus,
      connectionStatus
    });

    const account = accounts.find((acc) => acc.id === accountId);
    if (account) {
      if (loginStatus !== undefined) {
        account.loginStatus = loginStatus;
      }
      if (connectionStatus) {
        account.connectionStatus = connectionStatus;
      }
    }

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

    const account = accounts.find((acc) => acc.id === accountId);
    if (account) {
      account.connectionStatus = 'error';
      account.connectionError = error;
    }

    updateAccountStatus(accountId, 'error');

    console.error(`View error for account ${accountId}:`, error);
  }

  /**
   * Handle login status changed event
   */
  function handleLoginStatusChanged(data) {
    const { accountId, isLoggedIn, hasQRCode, loginInfo } = data;

    console.log(`[Sidebar] handleLoginStatusChanged for ${accountId}:`, {
      isLoggedIn,
      hasQRCode,
      loginInfo
    });

    const account = accounts.find((acc) => acc.id === accountId);
    if (account) {
      account.loginStatus = isLoggedIn;
      account.hasQRCode = hasQRCode;
      account.loginInfo = loginInfo;
    }

    if (isLoggedIn) {
      updateAccountStatus(accountId, 'online');
    } else if (hasQRCode) {
      updateAccountStatus(accountId, 'offline');
    } else {
      updateAccountStatus(accountId, account && account.status ? account.status : 'loading');
    }
  }

  /**
   * Handle view crashed event
   */
  function handleViewCrashed(data) {
    const { accountId, error } = data;

    const account = accounts.find((acc) => acc.id === accountId);
    if (account) {
      account.connectionStatus = 'error';
      account.connectionError = error;
    }

    updateAccountStatus(accountId, 'error');
    console.error(`View crashed for account ${accountId}:`, error);
    showError(`账号 "${getAccountName(accountId)}" 已崩溃，请重新加载。`);
  }

  /**
   * Handle connection status changed event
   */
  function handleConnectionStatusChanged(data) {
    const { accountId, connectionStatus, error, details, isLoggedIn, hasQRCode } = data;

    console.log(`[Sidebar] handleConnectionStatusChanged for ${accountId}:`, {
      connectionStatus,
      isLoggedIn,
      hasQRCode,
      details
    });

    const account = accounts.find((acc) => acc.id === accountId);
    if (account) {
      account.connectionStatus = connectionStatus;
      account.connectionError = error || null;
      account.connectionDetails = details || null;
      if (isLoggedIn !== undefined) {
        account.loginStatus = isLoggedIn;
      }
      if (hasQRCode !== undefined) {
        account.hasQRCode = hasQRCode;
      }
    }

    updateAccountStatus(accountId, connectionStatus);

    console.log(
      `Connection status changed for account ${accountId}:`,
      connectionStatus,
      details
    );
  }

  /**
   * Update account status in UI（集中管理 DOM 更新）
   */
  function updateAccountStatus(accountId, status) {
    const account = accounts.find((acc) => acc.id === accountId);
    if (account) {
      account.status = status;
    }

    if (!accountList) return;

    const item = accountList.querySelector(`[data-account-id="${accountId}"]`);
    if (!item) return;

    const statusElement = item.querySelector('.account-status');
    if (!statusElement || !account) return;

    renderAccountStatusForAccount(account, statusElement);
  }

  /**
   * Get account name by ID
   */
  function getAccountName(accountId) {
    const account = accounts.find((acc) => acc.id === accountId);
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
   * 这里保持 alert 行为以避免改变用户当前体验
   */
  function showError(message) {
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

