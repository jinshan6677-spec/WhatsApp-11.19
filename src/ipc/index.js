/**
 * IPC Module - Unified IPC handler exports
 * 
 * Provides IPCRouter-based handlers and IPC Bridge.
 * 
 * Note: Legacy proxy IPC handlers have been removed.
 * Use the new architecture handlers in src/presentation/ipc/handlers/ProxyIPCHandlers.js
 * 
 * @module ipc
 */

'use strict';

// IPC Bridge for connecting IPCRouter to ipcMain
const { IPCBridge, createIPCBridge } = require('./IPCBridge');

// New architecture proxy IPC handlers
const ProxyIPCHandlers = require('../presentation/ipc/handlers/ProxyIPCHandlers');

module.exports = {
  // New architecture proxy handlers
  ProxyIPCHandlers,
  registerProxyIPCHandlers: ProxyIPCHandlers.register,
  unregisterProxyIPCHandlers: ProxyIPCHandlers.unregister,
  registerProxyIPCHandlersWithRouter: ProxyIPCHandlers.registerWithRouter,
  unregisterProxyIPCHandlersFromRouter: ProxyIPCHandlers.unregisterFromRouter,
  
  // IPC Bridge
  IPCBridge,
  createIPCBridge
};
