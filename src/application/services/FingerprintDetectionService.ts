/**
 * FingerprintDetectionService
 * 
 * Detects fingerprint configuration issues and provides fix suggestions.
 * Analyzes fingerprint profiles for consistency, identifies risks, and
 * can automatically fix common issues.
 * 
 * Requirements: 26.1-26.6
 * 
 * @module src/application/services/FingerprintDetectionService
 */

import { FingerprintProfile, FingerprintProfileData, Platform } from '../../domain/entities/FingerprintProfile';
import { FingerprintValidator, ValidationResult } from '../../infrastructure/fingerprint/FingerprintValidator';
import { UserAgentGenerator } from '../../infrastructure/fingerprint/generators/UserAgentGenerator';
import { WebGLGenerator } from '../../infrastructure/fingerprint/generators/WebGLGenerator';

/**
 * Risk categories for fingerprint detection
 */
export type RiskCategory = 'webgl' | 'webrtc' | 'ua' | 'canvas' | 'audio' | 'consistency' | 'screen' | 'hardware' | 'timezone' | 'language';

/**
 * Risk severity levels
 */
export type RiskSeverity = 'low' | 'medium' | 'high';

/**
 * Risk level for overall detection result
 */
export type RiskLevel = 'low' | 'medium' | 'high';

/**
 * Individual risk item identified during detection
 */
export interface RiskItem {
  category: RiskCategory;
  severity: RiskSeverity;
  description: string;
  detectedValue?: string;
  expectedValue?: string;
}

/**
 * Detection result containing score, risk level, and identified risks
 */
export interface DetectionResult {
  score: number; // 0-100, higher is better
  riskLevel: RiskLevel;
  risks: RiskItem[];
  timestamp: Date;
  profileId?: string;
  accountId?: string;
}

/**
 * Fix suggestion for a risk item
 */
export interface FixSuggestion {
  riskItem: RiskItem;
  suggestion: string;
  autoFixable: boolean;
  fixAction?: string; // Description of the fix action
}

/**
 * Detection options
 */
export interface DetectionOptions {
  /** Include WebGL validation */
  checkWebGL?: boolean;
  /** Include WebRTC validation */
  checkWebRTC?: boolean;
  /** Include User-Agent validation */
  checkUserAgent?: boolean;
  /** Include Canvas validation */
  checkCanvas?: boolean;
  /** Include Audio validation */
  checkAudio?: boolean;
  /** Include screen resolution validation */
  checkScreen?: boolean;
  /** Include hardware validation */
  checkHardware?: boolean;
  /** Include timezone/language consistency */
  checkEnvironment?: boolean;
}

const DEFAULT_OPTIONS: DetectionOptions = {
  checkWebGL: true,
  checkWebRTC: true,
  checkUserAgent: true,
  checkCanvas: true,
  checkAudio: true,
  checkScreen: true,
  checkHardware: true,
  checkEnvironment: true,
};

export class FingerprintDetectionService {
  /**
   * Detects fingerprint configuration issues
   * Requirements: 26.1, 26.2, 26.4
   * 
   * @param profile - The fingerprint profile to analyze
   * @param options - Detection options to customize which checks to run
   * @returns Detection result with score, risk level, and identified risks
   */
  async detectFingerprint(
    profile: FingerprintProfile | FingerprintProfileData,
    options: DetectionOptions = DEFAULT_OPTIONS
  ): Promise<DetectionResult> {
    const risks: RiskItem[] = [];
    let score = 100;

    // Run validation using FingerprintValidator
    const validationResult = FingerprintValidator.validate(profile);
    
    // Convert validation errors to risk items
    for (const error of validationResult.errors) {
      const risk = this.errorToRiskItem(error, 'high');
      if (risk) {
        risks.push(risk);
        score -= 15;
      }
    }

    // Convert validation warnings to risk items
    for (const warning of validationResult.warnings) {
      const risk = this.errorToRiskItem(warning, 'medium');
      if (risk) {
        risks.push(risk);
        score -= 5;
      }
    }

    // Additional checks based on options
    if (options.checkWebGL) {
      const webglRisks = this.checkWebGLRisks(profile);
      risks.push(...webglRisks);
      score -= webglRisks.length * 5;
    }

    if (options.checkWebRTC) {
      const webrtcRisks = this.checkWebRTCRisks(profile);
      risks.push(...webrtcRisks);
      score -= webrtcRisks.length * 10;
    }

    if (options.checkUserAgent) {
      const uaRisks = this.checkUserAgentRisks(profile);
      risks.push(...uaRisks);
      score -= uaRisks.length * 5;
    }

    if (options.checkCanvas) {
      const canvasRisks = this.checkCanvasRisks(profile);
      risks.push(...canvasRisks);
      score -= canvasRisks.length * 3;
    }

    if (options.checkAudio) {
      const audioRisks = this.checkAudioRisks(profile);
      risks.push(...audioRisks);
      score -= audioRisks.length * 3;
    }

    if (options.checkScreen) {
      const screenRisks = this.checkScreenRisks(profile);
      risks.push(...screenRisks);
      score -= screenRisks.length * 5;
    }

    if (options.checkHardware) {
      const hardwareRisks = this.checkHardwareRisks(profile);
      risks.push(...hardwareRisks);
      score -= hardwareRisks.length * 5;
    }

    if (options.checkEnvironment) {
      const envRisks = this.checkEnvironmentRisks(profile);
      risks.push(...envRisks);
      score -= envRisks.length * 3;
    }

    // Ensure score is within bounds
    score = Math.max(0, Math.min(100, score));

    // Determine risk level based on score and risks
    const riskLevel = this.calculateRiskLevel(score, risks);

    return {
      score,
      riskLevel,
      risks,
      timestamp: new Date(),
      profileId: (profile as FingerprintProfile).id,
      accountId: profile.accountId,
    };
  }

