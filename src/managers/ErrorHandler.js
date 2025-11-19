/**
 * ErrorHandler - 错误处理器
 * 
 * 处理实例崩溃、代理错误、翻译错误等各种错误情况
 * 实现自动重启逻辑和错误日志记录
 */

const fs = require('fs').promises;
const path = require('path');

/**
 * @typedef {Object} ErrorLog
 * @property {Date} timestamp - 错误时间
 * @property {string} instanceId - 实例 ID
 * @property {string} errorType - 错误类型
 * @property {string} message - 错误消息
 * @property {Object} [details] - 错误详情
 */

/**
 * ErrorHandler 类
 */
class ErrorHandler {
  /**
   * 创建错误处理器
   * @param {Object} instanceManager - 实例管理器
   * @param {Object} [options] - 配置选项
   * @param {number} [options.maxCrashCount] - 最大崩溃次数
   * @param {number} [options.crashResetTime] - 崩溃计数重置时间（毫秒）
   * @param {number} [options.restartDelay] - 重启延迟（毫秒）
   * @param {string} [options.logPath] - 日志文件路径
   */
  constructor(instanceManager, options = {}) {
    this.instanceManager = instanceManager;
    
    // 配置选项
    this.maxCrashCount = options.maxCrashCount || 3;
    this.crashResetTime = options.crashResetTime || 300000; // 5 分钟
    this.restartDelay = options.restartDelay || 5000; // 5 秒
    this.logPath = options.logPath || null;
    
    // 崩溃历史记录 Map: instanceId -> Array<Date>
    this.crashHistory = new Map();
    
    // 重启定时器 Map: instanceId -> timeoutId
    this.restartTimers = new Map();
    
    // 日志函数
    this.log = this._createLogger();
  }

  /**
   * 创建日志记录器
   * @private
   * @returns {Function}
   */
  _createLogger() {
    return (level, message, ...args) => {
      const timestamp = new Date().toISOString();
      const logMessage = `[${timestamp}] [ErrorHandler] [${level.toUpperCase()}] ${message}`;
      
      if (level === 'error') {
        console.error(logMessage, ...args);
      } else if (level === 'warn') {
        console.warn(logMessage, ...args);
      } else {
        console.log(logMessage, ...args);
      }
    };
  }

  /**
   * 处理实例崩溃
   * @param {string} instanceId - 实例 ID
   * @param {Object} error - 错误对象
   * @param {boolean} [killed] - 是否被强制终止
   * @returns {Promise<void>}
   */
  async handleInstanceCrash(instanceId, error, killed = false) {
    this.log('error', `Instance ${instanceId} crashed (killed: ${killed})`, error);
    
    // 记录崩溃
    await this._recordCrash(instanceId, error, killed);
    
    // 获取实例状态
    const status = this.instanceManager.getInstanceStatus(instanceId);
    if (!status) {
      this.log('warn', `Cannot handle crash for unknown instance ${instanceId}`);
      return;
    }
    
    // 获取崩溃历史
    const crashHistory = this._getCrashHistory(instanceId);
    
    // 清理过期的崩溃记录
    const recentCrashes = this._getRecentCrashes(crashHistory);
    
    // 更新崩溃计数
    const crashCount = recentCrashes.length;
    
    this.log('info', `Instance ${instanceId} crash count: ${crashCount}/${this.maxCrashCount}`);
    
    // 判断是否应该自动重启
    if (crashCount < this.maxCrashCount) {
      this.log('info', `Scheduling restart for instance ${instanceId} in ${this.restartDelay}ms`);
      
      // 取消之前的重启定时器（如果存在）
      this._cancelRestartTimer(instanceId);
      
      // 设置延迟重启
      const timerId = setTimeout(async () => {
        await this._attemptRestart(instanceId);
        this.restartTimers.delete(instanceId);
      }, this.restartDelay);
      
      this.restartTimers.set(instanceId, timerId);
      
    } else {
      // 超过最大崩溃次数，标记为失败
      this.log('error', `Instance ${instanceId} exceeded maximum crash count (${crashCount}). Marking as failed.`);
      
      this.instanceManager._updateStatus(instanceId, {
        status: 'error',
        error: `Instance crashed ${crashCount} times. Auto-restart disabled.`
      });
      
      // 记录错误日志
      await this._logError({
        timestamp: new Date(),
        instanceId,
        errorType: 'MAX_CRASH_COUNT_EXCEEDED',
        message: `Instance crashed ${crashCount} times within ${this.crashResetTime}ms`,
        details: { crashCount, maxCrashCount: this.maxCrashCount }
      });
    }
  }

