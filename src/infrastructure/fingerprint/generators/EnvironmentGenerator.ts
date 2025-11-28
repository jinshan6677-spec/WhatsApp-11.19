/**
 * EnvironmentGenerator
 * 
 * Generates environment configuration for browser fingerprint including
 * timezone, geolocation, and language settings.
 * 
 * Requirements: 7.1-7.8
 */

import { 
  Platform, 
  TimezoneConfig, 
  GeolocationConfig, 
  LanguageConfig,
  TimezoneMode,
  GeolocationMode,
  LanguageMode
} from '../../../domain/entities/FingerprintProfile';

export interface TimezoneInfo {
  id: string;
  name: string;
  offset: number; // Minutes from UTC
  region: string;
  country: string;
}

export interface GeoLocation {
  latitude: number;
  longitude: number;
  city?: string;
  country?: string;
  countryCode?: string;
}

export interface LanguageInfo {
  code: string;
  name: string;
  region: string;
  countryCode: string;
}

// Comprehensive timezone database
const TIMEZONES: TimezoneInfo[] = [
  // Americas
  { id: 'America/New_York', name: 'Eastern Time', offset: 300, region: 'Americas', country: 'US' },
  { id: 'America/Chicago', name: 'Central Time', offset: 360, region: 'Americas', country: 'US' },
  { id: 'America/Denver', name: 'Mountain Time', offset: 420, region: 'Americas', country: 'US' },
  { id: 'America/Los_Angeles', name: 'Pacific Time', offset: 480, region: 'Americas', country: 'US' },
  { id: 'America/Anchorage', name: 'Alaska Time', offset: 540, region: 'Americas', country: 'US' },
  { id: 'Pacific/Honolulu', name: 'Hawaii Time', offset: 600, region: 'Americas', country: 'US' },
  { id: 'America/Toronto', name: 'Eastern Time', offset: 300, region: 'Americas', country: 'CA' },
  { id: 'America/Vancouver', name: 'Pacific Time', offset: 480, region: 'Americas', country: 'CA' },
  { id: 'America/Mexico_City', name: 'Central Time', offset: 360, region: 'Americas', country: 'MX' },
  { id: 'America/Sao_Paulo', name: 'Brasilia Time', offset: 180, region: 'Americas', country: 'BR' },
  { id: 'America/Buenos_Aires', name: 'Argentina Time', offset: 180, region: 'Americas', country: 'AR' },
  
  // Europe
  { id: 'Europe/London', name: 'Greenwich Mean Time', offset: 0, region: 'Europe', country: 'GB' },
  { id: 'Europe/Paris', name: 'Central European Time', offset: -60, region: 'Europe', country: 'FR' },
  { id: 'Europe/Berlin', name: 'Central European Time', offset: -60, region: 'Europe', country: 'DE' },
  { id: 'Europe/Rome', name: 'Central European Time', offset: -60, region: 'Europe', country: 'IT' },
  { id: 'Europe/Madrid', name: 'Central European Time', offset: -60, region: 'Europe', country: 'ES' },
  { id: 'Europe/Amsterdam', name: 'Central European Time', offset: -60, region: 'Europe', country: 'NL' },
  { id: 'Europe/Moscow', name: 'Moscow Time', offset: -180, region: 'Europe', country: 'RU' },
  { id: 'Europe/Istanbul', name: 'Turkey Time', offset: -180, region: 'Europe', country: 'TR' },
  
  // Asia
  { id: 'Asia/Tokyo', name: 'Japan Standard Time', offset: -540, region: 'Asia', country: 'JP' },
  { id: 'Asia/Shanghai', name: 'China Standard Time', offset: -480, region: 'Asia', country: 'CN' },
  { id: 'Asia/Hong_Kong', name: 'Hong Kong Time', offset: -480, region: 'Asia', country: 'HK' },
  { id: 'Asia/Singapore', name: 'Singapore Time', offset: -480, region: 'Asia', country: 'SG' },
  { id: 'Asia/Seoul', name: 'Korea Standard Time', offset: -540, region: 'Asia', country: 'KR' },
  { id: 'Asia/Taipei', name: 'Taipei Standard Time', offset: -480, region: 'Asia', country: 'TW' },
  { id: 'Asia/Bangkok', name: 'Indochina Time', offset: -420, region: 'Asia', country: 'TH' },
  { id: 'Asia/Jakarta', name: 'Western Indonesia Time', offset: -420, region: 'Asia', country: 'ID' },
  { id: 'Asia/Kolkata', name: 'India Standard Time', offset: -330, region: 'Asia', country: 'IN' },
  { id: 'Asia/Dubai', name: 'Gulf Standard Time', offset: -240, region: 'Asia', country: 'AE' },
  
  // Oceania
  { id: 'Australia/Sydney', name: 'Australian Eastern Time', offset: -660, region: 'Oceania', country: 'AU' },
  { id: 'Australia/Melbourne', name: 'Australian Eastern Time', offset: -660, region: 'Oceania', country: 'AU' },
  { id: 'Australia/Perth', name: 'Australian Western Time', offset: -480, region: 'Oceania', country: 'AU' },
  { id: 'Pacific/Auckland', name: 'New Zealand Time', offset: -780, region: 'Oceania', country: 'NZ' },
  
  // Africa
  { id: 'Africa/Cairo', name: 'Eastern European Time', offset: -120, region: 'Africa', country: 'EG' },
  { id: 'Africa/Johannesburg', name: 'South Africa Time', offset: -120, region: 'Africa', country: 'ZA' },
  { id: 'Africa/Lagos', name: 'West Africa Time', offset: -60, region: 'Africa', country: 'NG' },
  
  // UTC
  { id: 'UTC', name: 'Coordinated Universal Time', offset: 0, region: 'UTC', country: '' }
];

