const createTranslationAPI = (ipcRenderer) => ({
  translate: (request) => ipcRenderer.invoke('translation:translate', request),
  detectLanguage: (text) => ipcRenderer.invoke('translation:detectLanguage', text),
  getConfig: (accountId) => ipcRenderer.invoke('translation:getConfig', accountId),
  saveConfig: (accountId, config) => ipcRenderer.invoke('translation:saveConfig', { accountId, config }),
  getStats: () => ipcRenderer.invoke('translation:getStats'),
  clearCache: (accountId = null) => ipcRenderer.invoke('translation:clearCache', accountId),
  saveEngineConfig: (engineName, config) => ipcRenderer.invoke('translation:saveEngineConfig', { engineName, config }),
  getEngineConfig: (engineName) => ipcRenderer.invoke('translation:getEngineConfig', engineName)
});

module.exports = createTranslationAPI;
