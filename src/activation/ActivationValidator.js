const Signature = require('./crypto/Signature');
const DeviceFingerprint = require('./DeviceFingerprint');

/**
 * 激活码验证器
 * 负责验证激活码的有效性
 */
class ActivationValidator {
  /**
   * 验证激活码
   * @param {string} activationCode - 激活码
   * @param {object} activationData - 本地激活数据
   * @returns {object} { valid: boolean, error?: string }
   */
  static validate(activationCode, activationData) {
    try {
      // 1. 解析激活码
      const parsedData = ActivationValidator.parseActivationCode(activationCode);
      if (!parsedData) {
        return { valid: false, error: '激活码格式无效' };
      }

      // 2. 验证签名（必须包含所有签名字段，与管理后台保持一致）
      const publicKey = Signature.getPublicKey();
      const verifyData = {
        id: parsedData.id,
        maxDevices: parsedData.maxDevices,
        validDays: parsedData.validDays,
        createdAt: parsedData.createdAt
      };

      // 如果有 notes 字段，也要包含在验证数据中
      if (parsedData.notes !== undefined) {
        verifyData.notes = parsedData.notes;
      }

      const isValidSignature = Signature.verify(
        verifyData,
        parsedData.signature,
        publicKey
      );

      if (!isValidSignature) {
        return { valid: false, error: '激活码签名验证失败，可能是伪造的激活码' };
      }

      // 3. 验证过期时间（使用激活码创建时间）
      if (parsedData.validDays) {
        const createdAt = new Date(parsedData.createdAt);
        const expireDate = new Date(createdAt.getTime() + parsedData.validDays * 24 * 60 * 60 * 1000);
        
        if (new Date() > expireDate) {
          const expiredDaysAgo = Math.ceil((new Date() - expireDate) / (1000 * 60 * 60 * 24));
          return { 
            valid: false, 
            error: `激活码已于 ${expiredDaysAgo} 天前过期，请联系管理员获取新激活码` 
          };
        }
      }

      // 4. 验证设备数量
      if (activationData && activationData.devices) {
        const currentDeviceId = DeviceFingerprint.getDeviceId();
        const deviceCount = activationData.devices.length;

        // 如果当前设备已经在列表中，允许使用
        const isCurrentDeviceRegistered = activationData.devices.some(
          d => d.deviceId === currentDeviceId
        );

        if (!isCurrentDeviceRegistered && deviceCount >= parsedData.maxDevices) {
          return { 
            valid: false, 
            error: `该激活码已达到最大设备数限制（${parsedData.maxDevices}台），无法在更多设备上使用` 
          };
        }
      }

      return { valid: true, data: parsedData };
    } catch (error) {
      console.error('Activation validation error:', error);
      return { valid: false, error: '激活码验证失败：' + error.message };
    }
  }

  /**
   * 解析激活码
   * @param {string} activationCode - Base64编码的激活码
   * @returns {object|null} 解析后的数据
   */
  static parseActivationCode(activationCode) {
    try {
      const decoded = Buffer.from(activationCode, 'base64').toString('utf8');
      return JSON.parse(decoded);
    } catch (error) {
      console.error('Failed to parse activation code:', error);
      return null;
    }
  }

  /**
   * 验证本地激活状态
   * @param {object} activationData - 本地激活数据
   * @returns {object} { valid: boolean, error?: string }
   */
  static validateLocalActivation(activationData) {
    if (!activationData) {
      return { valid: false, error: '未检测到激活信息，请先激活应用' };
    }

    if (!activationData.activationCode) {
      return { valid: false, error: '激活码丢失，请重新激活' };
    }

    // 验证激活码
    const validation = ActivationValidator.validate(
      activationData.activationCode,
      activationData
    );

    if (!validation.valid) {
      return validation;
    }

    // 检查当前设备是否已激活
    const currentDeviceId = DeviceFingerprint.getDeviceId();
    const isDeviceActivated = activationData.devices.some(
      d => d.deviceId === currentDeviceId
    );

    if (!isDeviceActivated) {
      return { valid: false, error: '当前设备未激活，请使用激活码激活' };
    }

    return { valid: true };
  }

  /**
   * 检查激活码是否即将过期（提前30天提醒）
   * @param {string} activationCode - 激活码
   * @param {object} activationData - 本地激活数据
   * @returns {object} { expiring: boolean, daysLeft?: number, expireDate?: string }
   */
  static checkExpiration(activationCode, activationData) {
    try {
      const parsedData = ActivationValidator.parseActivationCode(activationCode);
      if (!parsedData || !parsedData.validDays) {
        return { expiring: false };
      }

      const createdAt = new Date(parsedData.createdAt);
      const expireDate = new Date(createdAt.getTime() + parsedData.validDays * 24 * 60 * 60 * 1000);
      const now = new Date();
      const daysLeft = Math.ceil((expireDate - now) / (1000 * 60 * 60 * 24));

      return {
        expiring: daysLeft <= 30,
        daysLeft,
        expireDate: expireDate.toISOString().split('T')[0]
      };
    } catch (error) {
      return { expiring: false };
    }
  }}

module.exports = ActivationValidator;