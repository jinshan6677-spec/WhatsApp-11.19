/**
 * FingerprintValidator
 * 
 * Validates fingerprint configurations for consistency and correctness.
 * Ensures User-Agent, WebGL, screen resolution, CPU, and memory are all
 * consistent with each other and the specified platform.
 * 
 * Requirements: 24.1-24.6
 */

import { 
  FingerprintProfile, 
  FingerprintProfileData, 
  Platform,
  WebGLConfig,
  ScreenConfig,
  HardwareConfig
} from '../../domain/entities/FingerprintProfile';
import { UserAgentGenerator } from './generators/UserAgentGenerator';
import { WebGLGenerator } from './generators/WebGLGenerator';

/**
 * Validation result with detailed information
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  score: number; // 0-100, higher is better
}

/**
 * Validation rule result
 */
interface RuleResult {
  passed: boolean;
  message?: string;
  severity: 'error' | 'warning';
}

/**
 * Common screen resolutions by device type
 */
const COMMON_RESOLUTIONS: Record<string, { width: number; height: number }[]> = {
  desktop: [
    { width: 1920, height: 1080 },
    { width: 2560, height: 1440 },
    { width: 3840, height: 2160 },
    { width: 1680, height: 1050 },
    { width: 1440, height: 900 },
    { width: 2560, height: 1080 },
    { width: 3440, height: 1440 },
  ],
  laptop: [
    { width: 1920, height: 1080 },
    { width: 1366, height: 768 },
    { width: 1536, height: 864 },
    { width: 1440, height: 900 },
    { width: 1280, height: 800 },
    { width: 2560, height: 1600 },
    { width: 2880, height: 1800 },
    { width: 3024, height: 1964 },
    { width: 2560, height: 1664 },
    { width: 1920, height: 1200 },
  ],
  mobile: [
    { width: 375, height: 812 },
    { width: 390, height: 844 },
    { width: 414, height: 896 },
    { width: 360, height: 800 },
    { width: 412, height: 915 },
  ]
};

/**
 * Reasonable CPU and memory combinations
 */
const REASONABLE_HARDWARE_COMBOS = [
  { minCores: 1, maxCores: 2, minMemory: 2, maxMemory: 4 },
  { minCores: 2, maxCores: 4, minMemory: 4, maxMemory: 8 },
  { minCores: 4, maxCores: 8, minMemory: 8, maxMemory: 16 },
  { minCores: 6, maxCores: 12, minMemory: 16, maxMemory: 32 },
  { minCores: 8, maxCores: 16, minMemory: 16, maxMemory: 64 },
  { minCores: 12, maxCores: 32, minMemory: 32, maxMemory: 128 },
  { minCores: 16, maxCores: 64, minMemory: 64, maxMemory: 256 },
  { minCores: 32, maxCores: 128, minMemory: 128, maxMemory: 256 },
];

export class FingerprintValidator {
  /**
   * Validates a complete fingerprint profile for consistency
   * Requirements: 24.1-24.5
   */
  static validate(profile: FingerprintProfile | FingerprintProfileData): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    let score = 100;

    // Run all validation rules
    const rules = [
      this.validateUserAgentPlatformMatch(profile),
      this.validateWebGLPlatformMatch(profile),
      this.validateScreenResolution(profile),
      this.validateCPUMemoryConsistency(profile),
      this.validateUserAgentBrowserVersion(profile),
      this.validateWebGLVendorRenderer(profile),
      this.validateTimezoneLanguageConsistency(profile),
    ];

    for (const rule of rules) {
      if (!rule.passed && rule.message) {
        if (rule.severity === 'error') {
          errors.push(rule.message);
          score -= 15;
        } else {
          warnings.push(rule.message);
          score -= 5;
        }
      }
    }

