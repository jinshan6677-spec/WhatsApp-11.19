const fs = require('fs');
const path = require('path');
const { app } = require('electron');

/**
 * 本地时间保护器
 * 记录每次验证的时间戳，检测时间篡改行为
 */
class TimeProtection {
  /**
   * 获取时间保护文件路径
   * @returns {string} 文件路径
   */
  static getTimeFilePath() {
    const userDataPath = app ? app.getPath('userData') : process.cwd();
    return path.join(userDataPath, '.time_protection');
  }

  /**
   * 获取最后验证时间
   * @returns {Date|null} 最后验证时间
   */
  static getLastValidationTime() {
    try {
      const filePath = TimeProtection.getTimeFilePath();
      
      if (!fs.existsSync(filePath)) {
        console.log('[TimeProtection] 未找到时间保护文件，首次验证');
        return null;
      }

      const data = fs.readFileSync(filePath, 'utf8').trim();
      const timestamp = parseInt(data);

      if (isNaN(timestamp)) {
        console.error('[TimeProtection] 时间保护文件格式错误');
        return null;
      }

      const lastTime = new Date(timestamp);
      console.log('[TimeProtection] 读取到最后验证时间:', lastTime.toISOString());
      
      return lastTime;
    } catch (error) {
      console.error('[TimeProtection] 读取最后验证时间失败:', error);
      return null;
    }
  }

  /**
   * 保存验证时间
   * @param {Date} time - 要保存的时间
   * @returns {boolean} 是否成功
   */
  static saveValidationTime(time) {
    try {
      const filePath = TimeProtection.getTimeFilePath();
      const dir = path.dirname(filePath);

      // 确保目录存在
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      const timestamp = time.getTime();
      fs.writeFileSync(filePath, timestamp.toString(), 'utf8');
      
      console.log('[TimeProtection] 已保存验证时间:', time.toISOString());
      return true;
    } catch (error) {
      console.error('[TimeProtection] 保存验证时间失败:', error);
      return false;
    }
  }

  /**
   * 检查时间是否被篡改
   * @param {Date} currentTime - 当前时间
   * @returns {object} { valid: boolean, error?: string }
   */
  static checkTimeManipulation(currentTime) {
    const lastTime = TimeProtection.getLastValidationTime();

    // 首次验证，记录时间
    if (!lastTime) {
      TimeProtection.saveValidationTime(currentTime);
      return { valid: true };
    }

    // 检查时间是否倒流
    if (currentTime < lastTime) {
      const timeDiff = lastTime - currentTime;
      const hoursDiff = timeDiff / (1000 * 60 * 60);

      console.log(`[TimeProtection] 检测到时间倒流: ${hoursDiff.toFixed(2)} 小时`);

      // 允许5分钟的时间误差（时钟同步、时区调整等）
      if (hoursDiff > 0.083) {
        const daysDiff = Math.floor(hoursDiff / 24);
        const hoursRemainder = Math.floor(hoursDiff % 24);

        let errorMsg = '检测到系统时间被修改';
        if (daysDiff > 0) {
          errorMsg += `（时间倒流了 ${daysDiff} 天 ${hoursRemainder} 小时）`;
        } else {
          errorMsg += `（时间倒流了 ${hoursRemainder} 小时）`;
        }
        
        return {
          valid: false,
          error: errorMsg
        };
      }
    }

    // 检查时间是否异常快进（防止用户把时间调快激活）
    const timeElapsed = currentTime - lastTime;
    const daysElapsed = timeElapsed / (1000 * 60 * 60 * 24);

    // 如果超过30天没验证，可能是时间被调快
    if (daysElapsed > 30) {
      console.log(`[TimeProtection] 检测到时间异常快进: ${daysElapsed.toFixed(2)} 天`);
      return {
        valid: false,
        error: `系统时间异常（距离上次验证已过 ${Math.floor(daysElapsed)} 天），请检查系统时间设置`
      };
    }

    // 时间正常，记录当前时间
    TimeProtection.saveValidationTime(currentTime);

    return { valid: true };
  }

  /**
   * 清除时间保护记录（用于测试或重置）
   * @returns {boolean} 是否成功
   */
  static clear() {
    try {
      const filePath = TimeProtection.getTimeFilePath();
      
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log('[TimeProtection] 已清除时间保护记录');
      }
      
      return true;
    } catch (error) {
      console.error('[TimeProtection] 清除时间保护记录失败:', error);
      return false;
    }
  }

  /**
   * 获取时间保护文件信息
   * @returns {object|null} 文件信息
   */
  static getFileInfo() {
    try {
      const filePath = TimeProtection.getTimeFilePath();
      
      if (!fs.existsSync(filePath)) {
        return null;
      }

      const stats = fs.statSync(filePath);
      const lastTime = TimeProtection.getLastValidationTime();

      return {
        path: filePath,
        size: stats.size,
        modified: stats.mtime,
        lastValidationTime: lastTime ? lastTime.toISOString() : null
      };
    } catch (error) {
      console.error('[TimeProtection] 获取文件信息失败:', error);
      return null;
    }
  }
}

module.exports = TimeProtection;