  /**
   * 处理代理错误
   * @param {string} instanceId - 实例 ID
   * @param {Object} error - 错误对象
   * @returns {Promise<void>}
   */
  async handleProxyError(instanceId, error) {
    this.log('error', `Proxy error for instance ${instanceId}:`, error);
    
    // 更新实例状态
    this.instanceManager._updateStatus(instanceId, {
      error: `Proxy connection failed: ${error.message}`
    });
    
    // 记录错误日志
    await this._logError({
      timestamp: new Date(),
      instanceId,
      errorType: 'PROXY_ERROR',
      message: error.message,
      details: { error: error.toString() }
    });
  }

  /**
   * 处理翻译错误
   * @param {string} instanceId - 实例 ID
   * @param {Object} error - 错误对象
   * @returns {Promise<void>}
   */
  async handleTranslationError(instanceId, error) {
    this.log('warn', `Translation error for instance ${instanceId}:`, error);
    
    // 翻译错误不影响核心功能，只记录警告
    await this._logError({
      timestamp: new Date(),
      instanceId,
      errorType: 'TRANSLATION_ERROR',
      message: error.message,
      details: { error: error.toString() }
    });
  }

  /**
   * 处理页面加载错误
   * @param {string} instanceId - 实例 ID
   * @param {number} errorCode - 错误代码
   * @param {string} errorDescription - 错误描述
   * @returns {Promise<void>}
   */
  async handlePageLoadError(instanceId, errorCode, errorDescription) {
    this.log('error', `Page load error for instance ${instanceId}: ${errorDescription} (${errorCode})`);
    
    // 更新实例状态
    this.instanceManager._updateStatus(instanceId, {
      error: `Page load failed: ${errorDescription}`
    });
    
    // 记录错误日志
    await this._logError({
      timestamp: new Date(),
      instanceId,
      errorType: 'PAGE_LOAD_ERROR',
      message: errorDescription,
      details: { errorCode, errorDescription }
    });
    
    // 如果是网络错误，可能需要重试
    if (errorCode === -106 || errorCode === -105) { // ERR_INTERNET_DISCONNECTED or ERR_NAME_NOT_RESOLVED
      this.log('info', `Network error detected for instance ${instanceId}. Will retry on next restart.`);
    }
  }

  /**
   * 处理实例无响应
   * @param {string} instanceId - 实例 ID
   * @returns {Promise<void>}
   */
  async handleInstanceUnresponsive(instanceId) {
    this.log('warn', `Instance ${instanceId} became unresponsive`);
    
    // 更新实例状态
    this.instanceManager._updateStatus(instanceId, {
      error: 'Window is unresponsive'
    });
    
    // 记录错误日志
    await this._logError({
      timestamp: new Date(),
      instanceId,
      errorType: 'UNRESPONSIVE',
      message: 'Instance became unresponsive',
      details: {}
    });
  }

  /**
   * 记录崩溃
   * @private
   * @param {string} instanceId - 实例 ID
   * @param {Object} error - 错误对象
   * @param {boolean} killed - 是否被强制终止
   * @returns {Promise<void>}
   */
  async _recordCrash(instanceId, error, killed) {
    // 获取或创建崩溃历史
    if (!this.crashHistory.has(instanceId)) {
      this.crashHistory.set(instanceId, []);
    }
    
    const history = this.crashHistory.get(instanceId);
    history.push(new Date());
    
    // 记录错误日志
    await this._logError({
      timestamp: new Date(),
      instanceId,
      errorType: 'CRASH',
      message: 'Instance crashed',
      details: { error: error?.toString(), killed }
    });
  }

  /**
   * 获取崩溃历史
   * @private
   * @param {string} instanceId - 实例 ID
   * @returns {Date[]}
   */
  _getCrashHistory(instanceId) {
    if (!this.crashHistory.has(instanceId)) {
      this.crashHistory.set(instanceId, []);
    }
    return this.crashHistory.get(instanceId);
  }

  /**
   * 获取最近的崩溃记录
   * @private
   * @param {Date[]} crashHistory - 崩溃历史
   * @returns {Date[]}
   */
  _getRecentCrashes(crashHistory) {
    const now = Date.now();
    return crashHistory.filter(crashTime => {
      return (now - crashTime.getTime()) < this.crashResetTime;
    });
  }

  /**
   * 尝试重启实例
   * @private
   * @param {string} instanceId - 实例 ID
   * @returns {Promise<void>}
   */
  async _attemptRestart(instanceId) {
    this.log('info', `Attempting to restart instance ${instanceId}`);
    
    try {
      const result = await this.instanceManager.restartInstance(instanceId);
      
      if (result.success) {
        this.log('info', `Instance ${instanceId} restarted successfully`);
      } else {
        this.log('error', `Failed to restart instance ${instanceId}: ${result.error}`);
        
        // 记录重启失败
        await this._logError({
          timestamp: new Date(),
          instanceId,
          errorType: 'RESTART_FAILED',
          message: result.error,
          details: {}
        });
      }
    } catch (error) {
      this.log('error', `Error restarting instance ${instanceId}:`, error);
      
      await this._logError({
        timestamp: new Date(),
        instanceId,
        errorType: 'RESTART_ERROR',
        message: error.message,
        details: { error: error.toString() }
      });
    }
  }

