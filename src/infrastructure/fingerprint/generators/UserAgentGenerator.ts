/**
 * UserAgentGenerator
 * 
 * Generates User-Agent strings for browser fingerprint configuration.
 * Supports multiple browser versions and operating systems.
 * 
 * Requirements: 3.1-3.6
 */

import { Platform } from '../../../domain/entities/FingerprintProfile';

export interface BrowserInfo {
  name: string;
  version: string;
  majorVersion: number;
}

export interface UserAgentResult {
  userAgent: string;
  browserVersion: string;
  platform: Platform;
}

// Browser version to User-Agent mapping
interface BrowserVersionConfig {
  name: string;
  versions: {
    version: string;
    majorVersion: number;
    chromeVersion?: string;  // For Chromium-based browsers
    safariVersion?: string;  // For Safari
    firefoxVersion?: string; // For Firefox
  }[];
}

// Operating system configurations
interface OSConfig {
  platform: Platform;
  userAgentPlatform: string;
  webkitVersion: string;
}

const OS_CONFIGS: Record<Platform, OSConfig> = {
  Windows: {
    platform: 'Windows',
    userAgentPlatform: 'Windows NT 10.0; Win64; x64',
    webkitVersion: '537.36'
  },
  MacOS: {
    platform: 'MacOS',
    userAgentPlatform: 'Macintosh; Intel Mac OS X 10_15_7',
    webkitVersion: '537.36'
  },
  Linux: {
    platform: 'Linux',
    userAgentPlatform: 'X11; Linux x86_64',
    webkitVersion: '537.36'
  }
};

// Browser configurations with version mappings
const BROWSER_CONFIGS: BrowserVersionConfig[] = [
  {
    name: 'Chrome',
    versions: [
      { version: 'Chrome 120', majorVersion: 120, chromeVersion: '120.0.0.0' },
      { version: 'Chrome 119', majorVersion: 119, chromeVersion: '119.0.0.0' },
      { version: 'Chrome 118', majorVersion: 118, chromeVersion: '118.0.0.0' },
      { version: 'Chrome 117', majorVersion: 117, chromeVersion: '117.0.0.0' },
      { version: 'Chrome 116', majorVersion: 116, chromeVersion: '116.0.0.0' },
      { version: 'Chrome 115', majorVersion: 115, chromeVersion: '115.0.0.0' },
      { version: 'Chrome 114', majorVersion: 114, chromeVersion: '114.0.0.0' },
      { version: 'Chrome 113', majorVersion: 113, chromeVersion: '113.0.0.0' },
      { version: 'Chrome 112', majorVersion: 112, chromeVersion: '112.0.0.0' },
      { version: 'Chrome 111', majorVersion: 111, chromeVersion: '111.0.0.0' },
      { version: 'Chrome 110', majorVersion: 110, chromeVersion: '110.0.0.0' },
      { version: 'Chrome 109', majorVersion: 109, chromeVersion: '109.0.0.0' },
      { version: 'Chrome 108', majorVersion: 108, chromeVersion: '108.0.0.0' }
    ]
  },
  {
    name: 'Edge',
    versions: [
      { version: 'Edge 120', majorVersion: 120, chromeVersion: '120.0.0.0' },
      { version: 'Edge 119', majorVersion: 119, chromeVersion: '119.0.0.0' },
      { version: 'Edge 118', majorVersion: 118, chromeVersion: '118.0.0.0' },
      { version: 'Edge 117', majorVersion: 117, chromeVersion: '117.0.0.0' },
      { version: 'Edge 116', majorVersion: 116, chromeVersion: '116.0.0.0' }
    ]
  },
  {
    name: 'Firefox',
    versions: [
      { version: 'Firefox 121', majorVersion: 121, firefoxVersion: '121.0' },
      { version: 'Firefox 120', majorVersion: 120, firefoxVersion: '120.0' },
      { version: 'Firefox 119', majorVersion: 119, firefoxVersion: '119.0' },
      { version: 'Firefox 118', majorVersion: 118, firefoxVersion: '118.0' },
      { version: 'Firefox 117', majorVersion: 117, firefoxVersion: '117.0' },
      { version: 'Firefox 116', majorVersion: 116, firefoxVersion: '116.0' },
      { version: 'Firefox 115', majorVersion: 115, firefoxVersion: '115.0' }
    ]
  },
  {
    name: 'Safari',
    versions: [
      { version: 'Safari 17', majorVersion: 17, safariVersion: '17.2' },
      { version: 'Safari 16', majorVersion: 16, safariVersion: '16.6' },
      { version: 'Safari 15', majorVersion: 15, safariVersion: '15.6.1' }
    ]
  }
];