  /**
   * Auto-fixes fingerprint configuration issues
   * Requirements: 26.5
   * 
   * @param profile - The fingerprint profile to fix
   * @param risks - The risks to fix (if not provided, all auto-fixable risks will be fixed)
   * @returns A new fingerprint profile with fixes applied
   */
  async autoFix(
    profile: FingerprintProfile | FingerprintProfileData,
    risks?: RiskItem[]
  ): Promise<FingerprintProfile> {
    // Get profile data
    const profileData: FingerprintProfileData = profile instanceof FingerprintProfile
      ? profile.toJSON() as FingerprintProfileData
      : { ...profile };

    // If no risks provided, detect them first
    if (!risks) {
      const detection = await this.detectFingerprint(profile);
      risks = detection.risks;
    }

    // Apply auto-fixes using FingerprintValidator
    let fixedData = FingerprintValidator.autoFix(profileData);

    // Apply additional fixes based on specific risks
    for (const risk of risks) {
      fixedData = this.applyRiskFix(fixedData, risk);
    }

    return new FingerprintProfile(fixedData);
  }

  /**
   * Gets fix suggestions for identified risks
   * Requirements: 26.3
   * 
   * @param risks - The risks to get suggestions for
   * @returns Array of fix suggestions
   */
  getFixSuggestions(risks: RiskItem[]): FixSuggestion[] {
    return risks.map(risk => this.createFixSuggestion(risk));
  }

  /**
   * Converts a validation error/warning message to a risk item
   * @private
   */
  private errorToRiskItem(message: string, defaultSeverity: RiskSeverity): RiskItem | null {
    // Categorize based on message content
    if (message.includes('User-Agent')) {
      return {
        category: 'ua',
        severity: defaultSeverity,
        description: message,
      };
    }

    if (message.includes('WebGL')) {
      return {
        category: 'webgl',
        severity: defaultSeverity,
        description: message,
      };
    }

    if (message.includes('Screen') || message.includes('resolution')) {
      return {
        category: 'screen',
        severity: defaultSeverity === 'high' ? 'medium' : 'low',
        description: message,
      };
    }

    if (message.includes('CPU') || message.includes('memory') || message.includes('Memory')) {
      return {
        category: 'hardware',
        severity: defaultSeverity === 'high' ? 'medium' : 'low',
        description: message,
      };
    }

    if (message.includes('timezone') || message.includes('language')) {
      return {
        category: 'consistency',
        severity: 'low',
        description: message,
      };
    }

    // Generic consistency issue
    return {
      category: 'consistency',
      severity: defaultSeverity,
      description: message,
    };
  }

  /**
   * Checks for WebGL-specific risks
   * @private
   */
  private checkWebGLRisks(profile: FingerprintProfile | FingerprintProfileData): RiskItem[] {
    const risks: RiskItem[] = [];
    const { webgl, platform } = profile;

    if (!webgl) return risks;

    // Check if WebGL is in 'real' mode (potential fingerprint leak)
    if (webgl.mode === 'real') {
      risks.push({
        category: 'webgl',
        severity: 'medium',
        description: 'WebGL is set to real mode, which may expose your actual GPU information',
        detectedValue: 'real',
        expectedValue: 'custom or random',
      });
    }

    // Check for empty vendor/renderer in custom mode
    if (webgl.mode === 'custom') {
      if (!webgl.vendor || webgl.vendor.trim() === '') {
        risks.push({
          category: 'webgl',
          severity: 'high',
          description: 'WebGL vendor is empty in custom mode',
          detectedValue: 'empty',
          expectedValue: 'Valid GPU vendor string',
        });
      }

      if (!webgl.renderer || webgl.renderer.trim() === '') {
        risks.push({
          category: 'webgl',
          severity: 'high',
          description: 'WebGL renderer is empty in custom mode',
          detectedValue: 'empty',
          expectedValue: 'Valid GPU renderer string',
        });
      }
    }

    return risks;
  }

