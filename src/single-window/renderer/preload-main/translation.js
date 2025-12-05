const createTranslationHelpersAPI = (ipcRenderer) => ({
  getActiveChatInfo: () => ipcRenderer.invoke('translation:get-active-chat'),
  applyTranslationConfig: (accountId, config) => ipcRenderer.invoke('translation:apply-config', accountId, config)
});

module.exports = createTranslationHelpersAPI;
