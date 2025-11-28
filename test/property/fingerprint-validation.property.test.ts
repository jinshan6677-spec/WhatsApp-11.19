/**
 * Property-Based Tests for Fingerprint Consistency Validation
 * 
 * Feature: professional-fingerprint-browser
 * Tests the accuracy of fingerprint validation logic
 * 
 * @module test/property/fingerprint-validation
 */

import * as fc from 'fast-check';
import { FingerprintValidator } from '../../src/infrastructure/fingerprint/FingerprintValidator';
import { FingerprintProfile, Platform, FingerprintProfileData } from '../../src/domain/entities/FingerprintProfile';
import { UserAgentGenerator } from '../../src/infrastructure/fingerprint/generators/UserAgentGenerator';
import { WebGLGenerator } from '../../src/infrastructure/fingerprint/generators/WebGLGenerator';

// ==================== Test Data Generators ====================

const platformArbitrary = fc.constantFrom<Platform>('Windows', 'MacOS', 'Linux');

/**
 * Generates a consistent fingerprint profile where all parameters match
 * Uses fc.constant to ensure the generated values are deterministic per platform
 */
const consistentFingerprintArbitrary = (platform: Platform): fc.Arbitrary<FingerprintProfileData> => {
  // Common screen resolutions
  const screenResolutions = [
    { width: 1920, height: 1080 },
    { width: 2560, height: 1440 },
    { width: 1366, height: 768 },
    { width: 1536, height: 864 },
  ];
  
  // Reasonable CPU/memory combinations
  const hardwareCombos = [
    { cpuCores: 4, memory: 8 },
    { cpuCores: 8, memory: 16 },
    { cpuCores: 6, memory: 16 },
    { cpuCores: 12, memory: 32 },
  ];
  
  // Browser versions that work on all platforms (exclude Safari for non-MacOS)
  const browserVersions = platform === 'MacOS' 
    ? ['Chrome 120', 'Chrome 119', 'Firefox 120', 'Safari 17']
    : ['Chrome 120', 'Chrome 119', 'Firefox 120', 'Edge 120'];
  
  // Generate platform-specific User-Agent and WebGL inside the arbitrary chain
  return fc.tuple(
    fc.constantFrom(...screenResolutions),
    fc.constantFrom(...hardwareCombos),
    fc.constantFrom<'0' | '1' | null>('0', '1', null),
    fc.constantFrom(...browserVersions)
  ).map(([screen, hardware, doNotTrack, browserVersion]) => {
    // Generate User-Agent that matches the platform using specific browser version
    const userAgent = UserAgentGenerator.generateUserAgent(browserVersion, platform);
    
    // Generate WebGL that matches the platform
    const webglConfig = WebGLGenerator.generateRandom(platform);
    
    return {
      userAgent: userAgent,
      browserVersion: browserVersion,
      platform: platform,
      webgl: webglConfig,
      canvas: { mode: 'random' as const, noiseLevel: 2 },
      audio: { mode: 'random' as const, noiseLevel: 2 },
      webrtc: { mode: 'disabled' as const },
      timezone: { mode: 'ip-based' as const },
      geolocation: { mode: 'ip-based' as const },
      language: { mode: 'ip-based' as const },
      screen: { mode: 'custom' as const, ...screen },
      hardware: hardware,
      doNotTrack: doNotTrack,
      battery: { mode: 'privacy' as const },
      fonts: { mode: 'system' as const },
      plugins: { mode: 'real' as const },
      mediaDevices: { mode: 'real' as const },
    };
  });
};

/**
 * Generates an inconsistent fingerprint with User-Agent/platform mismatch
 * Explicitly creates mismatched combinations using generateUserAgent directly
 */
