/**
 * DeviceInfoGenerator
 * 
 * Generates device information for browser fingerprint configuration.
 * Includes CPU cores, memory size, device name, and MAC address generation.
 * 
 * Requirements: 8.1-8.8
 */

import { Platform, HardwareConfig } from '../../../domain/entities/FingerprintProfile';

export interface DeviceNameConfig {
  mode: 'real' | 'custom';
  value?: string;
}

export interface MACAddressConfig {
  mode: 'real' | 'custom';
  value?: string;
}

export interface BluetoothConfig {
  enabled: boolean;
}

export interface DeviceInfoResult {
  hardware: HardwareConfig;
  deviceName: DeviceNameConfig;
  macAddress: MACAddressConfig;
  bluetooth: BluetoothConfig;
}

// Common CPU core counts for different device types
const CPU_CORE_OPTIONS = [2, 4, 6, 8, 12, 16, 24, 32];

// Common memory sizes in GB
const MEMORY_OPTIONS = [4, 8, 16, 32, 64];

// Device name prefixes by platform
const DEVICE_NAME_PREFIXES: Record<Platform, string[]> = {
  Windows: ['DESKTOP', 'LAPTOP', 'PC', 'WORKSTATION'],
  MacOS: ['MacBook', 'iMac', 'Mac-Pro', 'Mac-mini'],
  Linux: ['linux', 'ubuntu', 'fedora', 'debian', 'arch']
};

// Common device name patterns
const WINDOWS_DEVICE_PATTERNS = [
  'DESKTOP-{RANDOM}',
  'LAPTOP-{RANDOM}',
  'PC-{RANDOM}',
  '{USER}-PC',
  'WORKSTATION-{RANDOM}'
];

const MACOS_DEVICE_PATTERNS = [
  "{USER}'s MacBook Pro",
  "{USER}'s MacBook Air",
  "{USER}'s iMac",
  "{USER}'s Mac mini",
  "MacBook-Pro-{RANDOM}"
];

const LINUX_DEVICE_PATTERNS = [
  '{USER}-desktop',
  '{USER}-laptop',
  'linux-{RANDOM}',
  'ubuntu-{RANDOM}',
  'workstation-{RANDOM}'
];

// MAC address vendor prefixes (OUI) for common manufacturers
const MAC_VENDOR_PREFIXES = [
  '00:1A:2B', // Generic
  '00:50:56', // VMware
  '08:00:27', // VirtualBox
  '00:0C:29', // VMware
  '00:15:5D', // Microsoft Hyper-V
  '00:1C:42', // Parallels
  '00:16:3E', // Xen
  'AC:DE:48', // Private
  'B4:2E:99', // Giga-Byte
  '00:1E:68', // Quanta
  '00:23:AE', // Dell
  '00:25:64', // Dell
  '3C:D9:2B', // HP
  '00:21:5A', // HP
  '00:1F:16', // Wistron
  '00:26:B9', // Dell
  '00:1D:09', // Dell
  '00:22:19', // Dell
  '00:24:E8', // Dell
  '00:25:B3', // HP
  '00:26:55', // HP
  '00:1E:4F', // Dell
  '00:1A:A0', // Dell
  '00:1C:23', // Dell
  '00:21:70', // Dell
  '00:22:64', // HP
  '00:23:7D', // HP
  '00:24:81', // HP
  '00:25:B3', // HP
  '00:26:55', // HP
  'F0:4D:A2', // Dell
  '14:FE:B5', // Dell
  '18:A9:05', // HP
  '1C:C1:DE', // HP
  '2C:44:FD', // HP
  '30:8D:99', // HP
  '34:64:A9', // HP
  '38:63:BB', // HP
  '3C:4A:92', // HP
  '40:B0:34', // HP
  '44:1E:A1', // HP
  '48:0F:CF', // HP
  '4C:39:09', // HP
  '50:65:F3', // HP
  '54:EE:75', // HP
  '58:20:B1', // HP
  '5C:B9:01', // HP
  '60:45:BD', // HP
  '64:51:06', // HP
  '68:B5:99', // HP
  '6C:C2:17', // HP
  '70:5A:0F', // HP
  '74:46:A0', // HP
  '78:AC:C0', // HP
  '7C:D3:0A', // HP
  '80:C1:6E', // HP
  '84:34:97', // HP
  '88:51:FB', // HP
  '8C:DC:D4', // HP
  '90:B1:1C', // Dell
  '94:57:A5', // Dell
  '98:90:96', // Dell
  '9C:B6:54', // Dell
  'A0:36:9F', // Intel
  'A4:4C:C8', // Dell
  'A8:A1:59', // Dell
  'AC:16:2D', // HP
  'B0:5A:DA', // HP
  'B4:99:BA', // HP
  'B8:AC:6F', // Dell
  'BC:30:5B', // Dell
  'C0:3F:D5', // Intel
  'C4:34:6B', // HP
  'C8:1F:66', // HP
  'CC:3D:82', // HP
  'D0:67:E5', // Dell
  'D4:81:D7', // Dell
  'D8:9E:F3', // Dell
  'DC:4A:3E', // HP
  'E0:07:1B', // HP
  'E4:11:5B', // HP
  'E8:39:35', // HP
  'EC:B1:D7', // HP
  'F0:1F:AF', // Dell
  'F4:8E:38', // Dell
  'F8:BC:12', // Dell
  'FC:15:B4'  // HP
];

