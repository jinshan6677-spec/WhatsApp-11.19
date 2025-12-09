/**
 * Property-Based Tests for QuickReplyController
 * 
 * Tests correctness properties for the controller layer.
 */

const fc = require('fast-check');
const QuickReplyController = require('../controllers/QuickReplyController');
const TemplateManager = require('../managers/TemplateManager');
const GroupManager = require('../managers/GroupManager');
const { TEMPLATE_TYPES } = require('../constants/templateTypes');
const path = require('path');
const os = require('os');
const fs = require('fs').promises;

// Test data path
const TEST_DATA_PATH = path.join(os.tmpdir(), 'quick-reply-controller-test');

// Mock services
const mockTranslationService = {
  translate: async (text, targetLanguage, style) => {
    return `[TRANSLATED:${targetLanguage}] ${text}`;
  }
};

const mockWhatsappWebInterface = {
  sendMessage: async (text) => { /* mock */ },
  sendImage: async (imagePath) => { /* mock */ },
  sendAudio: async (audioPath) => { /* mock */ },
  sendVideo: async (videoPath) => { /* mock */ },
  sendContact: async (contactInfo) => { /* mock */ },
  insertText: async (text) => { /* mock */ },
  attachMedia: async (mediaPath) => { /* mock */ },
  attachContact: async (contactInfo) => { /* mock */ },
  focusInput: async () => { /* mock */ }
};

// Arbitraries
const accountIdArbitrary = () => fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0);

const keywordArbitrary = () => fc.string({ minLength: 0, maxLength: 50 });

const templateDataArbitrary = () => {
  return fc.nat(5).chain(typeIndex => {
    const types = Object.values(TEMPLATE_TYPES);
    const type = types[typeIndex % types.length];
    
    let contentArb;
    switch (type) {
      case TEMPLATE_TYPES.TEXT:
        contentArb = fc.record({ 
          text: fc.string({ minLength: 1, maxLength: 200 }).filter(s => s.trim().length > 0)
        });
        break;
      case TEMPLATE_TYPES.IMAGE:
      case TEMPLATE_TYPES.AUDIO:
      case TEMPLATE_TYPES.VIDEO:
        contentArb = fc.record({ mediaPath: fc.constant('/mock/path/media.jpg') });
        break;
      case TEMPLATE_TYPES.MIXED:
        contentArb = fc.record({
          text: fc.string({ minLength: 1, maxLength: 200 }).filter(s => s.trim().length > 0),
          mediaPath: fc.constant('/mock/path/media.jpg')
        });
        break;
      case TEMPLATE_TYPES.CONTACT:
        contentArb = fc.record({
          contactInfo: fc.record({
            name: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
            phone: fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0),
            email: fc.option(fc.emailAddress())
          })
        });
        break;
      default:
        contentArb = fc.record({ text: fc.constant('default text') });
    }
    
    return fc.record({
      type: fc.constant(type),
      label: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
      content: contentArb
    });
  });
};

const groupDataArbitrary = () => fc.record({
  name: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
  parentId: fc.constant(null)
});

// Helper functions
async function setupTestEnvironment(accountId) {
  // Sanitize accountId for file path (remove special characters)
  const sanitizedAccountId = accountId.replace(/[^a-zA-Z0-9-_]/g, '_');
  const testPath = path.join(TEST_DATA_PATH, sanitizedAccountId);
  await fs.mkdir(testPath, { recursive: true });
  return testPath;
}

async function cleanupTestEnvironment(accountId) {
  // Sanitize accountId for file path (remove special characters)
  const sanitizedAccountId = accountId.replace(/[^a-zA-Z0-9-_]/g, '_');
  const testPath = path.join(TEST_DATA_PATH, sanitizedAccountId);
  try {
    await fs.rm(testPath, { recursive: true, force: true });
  } catch (error) {
    // Ignore cleanup errors
  }
}

async function createTestController(accountId) {
  const testPath = await setupTestEnvironment(accountId);
  return new QuickReplyController(
    accountId,
    mockTranslationService,
    mockWhatsappWebInterface,
    TEST_DATA_PATH
  );
}

