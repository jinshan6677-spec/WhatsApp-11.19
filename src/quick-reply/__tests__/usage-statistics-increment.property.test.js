/**
 * Property-Based Test: Usage Statistics Increment
 * 
 * Feature: enhanced-quick-reply-management, Property 12: 使用统计递增
 * 
 * For any content, each time it is used via the "发送" button,
 * the content's usageCount should increase by 1.
 * 
 * Validates: Requirements 11.1
 */

const fc = require('fast-check');
const path = require('path');
const fs = require('fs').promises;
const os = require('os');
const TemplateManager = require('../managers/TemplateManager');
const GroupManager = require('../managers/GroupManager');
const StatisticsManager = require('../managers/StatisticsManager');
const { TEMPLATE_TYPES } = require('../constants');

// Test configuration - minimum 100 iterations per property
const NUM_RUNS = 100;

// Helper to create temporary test directory
async function createTempDir() {
  const tempDir = path.join(os.tmpdir(), `quick-reply-usage-test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
  await fs.mkdir(tempDir, { recursive: true });
  return tempDir;
}

// Helper to cleanup test directory
async function cleanupTempDir(tempDir) {
  try {
    await fs.rm(tempDir, { recursive: true, force: true });
  } catch (error) {
    // Ignore cleanup errors
  }
}

/**
 * Generate valid account ID
 */
const accountIdArbitrary = () => fc.uuid();

/**
 * Generate valid template type
 */
const templateTypeArbitrary = () => fc.constantFrom(...Object.values(TEMPLATE_TYPES));

/**
 * Generate valid template label (non-whitespace)
 */
const templateLabelArbitrary = () => fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0);

/**
 * Generate valid non-whitespace text
 */
const nonWhitespaceTextArbitrary = () => 
  fc.string({ minLength: 1, maxLength: 500 }).filter(s => s.trim().length > 0);

/**
 * Generate valid template content based on type
 */
const templateContentArbitrary = (type) => {
  switch (type) {
    case TEMPLATE_TYPES.TEXT:
      return fc.record({ text: nonWhitespaceTextArbitrary() });
    case TEMPLATE_TYPES.IMAGE:
    case TEMPLATE_TYPES.AUDIO:
    case TEMPLATE_TYPES.VIDEO:
      return fc.record({ mediaPath: fc.string({ minLength: 1, maxLength: 200 }).filter(s => s.trim().length > 0) });
    case TEMPLATE_TYPES.MIXED:
      return fc.record({
        text: nonWhitespaceTextArbitrary(),
        mediaPath: fc.string({ minLength: 1, maxLength: 200 }).filter(s => s.trim().length > 0)
      });
    case TEMPLATE_TYPES.CONTACT:
      return fc.record({
        contactInfo: fc.record({
          name: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
          phone: fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0)
        })
      });
    default:
      return fc.record({ text: nonWhitespaceTextArbitrary() });
  }
};

/**
 * Generate valid group name (non-whitespace)
 */
const groupNameArbitrary = () => fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0);

/**
 * Generate usage count (number of times to use the template)
 */
const usageCountArbitrary = () => fc.nat({ max: 20 });

describe('Usage Statistics Increment Property Tests', () => {
  
  /**
   * Feature: enhanced-quick-reply-management, Property 12: 使用统计递增
   * Validates: Requirements 11.1
   * 
   * For any template, each time the template is used to send a message,
   * the template's usageCount should increase by 1.
   */
  test('Property 12: Usage count increments by exactly 1 for each use', async () => {
    await fc.assert(
      fc.asyncProperty(
        accountIdArbitrary(),
        groupNameArbitrary(),
        templateTypeArbitrary(),
        templateLabelArbitrary(),
        usageCountArbitrary(),
        async (accountId, groupName, templateType, templateLabel, usageCount) => {
          const tempDir = await createTempDir();
          
          try {
            const groupManager = new GroupManager(accountId, tempDir);
            const templateManager = new TemplateManager(accountId, tempDir);
            
            // Create a group and template
            const group = await groupManager.createGroup(groupName, null);
            const content = await fc.sample(templateContentArbitrary(templateType), 1)[0];
            const template = await templateManager.createTemplate(
              group.id,
              templateType,
              templateLabel,
              content
            );
            
            // Get initial usage count (should be 0 for new template)
            const initial = await templateManager.getTemplate(template.id);
            const initialCount = initial.usageCount || 0;
            
            // Record usage multiple times
            for (let i = 0; i < usageCount; i++) {
              await templateManager.recordUsage(template.id);
            }
            
            // Get final usage count
            const final = await templateManager.getTemplate(template.id);
            const finalCount = final.usageCount || 0;
            
            // Property: usageCount should have increased by exactly usageCount
            return finalCount === initialCount + usageCount;
          } finally {
            await cleanupTempDir(tempDir);
          }
        }
      ),
      { numRuns: NUM_RUNS }
    );
  });

  /**
   * Property 12.1: Usage count is non-negative
   * 
   * For any template, the usageCount should never be negative.
   */
  test('Property 12.1: Usage count is always non-negative', async () => {
    await fc.assert(
      fc.asyncProperty(
        accountIdArbitrary(),
        groupNameArbitrary(),
        templateTypeArbitrary(),
        templateLabelArbitrary(),
        usageCountArbitrary(),
        async (accountId, groupName, templateType, templateLabel, usageCount) => {
          const tempDir = await createTempDir();
          
          try {
            const groupManager = new GroupManager(accountId, tempDir);
            const templateManager = new TemplateManager(accountId, tempDir);
            
            // Create a group and template
            const group = await groupManager.createGroup(groupName, null);
            const content = await fc.sample(templateContentArbitrary(templateType), 1)[0];
            const template = await templateManager.createTemplate(
              group.id,
              templateType,
              templateLabel,
              content
            );
            
            // Record usage multiple times
            for (let i = 0; i < usageCount; i++) {
              await templateManager.recordUsage(template.id);
            }
            
            // Get final template
            const final = await templateManager.getTemplate(template.id);
            
            // Property: usageCount should be non-negative
            return (final.usageCount || 0) >= 0;
          } finally {
            await cleanupTempDir(tempDir);
          }
        }
      ),
      { numRuns: NUM_RUNS }
    );
  });

  /**
   * Property 12.2: lastUsedAt is updated on each use
   * 
   * For any template, when recordUsage is called, lastUsedAt should be updated
   * to a timestamp that is greater than or equal to the previous lastUsedAt.
   */
  test('Property 12.2: lastUsedAt is updated on each use', async () => {
    await fc.assert(
      fc.asyncProperty(
        accountIdArbitrary(),
        groupNameArbitrary(),
        templateTypeArbitrary(),
        templateLabelArbitrary(),
        async (accountId, groupName, templateType, templateLabel) => {
          const tempDir = await createTempDir();
          
          try {
            const groupManager = new GroupManager(accountId, tempDir);
            const templateManager = new TemplateManager(accountId, tempDir);
            
            // Create a group and template
            const group = await groupManager.createGroup(groupName, null);
            const content = await fc.sample(templateContentArbitrary(templateType), 1)[0];
            const template = await templateManager.createTemplate(
              group.id,
              templateType,
              templateLabel,
              content
            );
            
            // Get initial lastUsedAt (should be null for new template)
            const initial = await templateManager.getTemplate(template.id);
            const initialLastUsedAt = initial.lastUsedAt;
            
            // Record usage
            await templateManager.recordUsage(template.id);
            
            // Get updated template
            const updated = await templateManager.getTemplate(template.id);
            
            // Property: lastUsedAt should be set and be a valid timestamp
            if (!updated.lastUsedAt) return false;
            if (typeof updated.lastUsedAt !== 'number') return false;
            
            // If there was a previous lastUsedAt, the new one should be >= old one
            if (initialLastUsedAt && updated.lastUsedAt < initialLastUsedAt) return false;
            
            return true;
          } finally {
            await cleanupTempDir(tempDir);
          }
        }
      ),
      { numRuns: NUM_RUNS }
    );
  });

  /**
   * Property 12.3: Statistics report reflects usage count
   * 
   * For any template with recorded usage, the statistics report should
   * correctly reflect the template's usage count.
   */
  test('Property 12.3: Statistics report reflects usage count', async () => {
    await fc.assert(
      fc.asyncProperty(
        accountIdArbitrary(),
        groupNameArbitrary(),
        templateTypeArbitrary(),
        templateLabelArbitrary(),
        usageCountArbitrary(),
        async (accountId, groupName, templateType, templateLabel, usageCount) => {
          const tempDir = await createTempDir();
          
          try {
            const groupManager = new GroupManager(accountId, tempDir);
            const templateManager = new TemplateManager(accountId, tempDir);
            const statisticsManager = new StatisticsManager(accountId, tempDir);
            
            // Create a group and template
            const group = await groupManager.createGroup(groupName, null);
            const content = await fc.sample(templateContentArbitrary(templateType), 1)[0];
            const template = await templateManager.createTemplate(
              group.id,
              templateType,
              templateLabel,
              content
            );
            
            // Record usage multiple times
            for (let i = 0; i < usageCount; i++) {
              await templateManager.recordUsage(template.id);
            }
            
            // Generate statistics report
            const report = await statisticsManager.generateReport();
            
            // Find the template in the report
            const templateStats = report.templates.find(t => t.id === template.id);
            
            // Property: template should be in report with correct usage count
            if (!templateStats) return false;
            return templateStats.usageCount === usageCount;
          } finally {
            await cleanupTempDir(tempDir);
          }
        }
      ),
      { numRuns: NUM_RUNS }
    );
  });

  /**
   * Property 12.4: Total usage count is sum of all template usage counts
   * 
   * For any set of templates, the total usage count in the statistics report
   * should equal the sum of all individual template usage counts.
   */
  test('Property 12.4: Total usage count is sum of all template usage counts', async () => {
    await fc.assert(
      fc.asyncProperty(
        accountIdArbitrary(),
        groupNameArbitrary(),
        fc.array(
          fc.tuple(templateTypeArbitrary(), templateLabelArbitrary(), usageCountArbitrary()),
          { minLength: 1, maxLength: 5 }
        ),
        async (accountId, groupName, templateSpecs) => {
          const tempDir = await createTempDir();
          
          try {
            const groupManager = new GroupManager(accountId, tempDir);
            const templateManager = new TemplateManager(accountId, tempDir);
            const statisticsManager = new StatisticsManager(accountId, tempDir);
            
            // Create a group
            const group = await groupManager.createGroup(groupName, null);
            
            // Track expected total usage
            let expectedTotalUsage = 0;
            
            // Create templates and record usage
            for (const [type, label, usageCount] of templateSpecs) {
              const content = await fc.sample(templateContentArbitrary(type), 1)[0];
              const template = await templateManager.createTemplate(
                group.id,
                type,
                label,
                content
              );
              
              // Record usage
              for (let i = 0; i < usageCount; i++) {
                await templateManager.recordUsage(template.id);
              }
              
              expectedTotalUsage += usageCount;
            }
            
            // Generate statistics report
            const report = await statisticsManager.generateReport();
            
            // Property: total usage count should equal sum of all template usage counts
            return report.totalUsageCount === expectedTotalUsage;
          } finally {
            await cleanupTempDir(tempDir);
          }
        }
      ),
      { numRuns: 30 }  // Reduced iterations for this complex test
    );
  }, 120000);  // 120 second timeout for complex test
});
