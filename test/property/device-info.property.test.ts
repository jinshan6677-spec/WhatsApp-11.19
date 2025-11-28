/**
 * Property-Based Tests for Device Info Generation
 * 
 * Feature: professional-fingerprint-browser
 * Tests the Device Info generation including CPU cores, memory, device name, and MAC address
 * 
 * @module test/property/device-info
 */

import * as fc from 'fast-check';
import { DeviceInfoGenerator } from '../../src/infrastructure/fingerprint/generators/DeviceInfoGenerator';
import { Platform, HardwareConfig } from '../../src/domain/entities/FingerprintProfile';

// Arbitraries for Device Info testing
const platformArbitrary = fc.constantFrom<Platform>('Windows', 'MacOS', 'Linux');
const cpuCoresArbitrary = fc.integer({ min: 1, max: 128 });
const memoryArbitrary = fc.integer({ min: 1, max: 256 });

// Valid hardware config arbitrary
const validHardwareConfigArbitrary = fc.record({
  cpuCores: fc.integer({ min: 2, max: 32 }),
  memory: fc.integer({ min: 4, max: 64 }),
  deviceName: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: undefined }),
  macAddress: fc.option(
    fc.array(fc.integer({ min: 0, max: 255 }), { minLength: 6, maxLength: 6 })
      .map(bytes => bytes.map(b => b.toString(16).padStart(2, '0').toUpperCase()).join(':')),
    { nil: undefined }
  )
});

