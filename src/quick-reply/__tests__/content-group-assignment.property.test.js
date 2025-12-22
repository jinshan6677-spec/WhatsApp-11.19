/**
 * Property-Based Tests for Content Addition Group Assignment
 * 
 * Feature: enhanced-quick-reply-management, Property 6: 内容添加分组归属
 * 
 * Tests the correctness of content being added to the correct group.
 * Uses fast-check for property-based testing with 100 iterations per property.
 * 
 * Requirements: 5.7
 */

const fc = require('fast-check');
const TemplateManager = require('../managers/TemplateManager');
const GroupManager = require('../managers/GroupManager');
const { TEMPLATE_TYPES } = require('../constants/templateTypes');
const { VISIBILITY_TYPES } = require('../constants/visibilityTypes');
const path = require('path');
const fs = require('fs');
const os = require('os');

// Test configuration
const NUM_RUNS = 100;

// Create a unique test directory for each test run
const createTestDir = () => {
  const testDir = path.join(os.tmpdir(), `quick-reply-test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
  fs.mkdirSync(testDir, { recursive: true });
  return testDir;
};

// Clean up test directory
const cleanupTestDir = (testDir) => {
  try {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  } catch (error) {
    // Ignore cleanup errors
  }
};

/**
 * Generate a valid template label
 */
const labelArbitrary = () => fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0);

/**
 * Generate valid text content
 */
const textContentArbitrary = () => fc.record({
  text: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0)
});

/**
 * Generate a valid account ID
 */
const accountIdArbitrary = () => fc.uuid();

/**
 * Generate a valid group name
 */
const groupNameArbitrary = () => fc.string({ minLength: 1, maxLength: 30 }).filter(s => s.trim().length > 0);

describe('Content Group Assignment Property-Based Tests', () => {
  
  /**
   * Feature: enhanced-quick-reply-management, Property 6: 内容添加分组归属
   * **Validates: Requirements 5.7**
   * 
   * For any content added through the toolbar, the content should be added
   * to the currently selected group and immediately displayed in the right
   * content area.
   */
  describe('Property 6: Content Addition Group Assignment', () => {
    
    let testDir;
    
    beforeEach(() => {
      testDir = createTestDir();
    });
    
    afterEach(() => {
      cleanupTestDir(testDir);
    });

    /**
     * Property 6a: Created template has correct groupId
     * Validates: Requirement 5.7
     */
    test('Property 6a: Created template has correct groupId', async () => {
      await fc.assert(
        fc.asyncProperty(
          accountIdArbitrary(),
          groupNameArbitrary(),
          labelArbitrary(),
          textContentArbitrary(),
          async (accountId, groupName, label, content) => {
            const localTestDir = createTestDir();
            
            try {
              const groupManager = new GroupManager(accountId, localTestDir);
              const templateManager = new TemplateManager(accountId, localTestDir);
              
              // Create a group
              const group = await groupManager.createGroup(groupName);
              expect(group).toBeDefined();
              expect(group.id).toBeDefined();
              
              // Create a template in that group
              const template = await templateManager.createTemplate(
                group.id,
                TEMPLATE_TYPES.TEXT,
                label,
                content
              );
              
              // Verify the template has the correct groupId
              expect(template).toBeDefined();
              expect(template.groupId).toBe(group.id);
              
              return true;
            } finally {
              cleanupTestDir(localTestDir);
            }
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    /**
     * Property 6b: Template can be retrieved by groupId
     * Validates: Requirement 5.7
     */
    test('Property 6b: Template can be retrieved by groupId', async () => {
      await fc.assert(
        fc.asyncProperty(
          accountIdArbitrary(),
          groupNameArbitrary(),
          labelArbitrary(),
          textContentArbitrary(),
          async (accountId, groupName, label, content) => {
            const localTestDir = createTestDir();
            
            try {
              const groupManager = new GroupManager(accountId, localTestDir);
              const templateManager = new TemplateManager(accountId, localTestDir);
              
              // Create a group
              const group = await groupManager.createGroup(groupName);
              
              // Create a template in that group
              const template = await templateManager.createTemplate(
                group.id,
                TEMPLATE_TYPES.TEXT,
                label,
                content
              );
              
              // Retrieve templates by group
              const groupTemplates = await templateManager.getTemplatesByGroup(group.id);
              
              // Verify the template is in the group's templates
              expect(groupTemplates).toBeDefined();
              expect(groupTemplates.length).toBeGreaterThan(0);
              expect(groupTemplates.some(t => t.id === template.id)).toBe(true);
              
              return true;
            } finally {
              cleanupTestDir(localTestDir);
            }
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    /**
     * Property 6c: Multiple templates in same group all have correct groupId
     * Validates: Requirement 5.7
     */
    test('Property 6c: Multiple templates in same group all have correct groupId', async () => {
      await fc.assert(
        fc.asyncProperty(
          accountIdArbitrary(),
          groupNameArbitrary(),
          fc.array(
            fc.record({
              label: labelArbitrary(),
              content: textContentArbitrary()
            }),
            { minLength: 1, maxLength: 5 }
          ),
          async (accountId, groupName, templateData) => {
            const localTestDir = createTestDir();
            
            try {
              const groupManager = new GroupManager(accountId, localTestDir);
              const templateManager = new TemplateManager(accountId, localTestDir);
              
              // Create a group
              const group = await groupManager.createGroup(groupName);
              
              // Create multiple templates in that group
              const createdTemplates = [];
              for (const data of templateData) {
                const template = await templateManager.createTemplate(
                  group.id,
                  TEMPLATE_TYPES.TEXT,
                  data.label,
                  data.content
                );
                createdTemplates.push(template);
              }
              
              // Verify all templates have the correct groupId
              for (const template of createdTemplates) {
                expect(template.groupId).toBe(group.id);
              }
              
              // Verify all templates can be retrieved by group
              const groupTemplates = await templateManager.getTemplatesByGroup(group.id);
              expect(groupTemplates.length).toBe(createdTemplates.length);
              
              return true;
            } finally {
              cleanupTestDir(localTestDir);
            }
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    /**
     * Property 6d: Templates in different groups are isolated
     * Validates: Requirement 5.7
     */
    test('Property 6d: Templates in different groups are isolated', async () => {
      await fc.assert(
        fc.asyncProperty(
          accountIdArbitrary(),
          groupNameArbitrary(),
          groupNameArbitrary(),
          labelArbitrary(),
          labelArbitrary(),
          textContentArbitrary(),
          textContentArbitrary(),
          async (accountId, groupName1, groupName2, label1, label2, content1, content2) => {
            const localTestDir = createTestDir();
            
            try {
              const groupManager = new GroupManager(accountId, localTestDir);
              const templateManager = new TemplateManager(accountId, localTestDir);
              
              // Create two groups
              const group1 = await groupManager.createGroup(groupName1);
              const group2 = await groupManager.createGroup(groupName2);
              
              // Create a template in each group
              const template1 = await templateManager.createTemplate(
                group1.id,
                TEMPLATE_TYPES.TEXT,
                label1,
                content1
              );
              
              const template2 = await templateManager.createTemplate(
                group2.id,
                TEMPLATE_TYPES.TEXT,
                label2,
                content2
              );
              
              // Verify templates have correct groupIds
              expect(template1.groupId).toBe(group1.id);
              expect(template2.groupId).toBe(group2.id);
              
              // Verify templates are isolated by group
              const group1Templates = await templateManager.getTemplatesByGroup(group1.id);
              const group2Templates = await templateManager.getTemplatesByGroup(group2.id);
              
              expect(group1Templates.some(t => t.id === template1.id)).toBe(true);
              expect(group1Templates.some(t => t.id === template2.id)).toBe(false);
              
              expect(group2Templates.some(t => t.id === template2.id)).toBe(true);
              expect(group2Templates.some(t => t.id === template1.id)).toBe(false);
              
              return true;
            } finally {
              cleanupTestDir(localTestDir);
            }
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    /**
     * Property 6e: Template groupId is immutable after creation (unless moved)
     * Validates: Requirement 5.7
     */
    test('Property 6e: Template groupId persists after retrieval', async () => {
      await fc.assert(
        fc.asyncProperty(
          accountIdArbitrary(),
          groupNameArbitrary(),
          labelArbitrary(),
          textContentArbitrary(),
          async (accountId, groupName, label, content) => {
            const localTestDir = createTestDir();
            
            try {
              const groupManager = new GroupManager(accountId, localTestDir);
              const templateManager = new TemplateManager(accountId, localTestDir);
              
              // Create a group
              const group = await groupManager.createGroup(groupName);
              
              // Create a template
              const template = await templateManager.createTemplate(
                group.id,
                TEMPLATE_TYPES.TEXT,
                label,
                content
              );
              
              // Retrieve the template
              const retrieved = await templateManager.getTemplate(template.id);
              
              // Verify groupId is preserved
              expect(retrieved).toBeDefined();
              expect(retrieved.groupId).toBe(group.id);
              expect(retrieved.groupId).toBe(template.groupId);
              
              return true;
            } finally {
              cleanupTestDir(localTestDir);
            }
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    /**
     * Property 6f: Creating template without groupId throws error
     * Validates: Requirement 5.7 (must have selected group)
     */
    test('Property 6f: Creating template without groupId throws error', async () => {
      await fc.assert(
        fc.asyncProperty(
          accountIdArbitrary(),
          labelArbitrary(),
          textContentArbitrary(),
          async (accountId, label, content) => {
            const localTestDir = createTestDir();
            
            try {
              const templateManager = new TemplateManager(accountId, localTestDir);
              
              // Attempt to create template without groupId
              await expect(
                templateManager.createTemplate(null, TEMPLATE_TYPES.TEXT, label, content)
              ).rejects.toThrow();
              
              await expect(
                templateManager.createTemplate(undefined, TEMPLATE_TYPES.TEXT, label, content)
              ).rejects.toThrow();
              
              await expect(
                templateManager.createTemplate('', TEMPLATE_TYPES.TEXT, label, content)
              ).rejects.toThrow();
              
              return true;
            } finally {
              cleanupTestDir(localTestDir);
            }
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    /**
     * Property 6g: Template order is assigned correctly within group
     * Validates: Requirement 5.7 (content displayed in right area)
     */
    test('Property 6g: Template order is assigned correctly within group', async () => {
      await fc.assert(
        fc.asyncProperty(
          accountIdArbitrary(),
          groupNameArbitrary(),
          fc.array(
            fc.record({
              label: labelArbitrary(),
              content: textContentArbitrary()
            }),
            { minLength: 2, maxLength: 5 }
          ),
          async (accountId, groupName, templateData) => {
            const localTestDir = createTestDir();
            
            try {
              const groupManager = new GroupManager(accountId, localTestDir);
              const templateManager = new TemplateManager(accountId, localTestDir);
              
              // Create a group
              const group = await groupManager.createGroup(groupName);
              
              // Create templates sequentially
              const createdTemplates = [];
              for (const data of templateData) {
                const template = await templateManager.createTemplate(
                  group.id,
                  TEMPLATE_TYPES.TEXT,
                  data.label,
                  data.content
                );
                createdTemplates.push(template);
              }
              
              // Verify order is sequential
              for (let i = 0; i < createdTemplates.length; i++) {
                expect(createdTemplates[i].order).toBe(i + 1);
              }
              
              // Verify templates are returned in order
              const groupTemplates = await templateManager.getTemplatesByGroup(group.id);
              for (let i = 0; i < groupTemplates.length; i++) {
                expect(groupTemplates[i].order).toBe(i + 1);
              }
              
              return true;
            } finally {
              cleanupTestDir(localTestDir);
            }
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

  });

});
