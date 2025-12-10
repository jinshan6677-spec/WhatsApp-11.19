/**
 * Quick Reply Panel Integration
 * 
 * Handles the quick reply panel display and integration with the main window
 */

(function() {
  'use strict';

  // Panel state
  let currentAccountId = null;
  let quickReplyController = null;
  let isLoading = false;
  let currentData = null;

  /**
   * Get current active account ID
   * @returns {Promise<string|null>} Account ID or null
   */
  async function getActiveAccountId() {
    // Try SidebarState first (synchronous)
    if (window.SidebarState && typeof window.SidebarState.getActiveAccountId === 'function') {
      const accountId = window.SidebarState.getActiveAccountId();
      if (accountId) return accountId;
    }
    
    // Try sidebar API
    if (window.sidebar && typeof window.sidebar.getActiveAccountId === 'function') {
      const accountId = window.sidebar.getActiveAccountId();
      if (accountId) return accountId;
    }
    
    // Try electronAPI (async)
    if (window.electronAPI && window.electronAPI.getActiveAccount) {
      try {
        const res = await window.electronAPI.getActiveAccount();
        return res?.accountId || null;
      } catch (error) {
        console.error('[QuickReply] Failed to get active account:', error);
      }
    }
    
    return null;
  }

  /**
   * Initialize quick reply panel
   */
  function initializeQuickReplyPanel() {
    console.log('[QuickReply] Initializing quick reply panel');

    // Listen for panel switch events
    const quickReplyBtn = document.querySelector('[data-panel="quick-reply"]');
    if (quickReplyBtn) {
      quickReplyBtn.addEventListener('click', () => {
        showQuickReplyPanel();
      });
    }

    // Listen for account switch events
    if (window.electronAPI && window.electronAPI.quickReply && window.electronAPI.quickReply.onAccountSwitch) {
      window.electronAPI.quickReply.onAccountSwitch((accountId) => {
        handleAccountSwitch(accountId);
      });
    }

    // Listen for account switch errors
    if (window.electronAPI && window.electronAPI.quickReply && window.electronAPI.quickReply.onAccountSwitchError) {
      window.electronAPI.quickReply.onAccountSwitchError((data) => {
        handleAccountSwitchError(data);
      });
    }

    // Listen for quick reply events from main process
    if (window.electronAPI && window.electronAPI.quickReply && window.electronAPI.quickReply.onQuickReplyEvent) {
      window.electronAPI.quickReply.onQuickReplyEvent((event, data) => {
        handleQuickReplyEvent(event, data);
      });
    }
    
    // Also listen for account:active-changed event via electronAPI.on
    if (window.electronAPI && window.electronAPI.on) {
      window.electronAPI.on('account:active-changed', (data) => {
        const accountId = typeof data === 'string' ? data : data?.accountId;
        if (accountId) {
          handleAccountSwitch(accountId);
        }
      });
    }
  }

  /**
   * Show quick reply panel
   */
  async function showQuickReplyPanel() {
    console.log('[QuickReply] Showing quick reply panel');

    // Hide other panels
    document.getElementById('translate-panel-body').style.display = 'none';
    document.getElementById('environment-panel-body').style.display = 'none';

    // Show quick reply panel
    const quickReplyPanel = document.getElementById('quick-reply-panel-body');
    quickReplyPanel.style.display = 'block';

    // Update active button
    document.querySelectorAll('.panel-menu-btn').forEach(btn => {
      btn.classList.remove('active');
    });
    document.querySelector('[data-panel="quick-reply"]').classList.add('active');

    // Sync with TranslatePanelLayout
    if (window.TranslatePanelLayout && window.TranslatePanelLayout.setActivePanel) {
      window.TranslatePanelLayout.setActivePanel('quick-reply');
    }

    // Get current active account if not set
    if (!currentAccountId) {
      const activeId = await getActiveAccountId();
      if (activeId) {
        console.log('[QuickReply] Got active account:', activeId);
        currentAccountId = activeId;
      }
    }

    // Load quick reply content if account is selected
    if (currentAccountId) {
      loadQuickReplyContent(currentAccountId);
    } else {
      console.log('[QuickReply] No active account, showing placeholder');
    }
  }

  /**
   * Hide quick reply panel
   */
  function hideQuickReplyPanel() {
    const quickReplyPanel = document.getElementById('quick-reply-panel-body');
    quickReplyPanel.style.display = 'none';
  }

  /**
   * Handle account switch
   * @param {string} accountId - Account ID
   */
  async function handleAccountSwitch(accountId) {
    console.log('[QuickReply] Account switched:', accountId);
    
    // Prevent concurrent switches
    if (isLoading) {
      console.log('[QuickReply] Already loading, skipping switch');
      return;
    }
    
    // If switching to the same account, skip
    if (currentAccountId === accountId) {
      console.log('[QuickReply] Already on this account, skipping switch');
      return;
    }
    
    const previousAccountId = currentAccountId;
    
    try {
      // Show switching indicator
      showSwitchingIndicator(previousAccountId, accountId);
      
      // Unload current data
      await unloadCurrentData();
      
      // Update current account ID
      currentAccountId = accountId;
      
      // Load new account data
      await loadAccountData(accountId);
      
      // If quick reply panel is visible, refresh UI
      const quickReplyPanel = document.getElementById('quick-reply-panel-body');
      if (quickReplyPanel && quickReplyPanel.style.display !== 'none') {
        await refreshUI();
      }
      
      console.log('[QuickReply] Account switch completed:', { from: previousAccountId, to: accountId });
    } catch (error) {
      console.error('[QuickReply] Account switch failed:', error);
      
      // Show error to user
      showError(`账号切换失败: ${error.message}`);
      
      // Try to restore previous account
      if (previousAccountId) {
        currentAccountId = previousAccountId;
        await loadAccountData(previousAccountId);
      }
    }
  }

  /**
   * Handle account switch error
   * @param {Object} data - Error data
   */
  function handleAccountSwitchError(data) {
    console.error('[QuickReply] Account switch error:', data);
    showError(`账号切换失败: ${data.error || '未知错误'}`);
  }

  /**
   * Show switching indicator
   * @param {string} fromAccountId - Previous account ID
   * @param {string} toAccountId - New account ID
   */
  function showSwitchingIndicator(fromAccountId, toAccountId) {
    const host = document.getElementById('quick-reply-host');
    if (host) {
      host.innerHTML = `
        <div style="padding: 20px; text-align: center;">
          <div style="margin-bottom: 10px;">正在切换账号...</div>
          <div style="font-size: 12px; color: #666;">
            ${fromAccountId ? `从 ${fromAccountId} 切换到 ${toAccountId}` : `切换到 ${toAccountId}`}
          </div>
        </div>
      `;
    }
  }

  /**
   * Unload current data
   * Requirements: 11.1
   * @returns {Promise<void>}
   */
  async function unloadCurrentData() {
    console.log('[QuickReply] Unloading current data');
    
    try {
      // Clear current data
      currentData = null;
      
      // Clear UI
      const host = document.getElementById('quick-reply-host');
      if (host) {
        host.innerHTML = '';
      }
      
      console.log('[QuickReply] Current data unloaded');
    } catch (error) {
      console.error('[QuickReply] Failed to unload current data:', error);
      // Don't throw - unload failure shouldn't block account switch
    }
  }

  /**
   * Load account data
   * Requirements: 11.1, 11.6
   * @param {string} accountId - Account ID
   * @returns {Promise<void>}
   */
  async function loadAccountData(accountId) {
    console.log('[QuickReply] Loading account data:', accountId);
    
    if (!accountId) {
      console.warn('[QuickReply] No account ID provided');
      return;
    }
    
    isLoading = true;
    
    try {
      // Request quick reply data from main process
      const result = await window.electronAPI.quickReply.load(accountId);
      
      if (result.success) {
        currentData = result;
        console.log('[QuickReply] Account data loaded:', {
          accountId,
          templates: result.templateCount,
          groups: result.groupCount
        });
      } else {
        throw new Error(result.error || '加载失败');
      }
    } catch (error) {
      console.error('[QuickReply] Failed to load account data:', error);
      throw error;
    } finally {
      isLoading = false;
    }
  }

  /**
   * Refresh UI
   * Requirements: 11.1
   * @returns {Promise<void>}
   */
  async function refreshUI() {
    console.log('[QuickReply] Refreshing UI');
    
    try {
      if (currentData) {
        renderQuickReplyPanel(currentData);
      } else {
        const host = document.getElementById('quick-reply-host');
        if (host) {
          host.innerHTML = '<div style="padding: 20px; text-align: center; color: #999;">暂无数据</div>';
        }
      }
      
      console.log('[QuickReply] UI refreshed');
    } catch (error) {
      console.error('[QuickReply] Failed to refresh UI:', error);
      showError(`UI刷新失败: ${error.message}`);
    }
  }

  /**
   * Show error message
   * @param {string} message - Error message
   */
  function showError(message) {
    const host = document.getElementById('quick-reply-host');
    if (host) {
      host.innerHTML = `
        <div style="padding: 20px; text-align: center; color: red;">
          <div style="margin-bottom: 10px;">❌ ${message}</div>
          <button onclick="location.reload()" style="padding: 8px 16px; cursor: pointer;">
            重新加载
          </button>
        </div>
      `;
    }
  }

  /**
   * Load quick reply content for account
   * @param {string} accountId - Account ID
   * @param {boolean} forceRefresh - Force refresh data from server
   */
  async function loadQuickReplyContent(accountId, forceRefresh = false) {
    console.log('[QuickReply] Loading content for account:', accountId, 'forceRefresh:', forceRefresh);

    const placeholder = document.getElementById('quick-reply-panel-placeholder');
    const host = document.getElementById('quick-reply-host');

    if (!accountId) {
      if (placeholder) placeholder.style.display = 'block';
      if (host) host.style.display = 'none';
      return;
    }

    if (placeholder) placeholder.style.display = 'none';
    if (host) host.style.display = 'block';

    // If we already have data for this account and not forcing refresh, use it
    if (!forceRefresh && currentAccountId === accountId && currentData) {
      renderQuickReplyPanel(currentData);
      return;
    }

    // Show loading state
    if (host) {
      host.innerHTML = '<div style="padding: 20px; text-align: center;">加载中...</div>';
    }

    try {
      // Clear current data to force reload
      currentData = null;
      
      // Load account data
      await loadAccountData(accountId);
      
      // Render UI
      await refreshUI();
    } catch (error) {
      console.error('[QuickReply] Load error:', error);
      showError(`加载失败: ${error.message}`);
    }
  }

  /**
   * Handle quick reply events from main process
   * @param {string} event - Event name
   * @param {*} data - Event data
   */
  function handleQuickReplyEvent(event, data) {
    console.log('[QuickReply] Event received:', event, data);

    switch (event) {
      case 'loaded':
        renderQuickReplyPanel(data);
        break;
      case 'template:created':
      case 'template:updated':
      case 'template:deleted':
      case 'group:created':
      case 'group:updated':
      case 'group:deleted':
        // Refresh panel
        if (currentAccountId) {
          loadQuickReplyContent(currentAccountId);
        }
        break;
      default:
        console.warn('[QuickReply] Unknown event:', event);
    }
  }

  /**
   * Render quick reply panel
   * @param {Object} data - Panel data
   */
  function renderQuickReplyPanel(data) {
    console.log('[QuickReply] Rendering panel with data:', data);

    const host = document.getElementById('quick-reply-host');
    
    // Create operation panel UI
    const templates = data.templates || [];
    const groups = data.groups || [];
    
    host.innerHTML = `
      <div class="quick-reply-operation-panel">
        <!-- Toolbar -->
        <div class="qr-toolbar">
          <span class="qr-toolbar-title">快捷回复</span>
          <div class="qr-toolbar-spacer"></div>
          <button class="qr-btn qr-btn-icon" id="qr-refresh-btn" title="刷新">
            <span>🔄</span>
          </button>
          <button class="qr-btn qr-btn-icon" id="qr-manage-btn" title="编辑管理">
            <span>⚙️</span>
          </button>
          <button class="qr-btn qr-btn-icon" id="qr-copy-btn" title="复制">
            <span>📋</span>
          </button>
          <button class="qr-btn qr-btn-primary-sm" id="qr-add-btn" title="添加模板">
            <span>➕</span>
          </button>
          <div class="qr-settings-dropdown">
            <button class="qr-btn qr-btn-icon" id="qr-settings-btn" title="设置菜单">
              <span>☰</span>
            </button>
            <div class="qr-dropdown-menu" id="qr-settings-menu" style="display: none;">
              <div class="qr-dropdown-item" data-action="import">📥 导入模板</div>
              <div class="qr-dropdown-item" data-action="export">📤 导出模板</div>
              <div class="qr-dropdown-item" data-action="clear-cache">🗑️ 清空缓存</div>
            </div>
          </div>
        </div>
        
        <!-- Send Mode -->
        <div class="qr-send-mode-bar">
          <label>
            <input type="radio" name="send-mode" value="original" checked>
            <span>○ 原文发送</span>
          </label>
          <label>
            <input type="radio" name="send-mode" value="translated">
            <span>○ 翻译后发送</span>
          </label>
        </div>

        <!-- Create Template Form (hidden by default) -->
        <div class="qr-create-form" id="qr-create-form" style="display: none;">
          <div class="qr-form-header">
            <span>创建新模板</span>
            <button class="qr-btn qr-btn-icon qr-btn-close" id="qr-form-close">✕</button>
          </div>
          <div class="qr-form-body">
            <div class="qr-form-group">
              <label>模板名称</label>
              <input type="text" id="qr-template-label" placeholder="输入模板名称..." />
            </div>
            <div class="qr-form-group">
              <label>模板内容</label>
              <textarea id="qr-template-content" placeholder="输入模板内容..." rows="4"></textarea>
            </div>
            <div class="qr-form-actions">
              <button class="qr-btn" id="qr-form-cancel">取消</button>
              <button class="qr-btn qr-btn-primary" id="qr-form-save">保存</button>
            </div>
          </div>
        </div>

        <!-- Search Box -->
        <div class="qr-search-box">
          <input type="text" id="qr-search-input" placeholder="搜索模板..." />
        </div>

        <!-- Content Area -->
        <div class="qr-content">
          <div class="qr-groups">
            ${renderGroups(groups)}
          </div>
          <div class="qr-templates">
            ${renderTemplates(templates)}
          </div>
        </div>

        <!-- Status -->
        <div class="qr-status">
          <span>模板: ${templates.length}</span>
          <span>分组: ${groups.length}</span>
        </div>
      </div>
    `;

    // Add styles
    addQuickReplyStyles();

    // Attach event listeners
    attachEventListeners(data);
  }

  // Track expanded groups state
  let expandedGroups = new Set();

  /**
   * Render groups
   * @param {Array} groups - Groups array
   * @returns {string} HTML string
   */
  function renderGroups(groups) {
    let html = `
      <div class="qr-group-header">
        <span>分组</span>
        <button class="qr-btn qr-btn-icon qr-btn-add-group" title="添加分组">➕</button>
      </div>
    `;
    
    if (!groups || groups.length === 0) {
      html += '<div class="qr-empty">暂无分组</div>';
    } else {
      html += groups.map(group => {
        const isExpanded = expandedGroups.has(group.id);
        return `
        <div class="qr-group-item ${isExpanded ? 'expanded' : ''}" data-group-id="${group.id}">
          <span class="qr-group-toggle" data-group-id="${group.id}">${isExpanded ? '▼' : '▶'}</span>
          <span class="qr-group-name" data-group-id="${group.id}">${escapeHtml(group.name)}</span>
          <span class="qr-group-count">(${group.templateCount || 0})</span>
          <button class="qr-btn qr-btn-icon qr-btn-edit-group" data-group-id="${group.id}" title="编辑分组">✏️</button>
          <button class="qr-btn qr-btn-icon qr-btn-delete-group" data-group-id="${group.id}" title="删除分组">🗑️</button>
        </div>
      `}).join('');
    }
    
    return html;
  }

  /**
   * Render templates
   * @param {Array} templates - Templates array
   * @param {string} filterGroupId - Optional group ID to filter by
   * @returns {string} HTML string
   */
  function renderTemplates(templates, filterGroupId = null) {
    // Filter templates by group if specified
    let filteredTemplates = templates;
    if (filterGroupId) {
      filteredTemplates = templates.filter(t => t.groupId === filterGroupId);
    }
    
    if (!filteredTemplates || filteredTemplates.length === 0) {
      return `
        <div class="qr-empty-state">
          <div class="qr-empty-icon">📝</div>
          <div class="qr-empty-title">暂无快捷回复模板</div>
          <div class="qr-empty-desc">点击下方按钮创建您的第一个模板</div>
          <button class="qr-btn qr-btn-primary" id="qr-create-first-btn">
            ➕ 创建模板
          </button>
        </div>
      `;
    }

    return filteredTemplates.map((template, index) => `
      <div class="qr-template-item" data-template-id="${template.id}" data-group-id="${template.groupId || ''}">
        <div class="qr-template-header">
          <span class="qr-template-seq">${index + 1}</span>
          <span class="qr-template-type">${getTypeIcon(template.type)}</span>
          <span class="qr-template-label">${escapeHtml(template.label || '未命名')}</span>
          <button class="qr-btn qr-btn-icon qr-btn-edit" data-template-id="${template.id}" data-template-label="${encodeURIComponent(template.label || '')}" data-template-content="${encodeURIComponent(template.content?.text || '')}" title="编辑">
            ✏️
          </button>
          <button class="qr-btn qr-btn-icon qr-btn-delete" data-template-id="${template.id}" title="删除">
            🗑️
          </button>
        </div>
        <div class="qr-template-preview" data-template-id="${template.id}" data-template-full="${encodeURIComponent(JSON.stringify(template))}">
          ${getTemplatePreview(template)}
        </div>
        <div class="qr-template-actions">
          <button class="qr-btn qr-btn-sm qr-btn-send" data-template-id="${template.id}">
            发送
          </button>
          <button class="qr-btn qr-btn-sm qr-btn-insert" data-template-id="${template.id}">
            输入框提示
          </button>
        </div>
      </div>
    `).join('');
  }

  /**
   * Get type icon
   * @param {string} type - Template type
   * @returns {string} Icon
   */
  function getTypeIcon(type) {
    const icons = {
      text: '📝',
      image: '🖼️',
      video: '🎬',
      audio: '🎵',
      mixed: '📎',
      contact: '👤'
    };
    return icons[type] || '📄';
  }

  /**
   * Get template preview
   * @param {Object} template - Template object
   * @returns {string} Preview HTML
   */
  function getTemplatePreview(template) {
    if (template.type === 'text') {
      const text = template.content?.text || '';
      return escapeHtml(text.substring(0, 50) + (text.length > 50 ? '...' : ''));
    }
    return `${template.type} 模板`;
  }

  /**
   * Escape HTML
   * @param {string} text - Text to escape
   * @returns {string} Escaped text
   */
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Add quick reply styles
   */
  function addQuickReplyStyles() {
    if (document.getElementById('quick-reply-styles')) {
      return;
    }

    const style = document.createElement('style');
    style.id = 'quick-reply-styles';
    style.textContent = `
      .quick-reply-operation-panel {
        display: flex;
        flex-direction: column;
        height: 100%;
        background: #fff;
      }

      .qr-toolbar {
        display: flex;
        align-items: center;
        padding: 10px;
        border-bottom: 1px solid #e0e0e0;
        gap: 8px;
      }

      .qr-toolbar-title {
        font-weight: 600;
        font-size: 15px;
        color: #333;
      }

      .qr-toolbar-spacer {
        flex: 1;
      }

      .qr-send-mode-bar {
        display: flex;
        gap: 16px;
        padding: 8px 12px;
        border-bottom: 1px solid #e0e0e0;
        background: #f9f9f9;
      }

      .qr-send-mode-bar label {
        display: flex;
        align-items: center;
        gap: 4px;
        cursor: pointer;
        font-size: 13px;
      }

      .qr-settings-dropdown {
        position: relative;
      }

      .qr-dropdown-menu {
        position: absolute;
        top: 100%;
        right: 0;
        background: #fff;
        border: 1px solid #ddd;
        border-radius: 4px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.15);
        z-index: 100;
        min-width: 140px;
      }

      .qr-dropdown-item {
        padding: 8px 12px;
        cursor: pointer;
        font-size: 13px;
        white-space: nowrap;
      }

      .qr-dropdown-item:hover {
        background: #f5f5f5;
      }

      .qr-btn {
        padding: 6px 12px;
        border: 1px solid #ddd;
        background: #fff;
        border-radius: 4px;
        cursor: pointer;
        font-size: 14px;
      }

      .qr-btn:hover {
        background: #f5f5f5;
      }

      .qr-btn-icon {
        padding: 6px 10px;
      }

      .qr-btn-sm {
        padding: 4px 8px;
        font-size: 12px;
      }

      .qr-send-mode {
        display: flex;
        gap: 12px;
      }

      .qr-send-mode label {
        display: flex;
        align-items: center;
        gap: 4px;
        cursor: pointer;
        font-size: 13px;
      }

      .qr-search-box {
        padding: 10px;
        border-bottom: 1px solid #e0e0e0;
      }

      .qr-search-box input {
        width: 100%;
        padding: 8px 12px;
        border: 1px solid #ddd;
        border-radius: 4px;
        font-size: 14px;
      }

      .qr-content {
        flex: 1;
        display: flex;
        overflow: hidden;
      }

      .qr-groups {
        width: 200px;
        border-right: 1px solid #e0e0e0;
        overflow-y: auto;
        padding: 10px;
      }

      .qr-templates {
        flex: 1;
        overflow-y: auto;
        padding: 10px;
      }

      .qr-group-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 8px 12px;
        font-weight: 500;
        font-size: 14px;
        color: #333;
        border-bottom: 1px solid #e0e0e0;
        margin-bottom: 8px;
      }

      .qr-group-header .qr-btn-add-group {
        padding: 2px 6px;
        font-size: 12px;
      }

      .qr-group-item {
        padding: 8px 12px;
        cursor: pointer;
        border-radius: 4px;
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 14px;
      }

      .qr-group-item:hover {
        background: #f5f5f5;
      }

      .qr-group-item.active {
        background: #e3f2fd;
      }

      .qr-group-toggle {
        color: #666;
        font-size: 10px;
        width: 16px;
        text-align: center;
        cursor: pointer;
      }

      .qr-group-name {
        flex: 1;
        color: #666;
      }

      .qr-group-count {
        color: #999;
        font-size: 12px;
      }

      .qr-btn-edit-group,
      .qr-btn-delete-group {
        opacity: 0;
        font-size: 12px;
        padding: 2px 6px;
        transition: opacity 0.2s;
      }

      .qr-group-item:hover .qr-btn-edit-group,
      .qr-group-item:hover .qr-btn-delete-group {
        opacity: 1;
      }

      .qr-btn-edit-group:hover {
        background: #e3f2fd;
        border-color: #2196f3;
      }

      .qr-btn-delete-group:hover {
        background: #ffebee;
        border-color: #f44336;
      }

      .qr-template-item {
        border: 1px solid #e0e0e0;
        border-radius: 6px;
        padding: 12px;
        margin-bottom: 10px;
        background: #fff;
      }

      .qr-template-header {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 8px;
      }

      .qr-template-seq {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 20px;
        height: 20px;
        background: #f0f0f0;
        border-radius: 50%;
        font-size: 11px;
        color: #666;
        flex-shrink: 0;
      }

      .qr-template-header .qr-btn-edit,
      .qr-template-header .qr-btn-delete {
        opacity: 0;
        font-size: 12px;
        padding: 2px 6px;
        transition: opacity 0.2s;
      }

      .qr-template-header .qr-btn-edit {
        margin-left: auto;
      }

      .qr-template-item:hover .qr-btn-edit,
      .qr-template-item:hover .qr-btn-delete {
        opacity: 1;
      }

      .qr-btn-edit:hover {
        background: #e3f2fd;
        border-color: #2196f3;
      }

      .qr-btn-delete:hover {
        background: #ffebee;
        border-color: #f44336;
      }

      .qr-template-label {
        font-weight: 500;
        font-size: 14px;
      }

      .qr-template-preview {
        color: #666;
        font-size: 13px;
        margin-bottom: 10px;
        line-height: 1.4;
      }

      .qr-template-actions {
        display: flex;
        gap: 8px;
      }

      .qr-btn-send {
        background: #25D366;
        color: white;
        border-color: #25D366;
      }

      .qr-btn-send:hover {
        background: #20BA5A;
      }

      .qr-btn-insert {
        background: #0088cc;
        color: white;
        border-color: #0088cc;
      }

      .qr-btn-insert:hover {
        background: #0077b3;
      }

      .qr-status {
        padding: 8px 10px;
        border-top: 1px solid #e0e0e0;
        display: flex;
        gap: 16px;
        font-size: 12px;
        color: #666;
      }

      .qr-empty {
        padding: 20px;
        text-align: center;
        color: #999;
      }

      .qr-empty-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 40px 20px;
        text-align: center;
      }

      .qr-empty-icon {
        font-size: 48px;
        margin-bottom: 16px;
      }

      .qr-empty-title {
        font-size: 16px;
        font-weight: 500;
        color: #333;
        margin-bottom: 8px;
      }

      .qr-empty-desc {
        font-size: 14px;
        color: #666;
        margin-bottom: 20px;
      }

      .qr-btn-primary {
        background: #25D366;
        color: white;
        border-color: #25D366;
        padding: 10px 20px;
        font-size: 14px;
      }

      .qr-btn-primary:hover {
        background: #20BA5A;
      }

      .qr-btn-primary-sm {
        background: #25D366;
        color: white;
        border-color: #25D366;
        padding: 4px 10px;
        font-size: 13px;
      }

      .qr-btn-primary-sm:hover {
        background: #20BA5A;
      }

      .qr-btn-close {
        background: transparent;
        border: none;
        font-size: 16px;
        cursor: pointer;
        padding: 4px 8px;
      }

      .qr-create-form {
        border-bottom: 1px solid #e0e0e0;
        background: #f9f9f9;
      }

      .qr-form-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 10px 12px;
        border-bottom: 1px solid #e0e0e0;
        font-weight: 500;
      }

      .qr-form-body {
        padding: 12px;
      }

      .qr-form-group {
        margin-bottom: 12px;
      }

      .qr-form-group label {
        display: block;
        font-size: 13px;
        color: #666;
        margin-bottom: 4px;
      }

      .qr-form-group input,
      .qr-form-group textarea {
        width: 100%;
        padding: 8px 10px;
        border: 1px solid #ddd;
        border-radius: 4px;
        font-size: 14px;
        box-sizing: border-box;
      }

      .qr-form-group textarea {
        resize: vertical;
        min-height: 80px;
      }

      .qr-form-actions {
        display: flex;
        justify-content: flex-end;
        gap: 8px;
        margin-top: 12px;
      }

      /* Preview Modal */
      .qr-preview-modal {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0,0,0,0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
      }

      .qr-preview-content {
        background: #fff;
        border-radius: 8px;
        max-width: 500px;
        max-height: 80vh;
        width: 90%;
        overflow: hidden;
        box-shadow: 0 4px 20px rgba(0,0,0,0.2);
      }

      .qr-preview-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 12px 16px;
        border-bottom: 1px solid #e0e0e0;
        background: #f9f9f9;
      }

      .qr-preview-title {
        font-weight: 500;
        font-size: 15px;
      }

      .qr-preview-body {
        padding: 16px;
        max-height: 60vh;
        overflow-y: auto;
      }

      .qr-preview-text {
        white-space: pre-wrap;
        word-break: break-word;
        line-height: 1.6;
        font-size: 14px;
      }

      .qr-preview-image {
        max-width: 100%;
        border-radius: 4px;
      }

      .qr-preview-footer {
        display: flex;
        justify-content: flex-end;
        gap: 8px;
        padding: 12px 16px;
        border-top: 1px solid #e0e0e0;
      }

      /* Group Edit Input */
      .qr-group-edit-input {
        flex: 1;
        padding: 4px 8px;
        border: 1px solid #2196f3;
        border-radius: 4px;
        font-size: 14px;
        outline: none;
      }
    `;
    document.head.appendChild(style);
  }

  /**
   * Attach event listeners
   * @param {Object} data - Panel data
   */
  function attachEventListeners(data) {
    // Refresh button
    const refreshBtn = document.getElementById('qr-refresh-btn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => {
        if (currentAccountId) {
          loadQuickReplyContent(currentAccountId, true); // Force refresh
        }
      });
    }

    // Manage button - open management interface
    const manageBtn = document.getElementById('qr-manage-btn');
    if (manageBtn) {
      manageBtn.addEventListener('click', () => {
        if (window.electronAPI && window.electronAPI.quickReply && window.electronAPI.quickReply.openManagement) {
          window.electronAPI.quickReply.openManagement();
        } else {
          alert('管理界面功能正在开发中');
        }
      });
    }

    // Copy button
    const copyBtn = document.getElementById('qr-copy-btn');
    if (copyBtn) {
      copyBtn.addEventListener('click', () => {
        handleCopyTemplates();
      });
    }

    // Settings menu button
    const settingsBtn = document.getElementById('qr-settings-btn');
    const settingsMenu = document.getElementById('qr-settings-menu');
    if (settingsBtn && settingsMenu) {
      settingsBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        settingsMenu.style.display = settingsMenu.style.display === 'none' ? 'block' : 'none';
      });
      
      // Close menu when clicking outside
      document.addEventListener('click', () => {
        settingsMenu.style.display = 'none';
      });
      
      // Settings menu items
      settingsMenu.querySelectorAll('.qr-dropdown-item').forEach(item => {
        item.addEventListener('click', (e) => {
          e.stopPropagation();
          const action = item.dataset.action;
          handleSettingsAction(action);
          settingsMenu.style.display = 'none';
        });
      });
    }

    // Search input
    const searchInput = document.getElementById('qr-search-input');
    if (searchInput) {
      let searchTimeout;
      searchInput.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
          handleSearch(e.target.value);
        }, 300);
      });
    }

    // Send buttons
    document.querySelectorAll('.qr-btn-send').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const templateId = e.target.dataset.templateId;
        const mode = document.querySelector('input[name="send-mode"]:checked').value;
        handleSendTemplate(templateId, mode);
      });
    });

    // Insert buttons
    document.querySelectorAll('.qr-btn-insert').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const templateId = e.target.dataset.templateId;
        const mode = document.querySelector('input[name="send-mode"]:checked').value;
        handleInsertTemplate(templateId, mode);
      });
    });

    // Edit buttons
    document.querySelectorAll('.qr-btn-edit').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const templateId = e.target.dataset.templateId;
        // Decode URI-encoded values
        const label = decodeURIComponent(e.target.dataset.templateLabel || '');
        const content = decodeURIComponent(e.target.dataset.templateContent || '');
        showEditForm(templateId, label, content);
      });
    });

    // Delete buttons
    document.querySelectorAll('.qr-btn-delete').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const templateId = e.target.dataset.templateId;
        handleDeleteTemplate(templateId);
      });
    });

    // Template preview click - show full preview modal
    document.querySelectorAll('.qr-template-preview').forEach(preview => {
      preview.addEventListener('click', (e) => {
        const templateData = preview.dataset.templateFull;
        if (templateData) {
          try {
            const template = JSON.parse(decodeURIComponent(templateData));
            showPreviewModal(template);
          } catch (err) {
            console.error('[QuickReply] Failed to parse template data:', err);
          }
        }
      });
    });

    // Create first template button (shown when no templates exist)
    const createFirstBtn = document.getElementById('qr-create-first-btn');
    if (createFirstBtn) {
      createFirstBtn.addEventListener('click', () => {
        showCreateForm();
      });
    }

    // Create form buttons
    const formClose = document.getElementById('qr-form-close');
    const formCancel = document.getElementById('qr-form-cancel');
    const formSave = document.getElementById('qr-form-save');

    if (formClose) {
      formClose.addEventListener('click', hideCreateForm);
    }
    if (formCancel) {
      formCancel.addEventListener('click', hideCreateForm);
    }
    if (formSave) {
      formSave.addEventListener('click', handleSaveTemplate);
    }

    // Add template button in toolbar
    const addBtn = document.getElementById('qr-add-btn');
    if (addBtn) {
      addBtn.addEventListener('click', () => {
        showCreateForm();
      });
    }

    // Group toggle (expand/collapse)
    document.querySelectorAll('.qr-group-toggle').forEach(toggle => {
      toggle.addEventListener('click', (e) => {
        e.stopPropagation();
        const groupId = toggle.dataset.groupId;
        handleToggleGroup(groupId);
      });
    });

    // Group name click - select group and filter templates
    document.querySelectorAll('.qr-group-name').forEach(nameEl => {
      nameEl.addEventListener('click', (e) => {
        e.stopPropagation();
        const groupId = nameEl.dataset.groupId;
        handleSelectGroup(groupId, data);
      });
    });

    // Edit group buttons
    document.querySelectorAll('.qr-btn-edit-group').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const groupId = btn.dataset.groupId;
        handleEditGroup(groupId);
      });
    });

    // Add group button
    const addGroupBtn = document.querySelector('.qr-btn-add-group');
    if (addGroupBtn) {
      addGroupBtn.addEventListener('click', () => {
        handleCreateGroup();
      });
    }

    // Delete group buttons
    document.querySelectorAll('.qr-btn-delete-group').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const groupId = e.target.dataset.groupId;
        handleDeleteGroup(groupId);
      });
    });
  }

  /**
   * Show create template form
   */
  function showCreateForm() {
    const form = document.getElementById('qr-create-form');
    if (form) {
      form.style.display = 'block';
      // Focus on label input
      const labelInput = document.getElementById('qr-template-label');
      if (labelInput) {
        labelInput.focus();
      }
    }
  }

  /**
   * Hide create template form
   */
  function hideCreateForm() {
    const form = document.getElementById('qr-create-form');
    if (form) {
      form.style.display = 'none';
      // Clear inputs and edit state
      const labelInput = document.getElementById('qr-template-label');
      const contentInput = document.getElementById('qr-template-content');
      const formHeader = form.querySelector('.qr-form-header span');
      if (labelInput) labelInput.value = '';
      if (contentInput) contentInput.value = '';
      if (formHeader) formHeader.textContent = '创建新模板';
      // Clear edit mode
      delete form.dataset.editId;
    }
  }

  /**
   * Show edit template form
   * @param {string} templateId - Template ID
   * @param {string} label - Current label
   * @param {string} content - Current content
   */
  function showEditForm(templateId, label, content) {
    const form = document.getElementById('qr-create-form');
    if (form) {
      form.style.display = 'block';
      form.dataset.editId = templateId;
      
      // Update form header
      const formHeader = form.querySelector('.qr-form-header span');
      if (formHeader) formHeader.textContent = '编辑模板';
      
      // Fill in current values
      const labelInput = document.getElementById('qr-template-label');
      const contentInput = document.getElementById('qr-template-content');
      if (labelInput) labelInput.value = label || '';
      if (contentInput) contentInput.value = content || '';
      
      // Focus on label input
      if (labelInput) labelInput.focus();
    }
  }

  /**
   * Handle save template (create or update)
   */
  async function handleSaveTemplate() {
    const form = document.getElementById('qr-create-form');
    const labelInput = document.getElementById('qr-template-label');
    const contentInput = document.getElementById('qr-template-content');
    const saveBtn = document.getElementById('qr-form-save');

    const label = labelInput?.value?.trim();
    const content = contentInput?.value?.trim();
    const editId = form?.dataset?.editId;

    if (!label) {
      alert('请输入模板名称');
      labelInput?.focus();
      return;
    }

    if (!content) {
      alert('请输入模板内容');
      contentInput?.focus();
      return;
    }

    // Disable save button
    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.textContent = '保存中...';
    }

    try {
      let result;
      
      if (editId) {
        // Update existing template
        result = await window.electronAPI.quickReply.updateTemplate(editId, {
          label,
          content
        });
        
        if (result.success) {
          console.log('[QuickReply] Template updated:', result.template);
        }
      } else {
        // Create new template
        result = await window.electronAPI.quickReply.createTemplate({
          label,
          content
        });
        
        if (result.success) {
          console.log('[QuickReply] Template created:', result.template);
        }
      }

      if (result.success) {
        hideCreateForm();
        // Reload templates with force refresh
        if (currentAccountId) {
          loadQuickReplyContent(currentAccountId, true);
        }
      } else {
        alert((editId ? '更新' : '创建') + '失败: ' + (result.error || '未知错误'));
      }
    } catch (error) {
      console.error('[QuickReply] Save template error:', error);
      alert((editId ? '更新' : '创建') + '失败: ' + error.message);
    } finally {
      // Re-enable save button
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.textContent = '保存';
      }
    }
  }

  /**
   * Handle search
   * @param {string} keyword - Search keyword
   */
  function handleSearch(keyword) {
    console.log('[QuickReply] Searching:', keyword);
    
    // If keyword is empty, reload all templates
    if (!keyword || !keyword.trim()) {
      if (currentAccountId) {
        loadQuickReplyContent(currentAccountId, true);
      }
      return;
    }
    
    window.electronAPI.quickReply.searchTemplates(keyword).then(response => {
      if (response.success && response.results) {
        // Re-render with filtered results
        renderQuickReplyPanel({
          accountId: currentAccountId,
          templates: response.results.templates || [],
          groups: response.results.groups || [],
          templateCount: response.results.templates?.length || 0,
          groupCount: response.results.groups?.length || 0
        });
      } else {
        console.error('[QuickReply] Search failed:', response.error);
      }
    }).catch(error => {
      console.error('[QuickReply] Search error:', error);
    });
  }

  /**
   * Handle send template
   * @param {string} templateId - Template ID
   * @param {string} mode - Send mode
   */
  async function handleSendTemplate(templateId, mode) {
    console.log('[QuickReply] Sending template:', templateId, mode);
    
    try {
      const result = await window.electronAPI.quickReply.sendTemplate(templateId, mode);
      
      if (result.success) {
        console.log('[QuickReply] Template sent successfully');
        // Show success feedback (optional)
      } else {
        alert('发送失败: ' + (result.error || '未知错误'));
      }
    } catch (error) {
      console.error('[QuickReply] Send template error:', error);
      alert('发送失败: ' + error.message);
    }
  }

  /**
   * Handle insert template
   * @param {string} templateId - Template ID
   * @param {string} mode - Insert mode
   */
  async function handleInsertTemplate(templateId, mode) {
    console.log('[QuickReply] Inserting template:', templateId, mode);
    
    try {
      const result = await window.electronAPI.quickReply.insertTemplate(templateId, mode);
      
      if (result.success) {
        console.log('[QuickReply] Template inserted successfully');
        // Show success feedback (optional)
      } else {
        alert('插入失败: ' + (result.error || '未知错误'));
      }
    } catch (error) {
      console.error('[QuickReply] Insert template error:', error);
      alert('插入失败: ' + error.message);
    }
  }

  /**
   * Handle delete template
   * @param {string} templateId - Template ID
   */
  async function handleDeleteTemplate(templateId) {
    if (!confirm('确定要删除这个模板吗？')) {
      return;
    }

    console.log('[QuickReply] Deleting template:', templateId);
    
    try {
      const result = await window.electronAPI.quickReply.deleteTemplate(templateId);
      
      if (result.success) {
        console.log('[QuickReply] Template deleted');
        // Reload templates
        if (currentAccountId) {
          loadQuickReplyContent(currentAccountId, true);
        }
      } else {
        alert('删除失败: ' + (result.error || '未知错误'));
      }
    } catch (error) {
      console.error('[QuickReply] Delete template error:', error);
      alert('删除失败: ' + error.message);
    }
  }

  /**
   * Handle create group
   */
  async function handleCreateGroup() {
    const groupName = prompt('请输入分组名称:');
    
    if (!groupName || !groupName.trim()) {
      return;
    }

    console.log('[QuickReply] Creating group:', groupName);
    
    try {
      const result = await window.electronAPI.quickReply.createGroup(groupName.trim());
      
      if (result.success) {
        console.log('[QuickReply] Group created:', result.group);
        // Reload content
        if (currentAccountId) {
          loadQuickReplyContent(currentAccountId, true);
        }
      } else {
        alert('创建分组失败: ' + (result.error || '未知错误'));
      }
    } catch (error) {
      console.error('[QuickReply] Create group error:', error);
      alert('创建分组失败: ' + error.message);
    }
  }

  /**
   * Handle delete group
   * @param {string} groupId - Group ID
   */
  async function handleDeleteGroup(groupId) {
    if (!confirm('确定要删除这个分组吗？分组内的模板也会被删除。')) {
      return;
    }

    console.log('[QuickReply] Deleting group:', groupId);
    
    try {
      const result = await window.electronAPI.quickReply.deleteGroup(groupId);
      
      if (result.success) {
        console.log('[QuickReply] Group deleted');
        // Reload content
        if (currentAccountId) {
          loadQuickReplyContent(currentAccountId, true);
        }
      } else {
        alert('删除分组失败: ' + (result.error || '未知错误'));
      }
    } catch (error) {
      console.error('[QuickReply] Delete group error:', error);
      alert('删除分组失败: ' + error.message);
    }
  }

  /**
   * Handle toggle group expand/collapse
   * @param {string} groupId - Group ID
   */
  function handleToggleGroup(groupId) {
    if (expandedGroups.has(groupId)) {
      expandedGroups.delete(groupId);
    } else {
      expandedGroups.add(groupId);
    }
    
    // Update UI
    const groupItem = document.querySelector(`.qr-group-item[data-group-id="${groupId}"]`);
    const toggle = document.querySelector(`.qr-group-toggle[data-group-id="${groupId}"]`);
    
    if (groupItem && toggle) {
      if (expandedGroups.has(groupId)) {
        groupItem.classList.add('expanded');
        toggle.textContent = '▼';
      } else {
        groupItem.classList.remove('expanded');
        toggle.textContent = '▶';
      }
    }
    
    console.log('[QuickReply] Group toggled:', groupId, 'expanded:', expandedGroups.has(groupId));
  }

  /**
   * Handle select group - filter templates by group
   * @param {string} groupId - Group ID
   * @param {Object} data - Panel data
   */
  function handleSelectGroup(groupId, data) {
    // Update active state
    document.querySelectorAll('.qr-group-item').forEach(item => {
      item.classList.remove('active');
    });
    
    const groupItem = document.querySelector(`.qr-group-item[data-group-id="${groupId}"]`);
    if (groupItem) {
      groupItem.classList.add('active');
    }
    
    // Filter templates
    const templatesContainer = document.querySelector('.qr-templates');
    if (templatesContainer && data.templates) {
      templatesContainer.innerHTML = renderTemplates(data.templates, groupId);
      
      // Re-attach event listeners for new template elements
      attachTemplateEventListeners();
    }
    
    console.log('[QuickReply] Group selected:', groupId);
  }

  /**
   * Attach event listeners to template elements (after re-render)
   */
  function attachTemplateEventListeners() {
    // Send buttons
    document.querySelectorAll('.qr-btn-send').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const templateId = e.target.dataset.templateId;
        const mode = document.querySelector('input[name="send-mode"]:checked').value;
        handleSendTemplate(templateId, mode);
      });
    });

    // Insert buttons
    document.querySelectorAll('.qr-btn-insert').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const templateId = e.target.dataset.templateId;
        const mode = document.querySelector('input[name="send-mode"]:checked').value;
        handleInsertTemplate(templateId, mode);
      });
    });

    // Edit buttons
    document.querySelectorAll('.qr-btn-edit').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const templateId = e.target.dataset.templateId;
        const label = decodeURIComponent(e.target.dataset.templateLabel || '');
        const content = decodeURIComponent(e.target.dataset.templateContent || '');
        showEditForm(templateId, label, content);
      });
    });

    // Delete buttons
    document.querySelectorAll('.qr-btn-delete').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const templateId = e.target.dataset.templateId;
        handleDeleteTemplate(templateId);
      });
    });

    // Template preview click
    document.querySelectorAll('.qr-template-preview').forEach(preview => {
      preview.addEventListener('click', (e) => {
        const templateData = preview.dataset.templateFull;
        if (templateData) {
          try {
            const template = JSON.parse(decodeURIComponent(templateData));
            showPreviewModal(template);
          } catch (err) {
            console.error('[QuickReply] Failed to parse template data:', err);
          }
        }
      });
    });

    // Create first template button
    const createFirstBtn = document.getElementById('qr-create-first-btn');
    if (createFirstBtn) {
      createFirstBtn.addEventListener('click', () => {
        showCreateForm();
      });
    }
  }

  /**
   * Handle edit group name
   * @param {string} groupId - Group ID
   */
  function handleEditGroup(groupId) {
    const groupItem = document.querySelector(`.qr-group-item[data-group-id="${groupId}"]`);
    const nameEl = groupItem?.querySelector('.qr-group-name');
    
    if (!nameEl) return;
    
    const currentName = nameEl.textContent;
    
    // Replace name with input
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'qr-group-edit-input';
    input.value = currentName;
    
    nameEl.style.display = 'none';
    nameEl.parentNode.insertBefore(input, nameEl.nextSibling);
    input.focus();
    input.select();
    
    // Handle save on blur or enter
    const saveEdit = async () => {
      const newName = input.value.trim();
      input.remove();
      nameEl.style.display = '';
      
      if (newName && newName !== currentName) {
        try {
          const result = await window.electronAPI.quickReply.updateGroup(groupId, { name: newName });
          if (result.success) {
            nameEl.textContent = newName;
            console.log('[QuickReply] Group renamed:', groupId, newName);
          } else {
            alert('重命名失败: ' + (result.error || '未知错误'));
          }
        } catch (error) {
          console.error('[QuickReply] Rename group error:', error);
          alert('重命名失败: ' + error.message);
        }
      }
    };
    
    input.addEventListener('blur', saveEdit);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        input.blur();
      } else if (e.key === 'Escape') {
        input.value = currentName;
        input.blur();
      }
    });
  }

  /**
   * Show preview modal for template
   * @param {Object} template - Template object
   */
  function showPreviewModal(template) {
    // Remove existing modal if any
    const existingModal = document.querySelector('.qr-preview-modal');
    if (existingModal) {
      existingModal.remove();
    }
    
    const modal = document.createElement('div');
    modal.className = 'qr-preview-modal';
    
    let contentHtml = '';
    if (template.type === 'text') {
      contentHtml = `<div class="qr-preview-text">${escapeHtml(template.content?.text || '')}</div>`;
    } else if (template.type === 'image') {
      contentHtml = `<img class="qr-preview-image" src="${template.content?.path || ''}" alt="图片预览" />`;
    } else if (template.type === 'mixed') {
      contentHtml = `
        ${template.content?.imagePath ? `<img class="qr-preview-image" src="${template.content.imagePath}" alt="图片预览" />` : ''}
        <div class="qr-preview-text">${escapeHtml(template.content?.text || '')}</div>
      `;
    } else {
      contentHtml = `<div class="qr-preview-text">${template.type} 模板内容</div>`;
    }
    
    modal.innerHTML = `
      <div class="qr-preview-content">
        <div class="qr-preview-header">
          <span class="qr-preview-title">${escapeHtml(template.label || '模板预览')}</span>
          <button class="qr-btn qr-btn-icon qr-preview-close">✕</button>
        </div>
        <div class="qr-preview-body">
          ${contentHtml}
        </div>
        <div class="qr-preview-footer">
          <button class="qr-btn qr-preview-send" data-template-id="${template.id}">发送</button>
          <button class="qr-btn qr-preview-insert" data-template-id="${template.id}">输入框提示</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    // Event listeners
    modal.querySelector('.qr-preview-close').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.remove();
    });
    
    modal.querySelector('.qr-preview-send').addEventListener('click', () => {
      const mode = document.querySelector('input[name="send-mode"]:checked')?.value || 'original';
      handleSendTemplate(template.id, mode);
      modal.remove();
    });
    
    modal.querySelector('.qr-preview-insert').addEventListener('click', () => {
      const mode = document.querySelector('input[name="send-mode"]:checked')?.value || 'original';
      handleInsertTemplate(template.id, mode);
      modal.remove();
    });
  }

  /**
   * Handle copy templates
   */
  function handleCopyTemplates() {
    if (!currentData || !currentData.templates || currentData.templates.length === 0) {
      alert('暂无模板可复制');
      return;
    }
    
    // Copy all template labels to clipboard
    const labels = currentData.templates.map(t => t.label || '未命名').join('\n');
    navigator.clipboard.writeText(labels).then(() => {
      alert('已复制 ' + currentData.templates.length + ' 个模板名称到剪贴板');
    }).catch(err => {
      console.error('[QuickReply] Copy failed:', err);
      alert('复制失败');
    });
  }

  /**
   * Handle settings menu action
   * @param {string} action - Action name
   */
  async function handleSettingsAction(action) {
    console.log('[QuickReply] Settings action:', action);
    
    switch (action) {
      case 'import':
        // TODO: Implement import
        alert('导入功能正在开发中');
        break;
      case 'export':
        // TODO: Implement export
        alert('导出功能正在开发中');
        break;
      case 'clear-cache':
        if (confirm('确定要清空缓存吗？这将重新加载所有数据。')) {
          currentData = null;
          if (currentAccountId) {
            loadQuickReplyContent(currentAccountId, true);
          }
        }
        break;
    }
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeQuickReplyPanel);
  } else {
    initializeQuickReplyPanel();
  }

  // Export for testing
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      initializeQuickReplyPanel,
      showQuickReplyPanel,
      hideQuickReplyPanel,
      handleAccountSwitch
    };
  }
})();
