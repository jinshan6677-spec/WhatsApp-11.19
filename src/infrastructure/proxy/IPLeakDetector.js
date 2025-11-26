'use strict';

const https = require('https');
const http = require('http');
const { SocksProxyAgent } = require('socks-proxy-agent');
const { HttpsProxyAgent } = require('https-proxy-agent');
const ProxyConfig = require('../../domain/entities/ProxyConfig');
const ProxyError = require('../../domain/errors/ProxyError');
const IPLeakDetectedEvent = require('../../domain/events/IPLeakDetectedEvent');

/**
 * Default configuration for IP leak detection
 * @readonly
 */
const LeakDetectorDefaults = {
  CHECK_TIMEOUT: 5000,           // 5 seconds per check
  VERIFICATION_INTERVAL: 300000, // 5 minutes for periodic verification
  MIN_SOURCES_REQUIRED: 2        // Minimum sources for reliable detection
};

/**
 * IP detection sources (multiple for cross-verification)
 * @readonly
 */
const IPSources = {
  PRIMARY: [
    { name: 'ipify', url: 'https://api.ipify.org?format=json', parser: (data) => data.ip },
    { name: 'ip-api', url: 'http://ip-api.com/json/', parser: (data) => data.query },
    { name: 'ipinfo', url: 'https://ipinfo.io/json', parser: (data) => data.ip }
  ],
  SECONDARY: [
    { name: 'myip', url: 'https://api.myip.com', parser: (data) => data.ip },
    { name: 'seeip', url: 'https://api.seeip.org/jsonip', parser: (data) => data.ip }
  ]
};

/**
 * Leak detection result types
 * @readonly
 * @enum {string}
 */
const LeakType = {
  NONE: 'none',
  IP_MISMATCH: 'ip_mismatch',
  WEBRTC: 'webrtc',
  DNS: 'dns',
  WEBSOCKET: 'websocket',
  UNKNOWN: 'unknown'
};

/**
 * IPLeakDetector - IP Verification and Leak Detection
 * 
 * Provides multi-source IP verification and leak detection capabilities.
 * This is a critical security component that ensures the proxy is working
 * correctly and no IP leaks occur.
 * 
 * Key functions:
 * - verifyExitIP: Verify the exit IP matches expected
 * - detectLeak: Detect potential IP leaks
 * - getMultiSourceIP: Get IP from multiple sources for verification
 * 
 * @class
 */
class IPLeakDetector {
  /**
   * Creates an IPLeakDetector instance
   * @param {Object} [options={}] - Configuration options
   * @param {Function} [options.logger] - Logger function
   * @param {Object} [options.eventBus] - Event bus for publishing events
   * @param {number} [options.checkTimeout] - Timeout for each check (ms)
   * @param {number} [options.minSourcesRequired] - Minimum sources for reliable detection
   */
  constructor(options = {}) {
    this.options = options;
    this.log = options.logger || this._createLogger();
    this.eventBus = options.eventBus || null;
    this.checkTimeout = options.checkTimeout || LeakDetectorDefaults.CHECK_TIMEOUT;
    this.minSourcesRequired = options.minSourcesRequired || LeakDetectorDefaults.MIN_SOURCES_REQUIRED;
    
    // IP sources
    this.primarySources = options.primarySources || IPSources.PRIMARY;
    this.secondarySources = options.secondarySources || IPSources.SECONDARY;
    
    // Track known IPs per account
    this._expectedIPs = new Map();
    
    // Track detection history
    this._detectionHistory = [];
    this._maxHistorySize = 100;
  }

  /**
   * Creates a default logger
   * @private
   * @returns {Function}
   */
  _createLogger() {
    return (level, message, ...args) => {
      const timestamp = new Date().toISOString();
      const prefix = `[${timestamp}] [IPLeakDetector] [${level.toUpperCase()}]`;
      
      if (level === 'error') {
        console.error(prefix, message, ...args);
      } else if (level === 'warn') {
        console.warn(prefix, message, ...args);
      } else {
        console.log(prefix, message, ...args);
      }
    };
  }

  // ==================== Core Detection Methods ====================

