/**
 * 应用启动引导器
 * 
 * 负责应用的整体初始化和依赖注入
 * 提供清晰的应用启动流程，与现有架构完全整合
 */

const { app } = require('electron');
const path = require('path');

// 导入统一导出模块，避免复杂的相对路径
const { APP_INFO, EVENTS, ERROR_CODES } = require('./constants');

// 导入依赖注入容器
const { getGlobalContainer } = require('./DependencyContainer');

// 导入现有架构组件
const MainWindow = require('../single-window/MainWindow');
const ViewManager = require('../single-window/ViewManager');
const NotificationManager = require('../managers/NotificationManager');
const TrayManager = require('../managers/TrayManager');

// 导入工具类
const { getErrorLogger, ErrorCategory } = require('../utils/ErrorLogger');
const { getErrorHandler } = require('../shared/utils/ErrorHandler');
const OrphanedDataCleaner = require('../utils/OrphanedDataCleaner');

// 导入配置
const config = require('../config');

// 应用实例
class AppBootstrap {
  constructor() {
    this.isInitialized = false;
    this.container = getGlobalContainer();
    this.managers = {};
    this.mainWindow = null;
    this.viewManager = null;
    this.errorHandler = null;
    this.errorLogger = null;
    this.config = config;
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
      
      // 1. 注册服务到依赖容器
      await this.registerServices();
      
      // 2. 初始化错误处理和日志记录
      await this.initializeErrorHandling();
      
      // 3. 初始化核心管理器
      await this.initializeManagers();
      
      // 3. 初始化UI组件
      await this.initializeUIComponents();
      
      // 4. 初始化ViewManager
      await this.initializeViewManager();
      
      // 5. 注册全局事件处理器
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
    if (this.errorHandler) {
      try {
        this.errorHandler.initialize();
      } catch (error) {
        console.warn('错误处理器初始化失败，使用默认处理:', error.message);
      }
    }
    
    // 捕获未处理的异常
    process.on('uncaughtException', (error) => {
      console.error('未捕获的异常:', error.message);
    });
    
    process.on('unhandledRejection', (reason, promise) => {
      console.error('未处理的Promise拒绝:', reason);
    });
  }

  /**
   * 注册服务到依赖容器
   * @returns {Promise<void>}
   */
  async registerServices() {
    try {
      // 注册配置
      this.container.registerSingleton('config', config);
      
      // 注册错误处理器
      this.container.registerSingleton('errorHandler', getErrorHandler());
      
      // 注册错误日志记录器
      this.container.registerSingleton('errorLogger', getErrorLogger());
      
      // 注册账号配置管理器
      this.container.registerFactory('accountConfigManager', () => {
        const { AccountConfigManager } = require('../core/managers');
        return new AccountConfigManager({
          cwd: app.getPath('userData')
        });
      });
      
      // 注册代理配置管理器
      this.container.registerFactory('proxyConfigManager', () => {
        const { ProxyConfigManager } = require('../core/managers');
        return new ProxyConfigManager({
          cwd: app.getPath('userData')
        });
      });
      
      // 注册代理检测服务
      this.container.registerFactory('proxyDetectionService', () => {
        const { createProxyDetectionService } = require('../core/services');
        return createProxyDetectionService();
      });
      
      // 注册会话管理器
      this.container.registerFactory('sessionManager', () => {
        const { SessionManager } = require('../core/managers');
        return new SessionManager({
          userDataPath: app.getPath('userData')
        });
      });
      
      console.log('✓ 依赖容器服务注册完成');
    } catch (error) {
      console.warn('依赖容器服务注册失败:', error.message);
    }
  }

