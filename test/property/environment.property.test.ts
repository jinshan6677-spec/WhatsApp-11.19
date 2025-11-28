/**
 * Property-Based Tests for Environment Configuration
 * 
 * Feature: professional-fingerprint-browser
 * Tests the timezone, geolocation, and language configuration
 * 
 * @module test/property/environment
 */

import * as fc from 'fast-check';
import { EnvironmentGenerator } from '../../src/infrastructure/fingerprint/generators/EnvironmentGenerator';
import { TimezoneMode, GeolocationMode, LanguageMode } from '../../src/domain/entities/FingerprintProfile';

// Arbitraries for Environment testing
const timezoneModeArbitrary = fc.constantFrom<TimezoneMode>('ip-based', 'real', 'custom');
const geolocationModeArbitrary = fc.constantFrom<GeolocationMode>('ip-based', 'prompt', 'deny');
const languageModeArbitrary = fc.constantFrom<LanguageMode>('ip-based', 'custom');

const timezoneIdArbitrary = fc.constantFrom(
  'America/New_York', 'America/Los_Angeles', 'Europe/London', 'Europe/Paris',
  'Asia/Tokyo', 'Asia/Shanghai', 'Australia/Sydney', 'UTC'
);

const languageCodeArbitrary = fc.constantFrom(
  'en-US', 'en-GB', 'zh-CN', 'zh-TW', 'ja-JP', 'ko-KR',
  'es-ES', 'fr-FR', 'de-DE', 'pt-BR', 'ru-RU'
);

const countryCodeArbitrary = fc.constantFrom(
  'US', 'CA', 'GB', 'FR', 'DE', 'JP', 'CN', 'KR', 'AU', 'BR'
);

const latitudeArbitrary = fc.double({ min: -90, max: 90, noNaN: true });
const longitudeArbitrary = fc.double({ min: -180, max: 180, noNaN: true });

