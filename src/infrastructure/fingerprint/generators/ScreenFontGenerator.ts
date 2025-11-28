/**
 * ScreenFontGenerator
 * 
 * Generates screen resolution and font configuration for browser fingerprint.
 * Includes screen dimensions, color depth, and font list management.
 * 
 * Requirements: 9.1-9.6
 */

import { 
  Platform, 
  ScreenConfig, 
  FontsConfig,
  ScreenMode,
  FontsMode
} from '../../../domain/entities/FingerprintProfile';

export interface ScreenResolution {
  width: number;
  height: number;
  name: string;
  aspectRatio: string;
  deviceType: 'desktop' | 'laptop' | 'tablet' | 'mobile';
}

export interface FontInfo {
  name: string;
  category: 'serif' | 'sans-serif' | 'monospace' | 'display' | 'handwriting';
  platforms: Platform[];
}

// Common screen resolutions
const SCREEN_RESOLUTIONS: ScreenResolution[] = [
  // Desktop resolutions
  { width: 1920, height: 1080, name: 'Full HD', aspectRatio: '16:9', deviceType: 'desktop' },
  { width: 2560, height: 1440, name: 'QHD', aspectRatio: '16:9', deviceType: 'desktop' },
  { width: 3840, height: 2160, name: '4K UHD', aspectRatio: '16:9', deviceType: 'desktop' },
  { width: 1920, height: 1200, name: 'WUXGA', aspectRatio: '16:10', deviceType: 'desktop' },
  { width: 2560, height: 1600, name: 'WQXGA', aspectRatio: '16:10', deviceType: 'desktop' },
  
  // Laptop resolutions
  { width: 1366, height: 768, name: 'HD', aspectRatio: '16:9', deviceType: 'laptop' },
  { width: 1440, height: 900, name: 'WXGA+', aspectRatio: '16:10', deviceType: 'laptop' },
  { width: 1536, height: 864, name: 'HD+', aspectRatio: '16:9', deviceType: 'laptop' },
  { width: 1600, height: 900, name: 'HD+', aspectRatio: '16:9', deviceType: 'laptop' },
  { width: 1680, height: 1050, name: 'WSXGA+', aspectRatio: '16:10', deviceType: 'laptop' },
  { width: 1280, height: 800, name: 'WXGA', aspectRatio: '16:10', deviceType: 'laptop' },
  { width: 1280, height: 720, name: 'HD', aspectRatio: '16:9', deviceType: 'laptop' },
  
  // MacBook resolutions
  { width: 2560, height: 1600, name: 'MacBook Pro 13"', aspectRatio: '16:10', deviceType: 'laptop' },
  { width: 2880, height: 1800, name: 'MacBook Pro 15"', aspectRatio: '16:10', deviceType: 'laptop' },
  { width: 3024, height: 1964, name: 'MacBook Pro 14"', aspectRatio: '3:2', deviceType: 'laptop' },
  { width: 3456, height: 2234, name: 'MacBook Pro 16"', aspectRatio: '3:2', deviceType: 'laptop' },
  
  // Tablet resolutions
  { width: 1024, height: 768, name: 'iPad', aspectRatio: '4:3', deviceType: 'tablet' },
  { width: 2048, height: 1536, name: 'iPad Retina', aspectRatio: '4:3', deviceType: 'tablet' },
  { width: 2732, height: 2048, name: 'iPad Pro 12.9"', aspectRatio: '4:3', deviceType: 'tablet' }
];

