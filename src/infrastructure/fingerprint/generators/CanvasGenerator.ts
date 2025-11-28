/**
 * CanvasGenerator
 * 
 * Generates Canvas and Audio fingerprint configurations including noise parameters.
 * Also handles ClientRects offset generation for fingerprint randomization.
 * 
 * Requirements: 6.1-6.6
 */

import { CanvasConfig, AudioConfig, CanvasMode, AudioMode } from '../../../domain/entities/FingerprintProfile';

export interface CanvasNoiseConfig {
  enabled: boolean;
  noiseLevel: number;  // 0-10, where 0 is no noise and 10 is maximum noise
  seed?: number;       // Optional seed for reproducible noise
}

export interface AudioNoiseConfig {
  enabled: boolean;
  noiseLevel: number;  // 0-10, where 0 is no noise and 10 is maximum noise
  seed?: number;       // Optional seed for reproducible noise
}

export interface ClientRectsConfig {
  enabled: boolean;
  offsetRange: number; // Maximum pixel offset (typically 0.1-1.0)
  seed?: number;       // Optional seed for reproducible offsets
}

export interface CanvasGeneratorResult {
  canvas: CanvasConfig;
  audio: AudioConfig;
  clientRects: ClientRectsConfig;
}

/**
 * Generates a random seed for noise generation
 */
function generateSeed(): number {
  return Math.floor(Math.random() * 2147483647);
}

/**
 * Seeded random number generator for reproducible noise
 */
function seededRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1103515245 + 12345) & 0x7fffffff;
    return state / 0x7fffffff;
  };
}

export class CanvasGenerator {
  /**
   * Generates a random Canvas configuration
   * Requirements: 6.1, 6.2
   */
  static generateRandomCanvasConfig(): CanvasConfig {
    const mode: CanvasMode = Math.random() > 0.5 ? 'random' : 'real';
    
    if (mode === 'random') {
      return {
        mode: 'random',
        noiseLevel: Math.floor(Math.random() * 5) + 1 // 1-5 for subtle noise
      };
    }
    
    return {
      mode: 'real'
    };
  }
  
  /**
   * Generates a random Audio configuration
   * Requirements: 6.3, 6.4
   */
  static generateRandomAudioConfig(): AudioConfig {
    const mode: AudioMode = Math.random() > 0.5 ? 'random' : 'real';
    
    if (mode === 'random') {
      return {
        mode: 'random',
        noiseLevel: Math.floor(Math.random() * 5) + 1 // 1-5 for subtle noise
      };
    }
    
    return {
      mode: 'real'
    };
  }
  
  /**
   * Generates a random ClientRects configuration
   * Requirements: 6.5
   */
  static generateRandomClientRectsConfig(): ClientRectsConfig {
    const enabled = Math.random() > 0.5;
    
    return {
      enabled,
      offsetRange: enabled ? 0.1 + Math.random() * 0.4 : 0, // 0.1-0.5 pixels
      seed: enabled ? generateSeed() : undefined
    };
  }
  
  /**
   * Generates a complete fingerprint randomization configuration
   */
  static generateRandomConfig(): CanvasGeneratorResult {
    return {
      canvas: this.generateRandomCanvasConfig(),
      audio: this.generateRandomAudioConfig(),
      clientRects: this.generateRandomClientRectsConfig()
    };
  }
  
  /**
   * Creates a Canvas configuration with specified mode
   */
  static createCanvasConfig(mode: CanvasMode, noiseLevel?: number): CanvasConfig {
    if (mode === 'random') {
      return {
        mode: 'random',
        noiseLevel: noiseLevel ?? 3 // Default noise level
      };
    }
    
    return {
      mode: 'real'
    };
  }
  
  /**
   * Creates an Audio configuration with specified mode
   */
  static createAudioConfig(mode: AudioMode, noiseLevel?: number): AudioConfig {
    if (mode === 'random') {
      return {
        mode: 'random',
        noiseLevel: noiseLevel ?? 3 // Default noise level
      };
    }
    
    return {
      mode: 'real'
    };
  }
  
  /**
   * Validates Canvas configuration
   */
  static validateCanvasConfig(config: CanvasConfig): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (!['real', 'random'].includes(config.mode)) {
      errors.push(`Invalid canvas mode: ${config.mode}`);
    }
    
    if (config.mode === 'random' && config.noiseLevel !== undefined) {
      if (config.noiseLevel < 0 || config.noiseLevel > 10) {
        errors.push('Canvas noise level must be between 0 and 10');
      }
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }
  
  /**
   * Validates Audio configuration
   */
  static validateAudioConfig(config: AudioConfig): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (!['real', 'random'].includes(config.mode)) {
      errors.push(`Invalid audio mode: ${config.mode}`);
    }
    
