/**
 * 视图内存管理器
 * 
 * 专门负责BrowserView的内存管理和监控
 * 处理内存使用监控、自动清理、内存限制等功能
 */

const { PERFORMANCE_CONFIG } = require('../../app/constants');

/**
 * 视图内存管理器类
 */
class ViewMemoryManager {
  /**
   * 创建内存管理器
   * @param {Object} options - 配置选项
   * @param {number} options.memoryWarningThreshold - 内存警告阈值(MB)
   * @param {number} options.maxMemoryPerView - 每视图最大内存(MB)
   * @param {boolean} options.autoMemoryCleanup - 是否启用自动内存清理
   * @param {number} options.monitorInterval - 监控间隔(ms)
   */
  constructor(options = {}) {
    this.options = {
      memoryWarningThreshold: options.memoryWarningThreshold || PERFORMANCE_CONFIG.MEMORY.WARNING_THRESHOLD / (1024 * 1024),
      maxMemoryPerView: options.maxMemoryPerView || PERFORMANCE_CONFIG.MEMORY.MAX_SIZE / (1024 * 1024),
      autoMemoryCleanup: options.autoMemoryCleanup !== false,
      monitorInterval: options.monitorInterval || PERFORMANCE_CONFIG.MEMORY.GC_INTERVAL,
      ...options
    };

    // 内存使用缓存
    this.memoryUsageCache = new Map();
    
    // 视图访问时间跟踪
    this.viewAccessTimes = new Map();
    
    // 内存监控定时器
    this.memoryMonitorInterval = null;
    
    // 日志记录器
    this.logger = this._createLogger();

    // 启动内存监控
    if (this.options.autoMemoryCleanup) {
      this.startMemoryMonitoring();
    }
  }

  /**
   * 开始内存监控
   */
  startMemoryMonitoring() {
    if (this.memoryMonitorInterval) {
      this.logger.warn('Memory monitoring is already running');
      return;
    }

    this.memoryMonitorInterval = setInterval(() => {
      this.performMemoryCheck();
    }, this.options.monitorInterval);

    this.logger.info('Memory monitoring started', {
      interval: this.options.monitorInterval
    });
  }

  /**
   * 停止内存监控
   */
  stopMemoryMonitoring() {
    if (this.memoryMonitorInterval) {
      clearInterval(this.memoryMonitorInterval);
      this.memoryMonitorInterval = null;
      this.logger.info('Memory monitoring stopped');
    }
  }

  /**
   * 执行内存检查
   */
  async performMemoryCheck() {
    try {
      const totalMemoryUsage = this.getTotalMemoryUsage();
      
      if (totalMemoryUsage > this.options.memoryWarningThreshold) {
        this.logger.warn('High memory usage detected', {
          totalMemoryUsage: `${totalMemoryUsage}MB`,
          threshold: `${this.options.memoryWarningThreshold}MB`
        });
        
        // 触发内存清理
        await this.performMemoryCleanup();
      }

    } catch (error) {
      this.logger.error('Failed to perform memory check', {
        error: error.message
      });
    }
  }

  /**
   * 记录视图内存使用
   * @param {string} accountId - 账号ID
   * @param {Object} viewState - 视图状态
   * @param {number} memoryUsage - 内存使用量(MB)
   */
  recordMemoryUsage(accountId, viewState, memoryUsage) {
    if (!accountId || !viewState) {
      return;
    }

    this.memoryUsageCache.set(accountId, {
      memoryUsage,
      timestamp: Date.now(),
      viewState
    });

    // 更新访问时间
    this.updateViewAccessTime(accountId);
  }

  /**
   * 更新视图访问时间
   * @param {string} accountId - 账号ID
   */
  updateViewAccessTime(accountId) {
    this.viewAccessTimes.set(accountId, Date.now());
  }

  /**
   * 获取视图内存使用情况
   * @param {string} accountId - 账号ID
   * @returns {Object|null} 内存使用信息
   */
  getViewMemoryUsage(accountId) {
    return this.memoryUsageCache.get(accountId) || null;
  }

  /**
   * 获取总内存使用量
   * @returns {number} 总内存使用量(MB)
   */
  getTotalMemoryUsage() {
    let total = 0;
    for (const usageInfo of this.memoryUsageCache.values()) {
      total += usageInfo.memoryUsage || 0;
    }
    return total;
  }

  /**
   * 获取视图内存使用统计
   * @returns {Object} 内存统计信息
   */
  getMemoryStatistics() {
    const viewStats = [];
    let totalMemory = 0;
    
    for (const [accountId, usageInfo] of this.memoryUsageCache.entries()) {
      const memoryUsage = usageInfo.memoryUsage || 0;
      const accessTime = this.viewAccessTimes.get(accountId) || usageInfo.timestamp;
      
      viewStats.push({
        accountId,
        memoryUsage,
        lastAccess: accessTime,
        age: Date.now() - accessTime,
        isActive: this._isViewActive(accountId)
      });
      
      totalMemory += memoryUsage;
    }

    // 按内存使用量排序
    viewStats.sort((a, b) => b.memoryUsage - a.memoryUsage);

    return {
      totalMemory,
      viewCount: this.memoryUsageCache.size,
      views: viewStats,
      averageMemory: viewStats.length > 0 ? totalMemory / viewStats.length : 0,
      memoryThreshold: this.options.memoryWarningThreshold,
      maxMemoryPerView: this.options.maxMemoryPerView
    };
  }