// Language database
const LANGUAGES: LanguageInfo[] = [
  { code: 'en-US', name: 'English (US)', region: 'Americas', countryCode: 'US' },
  { code: 'en-GB', name: 'English (UK)', region: 'Europe', countryCode: 'GB' },
  { code: 'en-AU', name: 'English (Australia)', region: 'Oceania', countryCode: 'AU' },
  { code: 'en-CA', name: 'English (Canada)', region: 'Americas', countryCode: 'CA' },
  { code: 'zh-CN', name: 'Chinese (Simplified)', region: 'Asia', countryCode: 'CN' },
  { code: 'zh-TW', name: 'Chinese (Traditional)', region: 'Asia', countryCode: 'TW' },
  { code: 'zh-HK', name: 'Chinese (Hong Kong)', region: 'Asia', countryCode: 'HK' },
  { code: 'ja-JP', name: 'Japanese', region: 'Asia', countryCode: 'JP' },
  { code: 'ko-KR', name: 'Korean', region: 'Asia', countryCode: 'KR' },
  { code: 'es-ES', name: 'Spanish (Spain)', region: 'Europe', countryCode: 'ES' },
  { code: 'es-MX', name: 'Spanish (Mexico)', region: 'Americas', countryCode: 'MX' },
  { code: 'es-AR', name: 'Spanish (Argentina)', region: 'Americas', countryCode: 'AR' },
  { code: 'fr-FR', name: 'French (France)', region: 'Europe', countryCode: 'FR' },
  { code: 'fr-CA', name: 'French (Canada)', region: 'Americas', countryCode: 'CA' },
  { code: 'de-DE', name: 'German', region: 'Europe', countryCode: 'DE' },
  { code: 'it-IT', name: 'Italian', region: 'Europe', countryCode: 'IT' },
  { code: 'pt-BR', name: 'Portuguese (Brazil)', region: 'Americas', countryCode: 'BR' },
  { code: 'pt-PT', name: 'Portuguese (Portugal)', region: 'Europe', countryCode: 'PT' },
  { code: 'ru-RU', name: 'Russian', region: 'Europe', countryCode: 'RU' },
  { code: 'nl-NL', name: 'Dutch', region: 'Europe', countryCode: 'NL' },
  { code: 'pl-PL', name: 'Polish', region: 'Europe', countryCode: 'PL' },
  { code: 'tr-TR', name: 'Turkish', region: 'Europe', countryCode: 'TR' },
  { code: 'ar-SA', name: 'Arabic (Saudi Arabia)', region: 'Asia', countryCode: 'SA' },
  { code: 'ar-AE', name: 'Arabic (UAE)', region: 'Asia', countryCode: 'AE' },
  { code: 'th-TH', name: 'Thai', region: 'Asia', countryCode: 'TH' },
  { code: 'vi-VN', name: 'Vietnamese', region: 'Asia', countryCode: 'VN' },
  { code: 'id-ID', name: 'Indonesian', region: 'Asia', countryCode: 'ID' },
  { code: 'ms-MY', name: 'Malay', region: 'Asia', countryCode: 'MY' },
  { code: 'hi-IN', name: 'Hindi', region: 'Asia', countryCode: 'IN' }
];