export class UserAgentGenerator {
  /**
   * Generates a User-Agent string for the specified browser version and platform
   * Requirements: 3.2, 3.3
   */
  static generateUserAgent(browserVersion: string, platform: Platform): string {
    const browserConfig = this.findBrowserConfig(browserVersion);
    const osConfig = OS_CONFIGS[platform];
    
    if (!browserConfig) {
      // Default to Chrome 120 if browser version not found
      return this.generateChromeUserAgent('120.0.0.0', osConfig);
    }
    
    const { browser, version } = browserConfig;
    
    switch (browser.name) {
      case 'Chrome':
        return this.generateChromeUserAgent(version.chromeVersion!, osConfig);
      case 'Edge':
        return this.generateEdgeUserAgent(version.chromeVersion!, version.majorVersion, osConfig);
      case 'Firefox':
        return this.generateFirefoxUserAgent(version.firefoxVersion!, osConfig);
      case 'Safari':
        return this.generateSafariUserAgent(version.safariVersion!, osConfig);
      default:
        return this.generateChromeUserAgent('120.0.0.0', osConfig);
    }
  }
  
  /**
   * Generates a random but valid User-Agent string
   * Requirements: 3.4
   */
  static generateRandomUserAgent(platform?: Platform): UserAgentResult {
    // Select random browser
    const browserConfig = BROWSER_CONFIGS[Math.floor(Math.random() * BROWSER_CONFIGS.length)];
    
    // Select random version from that browser
    const versionConfig = browserConfig.versions[Math.floor(Math.random() * browserConfig.versions.length)];
    
    // Select platform (use provided or random)
    let selectedPlatform = platform;
    if (!selectedPlatform) {
      const platforms: Platform[] = ['Windows', 'MacOS', 'Linux'];
      selectedPlatform = platforms[Math.floor(Math.random() * platforms.length)];
    }
    
    // Safari is only available on MacOS
    if (browserConfig.name === 'Safari' && selectedPlatform !== 'MacOS') {
      selectedPlatform = 'MacOS';
    }
    
    const userAgent = this.generateUserAgent(versionConfig.version, selectedPlatform);
    
    return {
      userAgent,
      browserVersion: versionConfig.version,
      platform: selectedPlatform
    };
  }
  
  /**
   * Updates the operating system information in an existing User-Agent string
   * Requirements: 3.3
   */
  static updatePlatform(userAgent: string, newPlatform: Platform): string {
    const osConfig = OS_CONFIGS[newPlatform];
    
    // Replace Windows platform string
    let updated = userAgent.replace(
      /Windows NT \d+\.\d+; Win64; x64/g,
      osConfig.userAgentPlatform
    );
    
    // Replace MacOS platform string
    updated = updated.replace(
      /Macintosh; Intel Mac OS X [\d_]+/g,
      osConfig.userAgentPlatform
    );
    
    // Replace Linux platform string
    updated = updated.replace(
      /X11; Linux x86_64/g,
      osConfig.userAgentPlatform
    );
    
    return updated;
  }
  
  /**
   * Validates a User-Agent string format
   * Requirements: 3.5
   */
  static validateUserAgent(userAgent: string): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (!userAgent || userAgent.trim().length === 0) {
      errors.push('User-Agent cannot be empty');
      return { valid: false, errors };
    }
    
    // Check minimum length
    if (userAgent.length < 50) {
      errors.push('User-Agent is too short (minimum 50 characters)');
    }
    
    // Check for Mozilla prefix (standard for all modern browsers)
    if (!userAgent.startsWith('Mozilla/5.0')) {
      errors.push('User-Agent should start with Mozilla/5.0');
    }
    
    // Check for platform information
    const hasPlatform = 
      userAgent.includes('Windows') || 
      userAgent.includes('Macintosh') || 
      userAgent.includes('Linux') ||
      userAgent.includes('X11');
    
    if (!hasPlatform) {
      errors.push('User-Agent should contain platform information');
    }
    
