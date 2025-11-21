/**
 * SmartFillParser - 智能填写解析器
 * 
 * 负责解析各种格式的代理信息字符串
 */

class SmartFillParser {
  /**
   * 解析代理字符串
   * @param {string} text - 要解析的文本
   * @returns {{success: boolean, data?: Object, error?: string}}
   */
  static parse(text) {
    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return {
        success: false,
        error: '请输入代理信息'
      };
    }

    const trimmedText = text.trim();

    // 尝试各种格式
    const parsers = [
      this.tryParseFormat1.bind(this),  // protocol://host:port
      this.tryParseFormat2.bind(this),  // host:port:username:password
      this.tryParseFormat3.bind(this),  // protocol://username:password@host:port
      this.tryParseFormat4.bind(this)   // JSON format
    ];

    for (const parser of parsers) {
      const result = parser(trimmedText);
      if (result.success) {
        return result;
      }
    }

    // 所有格式都失败
    return {
      success: false,
      error: '无法识别的代理信息格式。支持的格式:\n' +
             '- protocol://host:port\n' +
             '- host:port:username:password\n' +
             '- protocol://username:password@host:port\n' +
             '- JSON 格式'
    };
  }

  /**
   * 尝试解析格式1: protocol://host:port
   * @param {string} text - 要解析的文本
   * @returns {{success: boolean, data?: Object}}
   */
  static tryParseFormat1(text) {
    try {
      // 匹配 protocol://host:port
      const regex = /^(socks5|http|https):\/\/([^:@]+):(\d+)$/i;
      const match = text.match(regex);

      if (match) {
        const protocol = match[1].toLowerCase();
        const host = match[2];
        const port = parseInt(match[3], 10);

        const data = {
          protocol,
          host,
          port
        };

        const validation = this.validateParsedData(data);
        if (validation.valid) {
          return { success: true, data };
        }
      }

      return { success: false };
    } catch (error) {
      return { success: false };
    }
  }

  /**
   * 尝试解析格式2: host:port:username:password
   * @param {string} text - 要解析的文本
   * @returns {{success: boolean, data?: Object}}
   */
  static tryParseFormat2(text) {
    try {
      // 匹配 host:port:username:password 或 host:port
      const parts = text.split(':');

      if (parts.length === 2) {
        // host:port
        const host = parts[0];
        const port = parseInt(parts[1], 10);

        const data = {
          protocol: 'socks5', // 默认协议
          host,
          port
        };

        const validation = this.validateParsedData(data);
        if (validation.valid) {
          return { success: true, data };
        }
      } else if (parts.length === 4) {
        // host:port:username:password
        const host = parts[0];
        const port = parseInt(parts[1], 10);
        const username = parts[2];
        const password = parts[3];

        const data = {
          protocol: 'socks5', // 默认协议
          host,
          port,
          username,
          password
        };

        const validation = this.validateParsedData(data);
        if (validation.valid) {
          return { success: true, data };
        }
      }

      return { success: false };
    } catch (error) {
      return { success: false };
    }
  }

  /**
   * 尝试解析格式3: protocol://username:password@host:port
   * @param {string} text - 要解析的文本
   * @returns {{success: boolean, data?: Object}}
   */
  static tryParseFormat3(text) {
    try {
      // 匹配 protocol://username:password@host:port
      const regex = /^(socks5|http|https):\/\/([^:@]+):([^@]+)@([^:]+):(\d+)$/i;
      const match = text.match(regex);

      if (match) {
        const protocol = match[1].toLowerCase();
        const username = match[2];
        const password = match[3];
        const host = match[4];
        const port = parseInt(match[5], 10);

        const data = {
          protocol,
          host,
          port,
          username,
          password
        };

        const validation = this.validateParsedData(data);
        if (validation.valid) {
          return { success: true, data };
        }
      }

      return { success: false };
    } catch (error) {
      return { success: false };
    }
  }

  /**
   * 尝试解析格式4: JSON format
   * @param {string} text - 要解析的文本
   * @returns {{success: boolean, data?: Object}}
   */
  static tryParseFormat4(text) {
    try {
      // 尝试解析 JSON
      const parsed = JSON.parse(text);

      // 检查必需字段
      if (parsed.host && parsed.port) {
        const data = {
          protocol: parsed.protocol || 'socks5',
          host: parsed.host,
          port: parseInt(parsed.port, 10),
          username: parsed.username || '',
          password: parsed.password || ''
        };

        const validation = this.validateParsedData(data);
        if (validation.valid) {
          return { success: true, data };
        }
      }

      return { success: false };
    } catch (error) {
      return { success: false };
    }
  }

  /**
   * 验证解析结果
   * @param {Object} data - 解析的数据
   * @returns {{valid: boolean, errors?: string[]}}
   */
  static validateParsedData(data) {
    const errors = [];

    // 验证协议
    if (!data.protocol || !['socks5', 'http', 'https'].includes(data.protocol)) {
      errors.push('Invalid protocol');
    }

    // 验证主机
    if (!data.host || typeof data.host !== 'string' || data.host.trim().length === 0) {
      errors.push('Invalid host');
    }

    // 验证端口
    if (
      typeof data.port !== 'number' ||
      isNaN(data.port) ||
      data.port < 1 ||
      data.port > 65535
    ) {
      errors.push('Invalid port');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * 验证主机地址格式
   * @param {string} host - 主机地址
   * @returns {{valid: boolean, error?: string}}
   */
  static validateHost(host) {
    if (!host || typeof host !== 'string' || host.trim().length === 0) {
      return { valid: false, error: '主机地址不能为空' };
    }

    // IPv4 正则
    const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
    // 域名正则
    const hostnameRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

    if (ipv4Regex.test(host)) {
      // 验证 IP 地址范围
      const parts = host.split('.');
      if (parts.some(part => parseInt(part) > 255)) {
        return { valid: false, error: '无效的 IP 地址' };
      }
      return { valid: true };
    }

    if (hostnameRegex.test(host)) {
      return { valid: true };
    }

    return { valid: false, error: '无效的主机地址格式' };
  }

  /**
   * 验证端口号
   * @param {number|string} port - 端口号
   * @returns {{valid: boolean, error?: string}}
   */
  static validatePort(port) {
    const portNum = typeof port === 'string' ? parseInt(port, 10) : port;

    if (isNaN(portNum)) {
      return { valid: false, error: '端口必须是数字' };
    }

    if (portNum < 1 || portNum > 65535) {
      return { valid: false, error: '端口范围必须在 1-65535 之间' };
    }

    return { valid: true };
  }
}

module.exports = SmartFillParser;
