/**
 * Sidebar Toggle Module
 * Handles sidebar collapse/expand functionality
 */

(function () {
  'use strict';

  // Constants
  const COLLAPSED_WIDTH = 80;
  const EXPANDED_WIDTH = 219;

  /**
   * Toggle sidebar collapsed state
   */
  function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    if (!sidebar) return;

    const isCollapsed = sidebar.dataset.collapsed === 'true';
    const newState = !isCollapsed;
    const newWidth = newState ? COLLAPSED_WIDTH : EXPANDED_WIDTH;

    sidebar.dataset.collapsed = String(newState);

    // Update CSS variables for sidebar width
    // Always set all related CSS variables to ensure correct width on state toggle
    document.documentElement.style.setProperty('--sidebar-width', `${newWidth}px`);
    document.documentElement.style.setProperty('--sidebar-collapsed-width', `${COLLAPSED_WIDTH}px`);
    document.documentElement.style.setProperty('--sidebar-expanded-width', `${EXPANDED_WIDTH}px`);

    // Update toggle button title
    const toggleBtn = document.getElementById('sidebar-toggle');
    if (toggleBtn) {
      toggleBtn.title = newState ? '展开侧边栏' : '收起侧边栏';
    }

    // Save state to localStorage
    try {
      localStorage.setItem('sidebar-collapsed', String(newState));
    } catch (e) {
      console.warn('Failed to save sidebar state:', e);
    }

    // Notify main process about sidebar resize for BrowserView adjustment
    if (window.electronAPI) {
      // Use both methods for compatibility
      // 1. Primary: invoke resize-sidebar handler
      window.electronAPI.invoke('resize-sidebar', newWidth).catch(err => {
        console.warn('Failed to invoke resize-sidebar:', err);
      });

      // 2. Fallback: send sidebar-resized event
      window.electronAPI.send('sidebar-resized', newWidth);

      console.log(`[Sidebar] Toggled to ${newState ? 'collapsed' : 'expanded'}, width: ${newWidth}px`);
    }
  }

  /**
   * Restore sidebar collapsed state from localStorage
   */
  function restoreSidebarState() {
    try {
      const savedState = localStorage.getItem('sidebar-collapsed');
      const sidebar = document.getElementById('sidebar');
      if (!sidebar) return;

      if (savedState === 'true') {
        // Restore collapsed state
        sidebar.dataset.collapsed = 'true';

        // Ensure both state CSS variables are correctly set
        // Even in collapsed state, set expanded width for later expansion
        document.documentElement.style.setProperty('--sidebar-width', `${COLLAPSED_WIDTH}px`);
        document.documentElement.style.setProperty('--sidebar-collapsed-width', `${COLLAPSED_WIDTH}px`);
        document.documentElement.style.setProperty('--sidebar-expanded-width', `${EXPANDED_WIDTH}px`);

        // Update toggle button title
        const toggleBtn = document.getElementById('sidebar-toggle');
        if (toggleBtn) {
          toggleBtn.title = '展开侧边栏';
        }

        // Notify main process about the collapsed state
        if (window.electronAPI) {
          // Use both methods for compatibility
          window.electronAPI.invoke('resize-sidebar', COLLAPSED_WIDTH).catch(err => {
            console.warn('Failed to invoke resize-sidebar:', err);
          });

          // Fallback: send sidebar-resized event
          window.electronAPI.send('sidebar-resized', COLLAPSED_WIDTH);

          console.log(`[Sidebar] Restored collapsed state, width: ${COLLAPSED_WIDTH}px`);
        }
      } else {
        // Restore expanded state (or default state)
        sidebar.dataset.collapsed = 'false';

        // Ensure expanded state CSS variables are correct
        document.documentElement.style.setProperty('--sidebar-width', `${EXPANDED_WIDTH}px`);
        document.documentElement.style.setProperty('--sidebar-collapsed-width', `${COLLAPSED_WIDTH}px`);
        document.documentElement.style.setProperty('--sidebar-expanded-width', `${EXPANDED_WIDTH}px`);

        // Update toggle button title
        const toggleBtn = document.getElementById('sidebar-toggle');
        if (toggleBtn) {
          toggleBtn.title = '收起侧边栏';
        }

        // Notify main process about the expanded state
        if (window.electronAPI) {
          window.electronAPI.invoke('resize-sidebar', EXPANDED_WIDTH).catch(err => {
            console.warn('Failed to invoke resize-sidebar:', err);
          });

          window.electronAPI.send('sidebar-resized', EXPANDED_WIDTH);

          console.log(`[Sidebar] Restored expanded state, width: ${EXPANDED_WIDTH}px`);
        }
      }
    } catch (e) {
      console.warn('Failed to restore sidebar state:', e);
    }
  }

  // Export functions
  const sidebarToggleExports = {
    toggleSidebar,
    restoreSidebarState
  };

  // Export for CommonJS (Node.js/testing)
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = sidebarToggleExports;
  }

  // Export for browser (window object)
  if (typeof window !== 'undefined') {
    window.SidebarToggle = sidebarToggleExports;
  }
})();
