/**
 * Property-Based Tests for User-Agent Generation
 * 
 * Feature: professional-fingerprint-browser
 * Tests the User-Agent generation, validation, and application
 * 
 * @module test/property/user-agent
 */

import * as fc from 'fast-check';
import { UserAgentGenerator, UserAgentResult } from '../../src/infrastructure/fingerprint/generators/UserAgentGenerator';
import { Platform } from '../../src/domain/entities/FingerprintProfile';

// Arbitraries for User-Agent testing
const platformArbitrary = fc.constantFrom<Platform>('Windows', 'MacOS', 'Linux');

const browserVersionArbitrary = fc.constantFrom(
  'Chrome 120', 'Chrome 119', 'Chrome 118', 'Chrome 117', 'Chrome 116',
  'Chrome 115', 'Chrome 114', 'Chrome 113', 'Chrome 112', 'Chrome 111',
  'Chrome 110', 'Chrome 109', 'Chrome 108',
  'Edge 120', 'Edge 119', 'Edge 118', 'Edge 117', 'Edge 116',
  'Firefox 121', 'Firefox 120', 'Firefox 119', 'Firefox 118', 'Firefox 117',
  'Firefox 116', 'Firefox 115',
  'Safari 17', 'Safari 16', 'Safari 15'
);

describe('User-Agent Property Tests', () => {
  /**
   * Feature: professional-fingerprint-browser, Property 12: User-Agent 生成正确性
   * Validates: Requirements 3.2, 3.3
   * 
   * For any selected browser version and operating system combination,
   * the generated User-Agent must conform to the standard format for that combination.
   */
  test('Property 12: User-Agent generation correctness for browser version and platform', () => {
    fc.assert(
      fc.property(
        browserVersionArbitrary,
        platformArbitrary,
        (browserVersion: string, platform: Platform) => {
          // Skip Safari on non-MacOS platforms (Safari is MacOS only)
          if (browserVersion.startsWith('Safari') && platform !== 'MacOS') {
            return true; // Skip this combination
          }
          
          const userAgent = UserAgentGenerator.generateUserAgent(browserVersion, platform);
          
          // Verify User-Agent is not empty
          expect(userAgent).toBeTruthy();
          expect(userAgent.length).toBeGreaterThan(50);
          
          // Verify User-Agent starts with Mozilla/5.0
          expect(userAgent.startsWith('Mozilla/5.0')).toBe(true);
          
          // Verify platform is correctly reflected in User-Agent
          if (platform === 'Windows') {
            expect(userAgent).toContain('Windows');
          } else if (platform === 'MacOS') {
            expect(userAgent).toContain('Macintosh');
          } else if (platform === 'Linux') {
            expect(userAgent).toMatch(/Linux|X11/);
          }
          
          // Verify browser is correctly reflected in User-Agent
          if (browserVersion.startsWith('Chrome')) {
            expect(userAgent).toContain('Chrome/');
            expect(userAgent).not.toContain('Edg/');
          } else if (browserVersion.startsWith('Edge')) {
            expect(userAgent).toContain('Edg/');
          } else if (browserVersion.startsWith('Firefox')) {
            expect(userAgent).toContain('Firefox/');
          } else if (browserVersion.startsWith('Safari')) {
            expect(userAgent).toContain('Safari/');
            expect(userAgent).toContain('Version/');
          }
          
          // Verify version number is present
          const versionNumber = browserVersion.split(' ')[1];
          if (browserVersion.startsWith('Chrome') || browserVersion.startsWith('Edge')) {
            expect(userAgent).toContain(`${versionNumber}.`);
          } else if (browserVersion.startsWith('Firefox')) {
            expect(userAgent).toContain(`Firefox/${versionNumber}`);
          } else if (browserVersion.startsWith('Safari')) {
            expect(userAgent).toContain(`Version/${versionNumber}`);
          }
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: professional-fingerprint-browser, Property 13: User-Agent 随机生成有效性
   * Validates: Requirements 3.4
   * 
   * For any randomly generated User-Agent, it must be in a valid format
   * and contain reasonable browser and operating system information.
   */
  test('Property 13: Random User-Agent generation validity', () => {
    fc.assert(
      fc.property(
        fc.option(platformArbitrary, { nil: undefined }),
        (platform: Platform | undefined) => {
          const result: UserAgentResult = UserAgentGenerator.generateRandomUserAgent(platform);
          
          // Verify result structure
          expect(result).toHaveProperty('userAgent');
          expect(result).toHaveProperty('browserVersion');
          expect(result).toHaveProperty('platform');
          
          // Verify User-Agent is valid
          const validation = UserAgentGenerator.validateUserAgent(result.userAgent);
          expect(validation.valid).toBe(true);
          expect(validation.errors).toHaveLength(0);
          
          // Verify User-Agent format
          expect(result.userAgent.startsWith('Mozilla/5.0')).toBe(true);
          expect(result.userAgent.length).toBeGreaterThan(50);
          
          // Verify platform consistency
          const extractedPlatform = UserAgentGenerator.extractPlatform(result.userAgent);
          expect(extractedPlatform).toBe(result.platform);
          
          // If platform was specified, verify it's used (except Safari which forces MacOS)
          if (platform && !result.browserVersion.startsWith('Safari')) {
            expect(result.platform).toBe(platform);
          }
          
          // Verify browser version is valid
          const browserInfo = UserAgentGenerator.getBrowserInfo(result.browserVersion);
          expect(browserInfo).not.toBeNull();
          expect(browserInfo!.name).toMatch(/Chrome|Edge|Firefox|Safari/);
          expect(browserInfo!.majorVersion).toBeGreaterThan(0);
          
          // Verify Safari is only on MacOS
          if (result.browserVersion.startsWith('Safari')) {
            expect(result.platform).toBe('MacOS');
          }
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: professional-fingerprint-browser, Property 14: User-Agent 应用正确性
   * Validates: Requirements 3.6
   * 
   * For any configured User-Agent, the extracted browser version and platform
   * must match the original configuration (round-trip consistency).
   */
  test('Property 14: User-Agent application correctness (round-trip)', () => {
    fc.assert(
      fc.property(
        browserVersionArbitrary,
        platformArbitrary,
        (browserVersion: string, platform: Platform) => {
          // Skip Safari on non-MacOS platforms
          if (browserVersion.startsWith('Safari') && platform !== 'MacOS') {
            return true;
          }
          
          // Generate User-Agent
          const userAgent = UserAgentGenerator.generateUserAgent(browserVersion, platform);
          
          // Extract platform from generated User-Agent
          const extractedPlatform = UserAgentGenerator.extractPlatform(userAgent);
          expect(extractedPlatform).toBe(platform);
          
          // Extract browser version from generated User-Agent
          const extractedBrowserVersion = UserAgentGenerator.extractBrowserVersion(userAgent);
          expect(extractedBrowserVersion).not.toBeNull();
          
          // Verify browser name matches
          const originalBrowserName = browserVersion.split(' ')[0];
          expect(extractedBrowserVersion!.startsWith(originalBrowserName)).toBe(true);
          
          // Verify major version matches
          const originalMajorVersion = browserVersion.split(' ')[1];
          const extractedMajorVersion = extractedBrowserVersion!.split(' ')[1];
          expect(extractedMajorVersion).toBe(originalMajorVersion);
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Additional test: Platform update preserves browser information
   */
  test('Property 12 (Extended): Platform update preserves browser information', () => {
    fc.assert(
      fc.property(
        browserVersionArbitrary,
        platformArbitrary,
        platformArbitrary,
        (browserVersion: string, originalPlatform: Platform, newPlatform: Platform) => {
          // Skip Safari on non-MacOS platforms
          if (browserVersion.startsWith('Safari') && originalPlatform !== 'MacOS') {
            return true;
          }
          
          // Generate original User-Agent
          const originalUA = UserAgentGenerator.generateUserAgent(browserVersion, originalPlatform);
          
          // Update platform
          const updatedUA = UserAgentGenerator.updatePlatform(originalUA, newPlatform);
          
          // Verify new platform is reflected
          const extractedPlatform = UserAgentGenerator.extractPlatform(updatedUA);
          expect(extractedPlatform).toBe(newPlatform);
          
          // Verify browser information is preserved
          const originalBrowser = UserAgentGenerator.extractBrowserVersion(originalUA);
          const updatedBrowser = UserAgentGenerator.extractBrowserVersion(updatedUA);
          
          // Browser name and version should be preserved
          if (originalBrowser && updatedBrowser) {
            expect(updatedBrowser.split(' ')[0]).toBe(originalBrowser.split(' ')[0]);
          }
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Additional test: Validation correctly identifies invalid User-Agents
   */
  test('Property 13 (Extended): Validation correctly identifies invalid User-Agents', () => {
    const invalidUserAgents = [
      '', // Empty
      'Invalid UA', // Too short
      'Some random text that is long enough but has no browser info',
      'Mozilla/4.0 (compatible; MSIE 6.0; Windows NT 5.1)', // Old format without modern browser
    ];
    
    for (const ua of invalidUserAgents) {
      const validation = UserAgentGenerator.validateUserAgent(ua);
      expect(validation.valid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    }
  });

  /**
   * Additional test: All available browser versions generate valid User-Agents
   */
  test('Property 12 (Extended): All available browser versions generate valid User-Agents', () => {
    const versions = UserAgentGenerator.getAvailableBrowserVersions();
    const platforms: Platform[] = ['Windows', 'MacOS', 'Linux'];
    
    for (const version of versions) {
      for (const platform of platforms) {
        // Skip Safari on non-MacOS
        if (version.startsWith('Safari') && platform !== 'MacOS') {
          continue;
        }
        
        const userAgent = UserAgentGenerator.generateUserAgent(version, platform);
        const validation = UserAgentGenerator.validateUserAgent(userAgent);
        
        expect(validation.valid).toBe(true);
        expect(validation.errors).toHaveLength(0);
      }
    }
  });

  /**
   * Additional test: Random generation produces diverse results
   */
  test('Property 13 (Extended): Random generation produces diverse results', () => {
    const results: Set<string> = new Set();
    const iterations = 50;
    
    for (let i = 0; i < iterations; i++) {
      const result = UserAgentGenerator.generateRandomUserAgent();
      results.add(result.userAgent);
    }
    
    // With 50 iterations, we should have at least 5 unique User-Agents
    // (accounting for random selection from limited browser/platform combinations)
    expect(results.size).toBeGreaterThan(5);
  });
});
