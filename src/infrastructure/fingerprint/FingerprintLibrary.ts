/**
 * FingerprintLibrary
 * 
 * Manages a library of real device fingerprint configurations.
 * Provides methods for loading, querying, and randomly selecting fingerprints.
 * 
 * Requirements: 20.1-20.5
 */

import * as fs from 'fs';
import * as path from 'path';
import { Platform, FingerprintProfileData } from '../../domain/entities/FingerprintProfile';

/**
 * Represents a complete device fingerprint entry in the library
 */
export interface DeviceFingerprint {
  id: string;
  name: string;
  description: string;
  
  // Browser information
  userAgent: string;
  browserVersion: string;
  platform: Platform;
  
  // WebGL configuration
  webglVendor: string;
  webglRenderer: string;
  
  // Screen configuration
  screenWidth: number;
  screenHeight: number;
  
  // Hardware configuration
  cpuCores: number;
  memory: number; // GB
  
  // Device type for categorization
  deviceType: 'desktop' | 'laptop' | 'mobile' | 'tablet';
  
  // Popularity weight (higher = more common device)
  weight: number;
  
  // Tags for filtering
  tags: string[];
}

/**
 * Filter options for querying the fingerprint library
 */
export interface FingerprintFilter {
  platform?: Platform;
  deviceType?: 'desktop' | 'laptop' | 'mobile' | 'tablet';
  browserName?: string;
  minCpuCores?: number;
  maxCpuCores?: number;
  minMemory?: number;
  maxMemory?: number;
  tags?: string[];
}

/**
 * Result of library statistics
 */
export interface LibraryStats {
  totalFingerprints: number;
  byPlatform: Record<Platform, number>;
  byDeviceType: Record<string, number>;
  byBrowser: Record<string, number>;
}

export class FingerprintLibrary {
  private fingerprints: DeviceFingerprint[] = [];
  private libraryPath: string;
  private loaded: boolean = false;
  
  constructor(libraryPath?: string) {
    this.libraryPath = libraryPath || path.join(process.cwd(), 'resources', 'fingerprint-library.json');
  }
  
  /**
   * Loads the fingerprint library from disk
   * Requirements: 20.1
   */
  async load(): Promise<void> {
    try {
      if (!fs.existsSync(this.libraryPath)) {
        console.warn(`Fingerprint library not found at ${this.libraryPath}, using built-in defaults`);
        this.fingerprints = this.getBuiltInFingerprints();
        this.loaded = true;
        return;
      }
      
      const data = fs.readFileSync(this.libraryPath, 'utf-8');
      const json = JSON.parse(data);
      
      if (Array.isArray(json.fingerprints)) {
        this.fingerprints = json.fingerprints;
      } else if (Array.isArray(json)) {
        this.fingerprints = json;
      } else {
        throw new Error('Invalid fingerprint library format');
      }
      
      this.loaded = true;
    } catch (error) {
      console.error('Error loading fingerprint library:', error);
      // Fall back to built-in fingerprints
      this.fingerprints = this.getBuiltInFingerprints();
      this.loaded = true;
    }
  }
  
  /**
   * Ensures the library is loaded before operations
   */
  private async ensureLoaded(): Promise<void> {
    if (!this.loaded) {
      await this.load();
    }
  }
  
  /**
   * Gets all fingerprints in the library
   * Requirements: 20.2
   */
  async getAll(): Promise<DeviceFingerprint[]> {
    await this.ensureLoaded();
    return [...this.fingerprints];
  }
  
  /**
   * Gets a fingerprint by ID
   */
  async getById(id: string): Promise<DeviceFingerprint | null> {
    await this.ensureLoaded();
    return this.fingerprints.find(fp => fp.id === id) || null;
  }
  