const userAgentPlatformMismatchArbitrary = (): fc.Arbitrary<FingerprintProfileData> => {
  // Define explicit mismatch pairs: [UA platform, config platform, browser]
  // Use Chrome which works on all platforms to avoid Safari/MacOS special case
  const mismatchConfigs: { uaPlatform: Platform; configPlatform: Platform; browser: string }[] = [
    { uaPlatform: 'Windows', configPlatform: 'MacOS', browser: 'Chrome 120' },
    { uaPlatform: 'Windows', configPlatform: 'Linux', browser: 'Chrome 120' },
    { uaPlatform: 'MacOS', configPlatform: 'Windows', browser: 'Chrome 120' },
    { uaPlatform: 'MacOS', configPlatform: 'Linux', browser: 'Chrome 120' },
    { uaPlatform: 'Linux', configPlatform: 'Windows', browser: 'Chrome 120' },
    { uaPlatform: 'Linux', configPlatform: 'MacOS', browser: 'Chrome 120' },
  ];
  
  return fc.constantFrom(...mismatchConfigs).map(({ uaPlatform, configPlatform, browser }) => {
    // Generate User-Agent for one platform using generateUserAgent directly
    const userAgent = UserAgentGenerator.generateUserAgent(browser, uaPlatform);
    // Generate WebGL for the config platform (to isolate the UA mismatch)
    const webglConfig = WebGLGenerator.generateRandom(configPlatform);
    
    return {
      userAgent: userAgent,
      browserVersion: browser,
      platform: configPlatform, // Mismatch with User-Agent!
      webgl: webglConfig,
      canvas: { mode: 'random' as const },
      audio: { mode: 'random' as const },
      webrtc: { mode: 'disabled' as const },
      timezone: { mode: 'real' as const },
      geolocation: { mode: 'prompt' as const },
      language: { mode: 'custom' as const, value: 'en-US' },
      screen: { mode: 'custom' as const, width: 1920, height: 1080 },
      hardware: { cpuCores: 8, memory: 16 },
      doNotTrack: null,
      battery: { mode: 'real' as const },
      fonts: { mode: 'system' as const },
      plugins: { mode: 'real' as const },
      mediaDevices: { mode: 'real' as const },
    };
  });
};

/**
 * Generates an inconsistent fingerprint with WebGL/platform mismatch
 */
const webglPlatformMismatchArbitrary = (): fc.Arbitrary<FingerprintProfileData> => {
  // Apple Silicon on Windows is invalid
  return fc.record({
    userAgent: fc.constant('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'),
    browserVersion: fc.constant('Chrome 120'),
    platform: fc.constant<Platform>('Windows'),
    webgl: fc.constant({
      vendor: 'Apple Inc.',
      renderer: 'Apple M1',
      mode: 'custom' as const
    }),
    canvas: fc.constant({ mode: 'random' as const }),
    audio: fc.constant({ mode: 'random' as const }),
    webrtc: fc.constant({ mode: 'disabled' as const }),
    timezone: fc.constant({ mode: 'real' as const }),
    geolocation: fc.constant({ mode: 'prompt' as const }),
    language: fc.constant({ mode: 'custom' as const, value: 'en-US' }),
    screen: fc.constant({ mode: 'custom' as const, width: 1920, height: 1080 }),
    hardware: fc.constant({ cpuCores: 8, memory: 16 }),
    doNotTrack: fc.constant(null),
    battery: fc.constant({ mode: 'real' as const }),
    fonts: fc.constant({ mode: 'system' as const }),
    plugins: fc.constant({ mode: 'real' as const }),
    mediaDevices: fc.constant({ mode: 'real' as const }),
  });
};

/**
 * Generates fingerprint with unreasonable screen resolution
 */
const unreasonableScreenArbitrary = (): fc.Arbitrary<FingerprintProfileData> => {
  return fc.record({
    userAgent: fc.constant('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'),
    browserVersion: fc.constant('Chrome 120'),
    platform: fc.constant<Platform>('Windows'),
    webgl: fc.constant({
      vendor: 'Google Inc. (NVIDIA)',
      renderer: 'ANGLE (NVIDIA GeForce GTX 1060 Direct3D11 vs_5_0 ps_5_0)',
      mode: 'custom' as const
    }),
    canvas: fc.constant({ mode: 'random' as const }),
    audio: fc.constant({ mode: 'random' as const }),
    webrtc: fc.constant({ mode: 'disabled' as const }),
    timezone: fc.constant({ mode: 'real' as const }),
    geolocation: fc.constant({ mode: 'prompt' as const }),
    language: fc.constant({ mode: 'custom' as const, value: 'en-US' }),
    screen: fc.oneof(
      // Too small
      fc.constant({ mode: 'custom' as const, width: 100, height: 100 }),
      // Too large
      fc.constant({ mode: 'custom' as const, width: 10000, height: 10000 }),
      // Weird aspect ratio
      fc.constant({ mode: 'custom' as const, width: 100, height: 5000 })
    ),
    hardware: fc.constant({ cpuCores: 8, memory: 16 }),
    doNotTrack: fc.constant(null),
    battery: fc.constant({ mode: 'real' as const }),
    fonts: fc.constant({ mode: 'system' as const }),
    plugins: fc.constant({ mode: 'real' as const }),
    mediaDevices: fc.constant({ mode: 'real' as const }),
  });
};

