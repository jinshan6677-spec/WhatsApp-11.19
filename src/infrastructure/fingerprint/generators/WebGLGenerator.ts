/**
 * WebGLGenerator
 * 
 * Generates WebGL fingerprint configurations including vendor and renderer strings.
 * Supports multiple GPU vendors and ensures consistency with operating systems.
 * 
 * Requirements: 4.1-4.6
 */

import { Platform, WebGLConfig, WebGLMode } from '../../../domain/entities/FingerprintProfile';

export interface WebGLPreset {
  vendor: string;
  renderer: string;
  compatiblePlatforms: Platform[];
  gpuType: 'integrated' | 'discrete' | 'mobile';
}

// Comprehensive WebGL presets library with real device configurations
const WEBGL_PRESETS: WebGLPreset[] = [
  // NVIDIA GPUs (Windows/Linux)
  {
    vendor: 'Google Inc. (NVIDIA)',
    renderer: 'ANGLE (NVIDIA GeForce GTX 1060 Direct3D11 vs_5_0 ps_5_0)',
    compatiblePlatforms: ['Windows'],
    gpuType: 'discrete'
  },
  {
    vendor: 'Google Inc. (NVIDIA)',
    renderer: 'ANGLE (NVIDIA GeForce GTX 1070 Direct3D11 vs_5_0 ps_5_0)',
    compatiblePlatforms: ['Windows'],
    gpuType: 'discrete'
  },
  {
    vendor: 'Google Inc. (NVIDIA)',
    renderer: 'ANGLE (NVIDIA GeForce GTX 1080 Direct3D11 vs_5_0 ps_5_0)',
    compatiblePlatforms: ['Windows'],
    gpuType: 'discrete'
  },
  {
    vendor: 'Google Inc. (NVIDIA)',
    renderer: 'ANGLE (NVIDIA GeForce RTX 2060 Direct3D11 vs_5_0 ps_5_0)',
    compatiblePlatforms: ['Windows'],
    gpuType: 'discrete'
  },
  {
    vendor: 'Google Inc. (NVIDIA)',
    renderer: 'ANGLE (NVIDIA GeForce RTX 2070 Direct3D11 vs_5_0 ps_5_0)',
    compatiblePlatforms: ['Windows'],
    gpuType: 'discrete'
  },
  {
    vendor: 'Google Inc. (NVIDIA)',
    renderer: 'ANGLE (NVIDIA GeForce RTX 2080 Direct3D11 vs_5_0 ps_5_0)',
    compatiblePlatforms: ['Windows'],
    gpuType: 'discrete'
  },
  {
    vendor: 'Google Inc. (NVIDIA)',
    renderer: 'ANGLE (NVIDIA GeForce RTX 3060 Direct3D11 vs_5_0 ps_5_0)',
    compatiblePlatforms: ['Windows'],
    gpuType: 'discrete'
  },
  {
    vendor: 'Google Inc. (NVIDIA)',
    renderer: 'ANGLE (NVIDIA GeForce RTX 3070 Direct3D11 vs_5_0 ps_5_0)',
    compatiblePlatforms: ['Windows'],
    gpuType: 'discrete'
  },
  {
    vendor: 'Google Inc. (NVIDIA)',
    renderer: 'ANGLE (NVIDIA GeForce RTX 3080 Direct3D11 vs_5_0 ps_5_0)',
    compatiblePlatforms: ['Windows'],
    gpuType: 'discrete'
  },
  {
    vendor: 'Google Inc. (NVIDIA)',
    renderer: 'ANGLE (NVIDIA GeForce RTX 4060 Direct3D11 vs_5_0 ps_5_0)',
    compatiblePlatforms: ['Windows'],
    gpuType: 'discrete'
  },
  {
    vendor: 'Google Inc. (NVIDIA)',
    renderer: 'ANGLE (NVIDIA GeForce RTX 4070 Direct3D11 vs_5_0 ps_5_0)',
    compatiblePlatforms: ['Windows'],
    gpuType: 'discrete'
  },
  {
    vendor: 'Google Inc. (NVIDIA)',
    renderer: 'ANGLE (NVIDIA GeForce RTX 4080 Direct3D11 vs_5_0 ps_5_0)',
    compatiblePlatforms: ['Windows'],
    gpuType: 'discrete'
  },
  // NVIDIA on Linux
  {
    vendor: 'NVIDIA Corporation',
    renderer: 'NVIDIA GeForce GTX 1060/PCIe/SSE2',
    compatiblePlatforms: ['Linux'],
    gpuType: 'discrete'
  },
  {
    vendor: 'NVIDIA Corporation',
    renderer: 'NVIDIA GeForce RTX 3060/PCIe/SSE2',
    compatiblePlatforms: ['Linux'],
    gpuType: 'discrete'
  },
  
  // AMD GPUs (Windows/Linux)
  {
    vendor: 'Google Inc. (AMD)',
    renderer: 'ANGLE (AMD Radeon RX 580 Direct3D11 vs_5_0 ps_5_0)',
    compatiblePlatforms: ['Windows'],
    gpuType: 'discrete'
  },
  {
    vendor: 'Google Inc. (AMD)',
    renderer: 'ANGLE (AMD Radeon RX 5700 XT Direct3D11 vs_5_0 ps_5_0)',
    compatiblePlatforms: ['Windows'],
    gpuType: 'discrete'
  },
  {
    vendor: 'Google Inc. (AMD)',
    renderer: 'ANGLE (AMD Radeon RX 6700 XT Direct3D11 vs_5_0 ps_5_0)',
    compatiblePlatforms: ['Windows'],
    gpuType: 'discrete'
  },
  {
    vendor: 'Google Inc. (AMD)',
    renderer: 'ANGLE (AMD Radeon RX 6800 XT Direct3D11 vs_5_0 ps_5_0)',
    compatiblePlatforms: ['Windows'],
    gpuType: 'discrete'
  },
  {
    vendor: 'Google Inc. (AMD)',
    renderer: 'ANGLE (AMD Radeon RX 7900 XTX Direct3D11 vs_5_0 ps_5_0)',
    compatiblePlatforms: ['Windows'],
    gpuType: 'discrete'
  },
  // AMD on Linux
  {
    vendor: 'AMD',
    renderer: 'AMD Radeon RX 580 (polaris10, LLVM 15.0.7, DRM 3.49, 6.1.0-18-amd64)',
    compatiblePlatforms: ['Linux'],
    gpuType: 'discrete'
  },
  
  // Intel GPUs (Windows/Linux/MacOS)
  {
    vendor: 'Google Inc. (Intel)',
    renderer: 'ANGLE (Intel(R) UHD Graphics 620 Direct3D11 vs_5_0 ps_5_0)',
    compatiblePlatforms: ['Windows'],
    gpuType: 'integrated'
  },
  {
    vendor: 'Google Inc. (Intel)',
    renderer: 'ANGLE (Intel(R) UHD Graphics 630 Direct3D11 vs_5_0 ps_5_0)',
    compatiblePlatforms: ['Windows'],
    gpuType: 'integrated'
  },
  {
    vendor: 'Google Inc. (Intel)',
    renderer: 'ANGLE (Intel(R) Iris(R) Xe Graphics Direct3D11 vs_5_0 ps_5_0)',
    compatiblePlatforms: ['Windows'],
    gpuType: 'integrated'
  },
  {
    vendor: 'Google Inc. (Intel)',
    renderer: 'ANGLE (Intel(R) HD Graphics 530 Direct3D11 vs_5_0 ps_5_0)',
    compatiblePlatforms: ['Windows'],
    gpuType: 'integrated'
  },
  {
    vendor: 'Google Inc. (Intel)',
    renderer: 'ANGLE (Intel(R) HD Graphics 630 Direct3D11 vs_5_0 ps_5_0)',
    compatiblePlatforms: ['Windows'],
    gpuType: 'integrated'
  },
  // Intel on Linux
  {
    vendor: 'Intel',
    renderer: 'Mesa Intel(R) UHD Graphics 620 (KBL GT2)',
    compatiblePlatforms: ['Linux'],
    gpuType: 'integrated'
  },
  {
    vendor: 'Intel',
    renderer: 'Mesa Intel(R) Iris(R) Xe Graphics (TGL GT2)',
    compatiblePlatforms: ['Linux'],
    gpuType: 'integrated'
  },
  
  // Apple GPUs (MacOS only)
  {
    vendor: 'Apple Inc.',
    renderer: 'Apple M1',
    compatiblePlatforms: ['MacOS'],
    gpuType: 'integrated'
  },
  {
    vendor: 'Apple Inc.',
    renderer: 'Apple M1 Pro',
    compatiblePlatforms: ['MacOS'],
    gpuType: 'integrated'
  },
  {
    vendor: 'Apple Inc.',
    renderer: 'Apple M1 Max',
    compatiblePlatforms: ['MacOS'],
    gpuType: 'integrated'
  },
  {
    vendor: 'Apple Inc.',
    renderer: 'Apple M2',
    compatiblePlatforms: ['MacOS'],
    gpuType: 'integrated'
  },
  {
    vendor: 'Apple Inc.',
    renderer: 'Apple M2 Pro',
    compatiblePlatforms: ['MacOS'],
    gpuType: 'integrated'
  },
  {
    vendor: 'Apple Inc.',
    renderer: 'Apple M2 Max',
    compatiblePlatforms: ['MacOS'],
    gpuType: 'integrated'
  },
  {
    vendor: 'Apple Inc.',
    renderer: 'Apple M3',
    compatiblePlatforms: ['MacOS'],
    gpuType: 'integrated'
  },
  {
    vendor: 'Apple Inc.',
    renderer: 'Apple M3 Pro',
    compatiblePlatforms: ['MacOS'],
    gpuType: 'integrated'
  },
  // Intel on MacOS (older Macs)
  {
    vendor: 'Intel Inc.',
    renderer: 'Intel(R) Iris(TM) Plus Graphics 640',
    compatiblePlatforms: ['MacOS'],
    gpuType: 'integrated'
  },
  {
    vendor: 'Intel Inc.',
    renderer: 'Intel(R) UHD Graphics 630',
    compatiblePlatforms: ['MacOS'],
    gpuType: 'integrated'
  },
  // AMD on MacOS (older Macs with discrete GPUs)
  {
    vendor: 'AMD',
    renderer: 'AMD Radeon Pro 5500M OpenGL Engine',
    compatiblePlatforms: ['MacOS'],
    gpuType: 'discrete'
  },
  {
    vendor: 'AMD',
    renderer: 'AMD Radeon Pro 5300M OpenGL Engine',
    compatiblePlatforms: ['MacOS'],
    gpuType: 'discrete'
  },
  
  // Mobile/Qualcomm GPUs (for mobile emulation)
  {
    vendor: 'Qualcomm',
    renderer: 'Adreno (TM) 650',
    compatiblePlatforms: ['Windows', 'Linux'],
    gpuType: 'mobile'
  },
  {
    vendor: 'Qualcomm',
    renderer: 'Adreno (TM) 730',
    compatiblePlatforms: ['Windows', 'Linux'],
    gpuType: 'mobile'
  }
];

