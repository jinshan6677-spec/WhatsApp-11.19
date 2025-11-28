/**
 * Property-Based Tests for Miscellaneous Fingerprint Configuration
 * 
 * Feature: professional-fingerprint-browser
 * Tests Do Not Track, Media Devices, Plugins, and Battery configuration
 * 
 * @module test/property/misc-fingerprint
 */

import * as fc from 'fast-check';
import { MiscFingerprintGenerator } from '../../src/infrastructure/fingerprint/generators/MiscFingerprintGenerator';
import { 
  DoNotTrackValue, 
  BatteryMode, 
  PluginsMode, 
  MediaDevicesMode 
} from '../../src/domain/entities/FingerprintProfile';

// Arbitraries
const doNotTrackModeArbitrary = fc.constantFrom<'enabled' | 'disabled' | 'unspecified'>('enabled', 'disabled', 'unspecified');
const batteryModeArbitrary = fc.constantFrom<BatteryMode>('real', 'privacy', 'disabled');
const pluginsModeArbitrary = fc.constantFrom<PluginsMode>('real', 'custom', 'empty');
const mediaDevicesModeArbitrary = fc.constantFrom<MediaDevicesMode>('real', 'custom', 'disabled');
const deviceKindArbitrary = fc.constantFrom<'audioinput' | 'audiooutput' | 'videoinput'>('audioinput', 'audiooutput', 'videoinput');