export class DeviceInfoGenerator {
  /**
   * Generates a random CPU core count
   * Requirements: 8.5
   */
  static generateCPUCores(platform?: Platform): number {
    // Weight towards common values (4, 8, 16)
    const weights = [0.05, 0.25, 0.15, 0.30, 0.10, 0.10, 0.03, 0.02];
    const random = Math.random();
    let cumulative = 0;
    
    for (let i = 0; i < weights.length; i++) {
      cumulative += weights[i];
      if (random < cumulative) {
        return CPU_CORE_OPTIONS[i];
      }
    }
    
    return 8; // Default fallback
  }
  
  /**
   * Generates a random memory size in GB
   * Requirements: 8.6
   */
  static generateMemorySize(cpuCores?: number): number {
    // Memory should be reasonable for the CPU core count
    if (cpuCores !== undefined) {
      if (cpuCores <= 2) {
        // Low-end: 4-8 GB
        return Math.random() > 0.5 ? 4 : 8;
      } else if (cpuCores <= 4) {
        // Mid-range: 8-16 GB
        return Math.random() > 0.5 ? 8 : 16;
      } else if (cpuCores <= 8) {
        // High-end: 16-32 GB
        return Math.random() > 0.5 ? 16 : 32;
      } else {
        // Workstation: 32-64 GB
        return Math.random() > 0.5 ? 32 : 64;
      }
    }
    
    // Weight towards common values (8, 16)
    const weights = [0.10, 0.35, 0.35, 0.15, 0.05];
    const random = Math.random();
    let cumulative = 0;
    
    for (let i = 0; i < weights.length; i++) {
      cumulative += weights[i];
      if (random < cumulative) {
        return MEMORY_OPTIONS[i];
      }
    }
    
    return 16; // Default fallback
  }
  
  /**
   * Generates a random device name based on platform
   * Requirements: 8.1, 8.2
   */
  static generateDeviceName(platform: Platform, username?: string): string {
    const user = username || this.generateRandomUsername();
    const randomSuffix = this.generateRandomSuffix();
    
    let patterns: string[];
    switch (platform) {
      case 'Windows':
        patterns = WINDOWS_DEVICE_PATTERNS;
        break;
      case 'MacOS':
        patterns = MACOS_DEVICE_PATTERNS;
        break;
      case 'Linux':
        patterns = LINUX_DEVICE_PATTERNS;
        break;
      default:
        patterns = WINDOWS_DEVICE_PATTERNS;
    }
    
    const pattern = patterns[Math.floor(Math.random() * patterns.length)];
    return pattern
      .replace('{USER}', user)
      .replace('{RANDOM}', randomSuffix);
  }
  