  /**
   * 初始化核心管理器
   * @returns {Promise<void>}
   */
  async initializeManagers() {
    try {
      // 从容器获取管理器实例
      this.managers.accountConfigManager = this.container.resolve('accountConfigManager');
      this.managers.proxyConfigManager = this.container.resolve('proxyConfigManager');
      this.managers.proxyDetectionService = this.container.resolve('proxyDetectionService');
      this.managers.sessionManager = this.container.resolve('sessionManager');
      
      console.log('✓ 核心管理器初始化完成');
    } catch (error) {
      console.warn('管理器初始化失败，回退到直接实例化:', error.message);
      
      // 回退到原来的方式
      try {
        const { AccountConfigManager } = require('../core/managers');
        this.managers.accountConfigManager = new AccountConfigManager({
          cwd: app.getPath('userData')
        });
        console.log('✓ 账号配置管理器初始化');
      } catch (error) {
        console.warn('账号配置管理器初始化失败:', error.message);
      }
      
      try {
        const { ProxyConfigManager } = require('../core/managers');
        this.managers.proxyConfigManager = new ProxyConfigManager({
          cwd: app.getPath('userData')
        });
        console.log('✓ 代理配置管理器初始化');
      } catch (error) {
        console.warn('代理配置管理器初始化失败:', error.message);
      }
      
      try {
        const { createProxyDetectionService } = require('../core/services');
        this.managers.proxyDetectionService = createProxyDetectionService();
        console.log('✓ 代理检测服务初始化');
      } catch (error) {
        console.warn('代理检测服务初始化失败:', error.message);
      }
      
      try {
        const { SessionManager } = require('../core/managers');
        this.managers.sessionManager = new SessionManager({
          userDataPath: app.getPath('userData')
        });
        console.log('✓ 会话管理器初始化');
      } catch (error) {
        console.warn('会话管理器初始化失败:', error.message);
      }
      
      // 5. 通知管理器
      try {
        const { NotificationManager } = require('../core/managers');
        this.managers.notificationManager = new NotificationManager();
        console.log('✓ 通知管理器初始化');
      } catch (error) {
        console.warn('通知管理器初始化失败:', error.message);
      }
      
      // 6. 翻译集成管理器
      try {
        const { TranslationIntegration } = require('../core/managers');
        this.managers.translationIntegration = new TranslationIntegration(null);
        if (typeof this.managers.translationIntegration.initialize === 'function') {
          await this.managers.translationIntegration.initialize();
        }
        console.log('✓ 翻译集成管理器初始化');
      } catch (error) {
        console.warn('翻译集成管理器初始化失败:', error.message);
      }
      
      // 7. 迁移管理器
      try {
        const { MigrationManager } = require('../core/managers');
        this.managers.migrationManager = new MigrationManager({
          userDataPath: app.getPath('userData')
        });
        console.log('✓ 迁移管理器初始化');
      } catch (error) {
        console.warn('迁移管理器初始化失败:', error.message);
      }
      
      console.log('核心管理器初始化完成');
      
    }
  }

  /**
   * 初始化UI组件
   * @returns {Promise<void>}
   */
  async initializeUIComponents() {
    try {
      // 1. 初始化主窗口
      // 让MainWindow使用其默认的正确路径，避免路径计算错误
      this.mainWindow = new MainWindow({
        width: 1400,
        height: 900,
        minWidth: 1000,
        minHeight: 600,
        title: 'WhatsApp Desktop'
      });
      this.mainWindow.initialize();
      console.log('✓ 主窗口初始化完成');

      // 2. 设置通知管理器的主窗口引用
      this.managers.notificationManager.setMainWindow(this.mainWindow);

      // 3. 初始化系统托盘（如果启用）
      if (this.config.trayConfig && this.config.trayConfig.enabled) {
        try {
          this.managers.trayManager = new TrayManager();
          this.managers.trayManager.initialize(this.mainWindow.getWindow(), this.config.trayConfig);
          
          // 设置托盘管理器引用
          this.managers.notificationManager.setTrayManager(this.managers.trayManager);
          
          console.log('✓ 系统托盘初始化完成');
        } catch (error) {
          console.warn('系统托盘初始化失败:', error.message);
        }
      }

      // 4. 设置窗口关闭事件处理器
      this.setupMainWindowCloseHandler();
      console.log('✓ 窗口关闭处理器已设置');

    } catch (error) {
      throw new Error(`Failed to initialize UI components: ${error.message}`);
    }
  }

  /**
   * 初始化ViewManager
   * @returns {Promise<void>}
   */
  async initializeViewManager() {
    try {
      this.viewManager = new ViewManager(this.mainWindow, this.managers.sessionManager, {
        defaultSidebarWidth: 280,
        translationIntegration: this.managers.translationIntegration,
        accountManager: this.managers.accountConfigManager
      });
      console.log('✓ ViewManager初始化完成');
    } catch (error) {
      throw new Error(`Failed to initialize ViewManager: ${error.message}`);
    }
  }

  /**
   * 设置主窗口关闭处理器
   */
  setupMainWindowCloseHandler() {
    if (!this.mainWindow || this.mainWindow.isDestroyed()) {
      return;
    }

    const window = this.mainWindow.getWindow();
    if (!window) {
      return;
    }

    window.on('close', async () => {
      console.log('主窗口正在关闭');
      try {
        await this.saveApplicationState();
        console.log('窗口关闭前状态已保存');
      } catch (error) {
        console.error('保存窗口关闭状态时出错:', error);
      }
    });
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
   * 保存应用状态
   * @returns {Promise<void>}
   */
  async saveApplicationState() {
    try {
      // 1. 保存活跃账号ID
      if (this.viewManager) {
        const activeAccountId = this.viewManager.getActiveAccountId();
        if (activeAccountId) {
          console.log(`当前活跃账号: ${activeAccountId}`);
        }
      }

      // 2. 保存所有账号的最后活跃时间
      if (this.managers.accountConfigManager && this.viewManager) {
        const accounts = await this.managers.accountConfigManager.loadAccounts();
        let updatedCount = 0;

        for (const account of accounts) {
          if (this.viewManager.hasView(account.id)) {
            await this.managers.accountConfigManager.updateAccount(account.id, {
              lastActiveAt: new Date()
            });
            updatedCount++;
          }
        }

        console.log(`已更新 ${updatedCount} 个账号的活跃时间`);
      }

      // 3. 保存窗口状态
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        const bounds = this.mainWindow.getBounds();
        if (bounds) {
          console.log(`窗口状态已保存: ${bounds.width}x${bounds.height}`);
        }
      }

      console.log('应用状态保存完成');
    } catch (error) {
      console.error('保存应用状态时出错:', error);
      throw error;
    }
  }

