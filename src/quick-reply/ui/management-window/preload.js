/**
 * Preload script for Management Window
 * 
 * This script runs in the renderer process before the page loads,
 * exposing IPC functionality to the window.
 */

const { contextBridge, ipcRenderer } = require('electron');

// Expose IPC methods to the renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  // Request initial data
  requestData: () => {
    ipcRenderer.send('management-window-ready', {});
  },
  
  // Send action to main process
  sendAction: (data) => {
    ipcRenderer.send('management-window-action', data);
  },
  
  // Receive data from main process
  onData: (callback) => {
    ipcRenderer.on('management-window-data', (event, data) => callback(data));
  },
  
  // Legacy methods for compatibility
  send: (channel, data) => {
    const validChannels = ['management-window-ready', 'management-window-action'];
    if (validChannels.includes(channel)) {
      ipcRenderer.send(channel, data);
    }
  },
  
  on: (channel, callback) => {
    const validChannels = ['management-window-data', 'management-window-sync'];
    if (validChannels.includes(channel)) {
      ipcRenderer.on(channel, (event, ...args) => callback(...args));
    }
  }
});

console.log('[Management Window Preload] IPC API exposed');
