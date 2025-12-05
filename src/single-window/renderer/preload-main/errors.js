const createErrorAPI = (ipcRenderer) => ({
  onAccountError: (callback) => {
    const listener = (_event, data) => callback(data);
    ipcRenderer.on('account-error', listener);
    return () => ipcRenderer.removeListener('account-error', listener);
  },
  onGlobalError: (callback) => {
    const listener = (_event, data) => callback(data);
    ipcRenderer.on('global-error', listener);
    return () => ipcRenderer.removeListener('global-error', listener);
  },
  onErrorCleared: (callback) => {
    const listener = (_event, data) => callback(data);
    ipcRenderer.on('error-cleared', listener);
    return () => ipcRenderer.removeListener('error-cleared', listener);
  }
});

module.exports = createErrorAPI;