  /**
   * Generates a random MAC address
   * Requirements: 8.3, 8.4
   */
  static generateMACAddress(): string {
    // Select a random vendor prefix
    const vendorPrefix = MAC_VENDOR_PREFIXES[Math.floor(Math.random() * MAC_VENDOR_PREFIXES.length)];
    
    // Generate random device-specific bytes
    const deviceBytes = [
      this.generateRandomHexByte(),
      this.generateRandomHexByte(),
      this.generateRandomHexByte()
    ];
    
    return `${vendorPrefix}:${deviceBytes.join(':')}`;
  }
  
  /**
   * Validates a MAC address format
   */
  static validateMACAddress(mac: string): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (!mac || mac.trim().length === 0) {
      errors.push('MAC address cannot be empty');
      return { valid: false, errors };
    }
    
    // Check format: XX:XX:XX:XX:XX:XX or XX-XX-XX-XX-XX-XX
    const macRegex = /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/;
    if (!macRegex.test(mac)) {
      errors.push('MAC address must be in format XX:XX:XX:XX:XX:XX or XX-XX-XX-XX-XX-XX');
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }
  
  /**
   * Generates a complete random device info configuration
   */
  static generateRandom(platform: Platform): DeviceInfoResult {
    const cpuCores = this.generateCPUCores(platform);
    const memory = this.generateMemorySize(cpuCores);
    const deviceName = this.generateDeviceName(platform);
    const macAddress = this.generateMACAddress();
    
    return {
      hardware: {
        cpuCores,
        memory,
        deviceName,
        macAddress
      },
      deviceName: {
        mode: 'custom',
        value: deviceName
      },
      macAddress: {
        mode: 'custom',
        value: macAddress
      },
      bluetooth: {
        enabled: Math.random() > 0.3 // 70% chance of having Bluetooth
      }
    };
  }
  
  /**
   * Creates a HardwareConfig with specified values
   */
  static createHardwareConfig(
    cpuCores: number,
    memory: number,
    deviceName?: string,
    macAddress?: string
  ): HardwareConfig {
    return {
      cpuCores,
      memory,
      deviceName,
      macAddress
    };
  }
  
  /**
   * Validates hardware configuration
   */
  static validateHardwareConfig(config: HardwareConfig): { valid: boolean; errors: string[]; warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    // Validate CPU cores
    if (config.cpuCores <= 0) {
      errors.push('CPU cores must be positive');
    }
    if (config.cpuCores > 128) {
      warnings.push('CPU cores is unusually high (> 128)');
    }
    if (!Number.isInteger(config.cpuCores)) {
      errors.push('CPU cores must be an integer');
    }
    
    // Validate memory
    if (config.memory <= 0) {
      errors.push('Memory must be positive');
    }
    if (config.memory > 256) {
      warnings.push('Memory is unusually high (> 256 GB)');
    }
    
    // Validate CPU and memory consistency
    if (config.cpuCores > 16 && config.memory < 8) {
      warnings.push('High CPU cores (> 16) with low memory (< 8 GB) is unusual');
    }
    if (config.cpuCores <= 2 && config.memory > 32) {
      warnings.push('Low CPU cores (<= 2) with high memory (> 32 GB) is unusual');
    }
    
    // Validate MAC address if provided
    if (config.macAddress) {
      const macValidation = this.validateMACAddress(config.macAddress);
      if (!macValidation.valid) {
        errors.push(...macValidation.errors);
      }
    }
    
    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }
  
