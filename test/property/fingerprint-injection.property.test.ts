/**
 * Property-Based Tests for Fingerprint Injection
 * 
 * Feature: professional-fingerprint-browser
 * Tests the fingerprint injection mechanism including WebRTC disabling
 * 
 * @module test/property/fingerprint-injection
 */

import * as fc from 'fast-check';
import { FingerprintInjector } from '../../src/infrastructure/fingerprint/FingerprintInjector';
import { FingerprintScriptGenerator } from '../../src/infrastructure/fingerprint/FingerprintScriptGenerator';
import { FingerprintProfile, FingerprintProfileData, Platform, WebRTCMode } from '../../src/domain/entities/FingerprintProfile';

// Import the valid fingerprint profile arbitrary
const { validFingerprintProfileArbitrary } = require('../arbitraries/fingerprint');

// Arbitraries for injection testing
const platformArbitrary = fc.constantFrom<Platform>('Windows', 'MacOS', 'Linux');
const webrtcModeArbitrary = fc.constantFrom<WebRTCMode>('disabled', 'replaced', 'real');
 

// Set shorter timeout for property tests
jest.setTimeout(30000);

describe('Fingerprint Injection Property Tests', () => {
  /**
   * Feature: professional-fingerprint-browser, Property 16: WebRTC 禁用完整性
   * Validates: Requirements 5.1, 13.1-13.5
   * 
   * For any account with WebRTC mode set to "disabled", the RTCPeerConnection
   * must be undefined in the generated script.
   */
  test('Property 16: WebRTC disabling completeness', () => {
    fc.assert(
      fc.property(
        validFingerprintProfileArbitrary,
        (profileData: FingerprintProfileData) => {
          // Force WebRTC mode to disabled for this test
          const modifiedData = {
            ...profileData,
            webrtc: {
              mode: 'disabled' as WebRTCMode,
              fakeLocalIP: undefined
            }
          };
          
          const profile = new FingerprintProfile(modifiedData);
          
          // Generate the WebRTC script
          const script = FingerprintScriptGenerator.generate(profile, {
            includeWebRTC: true,
            includeUserAgent: false,
            includeWebGL: false,
            includeCanvas: false,
            includeAudio: false,
            includeTimezone: false,
            includeGeolocation: false,
            includeLanguage: false,
            includeScreen: false,
            includeHardware: false,
            includeDoNotTrack: false,
            includeBattery: false,
            includePlugins: false,
            includeMediaDevices: false,
            includeClientRects: false
          });
          
          // Verify the script contains WebRTC disabling code
          expect(script).toContain('delete window.RTCPeerConnection');
          expect(script).toContain('delete window.webkitRTCPeerConnection');
          expect(script).toContain('delete window.mozRTCPeerConnection');
          expect(script).toContain('delete window.RTCDataChannel');
          expect(script).toContain('delete window.RTCSessionDescription');
          expect(script).toContain('delete window.RTCIceCandidate');
          
          // Verify getUserMedia is also blocked
          expect(script).toContain('getUserMedia');
          expect(script).toContain('NotAllowedError');
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Additional test: WebRTC replaced mode generates IP replacement script
   */
  test('Property 16 (Extended): WebRTC replaced mode generates IP replacement', () => {
    fc.assert(
      fc.property(
        validFingerprintProfileArbitrary,
        fc.ipV4(),
        (profileData: FingerprintProfileData, fakeIP: string) => {
          const modifiedData = {
            ...profileData,
            webrtc: {
              mode: 'replaced' as WebRTCMode,
              fakeLocalIP: fakeIP
            }
          };
          
          const profile = new FingerprintProfile(modifiedData);
          
          const script = FingerprintScriptGenerator.generate(profile, {
            includeWebRTC: true,
            includeUserAgent: false,
            includeWebGL: false,
            includeCanvas: false,
            includeAudio: false,
            includeTimezone: false,
            includeGeolocation: false,
            includeLanguage: false,
            includeScreen: false,
            includeHardware: false,
            includeDoNotTrack: false,
            includeBattery: false,
            includePlugins: false,
            includeMediaDevices: false,
            includeClientRects: false
          });
          
          // Verify the script contains IP replacement code
          expect(script).toContain('FAKE_IP');
          expect(script).toContain(fakeIP);
          expect(script).toContain('setLocalDescription');
          expect(script).toContain('sdp');
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Additional test: WebRTC real mode generates no override
   */
  test('Property 16 (Extended): WebRTC real mode generates no override', () => {
    fc.assert(
      fc.property(
        validFingerprintProfileArbitrary,
        (profileData: FingerprintProfileData) => {
          const modifiedData = {
            ...profileData,
            webrtc: {
              mode: 'real' as WebRTCMode
            }
          };
          
          const profile = new FingerprintProfile(modifiedData);
          
          // When WebRTC mode is 'real', the generator skips WebRTC override
          // So we test the generateWebRTCScript directly
          const webrtcScript = FingerprintScriptGenerator['generateWebRTCScript'](profile);
          
          // Verify the script indicates real mode (no override)
          expect(webrtcScript).toContain('Real mode');
          expect(webrtcScript).not.toContain('delete window.RTCPeerConnection');
          expect(webrtcScript).not.toContain('FAKE_IP');
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Additional test: Chromium args include WebRTC flags when disabled
   */
  test('Property 16 (Extended): Chromium args include WebRTC flags when disabled', () => {
    fc.assert(
      fc.property(
        validFingerprintProfileArbitrary,
        (profileData: FingerprintProfileData) => {
          const modifiedData = {
            ...profileData,
            webrtc: {
              mode: 'disabled' as WebRTCMode
            }
          };
          
          const profile = new FingerprintProfile(modifiedData);
          const injector = new FingerprintInjector(profile);
          
          const chromiumArgs = injector.getChromiumArgs();
          
          // Verify WebRTC disable flags are present
          expect(chromiumArgs.args).toContain('--disable-webrtc');
          expect(chromiumArgs.args).toContain('--disable-webrtc-hw-encoding');
          expect(chromiumArgs.args).toContain('--disable-webrtc-hw-decoding');
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  

  /**
   * Additional test: Complete fingerprint script contains all enabled overrides
   */
  test('Property 16 (Extended): Complete fingerprint script contains all enabled overrides', () => {
    fc.assert(
      fc.property(
        validFingerprintProfileArbitrary,
        (profileData: FingerprintProfileData) => {
          const profile = new FingerprintProfile(profileData);
          const injector = new FingerprintInjector(profile);
          
          const script = injector.generateFingerprintScript();
          
          // Verify script is wrapped in IIFE
          expect(script).toContain('(function()');
          expect(script).toContain('})();');
          
          // Verify User-Agent override is present
          expect(script).toContain('navigator');
          expect(script).toContain('userAgent');
          
          // Verify hardware override is present
          expect(script).toContain('hardwareConcurrency');
          expect(script).toContain('deviceMemory');
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Additional test: Injector can update profile
   */
  test('Property 16 (Extended): Injector can update profile', () => {
    fc.assert(
      fc.property(
        validFingerprintProfileArbitrary,
        validFingerprintProfileArbitrary,
        (profileData1: FingerprintProfileData, profileData2: FingerprintProfileData) => {
          const profile1 = new FingerprintProfile(profileData1);
          const profile2 = new FingerprintProfile(profileData2);
          
          const injector = new FingerprintInjector(profile1);
          
          // Verify initial profile
          expect(injector.getProfile().userAgent).toBe(profile1.userAgent);
          
          // Update profile
          injector.updateProfile(profile2);
          
          // Verify updated profile
          expect(injector.getProfile().userAgent).toBe(profile2.userAgent);
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Additional test: Screen override generates correct dimensions
   */
  test('Property 16 (Extended): Screen override generates correct dimensions', () => {
    fc.assert(
      fc.property(
        validFingerprintProfileArbitrary,
        fc.integer({ min: 640, max: 7680 }),
        fc.integer({ min: 480, max: 4320 }),
        (profileData: FingerprintProfileData, width: number, height: number) => {
          const modifiedData = {
            ...profileData,
            screen: {
              mode: 'custom' as const,
              width,
              height
            }
          };
          
          const profile = new FingerprintProfile(modifiedData);
          
          const script = FingerprintScriptGenerator.generate(profile, {
            includeScreen: true,
            includeUserAgent: false,
            includeWebGL: false,
            includeCanvas: false,
            includeAudio: false,
            includeWebRTC: false,
            includeTimezone: false,
            includeGeolocation: false,
            includeLanguage: false,
            includeHardware: false,
            includeDoNotTrack: false,
            includeBattery: false,
            includePlugins: false,
            includeMediaDevices: false,
            includeClientRects: false
          });
          
          // Verify screen dimensions are in the script
          expect(script).toContain(`const WIDTH = ${width}`);
          expect(script).toContain(`const HEIGHT = ${height}`);
          expect(script).toContain("screen, 'width'");
          expect(script).toContain("screen, 'height'");
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Additional test: Chromium args include window size for custom screen
   */
  test('Property 16 (Extended): Chromium args include window size for custom screen', () => {
    fc.assert(
      fc.property(
        validFingerprintProfileArbitrary,
        fc.integer({ min: 640, max: 7680 }),
        fc.integer({ min: 480, max: 4320 }),
        (profileData: FingerprintProfileData, width: number, height: number) => {
          const modifiedData = {
            ...profileData,
            screen: {
              mode: 'custom' as const,
              width,
              height
            }
          };
          
          const profile = new FingerprintProfile(modifiedData);
          const injector = new FingerprintInjector(profile);
          
          const chromiumArgs = injector.getChromiumArgs();
          
          // Verify window size is in args
          expect(chromiumArgs.args).toContain(`--window-size=${width},${height}`);
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Additional test: Automation detection is disabled
   */
  test('Property 16 (Extended): Automation detection is disabled', () => {
    fc.assert(
      fc.property(
        validFingerprintProfileArbitrary,
        (profileData: FingerprintProfileData) => {
          const profile = new FingerprintProfile(profileData);
          const injector = new FingerprintInjector(profile);
          
          const chromiumArgs = injector.getChromiumArgs();
          
          // Verify automation detection is disabled
          expect(chromiumArgs.args).toContain('--disable-blink-features=AutomationControlled');
          expect(chromiumArgs.args).toContain('--disable-infobars');
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});
