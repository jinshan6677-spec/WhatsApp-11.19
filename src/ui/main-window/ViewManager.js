/**
 * 重构后的视图管理器 - BrowserView生命周期管理器
 * 
 * 专门负责BrowserView实例的创建、切换、隐藏和销毁
 * 维护会话隔离，支持单窗口架构
 * 
 * 核心职责：
 * - BrowserView生命周期管理
 * - 视图状态跟踪
 * - 视图池管理
 * - 错误处理和恢复
 */

const { BrowserView } = require('electron');
const path = require('path');
const { validateViewCreationParams, validateAccountSwitch } = require('../../shared/utils');

// 引入专门的管理器
const ViewBoundsManager = require('./ViewBoundsManager');
const ViewMemoryManager = require('./ViewMemoryManager');
const { getErrorHandler } = require('../../shared/utils');

/**
 * 视图状态枚举
 */
const ViewStatus = {
  CREATING: 'creating',
  READY: 'ready',
  LOADING: 'loading',
  ACTIVE: 'active',
  HIDDEN: 'hidden',
  ERROR: 'error',
  DESTROYING: 'destroying',
  DESTROYED: 'destroyed'
};

/**
 * 视图管理器类
 */
class ViewManager {
  /**
   * 创建视图管理器实例
   * @param {Object} mainWindow - 主窗口实例
   * @param {Object} sessionManager - 会话管理器实例
   * @param {Object} [options] - 配置选项
   */
  constructor(mainWindow, sessionManager, options = {}) {
    if (!mainWindow) {
      throw new Error('MainWindow instance is required');
    }
    if (!sessionManager) {
      throw new Error('SessionManager instance is required');
    }

    this.mainWindow = mainWindow;
    this.sessionManager = sessionManager;
    this.options = {
      defaultSidebarWidth: options.defaultSidebarWidth || 280,
      debounceDelay: options.debounceDelay || 100,
      lazyLoadViews: options.lazyLoadViews !== false,
      maxConcurrentViews: options.maxConcurrentViews || 10,
      viewPoolSize: options.viewPoolSize || 2,
      ...options
    };

    // 视图映射：accountId -> ViewState
    this.views = new Map();
    
    // 当前活动账号ID
    this.activeAccountId = null;

    // 专门的管理器组件
    this.boundsManager = new ViewBoundsManager({
      defaultSidebarWidth: this.options.defaultSidebarWidth,
      debounceDelay: this.options.debounceDelay
    });

    this.memoryManager = new ViewMemoryManager({
      autoMemoryCleanup: true,
      monitorInterval: 30000 // 30秒
    });

    // 错误处理器
    this.errorHandler = getErrorHandler();

    // 日志记录器
    this.logger = this._createLogger();

    // 状态存储
    this.stateStore = this.mainWindow.getStateStore();

    // 视图池（用于重用）
    this.viewPool = [];

    // 性能监控
    this.performanceMetrics = {
      totalViewsCreated: 0,
      totalViewsDestroyed: 0,
      averageLoadTime: 0,
      memoryUsageHistory: []
    };
  }

  /**
   * 创建BrowserView实例
   * @param {string} accountId - 账号ID
   * @param {Object} accountConfig - 账号配置
   * @returns {Promise<Object>} 视图状态对象
   */
  async createView(accountId, accountConfig) {
    try {
      // 验证参数
      validateViewCreationParams(accountId, accountConfig);
      
      // 检查是否已存在
      if (this.views.has(accountId)) {
        this.logger.warn('View already exists for account', { accountId });
        return this.views.get(accountId);
      }

      this.logger.info('Creating view for account', { accountId });

      // 创建视图状态对象
      const viewState = {
        accountId,
        accountConfig,
        browserView: null,
        status: ViewStatus.CREATING,
        createdAt: Date.now(),
        lastAccessed: Date.now(),
        loadStartTime: null,
        loadEndTime: null,
        errorCount: 0,
        retryCount: 0
      };

      // 从池中获取或创建新的BrowserView
      viewState.browserView = await this._getBrowserViewFromPool();
      
      // 配置BrowserView
      await this._configureBrowserView(viewState.browserView, accountConfig);
      
      // 设置Web内容
      await this._loadWebContent(viewState.browserView);
      
      // 更新状态
      viewState.status = ViewStatus.READY;
      viewState.loadEndTime = Date.now();
      
      // 记录性能指标
      this._updatePerformanceMetrics(viewState);
      
      // 存储视图
      this.views.set(accountId, viewState);
      
      // 记录内存使用
      this.memoryManager.recordMemoryUsage(accountId, viewState, 0); // 初始内存使用
      
      this.logger.info('View created successfully', { 
        accountId, 
        loadTime: viewState.loadEndTime - viewState.loadStartTime 
      });
      
      return viewState;

    } catch (error) {
      this.logger.error('Failed to create view', { accountId, error: error.message });
      
      // 错误处理
      await this.errorHandler.handleInstanceError(accountId, error, {
        operation: 'createView',
        accountConfig
      });
      
      throw error;
    }
  }