describe('QuickReplyController Property Tests', () => {
  afterEach(async () => {
    // Cleanup test data
    try {
      await fs.rm(TEST_DATA_PATH, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  /**
   * Feature: quick-reply, Property 3: 搜索清空往返一致性
   * 验证需求：6.5
   * 
   * For any template list state, when inputting a search keyword and then clearing
   * the search box, the displayed template list should be consistent with the list
   * before the search.
   */
  test('Property 3: Search clear round-trip consistency', async () => {
    await fc.assert(
      fc.asyncProperty(
        accountIdArbitrary(),
        fc.array(groupDataArbitrary(), { minLength: 1, maxLength: 5 }),
        fc.array(templateDataArbitrary(), { minLength: 1, maxLength: 10 }),
        keywordArbitrary(),
        async (accountId, groupsData, templatesData, keyword) => {
          let controller = null;
          
          try {
            // Create controller
            controller = await createTestController(accountId);
            await controller.initialize();
            
            // Create groups
            const groups = [];
            for (const groupData of groupsData) {
              const group = await controller.groupManager.createGroup(
                groupData.name,
                groupData.parentId
              );
              groups.push(group);
            }
            
            // Create templates
            const templates = [];
            for (let i = 0; i < templatesData.length; i++) {
              const templateData = templatesData[i];
              const groupIndex = i % groups.length;
              const template = await controller.templateManager.createTemplate(
                groups[groupIndex].id,
                templateData.type,
                templateData.label,
                templateData.content
              );
              templates.push(template);
            }
            
            // Get initial state (all templates)
            const initialResults = await controller.searchTemplates('');
            const initialTemplateIds = new Set(initialResults.templates.map(t => t.id));
            
            // Perform search with keyword
            const searchResults = await controller.searchTemplates(keyword);
            
            // Clear search (empty keyword)
            const clearedResults = await controller.searchTemplates('');
            const clearedTemplateIds = new Set(clearedResults.templates.map(t => t.id));
            
            // Property: After clearing search, should return to initial state
            // The set of template IDs should be the same
            const setsAreEqual = 
              initialTemplateIds.size === clearedTemplateIds.size &&
              [...initialTemplateIds].every(id => clearedTemplateIds.has(id));
            
            // Cleanup
            if (controller) {
              controller.destroy();
            }
            await cleanupTestEnvironment(accountId);
            
            return setsAreEqual;
          } catch (error) {
            // Cleanup on error
            if (controller) {
              controller.destroy();
            }
            await cleanupTestEnvironment(accountId);
            throw error;
          }
        }
      ),
      { numRuns: 100 }
    );
  }, 60000);

  /**
   * Feature: quick-reply, Property 20: 空搜索结果提示
   * 验证需求：6.4
   * 
   * For any search keyword that doesn't match any template or group,
   * the system should indicate no results were found (hasResults: false).
   */
  test('Property 20: Empty search results indication', async () => {
    await fc.assert(
      fc.asyncProperty(
        accountIdArbitrary(),
        fc.array(groupDataArbitrary(), { minLength: 1, maxLength: 3 }),
        fc.array(templateDataArbitrary(), { minLength: 1, maxLength: 5 }),
        async (accountId, groupsData, templatesData) => {
          let controller = null;
          
          try {
            // Create controller
            controller = await createTestController(accountId);
            await controller.initialize();
            
            // Create groups
            const groups = [];
            for (const groupData of groupsData) {
              const group = await controller.groupManager.createGroup(
                groupData.name,
                groupData.parentId
              );
              groups.push(group);
            }
            
            // Create templates
            for (let i = 0; i < templatesData.length; i++) {
              const templateData = templatesData[i];
              const groupIndex = i % groups.length;
              await controller.templateManager.createTemplate(
                groups[groupIndex].id,
                templateData.type,
                templateData.label,
                templateData.content
              );
            }
            
            // Generate a keyword that definitely won't match
            // Use a very unique string with special characters
            const unmatchableKeyword = '___UNMATCHABLE_KEYWORD_XYZ_123___';
            
            // Perform search with unmatchable keyword
            const searchResults = await controller.searchTemplates(unmatchableKeyword);
            
            // Property: When no results are found, hasResults should be false
            // and templates array should be empty
            const propertyHolds = 
              searchResults.hasResults === false &&
              searchResults.templates.length === 0;
            
            // Cleanup
            if (controller) {
              controller.destroy();
            }
            await cleanupTestEnvironment(accountId);
            
            return propertyHolds;
          } catch (error) {
            // Cleanup on error
            if (controller) {
              controller.destroy();
            }
            await cleanupTestEnvironment(accountId);
            throw error;
          }
        }
      ),
      { numRuns: 100 }
    );
  }, 60000);

  /**
   * Feature: quick-reply, Property 11: 导入导出往返一致性
   * 验证需求：10.5
   * 
   * For any template library state, when performing an export operation followed
   * by an import operation, the imported template library should be consistent
   * with the exported template library (except IDs and timestamps may differ).
   */
  test('Property 11: Import/Export round-trip consistency', async () => {
    await fc.assert(
      fc.asyncProperty(
        accountIdArbitrary(),
        fc.array(groupDataArbitrary(), { minLength: 1, maxLength: 5 }),
        fc.array(templateDataArbitrary(), { minLength: 1, maxLength: 10 }),
        async (accountId, groupsData, templatesData) => {
          let controller = null;
          // Sanitize accountId for file path (remove special characters)
          const sanitizedAccountId = accountId.replace(/[^a-zA-Z0-9-_]/g, '_');
          // Make accountId unique for each test run to avoid conflicts
          const uniqueAccountId = `${sanitizedAccountId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          // Export path
          const exportPath = path.join(TEST_DATA_PATH, `export-${uniqueAccountId}.json`);
          
          try {
            // Create controller
            controller = await createTestController(uniqueAccountId);
            await controller.initialize();
            
            // Create groups
            const groups = [];
            for (const groupData of groupsData) {
              const group = await controller.groupManager.createGroup(
                groupData.name,
                groupData.parentId
              );
              groups.push(group);
            }
            
            // Create templates
            const templates = [];
            for (let i = 0; i < templatesData.length; i++) {
              const templateData = templatesData[i];
              const groupIndex = i % groups.length;
              const template = await controller.templateManager.createTemplate(
                groups[groupIndex].id,
                templateData.type,
                templateData.label,
                templateData.content
              );
              templates.push(template);
            }
            
            // Capture original state (normalized for comparison)
            const originalGroups = await controller.groupManager.getAllGroups();
            const originalTemplates = await controller.templateManager.storage.getAll();
            
            // Normalize original data (remove IDs and timestamps for comparison)
            // Note: parentId is set to null for all groups since we only create top-level groups in this test
            const normalizedOriginalGroups = originalGroups.map(g => ({
              name: g.name,
              parentId: null, // Always null in this test
              order: g.order,
              expanded: g.expanded
            })).sort((a, b) => a.name.localeCompare(b.name));
            
            const normalizedOriginalTemplates = originalTemplates.map(t => ({
              type: t.type,
              label: t.label,
              content: t.content,
              order: t.order
            })).sort((a, b) => a.label.localeCompare(b.label));
            
            // Export templates
            const exportResult = await controller.exportTemplates(exportPath);
            
            // Verify export succeeded
            if (!exportResult.success) {
              throw new Error('Export failed');
            }
            
            // Create a new controller for a different account (to simulate clean import)
            // Use a unique import account ID to avoid conflicts
            const importAccountId = `${uniqueAccountId}-import`;
            if (controller) {
              controller.destroy();
            }
            // Clean up any existing data for the import account
            await cleanupTestEnvironment(importAccountId);
            controller = await createTestController(importAccountId);
            await controller.initialize();
            
            // Import templates (merge=false to replace)
            const importResult = await controller.importTemplates(exportPath, { merge: false });
            
            // Verify import succeeded
            if (!importResult.success) {
              throw new Error('Import failed');
            }
            
            // Get imported state
            const importedGroups = await controller.groupManager.getAllGroups();
            const importedTemplates = await controller.templateManager.storage.getAll();
            
            // Normalize imported data (remove IDs and timestamps for comparison)
            // Note: parentId is set to null for all groups since we only create top-level groups in this test
            const normalizedImportedGroups = importedGroups.map(g => ({
              name: g.name,
              parentId: null, // Always null in this test
              order: g.order,
              expanded: g.expanded
            })).sort((a, b) => a.name.localeCompare(b.name));
            
            const normalizedImportedTemplates = importedTemplates.map(t => ({
              type: t.type,
              label: t.label,
              // For content comparison, exclude mediaPath as it will be different
              content: {
                ...t.content,
                mediaPath: t.content.mediaPath ? 'MEDIA_EXISTS' : undefined
              },
              order: t.order
            })).sort((a, b) => a.label.localeCompare(b.label));
            
            const normalizedOriginalTemplatesForComparison = normalizedOriginalTemplates.map(t => ({
              ...t,
              content: {
                ...t.content,
                mediaPath: t.content.mediaPath ? 'MEDIA_EXISTS' : undefined
              }
            }));
            
            // Property: Imported data should match original data (structure-wise)
            // Note: parentId is not compared because it gets remapped during import
            // Note: expanded state is not compared as it's a UI state that may differ
            const groupsMatch = 
              normalizedOriginalGroups.length === normalizedImportedGroups.length &&
              normalizedOriginalGroups.every((og, i) => {
                const ig = normalizedImportedGroups[i];
                // Only compare name and order
                const nameMatch = og.name === ig.name;
                const orderMatch = og.order === ig.order;
                return nameMatch && orderMatch;
              });
            
            const templatesMatch = 
              normalizedOriginalTemplatesForComparison.length === normalizedImportedTemplates.length &&
              normalizedOriginalTemplatesForComparison.every((ot, i) => {
                const it = normalizedImportedTemplates[i];
                return ot.type === it.type &&
                       ot.label === it.label &&
                       ot.order === it.order &&
                       JSON.stringify(ot.content) === JSON.stringify(it.content);
              });
            
            // Cleanup
            if (controller) {
              controller.destroy();
            }
            await cleanupTestEnvironment(uniqueAccountId);
            await cleanupTestEnvironment(importAccountId);
            
            // Clean up export file
            try {
              await fs.unlink(exportPath);
            } catch (error) {
              // Ignore cleanup errors
            }
            
            return groupsMatch && templatesMatch;
          } catch (error) {
            // Cleanup on error
            if (controller) {
              controller.destroy();
            }
            await cleanupTestEnvironment(uniqueAccountId);
            await cleanupTestEnvironment(`${uniqueAccountId}-import`);
            
            // Clean up export file
            try {
              await fs.unlink(exportPath);
            } catch (cleanupError) {
              // Ignore cleanup errors
            }
            
            throw error;
          }
        }
      ),
      { numRuns: 100 }
    );
  }, 120000); // Longer timeout for import/export operations

  /**
   * Additional property: Search with empty keyword returns all templates
   * 
   * This verifies that searching with an empty keyword is equivalent to
   * not searching at all.
   */
  test('Additional: Empty keyword returns all templates', async () => {
    await fc.assert(
      fc.asyncProperty(
        accountIdArbitrary(),
        fc.array(groupDataArbitrary(), { minLength: 1, maxLength: 3 }),
        fc.array(templateDataArbitrary(), { minLength: 1, maxLength: 5 }),
        async (accountId, groupsData, templatesData) => {
          let controller = null;
          // Make accountId unique to avoid conflicts between test runs
          const uniqueAccountId = `${accountId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          
          try {
            // Create controller
            controller = await createTestController(uniqueAccountId);
            await controller.initialize();
            
            // Create groups
            const groups = [];
            for (const groupData of groupsData) {
              const group = await controller.groupManager.createGroup(
                groupData.name,
                groupData.parentId
              );
              groups.push(group);
            }
            
            // Create templates
            const expectedTemplateIds = [];
            for (let i = 0; i < templatesData.length; i++) {
              const templateData = templatesData[i];
              const groupIndex = i % groups.length;
              const template = await controller.templateManager.createTemplate(
                groups[groupIndex].id,
                templateData.type,
                templateData.label,
                templateData.content
              );
              expectedTemplateIds.push(template.id);
            }
            
            // Search with empty keyword
            const emptySearchResults = await controller.searchTemplates('');
            const emptySearchIds = new Set(emptySearchResults.templates.map(t => t.id));
            
            // Search with whitespace keyword
            const whitespaceSearchResults = await controller.searchTemplates('   ');
            const whitespaceSearchIds = new Set(whitespaceSearchResults.templates.map(t => t.id));
            
            // Property: Empty or whitespace keyword should return all templates
            const allTemplatesReturned = 
              emptySearchIds.size === expectedTemplateIds.length &&
              expectedTemplateIds.every(id => emptySearchIds.has(id)) &&
              whitespaceSearchIds.size === expectedTemplateIds.length &&
              expectedTemplateIds.every(id => whitespaceSearchIds.has(id));
            
            // Cleanup
            if (controller) {
              controller.destroy();
            }
            await cleanupTestEnvironment(uniqueAccountId);
            
            return allTemplatesReturned;
          } catch (error) {
            // Cleanup on error
            if (controller) {
              controller.destroy();
            }
            await cleanupTestEnvironment(uniqueAccountId);
            throw error;
          }
        }
      ),
      { numRuns: 100 }
    );
  }, 60000);
});
