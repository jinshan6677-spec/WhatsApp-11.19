const ActivationValidator = require('./ActivationValidator');
const ActivationStorage = require('./storage/ActivationStorage');
const DeviceFingerprint = require('./DeviceFingerprint');
const { EventEmitter } = require('events');

/**
 * 激活管理器
 * 负责激活流程的管理和状态维护
 */
class ActivationManager extends EventEmitter {
  constructor() {
    super();
    this.storage = null;
    this.currentDeviceId = DeviceFingerprint.getDeviceId();
    this.isActivated = false;
    this.activationData = null;
  }

  /**
   * 初始化激活管理器
   * @returns {Promise<object>} { activated: boolean, error?: string }
   */
  async initialize() {
    try {
      console.log('[ActivationManager] 开始初始化...');

      // 延迟初始化存储（确保app已经ready）
      if (!this.storage) {
        console.log('[ActivationManager] 初始化存储...');
        this.storage = new ActivationStorage();
      }

      // 加载本地激活数据
      console.log('[ActivationManager] 加载本地激活数据...');
      this.activationData = this.storage.load();

      if (!this.activationData) {
        console.log('[ActivationManager] 未找到激活数据');
        this.isActivated = false;
        return { activated: false, error: '未激活' };
      }

      console.log('[ActivationManager] 找到激活数据，开始验证...');

      // 验证本地激活状态
      const validation = ActivationValidator.validateLocalActivation(this.activationData);

      if (!validation.valid) {
        console.log('[ActivationManager] 激活验证失败:', validation.error);
        this.isActivated = false;
        return { activated: false, error: validation.error };
      }

      console.log('[ActivationManager] 激活验证成功');

      // 更新当前设备的最后使用时间
      this.storage.addDevice(this.currentDeviceId);
      this.isActivated = true;

      // 检查是否即将过期
      const expirationInfo = ActivationValidator.checkExpiration(
        this.activationData.activationCode,
        this.activationData
      );

      if (expirationInfo.expiring) {
        this.emit('activation-expiring', expirationInfo);
      }

      return { activated: true };
    } catch (error) {
      console.error('Failed to initialize activation manager:', error);
      return { activated: false, error: '激活系统初始化失败' };
    }
  }

  /**
   * 激活应用
   * @param {string} activationCode - 激活码
   * @param {boolean} rememberCode - 是否记住激活码
   * @returns {Promise<object>} { success: boolean, error?: string, info?: object }
   */
  async activate(activationCode, rememberCode = false) {
    try {
      console.log('[ActivationManager] 开始激活，记住激活码:', rememberCode);
      
      // 1. 验证激活码
      const validation = ActivationValidator.validate(
        activationCode,
        this.activationData
      );

      if (!validation.valid) {
        console.log('[ActivationManager] 激活码验证失败:', validation.error);
        return { success: false, error: validation.error };
      }

      // 2. 准备激活数据
      const parsedCode = ActivationValidator.parseActivationCode(activationCode);
      const createdAt = new Date(parsedCode.createdAt);
      const expireDate = new Date(createdAt.getTime() + parsedCode.validDays * 24 * 60 * 60 * 1000);
      
      const newActivationData = {
        activationCode: rememberCode ? activationCode : null,
        rememberCode: rememberCode,
        createdAt: createdAt.toISOString(),
        expireDate: expireDate.toISOString(),
        validDays: parsedCode.validDays,
        devices: this.activationData ? this.activationData.devices : []
      };

      console.log('[ActivationManager] 准备保存激活数据:', {
        hasActivationCode: !!newActivationData.activationCode,
        rememberCode: newActivationData.rememberCode,
        expireDate: newActivationData.expireDate
      });

      // 3. 添加当前设备
      const deviceExists = newActivationData.devices.some(
        d => d.deviceId === this.currentDeviceId
      );

      if (!deviceExists) {
        newActivationData.devices.push({
          deviceId: this.currentDeviceId,
          activatedAt: new Date().toISOString(),
          lastUsed: new Date().toISOString()
        });
      } else {
        // 更新现有设备的最后使用时间
        const device = newActivationData.devices.find(
          d => d.deviceId === this.currentDeviceId
        );
        device.lastUsed = new Date().toISOString();
      }

      // 4. 保存激活数据
      console.log('[ActivationManager] 保存激活数据...');
      const saveResult = this.storage.save(newActivationData);
      
      if (!saveResult) {
        console.error('[ActivationManager] 激活数据保存失败');
        return { success: false, error: '激活数据保存失败' };
      }
      
      console.log('[ActivationManager] 激活数据保存成功');

      // 5. 更新状态
      this.activationData = newActivationData;
      this.isActivated = true;

      // 6. 触发事件
      this.emit('activated', {
        activationCode,
        deviceId: this.currentDeviceId,
        deviceCount: newActivationData.devices.length,
        maxDevices: validation.data.maxDevices,
        validDays: validation.data.validDays
      });

      return {
        success: true,
        info: {
          deviceCount: newActivationData.devices.length,
          maxDevices: validation.data.maxDevices,
          expireDate: validation.data.expireDate
        }
      };
    } catch (error) {
      console.error('[ActivationManager] 激活失败:', error);
      return { success: false, error: '激活失败：' + error.message };
    }
  }

  /**
   * 取消激活
   * @returns {Promise<object>} { success: boolean, error?: string }
   */
  async deactivate() {
    try {
      const cleared = this.storage.clear();

      if (!cleared) {
        return { success: false, error: '取消激活失败' };
      }

      this.activationData = null;
      this.isActivated = false;

      this.emit('deactivated');

      return { success: true };
    } catch (error) {
      console.error('Deactivation failed:', error);
      return { success: false, error: '取消激活失败：' + error.message };
    }
  }

  /**
   * 检查是否已激活
   * @returns {boolean}
   */
  isAppActivated() {
    return this.isActivated;
  }

  /**
   * 获取激活信息
   * @returns {object|null}
   */
  getActivationInfo() {
    if (!this.isActivated || !this.activationData) {
      return null;
    }

    const activationCode = this.activationData.activationCode;
    const parsedCode = activationCode
      ? ActivationValidator.parseActivationCode(activationCode)
      : null;

    let expireDate = this.activationData.expireDate || null;

    return {
      activationCode: activationCode,
      rememberCode: this.activationData.rememberCode === true,
      activatedAt: this.activationData.activatedAt,
      createdAt: this.activationData.createdAt,
      devices: this.activationData.devices,
      currentDeviceId: this.currentDeviceId,
      maxDevices: parsedCode ? parsedCode.maxDevices : 0,
      validDays: parsedCode ? parsedCode.validDays : null,
      expireDate: expireDate,
      deviceCount: this.activationData.devices.length
    };
  }

  /**
   * 获取设备信息
   * @returns {object}
   */
  getDeviceInfo() {
    return {
      deviceId: this.currentDeviceId,
      info: DeviceFingerprint.getDeviceInfo()
    };
  }

  /**
   * 检查激活状态
   * @returns {object} { activated: boolean, error?: string }
   */
  checkActivationStatus() {
    if (!this.isActivated) {
      return { activated: false, error: '应用未激活' };
    }

    const validation = ActivationValidator.validateLocalActivation(this.activationData);

    if (!validation.valid) {
      this.isActivated = false;
      return { activated: false, error: validation.error };
    }

    return { activated: true };
  }
}

// 单例模式
let instance = null;

module.exports = {
  getInstance: () => {
    if (!instance) {
      instance = new ActivationManager();
    }
    return instance;
  },
  ActivationManager
};
