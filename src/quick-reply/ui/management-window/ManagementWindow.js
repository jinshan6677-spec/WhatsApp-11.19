/**
 * ManagementWindow
 * 
 * Creates and manages an independent Electron BrowserWindow for quick reply management.
 * This window provides a comprehensive interface for managing quick reply templates,
 * groups, and content - redesigned to match professional competitor UI.
 * 
 * Requirements: 2.1, 2.2, 2.6
 */

const EventEmitter = require('events');
const path = require('path');

class ManagementWindow extends EventEmitter {
  /**
   * @param {string} accountId - The WhatsApp account ID
   * @param {Object} [options] - Window options
   */
  constructor(accountId, options = {}) {
    super();
    
    if (!accountId) {
      throw new Error('accountId is required');
    }
    
    this.accountId = accountId;
    this.window = null;
    this.isDestroyed = false;
    
    this.config = {
      width: options.width || 1200,
      height: options.height || 800,
      minWidth: options.minWidth || 900,
      minHeight: options.minHeight || 600,
      x: options.x,
      y: options.y,
      title: '分组 专业版，可批量创建的快捷文字平台'
    };
  }

  async create() {
    if (this.window && !this.isDestroyed) {
      console.log('[ManagementWindow] Window already exists, focusing');
      this.focus();
      return;
    }

    try {
      const { BrowserWindow } = require('electron');
      const preloadPath = path.join(__dirname, 'preload.js');
      
      console.log('[ManagementWindow] Creating new BrowserWindow');
      console.log('[ManagementWindow] Preload path:', preloadPath);
      
      this.window = new BrowserWindow({
        width: this.config.width,
        height: this.config.height,
        minWidth: this.config.minWidth,
        minHeight: this.config.minHeight,
        x: this.config.x,
        y: this.config.y,
        title: this.config.title,
        show: false,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          preload: preloadPath,
          webSecurity: false  // Allow loading local files
        },
        backgroundColor: '#1a1a1a',
        autoHideMenuBar: true,
        frame: true,
        resizable: true
      });

      console.log('[ManagementWindow] BrowserWindow created');

      this.isDestroyed = false;
      this._setupEventHandlers();
      
      // Set up ready-to-show handler before loading content
      this.window.once('ready-to-show', () => {
        console.log('[ManagementWindow] ready-to-show event fired');
        if (this.window && !this.isDestroyed) {
          this.window.show();
          console.log('[ManagementWindow] Window shown');
          this.emit('ready');
        }
      });
      
      console.log('[ManagementWindow] Loading content...');
      await this._loadContent();
      console.log('[ManagementWindow] Content loaded');
      
      // Fallback: if ready-to-show doesn't fire within 2 seconds, show anyway
      setTimeout(() => {
        if (this.window && !this.isDestroyed && !this.window.isVisible()) {
          console.log('[ManagementWindow] Fallback: showing window after timeout');
          this.window.show();
          this.emit('ready');
        }
      }, 2000);

    } catch (error) {
      console.error('[ManagementWindow] Error creating window:', error);
      this.emit('error', error);
      throw error;
    }
  }

  _setupEventHandlers() {
    if (!this.window) return;

    this.window.on('close', () => this.emit('closing'));
    this.window.on('closed', () => {
      this.window = null;
      this.isDestroyed = true;
      this.emit('closed');
    });
    this.window.on('focus', () => this.emit('focus'));
    this.window.on('blur', () => this.emit('blur'));
    this.window.on('resize', () => {
      if (this.window && !this.isDestroyed) {
        const [width, height] = this.window.getSize();
        this.config.width = width;
        this.config.height = height;
        this.emit('resize', { width, height });
      }
    });
    this.window.on('move', () => {
      if (this.window && !this.isDestroyed) {
        const [x, y] = this.window.getPosition();
        this.config.x = x;
        this.config.y = y;
        this.emit('move', { x, y });
      }
    });
  }


  async _loadContent() {
    if (!this.window) return;
    const htmlContent = this._generateHTML();
    await this.window.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`);
  }

  _generateHTML() {
    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${this.config.title}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background-color: #1a1a1a;
      color: #e0e0e0;
      height: 100vh;
      overflow: hidden;
    }
    #root { height: 100%; display: flex; flex-direction: column; }
    .management-window { height: 100%; display: flex; flex-direction: column; }
    
    /* Header/Toolbar */
    .header {
      display: flex;
      align-items: center;
      padding: 8px 16px;
      background-color: #252525;
      border-bottom: 1px solid #333;
      gap: 8px;
    }
    .header-title {
      font-size: 13px;
      color: #888;
      margin-right: 16px;
    }
    .header-icons { display: flex; gap: 8px; margin-right: auto; }
    .header-icon {
      width: 28px; height: 28px;
      background: transparent;
      border: 1px solid #444;
      border-radius: 4px;
      color: #888;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 14px;
    }
    .header-icon:hover { background: #333; color: #fff; }
    
    /* Toolbar links */
    .toolbar-links {
      display: flex;
      gap: 24px;
      padding: 0 16px;
    }
    .toolbar-link {
      color: #4a9eff;
      font-size: 13px;
      cursor: pointer;
      background: none;
      border: none;
      padding: 8px 0;
    }
    .toolbar-link:hover { color: #6bb3ff; text-decoration: underline; }

    /* Main content */
    .main-content { flex: 1; display: flex; overflow: hidden; }
    
    /* Left panel - Tree view */
    .left-panel {
      width: 280px;
      background-color: #1e1e1e;
      border-right: 1px solid #333;
      display: flex;
      flex-direction: column;
    }
    .search-box {
      padding: 8px 12px;
      border-bottom: 1px solid #333;
    }
    .search-input {
      width: 100%;
      padding: 6px 10px;
      background: #2a2a2a;
      border: 1px solid #444;
      border-radius: 4px;
      color: #e0e0e0;
      font-size: 13px;
      outline: none;
    }
    .search-input:focus { border-color: #4a9eff; }
    .search-input::placeholder { color: #666; }
    
    /* Tree view */
    .tree-view { flex: 1; overflow-y: auto; padding: 4px 0; }
    .tree-group {
      user-select: none;
    }
    .tree-group-header {
      display: flex;
      align-items: center;
      padding: 6px 8px;
      cursor: pointer;
      gap: 4px;
    }
    .tree-group-header:hover { background: #2a2a2a; }
    .tree-group-header.selected { background: #0d47a1; }
    .tree-checkbox {
      width: 14px; height: 14px;
      margin-right: 4px;
      accent-color: #4a9eff;
    }
    .tree-expand {
      width: 16px; height: 16px;
      color: #888;
      font-size: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: transform 0.2s;
    }
    .tree-expand.expanded { transform: rotate(90deg); }
    .tree-group-icon {
      background: #4a9eff;
      color: #fff;
      font-size: 10px;
      padding: 2px 4px;
      border-radius: 2px;
      margin-right: 6px;
    }
    .tree-group-name { flex: 1; font-size: 13px; color: #e0e0e0; }
    .tree-group-actions {
      display: flex;
      gap: 4px;
      opacity: 0;
      transition: opacity 0.2s;
    }
    .tree-group-header:hover .tree-group-actions { opacity: 1; }
    .tree-action-btn {
      width: 20px; height: 20px;
      background: transparent;
      border: none;
      color: #888;
      cursor: pointer;
      font-size: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 3px;
    }
    .tree-action-btn:hover { background: #444; color: #fff; }

    /* Tree items (templates) */
    .tree-items { padding-left: 24px; }
    .tree-item {
      display: flex;
      align-items: center;
      padding: 5px 8px;
      cursor: pointer;
      gap: 4px;
    }
    .tree-item:hover { background: #2a2a2a; }
    .tree-item.selected { background: #0d47a1; }
    .tree-item-icon {
      background: #666;
      color: #fff;
      font-size: 9px;
      padding: 2px 4px;
      border-radius: 2px;
      margin-right: 6px;
    }
    .tree-item-name { flex: 1; font-size: 13px; color: #ccc; }
    .tree-item-actions {
      display: flex;
      gap: 2px;
      opacity: 0;
    }
    .tree-item:hover .tree-item-actions { opacity: 1; }
    
    /* Right panel - Content preview */
    .right-panel {
      flex: 1;
      background-color: #1a1a1a;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
    .content-list {
      flex: 1;
      overflow-y: auto;
      padding: 16px;
    }
    
    /* Content cards */
    .content-card {
      background: #252525;
      border: 1px solid #333;
      border-radius: 4px;
      margin-bottom: 16px;
      position: relative;
    }
    .content-card:hover { border-color: #444; }
    .content-card-actions {
      position: absolute;
      top: 8px;
      right: 8px;
      display: flex;
      gap: 8px;
      opacity: 0;
      transition: opacity 0.2s;
      z-index: 10;
      pointer-events: none;
    }
    .content-card:hover .content-card-actions { 
      opacity: 1; 
      pointer-events: auto;
    }
    .card-action-btn {
      width: 28px; height: 28px;
      background: rgba(0,0,0,0.6);
      border: none;
      border-radius: 4px;
      color: #ccc;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 14px;
    }
    .card-action-btn:hover { background: rgba(0,0,0,0.8); color: #fff; }

    /* Content types */
    .content-image {
      max-width: 300px;
      border-radius: 4px 4px 0 0;
    }
    .content-image img {
      width: 100%;
      height: auto;
      display: block;
      border-radius: 4px 4px 0 0;
    }
    .content-video {
      max-width: 300px;
    }
    .content-video video {
      width: 100%;
      height: auto;
      display: block;
      border-radius: 4px 4px 0 0;
      background: #000;
    }
    .content-audio {
      padding: 16px;
    }
    .content-audio audio {
      width: 100%;
    }
    .content-text {
      padding: 16px;
      position: relative;
      z-index: 1;
    }
    .content-text-input {
      width: 100%;
      min-height: 80px;
      background: #2a2a2a;
      border: 1px solid #444;
      border-radius: 4px;
      color: #e0e0e0;
      font-size: 14px;
      padding: 12px;
      resize: vertical;
      outline: none;
      cursor: text;
    }
    .content-text-input:focus { 
      border-color: #4a9eff; 
      box-shadow: 0 0 0 2px rgba(74,158,255,0.2);
    }
    .content-text-input:hover { border-color: #555; }
    
    /* Media container */
    .media-container {
      position: relative;
    }
    .media-container img {
      cursor: pointer;
      transition: opacity 0.2s;
    }
    .media-container img:hover { opacity: 0.9; }
    .media-container video {
      background: #000;
    }
    
    /* Change media button */
    .change-media-btn {
      position: absolute;
      bottom: 8px;
      right: 8px;
      padding: 6px 12px;
      background: rgba(0,0,0,0.7);
      border: 1px solid #555;
      border-radius: 4px;
      color: #fff;
      cursor: pointer;
      font-size: 12px;
      opacity: 0;
      transition: opacity 0.2s;
      z-index: 5;
    }
    .media-container:hover .change-media-btn { opacity: 1; }
    .change-media-btn:hover { background: rgba(0,0,0,0.9); }
    
    .change-audio-btn {
      margin-top: 8px;
      padding: 6px 12px;
      background: #333;
      border: 1px solid #555;
      border-radius: 4px;
      color: #ccc;
      cursor: pointer;
      font-size: 12px;
    }
    .change-audio-btn:hover { background: #444; color: #fff; }
    
    /* Lightbox for image preview */
    .lightbox {
      display: none;
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0,0,0,0.9);
      z-index: 1000;
      justify-content: center;
      align-items: center;
      cursor: zoom-out;
    }
    .lightbox.active { display: flex; }
    .lightbox img {
      max-width: 90%;
      max-height: 90%;
      object-fit: contain;
      border-radius: 4px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.5);
    }
    .lightbox-close {
      position: absolute;
      top: 20px;
      right: 20px;
      width: 40px;
      height: 40px;
      background: rgba(255,255,255,0.1);
      border: none;
      border-radius: 50%;
      color: #fff;
      font-size: 24px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .lightbox-close:hover { background: rgba(255,255,255,0.2); }
    
    /* Footer */
    .footer {
      display: flex;
      justify-content: center;
      gap: 16px;
      padding: 12px 16px;
      background: #252525;
      border-top: 1px solid #333;
    }
    .footer-btn {
      padding: 8px 32px;
      border-radius: 4px;
      font-size: 13px;
      cursor: pointer;
      transition: all 0.2s;
    }
    .btn-import {
      background: transparent;
      border: 1px solid #4a9eff;
      color: #4a9eff;
    }
    .btn-import:hover { background: rgba(74,158,255,0.1); }
    .btn-export {
      background: #4a9eff;
      border: 1px solid #4a9eff;
      color: #fff;
    }
    .btn-export:hover { background: #3a8eef; }
    
    /* Empty state */
    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100%;
      color: #666;
    }
    .empty-state-icon { font-size: 48px; margin-bottom: 16px; }
    .empty-state-text { font-size: 14px; }
  </style>
</head>
<body>
  <div id="root">
    <div class="management-window">

      <!-- Header -->
      <div class="header">
        <span class="header-title">分组</span>
        <span style="color:#888;font-size:12px;">复制后，可粘贴到其他社交平台</span>
        <div class="header-icons">
          <button class="header-icon" id="addGroupBtn" title="添加分组">+</button>
          <button class="header-icon" id="collapseAllBtn" title="全部折叠">⊟</button>
          <button class="header-icon" id="expandAllBtn" title="全部展开">⊞</button>
        </div>
        <div class="toolbar-links">
          <button class="toolbar-link" id="addTextBtn">添加文本</button>
          <button class="toolbar-link" id="addImageBtn">添加图片</button>
          <button class="toolbar-link" id="addAudioBtn">添加音频</button>
          <button class="toolbar-link" id="addVideoBtn">添加视频</button>
          <button class="toolbar-link" id="addImageTextBtn">添加图文</button>
        </div>
      </div>
      
      <!-- Main content -->
      <div class="main-content">
        <!-- Left panel - Tree view -->
        <div class="left-panel">
          <div class="search-box">
            <input type="text" class="search-input" placeholder="请输入关键词" id="searchInput">
          </div>
          <div class="tree-view" id="treeView">
            <!-- Tree will be rendered here -->
          </div>
        </div>
        
        <!-- Right panel - Content preview -->
        <div class="right-panel">
          <div class="content-list" id="contentList">
            <div class="empty-state">
              <div class="empty-state-icon">📝</div>
              <div class="empty-state-text">请选择分组或模板查看内容</div>
            </div>
          </div>
        </div>
      </div>
      
      <!-- Footer -->
      <div class="footer">
        <button class="footer-btn btn-import" id="importBtn">↑ 我要导入</button>
        <button class="footer-btn btn-export" id="exportBtn">↓ 我要导出</button>
      </div>
    </div>
    
    <!-- Lightbox for image preview -->
    <div class="lightbox" id="lightbox">
      <button class="lightbox-close" onclick="closeLightbox()">×</button>
      <img id="lightboxImg" src="" alt="">
    </div>
  </div>

  <script>
    const accountId = '${this.accountId}';
    let allGroups = [];
    let allTemplates = [];
    let selectedGroupId = null;
    let expandedGroups = new Set();
    
    function sendIPC(channel, data) {
      if (window.electronAPI && window.electronAPI.send) {
        window.electronAPI.send(channel, data);
      }
    }
    
    function onIPC(channel, callback) {
      if (window.electronAPI && window.electronAPI.on) {
        window.electronAPI.on(channel, callback);
      }
    }
    
    window.addEventListener('DOMContentLoaded', () => {
      sendIPC('management-window-ready', { accountId });
    });
    
    // Toolbar buttons
    document.getElementById('addTextBtn').onclick = () => sendIPC('management-window-action', { action: 'addText', accountId, groupId: selectedGroupId });
    document.getElementById('addImageBtn').onclick = () => sendIPC('management-window-action', { action: 'addImage', accountId, groupId: selectedGroupId });
    document.getElementById('addAudioBtn').onclick = () => sendIPC('management-window-action', { action: 'addAudio', accountId, groupId: selectedGroupId });
    document.getElementById('addVideoBtn').onclick = () => sendIPC('management-window-action', { action: 'addVideo', accountId, groupId: selectedGroupId });
    document.getElementById('addImageTextBtn').onclick = () => sendIPC('management-window-action', { action: 'addImageText', accountId, groupId: selectedGroupId });
    document.getElementById('importBtn').onclick = () => sendIPC('management-window-action', { action: 'import', accountId });
    document.getElementById('exportBtn').onclick = () => sendIPC('management-window-action', { action: 'export', accountId });
    document.getElementById('addGroupBtn').onclick = () => sendIPC('management-window-action', { action: 'addGroup', accountId });
    document.getElementById('collapseAllBtn').onclick = () => { expandedGroups.clear(); renderTree(); };
    document.getElementById('expandAllBtn').onclick = () => { allGroups.forEach(g => expandedGroups.add(g.id)); renderTree(); };
    
    document.getElementById('searchInput').oninput = (e) => {
      sendIPC('management-window-action', { action: 'search', accountId, keyword: e.target.value });
    };
    
    onIPC('management-window-data', (data) => {
      if (data.groups) allGroups = data.groups;
      if (data.templates) allTemplates = data.templates;
      renderTree();
      renderContent();
    });

    function renderTree() {
      const treeView = document.getElementById('treeView');
      if (!allGroups.length) {
        treeView.innerHTML = '<div style="padding:16px;color:#666;text-align:center;">暂无分组</div>';
        return;
      }
      
      treeView.innerHTML = allGroups.map(group => {
        const isExpanded = expandedGroups.has(group.id);
        const isSelected = selectedGroupId === group.id;
        const groupTemplates = allTemplates.filter(t => t.groupId === group.id);
        
        return \`
          <div class="tree-group" data-id="\${group.id}">
            <div class="tree-group-header \${isSelected ? 'selected' : ''}" data-id="\${group.id}">
              <input type="checkbox" class="tree-checkbox" onclick="event.stopPropagation()">
              <span class="tree-expand \${isExpanded ? 'expanded' : ''}">▶</span>
              <span class="tree-group-icon">分组</span>
              <span class="tree-group-name">\${group.name}</span>
              <div class="tree-group-actions">
                <button class="tree-action-btn" onclick="event.stopPropagation(); addToGroup('\${group.id}')" title="添加">+</button>
                <button class="tree-action-btn" onclick="event.stopPropagation(); showGroupMenu('\${group.id}')" title="更多">⋯</button>
              </div>
            </div>
            <div class="tree-items" style="display:\${isExpanded ? 'block' : 'none'}">
              \${groupTemplates.map(t => \`
                <div class="tree-item" data-id="\${t.id}" data-group="\${group.id}">
                  <input type="checkbox" class="tree-checkbox" onclick="event.stopPropagation()">
                  <span class="tree-item-icon">模板</span>
                  <span class="tree-item-name">\${t.label || getTypeLabel(t.type)}</span>
                  <div class="tree-item-actions">
                    <button class="tree-action-btn" onclick="event.stopPropagation(); editTemplate('\${t.id}')" title="编辑">✎</button>
                    <button class="tree-action-btn" onclick="event.stopPropagation(); deleteTemplate('\${t.id}')" title="删除">🗑</button>
                  </div>
                </div>
              \`).join('')}
            </div>
          </div>
        \`;
      }).join('');
      
      // Add event listeners
      treeView.querySelectorAll('.tree-group-header').forEach(header => {
        header.onclick = (e) => {
          // Don't trigger if clicking on input (during rename)
          if (e.target.tagName === 'INPUT') return;
          // Don't trigger if there's an active rename input
          if (header.querySelector('.inline-rename-input')) return;
          // Don't trigger if in rename mode
          if (header.dataset.renaming === 'true') return;
          
          const groupId = header.dataset.id;
          const expandIcon = header.querySelector('.tree-expand');
          const items = header.nextElementSibling;
          
          if (expandedGroups.has(groupId)) {
            expandedGroups.delete(groupId);
            expandIcon.classList.remove('expanded');
            items.style.display = 'none';
          } else {
            expandedGroups.add(groupId);
            expandIcon.classList.add('expanded');
            items.style.display = 'block';
          }
          
          selectedGroupId = groupId;
          renderTree();
          renderContent();
        };
      });
      
      treeView.querySelectorAll('.tree-item').forEach(item => {
        item.onclick = () => {
          const templateId = item.dataset.id;
          selectedGroupId = item.dataset.group;
          renderTree();
          scrollToTemplate(templateId);
        };
      });
    }

    function renderContent() {
      const contentList = document.getElementById('contentList');
      const templates = selectedGroupId 
        ? allTemplates.filter(t => t.groupId === selectedGroupId)
        : allTemplates;
      
      if (!templates.length) {
        contentList.innerHTML = \`
          <div class="empty-state">
            <div class="empty-state-icon">📝</div>
            <div class="empty-state-text">请选择分组或通过顶部工具栏添加内容</div>
          </div>
        \`;
        return;
      }
      
      contentList.innerHTML = templates.map(t => {
        let content = '';
        const rawPath = t.content?.mediaPath || '';
        // Convert Windows path to proper file:// URL
        const mediaPath = rawPath ? 'file:///' + rawPath.replace(/\\\\/g, '/') : '';
        const text = t.content?.text || '';
        
        switch (t.type) {
          case 'image':
            content = \`<div class="content-image media-container" data-id="\${t.id}"><img src="\${mediaPath}" alt="" onclick="openLightbox(this.src)" title="点击放大查看" onerror="handleImageError(this)"><button class="change-media-btn" onclick="event.stopPropagation(); changeMedia('\${t.id}', 'image')">更换图片</button></div>\`;
            break;
          case 'video':
            content = \`<div class="content-video media-container" data-id="\${t.id}"><video src="\${mediaPath}" controls onerror="handleVideoError(this)"></video><button class="change-media-btn" onclick="event.stopPropagation(); changeMedia('\${t.id}', 'video')">更换视频</button></div>\`;
            break;
          case 'audio':
            content = \`<div class="content-audio"><audio controls src="\${mediaPath}" onerror="handleAudioError(this)"></audio><button class="change-audio-btn" onclick="changeMedia('\${t.id}', 'audio')">更换音频</button></div>\`;
            break;
          case 'text':
            content = \`<div class="content-text"><textarea class="content-text-input" data-id="\${t.id}" placeholder="请输入文本内容...">\${escapeHtml(text)}</textarea></div>\`;
            break;
          case 'mixed':
            content = \`
              <div class="content-image media-container" data-id="\${t.id}"><img src="\${mediaPath}" alt="" onclick="openLightbox(this.src)" title="点击放大查看" onerror="handleImageError(this)"><button class="change-media-btn" onclick="event.stopPropagation(); changeMedia('\${t.id}', 'image')">更换图片</button></div>
              <div class="content-text"><textarea class="content-text-input" data-id="\${t.id}" placeholder="请输入文本内容...">\${escapeHtml(text)}</textarea></div>
            \`;
            break;
          default:
            content = \`<div class="content-text"><textarea class="content-text-input" data-id="\${t.id}" placeholder="请输入文本内容...">\${escapeHtml(t.label || '')}</textarea></div>\`;
        }
        
        return \`
          <div class="content-card" data-id="\${t.id}">
            <div class="content-card-actions">
              <button class="card-action-btn" onclick="deleteTemplate('\${t.id}')" title="删除">🗑</button>
              <button class="card-action-btn" onclick="moveTemplate('\${t.id}')" title="移动">⊕</button>
            </div>
            \${content}
          </div>
        \`;
      }).join('');
      
      // Initialize event delegation (only once)
      initEventDelegation();
    }
    
    function setupInlineEditing() {
      const contentList = document.getElementById('contentList');
      
      // Text auto-save on blur - use event delegation
      contentList.addEventListener('focusout', function(e) {
        if (e.target.classList.contains('content-text-input')) {
          const templateId = e.target.dataset.id;
          const text = e.target.value;
          if (templateId && text !== undefined) {
            saveText(templateId, text);
          }
        }
      });
    }
    
    // Lightbox functions
    function openLightbox(imageSrc) {
      const lightbox = document.getElementById('lightbox');
      const lightboxImg = document.getElementById('lightboxImg');
      lightboxImg.src = imageSrc;
      lightbox.classList.add('active');
    }
    
    function closeLightbox() {
      const lightbox = document.getElementById('lightbox');
      lightbox.classList.remove('active');
    }
    
    // Media error handlers
    function handleImageError(img) {
      const container = img.parentElement;
      const errorDiv = document.createElement('div');
      errorDiv.style.cssText = 'padding:40px;text-align:center;color:#666;background:#2a2a2a;border-radius:4px;';
      errorDiv.textContent = '图片加载失败';
      // Keep the change button
      const btn = container.querySelector('.change-media-btn');
      container.innerHTML = '';
      container.appendChild(errorDiv);
      if (btn) container.appendChild(btn);
    }
    
    function handleVideoError(video) {
      const container = video.parentElement;
      const errorDiv = document.createElement('div');
      errorDiv.style.cssText = 'padding:40px;text-align:center;color:#666;background:#2a2a2a;border-radius:4px;';
      errorDiv.textContent = '视频加载失败';
      const btn = container.querySelector('.change-media-btn');
      container.innerHTML = '';
      container.appendChild(errorDiv);
      if (btn) container.appendChild(btn);
    }
    
    function handleAudioError(audio) {
      const container = audio.parentElement;
      const errorDiv = document.createElement('div');
      errorDiv.style.cssText = 'padding:10px;text-align:center;color:#666;';
      errorDiv.textContent = '音频加载失败';
      const btn = container.querySelector('.change-audio-btn');
      container.innerHTML = '';
      container.appendChild(errorDiv);
      if (btn) container.appendChild(btn);
    }
    
    // Close lightbox when clicking outside the image
    document.getElementById('lightbox').addEventListener('click', function(e) {
      if (e.target === this || e.target.classList.contains('lightbox-close')) {
        closeLightbox();
      }
    });
    
    // Close lightbox with Escape key
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') {
        closeLightbox();
      }
    });
    
    // Initialize event delegation once
    let eventDelegationInitialized = false;
    function initEventDelegation() {
      if (eventDelegationInitialized) return;
      eventDelegationInitialized = true;
      setupInlineEditing();
    }
    
    function escapeHtml(str) {
      if (!str) return '';
      return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }
    
    function getTypeLabel(type) {
      const labels = { text: '文本', image: '图片', audio: '音频', video: '视频', mixed: '图文' };
      return labels[type] || '模板';
    }
    
    function scrollToTemplate(templateId) {
      const card = document.querySelector(\`.content-card[data-id="\${templateId}"]\`);
      if (card) card.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    function addToGroup(groupId) {
      selectedGroupId = groupId;
      sendIPC('management-window-action', { action: 'addText', accountId, groupId });
    }
    
    // Close any open dropdown menu
    function closeDropdownMenu() {
      const existing = document.getElementById('dropdown-menu');
      if (existing) existing.remove();
    }
    
    function showGroupMenu(groupId) {
      closeDropdownMenu();
      
      const group = allGroups.find(g => g.id === groupId);
      const groupName = group ? group.name : '分组';
      
      // Get button position
      const btn = event.target.closest('.tree-action-btn');
      const rect = btn.getBoundingClientRect();
      
      // Create dropdown menu
      const menu = document.createElement('div');
      menu.id = 'dropdown-menu';
      menu.style.cssText = \`
        position: fixed;
        top: \${rect.bottom + 4}px;
        left: \${rect.left}px;
        background: #2a2a2a;
        border: 1px solid #444;
        border-radius: 6px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.4);
        z-index: 1000;
        min-width: 150px;
        padding: 4px 0;
      \`;
      
      menu.innerHTML = \`
        <div class="dropdown-item" data-action="rename" style="padding:8px 16px;cursor:pointer;color:#e0e0e0;font-size:13px;display:flex;align-items:center;gap:8px;">
          <span>✏️</span><span>重命名</span>
        </div>
        <div class="dropdown-item" data-action="delete" style="padding:8px 16px;cursor:pointer;color:#ff6b6b;font-size:13px;display:flex;align-items:center;gap:8px;">
          <span>🗑️</span><span>删除分组</span>
        </div>
      \`;
      
      document.body.appendChild(menu);
      
      // Add hover effects
      menu.querySelectorAll('.dropdown-item').forEach(item => {
        item.onmouseenter = () => item.style.background = '#3a3a3a';
        item.onmouseleave = () => item.style.background = 'transparent';
      });
      
      // Handle menu item clicks
      menu.onclick = (e) => {
        const item = e.target.closest('.dropdown-item');
        if (!item) return;
        
        const action = item.dataset.action;
        closeDropdownMenu();
        
        if (action === 'rename') {
          startInlineRename(groupId, groupName);
        } else if (action === 'delete') {
          if (confirm('确定要删除此分组吗？')) {
            sendIPC('management-window-action', { action: 'deleteGroup', accountId, groupId });
          }
        }
      };
      
      // Close menu when clicking outside
      setTimeout(() => {
        document.addEventListener('click', function closeMenu(e) {
          if (!menu.contains(e.target)) {
            closeDropdownMenu();
            document.removeEventListener('click', closeMenu);
          }
        });
      }, 0);
    }
    
    // Inline rename for groups
    function startInlineRename(groupId, currentName) {
      const groupHeader = document.querySelector(\`.tree-group-header[data-id="\${groupId}"]\`);
      if (!groupHeader) return;
      
      const nameSpan = groupHeader.querySelector('.tree-group-name');
      if (!nameSpan) return;
      
      // Mark that we're in rename mode
      groupHeader.dataset.renaming = 'true';
      
      // Create inline input
      const input = document.createElement('input');
      input.type = 'text';
      input.value = currentName;
      input.className = 'inline-rename-input';
      input.style.cssText = \`
        flex: 1;
        background: #1a1a1a;
        border: 1px solid #4a9eff;
        border-radius: 3px;
        color: #fff;
        font-size: 13px;
        padding: 2px 6px;
        outline: none;
        min-width: 100px;
      \`;
      
      // Replace name with input
      nameSpan.style.display = 'none';
      nameSpan.parentNode.insertBefore(input, nameSpan.nextSibling);
      
      // Use setTimeout to ensure focus works
      setTimeout(() => {
        input.focus();
        input.select();
      }, 50);
      
      // Save function
      const saveRename = () => {
        if (!input.parentNode) return; // Already removed
        const newName = input.value.trim();
        if (newName && newName !== currentName) {
          sendIPC('management-window-action', { action: 'renameGroup', accountId, groupId, newName });
        } else {
          // Just restore the display
          nameSpan.style.display = '';
        }
        input.remove();
        delete groupHeader.dataset.renaming;
      };
      
      // Cancel function
      const cancelRename = () => {
        if (!input.parentNode) return;
        input.remove();
        nameSpan.style.display = '';
        delete groupHeader.dataset.renaming;
      };
      
      // Event handlers
      input.onblur = (e) => {
        // Delay to allow click events to process
        setTimeout(saveRename, 100);
      };
      
      input.onkeydown = (e) => {
        e.stopPropagation();
        if (e.key === 'Enter') {
          e.preventDefault();
          input.onblur = null;
          saveRename();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          input.onblur = null;
          cancelRename();
        }
      };
      
      input.onclick = (e) => {
        e.stopPropagation();
        e.preventDefault();
      };
      
      input.onmousedown = (e) => {
        e.stopPropagation();
      };
    }
    
    function editTemplate(templateId) {
      const template = allTemplates.find(t => t.id === templateId);
      if (template) {
        sendIPC('management-window-action', { action: 'editTemplate', accountId, templateId, template });
      }
    }
    
    function deleteTemplate(templateId) {
      if (confirm('确定要删除此模板吗？')) {
        sendIPC('management-window-action', { action: 'deleteTemplate', accountId, templateId });
      }
    }
    
    function moveTemplate(templateId) {
      const groupNames = allGroups.map((g, i) => \`\${i + 1}. \${g.name}\`).join('\\n');
      const choice = prompt(\`选择目标分组 (输入数字):\\n\${groupNames}\`);
      const index = parseInt(choice) - 1;
      if (index >= 0 && index < allGroups.length) {
        sendIPC('management-window-action', { action: 'moveTemplate', accountId, templateId, targetGroupId: allGroups[index].id });
      }
    }
    
    function changeMedia(templateId, mediaType) {
      sendIPC('management-window-action', { action: 'changeMedia', accountId, templateId, mediaType });
    }
    
    function saveText(templateId, text) {
      if (text && text.trim()) {
        sendIPC('management-window-action', { action: 'updateText', accountId, templateId, text });
      }
    }
  </script>
</body>
</html>`;
  }


  show() {
    if (this.window && !this.isDestroyed) this.window.show();
  }

  hide() {
    if (this.window && !this.isDestroyed) this.window.hide();
  }

  focus() {
    if (this.window && !this.isDestroyed) {
      if (this.window.isMinimized()) this.window.restore();
      this.window.focus();
    }
  }

  close() {
    if (this.window && !this.isDestroyed) this.window.close();
  }

  isOpen() {
    return this.window !== null && !this.isDestroyed;
  }

  sendData(data) {
    if (this.window && !this.isDestroyed) {
      this.window.webContents.send('management-window-data', data);
    }
  }

  sendUpdate(eventType, eventData) {
    if (this.window && !this.isDestroyed) {
      this.window.webContents.send('management-window-sync', {
        type: eventType,
        data: eventData,
        timestamp: Date.now()
      });
    }
  }

  getSize() {
    if (this.window && !this.isDestroyed) {
      const [width, height] = this.window.getSize();
      return { width, height };
    }
    return null;
  }

  getPosition() {
    if (this.window && !this.isDestroyed) {
      const [x, y] = this.window.getPosition();
      return { x, y };
    }
    return null;
  }

  getConfig() {
    return {
      width: this.config.width,
      height: this.config.height,
      x: this.config.x,
      y: this.config.y
    };
  }

  destroy() {
    if (this.window && !this.isDestroyed) {
      this.window.destroy();
      this.window = null;
      this.isDestroyed = true;
      this.removeAllListeners();
    }
  }
}

module.exports = ManagementWindow;