export interface WebGLValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export class WebGLGenerator {
  /**
   * Gets all available WebGL presets
   */
  static getPresets(): WebGLPreset[] {
    return [...WEBGL_PRESETS];
  }
  
  /**
   * Gets WebGL presets compatible with a specific platform
   * Requirements: 4.3
   */
  static getPresetsForPlatform(platform: Platform): WebGLPreset[] {
    return WEBGL_PRESETS.filter(preset => 
      preset.compatiblePlatforms.includes(platform)
    );
  }
  
  /**
   * Generates a random WebGL configuration for a platform
   * Requirements: 4.3
   */
  static generateRandom(platform: Platform): WebGLConfig {
    const compatiblePresets = this.getPresetsForPlatform(platform);
    
    if (compatiblePresets.length === 0) {
      // Fallback to a generic configuration
      return this.getDefaultConfig(platform);
    }
    
    const preset = compatiblePresets[Math.floor(Math.random() * compatiblePresets.length)];
    
    return {
      vendor: preset.vendor,
      renderer: preset.renderer,
      mode: 'custom'
    };
  }
  
  /**
   * Gets a default WebGL configuration for a platform
   */
  static getDefaultConfig(platform: Platform): WebGLConfig {
    switch (platform) {
      case 'Windows':
        return {
          vendor: 'Google Inc. (NVIDIA)',
          renderer: 'ANGLE (NVIDIA GeForce GTX 1060 Direct3D11 vs_5_0 ps_5_0)',
          mode: 'real'
        };
      case 'MacOS':
        return {
          vendor: 'Apple Inc.',
          renderer: 'Apple M1',
          mode: 'real'
        };
      case 'Linux':
        return {
          vendor: 'NVIDIA Corporation',
          renderer: 'NVIDIA GeForce GTX 1060/PCIe/SSE2',
          mode: 'real'
        };
      default:
        return {
          vendor: 'Google Inc. (NVIDIA)',
          renderer: 'ANGLE (NVIDIA GeForce GTX 1060 Direct3D11 vs_5_0 ps_5_0)',
          mode: 'real'
        };
    }
  }
  
