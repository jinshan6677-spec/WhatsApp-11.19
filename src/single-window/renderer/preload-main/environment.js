const createEnvironmentAPI = (ipcRenderer) => ({
  getEnvironmentConfig: (accountId) => ipcRenderer.invoke('env:get-config', accountId),
  saveEnvironmentConfig: (accountId, config) => ipcRenderer.invoke('env:save-config', accountId, config),
  testProxy: (config) => ipcRenderer.invoke('env:test-proxy', config),
  detectNetwork: () => ipcRenderer.invoke('env:detect-network'),
  getProxyConfigs: () => ipcRenderer.invoke('env:get-proxy-configs'),
  saveProxyConfig: (name, config) => ipcRenderer.invoke('env:save-proxy-config', name, config),
  deleteNamedProxy: (name) => ipcRenderer.invoke('env:delete-proxy-config', name),
  parseProxyString: (proxyString) => ipcRenderer.invoke('env:parse-proxy-string', proxyString),
  
  // Local proxy APIs
  getLocalProxyPresets: () => ipcRenderer.invoke('env:local-proxy:get-presets'),
  getLocalProxyPreset: (presetId) => ipcRenderer.invoke('env:local-proxy:get-preset', presetId),
  getLocalProxyConfig: (accountId) => ipcRenderer.invoke('env:local-proxy:get-config', accountId),
  validateLocalProxy: (host, port) => ipcRenderer.invoke('env:local-proxy:validate', host, port),
  testLocalProxy: (config) => ipcRenderer.invoke('env:local-proxy:test', config),
  diagnoseProxyChain: (localProxy, chainedProxy) => ipcRenderer.invoke('env:proxy-chain:diagnose', localProxy, chainedProxy),
  
  // Health monitor APIs
  startHealthMonitor: (accountId, proxyConfig) => ipcRenderer.invoke('env:health-monitor:start', accountId, proxyConfig),
  stopHealthMonitor: (accountId) => ipcRenderer.invoke('env:health-monitor:stop', accountId),
  getHealthStatus: (accountId) => ipcRenderer.invoke('env:health-monitor:get-status', accountId),
  checkHealthNow: (accountId) => ipcRenderer.invoke('env:health-monitor:check-now', accountId),
  onHealthStatusChanged: (callback) => {
    const handler = (event, data) => callback(data);
    ipcRenderer.on('env:health-monitor:status-changed', handler);
    return () => ipcRenderer.removeListener('env:health-monitor:status-changed', handler);
  }
});

module.exports = createEnvironmentAPI;
