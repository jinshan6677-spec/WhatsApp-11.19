const createViewsAPI = (ipcRenderer) => ({
  switchAccount: (accountId) => ipcRenderer.invoke('switch-account', accountId),
  switchAccountByIndex: (index) => ipcRenderer.invoke('switch-account-by-index', index),
  switchToNextAccount: () => ipcRenderer.invoke('switch-to-next-account'),
  switchToPreviousAccount: () => ipcRenderer.invoke('switch-to-previous-account'),
  getActiveAccount: () => ipcRenderer.invoke('account:get-active'),
  restoreActiveAccount: () => ipcRenderer.invoke('restore-active-account'),
  getViewStatus: (accountId) => ipcRenderer.invoke('account:view-status', accountId),
  reloadView: (accountId, ignoreCache = false) => ipcRenderer.invoke('account:reload-view', accountId, ignoreCache),
  recreateView: (accountId) => ipcRenderer.invoke('account:recreate-view', accountId),
  loadURL: (accountId, url) => ipcRenderer.invoke('account:load-url', accountId, url)
});

module.exports = createViewsAPI;
