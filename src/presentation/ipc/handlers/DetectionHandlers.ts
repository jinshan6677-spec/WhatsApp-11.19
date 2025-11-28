/**
 * Detection IPC Handlers
 * 
 * Handles IPC communication for fingerprint detection and validation services.
 * Provides channels for running detection tests, analyzing results, and
 * generating fix suggestions.
 * 
 * IPC Channels (8 total):
 * - detection:run-full - Run full fingerprint detection
 * - detection:run-quick - Run quick fingerprint check
 * - detection:get-risks - Get identified risks
 * - detection:get-suggestions - Get fix suggestions for risks
 * - detection:auto-fix - Auto-fix identified issues
 * - detection:get-score - Get fingerprint score
 * - detection:validate-consistency - Validate fingerprint consistency
 * - detection:get-report - Get detailed detection report
 * 
 * @module presentation/ipc/handlers/DetectionHandlers
 */

import { ipcMain, IpcMainInvokeEvent } from 'electron';
import { FingerprintDetectionService, DetectionResult, RiskItem } from '../../../application/services/FingerprintDetectionService';
import { FingerprintValidator, ValidationResult } from '../../../infrastructure/fingerprint/FingerprintValidator';
import { FingerprintProfile, FingerprintProfileData } from '../../../domain/entities/FingerprintProfile';

// Store references for cleanup
let _detectionService: FingerprintDetectionService | null = null;
let _validator: FingerprintValidator | null = null;

/**
 * List of all detection IPC channels
 */
const CHANNELS = [
  'detection:run-full',
  'detection:run-quick',
  'detection:get-risks',
  'detection:get-suggestions',
  'detection:auto-fix',
  'detection:get-score',
  'detection:validate-consistency',
  'detection:get-report'
];

/**
 * Creates a structured error response
 */
function createErrorResponse(code: string, message: string, context: Record<string, unknown> = {}): object {
  return {
    success: false,
    error: {
      code,
      message,
      context,
      timestamp: new Date().toISOString()
    }
  };
}

/**
 * Creates a success response
 */
function createSuccessResponse(data: Record<string, unknown> = {}): object {
  return {
    success: true,
    ...data
  };
}

/**
 * Handler dependencies interface
 */
interface DetectionHandlerDependencies {
  detectionService?: FingerprintDetectionService;
  validator?: FingerprintValidator;
}

/**
 * Register detection IPC handlers
 */
