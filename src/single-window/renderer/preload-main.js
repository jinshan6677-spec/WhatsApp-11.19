const { contextBridge, ipcRenderer } = require('electron');
const createAccountsAPI = require('./preload-main/accounts');
const createViewsAPI = require('./preload-main/views');
const createStatusAPI = require('./preload-main/status');
const createLayoutAPI = require('./preload-main/layout');
const createEnvironmentAPI = require('./preload-main/environment');
const createFingerprintAPI = require('./preload-main/fingerprint');
const createTranslationHelpersAPI = require('./preload-main/translation');
const createEventsAPI = require('./preload-main/events');
const { createInvoke, createSend } = require('./preload-main/ipc');
const channels = require('./preload-main/channels');
const createErrorAPI = require('./preload-main/errors');
const createTranslationAPI = require('./preload-main/translationApi');

// 加载快捷回复 API
let quickReplyAPI = {};
try {
  const createQuickReplyAPI = require('./preload-main/quickReply');
  quickReplyAPI = createQuickReplyAPI(ipcRenderer);
  console.log('[Preload] QuickReply API loaded:', Object.keys(quickReplyAPI));
} catch (error) {
  console.error('[Preload] Failed to load QuickReply API:', error);
}

const electronAPI = {
  ...createAccountsAPI(ipcRenderer),
  ...createViewsAPI(ipcRenderer),
  ...createStatusAPI(ipcRenderer),
  ...createLayoutAPI(ipcRenderer),
  ...createEnvironmentAPI(ipcRenderer),
  ...createFingerprintAPI(ipcRenderer),
  ...createTranslationHelpersAPI(ipcRenderer),
  ...quickReplyAPI,
  invoke: createInvoke(ipcRenderer, channels.invokeChannels),
  send: createSend(ipcRenderer, channels.sendChannels),
  ...createEventsAPI(ipcRenderer, channels.eventChannels),
  ...createErrorAPI(ipcRenderer)
};

// 调试：检查 quickReply 是否存在
console.log('[Preload] electronAPI.quickReply exists:', !!electronAPI.quickReply);

contextBridge.exposeInMainWorld('electronAPI', electronAPI);
contextBridge.exposeInMainWorld('translationAPI', createTranslationAPI(ipcRenderer));

console.log('[Preload] Main window preload script loaded');
console.log('[Preload] electronAPI exposed to renderer');
