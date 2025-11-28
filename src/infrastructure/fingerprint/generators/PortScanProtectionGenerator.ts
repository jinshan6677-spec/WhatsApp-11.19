/**
 * PortScanProtectionGenerator
 * 
 * Generates port scan protection configuration and scripts to prevent
 * websites from scanning local ports via WebSocket or Fetch API.
 * 
 * Requirements: 18.1-18.5
 */

export interface PortScanProtectionConfig {
  /** Whether port scan protection is enabled */
  enabled: boolean;
  /** Whether to block connections to local addresses (127.0.0.1, localhost, 192.168.x.x) */
  blockLocalAddresses: boolean;
  /** Whether to block connections to sensitive ports */
  blockSensitivePorts: boolean;
  /** Custom list of ports to block (in addition to default sensitive ports) */
  customBlockedPorts?: number[];
  /** Custom list of addresses to block (in addition to default local addresses) */
  customBlockedAddresses?: string[];
  /** Whether to log blocked attempts (for debugging) */
  logBlockedAttempts: boolean;
}

// Default sensitive ports that should be blocked
const DEFAULT_SENSITIVE_PORTS: number[] = [
  // SSH
  22,
  // FTP
  21, 20,
  // Telnet
  23,
  // SMTP
  25, 465, 587,
  // DNS
  53,
  // HTTP/HTTPS (local servers)
  80, 443, 8080, 8443,
  // POP3
  110, 995,
  // IMAP
  143, 993,
  // MySQL
  3306,
  // PostgreSQL
  5432,
  // MongoDB
  27017,
  // Redis
  6379,
  // Elasticsearch
  9200, 9300,
  // RDP (Remote Desktop)
  3389,
  // VNC
  5900, 5901,
  // SMB
  445, 139,
  // LDAP
  389, 636,
  // Docker
  2375, 2376,
  // Kubernetes
  6443, 10250,
  // Common development ports
  3000, 4000, 5000, 8000, 9000
];

// Default local address patterns
const DEFAULT_LOCAL_ADDRESSES: string[] = [
  '127.0.0.1',
  'localhost',
  '0.0.0.0',
  '::1',
  // Private network ranges (will be matched as prefixes)
  '192.168.',
  '10.',
  '172.16.',
  '172.17.',
  '172.18.',
  '172.19.',
  '172.20.',
  '172.21.',
  '172.22.',
  '172.23.',
  '172.24.',
  '172.25.',
  '172.26.',
  '172.27.',
  '172.28.',
  '172.29.',
  '172.30.',
  '172.31.'
];

export class PortScanProtectionGenerator {
  /**
   * Gets the default sensitive ports list
   */
  static getDefaultSensitivePorts(): number[] {
    return [...DEFAULT_SENSITIVE_PORTS];
  }
  
  /**
   * Gets the default local addresses list
   */
  static getDefaultLocalAddresses(): string[] {
    return [...DEFAULT_LOCAL_ADDRESSES];
  }
  
  /**
   * Creates a default port scan protection config
   * Requirements: 18.1
   */
  static createDefaultConfig(): PortScanProtectionConfig {
    return {
      enabled: true,
      blockLocalAddresses: true,
      blockSensitivePorts: true,
      customBlockedPorts: [],
      customBlockedAddresses: [],
      logBlockedAttempts: false
    };
  }
  
  /**
   * Creates a disabled port scan protection config
   * Requirements: 18.4
   */
  static createDisabledConfig(): PortScanProtectionConfig {
    return {
      enabled: false,
      blockLocalAddresses: false,
      blockSensitivePorts: false,
      customBlockedPorts: [],
      customBlockedAddresses: [],
      logBlockedAttempts: false
    };
  }
  
  /**
   * Creates a custom port scan protection config
   */
  static createConfig(options: Partial<PortScanProtectionConfig>): PortScanProtectionConfig {
    return {
      enabled: options.enabled ?? true,
      blockLocalAddresses: options.blockLocalAddresses ?? true,
      blockSensitivePorts: options.blockSensitivePorts ?? true,
      customBlockedPorts: options.customBlockedPorts ?? [],
      customBlockedAddresses: options.customBlockedAddresses ?? [],
      logBlockedAttempts: options.logBlockedAttempts ?? false
    };
  }
  
  /**
   * Validates port scan protection configuration
   */
  static validateConfig(config: PortScanProtectionConfig): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (typeof config.enabled !== 'boolean') {
      errors.push('enabled must be a boolean');
    }
    