// Country to approximate coordinates mapping
const COUNTRY_COORDINATES: Record<string, GeoLocation> = {
  'US': { latitude: 37.0902, longitude: -95.7129, country: 'United States', countryCode: 'US' },
  'CA': { latitude: 56.1304, longitude: -106.3468, country: 'Canada', countryCode: 'CA' },
  'MX': { latitude: 23.6345, longitude: -102.5528, country: 'Mexico', countryCode: 'MX' },
  'BR': { latitude: -14.2350, longitude: -51.9253, country: 'Brazil', countryCode: 'BR' },
  'AR': { latitude: -38.4161, longitude: -63.6167, country: 'Argentina', countryCode: 'AR' },
  'GB': { latitude: 55.3781, longitude: -3.4360, country: 'United Kingdom', countryCode: 'GB' },
  'FR': { latitude: 46.2276, longitude: 2.2137, country: 'France', countryCode: 'FR' },
  'DE': { latitude: 51.1657, longitude: 10.4515, country: 'Germany', countryCode: 'DE' },
  'IT': { latitude: 41.8719, longitude: 12.5674, country: 'Italy', countryCode: 'IT' },
  'ES': { latitude: 40.4637, longitude: -3.7492, country: 'Spain', countryCode: 'ES' },
  'NL': { latitude: 52.1326, longitude: 5.2913, country: 'Netherlands', countryCode: 'NL' },
  'RU': { latitude: 61.5240, longitude: 105.3188, country: 'Russia', countryCode: 'RU' },
  'TR': { latitude: 38.9637, longitude: 35.2433, country: 'Turkey', countryCode: 'TR' },
  'JP': { latitude: 36.2048, longitude: 138.2529, country: 'Japan', countryCode: 'JP' },
  'CN': { latitude: 35.8617, longitude: 104.1954, country: 'China', countryCode: 'CN' },
  'HK': { latitude: 22.3193, longitude: 114.1694, country: 'Hong Kong', countryCode: 'HK' },
  'SG': { latitude: 1.3521, longitude: 103.8198, country: 'Singapore', countryCode: 'SG' },
  'KR': { latitude: 35.9078, longitude: 127.7669, country: 'South Korea', countryCode: 'KR' },
  'TW': { latitude: 23.6978, longitude: 120.9605, country: 'Taiwan', countryCode: 'TW' },
  'TH': { latitude: 15.8700, longitude: 100.9925, country: 'Thailand', countryCode: 'TH' },
  'ID': { latitude: -0.7893, longitude: 113.9213, country: 'Indonesia', countryCode: 'ID' },
  'IN': { latitude: 20.5937, longitude: 78.9629, country: 'India', countryCode: 'IN' },
  'AE': { latitude: 23.4241, longitude: 53.8478, country: 'UAE', countryCode: 'AE' },
  'AU': { latitude: -25.2744, longitude: 133.7751, country: 'Australia', countryCode: 'AU' },
  'NZ': { latitude: -40.9006, longitude: 174.8860, country: 'New Zealand', countryCode: 'NZ' },
  'EG': { latitude: 26.8206, longitude: 30.8025, country: 'Egypt', countryCode: 'EG' },
  'ZA': { latitude: -30.5595, longitude: 22.9375, country: 'South Africa', countryCode: 'ZA' },
  'NG': { latitude: 9.0820, longitude: 8.6753, country: 'Nigeria', countryCode: 'NG' }
};

