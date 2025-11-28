/**
 * Property-Based Tests for Batch Fingerprint Operations
 * 
 * Feature: professional-fingerprint-browser
 * Tests the batch fingerprint application functionality
 * 
 * Property 40: 批量应用指纹一致性
 * Property 41: 批量应用代理一致性
 * Validates: Requirements 32.3, 32.5
 * 
 * @module test/property/fingerprint-batch
 */

import * as fc from 'fast-check';
import * as fs from 'fs';
import * as path from 'path';
import { FingerprintProfile, FingerprintProfileData } from '../../src/domain/entities/FingerprintProfile';
import { FingerprintService, BatchProgress, BatchResult } from '../../src/application/services/FingerprintService';

const { validFingerprintProfileArbitrary } = require('../arbitraries/fingerprint');

// Test directory for batch operations
const TEST_SESSION_DIR = path.join(__dirname, '..', 'test-session-data-batch');

describe('Fingerprint Batch Operations Property Tests', () => {
  let fingerprintService: FingerprintService;
  
  beforeAll(() => {
    // Create test directory
    if (!fs.existsSync(TEST_SESSION_DIR)) {
      fs.mkdirSync(TEST_SESSION_DIR, { recursive: true });
    }
    fingerprintService = new FingerprintService(TEST_SESSION_DIR);
  });
  
  afterAll(() => {
    // Clean up test directory
    if (fs.existsSync(TEST_SESSION_DIR)) {
      fs.rmSync(TEST_SESSION_DIR, { recursive: true, force: true });
    }
  });
  
  beforeEach(() => {
    // Clean account directories before each test
    if (fs.existsSync(TEST_SESSION_DIR)) {
      const entries = fs.readdirSync(TEST_SESSION_DIR);
      for (const entry of entries) {
        const entryPath = path.join(TEST_SESSION_DIR, entry);
        if (entry.startsWith('account-')) {
          fs.rmSync(entryPath, { recursive: true, force: true });
        }
      }
    }
  });
  
  /**
   * Feature: professional-fingerprint-browser, Property 40: 批量应用指纹一致性
   * Validates: Requirements 32.3
   * 
   * For any fingerprint template and set of account IDs, applying the template
   * in batch should result in all accounts having the same fingerprint configuration.
   */
  test('Property 40: Batch fingerprint application consistency', async () => {
    await fc.assert(
      fc.asyncProperty(
        validFingerprintProfileArbitrary,
        accountIdsArbitrary(),
        async (profileData: FingerprintProfileData, accountIds: string[]) => {
          const template = new FingerprintProfile(profileData);
          
          // Apply template to all accounts
          const result = await fingerprintService.applyFingerprintBatch(accountIds, template);
          
          // Verify result structure
          expect(result.success + result.failed + result.skipped).toBe(accountIds.length);
          expect(result.successfulAccounts.length).toBe(result.success);
          expect(result.failedAccounts.length).toBe(result.failed);
          expect(result.skippedAccounts.length).toBe(result.skipped);
          
          // Verify all successful accounts have the same fingerprint
          for (const accountId of result.successfulAccounts) {
            const fingerprint = await fingerprintService.getFingerprint(accountId);
            
            expect(fingerprint).not.toBeNull();
            if (fingerprint) {
              // Core fields should match the template
              expect(fingerprint.userAgent).toBe(template.userAgent);
              expect(fingerprint.browserVersion).toBe(template.browserVersion);
              expect(fingerprint.platform).toBe(template.platform);
              expect(fingerprint.webgl.vendor).toBe(template.webgl.vendor);
              expect(fingerprint.webgl.renderer).toBe(template.webgl.renderer);
              expect(fingerprint.webgl.mode).toBe(template.webgl.mode);
            }
          }
        }
      ),
      { numRuns: 30 }
    );
  });
  
  /**
   * Property 40 (Extended): Batch result counts are accurate
   * 
   * The sum of success, failed, and skipped should equal the total accounts.
   */
  test('Property 40 (Extended): Batch result counts are accurate', async () => {
    await fc.assert(
      fc.asyncProperty(
        validFingerprintProfileArbitrary,
        accountIdsArbitrary(),
        async (profileData: FingerprintProfileData, accountIds: string[]) => {
          const template = new FingerprintProfile(profileData);
          
          const result = await fingerprintService.applyFingerprintBatch(accountIds, template);
          
          // Total should equal input count
          const total = result.success + result.failed + result.skipped;
          expect(total).toBe(accountIds.length);
          
          // Arrays should match counts
          expect(result.successfulAccounts.length).toBe(result.success);
          expect(result.failedAccounts.length).toBe(result.failed);
          expect(result.skippedAccounts.length).toBe(result.skipped);
          
          // All account IDs should be accounted for
          const allProcessed = [
            ...result.successfulAccounts,
            ...result.failedAccounts,
            ...result.skippedAccounts
          ];
          expect(allProcessed.length).toBe(accountIds.length);
          
          // Each input account should appear exactly once
          for (const accountId of accountIds) {
            const count = allProcessed.filter(id => id === accountId).length;
            expect(count).toBe(1);
          }
        }
      ),
      { numRuns: 30 }
    );
  });
  
  /**
   * Property 40 (Extended): Progress callback is called correctly
   * 
   * The progress callback should be called for each account with correct values.
   */
  test('Property 40 (Extended): Progress callback is called correctly', async () => {
    await fc.assert(
      fc.asyncProperty(
        validFingerprintProfileArbitrary,
        accountIdsArbitrary(),
        async (profileData: FingerprintProfileData, accountIds: string[]) => {
          const template = new FingerprintProfile(profileData);
          const progressUpdates: BatchProgress[] = [];
          
          await fingerprintService.applyFingerprintBatch(
            accountIds,
            template,
            (progress) => progressUpdates.push({ ...progress })
          );
          
          // Should have at least 2 updates per account (processing + result)
          expect(progressUpdates.length).toBeGreaterThanOrEqual(accountIds.length * 2);
          
          // Verify progress values
          for (const progress of progressUpdates) {
            expect(progress.currentIndex).toBeGreaterThanOrEqual(0);
            expect(progress.currentIndex).toBeLessThan(accountIds.length);
            expect(progress.totalAccounts).toBe(accountIds.length);
            expect(progress.percentComplete).toBeGreaterThanOrEqual(0);
            expect(progress.percentComplete).toBeLessThanOrEqual(100);
            expect(['processing', 'success', 'failed', 'skipped']).toContain(progress.status);
          }
          
          // Final progress should be 100%
          const lastProgress = progressUpdates[progressUpdates.length - 1];
          expect(lastProgress.percentComplete).toBe(100);
        }
      ),
      { numRuns: 20 }
    );
  });
  
  /**
   * Property 40 (Extended): Processing time is recorded
   * 
   * The batch result should include a valid processing time.
   */
  test('Property 40 (Extended): Processing time is recorded', async () => {
    await fc.assert(
      fc.asyncProperty(
        validFingerprintProfileArbitrary,
        accountIdsArbitrary(),
        async (profileData: FingerprintProfileData, accountIds: string[]) => {
          const template = new FingerprintProfile(profileData);
          
          const result = await fingerprintService.applyFingerprintBatch(accountIds, template);
          
          // Processing time should be positive
          expect(result.processingTime).toBeGreaterThanOrEqual(0);
          
          // Processing time should be reasonable (less than 1 minute for small batches)
          expect(result.processingTime).toBeLessThan(60000);
        }
      ),
      { numRuns: 20 }
    );
  });
  
  /**
   * Property 40 (Extended): Batch summary is generated correctly
   * 
   * The batch summary should contain accurate counts.
   */
  test('Property 40 (Extended): Batch summary is generated correctly', async () => {
    await fc.assert(
      fc.asyncProperty(
        validFingerprintProfileArbitrary,
        accountIdsArbitrary(),
        async (profileData: FingerprintProfileData, accountIds: string[]) => {
          const template = new FingerprintProfile(profileData);
          
          const result = await fingerprintService.applyFingerprintBatch(accountIds, template);
          const summary = fingerprintService.generateBatchSummary(result);
          
          // Summary should be a non-empty string
          expect(typeof summary).toBe('string');
          expect(summary.length).toBeGreaterThan(0);
          
          // Summary should contain the word "批量操作完成"
          expect(summary).toContain('批量操作完成');
          
          // If there were successes, summary should mention them
          if (result.success > 0) {
            expect(summary).toContain(`成功 ${result.success} 个`);
          }
          
          // If there were failures, summary should mention them
          if (result.failed > 0) {
            expect(summary).toContain(`失败 ${result.failed} 个`);
          }
        }
      ),
      { numRuns: 20 }
    );
  });
  
  /**
   * Property 40 (Extended): Empty account list returns empty result
   * 
   * Applying a template to an empty list should return a result with all zeros.
   */
  test('Property 40 (Extended): Empty account list returns empty result', async () => {
    await fc.assert(
      fc.asyncProperty(
        validFingerprintProfileArbitrary,
        async (profileData: FingerprintProfileData) => {
          const template = new FingerprintProfile(profileData);
          
          const result = await fingerprintService.applyFingerprintBatch([], template);
          
          expect(result.success).toBe(0);
          expect(result.failed).toBe(0);
          expect(result.skipped).toBe(0);
          expect(result.successfulAccounts).toHaveLength(0);
          expect(result.failedAccounts).toHaveLength(0);
          expect(result.skippedAccounts).toHaveLength(0);
          expect(result.errors).toHaveLength(0);
        }
      ),
      { numRuns: 20 }
    );
  });
  
  /**
   * Property 40 (Extended): Duplicate account IDs are handled
   * 
   * If the same account ID appears multiple times, each occurrence should be processed.
   */
  test('Property 40 (Extended): Duplicate account IDs are handled', async () => {
    await fc.assert(
      fc.asyncProperty(
        validFingerprintProfileArbitrary,
        fc.uuid(),
        async (profileData: FingerprintProfileData, accountId: string) => {
          const template = new FingerprintProfile(profileData);
          
          // Apply to the same account twice
          const result = await fingerprintService.applyFingerprintBatch(
            [accountId, accountId],
            template
          );
          
          // Both should be processed (second may succeed or fail depending on implementation)
          expect(result.success + result.failed + result.skipped).toBe(2);
          
          // The account should have a fingerprint
          const fingerprint = await fingerprintService.getFingerprint(accountId);
          expect(fingerprint).not.toBeNull();
        }
      ),
      { numRuns: 20 }
    );
  });
});

/**
 * Generates an array of unique account IDs for testing
 */
function accountIdsArbitrary(): fc.Arbitrary<string[]> {
  return fc.array(fc.uuid(), { minLength: 1, maxLength: 5 })
    .map(ids => [...new Set(ids)]); // Remove duplicates
}