  /**
   * Queries fingerprints with filters
   * Requirements: 20.2
   */
  async query(filter: FingerprintFilter): Promise<DeviceFingerprint[]> {
    await this.ensureLoaded();
    
    return this.fingerprints.filter(fp => {
      // Platform filter
      if (filter.platform && fp.platform !== filter.platform) {
        return false;
      }
      
      // Device type filter
      if (filter.deviceType && fp.deviceType !== filter.deviceType) {
        return false;
      }
      
      // Browser name filter
      if (filter.browserName && !fp.browserVersion.toLowerCase().includes(filter.browserName.toLowerCase())) {
        return false;
      }
      
      // CPU cores filter
      if (filter.minCpuCores !== undefined && fp.cpuCores < filter.minCpuCores) {
        return false;
      }
      if (filter.maxCpuCores !== undefined && fp.cpuCores > filter.maxCpuCores) {
        return false;
      }
      
      // Memory filter
      if (filter.minMemory !== undefined && fp.memory < filter.minMemory) {
        return false;
      }
      if (filter.maxMemory !== undefined && fp.memory > filter.maxMemory) {
        return false;
      }
      
      // Tags filter
      if (filter.tags && filter.tags.length > 0) {
        const hasAllTags = filter.tags.every(tag => fp.tags.includes(tag));
        if (!hasAllTags) {
          return false;
        }
      }
      
      return true;
    });
  }
  
  /**
   * Selects a random fingerprint from the library
   * Uses weighted random selection based on device popularity
   * Requirements: 20.3
   */
  async selectRandom(filter?: FingerprintFilter): Promise<DeviceFingerprint | null> {
    await this.ensureLoaded();
    
    let candidates = filter ? await this.query(filter) : this.fingerprints;
    
    if (candidates.length === 0) {
      return null;
    }
    
    // Weighted random selection
    const totalWeight = candidates.reduce((sum, fp) => sum + fp.weight, 0);
    let random = Math.random() * totalWeight;
    
    for (const fp of candidates) {
      random -= fp.weight;
      if (random <= 0) {
        return fp;
      }
    }
    
    // Fallback to last candidate
    return candidates[candidates.length - 1];
  }
  
  /**
   * Selects multiple random fingerprints (without duplicates)
   */
  async selectRandomMultiple(count: number, filter?: FingerprintFilter): Promise<DeviceFingerprint[]> {
    await this.ensureLoaded();
    
    let candidates = filter ? await this.query(filter) : [...this.fingerprints];
    const results: DeviceFingerprint[] = [];
    
    const actualCount = Math.min(count, candidates.length);
    
    for (let i = 0; i < actualCount; i++) {
      const totalWeight = candidates.reduce((sum, fp) => sum + fp.weight, 0);
      let random = Math.random() * totalWeight;
      
      for (let j = 0; j < candidates.length; j++) {
        random -= candidates[j].weight;
        if (random <= 0) {
          results.push(candidates[j]);
          candidates.splice(j, 1);
          break;
        }
      }
    }
    
    return results;
  }
  
  /**
   * Converts a DeviceFingerprint to FingerprintProfileData
   * Requirements: 20.2
   */
  toProfileData(fingerprint: DeviceFingerprint): Partial<FingerprintProfileData> {
    return {
      userAgent: fingerprint.userAgent,
      browserVersion: fingerprint.browserVersion,
      platform: fingerprint.platform,
      webgl: {
        vendor: fingerprint.webglVendor,
        renderer: fingerprint.webglRenderer,
        mode: 'custom'
      },
      screen: {
        mode: 'custom',
        width: fingerprint.screenWidth,
        height: fingerprint.screenHeight
      },
      hardware: {
        cpuCores: fingerprint.cpuCores,
        memory: fingerprint.memory
      },
      canvas: {
        mode: 'random',
        noiseLevel: 2
      },
      audio: {
        mode: 'random',
        noiseLevel: 2
      },
      webrtc: {
        mode: 'disabled'
      },
      timezone: {
        mode: 'ip-based'
      },
      geolocation: {
        mode: 'ip-based'
      },
      language: {
        mode: 'ip-based'
      },
      doNotTrack: null,
      battery: {
        mode: 'privacy'
      },
      fonts: {
        mode: 'system'
      },
      plugins: {
        mode: 'real'
      },
      mediaDevices: {
        mode: 'real'
      }
    };
  }
  
