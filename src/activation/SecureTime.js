const NetworkTime = require('./NetworkTime');
const TimeProtection = require('./TimeProtection');

/**
 * 安全时间获取器
 * 混合方案：优先使用网络时间，网络不可用时使用本地时间+时间保护机制
 */
class SecureTime {
  /**
   * 获取当前安全时间
   * @returns {Promise<Date>} 当前时间
   */
  static async getCurrentTime() {
    console.log('[SecureTime] 开始获取安全时间...');

    try {
      // 优先尝试获取网络时间（超时3秒）
      console.log('[SecureTime] 尝试获取网络时间...');
      const networkTime = await Promise.race([
        NetworkTime.getCurrentTime(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Network timeout')), 3000)
        )
      ]);

      // 验证网络时间的合理性
      console.log('[SecureTime] 网络时间获取成功，进行时间保护验证...');
      const timeCheck = TimeProtection.checkTimeManipulation(networkTime);
      
      if (!timeCheck.valid) {
        console.error('[SecureTime] 网络时间验证失败:', timeCheck.error);
        throw new Error(timeCheck.error);
      }

      console.log('[SecureTime] 网络时间验证通过:', networkTime.toISOString());
      return networkTime;

    } catch (error) {
      console.warn('[SecureTime] 网络时间不可用，使用本地时间进行保护验证');
      console.warn('[SecureTime] 错误详情:', error.message);

      // 网络时间不可用，使用本地时间
      const localTime = new Date();
      console.log('[SecureTime] 本地时间:', localTime.toISOString());

      const timeCheck = TimeProtection.checkTimeManipulation(localTime);

      if (!timeCheck.valid) {
        console.error('[SecureTime] 本地时间验证失败:', timeCheck.error);
        throw new Error(timeCheck.error);
      }

      console.log('[SecureTime] 本地时间验证通过');
      return localTime;
    }
  }

  /**
   * 检查时间是否被篡改
   * @param {Date} time - 要检查的时间
   * @returns {object} { valid: boolean, error?: string }
   */
  static checkTimeManipulation(time) {
    return TimeProtection.checkTimeManipulation(time);
  }

  /**
   * 获取时间保护信息（用于调试）
   * @returns {object} 时间保护信息
   */
  static getTimeProtectionInfo() {
    const fileInfo = TimeProtection.getFileInfo();
    return {
      fileInfo,
      networkTimeAvailable: null // 需要异步检查
    };
  }

  /**
   * 检查网络时间是否可用
   * @returns {Promise<boolean>} 是否可用
   */
  static async isNetworkTimeAvailable() {
    return NetworkTime.isAvailable();
  }

  /**
   * 清除时间保护记录（用于测试或重置）
   * @returns {boolean} 是否成功
   */
  static clear() {
    return TimeProtection.clear();
  }
}

module.exports = SecureTime;