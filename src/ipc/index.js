/**
 * IPC Module - Unified IPC handler exports
 * 
 * Provides both legacy ipcMain handlers and new IPCRouter-based handlers.
 * 
 * @module ipc
 */

'use strict';

// Legacy IPC handlers (direct ipcMain usage)
const { 
  registerProxyIPCHandlers, 
  unregisterProxyIPCHandlers 
} = require('./proxyIPCHandlers');

// New IPCRouter-based handlers
const { 
  registerProxyIPCHandlersWithRouter, 
  unregisterProxyIPCHandlersFromRouter,
  ProxySchemas 
} = require('./proxyIPCHandlersRouter');

// IPC Bridge for connecting IPCRouter to ipcMain
const { IPCBridge, createIPCBridge } = require('./IPCBridge');

module.exports = {
  // Legacy handlers
  registerProxyIPCHandlers,
  unregisterProxyIPCHandlers,
  
  // New IPCRouter-based handlers
  registerProxyIPCHandlersWithRouter,
  unregisterProxyIPCHandlersFromRouter,
  ProxySchemas,
  
  // IPC Bridge
  IPCBridge,
  createIPCBridge
};