  /**
   * Gets library statistics
   */
  async getStats(): Promise<LibraryStats> {
    await this.ensureLoaded();
    
    const stats: LibraryStats = {
      totalFingerprints: this.fingerprints.length,
      byPlatform: { Windows: 0, MacOS: 0, Linux: 0 },
      byDeviceType: {},
      byBrowser: {}
    };
    
    for (const fp of this.fingerprints) {
      // Count by platform
      stats.byPlatform[fp.platform]++;
      
      // Count by device type
      stats.byDeviceType[fp.deviceType] = (stats.byDeviceType[fp.deviceType] || 0) + 1;
      
      // Count by browser
      const browserName = fp.browserVersion.split(' ')[0];
      stats.byBrowser[browserName] = (stats.byBrowser[browserName] || 0) + 1;
    }
    
    return stats;
  }
  
  /**
   * Validates a fingerprint entry
   * Requirements: 20.4
   */
  validateFingerprint(fingerprint: DeviceFingerprint): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (!fingerprint.id) {
      errors.push('Fingerprint ID is required');
    }
    
    if (!fingerprint.userAgent || fingerprint.userAgent.length < 50) {
      errors.push('User-Agent is required and must be at least 50 characters');
    }
    
    if (!fingerprint.browserVersion) {
      errors.push('Browser version is required');
    }
    
    if (!['Windows', 'MacOS', 'Linux'].includes(fingerprint.platform)) {
      errors.push('Platform must be Windows, MacOS, or Linux');
    }
    
    if (!fingerprint.webglVendor) {
      errors.push('WebGL vendor is required');
    }
    
    if (!fingerprint.webglRenderer) {
      errors.push('WebGL renderer is required');
    }
    
    if (fingerprint.screenWidth <= 0 || fingerprint.screenHeight <= 0) {
      errors.push('Screen dimensions must be positive');
    }
    
    if (fingerprint.cpuCores <= 0 || fingerprint.cpuCores > 128) {
      errors.push('CPU cores must be between 1 and 128');
    }
    
    if (fingerprint.memory <= 0 || fingerprint.memory > 256) {
      errors.push('Memory must be between 1 and 256 GB');
    }
    
    // Validate platform consistency
    if (fingerprint.platform === 'Windows' && fingerprint.userAgent.includes('Macintosh')) {
      errors.push('Platform is Windows but User-Agent indicates MacOS');
    }
    
    if (fingerprint.platform === 'MacOS' && fingerprint.userAgent.includes('Windows NT')) {
      errors.push('Platform is MacOS but User-Agent indicates Windows');
    }
    
    // Validate WebGL consistency with platform
    if (fingerprint.platform === 'Windows' && fingerprint.webglVendor.includes('Apple Inc.') && fingerprint.webglRenderer.includes('Apple M')) {
      errors.push('Apple Silicon GPUs are not compatible with Windows');
    }
    
    if (fingerprint.platform === 'MacOS' && fingerprint.webglRenderer.includes('Direct3D')) {
      errors.push('Direct3D renderers are not compatible with MacOS');
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }
  
  /**
   * Adds a fingerprint to the library (in memory)
   */
  addFingerprint(fingerprint: DeviceFingerprint): void {
    const validation = this.validateFingerprint(fingerprint);
    if (!validation.valid) {
      throw new Error(`Invalid fingerprint: ${validation.errors.join(', ')}`);
    }
    
    this.fingerprints.push(fingerprint);
  }
  