  /**
   * Gets available CPU core options
   */
  static getAvailableCPUCores(): number[] {
    return [...CPU_CORE_OPTIONS];
  }
  
  /**
   * Gets available memory options
   */
  static getAvailableMemoryOptions(): number[] {
    return [...MEMORY_OPTIONS];
  }
  
  /**
   * Suggests reasonable hardware config based on platform
   */
  static suggestHardwareConfig(platform: Platform): HardwareConfig {
    switch (platform) {
      case 'Windows':
        // Typical Windows desktop/laptop
        return {
          cpuCores: 8,
          memory: 16,
          deviceName: this.generateDeviceName('Windows'),
          macAddress: this.generateMACAddress()
        };
      case 'MacOS':
        // Typical Mac
        return {
          cpuCores: 8,
          memory: 16,
          deviceName: this.generateDeviceName('MacOS'),
          macAddress: this.generateMACAddress()
        };
      case 'Linux':
        // Typical Linux workstation
        return {
          cpuCores: 8,
          memory: 16,
          deviceName: this.generateDeviceName('Linux'),
          macAddress: this.generateMACAddress()
        };
      default:
        return {
          cpuCores: 8,
          memory: 16
        };
    }
  }
  
  /**
   * Generates CPU cores override script
   * Requirements: 8.5
   */
  static generateCPUCoresScript(cpuCores: number): string {
    return `
(function() {
  // Override navigator.hardwareConcurrency
  Object.defineProperty(navigator, 'hardwareConcurrency', {
    get: function() { return ${cpuCores}; },
    configurable: false,
    enumerable: true
  });
})();
`;
  }
  
  /**
   * Generates memory size override script
   * Requirements: 8.6
   */
  static generateMemoryScript(memoryGB: number): string {
    return `
(function() {
  // Override navigator.deviceMemory
  Object.defineProperty(navigator, 'deviceMemory', {
    get: function() { return ${memoryGB}; },
    configurable: false,
    enumerable: true
  });
})();
`;
  }
  
  /**
   * Generates Bluetooth override script
   * Requirements: 8.7, 8.8
   */
  static generateBluetoothScript(enabled: boolean): string {
    if (enabled) {
      return '// Bluetooth enabled - using real navigator.bluetooth';
    }
    
    return `
(function() {
  // Disable navigator.bluetooth
  Object.defineProperty(navigator, 'bluetooth', {
    get: function() { return undefined; },
    configurable: false,
    enumerable: true
  });
})();
`;
  }
  
  /**
   * Generates combined device info override script
   */
  static generateCombinedScript(config: HardwareConfig, bluetoothEnabled: boolean = true): string {
    const scripts: string[] = [];
    
    scripts.push(this.generateCPUCoresScript(config.cpuCores));
    scripts.push(this.generateMemoryScript(config.memory));
    scripts.push(this.generateBluetoothScript(bluetoothEnabled));
    
    return scripts.join('\n');
  }
  
  // Private helper methods
  
  private static generateRandomUsername(): string {
    const adjectives = ['Happy', 'Lucky', 'Cool', 'Smart', 'Fast', 'Bright', 'Swift', 'Bold'];
    const nouns = ['User', 'Dev', 'Admin', 'Guest', 'Owner', 'Pro', 'Master', 'Chief'];
    
    const adjective = adjectives[Math.floor(Math.random() * adjectives.length)];
    const noun = nouns[Math.floor(Math.random() * nouns.length)];
    
    return `${adjective}${noun}`;
  }
  
  private static generateRandomSuffix(): string {
    // Generate a random alphanumeric suffix like "FZ3DGZ7"
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let suffix = '';
    for (let i = 0; i < 7; i++) {
      suffix += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return suffix;
  }
  
  private static generateRandomHexByte(): string {
    const byte = Math.floor(Math.random() * 256);
    return byte.toString(16).padStart(2, '0').toUpperCase();
  }
}

export default DeviceInfoGenerator;