describe('Miscellaneous Fingerprint Property Tests', () => {
  /**
   * Feature: professional-fingerprint-browser, Property 49: Do Not Track 配置正确性
   * Validates: Requirements 19.2
   * 
   * For any Do Not Track configuration, the generated override script
   * must correctly set navigator.doNotTrack to the specified value.
   */
  test('Property 49: Do Not Track configuration correctness', () => {
    fc.assert(
      fc.property(
        doNotTrackModeArbitrary,
        (mode) => {
          // Create Do Not Track value
          const value = MiscFingerprintGenerator.createDoNotTrack(mode);
          
          // Verify value is correct
          if (mode === 'enabled') {
            expect(value).toBe('1');
          } else if (mode === 'disabled') {
            expect(value).toBe('0');
          } else {
            expect(value).toBeNull();
          }
          
          // Generate script
          const script = MiscFingerprintGenerator.generateDoNotTrackScript(value);
          
          // Verify script is not empty
          expect(script).toBeTruthy();
          expect(script.length).toBeGreaterThan(0);

          
          // Verify script overrides navigator.doNotTrack
          expect(script).toContain('navigator');
          expect(script).toContain('doNotTrack');
          
          // Verify script contains correct value
          if (value === '1') {
            expect(script).toContain('"1"');
          } else if (value === '0') {
            expect(script).toContain('"0"');
          } else {
            expect(script).toContain('null');
          }
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: professional-fingerprint-browser, Property 50: Media Devices 列表正确性
   * Validates: Requirements 21.1-21.3
   * 
   * For any Media Devices configuration, the generated override script
   * must correctly set navigator.mediaDevices.enumerateDevices.
   */
  test('Property 50: Media Devices list correctness', () => {
    fc.assert(
      fc.property(
        mediaDevicesModeArbitrary,
        (mode: MediaDevicesMode) => {
          // Create media devices config
          const config = MiscFingerprintGenerator.createMediaDevicesConfig(mode);
          
          // Validate config
          const validation = MiscFingerprintGenerator.validateMediaDevicesConfig(config);
          expect(validation.valid).toBe(true);
          expect(validation.errors).toHaveLength(0);
          
          // Generate script
          const script = MiscFingerprintGenerator.generateMediaDevicesScript(config);
          
          // Verify script is not empty
          expect(script).toBeTruthy();
          expect(script.length).toBeGreaterThan(0);
          
          if (mode === 'real') {
            expect(script).toContain('Real mode');
          } else if (mode === 'disabled') {
            expect(script).toContain('Disabled');
            expect(script).toContain('enumerateDevices');
          } else {
            expect(script).toContain('Custom');
            expect(script).toContain('customDevices');
          }
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: professional-fingerprint-browser, Property 51: Plugins 列表正确性
   * Validates: Requirements 22.2
   * 
   * For any Plugins configuration, the generated override script
   * must correctly set navigator.plugins.
   */
  test('Property 51: Plugins list correctness', () => {
    fc.assert(
      fc.property(
        pluginsModeArbitrary,
        (mode: PluginsMode) => {
          // Create plugins config
          const config = MiscFingerprintGenerator.createPluginsConfig(mode);
          
          // Validate config
          const validation = MiscFingerprintGenerator.validatePluginsConfig(config);
          expect(validation.valid).toBe(true);
          expect(validation.errors).toHaveLength(0);
          
          // Generate script
          const script = MiscFingerprintGenerator.generatePluginsScript(config);
          
          // Verify script is not empty
          expect(script).toBeTruthy();
          expect(script.length).toBeGreaterThan(0);
          
          if (mode === 'real') {
            expect(script).toContain('Real mode');
          } else if (mode === 'empty') {
            expect(script).toContain('Empty');
            expect(script).toContain('length: 0');
          } else {
            expect(script).toContain('Custom');
            expect(script).toContain('customPlugins');
          }
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: professional-fingerprint-browser, Property 52: 电池信息隐私模式
   * Validates: Requirements 23.2
   * 
   * For any Battery configuration in privacy mode, the generated override script
   * must return fixed battery values (100% charged).
   */
  test('Property 52: Battery privacy mode correctness', () => {
    fc.assert(
      fc.property(
        batteryModeArbitrary,
        (mode: BatteryMode) => {
          // Create battery config
          const config = MiscFingerprintGenerator.createBatteryConfig(mode);
          
          // Validate config
          const validation = MiscFingerprintGenerator.validateBatteryConfig(config);
          expect(validation.valid).toBe(true);
          expect(validation.errors).toHaveLength(0);
          
          // Generate script
          const script = MiscFingerprintGenerator.generateBatteryScript(config);
          
          // Verify script is not empty
          expect(script).toBeTruthy();
          expect(script.length).toBeGreaterThan(0);
          
          if (mode === 'real') {
            expect(script).toContain('Real mode');
          } else if (mode === 'disabled') {
            expect(script).toContain('Disabled');
            expect(script).toContain('undefined');
          } else {
            // Privacy mode
            expect(script).toContain('Privacy Mode');
            expect(script).toContain('charging: true');
            expect(script).toContain('level: 1.0');
          }
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Additional test: Random Do Not Track generation
   */
  test('Property 49 (Extended): Random Do Not Track generation', () => {
    fc.assert(
      fc.property(
        fc.constant(null),
        () => {
          const value = MiscFingerprintGenerator.generateRandomDoNotTrack();
          
          // Verify value is one of the valid options
          expect(['0', '1', null]).toContain(value);
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Additional test: Custom media device creation
   */
  test('Property 50 (Extended): Custom media device creation', () => {
    fc.assert(
      fc.property(
        deviceKindArbitrary,
        fc.string({ minLength: 1, maxLength: 50 }),
        (kind, label) => {
          const device = MiscFingerprintGenerator.createMediaDevice(kind, label);
          
          // Verify device properties
          expect(device.kind).toBe(kind);
          expect(device.label).toBe(label);
          expect(device.deviceId).toBeTruthy();
          expect(device.deviceId.length).toBe(64);
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Additional test: Default plugins are valid
   */
  test('Property 51 (Extended): Default plugins are valid', () => {
    const plugins = MiscFingerprintGenerator.getDefaultPlugins();
    
    // Verify we have default plugins
    expect(plugins.length).toBeGreaterThan(0);
    
    // Verify each plugin has required properties
    for (const plugin of plugins) {
      expect(plugin.name).toBeTruthy();
      expect(plugin.description).toBeTruthy();
      expect(plugin.filename).toBeTruthy();
      expect(plugin.mimeTypes).toBeDefined();
      expect(plugin.mimeTypes.length).toBeGreaterThan(0);
    }
  });

  /**
   * Additional test: Default media devices are valid
   */
  test('Property 50 (Extended): Default media devices are valid', () => {
    const devices = MiscFingerprintGenerator.getDefaultMediaDevices();
    
    // Verify we have default devices
    expect(devices.length).toBeGreaterThan(0);
    
    // Verify each device has required properties
    for (const device of devices) {
      expect(device.deviceId).toBeTruthy();
      expect(device.label).toBeTruthy();
      expect(['audioinput', 'audiooutput', 'videoinput']).toContain(device.kind);
    }
  });

  /**
   * Additional test: Invalid configurations are detected
   */
  test('Property 51 (Extended): Invalid configurations are detected', () => {
    // Invalid plugins config
    const invalidPlugins = MiscFingerprintGenerator.validatePluginsConfig({
      mode: 'custom',
      list: []
    });
    expect(invalidPlugins.valid).toBe(false);
    
    // Invalid media devices config
    const invalidMedia = MiscFingerprintGenerator.validateMediaDevicesConfig({
      mode: 'custom',
      devices: []
    });
    expect(invalidMedia.valid).toBe(false);
  });

  /**
   * Additional test: Combined script includes all components
   */
  test('Property 52 (Extended): Combined script includes all components', () => {
    const doNotTrack: DoNotTrackValue = '1';
    const battery = MiscFingerprintGenerator.createBatteryConfig('privacy');
    const plugins = MiscFingerprintGenerator.createPluginsConfig('empty');
    const mediaDevices = MiscFingerprintGenerator.createMediaDevicesConfig('disabled');
    
    const script = MiscFingerprintGenerator.generateCombinedScript(
      doNotTrack,
      battery,
      plugins,
      mediaDevices
    );
    
    // Verify script contains all components
    expect(script).toContain('doNotTrack');
    expect(script).toContain('getBattery');
    expect(script).toContain('plugins');
    expect(script).toContain('enumerateDevices');
  });

  /**
   * Additional test: Random configurations are valid
   */
  test('Property 52 (Extended): Random configurations are valid', () => {
    fc.assert(
      fc.property(
        fc.constant(null),
        () => {
          // Generate random configs
          const battery = MiscFingerprintGenerator.generateRandomBatteryConfig();
          const plugins = MiscFingerprintGenerator.generateRandomPluginsConfig();
          const mediaDevices = MiscFingerprintGenerator.generateRandomMediaDevicesConfig();
          
          // Validate all configs
          expect(MiscFingerprintGenerator.validateBatteryConfig(battery).valid).toBe(true);
          expect(MiscFingerprintGenerator.validatePluginsConfig(plugins).valid).toBe(true);
          expect(MiscFingerprintGenerator.validateMediaDevicesConfig(mediaDevices).valid).toBe(true);
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});
