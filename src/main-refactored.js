/**
 * 重构后的主入口文件
 * 
 * 使用新的架构和依赖注入机制
 * 提供清晰的应用启动流程和模块管理
 */

const { app } = require('electron');
const { APP_INFO, EVENTS, ERROR_CODES } = require('./app/constants');
const { initializeApp } = require('./app/bootstrap');
const { getErrorHandler } = require('./shared/utils');

// 全局应用实例
let appInstance = null;

/**
 * 主启动函数
 */
async function main() {
  try {
    // 验证运行环境
    validateEnvironment();
    
    // 初始化应用
    appInstance = await initializeApp();
    
    console.log(`${APP_INFO.NAME} v${APP_INFO.VERSION} started successfully`);
    
  } catch (error) {
    console.error('Failed to start application:', error);
    
    // 错误处理
    const errorHandler = getErrorHandler();
    await errorHandler.handleInstanceError('main-process', error, {
      operation: 'application-startup'
    });
    
    // 退出应用
    app.quit();
  }
}

/**
 * 验证运行环境
 */
function validateEnvironment() {
  // 检查主进程
  if (!app.isPackaged && !app.isDefaultProtocolClient) {
    console.warn('Running in development mode');
  }
  
  // 检查必要的事件循环
  if (!app.eventNames().includes(EVENTS.APP.READY)) {
    throw new Error('Electron event system not properly initialized');
  }
  
  console.log('Environment validation passed');
}

/**
 * 设置应用事件处理
 */
function setupAppEvents() {
  // 应用准备就绪
  app.whenReady().then(async () => {
    try {
      console.log('Electron app is ready');
      
      // 显示应用（在AppBootstrap中处理）
      
    } catch (error) {
      console.error('App ready handler failed:', error);
      app.quit();
    }
  });
  
  // 所有窗口关闭
  app.on('window-all-closed', () => {
    console.log('All windows closed');
    
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });
  
  // 应用激活（macOS）
  app.on('activate', async () => {
    console.log('App activated');
    
    if (appInstance && appInstance.getMainWindow()) {
      const mainWindow = appInstance.getMainWindow();
      if (mainWindow && mainWindow.isDestroyed()) {
        // 重建主窗口
        await mainWindow.rebuild();
      } else if (mainWindow) {
        mainWindow.show();
      }
    }
  });
  
  // 应用退出前
  app.on('before-quit', async (event) => {
    console.log('Application quitting...');
    
    if (appInstance) {
      try {
        // 阻止立即退出，给清理操作时间
        event.preventDefault();
        
        // 执行清理操作
        await appInstance.cleanup();
        
        // 允许退出
        app.quit();
        
      } catch (error) {
        console.error('Cleanup failed:', error);
        // 即使清理失败也允许退出
        app.quit();
      }
    }
  });
  
  // Web内容创建失败
  app.on('web-contents-created', (event, contents) => {
    contents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
      console.error('Web contents failed to load', {
        errorCode,
        errorDescription,
        validatedURL
      });
    });
  });
}

/**
 * 设置全局错误处理
 */
function setupGlobalErrorHandlers() {
  // 未捕获的异常
  process.on('uncaughtException', async (error) => {
    console.error('Uncaught Exception:', error);
    
    const errorHandler = getErrorHandler();
    await errorHandler.handleInstanceError('uncaught-exception', error, {
      type: 'uncaughtException',
      stack: error.stack
    });
  });
  
  // 未处理的Promise拒绝
  process.on('unhandledRejection', async (reason, promise) => {
    console.error('Unhandled Rejection:', reason);
    
    const errorHandler = getErrorHandler();
    await errorHandler.handleInstanceError('unhandled-rejection', new Error(String(reason)), {
      type: 'unhandledRejection',
      promise: promise.toString()
    });
  });
  
  // 警告
  process.on('warning', (warning) => {
    console.warn('Process Warning:', warning.name, warning.message);
  });
}

/**
 * 应用单例检查
 */
function enforceAppSingleInstance() {
  const gotTheLock = app.requestSingleInstanceLock();
  
  if (!gotTheLock) {
    console.log('Another instance is already running, quitting...');
    app.quit();
  } else {
    app.on('second-instance', (event, argv, cwd) => {
      // 有人运行了第二个实例，应该聚焦到主窗口
      if (appInstance && appInstance.getMainWindow()) {
        const mainWindow = appInstance.getMainWindow();
        if (mainWindow.isMinimized()) {
          mainWindow.restore();
        }
        mainWindow.focus();
      }
    });
  }
}

// 初始化应用
function initialize() {
  console.log(`Starting ${APP_INFO.NAME}...`);
  
  // 设置单例检查
  enforceAppSingleInstance();
  
  // 设置全局错误处理
  setupGlobalErrorHandlers();
  
  // 设置应用事件
  setupAppEvents();
  
  // 启动主函数
  main();
}

// 只有在主进程中运行
if (!app.isPackaged && process.type === 'browser') {
  initialize();
} else if (app.isPackaged) {
  initialize();
}

// 导出应用实例（用于测试）
module.exports = {
  getAppInstance: () => appInstance,
  initialize
};
