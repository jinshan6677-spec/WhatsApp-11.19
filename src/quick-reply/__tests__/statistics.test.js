/**
 * StatisticsManager Tests
 * 
 * Tests for usage statistics functionality.
 * 
 * Requirements: 15.1-15.7
 */

const StatisticsManager = require('../managers/StatisticsManager');
const TemplateManager = require('../managers/TemplateManager');
const GroupManager = require('../managers/GroupManager');
const { TEMPLATE_TYPES } = require('../constants');
const path = require('path');
const fs = require('fs').promises;
const os = require('os');

describe('StatisticsManager', () => {
  let statsManager;
  let templateManager;
  let groupManager;
  let testDir;
  const accountId = 'test-account-stats';

  beforeEach(async () => {
    // Create temporary test directory
    testDir = path.join(os.tmpdir(), `quick-reply-test-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });

    // Initialize managers
    statsManager = new StatisticsManager(accountId, testDir);
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

  describe('generateReport', () => {
    test('should generate empty report when no templates exist', async () => {
      const report = await statsManager.generateReport();

      expect(report).toBeDefined();
      expect(report.totalTemplates).toBe(0);
      expect(report.totalUsageCount).toBe(0);
      expect(report.averageUsageCount).toBe('0.00');
      expect(report.mostUsedTemplate).toBeNull();
      expect(report.leastUsedTemplate).toBeNull();
      expect(report.unusedTemplates).toBe(0);
      expect(report.templates).toEqual([]);
      expect(report.generatedAt).toBeDefined();
    });

    test('should generate report with template statistics', async () => {
      // Create test group
      const group = await groupManager.createGroup('Test Group');

      // Create templates with different usage counts
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

      // Record usage
      await templateManager.recordUsage(template1.id);
      await templateManager.recordUsage(template1.id);
      await templateManager.recordUsage(template1.id);
      await templateManager.recordUsage(template2.id);

      // Generate report
      const report = await statsManager.generateReport();

      expect(report.totalTemplates).toBe(3);
      expect(report.totalUsageCount).toBe(4);
      expect(report.averageUsageCount).toBe('1.33');
      expect(report.unusedTemplates).toBe(1);

      // Check most used template
      expect(report.mostUsedTemplate).toBeDefined();
      expect(report.mostUsedTemplate.id).toBe(template1.id);
      expect(report.mostUsedTemplate.usageCount).toBe(3);
      expect(report.mostUsedTemplate.usageRate).toBe('75.00');

      // Check templates are sorted by usage count
      expect(report.templates[0].id).toBe(template1.id);
      expect(report.templates[1].id).toBe(template2.id);
      expect(report.templates[2].id).toBe(template3.id);
    });

    test('should calculate usage rates correctly', async () => {
      const group = await groupManager.createGroup('Test Group');

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

      // Record usage: 60 for template1, 40 for template2
      for (let i = 0; i < 60; i++) {
        await templateManager.recordUsage(template1.id);
      }
      for (let i = 0; i < 40; i++) {
        await templateManager.recordUsage(template2.id);
      }

      const report = await statsManager.generateReport();

      expect(report.totalUsageCount).toBe(100);
      expect(report.templates[0].usageRate).toBe('60.00');
      expect(report.templates[1].usageRate).toBe('40.00');
    });
  });

  describe('generateGroupReport', () => {
    test('should generate report for specific group', async () => {
      const group1 = await groupManager.createGroup('Group 1');
      const group2 = await groupManager.createGroup('Group 2');

      // Create templates in different groups
      const template1 = await templateManager.createTemplate(
        group1.id,
        TEMPLATE_TYPES.TEXT,
        'Template 1',
        { text: 'Content 1' }
      );

      const template2 = await templateManager.createTemplate(
        group2.id,
        TEMPLATE_TYPES.TEXT,
        'Template 2',
        { text: 'Content 2' }
      );

      await templateManager.recordUsage(template1.id);
      await templateManager.recordUsage(template2.id);
      await templateManager.recordUsage(template2.id);

      // Generate report for group2
      const report = await statsManager.generateGroupReport(group2.id);

      expect(report.groupId).toBe(group2.id);
      expect(report.totalTemplates).toBe(1);
      expect(report.totalUsageCount).toBe(2);
      expect(report.templates.length).toBe(1);
      expect(report.templates[0].id).toBe(template2.id);
    });

    test('should throw error when group ID is missing', async () => {
      await expect(statsManager.generateGroupReport()).rejects.toThrow('Group ID is required');
    });
  });

  describe('getTopTemplates', () => {
    test('should return top N templates by usage count', async () => {
      const group = await groupManager.createGroup('Test Group');

      // Create 5 templates with different usage counts
      const templates = [];
      for (let i = 0; i < 5; i++) {
        const template = await templateManager.createTemplate(
          group.id,
          TEMPLATE_TYPES.TEXT,
          `Template ${i + 1}`,
          { text: `Content ${i + 1}` }
        );
        templates.push(template);

        // Record usage: template 0 gets 5 uses, template 1 gets 4 uses, etc.
        for (let j = 0; j < (5 - i); j++) {
          await templateManager.recordUsage(template.id);
        }
      }

      // Get top 3 templates
      const topTemplates = await statsManager.getTopTemplates(3);

      expect(topTemplates.length).toBe(3);
      expect(topTemplates[0].id).toBe(templates[0].id);
      expect(topTemplates[0].usageCount).toBe(5);
      expect(topTemplates[1].id).toBe(templates[1].id);
      expect(topTemplates[1].usageCount).toBe(4);
      expect(topTemplates[2].id).toBe(templates[2].id);
      expect(topTemplates[2].usageCount).toBe(3);
    });

    test('should return all templates if limit exceeds total', async () => {
      const group = await groupManager.createGroup('Test Group');

      await templateManager.createTemplate(
        group.id,
        TEMPLATE_TYPES.TEXT,
        'Template 1',
        { text: 'Content 1' }
      );

      const topTemplates = await statsManager.getTopTemplates(10);

      expect(topTemplates.length).toBe(1);
    });

    test('should throw error for invalid limit', async () => {
      await expect(statsManager.getTopTemplates(0)).rejects.toThrow('Limit must be a positive number');
      await expect(statsManager.getTopTemplates(-1)).rejects.toThrow('Limit must be a positive number');
    });
  });

  describe('getUnusedTemplates', () => {
    test('should return only templates with zero usage', async () => {
      const group = await groupManager.createGroup('Test Group');

      const template1 = await templateManager.createTemplate(
        group.id,
        TEMPLATE_TYPES.TEXT,
        'Used Template',
        { text: 'Content 1' }
      );

      const template2 = await templateManager.createTemplate(
        group.id,
        TEMPLATE_TYPES.TEXT,
        'Unused Template 1',
        { text: 'Content 2' }
      );

      const template3 = await templateManager.createTemplate(
        group.id,
        TEMPLATE_TYPES.TEXT,
        'Unused Template 2',
        { text: 'Content 3' }
      );

      await templateManager.recordUsage(template1.id);

      const unusedTemplates = await statsManager.getUnusedTemplates();

      expect(unusedTemplates.length).toBe(2);
      expect(unusedTemplates.some(t => t.id === template2.id)).toBe(true);
      expect(unusedTemplates.some(t => t.id === template3.id)).toBe(true);
      expect(unusedTemplates.some(t => t.id === template1.id)).toBe(false);
    });

    test('should return empty array when all templates are used', async () => {
      const group = await groupManager.createGroup('Test Group');

      const template = await templateManager.createTemplate(
        group.id,
        TEMPLATE_TYPES.TEXT,
        'Template',
        { text: 'Content' }
      );

      await templateManager.recordUsage(template.id);

      const unusedTemplates = await statsManager.getUnusedTemplates();

      expect(unusedTemplates.length).toBe(0);
    });
  });

  describe('getRecentlyUsedTemplates', () => {
    test('should return templates sorted by last used time', async () => {
      const group = await groupManager.createGroup('Test Group');

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

      // Record usage in specific order
      await templateManager.recordUsage(template1.id);
      await new Promise(resolve => setTimeout(resolve, 10));
      await templateManager.recordUsage(template2.id);
      await new Promise(resolve => setTimeout(resolve, 10));
      await templateManager.recordUsage(template3.id);

      const recentTemplates = await statsManager.getRecentlyUsedTemplates(10);

      expect(recentTemplates.length).toBe(3);
      // Most recently used should be first
      expect(recentTemplates[0].id).toBe(template3.id);
      expect(recentTemplates[1].id).toBe(template2.id);
      expect(recentTemplates[2].id).toBe(template1.id);
    });

    test('should not include templates that have never been used', async () => {
      const group = await groupManager.createGroup('Test Group');

      const template1 = await templateManager.createTemplate(
        group.id,
        TEMPLATE_TYPES.TEXT,
        'Used Template',
        { text: 'Content 1' }
      );

      await templateManager.createTemplate(
        group.id,
        TEMPLATE_TYPES.TEXT,
        'Unused Template',
        { text: 'Content 2' }
      );

      await templateManager.recordUsage(template1.id);

      const recentTemplates = await statsManager.getRecentlyUsedTemplates(10);

      expect(recentTemplates.length).toBe(1);
      expect(recentTemplates[0].id).toBe(template1.id);
    });

    test('should respect limit parameter', async () => {
      const group = await groupManager.createGroup('Test Group');

      // Create 5 templates and use them all
      for (let i = 0; i < 5; i++) {
        const template = await templateManager.createTemplate(
          group.id,
          TEMPLATE_TYPES.TEXT,
          `Template ${i + 1}`,
          { text: `Content ${i + 1}` }
        );
        await templateManager.recordUsage(template.id);
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      const recentTemplates = await statsManager.getRecentlyUsedTemplates(3);

      expect(recentTemplates.length).toBe(3);
    });
  });

  describe('Requirement 15.7: Delete template removes usage data', () => {
    test('should remove template from statistics when deleted', async () => {
      const group = await groupManager.createGroup('Test Group');

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

      await templateManager.recordUsage(template1.id);
      await templateManager.recordUsage(template2.id);

      // Generate report before deletion
      const reportBefore = await statsManager.generateReport();
      expect(reportBefore.totalTemplates).toBe(2);
      expect(reportBefore.totalUsageCount).toBe(2);

      // Delete template1
      await templateManager.deleteTemplate(template1.id);

      // Generate report after deletion
      const reportAfter = await statsManager.generateReport();
      expect(reportAfter.totalTemplates).toBe(1);
      expect(reportAfter.totalUsageCount).toBe(1);
      expect(reportAfter.templates[0].id).toBe(template2.id);
    });
  });
});