    if (typeof config.blockLocalAddresses !== 'boolean') {
      errors.push('blockLocalAddresses must be a boolean');
    }
    
    if (typeof config.blockSensitivePorts !== 'boolean') {
      errors.push('blockSensitivePorts must be a boolean');
    }
    
    if (config.customBlockedPorts) {
      if (!Array.isArray(config.customBlockedPorts)) {
        errors.push('customBlockedPorts must be an array');
      } else {
        for (const port of config.customBlockedPorts) {
          if (typeof port !== 'number' || port < 1 || port > 65535) {
            errors.push(`Invalid port number: ${port}`);
          }
        }
      }
    }
    
    if (config.customBlockedAddresses) {
      if (!Array.isArray(config.customBlockedAddresses)) {
        errors.push('customBlockedAddresses must be an array');
      } else {
        for (const addr of config.customBlockedAddresses) {
          if (typeof addr !== 'string' || addr.length === 0) {
            errors.push(`Invalid address: ${addr}`);
          }
        }
      }
    }
    
    return { valid: errors.length === 0, errors };
  }
  
  /**
   * Checks if an address is a local address
   * Requirements: 18.2
   */
  static isLocalAddress(address: string, customAddresses: string[] = []): boolean {
    const allAddresses = [...DEFAULT_LOCAL_ADDRESSES, ...customAddresses];
    
    // Remove brackets from IPv6 addresses (URL parsing adds them)
    let normalizedAddress = address.toLowerCase();
    if (normalizedAddress.startsWith('[') && normalizedAddress.endsWith(']')) {
      normalizedAddress = normalizedAddress.slice(1, -1);
    }
    
    for (const localAddr of allAddresses) {
      const lowerLocalAddr = localAddr.toLowerCase();
      // Exact match or prefix match
      if (normalizedAddress === lowerLocalAddr || normalizedAddress.startsWith(lowerLocalAddr)) {
        return true;
      }
    }
    
    return false;
  }
  
  /**
   * Checks if a port is a sensitive port
   * Requirements: 18.3
   */
  static isSensitivePort(port: number, customPorts: number[] = []): boolean {
    const allPorts = [...DEFAULT_SENSITIVE_PORTS, ...customPorts];
    return allPorts.includes(port);
  }
  
  /**
   * Checks if a URL should be blocked
   */
  static shouldBlockUrl(
    url: string,
    config: PortScanProtectionConfig
  ): { blocked: boolean; reason?: string } {
    if (!config.enabled) {
      return { blocked: false };
    }
    
    try {
      // Only process http, https, ws, wss protocols
      if (!url.match(/^(https?|wss?):\/\//i)) {
        return { blocked: false };
      }
      
      const parsedUrl = new URL(url);
      const hostname = parsedUrl.hostname;
      const port = parsedUrl.port ? parseInt(parsedUrl.port, 10) : 
        (parsedUrl.protocol === 'https:' || parsedUrl.protocol === 'wss:' ? 443 : 80);
      
      // Check local addresses
      if (config.blockLocalAddresses) {
        if (this.isLocalAddress(hostname, config.customBlockedAddresses)) {
          return { blocked: true, reason: `Local address blocked: ${hostname}` };
        }
      }
      
      // Check sensitive ports
      if (config.blockSensitivePorts) {
        if (this.isSensitivePort(port, config.customBlockedPorts)) {
          return { blocked: true, reason: `Sensitive port blocked: ${port}` };
        }
      }
      
      return { blocked: false };
    } catch {
      // Invalid URL, don't block
      return { blocked: false };
    }
  }
  
  /**
   * Generates port scan protection script
   * Requirements: 18.1-18.5
   */
  static generateScript(config: PortScanProtectionConfig): string {
    if (!config.enabled) {
      return '// Port Scan Protection: Disabled';
    }
    
    const localAddresses = JSON.stringify([...DEFAULT_LOCAL_ADDRESSES, ...(config.customBlockedAddresses || [])]);
    const sensitivePorts = JSON.stringify([...DEFAULT_SENSITIVE_PORTS, ...(config.customBlockedPorts || [])]);
    const logEnabled = config.logBlockedAttempts ? 'true' : 'false';
    const blockLocal = config.blockLocalAddresses ? 'true' : 'false';
    const blockPorts = config.blockSensitivePorts ? 'true' : 'false';
    
    return `
(function() {
  // Port Scan Protection
  const LOCAL_ADDRESSES = ${localAddresses};
  const SENSITIVE_PORTS = ${sensitivePorts};
  const LOG_BLOCKED = ${logEnabled};
  const BLOCK_LOCAL = ${blockLocal};
  const BLOCK_PORTS = ${blockPorts};
  
  function isLocalAddress(hostname) {
    if (!BLOCK_LOCAL) return false;
    const lower = hostname.toLowerCase();
    for (const addr of LOCAL_ADDRESSES) {
      if (lower === addr.toLowerCase() || lower.startsWith(addr.toLowerCase())) {
        return true;
      }
    }
    return false;
  }
  
  function isSensitivePort(port) {
    if (!BLOCK_PORTS) return false;
    return SENSITIVE_PORTS.includes(port);
  }
  
  function shouldBlock(url) {
    try {
      const parsed = new URL(url);
      const hostname = parsed.hostname;
      const port = parsed.port ? parseInt(parsed.port, 10) : 
        (parsed.protocol === 'https:' ? 443 : 80);
      
      if (isLocalAddress(hostname)) {
        return { blocked: true, reason: 'Local address: ' + hostname };
      }
      
      if (isSensitivePort(port)) {
        return { blocked: true, reason: 'Sensitive port: ' + port };
      }
      
      return { blocked: false };
    } catch (e) {
      return { blocked: false };
    }
  }
  
  function logBlocked(type, url, reason) {
    if (LOG_BLOCKED) {
      console.warn('[PortScanProtection] Blocked ' + type + ' to ' + url + ': ' + reason);
    }
  }
  
  // Override WebSocket
  const OriginalWebSocket = window.WebSocket;
  window.WebSocket = function(url, protocols) {
    const result = shouldBlock(url);
    if (result.blocked) {
      logBlocked('WebSocket', url, result.reason);
      throw new DOMException('WebSocket connection blocked by port scan protection', 'SecurityError');
    }
    return new OriginalWebSocket(url, protocols);
  };
  window.WebSocket.prototype = OriginalWebSocket.prototype;
  window.WebSocket.CONNECTING = OriginalWebSocket.CONNECTING;
  window.WebSocket.OPEN = OriginalWebSocket.OPEN;
  window.WebSocket.CLOSING = OriginalWebSocket.CLOSING;
  window.WebSocket.CLOSED = OriginalWebSocket.CLOSED;
  
  // Override fetch
  const originalFetch = window.fetch;
  window.fetch = function(input, init) {
    const url = typeof input === 'string' ? input : input.url;
    const result = shouldBlock(url);
    if (result.blocked) {
      logBlocked('fetch', url, result.reason);
      return Promise.reject(new TypeError('Failed to fetch: blocked by port scan protection'));
    }
    return originalFetch.call(this, input, init);
  };
  
  // Override XMLHttpRequest
  const OriginalXHR = window.XMLHttpRequest;
  const originalOpen = OriginalXHR.prototype.open;
  OriginalXHR.prototype.open = function(method, url, async, user, password) {
    const result = shouldBlock(url);
    if (result.blocked) {
      logBlocked('XMLHttpRequest', url, result.reason);
      throw new DOMException('XMLHttpRequest blocked by port scan protection', 'SecurityError');
    }
    return originalOpen.call(this, method, url, async, user, password);
  };
  
  // Override Image (can be used for port scanning)
  const OriginalImage = window.Image;
  window.Image = function(width, height) {
    const img = new OriginalImage(width, height);
    const originalSrcDescriptor = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src');
    
    Object.defineProperty(img, 'src', {
      get: function() {
        return originalSrcDescriptor.get.call(this);
      },
      set: function(value) {
        const result = shouldBlock(value);
        if (result.blocked) {
          logBlocked('Image', value, result.reason);
          // Set to empty data URL instead of throwing
          return originalSrcDescriptor.set.call(this, 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7');
        }
        return originalSrcDescriptor.set.call(this, value);
      },
      configurable: true,
      enumerable: true
    });
    
    return img;
  };
  window.Image.prototype = OriginalImage.prototype;
})();
`;
  }
  
  /**
   * Generates a minimal script that only blocks local addresses
   */
  static generateLocalAddressBlockScript(): string {
    return this.generateScript({
      enabled: true,
      blockLocalAddresses: true,
      blockSensitivePorts: false,
      logBlockedAttempts: false
    });
  }
  
  /**
   * Generates a minimal script that only blocks sensitive ports
   */
  static generateSensitivePortBlockScript(): string {
    return this.generateScript({
      enabled: true,
      blockLocalAddresses: false,
      blockSensitivePorts: true,
      logBlockedAttempts: false
    });
  }
}

export default PortScanProtectionGenerator;
