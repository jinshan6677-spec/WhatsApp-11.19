/**
 * Property-Based Tests for Smart Matching (IP-based Timezone and Language)
 * 
 * Feature: professional-fingerprint-browser
 * Tests the smart matching functionality that automatically adjusts
 * timezone and language based on IP geolocation (country code).
 * 
 * Property 45: 基于 IP 的时区自动匹配
 * Property 46: 基于 IP 的语言自动匹配
 * 
 * Validates: Requirements 35.2, 14.2
 * 
 * @module test/property/smart-match
 */

import * as fc from 'fast-check';
import { EnvironmentGenerator, TimezoneInfo, LanguageInfo } from '../../src/infrastructure/fingerprint/generators/EnvironmentGenerator';

// Arbitraries for Smart Matching testing

// Country codes that have both timezone and language mappings
const countryCodeArbitrary = fc.constantFrom(
  'US', 'CA', 'GB', 'FR', 'DE', 'IT', 'ES', 'NL', 'RU', 'TR',
  'JP', 'CN', 'HK', 'SG', 'KR', 'TW', 'TH', 'ID', 'IN', 'AE',
  'AU', 'NZ', 'EG', 'ZA', 'NG', 'BR', 'AR', 'MX'
);

// Country codes that have timezone mappings
const countryWithTimezoneArbitrary = fc.constantFrom(
  'US', 'CA', 'MX', 'BR', 'AR', 'GB', 'FR', 'DE', 'IT', 'ES',
  'NL', 'RU', 'TR', 'JP', 'CN', 'HK', 'SG', 'KR', 'TW', 'TH',
  'ID', 'IN', 'AE', 'AU', 'NZ', 'EG', 'ZA', 'NG'
);

// Country codes that have language mappings
const countryWithLanguageArbitrary = fc.constantFrom(
  'US', 'GB', 'AU', 'CA', 'CN', 'TW', 'HK', 'JP', 'KR', 'ES',
  'MX', 'AR', 'FR', 'DE', 'IT', 'BR', 'RU', 'NL', 'TR', 'SA',
  'AE', 'TH', 'VN', 'ID', 'MY', 'IN'
);