function register(dependencies: DetectionHandlerDependencies): void {
  const { detectionService, validator } = dependencies;

  _detectionService = detectionService || null;
  _validator = validator || new FingerprintValidator();

  // Run full fingerprint detection
  ipcMain.handle('detection:run-full', async (_event: IpcMainInvokeEvent, config: FingerprintProfileData) => {
    try {
      if (!config) {
        return createErrorResponse('INVALID_PARAMS', 'Configuration is required');
      }

      if (!_detectionService) {
        // Fallback to validator-only detection
        const profile = new FingerprintProfile(config);
        const validationResult = FingerprintValidator.validate(config);
        
        return createSuccessResponse({
          result: {
            score: validationResult.valid ? 85 : 50,
            riskLevel: validationResult.valid ? 'low' : (validationResult.errors.length > 2 ? 'high' : 'medium'),
            risks: validationResult.errors.map((err, idx) => ({
              category: 'consistency',
              severity: 'medium',
              description: err
            })),
            timestamp: new Date()
          }
        });
      }

      const profile = new FingerprintProfile(config);
      const result = await _detectionService.detectFingerprint(profile);
      return createSuccessResponse({ result });
    } catch (error) {
      console.error('[DetectionHandlers] run-full error:', error);
      return createErrorResponse('DETECTION_FAILED', (error as Error).message);
    }
  });

  // Run quick fingerprint check
  ipcMain.handle('detection:run-quick', async (_event: IpcMainInvokeEvent, config: FingerprintProfileData) => {
    try {
      if (!config) {
        return createErrorResponse('INVALID_PARAMS', 'Configuration is required');
      }

      // Quick check using validator only
      const validationResult = FingerprintValidator.validate(config);
      
      return createSuccessResponse({
        valid: validationResult.valid,
        errors: validationResult.errors,
        warnings: validationResult.warnings,
        quickScore: validationResult.valid ? 85 : 50
      });
    } catch (error) {
      console.error('[DetectionHandlers] run-quick error:', error);
      return createErrorResponse('QUICK_CHECK_FAILED', (error as Error).message);
    }
  });

  // Get identified risks
  ipcMain.handle('detection:get-risks', async (_event: IpcMainInvokeEvent, config: FingerprintProfileData) => {
    try {
      if (!config) {
        return createErrorResponse('INVALID_PARAMS', 'Configuration is required');
      }

      const validationResult = FingerprintValidator.validate(config);
      
      const risks: RiskItem[] = [
        ...validationResult.errors.map((err: string) => ({
          category: 'consistency' as const,
          severity: 'high' as const,
          description: err
        })),
        ...validationResult.warnings.map((warn: string) => ({
          category: 'consistency' as const,
          severity: 'medium' as const,
          description: warn
        }))
      ];

      return createSuccessResponse({
        risks,
        totalRisks: risks.length,
        highSeverity: risks.filter(r => r.severity === 'high').length,
        mediumSeverity: risks.filter(r => r.severity === 'medium').length,
        lowSeverity: risks.filter(r => r.severity === 'low').length
      });
    } catch (error) {
      console.error('[DetectionHandlers] get-risks error:', error);
      return createErrorResponse('GET_RISKS_FAILED', (error as Error).message);
    }
  });

  // Get fix suggestions for risks
  ipcMain.handle('detection:get-suggestions', async (_event: IpcMainInvokeEvent, risks: RiskItem[]) => {
    try {
      if (!risks || !Array.isArray(risks)) {
        return createErrorResponse('INVALID_PARAMS', 'Risks array is required');
      }

      if (_detectionService) {
        const suggestions = _detectionService.getFixSuggestions(risks);
        return createSuccessResponse({ suggestions });
      }

      // Fallback suggestions
      const suggestions = risks.map(risk => ({
        riskItem: risk,
        suggestion: `Consider reviewing the ${risk.category} configuration: ${risk.description}`,
        autoFixable: false
      }));

      return createSuccessResponse({ suggestions });
    } catch (error) {
      console.error('[DetectionHandlers] get-suggestions error:', error);
      return createErrorResponse('GET_SUGGESTIONS_FAILED', (error as Error).message);
    }
  });

  // Auto-fix identified issues
  ipcMain.handle('detection:auto-fix', async (_event: IpcMainInvokeEvent, config: FingerprintProfileData, risks: RiskItem[]) => {
    try {
      if (!config) {
        return createErrorResponse('INVALID_PARAMS', 'Configuration is required');
      }
      if (!risks || !Array.isArray(risks)) {
        return createErrorResponse('INVALID_PARAMS', 'Risks array is required');
      }

      if (!_detectionService) {
        return createErrorResponse('SERVICE_UNAVAILABLE', 'Detection service is not available for auto-fix');
      }

      const profile = new FingerprintProfile(config);
      const fixed = await _detectionService.autoFix(profile, risks);
      
      return createSuccessResponse({
        fingerprint: fixed.toJSON(),
        fixedCount: risks.length
      });
    } catch (error) {
      console.error('[DetectionHandlers] auto-fix error:', error);
      return createErrorResponse('AUTO_FIX_FAILED', (error as Error).message);
    }
  });

  // Get fingerprint score
  ipcMain.handle('detection:get-score', async (_event: IpcMainInvokeEvent, config: FingerprintProfileData) => {
    try {
      if (!config) {
        return createErrorResponse('INVALID_PARAMS', 'Configuration is required');
      }

      const validationResult = FingerprintValidator.validate(config);
      
      // Calculate score based on validation results
      let score = 100;
      score -= validationResult.errors.length * 15;
      score -= validationResult.warnings.length * 5;
      score = Math.max(0, Math.min(100, score));

      let riskLevel: 'low' | 'medium' | 'high';
      if (score >= 80) {
        riskLevel = 'low';
      } else if (score >= 50) {
        riskLevel = 'medium';
      } else {
        riskLevel = 'high';
      }

      return createSuccessResponse({
        score,
        riskLevel,
        breakdown: {
          errors: validationResult.errors.length,
          warnings: validationResult.warnings.length,
          valid: validationResult.valid
        }
      });
    } catch (error) {
      console.error('[DetectionHandlers] get-score error:', error);
      return createErrorResponse('GET_SCORE_FAILED', (error as Error).message);
    }
  });

  // Validate fingerprint consistency
  ipcMain.handle('detection:validate-consistency', async (_event: IpcMainInvokeEvent, config: FingerprintProfileData) => {
    try {
      if (!config) {
        return createErrorResponse('INVALID_PARAMS', 'Configuration is required');
      }

      const result = FingerprintValidator.validate(config);
      
      return createSuccessResponse({
        consistent: result.valid,
        errors: result.errors,
        warnings: result.warnings,
        checks: {
          userAgentPlatformMatch: !result.errors.some((e: string) => e.includes('User-Agent') && e.includes('platform')),
          webglPlatformMatch: !result.errors.some((e: string) => e.includes('WebGL') && e.includes('platform')),
          screenResolutionValid: !result.errors.some((e: string) => e.includes('screen') || e.includes('resolution')),
          hardwareConsistent: !result.errors.some((e: string) => e.includes('CPU') || e.includes('memory'))
        }
      });
    } catch (error) {
      console.error('[DetectionHandlers] validate-consistency error:', error);
      return createErrorResponse('VALIDATE_CONSISTENCY_FAILED', (error as Error).message);
    }
  });

  // Get detailed detection report
  ipcMain.handle('detection:get-report', async (_event: IpcMainInvokeEvent, config: FingerprintProfileData) => {
    try {
      if (!config) {
        return createErrorResponse('INVALID_PARAMS', 'Configuration is required');
      }

      const validationResult = FingerprintValidator.validate(config);
      
      // Calculate score
      let score = 100;
      score -= validationResult.errors.length * 15;
      score -= validationResult.warnings.length * 5;
      score = Math.max(0, Math.min(100, score));

      // Build detailed report
      const report = {
        timestamp: new Date().toISOString(),
        score,
        riskLevel: score >= 80 ? 'low' : (score >= 50 ? 'medium' : 'high'),
        summary: {
          totalIssues: validationResult.errors.length + validationResult.warnings.length,
          criticalIssues: validationResult.errors.length,
          warnings: validationResult.warnings.length,
          passed: validationResult.valid
        },
        categories: {
          browser: {
            userAgent: config.userAgent,
            browserVersion: config.browserVersion,
            platform: config.platform,
            issues: validationResult.errors.filter((e: string) => e.includes('User-Agent') || e.includes('browser'))
          },
          webgl: {
            vendor: config.webgl?.vendor,
            renderer: config.webgl?.renderer,
            mode: config.webgl?.mode,
            issues: validationResult.errors.filter((e: string) => e.includes('WebGL'))
          },
          canvas: {
            mode: config.canvas?.mode,
            issues: validationResult.errors.filter((e: string) => e.includes('Canvas'))
          },
          audio: {
            mode: config.audio?.mode,
            issues: validationResult.errors.filter((e: string) => e.includes('Audio'))
          },
          webrtc: {
            mode: config.webrtc?.mode,
            issues: validationResult.errors.filter((e: string) => e.includes('WebRTC'))
          },
          environment: {
            timezone: config.timezone,
            language: config.language,
            geolocation: config.geolocation,
            issues: validationResult.errors.filter((e: string) => e.includes('timezone') || e.includes('language') || e.includes('geolocation'))
          },
          hardware: {
            cpuCores: config.hardware?.cpuCores,
            memory: config.hardware?.memory,
            screen: config.screen,
            issues: validationResult.errors.filter((e: string) => e.includes('CPU') || e.includes('memory') || e.includes('screen'))
          }
        },
        recommendations: validationResult.errors.map((err: string) => ({
          issue: err,
          recommendation: `Fix: ${err}`,
          priority: 'high'
        })).concat(validationResult.warnings.map((warn: string) => ({
          issue: warn,
          recommendation: `Consider: ${warn}`,
          priority: 'medium'
        })))
      };

      return createSuccessResponse({ report });
    } catch (error) {
      console.error('[DetectionHandlers] get-report error:', error);
      return createErrorResponse('GET_REPORT_FAILED', (error as Error).message);
    }
  });

  console.log('[DetectionHandlers] Registered 8 IPC channels');
}

/**
 * Unregister all detection IPC handlers
 */
function unregister(): void {
  for (const channel of CHANNELS) {
    ipcMain.removeHandler(channel);
  }

  _detectionService = null;
  _validator = null;

  console.log('[DetectionHandlers] Unregistered all IPC channels');
}

/**
 * Get list of registered channels
 */
function getChannels(): string[] {
  return [...CHANNELS];
}

export {
  register,
  unregister,
  getChannels,
  CHANNELS
};
