/**
 * Quick Reply Panel Integration
 * 
 * Handles the quick reply panel display and integration with the main window
 */

(function () {
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
          <button class="qr-btn qr-btn-icon" id="qr-refresh-btn" title="刷新">
            <span>🔄</span>
          </button>
          <button class="qr-btn qr-btn-primary-sm" id="qr-add-btn" title="添加模板">
            <span>➕ 添加模板</span>
          </button>
          <div class="qr-toolbar-spacer"></div>
          <div class="qr-send-mode">
            <label>
              <input type="radio" name="send-mode" value="original" checked>
              <span>原文</span>
            </label>
            <label>
              <input type="radio" name="send-mode" value="translated">
              <span>翻译</span>
            </label>
          </div>
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
          <input type="text" id="qr-search-input" placeholder="🔍 搜索模板..." />
        </div>

        <!-- Content Area - Single Column -->
        <div class="qr-content">
          <div class="qr-templates">
            ${renderTemplates(templates)}
          </div>
        </div>

        <!-- Status -->
        <div class="qr-status">
          <span>📋 ${templates.length} 个模板</span>
          <span>📁 ${groups.length} 个分组</span>
        </div>
      </div>
    `;

    // Add styles
    addQuickReplyStyles();

    // Attach event listeners
    attachEventListeners(data);
  }

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
      html += groups.map(group => `
        <div class="qr-group-item" data-group-id="${group.id}">
          <span class="qr-group-icon">${group.expanded ? '📂' : '📁'}</span>
          <span class="qr-group-name">${escapeHtml(group.name)}</span>
          <span class="qr-group-count">(${group.templateCount || 0})</span>
          <button class="qr-btn qr-btn-icon qr-btn-delete-group" data-group-id="${group.id}" title="删除分组">🗑️</button>
        </div>
      `).join('');
    }

    return html;
  }

  /**
   * Render templates
   * @param {Array} templates - Templates array
   * @returns {string} HTML string
   */
  function renderTemplates(templates) {
    if (!templates || templates.length === 0) {
      return `
        <div class="qr-empty-state">
          <div class="qr-empty-icon">💬</div>
          <div class="qr-empty-title">还没有快捷回复</div>
          <div class="qr-empty-desc">创建模板来快速发送常用消息</div>
          <button class="qr-btn qr-btn-primary" id="qr-create-first-btn">
            ➕ 创建第一个模板
          </button>
        </div>
      `;
    }

    return templates.map(template => `
      <div class="qr-template-item" data-template-id="${template.id}">
        <div class="qr-template-header">
          <span class="qr-template-type">${getTypeIcon(template.type)}</span>
          <span class="qr-template-label">${escapeHtml(template.label || '未命名')}</span>
          <button class="qr-btn qr-btn-icon qr-btn-edit" data-template-id="${template.id}" data-template-label="${encodeURIComponent(template.label || '')}" data-template-content="${encodeURIComponent(template.content?.text || '')}" title="编辑">
            ✏️
          </button>
          <button class="qr-btn qr-btn-icon qr-btn-delete" data-template-id="${template.id}" title="删除">
            🗑️
          </button>
        </div>
        <div class="qr-template-preview">
          ${getTemplatePreview(template)}
        </div>
        <div class="qr-template-actions">
          <button class="qr-btn qr-btn-sm qr-btn-send" data-template-id="${template.id}">
            发送
          </button>
          <button class="qr-btn qr-btn-sm qr-btn-insert" data-template-id="${template.id}">
            插入
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
      // Show more text in single-column layout
      return escapeHtml(text.substring(0, 100) + (text.length > 100 ? '...' : ''));
    }
    if (template.type === 'image') {
      return '🖼️ 图片模板';
    }
    if (template.type === 'video') {
      return '🎬 视频模板';
    }
    if (template.type === 'audio') {
      return '🎵 音频模板';
    }
    if (template.type === 'mixed') {
      const text = template.content?.text || '';
      return '📎 ' + escapeHtml(text.substring(0, 80) + (text.length > 80 ? '...' : ''));
    }
    return `📄 ${template.type || '未知'} 模板`;
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
   * Loads external CSS stylesheet for dark theme design
   */
  function addQuickReplyStyles() {
    if (document.getElementById('quick-reply-styles-link')) {
      return;
    }

    // Load external CSS file
    const link = document.createElement('link');
    link.id = 'quick-reply-styles-link';
    link.rel = 'stylesheet';
    link.type = 'text/css';
    link.href = './quick-reply-panel.css';
    document.head.appendChild(link);
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

    // Manage button
    const manageBtn = document.getElementById('qr-manage-btn');
    if (manageBtn) {
      manageBtn.addEventListener('click', () => {
        window.electronAPI.quickReply.openManagement();
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

    // Create first template button (shown when no templates exist)
    const createFirstBtn = document.getElementById('qr-create-first-btn');
    if (createFirstBtn) {
      createFirstBtn.addEventListener('click', () => {
        showCreateForm();
      });
    }

    // Add template button in toolbar
    const addBtn = document.getElementById('qr-add-btn');
    if (addBtn) {
      addBtn.addEventListener('click', () => {
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