export class EnvironmentGenerator {
  /**
   * Gets all available timezones
   */
  static getTimezones(): TimezoneInfo[] {
    return [...TIMEZONES];
  }
  
  /**
   * Gets timezones for a specific region
   */
  static getTimezonesByRegion(region: string): TimezoneInfo[] {
    return TIMEZONES.filter(tz => tz.region === region);
  }
  
  /**
   * Gets timezones for a specific country
   */
  static getTimezonesByCountry(countryCode: string): TimezoneInfo[] {
    return TIMEZONES.filter(tz => tz.country === countryCode);
  }
  
  /**
   * Finds a timezone by ID
   */
  static findTimezone(id: string): TimezoneInfo | null {
    return TIMEZONES.find(tz => tz.id === id) || null;
  }
  
  /**
   * Generates a random timezone
   */
  static generateRandomTimezone(): TimezoneConfig {
    const timezone = TIMEZONES[Math.floor(Math.random() * TIMEZONES.length)];
    return {
      mode: 'custom',
      value: timezone.id
    };
  }
  
  /**
   * Creates a timezone config
   * Requirements: 7.1-7.3
   */
  static createTimezoneConfig(mode: TimezoneMode, value?: string): TimezoneConfig {
    if (mode === 'custom' && !value) {
      return { mode: 'custom', value: 'UTC' };
    }
    return { mode, value };
  }
  
  /**
   * Gets all available languages
   */
  static getLanguages(): LanguageInfo[] {
    return [...LANGUAGES];
  }
  
  /**
   * Gets languages for a specific region
   */
  static getLanguagesByRegion(region: string): LanguageInfo[] {
    return LANGUAGES.filter(lang => lang.region === region);
  }
  
  /**
   * Gets languages for a specific country
   */
  static getLanguagesByCountry(countryCode: string): LanguageInfo[] {
    return LANGUAGES.filter(lang => lang.countryCode === countryCode);
  }
  
  /**
   * Finds a language by code
   */
  static findLanguage(code: string): LanguageInfo | null {
    return LANGUAGES.find(lang => lang.code === code) || null;
  }
  
  /**
   * Generates a random language
   */
  static generateRandomLanguage(): LanguageConfig {
    const language = LANGUAGES[Math.floor(Math.random() * LANGUAGES.length)];
    return {
      mode: 'custom',
      value: language.code
    };
  }
  
  /**
   * Creates a language config
   * Requirements: 7.7, 7.8
   */
  static createLanguageConfig(mode: LanguageMode, value?: string): LanguageConfig {
    if (mode === 'custom' && !value) {
      return { mode: 'custom', value: 'en-US' };
    }
    return { mode, value };
  }
  
  /**
   * Gets coordinates for a country
   */
  static getCountryCoordinates(countryCode: string): GeoLocation | null {
    return COUNTRY_COORDINATES[countryCode] || null;
  }
  
  /**
   * Generates random geolocation for a country
   * Adds small random offset to base coordinates
   */
  static generateGeolocationForCountry(countryCode: string): GeoLocation | null {
    const base = COUNTRY_COORDINATES[countryCode];
    if (!base) return null;
    
    // Add random offset (up to ~50km)
    const latOffset = (Math.random() - 0.5) * 1;
    const lonOffset = (Math.random() - 0.5) * 1;
    
    return {
      latitude: base.latitude + latOffset,
      longitude: base.longitude + lonOffset,
      country: base.country,
      countryCode: base.countryCode
    };
  }
  
  /**
   * Creates a geolocation config
   * Requirements: 7.4-7.6
   */
  static createGeolocationConfig(
    mode: GeolocationMode, 
    latitude?: number, 
    longitude?: number
  ): GeolocationConfig {
    return { mode, latitude, longitude };
  }
  
  /**
   * Generates a random geolocation
   */
  static generateRandomGeolocation(): GeolocationConfig {
    const countryCodes = Object.keys(COUNTRY_COORDINATES);
    const countryCode = countryCodes[Math.floor(Math.random() * countryCodes.length)];
    const location = this.generateGeolocationForCountry(countryCode);
    
    if (location) {
      return {
        mode: 'ip-based',
        latitude: location.latitude,
        longitude: location.longitude
      };
    }
    
    return { mode: 'prompt' };
  }
  
