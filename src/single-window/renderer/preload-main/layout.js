const createLayoutAPI = (ipcRenderer) => ({
  getViewBounds: () => ipcRenderer.invoke('get-view-bounds'),
  getSidebarWidth: () => ipcRenderer.invoke('get-sidebar-width'),
  getTranslationPanelLayout: () => ipcRenderer.invoke('get-translation-panel-layout'),
  getActiveAccountId: () => ipcRenderer.invoke('get-active-account-id'),
  notifySidebarResized: (sidebarWidth) => ipcRenderer.send('sidebar-resized', sidebarWidth),
  notifyTranslationPanelResized: (payload) => ipcRenderer.send('translation-panel-resized', payload),
  notifyWindowResizeComplete: () => ipcRenderer.send('window-resize-complete')
});

module.exports = createLayoutAPI;
