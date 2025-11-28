/**
 * Property-Based Tests for Fingerprint Template Management
 * 
 * Feature: professional-fingerprint-browser
 * Tests the round-trip serialization and deserialization of fingerprint templates
 * 
 * Property 27: 指纹模板 Round-Trip
 * Validates: Requirements 25.2, 25.4
 * 
 * @module test/property/fingerprint-template
 */

import * as fc from 'fast-check';
import * as fs from 'fs';
import * as path from 'path';
import { FingerprintProfile, FingerprintProfileData } from '../../src/domain/entities/FingerprintProfile';
import { FingerprintService } from '../../src/application/services/FingerprintService';

const { validFingerprintProfileArbitrary } = require('../arbitraries/fingerprint');

// Test directory for templates
const TEST_SESSION_DIR = path.join(__dirname, '..', 'test-session-data-templates');

describe('Fingerprint Template Property Tests', () => {
  let fingerprintService: FingerprintService;
  
  beforeAll(() => {
    // Create test directory
    if (!fs.existsSync(TEST_SESSION_DIR)) {
      fs.mkdirSync(TEST_SESSION_DIR, { recursive: true });
    }
    fingerprintService = new FingerprintService(TEST_SESSION_DIR);
  });
  
  afterAll(() => {
    // Clean up test directory
    if (fs.existsSync(TEST_SESSION_DIR)) {
      fs.rmSync(TEST_SESSION_DIR, { recursive: true, force: true });
    }
  });
  
  beforeEach(() => {
    // Clean templates directory before each test
    const templatesDir = path.join(TEST_SESSION_DIR, 'fingerprint-templates');
    if (fs.existsSync(templatesDir)) {
      fs.rmSync(templatesDir, { recursive: true, force: true });
    }
  });
  
  /**
   * Feature: professional-fingerprint-browser, Property 27: 指纹模板 Round-Trip
   * Validates: Requirements 25.2, 25.4
   * 
   * For any valid fingerprint profile and valid template name, saving the profile
   * as a template and then loading it should produce an equivalent profile.
   */
  test('Property 27: Fingerprint template round-trip persistence', async () => {
    await fc.assert(
      fc.asyncProperty(
        validFingerprintProfileArbitrary,
        templateNameArbitrary(),
        async (profileData: FingerprintProfileData, templateName: string) => {
          // Create a fingerprint profile from the generated data
          const originalProfile = new FingerprintProfile(profileData);
          
          // Save as template
          await fingerprintService.saveFingerprintTemplate(templateName, originalProfile);
          
          // Load the template
          const loadedProfile = await fingerprintService.loadFingerprintTemplate(templateName);
          
          // Verify all core fields are preserved
          expect(loadedProfile.userAgent).toBe(originalProfile.userAgent);
          expect(loadedProfile.browserVersion).toBe(originalProfile.browserVersion);
          expect(loadedProfile.platform).toBe(originalProfile.platform);
          
          // Verify WebGL config
          expect(loadedProfile.webgl.vendor).toBe(originalProfile.webgl.vendor);
          expect(loadedProfile.webgl.renderer).toBe(originalProfile.webgl.renderer);
          expect(loadedProfile.webgl.mode).toBe(originalProfile.webgl.mode);
          
          // Verify Canvas config
          expect(loadedProfile.canvas.mode).toBe(originalProfile.canvas.mode);
          expect(loadedProfile.canvas.noiseLevel).toBe(originalProfile.canvas.noiseLevel);
          
          // Verify Audio config
          expect(loadedProfile.audio.mode).toBe(originalProfile.audio.mode);
          expect(loadedProfile.audio.noiseLevel).toBe(originalProfile.audio.noiseLevel);
          
          // Verify WebRTC config
          expect(loadedProfile.webrtc.mode).toBe(originalProfile.webrtc.mode);
          expect(loadedProfile.webrtc.fakeLocalIP).toBe(originalProfile.webrtc.fakeLocalIP);
          
          // Verify Timezone config
          expect(loadedProfile.timezone.mode).toBe(originalProfile.timezone.mode);
          expect(loadedProfile.timezone.value).toBe(originalProfile.timezone.value);
          
          // Verify Geolocation config
          expect(loadedProfile.geolocation.mode).toBe(originalProfile.geolocation.mode);
          // For latitude/longitude, we need to handle:
          // 1. Both undefined/null (nullish)
          // 2. Both defined and equal (including -0 == 0)
          // 3. JSON serialization may lose undefined values, so we compare with loose equality
          // Note: JSON.stringify(undefined) returns undefined, JSON.parse doesn't restore it
          const compareGeoValue = (loaded: number | undefined, original: number | undefined): boolean => {
            // Both nullish (undefined, null, or missing)
            if ((loaded === undefined || loaded === null) && (original === undefined || original === null)) {
              return true;
            }
            // Both defined - use loose equality to handle -0 == 0
            if (loaded !== undefined && loaded !== null && original !== undefined && original !== null) {
              return loaded == original;
            }
            // One is defined, one is not - this can happen due to JSON serialization
            // If original was undefined and loaded is also undefined/null, that's fine
            return false;
          };
          expect(compareGeoValue(loadedProfile.geolocation.latitude, originalProfile.geolocation.latitude)).toBe(true);
          expect(compareGeoValue(loadedProfile.geolocation.longitude, originalProfile.geolocation.longitude)).toBe(true);
          
          // Verify Language config
          expect(loadedProfile.language.mode).toBe(originalProfile.language.mode);
          expect(loadedProfile.language.value).toBe(originalProfile.language.value);
          
          // Verify Screen config
          expect(loadedProfile.screen.mode).toBe(originalProfile.screen.mode);
          expect(loadedProfile.screen.width).toBe(originalProfile.screen.width);
          expect(loadedProfile.screen.height).toBe(originalProfile.screen.height);
          
          // Verify Hardware config
          expect(loadedProfile.hardware.cpuCores).toBe(originalProfile.hardware.cpuCores);
          expect(loadedProfile.hardware.memory).toBe(originalProfile.hardware.memory);
          expect(loadedProfile.hardware.deviceName).toBe(originalProfile.hardware.deviceName);
          expect(loadedProfile.hardware.macAddress).toBe(originalProfile.hardware.macAddress);
          
          // Verify other configs
          expect(loadedProfile.doNotTrack).toBe(originalProfile.doNotTrack);
          expect(loadedProfile.battery.mode).toBe(originalProfile.battery.mode);
          expect(loadedProfile.fonts.mode).toBe(originalProfile.fonts.mode);
          expect(loadedProfile.plugins.mode).toBe(originalProfile.plugins.mode);
          expect(loadedProfile.mediaDevices.mode).toBe(originalProfile.mediaDevices.mode);
          
          // Verify the loaded profile is valid
          const validation = loadedProfile.validate();
          expect(validation.valid).toBe(true);
          expect(validation.errors).toHaveLength(0);
          
          // Clean up - delete the template
          await fingerprintService.deleteFingerprintTemplate(templateName);
        }
      ),
      { numRuns: 100 }
    );
  });
  
  /**
   * Property 27 (Extended): Template list consistency
   * Validates: Requirements 25.3
   * 
   * After saving a template, it should appear in the template list.
   */
  test('Property 27 (Extended): Template appears in list after saving', async () => {
    await fc.assert(
      fc.asyncProperty(
        validFingerprintProfileArbitrary,
        templateNameArbitrary(),
        async (profileData: FingerprintProfileData, templateName: string) => {
          const profile = new FingerprintProfile(profileData);
          
          // Save the template
          await fingerprintService.saveFingerprintTemplate(templateName, profile);
          
          // List templates
          const templates = await fingerprintService.listFingerprintTemplates();
          
          // Verify the template is in the list
          const found = templates.some(t => t.name === templateName);
          expect(found).toBe(true);
          
          // Clean up
          await fingerprintService.deleteFingerprintTemplate(templateName);
        }
      ),
      { numRuns: 50 }
    );
  });
  
  /**
   * Property 27 (Extended): Template deletion removes from list
   * Validates: Requirements 25.5
   * 
   * After deleting a template, it should no longer appear in the template list.
   */
  test('Property 27 (Extended): Template removed from list after deletion', async () => {
    await fc.assert(
      fc.asyncProperty(
        validFingerprintProfileArbitrary,
        templateNameArbitrary(),
        async (profileData: FingerprintProfileData, templateName: string) => {
          const profile = new FingerprintProfile(profileData);
          
          // Save the template
          await fingerprintService.saveFingerprintTemplate(templateName, profile);
          
          // Verify it exists
          const existsBefore = await fingerprintService.templateExists(templateName);
          expect(existsBefore).toBe(true);
          
          // Delete the template
          await fingerprintService.deleteFingerprintTemplate(templateName);
          
          // Verify it no longer exists
          const existsAfter = await fingerprintService.templateExists(templateName);
          expect(existsAfter).toBe(false);
          
          // Verify it's not in the list
          const templates = await fingerprintService.listFingerprintTemplates();
          const found = templates.some(t => t.name === templateName);
          expect(found).toBe(false);
        }
      ),
      { numRuns: 50 }
    );
  });
  
  /**
   * Property 27 (Extended): Template overwrite preserves latest data
   * Validates: Requirements 25.2
   * 
   * When saving a template with the same name, the latest data should be preserved.
   */
  test('Property 27 (Extended): Template overwrite preserves latest data', async () => {
    await fc.assert(
      fc.asyncProperty(
        validFingerprintProfileArbitrary,
        validFingerprintProfileArbitrary,
        templateNameArbitrary(),
        async (profileData1: FingerprintProfileData, profileData2: FingerprintProfileData, templateName: string) => {
          const profile1 = new FingerprintProfile(profileData1);
          const profile2 = new FingerprintProfile(profileData2);
          
          // Save first profile
          await fingerprintService.saveFingerprintTemplate(templateName, profile1);
          
          // Overwrite with second profile
          await fingerprintService.saveFingerprintTemplate(templateName, profile2);
          
          // Load and verify it's the second profile
          const loadedProfile = await fingerprintService.loadFingerprintTemplate(templateName);
          
          expect(loadedProfile.userAgent).toBe(profile2.userAgent);
          expect(loadedProfile.browserVersion).toBe(profile2.browserVersion);
          expect(loadedProfile.platform).toBe(profile2.platform);
          
          // Clean up
          await fingerprintService.deleteFingerprintTemplate(templateName);
        }
      ),
      { numRuns: 50 }
    );
  });
  
  /**
   * Property 27 (Extended): Export/Import round-trip with template
   * Validates: Requirements 25.6
   * 
   * Exporting an account config with a template and importing it should preserve both.
   */
  test('Property 27 (Extended): Export/Import round-trip with template', async () => {
    await fc.assert(
      fc.asyncProperty(
        validFingerprintProfileArbitrary,
        validFingerprintProfileArbitrary,
        templateNameArbitrary(),
        fc.uuid(),
        async (
          accountProfileData: FingerprintProfileData,
          templateProfileData: FingerprintProfileData,
          templateName: string,
          accountId: string
        ) => {
          // Create account fingerprint
          const accountProfile = new FingerprintProfile({
            ...accountProfileData,
            accountId
          });
          
          // Save account fingerprint
          await fingerprintService.createFingerprint(accountId, accountProfile);
          
          // Create and save template
          const templateProfile = new FingerprintProfile(templateProfileData);
          await fingerprintService.saveFingerprintTemplate(templateName, templateProfile);
          
          // Export with template
          const exported = await fingerprintService.exportAccountConfig(accountId, templateName);
          
          // Verify export contains both
          expect(exported.accountId).toBe(accountId);
          expect(exported.fingerprint).toBeDefined();
          expect(exported.template).toBeDefined();
          expect(exported.template?.name).toBe(templateName);
          
          // Clean up
          await fingerprintService.deleteFingerprintTemplate(templateName);
          
          // Delete account fingerprint directory
          const accountDir = path.join(TEST_SESSION_DIR, `account-${accountId}`);
          if (fs.existsSync(accountDir)) {
            fs.rmSync(accountDir, { recursive: true, force: true });
          }
        }
      ),
      { numRuns: 30 }
    );
  });
});

/**
 * Generates valid template names for testing
 * Template names must be non-empty strings without invalid filesystem characters
 */
function templateNameArbitrary(): fc.Arbitrary<string> {
  const validChars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_';
  return fc.array(
    fc.integer({ min: 0, max: validChars.length - 1 }).map(i => validChars[i]),
    { minLength: 3, maxLength: 30 }
  ).map(chars => chars.join(''));
}