  /**
   * Checks for WebRTC-specific risks
   * @private
   */
  private checkWebRTCRisks(profile: FingerprintProfile | FingerprintProfileData): RiskItem[] {
    const risks: RiskItem[] = [];
    const { webrtc } = profile;

    if (!webrtc) return risks;

    // Check if WebRTC is in 'real' mode (IP leak risk)
    if (webrtc.mode === 'real') {
      risks.push({
        category: 'webrtc',
        severity: 'high',
        description: 'WebRTC is set to real mode, which may leak your real IP address',
        detectedValue: 'real',
        expectedValue: 'disabled or replaced',
      });
    }

    // Check for missing fake IP in replaced mode
    if (webrtc.mode === 'replaced' && !webrtc.fakeLocalIP) {
      risks.push({
        category: 'webrtc',
        severity: 'medium',
        description: 'WebRTC is in replaced mode but no fake local IP is configured',
        detectedValue: 'undefined',
        expectedValue: 'Valid local IP address',
      });
    }

    return risks;
  }

  /**
   * Checks for User-Agent-specific risks
   * @private
   */
  private checkUserAgentRisks(profile: FingerprintProfile | FingerprintProfileData): RiskItem[] {
    const risks: RiskItem[] = [];
    const { userAgent, browserVersion } = profile;

    if (!userAgent) {
      risks.push({
        category: 'ua',
        severity: 'high',
        description: 'User-Agent is not configured',
        detectedValue: 'undefined',
        expectedValue: 'Valid User-Agent string',
      });
      return risks;
    }

    // Check for outdated browser version
    const extractedVersion = UserAgentGenerator.extractBrowserVersion(userAgent);
    if (extractedVersion) {
      const versionMatch = extractedVersion.match(/\d+/);
      if (versionMatch) {
        const majorVersion = parseInt(versionMatch[0], 10);
        // Chrome versions below 100 are considered outdated
        if (extractedVersion.includes('Chrome') && majorVersion < 100) {
          risks.push({
            category: 'ua',
            severity: 'medium',
            description: `Browser version ${majorVersion} is outdated and may be flagged`,
            detectedValue: `Chrome ${majorVersion}`,
            expectedValue: 'Chrome 110 or higher',
          });
        }
      }
    }

    // Check for suspicious User-Agent patterns
    if (userAgent.includes('HeadlessChrome')) {
      risks.push({
        category: 'ua',
        severity: 'high',
        description: 'User-Agent contains HeadlessChrome indicator',
        detectedValue: 'HeadlessChrome',
        expectedValue: 'Standard Chrome User-Agent',
      });
    }

    return risks;
  }

  /**
   * Checks for Canvas-specific risks
   * @private
   */
  private checkCanvasRisks(profile: FingerprintProfile | FingerprintProfileData): RiskItem[] {
    const risks: RiskItem[] = [];
    const { canvas } = profile;

    if (!canvas) return risks;

    // Check if Canvas is in 'real' mode
    if (canvas.mode === 'real') {
      risks.push({
        category: 'canvas',
        severity: 'low',
        description: 'Canvas fingerprinting is not randomized',
        detectedValue: 'real',
        expectedValue: 'random',
      });
    }

    // Check noise level if in random mode
    if (canvas.mode === 'random' && canvas.noiseLevel !== undefined) {
      if (canvas.noiseLevel > 10) {
        risks.push({
          category: 'canvas',
          severity: 'low',
          description: 'Canvas noise level is very high, which may cause visual artifacts',
          detectedValue: String(canvas.noiseLevel),
          expectedValue: '1-10',
        });
      }
    }

    return risks;
  }

  /**
   * Checks for Audio-specific risks
   * @private
   */
  private checkAudioRisks(profile: FingerprintProfile | FingerprintProfileData): RiskItem[] {
    const risks: RiskItem[] = [];
    const { audio } = profile;

    if (!audio) return risks;

    // Check if Audio is in 'real' mode
    if (audio.mode === 'real') {
      risks.push({
        category: 'audio',
        severity: 'low',
        description: 'Audio fingerprinting is not randomized',
        detectedValue: 'real',
        expectedValue: 'random',
      });
    }

    return risks;
  }

