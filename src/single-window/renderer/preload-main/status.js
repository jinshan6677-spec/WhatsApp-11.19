const createStatusAPI = (ipcRenderer) => ({
  getLoginStatus: (accountId) => ipcRenderer.invoke('account:login-status', accountId),
  checkLoginStatus: (accountId) => ipcRenderer.invoke('account:check-login-status', accountId),
  startLoginStatusMonitoring: (accountId, options) => ipcRenderer.invoke('account:start-login-status-monitoring', accountId, options),
  stopLoginStatusMonitoring: (accountId) => ipcRenderer.invoke('account:stop-login-status-monitoring', accountId),
  startAllLoginStatusMonitoring: (options) => ipcRenderer.invoke('account:start-all-login-status-monitoring', options),
  stopAllLoginStatusMonitoring: () => ipcRenderer.invoke('account:stop-all-login-status-monitoring'),
  getConnectionStatus: (accountId) => ipcRenderer.invoke('account:connection-status', accountId),
  checkConnectionStatus: (accountId) => ipcRenderer.invoke('account:check-connection-status', accountId),
  startConnectionMonitoring: (accountId, options) => ipcRenderer.invoke('account:start-connection-monitoring', accountId, options),
  stopConnectionMonitoring: (accountId) => ipcRenderer.invoke('account:stop-connection-monitoring', accountId),
  startAllConnectionMonitoring: (options) => ipcRenderer.invoke('account:start-all-connection-monitoring', options),
  stopAllConnectionMonitoring: () => ipcRenderer.invoke('account:stop-all-connection-monitoring'),
  forceLogout: (accountId) => ipcRenderer.invoke('account:force-logout', accountId),
  handleSessionExpiration: (accountId, options) => ipcRenderer.invoke('account:handle-session-expiration', accountId, options),
  checkSessionExpiration: (accountId) => ipcRenderer.invoke('account:check-session-expiration', accountId),
  getSessionPersistenceStatus: (accountId) => ipcRenderer.invoke('account:session-persistence-status', accountId),
  restoreAllLoginStates: () => ipcRenderer.invoke('account:restore-all-login-states'),
  startSessionMonitoring: (accountId) => ipcRenderer.invoke('account:start-session-monitoring', accountId)
});

module.exports = createStatusAPI;
