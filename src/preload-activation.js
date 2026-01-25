/**
 * 激活窗口预加载脚本
 */

const { contextBridge, ipcRenderer } = require('electron');

// 暴露激活API到渲染进程
contextBridge.exposeInMainWorld('electronAPI', {
  activation: {
    // 激活应用
    activate: (activationCode, rememberCode = false) => ipcRenderer.invoke('activation:activate', activationCode, rememberCode),
    
    // 获取激活信息
    getInfo: () => ipcRenderer.invoke('activation:get-info'),
    
    // 获取设备信息
    getDeviceInfo: () => ipcRenderer.invoke('activation:get-device-info'),
    
    // 退出应用
    quit: () => ipcRenderer.invoke('activation:quit'),

    // 取消激活
    deactivate: () => ipcRenderer.invoke('activation:deactivate')
  },
  
  // 监听激活错误消息
  onActivationError: (callback) => {
    ipcRenderer.on('activation-error', (event, error) => callback(error));
  }
});
