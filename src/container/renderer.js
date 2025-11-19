/**
 * Renderer Process - 主窗口渲染进程脚本
 * 
 * 处理主窗口的 UI 交互和账号列表渲染
 */

// 状态管理
let accounts = [];
let filteredAccounts = [];
let currentFilter = 'all';
let searchQuery = '';
let sortBy = 'name';
let editingAccountId = null;

// DOM 元素
const accountList = document.getElementById('account-list');
const addAccountBtn = document.getElementById('add-account-btn');
const searchInput = document.getElementById('search-input');
const filterStatus = document.getElementById('filter-status');
const sortBySelect = document.getElementById('sort-by');
const themeToggle = document.getElementById('theme-toggle');
const configDialog = document.getElementById('config-dialog');
const dialogTitle = document.getElementById('dialog-title');
const dialogClose = document.getElementById('dialog-close');
const dialogCancel = document.getElementById('dialog-cancel');
const dialogSave = document.getElementById('dialog-save');
const accountForm = document.getElementById('account-form');

// 表单元素
const accountNameInput = document.getElementById('account-name');
const proxyEnabledCheckbox = document.getElementById('proxy-enabled');
const proxySettings = document.getElementById('proxy-settings');
const proxyProtocol = document.getElementById('proxy-protocol');
const proxyHost = document.getElementById('proxy-host');
const proxyPort = document.getElementById('proxy-port');
const proxyUsername = document.getElementById('proxy-username');
const proxyPassword = document.getElementById('proxy-password');
const translationEnabledCheckbox = document.getElementById('translation-enabled');
const translationSettings = document.getElementById('translation-settings');
const translationTargetLang = document.getElementById('translation-target-lang');
const translationEngine = document.getElementById('translation-engine');
const translationAuto = document.getElementById('translation-auto');
const notificationEnabledCheckbox = document.getElementById('notification-enabled');
const notificationSettings = document.getElementById('notification-settings');
const notificationSound = document.getElementById('notification-sound');
const notificationBadge = document.getElementById('notification-badge');

/**
 * 初始化
 */
function initialize() {
  // 加载主题
  loadTheme();
  
  // 绑定事件
  bindEvents();
  
  // 请求账号列表
  window.mainAPI.getAccounts().then(renderAccountList);
}

/**
 * 绑定事件监听器
 */
function bindEvents() {
  // 添加账号按钮
  addAccountBtn.addEventListener('click', () => {
    editingAccountId = null;
    showConfigDialog();
  });
  
  // 搜索输入
  searchInput.addEventListener('input', (e) => {
    searchQuery = e.target.value.toLowerCase();
    filterAndRenderAccounts();
  });
  
  // 状态过滤
  filterStatus.addEventListener('change', (e) => {
    currentFilter = e.target.value;
    filterAndRenderAccounts();
  });
  
  // 排序选择
  sortBySelect.addEventListener('change', (e) => {
    sortBy = e.target.value;
    filterAndRenderAccounts();
  });
  
  // 主题切换
  themeToggle.addEventListener('click', toggleTheme);
  
  // 对话框关闭
  dialogClose.addEventListener('click', hideConfigDialog);
  dialogCancel.addEventListener('click', hideConfigDialog);
  
  // 对话框保存
  dialogSave.addEventListener('click', saveAccount);
  
  // 代理启用切换
  proxyEnabledCheckbox.addEventListener('change', (e) => {
    proxySettings.style.display = e.target.checked ? 'block' : 'none';
  });
  
  // 翻译启用切换
  translationEnabledCheckbox.addEventListener('change', (e) => {
    translationSettings.style.display = e.target.checked ? 'block' : 'none';
  });
  
  // 通知启用切换
  notificationEnabledCheckbox.addEventListener('change', (e) => {
    notificationSettings.style.display = e.target.checked ? 'block' : 'none';
  });
  
  // 点击对话框外部关闭
  configDialog.addEventListener('click', (e) => {
    if (e.target === configDialog) {
      hideConfigDialog();
    }
  });
}

/**
 * 渲染账号列表
 * @param {Array} accountsData - 账号数据数组
 */
function renderAccountList(accountsData) {
  accounts = accountsData || [];
  filterAndRenderAccounts();
}

/**
 * 过滤并渲染账号
 */