  /**
   * Verifies that the exit IP matches the expected IP
   * 
   * @param {string} expectedIP - The expected exit IP address
   * @param {ProxyConfig|Object} [config] - Optional proxy config for verification
   * @returns {Promise<{success: boolean, match: boolean, detectedIP?: string, error?: string}>}
   */
  async verifyExitIP(expectedIP, config = null) {
    if (!expectedIP || typeof expectedIP !== 'string') {
      return {
        success: false,
        match: false,
        error: 'Expected IP is required'
      };
    }

    this.log('info', `Verifying exit IP matches: ${expectedIP}`);

    try {
      // Get current IP (through proxy if config provided)
      const result = config 
        ? await this.getIPThroughProxy(config)
        : await this.getDirectIP();

      if (!result.success) {
        return {
          success: false,
          match: false,
          error: result.error
        };
      }

      const detectedIP = result.ip;
      const match = this._normalizeIP(detectedIP) === this._normalizeIP(expectedIP);

      if (match) {
        this.log('info', `✓ IP verification passed: ${detectedIP}`);
      } else {
        this.log('error', `✗ IP mismatch! Expected: ${expectedIP}, Got: ${detectedIP}`);
      }

      // Record in history
      this._recordDetection({
        type: match ? 'verification_passed' : 'verification_failed',
        expectedIP,
        detectedIP,
        match,
        timestamp: new Date()
      });

      return {
        success: true,
        match,
        expectedIP,
        detectedIP,
        source: result.source
      };

    } catch (error) {
      this.log('error', `IP verification error: ${error.message}`);
      return {
        success: false,
        match: false,
        error: error.message
      };
    }
  }

  /**
   * Detects potential IP leaks by comparing proxy IP with direct IP
   * 
   * @param {ProxyConfig|Object} config - Proxy configuration
   * @param {string} [expectedProxyIP] - Expected proxy exit IP
   * @returns {Promise<{leaked: boolean, leakType: string, details?: Object}>}
   */
  async detectLeak(config, expectedProxyIP = null) {
    const proxyConfig = config instanceof ProxyConfig ? config : new ProxyConfig(config);
    
    this.log('info', 'Starting IP leak detection...');

    try {
      // Step 1: Get IP through proxy
      const proxyIPResult = await this.getIPThroughProxy(proxyConfig);
      if (!proxyIPResult.success) {
        return {
          leaked: false,
          leakType: LeakType.UNKNOWN,
          error: `Could not get proxy IP: ${proxyIPResult.error}`
        };
      }

      const proxyIP = proxyIPResult.ip;
      this.log('info', `Proxy IP: ${proxyIP}`);

      // Step 2: If expected IP provided, verify it matches
      if (expectedProxyIP) {
        const normalizedExpected = this._normalizeIP(expectedProxyIP);
        const normalizedProxy = this._normalizeIP(proxyIP);
        
        if (normalizedExpected !== normalizedProxy) {
          this.log('error', `IP mismatch detected! Expected: ${expectedProxyIP}, Got: ${proxyIP}`);
          
          await this._emitLeakEvent(proxyConfig, LeakType.IP_MISMATCH, {
            expectedIP: expectedProxyIP,
            actualIP: proxyIP
          });

          return {
            leaked: true,
            leakType: LeakType.IP_MISMATCH,
            details: {
              expectedIP: expectedProxyIP,
              actualIP: proxyIP
            }
          };
        }
      }

      // Step 3: Multi-source verification
      const multiSourceResult = await this.getMultiSourceIP(proxyConfig);
      if (multiSourceResult.success && multiSourceResult.ips.length >= this.minSourcesRequired) {
        const uniqueIPs = [...new Set(multiSourceResult.ips.map(ip => this._normalizeIP(ip)))];
        
        if (uniqueIPs.length > 1) {
          this.log('warn', `Inconsistent IPs detected across sources: ${uniqueIPs.join(', ')}`);
          // This could indicate a leak or unstable proxy
        }
      }

      this.log('info', '✓ No IP leak detected');

      return {
        leaked: false,
        leakType: LeakType.NONE,
        proxyIP,
        verifiedSources: multiSourceResult.sources || []
      };

    } catch (error) {
      this.log('error', `Leak detection error: ${error.message}`);
      return {
        leaked: false,
        leakType: LeakType.UNKNOWN,
        error: error.message
      };
    }
  }