describe('Device Info Property Tests', () => {
  /**
   * Feature: professional-fingerprint-browser, Property 23: CPU 内核数覆盖正确性
   * Validates: Requirements 8.5
   * 
   * For any CPU core count configuration, the generated override script
   * must correctly set navigator.hardwareConcurrency to the specified value.
   */
  test('Property 23: CPU cores override correctness', () => {
    fc.assert(
      fc.property(
        cpuCoresArbitrary,
        (cpuCores: number) => {
          // Generate the CPU cores override script
          const script = DeviceInfoGenerator.generateCPUCoresScript(cpuCores);
          
          // Verify script is not empty
          expect(script).toBeTruthy();
          expect(script.length).toBeGreaterThan(0);
          
          // Verify script contains the correct CPU core value
          expect(script).toContain(`return ${cpuCores}`);
          
          // Verify script overrides navigator.hardwareConcurrency
          expect(script).toContain('navigator');
          expect(script).toContain('hardwareConcurrency');
          expect(script).toContain('Object.defineProperty');
          
          // Verify script makes property non-configurable
          expect(script).toContain('configurable: false');
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: professional-fingerprint-browser, Property 24: 内存大小覆盖正确性
   * Validates: Requirements 8.6
   * 
   * For any memory size configuration, the generated override script
   * must correctly set navigator.deviceMemory to the specified value.
   */
  test('Property 24: Memory size override correctness', () => {
    fc.assert(
      fc.property(
        memoryArbitrary,
        (memoryGB: number) => {
          // Generate the memory override script
          const script = DeviceInfoGenerator.generateMemoryScript(memoryGB);
          
          // Verify script is not empty
          expect(script).toBeTruthy();
          expect(script.length).toBeGreaterThan(0);
          
          // Verify script contains the correct memory value
          expect(script).toContain(`return ${memoryGB}`);
          
          // Verify script overrides navigator.deviceMemory
          expect(script).toContain('navigator');
          expect(script).toContain('deviceMemory');
          expect(script).toContain('Object.defineProperty');
          
          // Verify script makes property non-configurable
          expect(script).toContain('configurable: false');
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Additional test: CPU cores generation produces valid values
   */
  test('Property 23 (Extended): CPU cores generation produces valid values', () => {
    fc.assert(
      fc.property(
        platformArbitrary,
        (platform: Platform) => {
          const cpuCores = DeviceInfoGenerator.generateCPUCores(platform);
          
          // Verify CPU cores is a positive integer
          expect(cpuCores).toBeGreaterThan(0);
          expect(Number.isInteger(cpuCores)).toBe(true);
          
          // Verify CPU cores is within reasonable range
          expect(cpuCores).toBeLessThanOrEqual(128);
          
          // Verify CPU cores is one of the common values
          const availableCores = DeviceInfoGenerator.getAvailableCPUCores();
          expect(availableCores).toContain(cpuCores);
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Additional test: Memory generation produces valid values
   */
  test('Property 24 (Extended): Memory generation produces valid values', () => {
    fc.assert(
      fc.property(
        fc.option(cpuCoresArbitrary, { nil: undefined }),
        (cpuCores: number | undefined) => {
          const memory = DeviceInfoGenerator.generateMemorySize(cpuCores);
          
          // Verify memory is a positive number
          expect(memory).toBeGreaterThan(0);
          
          // Verify memory is within reasonable range
          expect(memory).toBeLessThanOrEqual(256);
          
          // Verify memory is one of the common values
          const availableMemory = DeviceInfoGenerator.getAvailableMemoryOptions();
          expect(availableMemory).toContain(memory);
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Additional test: Memory is reasonable for CPU cores
   */
  test('Property 24 (Extended): Memory is reasonable for CPU cores', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 32 }),
        (cpuCores: number) => {
          const memory = DeviceInfoGenerator.generateMemorySize(cpuCores);
          
          // Low CPU cores should not have extremely high memory
          if (cpuCores <= 2) {
            expect(memory).toBeLessThanOrEqual(32);
          }
          
          // High CPU cores should have reasonable memory
          if (cpuCores > 16) {
            expect(memory).toBeGreaterThanOrEqual(16);
          }
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Additional test: Device name generation produces platform-appropriate names
   */
  test('Property 23 (Extended): Device name generation produces platform-appropriate names', () => {
    fc.assert(
      fc.property(
        platformArbitrary,
        (platform: Platform) => {
          const deviceName = DeviceInfoGenerator.generateDeviceName(platform);
          
          // Verify device name is not empty
          expect(deviceName).toBeTruthy();
          expect(deviceName.length).toBeGreaterThan(0);
          
          // Verify device name follows platform conventions
          if (platform === 'Windows') {
            // Windows device names are typically uppercase with hyphens
            expect(deviceName).toMatch(/^[A-Z0-9\-']+$/i);
          } else if (platform === 'MacOS') {
            // MacOS device names often contain "Mac" or apostrophes
            expect(deviceName.toLowerCase()).toMatch(/mac|imac|'s/i);
          } else if (platform === 'Linux') {
            // Linux device names are typically lowercase with hyphens
            expect(deviceName).toMatch(/^[a-zA-Z0-9\-]+$/);
          }
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Additional test: MAC address generation produces valid format
   */
  test('Property 23 (Extended): MAC address generation produces valid format', () => {
    fc.assert(
      fc.property(
        fc.constant(null), // No input needed
        () => {
          const macAddress = DeviceInfoGenerator.generateMACAddress();
          
          // Verify MAC address is not empty
          expect(macAddress).toBeTruthy();
          
          // Verify MAC address format (XX:XX:XX:XX:XX:XX)
          const macRegex = /^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$/;
          expect(macAddress).toMatch(macRegex);
          
          // Verify MAC address validation passes
          const validation = DeviceInfoGenerator.validateMACAddress(macAddress);
          expect(validation.valid).toBe(true);
          expect(validation.errors).toHaveLength(0);
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Additional test: Hardware config validation works correctly
   */
  test('Property 23 (Extended): Hardware config validation works correctly', () => {
    fc.assert(
      fc.property(
        validHardwareConfigArbitrary,
        (config: HardwareConfig) => {
          const validation = DeviceInfoGenerator.validateHardwareConfig(config);
          
          // Valid configs should pass validation
          expect(validation.valid).toBe(true);
          expect(validation.errors).toHaveLength(0);
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Additional test: Invalid hardware configs are detected
   */
  test('Property 23 (Extended): Invalid hardware configs are detected', () => {
    // Test invalid CPU cores
    const invalidCPU = DeviceInfoGenerator.validateHardwareConfig({
      cpuCores: 0,
      memory: 16
    });
    expect(invalidCPU.valid).toBe(false);
    expect(invalidCPU.errors.length).toBeGreaterThan(0);
    
    // Test invalid memory
    const invalidMemory = DeviceInfoGenerator.validateHardwareConfig({
      cpuCores: 8,
      memory: 0
    });
    expect(invalidMemory.valid).toBe(false);
    expect(invalidMemory.errors.length).toBeGreaterThan(0);
    
    // Test invalid MAC address
    const invalidMAC = DeviceInfoGenerator.validateHardwareConfig({
      cpuCores: 8,
      memory: 16,
      macAddress: 'invalid-mac'
    });
    expect(invalidMAC.valid).toBe(false);
    expect(invalidMAC.errors.length).toBeGreaterThan(0);
  });

  /**
   * Additional test: Complete device info generation produces consistent results
   */
  test('Property 23 (Extended): Complete device info generation produces consistent results', () => {
    fc.assert(
      fc.property(
        platformArbitrary,
        (platform: Platform) => {
          const deviceInfo = DeviceInfoGenerator.generateRandom(platform);
          
          // Verify all fields are present
          expect(deviceInfo).toHaveProperty('hardware');
          expect(deviceInfo).toHaveProperty('deviceName');
          expect(deviceInfo).toHaveProperty('macAddress');
          expect(deviceInfo).toHaveProperty('bluetooth');
          
          // Verify hardware config is valid
          const validation = DeviceInfoGenerator.validateHardwareConfig(deviceInfo.hardware);
          expect(validation.valid).toBe(true);
          
          // Verify device name matches hardware config
          expect(deviceInfo.hardware.deviceName).toBe(deviceInfo.deviceName.value);
          
          // Verify MAC address matches hardware config
          expect(deviceInfo.hardware.macAddress).toBe(deviceInfo.macAddress.value);
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Additional test: Bluetooth script generation works correctly
   */
  test('Property 24 (Extended): Bluetooth script generation works correctly', () => {
    // Test enabled Bluetooth
    const enabledScript = DeviceInfoGenerator.generateBluetoothScript(true);
    expect(enabledScript).toContain('Bluetooth enabled');
    expect(enabledScript).not.toContain('undefined');
    
    // Test disabled Bluetooth
    const disabledScript = DeviceInfoGenerator.generateBluetoothScript(false);
    expect(disabledScript).toContain('navigator');
    expect(disabledScript).toContain('bluetooth');
    expect(disabledScript).toContain('undefined');
  });

  /**
   * Additional test: Combined script generation includes all components
   */
  test('Property 24 (Extended): Combined script generation includes all components', () => {
    fc.assert(
      fc.property(
        validHardwareConfigArbitrary,
        fc.boolean(),
        (config: HardwareConfig, bluetoothEnabled: boolean) => {
          const script = DeviceInfoGenerator.generateCombinedScript(config, bluetoothEnabled);
          
          // Verify script is not empty
          expect(script).toBeTruthy();
          expect(script.length).toBeGreaterThan(0);
          
          // Verify script contains CPU cores override
          expect(script).toContain('hardwareConcurrency');
          expect(script).toContain(`return ${config.cpuCores}`);
          
          // Verify script contains memory override
          expect(script).toContain('deviceMemory');
          expect(script).toContain(`return ${config.memory}`);
          
          // Verify script contains Bluetooth handling
          expect(script).toContain('bluetooth');
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Additional test: Suggested hardware config is valid for platform
   */
  test('Property 23 (Extended): Suggested hardware config is valid for platform', () => {
    fc.assert(
      fc.property(
        platformArbitrary,
        (platform: Platform) => {
          const suggested = DeviceInfoGenerator.suggestHardwareConfig(platform);
          
          // Verify suggested config is valid
          const validation = DeviceInfoGenerator.validateHardwareConfig(suggested);
          expect(validation.valid).toBe(true);
          
          // Verify suggested config has reasonable values
          expect(suggested.cpuCores).toBeGreaterThanOrEqual(4);
          expect(suggested.cpuCores).toBeLessThanOrEqual(16);
          expect(suggested.memory).toBeGreaterThanOrEqual(8);
          expect(suggested.memory).toBeLessThanOrEqual(32);
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});