  /**
   * 执行内存清理
   */
  async performMemoryCleanup() {
    this.logger.info('Starting memory cleanup');
    
    let cleanedCount = 0;
    let freedMemory = 0;
    
    // 清理过期的内存缓存条目
    const expirationTime = Date.now() - (10 * 60 * 1000); // 10分钟
    for (const [accountId, usageInfo] of this.memoryUsageCache.entries()) {
      if (usageInfo.timestamp < expirationTime && !this._isViewActive(accountId)) {
        this.memoryUsageCache.delete(accountId);
        this.viewAccessTimes.delete(accountId);
        cleanedCount++;
        freedMemory += usageInfo.memoryUsage || 0;
      }
    }

    // 垃圾回收提示（如果视图支持）
    if (global.gc) {
      global.gc();
    }

    this.logger.info('Memory cleanup completed', {
      cleanedCount,
      freedMemory: `${freedMemory}MB`
    });

    return {
      cleanedCount,
      freedMemory
    };
  }

  /**
   * 清理指定视图的内存信息
   * @param {string} accountId - 账号ID
   */
  cleanupViewMemory(accountId) {
    if (this.memoryUsageCache.has(accountId)) {
      const usageInfo = this.memoryUsageCache.get(accountId);
      this.memoryUsageCache.delete(accountId);
      this.viewAccessTimes.delete(accountId);
      
      this.logger.debug('Cleaned up memory info for view', {
        accountId,
        freedMemory: usageInfo.memoryUsage
      });
    }
  }

  /**
   * 检查视图是否处于活动状态
   * @param {string} accountId - 账号ID
   * @returns {boolean} 是否活动
   */
  _isViewActive(accountId) {
    const accessTime = this.viewAccessTimes.get(accountId);
    if (!accessTime) return false;
    
    // 5分钟内访问过的视图认为处于活动状态
    return (Date.now() - accessTime) < (5 * 60 * 1000);
  }

  /**
   * 获取内存警告的视图列表
   * @returns {Array} 超过内存阈值的视图
   */
  getMemoryWarningViews() {
    const warningViews = [];
    
    for (const [accountId, usageInfo] of this.memoryUsageCache.entries()) {
      const memoryUsage = usageInfo.memoryUsage || 0;
      
      if (memoryUsage > this.options.memoryWarningThreshold) {
        warningViews.push({
          accountId,
          memoryUsage,
          threshold: this.options.memoryWarningThreshold,
          excess: memoryUsage - this.options.memoryWarningThreshold
        });
      }
    }

    return warningViews.sort((a, b) => b.excess - a.excess);
  }

  /**
   * 强制垃圾回收（如果支持）
   */
  forceGarbageCollection() {
    if (global.gc) {
      global.gc();
      this.logger.info('Forced garbage collection performed');
    } else {
      this.logger.warn('Garbage collection not available (run with --expose-gc)');
    }
  }

  /**
   * 获取内存使用报告
   * @returns {Object} 详细内存报告
   */
  getMemoryReport() {
    const stats = this.getMemoryStatistics();
    const warningViews = this.getMemoryWarningViews();
    
    return {
      summary: {
        totalMemory: `${stats.totalMemory}MB`,
        viewCount: stats.viewCount,
        averageMemory: `${stats.averageMemory.toFixed(2)}MB`,
        isMonitoring: !!this.memoryMonitorInterval
      },
      thresholds: {
        warning: `${this.options.memoryWarningThreshold}MB`,
        maxPerView: `${this.options.maxMemoryPerView}MB`
      },
      warningViews,
      recommendations: this._getMemoryRecommendations(stats, warningViews)
    };
  }

  /**
   * 获取内存优化建议
   * @param {Object} stats - 内存统计
   * @param {Array} warningViews - 警告视图
   * @returns {Array} 建议列表
   */
  _getMemoryRecommendations(stats, warningViews) {
    const recommendations = [];
    
    if (stats.totalMemory > this.options.memoryWarningThreshold * stats.viewCount) {
      recommendations.push('Consider reducing the number of concurrent views');
    }
    
    if (warningViews.length > 0) {
      recommendations.push('Close or reload views with high memory usage');
      recommendations.push('Enable aggressive memory cleanup mode');
    }
    
    if (stats.averageMemory > this.options.memoryWarningThreshold / 2) {
      recommendations.push('Monitor memory usage trends');
    }
    
    return recommendations;
  }

  /**
   * 创建日志记录器
   * @returns {Object} 日志记录器
   */
  _createLogger() {
    return {
      debug: (message, data) => {
        if (process.env.NODE_ENV === 'development') {
          console.debug(`[ViewMemoryManager] ${message}`, data || '');
        }
      },
      info: (message, data) => {
        console.info(`[ViewMemoryManager] ${message}`, data || '');
      },
      warn: (message, data) => {
        console.warn(`[ViewMemoryManager] ${message}`, data || '');
      },
      error: (message, data) => {
        console.error(`[ViewMemoryManager] ${message}`, data || '');
      }
    };
  }

  /**
   * 销毁内存管理器
   */
  destroy() {
    this.stopMemoryMonitoring();
    this.memoryUsageCache.clear();
    this.viewAccessTimes.clear();
    this.logger.info('ViewMemoryManager destroyed');
  }
}

module.exports = ViewMemoryManager;