  /**
   * Checks for screen resolution risks
   * @private
   */
  private checkScreenRisks(profile: FingerprintProfile | FingerprintProfileData): RiskItem[] {
    const risks: RiskItem[] = [];
    const { screen } = profile;

    if (!screen || screen.mode === 'real') return risks;

    const { width, height } = screen;

    // Check for unusual aspect ratios
    if (width && height) {
      const aspectRatio = width / height;
      if (aspectRatio < 1 || aspectRatio > 3) {
        risks.push({
          category: 'screen',
          severity: 'low',
          description: `Unusual screen aspect ratio (${aspectRatio.toFixed(2)})`,
          detectedValue: `${width}x${height}`,
          expectedValue: 'Standard aspect ratio (16:9, 16:10, etc.)',
        });
      }
    }

    return risks;
  }

  /**
   * Checks for hardware configuration risks
   * @private
   */
  private checkHardwareRisks(profile: FingerprintProfile | FingerprintProfileData): RiskItem[] {
    const risks: RiskItem[] = [];
    const { hardware } = profile;

    if (!hardware) return risks;

    // Check for unusual CPU/memory combinations
    const { cpuCores, memory } = hardware;

    if (cpuCores === 1) {
      risks.push({
        category: 'hardware',
        severity: 'low',
        description: 'Single CPU core is uncommon for modern devices',
        detectedValue: '1 core',
        expectedValue: '2-16 cores',
      });
    }

    if (memory < 4) {
      risks.push({
        category: 'hardware',
        severity: 'low',
        description: 'Low memory may be flagged as unusual',
        detectedValue: `${memory} GB`,
        expectedValue: '4-32 GB',
      });
    }

    return risks;
  }

  /**
   * Checks for environment (timezone/language) risks
   * @private
   */
  private checkEnvironmentRisks(profile: FingerprintProfile | FingerprintProfileData): RiskItem[] {
    const risks: RiskItem[] = [];
    const { timezone, language, geolocation } = profile;

    // Check for inconsistent timezone/language/geolocation modes
    const modes = [timezone?.mode, language?.mode, geolocation?.mode];
    const ipBasedCount = modes.filter(m => m === 'ip-based').length;
    const customCount = modes.filter(m => m === 'custom').length;

    if (ipBasedCount > 0 && customCount > 0) {
      risks.push({
        category: 'consistency',
        severity: 'low',
        description: 'Mixed IP-based and custom environment settings may be inconsistent',
        detectedValue: `${ipBasedCount} IP-based, ${customCount} custom`,
        expectedValue: 'All IP-based or all custom',
      });
    }

    return risks;
  }

  /**
   * Calculates the overall risk level based on score and risks
   * @private
   */
  private calculateRiskLevel(score: number, risks: RiskItem[]): RiskLevel {
    // Count high severity risks
    const highRisks = risks.filter(r => r.severity === 'high').length;
    const mediumRisks = risks.filter(r => r.severity === 'medium').length;

    if (highRisks >= 2 || score < 50) {
      return 'high';
    }

    if (highRisks >= 1 || mediumRisks >= 3 || score < 70) {
      return 'medium';
    }

    return 'low';
  }

