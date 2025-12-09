/**
 * Batch Operations Tests
 * 
 * Tests for batch operations functionality including:
 * - Batch selection
 * - Batch delete
 * - Batch move
 * - Select all / Clear selection
 * 
 * Requirements: 13.1-13.10
 */

const TemplateManager = require('../managers/TemplateManager');
const GroupManager = require('../managers/GroupManager');
const { TEMPLATE_TYPES } = require('../constants');
const path = require('path');
const fs = require('fs').promises;
const os = require('os');

describe('Batch Operations', () => {
  let templateManager;
  let groupManager;
  let testDir;
  const accountId = 'test-account-batch-ops';

  beforeEach(async () => {
    // Create temporary test directory
    testDir = path.join(os.tmpdir(), `quick-reply-test-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });

    // Initialize managers
    templateManager = new TemplateManager(accountId, testDir);
    groupManager = new GroupManager(accountId, testDir);
  });

  afterEach(async () => {
    // Clean up test directory
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      console.error('Failed to clean up test directory:', error);
    }
  });

  describe('Batch Template Operations', () => {
    test('should batch delete multiple templates', async () => {
      // Create a group
      const group = await groupManager.createGroup('Test Group');

      // Create multiple templates
      const template1 = await templateManager.createTemplate(
        group.id,
        TEMPLATE_TYPES.TEXT,
        'Template 1',
        { text: 'Content 1' }
      );

      const template2 = await templateManager.createTemplate(
        group.id,
        TEMPLATE_TYPES.TEXT,
        'Template 2',
        { text: 'Content 2' }
      );

      const template3 = await templateManager.createTemplate(
        group.id,
        TEMPLATE_TYPES.TEXT,
        'Template 3',
        { text: 'Content 3' }
      );

      // Batch delete templates 1 and 2
      const deletedCount = await templateManager.batchDeleteTemplates([
        template1.id,
        template2.id
      ]);

      expect(deletedCount).toBe(2);

      // Verify templates are deleted
      const remaining = await templateManager.getTemplatesByGroup(group.id);
      expect(remaining).toHaveLength(1);
      expect(remaining[0].id).toBe(template3.id);
    });

    test('should batch move templates to another group', async () => {
      // Create two groups
      const group1 = await groupManager.createGroup('Group 1');
      const group2 = await groupManager.createGroup('Group 2');

      // Create templates in group 1
      const template1 = await templateManager.createTemplate(
        group1.id,
        TEMPLATE_TYPES.TEXT,
        'Template 1',
        { text: 'Content 1' }
      );

      const template2 = await templateManager.createTemplate(
        group1.id,
        TEMPLATE_TYPES.TEXT,
        'Template 2',
        { text: 'Content 2' }
      );

      const template3 = await templateManager.createTemplate(
        group1.id,
        TEMPLATE_TYPES.TEXT,
        'Template 3',
        { text: 'Content 3' }
      );

      // Batch move templates 1 and 2 to group 2
      const movedCount = await templateManager.batchMoveTemplates(
        [template1.id, template2.id],
        group2.id
      );

      expect(movedCount).toBe(2);

      // Verify templates are moved
      const group1Templates = await templateManager.getTemplatesByGroup(group1.id);
      expect(group1Templates).toHaveLength(1);
      expect(group1Templates[0].id).toBe(template3.id);

      const group2Templates = await templateManager.getTemplatesByGroup(group2.id);
      expect(group2Templates).toHaveLength(2);
      expect(group2Templates.map(t => t.id)).toContain(template1.id);
      expect(group2Templates.map(t => t.id)).toContain(template2.id);

      // Verify groupId is updated
      const movedTemplate1 = await templateManager.getTemplate(template1.id);
      expect(movedTemplate1.groupId).toBe(group2.id);
    });

    test('should handle batch delete with empty array', async () => {
      await expect(
        templateManager.batchDeleteTemplates([])
      ).rejects.toThrow('Template IDs array is required');
    });

    test('should handle batch move with empty array', async () => {
      const group = await groupManager.createGroup('Test Group');

      await expect(
        templateManager.batchMoveTemplates([], group.id)
      ).rejects.toThrow('Template IDs array is required');
    });

    test('should handle batch move with invalid target group', async () => {
      const group = await groupManager.createGroup('Test Group');
      const template = await templateManager.createTemplate(
        group.id,
        TEMPLATE_TYPES.TEXT,
        'Template',
        { text: 'Content' }
      );

      await expect(
        templateManager.batchMoveTemplates([template.id], null)
      ).rejects.toThrow('Target group ID is required');
    });

    test('should batch delete only existing templates', async () => {
      const group = await groupManager.createGroup('Test Group');
      const template = await templateManager.createTemplate(
        group.id,
        TEMPLATE_TYPES.TEXT,
        'Template',
        { text: 'Content' }
      );

      // Try to delete one existing and one non-existing template
      const deletedCount = await templateManager.batchDeleteTemplates([
        template.id,
        'non-existing-id'
      ]);

      // Should delete only the existing one
      expect(deletedCount).toBe(1);
    });

    test('should batch move only existing templates', async () => {
      const group1 = await groupManager.createGroup('Group 1');
      const group2 = await groupManager.createGroup('Group 2');
      const template = await templateManager.createTemplate(
        group1.id,
        TEMPLATE_TYPES.TEXT,
        'Template',
        { text: 'Content' }
      );

      // Try to move one existing and one non-existing template
      const movedCount = await templateManager.batchMoveTemplates(
        [template.id, 'non-existing-id'],
        group2.id
      );

      // Should move only the existing one
      expect(movedCount).toBe(1);
    });
  });

  describe('Batch Group Operations', () => {
    test('should batch delete multiple groups', async () => {
      // Create multiple groups
      const group1 = await groupManager.createGroup('Group 1');
      const group2 = await groupManager.createGroup('Group 2');
      const group3 = await groupManager.createGroup('Group 3');

      // Batch delete groups 1 and 2
      const deletedCount = await groupManager.batchDeleteGroups([
        group1.id,
        group2.id
      ]);

      expect(deletedCount).toBe(2);

      // Verify groups are deleted
      const remaining = await groupManager.getAllGroups();
      expect(remaining).toHaveLength(1);
      expect(remaining[0].id).toBe(group3.id);
    });

    test('should batch delete groups and their templates', async () => {
      // Create groups
      const group1 = await groupManager.createGroup('Group 1');
      const group2 = await groupManager.createGroup('Group 2');

      // Create templates in groups
      await templateManager.createTemplate(
        group1.id,
        TEMPLATE_TYPES.TEXT,
        'Template 1',
        { text: 'Content 1' }
      );

      await templateManager.createTemplate(
        group2.id,
        TEMPLATE_TYPES.TEXT,
        'Template 2',
        { text: 'Content 2' }
      );

      // Batch delete groups
      await groupManager.batchDeleteGroups([group1.id, group2.id]);

      // Verify templates are also deleted
      const group1Templates = await templateManager.getTemplatesByGroup(group1.id);
      const group2Templates = await templateManager.getTemplatesByGroup(group2.id);

      expect(group1Templates).toHaveLength(0);
      expect(group2Templates).toHaveLength(0);
    });

    test('should handle batch delete with empty array', async () => {
      await expect(
        groupManager.batchDeleteGroups([])
      ).rejects.toThrow('Group IDs array is required');
    });

    test('should batch delete only existing groups', async () => {
      const group = await groupManager.createGroup('Test Group');

      // Try to delete one existing and one non-existing group
      const deletedCount = await groupManager.batchDeleteGroups([
        group.id,
        'non-existing-id'
      ]);

      // Should delete only the existing one
      expect(deletedCount).toBe(1);
    });

    test('should batch delete groups with child groups', async () => {
      // Create parent and child groups
      const parent = await groupManager.createGroup('Parent');
      const child1 = await groupManager.createGroup('Child 1', parent.id);
      const child2 = await groupManager.createGroup('Child 2', parent.id);

      // Create templates in child groups
      await templateManager.createTemplate(
        child1.id,
        TEMPLATE_TYPES.TEXT,
        'Template 1',
        { text: 'Content 1' }
      );

      await templateManager.createTemplate(
        child2.id,
        TEMPLATE_TYPES.TEXT,
        'Template 2',
        { text: 'Content 2' }
      );

      // Batch delete parent (should also delete children)
      const deletedCount = await groupManager.batchDeleteGroups([parent.id]);

      expect(deletedCount).toBe(1);

      // Verify all groups are deleted
      const remaining = await groupManager.getAllGroups();
      expect(remaining).toHaveLength(0);

      // Verify all templates are deleted
      const child1Templates = await templateManager.getTemplatesByGroup(child1.id);
      const child2Templates = await templateManager.getTemplatesByGroup(child2.id);

      expect(child1Templates).toHaveLength(0);
      expect(child2Templates).toHaveLength(0);
    });
  });

  describe('Selection Operations', () => {
    test('should select all templates in a group', async () => {
      const group = await groupManager.createGroup('Test Group');

      // Create multiple templates
      const templates = [];
      for (let i = 1; i <= 5; i++) {
        const template = await templateManager.createTemplate(
          group.id,
          TEMPLATE_TYPES.TEXT,
          `Template ${i}`,
          { text: `Content ${i}` }
        );
        templates.push(template);
      }

      // Get all templates
      const allTemplates = await templateManager.getTemplatesByGroup(group.id);

      // Simulate select all
      const selectedIds = new Set(allTemplates.map(t => t.id));

      expect(selectedIds.size).toBe(5);
      templates.forEach(t => {
        expect(selectedIds.has(t.id)).toBe(true);
      });
    });

    test('should clear template selection', async () => {
      const group = await groupManager.createGroup('Test Group');

      // Create templates
      const template1 = await templateManager.createTemplate(
        group.id,
        TEMPLATE_TYPES.TEXT,
        'Template 1',
        { text: 'Content 1' }
      );

      const template2 = await templateManager.createTemplate(
        group.id,
        TEMPLATE_TYPES.TEXT,
        'Template 2',
        { text: 'Content 2' }
      );

      // Simulate selection
      const selectedIds = new Set([template1.id, template2.id]);
      expect(selectedIds.size).toBe(2);

      // Clear selection
      selectedIds.clear();
      expect(selectedIds.size).toBe(0);
    });

    test('should toggle individual template selection', async () => {
      const group = await groupManager.createGroup('Test Group');
      const template = await templateManager.createTemplate(
        group.id,
        TEMPLATE_TYPES.TEXT,
        'Template',
        { text: 'Content' }
      );

      const selectedIds = new Set();

      // Toggle on
      selectedIds.add(template.id);
      expect(selectedIds.has(template.id)).toBe(true);

      // Toggle off
      selectedIds.delete(template.id);
      expect(selectedIds.has(template.id)).toBe(false);
    });

    test('should select all groups', async () => {
      // Create multiple groups
      const groups = [];
      for (let i = 1; i <= 5; i++) {
        const group = await groupManager.createGroup(`Group ${i}`);
        groups.push(group);
      }

      // Get all groups
      const allGroups = await groupManager.getAllGroups();

      // Simulate select all
      const selectedIds = new Set(allGroups.map(g => g.id));

      expect(selectedIds.size).toBe(5);
      groups.forEach(g => {
        expect(selectedIds.has(g.id)).toBe(true);
      });
    });
  });

  describe('Batch Operations with Filters', () => {
    test('should batch delete filtered templates', async () => {
      const group = await groupManager.createGroup('Test Group');

      // Create templates with different types
      const textTemplate1 = await templateManager.createTemplate(
        group.id,
        TEMPLATE_TYPES.TEXT,
        'Text 1',
        { text: 'Content 1' }
      );

      const textTemplate2 = await templateManager.createTemplate(
        group.id,
        TEMPLATE_TYPES.TEXT,
        'Text 2',
        { text: 'Content 2' }
      );

      const imageTemplate = await templateManager.createTemplate(
        group.id,
        TEMPLATE_TYPES.IMAGE,
        'Image',
        { mediaPath: '/path/to/image.jpg' }
      );

      // Get only text templates
      const textTemplates = await templateManager.getTemplatesByType(
        group.id,
        TEMPLATE_TYPES.TEXT
      );

      // Batch delete text templates
      const textTemplateIds = textTemplates.map(t => t.id);
      await templateManager.batchDeleteTemplates(textTemplateIds);

      // Verify only image template remains
      const remaining = await templateManager.getTemplatesByGroup(group.id);
      expect(remaining).toHaveLength(1);
      expect(remaining[0].id).toBe(imageTemplate.id);
    });

    test('should batch move filtered templates', async () => {
      const group1 = await groupManager.createGroup('Group 1');
      const group2 = await groupManager.createGroup('Group 2');

      // Create templates with different types
      const textTemplate = await templateManager.createTemplate(
        group1.id,
        TEMPLATE_TYPES.TEXT,
        'Text',
        { text: 'Content' }
      );

      const imageTemplate = await templateManager.createTemplate(
        group1.id,
        TEMPLATE_TYPES.IMAGE,
        'Image',
        { mediaPath: '/path/to/image.jpg' }
      );

      // Get only text templates
      const textTemplates = await templateManager.getTemplatesByType(
        group1.id,
        TEMPLATE_TYPES.TEXT
      );

      // Batch move text templates
      const textTemplateIds = textTemplates.map(t => t.id);
      await templateManager.batchMoveTemplates(textTemplateIds, group2.id);

      // Verify text template is moved
      const group1Templates = await templateManager.getTemplatesByGroup(group1.id);
      expect(group1Templates).toHaveLength(1);
      expect(group1Templates[0].id).toBe(imageTemplate.id);

      const group2Templates = await templateManager.getTemplatesByGroup(group2.id);
      expect(group2Templates).toHaveLength(1);
      expect(group2Templates[0].id).toBe(textTemplate.id);
    });
  });
});
