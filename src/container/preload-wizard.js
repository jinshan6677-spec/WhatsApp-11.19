/**
 * Preload script for First Run Wizard
 * 
 * 为首次启动向导提供安全的 IPC 通信接口
 */

const { contextBridge, ipcRenderer } = require('electron');

// 暴露安全的 API 到渲染进程
contextBridge.exposeInMainWorld('wizardAPI', {
  // 开始迁移
  startMigration: () => ipcRenderer.invoke('wizard:start-migration'),
  
  // 跳过迁移
  skip: () => ipcRenderer.invoke('wizard:skip'),
  
  // 完成向导
  complete: () => ipcRenderer.invoke('wizard:complete'),
  
  // 获取迁移状态
  getStatus: () => ipcRenderer.invoke('wizard:get-status'),
  
  // 监听迁移事件
  onMigrationStarted: (callback) => {
    ipcRenderer.on('migration:started', () => callback());
  },
  
  onMigrationCompleted: (callback) => {
    ipcRenderer.on('migration:completed', (event, result) => callback(result));
  },
  
  onMigrationFailed: (callback) => {
    ipcRenderer.on('migration:failed', (event, result) => callback(result));
  }
});
