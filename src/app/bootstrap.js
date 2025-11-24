/**
 * 应用启动引导器
 * 
 * 负责应用的整体初始化和依赖注入
 * 提供清晰的应用启动流程
 */

const { app } = require('electron');
const path = require('path');

// 导入统一导出模块，避免复杂的相对路径
const { APP_INFO, EVENTS, ERROR_CODES } = require('./constants');
const { createAccountConfigManager, createSessionManager, createTranslationIntegration } = require('../core/managers');
const { createProxyDetectionService } = require('../core/services');
const { createMainWindow } = require('../ui/main-window/MainWindow');
const { ErrorHandler } = require('../shared/utils');

// 应用实例
class AppBootstrap {
  constructor() {
    this.isInitialized = false;
    this.managers = {};
    this.mainWindow = null;
    this.errorHandler = new ErrorHandler();
  }

  /**
   * 初始化应用
   * @returns {Promise<void>}
   */
  async initialize() {
    if (this.isInitialized) {
      console.warn('App is already initialized');
      return;
    }

    try {
      console.log(`Starting ${APP_INFO.NAME} v${APP_INFO.VERSION}...`);
      
      // 1. 初始化错误处理
      await this.initializeErrorHandling();
      
      // 2. 初始化核心管理器
      await this.initializeManagers();
      
      // 3. 初始化主窗口
      await this.initializeMainWindow();
      
      // 4. 注册全局事件处理器
      this.registerGlobalEventHandlers();
      
      this.isInitialized = true;
      console.log('Application initialized successfully');
      
    } catch (error) {
      console.error('Failed to initialize application:', error);
      throw error;
    }
  }

  /**
   * 初始化错误处理
   * @returns {Promise<void>}
   */
  async initializeErrorHandling() {
    this.errorHandler.initialize();
    
    // 捕获未处理的异常
    process.on('uncaughtException', (error) => {
      this.errorHandler.handleError(ERROR_CODES.SYSTEM.UNKNOWN_ERROR, error, {
        context: 'uncaughtException'
      });
    });
    
    process.on('unhandledRejection', (reason, promise) => {
      this.errorHandler.handleError(ERROR_CODES.SYSTEM.UNKNOWN_ERROR, reason, {
        context: 'unhandledRejection',
        promise
      });
    });
  }

  /**
   * 初始化核心管理器
   * @returns {Promise<void>}
   */
  async initializeManagers() {
    try {
      // 账号配置管理器
      this.managers.accountConfigManager = createAccountConfigManager();
      await this.managers.accountConfigManager.initialize();
      
      // 会话管理器
      this.managers.sessionManager = createSessionManager();
      await this.managers.sessionManager.initialize();
      
      // 翻译集成管理器
      this.managers.translationIntegration = createTranslationIntegration();
      await this.managers.translationIntegration.initialize();
      
      // 代理检测服务
      this.managers.proxyDetectionService = createProxyDetectionService();
      await this.managers.proxyDetectionService.initialize();
      
      console.log('Core managers initialized successfully');
      
    } catch (error) {
      throw new Error(`Failed to initialize managers: ${error.message}`);
    }
  }

  /**
   * 初始化主窗口
   * @returns {Promise<void>}
   */
  async initializeMainWindow() {
    try {
      this.mainWindow = createMainWindow({
        managers: this.managers,
        errorHandler: this.errorHandler
      });
      
      await this.mainWindow.initialize();
      console.log('Main window initialized successfully');
      
    } catch (error) {
      throw new Error(`Failed to initialize main window: ${error.message}`);
    }
  }

  /**
   * 注册全局事件处理器
   */
  registerGlobalEventHandlers() {
    // 应用准备就绪
    app.whenReady().then(() => {
      this.onAppReady();
    });
    
    // 所有窗口关闭
    app.on('window-all-closed', () => {
      this.onAllWindowsClosed();
    });
    
    // 应用激活
    app.on('activate', () => {
      this.onAppActivated();
    });
    
    // 应用退出前
    app.on('before-quit', () => {
      this.onBeforeQuit();
    });
  }

  /**
   * 应用准备就绪事件处理
   */
  onAppReady() {
    console.log(`${APP_INFO.NAME} is ready`);
    
    // 显示主窗口
    if (this.mainWindow) {
      this.mainWindow.show();
    }
  }

  /**
   * 所有窗口关闭事件处理
   */
  onAllWindowsClosed() {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  }

  /**
   * 应用激活事件处理
   */
  onAppActivated() {
    if (this.mainWindow && this.mainWindow.isDestroyed()) {
      this.mainWindow.rebuild();
    }
  }

  /**
   * 应用退出前事件处理
   */
  async onBeforeQuit() {
    console.log('Application shutting down...');
    
    try {
      // 清理资源
      await this.cleanup();
    } catch (error) {
      console.error('Error during cleanup:', error);
    }
  }

  /**
   * 清理资源
   * @returns {Promise<void>}
   */
  async cleanup() {
    if (this.mainWindow) {
      await this.mainWindow.cleanup();
    }
    
    if (this.managers.sessionManager) {
      await this.managers.sessionManager.cleanup();
    }
    
    console.log('Cleanup completed');
  }

  /**
   * 获取管理器实例
   * @param {string} name - 管理器名称
   * @returns {Object} 管理器实例
   */
  getManager(name) {
    return this.managers[name];
  }

  /**
   * 获取主窗口实例
   * @returns {Object} 主窗口实例
   */
  getMainWindow() {
    return this.mainWindow;
  }

  /**
   * 获取应用状态
   * @returns {Object} 应用状态
   */
  getStatus() {
    return {
      isInitialized: this.isInitialized,
      hasMainWindow: !!this.mainWindow,
      managers: Object.keys(this.managers),
      version: APP_INFO.VERSION
    };
  }
}

// 单例实例
let appInstance = null;

/**
 * 获取应用实例（单例模式）
 * @returns {AppBootstrap} 应用实例
 */
function getAppInstance() {
  if (!appInstance) {
    appInstance = new AppBootstrap();
  }
  return appInstance;
}

/**
 * 初始化应用
 * @returns {Promise<AppBootstrap>} 应用实例
 */
async function initializeApp() {
  const bootstrap = getAppInstance();
  await bootstrap.initialize();
  return bootstrap;
}

module.exports = {
  AppBootstrap,
  getAppInstance,
  initializeApp
};