function filterAndRenderAccounts() {
  // 应用过滤
  filteredAccounts = accounts.filter(account => {
    // 搜索过滤
    if (searchQuery && !account.name.toLowerCase().includes(searchQuery)) {
      return false;
    }
    
    // 状态过滤
    if (currentFilter !== 'all' && account.status !== currentFilter) {
      return false;
    }
    
    return true;
  });
  
  // 应用排序
  sortAccounts(filteredAccounts);
  
  // 渲染
  if (filteredAccounts.length === 0) {
    renderEmptyState();
  } else {
    renderAccountCards();
  }
}

/**
 * 排序账号列表
 * @param {Array} accountsToSort - 要排序的账号数组
 */
function sortAccounts(accountsToSort) {
  accountsToSort.sort((a, b) => {
    switch (sortBy) {
      case 'name':
        // 按名称字母顺序排序
        return a.name.localeCompare(b.name, 'zh-CN');
      
      case 'status':
        // 按状态排序：running > starting > stopped > error
        const statusOrder = { running: 0, starting: 1, stopped: 2, error: 3 };
        const aOrder = statusOrder[a.status] ?? 4;
        const bOrder = statusOrder[b.status] ?? 4;
        if (aOrder !== bOrder) {
          return aOrder - bOrder;
        }
        // 状态相同时按名称排序
        return a.name.localeCompare(b.name, 'zh-CN');
      
      case 'lastActive':
        // 按最后活跃时间排序（最近的在前）
        const aTime = a.lastActiveAt ? new Date(a.lastActiveAt).getTime() : 0;
        const bTime = b.lastActiveAt ? new Date(b.lastActiveAt).getTime() : 0;
        return bTime - aTime;
      
      default:
        return 0;
    }
  });
}

/**
 * 渲染空状态
 */
function renderEmptyState() {
  accountList.innerHTML = `
    <div class="empty-state">
      <svg class="empty-icon" viewBox="0 0 24 24">
        <path d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/>
      </svg>
      <p class="empty-text">${searchQuery || currentFilter !== 'all' ? '未找到匹配的账号' : '暂无账号'}</p>
      <p class="empty-hint">${searchQuery || currentFilter !== 'all' ? '尝试调整搜索或过滤条件' : '点击"添加账号"按钮创建第一个账号'}</p>
    </div>
  `;
}

/**
 * 渲染账号卡片
 */
function renderAccountCards() {
  accountList.innerHTML = filteredAccounts.map(account => createAccountCard(account)).join('');
  
  // 绑定卡片事件
  filteredAccounts.forEach(account => {
    bindAccountCardEvents(account.id);
  });
}

/**
 * 创建账号卡片 HTML
 * @param {Object} account - 账号对象
 * @returns {string} HTML 字符串
 */
function createAccountCard(account) {
  const statusClass = `status-${account.status || 'stopped'}`;
  const statusText = getStatusText(account.status);
  const lastActive = account.lastActiveAt ? formatDate(account.lastActiveAt) : '从未';
  const unreadCount = account.unreadCount || 0;
  
  return `
    <div class="account-card" data-account-id="${account.id}">
      <div class="account-card-header">
        <div class="account-info">
          <div class="account-name">${escapeHtml(account.name)}</div>
          <div class="account-id">${account.id.substring(0, 8)}</div>
        </div>
        <div class="status-badge ${statusClass}">
          <span class="status-dot"></span>
          ${statusText}
        </div>
      </div>
      
      <div class="account-meta">
        <div class="meta-item">
          <svg class="icon" viewBox="0 0 24 24">
            <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
          ${lastActive}
        </div>
        ${unreadCount > 0 ? `
          <div class="meta-item">
            <svg class="icon" viewBox="0 0 24 24">
              <path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
            </svg>
            <span class="unread-badge">${unreadCount}</span>
          </div>
        ` : ''}
      </div>
      
      <div class="account-actions">
        ${account.status === 'running' ? `
          <button class="btn btn-sm btn-secondary" data-action="stop" data-account-id="${account.id}">
            <svg class="icon" viewBox="0 0 24 24">
              <path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
              <path d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z"/>
            </svg>
            停止
          </button>
          <button class="btn btn-sm btn-secondary" data-action="restart" data-account-id="${account.id}">
            <svg class="icon" viewBox="0 0 24 24">
              <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
            </svg>
            重启
          </button>
        ` : `
          <button class="btn btn-sm btn-primary" data-action="start" data-account-id="${account.id}">
            <svg class="icon" viewBox="0 0 24 24">
              <path d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"/>
              <path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
            启动
          </button>
        `}
        <button class="btn btn-sm btn-secondary" data-action="edit" data-account-id="${account.id}">
          <svg class="icon" viewBox="0 0 24 24">
            <path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
          </svg>
          编辑
        </button>
        <button class="btn btn-sm btn-danger" data-action="delete" data-account-id="${account.id}">
          <svg class="icon" viewBox="0 0 24 24">
            <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
          </svg>
          删除
        </button>
      </div>
    </div>
  `;
}