  /**
   * 显示指定账号的视图
   * @param {string} accountId - 账号ID
   * @param {Object} [bounds] - 视图边界
   * @returns {Promise<boolean>} 是否成功
   */
  async showView(accountId, bounds) {
    try {
      // 验证账号切换
      validateAccountSwitch(accountId, this.views);
      
      const viewState = this.views.get(accountId);
      if (!viewState) {
        throw new Error(`View not found for account: ${accountId}`);
      }

      this.logger.debug('Showing view', { accountId });

      // 更新活动账号
      this.activeAccountId = accountId;
      
      // 更新视图状态
      viewState.status = ViewStatus.ACTIVE;
      viewState.lastAccessed = Date.now();
      
      // 设置为主内容视图
      if (viewState.browserView && !viewState.browserView.isDestroyed()) {
        this.mainWindow.setContentView(viewState.browserView);
        
        // 应用边界
        if (bounds) {
          viewState.browserView.setBounds(bounds);
        }
        
        this.logger.debug('View shown successfully', { accountId });
        return true;
      } else {
        throw new Error(`BrowserView is destroyed or invalid for account: ${accountId}`);
      }

    } catch (error) {
      this.logger.error('Failed to show view', { accountId, error: error.message });
      
      // 错误处理
      const viewState = this.views.get(accountId);
      if (viewState) {
        viewState.status = ViewStatus.ERROR;
        viewState.errorCount++;
      }
      
      await this.errorHandler.handleInstanceError(accountId, error, {
        operation: 'showView',
        bounds
      });
      
      return false;
    }
  }

  /**
   * 隐藏指定账号的视图
   * @param {string} accountId - 账号ID
   * @returns {Promise<boolean>} 是否成功
   */
  async hideView(accountId) {
    try {
      const viewState = this.views.get(accountId);
      if (!viewState) {
        this.logger.warn('View not found for account', { accountId });
        return false;
      }

      this.logger.debug('Hiding view', { accountId });

      // 更新状态
      viewState.status = ViewStatus.HIDDEN;
      
      // 更新内存管理器
      this.memoryManager.updateViewAccessTime(accountId);

      // 如果是当前活动账号，清除活动状态
      if (this.activeAccountId === accountId) {
        this.activeAccountId = null;
      }

      this.logger.debug('View hidden successfully', { accountId });
      return true;

    } catch (error) {
      this.logger.error('Failed to hide view', { accountId, error: error.message });
      return false;
    }
  }

  /**
   * 销毁指定账号的视图
   * @param {string} accountId - 账号ID
   * @returns {Promise<boolean>} 是否成功
   */
  async destroyView(accountId) {
    try {
      const viewState = this.views.get(accountId);
      if (!viewState) {
        this.logger.warn('View not found for account', { accountId });
        return false;
      }

      this.logger.info('Destroying view', { accountId });

      // 更新状态
      viewState.status = ViewStatus.DESTROYING;

      // 如果是当前活动账号，清除活动状态
      if (this.activeAccountId === accountId) {
        this.activeAccountId = null;
        this.mainWindow.setContentView(null);
      }

      // 清理BrowserView
      if (viewState.browserView && !viewState.browserView.isDestroyed()) {
        // 返回到池中重用或销毁
        await this._returnBrowserViewToPool(viewState.browserView);
      }

      // 清理内存管理器中的记录
      this.memoryManager.cleanupViewMemory(accountId);
      
      // 更新性能指标
      this.performanceMetrics.totalViewsDestroyed++;
      
      // 从映射中移除
      this.views.delete(accountId);
      
      viewState.status = ViewStatus.DESTROYED;

      this.logger.info('View destroyed successfully', { accountId });
      return true;

    } catch (error) {
      this.logger.error('Failed to destroy view', { accountId, error: error.message });
      
      // 强制移除
      this.views.delete(accountId);
      this.memoryManager.cleanupViewMemory(accountId);
      
      return false;
    }
  }

