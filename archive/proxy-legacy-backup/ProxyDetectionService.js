/**
 * ProxyDetectionService - 代理检测服务 (LEGACY BACKUP)
 * 
 * 备份日期: 2025-11-27
 * 原位置: src/services/ProxyDetectionService.js
 * 
 * 负责测试代理连接和查询网络信息
 */

const https = require('https');
const http = require('http');
const { SocksProxyAgent } = require('socks-proxy-agent');

class ProxyDetectionService {
  constructor() {
    // IP 查询 API 端点（按优先级排序）
    this.ipApiEndpoints = [
      'http://ip-api.com/json/',
      'https://ipapi.co/json/',
      'https://api.ipify.org?format=json'
    ];
  }

  /**
   * 测试代理连接
   * @param {Object} proxyConfig - 代理配置
   * @returns {Promise<Object>} 检测结果
   */
  async testProxy(proxyConfig) {
    try {
      const startTime = Date.now();
      
      // 设置超时时间
      const timeout = 10000; // 10 seconds
      
      const result = await Promise.race([
        this.getIPInfoThroughProxy(proxyConfig),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('连接超时')), timeout)
        )
      ]);
      
      const responseTime = Date.now() - startTime;
      
      return {
        success: true,
        ...result,
        responseTime,
        timestamp: new Date()
      };
    } catch (error) {
      return {
        success: false,
        error: this.formatNetworkError(error),
        timestamp: new Date()
      };
    }
  }

  /**
   * 获取当前网络信息
   * @returns {Promise<Object>} 网络信息
   */
  async getCurrentNetworkInfo() {
    const startTime = Date.now();
    
    // 尝试多个 API 端点
    for (const endpoint of this.ipApiEndpoints) {
      try {
        console.log('[ProxyDetectionService] 尝试 API:', endpoint);
        const result = await this._fetchIPInfo(endpoint);
        const responseTime = Date.now() - startTime;
        
        console.log('[ProxyDetectionService] API 响应成功:', result);
        
        return {
          success: true,
          ...result,
          responseTime,
          timestamp: new Date()
        };
      } catch (error) {
        console.warn('[ProxyDetectionService] API 失败:', endpoint, error.message);
        // 继续尝试下一个端点
      }
    }
    
    // 所有端点都失败
    return {
      success: false,
      error: '无法获取网络信息，所有 API 端点都失败',
      timestamp: new Date()
    };
  }

  /**
   * 通过代理获取 IP 信息
   * @param {Object} proxyConfig - 代理配置
   * @returns {Promise<Object>} IP 信息
   */
  async getIPInfoThroughProxy(proxyConfig) {
    try {
      // 构建代理 URL
      const proxyUrl = this._buildProxyUrl(proxyConfig);
      
      // 根据协议选择合适的方法
      if (proxyConfig.protocol === 'socks5') {
        return await this._fetchIPInfoWithSocks(proxyUrl);
      } else {
        return await this._fetchIPInfoWithHttpProxy(proxyUrl);
      }
    } catch (error) {
      throw new Error(`代理连接失败: ${error.message}`);
    }
  }

  /**
   * 构建代理 URL
   * @private
   * @param {Object} config - 代理配置
   * @returns {string} 代理 URL
   */
  _buildProxyUrl(config) {
    const { protocol, host, port, username, password } = config;
    
    if (username && password) {
      return `${protocol}://${username}:${password}@${host}:${port}`;
    }
    
    return `${protocol}://${host}:${port}`;
  }

  /**
   * 使用 SOCKS 代理获取 IP 信息
   * @private
   * @param {string} proxyUrl - 代理 URL
   * @returns {Promise<Object>} IP 信息
   */
  async _fetchIPInfoWithSocks(proxyUrl) {
    try {
      const agent = new SocksProxyAgent(proxyUrl);
      return await this._fetchIPInfo(this.ipApiEndpoints[0], { agent });
    } catch (error) {
      if (error.message.includes('Cannot find module')) {
        throw new Error('SOCKS5 代理支持需要安装 socks-proxy-agent 包');
      }
      throw error;
    }
  }

  /**
   * 使用 HTTP/HTTPS 代理获取 IP 信息
   * @private
   * @param {string} proxyUrl - 代理 URL
   * @returns {Promise<Object>} IP 信息
   */
  async _fetchIPInfoWithHttpProxy(proxyUrl) {
    const url = new URL(proxyUrl);
    const proxyOptions = {
      host: url.hostname,
      port: url.port,
      auth: url.username && url.password ? `${url.username}:${url.password}` : undefined
    };
    
    return await this._fetchIPInfo(this.ipApiEndpoints[0], { proxy: proxyOptions });
  }

  /**
   * 获取 IP 信息
   * @private
   * @param {string} apiUrl - API URL
   * @param {Object} [options] - 请求选项
   * @returns {Promise<Object>} IP 信息
   */
  _fetchIPInfo(apiUrl, options = {}) {
    return new Promise((resolve, reject) => {
      const url = new URL(apiUrl);
      const isHttps = url.protocol === 'https:';
      const httpModule = isHttps ? https : http;
      
      const requestOptions = {
        hostname: url.hostname,
        port: url.port || (isHttps ? 443 : 80),
        path: url.pathname + url.search,
        method: 'GET',
        headers: {
          'User-Agent': 'WhatsApp-Desktop-Proxy-Checker/1.0'
        },
        timeout: 10000
      };
      
      if (options.proxy) {
        requestOptions.agent = new http.Agent({
          proxy: options.proxy
        });
      } else if (options.agent) {
        requestOptions.agent = options.agent;
      }
      
      const req = httpModule.request(requestOptions, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          try {
            console.log('[ProxyDetectionService] 原始响应数据:', data);
            const parsed = JSON.parse(data);
            const result = this.parseIPInfo(parsed);
            resolve(result);
          } catch (error) {
            console.error('[ProxyDetectionService] 解析失败:', error);
            reject(new Error('无法解析 IP 信息响应: ' + error.message));
          }
        });
      });
      
      req.on('error', (error) => {
        reject(error);
      });
      
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('请求超时'));
      });
      
      req.end();
    });
  }

  /**
   * 解析 IP 信息响应
   * @param {Object} response - API 响应
   * @returns {Object} 解析后的 IP 信息
   */
  parseIPInfo(response) {
    console.log('[ProxyDetectionService] 解析 IP 信息:', JSON.stringify(response));
    
    const result = {
      ip: response.ip || response.query || 'N/A',
      location: response.city || response.regionName || response.region || 'Unknown',
      country: response.country_name || response.country || 'Unknown',
      countryCode: response.country_code || response.countryCode || response.country || 'Unknown'
    };
    
    console.log('[ProxyDetectionService] 解析结果:', JSON.stringify(result));
    
    return result;
  }

  /**
   * 格式化网络错误
   * @param {Error} error - 错误对象
   * @returns {string} 格式化的错误消息
   */
  formatNetworkError(error) {
    const message = error.message || '';
    
    if (message.includes('timeout') || message.includes('超时')) {
      return '代理服务器连接超时，请检查地址和端口是否正确';
    }
    if (message.includes('ECONNREFUSED')) {
      return '代理服务器拒绝连接，请确认服务器正在运行';
    }
    if (message.includes('ENOTFOUND')) {
      return '无法解析主机地址，请检查域名是否正确';
    }
    if (message.includes('ETIMEDOUT')) {
      return '连接超时，请检查网络连接和代理设置';
    }
    if (message.includes('authentication') || message.includes('认证')) {
      return '代理认证失败，请检查用户名和密码';
    }
    if (message.includes('ECONNRESET')) {
      return '连接被重置，代理服务器可能不稳定';
    }
    if (message.includes('EHOSTUNREACH')) {
      return '无法访问主机，请检查网络连接';
    }
    
    return `连接失败: ${message}`;
  }

  /**
   * 验证代理配置
   * @param {Object} config - 代理配置
   * @returns {{valid: boolean, errors: string[]}}
   */
  validateProxyConfig(config) {
    const errors = [];
    
    if (!config) {
      errors.push('代理配置不能为空');
      return { valid: false, errors };
    }
    
    if (!['socks5', 'http', 'https'].includes(config.protocol)) {
      errors.push('无效的代理协议');
    }
    
    if (!config.host || config.host.trim().length === 0) {
      errors.push('代理主机地址不能为空');
    }
    
    if (!config.port || config.port < 1 || config.port > 65535) {
      errors.push('代理端口必须在 1-65535 之间');
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }
}

module.exports = ProxyDetectionService;