// Common fonts by platform
const FONTS: FontInfo[] = [
  // Windows fonts
  { name: 'Arial', category: 'sans-serif', platforms: ['Windows', 'MacOS', 'Linux'] },
  { name: 'Arial Black', category: 'sans-serif', platforms: ['Windows', 'MacOS'] },
  { name: 'Calibri', category: 'sans-serif', platforms: ['Windows'] },
  { name: 'Cambria', category: 'serif', platforms: ['Windows'] },
  { name: 'Comic Sans MS', category: 'handwriting', platforms: ['Windows', 'MacOS'] },
  { name: 'Consolas', category: 'monospace', platforms: ['Windows'] },
  { name: 'Courier New', category: 'monospace', platforms: ['Windows', 'MacOS', 'Linux'] },
  { name: 'Georgia', category: 'serif', platforms: ['Windows', 'MacOS', 'Linux'] },
  { name: 'Impact', category: 'display', platforms: ['Windows', 'MacOS'] },
  { name: 'Lucida Console', category: 'monospace', platforms: ['Windows'] },
  { name: 'Segoe UI', category: 'sans-serif', platforms: ['Windows'] },
  { name: 'Tahoma', category: 'sans-serif', platforms: ['Windows', 'MacOS'] },
  { name: 'Times New Roman', category: 'serif', platforms: ['Windows', 'MacOS', 'Linux'] },
  { name: 'Trebuchet MS', category: 'sans-serif', platforms: ['Windows', 'MacOS'] },
  { name: 'Verdana', category: 'sans-serif', platforms: ['Windows', 'MacOS', 'Linux'] },
  
  // MacOS fonts
  { name: 'Helvetica', category: 'sans-serif', platforms: ['MacOS'] },
  { name: 'Helvetica Neue', category: 'sans-serif', platforms: ['MacOS'] },
  { name: 'San Francisco', category: 'sans-serif', platforms: ['MacOS'] },
  { name: 'Menlo', category: 'monospace', platforms: ['MacOS'] },
  { name: 'Monaco', category: 'monospace', platforms: ['MacOS'] },
  { name: 'Avenir', category: 'sans-serif', platforms: ['MacOS'] },
  { name: 'Avenir Next', category: 'sans-serif', platforms: ['MacOS'] },
  { name: 'Futura', category: 'sans-serif', platforms: ['MacOS'] },
  { name: 'Optima', category: 'sans-serif', platforms: ['MacOS'] },
  { name: 'Palatino', category: 'serif', platforms: ['MacOS'] },
  
  // Linux fonts
  { name: 'DejaVu Sans', category: 'sans-serif', platforms: ['Linux'] },
  { name: 'DejaVu Serif', category: 'serif', platforms: ['Linux'] },
  { name: 'DejaVu Sans Mono', category: 'monospace', platforms: ['Linux'] },
  { name: 'Liberation Sans', category: 'sans-serif', platforms: ['Linux'] },
  { name: 'Liberation Serif', category: 'serif', platforms: ['Linux'] },
  { name: 'Liberation Mono', category: 'monospace', platforms: ['Linux'] },
  { name: 'Ubuntu', category: 'sans-serif', platforms: ['Linux'] },
  { name: 'Ubuntu Mono', category: 'monospace', platforms: ['Linux'] },
  { name: 'Noto Sans', category: 'sans-serif', platforms: ['Linux'] },
  { name: 'Noto Serif', category: 'serif', platforms: ['Linux'] },
  { name: 'Droid Sans', category: 'sans-serif', platforms: ['Linux'] },
  { name: 'Droid Serif', category: 'serif', platforms: ['Linux'] },
  { name: 'Roboto', category: 'sans-serif', platforms: ['Linux'] }
];

export class ScreenFontGenerator {
  /**
   * Gets all available screen resolutions
   */
  static getResolutions(): ScreenResolution[] {
    return [...SCREEN_RESOLUTIONS];
  }
  
  /**
   * Gets resolutions for a specific device type
   */
  static getResolutionsByDeviceType(deviceType: 'desktop' | 'laptop' | 'tablet' | 'mobile'): ScreenResolution[] {
    return SCREEN_RESOLUTIONS.filter(r => r.deviceType === deviceType);
  }
  
  /**
   * Finds a resolution by dimensions
   */
  static findResolution(width: number, height: number): ScreenResolution | null {
    return SCREEN_RESOLUTIONS.find(r => r.width === width && r.height === height) || null;
  }
  
  /**
   * Generates a random screen resolution
   */
  static generateRandomResolution(deviceType?: 'desktop' | 'laptop' | 'tablet' | 'mobile'): ScreenConfig {
    let resolutions = SCREEN_RESOLUTIONS;
    if (deviceType) {
      resolutions = this.getResolutionsByDeviceType(deviceType);
    }
    
    // Weight towards common resolutions
    const commonResolutions = resolutions.filter(r => 
      r.width === 1920 && r.height === 1080 ||
      r.width === 1366 && r.height === 768 ||
      r.width === 2560 && r.height === 1440
    );
    
    const pool = commonResolutions.length > 0 && Math.random() > 0.3 
      ? commonResolutions 
      : resolutions;
    
    const resolution = pool[Math.floor(Math.random() * pool.length)];
    
    return {
      mode: 'custom',
      width: resolution.width,
      height: resolution.height
    };
  }
  
