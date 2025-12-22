/**
 * Property-Based Tests for Account Data Isolation
 * 
 * Feature: enhanced-quick-reply-management, Property 13: 账号数据隔离
 * 
 * For any two different accounts A and B, data created or modified in account A
 * should not appear in account B's data.
 * 
 * **Validates: Requirements 16.9**
 * 
 * Uses fast-check for property-based testing with 100 iterations per property.
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
  const tempDir = path.join(os.tmpdir(), `quick-reply-isolation-test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
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
 * Generate account ID (UUID-like string)
 */
const accountIdArbitrary = () => fc.uuid();

/**
 * Generate valid template data
 */
const templateArbitrary = () => fc.record({
  groupId: fc.uuid(),
  type: fc.constantFrom(...Object.values(TEMPLATE_TYPES)),
  label: fc.string({ minLength: 1, maxLength: 50 }),
  visibility: fc.constantFrom('public', 'personal'),
  content: fc.oneof(
    fc.record({ text: fc.string({ minLength: 1, maxLength: 500 }) }),
    fc.record({ mediaPath: fc.string({ minLength: 1, maxLength: 100 }) })
  ),
  order: fc.nat({ max: 1000 })
});

/**
 * Generate valid group data
 */
const groupArbitrary = () => fc.record({
  name: fc.string({ minLength: 1, maxLength: 100 }),
  parentId: fc.option(fc.uuid(), { nil: null }),
  order: fc.nat({ max: 1000 }),
  expanded: fc.boolean()
});

/**
 * Generate config updates
 */
const configUpdatesArbitrary = () => fc.record({
  sendMode: fc.constantFrom(...Object.values(SEND_MODES)),
  expandedGroups: fc.array(fc.uuid(), { maxLength: 5 }),
  activeTab: fc.constantFrom('all', 'public', 'personal')
});