  /**
   * Gets IP from multiple sources through the proxy for cross-verification
   * 
   * @param {ProxyConfig|Object} config - Proxy configuration
   * @returns {Promise<{success: boolean, ips: string[], sources: string[], error?: string}>}
   */
  async getMultiSourceIP(config) {
    const proxyConfig = config instanceof ProxyConfig ? config : new ProxyConfig(config);
    const agent = this._createProxyAgent(proxyConfig);
    
    this.log('info', 'Getting IP from multiple sources...');

    const results = [];
    const allSources = [...this.primarySources, ...this.secondarySources];

    // Query all sources in parallel
    const promises = allSources.map(async (source) => {
      try {
        const response = await this._fetchJSON(source.url, agent, this.checkTimeout);
        const ip = source.parser(response);
        
        if (ip && this._isValidIP(ip)) {
          return { source: source.name, ip, success: true };
        }
        return { source: source.name, success: false, error: 'Invalid IP' };
      } catch (error) {
        return { source: source.name, success: false, error: error.message };
      }
    });

    const responses = await Promise.allSettled(promises);
    
    for (const response of responses) {
      if (response.status === 'fulfilled' && response.value.success) {
        results.push(response.value);
      }
    }

    if (results.length === 0) {
      return {
        success: false,
        ips: [],
        sources: [],
        error: 'All IP sources failed'
      };
    }

    const ips = results.map(r => r.ip);
    const sources = results.map(r => r.source);

    this.log('info', `Got IPs from ${results.length} sources: ${ips.join(', ')}`);

    return {
      success: true,
      ips,
      sources,
      details: results
    };
  }

  /**
   * Gets IP through the proxy
   * 
   * @param {ProxyConfig|Object} config - Proxy configuration
   * @returns {Promise<{success: boolean, ip?: string, source?: string, error?: string}>}
   */
  async getIPThroughProxy(config) {
    const proxyConfig = config instanceof ProxyConfig ? config : new ProxyConfig(config);
    const agent = this._createProxyAgent(proxyConfig);

    // Try primary sources first
    for (const source of this.primarySources) {
      try {
        const response = await this._fetchJSON(source.url, agent, this.checkTimeout);
        const ip = source.parser(response);
        
        if (ip && this._isValidIP(ip)) {
          return {
            success: true,
            ip,
            source: source.name
          };
        }
      } catch (error) {
        this.log('debug', `Source ${source.name} failed: ${error.message}`);
      }
    }

    // Try secondary sources
    for (const source of this.secondarySources) {
      try {
        const response = await this._fetchJSON(source.url, agent, this.checkTimeout);
        const ip = source.parser(response);
        
        if (ip && this._isValidIP(ip)) {
          return {
            success: true,
            ip,
            source: source.name
          };
        }
      } catch (error) {
        this.log('debug', `Source ${source.name} failed: ${error.message}`);
      }
    }

    return {
      success: false,
      error: 'All IP sources failed'
    };
  }

  /**
   * Gets the direct (non-proxy) IP address
   * Used for leak comparison
   * 
   * @returns {Promise<{success: boolean, ip?: string, source?: string, error?: string}>}
   */
  async getDirectIP() {
    this.log('info', 'Getting direct IP (no proxy)...');

    for (const source of this.primarySources) {
      try {
        const response = await this._fetchJSON(source.url, null, this.checkTimeout);
        const ip = source.parser(response);
        
        if (ip && this._isValidIP(ip)) {
          this.log('info', `Direct IP: ${ip} (source: ${source.name})`);
          return {
            success: true,
            ip,
            source: source.name
          };
        }
      } catch (error) {
        this.log('debug', `Direct IP source ${source.name} failed: ${error.message}`);
      }
    }

    return {
      success: false,
      error: 'Could not determine direct IP'
    };
  }

  // ==================== Expected IP Management ====================