  /**
   * Gets matching environment settings for a country
   * Returns timezone, language, and geolocation that match the country
   */
  static getEnvironmentForCountry(countryCode: string): {
    timezone: TimezoneConfig;
    language: LanguageConfig;
    geolocation: GeolocationConfig;
  } {
    // Find timezone for country
    const timezones = this.getTimezonesByCountry(countryCode);
    const timezone = timezones.length > 0 
      ? { mode: 'custom' as TimezoneMode, value: timezones[0].id }
      : { mode: 'custom' as TimezoneMode, value: 'UTC' };
    
    // Find language for country
    const languages = this.getLanguagesByCountry(countryCode);
    const language = languages.length > 0
      ? { mode: 'custom' as LanguageMode, value: languages[0].code }
      : { mode: 'custom' as LanguageMode, value: 'en-US' };
    
    // Get geolocation for country
    const location = this.generateGeolocationForCountry(countryCode);
    const geolocation: GeolocationConfig = location
      ? { mode: 'ip-based', latitude: location.latitude, longitude: location.longitude }
      : { mode: 'prompt' };
    
    return { timezone, language, geolocation };
  }
  
  /**
   * Validates timezone configuration
   */
  static validateTimezoneConfig(config: TimezoneConfig): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (!['ip-based', 'real', 'custom'].includes(config.mode)) {
      errors.push(`Invalid timezone mode: ${config.mode}`);
    }
    
    if (config.mode === 'custom' && !config.value) {
      errors.push('Timezone value is required when mode is custom');
    }
    
    if (config.value && !this.findTimezone(config.value)) {
      errors.push(`Unknown timezone: ${config.value}`);
    }
    