  /**
   * Creates a screen config
   * Requirements: 9.1-9.3
   */
  static createScreenConfig(mode: ScreenMode, width?: number, height?: number): ScreenConfig {
    if (mode === 'custom' && (!width || !height)) {
      return { mode: 'custom', width: 1920, height: 1080 };
    }
    return { mode, width, height };
  }
  
  /**
   * Validates screen configuration
   */
  static validateScreenConfig(config: ScreenConfig): { valid: boolean; errors: string[]; warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    if (!['real', 'custom'].includes(config.mode)) {
      errors.push(`Invalid screen mode: ${config.mode}`);
    }
    
    if (config.mode === 'custom') {
      if (!config.width || config.width <= 0) {
        errors.push('Screen width must be positive when mode is custom');
      }
      if (!config.height || config.height <= 0) {
        errors.push('Screen height must be positive when mode is custom');
      }
      
      if (config.width && config.height) {
        if (config.width < 640 || config.height < 480) {
          warnings.push('Screen resolution is unusually small (< 640x480)');
        }
        if (config.width > 7680 || config.height > 4320) {
          warnings.push('Screen resolution is unusually large (> 8K)');
        }
      }
    }
    
    return { valid: errors.length === 0, errors, warnings };
  }
  

  /**
   * Gets all available fonts
   */
  static getFonts(): FontInfo[] {
    return [...FONTS];
  }
  
  /**
   * Gets fonts for a specific platform
   */
  static getFontsForPlatform(platform: Platform): FontInfo[] {
    return FONTS.filter(f => f.platforms.includes(platform));
  }
  
  /**
   * Gets fonts by category
   */
  static getFontsByCategory(category: FontInfo['category']): FontInfo[] {
    return FONTS.filter(f => f.category === category);
  }
  