  /**
   * 获取BrowserView（从池中或新建）
   * @returns {Promise<BrowserView>} BrowserView实例
   */
  async _getBrowserViewFromPool() {
    // 尝试从池中获取
    if (this.viewPool.length > 0) {
      return this.viewPool.pop();
    }

    // 创建新的BrowserView
    const webPreferences = {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      ...this.options.viewConfig?.webPreferences
    };

    return new BrowserView({ 
      webPreferences,
      ...this.options.viewConfig 
    });
  }

  /**
   * 配置BrowserView
   * @param {BrowserView} browserView - BrowserView实例
   * @param {Object} accountConfig - 账号配置
   */
  async _configureBrowserView(browserView, accountConfig) {
    // 设置User Agent
    if (accountConfig.userAgent) {
      browserView.setUserAgent(accountConfig.userAgent);
    }

    // 设置代理（如果配置了）
    if (accountConfig.proxy && accountConfig.proxy.enabled) {
      // 代理设置逻辑将在后续实现
    }
  }

  /**
   * 加载Web内容
   * @param {BrowserView} browserView - BrowserView实例
   */
  async _loadWebContent(browserView) {
    // 加载WhatsApp Web
    browserView.loadURL('https://web.whatsapp.com');
  }

  /**
   * 将BrowserView返回到池中
   * @param {BrowserView} browserView - BrowserView实例
   */
  async _returnBrowserViewToPool(browserView) {
    // 池大小限制
    if (this.viewPool.length < this.options.viewPoolSize) {
      // 清理Web内容
      try {
        await browserView.webContents.session.clearStorageData();
      } catch (error) {
        this.logger.warn('Failed to clear storage data for reused view', { error: error.message });
      }
      
      // 添加到池中
      this.viewPool.push(browserView);
    } else {
      // 池已满，直接销毁
      try {
        browserView.destroy();
      } catch (error) {
        this.logger.warn('Failed to destroy BrowserView', { error: error.message });
      }
    }
  }

  /**
   * 更新性能指标
   * @param {Object} viewState - 视图状态
   */
  _updatePerformanceMetrics(viewState) {
    this.performanceMetrics.totalViewsCreated++;
    
    if (viewState.loadEndTime && viewState.loadStartTime) {
      const loadTime = viewState.loadEndTime - viewState.loadStartTime;
      this.performanceMetrics.averageLoadTime = 
        (this.performanceMetrics.averageLoadTime + loadTime) / 2;
    }
  }

  /**
   * 获取视图状态
   * @param {string} accountId - 账号ID
   * @returns {Object|null} 视图状态
   */
  getViewState(accountId) {
    return this.views.get(accountId) || null;
  }

  /**
   * 获取所有视图状态
   * @returns {Map} 视图状态映射
   */
  getAllViewStates() {
    return new Map(this.views);
  }

  /**
   * 获取活动账号ID
   * @returns {string|null} 活动账号ID
   */
  getActiveAccountId() {
    return this.activeAccountId;
  }

  /**
   * 获取性能指标
   * @returns {Object} 性能指标
   */
  getPerformanceMetrics() {
    return {
      ...this.performanceMetrics,
      activeViews: this.views.size,
      poolSize: this.viewPool.length,
      memoryStats: this.memoryManager.getMemoryStatistics()
    };
  }

  /**
   * 创建日志记录器
   * @returns {Object} 日志记录器
   */
  _createLogger() {
    return {
      debug: (message, data) => {
        if (process.env.NODE_ENV === 'development') {
          console.debug(`[ViewManager] ${message}`, data || '');
        }
      },
      info: (message, data) => {
        console.info(`[ViewManager] ${message}`, data || '');
      },
      warn: (message, data) => {
        console.warn(`[ViewManager] ${message}`, data || '');
      },
      error: (message, data) => {
        console.error(`[ViewManager] ${message}`, data || '');
      }
    };
  }

  /**
   * 销毁视图管理器
   */
  async destroy() {
    this.logger.info('Destroying ViewManager');
    
    // 销毁所有视图
    const destroyPromises = Array.from(this.views.keys()).map(accountId => 
      this.destroyView(accountId)
    );
    
    await Promise.all(destroyPromises);
    
    // 清理池中的视图
    for (const browserView of this.viewPool) {
      try {
        browserView.destroy();
      } catch (error) {
        this.logger.warn('Failed to destroy pooled BrowserView', { error: error.message });
      }
    }
    this.viewPool.clear();
    
    // 销毁子管理器
    this.boundsManager.destroy();
    this.memoryManager.destroy();
    
    this.logger.info('ViewManager destroyed');
  }
}

module.exports = ViewManager;