/**
 * 绑定账号卡片事件
 * @param {string} accountId - 账号 ID
 */
function bindAccountCardEvents(accountId) {
  const card = document.querySelector(`[data-account-id="${accountId}"]`);
  if (!card) return;
  
  // 启动按钮
  const startBtn = card.querySelector('[data-action="start"]');
  if (startBtn) {
    startBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      handleStartAccount(accountId);
    });
  }
  
  // 停止按钮
  const stopBtn = card.querySelector('[data-action="stop"]');
  if (stopBtn) {
    stopBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      handleStopAccount(accountId);
    });
  }
  
  // 重启按钮
  const restartBtn = card.querySelector('[data-action="restart"]');
  if (restartBtn) {
    restartBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      handleRestartAccount(accountId);
    });
  }
  
  // 编辑按钮
  const editBtn = card.querySelector('[data-action="edit"]');
  if (editBtn) {
    editBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      handleEditAccount(accountId);
    });
  }
  
  // 删除按钮
  const deleteBtn = card.querySelector('[data-action="delete"]');
  if (deleteBtn) {
    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      handleDeleteAccount(accountId);
    });
  }
}

/**
 * 更新单个账号状态
 * @param {string} accountId - 账号 ID
 * @param {Object} status - 状态对象
 */
function updateAccountStatus(accountId, status) {
  const account = accounts.find(a => a.id === accountId);
  if (account) {
    Object.assign(account, status);
    filterAndRenderAccounts();
  }
}

/**
 * 显示配置对话框
 * @param {Object} account - 账号对象（编辑时）
 */
function showConfigDialog(account = null) {
  if (account) {
    // 编辑模式
    editingAccountId = account.id;
    dialogTitle.textContent = '编辑账号';
    
    // 填充表单
    accountNameInput.value = account.name;
    
    // 代理设置
    proxyEnabledCheckbox.checked = account.proxy?.enabled || false;
    proxySettings.style.display = account.proxy?.enabled ? 'block' : 'none';
    proxyProtocol.value = account.proxy?.protocol || 'socks5';
    proxyHost.value = account.proxy?.host || '';
    proxyPort.value = account.proxy?.port || '';
    proxyUsername.value = account.proxy?.username || '';
    proxyPassword.value = account.proxy?.password || '';
    
    // 翻译设置
    translationEnabledCheckbox.checked = account.translation?.enabled || false;
    translationSettings.style.display = account.translation?.enabled ? 'block' : 'none';
    translationTargetLang.value = account.translation?.targetLanguage || 'zh-CN';
    translationEngine.value = account.translation?.engine || 'google';
    translationAuto.checked = account.translation?.autoTranslate || false;
    
    // 通知设置
    notificationEnabledCheckbox.checked = account.notifications?.enabled !== false;
    notificationSettings.style.display = account.notifications?.enabled !== false ? 'block' : 'none';
    notificationSound.checked = account.notifications?.sound !== false;
    notificationBadge.checked = account.notifications?.badge !== false;
  } else {
    // 新建模式
    editingAccountId = null;
    dialogTitle.textContent = '添加账号';
    accountForm.reset();
    proxySettings.style.display = 'none';
    translationSettings.style.display = 'none';
    notificationSettings.style.display = 'block';
  }
  
  configDialog.style.display = 'flex';
}

/**
 * 隐藏配置对话框
 */
function hideConfigDialog() {
  configDialog.style.display = 'none';
  accountForm.reset();
  editingAccountId = null;
}

/**
 * 保存账号
 */
