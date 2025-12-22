/**
 * Property-Based Tests for Batch Delete Completeness
 * 
 * Feature: enhanced-quick-reply-management, Property 10: 批量删除完整性
 * 
 * Tests the correctness of batch delete functionality.
 * Uses fast-check for property-based testing with 100 iterations per property.
 * 
 * Requirements: 8.6
 */

const fc = require('fast-check');
const path = require('path');
const fs = require('fs').promises;
const os = require('os');
const TemplateManager = require('../managers/TemplateManager');
const GroupManager = require('../managers/GroupManager');
const { TEMPLATE_TYPES } = require('../constants');

// Test configuration
const NUM_RUNS = 100;

/**
 * Generate a valid template content based on type
 */
const generateContent = (type) => {
  switch (type) {
    case TEMPLATE_TYPES.TEXT:
      return { text: 'Test content' };
    case TEMPLATE_TYPES.IMAGE:
      return { mediaPath: '/path/to/image.jpg' };
    case TEMPLATE_TYPES.AUDIO:
      return { mediaPath: '/path/to/audio.mp3' };
    case TEMPLATE_TYPES.VIDEO:
      return { mediaPath: '/path/to/video.mp4' };
    case TEMPLATE_TYPES.MIXED:
      return { text: 'Test content', mediaPath: '/path/to/image.jpg' };
    case TEMPLATE_TYPES.CONTACT:
      return { contactInfo: { name: 'Test', phone: '123456789' } };
    default:
      return { text: 'Test content' };
  }
};

/**
 * Generate a random subset of indices from an array
 */
const subsetArbitrary = (maxLength) => fc.array(
  fc.nat({ max: Math.max(0, maxLength - 1) }),
  { minLength: 0, maxLength: Math.max(1, maxLength) }
).map(indices => [...new Set(indices)]); // Remove duplicates