  /**
   * Generates a random font list for a platform
   */
  static generateRandomFontList(platform: Platform, count: number = 10): string[] {
    const platformFonts = this.getFontsForPlatform(platform);
    const shuffled = [...platformFonts].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, Math.min(count, shuffled.length)).map(f => f.name);
  }
  
  /**
   * Creates a fonts config
   * Requirements: 9.4-9.6
   */
  static createFontsConfig(mode: FontsMode, list?: string[]): FontsConfig {
    if (mode === 'custom' && (!list || list.length === 0)) {
      return { mode: 'custom', list: ['Arial', 'Times New Roman', 'Courier New'] };
    }
    return { mode, list };
  }
  
  /**
   * Validates fonts configuration
   */
  static validateFontsConfig(config: FontsConfig): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (!['system', 'custom'].includes(config.mode)) {
      errors.push(`Invalid fonts mode: ${config.mode}`);
    }
    
    if (config.mode === 'custom' && (!config.list || config.list.length === 0)) {
      errors.push('Font list is required when mode is custom');
    }
    
    return { valid: errors.length === 0, errors };
  }
  
  /**
   * Generates screen override script
   * Requirements: 9.2, 9.3
   */
  static generateScreenScript(config: ScreenConfig): string {
    if (config.mode === 'real') {
      return '// Screen: Real mode (no override)';
    }
    
    const width = config.width || 1920;
    const height = config.height || 1080;
    
    return `
(function() {
  const WIDTH = ${width};
  const HEIGHT = ${height};
  
  // Override screen properties
  Object.defineProperty(screen, 'width', {
    get: function() { return WIDTH; },
    configurable: false,
    enumerable: true
  });
  
  Object.defineProperty(screen, 'height', {
    get: function() { return HEIGHT; },
    configurable: false,
    enumerable: true
  });
  
  Object.defineProperty(screen, 'availWidth', {
    get: function() { return WIDTH; },
    configurable: false,
    enumerable: true
  });
  
  Object.defineProperty(screen, 'availHeight', {
    get: function() { return HEIGHT - 40; }, // Account for taskbar
    configurable: false,
    enumerable: true
  });
  
  Object.defineProperty(screen, 'colorDepth', {
    get: function() { return 24; },
    configurable: false,
    enumerable: true
  });
  
  Object.defineProperty(screen, 'pixelDepth', {
    get: function() { return 24; },
    configurable: false,
    enumerable: true
  });
  
  // Override window dimensions
  Object.defineProperty(window, 'innerWidth', {
    get: function() { return WIDTH; },
    configurable: false,
    enumerable: true
  });
  
  Object.defineProperty(window, 'innerHeight', {
    get: function() { return HEIGHT - 100; }, // Account for browser chrome
    configurable: false,
    enumerable: true
  });
  
  Object.defineProperty(window, 'outerWidth', {
    get: function() { return WIDTH; },
    configurable: false,
    enumerable: true
  });
  
  Object.defineProperty(window, 'outerHeight', {
    get: function() { return HEIGHT; },
    configurable: false,
    enumerable: true
  });
  
  // Override devicePixelRatio
  Object.defineProperty(window, 'devicePixelRatio', {
    get: function() { return 1; },
    configurable: false,
    enumerable: true
  });
})();
`;
  }
  
  /**
   * Generates font list override script
   * Requirements: 9.5, 9.6
   */
  static generateFontsScript(config: FontsConfig): string {
    if (config.mode === 'system') {
      return '// Fonts: System mode (no override)';
    }
    
    const fontList = config.list || ['Arial', 'Times New Roman', 'Courier New'];
    
    return `
(function() {
  const FONT_LIST = ${JSON.stringify(fontList)};
  
  // Override font detection by intercepting canvas measureText
  const originalMeasureText = CanvasRenderingContext2D.prototype.measureText;
  CanvasRenderingContext2D.prototype.measureText = function(text) {
    const result = originalMeasureText.call(this, text);
    
    // Get the font family from the current font
    const fontMatch = this.font.match(/(?:^|\\s)([\\w\\s]+)(?:,|$)/);
    if (fontMatch) {
      const fontFamily = fontMatch[1].trim();
      
      // If font is not in our list, return metrics as if it's a fallback font
      if (!FONT_LIST.includes(fontFamily)) {
        // Return slightly modified metrics to simulate fallback
        return {
          width: result.width * 1.01,
          actualBoundingBoxAscent: result.actualBoundingBoxAscent,
          actualBoundingBoxDescent: result.actualBoundingBoxDescent,
          actualBoundingBoxLeft: result.actualBoundingBoxLeft,
          actualBoundingBoxRight: result.actualBoundingBoxRight,
          fontBoundingBoxAscent: result.fontBoundingBoxAscent,
          fontBoundingBoxDescent: result.fontBoundingBoxDescent
        };
      }
    }
    
    return result;
  };
  
  // Store font list for potential queries
  window.__fingerprintFonts = FONT_LIST;
})();
`;
  }
  
  /**
   * Generates combined screen and font override script
   */
  static generateCombinedScript(screen: ScreenConfig, fonts: FontsConfig): string {
    const scripts: string[] = [];
    
    if (screen.mode === 'custom') {
      scripts.push(this.generateScreenScript(screen));
    }
    
    if (fonts.mode === 'custom') {
      scripts.push(this.generateFontsScript(fonts));
    }
    
    return scripts.join('\n');
  }
  
  /**
   * Suggests a screen resolution based on platform
   */
  static suggestResolution(platform: Platform): ScreenConfig {
    switch (platform) {
      case 'Windows':
        return { mode: 'custom', width: 1920, height: 1080 };
      case 'MacOS':
        return { mode: 'custom', width: 2560, height: 1600 };
      case 'Linux':
        return { mode: 'custom', width: 1920, height: 1080 };
      default:
        return { mode: 'custom', width: 1920, height: 1080 };
    }
  }
  
  /**
   * Suggests a font list based on platform
   */
  static suggestFontList(platform: Platform): FontsConfig {
    const fonts = this.getFontsForPlatform(platform);
    return {
      mode: 'custom',
      list: fonts.slice(0, 15).map(f => f.name)
    };
  }
}

export default ScreenFontGenerator;