  /**
   * 执行遗留数据清理
   * @returns {Promise<void>}
   */
  async performOrphanedDataCleanup() {
    try {
      console.log('开始执行自动数据清理...');

      const userDataPath = app.getPath('userData');
      const cleaner = new OrphanedDataCleaner({
        userDataPath,
        logFunction: (level, message, ...args) => {
          console.log(`[${level.toUpperCase()}] OrphanedDataCleaner: ${message}`, ...args);
        }
      });

      const accounts = await this.managers.accountConfigManager.loadAccounts();
      const accountIds = accounts.map(acc => acc.id);

      console.log(`当前账号数量: ${accounts.length}`);
      
      const cleanupResult = await cleaner.scanAndClean(accountIds);

      if (cleanupResult.success) {
        console.log(`自动清理完成: 清理了 ${cleanupResult.cleaned} 个遗留目录`);
        if (cleanupResult.details.totalSizeFreed > 0) {
          console.log(`释放磁盘空间: ${cleanupResult.details.totalSizeFreed} 字节`);
        }
      } else {
        console.warn(`自动清理完成但有错误: ${cleanupResult.errors.join(', ')}`);
      }
    } catch (error) {
      console.error('自动数据清理失败:', error);
    }
  }

  /**
   * 确保所有账号启用了翻译功能
   * @returns {Promise<void>}
   */
  async ensureTranslationEnabled() {
    try {
      const accounts = await this.managers.accountConfigManager.loadAccounts();
      let updatedCount = 0;

      for (const account of accounts) {
        let needsUpdate = false;

        if (!account.translation) {
          account.translation = {
            enabled: true,
            targetLanguage: 'zh-CN',
            engine: 'google',
            apiKey: '',
            autoTranslate: false,
            translateInput: false,
            friendSettings: {}
          };
          needsUpdate = true;
        } else if (!account.translation.enabled) {
          account.translation.enabled = true;
          needsUpdate = true;
        }

        if (needsUpdate) {
          await this.managers.accountConfigManager.saveAccount(account);
          updatedCount++;
          console.log(`已为账号 ${account.name} 启用翻译功能`);
        }
      }

      if (updatedCount > 0) {
        console.log(`已为 ${updatedCount} 个账号启用翻译功能`);
      }
    } catch (error) {
      console.error('检查翻译配置时出错:', error);
    }
  }

  /**
   * 清理资源
   * @returns {Promise<void>}
   */
  async cleanup() {
    console.log('开始清理资源...');

    try {
      // 1. 保存应用状态
      await this.saveApplicationState();

      // 2. 停止所有监控
      if (this.viewManager) {
        try {
          const stopResult = this.viewManager.stopAllConnectionMonitoring();
          console.log(`连接监控已停止: ${stopResult.stopped} 个账号`);

          const stopLoginResult = this.viewManager.stopAllLoginStatusMonitoring();
          console.log(`登录状态监控已停止: ${stopLoginResult.stopped} 个账号`);
        } catch (error) {
          console.error('停止监控时出错:', error);
        }
      }

      // 3. 优雅关闭所有BrowserView
      if (this.viewManager) {
        console.log('开始优雅关闭所有BrowserView...');
        const allViews = this.viewManager.getAllViews();
        console.log(`准备关闭 ${allViews.length} 个BrowserView`);

        const result = await this.viewManager.destroyAllViews();
        console.log(`BrowserView关闭完成: ${result.destroyed} 个成功, ${result.failed} 个失败`);
      }

      // 4. 销毁系统托盘
      if (this.managers.trayManager) {
        this.managers.trayManager.destroy();
        this.managers.trayManager = null;
        console.log('系统托盘已销毁');
      }

      // 5. 清理翻译集成
      if (this.managers.translationIntegration) {
        this.managers.translationIntegration.cleanup();
        console.log('翻译集成已清理');
      }

      // 6. 清理通知管理器
      if (this.managers.notificationManager) {
        this.managers.notificationManager.clearAll();
        console.log('通知管理器已清理');
      }

      console.log('资源清理完成');
    } catch (error) {
      console.error('资源清理过程中发生错误:', error);
    }
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
   * 获取ViewManager实例
   * @returns {Object} ViewManager实例
   */
  getViewManager() {
    return this.viewManager;
  }

  /**
   * 获取主窗口实例
   * @returns {Object} 主窗口实例
   */
  getMainWindow() {
    return this.mainWindow;
  }

  /**
   * 获取所有管理器
   * @returns {Object} 所有管理器实例
   */
  getAllManagers() {
    return { ...this.managers };
  }

  /**
   * 获取应用状态
   * @returns {Object} 应用状态
   */
  getStatus() {
    return {
      isInitialized: this.isInitialized,
      hasMainWindow: !!this.mainWindow,
      hasViewManager: !!this.viewManager,
      managers: Object.keys(this.managers),
      version: APP_INFO.VERSION,
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage(),
      platform: process.platform
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
