/**
 * Enhanced Quick Reply Panel Integration
 * 
 * 增强版快捷回复面板集成
 * 实现需求：1.1.1-1.1.9, 1.2.1-1.2.7
 * 
 * 主要功能：
 * - 标签切换（全部/公共/个人）
 * - 快捷回复管理按钮
 * - 序号显示
 * - 发送和插入按钮
 * - 数据同步
 */

(function () {
  'use strict';

  // Panel state
  let currentAccountId = null;
  let isLoading = false;
  let currentData = null;
  let activeTab = 'all'; // 'all' | 'public' | 'personal'
  let searchKeyword = '';
  let expandedGroups = new Set();
  let sendMode = 'original'; // 'original' | 'translated'

  // Tab type constants
  const TAB_TYPES = {
    ALL: 'all',
    PUBLIC: 'public',
    PERSONAL: 'personal'
  };

  const TAB_LABELS = {
    [TAB_TYPES.ALL]: '全部',
    [TAB_TYPES.PUBLIC]: '公共',
    [TAB_TYPES.PERSONAL]: '个人'
  };

  /**
   * Get current active account ID
   * @returns {Promise<string|null>} Account ID or null
   */
  async function getActiveAccountId() {
    if (window.SidebarState && typeof window.SidebarState.getActiveAccountId === 'function') {
      const accountId = window.SidebarState.getActiveAccountId();
      if (accountId) return accountId;
    }

    if (window.sidebar && typeof window.sidebar.getActiveAccountId === 'function') {
      const accountId = window.sidebar.getActiveAccountId();
      if (accountId) return accountId;
    }

    if (window.electronAPI && window.electronAPI.getActiveAccount) {
      try {
        const res = await window.electronAPI.getActiveAccount();
        return res?.accountId || null;
      } catch (error) {
        console.error('[QuickReply Enhanced] Failed to get active account:', error);
      }
    }

    return null;
  }

  /**
   * Initialize enhanced quick reply panel
   */
  function initializeEnhancedQuickReplyPanel() {
    console.log('[QuickReply Enhanced] Initializing enhanced quick reply panel');

    // Listen for panel switch events
    const quickReplyBtn = document.querySelector('[data-panel="quick-reply"]');
    if (quickReplyBtn) {
      quickReplyBtn.addEventListener('click', () => {
        showQuickReplyPanel();
      });
    }

    // Listen for account switch events
    if (window.electronAPI && window.electronAPI.quickReply) {
      if (window.electronAPI.quickReply.onAccountSwitch) {
        window.electronAPI.quickReply.onAccountSwitch((accountId) => {
          handleAccountSwitch(accountId);
        });
      }

      if (window.electronAPI.quickReply.onAccountSwitchError) {
        window.electronAPI.quickReply.onAccountSwitchError((data) => {
          handleAccountSwitchError(data);
        });
      }

      if (window.electronAPI.quickReply.onQuickReplyEvent) {
        window.electronAPI.quickReply.onQuickReplyEvent((event, data) => {
          handleQuickReplyEvent(event, data);
        });
      }
    }

    // Listen for account:active-changed event
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
    console.log('[QuickReply Enhanced] Showing quick reply panel');

    // Hide other panels
    const translatePanel = document.getElementById('translate-panel-body');
    const environmentPanel = document.getElementById('environment-panel-body');
    if (translatePanel) translatePanel.style.display = 'none';
    if (environmentPanel) environmentPanel.style.display = 'none';

    // Show quick reply panel
    const quickReplyPanel = document.getElementById('quick-reply-panel-body');
    if (quickReplyPanel) quickReplyPanel.style.display = 'block';

    // Update active button
    document.querySelectorAll('.panel-menu-btn').forEach(btn => {
      btn.classList.remove('active');
    });
    const activeBtn = document.querySelector('[data-panel="quick-reply"]');
    if (activeBtn) activeBtn.classList.add('active');

    // Sync with TranslatePanelLayout
    if (window.TranslatePanelLayout && window.TranslatePanelLayout.setActivePanel) {
      window.TranslatePanelLayout.setActivePanel('quick-reply');
    }

    // Get current active account if not set
    if (!currentAccountId) {
      const activeId = await getActiveAccountId();
      if (activeId) {
        console.log('[QuickReply Enhanced] Got active account:', activeId);
        currentAccountId = activeId;
      }
    }

    // Load quick reply content if account is selected
    if (currentAccountId) {
      loadQuickReplyContent(currentAccountId);
    } else {
      console.log('[QuickReply Enhanced] No active account, showing placeholder');
    }
  }

  /**
   * Handle account switch
   * @param {string} accountId - Account ID
   */
  async function handleAccountSwitch(accountId) {
    console.log('[QuickReply Enhanced] Account switched:', accountId);

    if (isLoading) {
      console.log('[QuickReply Enhanced] Already loading, skipping switch');
      return;
    }

    if (currentAccountId === accountId) {
      console.log('[QuickReply Enhanced] Already on this account, skipping switch');
      return;
    }

    const previousAccountId = currentAccountId;

    try {
      showSwitchingIndicator(previousAccountId, accountId);
      await unloadCurrentData();
      currentAccountId = accountId;
      await loadAccountData(accountId);

      const quickReplyPanel = document.getElementById('quick-reply-panel-body');
      if (quickReplyPanel && quickReplyPanel.style.display !== 'none') {
        await refreshUI();
      }

      console.log('[QuickReply Enhanced] Account switch completed:', { from: previousAccountId, to: accountId });
    } catch (error) {
      console.error('[QuickReply Enhanced] Account switch failed:', error);
      showError(`账号切换失败: ${error.message}`);

      if (previousAccountId) {
        currentAccountId = previousAccountId;
        await loadAccountData(previousAccountId);
      }
    }
  }

  /**
   * Handle account switch error
   */
  function handleAccountSwitchError(data) {
    console.error('[QuickReply Enhanced] Account switch error:', data);
    showError(`账号切换失败: ${data.error || '未知错误'}`);
  }

  /**
   * Show switching indicator
   */
  function showSwitchingIndicator(fromAccountId, toAccountId) {
    const host = document.getElementById('quick-reply-host');
    if (host) {
      host.innerHTML = `
        <div class="qr-loading-container">
          <div class="qr-loading-spinner"></div>
          <div class="qr-loading-text">正在切换账号...</div>
          <div class="qr-loading-subtext">
            ${fromAccountId ? `从 ${fromAccountId.substring(0, 8)}... 切换到 ${toAccountId.substring(0, 8)}...` : `切换到 ${toAccountId.substring(0, 8)}...`}
          </div>
        </div>
      `;
    }
  }

  /**
   * Unload current data
   */
  async function unloadCurrentData() {
    console.log('[QuickReply Enhanced] Unloading current data');
    currentData = null;
    const host = document.getElementById('quick-reply-host');
    if (host) {
      host.innerHTML = '';
    }
  }

  /**
   * Load account data
   */
  async function loadAccountData(accountId) {
    console.log('[QuickReply Enhanced] Loading account data:', accountId);

    if (!accountId) {
      console.warn('[QuickReply Enhanced] No account ID provided');
      return;
    }

    isLoading = true;

    try {
      const result = await window.electronAPI.quickReply.load(accountId);

      if (result.success) {
        currentData = result;
        console.log('[QuickReply Enhanced] Account data loaded:', {
          accountId,
          templates: result.templateCount,
          groups: result.groupCount
        });
      } else {
        throw new Error(result.error || '加载失败');
      }
    } catch (error) {
      console.error('[QuickReply Enhanced] Failed to load account data:', error);
      throw error;
    } finally {
      isLoading = false;
    }
  }

  /**
   * Refresh UI
   */
  async function refreshUI() {
    console.log('[QuickReply Enhanced] Refreshing UI');

    try {
      if (currentData) {
        renderEnhancedQuickReplyPanel(currentData);
      } else {
        const host = document.getElementById('quick-reply-host');
        if (host) {
          host.innerHTML = '<div class="qr-empty-state"><div class="qr-empty-icon">📭</div><div class="qr-empty-text">暂无数据</div></div>';
        }
      }
    } catch (error) {
      console.error('[QuickReply Enhanced] Failed to refresh UI:', error);
      showError(`UI刷新失败: ${error.message}`);
    }
  }

  /**
   * Show error message
   */
  function showError(message) {
    const host = document.getElementById('quick-reply-host');
    if (host) {
      host.innerHTML = `
        <div class="qr-error-container">
          <div class="qr-error-icon">❌</div>
          <div class="qr-error-message">${escapeHtml(message)}</div>
          <button class="qr-btn qr-btn-primary" onclick="location.reload()">重新加载</button>
        </div>
      `;
    }
  }

  /**
   * Load quick reply content for account
   */
  async function loadQuickReplyContent(accountId, forceRefresh = false) {
    console.log('[QuickReply Enhanced] Loading content for account:', accountId, 'forceRefresh:', forceRefresh);

    const placeholder = document.getElementById('quick-reply-panel-placeholder');
    const host = document.getElementById('quick-reply-host');

    if (!accountId) {
      if (placeholder) placeholder.style.display = 'block';
      if (host) host.style.display = 'none';
      return;
    }

    if (placeholder) placeholder.style.display = 'none';
    if (host) host.style.display = 'block';

    if (!forceRefresh && currentAccountId === accountId && currentData) {
      renderEnhancedQuickReplyPanel(currentData);
      return;
    }

    if (host) {
      host.innerHTML = `
        <div class="qr-loading-container">
          <div class="qr-loading-spinner"></div>
          <div class="qr-loading-text">加载中...</div>
        </div>
      `;
    }

    try {
      currentData = null;
      await loadAccountData(accountId);
      await refreshUI();
    } catch (error) {
      console.error('[QuickReply Enhanced] Load error:', error);
      showError(`加载失败: ${error.message}`);
    }
  }

  /**
   * Handle quick reply events from main process
   */
  function handleQuickReplyEvent(event, data) {
    console.log('[QuickReply Enhanced] Event received:', event, data);

    switch (event) {
      case 'loaded':
        renderEnhancedQuickReplyPanel(data);
        break;
      case 'template:created':
      case 'template:updated':
      case 'template:deleted':
      case 'group:created':
      case 'group:updated':
      case 'group:deleted':
        if (currentAccountId) {
          loadQuickReplyContent(currentAccountId, true);
        }
        break;
      default:
        console.warn('[QuickReply Enhanced] Unknown event:', event);
    }
  }

  /**
   * Render enhanced quick reply panel with tabs
   * 需求：1.1.1-1.1.9
   * @param {Object} data - Panel data
   */
  function renderEnhancedQuickReplyPanel(data) {
    console.log('[QuickReply Enhanced] Rendering panel with data:', data);

    const host = document.getElementById('quick-reply-host');
    if (!host) return;

    const templates = data.templates || [];
    const groups = data.groups || [];

    // Filter templates by active tab
    const filteredTemplates = filterTemplatesByTab(templates, activeTab);

    host.innerHTML = `
      <div class="qr-enhanced-panel">
        <!-- Tab Switcher -->
        <div class="qr-tab-switcher">
          <button class="qr-tab ${activeTab === 'all' ? 'active' : ''}" data-tab="all">
            ${TAB_LABELS[TAB_TYPES.ALL]}
          </button>
          <button class="qr-tab ${activeTab === 'public' ? 'active' : ''}" data-tab="public">
            ${TAB_LABELS[TAB_TYPES.PUBLIC]}
          </button>
          <button class="qr-tab ${activeTab === 'personal' ? 'active' : ''}" data-tab="personal">
            ${TAB_LABELS[TAB_TYPES.PERSONAL]}
          </button>
        </div>

        <!-- Management Button -->
        <div class="qr-management-bar">
          <button class="qr-btn qr-btn-management" id="qr-open-management">
            <span class="qr-btn-icon">⚙️</span>
            <span>快捷回复管理</span>
          </button>
        </div>

        <!-- Search Box -->
        <div class="qr-search-box">
          <input type="text" id="qr-search-input" placeholder="🔍 搜索模板..." value="${escapeHtml(searchKeyword)}" />
        </div>

        <!-- Send Mode Toggle -->
        <div class="qr-send-mode-bar">
          <label class="qr-radio-label">
            <input type="radio" name="qr-send-mode" value="original" ${sendMode === 'original' ? 'checked' : ''}>
            <span>原文</span>
          </label>
          <label class="qr-radio-label">
            <input type="radio" name="qr-send-mode" value="translated" ${sendMode === 'translated' ? 'checked' : ''}>
            <span>翻译</span>
          </label>
        </div>

        <!-- Content Area -->
        <div class="qr-content-area">
          ${renderTemplatesWithSequence(filteredTemplates, groups)}
        </div>

        <!-- Status Bar -->
        <div class="qr-status-bar">
          <span>📋 ${filteredTemplates.length} 个模板</span>
          ${activeTab !== 'all' ? `<span class="qr-filter-hint">(${TAB_LABELS[activeTab]})</span>` : ''}
        </div>
      </div>
    `;

    // Add enhanced styles
    addEnhancedStyles();

    // Attach event listeners
    attachEnhancedEventListeners(data);
  }

  /**
   * Filter templates by tab type
   * 需求：1.1.2, 1.1.3, 1.1.4
   * @param {Array} templates - All templates
   * @param {string} tab - Active tab
   * @returns {Array} Filtered templates
   */
  function filterTemplatesByTab(templates, tab) {
    if (tab === TAB_TYPES.ALL) {
      return templates;
    }
    return templates.filter(t => t.visibility === tab);
  }

  /**
   * Render templates with sequence numbers
   * 需求：1.1.8, 1.1.9
   * @param {Array} templates - Templates to render
   * @param {Array} groups - Groups for reference
   * @returns {string} HTML string
   */
  function renderTemplatesWithSequence(templates, groups) {
    if (!templates || templates.length === 0) {
      return `
        <div class="qr-empty-state">
          <div class="qr-empty-icon">💬</div>
          <div class="qr-empty-title">暂无快捷回复</div>
          <div class="qr-empty-desc">点击"快捷回复管理"按钮添加模板</div>
        </div>
      `;
    }

    // Group templates by groupId
    const groupedTemplates = {};
    const ungroupedTemplates = [];

    templates.forEach(template => {
      if (template.groupId) {
        if (!groupedTemplates[template.groupId]) {
          groupedTemplates[template.groupId] = [];
        }
        groupedTemplates[template.groupId].push(template);
      } else {
        ungroupedTemplates.push(template);
      }
    });

    let html = '';
    let sequenceNumber = 1;

    // Render grouped templates
    groups.forEach(group => {
      const groupTemplates = groupedTemplates[group.id] || [];
      if (groupTemplates.length === 0) return;

      const isExpanded = expandedGroups.has(group.id);

      html += `
        <div class="qr-group" data-group-id="${group.id}">
          <div class="qr-group-header" data-group-id="${group.id}">
            <span class="qr-group-arrow">${isExpanded ? '▼' : '▶'}</span>
            <span class="qr-group-icon">📁</span>
            <span class="qr-group-name">${escapeHtml(group.name)}</span>
            <span class="qr-group-count">(${groupTemplates.length})</span>
          </div>
          <div class="qr-group-content" style="display: ${isExpanded ? 'block' : 'none'}">
            ${groupTemplates.map(template => renderTemplateItem(template, sequenceNumber++)).join('')}
          </div>
        </div>
      `;
    });

    // Render ungrouped templates
    if (ungroupedTemplates.length > 0) {
      html += `
        <div class="qr-ungrouped">
          ${ungroupedTemplates.map(template => renderTemplateItem(template, sequenceNumber++)).join('')}
        </div>
      `;
    }

    return html;
  }

  /**
   * Render single template item with sequence number
   * 需求：1.1.8, 1.1.9
   * @param {Object} template - Template object
   * @param {number} seq - Sequence number
   * @returns {string} HTML string
   */
  function renderTemplateItem(template, seq) {
    const typeIcon = getTypeIcon(template.type);
    const preview = getTemplatePreview(template);
    const visibilityBadge = template.visibility === 'public' 
      ? '<span class="qr-badge qr-badge-public">公共</span>' 
      : '<span class="qr-badge qr-badge-personal">个人</span>';

    return `
      <div class="qr-template-item" data-template-id="${template.id}">
        <div class="qr-template-seq">${seq}</div>
        <div class="qr-template-main">
          <div class="qr-template-header">
            <span class="qr-template-type">${typeIcon}</span>
            <span class="qr-template-label">${escapeHtml(template.label || '未命名')}</span>
            ${visibilityBadge}
          </div>
          <div class="qr-template-preview">${preview}</div>
        </div>
        <div class="qr-template-actions">
          <button class="qr-btn qr-btn-action qr-btn-send" data-template-id="${template.id}" title="发送">
            发送
          </button>
          <button class="qr-btn qr-btn-action qr-btn-insert" data-template-id="${template.id}" title="插入到输入框">
            插入
          </button>
        </div>
      </div>
    `;
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
      imageText: '📎',
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
      return escapeHtml(text.substring(0, 80) + (text.length > 80 ? '...' : ''));
    }
    if (template.type === 'image') {
      return '🖼️ 图片';
    }
    if (template.type === 'video') {
      return '🎬 视频';
    }
    if (template.type === 'audio') {
      return '🎵 音频';
    }
    if (template.type === 'mixed' || template.type === 'imageText') {
      const text = template.content?.text || '';
      return '📎 ' + escapeHtml(text.substring(0, 60) + (text.length > 60 ? '...' : ''));
    }
    return `📄 ${template.type || '未知'}`;
  }

  /**
   * Escape HTML
   * @param {string} text - Text to escape
   * @returns {string} Escaped text
   */
  function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Add enhanced styles
   */
  function addEnhancedStyles() {
    if (document.getElementById('qr-enhanced-styles')) {
      return;
    }

    const style = document.createElement('style');
    style.id = 'qr-enhanced-styles';
    style.textContent = `
      /* Enhanced Quick Reply Panel Styles */
      .qr-enhanced-panel {
        display: flex;
        flex-direction: column;
        height: 100%;
        background: #1a1a1a;
        color: #e0e0e0;
        font-size: 13px;
      }

      /* Tab Switcher */
      .qr-tab-switcher {
        display: flex;
        padding: 8px;
        gap: 4px;
        background: #252525;
        border-bottom: 1px solid #333;
      }

      .qr-tab {
        flex: 1;
        padding: 8px 12px;
        border: none;
        border-radius: 6px;
        background: transparent;
        color: #888;
        cursor: pointer;
        font-size: 13px;
        transition: all 0.2s;
      }

      .qr-tab:hover {
        background: #333;
        color: #fff;
      }

      .qr-tab.active {
        background: #0066cc;
        color: #fff;
      }

      /* Management Bar */
      .qr-management-bar {
        padding: 8px;
        border-bottom: 1px solid #333;
      }

      .qr-btn-management {
        width: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        padding: 10px 16px;
        border: none;
        border-radius: 6px;
        background: #0066cc;
        color: #fff;
        cursor: pointer;
        font-size: 14px;
        font-weight: 500;
        transition: background 0.2s;
      }

      .qr-btn-management:hover {
        background: #0055aa;
      }

      .qr-btn-icon {
        font-size: 16px;
      }

      /* Search Box */
      .qr-search-box {
        padding: 8px;
        border-bottom: 1px solid #333;
      }

      .qr-search-box input {
        width: 100%;
        padding: 8px 12px;
        border: 1px solid #444;
        border-radius: 6px;
        background: #2a2a2a;
        color: #e0e0e0;
        font-size: 13px;
        box-sizing: border-box;
      }

      .qr-search-box input:focus {
        outline: none;
        border-color: #0066cc;
      }

      .qr-search-box input::placeholder {
        color: #666;
      }

      /* Send Mode Bar */
      .qr-send-mode-bar {
        display: flex;
        gap: 16px;
        padding: 8px 12px;
        background: #252525;
        border-bottom: 1px solid #333;
      }

      .qr-radio-label {
        display: flex;
        align-items: center;
        gap: 4px;
        cursor: pointer;
        color: #aaa;
        font-size: 12px;
      }

      .qr-radio-label input[type="radio"] {
        accent-color: #0066cc;
      }

      /* Content Area */
      .qr-content-area {
        flex: 1;
        overflow-y: auto;
        padding: 8px;
      }

      /* Group */
      .qr-group {
        margin-bottom: 8px;
      }

      .qr-group-header {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 8px;
        background: #2a2a2a;
        border-radius: 6px;
        cursor: pointer;
        user-select: none;
      }

      .qr-group-header:hover {
        background: #333;
      }

      .qr-group-arrow {
        font-size: 10px;
        color: #888;
        width: 12px;
      }

      .qr-group-icon {
        font-size: 14px;
      }

      .qr-group-name {
        flex: 1;
        font-weight: 500;
      }

      .qr-group-count {
        color: #666;
        font-size: 12px;
      }

      .qr-group-content {
        padding-left: 8px;
        margin-top: 4px;
      }

      /* Template Item */
      .qr-template-item {
        display: flex;
        align-items: flex-start;
        gap: 8px;
        padding: 10px;
        margin-bottom: 6px;
        background: #2a2a2a;
        border-radius: 6px;
        transition: background 0.2s;
      }

      .qr-template-item:hover {
        background: #333;
      }

      .qr-template-seq {
        width: 24px;
        height: 24px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: #444;
        border-radius: 50%;
        font-size: 12px;
        font-weight: 600;
        color: #fff;
        flex-shrink: 0;
      }

      .qr-template-main {
        flex: 1;
        min-width: 0;
      }

      .qr-template-header {
        display: flex;
        align-items: center;
        gap: 6px;
        margin-bottom: 4px;
      }

      .qr-template-type {
        font-size: 14px;
      }

      .qr-template-label {
        font-weight: 500;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .qr-badge {
        padding: 2px 6px;
        border-radius: 4px;
        font-size: 10px;
        font-weight: 500;
      }

      .qr-badge-public {
        background: #1a4d1a;
        color: #4caf50;
      }

      .qr-badge-personal {
        background: #4d3d1a;
        color: #ff9800;
      }

      .qr-template-preview {
        color: #888;
        font-size: 12px;
        line-height: 1.4;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .qr-template-actions {
        display: flex;
        flex-direction: column;
        gap: 4px;
        flex-shrink: 0;
      }

      .qr-btn-action {
        padding: 6px 12px;
        border: none;
        border-radius: 4px;
        font-size: 12px;
        cursor: pointer;
        transition: all 0.2s;
      }

      .qr-btn-send {
        background: #0066cc;
        color: #fff;
      }

      .qr-btn-send:hover {
        background: #0055aa;
      }

      .qr-btn-insert {
        background: #444;
        color: #e0e0e0;
      }

      .qr-btn-insert:hover {
        background: #555;
      }

      /* Empty State */
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
        margin-bottom: 8px;
      }

      .qr-empty-desc {
        color: #666;
        font-size: 13px;
      }

      /* Status Bar */
      .qr-status-bar {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px 12px;
        background: #252525;
        border-top: 1px solid #333;
        font-size: 12px;
        color: #888;
      }

      .qr-filter-hint {
        color: #0066cc;
      }

      /* Loading */
      .qr-loading-container {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 40px;
      }

      .qr-loading-spinner {
        width: 32px;
        height: 32px;
        border: 3px solid #333;
        border-top-color: #0066cc;
        border-radius: 50%;
        animation: qr-spin 1s linear infinite;
      }

      @keyframes qr-spin {
        to { transform: rotate(360deg); }
      }

      .qr-loading-text {
        margin-top: 12px;
        color: #888;
      }

      .qr-loading-subtext {
        margin-top: 4px;
        font-size: 11px;
        color: #666;
      }

      /* Error */
      .qr-error-container {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 40px;
        text-align: center;
      }

      .qr-error-icon {
        font-size: 32px;
        margin-bottom: 12px;
      }

      .qr-error-message {
        color: #ff6b6b;
        margin-bottom: 16px;
      }

      .qr-btn-primary {
        padding: 8px 16px;
        border: none;
        border-radius: 6px;
        background: #0066cc;
        color: #fff;
        cursor: pointer;
      }

      .qr-btn-primary:hover {
        background: #0055aa;
      }

      /* Scrollbar */
      .qr-content-area::-webkit-scrollbar {
        width: 6px;
      }

      .qr-content-area::-webkit-scrollbar-track {
        background: #1a1a1a;
      }

      .qr-content-area::-webkit-scrollbar-thumb {
        background: #444;
        border-radius: 3px;
      }

      .qr-content-area::-webkit-scrollbar-thumb:hover {
        background: #555;
      }
    `;
    document.head.appendChild(style);
  }

  /**
   * Attach enhanced event listeners
   * @param {Object} data - Panel data
   */
  function attachEnhancedEventListeners(data) {
    // Tab switching
    document.querySelectorAll('.qr-tab').forEach(tab => {
      tab.addEventListener('click', (e) => {
        const newTab = e.target.dataset.tab;
        if (newTab && newTab !== activeTab) {
          activeTab = newTab;
          renderEnhancedQuickReplyPanel(currentData);
        }
      });
    });

    // Management button
    const managementBtn = document.getElementById('qr-open-management');
    if (managementBtn) {
      managementBtn.addEventListener('click', () => {
        openManagementWindow();
      });
    }

    // Search input
    const searchInput = document.getElementById('qr-search-input');
    if (searchInput) {
      let searchTimeout;
      searchInput.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
          searchKeyword = e.target.value;
          handleSearch(searchKeyword);
        }, 300);
      });
    }

    // Send mode toggle
    document.querySelectorAll('input[name="qr-send-mode"]').forEach(radio => {
      radio.addEventListener('change', (e) => {
        sendMode = e.target.value;
      });
    });

    // Group headers (expand/collapse)
    document.querySelectorAll('.qr-group-header').forEach(header => {
      header.addEventListener('click', (e) => {
        const groupId = header.dataset.groupId;
        if (expandedGroups.has(groupId)) {
          expandedGroups.delete(groupId);
        } else {
          expandedGroups.add(groupId);
        }
        renderEnhancedQuickReplyPanel(currentData);
      });
    });

    // Send buttons
    document.querySelectorAll('.qr-btn-send').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const templateId = e.target.dataset.templateId;
        handleSendTemplate(templateId, sendMode);
      });
    });

    // Insert buttons
    document.querySelectorAll('.qr-btn-insert').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const templateId = e.target.dataset.templateId;
        handleInsertTemplate(templateId, sendMode);
      });
    });
  }

  /**
   * Open management window
   * 需求：1.1, 1.2
   */
  function openManagementWindow() {
    console.log('[QuickReply Enhanced] Opening management window');
    if (window.electronAPI && window.electronAPI.quickReply && window.electronAPI.quickReply.openManagement) {
      window.electronAPI.quickReply.openManagement()
        .then(result => {
          console.log('[QuickReply Enhanced] Management window opened:', result);
        })
        .catch(error => {
          console.error('[QuickReply Enhanced] Failed to open management window:', error);
          alert('打开管理窗口失败: ' + (error.message || error));
        });
    } else {
      console.error('[QuickReply Enhanced] openManagement API not available');
      console.log('[QuickReply Enhanced] electronAPI:', window.electronAPI);
      console.log('[QuickReply Enhanced] quickReply:', window.electronAPI?.quickReply);
      alert('管理窗口功能暂不可用');
    }
  }

  /**
   * Handle search
   * @param {string} keyword - Search keyword
   */
  function handleSearch(keyword) {
    console.log('[QuickReply Enhanced] Searching:', keyword);

    if (!keyword || !keyword.trim()) {
      if (currentAccountId && currentData) {
        renderEnhancedQuickReplyPanel(currentData);
      }
      return;
    }

    if (window.electronAPI && window.electronAPI.quickReply && window.electronAPI.quickReply.searchTemplates) {
      window.electronAPI.quickReply.searchTemplates(keyword).then(response => {
        if (response.success && response.results) {
          renderEnhancedQuickReplyPanel({
            accountId: currentAccountId,
            templates: response.results.templates || [],
            groups: response.results.groups || [],
            templateCount: response.results.templates?.length || 0,
            groupCount: response.results.groups?.length || 0
          });
        }
      }).catch(error => {
        console.error('[QuickReply Enhanced] Search error:', error);
      });
    }
  }

  /**
   * Handle send template
   * @param {string} templateId - Template ID
   * @param {string} mode - Send mode
   */
  async function handleSendTemplate(templateId, mode) {
    console.log('[QuickReply Enhanced] Sending template:', templateId, mode);

    try {
      const result = await window.electronAPI.quickReply.sendTemplate(templateId, mode);

      if (result.success) {
        console.log('[QuickReply Enhanced] Template sent successfully');
      } else {
        alert('发送失败: ' + (result.error || '未知错误'));
      }
    } catch (error) {
      console.error('[QuickReply Enhanced] Send template error:', error);
      alert('发送失败: ' + error.message);
    }
  }

  /**
   * Handle insert template
   * @param {string} templateId - Template ID
   * @param {string} mode - Insert mode
   */
  async function handleInsertTemplate(templateId, mode) {
    console.log('[QuickReply Enhanced] Inserting template:', templateId, mode);

    try {
      const result = await window.electronAPI.quickReply.insertTemplate(templateId, mode);

      if (result.success) {
        console.log('[QuickReply Enhanced] Template inserted successfully');
      } else {
        alert('插入失败: ' + (result.error || '未知错误'));
      }
    } catch (error) {
      console.error('[QuickReply Enhanced] Insert template error:', error);
      alert('插入失败: ' + error.message);
    }
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeEnhancedQuickReplyPanel);
  } else {
    initializeEnhancedQuickReplyPanel();
  }

  // Export for testing
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      initializeEnhancedQuickReplyPanel,
      showQuickReplyPanel,
      handleAccountSwitch,
      filterTemplatesByTab,
      renderTemplatesWithSequence
    };
  }
})();
