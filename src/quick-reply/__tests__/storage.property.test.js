/**
 * Property-Based Tests for Storage Layer
 * 
 * Tests the correctness properties of the storage implementations.
 * Uses fast-check for property-based testing with 100 iterations per property.
 * 
 * Requirements: 3.11, 3.13, 5.4, 11.2
 */

const fc = require('fast-check');
const path = require('path');
const fs = require('fs').promises;
const os = require('os');
const { TemplateStorage, GroupStorage, ConfigStorage } = require('../storage');
const Template = require('../models/Template');
const Group = require('../models/Group');
const Config = require('../models/Config');
const { TEMPLATE_TYPES, SEND_MODES } = require('../constants');

// Test configuration
const NUM_RUNS = 100;

// Helper to create temporary test directory
async function createTempDir() {
  const tempDir = path.join(os.tmpdir(), `quick-reply-test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
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

// Arbitraries for generating test data

/**
 * Generate valid template data
 */
const templateArbitrary = () => fc.record({
  groupId: accountIdArbitrary(),
  type: fc.constantFrom(...Object.values(TEMPLATE_TYPES)),
  label: fc.string({ minLength: 1, maxLength: 50 }),
  content: fc.oneof(
    fc.record({ text: fc.string({ minLength: 1, maxLength: 1000 }) }),
    fc.record({ mediaPath: fc.string({ minLength: 1, maxLength: 200 }) }),
    fc.record({
      text: fc.string({ minLength: 1, maxLength: 1000 }),
      mediaPath: fc.string({ minLength: 1, maxLength: 200 })
    }),
    fc.record({
      contactInfo: fc.record({
        name: fc.string({ minLength: 1, maxLength: 100 }),
        phone: fc.string({ minLength: 1, maxLength: 20 }),
        email: fc.option(fc.emailAddress())
      })
    })
  ),
  order: fc.nat({ max: 1000 })
});

/**
 * Generate valid group data
 */
const groupArbitrary = () => fc.record({
  name: fc.string({ minLength: 1, maxLength: 100 }),
  parentId: fc.option(accountIdArbitrary()),
  order: fc.nat({ max: 1000 }),
  expanded: fc.boolean()
});

/**
 * Generate account ID
 */
const accountIdArbitrary = () => fc.string({ minLength: 36, maxLength: 36 }).map(s => {
  // Generate a valid UUID-like string
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
});

describe('Storage Layer Property-Based Tests', () => {
  
  describe('TemplateStorage', () => {
    
    /**
     * Feature: quick-reply, Property 1: 模板创建后可检索
     * 验证需求：3.11, 3.13
     * 
     * For any valid template data, after creating a template,
     * retrieving it by ID should return the same template data.
     */
    test('Property 1: Template retrieval after creation', async () => {
      await fc.assert(
        fc.asyncProperty(
          accountIdArbitrary(),
          templateArbitrary(),
          async (accountId, templateData) => {
            const tempDir = await createTempDir();
            
            try {
              const storage = new TemplateStorage(accountId, tempDir);
              
              // Create template
              const template = new Template(templateData);
              await storage.save(template.toJSON());
              
              // Retrieve template
              const retrieved = await storage.get(template.id);
              
              // Verify template exists and data matches
              expect(retrieved).not.toBeNull();
              expect(retrieved.id).toBe(template.id);
              expect(retrieved.groupId).toBe(template.groupId);
              expect(retrieved.type).toBe(template.type);
              expect(retrieved.label).toBe(template.label);
              expect(retrieved.content).toEqual(template.content);
              
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
     * Feature: quick-reply, Property 4: 模板删除后不可检索
     * 验证需求：5.4
     * 
     * For any existing template, after deleting it,
     * retrieving it by ID should return null.
     */
    test('Property 4: Template not retrievable after deletion', async () => {
      await fc.assert(
        fc.asyncProperty(
          accountIdArbitrary(),
          templateArbitrary(),
          async (accountId, templateData) => {
            const tempDir = await createTempDir();
            
            try {
              const storage = new TemplateStorage(accountId, tempDir);
              
              // Create template
              const template = new Template(templateData);
              await storage.save(template.toJSON());
              
              // Verify it exists
              const beforeDelete = await storage.get(template.id);
              expect(beforeDelete).not.toBeNull();
              
              // Delete template
              const deleted = await storage.delete(template.id);
              expect(deleted).toBe(true);
              
              // Verify it no longer exists
              const afterDelete = await storage.get(template.id);
              expect(afterDelete).toBeNull();
              
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
     * Feature: quick-reply, Property 12: 账号数据隔离
     * 验证需求：11.2
     * 
     * For any two different accounts A and B, templates created
     * in account A should not appear in account B's template library.
     */
    test('Property 12: Account data isolation', async () => {
      await fc.assert(
        fc.asyncProperty(
          accountIdArbitrary(),
          accountIdArbitrary(),
          templateArbitrary(),
          async (accountIdA, accountIdB, templateData) => {
            // Ensure accounts are different
            fc.pre(accountIdA !== accountIdB);
            
            const tempDir = await createTempDir();
            
            try {
              const storageA = new TemplateStorage(accountIdA, tempDir);
              const storageB = new TemplateStorage(accountIdB, tempDir);
              
              // Create template in account A
              const template = new Template(templateData);
              await storageA.save(template.toJSON());
              
              // Verify template exists in account A
              const inAccountA = await storageA.get(template.id);
              expect(inAccountA).not.toBeNull();
              
              // Verify template does NOT exist in account B
              const inAccountB = await storageB.get(template.id);
              expect(inAccountB).toBeNull();
              
              // Verify account B's template list doesn't contain the template
              const allInB = await storageB.getAll();
              const foundInB = allInB.find(t => t.id === template.id);
              expect(foundInB).toBeUndefined();
              
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
     * Additional property: Template update preserves ID
     * 
     * For any template, updating it should preserve its ID.
     */
    test('Property: Template update preserves ID', async () => {
      await fc.assert(
        fc.asyncProperty(
          accountIdArbitrary(),
          templateArbitrary(),
          fc.string({ minLength: 1, maxLength: 50 }),
          async (accountId, templateData, newLabel) => {
            const tempDir = await createTempDir();
            
            try {
              const storage = new TemplateStorage(accountId, tempDir);
              
              // Create template
              const template = new Template(templateData);
              const originalId = template.id;
              await storage.save(template.toJSON());
              
              // Update template
              await storage.update(template.id, { label: newLabel });
              
              // Retrieve updated template
              const updated = await storage.get(originalId);
              
              // Verify ID is preserved
              expect(updated).not.toBeNull();
              expect(updated.id).toBe(originalId);
              expect(updated.label).toBe(newLabel);
              
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
     * Additional property: Search returns only matching templates
     * 
     * For any search keyword, all returned templates should contain
     * the keyword in their label or content.
     */
    test('Property: Search returns only matching templates', async () => {
      await fc.assert(
        fc.asyncProperty(
          accountIdArbitrary(),
          fc.array(templateArbitrary(), { minLength: 1, maxLength: 10 }),
          fc.string({ minLength: 1, maxLength: 20 }),
          async (accountId, templatesData, keyword) => {
            const tempDir = await createTempDir();
            
            try {
              const storage = new TemplateStorage(accountId, tempDir);
              
              // Create templates
              for (const templateData of templatesData) {
                const template = new Template(templateData);
                await storage.save(template.toJSON());
              }
              
              // Search
              const results = await storage.search(keyword);
              
              // Verify all results match the keyword
              const lowerKeyword = keyword.toLowerCase();
              for (const result of results) {
                const matchesLabel = result.label && result.label.toLowerCase().includes(lowerKeyword);
                const matchesText = result.content && result.content.text && 
                                   result.content.text.toLowerCase().includes(lowerKeyword);
                const matchesContact = result.content && result.content.contactInfo && (
                  (result.content.contactInfo.name && result.content.contactInfo.name.toLowerCase().includes(lowerKeyword)) ||
                  (result.content.contactInfo.phone && result.content.contactInfo.phone.includes(lowerKeyword)) ||
                  (result.content.contactInfo.email && result.content.contactInfo.email.toLowerCase().includes(lowerKeyword))
                );
                
                expect(matchesLabel || matchesText || matchesContact).toBe(true);
              }
              
              return true;
            } finally {
              await cleanupTempDir(tempDir);
            }
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

  });

  describe('GroupStorage', () => {
    
    /**
     * Property: Group retrieval after creation
     * 
     * For any valid group data, after creating a group,
     * retrieving it by ID should return the same group data.
     */
    test('Property: Group retrieval after creation', async () => {
      await fc.assert(
        fc.asyncProperty(
          accountIdArbitrary(),
          groupArbitrary(),
          async (accountId, groupData) => {
            const tempDir = await createTempDir();
            
            try {
              const storage = new GroupStorage(accountId, tempDir);
              
              // Create group
              const group = new Group(groupData);
              await storage.save(group.toJSON());
              
              // Retrieve group
              const retrieved = await storage.get(group.id);
              
              // Verify group exists and data matches
              expect(retrieved).not.toBeNull();
              expect(retrieved.id).toBe(group.id);
              expect(retrieved.name).toBe(group.name);
              expect(retrieved.parentId).toBe(group.parentId);
              
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
     * Property: Group not retrievable after deletion
     * 
     * For any existing group, after deleting it,
     * retrieving it by ID should return null.
     */
    test('Property: Group not retrievable after deletion', async () => {
      await fc.assert(
        fc.asyncProperty(
          accountIdArbitrary(),
          groupArbitrary(),
          async (accountId, groupData) => {
            const tempDir = await createTempDir();
            
            try {
              const storage = new GroupStorage(accountId, tempDir);
              
              // Create group
              const group = new Group(groupData);
              await storage.save(group.toJSON());
              
              // Verify it exists
              const beforeDelete = await storage.get(group.id);
              expect(beforeDelete).not.toBeNull();
              
              // Delete group
              const deleted = await storage.delete(group.id);
              expect(deleted).toBe(true);
              
              // Verify it no longer exists
              const afterDelete = await storage.get(group.id);
              expect(afterDelete).toBeNull();
              
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
     * Property: Account data isolation for groups
     * 
     * For any two different accounts A and B, groups created
     * in account A should not appear in account B's group library.
     */
    test('Property: Account data isolation for groups', async () => {
      await fc.assert(
        fc.asyncProperty(
          accountIdArbitrary(),
          accountIdArbitrary(),
          groupArbitrary(),
          async (accountIdA, accountIdB, groupData) => {
            // Ensure accounts are different
            fc.pre(accountIdA !== accountIdB);
            
            const tempDir = await createTempDir();
            
            try {
              const storageA = new GroupStorage(accountIdA, tempDir);
              const storageB = new GroupStorage(accountIdB, tempDir);
              
              // Create group in account A
              const group = new Group(groupData);
              await storageA.save(group.toJSON());
              
              // Verify group exists in account A
              const inAccountA = await storageA.get(group.id);
              expect(inAccountA).not.toBeNull();
              
              // Verify group does NOT exist in account B
              const inAccountB = await storageB.get(group.id);
              expect(inAccountB).toBeNull();
              
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
     * Property: Child groups are retrieved correctly
     * 
     * For any parent group, getChildren should return only
     * groups with matching parentId.
     */
    test('Property: Child groups retrieval', async () => {
      await fc.assert(
        fc.asyncProperty(
          accountIdArbitrary(),
          groupArbitrary(),
          fc.array(groupArbitrary(), { minLength: 1, maxLength: 5 }),
          async (accountId, parentData, childrenData) => {
            const tempDir = await createTempDir();
            
            try {
              const storage = new GroupStorage(accountId, tempDir);
              
              // Create parent group
              const parent = new Group(parentData);
              await storage.save(parent.toJSON());
              
              // Create child groups
              const children = [];
              for (const childData of childrenData) {
                const child = new Group({ ...childData, parentId: parent.id });
                await storage.save(child.toJSON());
                children.push(child);
              }
              
              // Get children
              const retrievedChildren = await storage.getChildren(parent.id);
              
              // Verify all children are returned
              expect(retrievedChildren.length).toBe(children.length);
              
              // Verify all have correct parentId
              for (const child of retrievedChildren) {
                expect(child.parentId).toBe(parent.id);
              }
              
              return true;
            } finally {
              await cleanupTempDir(tempDir);
            }
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

  });

  describe('ConfigStorage', () => {
    
    /**
     * Property: Config retrieval returns valid config
     * 
     * For any account, getting config should return a valid
     * configuration object with the correct accountId.
     */
    test('Property: Config retrieval returns valid config', async () => {
      await fc.assert(
        fc.asyncProperty(
          accountIdArbitrary(),
          async (accountId) => {
            const tempDir = await createTempDir();
            
            try {
              const storage = new ConfigStorage(accountId, tempDir);
              
              // Get config (should return default if not exists)
              const config = await storage.get();
              
              // Verify config is valid
              expect(config).not.toBeNull();
              expect(config.accountId).toBe(accountId);
              expect(Object.values(SEND_MODES)).toContain(config.sendMode);
              expect(Array.isArray(config.expandedGroups)).toBe(true);
              
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
     * Property: Config update preserves accountId
     * 
     * For any config updates, the accountId should remain unchanged.
     */
    test('Property: Config update preserves accountId', async () => {
      await fc.assert(
        fc.asyncProperty(
          accountIdArbitrary(),
          fc.constantFrom(...Object.values(SEND_MODES)),
          fc.array(accountIdArbitrary(), { maxLength: 5 }),
          async (accountId, newSendMode, newExpandedGroups) => {
            const tempDir = await createTempDir();
            
            try {
              const storage = new ConfigStorage(accountId, tempDir);
              
              // Update config
              const updated = await storage.update({
                sendMode: newSendMode,
                expandedGroups: newExpandedGroups
              });
              
              // Verify accountId is preserved
              expect(updated.accountId).toBe(accountId);
              expect(updated.sendMode).toBe(newSendMode);
              expect(updated.expandedGroups).toEqual(newExpandedGroups);
              
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
     * Property: Account data isolation for config
     * 
     * For any two different accounts A and B, config changes
     * in account A should not affect account B's config.
     */
    test('Property: Account data isolation for config', async () => {
      await fc.assert(
        fc.asyncProperty(
          accountIdArbitrary(),
          accountIdArbitrary(),
          fc.constantFrom(...Object.values(SEND_MODES)),
          async (accountIdA, accountIdB, sendMode) => {
            // Ensure accounts are different
            fc.pre(accountIdA !== accountIdB);
            
            const tempDir = await createTempDir();
            
            try {
              const storageA = new ConfigStorage(accountIdA, tempDir);
              const storageB = new ConfigStorage(accountIdB, tempDir);
              
              // Get initial configs
              const initialA = await storageA.get();
              const initialB = await storageB.get();
              
              // Update config in account A
              await storageA.update({ sendMode });
              
              // Get updated configs
              const updatedA = await storageA.get();
              const updatedB = await storageB.get();
              
              // Verify account A was updated
              expect(updatedA.sendMode).toBe(sendMode);
              
              // Verify account B was NOT affected
              expect(updatedB.sendMode).toBe(initialB.sendMode);
              
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
     * Property: Reset returns default config
     * 
     * For any account, resetting config should return
     * the default configuration.
     */
    test('Property: Reset returns default config', async () => {
      await fc.assert(
        fc.asyncProperty(
          accountIdArbitrary(),
          async (accountId) => {
            const tempDir = await createTempDir();
            
            try {
              const storage = new ConfigStorage(accountId, tempDir);
              
              // Make some changes
              await storage.update({
                sendMode: SEND_MODES.TRANSLATED,
                expandedGroups: ['group1', 'group2']
              });
              
              // Reset
              const reset = await storage.reset();
              
              // Verify it's back to defaults
              const defaultConfig = Config.getDefault(accountId);
              expect(reset.accountId).toBe(accountId);
              expect(reset.sendMode).toBe(defaultConfig.sendMode);
              expect(reset.expandedGroups).toEqual([]);
              
              return true;
            } finally {
              await cleanupTempDir(tempDir);
            }
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

  });

});
