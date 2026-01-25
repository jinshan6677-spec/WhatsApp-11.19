const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { app } = require('electron');

/**
 * 激活存储管理器
 * 负责本地激活数据的加密存储和读取
 */
class ActivationStorage {
  constructor() {
    this.storagePath = null;
    this.keyPath = null;
    this.encryptionKey = null;
  }

  /**
   * 确保路径已初始化
   */
  ensurePathsInitialized() {
    if (!this.storagePath || !this.keyPath) {
      const userDataPath = app ? app.getPath('userData') : process.cwd();
      this.storagePath = path.join(userDataPath, 'activation.dat');
      this.keyPath = path.join(userDataPath, '.activation_key');
    }
  }

  /**
   * 获取或创建加密密钥
   * @returns {string} 加密密钥
   */
  getOrCreateEncryptionKey() {
    this.ensurePathsInitialized();
    const keyPath = this.keyPath;

    if (fs.existsSync(keyPath)) {
      return fs.readFileSync(keyPath, 'utf8');
    }

    // 确保目录存在
    const keyDir = path.dirname(keyPath);
    if (!fs.existsSync(keyDir)) {
      fs.mkdirSync(keyDir, { recursive: true });
    }

    // 生成新密钥
const key = crypto.randomBytes(32).toString('hex');
      fs.writeFileSync(keyPath, key, 'utf8');
      return key;
  }

  /**
   * 加密数据
   * @param {object} data - 要加密的数据
   * @returns {string} 加密后的字符串
   */
  encrypt(data) {
    try {
      const algorithm = 'aes-256-cbc';
      const iv = crypto.randomBytes(16);
      
      // 确保加密密钥已初始化
      if (!this.encryptionKey) {
        this.encryptionKey = this.getOrCreateEncryptionKey();
      }
      
      const key = Buffer.from(this.encryptionKey, 'hex');
      
      const cipher = crypto.createCipheriv(algorithm, key, iv);
      let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      return iv.toString('hex') + ':' + encrypted;
    } catch (error) {
      console.error('[ActivationStorage] 加密失败:', error);
      throw error;
    }
  }

  /**
   * 解密数据
   * @param {string} encryptedData - 加密的数据
   * @returns {object|null} 解密后的数据
   */
  decrypt(encryptedData) {
    try {
      const algorithm = 'aes-256-cbc';
      const parts = encryptedData.split(':');
      const iv = Buffer.from(parts[0], 'hex');
      const encrypted = parts[1];
      
      // 确保加密密钥已初始化
      if (!this.encryptionKey) {
        this.encryptionKey = this.getOrCreateEncryptionKey();
      }
      
      const key = Buffer.from(this.encryptionKey, 'hex');
      
      const decipher = crypto.createDecipheriv(algorithm, key, iv);
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return JSON.parse(decrypted);
    } catch (error) {
      console.error('[ActivationStorage] 解密失败:', error);
      return null;
    }
  }

  /**
   * 保存激活数据
   * @param {object} data - 激活数据
   */
  save(data) {
    try {
      this.ensurePathsInitialized();
      console.log('[ActivationStorage] 保存路径:', this.storagePath);
      console.log('[ActivationStorage] 数据内容:', JSON.stringify(data, null, 2));
      
      // 确保目录存在
      const storageDir = path.dirname(this.storagePath);
      console.log('[ActivationStorage] 检查目录:', storageDir);
      
      if (!fs.existsSync(storageDir)) {
        console.log('[ActivationStorage] 创建目录...');
        fs.mkdirSync(storageDir, { recursive: true });
      }

      console.log('[ActivationStorage] 开始加密...');
      const encrypted = this.encrypt(data);
      console.log('[ActivationStorage] 加密完成，长度:', encrypted.length);
      
      console.log('[ActivationStorage] 写入文件...');
      fs.writeFileSync(this.storagePath, encrypted, 'utf8');
      console.log('[ActivationStorage] 文件写入成功');
      
      return true;
    } catch (error) {
      console.error('[ActivationStorage] 保存激活数据失败:', error);
      console.error('[ActivationStorage] 错误堆栈:', error.stack);
      return false;
    }
  }

  /**
   * 读取激活数据
   * @returns {object|null} 激活数据
   */
  load() {
    try {
      this.ensurePathsInitialized();
      
      if (!fs.existsSync(this.storagePath)) {
        return null;
      }

      const encrypted = fs.readFileSync(this.storagePath, 'utf8');
      return this.decrypt(encrypted);
    } catch (error) {
      console.error('Failed to load activation data:', error);
      return null;
    }
  }

  /**
   * 删除激活数据
   */
  clear() {
    try {
      if (fs.existsSync(this.storagePath)) {
        fs.unlinkSync(this.storagePath);
      }
      return true;
    } catch (error) {
      console.error('Failed to clear activation data:', error);
      return false;
    }
  }

  /**
   * 检查是否存在激活数据
   * @returns {boolean}
   */
  exists() {
    return fs.existsSync(this.storagePath);
  }

  /**
   * 添加设备到激活列表
   * @param {string} deviceId - 设备ID
   */
  addDevice(deviceId) {
    const data = this.load();
    if (!data) {
      return false;
    }

    // 检查设备是否已存在
    const existingDevice = data.devices.find(d => d.deviceId === deviceId);
    if (existingDevice) {
      // 更新最后使用时间
      existingDevice.lastUsed = new Date().toISOString();
    } else {
      // 添加新设备
      data.devices.push({
        deviceId,
        activatedAt: new Date().toISOString(),
        lastUsed: new Date().toISOString()
      });
    }

    return this.save(data);
  }

  /**
   * 获取激活的设备列表
   * @returns {Array} 设备列表
   */
  getDevices() {
    const data = this.load();
    return data ? data.devices : [];
  }

  /**
   * 获取激活码信息
   * @returns {object|null} 激活码信息
   */
  getActivationInfo() {
    const data = this.load();
    if (!data) {
      return null;
    }

    return {
      activationCode: data.activationCode,
      rememberCode: data.rememberCode === true,
      createdAt: data.createdAt,
      expireDate: data.expireDate,
      activatedAt: data.activatedAt,
      devices: data.devices,
      deviceCount: data.devices.length
    };
  }
}

module.exports = ActivationStorage;
