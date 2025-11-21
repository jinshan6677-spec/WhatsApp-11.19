/**
 * ProxyConfigManager - 代理配置管理器
 * 
 * 负责代理配置列表的加载、保存、删除和验证
 * 使用 electron-store 进行持久化存储
 */

const Store = require('electron-store');
const ProxyListEntry = require('../models/ProxyListEntry');
const PasswordEncryption = require('../utils/PasswordEncryption');

/**
 * ProxyConfigManager 类
 */
class ProxyConfigManager {
  /**
   * 创建代理配置管理器实例
   * @param {Object} [options] - 配置选项
   * @param {string} [options.configName] - 配置文件名
   * @param {string} [options.cwd] - 配置文件目录
   */
  constructor(options = {}) {
    // 初始化 electron-store
    this.store = new Store({
      name: options.configName || 'proxy-configs',
      cwd: options.cwd,
      defaults: {
        proxyConfigs: {},
        version: '1.0.0'
      },
      schema: {
        proxyConfigs: {
          type: 'object'
        },
        version: {
          type: 'string'
        }
      }
    });

    // 内存缓存
    this.configsCache = new Map();
    
    // 加载所有配置到缓存
    this._loadConfigsToCache();
  }

  /**
   * 从存储加载所有配置到内存缓存
   * @private
   */
  _loadConfigsToCache() {
    const configsData = this.store.get('proxyConfigs', {});
    this.configsCache.clear();
    
    for (const [id, data] of Object.entries(configsData)) {
      try {
        const config = ProxyListEntry.fromJSON(data);
        this.configsCache.set(id, config);
      } catch (error) {
        console.error(`Failed to load proxy config ${id}:`, error);
      }
    }
  }

  /**
   * 保存缓存到存储
   * @private
   */
  _saveCacheToStore() {
    const configsData = {};
    for (const [id, config] of this.configsCache.entries()) {
      configsData[id] = config.toJSON();
    }
    this.store.set('proxyConfigs', configsData);
  }

  /**
   * 获取所有代理配置
   * @param {boolean} [decrypt=true] - 是否解密密码
   * @returns {Promise<ProxyListEntry[]>}
   */
  async getAllProxyConfigs(decrypt = true) {
    const configs = Array.from(this.configsCache.values());
    
    // 如果需要解密，解密所有配置的密码
    if (decrypt) {
      return configs.map(config => {
        if (config.password) {
          const decrypted = { ...config };
          decrypted.password = PasswordEncryption.decryptPassword(config.password);
          return decrypted;
        }
        return config;
      });
    }
    
    return configs;
  }

  /**
   * 获取单个代理配置
   * @param {string} id - 配置 ID
   * @param {boolean} [decrypt=true] - 是否解密密码
   * @returns {Promise<ProxyListEntry|null>}
   */
  async getProxyConfig(id, decrypt = true) {
    const config = this.configsCache.get(id);
    if (!config) {
      return null;
    }

    // 如果需要解密，创建副本并解密密码
    if (decrypt && config.password) {
      const decrypted = { ...config };
      decrypted.password = PasswordEncryption.decryptPassword(config.password);
      return decrypted;
    }

    return config;
  }

  /**
   * 保存代理配置
   * @param {ProxyListEntry|Object} config - 代理配置
   * @returns {Promise<{success: boolean, errors?: string[]}>}
   */
  async saveProxyConfig(config) {
    try {
      // 如果是普通对象，转换为 ProxyListEntry 实例
      const proxyEntry = config instanceof ProxyListEntry 
        ? config 
        : new ProxyListEntry(config);

      // 加密密码
      if (proxyEntry.password) {
        proxyEntry.password = PasswordEncryption.encryptIfNeeded(proxyEntry.password);
      }

      // 验证配置
      const validation = proxyEntry.validate();
      if (!validation.valid) {
        return {
          success: false,
          errors: validation.errors
        };
      }

      // 更新缓存
      this.configsCache.set(proxyEntry.id, proxyEntry);
      
      // 持久化到存储
      this._saveCacheToStore();
      
      return { success: true };
    } catch (error) {
      console.error('Failed to save proxy config:', error);
      return {
        success: false,
        errors: [`Failed to save proxy config: ${error.message}`]
      };
    }
  }

