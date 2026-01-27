const https = require('https');

/**
 * 网络时间获取器
 * 从公开的时间服务器获取当前时间，防止用户修改本地系统时间绕过激活码过期限制
 */
class NetworkTime {
  /**
   * 获取当前网络时间
   * @returns {Promise<Date>} 当前时间
   */
  static async getCurrentTime() {
    const timeServers = [
      'https://worldtimeapi.org/api/timezone/Asia/Shanghai',
      'https://timeapi.io/api/Time/current/zone?timeZone=Asia/Shanghai'
    ];

    for (const url of timeServers) {
      try {
        const time = await NetworkTime.fetchTime(url);
        if (time) {
          console.log(`[NetworkTime] 成功从服务器获取时间: ${url}`);
          return time;
        }
      } catch (error) {
        console.error(`[NetworkTime] 从 ${url} 获取时间失败:`, error.message);
      }
    }

    // 所有服务器都失败，抛出错误
    throw new Error('所有时间服务器均不可用');
  }

  /**
   * 从指定URL获取时间
   * @param {string} url - 时间服务器URL
   * @returns {Promise<Date>} 时间
   */
  static fetchTime(url) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        req.destroy();
        reject(new Error('Request timeout'));
      }, 3000); // 3秒超时

      const req = https.get(url, (res) => {
        clearTimeout(timeout);

        // 检查状态码
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode}`));
          return;
        }

        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            // 兼容不同的时间API格式
            const timeStr = json.datetime || json.dateTime;
            
            if (!timeStr) {
              reject(new Error('Invalid time response format'));
              return;
            }

            const time = new Date(timeStr);

            // 验证时间是否有效
            if (isNaN(time.getTime())) {
              reject(new Error('Invalid time value'));
              return;
            }

            // 验证时间是否合理（不能是未来时间，不能是太久以前的时间）
            const now = new Date();
            const yearDiff = Math.abs(time.getFullYear() - now.getFullYear());
            
            if (yearDiff > 2) {
              reject(new Error('Time value is unreasonable'));
              return;
            }

            resolve(time);
          } catch (error) {
            reject(new Error(`Failed to parse time response: ${error.message}`));
          }
        });
      });

      req.on('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  }

  /**
   * 检查网络时间是否可用
   * @returns {Promise<boolean>} 是否可用
   */
  static async isAvailable() {
    try {
      await NetworkTime.getCurrentTime();
      return true;
    } catch (error) {
      return false;
    }
  }
}

module.exports = NetworkTime;