  /**
   * Saves the library to disk
   * Requirements: 20.5
   */
  async save(): Promise<void> {
    const dir = path.dirname(this.libraryPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    const data = JSON.stringify({ fingerprints: this.fingerprints }, null, 2);
    fs.writeFileSync(this.libraryPath, data, 'utf-8');
  }
  
  /**
   * Gets built-in fingerprints as fallback
   * These are used when the library file is not found
   */
  private getBuiltInFingerprints(): DeviceFingerprint[] {
    return BUILT_IN_FINGERPRINTS;
  }
}

// Built-in fingerprints (subset of the full library)
const BUILT_IN_FINGERPRINTS: DeviceFingerprint[] = [
  // Windows Chrome devices
  {
    id: 'win-chrome-120-gtx1060',
    name: 'Windows Chrome 120 - GTX 1060',
    description: 'Common Windows gaming laptop with GTX 1060',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    browserVersion: 'Chrome 120',
    platform: 'Windows',
    webglVendor: 'Google Inc. (NVIDIA)',
    webglRenderer: 'ANGLE (NVIDIA GeForce GTX 1060 Direct3D11 vs_5_0 ps_5_0)',
    screenWidth: 1920,
    screenHeight: 1080,
    cpuCores: 8,
    memory: 16,
    deviceType: 'laptop',
    weight: 10,
    tags: ['gaming', 'nvidia', 'popular']
  },
  {
    id: 'win-chrome-120-rtx3060',
    name: 'Windows Chrome 120 - RTX 3060',
    description: 'Modern Windows gaming PC with RTX 3060',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    browserVersion: 'Chrome 120',
    platform: 'Windows',
    webglVendor: 'Google Inc. (NVIDIA)',
    webglRenderer: 'ANGLE (NVIDIA GeForce RTX 3060 Direct3D11 vs_5_0 ps_5_0)',
    screenWidth: 2560,
    screenHeight: 1440,
    cpuCores: 12,
    memory: 32,
    deviceType: 'desktop',
    weight: 8,
    tags: ['gaming', 'nvidia', 'high-end']
  },
  {
    id: 'win-chrome-120-intel-uhd',
    name: 'Windows Chrome 120 - Intel UHD',
    description: 'Standard Windows office laptop with Intel UHD',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    browserVersion: 'Chrome 120',
    platform: 'Windows',
    webglVendor: 'Google Inc. (Intel)',
    webglRenderer: 'ANGLE (Intel(R) UHD Graphics 620 Direct3D11 vs_5_0 ps_5_0)',
    screenWidth: 1920,
    screenHeight: 1080,
    cpuCores: 4,
    memory: 8,
    deviceType: 'laptop',
    weight: 15,
    tags: ['office', 'intel', 'popular', 'budget']
  },
  {
    id: 'win-chrome-119-iris-xe',
    name: 'Windows Chrome 119 - Iris Xe',
    description: 'Modern Windows ultrabook with Intel Iris Xe',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
    browserVersion: 'Chrome 119',
    platform: 'Windows',
    webglVendor: 'Google Inc. (Intel)',
    webglRenderer: 'ANGLE (Intel(R) Iris(R) Xe Graphics Direct3D11 vs_5_0 ps_5_0)',
    screenWidth: 1920,
    screenHeight: 1200,
    cpuCores: 8,
    memory: 16,
    deviceType: 'laptop',
    weight: 12,
    tags: ['ultrabook', 'intel', 'modern']
  },
  {
    id: 'win-edge-120-rtx2070',
    name: 'Windows Edge 120 - RTX 2070',
    description: 'Windows workstation with Edge browser',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0',
    browserVersion: 'Edge 120',
    platform: 'Windows',
    webglVendor: 'Google Inc. (NVIDIA)',
    webglRenderer: 'ANGLE (NVIDIA GeForce RTX 2070 Direct3D11 vs_5_0 ps_5_0)',
    screenWidth: 2560,
    screenHeight: 1440,
    cpuCores: 8,
    memory: 32,
    deviceType: 'desktop',
    weight: 6,
    tags: ['workstation', 'nvidia', 'edge']
  },
  {
    id: 'win-firefox-120-rx580',
    name: 'Windows Firefox 120 - RX 580',
    description: 'Windows gaming PC with AMD GPU and Firefox',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:120.0) Gecko/20100101 Firefox/120.0',
    browserVersion: 'Firefox 120',
    platform: 'Windows',
    webglVendor: 'Google Inc. (AMD)',
    webglRenderer: 'ANGLE (AMD Radeon RX 580 Direct3D11 vs_5_0 ps_5_0)',
    screenWidth: 1920,
    screenHeight: 1080,
    cpuCores: 6,
    memory: 16,
    deviceType: 'desktop',
    weight: 5,
    tags: ['gaming', 'amd', 'firefox']
  },
  
