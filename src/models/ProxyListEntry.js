/**
 * ProxyListEntry 数据模型
 *
 * 定义代理配置列表条目的数据结构
 */

const crypto = require('crypto');

/**
 * Generate a UUID v4
 * @returns {string}
 */
function uuidv4() {
  return crypto.randomUUID();
}

/**
 * @typedef {Object} ProxyListEntry
 * @property {string} id - 唯一标识符
 * @property {string} name - 配置名称
 * @property {'socks5'|'http'|'https'} protocol - 代理协议
 * @property {string} host - 代理服务器地址
 * @property {number} port - 代理服务器端口
 * @property {string} [username] - 代理认证用户名（可选）
 * @property {string} [password] - 代理认证密码（加密存储）
 * @property {Date} createdAt - 创建时间
 * @property {Date} lastUsedAt - 最后使用时间
 */

/**
 * ProxyListEntry 实体
 */
class ProxyListEntry {
  /**
   * 创建新的代理配置条目
   * @param {Partial<ProxyListEntry>} [config] - 配置选项
   */
  constructor(config = {}) {
    this.id = config.id || uuidv4();
    this.name = config.name || this._generateDefaultName(config);
    this.protocol = config.protocol || 'socks5';
    this.host = config.host || '';
    this.port = config.port || 0;
    this.username = config.username || '';
    this.password = config.password || '';
    this.createdAt = config.createdAt ? new Date(config.createdAt) : new Date();
    this.lastUsedAt = config.lastUsedAt ? new Date(config.lastUsedAt) : new Date();
  }

  /**
   * 生成默认配置名称
   * @private
   * @param {Object} config - 配置对象
   * @returns {string}
   */
  _generateDefaultName(config) {
    const protocol = (config.protocol || 'socks5').toUpperCase();
    const host = config.host || 'unknown';
    const port = config.port || 0;
    return `${protocol} - ${host}:${port}`;
  }

  /**
   * 转换为普通对象，方便持久化 / 通过 IPC 传输
   * @returns {Object}
   */
  toJSON() {
    const createdAt =
      this.createdAt instanceof Date
        ? this.createdAt
        : new Date(this.createdAt || Date.now());
    const lastUsedAt =
      this.lastUsedAt instanceof Date
        ? this.lastUsedAt
        : new Date(this.lastUsedAt || Date.now());

    return {
      id: this.id,
      name: this.name,
      protocol: this.protocol,
      host: this.host,
      port: this.port,
      username: this.username,
      password: this.password,
      createdAt: createdAt.toISOString(),
      lastUsedAt: lastUsedAt.toISOString()
    };
  }

  /**
   * 从普通对象创建 ProxyListEntry 实例
   * @param {Object} data - 数据对象
   * @returns {ProxyListEntry}
   */
  static fromJSON(data) {
    return new ProxyListEntry(data);
  }

  /**
   * 验证配置是否有效
   * @returns {{valid: boolean, errors: string[]}}
   */
  validate() {
    const errors = [];

    // 验证 ID
    if (!this.id || typeof this.id !== 'string') {
      errors.push('Invalid proxy configuration ID');
    }

    // 验证名称
    if (!this.name || typeof this.name !== 'string' || this.name.trim().length === 0) {
      errors.push('Proxy configuration name is required');
    }

    // 验证协议
    if (!['socks5', 'http', 'https'].includes(this.protocol)) {
      errors.push('Invalid proxy protocol. Must be socks5, http, or https');
    }

    // 验证主机
    if (!this.host || typeof this.host !== 'string' || this.host.trim().length === 0) {
      errors.push('Proxy host is required');
    }

    // 验证端口
    if (
      typeof this.port !== 'number' ||
      this.port < 1 ||
      this.port > 65535
    ) {
      errors.push('Invalid proxy port. Must be between 1 and 65535');
    }

    // 验证用户名（可选）
    if (this.username !== undefined && this.username !== null && this.username !== '') {
      if (typeof this.username !== 'string') {
        errors.push('Username must be a string');
      }
    }

    // 验证密码（可选）
    if (this.password !== undefined && this.password !== null && this.password !== '') {
      if (typeof this.password !== 'string') {
        errors.push('Password must be a string');
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * 更新最后使用时间
   */
  updateLastUsed() {
    this.lastUsedAt = new Date();
  }

  /**
   * 转换为 ProxyConfig 格式（用于应用到账号）
   * @returns {Object}
   */
  toProxyConfig() {
    return {
      enabled: true,
      protocol: this.protocol,
      host: this.host,
      port: this.port,
      username: this.username,
      password: this.password,
      bypass: ''
    };
  }
}

module.exports = ProxyListEntry;