  /**
   * 取消重启定时器
   * @private
   * @param {string} instanceId - 实例 ID
   */
  _cancelRestartTimer(instanceId) {
    const timerId = this.restartTimers.get(instanceId);
    if (timerId) {
      clearTimeout(timerId);
      this.restartTimers.delete(instanceId);
      this.log('info', `Cancelled restart timer for instance ${instanceId}`);
    }
  }

  /**
   * 记录错误日志
   * @private
   * @param {ErrorLog} errorLog - 错误日志
   * @returns {Promise<void>}
   */
  async _logError(errorLog) {
    // 如果没有配置日志路径，只输出到控制台
    if (!this.logPath) {
      return;
    }
    
    try {
      // 确保日志目录存在
      await fs.mkdir(path.dirname(this.logPath), { recursive: true });
      
      // 格式化日志
      const logLine = JSON.stringify({
        ...errorLog,
        timestamp: errorLog.timestamp.toISOString()
      }) + '\n';
      
      // 追加到日志文件
      await fs.appendFile(this.logPath, logLine, 'utf8');
      
    } catch (error) {
      this.log('error', 'Failed to write error log:', error);
    }
  }

  /**
   * 清除实例的崩溃历史
   * @param {string} instanceId - 实例 ID
   */
  clearCrashHistory(instanceId) {
    this.crashHistory.delete(instanceId);
    this._cancelRestartTimer(instanceId);
    this.log('info', `Cleared crash history for instance ${instanceId}`);
  }

  /**
   * 清除所有崩溃历史
   */
  clearAllCrashHistory() {
    this.crashHistory.clear();
    
    // 取消所有重启定时器
    for (const timerId of this.restartTimers.values()) {
      clearTimeout(timerId);
    }
    this.restartTimers.clear();
    
    this.log('info', 'Cleared all crash history');
  }

  /**
   * 获取实例的崩溃统计
   * @param {string} instanceId - 实例 ID
   * @returns {{totalCrashes: number, recentCrashes: number, lastCrash: Date|null}}
   */
  getCrashStats(instanceId) {
    const history = this._getCrashHistory(instanceId);
    const recentCrashes = this._getRecentCrashes(history);
    
    return {
      totalCrashes: history.length,
      recentCrashes: recentCrashes.length,
      lastCrash: history.length > 0 ? history[history.length - 1] : null
    };
  }

  /**
   * 获取所有实例的崩溃统计
   * @returns {Map<string, {totalCrashes: number, recentCrashes: number, lastCrash: Date|null}>}
   */
  getAllCrashStats() {
    const stats = new Map();
    
    for (const instanceId of this.crashHistory.keys()) {
      stats.set(instanceId, this.getCrashStats(instanceId));
    }
    
    return stats;
  }

  /**
   * 读取错误日志
   * @param {Object} [options] - 选项
   * @param {number} [options.limit] - 限制返回的日志数量
   * @param {string} [options.instanceId] - 过滤特定实例的日志
   * @param {string} [options.errorType] - 过滤特定错误类型
   * @returns {Promise<ErrorLog[]>}
   */
  async readErrorLogs(options = {}) {
    if (!this.logPath) {
      return [];
    }
    
    try {
      const content = await fs.readFile(this.logPath, 'utf8');
      const lines = content.trim().split('\n').filter(line => line.length > 0);
      
      let logs = lines.map(line => {
        try {
          const log = JSON.parse(line);
          log.timestamp = new Date(log.timestamp);
          return log;
        } catch {
          return null;
        }
      }).filter(log => log !== null);
      
      // 过滤
      if (options.instanceId) {
        logs = logs.filter(log => log.instanceId === options.instanceId);
      }
      
      if (options.errorType) {
        logs = logs.filter(log => log.errorType === options.errorType);
      }
      
      // 限制数量（返回最新的）
      if (options.limit && logs.length > options.limit) {
        logs = logs.slice(-options.limit);
      }
      
      return logs;
      
    } catch (error) {
      if (error.code !== 'ENOENT') {
        this.log('error', 'Failed to read error logs:', error);
      }
      return [];
    }
  }

  /**
   * 清除错误日志文件
   * @returns {Promise<void>}
   */
  async clearErrorLogs() {
    if (!this.logPath) {
      return;
    }
    
    try {
      await fs.unlink(this.logPath);
      this.log('info', 'Error logs cleared');
    } catch (error) {
      if (error.code !== 'ENOENT') {
        this.log('error', 'Failed to clear error logs:', error);
      }
    }
  }
}

module.exports = ErrorHandler;