describe('Account Data Isolation Property Tests', () => {
  
  describe('Property 13: Account Data Isolation', () => {
    
    /**
     * Feature: enhanced-quick-reply-management, Property 13: 账号数据隔离
     * 验证需求：16.9
     * 
     * For any two different accounts A and B, templates created in account A
     * should not appear in account B's template library.
     */
    test('Property 13.1: Template isolation between accounts', async () => {
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
              expect(inAccountA.id).toBe(template.id);
              
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
     * Feature: enhanced-quick-reply-management, Property 13: 账号数据隔离
     * 验证需求：16.9
     * 
     * For any two different accounts A and B, groups created in account A
     * should not appear in account B's group library.
     */
    test('Property 13.2: Group isolation between accounts', async () => {
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
              expect(inAccountA.id).toBe(group.id);
              
              // Verify group does NOT exist in account B
              const inAccountB = await storageB.get(group.id);
              expect(inAccountB).toBeNull();
              
              // Verify account B's group list doesn't contain the group
              const allInB = await storageB.getAll();
              const foundInB = allInB.find(g => g.id === group.id);
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
     * Feature: enhanced-quick-reply-management, Property 13: 账号数据隔离
     * 验证需求：16.9
     * 
     * For any two different accounts A and B, config changes in account A
     * should not affect account B's config.
     */
    test('Property 13.3: Config isolation between accounts', async () => {
      await fc.assert(
        fc.asyncProperty(
          accountIdArbitrary(),
          accountIdArbitrary(),
          configUpdatesArbitrary(),
          async (accountIdA, accountIdB, configUpdates) => {
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
              await storageA.update(configUpdates);
              
              // Get updated configs
              const updatedA = await storageA.get();
              const updatedB = await storageB.get();
              
              // Verify account A was updated
              expect(updatedA.sendMode).toBe(configUpdates.sendMode);
              expect(updatedA.expandedGroups).toEqual(configUpdates.expandedGroups);
              
              // Verify account B was NOT affected (still has initial values)
              expect(updatedB.sendMode).toBe(initialB.sendMode);
              expect(updatedB.expandedGroups).toEqual(initialB.expandedGroups);
              
              // Verify accountIds are correct
              expect(updatedA.accountId).toBe(accountIdA);
              expect(updatedB.accountId).toBe(accountIdB);
              
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
     * Feature: enhanced-quick-reply-management, Property 13: 账号数据隔离
     * 验证需求：16.9
     * 
     * For any two different accounts A and B, deleting data in account A
     * should not affect account B's data.
     */
    test('Property 13.4: Deletion isolation between accounts', async () => {
      await fc.assert(
        fc.asyncProperty(
          accountIdArbitrary(),
          accountIdArbitrary(),
          templateArbitrary(),
          templateArbitrary(),
          async (accountIdA, accountIdB, templateDataA, templateDataB) => {
            // Ensure accounts are different
            fc.pre(accountIdA !== accountIdB);
            
            const tempDir = await createTempDir();
            
            try {
              const storageA = new TemplateStorage(accountIdA, tempDir);
              const storageB = new TemplateStorage(accountIdB, tempDir);
              
              // Create templates in both accounts
              const templateA = new Template(templateDataA);
              const templateB = new Template(templateDataB);
              
              await storageA.save(templateA.toJSON());
              await storageB.save(templateB.toJSON());
              
              // Verify both templates exist
              expect(await storageA.get(templateA.id)).not.toBeNull();
              expect(await storageB.get(templateB.id)).not.toBeNull();
              
              // Delete template from account A
              await storageA.delete(templateA.id);
              
              // Verify template A is deleted
              expect(await storageA.get(templateA.id)).toBeNull();
              
              // Verify template B still exists (not affected by deletion in A)
              const templateBAfterDelete = await storageB.get(templateB.id);
              expect(templateBAfterDelete).not.toBeNull();
              expect(templateBAfterDelete.id).toBe(templateB.id);
              
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
     * Feature: enhanced-quick-reply-management, Property 13: 账号数据隔离
     * 验证需求：16.9
     * 
     * For any two different accounts A and B, updating data in account A
     * should not affect account B's data.
     */
    test('Property 13.5: Update isolation between accounts', async () => {
      await fc.assert(
        fc.asyncProperty(
          accountIdArbitrary(),
          accountIdArbitrary(),
          templateArbitrary(),
          fc.string({ minLength: 1, maxLength: 50 }),
          async (accountIdA, accountIdB, templateData, newLabel) => {
            // Ensure accounts are different
            fc.pre(accountIdA !== accountIdB);
            
            const tempDir = await createTempDir();
            
            try {
              const storageA = new TemplateStorage(accountIdA, tempDir);
              const storageB = new TemplateStorage(accountIdB, tempDir);
              
              // Create same template data in both accounts (different instances)
              const templateA = new Template(templateData);
              const templateB = new Template(templateData);
              
              await storageA.save(templateA.toJSON());
              await storageB.save(templateB.toJSON());
              
              // Get original label from B
              const originalB = await storageB.get(templateB.id);
              const originalLabelB = originalB.label;
              
              // Update template in account A
              await storageA.update(templateA.id, { label: newLabel });
              
              // Verify template A was updated
              const updatedA = await storageA.get(templateA.id);
              expect(updatedA.label).toBe(newLabel);
              
              // Verify template B was NOT affected
              const afterUpdateB = await storageB.get(templateB.id);
              expect(afterUpdateB.label).toBe(originalLabelB);
              
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
     * Feature: enhanced-quick-reply-management, Property 13: 账号数据隔离
     * 验证需求：16.9
     * 
     * For any account, the storage path should include the accountId
     * to ensure physical file isolation.
     */
    test('Property 13.6: Storage path includes accountId', async () => {
      await fc.assert(
        fc.asyncProperty(
          accountIdArbitrary(),
          async (accountId) => {
            const tempDir = await createTempDir();
            
            try {
              const templateStorage = new TemplateStorage(accountId, tempDir);
              const groupStorage = new GroupStorage(accountId, tempDir);
              const configStorage = new ConfigStorage(accountId, tempDir);
              
              // Verify storage paths include accountId (sanitized)
              // The sanitizeAccountId function replaces special chars with underscores
              const sanitizedAccountId = accountId.replace(/[^a-zA-Z0-9-_]/g, '_');
              
              expect(templateStorage.storagePath).toContain(sanitizedAccountId);
              expect(groupStorage.storagePath).toContain(sanitizedAccountId);
              expect(configStorage.storagePath).toContain(sanitizedAccountId);
              
              // Verify paths are different for different storage types
              expect(templateStorage.storagePath).toContain('templates.json');
              expect(groupStorage.storagePath).toContain('groups.json');
              expect(configStorage.storagePath).toContain('config.json');
              
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