    return { valid: errors.length === 0, errors };
  }
  
  /**
   * Validates language configuration
   */
  static validateLanguageConfig(config: LanguageConfig): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (!['ip-based', 'custom'].includes(config.mode)) {
      errors.push(`Invalid language mode: ${config.mode}`);
    }
    
    if (config.mode === 'custom' && !config.value) {
      errors.push('Language value is required when mode is custom');
    }
    
    // Validate language code format (xx-XX)
    if (config.value && !/^[a-z]{2}(-[A-Z]{2})?$/.test(config.value)) {
      errors.push(`Invalid language code format: ${config.value}`);
    }
    
    return { valid: errors.length === 0, errors };
  }
  
  /**
   * Validates geolocation configuration
   */
  static validateGeolocationConfig(config: GeolocationConfig): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (!['ip-based', 'prompt', 'deny'].includes(config.mode)) {
      errors.push(`Invalid geolocation mode: ${config.mode}`);
    }
    
    if (config.latitude !== undefined) {
      if (config.latitude < -90 || config.latitude > 90) {
        errors.push('Latitude must be between -90 and 90');
      }
    }
    
    if (config.longitude !== undefined) {
      if (config.longitude < -180 || config.longitude > 180) {
        errors.push('Longitude must be between -180 and 180');
      }
    }
    
    return { valid: errors.length === 0, errors };
  }
  
  /**
   * Generates timezone override script
   * Requirements: 7.1-7.3
   */
  static generateTimezoneScript(config: TimezoneConfig): string {
    if (config.mode === 'real') {
      return '// Timezone: Real mode (no override)';
    }
    
    const timezone = config.value || 'UTC';
    const tzInfo = this.findTimezone(timezone);
    const offset = tzInfo ? tzInfo.offset : 0;
    
    return `
(function() {
  const TIMEZONE = '${timezone}';
  const OFFSET = ${offset};
  
  // Override Intl.DateTimeFormat
  const OriginalDateTimeFormat = Intl.DateTimeFormat;
  Intl.DateTimeFormat = function(locales, options) {
    const opts = Object.assign({}, options || {});
    opts.timeZone = TIMEZONE;
    return new OriginalDateTimeFormat(locales, opts);
  };
  Intl.DateTimeFormat.prototype = OriginalDateTimeFormat.prototype;
  Intl.DateTimeFormat.supportedLocalesOf = OriginalDateTimeFormat.supportedLocalesOf;
  
  // Override Date.prototype.getTimezoneOffset
  Date.prototype.getTimezoneOffset = function() {
    return OFFSET;
  };
  
  // Override Intl.DateTimeFormat.prototype.resolvedOptions
  const originalResolvedOptions = OriginalDateTimeFormat.prototype.resolvedOptions;
  Intl.DateTimeFormat.prototype.resolvedOptions = function() {
    const options = originalResolvedOptions.call(this);
    options.timeZone = TIMEZONE;
    return options;
  };
})();
`;
  }
  
  /**
   * Generates geolocation override script
   * Requirements: 7.4-7.6
   */
  static generateGeolocationScript(config: GeolocationConfig): string {
    if (config.mode === 'prompt') {
      return '// Geolocation: Prompt mode (no override)';
    }
    
    if (config.mode === 'deny') {
      return `
(function() {
  // Geolocation Denied
  navigator.geolocation.getCurrentPosition = function(success, error) {
    if (error) {
      error({ code: 1, message: 'User denied Geolocation' });
    }
  };
  navigator.geolocation.watchPosition = function(success, error) {
    if (error) {
      error({ code: 1, message: 'User denied Geolocation' });
    }
    return 0;
  };
  navigator.geolocation.clearWatch = function() {};
})();
`;
    }
    
    // ip-based mode with coordinates
    const lat = config.latitude ?? 0;
    const lon = config.longitude ?? 0;
    
    return `
(function() {
  const LATITUDE = ${lat};
  const LONGITUDE = ${lon};
  
  navigator.geolocation.getCurrentPosition = function(success, error, options) {
    success({
      coords: {
        latitude: LATITUDE,
        longitude: LONGITUDE,
        accuracy: 100,
        altitude: null,
        altitudeAccuracy: null,
        heading: null,
        speed: null
      },
      timestamp: Date.now()
    });
  };
  
  navigator.geolocation.watchPosition = function(success, error, options) {
    const watchId = Math.floor(Math.random() * 1000);
    success({
      coords: {
        latitude: LATITUDE,
        longitude: LONGITUDE,
        accuracy: 100,
        altitude: null,
        altitudeAccuracy: null,
        heading: null,
        speed: null
      },
      timestamp: Date.now()
    });
    return watchId;
  };
  
  navigator.geolocation.clearWatch = function(watchId) {};
})();
`;
  }
  
  /**
   * Generates language override script
   * Requirements: 7.7, 7.8
   */
  static generateLanguageScript(config: LanguageConfig): string {
    if (config.mode === 'ip-based' && !config.value) {
      return '// Language: IP-based mode (no override until IP is resolved)';
    }
    
    const language = config.value || 'en-US';
    const primaryLang = language.split('-')[0];
    const languages = [language];
    if (primaryLang !== language) {
      languages.push(primaryLang);
    }
    
    return `
(function() {
  // Language Override
  Object.defineProperty(navigator, 'language', {
    get: function() { return '${language}'; },
    configurable: false,
    enumerable: true
  });
  
  Object.defineProperty(navigator, 'languages', {
    get: function() { return Object.freeze(${JSON.stringify(languages)}); },
    configurable: false,
    enumerable: true
  });
})();
`;
  }
  
  /**
   * Generates combined environment override script
   */
  static generateCombinedScript(
    timezone: TimezoneConfig,
    geolocation: GeolocationConfig,
    language: LanguageConfig
  ): string {
    const scripts: string[] = [];
    
    if (timezone.mode !== 'real') {
      scripts.push(this.generateTimezoneScript(timezone));
    }
    
    if (geolocation.mode !== 'prompt') {
      scripts.push(this.generateGeolocationScript(geolocation));
    }
    
    if (language.mode === 'custom' && language.value) {
      scripts.push(this.generateLanguageScript(language));
    }
    
    return scripts.join('\n');
  }
}

export default EnvironmentGenerator;