'use strict';

const https = require('https');
const http = require('http');
const { SocksProxyAgent } = require('socks-proxy-agent');
const { HttpsProxyAgent } = require('https-proxy-agent');
const ProxyConfig = require('../../domain/entities/ProxyConfig');
const ProxyError = require('../../domain/errors/ProxyError');

/**
 * Default configuration for pre-checks
 * @readonly
 */
const PreCheckDefaults = {
  CONNECTIVITY_TIMEOUT: 3000,  // 3 seconds
  LATENCY_SAMPLES: 3,          // Number of samples for latency measurement
  IP_CHECK_TIMEOUT: 5000       // 5 seconds for IP check
};

/**
 * IP detection endpoints (multiple sources for reliability)
 * @readonly
 */
const IPEndpoints = [
  { url: 'https://api.ipify.org?format=json', parser: (data) => data.ip },
  { url: 'http://ip-api.com/json/', parser: (data) => data.query },
  { url: 'https://ipinfo.io/json', parser: (data) => data.ip }
];

/**
 * ProxyPreChecker - Pre-connection Proxy Verification
 * 
 * Performs connectivity tests, latency measurements, and exit IP detection
 * BEFORE creating a BrowserView. This is a critical security component.
 * 
 * Key functions:
 * - testConnectivity: Verify proxy is reachable (3s timeout)
 * - measureLatency: Measure round-trip latency
 * - getExitIP: Detect the proxy's exit IP address
 * 
 * @class
 */
class ProxyPreChecker {
  /**
   * Creates a ProxyPreChecker instance
   * @param {Object} [options={}] - Configuration options
   * @param {Function} [options.logger] - Logger function
   * @param {number} [options.connectivityTimeout] - Connectivity test timeout (ms)
   * @param {number} [options.latencySamples] - Number of latency samples
   * @param {number} [options.ipCheckTimeout] - IP check timeout (ms)
   */
  constructor(options = {}) {
    this.options = options;
    this.log = options.logger || this._createLogger();
    this.connectivityTimeout = options.connectivityTimeout || PreCheckDefaults.CONNECTIVITY_TIMEOUT;
    this.latencySamples = options.latencySamples || PreCheckDefaults.LATENCY_SAMPLES;
    this.ipCheckTimeout = options.ipCheckTimeout || PreCheckDefaults.IP_CHECK_TIMEOUT;
    
    // IP endpoints for detection
    this.ipEndpoints = options.ipEndpoints || IPEndpoints;
  }

  /**
   * Creates a default logger
   * @private
   * @returns {Function}
   */
  _createLogger() {
    return (level, message, ...args) => {
      const timestamp = new Date().toISOString();
      const prefix = `[${timestamp}] [ProxyPreChecker] [${level.toUpperCase()}]`;
      
      if (level === 'error') {
        console.error(prefix, message, ...args);
      } else if (level === 'warn') {
        console.warn(prefix, message, ...args);
      } else {
        console.log(prefix, message, ...args);
      }
    };
  }

  // ==================== Core Pre-Check Methods ====================

  /**
   * Tests proxy connectivity with a short timeout
   * This is the first check before any connection is established.
   * 
   * @param {ProxyConfig|Object} config - Proxy configuration
   * @returns {Promise<{success: boolean, latency?: number, error?: string}>}
   */
  async testConnectivity(config) {
    const proxyConfig = config instanceof ProxyConfig ? config : new ProxyConfig(config);
    
    // Validate config first
    const validation = proxyConfig.validate();
    if (!validation.valid) {
      const errorDetails = validation.errors.map(e => `${e.field}: ${e.reason}`).join('; ');
      return {
        success: false,
        error: `Invalid configuration: ${errorDetails}`
      };
    }

    this.log('info', `Testing connectivity to ${proxyConfig.host}:${proxyConfig.port}`);

    const startTime = Date.now();

    try {
      // Create proxy agent
      const agent = this._createProxyAgent(proxyConfig);
      
      // Make a simple request through the proxy
      await this._makeTestRequest(agent, this.connectivityTimeout);
      
      const latency = Date.now() - startTime;
      
      this.log('info', `✓ Connectivity test passed (${latency}ms)`);
      
      return {
        success: true,
        latency
      };

    } catch (error) {
      const elapsed = Date.now() - startTime;
      this.log('error', `✗ Connectivity test failed after ${elapsed}ms: ${error.message}`);
      
      return {
        success: false,
        error: this._formatError(error),
        elapsed
      };
    }
  }

