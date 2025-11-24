/**
 * 视图边界管理器
 * 
 * 专门负责BrowserView的边界计算和管理
 * 处理窗口大小变化、侧边栏宽度变化等场景下的视图边界更新
 */

const { APP_INFO, WINDOW_CONFIG } = require('../../app/constants');

/**
 * 视图边界管理器类
 */
class ViewBoundsManager {
  /**
   * 创建边界管理器
   * @param {Object} options - 配置选项
   * @param {number} options.defaultSidebarWidth - 默认侧边栏宽度
   * @param {number} options.debounceDelay - 防抖延迟
   */
  constructor(options = {}) {
    this.options = {
      defaultSidebarWidth: options.defaultSidebarWidth || WINDOW_CONFIG.SIDEBAR_WIDTH,
      debounceDelay: options.debounceDelay || 100,
      ...options
    };

    // 边界缓存
    this.boundsCache = {
      lastSidebarWidth: null,
      lastWindowBounds: null,
      cachedBounds: null,
      cacheTimestamp: null
    };

    // 防抖定时器
    this.resizeDebounceTimer = null;

    // 日志记录器
    this.logger = this._createLogger();
  }

  /**
   * 计算BrowserView的边界
   * @param {Object} windowBounds - 窗口边界
   * @param {number} sidebarWidth - 侧边栏宽度
   * @returns {Object} 视图边界
   */
  calculateViewBounds(windowBounds, sidebarWidth) {
    if (!windowBounds) {
      throw new Error('Window bounds are required');
    }

    const { width, height } = windowBounds;
    
    // 计算主内容区域边界（排除侧边栏）
    const viewBounds = {
      x: sidebarWidth,
      y: 0,
      width: Math.max(0, width - sidebarWidth),
      height: height
    };

    // 验证边界值
    if (viewBounds.width < 0 || viewBounds.height < 0) {
      this.logger.warn('Invalid view bounds calculated', {
        windowBounds,
        sidebarWidth,
        viewBounds
      });
    }

    return viewBounds;
  }

  /**
   * 获取缓存的边界（如果有效）
   * @param {Object} windowBounds - 当前窗口边界
   * @param {number} sidebarWidth - 当前侧边栏宽度
   * @returns {Object|null} 缓存的边界或null
   */
  getCachedBounds(windowBounds, sidebarWidth) {
    const { cachedBounds, lastWindowBounds, lastSidebarWidth, cacheTimestamp } = this.boundsCache;
    
    // 检查缓存是否仍然有效
    if (
      cachedBounds &&
      lastWindowBounds &&
      lastSidebarWidth !== null &&
      this._isWindowBoundsEqual(windowBounds, lastWindowBounds) &&
      sidebarWidth === lastSidebarWidth
    ) {
      const cacheAge = Date.now() - cacheTimestamp;
      // 缓存5秒内认为有效
      if (cacheAge < 5000) {
        return cachedBounds;
      }
    }

    return null;
  }

  /**
   * 更新边界缓存
   * @param {Object} windowBounds - 窗口边界
   * @param {number} sidebarWidth - 侧边栏宽度
   * @param {Object} viewBounds - 计算出的视图边界
   */
  updateBoundsCache(windowBounds, sidebarWidth, viewBounds) {
    this.boundsCache = {
      lastSidebarWidth: sidebarWidth,
      lastWindowBounds: { ...windowBounds },
      cachedBounds: { ...viewBounds },
      cacheTimestamp: Date.now()
    };
  }

  /**
   * 处理窗口大小变化
   * @param {Object} windowBounds - 新的窗口边界
   * @param {number} sidebarWidth - 当前侧边栏宽度
   * @param {Function} callback - 边界变化回调
   */
  handleWindowResize(windowBounds, sidebarWidth, callback) {
    // 清除之前的防抖定时器
    if (this.resizeDebounceTimer) {
      clearTimeout(this.resizeDebounceTimer);
    }

    // 设置新的防抖定时器
    this.resizeDebounceTimer = setTimeout(() => {
      this.resizeDebounceTimer = null;
      
      try {
        // 尝试从缓存获取
        let viewBounds = this.getCachedBounds(windowBounds, sidebarWidth);
        
        if (!viewBounds) {
          // 计算新的边界
          viewBounds = this.calculateViewBounds(windowBounds, sidebarWidth);
          this.updateBoundsCache(windowBounds, sidebarWidth, viewBounds);
        }

        this.logger.debug('Window resize handled', {
          windowBounds,
          sidebarWidth,
          viewBounds,
          fromCache: !!viewBounds && this.boundsCache.cachedBounds === viewBounds
        });

        // 执行回调
        if (callback && typeof callback === 'function') {
          callback(viewBounds);
        }

      } catch (error) {
        this.logger.error('Failed to handle window resize', {
          error: error.message,
          windowBounds,
          sidebarWidth
        });
      }
    }, this.options.debounceDelay);
  }

