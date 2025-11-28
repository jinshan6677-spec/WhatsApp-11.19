/**
 * Property-Based Tests for Screen and Font Configuration
 * 
 * Feature: professional-fingerprint-browser
 * Tests the screen resolution and font list configuration
 * 
 * @module test/property/screen-font
 */

import * as fc from 'fast-check';
import { ScreenFontGenerator } from '../../src/infrastructure/fingerprint/generators/ScreenFontGenerator';
import { Platform, ScreenMode, FontsMode } from '../../src/domain/entities/FingerprintProfile';

// Arbitraries for Screen and Font testing
const platformArbitrary = fc.constantFrom<Platform>('Windows', 'MacOS', 'Linux');
const screenModeArbitrary = fc.constantFrom<ScreenMode>('real', 'custom');
const fontsModeArbitrary = fc.constantFrom<FontsMode>('system', 'custom');
const deviceTypeArbitrary = fc.constantFrom<'desktop' | 'laptop' | 'tablet' | 'mobile'>('desktop', 'laptop', 'tablet');

const widthArbitrary = fc.integer({ min: 640, max: 7680 });
const heightArbitrary = fc.integer({ min: 480, max: 4320 });

describe('Screen and Font Property Tests', () => {
  /**
   * Feature: professional-fingerprint-browser, Property 22: 分辨率覆盖正确性
   * Validates: Requirements 9.2, 9.3
   * 
   * For any screen resolution configuration, the generated override script
   * must correctly set screen.width, screen.height and related properties.
   */
  test('Property 22: Screen resolution override correctness', () => {
    fc.assert(
      fc.property(
        widthArbitrary,
        heightArbitrary,
        (width: number, height: number) => {
          // Create screen config
          const config = ScreenFontGenerator.createScreenConfig('custom', width, height);
          
          // Validate config
          const validation = ScreenFontGenerator.validateScreenConfig(config);
          expect(validation.valid).toBe(true);
          expect(validation.errors).toHaveLength(0);
          
          // Generate script
          const script = ScreenFontGenerator.generateScreenScript(config);
          
          // Verify script is not empty
          expect(script).toBeTruthy();
          expect(script.length).toBeGreaterThan(0);
          
          // Verify script contains the width and height values
          expect(script).toContain(`WIDTH = ${width}`);
          expect(script).toContain(`HEIGHT = ${height}`);
          
          // Verify script overrides screen properties
          expect(script).toContain('screen');
          expect(script).toContain('width');
          expect(script).toContain('height');
          expect(script).toContain('availWidth');
          expect(script).toContain('availHeight');
          
          // Verify script makes properties non-configurable
          expect(script).toContain('configurable: false');
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });


  /**
   * Additional test: Screen real mode produces no override
   */
  test('Property 22 (Extended): Screen real mode produces no override', () => {
    const config = ScreenFontGenerator.createScreenConfig('real');
    const script = ScreenFontGenerator.generateScreenScript(config);
    
    expect(script).toContain('Real mode');
    expect(script).toContain('no override');
  });

  /**
   * Additional test: Random resolution generation produces valid configs
   */
  test('Property 22 (Extended): Random resolution generation produces valid configs', () => {
    fc.assert(
      fc.property(
        fc.option(deviceTypeArbitrary, { nil: undefined }),
        (deviceType) => {
          const config = ScreenFontGenerator.generateRandomResolution(deviceType);
          
          // Verify config is valid
          const validation = ScreenFontGenerator.validateScreenConfig(config);
          expect(validation.valid).toBe(true);
          
          // Verify dimensions are reasonable
          expect(config.width).toBeGreaterThanOrEqual(640);
          expect(config.width).toBeLessThanOrEqual(7680);
          expect(config.height).toBeGreaterThanOrEqual(480);
          expect(config.height).toBeLessThanOrEqual(4320);
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Additional test: Resolution database is comprehensive
   */
  test('Property 22 (Extended): Resolution database is comprehensive', () => {
    const resolutions = ScreenFontGenerator.getResolutions();
    
    // Verify we have a reasonable number of resolutions
    expect(resolutions.length).toBeGreaterThan(10);
    
    // Verify common resolutions are present
    const fullHD = ScreenFontGenerator.findResolution(1920, 1080);
    expect(fullHD).not.toBeNull();
    expect(fullHD?.name).toBe('Full HD');
    
    const qhd = ScreenFontGenerator.findResolution(2560, 1440);
    expect(qhd).not.toBeNull();
    
    // Verify all device types are covered
    const deviceTypes = new Set(resolutions.map(r => r.deviceType));
    expect(deviceTypes.has('desktop')).toBe(true);
    expect(deviceTypes.has('laptop')).toBe(true);
    expect(deviceTypes.has('tablet')).toBe(true);
  });

  /**
   * Additional test: Invalid screen configs are detected
   */
  test('Property 22 (Extended): Invalid screen configs are detected', () => {
    // Invalid width
    const invalidWidth = ScreenFontGenerator.validateScreenConfig({
      mode: 'custom',
      width: 0,
      height: 1080
    });
    expect(invalidWidth.valid).toBe(false);
    
    // Invalid height
    const invalidHeight = ScreenFontGenerator.validateScreenConfig({
      mode: 'custom',
      width: 1920,
      height: 0
    });
    expect(invalidHeight.valid).toBe(false);
    
    // Missing dimensions in custom mode
    const missingDimensions = ScreenFontGenerator.validateScreenConfig({
      mode: 'custom'
    });
    expect(missingDimensions.valid).toBe(false);
  });

  /**
   * Additional test: Suggested resolution is valid for platform
   */
  test('Property 22 (Extended): Suggested resolution is valid for platform', () => {
    fc.assert(
      fc.property(
        platformArbitrary,
        (platform: Platform) => {
          const suggested = ScreenFontGenerator.suggestResolution(platform);
          
          // Verify suggested config is valid
          const validation = ScreenFontGenerator.validateScreenConfig(suggested);
          expect(validation.valid).toBe(true);
          
          // Verify suggested config has reasonable values
          expect(suggested.width).toBeGreaterThanOrEqual(1280);
          expect(suggested.height).toBeGreaterThanOrEqual(720);
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Additional test: Font list generation produces valid configs
   */
  test('Property 22 (Extended): Font list generation produces valid configs', () => {
    fc.assert(
      fc.property(
        platformArbitrary,
        fc.integer({ min: 1, max: 20 }),
        (platform: Platform, count: number) => {
          const fontList = ScreenFontGenerator.generateRandomFontList(platform, count);
          
          // Verify font list is not empty
          expect(fontList.length).toBeGreaterThan(0);
          expect(fontList.length).toBeLessThanOrEqual(count);
          
          // Verify all fonts are strings
          for (const font of fontList) {
            expect(typeof font).toBe('string');
            expect(font.length).toBeGreaterThan(0);
          }
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Additional test: Font config validation works correctly
   */
  test('Property 22 (Extended): Font config validation works correctly', () => {
    // Valid system mode
    const systemMode = ScreenFontGenerator.validateFontsConfig({ mode: 'system' });
    expect(systemMode.valid).toBe(true);
    
    // Valid custom mode with list
    const customMode = ScreenFontGenerator.validateFontsConfig({
      mode: 'custom',
      list: ['Arial', 'Times New Roman']
    });
    expect(customMode.valid).toBe(true);
    
    // Invalid custom mode without list
    const invalidCustom = ScreenFontGenerator.validateFontsConfig({
      mode: 'custom',
      list: []
    });
    expect(invalidCustom.valid).toBe(false);
  });

  /**
   * Additional test: Font script generation works correctly
   */
  test('Property 22 (Extended): Font script generation works correctly', () => {
    fc.assert(
      fc.property(
        fc.array(fc.string({ minLength: 1, maxLength: 50 }), { minLength: 1, maxLength: 10 }),
        (fontList: string[]) => {
          const config = ScreenFontGenerator.createFontsConfig('custom', fontList);
          const script = ScreenFontGenerator.generateFontsScript(config);
          
          // Verify script is not empty
          expect(script).toBeTruthy();
          expect(script.length).toBeGreaterThan(0);
          
          // Verify script contains FONT_LIST
          expect(script).toContain('FONT_LIST');
          
          // Verify script overrides measureText
          expect(script).toContain('measureText');
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Additional test: Font system mode produces no override
   */
  test('Property 22 (Extended): Font system mode produces no override', () => {
    const config = ScreenFontGenerator.createFontsConfig('system');
    const script = ScreenFontGenerator.generateFontsScript(config);
    
    expect(script).toContain('System mode');
    expect(script).toContain('no override');
  });

  /**
   * Additional test: Combined script includes all components
   */
  test('Property 22 (Extended): Combined script includes all components', () => {
    fc.assert(
      fc.property(
        widthArbitrary,
        heightArbitrary,
        fc.array(fc.string({ minLength: 1, maxLength: 30 }), { minLength: 1, maxLength: 5 }),
        (width: number, height: number, fontList: string[]) => {
          const screen = ScreenFontGenerator.createScreenConfig('custom', width, height);
          const fonts = ScreenFontGenerator.createFontsConfig('custom', fontList);
          
          const script = ScreenFontGenerator.generateCombinedScript(screen, fonts);
          
          // Verify script contains screen overrides
          expect(script).toContain(`WIDTH = ${width}`);
          expect(script).toContain(`HEIGHT = ${height}`);
          
          // Verify script contains font overrides
          expect(script).toContain('FONT_LIST');
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Additional test: Font database is comprehensive
   */
  test('Property 22 (Extended): Font database is comprehensive', () => {
    const fonts = ScreenFontGenerator.getFonts();
    
    // Verify we have a reasonable number of fonts
    expect(fonts.length).toBeGreaterThan(30);
    
    // Verify all platforms have fonts
    const windowsFonts = ScreenFontGenerator.getFontsForPlatform('Windows');
    const macFonts = ScreenFontGenerator.getFontsForPlatform('MacOS');
    const linuxFonts = ScreenFontGenerator.getFontsForPlatform('Linux');
    
    expect(windowsFonts.length).toBeGreaterThan(10);
    expect(macFonts.length).toBeGreaterThan(10);
    expect(linuxFonts.length).toBeGreaterThan(10);
    
    // Verify common fonts are present
    const fontNames = fonts.map(f => f.name);
    expect(fontNames).toContain('Arial');
    expect(fontNames).toContain('Times New Roman');
    expect(fontNames).toContain('Courier New');
  });

  /**
   * Additional test: Suggested font list is valid for platform
   */
  test('Property 22 (Extended): Suggested font list is valid for platform', () => {
    fc.assert(
      fc.property(
        platformArbitrary,
        (platform: Platform) => {
          const suggested = ScreenFontGenerator.suggestFontList(platform);
          
          // Verify suggested config is valid
          const validation = ScreenFontGenerator.validateFontsConfig(suggested);
          expect(validation.valid).toBe(true);
          
          // Verify suggested list has fonts
          expect(suggested.list).toBeDefined();
          expect(suggested.list!.length).toBeGreaterThan(0);
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});