  /**
   * Sets the expected IP for an account
   * @param {string} accountId - Account ID
   * @param {string} ip - Expected IP address
   */
  setExpectedIP(accountId, ip) {
    if (accountId && ip) {
      this._expectedIPs.set(accountId, {
        ip: this._normalizeIP(ip),
        setAt: new Date()
      });
      this.log('info', `Set expected IP for ${accountId}: ${ip}`);
    }
  }

  /**
   * Gets the expected IP for an account
   * @param {string} accountId - Account ID
   * @returns {string|null}
   */
  getExpectedIP(accountId) {
    const entry = this._expectedIPs.get(accountId);
    return entry ? entry.ip : null;
  }

  /**
   * Clears the expected IP for an account
   * @param {string} accountId - Account ID
   */
  clearExpectedIP(accountId) {
    this._expectedIPs.delete(accountId);
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
      return new HttpsProxyAgent(proxyUrl);
    }
  }

  /**
   * Fetches JSON data
   * @private
   * @param {string} url - URL to fetch
   * @param {Object|null} agent - Proxy agent (null for direct)
   * @param {number} timeout - Request timeout
   * @returns {Promise<Object>} Parsed JSON response
   */
  _fetchJSON(url, agent, timeout) {
    return new Promise((resolve, reject) => {
      const parsedUrl = new URL(url);
      const isHttps = parsedUrl.protocol === 'https:';
      const httpModule = isHttps ? https : http;
      
      const options = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (isHttps ? 443 : 80),
        path: parsedUrl.pathname + parsedUrl.search,
        method: 'GET',
        timeout,
        headers: {
          'User-Agent': 'WhatsApp-Desktop-IPLeakDetector/1.0',
          'Accept': 'application/json'
        }
      };

      if (agent) {
        options.agent = agent;
      }
      
      const req = httpModule.request(options, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            resolve(parsed);
          } catch (error) {
            reject(new Error(`Invalid JSON: ${error.message}`));
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
      const octets = ip.split('.');
      return octets.every(octet => {
        const num = parseInt(octet, 10);
        return num >= 0 && num <= 255;
      });
    }
    
    return ipv6Pattern.test(ip);
  }

  /**
   * Normalizes an IP address for comparison
   * @private
   * @param {string} ip - IP address
   * @returns {string}
   */
  _normalizeIP(ip) {
    if (!ip) return '';
    return ip.trim().toLowerCase();
  }

  /**
   * Records a detection event in history
   * @private
   * @param {Object} event - Detection event
   */
  _recordDetection(event) {
    this._detectionHistory.push(event);
    
    // Trim history if too large
    if (this._detectionHistory.length > this._maxHistorySize) {
      this._detectionHistory = this._detectionHistory.slice(-this._maxHistorySize);
    }
  }

  /**
   * Emits an IP leak event
   * @private
   * @param {ProxyConfig} config - Proxy configuration
   * @param {string} leakType - Type of leak
   * @param {Object} details - Leak details
   */
  async _emitLeakEvent(config, leakType, details) {
    if (!this.eventBus) return;

    try {
      const event = IPLeakDetectedEvent.create(
        config.id,
        null, // accountId not known here
        leakType,
        details.actualIP,
        details.expectedIP,
        'IPLeakDetector'
      );
      
      await this.eventBus.publish(IPLeakDetectedEvent.EVENT_NAME, event.toJSON());
    } catch (error) {
      this.log('error', `Failed to emit leak event: ${error.message}`);
    }
  }

  // ==================== Query Methods ====================

  /**
   * Gets detection history
   * @param {number} [limit=10] - Maximum entries to return
   * @returns {Array}
   */
  getDetectionHistory(limit = 10) {
    return this._detectionHistory.slice(-limit);
  }

  /**
   * Clears detection history
   */
  clearHistory() {
    this._detectionHistory = [];
  }

  /**
   * Gets all expected IPs
   * @returns {Object}
   */
  getAllExpectedIPs() {
    const result = {};
    for (const [accountId, entry] of this._expectedIPs) {
      result[accountId] = entry;
    }
    return result;
  }
}

// Export class and constants
IPLeakDetector.Defaults = LeakDetectorDefaults;
IPLeakDetector.IPSources = IPSources;
IPLeakDetector.LeakType = LeakType;
module.exports = IPLeakDetector;