  /**
   * Measures proxy latency by taking multiple samples
   * 
   * @param {ProxyConfig|Object} config - Proxy configuration
   * @param {number} [samples] - Number of samples to take
   * @returns {Promise<{success: boolean, latency?: {min: number, max: number, avg: number}, error?: string}>}
   */
  async measureLatency(config, samples = null) {
    const proxyConfig = config instanceof ProxyConfig ? config : new ProxyConfig(config);
    const numSamples = samples || this.latencySamples;
    
    this.log('info', `Measuring latency with ${numSamples} samples`);

    const latencies = [];
    const agent = this._createProxyAgent(proxyConfig);

    for (let i = 0; i < numSamples; i++) {
      try {
        const startTime = Date.now();
        await this._makeTestRequest(agent, this.connectivityTimeout);
        const latency = Date.now() - startTime;
        latencies.push(latency);
        
        this.log('debug', `Sample ${i + 1}: ${latency}ms`);
        
        // Small delay between samples
        if (i < numSamples - 1) {
          await this._delay(100);
        }
      } catch (error) {
        this.log('warn', `Sample ${i + 1} failed: ${error.message}`);
        // Continue with remaining samples
      }
    }

    if (latencies.length === 0) {
      return {
        success: false,
        error: 'All latency samples failed'
      };
    }

    const min = Math.min(...latencies);
    const max = Math.max(...latencies);
    const avg = Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length);

    this.log('info', `Latency: min=${min}ms, max=${max}ms, avg=${avg}ms`);