describe('Batch Delete Completeness Property-Based Tests', () => {
  let testDir;
  const accountId = 'test-account-batch-delete-pbt';

  beforeEach(async () => {
    // Create temporary test directory
    testDir = path.join(os.tmpdir(), `quick-reply-test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
    await fs.mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    // Clean up test directory
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  /**
   * Feature: enhanced-quick-reply-management, Property 10: 批量删除完整性
   * **Validates: Requirements 8.6**
   * 
   * For any batch delete operation, all selected content should be deleted,
   * and only selected content should be deleted.
   */
  describe('Property 10: Batch Delete Completeness', () => {
    
    /**
     * All selected templates should be deleted after batch delete
     * Validates: Requirement 8.6
     */
    test('Property 10a: All selected templates are deleted', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 10 }), // Number of templates to create
          fc.integer({ min: 1, max: 10 }), // Number of templates to select for deletion
          async (totalCount, selectCount) => {
            // Ensure selectCount doesn't exceed totalCount
            const actualSelectCount = Math.min(selectCount, totalCount);
            
            // Create fresh managers for each test
            const templateManager = new TemplateManager(accountId, testDir);
            const groupManager = new GroupManager(accountId, testDir);
            
            // Create a group
            const group = await groupManager.createGroup('Test Group');
            
            // Create templates
            const createdTemplates = [];
            for (let i = 0; i < totalCount; i++) {
              const template = await templateManager.createTemplate(
                group.id,
                TEMPLATE_TYPES.TEXT,
                `Template ${i + 1}`,
                { text: `Content ${i + 1}` }
              );
              createdTemplates.push(template);
            }
            
            // Select templates to delete (first N templates)
            const templatesToDelete = createdTemplates.slice(0, actualSelectCount);
            const templateIdsToDelete = templatesToDelete.map(t => t.id);
            
            // Perform batch delete
            const deletedCount = await templateManager.batchDeleteTemplates(templateIdsToDelete);
            
            // Verify all selected templates were deleted
            expect(deletedCount).toBe(actualSelectCount);
            
            // Verify selected templates no longer exist
            for (const templateId of templateIdsToDelete) {
              const template = await templateManager.getTemplate(templateId);
              expect(template).toBeNull();
            }
            
            return true;
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    /**
     * Only selected templates should be deleted, others remain
     * Validates: Requirement 8.6
     */
    test('Property 10b: Only selected templates are deleted', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 2, max: 10 }), // Need at least 2 templates
          fc.integer({ min: 1, max: 5 }),  // Number to delete (less than total)
          async (totalCount, deleteCount) => {
            // Ensure deleteCount is less than totalCount
            const actualDeleteCount = Math.min(deleteCount, totalCount - 1);
            
            // Create fresh managers for each test
            const templateManager = new TemplateManager(accountId, testDir);
            const groupManager = new GroupManager(accountId, testDir);
            
            // Create a group
            const group = await groupManager.createGroup('Test Group');
            
            // Create templates
            const createdTemplates = [];
            for (let i = 0; i < totalCount; i++) {
              const template = await templateManager.createTemplate(
                group.id,
                TEMPLATE_TYPES.TEXT,
                `Template ${i + 1}`,
                { text: `Content ${i + 1}` }
              );
              createdTemplates.push(template);
            }
            
            // Select templates to delete (first N templates)
            const templatesToDelete = createdTemplates.slice(0, actualDeleteCount);
            const templateIdsToDelete = templatesToDelete.map(t => t.id);
            
            // Templates that should remain
            const templatesToKeep = createdTemplates.slice(actualDeleteCount);
            const templateIdsToKeep = templatesToKeep.map(t => t.id);
            
            // Perform batch delete
            await templateManager.batchDeleteTemplates(templateIdsToDelete);
            
            // Verify non-selected templates still exist
            for (const templateId of templateIdsToKeep) {
              const template = await templateManager.getTemplate(templateId);
              expect(template).not.toBeNull();
              expect(template.id).toBe(templateId);
            }
            
            // Verify remaining count is correct
            const remainingTemplates = await templateManager.getTemplatesByGroup(group.id);
            expect(remainingTemplates.length).toBe(totalCount - actualDeleteCount);
            
            return true;
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    /**
     * Batch delete with empty selection should not delete anything
     * Validates: Requirement 8.6 (edge case)
     */
    test('Property 10c: Empty selection deletes nothing', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 10 }), // Number of templates to create
          async (totalCount) => {
            // Create fresh managers for each test
            const templateManager = new TemplateManager(accountId, testDir);
            const groupManager = new GroupManager(accountId, testDir);
            
            // Create a group
            const group = await groupManager.createGroup('Test Group');
            
            // Create templates
            for (let i = 0; i < totalCount; i++) {
              await templateManager.createTemplate(
                group.id,
                TEMPLATE_TYPES.TEXT,
                `Template ${i + 1}`,
                { text: `Content ${i + 1}` }
              );
            }
            
            // Verify empty array throws error (as per existing implementation)
            await expect(
              templateManager.batchDeleteTemplates([])
            ).rejects.toThrow('Template IDs array is required');
            
            // Verify all templates still exist
            const remainingTemplates = await templateManager.getTemplatesByGroup(group.id);
            expect(remainingTemplates.length).toBe(totalCount);
            
            return true;
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    /**
     * Batch delete with non-existent IDs should only delete existing ones
     * Validates: Requirement 8.6
     */
    test('Property 10d: Non-existent IDs are handled gracefully', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 5 }), // Number of real templates
          fc.integer({ min: 1, max: 5 }), // Number of fake IDs
          async (realCount, fakeCount) => {
            // Create fresh managers for each test
            const templateManager = new TemplateManager(accountId, testDir);
            const groupManager = new GroupManager(accountId, testDir);
            
            // Create a group
            const group = await groupManager.createGroup('Test Group');
            
            // Create templates
            const createdTemplates = [];
            for (let i = 0; i < realCount; i++) {
              const template = await templateManager.createTemplate(
                group.id,
                TEMPLATE_TYPES.TEXT,
                `Template ${i + 1}`,
                { text: `Content ${i + 1}` }
              );
              createdTemplates.push(template);
            }
            
            // Create array with real and fake IDs
            const realIds = createdTemplates.map(t => t.id);
            const fakeIds = Array.from({ length: fakeCount }, (_, i) => `fake-id-${i}`);
            const mixedIds = [...realIds, ...fakeIds];
            
            // Perform batch delete
            const deletedCount = await templateManager.batchDeleteTemplates(mixedIds);
            
            // Should only delete the real templates
            expect(deletedCount).toBe(realCount);
            
            // Verify all real templates are deleted
            for (const templateId of realIds) {
              const template = await templateManager.getTemplate(templateId);
              expect(template).toBeNull();
            }
            
            return true;
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    /**
     * Batch delete is idempotent - deleting same IDs twice has no additional effect
     * Validates: Requirement 8.6
     */
    test('Property 10e: Batch delete is idempotent', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 5 }), // Number of templates
          async (totalCount) => {
            // Create fresh managers for each test
            const templateManager = new TemplateManager(accountId, testDir);
            const groupManager = new GroupManager(accountId, testDir);
            
            // Create a group
            const group = await groupManager.createGroup('Test Group');
            
            // Create templates
            const createdTemplates = [];
            for (let i = 0; i < totalCount; i++) {
              const template = await templateManager.createTemplate(
                group.id,
                TEMPLATE_TYPES.TEXT,
                `Template ${i + 1}`,
                { text: `Content ${i + 1}` }
              );
              createdTemplates.push(template);
            }
            
            const templateIds = createdTemplates.map(t => t.id);
            
            // First delete
            const firstDeleteCount = await templateManager.batchDeleteTemplates(templateIds);
            expect(firstDeleteCount).toBe(totalCount);
            
            // Second delete of same IDs should delete 0
            const secondDeleteCount = await templateManager.batchDeleteTemplates(templateIds);
            expect(secondDeleteCount).toBe(0);
            
            return true;
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

  });

});
