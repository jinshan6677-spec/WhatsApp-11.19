/**
 * Property-Based Tests for Canvas and Audio Fingerprint Generation
 * 
 * Feature: professional-fingerprint-browser
 * Tests the Canvas and Audio noise generation and randomization
 * 
 * @module test/property/canvas-audio
 */

import * as fc from 'fast-check';
import { 
  CanvasGenerator, 
  CanvasNoiseConfig, 
  AudioNoiseConfig,
  ClientRectsConfig 
} from '../../src/infrastructure/fingerprint/generators/CanvasGenerator';
import { CanvasConfig, AudioConfig, CanvasMode, AudioMode } from '../../src/domain/entities/FingerprintProfile';

// Arbitraries for Canvas/Audio testing
const canvasModeArbitrary = fc.constantFrom<CanvasMode>('real', 'random');
const audioModeArbitrary = fc.constantFrom<AudioMode>('real', 'random');
const noiseLevelArbitrary = fc.integer({ min: 0, max: 10 });
const seedArbitrary = fc.integer({ min: 1, max: 2147483647 });

describe('Canvas and Audio Property Tests', () => {
  /**
   * Feature: professional-fingerprint-browser, Property 17: Canvas 随机化不可预测性
   * Validates: Requirements 6.1
   * 
   * For any Canvas mode set to "random", multiple calls to the noise generation
   * with different seeds must produce different results.
   */
  test('Property 17: Canvas randomization unpredictability', () => {
    fc.assert(
      fc.property(
        noiseLevelArbitrary.filter(n => n > 0), // Only test with noise enabled
        seedArbitrary,
        seedArbitrary,
        (noiseLevel: number, seed1: number, seed2: number) => {
          // Skip if seeds are the same
          if (seed1 === seed2) {
            return true;
          }
          
          const config1: CanvasNoiseConfig = {
            enabled: true,
            noiseLevel,
            seed: seed1
          };
          
          const config2: CanvasNoiseConfig = {
            enabled: true,
            noiseLevel,
            seed: seed2
          };
          
          // Generate scripts with different seeds
          const script1 = CanvasGenerator.generateCanvasNoiseScript(config1);
          const script2 = CanvasGenerator.generateCanvasNoiseScript(config2);
          
          // Scripts should be different due to different seeds
          expect(script1).not.toBe(script2);
          
          // Both scripts should contain the noise injection code
          expect(script1).toContain('toDataURL');
          expect(script1).toContain('getImageData');
          expect(script2).toContain('toDataURL');
          expect(script2).toContain('getImageData');
          
          // Verify seed values are embedded in scripts
          expect(script1).toContain(`const seed = ${seed1}`);
          expect(script2).toContain(`const seed = ${seed2}`);
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: professional-fingerprint-browser, Property 18: Audio 随机化不可预测性
   * Validates: Requirements 6.3
   * 
   * For any Audio mode set to "random", multiple calls to the noise generation
   * with different seeds must produce different results.
   */
  test('Property 18: Audio randomization unpredictability', () => {
    fc.assert(
      fc.property(
        noiseLevelArbitrary.filter(n => n > 0), // Only test with noise enabled
        seedArbitrary,
        seedArbitrary,
        (noiseLevel: number, seed1: number, seed2: number) => {
          // Skip if seeds are the same
          if (seed1 === seed2) {
            return true;
          }
          
          const config1: AudioNoiseConfig = {
            enabled: true,
            noiseLevel,
            seed: seed1
          };
          
          const config2: AudioNoiseConfig = {
            enabled: true,
            noiseLevel,
            seed: seed2
          };
          
          // Generate scripts with different seeds
          const script1 = CanvasGenerator.generateAudioNoiseScript(config1);
          const script2 = CanvasGenerator.generateAudioNoiseScript(config2);
          
          // Scripts should be different due to different seeds
          expect(script1).not.toBe(script2);
          
          // Both scripts should contain the audio noise injection code
          expect(script1).toContain('AudioContext');
          expect(script1).toContain('createAnalyser');
          expect(script2).toContain('AudioContext');
          expect(script2).toContain('createAnalyser');
          
          // Verify seed values are embedded in scripts
          expect(script1).toContain(`const seed = ${seed1}`);
          expect(script2).toContain(`const seed = ${seed2}`);
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Additional test: Same seed produces same script (reproducibility)
   */
  test('Property 17 (Extended): Same seed produces reproducible Canvas noise', () => {
    fc.assert(
      fc.property(
        noiseLevelArbitrary.filter(n => n > 0),
        seedArbitrary,
        (noiseLevel: number, seed: number) => {
          const config: CanvasNoiseConfig = {
            enabled: true,
            noiseLevel,
            seed
          };
          
          // Generate script twice with same config
          const script1 = CanvasGenerator.generateCanvasNoiseScript(config);
          const script2 = CanvasGenerator.generateCanvasNoiseScript(config);
          
          // Scripts should be identical
          expect(script1).toBe(script2);
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Additional test: Same seed produces same Audio script (reproducibility)
   */
  test('Property 18 (Extended): Same seed produces reproducible Audio noise', () => {
    fc.assert(
      fc.property(
        noiseLevelArbitrary.filter(n => n > 0),
        seedArbitrary,
        (noiseLevel: number, seed: number) => {
          const config: AudioNoiseConfig = {
            enabled: true,
            noiseLevel,
            seed
          };
          
          // Generate script twice with same config
          const script1 = CanvasGenerator.generateAudioNoiseScript(config);
          const script2 = CanvasGenerator.generateAudioNoiseScript(config);
          
          // Scripts should be identical
          expect(script1).toBe(script2);
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Additional test: Disabled noise produces minimal script
   */
  test('Property 17 (Extended): Disabled Canvas noise produces minimal script', () => {
    const config: CanvasNoiseConfig = {
      enabled: false,
      noiseLevel: 5
    };
    
    const script = CanvasGenerator.generateCanvasNoiseScript(config);
    
    // Should be a comment indicating disabled
    expect(script).toContain('disabled');
    expect(script).not.toContain('toDataURL');
    expect(script).not.toContain('getImageData');
  });

  /**
   * Additional test: Disabled Audio noise produces minimal script
   */
  test('Property 18 (Extended): Disabled Audio noise produces minimal script', () => {
    const config: AudioNoiseConfig = {
      enabled: false,
      noiseLevel: 5
    };
    
    const script = CanvasGenerator.generateAudioNoiseScript(config);
    
    // Should be a comment indicating disabled
    expect(script).toContain('disabled');
    expect(script).not.toContain('AudioContext');
    expect(script).not.toContain('createAnalyser');
  });

  /**
   * Additional test: Canvas config validation
   */
  test('Property 17 (Extended): Canvas config validation works correctly', () => {
    fc.assert(
      fc.property(
        canvasModeArbitrary,
        fc.integer({ min: -5, max: 15 }), // Include invalid values
        (mode: CanvasMode, noiseLevel: number) => {
          const config: CanvasConfig = {
            mode,
            noiseLevel: mode === 'random' ? noiseLevel : undefined
          };
          
          const validation = CanvasGenerator.validateCanvasConfig(config);
          
          // Valid noise levels are 0-10
          if (mode === 'random' && noiseLevel !== undefined) {
            if (noiseLevel < 0 || noiseLevel > 10) {
              expect(validation.valid).toBe(false);
              expect(validation.errors.length).toBeGreaterThan(0);
            } else {
              expect(validation.valid).toBe(true);
            }
          } else {
            expect(validation.valid).toBe(true);
          }
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Additional test: Audio config validation
   */
  test('Property 18 (Extended): Audio config validation works correctly', () => {
    fc.assert(
      fc.property(
        audioModeArbitrary,
        fc.integer({ min: -5, max: 15 }), // Include invalid values
        (mode: AudioMode, noiseLevel: number) => {
          const config: AudioConfig = {
            mode,
            noiseLevel: mode === 'random' ? noiseLevel : undefined
          };
          
          const validation = CanvasGenerator.validateAudioConfig(config);
          
          // Valid noise levels are 0-10
          if (mode === 'random' && noiseLevel !== undefined) {
            if (noiseLevel < 0 || noiseLevel > 10) {
              expect(validation.valid).toBe(false);
              expect(validation.errors.length).toBeGreaterThan(0);
            } else {
              expect(validation.valid).toBe(true);
            }
          } else {
            expect(validation.valid).toBe(true);
          }
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Additional test: Random config generation produces valid configs
   */
  test('Property 17/18 (Extended): Random config generation produces valid configs', () => {
    for (let i = 0; i < 50; i++) {
      const canvasConfig = CanvasGenerator.generateRandomCanvasConfig();
      const audioConfig = CanvasGenerator.generateRandomAudioConfig();
      
      // Validate canvas config
      const canvasValidation = CanvasGenerator.validateCanvasConfig(canvasConfig);
      expect(canvasValidation.valid).toBe(true);
      
      // Validate audio config
      const audioValidation = CanvasGenerator.validateAudioConfig(audioConfig);
      expect(audioValidation.valid).toBe(true);
      
      // Verify structure
      expect(['real', 'random']).toContain(canvasConfig.mode);
      expect(['real', 'random']).toContain(audioConfig.mode);
      
      // If random mode, noise level should be set
      if (canvasConfig.mode === 'random') {
        expect(canvasConfig.noiseLevel).toBeDefined();
        expect(canvasConfig.noiseLevel).toBeGreaterThanOrEqual(1);
        expect(canvasConfig.noiseLevel).toBeLessThanOrEqual(5);
      }
      
      if (audioConfig.mode === 'random') {
        expect(audioConfig.noiseLevel).toBeDefined();
        expect(audioConfig.noiseLevel).toBeGreaterThanOrEqual(1);
        expect(audioConfig.noiseLevel).toBeLessThanOrEqual(5);
      }
    }
  });

  /**
   * Additional test: ClientRects offset generation
   */
  test('Property 17/18 (Extended): ClientRects offset generation works correctly', () => {
    fc.assert(
      fc.property(
        fc.boolean(),
        fc.double({ min: 0.1, max: 1.0 }),
        seedArbitrary,
        (enabled: boolean, offsetRange: number, seed: number) => {
          const config: ClientRectsConfig = {
            enabled,
            offsetRange: enabled ? offsetRange : 0,
            seed: enabled ? seed : undefined
          };
          
          const script = CanvasGenerator.generateClientRectsScript(config);
          
          if (enabled) {
            // Should contain the offset injection code
            expect(script).toContain('getBoundingClientRect');
            expect(script).toContain('getClientRects');
            expect(script).toContain(`const seed = ${seed}`);
            expect(script).toContain(`const offsetRange = ${offsetRange}`);
          } else {
            // Should be disabled comment
            expect(script).toContain('disabled');
            expect(script).not.toContain('getBoundingClientRect');
          }
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Additional test: Combined script generation
   */
  test('Property 17/18 (Extended): Combined script generation includes all enabled features', () => {
    const canvasConfig: CanvasNoiseConfig = {
      enabled: true,
      noiseLevel: 5,
      seed: 12345
    };
    
    const audioConfig: AudioNoiseConfig = {
      enabled: true,
      noiseLevel: 3,
      seed: 67890
    };
    
    const clientRectsConfig: ClientRectsConfig = {
      enabled: true,
      offsetRange: 0.5,
      seed: 11111
    };
    
    const combinedScript = CanvasGenerator.generateCombinedScript(
      canvasConfig,
      audioConfig,
      clientRectsConfig
    );
    
    // Should contain all three components
    expect(combinedScript).toContain('toDataURL');
    expect(combinedScript).toContain('AudioContext');
    expect(combinedScript).toContain('getBoundingClientRect');
    
    // Test with some disabled
    const partialScript = CanvasGenerator.generateCombinedScript(
      { enabled: true, noiseLevel: 5, seed: 12345 },
      { enabled: false, noiseLevel: 0 },
      { enabled: false, offsetRange: 0 }
    );
    
    expect(partialScript).toContain('toDataURL');
    expect(partialScript).not.toContain('AudioContext');
    expect(partialScript).not.toContain('getBoundingClientRect');
  });

  /**
   * Additional test: Config conversion functions
   */
  test('Property 17/18 (Extended): Config conversion functions work correctly', () => {
    fc.assert(
      fc.property(
        canvasModeArbitrary,
        noiseLevelArbitrary,
        seedArbitrary,
        (mode: CanvasMode, noiseLevel: number, seed: number) => {
          const canvasConfig: CanvasConfig = {
            mode,
            noiseLevel: mode === 'random' ? noiseLevel : undefined
          };
          
          const noiseConfig = CanvasGenerator.toCanvasNoiseConfig(canvasConfig, seed);
          
          expect(noiseConfig.enabled).toBe(mode === 'random');
          expect(noiseConfig.seed).toBe(seed);
          
          if (mode === 'random' && noiseLevel !== undefined) {
            expect(noiseConfig.noiseLevel).toBe(noiseLevel);
          }
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Additional test: Noise intensity is proportional to noise level
   */
  test('Property 17 (Extended): Noise intensity is proportional to noise level', () => {
    const lowNoiseConfig: CanvasNoiseConfig = {
      enabled: true,
      noiseLevel: 1,
      seed: 12345
    };
    
    const highNoiseConfig: CanvasNoiseConfig = {
      enabled: true,
      noiseLevel: 10,
      seed: 12345
    };
    
    const lowNoiseScript = CanvasGenerator.generateCanvasNoiseScript(lowNoiseConfig);
    const highNoiseScript = CanvasGenerator.generateCanvasNoiseScript(highNoiseConfig);
    
    // Extract noise intensity from scripts
    const lowIntensityMatch = lowNoiseScript.match(/const noiseIntensity = ([\d.]+)/);
    const highIntensityMatch = highNoiseScript.match(/const noiseIntensity = ([\d.]+)/);
    
    expect(lowIntensityMatch).not.toBeNull();
    expect(highIntensityMatch).not.toBeNull();
    
    const lowIntensity = parseFloat(lowIntensityMatch![1]);
    const highIntensity = parseFloat(highIntensityMatch![1]);
    
    // High noise should have higher intensity
    expect(highIntensity).toBeGreaterThan(lowIntensity);
  });
});