describe('Smart Match Property Tests', () => {
  /**
   * Feature: professional-fingerprint-browser, Property 45: 基于 IP 的时区自动匹配
   * Validates: Requirements 35.2, 14.2
   * 
   * For any country code with known timezone mappings, the smart matching
   * system must return a timezone that is valid for that country.
   */
  test('Property 45: IP-based timezone auto-matching', () => {
    fc.assert(
      fc.property(
        countryWithTimezoneArbitrary,
        (countryCode: string) => {
          // Get environment settings for the country
          const env = EnvironmentGenerator.getEnvironmentForCountry(countryCode);
          
          // Verify timezone is returned
          expect(env.timezone).toBeDefined();
          expect(env.timezone.mode).toBe('custom');
          expect(env.timezone.value).toBeDefined();
          
          // Verify the timezone is valid
          const tzValidation = EnvironmentGenerator.validateTimezoneConfig(env.timezone);
          expect(tzValidation.valid).toBe(true);
          expect(tzValidation.errors).toHaveLength(0);
          
          // Verify the timezone exists in the database
          const tzInfo = EnvironmentGenerator.findTimezone(env.timezone.value!);
          expect(tzInfo).not.toBeNull();
          
          // Verify the timezone is associated with the correct country
          // (or is a fallback UTC for countries without specific timezone)
          const countryTimezones = EnvironmentGenerator.getTimezonesByCountry(countryCode);
          if (countryTimezones.length > 0) {
            // The returned timezone should be one of the country's timezones
            const isValidForCountry = countryTimezones.some(
              (tz: TimezoneInfo) => tz.id === env.timezone.value
            );
            expect(isValidForCountry).toBe(true);
          } else {
            // Fallback to UTC for unknown countries
            expect(env.timezone.value).toBe('UTC');
          }
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: professional-fingerprint-browser, Property 46: 基于 IP 的语言自动匹配
   * Validates: Requirements 35.2, 14.2
   * 
   * For any country code with known language mappings, the smart matching
   * system must return a language that is valid for that country.
   */
  test('Property 46: IP-based language auto-matching', () => {
    fc.assert(
      fc.property(
        countryWithLanguageArbitrary,
        (countryCode: string) => {
          // Get environment settings for the country
          const env = EnvironmentGenerator.getEnvironmentForCountry(countryCode);
          
          // Verify language is returned
          expect(env.language).toBeDefined();
          expect(env.language.mode).toBe('custom');
          expect(env.language.value).toBeDefined();
          
          // Verify the language is valid
          const langValidation = EnvironmentGenerator.validateLanguageConfig(env.language);
          expect(langValidation.valid).toBe(true);
          expect(langValidation.errors).toHaveLength(0);
          
          // Verify the language code format is correct (xx-XX)
          expect(env.language.value).toMatch(/^[a-z]{2}-[A-Z]{2}$/);
          
          // Verify the language is associated with the correct country
          // (or is a fallback en-US for countries without specific language)
          const countryLanguages = EnvironmentGenerator.getLanguagesByCountry(countryCode);
          if (countryLanguages.length > 0) {
            // The returned language should be one of the country's languages
            const isValidForCountry = countryLanguages.some(
              (lang: LanguageInfo) => lang.code === env.language.value
            );
            expect(isValidForCountry).toBe(true);
          } else {
            // Fallback to en-US for unknown countries
            expect(env.language.value).toBe('en-US');
          }
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Additional test: Smart matching returns consistent environment settings
   * 
   * For any country code, the smart matching system must return
   * a complete and consistent set of environment settings.
   */
  test('Property 45/46 (Extended): Smart matching returns consistent environment', () => {
    fc.assert(
      fc.property(
        countryCodeArbitrary,
        (countryCode: string) => {
          // Get environment settings for the country
          const env = EnvironmentGenerator.getEnvironmentForCountry(countryCode);
          
          // Verify all components are present
          expect(env).toHaveProperty('timezone');
          expect(env).toHaveProperty('language');
          expect(env).toHaveProperty('geolocation');
          
          // Verify timezone is valid
          const tzValidation = EnvironmentGenerator.validateTimezoneConfig(env.timezone);
          expect(tzValidation.valid).toBe(true);
          
          // Verify language is valid
          const langValidation = EnvironmentGenerator.validateLanguageConfig(env.language);
          expect(langValidation.valid).toBe(true);
          
          // Verify geolocation is valid
          const geoValidation = EnvironmentGenerator.validateGeolocationConfig(env.geolocation);
          expect(geoValidation.valid).toBe(true);
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Additional test: Smart matching is deterministic for same country
   * 
   * For any country code, calling getEnvironmentForCountry multiple times
   * should return the same timezone and language (geolocation may vary due to random offset).
   */
  test('Property 45/46 (Extended): Smart matching is deterministic for timezone and language', () => {
    fc.assert(
      fc.property(
        countryCodeArbitrary,
        (countryCode: string) => {
          // Get environment settings twice
          const env1 = EnvironmentGenerator.getEnvironmentForCountry(countryCode);
          const env2 = EnvironmentGenerator.getEnvironmentForCountry(countryCode);
          
          // Timezone should be the same
          expect(env1.timezone.mode).toBe(env2.timezone.mode);
          expect(env1.timezone.value).toBe(env2.timezone.value);
          
          // Language should be the same
          expect(env1.language.mode).toBe(env2.language.mode);
          expect(env1.language.value).toBe(env2.language.value);
          
          // Geolocation mode should be the same (coordinates may vary)
          expect(env1.geolocation.mode).toBe(env2.geolocation.mode);
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Additional test: Geolocation coordinates are within valid range
   * 
   * For any country code with geolocation data, the coordinates
   * must be within valid latitude/longitude ranges.
   */
  test('Property 45/46 (Extended): Geolocation coordinates are valid', () => {
    fc.assert(
      fc.property(
        countryCodeArbitrary,
        (countryCode: string) => {
          // Get environment settings for the country
          const env = EnvironmentGenerator.getEnvironmentForCountry(countryCode);
          
          // If geolocation has coordinates, verify they are valid
          if (env.geolocation.latitude !== undefined) {
            expect(env.geolocation.latitude).toBeGreaterThanOrEqual(-90);
            expect(env.geolocation.latitude).toBeLessThanOrEqual(90);
          }
          
          if (env.geolocation.longitude !== undefined) {
            expect(env.geolocation.longitude).toBeGreaterThanOrEqual(-180);
            expect(env.geolocation.longitude).toBeLessThanOrEqual(180);
          }
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Additional test: Unknown country codes fall back to defaults
   * 
   * For country codes not in the database, the system should
   * return sensible default values.
   */
  test('Property 45/46 (Extended): Unknown country codes fall back to defaults', () => {
    // Test with some country codes that might not have mappings
    const unknownCountries = ['XX', 'ZZ', 'QQ'];
    
    for (const countryCode of unknownCountries) {
      const env = EnvironmentGenerator.getEnvironmentForCountry(countryCode);
      
      // Should still return valid configurations
      expect(env.timezone).toBeDefined();
      expect(env.language).toBeDefined();
      expect(env.geolocation).toBeDefined();
      
      // Timezone should fall back to UTC
      expect(env.timezone.value).toBe('UTC');
      
      // Language should fall back to en-US
      expect(env.language.value).toBe('en-US');
      
      // Geolocation should be prompt mode (no coordinates)
      expect(env.geolocation.mode).toBe('prompt');
    }
  });

  /**
   * Additional test: Timezone offset is consistent with timezone ID
   * 
   * For any timezone returned by smart matching, the offset
   * should be consistent with the timezone ID.
   */
  test('Property 45 (Extended): Timezone offset is consistent', () => {
    fc.assert(
      fc.property(
        countryWithTimezoneArbitrary,
        (countryCode: string) => {
          const env = EnvironmentGenerator.getEnvironmentForCountry(countryCode);
          
          if (env.timezone.value && env.timezone.value !== 'UTC') {
            const tzInfo = EnvironmentGenerator.findTimezone(env.timezone.value);
            
            if (tzInfo) {
              // Verify the timezone has a valid offset
              expect(typeof tzInfo.offset).toBe('number');
              
              // Verify the timezone has a valid region
              expect(tzInfo.region).toBeTruthy();
              
              // Verify the timezone has a valid country
              expect(tzInfo.country).toBeTruthy();
            }
          }
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Additional test: Language code format is correct
   * 
   * For any language returned by smart matching, the code
   * should follow the xx-XX format (language-COUNTRY).
   */
  test('Property 46 (Extended): Language code format is correct', () => {
    fc.assert(
      fc.property(
        countryWithLanguageArbitrary,
        (countryCode: string) => {
          const env = EnvironmentGenerator.getEnvironmentForCountry(countryCode);
          
          if (env.language.value) {
            // Verify format is xx-XX
            expect(env.language.value).toMatch(/^[a-z]{2}-[A-Z]{2}$/);
            
            // Verify the language exists in the database
            const langInfo = EnvironmentGenerator.findLanguage(env.language.value);
            expect(langInfo).not.toBeNull();
            
            if (langInfo) {
              // Verify the language has a valid name
              expect(langInfo.name).toBeTruthy();
              
              // Verify the language has a valid region
              expect(langInfo.region).toBeTruthy();
            }
          }
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Additional test: Major countries have correct timezone mappings
   * 
   * Verify that major countries return expected timezone values.
   */
  test('Property 45 (Extended): Major countries have correct timezone mappings', () => {
    const expectedMappings: Record<string, string[]> = {
      'US': ['America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles', 'America/Anchorage', 'Pacific/Honolulu'],
      'GB': ['Europe/London'],
      'JP': ['Asia/Tokyo'],
      'CN': ['Asia/Shanghai'],
      'DE': ['Europe/Berlin'],
      'FR': ['Europe/Paris'],
      'AU': ['Australia/Sydney', 'Australia/Melbourne', 'Australia/Perth']
    };
    
    for (const [country, expectedTimezones] of Object.entries(expectedMappings)) {
      const env = EnvironmentGenerator.getEnvironmentForCountry(country);
      
      // The returned timezone should be one of the expected timezones
      expect(expectedTimezones).toContain(env.timezone.value);
    }
  });

  /**
   * Additional test: Major countries have correct language mappings
   * 
   * Verify that major countries return expected language values.
   */
  test('Property 46 (Extended): Major countries have correct language mappings', () => {
    const expectedMappings: Record<string, string[]> = {
      'US': ['en-US'],
      'GB': ['en-GB'],
      'JP': ['ja-JP'],
      'CN': ['zh-CN'],
      'DE': ['de-DE'],
      'FR': ['fr-FR'],
      'ES': ['es-ES'],
      'KR': ['ko-KR'],
      'BR': ['pt-BR']
    };
    
    for (const [country, expectedLanguages] of Object.entries(expectedMappings)) {
      const env = EnvironmentGenerator.getEnvironmentForCountry(country);
      
      // The returned language should be one of the expected languages
      expect(expectedLanguages).toContain(env.language.value);
    }
  });

  /**
   * Additional test: Generated scripts contain correct values
   * 
   * For any country code, the generated override scripts should
   * contain the correct timezone and language values.
   */
  test('Property 45/46 (Extended): Generated scripts contain correct values', () => {
    fc.assert(
      fc.property(
        countryCodeArbitrary,
        (countryCode: string) => {
          const env = EnvironmentGenerator.getEnvironmentForCountry(countryCode);
          
          // Generate timezone script
          const tzScript = EnvironmentGenerator.generateTimezoneScript(env.timezone);
          if (env.timezone.value && env.timezone.mode === 'custom') {
            expect(tzScript).toContain(env.timezone.value);
          }
          
          // Generate language script
          const langScript = EnvironmentGenerator.generateLanguageScript(env.language);
          if (env.language.value && env.language.mode === 'custom') {
            expect(langScript).toContain(env.language.value);
          }
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});