describe('Environment Property Tests', () => {
  /**
   * Feature: professional-fingerprint-browser, Property 19: 时区配置正确性
   * Validates: Requirements 7.1-7.3
   * 
   * For any timezone configuration, the generated override script
   * must correctly set the timezone to the specified value.
   */
  test('Property 19: Timezone configuration correctness', () => {
    fc.assert(
      fc.property(
        timezoneIdArbitrary,
        (timezoneId: string) => {
          // Create timezone config
          const config = EnvironmentGenerator.createTimezoneConfig('custom', timezoneId);
          
          // Validate config
          const validation = EnvironmentGenerator.validateTimezoneConfig(config);
          expect(validation.valid).toBe(true);
          expect(validation.errors).toHaveLength(0);

          
          // Generate script
          const script = EnvironmentGenerator.generateTimezoneScript(config);
          
          // Verify script is not empty
          expect(script).toBeTruthy();
          expect(script.length).toBeGreaterThan(0);
          
          // Verify script contains the timezone value
          expect(script).toContain(timezoneId);
          
          // Verify script overrides Intl.DateTimeFormat
          expect(script).toContain('DateTimeFormat');
          
          // Verify script overrides getTimezoneOffset
          expect(script).toContain('getTimezoneOffset');
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: professional-fingerprint-browser, Property 21: 语言配置正确性
   * Validates: Requirements 7.7, 7.8
   * 
   * For any language configuration, the generated override script
   * must correctly set navigator.language and navigator.languages.
   */
  test('Property 21: Language configuration correctness', () => {
    fc.assert(
      fc.property(
        languageCodeArbitrary,
        (languageCode: string) => {
          // Create language config
          const config = EnvironmentGenerator.createLanguageConfig('custom', languageCode);
          
          // Validate config
          const validation = EnvironmentGenerator.validateLanguageConfig(config);
          expect(validation.valid).toBe(true);
          expect(validation.errors).toHaveLength(0);
          
          // Generate script
          const script = EnvironmentGenerator.generateLanguageScript(config);
          
          // Verify script is not empty
          expect(script).toBeTruthy();
          expect(script.length).toBeGreaterThan(0);
          
          // Verify script contains the language code
          expect(script).toContain(languageCode);
          
          // Verify script overrides navigator.language
          expect(script).toContain('navigator');
          expect(script).toContain('language');
          
          // Verify script overrides navigator.languages
          expect(script).toContain('languages');
          
          // Verify script makes properties non-configurable
          expect(script).toContain('configurable: false');
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Additional test: Geolocation configuration correctness
   * Validates: Requirements 7.4-7.6
   */
  test('Property 19 (Extended): Geolocation configuration correctness', () => {
    fc.assert(
      fc.property(
        latitudeArbitrary,
        longitudeArbitrary,
        (latitude: number, longitude: number) => {
          // Create geolocation config
          const config = EnvironmentGenerator.createGeolocationConfig('ip-based', latitude, longitude);
          
          // Validate config
          const validation = EnvironmentGenerator.validateGeolocationConfig(config);
          expect(validation.valid).toBe(true);
          expect(validation.errors).toHaveLength(0);
          
          // Generate script
          const script = EnvironmentGenerator.generateGeolocationScript(config);
          
          // Verify script is not empty
          expect(script).toBeTruthy();
          expect(script.length).toBeGreaterThan(0);
          
          // Verify script contains coordinates
          expect(script).toContain('LATITUDE');
          expect(script).toContain('LONGITUDE');
          
          // Verify script overrides geolocation methods
          expect(script).toContain('getCurrentPosition');
          expect(script).toContain('watchPosition');
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Additional test: Timezone real mode produces no override
   */
  test('Property 19 (Extended): Timezone real mode produces no override', () => {
    const config = EnvironmentGenerator.createTimezoneConfig('real');
    const script = EnvironmentGenerator.generateTimezoneScript(config);
    
    expect(script).toContain('Real mode');
    expect(script).toContain('no override');
  });

  /**
   * Additional test: Geolocation deny mode blocks access
   */
  test('Property 19 (Extended): Geolocation deny mode blocks access', () => {
    const config = EnvironmentGenerator.createGeolocationConfig('deny');
    const script = EnvironmentGenerator.generateGeolocationScript(config);
    
    expect(script).toContain('Geolocation Denied');
    expect(script).toContain('User denied Geolocation');
  });

  /**
   * Additional test: Geolocation prompt mode produces no override
   */
  test('Property 19 (Extended): Geolocation prompt mode produces no override', () => {
    const config = EnvironmentGenerator.createGeolocationConfig('prompt');
    const script = EnvironmentGenerator.generateGeolocationScript(config);
    
    expect(script).toContain('Prompt mode');
    expect(script).toContain('no override');
  });

  /**
   * Additional test: Environment for country produces consistent settings
   */
  test('Property 21 (Extended): Environment for country produces consistent settings', () => {
    fc.assert(
      fc.property(
        countryCodeArbitrary,
        (countryCode: string) => {
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
   * Additional test: Random timezone generation produces valid configs
   */
  test('Property 19 (Extended): Random timezone generation produces valid configs', () => {
    fc.assert(
      fc.property(
        fc.constant(null),
        () => {
          const config = EnvironmentGenerator.generateRandomTimezone();
          
          // Verify config is valid
          const validation = EnvironmentGenerator.validateTimezoneConfig(config);
          expect(validation.valid).toBe(true);
          
          // Verify timezone exists in database
          const tzInfo = EnvironmentGenerator.findTimezone(config.value!);
          expect(tzInfo).not.toBeNull();
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Additional test: Random language generation produces valid configs
   */
  test('Property 21 (Extended): Random language generation produces valid configs', () => {
    fc.assert(
      fc.property(
        fc.constant(null),
        () => {
          const config = EnvironmentGenerator.generateRandomLanguage();
          
          // Verify config is valid
          const validation = EnvironmentGenerator.validateLanguageConfig(config);
          expect(validation.valid).toBe(true);
          
          // Verify language exists in database
          const langInfo = EnvironmentGenerator.findLanguage(config.value!);
          expect(langInfo).not.toBeNull();
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Additional test: Random geolocation generation produces valid configs
   */
  test('Property 19 (Extended): Random geolocation generation produces valid configs', () => {
    fc.assert(
      fc.property(
        fc.constant(null),
        () => {
          const config = EnvironmentGenerator.generateRandomGeolocation();
          
          // Verify config is valid
          const validation = EnvironmentGenerator.validateGeolocationConfig(config);
          expect(validation.valid).toBe(true);
          
          // If coordinates are present, verify they are in valid range
          if (config.latitude !== undefined) {
            expect(config.latitude).toBeGreaterThanOrEqual(-90);
            expect(config.latitude).toBeLessThanOrEqual(90);
          }
          
          if (config.longitude !== undefined) {
            expect(config.longitude).toBeGreaterThanOrEqual(-180);
            expect(config.longitude).toBeLessThanOrEqual(180);
          }
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Additional test: Invalid configurations are detected
   */
  test('Property 19 (Extended): Invalid configurations are detected', () => {
    // Invalid timezone
    const invalidTz = EnvironmentGenerator.validateTimezoneConfig({
      mode: 'custom',
      value: undefined
    });
    expect(invalidTz.valid).toBe(false);
    
    // Invalid language
    const invalidLang = EnvironmentGenerator.validateLanguageConfig({
      mode: 'custom',
      value: undefined
    });
    expect(invalidLang.valid).toBe(false);
    
    // Invalid geolocation (latitude out of range)
    const invalidGeo = EnvironmentGenerator.validateGeolocationConfig({
      mode: 'ip-based',
      latitude: 100, // Invalid
      longitude: 0
    });
    expect(invalidGeo.valid).toBe(false);
  });

  /**
   * Additional test: Combined script includes all components
   */
  test('Property 21 (Extended): Combined script includes all components', () => {
    fc.assert(
      fc.property(
        timezoneIdArbitrary,
        languageCodeArbitrary,
        latitudeArbitrary,
        longitudeArbitrary,
        (timezoneId: string, languageCode: string, latitude: number, longitude: number) => {
          const timezone = EnvironmentGenerator.createTimezoneConfig('custom', timezoneId);
          const language = EnvironmentGenerator.createLanguageConfig('custom', languageCode);
          const geolocation = EnvironmentGenerator.createGeolocationConfig('ip-based', latitude, longitude);
          
          const script = EnvironmentGenerator.generateCombinedScript(timezone, geolocation, language);
          
          // Verify script contains all components
          expect(script).toContain(timezoneId);
          expect(script).toContain(languageCode);
          expect(script).toContain('LATITUDE');
          expect(script).toContain('LONGITUDE');
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Additional test: Timezone database is comprehensive
   */
  test('Property 19 (Extended): Timezone database is comprehensive', () => {
    const timezones = EnvironmentGenerator.getTimezones();
    
    // Verify we have a reasonable number of timezones
    expect(timezones.length).toBeGreaterThan(30);
    
    // Verify all major regions are covered
    const regions = new Set(timezones.map(tz => tz.region));
    expect(regions.has('Americas')).toBe(true);
    expect(regions.has('Europe')).toBe(true);
    expect(regions.has('Asia')).toBe(true);
    expect(regions.has('Oceania')).toBe(true);
    expect(regions.has('Africa')).toBe(true);
  });

  /**
   * Additional test: Language database is comprehensive
   */
  test('Property 21 (Extended): Language database is comprehensive', () => {
    const languages = EnvironmentGenerator.getLanguages();
    
    // Verify we have a reasonable number of languages
    expect(languages.length).toBeGreaterThan(20);
    
    // Verify major languages are present
    const codes = languages.map(l => l.code);
    expect(codes).toContain('en-US');
    expect(codes).toContain('zh-CN');
    expect(codes).toContain('ja-JP');
    expect(codes).toContain('es-ES');
    expect(codes).toContain('fr-FR');
    expect(codes).toContain('de-DE');
  });
});