    // Ensure score doesn't go below 0
    score = Math.max(0, score);

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      score
    };
  }

  /**
   * Validates User-Agent matches the specified platform
   * Requirements: 24.1
   */
  static validateUserAgentPlatformMatch(profile: FingerprintProfile | FingerprintProfileData): RuleResult {
    const { userAgent, platform } = profile;

    if (!userAgent) {
      return { passed: false, message: 'User-Agent is required', severity: 'error' };
    }

    // Extract platform from User-Agent
    const extractedPlatform = UserAgentGenerator.extractPlatform(userAgent);

    if (!extractedPlatform) {
      return { 
        passed: false, 
        message: 'Could not determine platform from User-Agent', 
        severity: 'warning' 
      };
    }

    if (extractedPlatform !== platform) {
      return {
        passed: false,
        message: `User-Agent indicates ${extractedPlatform} but platform is set to ${platform}`,
        severity: 'error'
      };
    }

    return { passed: true, severity: 'error' };
  }

  /**
   * Validates WebGL configuration matches the specified platform
   * Requirements: 24.2
   */
  static validateWebGLPlatformMatch(profile: FingerprintProfile | FingerprintProfileData): RuleResult {
    const { webgl, platform } = profile;

    if (!webgl || webgl.mode === 'real') {
      return { passed: true, severity: 'error' };
    }

    const validation = WebGLGenerator.validateConsistency(webgl, platform);

    if (!validation.valid) {
      return {
        passed: false,
        message: `WebGL configuration incompatible with ${platform}: ${validation.errors.join(', ')}`,
        severity: 'error'
      };
    }

    if (validation.warnings.length > 0) {
      return {
        passed: true,
        message: validation.warnings.join(', '),
        severity: 'warning'
      };
    }

    return { passed: true, severity: 'error' };
  }

  /**
   * Validates screen resolution is reasonable
   * Requirements: 24.3
   */
  static validateScreenResolution(profile: FingerprintProfile | FingerprintProfileData): RuleResult {
    const { screen } = profile;

    if (!screen || screen.mode === 'real') {
      return { passed: true, severity: 'error' };
    }

    const { width, height } = screen;

    if (!width || !height) {
      return { passed: true, severity: 'error' };
    }

    // Check minimum resolution
    if (width < 640 || height < 480) {
      return {
        passed: false,
        message: `Screen resolution ${width}x${height} is too small (minimum 640x480)`,
        severity: 'error'
      };
    }

    // Check maximum resolution
    if (width > 7680 || height > 4320) {
      return {
        passed: false,
        message: `Screen resolution ${width}x${height} is unusually large (maximum 8K: 7680x4320)`,
        severity: 'warning'
      };
    }

    // Check aspect ratio (should be between 1:1 and 32:9)
    const aspectRatio = width / height;
    if (aspectRatio < 0.5 || aspectRatio > 4) {
      return {
        passed: false,
        message: `Screen aspect ratio ${aspectRatio.toFixed(2)} is unusual`,
        severity: 'warning'
      };
    }

    // Check if resolution is common
    const allResolutions = [
      ...COMMON_RESOLUTIONS.desktop,
      ...COMMON_RESOLUTIONS.laptop,
      ...COMMON_RESOLUTIONS.mobile
    ];

    const isCommon = allResolutions.some(r => r.width === width && r.height === height);
    if (!isCommon) {
      // Check if it's close to a common resolution
      const isClose = allResolutions.some(r => 
        Math.abs(r.width - width) <= 100 && Math.abs(r.height - height) <= 100
      );

      if (!isClose) {
        return {
          passed: true,
          message: `Screen resolution ${width}x${height} is uncommon and may be detectable`,
          severity: 'warning'
        };
      }
    }

    return { passed: true, severity: 'error' };
  }

  /**
   * Validates CPU cores and memory are consistent
   * Requirements: 24.4
   */
  static validateCPUMemoryConsistency(profile: FingerprintProfile | FingerprintProfileData): RuleResult {
    const { hardware } = profile;

    if (!hardware) {
      return { passed: true, severity: 'error' };
    }

    const { cpuCores, memory } = hardware;

    // Validate CPU cores range
    if (cpuCores <= 0) {
      return {
        passed: false,
        message: 'CPU cores must be positive',
        severity: 'error'
      };
    }

    if (cpuCores > 128) {
      return {
        passed: false,
        message: `CPU cores (${cpuCores}) is unusually high (maximum 128)`,
        severity: 'warning'
      };
    }

    // Validate memory range
    if (memory <= 0) {
      return {
        passed: false,
        message: 'Memory must be positive',
        severity: 'error'
      };
    }

    if (memory > 256) {
      return {
        passed: false,
        message: `Memory (${memory} GB) is unusually high (maximum 256 GB)`,
        severity: 'warning'
      };
    }

    // Check if CPU and memory combination is reasonable
    const isReasonable = REASONABLE_HARDWARE_COMBOS.some(combo => 
      cpuCores >= combo.minCores && 
      cpuCores <= combo.maxCores && 
      memory >= combo.minMemory && 
      memory <= combo.maxMemory
    );

    if (!isReasonable) {
      // Check for specific unreasonable combinations
      if (cpuCores > 16 && memory < 8) {
        return {
          passed: false,
          message: `High CPU cores (${cpuCores}) with low memory (${memory} GB) is unusual`,
          severity: 'warning'
        };
      }

      if (cpuCores < 4 && memory > 32) {
        return {
          passed: false,
          message: `Low CPU cores (${cpuCores}) with high memory (${memory} GB) is unusual`,
          severity: 'warning'
        };
      }

      return {
        passed: true,
        message: `CPU (${cpuCores} cores) and memory (${memory} GB) combination may be uncommon`,
        severity: 'warning'
      };
    }

    return { passed: true, severity: 'error' };
  }

  /**
   * Validates User-Agent browser version format
   */
  static validateUserAgentBrowserVersion(profile: FingerprintProfile | FingerprintProfileData): RuleResult {
    const { userAgent, browserVersion } = profile;

    if (!userAgent || !browserVersion) {
      return { passed: true, severity: 'error' };
    }

    // Extract browser version from User-Agent
    const extractedVersion = UserAgentGenerator.extractBrowserVersion(userAgent);

    if (!extractedVersion) {
      return {
        passed: true,
        message: 'Could not extract browser version from User-Agent',
        severity: 'warning'
      };
    }

    // Compare browser names (not exact versions, as minor versions may differ)
    const extractedBrowser = extractedVersion.split(' ')[0];
    const configuredBrowser = browserVersion.split(' ')[0];

    if (extractedBrowser !== configuredBrowser) {
      return {
        passed: false,
        message: `User-Agent indicates ${extractedBrowser} but browserVersion is ${configuredBrowser}`,
        severity: 'warning'
      };
    }

    return { passed: true, severity: 'error' };
  }

  /**
   * Validates WebGL vendor and renderer are consistent
   */
  static validateWebGLVendorRenderer(profile: FingerprintProfile | FingerprintProfileData): RuleResult {
    const { webgl } = profile;

    if (!webgl || webgl.mode === 'real') {
      return { passed: true, severity: 'error' };
    }

    const { vendor, renderer } = webgl;

    if (!vendor || !renderer) {
      return { passed: true, severity: 'error' };
    }

    // Check vendor-renderer consistency
    // NVIDIA vendor should have NVIDIA renderer
    if (vendor.includes('NVIDIA') && !renderer.includes('NVIDIA') && !renderer.includes('GeForce')) {
      return {
        passed: false,
        message: 'NVIDIA vendor should have NVIDIA/GeForce renderer',
        severity: 'warning'
      };
    }

    // AMD vendor should have AMD/Radeon renderer
    if (vendor.includes('AMD') && !renderer.includes('AMD') && !renderer.includes('Radeon')) {
      return {
        passed: false,
        message: 'AMD vendor should have AMD/Radeon renderer',
        severity: 'warning'
      };
    }

    // Intel vendor should have Intel renderer
    if (vendor.includes('Intel') && !renderer.includes('Intel') && !renderer.includes('UHD') && !renderer.includes('Iris') && !renderer.includes('HD Graphics')) {
      return {
        passed: false,
        message: 'Intel vendor should have Intel renderer',
        severity: 'warning'
      };
    }

    // Apple vendor should have Apple renderer
    if (vendor.includes('Apple') && !renderer.includes('Apple') && !renderer.includes('M1') && !renderer.includes('M2') && !renderer.includes('M3')) {
      return {
        passed: false,
        message: 'Apple vendor should have Apple Silicon renderer',
        severity: 'warning'
      };
    }

    return { passed: true, severity: 'error' };
  }

  /**
   * Validates timezone and language consistency (if both are IP-based, they should match)
   */
  static validateTimezoneLanguageConsistency(profile: FingerprintProfile | FingerprintProfileData): RuleResult {
    const { timezone, language } = profile;

    // If both are IP-based, they will be set automatically, so no validation needed
    if (timezone?.mode === 'ip-based' && language?.mode === 'ip-based') {
      return { passed: true, severity: 'error' };
    }

    // If timezone is custom and language is custom, check for obvious mismatches
    if (timezone?.mode === 'custom' && language?.mode === 'custom') {
      const tz = timezone.value || '';
      const lang = language.value || '';

      // Check for obvious mismatches (e.g., US timezone with Chinese language)
      const usTimezones = ['America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles'];
      const isUSTimezone = usTimezones.some(t => tz.includes(t) || tz.includes('US/'));

      if (isUSTimezone && lang.startsWith('zh')) {
        return {
          passed: true,
          message: 'US timezone with Chinese language may be unusual',
          severity: 'warning'
        };
      }

      const chinaTimezones = ['Asia/Shanghai', 'Asia/Hong_Kong'];
      const isChinaTimezone = chinaTimezones.some(t => tz.includes(t));

      if (isChinaTimezone && lang.startsWith('en-US')) {
        return {
          passed: true,
          message: 'China timezone with US English language may be unusual',
          severity: 'warning'
        };
      }
    }

    return { passed: true, severity: 'error' };
  }

  /**
   * Validates a fingerprint and returns suggestions for fixing issues
   * Requirements: 24.5
   */
  static validateWithSuggestions(profile: FingerprintProfile | FingerprintProfileData): {
    result: ValidationResult;
    suggestions: string[];
  } {
    const result = this.validate(profile);
    const suggestions: string[] = [];

    // Generate suggestions based on errors and warnings
    for (const error of result.errors) {
      if (error.includes('User-Agent indicates')) {
        suggestions.push('Update the User-Agent to match the configured platform, or change the platform setting');
      }
      if (error.includes('WebGL configuration incompatible')) {
        suggestions.push(`Use WebGLGenerator.generateRandom('${profile.platform}') to get a compatible WebGL configuration`);
      }
      if (error.includes('Screen resolution') && error.includes('too small')) {
        suggestions.push('Use a standard resolution like 1920x1080 or 1366x768');
      }
      if (error.includes('CPU cores must be positive')) {
        suggestions.push('Set CPU cores to a value between 2 and 16 for typical devices');
      }
      if (error.includes('Memory must be positive')) {
        suggestions.push('Set memory to a value between 4 and 32 GB for typical devices');
      }
    }

    for (const warning of result.warnings) {
      if (warning.includes('uncommon')) {
        suggestions.push('Consider using values from the fingerprint library for more realistic configurations');
      }
      if (warning.includes('unusual')) {
        suggestions.push('Review the configuration for consistency with real-world devices');
      }
    }

    return { result, suggestions };
  }

  /**
   * Checks if a fingerprint configuration is consistent (no errors)
   * Requirements: 24.6
   */
  static isConsistent(profile: FingerprintProfile | FingerprintProfileData): boolean {
    const result = this.validate(profile);
    return result.valid;
  }

  /**
   * Gets a consistency score for a fingerprint (0-100)
   */
  static getConsistencyScore(profile: FingerprintProfile | FingerprintProfileData): number {
    const result = this.validate(profile);
    return result.score;
  }

  /**
   * Validates and auto-fixes common issues
   * Returns a new profile with fixes applied
   */
  static autoFix(profile: FingerprintProfileData): FingerprintProfileData {
    const fixed = { ...profile };

    // Fix User-Agent platform mismatch
    if (fixed.userAgent && fixed.platform) {
      const extractedPlatform = UserAgentGenerator.extractPlatform(fixed.userAgent);
      if (extractedPlatform && extractedPlatform !== fixed.platform) {
        // Update User-Agent to match platform
        fixed.userAgent = UserAgentGenerator.updatePlatform(fixed.userAgent, fixed.platform);
      }
    }

    // Fix WebGL platform mismatch
    if (fixed.webgl && fixed.webgl.mode === 'custom' && fixed.platform) {
      const validation = WebGLGenerator.validateConsistency(fixed.webgl, fixed.platform);
      if (!validation.valid) {
        // Generate a compatible WebGL config
        const compatibleConfig = WebGLGenerator.generateRandom(fixed.platform);
        fixed.webgl = compatibleConfig;
      }
    }

    // Fix screen resolution if too small
    if (fixed.screen && fixed.screen.mode === 'custom') {
      if (fixed.screen.width && fixed.screen.width < 640) {
        fixed.screen.width = 1920;
      }
      if (fixed.screen.height && fixed.screen.height < 480) {
        fixed.screen.height = 1080;
      }
    }

    // Fix hardware if invalid
    if (fixed.hardware) {
      if (fixed.hardware.cpuCores <= 0) {
        fixed.hardware.cpuCores = 8;
      }
      if (fixed.hardware.memory <= 0) {
        fixed.hardware.memory = 16;
      }
    }

    return fixed;
  }
}

export default FingerprintValidator;
