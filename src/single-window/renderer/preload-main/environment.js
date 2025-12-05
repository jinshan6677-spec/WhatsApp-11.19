const createEnvironmentAPI = (ipcRenderer) => ({
  getEnvironmentConfig: (accountId) => ipcRenderer.invoke('env:get-config', accountId),
  saveEnvironmentConfig: (accountId, config) => ipcRenderer.invoke('env:save-config', accountId, config),
  testProxy: (config) => ipcRenderer.invoke('env:test-proxy', config),
  detectNetwork: () => ipcRenderer.invoke('env:detect-network'),
  getProxyConfigs: () => ipcRenderer.invoke('env:get-proxy-configs'),
  saveProxyConfig: (name, config) => ipcRenderer.invoke('env:save-proxy-config', name, config),
  deleteNamedProxy: (name) => ipcRenderer.invoke('env:delete-proxy-config', name),
  parseProxyString: (proxyString) => ipcRenderer.invoke('env:parse-proxy-string', proxyString)
});

module.exports = createEnvironmentAPI;
