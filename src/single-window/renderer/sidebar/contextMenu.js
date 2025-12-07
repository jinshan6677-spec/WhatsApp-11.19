/**
 * Context Menu Module
 * Handles right-click context menu for account items
 */

(function () {
  'use strict';

  // Import dependencies
  function getActions() {
    if (typeof require !== 'undefined') {
      return require('./actions.js');
    }
    return window.SidebarActions || {};
  }

  /**
   * Handle context menu event
   * @param {MouseEvent} e - Context menu event
   * @param {Object} account - Account object
   */
  function handleContextMenu(e, account) {
    const actions = getActions();
    
    // Remove existing context menus
    const existing = document.querySelectorAll('.custom-context-menu');
    existing.forEach(el => el.remove());

    const menu = createContextMenu(account, actions);
    document.body.appendChild(menu);

    // Position menu
    positionContextMenu(menu, e);

    // Close on click outside
    const closeMenu = () => {
      menu.remove();
      document.removeEventListener('click', closeMenu);
    };
    // Delay to prevent immediate closing
    setTimeout(() => document.addEventListener('click', closeMenu), 0);
  }

  /**
   * Create context menu element
   * @param {Object} account - Account object
   * @param {Object} actions - Actions module
   * @returns {HTMLElement} Menu element
   */
  function createContextMenu(account, actions) {
    const menu = document.createElement('div');
    menu.className = 'custom-context-menu';

    const options = [
      { 
        label: '打开账号', 
        icon: '▶', 
        action: () => actions.handleOpenAccount(account.id), 
        visible: !account.isRunning 
      },
      { 
        label: '关闭账号', 
        icon: '⏹', 
        action: () => actions.handleCloseAccount(account.id), 
        visible: account.isRunning 
      },
      {
        label: '环境设置',
        icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22S20 18 20 12V5L12 2L4 5V12C4 18 12 22 12 22Z"></path><path d="M9 12L11 14L15 10"></path></svg>`,
        action: () => actions.openEnvironmentPanel(account.id)
      },
      { type: 'separator' },
      { 
        label: '删除账号', 
        icon: '🗑️', 
        action: () => actions.handleDeleteAccount(account.id), 
        danger: true 
      }
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

    return menu;
  }

  /**
   * Position context menu within sidebar bounds
   * @param {HTMLElement} menu - Menu element
   * @param {MouseEvent} e - Mouse event
   */
  function positionContextMenu(menu, e) {
    // Get menu dimensions
    const rect = menu.getBoundingClientRect();
    const sidebar = document.getElementById('sidebar');
    const sidebarRect = sidebar ? sidebar.getBoundingClientRect() : { right: window.innerWidth, left: 0 };

    let x = e.clientX;
    let y = e.clientY;

    // Ensure menu doesn't extend beyond sidebar's right edge (BrowserView would cover it)
    const maxX = sidebarRect.right - rect.width - 4; // 4px padding from edge
    if (x + rect.width > sidebarRect.right) {
      x = Math.max(sidebarRect.left + 4, maxX);
    }

    // Vertical bounds check
    if (y + rect.height > window.innerHeight) {
      y = window.innerHeight - rect.height - 4;
    }
    if (y < 0) y = 4;

    menu.style.left = `${x}px`;
    menu.style.top = `${y}px`;
  }

  // Export functions
  const contextMenuExports = {
    handleContextMenu,
    createContextMenu,
    positionContextMenu
  };

  // Export for CommonJS (Node.js/testing)
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = contextMenuExports;
  }

  // Export for browser (window object)
  if (typeof window !== 'undefined') {
    window.SidebarContextMenu = contextMenuExports;
  }
})();