  /**
   * Validates WebGL configuration for consistency with platform
   * Requirements: 4.4
   */
  static validateConsistency(config: WebGLConfig, platform: Platform): WebGLValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    // Validate vendor is not empty
    if (!config.vendor || config.vendor.trim().length === 0) {
      errors.push('WebGL vendor cannot be empty');
    }
    
    // Validate renderer is not empty
    if (!config.renderer || config.renderer.trim().length === 0) {
      errors.push('WebGL renderer cannot be empty');
    }
    
    // Platform-specific validation
    if (platform === 'Windows') {
      // Windows typically uses ANGLE with Direct3D
      if (config.vendor.includes('Apple Inc.') && config.renderer.includes('Apple M')) {
        errors.push('Apple Silicon GPUs are not compatible with Windows');
      }
      
      // Check for typical Windows patterns
      if (!config.vendor.includes('Google Inc.') && 
          !config.vendor.includes('NVIDIA') && 
          !config.vendor.includes('AMD') && 
          !config.vendor.includes('Intel') &&
          !config.vendor.includes('Qualcomm')) {
        warnings.push('WebGL vendor may not be typical for Windows');
      }
    }
    
    if (platform === 'MacOS') {
      // MacOS validation
      if (config.renderer.includes('Direct3D')) {
        errors.push('Direct3D renderers are not compatible with MacOS');
      }
      
      // Apple Silicon or Intel/AMD for older Macs
      const validMacVendors = ['Apple Inc.', 'Intel Inc.', 'Intel', 'AMD'];
      if (!validMacVendors.some(v => config.vendor.includes(v))) {
        warnings.push('WebGL vendor may not be typical for MacOS');
      }
    }
    