    if (config.mode === 'random' && config.noiseLevel !== undefined) {
      if (config.noiseLevel < 0 || config.noiseLevel > 10) {
        errors.push('Audio noise level must be between 0 and 10');
      }
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }
  
  /**
   * Generates Canvas noise injection script
   * This script modifies Canvas API to add random noise to rendered images
   * Requirements: 6.1, 6.6
   */
  static generateCanvasNoiseScript(config: CanvasNoiseConfig): string {
    if (!config.enabled) {
      return '// Canvas noise disabled';
    }
    
    const seed = config.seed ?? generateSeed();
    const noiseIntensity = config.noiseLevel / 10; // Convert to 0-1 range
    
    return `
(function() {
  const seed = ${seed};
  const noiseIntensity = ${noiseIntensity};
  
  // Seeded random number generator
  let state = seed;
  function seededRandom() {
    state = (state * 1103515245 + 12345) & 0x7fffffff;
    return state / 0x7fffffff;
  }
  
  // Override toDataURL
  const originalToDataURL = HTMLCanvasElement.prototype.toDataURL;
  HTMLCanvasElement.prototype.toDataURL = function(type, quality) {
    const ctx = this.getContext('2d');
    if (ctx && noiseIntensity > 0) {
      try {
        const imageData = ctx.getImageData(0, 0, this.width, this.height);
        const data = imageData.data;
        
        // Add noise to each pixel
        for (let i = 0; i < data.length; i += 4) {
          // Only modify RGB, not alpha
          data[i] = Math.max(0, Math.min(255, data[i] + (seededRandom() - 0.5) * noiseIntensity * 10));
          data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + (seededRandom() - 0.5) * noiseIntensity * 10));
          data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + (seededRandom() - 0.5) * noiseIntensity * 10));
        }
        
        ctx.putImageData(imageData, 0, 0);
      } catch (e) {
        // Ignore errors (e.g., cross-origin canvas)
      }
    }
    return originalToDataURL.call(this, type, quality);
  };
  
  // Override toBlob
  const originalToBlob = HTMLCanvasElement.prototype.toBlob;
  HTMLCanvasElement.prototype.toBlob = function(callback, type, quality) {
    const ctx = this.getContext('2d');
    if (ctx && noiseIntensity > 0) {
      try {
        const imageData = ctx.getImageData(0, 0, this.width, this.height);
        const data = imageData.data;
        
        for (let i = 0; i < data.length; i += 4) {
          data[i] = Math.max(0, Math.min(255, data[i] + (seededRandom() - 0.5) * noiseIntensity * 10));
          data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + (seededRandom() - 0.5) * noiseIntensity * 10));
          data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + (seededRandom() - 0.5) * noiseIntensity * 10));
        }
        
        ctx.putImageData(imageData, 0, 0);
      } catch (e) {
        // Ignore errors
      }
    }
    return originalToBlob.call(this, callback, type, quality);
  };
  
  // Override getImageData
  const originalGetImageData = CanvasRenderingContext2D.prototype.getImageData;
  CanvasRenderingContext2D.prototype.getImageData = function(sx, sy, sw, sh) {
    const imageData = originalGetImageData.call(this, sx, sy, sw, sh);
    
    if (noiseIntensity > 0) {
      const data = imageData.data;
      for (let i = 0; i < data.length; i += 4) {
        data[i] = Math.max(0, Math.min(255, data[i] + (seededRandom() - 0.5) * noiseIntensity * 10));
        data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + (seededRandom() - 0.5) * noiseIntensity * 10));
        data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + (seededRandom() - 0.5) * noiseIntensity * 10));
      }
    }
    
    return imageData;
  };
})();
`;
  }
  
