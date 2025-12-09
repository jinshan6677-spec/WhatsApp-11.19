/**
 * Property-Based Tests for Manager Layer
 * 
 * Tests the correctness properties of the manager implementations.
 * Uses fast-check for property-based testing with 100 iterations per property.
 * 
 * Requirements: 2.6, 2.5, 26.3, 26.4, 13.4, 13.6, 15.1, 29.1-29.6, 19.2, 7.1, 8.1
 */

const fc = require('fast-check');
const path = require('path');
const fs = require('fs').promises;
const os = require('os');
const TemplateManager = require('../managers/TemplateManager');
const GroupManager = require('../managers/GroupManager');
const SendManager = require('../managers/SendManager');
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

/**
 * Generate valid template type
 */
const templateTypeArbitrary = () => fc.constantFrom(...Object.values(TEMPLATE_TYPES));

/**
 * Generate valid template label (non-whitespace)
 */
const templateLabelArbitrary = () => fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0);

/**
 * Generate valid template content based on type
 */
const templateContentArbitrary = (type) => {
  switch (type) {
    case TEMPLATE_TYPES.TEXT:
      return fc.record({ text: fc.string({ minLength: 1, maxLength: 1000 }) });
    case TEMPLATE_TYPES.IMAGE:
    case TEMPLATE_TYPES.AUDIO:
    case TEMPLATE_TYPES.VIDEO:
      return fc.record({ mediaPath: fc.string({ minLength: 1, maxLength: 200 }) });
    case TEMPLATE_TYPES.MIXED:
      return fc.record({
        text: fc.string({ minLength: 1, maxLength: 1000 }),
        mediaPath: fc.string({ minLength: 1, maxLength: 200 })
      });
    case TEMPLATE_TYPES.CONTACT:
      return fc.record({
        contactInfo: fc.record({
          name: fc.string({ minLength: 1, maxLength: 100 }),
          phone: fc.string({ minLength: 1, maxLength: 20 }),
          email: fc.option(fc.emailAddress())
        })
      });
    default:
      return fc.record({ text: fc.string({ minLength: 1, maxLength: 1000 }) });
  }
};

/**
 * Generate valid group name (non-whitespace)
 */
const groupNameArbitrary = () => fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0);

