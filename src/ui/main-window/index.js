/**
 * UI主窗口模块统一导出
 * 
 * 重构说明：ViewManager现在统一使用 single-window/ViewManager.js
 * 此模块提供其他UI组件的统一导出接口
 */

// 导入实际的ViewManager实现
const ViewManager = require('../../single-window/ViewManager');
const ViewBoundsManager = require('./ViewBoundsManager');
const ViewMemoryManager = require('./ViewMemoryManager');

module.exports = {
  ViewManager,
  ViewBoundsManager,
  ViewMemoryManager,
  
  createViewManager: (mainWindow, sessionManager, options) => 
    new ViewManager(mainWindow, sessionManager, options),
  createViewBoundsManager: (mainWindow, options) => 
    new ViewBoundsManager(mainWindow, options),
  createViewMemoryManager: (options) => 
    new ViewMemoryManager(options)
};