    // Check for browser identifier
    const hasBrowser = 
      userAgent.includes('Chrome') || 
      userAgent.includes('Firefox') || 
      userAgent.includes('Safari') ||
      userAgent.includes('Edge');
    
    if (!hasBrowser) {
      errors.push('User-Agent should contain browser identifier');
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }
  
  /**
   * Gets all available browser versions
   */
  static getAvailableBrowserVersions(): string[] {
    const versions: string[] = [];
    for (const browser of BROWSER_CONFIGS) {
      for (const version of browser.versions) {
        versions.push(version.version);
      }
    }
    return versions;
  }
  
  /**
   * Gets browser info from a browser version string
   */
  static getBrowserInfo(browserVersion: string): BrowserInfo | null {
    const config = this.findBrowserConfig(browserVersion);
    if (!config) return null;
    
    return {
      name: config.browser.name,
      version: config.version.version,
      majorVersion: config.version.majorVersion
    };
  }
  
  /**
   * Extracts platform from a User-Agent string
   */
  static extractPlatform(userAgent: string): Platform | null {
    if (userAgent.includes('Windows')) return 'Windows';
    if (userAgent.includes('Macintosh') || userAgent.includes('Mac OS')) return 'MacOS';
    if (userAgent.includes('Linux') || userAgent.includes('X11')) return 'Linux';
    return null;
  }
  
  /**
   * Extracts browser version from a User-Agent string
   */
  static extractBrowserVersion(userAgent: string): string | null {
    // Try Chrome
    const chromeMatch = userAgent.match(/Chrome\/(\d+)/);
    if (chromeMatch && !userAgent.includes('Edg/')) {
      return `Chrome ${chromeMatch[1]}`;
    }
    
    // Try Edge
    const edgeMatch = userAgent.match(/Edg\/(\d+)/);
    if (edgeMatch) {
      return `Edge ${edgeMatch[1]}`;
    }
    
    // Try Firefox
    const firefoxMatch = userAgent.match(/Firefox\/(\d+)/);
    if (firefoxMatch) {
      return `Firefox ${firefoxMatch[1]}`;
    }
    
    // Try Safari (must check after Chrome since Chrome also has Safari in UA)
    const safariMatch = userAgent.match(/Version\/(\d+)/);
    if (safariMatch && userAgent.includes('Safari') && !userAgent.includes('Chrome')) {
      return `Safari ${safariMatch[1]}`;
    }
    
    return null;
  }
  
  // Private helper methods
  
  private static findBrowserConfig(browserVersion: string): { browser: BrowserVersionConfig; version: typeof BROWSER_CONFIGS[0]['versions'][0] } | null {
    for (const browser of BROWSER_CONFIGS) {
      for (const version of browser.versions) {
        if (version.version === browserVersion) {
          return { browser, version };
        }
      }
    }
    return null;
  }
  
  private static generateChromeUserAgent(chromeVersion: string, osConfig: OSConfig): string {
    return `Mozilla/5.0 (${osConfig.userAgentPlatform}) AppleWebKit/${osConfig.webkitVersion} (KHTML, like Gecko) Chrome/${chromeVersion} Safari/${osConfig.webkitVersion}`;
  }
  
  private static generateEdgeUserAgent(chromeVersion: string, edgeMajorVersion: number, osConfig: OSConfig): string {
    return `Mozilla/5.0 (${osConfig.userAgentPlatform}) AppleWebKit/${osConfig.webkitVersion} (KHTML, like Gecko) Chrome/${chromeVersion} Safari/${osConfig.webkitVersion} Edg/${edgeMajorVersion}.0.0.0`;
  }
  
  private static generateFirefoxUserAgent(firefoxVersion: string, osConfig: OSConfig): string {
    // Firefox uses Gecko instead of WebKit
    return `Mozilla/5.0 (${osConfig.userAgentPlatform}; rv:${firefoxVersion}) Gecko/20100101 Firefox/${firefoxVersion}`;
  }
  
  private static generateSafariUserAgent(safariVersion: string, osConfig: OSConfig): string {
    // Safari is only on MacOS, but we'll use the provided osConfig
    const safariWebkitVersion = '605.1.15';
    return `Mozilla/5.0 (${osConfig.userAgentPlatform}) AppleWebKit/${safariWebkitVersion} (KHTML, like Gecko) Version/${safariVersion} Safari/${safariWebkitVersion}`;
  }
}

export default UserAgentGenerator;