async function saveAccount() {
  // 验证表单
  if (!accountNameInput.value.trim()) {
    alert('请输入账号名称');
    return;
  }
  
  // 构建账号配置
  const accountConfig = {
    name: accountNameInput.value.trim(),
    proxy: {
      enabled: proxyEnabledCheckbox.checked,
      protocol: proxyProtocol.value,
      host: proxyHost.value.trim(),
      port: parseInt(proxyPort.value) || 0,
      username: proxyUsername.value.trim(),
      password: proxyPassword.value.trim()
    },
    translation: {
      enabled: translationEnabledCheckbox.checked,
      targetLanguage: translationTargetLang.value,
      engine: translationEngine.value,
      autoTranslate: translationAuto.checked
    },
    notifications: {
      enabled: notificationEnabledCheckbox.checked,
      sound: notificationSound.checked,
      badge: notificationBadge.checked
    }
  };
  
  try {
    if (editingAccountId) {
      // 更新账号
      await window.mainAPI.updateAccount(editingAccountId, accountConfig);
    } else {
      // 创建账号
      await window.mainAPI.createAccount(accountConfig);
    }
    
    hideConfigDialog();
    
    // 刷新列表
    const updatedAccounts = await window.mainAPI.getAccounts();
    renderAccountList(updatedAccounts);
  } catch (error) {
    alert(`保存失败: ${error.message}`);
  }
}

/**
 * 处理启动账号
 */
async function handleStartAccount(accountId) {
  console.log(`[Renderer] Starting account: ${accountId}`);
  try {
    await window.mainAPI.startInstance(accountId);
    console.log(`[Renderer] Account ${accountId} started successfully`);
  } catch (error) {
    console.error(`[Renderer] Failed to start account ${accountId}:`, error);
    alert(`启动失败: ${error.message}`);
  }
}

/**
 * 处理停止账号
 */
async function handleStopAccount(accountId) {
  console.log(`[Renderer] Stopping account: ${accountId}`);
  try {
    await window.mainAPI.stopInstance(accountId);
    console.log(`[Renderer] Account ${accountId} stopped successfully`);
  } catch (error) {
    console.error(`[Renderer] Failed to stop account ${accountId}:`, error);
    alert(`停止失败: ${error.message}`);
  }
}

/**
 * 处理重启账号
 */
async function handleRestartAccount(accountId) {
  try {
    await window.mainAPI.restartInstance(accountId);
  } catch (error) {
    alert(`重启失败: ${error.message}`);
  }
}

/**
 * 处理编辑账号
 */
function handleEditAccount(accountId) {
  const account = accounts.find(a => a.id === accountId);
  if (account) {
    showConfigDialog(account);
  }
}

/**
 * 处理删除账号
 */
async function handleDeleteAccount(accountId) {
  const account = accounts.find(a => a.id === accountId);
  if (!account) return;
  
  if (!confirm(`确定要删除账号"${account.name}"吗？此操作将删除所有相关数据且无法恢复。`)) {
    return;
  }
  
  try {
    await window.mainAPI.deleteAccount(accountId);
    
    // 刷新列表
    const updatedAccounts = await window.mainAPI.getAccounts();
    renderAccountList(updatedAccounts);
  } catch (error) {
    alert(`删除失败: ${error.message}`);
  }
}

/**
 * 切换主题
 */
function toggleTheme() {
  const currentTheme = document.documentElement.getAttribute('data-theme');
  const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', newTheme);
  localStorage.setItem('theme', newTheme);
}

/**
 * 加载主题
 */
function loadTheme() {
  const savedTheme = localStorage.getItem('theme') || 'light';
  document.documentElement.setAttribute('data-theme', savedTheme);
}

/**
 * 获取状态文本
 */
function getStatusText(status) {
  const statusMap = {
    running: '运行中',
    stopped: '已停止',
    starting: '启动中',
    error: '错误'
  };
  return statusMap[status] || '未知';
}

/**
 * 格式化日期
 */
function formatDate(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const diff = now - date;
  
  if (diff < 60000) return '刚刚';
  if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`;
  if (diff < 604800000) return `${Math.floor(diff / 86400000)} 天前`;
  
  return date.toLocaleDateString('zh-CN');
}

/**
 * HTML 转义
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// 监听来自主进程的事件
window.mainAPI.onAccountsRender((accounts) => {
  renderAccountList(accounts);
});

window.mainAPI.onAccountStatusUpdate(({ accountId, status }) => {
  updateAccountStatus(accountId, status);
});

window.mainAPI.onNotificationShow(({ accountId, message }) => {
  // 可以在这里实现更复杂的通知 UI
  console.log(`[${accountId}] ${message}`);
});

// 初始化应用
initialize();