  /**
   * Generates Audio noise injection script
   * This script modifies AudioContext API to add random noise to audio processing
   * Requirements: 6.3, 6.6
   */
  static generateAudioNoiseScript(config: AudioNoiseConfig): string {
    if (!config.enabled) {
      return '// Audio noise disabled';
    }
    
    const seed = config.seed ?? generateSeed();
    const noiseIntensity = config.noiseLevel / 1000; // Very small noise for audio
    
    return `
(function() {
  const seed = ${seed};
  const noiseIntensity = ${noiseIntensity};
  
  // Seeded random number generator
  let state = seed;
  function seededRandom() {
    state = (state * 1103515245 + 12345) & 0x7fffffff;
    return (state / 0x7fffffff) - 0.5;
  }
  
  // Override AudioContext.createAnalyser
  const originalCreateAnalyser = AudioContext.prototype.createAnalyser;
  AudioContext.prototype.createAnalyser = function() {
    const analyser = originalCreateAnalyser.call(this);
    
    const originalGetFloatFrequencyData = analyser.getFloatFrequencyData.bind(analyser);
    analyser.getFloatFrequencyData = function(array) {
      originalGetFloatFrequencyData(array);
      if (noiseIntensity > 0) {
        for (let i = 0; i < array.length; i++) {
          array[i] += seededRandom() * noiseIntensity;
        }
      }
    };
    
    const originalGetByteFrequencyData = analyser.getByteFrequencyData.bind(analyser);
    analyser.getByteFrequencyData = function(array) {
      originalGetByteFrequencyData(array);
      if (noiseIntensity > 0) {
        for (let i = 0; i < array.length; i++) {
          array[i] = Math.max(0, Math.min(255, array[i] + seededRandom() * noiseIntensity * 255));
        }
      }
    };
    
    return analyser;
  };
  
  // Override OfflineAudioContext if available
  if (typeof OfflineAudioContext !== 'undefined') {
    const originalOfflineCreateAnalyser = OfflineAudioContext.prototype.createAnalyser;
    OfflineAudioContext.prototype.createAnalyser = function() {
      const analyser = originalOfflineCreateAnalyser.call(this);
      
      const originalGetFloatFrequencyData = analyser.getFloatFrequencyData.bind(analyser);
      analyser.getFloatFrequencyData = function(array) {
        originalGetFloatFrequencyData(array);
        if (noiseIntensity > 0) {
          for (let i = 0; i < array.length; i++) {
            array[i] += seededRandom() * noiseIntensity;
          }
        }
      };
      
      return analyser;
    };
  }
})();
`;
  }
  
  /**
   * Generates ClientRects offset injection script
   * This script modifies getBoundingClientRect to add small random offsets
   * Requirements: 6.5, 6.6
   */
  static generateClientRectsScript(config: ClientRectsConfig): string {
    if (!config.enabled) {
      return '// ClientRects offset disabled';
    }
    
    const seed = config.seed ?? generateSeed();
    const offsetRange = config.offsetRange;
    
    return `
(function() {
  const seed = ${seed};
  const offsetRange = ${offsetRange};
  
  // Seeded random number generator
  let state = seed;
  function seededRandom() {
    state = (state * 1103515245 + 12345) & 0x7fffffff;
    return (state / 0x7fffffff) - 0.5;
  }
  
  // Override getBoundingClientRect
  const originalGetBoundingClientRect = Element.prototype.getBoundingClientRect;
  Element.prototype.getBoundingClientRect = function() {
    const rect = originalGetBoundingClientRect.call(this);
    
    if (offsetRange > 0) {
      const offset = seededRandom() * offsetRange * 2;
      
      return new DOMRect(
        rect.x + offset,
        rect.y + offset,
        rect.width + offset * 0.1,
        rect.height + offset * 0.1
      );
    }
    
    return rect;
  };
  
  // Override getClientRects
  const originalGetClientRects = Element.prototype.getClientRects;
  Element.prototype.getClientRects = function() {
    const rects = originalGetClientRects.call(this);
    
    if (offsetRange > 0) {
      const modifiedRects = [];
      for (let i = 0; i < rects.length; i++) {
        const rect = rects[i];
        const offset = seededRandom() * offsetRange * 2;
        
        modifiedRects.push(new DOMRect(
          rect.x + offset,
          rect.y + offset,
          rect.width + offset * 0.1,
          rect.height + offset * 0.1
        ));
      }
      
      // Return array-like object
      return {
        length: modifiedRects.length,
        item: (index) => modifiedRects[index],
        [Symbol.iterator]: function* () {
          for (const rect of modifiedRects) {
            yield rect;
          }
        }
      };
    }
    
    return rects;
  };
})();
`;
  }
  
  /**
   * Generates combined fingerprint randomization script
   */
  static generateCombinedScript(
    canvasConfig: CanvasNoiseConfig,
    audioConfig: AudioNoiseConfig,
    clientRectsConfig: ClientRectsConfig
  ): string {
    const scripts: string[] = [];
    
    if (canvasConfig.enabled) {
      scripts.push(this.generateCanvasNoiseScript(canvasConfig));
    }
    
    if (audioConfig.enabled) {
      scripts.push(this.generateAudioNoiseScript(audioConfig));
    }
    
    if (clientRectsConfig.enabled) {
      scripts.push(this.generateClientRectsScript(clientRectsConfig));
    }
    
    return scripts.join('\n\n');
  }
  
  /**
   * Converts CanvasConfig to CanvasNoiseConfig
   */
  static toCanvasNoiseConfig(config: CanvasConfig, seed?: number): CanvasNoiseConfig {
    return {
      enabled: config.mode === 'random',
      noiseLevel: config.noiseLevel ?? 3,
      seed
    };
  }
  
  /**
   * Converts AudioConfig to AudioNoiseConfig
   */
  static toAudioNoiseConfig(config: AudioConfig, seed?: number): AudioNoiseConfig {
    return {
      enabled: config.mode === 'random',
      noiseLevel: config.noiseLevel ?? 3,
      seed
    };
  }
}

export default CanvasGenerator;
