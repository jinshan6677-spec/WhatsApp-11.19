/**
 * Property-Based Tests for Fingerprint Detection Service
 * 
 * Feature: professional-fingerprint-browser
 * Tests the fingerprint detection and risk identification functionality
 * 
 * Property 30: 指纹检测风险识别
 * Validates: Requirements 26.2
 * 
 * @module test/property/fingerprint-detection
 */

import * as fc from 'fast-check';
import { FingerprintProfile, FingerprintProfileData } from '../../src/domain/entities/FingerprintProfile';
import { FingerprintDetectionService, RiskItem, DetectionResult } from '../../src/application/services/FingerprintDetectionService';

const { validFingerprintProfileArbitrary } = require('../arbitraries/fingerprint');

describe('Fingerprint Detection Property Tests', () => {
  let detectionService: FingerprintDetectionService;
  
  beforeAll(() => {
    detectionService = new FingerprintDetectionService();
  });
  
  /**
   * Feature: professional-fingerprint-browser, Property 30: 指纹检测风险识别
   * Validates: Requirements 26.2
   * 
   * For any fingerprint profile, the detection service should:
   * 1. Return a valid score between 0 and 100
   * 2. Return a valid risk level (low, medium, high)
   * 3. Return an array of risk items (may be empty)
   * 4. Include a timestamp
   */
  test('Property 30: Detection returns valid result structure', async () => {
    await fc.assert(
      fc.asyncProperty(
        validFingerprintProfileArbitrary,
        async (profileData: FingerprintProfileData) => {
          const profile = new FingerprintProfile(profileData);
          
          const result = await detectionService.detectFingerprint(profile);
          
          // Verify score is within valid range
          expect(result.score).toBeGreaterThanOrEqual(0);
          expect(result.score).toBeLessThanOrEqual(100);
          
          // Verify risk level is valid
          expect(['low', 'medium', 'high']).toContain(result.riskLevel);
          
          // Verify risks is an array
          expect(Array.isArray(result.risks)).toBe(true);
          
          // Verify timestamp is a valid date
          expect(result.timestamp).toBeInstanceOf(Date);
          expect(result.timestamp.getTime()).toBeLessThanOrEqual(Date.now());
        }
      ),
      { numRuns: 100 }
    );
  });
  
  /**
   * Property 30 (Extended): Risk items have valid structure
   * 
   * For any detected risk item, it should have:
   * 1. A valid category
   * 2. A valid severity
   * 3. A non-empty description
   */
  test('Property 30 (Extended): Risk items have valid structure', async () => {
    await fc.assert(
      fc.asyncProperty(
        validFingerprintProfileArbitrary,
        async (profileData: FingerprintProfileData) => {
          const profile = new FingerprintProfile(profileData);
          
          const result = await detectionService.detectFingerprint(profile);
          
          for (const risk of result.risks) {
            // Verify category is valid
            expect([
              'webgl', 'webrtc', 'ua', 'canvas', 'audio', 
              'consistency', 'screen', 'hardware', 'timezone', 'language'
            ]).toContain(risk.category);
            
            // Verify severity is valid
            expect(['low', 'medium', 'high']).toContain(risk.severity);
            
            // Verify description is non-empty
            expect(risk.description).toBeDefined();
            expect(typeof risk.description).toBe('string');
            expect(risk.description.length).toBeGreaterThan(0);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
  
  /**
   * Property 30 (Extended): High severity risks lower the score
   * 
   * Profiles with high severity risks should have lower scores than
   * profiles without high severity risks (on average).
   */
  test('Property 30 (Extended): High severity risks affect score', async () => {
    await fc.assert(
      fc.asyncProperty(
        validFingerprintProfileArbitrary,
        async (profileData: FingerprintProfileData) => {
          const profile = new FingerprintProfile(profileData);
          
          const result = await detectionService.detectFingerprint(profile);
          
          const highRisks = result.risks.filter(r => r.severity === 'high');
          
          // If there are high severity risks, score should be reduced
          if (highRisks.length > 0) {
            // Score should be less than perfect (100)
            expect(result.score).toBeLessThan(100);
          }
          
          // If there are many high risks, risk level should be high
          if (highRisks.length >= 2) {
            expect(result.riskLevel).toBe('high');
          }
        }
      ),
      { numRuns: 100 }
    );
  });
  
  /**
   * Property 30 (Extended): Fix suggestions are provided for all risks
   * 
   * For any detected risk, the service should provide a fix suggestion.
   */
  test('Property 30 (Extended): Fix suggestions provided for all risks', async () => {
    await fc.assert(
      fc.asyncProperty(
        validFingerprintProfileArbitrary,
        async (profileData: FingerprintProfileData) => {
          const profile = new FingerprintProfile(profileData);
          
          const result = await detectionService.detectFingerprint(profile);
          
          if (result.risks.length > 0) {
            const suggestions = detectionService.getFixSuggestions(result.risks);
            
            // Should have same number of suggestions as risks
            expect(suggestions.length).toBe(result.risks.length);
            
            // Each suggestion should have required fields
            for (const suggestion of suggestions) {
              expect(suggestion.riskItem).toBeDefined();
              expect(suggestion.suggestion).toBeDefined();
              expect(typeof suggestion.suggestion).toBe('string');
              expect(suggestion.suggestion.length).toBeGreaterThan(0);
              expect(typeof suggestion.autoFixable).toBe('boolean');
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });
  
  /**
   * Property 30 (Extended): Auto-fix produces valid profile
   * 
   * After auto-fixing a profile, the result should still be a valid
   * fingerprint profile that can be detected.
   */
  test('Property 30 (Extended): Auto-fix produces valid profile', async () => {
    await fc.assert(
      fc.asyncProperty(
        validFingerprintProfileArbitrary,
        async (profileData: FingerprintProfileData) => {
          const profile = new FingerprintProfile(profileData);
          
          // Get initial detection
          const initialResult = await detectionService.detectFingerprint(profile);
          
          // Apply auto-fix
          const fixedProfile = await detectionService.autoFix(profile, initialResult.risks);
          
          // Fixed profile should be valid
          expect(fixedProfile).toBeInstanceOf(FingerprintProfile);
          
          // Should be able to detect the fixed profile
          const fixedResult = await detectionService.detectFingerprint(fixedProfile);
          
          // Fixed result should have valid structure
          expect(fixedResult.score).toBeGreaterThanOrEqual(0);
          expect(fixedResult.score).toBeLessThanOrEqual(100);
          expect(['low', 'medium', 'high']).toContain(fixedResult.riskLevel);
          expect(Array.isArray(fixedResult.risks)).toBe(true);
        }
      ),
      { numRuns: 50 }
    );
  });
  
  /**
   * Property 30 (Extended): WebRTC real mode is detected as high risk
   * 
   * When WebRTC is in 'real' mode, it should be detected as a high severity risk.
   */
  test('Property 30 (Extended): WebRTC real mode detected as high risk', async () => {
    await fc.assert(
      fc.asyncProperty(
        validFingerprintProfileArbitrary,
        async (profileData: FingerprintProfileData) => {
          // Force WebRTC to real mode
          const modifiedData: FingerprintProfileData = {
            ...profileData,
            webrtc: { mode: 'real' }
          };
          
          const profile = new FingerprintProfile(modifiedData);
          const result = await detectionService.detectFingerprint(profile);
          
          // Should detect WebRTC risk
          const webrtcRisks = result.risks.filter(r => r.category === 'webrtc');
          expect(webrtcRisks.length).toBeGreaterThan(0);
          
          // At least one should be high severity
          const highWebrtcRisks = webrtcRisks.filter(r => r.severity === 'high');
          expect(highWebrtcRisks.length).toBeGreaterThan(0);
        }
      ),
      { numRuns: 50 }
    );
  });
  
  /**
   * Property 30 (Extended): Detection is deterministic
   * 
   * Running detection twice on the same profile should produce
   * the same score and risk count.
   */
  test('Property 30 (Extended): Detection is deterministic', async () => {
    await fc.assert(
      fc.asyncProperty(
        validFingerprintProfileArbitrary,
        async (profileData: FingerprintProfileData) => {
          const profile = new FingerprintProfile(profileData);
          
          const result1 = await detectionService.detectFingerprint(profile);
          const result2 = await detectionService.detectFingerprint(profile);
          
          // Score should be the same
          expect(result1.score).toBe(result2.score);
          
          // Risk level should be the same
          expect(result1.riskLevel).toBe(result2.riskLevel);
          
          // Number of risks should be the same
          expect(result1.risks.length).toBe(result2.risks.length);
          
          // Risk categories should be the same
          const categories1 = result1.risks.map(r => r.category).sort();
          const categories2 = result2.risks.map(r => r.category).sort();
          expect(categories1).toEqual(categories2);
        }
      ),
      { numRuns: 50 }
    );
  });
  
  /**
   * Property 30 (Extended): Score correlates with risk level
   * 
   * Higher scores should correlate with lower risk levels.
   * Note: Boundary conditions (score = 50, 70) may be classified either way.
   */
  test('Property 30 (Extended): Score correlates with risk level', async () => {
    await fc.assert(
      fc.asyncProperty(
        validFingerprintProfileArbitrary,
        async (profileData: FingerprintProfileData) => {
          const profile = new FingerprintProfile(profileData);
          
          const result = await detectionService.detectFingerprint(profile);
          
          // High risk level should have score < 75 (allowing some boundary flexibility)
          if (result.riskLevel === 'high') {
            expect(result.score).toBeLessThan(75);
          }
          
          // Low risk level should have score >= 70
          if (result.riskLevel === 'low') {
            expect(result.score).toBeGreaterThanOrEqual(70);
          }
          
          // Very low scores should always be high risk
          if (result.score < 50) {
            expect(result.riskLevel).toBe('high');
          }
          
          // Very high scores should not be high risk
          if (result.score > 85) {
            expect(result.riskLevel).not.toBe('high');
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