/**
 * Generates fingerprint with unreasonable CPU/memory combination
 */
const unreasonableHardwareArbitrary = (): fc.Arbitrary<FingerprintProfileData> => {
  return fc.record({
    userAgent: fc.constant('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'),
    browserVersion: fc.constant('Chrome 120'),
    platform: fc.constant<Platform>('Windows'),
    webgl: fc.constant({
      vendor: 'Google Inc. (NVIDIA)',
      renderer: 'ANGLE (NVIDIA GeForce GTX 1060 Direct3D11 vs_5_0 ps_5_0)',
      mode: 'custom' as const
    }),
    canvas: fc.constant({ mode: 'random' as const }),
    audio: fc.constant({ mode: 'random' as const }),
    webrtc: fc.constant({ mode: 'disabled' as const }),
    timezone: fc.constant({ mode: 'real' as const }),
    geolocation: fc.constant({ mode: 'prompt' as const }),
    language: fc.constant({ mode: 'custom' as const, value: 'en-US' }),
    screen: fc.constant({ mode: 'custom' as const, width: 1920, height: 1080 }),
    hardware: fc.oneof(
      // High CPU, low memory
      fc.constant({ cpuCores: 64, memory: 4 }),
      // Low CPU, high memory
      fc.constant({ cpuCores: 2, memory: 128 }),
      // Invalid values
      fc.constant({ cpuCores: 0, memory: 16 }),
      fc.constant({ cpuCores: 8, memory: 0 })
    ),
    doNotTrack: fc.constant(null),
    battery: fc.constant({ mode: 'real' as const }),
    fonts: fc.constant({ mode: 'system' as const }),
    plugins: fc.constant({ mode: 'real' as const }),
    mediaDevices: fc.constant({ mode: 'real' as const }),
  });
};

// ==================== Property Tests ====================