  /**
   * 删除代理配置
   * @param {string} id - 配置 ID
   * @returns {Promise<{success: boolean, errors?: string[]}>}
   */
  async deleteProxyConfig(id) {
    const config = this.configsCache.get(id);
    
    if (!config) {
      return {
        success: false,
        errors: [`Proxy config ${id} not found`]
      };
    }

    try {
      // 从缓存中删除
      this.configsCache.delete(id);
      
      // 持久化到存储
      this._saveCacheToStore();
      
      return { success: true };
    } catch (error) {
      console.error('Failed to delete proxy config:', error);
      return {
        success: false,
        errors: [`Failed to delete proxy config: ${error.message}`]
      };
    }
  }

  /**
   * 生成配置名称
   * @param {Object} config - 配置对象
   * @returns {string}
   */
  generateConfigName(config) {
    const protocol = (config.protocol || 'socks5').toUpperCase();
    const host = config.host || 'unknown';
    const port = config.port || 0;
    
    // 如果有用户名，添加到名称中
    if (config.username) {
      return `${protocol} - ${config.username}@${host}:${port}`;
    }
    
    return `${protocol} - ${host}:${port}`;
  }

  /**
   * 验证代理配置
   * @param {ProxyListEntry|Object} config - 代理配置
   * @returns {{valid: boolean, errors: string[]}}
   */
  validateProxyConfig(config) {
    const proxyEntry = config instanceof ProxyListEntry 
      ? config 
      : new ProxyListEntry(config);
    
    return proxyEntry.validate();
  }

  /**
   * 检查配置是否存在
   * @param {string} id - 配置 ID
   * @returns {boolean}
   */
  configExists(id) {
    return this.configsCache.has(id);
  }

  /**
   * 获取所有配置 ID
   * @returns {string[]}
   */
  getAllConfigIds() {
    return Array.from(this.configsCache.keys());
  }

  /**
   * 获取配置数量
   * @returns {number}
   */
  getConfigCount() {
    return this.configsCache.size;
  }

  /**
   * 清除所有配置（危险操作）
   * @returns {Promise<{success: boolean}>}
   */
  async clearAllConfigs() {
    try {
      this.configsCache.clear();
      this.store.set('proxyConfigs', {});
      return { success: true };
    } catch (error) {
      console.error('Failed to clear proxy configs:', error);
      return { success: false };
    }
  }

  /**
   * 获取配置文件路径
   * @returns {string}
   */
  getConfigPath() {
    return this.store.path;
  }

  /**
   * 导出所有配置
   * @returns {Promise<Object>}
   */
  async exportConfigs() {
    const configs = await this.getAllProxyConfigs();
    return {
      version: this.store.get('version'),
      exportDate: new Date().toISOString(),
      configs: configs.map(config => config.toJSON())
    };
  }

  /**
   * 导入配置
   * @param {Object} data - 导入的数据
   * @param {Object} [options] - 导入选项
   * @param {boolean} [options.overwrite] - 是否覆盖现有配置
   * @returns {Promise<{success: boolean, imported: number, skipped: number, errors: string[]}>}
   */
  async importConfigs(data, options = {}) {
    const errors = [];
    let imported = 0;
    let skipped = 0;

    if (!data.configs || !Array.isArray(data.configs)) {
      return {
        success: false,
        imported: 0,
        skipped: 0,
        errors: ['Invalid import data format']
      };
    }

    for (const configData of data.configs) {
      try {
        const config = ProxyListEntry.fromJSON(configData);
        
        // 检查配置是否已存在
        if (this.configExists(config.id) && !options.overwrite) {
          skipped++;
          continue;
        }

        // 保存配置
        const result = await this.saveProxyConfig(config);
        if (result.success) {
          imported++;
        } else {
          errors.push(`Failed to import config ${config.id}: ${result.errors.join(', ')}`);
          skipped++;
        }
      } catch (error) {
        errors.push(`Failed to parse config data: ${error.message}`);
        skipped++;
      }
    }

    return {
      success: errors.length === 0,
      imported,
      skipped,
      errors
    };
  }
}

module.exports = ProxyConfigManager;