    return {
      success: true,
      latency: { min, max, avg },
      samples: latencies.length
    };
  }

  /**
   * Gets the exit IP address through the proxy
   * Uses multiple IP detection services for reliability.
   * 
   * @param {ProxyConfig|Object} config - Proxy configuration
   * @returns {Promise<{success: boolean, ip?: string, source?: string, error?: string}>}
   */
  async getExitIP(config) {
    const proxyConfig = config instanceof ProxyConfig ? config : new ProxyConfig(config);
    
    this.log('info', `Getting exit IP through ${proxyConfig.host}:${proxyConfig.port}`);

    const agent = this._createProxyAgent(proxyConfig);

    // Try each endpoint until one succeeds
    for (const endpoint of this.ipEndpoints) {
      try {
        this.log('debug', `Trying IP endpoint: ${endpoint.url}`);
        
        const response = await this._fetchJSON(endpoint.url, agent, this.ipCheckTimeout);
        const ip = endpoint.parser(response);
        
        if (ip && this._isValidIP(ip)) {
          this.log('info', `✓ Exit IP detected: ${ip} (source: ${endpoint.url})`);
          
          return {
            success: true,
            ip,
            source: endpoint.url
          };
        }
      } catch (error) {
        this.log('warn', `IP endpoint failed (${endpoint.url}): ${error.message}`);
        // Continue to next endpoint
      }
    }

    this.log('error', 'All IP detection endpoints failed');
    
    return {
      success: false,
      error: 'Failed to detect exit IP from all sources'
    };
  }

  /**
   * Performs a complete pre-check (connectivity + IP detection)
   * This is the recommended method to call before creating a BrowserView.
   * 
   * @param {ProxyConfig|Object} config - Proxy configuration
   * @returns {Promise<{success: boolean, connectivity?: Object, ip?: string, latency?: Object, error?: string}>}
   */
  async performFullCheck(config) {
    const proxyConfig = config instanceof ProxyConfig ? config : new ProxyConfig(config);
    
    this.log('info', `Performing full pre-check for ${proxyConfig.host}:${proxyConfig.port}`);

    // Step 1: Connectivity test
    const connectivityResult = await this.testConnectivity(proxyConfig);
    if (!connectivityResult.success) {
      return {
        success: false,
        error: `Connectivity failed: ${connectivityResult.error}`,
        connectivity: connectivityResult
      };
    }

    // Step 2: Get exit IP
    const ipResult = await this.getExitIP(proxyConfig);
    if (!ipResult.success) {
      return {
        success: false,
        error: `IP detection failed: ${ipResult.error}`,
        connectivity: connectivityResult,
        ipCheck: ipResult
      };
    }

    // Step 3: Measure latency (optional, non-blocking)
    const latencyResult = await this.measureLatency(proxyConfig);

    this.log('info', `✓ Full pre-check passed (IP: ${ipResult.ip})`);

    return {
      success: true,
      connectivity: connectivityResult,
      ip: ipResult.ip,
      ipSource: ipResult.source,
      latency: latencyResult.success ? latencyResult.latency : null
    };
  }

  // ==================== Internal Methods ====================

  /**
   * Creates a proxy agent based on protocol
   * @private
   * @param {ProxyConfig} config - Proxy configuration
   * @returns {Object} Proxy agent
   */
  _createProxyAgent(config) {
    const proxyUrl = config.getUrl();
    
    if (config.protocol === ProxyConfig.Protocol.SOCKS5) {
      return new SocksProxyAgent(proxyUrl);
    } else {
      // HTTP/HTTPS proxy
      return new HttpsProxyAgent(proxyUrl);
    }
  }

  /**
   * Makes a simple test request through the proxy
   * @private
   * @param {Object} agent - Proxy agent
   * @param {number} timeout - Request timeout
   * @returns {Promise<void>}
   */
  _makeTestRequest(agent, timeout) {
    return new Promise((resolve, reject) => {
      // Use a simple, fast endpoint for connectivity test
      const testUrl = 'http://ip-api.com/json/';
      const url = new URL(testUrl);
      
      const req = http.request({
        hostname: url.hostname,
        port: url.port || 80,
        path: url.pathname + url.search,
        method: 'GET',
        agent,
        timeout,
        headers: {
          'User-Agent': 'WhatsApp-Desktop-Proxy-PreChecker/1.0'
        }
      }, (res) => {
        // Consume response data
        res.on('data', () => {});
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 400) {
            resolve();
          } else {
            reject(new Error(`HTTP ${res.statusCode}`));
          }
        });
      });

      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Connection timeout'));
      });

      req.end();
    });
  }

  /**
   * Fetches JSON data through the proxy
   * @private
   * @param {string} url - URL to fetch
   * @param {Object} agent - Proxy agent
   * @param {number} timeout - Request timeout
   * @returns {Promise<Object>} Parsed JSON response
   */
  _fetchJSON(url, agent, timeout) {
    return new Promise((resolve, reject) => {
      const parsedUrl = new URL(url);
      const isHttps = parsedUrl.protocol === 'https:';
      const httpModule = isHttps ? https : http;
      
      const req = httpModule.request({
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (isHttps ? 443 : 80),
        path: parsedUrl.pathname + parsedUrl.search,
        method: 'GET',
        agent,
        timeout,
        headers: {
          'User-Agent': 'WhatsApp-Desktop-Proxy-PreChecker/1.0',
          'Accept': 'application/json'
        }
      }, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            resolve(parsed);
          } catch (error) {
            reject(new Error(`Invalid JSON response: ${error.message}`));
          }
        });
      });

      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });

      req.end();
    });
  }

  /**
   * Validates an IP address format
   * @private
   * @param {string} ip - IP address to validate
   * @returns {boolean}
   */
  _isValidIP(ip) {
    if (!ip || typeof ip !== 'string') return false;
    
    // IPv4 pattern
    const ipv4Pattern = /^(\d{1,3}\.){3}\d{1,3}$/;
    // IPv6 pattern (simplified)
    const ipv6Pattern = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$|^::([0-9a-fA-F]{1,4}:){0,6}[0-9a-fA-F]{1,4}$|^([0-9a-fA-F]{1,4}:){1,7}:$/;
    
    if (ipv4Pattern.test(ip)) {
      // Validate IPv4 octets
      const octets = ip.split('.');
      return octets.every(octet => {
        const num = parseInt(octet, 10);
        return num >= 0 && num <= 255;
      });
    }
    
    return ipv6Pattern.test(ip);
  }

  /**
   * Formats an error message
   * @private
   * @param {Error} error - Error object
   * @returns {string}
   */
  _formatError(error) {
    const message = error.message || '';
    
    if (message.includes('timeout') || message.includes('ETIMEDOUT')) {
      return 'Connection timeout - proxy may be slow or unreachable';
    }
    if (message.includes('ECONNREFUSED')) {
      return 'Connection refused - proxy server may be down';
    }
    if (message.includes('ENOTFOUND')) {
      return 'Host not found - check proxy hostname';
    }
    if (message.includes('ECONNRESET')) {
      return 'Connection reset - proxy may be unstable';
    }
    if (message.includes('authentication') || message.includes('407')) {
      return 'Authentication failed - check username/password';
    }
    if (message.includes('EHOSTUNREACH')) {
      return 'Host unreachable - check network connection';
    }
    
    return message;
  }

  /**
   * Delays execution
   * @private
   * @param {number} ms - Milliseconds to delay
   * @returns {Promise<void>}
   */
  _delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Export class and defaults
ProxyPreChecker.Defaults = PreCheckDefaults;
ProxyPreChecker.IPEndpoints = IPEndpoints;
module.exports = ProxyPreChecker;