  // MacOS devices
  {
    id: 'mac-chrome-120-m1',
    name: 'MacOS Chrome 120 - M1',
    description: 'MacBook Air M1 with Chrome',
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    browserVersion: 'Chrome 120',
    platform: 'MacOS',
    webglVendor: 'Apple Inc.',
    webglRenderer: 'Apple M1',
    screenWidth: 2560,
    screenHeight: 1600,
    cpuCores: 8,
    memory: 8,
    deviceType: 'laptop',
    weight: 12,
    tags: ['apple', 'silicon', 'popular']
  },
  {
    id: 'mac-chrome-120-m2',
    name: 'MacOS Chrome 120 - M2',
    description: 'MacBook Air M2 with Chrome',
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    browserVersion: 'Chrome 120',
    platform: 'MacOS',
    webglVendor: 'Apple Inc.',
    webglRenderer: 'Apple M2',
    screenWidth: 2560,
    screenHeight: 1664,
    cpuCores: 8,
    memory: 16,
    deviceType: 'laptop',
    weight: 10,
    tags: ['apple', 'silicon', 'modern']
  },
  {
    id: 'mac-chrome-120-m2-pro',
    name: 'MacOS Chrome 120 - M2 Pro',
    description: 'MacBook Pro 14" M2 Pro with Chrome',
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    browserVersion: 'Chrome 120',
    platform: 'MacOS',
    webglVendor: 'Apple Inc.',
    webglRenderer: 'Apple M2 Pro',
    screenWidth: 3024,
    screenHeight: 1964,
    cpuCores: 12,
    memory: 32,
    deviceType: 'laptop',
    weight: 8,
    tags: ['apple', 'silicon', 'pro', 'high-end']
  },
  {
    id: 'mac-safari-17-m1',
    name: 'MacOS Safari 17 - M1',
    description: 'MacBook with Safari browser',
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
    browserVersion: 'Safari 17',
    platform: 'MacOS',
    webglVendor: 'Apple Inc.',
    webglRenderer: 'Apple M1',
    screenWidth: 2560,
    screenHeight: 1600,
    cpuCores: 8,
    memory: 16,
    deviceType: 'laptop',
    weight: 8,
    tags: ['apple', 'safari', 'native']
  },
  {
    id: 'mac-chrome-119-intel',
    name: 'MacOS Chrome 119 - Intel',
    description: 'Older Intel MacBook Pro',
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
    browserVersion: 'Chrome 119',
    platform: 'MacOS',
    webglVendor: 'Intel Inc.',
    webglRenderer: 'Intel(R) UHD Graphics 630',
    screenWidth: 2880,
    screenHeight: 1800,
    cpuCores: 6,
    memory: 16,
    deviceType: 'laptop',
    weight: 6,
    tags: ['apple', 'intel', 'legacy']
  },
  
  // Linux devices
  {
    id: 'linux-chrome-120-nvidia',
    name: 'Linux Chrome 120 - NVIDIA',
    description: 'Linux workstation with NVIDIA GPU',
    userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    browserVersion: 'Chrome 120',
    platform: 'Linux',
    webglVendor: 'NVIDIA Corporation',
    webglRenderer: 'NVIDIA GeForce GTX 1060/PCIe/SSE2',
    screenWidth: 1920,
    screenHeight: 1080,
    cpuCores: 8,
    memory: 16,
    deviceType: 'desktop',
    weight: 5,
    tags: ['linux', 'nvidia', 'developer']
  },
  {
    id: 'linux-chrome-120-intel',
    name: 'Linux Chrome 120 - Intel Mesa',
    description: 'Linux laptop with Intel integrated graphics',
    userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    browserVersion: 'Chrome 120',
    platform: 'Linux',
    webglVendor: 'Intel',
    webglRenderer: 'Mesa Intel(R) UHD Graphics 620 (KBL GT2)',
    screenWidth: 1920,
    screenHeight: 1080,
    cpuCores: 4,
    memory: 8,
    deviceType: 'laptop',
    weight: 4,
    tags: ['linux', 'intel', 'developer']
  },
  {
    id: 'linux-firefox-120-amd',
    name: 'Linux Firefox 120 - AMD',
    description: 'Linux desktop with AMD GPU and Firefox',
    userAgent: 'Mozilla/5.0 (X11; Linux x86_64; rv:120.0) Gecko/20100101 Firefox/120.0',
    browserVersion: 'Firefox 120',
    platform: 'Linux',
    webglVendor: 'AMD',
    webglRenderer: 'AMD Radeon RX 580 (polaris10, LLVM 15.0.7, DRM 3.49, 6.1.0-18-amd64)',
    screenWidth: 2560,
    screenHeight: 1440,
    cpuCores: 8,
    memory: 32,
    deviceType: 'desktop',
    weight: 3,
    tags: ['linux', 'amd', 'firefox', 'developer']
  }
];

export default FingerprintLibrary;
