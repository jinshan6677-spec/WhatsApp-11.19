/**
 * Property-Based Tests for One-Click Fingerprint Generation
 * 
 * Feature: professional-fingerprint-browser
 * Tests the consistency and validity of generated fingerprints
 * 
 * @module test/property/fingerprint-generation
 */

import * as fc from 'fast-check';
import { FingerprintService } from '../../src/application/services/FingerprintService';
import { FingerprintLibrary } from '../../src/infrastructure/fingerprint/FingerprintLibrary';
import { Platform } from '../../src/domain/entities/FingerprintProfile';

describe('Fingerprint Generation Property Tests', () => {
  let fingerprintService: FingerprintService;
  
  beforeEach(() => {
    fingerprintService = new FingerprintService('test-session-data');
  });
  
  /**
   * Feature: professional-fingerprint-browser, Property 28: 一键生成指纹一致性
   * Validates: Requirements 11.2, 24.1-24.4
   * 
   * For any generated fingerprint, the User-Agent, WebGL, and operating system
   * parameters should be mutually consistent.
   */
  test('Property 28: One-click fingerprint generation consistency', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 50 }),
        async (iterations: number) => {
          for (let i = 0; i < iterations; i++) {
            const profile = await fingerprintService.generateRandomFingerprint();
            
            // Verify the profile is valid
            const validation = profile.validate();
            expect(validation.valid).toBe(true);
            
            // Verify User-Agent matches platform
            if (profile.platform === 'Windows') {
              expect(profile.userAgent).toMatch(/Windows/);
              expect(profile.userAgent).not.toMatch(/Macintosh/);
              expect(profile.userAgent).not.toMatch(/Linux/);
            } else if (profile.platform === 'MacOS') {
              expect(profile.userAgent).toMatch(/Macintosh|Mac OS/);
              expect(profile.userAgent).not.toMatch(/Windows NT/);
            } else if (profile.platform === 'Linux') {
              expect(profile.userAgent).toMatch(/Linux|X11/);
              expect(profile.userAgent).not.toMatch(/Windows NT/);
              expect(profile.userAgent).not.toMatch(/Macintosh/);
            }
            
            // Verify WebGL is consistent with platform
            if (profile.platform === 'Windows') {
              // Windows should not have Apple Silicon GPUs
              if (profile.webgl.vendor.includes('Apple Inc.')) {
                expect(profile.webgl.renderer).not.toMatch(/Apple M\d/);
              }
              // Windows typically uses ANGLE with Direct3D
              if (profile.webgl.renderer.includes('ANGLE')) {
                expect(profile.webgl.renderer).toMatch(/Direct3D/);
              }
            } else if (profile.platform === 'MacOS') {
              // MacOS should not have Direct3D renderers
              expect(profile.webgl.renderer).not.toMatch(/Direct3D/);
            } else if (profile.platform === 'Linux') {
              // Linux should not have Direct3D or Apple Silicon
              expect(profile.webgl.renderer).not.toMatch(/Direct3D/);
              if (profile.webgl.vendor.includes('Apple Inc.')) {
                expect(profile.webgl.renderer).not.toMatch(/Apple M\d/);
              }
            }
            
            // Verify hardware configuration is reasonable
            expect(profile.hardware.cpuCores).toBeGreaterThan(0);
            expect(profile.hardware.cpuCores).toBeLessThanOrEqual(128);
            expect(profile.hardware.memory).toBeGreaterThan(0);
            expect(profile.hardware.memory).toBeLessThanOrEqual(256);
            
            // Verify screen dimensions are reasonable
            if (profile.screen.mode === 'custom') {
              expect(profile.screen.width).toBeGreaterThan(0);
              expect(profile.screen.height).toBeGreaterThan(0);
            }
          }
        }
      ),
      { numRuns: 20 }
    );
  });
  
  /**
   * Feature: professional-fingerprint-browser, Property 28 (Extended): Platform-specific generation
   * Validates: Requirements 11.2, 24.1-24.4
   * 
   * When generating a fingerprint for a specific platform, all parameters
   * should be consistent with that platform.
   */
  test('Property 28 (Extended): Platform-specific fingerprint generation', async () => {
    const platforms: Platform[] = ['Windows', 'MacOS', 'Linux'];
    
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom(...platforms),
        fc.integer({ min: 1, max: 10 }),
        async (platform: Platform, iterations: number) => {
          for (let i = 0; i < iterations; i++) {
            const profile = await fingerprintService.generateRandomFingerprintForPlatform(platform);
            
            // Verify the platform matches
            expect(profile.platform).toBe(platform);
            
            // Verify User-Agent matches the requested platform
            if (platform === 'Windows') {
              expect(profile.userAgent).toMatch(/Windows/);
            } else if (platform === 'MacOS') {
              expect(profile.userAgent).toMatch(/Macintosh|Mac OS/);
            } else if (platform === 'Linux') {
              expect(profile.userAgent).toMatch(/Linux|X11/);
            }
            
            // Verify the profile is valid
            const validation = profile.validate();
            expect(validation.valid).toBe(true);
          }
        }
      ),
      { numRuns: 30 }
    );
  });
  
  /**
   * Feature: professional-fingerprint-browser, Property 28 (Extended): Uniqueness of generated fingerprints
   * Validates: Requirements 11.1, 11.4
   * 
   * Multiple generated fingerprints should have unique IDs and potentially
   * different configurations (not all identical).
   */
  test('Property 28 (Extended): Generated fingerprints have unique IDs', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 5, max: 20 }),
        async (count: number) => {
          const profiles = await Promise.all(
            Array.from({ length: count }, () => fingerprintService.generateRandomFingerprint())
          );
          
          // All IDs should be unique
          const ids = profiles.map(p => p.id);
          const uniqueIds = new Set(ids);
          expect(uniqueIds.size).toBe(count);
          
          // All profiles should be valid
          for (const profile of profiles) {
            const validation = profile.validate();
            expect(validation.valid).toBe(true);
          }
        }
      ),
      { numRuns: 20 }
    );
  });
});