  /**
   * 处理侧边栏宽度变化
   * @param {number} newSidebarWidth - 新的侧边栏宽度
   * @param {Object} windowBounds - 当前窗口边界
   * @param {Function} callback - 边界变化回调
   */
  handleSidebarResize(newSidebarWidth, windowBounds, callback) {
    // 验证侧边栏宽度
    const validatedWidth = this._validateSidebarWidth(newSidebarWidth);
    
    if (validatedWidth !== newSidebarWidth) {
      this.logger.warn('Sidebar width adjusted to valid range', {
        originalWidth: newSidebarWidth,
        adjustedWidth: validatedWidth
      });
    }

    this.handleWindowResize(windowBounds, validatedWidth, callback);
  }

  /**
   * 为所有视图更新边界
   * @param {Map} views - 视图Map
   * @param {Object} windowBounds - 窗口边界
   * @param {number} sidebarWidth - 侧边栏宽度
   */
  updateAllViewBounds(views, windowBounds, sidebarWidth) {
    const viewBounds = this.getCachedBounds(windowBounds, sidebarWidth) ||
                      this.calculateViewBounds(windowBounds, sidebarWidth);
    
    // 更新缓存
    this.updateBoundsCache(windowBounds, sidebarWidth, viewBounds);

    // 应用到所有视图
    let updatedCount = 0;
    for (const [accountId, viewState] of views.entries()) {
      if (viewState.browserView && !viewState.browserView.isDestroyed()) {
        try {
          viewState.browserView.setBounds(viewBounds);
          updatedCount++;
        } catch (error) {
          this.logger.warn(`Failed to update bounds for view ${accountId}`, {
            error: error.message
          });
        }
      }
    }

    this.logger.info('Updated bounds for all views', {
      totalViews: views.size,
      updatedCount,
      viewBounds
    });

    return updatedCount;
  }

  /**
   * 验证侧边栏宽度是否在有效范围内
   * @param {number} sidebarWidth - 侧边栏宽度
   * @returns {number} 验证后的宽度
   */
  _validateSidebarWidth(sidebarWidth) {
    const minWidth = WINDOW_CONFIG.SIDEBAR_MIN_WIDTH || 200;
    const maxWidth = WINDOW_CONFIG.SIDEBAR_MAX_WIDTH || 400;
    
    return Math.max(minWidth, Math.min(maxWidth, sidebarWidth));
  }

  /**
   * 检查窗口边界是否相等
   * @param {Object} bounds1 - 边界1
   * @param {Object} bounds2 - 边界2
   * @returns {boolean} 是否相等
   */
  _isWindowBoundsEqual(bounds1, bounds2) {
    if (!bounds1 || !bounds2) return false;
    
    return (
      bounds1.x === bounds2.x &&
      bounds1.y === bounds2.y &&
      bounds1.width === bounds2.width &&
      bounds1.height === bounds2.height
    );
  }

  /**
   * 创建日志记录器
   * @returns {Object} 日志记录器
   */
  _createLogger() {
    return {
      debug: (message, data) => {
        if (process.env.NODE_ENV === 'development') {
          console.debug(`[ViewBoundsManager] ${message}`, data || '');
        }
      },
      info: (message, data) => {
        console.info(`[ViewBoundsManager] ${message}`, data || '');
      },
      warn: (message, data) => {
        console.warn(`[ViewBoundsManager] ${message}`, data || '');
      },
      error: (message, data) => {
        console.error(`[ViewBoundsManager] ${message}`, data || '');
      }
    };
  }

  /**
   * 获取边界缓存状态
   * @returns {Object} 缓存状态
   */
  getCacheStatus() {
    return {
      ...this.boundsCache,
      isValid: this.boundsCache.cachedBounds !== null,
      cacheAge: this.boundsCache.cacheTimestamp ? 
        Date.now() - this.boundsCache.cacheTimestamp : null
    };
  }

  /**
   * 清除边界缓存
   */
  clearBoundsCache() {
    this.boundsCache = {
      lastSidebarWidth: null,
      lastWindowBounds: null,
      cachedBounds: null,
      cacheTimestamp: null
    };
    
    this.logger.debug('Bounds cache cleared');
  }

  /**
   * 销毁边界管理器
   */
  destroy() {
    if (this.resizeDebounceTimer) {
      clearTimeout(this.resizeDebounceTimer);
      this.resizeDebounceTimer = null;
    }
    
    this.clearBoundsCache();
    this.logger.info('ViewBoundsManager destroyed');
  }
}

module.exports = ViewBoundsManager;
