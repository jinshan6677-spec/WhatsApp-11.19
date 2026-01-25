const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('adminAPI', {
  generateCodes: (options) => ipcRenderer.invoke('generate-codes', options),
  getCodes: () => ipcRenderer.invoke('get-codes'),
  deleteCode: (codeId) => ipcRenderer.invoke('delete-code', codeId),
  getStats: () => ipcRenderer.invoke('get-stats'),
  exportCodes: (codeIds) => ipcRenderer.invoke('export-codes', codeIds)
});