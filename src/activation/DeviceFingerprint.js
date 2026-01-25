const { machineIdSync } = require('node-machine-id');
const crypto = require('crypto');
const os = require('os');

/**
 * 设备指纹生成器
 * 生成唯一的设备ID，用于绑定激活码
 */
class DeviceFingerprint {
  /**
   * 获取设备唯一ID
   * @returns {string} 设备唯一ID
   */
  static getDeviceId() {
    try {
      // 获取机器ID（基于硬件信息）
      const machineId = machineIdSync();

      // 获取网络接口信息
      const networkInterfaces = os.networkInterfaces();
      const macAddresses = [];
      
      for (const interfaceName in networkInterfaces) {
        const interfaces = networkInterfaces[interfaceName];
        for (const iface of interfaces) {
          if (!iface.internal && iface.mac !== '00:00:00:00:00:00') {
            macAddresses.push(iface.mac);
          }
        }
      }

      // 组合多个硬件特征
      const fingerprintData = {
        machineId,
        platform: os.platform(),
        arch: os.arch(),
        hostname: os.hostname(),
        cpus: os.cpus().length,
        totalmem: os.totalmem(),
        macAddresses: macAddresses.sort().join(',')
      };

      // 生成哈希
      const hash = crypto.createHash('sha256');
      hash.update(JSON.stringify(fingerprintData));
      return hash.digest('hex');
    } catch (error) {
      console.error('Failed to generate device fingerprint:', error);
      // 降级方案：使用随机UUID
      return crypto.randomUUID();
    }
  }

  /**
   * 获取设备信息（用于显示）
   * @returns {object} 设备信息
   */
  static getDeviceInfo() {
    return {
      platform: os.platform(),
      arch: os.arch(),
      hostname: os.hostname(),
      cpus: os.cpus().length,
      totalmem: Math.round(os.totalmem() / 1024 / 1024 / 1024) + 'GB',
      release: os.release()
    };
  }
}

module.exports = DeviceFingerprint;