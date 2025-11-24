/**
 * 主窗口UI模块统一导出
 * 
 * 提供所有主窗口相关组件的统一导入接口
 */

const ViewManager = require('./ViewManager');
const ViewBoundsManager = require('./ViewBoundsManager');
const ViewMemoryManager = require('./ViewMemoryManager');
const MainWindow = require('./MainWindow');

// 便捷创建方法
function createViewManager(mainWindow, sessionManager, options) {
  return new ViewManager(mainWindow, sessionManager, options);
}

function createBoundsManager(options) {
  return new ViewBoundsManager(options);
}

function createMemoryManager(options) {
  return new ViewMemoryManager(options);
}

module.exports = {
  // 核心组件
  ViewManager,
  ViewBoundsManager,
  ViewMemoryManager,
  MainWindow,
  
  // 便捷创建方法
  createViewManager,
  createBoundsManager,
  createMemoryManager,
  
  // 组件类型
  ViewStatus: ViewManager.ViewStatus || require('./ViewManager').ViewStatus
};