    if (platform === 'Linux') {
      // Linux validation
      if (config.renderer.includes('Direct3D')) {
        errors.push('Direct3D renderers are not compatible with Linux');
      }
      
      if (config.vendor.includes('Apple Inc.') && config.renderer.includes('Apple M')) {
        errors.push('Apple Silicon GPUs are not compatible with Linux');
      }
      
      // Linux typically uses Mesa or native drivers
      const validLinuxVendors = ['NVIDIA', 'AMD', 'Intel', 'Mesa', 'Qualcomm'];
      if (!validLinuxVendors.some(v => config.vendor.includes(v))) {
        warnings.push('WebGL vendor may not be typical for Linux');
      }
    }
    
    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }
  
  /**
   * Checks if a WebGL configuration is compatible with a platform
   */
  static isCompatibleWithPlatform(config: WebGLConfig, platform: Platform): boolean {
    const validation = this.validateConsistency(config, platform);
    return validation.valid;
  }
  
  /**
   * Gets all unique vendors from presets
   */
  static getAvailableVendors(): string[] {
    const vendors = new Set<string>();
    for (const preset of WEBGL_PRESETS) {
      vendors.add(preset.vendor);
    }
    return Array.from(vendors);
  }
  
  /**
   * Gets all unique renderers from presets
   */
  static getAvailableRenderers(): string[] {
    const renderers = new Set<string>();
    for (const preset of WEBGL_PRESETS) {
      renderers.add(preset.renderer);
    }
    return Array.from(renderers);
  }
  
  /**
   * Gets renderers for a specific vendor
   */
  static getRenderersForVendor(vendor: string): string[] {
    return WEBGL_PRESETS
      .filter(preset => preset.vendor === vendor)
      .map(preset => preset.renderer);
  }
  
  /**
   * Finds a preset by vendor and renderer
   */
  static findPreset(vendor: string, renderer: string): WebGLPreset | null {
    return WEBGL_PRESETS.find(
      preset => preset.vendor === vendor && preset.renderer === renderer
    ) || null;
  }
  
  /**
   * Creates a WebGL config from a preset
   */
  static createConfigFromPreset(preset: WebGLPreset, mode: WebGLMode = 'custom'): WebGLConfig {
    return {
      vendor: preset.vendor,
      renderer: preset.renderer,
      mode
    };
  }
  
  /**
   * Suggests a compatible WebGL configuration for a platform
   * Returns the most common/realistic configuration for that platform
   */
  static suggestConfig(platform: Platform): WebGLConfig {
    const compatiblePresets = this.getPresetsForPlatform(platform);
    
    // Prefer integrated GPUs for laptops (more common)
    const integratedPresets = compatiblePresets.filter(p => p.gpuType === 'integrated');
    
    if (integratedPresets.length > 0) {
      const preset = integratedPresets[0];
      return this.createConfigFromPreset(preset);
    }
    
    if (compatiblePresets.length > 0) {
      const preset = compatiblePresets[0];
      return this.createConfigFromPreset(preset);
    }
    
    return this.getDefaultConfig(platform);
  }
}

export default WebGLGenerator;
