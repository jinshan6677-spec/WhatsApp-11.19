/**
 * Quick Reply Panel Bridge
 * 
 * 桥接层：加载打包后的 React 组件并提供初始化接口
 * 
 * 使用方式：
 * 1. 运行 npm run build:quick-reply 生成 bundle
 * 2. 在 app.html 中加载此文件
 */

(function() {
  'use strict';

  let currentAccountId = null;
  let isInitialized = false;

  /**
   * 获取当前活动账号 ID
   */
  async function getActiveAccountId() {
    if (window.SidebarState?.getActiveAccountId) {
      const id = window.SidebarState.getActiveAccountId();
      if (id) return id;
    }
    if (window.sidebar?.getActiveAccountId) {
      const id = window.sidebar.getActiveAccountId();
      if (id) return id;
    }
    if (window.electronAPI?.getActiveAccount) {
      try {
        const res = await window.electronAPI.getActiveAccount();
        return res?.accountId || null;
      } catch (e) {
        console.error('[QuickReply Bridge] Failed to get active account:', e);
      }
    }
    return null;
  }

  /**
   * 初始化快捷回复面板
   */
  function initializeQuickReplyPanel() {
    console.log('[QuickReply Bridge] Initializing...');

    // 检查 React bundle 是否已加载
    if (!window.QuickReplyApp) {
      console.warn('[QuickReply Bridge] QuickReplyApp not loaded, falling back to vanilla JS');
      // 如果 React bundle 未加载，使用原来的 vanilla JS 实现
      loadVanillaJSFallback();
      return;
    }

    isInitialized = true;

    // 监听面板切换
    const quickReplyBtn = document.querySelector('[data-panel="quick-reply"]');
    if (quickReplyBtn) {
      quickReplyBtn.addEventListener('click', showQuickReplyPanel);
    }

    // 监听账号切换
    if (window.electronAPI?.quickReply?.onAccountSwitch) {
      window.electronAPI.quickReply.onAccountSwitch(handleAccountSwitch);
    }

    if (window.electronAPI?.on) {
      window.electronAPI.on('account:active-changed', (data) => {
        const accountId = typeof data === 'string' ? data : data?.accountId;
        if (accountId) handleAccountSwitch(accountId);
      });
    }

    console.log('[QuickReply Bridge] Initialized with React components');
  }

  /**
   * 显示快捷回复面板
   */
  async function showQuickReplyPanel() {
    console.log('[QuickReply Bridge] Showing panel');

    // 隐藏其他面板
    const translatePanel = document.getElementById('translate-panel-body');
    const envPanel = document.getElementById('environment-panel-body');
    if (translatePanel) translatePanel.style.display = 'none';
    if (envPanel) envPanel.style.display = 'none';

    // 显示快捷回复面板
    const quickReplyPanel = document.getElementById('quick-reply-panel-body');
    if (quickReplyPanel) quickReplyPanel.style.display = 'block';

    // 更新按钮状态
    document.querySelectorAll('.panel-menu-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelector('[data-panel="quick-reply"]')?.classList.add('active');

    // 同步 TranslatePanelLayout
    if (window.TranslatePanelLayout?.setActivePanel) {
      window.TranslatePanelLayout.setActivePanel('quick-reply');
    }

    // 获取账号 ID
    if (!currentAccountId) {
      currentAccountId = await getActiveAccountId();
    }

    // 渲染 React 组件
    if (currentAccountId && window.QuickReplyApp) {
      const host = document.getElementById('quick-reply-host');
      const placeholder = document.getElementById('quick-reply-panel-placeholder');
      
      if (placeholder) placeholder.style.display = 'none';
      if (host) {
        host.style.display = 'block';
        window.QuickReplyApp.render(host, currentAccountId);
      }
    }
  }

  /**
   * 隐藏快捷回复面板
   */
  function hideQuickReplyPanel() {
    const panel = document.getElementById('quick-reply-panel-body');
    if (panel) panel.style.display = 'none';
  }

  /**
   * 处理账号切换
   */
  async function handleAccountSwitch(accountId) {
    console.log('[QuickReply Bridge] Account switched:', accountId);
    
    if (currentAccountId === accountId) return;
    currentAccountId = accountId;

    // 如果面板可见，重新渲染
    const panel = document.getElementById('quick-reply-panel-body');
    if (panel?.style.display !== 'none' && window.QuickReplyApp) {
      const host = document.getElementById('quick-reply-host');
      if (host) {
        window.QuickReplyApp.render(host, accountId);
      }
    }
  }

  /**
   * 加载 vanilla JS 回退实现
   */
  function loadVanillaJSFallback() {
    // 动态加载原来的 vanilla JS 实现
    const script = document.createElement('script');
    script.src = 'quick-reply-panel.js';
    script.onload = () => {
      console.log('[QuickReply Bridge] Vanilla JS fallback loaded');
    };
    script.onerror = () => {
      console.error('[QuickReply Bridge] Failed to load vanilla JS fallback');
    };
    document.head.appendChild(script);
  }

  // DOM 加载完成后初始化
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeQuickReplyPanel);
  } else {
    initializeQuickReplyPanel();
  }

  // 导出
  window.QuickReplyBridge = {
    show: showQuickReplyPanel,
    hide: hideQuickReplyPanel,
    refresh: () => window.QuickReplyApp?.refresh(),
    switchAccount: handleAccountSwitch
  };
})();