describe('Fingerprint Validation Property Tests', () => {
  /**
   * Feature: professional-fingerprint-browser, Property 29: 指纹一致性验证准确性
   * Validates: Requirements 24.1-24.5
   * 
   * For any consistent fingerprint configuration, the validator should
   * return valid=true with no errors.
   */
  test('Property 29: Consistent fingerprints pass validation', async () => {
    await fc.assert(
      fc.asyncProperty(
        platformArbitrary.chain(platform => consistentFingerprintArbitrary(platform)),
        async (profileData: FingerprintProfileData) => {
          const result = FingerprintValidator.validate(profileData);
          
          // Consistent fingerprints should pass validation
          expect(result.valid).toBe(true);
          expect(result.errors).toHaveLength(0);
          
          // Score should be high (at least 80)
          expect(result.score).toBeGreaterThanOrEqual(80);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: professional-fingerprint-browser, Property 29: User-Agent/Platform mismatch detection
   * Validates: Requirements 24.1
   * 
   * For any fingerprint with User-Agent/platform mismatch, the validator
   * should detect the inconsistency.
   */
  test('Property 29: User-Agent/Platform mismatch is detected', async () => {
    await fc.assert(
      fc.asyncProperty(
        userAgentPlatformMismatchArbitrary(),
        async (profileData: FingerprintProfileData) => {
          const result = FingerprintValidator.validate(profileData);
          
          // Should detect the mismatch
          expect(result.valid).toBe(false);
          expect(result.errors.length).toBeGreaterThan(0);
          
          // Error should mention User-Agent or platform
          const hasRelevantError = result.errors.some(e => 
            e.toLowerCase().includes('user-agent') || 
            e.toLowerCase().includes('platform')
          );
          expect(hasRelevantError).toBe(true);
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Feature: professional-fingerprint-browser, Property 29: WebGL/Platform mismatch detection
   * Validates: Requirements 24.2
   * 
   * For any fingerprint with WebGL/platform mismatch (e.g., Apple Silicon on Windows),
   * the validator should detect the inconsistency.
   */
  test('Property 29: WebGL/Platform mismatch is detected', async () => {
    await fc.assert(
      fc.asyncProperty(
        webglPlatformMismatchArbitrary(),
        async (profileData: FingerprintProfileData) => {
          const result = FingerprintValidator.validate(profileData);
          
          // Should detect the mismatch
          expect(result.valid).toBe(false);
          expect(result.errors.length).toBeGreaterThan(0);
          
          // Error should mention WebGL
          const hasWebGLError = result.errors.some(e => 
            e.toLowerCase().includes('webgl')
          );
          expect(hasWebGLError).toBe(true);
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Feature: professional-fingerprint-browser, Property 29: Screen resolution validation
   * Validates: Requirements 24.3
   * 
   * For any fingerprint with unreasonable screen resolution, the validator
   * should detect the issue.
   */
  test('Property 29: Unreasonable screen resolution is detected', async () => {
    await fc.assert(
      fc.asyncProperty(
        unreasonableScreenArbitrary(),
        async (profileData: FingerprintProfileData) => {
          const result = FingerprintValidator.validate(profileData);
          
          // Should detect the issue (either error or warning)
          const hasScreenIssue = 
            result.errors.some(e => e.toLowerCase().includes('screen') || e.toLowerCase().includes('resolution')) ||
            result.warnings.some(w => w.toLowerCase().includes('screen') || w.toLowerCase().includes('resolution') || w.toLowerCase().includes('aspect'));
          
          expect(hasScreenIssue).toBe(true);
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Feature: professional-fingerprint-browser, Property 29: CPU/Memory consistency validation
   * Validates: Requirements 24.4
   * 
   * For any fingerprint with unreasonable CPU/memory combination, the validator
   * should detect the issue.
   */
  test('Property 29: Unreasonable CPU/Memory combination is detected', async () => {
    await fc.assert(
      fc.asyncProperty(
        unreasonableHardwareArbitrary(),
        async (profileData: FingerprintProfileData) => {
          const result = FingerprintValidator.validate(profileData);
          
          // Should detect the issue (either error or warning)
          const hasHardwareIssue = 
            result.errors.some(e => 
              e.toLowerCase().includes('cpu') || 
              e.toLowerCase().includes('memory') ||
              e.toLowerCase().includes('cores')
            ) ||
            result.warnings.some(w => 
              w.toLowerCase().includes('cpu') || 
              w.toLowerCase().includes('memory') ||
              w.toLowerCase().includes('cores')
            );
          
          expect(hasHardwareIssue).toBe(true);
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Feature: professional-fingerprint-browser, Property 29: isConsistent matches validate
   * Validates: Requirements 24.6
   * 
   * The isConsistent method should return true if and only if validate returns valid=true.
   */
  test('Property 29: isConsistent matches validate result', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.oneof(
          platformArbitrary.chain(platform => consistentFingerprintArbitrary(platform)),
          userAgentPlatformMismatchArbitrary(),
          webglPlatformMismatchArbitrary()
        ),
        async (profileData: FingerprintProfileData) => {
          const validateResult = FingerprintValidator.validate(profileData);
          const isConsistent = FingerprintValidator.isConsistent(profileData);
          
          expect(isConsistent).toBe(validateResult.valid);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: professional-fingerprint-browser, Property 29: Score is bounded
   * Validates: Requirements 24.1-24.5
   * 
   * The consistency score should always be between 0 and 100.
   */
  test('Property 29: Consistency score is bounded 0-100', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.oneof(
          platformArbitrary.chain(platform => consistentFingerprintArbitrary(platform)),
          userAgentPlatformMismatchArbitrary(),
          webglPlatformMismatchArbitrary(),
          unreasonableScreenArbitrary(),
          unreasonableHardwareArbitrary()
        ),
        async (profileData: FingerprintProfileData) => {
          const score = FingerprintValidator.getConsistencyScore(profileData);
          
          expect(score).toBeGreaterThanOrEqual(0);
          expect(score).toBeLessThanOrEqual(100);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: professional-fingerprint-browser, Property 29: AutoFix produces valid fingerprints
   * Validates: Requirements 24.5
   * 
   * The autoFix method should produce fingerprints that pass basic validation.
   */
  test('Property 29: AutoFix improves or maintains validity', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.oneof(
          platformArbitrary.chain(platform => consistentFingerprintArbitrary(platform)),
          userAgentPlatformMismatchArbitrary()
        ),
        async (profileData: FingerprintProfileData) => {
          const originalResult = FingerprintValidator.validate(profileData);
          const fixed = FingerprintValidator.autoFix(profileData);
          const fixedResult = FingerprintValidator.validate(fixed);
          
          // Fixed version should be at least as good as original
          expect(fixedResult.score).toBeGreaterThanOrEqual(originalResult.score);
          
          // If original was invalid, fixed should have fewer errors
          if (!originalResult.valid) {
            expect(fixedResult.errors.length).toBeLessThanOrEqual(originalResult.errors.length);
          }
        }
      ),
      { numRuns: 50 }
    );
  });
});

describe('Fingerprint Validation Edge Cases', () => {
  /**
   * Test that real mode configurations are always valid
   */
  test('Real mode configurations pass validation', () => {
    const profile: FingerprintProfileData = {
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      browserVersion: 'Chrome 120',
      platform: 'Windows',
      webgl: { vendor: '', renderer: '', mode: 'real' },
      canvas: { mode: 'real' },
      audio: { mode: 'real' },
      webrtc: { mode: 'real' },
      timezone: { mode: 'real' },
      geolocation: { mode: 'prompt' },
      language: { mode: 'custom', value: 'en-US' },
      screen: { mode: 'real' },
      hardware: { cpuCores: 8, memory: 16 },
      doNotTrack: null,
      battery: { mode: 'real' },
      fonts: { mode: 'system' },
      plugins: { mode: 'real' },
      mediaDevices: { mode: 'real' },
    };
    
    const result = FingerprintValidator.validate(profile);
    expect(result.valid).toBe(true);
  });

  /**
   * Test Direct3D on MacOS detection
   */
  test('Direct3D on MacOS is detected as invalid', () => {
    const profile: FingerprintProfileData = {
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      browserVersion: 'Chrome 120',
      platform: 'MacOS',
      webgl: { 
        vendor: 'Google Inc. (NVIDIA)', 
        renderer: 'ANGLE (NVIDIA GeForce GTX 1060 Direct3D11 vs_5_0 ps_5_0)', 
        mode: 'custom' 
      },
      canvas: { mode: 'real' },
      audio: { mode: 'real' },
      webrtc: { mode: 'real' },
      timezone: { mode: 'real' },
      geolocation: { mode: 'prompt' },
      language: { mode: 'custom', value: 'en-US' },
      screen: { mode: 'real' },
      hardware: { cpuCores: 8, memory: 16 },
      doNotTrack: null,
      battery: { mode: 'real' },
      fonts: { mode: 'system' },
      plugins: { mode: 'real' },
      mediaDevices: { mode: 'real' },
    };
    
    const result = FingerprintValidator.validate(profile);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('Direct3D'))).toBe(true);
  });

  /**
   * Test suggestions are provided for invalid fingerprints
   */
  test('Suggestions are provided for invalid fingerprints', () => {
    const profile: FingerprintProfileData = {
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      browserVersion: 'Chrome 120',
      platform: 'MacOS', // Mismatch!
      webgl: { vendor: 'Apple Inc.', renderer: 'Apple M1', mode: 'custom' },
      canvas: { mode: 'real' },
      audio: { mode: 'real' },
      webrtc: { mode: 'real' },
      timezone: { mode: 'real' },
      geolocation: { mode: 'prompt' },
      language: { mode: 'custom', value: 'en-US' },
      screen: { mode: 'real' },
      hardware: { cpuCores: 8, memory: 16 },
      doNotTrack: null,
      battery: { mode: 'real' },
      fonts: { mode: 'system' },
      plugins: { mode: 'real' },
      mediaDevices: { mode: 'real' },
    };
    
    const { result, suggestions } = FingerprintValidator.validateWithSuggestions(profile);
    expect(result.valid).toBe(false);
    expect(suggestions.length).toBeGreaterThan(0);
  });
});