  /**
   * Creates a fix suggestion for a risk item
   * @private
   */
  private createFixSuggestion(risk: RiskItem): FixSuggestion {
    const suggestion: FixSuggestion = {
      riskItem: risk,
      suggestion: '',
      autoFixable: false,
    };

    switch (risk.category) {
      case 'webgl':
        if (risk.description.includes('real mode')) {
          suggestion.suggestion = 'Change WebGL mode to "custom" or "random" to prevent GPU fingerprinting';
          suggestion.autoFixable = true;
          suggestion.fixAction = 'Set webgl.mode to "random"';
        } else if (risk.description.includes('empty')) {
          suggestion.suggestion = 'Configure WebGL vendor and renderer with valid GPU information';
          suggestion.autoFixable = true;
          suggestion.fixAction = 'Generate random WebGL configuration';
        } else {
          suggestion.suggestion = 'Update WebGL configuration to match the platform';
          suggestion.autoFixable = true;
          suggestion.fixAction = 'Generate platform-compatible WebGL configuration';
        }
        break;

      case 'webrtc':
        if (risk.description.includes('real mode')) {
          suggestion.suggestion = 'Disable WebRTC or use "replaced" mode to prevent IP leaks';
          suggestion.autoFixable = true;
          suggestion.fixAction = 'Set webrtc.mode to "disabled"';
        } else if (risk.description.includes('fake local IP')) {
          suggestion.suggestion = 'Configure a fake local IP address for WebRTC';
          suggestion.autoFixable = true;
          suggestion.fixAction = 'Generate random fake local IP';
        }
        break;

      case 'ua':
        if (risk.description.includes('not configured')) {
          suggestion.suggestion = 'Configure a valid User-Agent string';
          suggestion.autoFixable = true;
          suggestion.fixAction = 'Generate User-Agent for platform';
        } else if (risk.description.includes('outdated')) {
          suggestion.suggestion = 'Update to a more recent browser version';
          suggestion.autoFixable = true;
          suggestion.fixAction = 'Update User-Agent to latest Chrome version';
        } else if (risk.description.includes('HeadlessChrome')) {
          suggestion.suggestion = 'Remove HeadlessChrome indicator from User-Agent';
          suggestion.autoFixable = true;
          suggestion.fixAction = 'Replace with standard Chrome User-Agent';
        } else {
          suggestion.suggestion = 'Update User-Agent to match the configured platform';
          suggestion.autoFixable = true;
          suggestion.fixAction = 'Regenerate User-Agent for platform';
        }
        break;

      case 'canvas':
        suggestion.suggestion = 'Enable Canvas randomization to prevent fingerprinting';
        suggestion.autoFixable = true;
        suggestion.fixAction = 'Set canvas.mode to "random"';
        break;

      case 'audio':
        suggestion.suggestion = 'Enable Audio randomization to prevent fingerprinting';
        suggestion.autoFixable = true;
        suggestion.fixAction = 'Set audio.mode to "random"';
        break;

      case 'screen':
        suggestion.suggestion = 'Use a standard screen resolution';
        suggestion.autoFixable = true;
        suggestion.fixAction = 'Set resolution to 1920x1080';
        break;

      case 'hardware':
        suggestion.suggestion = 'Use realistic hardware configuration';
        suggestion.autoFixable = true;
        suggestion.fixAction = 'Set CPU cores to 8 and memory to 16 GB';
        break;

      case 'consistency':
      case 'timezone':
      case 'language':
        suggestion.suggestion = 'Ensure environment settings are consistent';
        suggestion.autoFixable = false;
        break;

      default:
        suggestion.suggestion = 'Review and update the configuration';
        suggestion.autoFixable = false;
    }

    return suggestion;
  }

  /**
   * Applies a fix for a specific risk
   * @private
   */
  private applyRiskFix(profileData: FingerprintProfileData, risk: RiskItem): FingerprintProfileData {
    const fixed = { ...profileData };

    switch (risk.category) {
      case 'webgl':
        if (risk.description.includes('real mode') || risk.description.includes('empty')) {
          fixed.webgl = {
            ...fixed.webgl,
            mode: 'random',
            vendor: fixed.webgl?.vendor || 'Google Inc. (NVIDIA)',
            renderer: fixed.webgl?.renderer || 'ANGLE (NVIDIA GeForce GTX 1060 Direct3D11 vs_5_0 ps_5_0)',
          };
        }
        break;

      case 'webrtc':
        if (risk.description.includes('real mode')) {
          fixed.webrtc = {
            ...fixed.webrtc,
            mode: 'disabled',
          };
        } else if (risk.description.includes('fake local IP')) {
          fixed.webrtc = {
            ...fixed.webrtc,
            fakeLocalIP: '192.168.1.100',
          };
        }
        break;

      case 'ua':
        if (risk.description.includes('HeadlessChrome')) {
          fixed.userAgent = fixed.userAgent?.replace('HeadlessChrome', 'Chrome') || fixed.userAgent;
        }
        break;

      case 'canvas':
        fixed.canvas = {
          ...fixed.canvas,
          mode: 'random',
          noiseLevel: fixed.canvas?.noiseLevel || 2,
        };
        break;

      case 'audio':
        fixed.audio = {
          ...fixed.audio,
          mode: 'random',
          noiseLevel: fixed.audio?.noiseLevel || 2,
        };
        break;

      case 'screen':
        if (fixed.screen?.mode === 'custom') {
          fixed.screen = {
            ...fixed.screen,
            width: 1920,
            height: 1080,
          };
        }
        break;

      case 'hardware':
        fixed.hardware = {
          ...fixed.hardware,
          cpuCores: Math.max(fixed.hardware?.cpuCores || 8, 4),
          memory: Math.max(fixed.hardware?.memory || 16, 8),
        };
        break;
    }

    return fixed;
  }
}

export default FingerprintDetectionService;
