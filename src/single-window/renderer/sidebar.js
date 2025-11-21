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
  const searchInput = document.getElementById('account-search');

  // Search state
  let filterQuery = '';

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

    // Search input
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        filterQuery = e.target.value.trim().toLowerCase();
        renderAccountList();
      });
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
      window.electronAPI.on('view-manager:account-profile-updated', handleAccountProfileUpdated);

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

    // Filter accounts
    const filteredAccounts = accounts.filter(account => {
      if (!filterQuery) return true;
      const name = (account.name || '').toLowerCase();
      const phone = (account.phoneNumber || '').toLowerCase();
      const note = (account.note || '').toLowerCase();
      return name.includes(filterQuery) || phone.includes(filterQuery) || note.includes(filterQuery);
    });

    // Show/hide empty state (based on filter result)
    if (filteredAccounts.length === 0) {
      if (emptyState) {
        // If we have accounts but filtered to 0, show "no results" state?
        // For now just show empty state or maybe a specific "no results" state
        emptyState.classList.remove('hidden');
        if (accounts.length > 0) {
           // Optional: Change empty state text for search results
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
    const sortedAccounts = [...filteredAccounts].sort((a, b) => {
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

    // Avatar container
    const avatarContainer = document.createElement('div');
    avatarContainer.className = 'account-avatar-container';

    // Avatar
    const avatar = document.createElement('div');
    avatar.className = 'account-avatar';
    avatar.textContent = getAccountInitial(account.name);
    avatar.style.background = getAccountColor(account.id);
    
    // Status Dot (Online/Offline indicator on avatar)
    const statusDot = document.createElement('div');
    statusDot.className = 'status-dot';
    renderStatusDot(account, statusDot);
    
    avatarContainer.appendChild(avatar);
    avatarContainer.appendChild(statusDot);

    // Info
    const info = document.createElement('div');
    info.className = 'account-info';

    const header = document.createElement('div');
    header.className = 'account-header';

    const name = document.createElement('div');
    name.className = 'account-name';
    name.textContent = account.name || '未命名账号';
    name.title = account.name || '未命名账号';
    
    header.appendChild(name);

    // Secondary info (Phone or Note)
    const secondary = document.createElement('div');
    secondary.className = 'account-secondary';
    
    if (account.phoneNumber) {
        secondary.textContent = account.phoneNumber;
        secondary.title = account.phoneNumber;
    } else if (account.note) {
        secondary.textContent = account.note;
        secondary.title = account.note;
    } else {
        secondary.textContent = '无号码';
    }

    info.appendChild(header);
    info.appendChild(secondary);

    // Quick Actions (Hover only)
    const actions = document.createElement('div');
    actions.className = 'account-actions';
    renderQuickActions(account, actions);

    // Assemble
    item.appendChild(avatarContainer);
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
    
    // Context Menu
    item.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        handleContextMenu(e, account);
    });

    // Apply profile info (真实头像 / 昵称 / 号码）如果已知
    applyAccountProfileToItem(account, item);

    return item;
  }

  /**
   * 根据账号 profile 信息更新账号项的头像 / 名称 / 号码展示
   * @param {Object} account - 账号对象
   * @param {HTMLElement} item - 对应的账号 DOM 节点
   */
  /**
   * 根据账号 profile 信息更新账号项的头像 / 名称 / 号码展示
   * @param {Object} account - 账号对象
   * @param {HTMLElement} item - 对应的账号 DOM 节点
   */
  function applyAccountProfileToItem(account, item) {
    if (!account || !item) return;

    const displayName = account.profileName || account.name || '未命名账号';

    // 更新名称
    const nameEl = item.querySelector('.account-name');
    if (nameEl) {
      nameEl.textContent = displayName;
      nameEl.title = displayName;
    }

    // 更新头像
    const avatarEl = item.querySelector('.account-avatar');
    if (avatarEl) {
      // 清理旧内容
      avatarEl.textContent = '';
      const existingImg = avatarEl.querySelector('img');
      if (existingImg) {
        existingImg.remove();
      }
      avatarEl.style.background = '';

      if (account.avatarUrl) {
        const img = document.createElement('img');
        img.src = account.avatarUrl;
        img.alt = displayName;
        img.className = 'account-avatar-image';
        avatarEl.appendChild(img);
      } else {
        avatarEl.textContent = getAccountInitial(displayName);
        avatarEl.style.background = getAccountColor(account.id);
      }
    }

    // 更新号码
    const secondaryEl = item.querySelector('.account-secondary');
    if (secondaryEl) {
        if (account.phoneNumber) {
            secondaryEl.textContent = account.phoneNumber;
            secondaryEl.title = account.phoneNumber;
        } else if (account.note) {
            secondaryEl.textContent = account.note;
            secondaryEl.title = account.note;
        } else {
            secondaryEl.textContent = '无号码';
        }
    }
  }

  /**
   * 渲染账号的状态展示（文本 + class + tooltip）
   * 统一处理 loginStatus / connectionStatus / hasQRCode / error 等字段
   */
  /**
   * Render status dot
   */
  function renderStatusDot(account, dotElement) {
    if (!dotElement || !account) return;
    
    const statusValue = account.status || account.connectionStatus || 'offline';
    const loginStatus = account.loginStatus;
    const hasQRCode = account.hasQRCode;
    const details = account.connectionDetails;
    const error = account.connectionError;

    dotElement.className = 'status-dot';
    
    if (statusValue === 'offline' && (loginStatus === false || hasQRCode || (details && details.needsQRScan))) {
        dotElement.classList.add('warning');
        dotElement.title = '需要登录';
    } else if (statusValue === 'online') {
        dotElement.classList.add('online');
        dotElement.title = '在线';
    } else if (statusValue === 'loading') {
        dotElement.classList.add('loading');
        dotElement.title = '加载中...';
    } else if (statusValue === 'error') {
        dotElement.classList.add('error');
        dotElement.title = (error && error.message) || '连接错误';
    } else {
        dotElement.classList.add('offline');
        dotElement.title = '离线';
    }
  }

  /**
   * Render quick actions (Open/Close)
   */
  function renderQuickActions(account, actions) {
    if (!actions || !account) return;

    actions.innerHTML = '';

    const runningStatus = account.runningStatus || 'not_started';
    const isRunning = !!account.isRunning;

    // Only show primary action button
    const actionBtn = document.createElement('button');
    actionBtn.className = 'action-btn';
    
    if (runningStatus === 'not_started' || !isRunning) {
        actionBtn.innerHTML = '▶'; // Play icon
        actionBtn.title = '打开账号';
        actionBtn.classList.add('start');
        actionBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            handleOpenAccount(account.id);
        });
        actions.appendChild(actionBtn);
    } else if (runningStatus === 'loading') {
        const spinner = document.createElement('div');
        spinner.className = 'mini-spinner';
        actions.appendChild(spinner);
    } else if (runningStatus === 'connected' || isRunning) {
        actionBtn.innerHTML = '⏹'; // Stop icon
        actionBtn.title = '关闭账号';
        actionBtn.classList.add('stop');
        actionBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            handleCloseAccount(account.id);
        });
        actions.appendChild(actionBtn);
    } else if (runningStatus === 'error') {
        actionBtn.innerHTML = '↻'; // Retry icon
        actionBtn.title = '重试';
        actionBtn.classList.add('retry');
        actionBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            handleRetryAccount(account.id);
        });
        actions.appendChild(actionBtn);
    }
  }

  /**
   * Handle Context Menu
   */
  function handleContextMenu(e, account) {
    // Remove existing context menus
    const existing = document.querySelectorAll('.custom-context-menu');
    existing.forEach(el => el.remove());

    const menu = document.createElement('div');
    menu.className = 'custom-context-menu';
    
    const options = [
        { label: '打开账号', icon: '▶', action: () => handleOpenAccount(account.id), visible: !account.isRunning },
        { label: '关闭账号', icon: '⏹', action: () => handleCloseAccount(account.id), visible: account.isRunning },
        { label: '编辑账号', icon: '⚙️', action: () => handleEditAccount(account.id) },
        { label: '复制号码', icon: '📋', action: () => copyToClipboard(account.phoneNumber), visible: !!account.phoneNumber },
        { type: 'separator' },
        { label: '删除账号', icon: '🗑️', action: () => handleDeleteAccount(account.id), danger: true }
    ];

    options.forEach(opt => {
        if (opt.visible === false) return;
        
        if (opt.type === 'separator') {
            const sep = document.createElement('div');
            sep.className = 'menu-separator';
            menu.appendChild(sep);
            return;
        }

        const item = document.createElement('div');
        item.className = 'menu-item';
        if (opt.danger) item.classList.add('danger');
        
        item.innerHTML = `<span class="menu-icon">${opt.icon}</span><span class="menu-label">${opt.label}</span>`;
        item.addEventListener('click', () => {
            opt.action();
            menu.remove();
        });
        menu.appendChild(item);
    });

    document.body.appendChild(menu);
    
    // Position menu
    const rect = menu.getBoundingClientRect();
    let x = e.clientX;
    let y = e.clientY;
    
    if (x + rect.width > window.innerWidth) x = window.innerWidth - rect.width;
    if (y + rect.height > window.innerHeight) y = window.innerHeight - rect.height;
    
    menu.style.left = `${x}px`;
    menu.style.top = `${y}px`;

    // Close on click outside
    const closeMenu = () => {
        menu.remove();
        document.removeEventListener('click', closeMenu);
    };
    // Delay to prevent immediate closing
    setTimeout(() => document.addEventListener('click', closeMenu), 0);
  }

  function copyToClipboard(text) {
      if (!text) return;
      navigator.clipboard.writeText(text).then(() => {
          // Optional: show toast
          console.log('Copied to clipboard');
      });
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
    
    // Update actions
    const actions = item.querySelector('.account-actions');
    if (actions) {
        renderQuickActions(account, actions);
    }
    
    // Update status dot
    const statusDot = item.querySelector('.status-dot');
    if (statusDot) {
        renderStatusDot(account, statusDot);
    }
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

  function updateAccountStatus(accountId, status) {
      const account = accounts.find(acc => acc.id === accountId);
      if (account) {
          account.status = status;
      }
      
      const item = accountList.querySelector(`[data-account-id="${accountId}"]`);
      if (item) {
          const statusDot = item.querySelector('.status-dot');
          if (statusDot) {
              renderStatusDot(account, statusDot);
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
   * Handle account profile updated event (avatar / name / phone)
   */
  function handleAccountProfileUpdated(data) {
    const { accountId, phoneNumber, profileName, avatarUrl } = data || {};

    console.log('[Sidebar] account-profile-updated', data);

    const account = accounts.find((acc) => acc.id === accountId);
    if (!account) {
      return;
    }

    if (phoneNumber) {
      account.phoneNumber = phoneNumber;
    }
    if (profileName) {
      account.profileName = profileName;
    }
    if (avatarUrl) {
      account.avatarUrl = avatarUrl;
    }

    if (!accountList) return;
    const item = accountList.querySelector(`[data-account-id="${accountId}"]`);
    if (!item) return;

    applyAccountProfileToItem(account, item);
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
