/**
 * Property-Based Tests for Fingerprint Configuration Persistence
 * 
 * Feature: professional-fingerprint-browser
 * Tests the round-trip serialization and deserialization of fingerprint profiles
 * 
 * @module test/property/fingerprint-persistence
 */

import * as fc from 'fast-check';
import { FingerprintProfile, FingerprintProfileData } from '../../src/domain/entities/FingerprintProfile';

const { validFingerprintProfileArbitrary } = require('../arbitraries/fingerprint');

describe('Fingerprint Persistence Property Tests', () => {
  /**
   * Feature: professional-fingerprint-browser, Property 26: 指纹配置持久化 Round-Trip
   * Validates: Requirements 12.1, 12.2
   * 
   * For any valid fingerprint profile, serializing to JSON and then deserializing
   * should produce an equivalent profile with the same configuration values.
   */
  test('Property 26: Fingerprint configuration round-trip persistence', () => {
    fc.assert(
      fc.property(
        validFingerprintProfileArbitrary,
        (profileData: FingerprintProfileData) => {
          // Create a fingerprint profile from the generated data
          const originalProfile = new FingerprintProfile(profileData);
          
          // Serialize to JSON
          const json = originalProfile.toJSON();
          
          // Deserialize from JSON
          const restoredProfile = FingerprintProfile.fromJSON(json);
          
          // Verify all fields are preserved
          expect(restoredProfile.id).toBe(originalProfile.id);
          expect(restoredProfile.accountId).toBe(originalProfile.accountId);
          expect(restoredProfile.userAgent).toBe(originalProfile.userAgent);
          expect(restoredProfile.browserVersion).toBe(originalProfile.browserVersion);
          expect(restoredProfile.platform).toBe(originalProfile.platform);
          
          // Verify WebGL config
          expect(restoredProfile.webgl.vendor).toBe(originalProfile.webgl.vendor);
          expect(restoredProfile.webgl.renderer).toBe(originalProfile.webgl.renderer);
          expect(restoredProfile.webgl.mode).toBe(originalProfile.webgl.mode);
          
          // Verify Canvas config
          expect(restoredProfile.canvas.mode).toBe(originalProfile.canvas.mode);
          expect(restoredProfile.canvas.noiseLevel).toBe(originalProfile.canvas.noiseLevel);
          
          // Verify Audio config
          expect(restoredProfile.audio.mode).toBe(originalProfile.audio.mode);
          expect(restoredProfile.audio.noiseLevel).toBe(originalProfile.audio.noiseLevel);
          
          // Verify WebRTC config
          expect(restoredProfile.webrtc.mode).toBe(originalProfile.webrtc.mode);
          expect(restoredProfile.webrtc.fakeLocalIP).toBe(originalProfile.webrtc.fakeLocalIP);
          
          // Verify Timezone config
          expect(restoredProfile.timezone.mode).toBe(originalProfile.timezone.mode);
          expect(restoredProfile.timezone.value).toBe(originalProfile.timezone.value);
          
          // Verify Geolocation config
          expect(restoredProfile.geolocation.mode).toBe(originalProfile.geolocation.mode);
          expect(restoredProfile.geolocation.latitude).toBe(originalProfile.geolocation.latitude);
          expect(restoredProfile.geolocation.longitude).toBe(originalProfile.geolocation.longitude);
          
          // Verify Language config
          expect(restoredProfile.language.mode).toBe(originalProfile.language.mode);
          expect(restoredProfile.language.value).toBe(originalProfile.language.value);
          
          // Verify Screen config
          expect(restoredProfile.screen.mode).toBe(originalProfile.screen.mode);
          expect(restoredProfile.screen.width).toBe(originalProfile.screen.width);
          expect(restoredProfile.screen.height).toBe(originalProfile.screen.height);
          
          // Verify Hardware config
          expect(restoredProfile.hardware.cpuCores).toBe(originalProfile.hardware.cpuCores);
          expect(restoredProfile.hardware.memory).toBe(originalProfile.hardware.memory);
          expect(restoredProfile.hardware.deviceName).toBe(originalProfile.hardware.deviceName);
          expect(restoredProfile.hardware.macAddress).toBe(originalProfile.hardware.macAddress);
          
          // Verify other configs
          expect(restoredProfile.doNotTrack).toBe(originalProfile.doNotTrack);
          expect(restoredProfile.battery.mode).toBe(originalProfile.battery.mode);
          expect(restoredProfile.fonts.mode).toBe(originalProfile.fonts.mode);
          expect(restoredProfile.plugins.mode).toBe(originalProfile.plugins.mode);
          expect(restoredProfile.mediaDevices.mode).toBe(originalProfile.mediaDevices.mode);
          
          // Verify metadata
          expect(restoredProfile.version).toBe(originalProfile.version);
          
          // Verify dates (compare timestamps since Date objects may differ)
          expect(restoredProfile.createdAt.getTime()).toBe(originalProfile.createdAt.getTime());
          expect(restoredProfile.updatedAt.getTime()).toBe(originalProfile.updatedAt.getTime());
          
          // Verify the restored profile is valid
          const validation = restoredProfile.validate();
          expect(validation.valid).toBe(true);
          expect(validation.errors).toHaveLength(0);
        }
      ),
      { numRuns: 100 }
    );
  });
  
  /**
   * Additional test: Verify that validation works correctly after round-trip
   */
  test('Property 26 (Extended): Validation consistency after round-trip', () => {
    fc.assert(
      fc.property(
        validFingerprintProfileArbitrary,
        (profileData: FingerprintProfileData) => {
          const originalProfile = new FingerprintProfile(profileData);
          const originalValidation = originalProfile.validate();
          
          const json = originalProfile.toJSON();
          const restoredProfile = FingerprintProfile.fromJSON(json);
          const restoredValidation = restoredProfile.validate();
          
          // Both should have the same validation result
          expect(restoredValidation.valid).toBe(originalValidation.valid);
          expect(restoredValidation.errors.length).toBe(originalValidation.errors.length);
          expect(restoredValidation.warnings.length).toBe(originalValidation.warnings.length);
        }
      ),
      { numRuns: 100 }
    );
  });
  
  /**
   * Additional test: Verify JSON structure is correct
   */
  test('Property 26 (Extended): JSON structure correctness', () => {
    fc.assert(
      fc.property(
        validFingerprintProfileArbitrary,
        (profileData: FingerprintProfileData) => {
          const profile = new FingerprintProfile(profileData);
          const json = profile.toJSON();
          
          // Verify JSON is a plain object
          expect(typeof json).toBe('object');
          expect(json).not.toBeNull();
          
          // Verify required fields exist
          expect(json).toHaveProperty('id');
          expect(json).toHaveProperty('accountId');
          expect(json).toHaveProperty('userAgent');
          expect(json).toHaveProperty('browserVersion');
          expect(json).toHaveProperty('platform');
          expect(json).toHaveProperty('webgl');
          expect(json).toHaveProperty('canvas');
          expect(json).toHaveProperty('audio');
          expect(json).toHaveProperty('webrtc');
          expect(json).toHaveProperty('timezone');
          expect(json).toHaveProperty('geolocation');
          expect(json).toHaveProperty('language');
          expect(json).toHaveProperty('screen');
          expect(json).toHaveProperty('hardware');
          expect(json).toHaveProperty('doNotTrack');
          expect(json).toHaveProperty('battery');
          expect(json).toHaveProperty('fonts');
          expect(json).toHaveProperty('plugins');
          expect(json).toHaveProperty('mediaDevices');
          expect(json).toHaveProperty('createdAt');
          expect(json).toHaveProperty('updatedAt');
          expect(json).toHaveProperty('version');
          
          // Verify dates are serialized as ISO strings
          expect(typeof (json as any).createdAt).toBe('string');
          expect(typeof (json as any).updatedAt).toBe('string');
          
          // Verify ISO string format
          expect(() => new Date((json as any).createdAt)).not.toThrow();
          expect(() => new Date((json as any).updatedAt)).not.toThrow();
        }
      ),
      { numRuns: 100 }
    );
  });
});