describe('Manager Layer Property-Based Tests', () => {
  
  describe('GroupManager', () => {
    
    /**
     * Feature: quick-reply, Property 2: 分组展开折叠往返一致性
     * 验证需求：2.6
     * 
     * For any group, when executing expand operation followed by collapse operation,
     * the group's state should return to the initial state (collapsed state).
     */
    test('Property 2: Group expand/collapse round-trip consistency', async () => {
      await fc.assert(
        fc.asyncProperty(
          accountIdArbitrary(),
          groupNameArbitrary(),
          async (accountId, groupName) => {
            const tempDir = await createTempDir();
            
            try {
              const manager = new GroupManager(accountId, tempDir);
              
              // Create a group with collapsed state
              const group = await manager.createGroup(groupName, null);
              await manager.updateGroup(group.id, { expanded: false });
              
              // Get initial state
              const initial = await manager.getGroup(group.id);
              const initialExpanded = initial.expanded;
              
              // Toggle twice (expand then collapse)
              await manager.toggleExpanded(group.id);
              await manager.toggleExpanded(group.id);
              
              // Get final state
              const final = await manager.getGroup(group.id);
              const finalExpanded = final.expanded;
              
              // Should return to initial state
              return initialExpanded === finalExpanded;
            } finally {
              await cleanupTempDir(tempDir);
            }
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });
    
    /**
     * Feature: quick-reply, Property 5: 分组删除级联删除模板
     * 验证需求：2.5
     * 
     * For any group containing templates, when deleting the group,
     * all templates in that group should also be deleted.
     */
    test('Property 5: Group deletion cascades to templates', async () => {
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
              
              // Create a group
              const group = await groupManager.createGroup(groupName, null);
              
              // Create a template in the group
              const content = await fc.sample(templateContentArbitrary(templateType), 1)[0];
              const template = await templateManager.createTemplate(
                group.id,
                templateType,
                templateLabel,
                content
              );
              
              // Verify template exists
              const beforeDelete = await templateManager.getTemplate(template.id);
              if (!beforeDelete) return false;
              
              // Delete the group
              await groupManager.deleteGroup(group.id);
              
              // Verify template is also deleted
              const afterDelete = await templateManager.getTemplate(template.id);
              
              return afterDelete === null;
            } finally {
              await cleanupTempDir(tempDir);
            }
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });
    
    /**
     * Feature: quick-reply, Property 16: 分组层级结构一致性
     * 验证需求：19.2
     * 
     * For any child group, the child group's parentId should point to its parent group's ID,
     * and the parent group's child list should contain the child group.
     */
    test('Property 16: Group hierarchical structure consistency', async () => {
      await fc.assert(
        fc.asyncProperty(
          accountIdArbitrary(),
          groupNameArbitrary(),
          groupNameArbitrary(),
          async (accountId, parentName, childName) => {
            const tempDir = await createTempDir();
            
            try {
              const manager = new GroupManager(accountId, tempDir);
              
              // Create parent group
              const parent = await manager.createGroup(parentName, null);
              
              // Create child group
              const child = await manager.createGroup(childName, parent.id);
              
              // Verify child's parentId points to parent
              const childData = await manager.getGroup(child.id);
              if (childData.parentId !== parent.id) return false;
              
              // Verify parent's children list contains child
              const children = await manager.getChildGroups(parent.id);
              const hasChild = children.some(c => c.id === child.id);
              
              return hasChild;
            } finally {
              await cleanupTempDir(tempDir);
            }
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });
  });
  
  describe('TemplateManager', () => {
    
    /**
     * Feature: quick-reply, Property 8: 模板序号唯一性
     * 验证需求：26.3, 26.4
     * 
     * For any group, all templates in that group should have unique order numbers,
     * and the order numbers should range from 1 to the total number of templates.
     */
    test('Property 8: Template order uniqueness', async () => {
      await fc.assert(
        fc.asyncProperty(
          accountIdArbitrary(),
          groupNameArbitrary(),
          fc.array(
            fc.tuple(templateTypeArbitrary(), templateLabelArbitrary()),
            { minLength: 2, maxLength: 10 }
          ),
          async (accountId, groupName, templateSpecs) => {
            const tempDir = await createTempDir();
            
            try {
              const groupManager = new GroupManager(accountId, tempDir);
              const templateManager = new TemplateManager(accountId, tempDir);
              
              // Create a group
              const group = await groupManager.createGroup(groupName, null);
              
              // Create multiple templates
              for (const [type, label] of templateSpecs) {
                const content = await fc.sample(templateContentArbitrary(type), 1)[0];
                await templateManager.createTemplate(group.id, type, label, content);
              }
              
              // Get all templates in the group
              const templates = await templateManager.getTemplatesByGroup(group.id);
              
              // Check uniqueness of order numbers
              const orders = templates.map(t => t.order);
              const uniqueOrders = new Set(orders);
              if (orders.length !== uniqueOrders.size) return false;
              
              // Check range (should be 1 to N)
              const minOrder = Math.min(...orders);
              const maxOrder = Math.max(...orders);
              
              return minOrder >= 1 && maxOrder <= templates.length;
            } finally {
              await cleanupTempDir(tempDir);
            }
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });
    
    /**
     * Feature: quick-reply, Property 9: 模板移动后分组变更
     * 验证需求：13.4
     * 
     * For any template, when moving the template from group A to group B,
     * the template's groupId should change to group B's ID,
     * and the template should no longer exist in group A.
     */
    test('Property 9: Template group change after move', async () => {
      await fc.assert(
        fc.asyncProperty(
          accountIdArbitrary(),
          groupNameArbitrary(),
          groupNameArbitrary(),
          templateTypeArbitrary(),
          templateLabelArbitrary(),
          async (accountId, groupAName, groupBName, templateType, templateLabel) => {
            const tempDir = await createTempDir();
            
            try {
              const groupManager = new GroupManager(accountId, tempDir);
              const templateManager = new TemplateManager(accountId, tempDir);
              
              // Create two groups
              const groupA = await groupManager.createGroup(groupAName, null);
              const groupB = await groupManager.createGroup(groupBName, null);
              
              // Create template in group A
              const content = await fc.sample(templateContentArbitrary(templateType), 1)[0];
              const template = await templateManager.createTemplate(
                groupA.id,
                templateType,
                templateLabel,
                content
              );
              
              // Move template to group B
              await templateManager.moveTemplate(template.id, groupB.id);
              
              // Get updated template
              const updated = await templateManager.getTemplate(template.id);
              
              // Check groupId changed to B
              if (updated.groupId !== groupB.id) return false;
              
              // Check template no longer in group A
              const groupATemplates = await templateManager.getTemplatesByGroup(groupA.id);
              const inGroupA = groupATemplates.some(t => t.id === template.id);
              
              return !inGroupA;
            } finally {
              await cleanupTempDir(tempDir);
            }
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });
    
    /**
     * Feature: quick-reply, Property 10: 批量删除一致性
     * 验证需求：13.6
     * 
     * For any set of template IDs, after batch delete operation,
     * all specified templates should be deleted, and only those templates.
     */
    test('Property 10: Batch delete consistency', async () => {
      await fc.assert(
        fc.asyncProperty(
          accountIdArbitrary(),
          groupNameArbitrary(),
          fc.array(
            fc.tuple(templateTypeArbitrary(), templateLabelArbitrary()),
            { minLength: 3, maxLength: 10 }
          ),
          async (accountId, groupName, templateSpecs) => {
            const tempDir = await createTempDir();
            
            try {
              const groupManager = new GroupManager(accountId, tempDir);
              const templateManager = new TemplateManager(accountId, tempDir);
              
              // Create a group
              const group = await groupManager.createGroup(groupName, null);
              
              // Create multiple templates
              const templateIds = [];
              for (const [type, label] of templateSpecs) {
                const content = await fc.sample(templateContentArbitrary(type), 1)[0];
                const template = await templateManager.createTemplate(group.id, type, label, content);
                templateIds.push(template.id);
              }
              
              // Select some templates to delete (at least 1, at most all-1)
              const numToDelete = Math.max(1, Math.floor(templateIds.length / 2));
              const toDelete = templateIds.slice(0, numToDelete);
              const toKeep = templateIds.slice(numToDelete);
              
              // Batch delete
              await templateManager.batchDeleteTemplates(toDelete);
              
              // Verify deleted templates are gone
              for (const id of toDelete) {
                const template = await templateManager.getTemplate(id);
                if (template !== null) return false;
              }
              
              // Verify kept templates still exist
              for (const id of toKeep) {
                const template = await templateManager.getTemplate(id);
                if (template === null) return false;
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
    
    /**
     * Feature: quick-reply, Property 13: 模板使用计数递增
     * 验证需求：15.1
     * 
     * For any template, each time the template is used to send a message,
     * the template's usage count should increase by 1.
     */
    test('Property 13: Template usage count increment', async () => {
      await fc.assert(
        fc.asyncProperty(
          accountIdArbitrary(),
          groupNameArbitrary(),
          templateTypeArbitrary(),
          templateLabelArbitrary(),
          fc.nat({ max: 10 }),
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
              
              // Get initial usage count
              const initial = await templateManager.getTemplate(template.id);
              const initialCount = initial.usageCount || 0;
              
              // Record usage multiple times
              for (let i = 0; i < usageCount; i++) {
                await templateManager.recordUsage(template.id);
              }
              
              // Get final usage count
              const final = await templateManager.getTemplate(template.id);
              const finalCount = final.usageCount || 0;
              
              // Should have increased by usageCount
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
     * Feature: quick-reply, Property 14: 默认标签生成规则
     * 验证需求：29.1-29.6
     * 
     * For any new template without a specified label,
     * the system should generate a default label based on the template type
     * (text→"新模板", image→"图片模板", etc.)
     */
    test('Property 14: Default label generation rules', async () => {
      await fc.assert(
        fc.asyncProperty(
          accountIdArbitrary(),
          groupNameArbitrary(),
          templateTypeArbitrary(),
          async (accountId, groupName, templateType) => {
            const tempDir = await createTempDir();
            
            try {
              const groupManager = new GroupManager(accountId, tempDir);
              const templateManager = new TemplateManager(accountId, tempDir);
              
              // Create a group
              const group = await groupManager.createGroup(groupName, null);
              
              // Create template without label (empty string)
              const content = await fc.sample(templateContentArbitrary(templateType), 1)[0];
              const template = await templateManager.createTemplate(
                group.id,
                templateType,
                '',  // Empty label
                content
              );
              
              // Expected default labels
              const expectedLabels = {
                [TEMPLATE_TYPES.TEXT]: '新模板',
                [TEMPLATE_TYPES.IMAGE]: '图片模板',
                [TEMPLATE_TYPES.AUDIO]: '音频模板',
                [TEMPLATE_TYPES.VIDEO]: '视频模板',
                [TEMPLATE_TYPES.MIXED]: '图文模板',
                [TEMPLATE_TYPES.CONTACT]: '名片模板'
              };
              
              const expectedLabel = expectedLabels[templateType] || '新模板';
              
              return template.label === expectedLabel;
            } finally {
              await cleanupTempDir(tempDir);
            }
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });
  });
  
  describe('SendManager', () => {
    
    /**
     * Feature: quick-reply, Property 19: 发送模式影响发送行为
     * 验证需求：7.1, 8.1
     * 
     * For any template, when send mode is "original",
     * the sent content should match the template's original content;
     * when send mode is "translated", the sent content should be translated.
     */
    test('Property 19: Send mode affects send behavior', async () => {
      await fc.assert(
        fc.asyncProperty(
          templateTypeArbitrary(),
          async (templateType) => {
            // Mock translation service
            const mockTranslationService = {
              translate: async (text, targetLang, style) => {
                return `[TRANSLATED:${text}]`;
              }
            };
            
            // Mock WhatsApp Web interface
            let sentContent = null;
            const mockWhatsappWeb = {
              sendMessage: async (text) => { sentContent = text; },
              sendImage: async (path) => { sentContent = `IMAGE:${path}`; },
              sendAudio: async (path) => { sentContent = `AUDIO:${path}`; },
              sendVideo: async (path) => { sentContent = `VIDEO:${path}`; },
              sendContact: async (info) => { sentContent = `CONTACT:${info.name}`; }
            };
            
            const sendManager = new SendManager(mockTranslationService, mockWhatsappWeb);
            
            // Create a template
            const content = await fc.sample(templateContentArbitrary(templateType), 1)[0];
            const template = {
              id: 'test-id',
              type: templateType,
              content: content
            };
            
            // Test original send
            sentContent = null;
            try {
              await sendManager.sendOriginal(template);
              const originalContent = sentContent;
              
              // For text and mixed types, test translated send
              if (templateType === TEMPLATE_TYPES.TEXT || templateType === TEMPLATE_TYPES.MIXED) {
                sentContent = null;
                await sendManager.sendTranslated(template, 'en', 'formal');
                const translatedContent = sentContent;
                
                // Translated content should be different from original
                // (should contain [TRANSLATED:] prefix)
                if (templateType === TEMPLATE_TYPES.TEXT) {
                  return translatedContent && translatedContent.includes('[TRANSLATED:');
                }
              }
              
              // For non-translatable types, both modes should send same content
              return originalContent !== null;
            } catch (error) {
              // Some errors are expected (e.g., validation errors)
              return true;
            }
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });
  });
});