describe('Fingerprint Library Property Tests', () => {
  let library: FingerprintLibrary;
  
  beforeEach(async () => {
    library = new FingerprintLibrary();
    await library.load();
  });
  
  /**
   * Feature: professional-fingerprint-browser, Property 28 (Library): Library fingerprints are valid
   * Validates: Requirements 20.1-20.4
   * 
   * All fingerprints in the library should pass validation.
   */
  test('Property 28 (Library): All library fingerprints are valid', async () => {
    const fingerprints = await library.getAll();
    
    for (const fp of fingerprints) {
      const validation = library.validateFingerprint(fp);
      expect(validation.valid).toBe(true);
      if (!validation.valid) {
        console.error(`Invalid fingerprint ${fp.id}:`, validation.errors);
      }
    }
  });
  
  /**
   * Feature: professional-fingerprint-browser, Property 28 (Library): Library has sufficient diversity
   * Validates: Requirements 20.1, 20.2
   * 
   * The library should contain fingerprints for all platforms.
   */
  test('Property 28 (Library): Library has fingerprints for all platforms', async () => {
    const stats = await library.getStats();
    
    expect(stats.byPlatform.Windows).toBeGreaterThan(0);
    expect(stats.byPlatform.MacOS).toBeGreaterThan(0);
    expect(stats.byPlatform.Linux).toBeGreaterThan(0);
  });
  
  /**
   * Feature: professional-fingerprint-browser, Property 28 (Library): Filtering works correctly
   * Validates: Requirements 20.2
   * 
   * Filtering by platform should return only fingerprints for that platform.
   */
  test('Property 28 (Library): Platform filtering returns correct results', async () => {
    const platforms: Platform[] = ['Windows', 'MacOS', 'Linux'];
    
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom(...platforms),
        async (platform: Platform) => {
          const filtered = await library.query({ platform });
          
          for (const fp of filtered) {
            expect(fp.platform).toBe(platform);
          }
        }
      ),
      { numRuns: 10 }
    );
  });
  
  /**
   * Feature: professional-fingerprint-browser, Property 28 (Library): Random selection respects filters
   * Validates: Requirements 20.3
   * 
   * Random selection with a filter should only return fingerprints matching the filter.
   */
  test('Property 28 (Library): Random selection respects platform filter', async () => {
    const platforms: Platform[] = ['Windows', 'MacOS', 'Linux'];
    
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom(...platforms),
        fc.integer({ min: 1, max: 10 }),
        async (platform: Platform, iterations: number) => {
          for (let i = 0; i < iterations; i++) {
            const fp = await library.selectRandom({ platform });
            
            if (fp) {
              expect(fp.platform).toBe(platform);
            }
          }
        }
      ),
      { numRuns: 30 }
    );
  });
});
