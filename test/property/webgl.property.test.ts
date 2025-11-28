/**
 * Property-Based Tests for WebGL Fingerprint Generation
 * 
 * Feature: professional-fingerprint-browser
 * Tests the WebGL configuration generation, validation, and platform consistency
 * 
 * @module test/property/webgl
 */

import * as fc from 'fast-check';
import { WebGLGenerator, WebGLPreset } from '../../src/infrastructure/fingerprint/generators/WebGLGenerator';
import { Platform, WebGLConfig, WebGLMode } from '../../src/domain/entities/FingerprintProfile';

// Arbitraries for WebGL testing
const platformArbitrary = fc.constantFrom<Platform>('Windows', 'MacOS', 'Linux');
const webglModeArbitrary = fc.constantFrom<WebGLMode>('real', 'custom', 'random');

describe('WebGL Property Tests', () => {
  /**
   * Feature: professional-fingerprint-browser, Property 15: WebGL 参数覆盖正确性
   * Validates: Requirements 4.2, 4.6
   * 
   * For any configured WebGL vendor and renderer, the configuration must be
   * valid and consistent with the target platform.
   */
  test('Property 15: WebGL parameter override correctness', () => {
    fc.assert(
      fc.property(
        platformArbitrary,
        (platform: Platform) => {
          // Generate a random WebGL config for the platform
          const config = WebGLGenerator.generateRandom(platform);
          
          // Verify config structure
          expect(config).toHaveProperty('vendor');
          expect(config).toHaveProperty('renderer');
          expect(config).toHaveProperty('mode');
          
          // Verify vendor and renderer are not empty
          expect(config.vendor).toBeTruthy();
          expect(config.vendor.length).toBeGreaterThan(0);
          expect(config.renderer).toBeTruthy();
          expect(config.renderer.length).toBeGreaterThan(0);
          
          // Verify the config is compatible with the platform
          const validation = WebGLGenerator.validateConsistency(config, platform);
          expect(validation.valid).toBe(true);
          expect(validation.errors).toHaveLength(0);
          
          // Verify the config can be found in presets for this platform
          const compatiblePresets = WebGLGenerator.getPresetsForPlatform(platform);
          const matchingPreset = compatiblePresets.find(
            p => p.vendor === config.vendor && p.renderer === config.renderer
          );
          expect(matchingPreset).toBeDefined();
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Additional test: Platform-specific WebGL presets are correctly filtered
   */
  test('Property 15 (Extended): Platform-specific presets are correctly filtered', () => {
    fc.assert(
      fc.property(
        platformArbitrary,
        (platform: Platform) => {
          const presets = WebGLGenerator.getPresetsForPlatform(platform);
          
          // Verify all returned presets are compatible with the platform
          for (const preset of presets) {
            expect(preset.compatiblePlatforms).toContain(platform);
            
            // Verify the preset passes validation
            const config: WebGLConfig = {
              vendor: preset.vendor,
              renderer: preset.renderer,
              mode: 'custom'
            };
            const validation = WebGLGenerator.validateConsistency(config, platform);
            expect(validation.valid).toBe(true);
          }
          
          // Verify at least one preset exists for each platform
          expect(presets.length).toBeGreaterThan(0);
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Additional test: Incompatible configurations are correctly rejected
   */
  test('Property 15 (Extended): Incompatible configurations are correctly rejected', () => {
    // Apple Silicon on Windows should be rejected
    const appleOnWindows: WebGLConfig = {
      vendor: 'Apple Inc.',
      renderer: 'Apple M1',
      mode: 'custom'
    };
    const windowsValidation = WebGLGenerator.validateConsistency(appleOnWindows, 'Windows');
    expect(windowsValidation.valid).toBe(false);
    expect(windowsValidation.errors.length).toBeGreaterThan(0);
    
    // Apple Silicon on Linux should be rejected
    const linuxValidation = WebGLGenerator.validateConsistency(appleOnWindows, 'Linux');
    expect(linuxValidation.valid).toBe(false);
    expect(linuxValidation.errors.length).toBeGreaterThan(0);
    
    // Direct3D on MacOS should be rejected
    const d3dOnMac: WebGLConfig = {
      vendor: 'Google Inc. (NVIDIA)',
      renderer: 'ANGLE (NVIDIA GeForce GTX 1060 Direct3D11 vs_5_0 ps_5_0)',
      mode: 'custom'
    };
    const macValidation = WebGLGenerator.validateConsistency(d3dOnMac, 'MacOS');
    expect(macValidation.valid).toBe(false);
    expect(macValidation.errors.length).toBeGreaterThan(0);
    
    // Direct3D on Linux should be rejected
    const linuxD3dValidation = WebGLGenerator.validateConsistency(d3dOnMac, 'Linux');
    expect(linuxD3dValidation.valid).toBe(false);
    expect(linuxD3dValidation.errors.length).toBeGreaterThan(0);
  });

  /**
   * Additional test: Default configs are valid for their platforms
   */
  test('Property 15 (Extended): Default configs are valid for their platforms', () => {
    const platforms: Platform[] = ['Windows', 'MacOS', 'Linux'];
    
    for (const platform of platforms) {
      const defaultConfig = WebGLGenerator.getDefaultConfig(platform);
      
      // Verify structure
      expect(defaultConfig).toHaveProperty('vendor');
      expect(defaultConfig).toHaveProperty('renderer');
      expect(defaultConfig).toHaveProperty('mode');
      
      // Verify not empty
      expect(defaultConfig.vendor.length).toBeGreaterThan(0);
      expect(defaultConfig.renderer.length).toBeGreaterThan(0);
      
      // Verify compatibility
      const validation = WebGLGenerator.validateConsistency(defaultConfig, platform);
      expect(validation.valid).toBe(true);
    }
  });

  /**
   * Additional test: Suggested configs are valid and realistic
   */
  test('Property 15 (Extended): Suggested configs are valid and realistic', () => {
    fc.assert(
      fc.property(
        platformArbitrary,
        (platform: Platform) => {
          const suggestedConfig = WebGLGenerator.suggestConfig(platform);
          
          // Verify structure
          expect(suggestedConfig).toHaveProperty('vendor');
          expect(suggestedConfig).toHaveProperty('renderer');
          expect(suggestedConfig).toHaveProperty('mode');
          
          // Verify compatibility
          const validation = WebGLGenerator.validateConsistency(suggestedConfig, platform);
          expect(validation.valid).toBe(true);
          expect(validation.errors).toHaveLength(0);
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Additional test: Vendor-renderer relationships are consistent
   */
  test('Property 15 (Extended): Vendor-renderer relationships are consistent', () => {
    const presets = WebGLGenerator.getPresets();
    
    for (const preset of presets) {
      // Verify vendor and renderer are related
      // NVIDIA vendor should have NVIDIA in renderer
      if (preset.vendor.includes('NVIDIA')) {
        expect(preset.renderer).toMatch(/NVIDIA|GeForce/i);
      }
      
      // AMD vendor should have AMD/Radeon in renderer
      if (preset.vendor.includes('AMD')) {
        expect(preset.renderer).toMatch(/AMD|Radeon/i);
      }
      
      // Apple vendor should have Apple in renderer
      if (preset.vendor.includes('Apple')) {
        expect(preset.renderer).toMatch(/Apple|M[123]/i);
      }
      
      // Intel vendor should have Intel in renderer
      if (preset.vendor.includes('Intel')) {
        expect(preset.renderer).toMatch(/Intel|UHD|Iris|HD Graphics/i);
      }
    }
  });

  /**
   * Additional test: Random generation produces diverse results
   */
  test('Property 15 (Extended): Random generation produces diverse results', () => {
    const platforms: Platform[] = ['Windows', 'MacOS', 'Linux'];
    
    for (const platform of platforms) {
      const configs: Set<string> = new Set();
      const iterations = 30;
      
      for (let i = 0; i < iterations; i++) {
        const config = WebGLGenerator.generateRandom(platform);
        configs.add(`${config.vendor}|${config.renderer}`);
      }
      
      // Should have at least 2 unique configurations per platform
      // (accounting for platforms with fewer presets)
      const minExpected = Math.min(2, WebGLGenerator.getPresetsForPlatform(platform).length);
      expect(configs.size).toBeGreaterThanOrEqual(minExpected);
    }
  });

  /**
   * Additional test: Empty vendor/renderer are rejected
   */
  test('Property 15 (Extended): Empty vendor/renderer are rejected', () => {
    const emptyVendor: WebGLConfig = {
      vendor: '',
      renderer: 'Some Renderer',
      mode: 'custom'
    };
    const emptyVendorValidation = WebGLGenerator.validateConsistency(emptyVendor, 'Windows');
    expect(emptyVendorValidation.valid).toBe(false);
    expect(emptyVendorValidation.errors).toContain('WebGL vendor cannot be empty');
    
    const emptyRenderer: WebGLConfig = {
      vendor: 'Some Vendor',
      renderer: '',
      mode: 'custom'
    };
    const emptyRendererValidation = WebGLGenerator.validateConsistency(emptyRenderer, 'Windows');
    expect(emptyRendererValidation.valid).toBe(false);
    expect(emptyRendererValidation.errors).toContain('WebGL renderer cannot be empty');
  });

  /**
   * Additional test: Preset lookup functions work correctly
   */
  test('Property 15 (Extended): Preset lookup functions work correctly', () => {
    const presets = WebGLGenerator.getPresets();
    
    // Test findPreset
    for (const preset of presets.slice(0, 5)) { // Test first 5 presets
      const found = WebGLGenerator.findPreset(preset.vendor, preset.renderer);
      expect(found).not.toBeNull();
      expect(found!.vendor).toBe(preset.vendor);
      expect(found!.renderer).toBe(preset.renderer);
    }
    
    // Test non-existent preset
    const notFound = WebGLGenerator.findPreset('NonExistent', 'NonExistent');
    expect(notFound).toBeNull();
    
    // Test getAvailableVendors
    const vendors = WebGLGenerator.getAvailableVendors();
    expect(vendors.length).toBeGreaterThan(0);
    expect(vendors).toContain('Apple Inc.');
    expect(vendors).toContain('Google Inc. (NVIDIA)');
    
    // Test getAvailableRenderers
    const renderers = WebGLGenerator.getAvailableRenderers();
    expect(renderers.length).toBeGreaterThan(0);
    
    // Test getRenderersForVendor
    const appleRenderers = WebGLGenerator.getRenderersForVendor('Apple Inc.');
    expect(appleRenderers.length).toBeGreaterThan(0);
    for (const renderer of appleRenderers) {
      expect(renderer).toMatch(/Apple|M[123]/i);
    }
  });

  /**
   * Additional test: createConfigFromPreset creates valid configs
   */
  test('Property 15 (Extended): createConfigFromPreset creates valid configs', () => {
    fc.assert(
      fc.property(
        webglModeArbitrary,
        (mode: WebGLMode) => {
          const presets = WebGLGenerator.getPresets();
          const preset = presets[Math.floor(Math.random() * presets.length)];
          
          const config = WebGLGenerator.createConfigFromPreset(preset, mode);
          
          expect(config.vendor).toBe(preset.vendor);
          expect(config.renderer).toBe(preset.renderer);
          expect(config.mode).toBe(mode);
          
          // Verify it's valid for at least one compatible platform
          for (const platform of preset.compatiblePlatforms) {
            const validation = WebGLGenerator.validateConsistency(config, platform);
            expect(validation.valid).toBe(true);
          }
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});
