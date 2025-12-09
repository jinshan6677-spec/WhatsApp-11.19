/**
 * End-to-End Tests for Quick Reply System
 * 
 * Tests complete user workflows:
 * - Creating and using templates
 * - Import/export workflows
 * - Multi-account switching
 * 
 * Task 22: 编写端到端测试
 * Requirements: All end-to-end workflow requirements
 */

const QuickReplyController = require('../controllers/QuickReplyController');
const { TEMPLATE_TYPES, SEND_MODES } = require('../constants');
const path = require('path');
const fs = require('fs').promises;
const os = require('os');

describe('Quick Reply End-to-End Tests', () => {
  let tempDir;
  let controller;
  let mockTranslationService;
  let mockWebContents;

  beforeEach(async () => {
    // Create temp directory for testing
    tempDir = path.join(os.tmpdir(), `quick-reply-e2e-test-${Date.now()}`);
    await fs.mkdir(tempDir, { recursive: true });

    // Mock translation service
    mockTranslationService = {
      initialized: true,
      configManager: {
        getEngineConfig: jest.fn().mockReturnValue({
          enabled: true,
          apiKey: 'test-key'
        })
      },
      getConfig: jest.fn().mockReturnValue({
        inputBox: {
          enabled: true,
          engine: 'google',
          style: '通用',
          targetLang: 'en'
        }
      }),
      translate: jest.fn().mockResolvedValue('Translated text'),
      initialize: jest.fn().mockResolvedValue()
    };

    // Mock webContents
    mockWebContents = {
      executeJavaScript: jest.fn().mockResolvedValue(true)
    };

    // Create controller
    const WhatsAppWebInterface = require('../services/WhatsAppWebInterface');
    const whatsappInterface = new WhatsAppWebInterface(mockWebContents);

    controller = new QuickReplyController(
      'test-account',
      mockTranslationService,
      whatsappInterface,
      tempDir
    );

    await controller.initialize();
  });

  afterEach(async () => {
    // Clean up
    if (controller) {
      controller.destroy();
    }

    // Remove temp directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('E2E: Complete Template Creation and Usage Workflow', () => {
    test('should complete full workflow: create group -> create template -> send template', async () => {
      // Step 1: Create a group
      const group = await controller.groupManager.createGroup('Customer Support');
      expect(group).toBeDefined();
      expect(group.id).toBeDefined();
      expect(group.name).toBe('Customer Support');

      // Step 2: Create a text template in the group
      const template = await controller.templateManager.createTemplate(
        group.id,
        TEMPLATE_TYPES.TEXT,
        'Welcome Message',
        { text: 'Welcome to our service! How can I help you today?' }
      );
      expect(template).toBeDefined();
      expect(template.id).toBeDefined();
      expect(template.label).toBe('Welcome Message');
      expect(template.groupId).toBe(group.id);

      // Step 3: Verify template is in storage
      const storedTemplate = await controller.templateManager.getTemplate(template.id);
      expect(storedTemplate).toBeDefined();
      expect(storedTemplate.id).toBe(template.id);

      // Step 4: Mock WhatsApp interface for sending
      controller.whatsappWebInterface.sendMessage = jest.fn().mockResolvedValue(true);

      // Step 5: Send the template
      await controller.sendTemplate(template.id, SEND_MODES.ORIGINAL);

      // Step 6: Verify message was sent
      expect(controller.whatsappWebInterface.sendMessage).toHaveBeenCalledWith(
        'Welcome to our service! How can I help you today?'
      );

      // Step 7: Verify usage statistics were updated
      const stats = await controller.templateManager.getUsageStats(template.id);
      expect(stats.usageCount).toBe(1);
      expect(stats.lastUsedAt).toBeDefined();
    });

    test('should complete workflow with translation: create -> translate -> send', async () => {
      // Step 1: Create a group first
      const group = await controller.groupManager.createGroup('Translation Group');
      
      // Step 2: Create template with Chinese text
      const template = await controller.templateManager.createTemplate(
        group.id,
        TEMPLATE_TYPES.TEXT,
        '欢迎消息',
        { text: '欢迎使用我们的服务！有什么可以帮您的吗？' }
      );

      // Step 2: Mock WhatsApp interface
      controller.whatsappWebInterface.sendMessage = jest.fn().mockResolvedValue(true);

      // Step 3: Send with translation
      await controller.sendTemplate(template.id, SEND_MODES.TRANSLATED);

      // Step 4: Verify translation was called
      expect(mockTranslationService.translate).toHaveBeenCalledWith(
        '欢迎使用我们的服务！有什么可以帮您的吗？',
        'auto',
        'en',
        'google',
        { style: '通用' }
      );

      // Step 5: Verify translated message was sent
      expect(controller.whatsappWebInterface.sendMessage).toHaveBeenCalledWith('Translated text');

      // Step 6: Verify usage was recorded
      const stats = await controller.templateManager.getUsageStats(template.id);
      expect(stats.usageCount).toBe(1);
    });

    test('should complete workflow with mixed content: create -> send image and text', async () => {
      // Step 1: Create a group first
      const group = await controller.groupManager.createGroup('Mixed Content Group');
      
      // Step 2: Create mixed template
      const template = await controller.templateManager.createTemplate(
        group.id,
        TEMPLATE_TYPES.MIXED,
        'Product Introduction',
        {
          mediaPath: '/path/to/product.jpg',
          text: 'Check out our new product!'
        }
      );

      // Step 3: Mock WhatsApp interface
      controller.whatsappWebInterface.sendImage = jest.fn().mockResolvedValue(true);
      controller.whatsappWebInterface.sendMessage = jest.fn().mockResolvedValue(true);

      // Step 4: Send the mixed template
      await controller.sendManager.sendOriginal(template);

      // Step 4: Verify both image and text were sent
      expect(controller.whatsappWebInterface.sendImage).toHaveBeenCalledWith('/path/to/product.jpg');
      expect(controller.whatsappWebInterface.sendMessage).toHaveBeenCalledWith('Check out our new product!');
    });

    test('should complete workflow with insert to input box', async () => {
      // Step 1: Create a group first
      const group = await controller.groupManager.createGroup('Quick Replies');
      
      // Step 2: Create template
      const template = await controller.templateManager.createTemplate(
        group.id,
        TEMPLATE_TYPES.TEXT,
        'Quick Reply',
        { text: 'Thank you for your message. I will get back to you soon.' }
      );

      // Step 3: Mock WhatsApp interface
      controller.whatsappWebInterface.insertText = jest.fn().mockResolvedValue(true);
      controller.whatsappWebInterface.focusInput = jest.fn().mockResolvedValue(true);

      // Step 4: Insert template into input box
      await controller.insertTemplate(template.id, SEND_MODES.ORIGINAL);

      // Step 4: Verify text was inserted and input was focused
      expect(controller.whatsappWebInterface.insertText).toHaveBeenCalledWith(
        'Thank you for your message. I will get back to you soon.'
      );
      expect(controller.whatsappWebInterface.focusInput).toHaveBeenCalled();

      // Step 5: Verify usage was recorded
      const stats = await controller.templateManager.getUsageStats(template.id);
      expect(stats.usageCount).toBe(1);
    });

    test('should complete workflow with hierarchical groups', async () => {
      // Step 1: Create parent group
      const parentGroup = await controller.groupManager.createGroup('Sales');

      // Step 2: Create child groups
      const childGroup1 = await controller.groupManager.createGroup('New Customers', parentGroup.id);
      const childGroup2 = await controller.groupManager.createGroup('Existing Customers', parentGroup.id);

      // Step 3: Create templates in child groups
      const template1 = await controller.templateManager.createTemplate(
        childGroup1.id,
        TEMPLATE_TYPES.TEXT,
        'New Customer Welcome',
        { text: 'Welcome! We are excited to have you as a new customer.' }
      );

      const template2 = await controller.templateManager.createTemplate(
        childGroup2.id,
        TEMPLATE_TYPES.TEXT,
        'Existing Customer Thanks',
        { text: 'Thank you for your continued support!' }
      );

      // Step 4: Verify hierarchy
      const childGroups = await controller.groupManager.getChildGroups(parentGroup.id);
      expect(childGroups).toHaveLength(2);
      expect(childGroups.map(g => g.id)).toContain(childGroup1.id);
      expect(childGroups.map(g => g.id)).toContain(childGroup2.id);

      // Step 5: Verify templates are in correct groups
      const group1Templates = await controller.templateManager.getTemplatesByGroup(childGroup1.id);
      expect(group1Templates).toHaveLength(1);
      expect(group1Templates[0].id).toBe(template1.id);

      const group2Templates = await controller.templateManager.getTemplatesByGroup(childGroup2.id);
      expect(group2Templates).toHaveLength(1);
      expect(group2Templates[0].id).toBe(template2.id);

      // Step 6: Mock WhatsApp interface
      controller.whatsappWebInterface.sendMessage = jest.fn().mockResolvedValue(true);

      // Step 7: Send templates from different groups
      await controller.sendTemplate(template1.id, SEND_MODES.ORIGINAL);
      await controller.sendTemplate(template2.id, SEND_MODES.ORIGINAL);

      // Step 8: Verify both messages were sent
      expect(controller.whatsappWebInterface.sendMessage).toHaveBeenCalledTimes(2);
    });

    test('should complete workflow with search and send', async () => {
      // Step 1: Create multiple templates
      const group = await controller.groupManager.createGroup('Support');
      
      await controller.templateManager.createTemplate(
        group.id,
        TEMPLATE_TYPES.TEXT,
        'Greeting',
        { text: 'Hello! How can I help you?' }
      );

      const targetTemplate = await controller.templateManager.createTemplate(
        group.id,
        TEMPLATE_TYPES.TEXT,
        'Shipping Info',
        { text: 'Your order will be shipped within 2-3 business days.' }
      );

      await controller.templateManager.createTemplate(
        group.id,
        TEMPLATE_TYPES.TEXT,
        'Refund Policy',
        { text: 'We offer a 30-day money-back guarantee.' }
      );

      // Step 2: Search for specific template
      const searchResults = await controller.searchTemplates('shipping');

      // Step 3: Verify search found the correct template
      expect(searchResults.hasResults).toBe(true);
      expect(searchResults.templates).toHaveLength(1);
      expect(searchResults.templates[0].id).toBe(targetTemplate.id);

      // Step 4: Mock WhatsApp interface
      controller.whatsappWebInterface.sendMessage = jest.fn().mockResolvedValue(true);

      // Step 5: Send the found template
      await controller.sendTemplate(searchResults.templates[0].id, SEND_MODES.ORIGINAL);

      // Step 6: Verify correct message was sent
      expect(controller.whatsappWebInterface.sendMessage).toHaveBeenCalledWith(
        'Your order will be shipped within 2-3 business days.'
      );
    });

    test('should complete workflow with batch operations', async () => {
      // Step 1: Create source and target groups
      const sourceGroup = await controller.groupManager.createGroup('Old Templates');
      const targetGroup = await controller.groupManager.createGroup('Active Templates');

      // Step 2: Create multiple templates in source group
      const template1 = await controller.templateManager.createTemplate(
        sourceGroup.id,
        TEMPLATE_TYPES.TEXT,
        'Template 1',
        { text: 'Text 1' }
      );

      const template2 = await controller.templateManager.createTemplate(
        sourceGroup.id,
        TEMPLATE_TYPES.TEXT,
        'Template 2',
        { text: 'Text 2' }
      );

      const template3 = await controller.templateManager.createTemplate(
        sourceGroup.id,
        TEMPLATE_TYPES.TEXT,
        'Template 3',
        { text: 'Text 3' }
      );

      // Step 3: Batch move templates to target group
      const movedCount = await controller.templateManager.batchMoveTemplates(
        [template1.id, template2.id],
        targetGroup.id
      );

      expect(movedCount).toBe(2);

      // Step 4: Verify templates were moved
      const targetTemplates = await controller.templateManager.getTemplatesByGroup(targetGroup.id);
      expect(targetTemplates).toHaveLength(2);
      expect(targetTemplates.map(t => t.id)).toContain(template1.id);
      expect(targetTemplates.map(t => t.id)).toContain(template2.id);

      const sourceTemplates = await controller.templateManager.getTemplatesByGroup(sourceGroup.id);
      expect(sourceTemplates).toHaveLength(1);
      expect(sourceTemplates[0].id).toBe(template3.id);

      // Step 5: Batch delete remaining template
      const deletedCount = await controller.templateManager.batchDeleteTemplates([template3.id]);
      expect(deletedCount).toBe(1);

      // Step 6: Verify deletion
      const remainingSourceTemplates = await controller.templateManager.getTemplatesByGroup(sourceGroup.id);
      expect(remainingSourceTemplates).toHaveLength(0);
    });
  });

  describe('E2E: Import/Export Workflow', () => {
    test('should complete full export and import workflow', async () => {
      // Step 1: Create groups and templates
      const group1 = await controller.groupManager.createGroup('Sales Templates');
      const group2 = await controller.groupManager.createGroup('Support Templates');

      const template1 = await controller.templateManager.createTemplate(
        group1.id,
        TEMPLATE_TYPES.TEXT,
        'Sales Pitch',
        { text: 'Our product can help you save time and money!' }
      );

      const template2 = await controller.templateManager.createTemplate(
        group2.id,
        TEMPLATE_TYPES.TEXT,
        'Support Response',
        { text: 'Thank you for contacting support. We will help you resolve this issue.' }
      );

      const template3 = await controller.templateManager.createTemplate(
        group1.id,
        TEMPLATE_TYPES.TEXT,
        'Follow Up',
        { text: 'Just following up on our previous conversation.' }
      );

      // Step 2: Record some usage
      await controller.templateManager.recordUsage(template1.id);
      await controller.templateManager.recordUsage(template1.id);
      await controller.templateManager.recordUsage(template2.id);

      // Step 3: Export templates
      const exportPath = path.join(tempDir, 'export-test.json');
      const exportResult = await controller.exportTemplates(exportPath);

      expect(exportResult.success).toBe(true);
      expect(exportResult.templatesCount).toBe(3);
      expect(exportResult.groupsCount).toBe(2);
      expect(exportResult.filePath).toBe(exportPath);

      // Step 4: Verify export file exists and has correct structure
      const exportContent = await fs.readFile(exportPath, 'utf8');
      const exportData = JSON.parse(exportContent);

      expect(exportData.version).toBe('1.0.0');
      expect(exportData.accountId).toBe('test-account');
      expect(exportData.groups).toHaveLength(2);
      expect(exportData.templates).toHaveLength(3);

      // Step 5: Create a new controller for a different account
      const controller2 = new QuickReplyController(
        'test-account-2',
        mockTranslationService,
        controller.whatsappWebInterface,
        tempDir
      );
      await controller2.initialize();

      // Step 6: Import templates into new account
      const importResult = await controller2.importTemplates(exportPath, { merge: false });

      expect(importResult.success).toBe(true);
      expect(importResult.templatesImported).toBe(3);
      expect(importResult.groupsImported).toBe(2);

      // Step 7: Verify imported data
      const importedGroups = await controller2.groupManager.getAllGroups();
      expect(importedGroups).toHaveLength(2);

      const importedTemplates = await controller2.templateManager.storage.getAll();
      expect(importedTemplates).toHaveLength(3);

      // Step 8: Verify template content is preserved
      const salesTemplates = importedTemplates.filter(t => 
        importedGroups.find(g => g.id === t.groupId && g.name === 'Sales Templates')
      );
      expect(salesTemplates).toHaveLength(2);

      // Step 9: Verify usage statistics are preserved
      const importedTemplate1 = importedTemplates.find(t => t.label === 'Sales Pitch');
      expect(importedTemplate1).toBeDefined();
      expect(importedTemplate1.usageCount).toBe(2);

      // Clean up
      controller2.destroy();
    });

    test('should handle import with name conflicts', async () => {
      // Step 1: Create initial data
      const existingGroup = await controller.groupManager.createGroup('Common Templates');
      await controller.templateManager.createTemplate(
        existingGroup.id,
        TEMPLATE_TYPES.TEXT,
        'Greeting',
        { text: 'Hello!' }
      );

      // Step 2: Export
      const exportPath = path.join(tempDir, 'conflict-test.json');
      await controller.exportTemplates(exportPath);

      // Step 3: Import into same account (should create duplicate with suffix)
      const importResult = await controller.importTemplates(exportPath, { merge: true });

      expect(importResult.success).toBe(true);
      expect(importResult.groupsImported).toBe(1);

      // Step 4: Verify group name conflict was resolved
      const allGroups = await controller.groupManager.getAllGroups();
      expect(allGroups).toHaveLength(2);
      
      const groupNames = allGroups.map(g => g.name);
      expect(groupNames).toContain('Common Templates');
      expect(groupNames).toContain('Common Templates (1)');

      // Step 5: Verify both templates exist
      const allTemplates = await controller.templateManager.storage.getAll();
      expect(allTemplates).toHaveLength(2);
    });

    test('should handle export with media files (Base64 encoding)', async () => {
      // Step 1: Create a group first
      const group = await controller.groupManager.createGroup('Media Group');
      
      // Step 2: Create template with media (simulated)
      const template = await controller.templateManager.createTemplate(
        group.id,
        TEMPLATE_TYPES.IMAGE,
        'Product Image',
        { mediaPath: '/path/to/image.jpg' }
      );

      // Step 3: Mock file operations for Base64 encoding
      const { fileToBase64, base64ToFile } = require('../utils/file');
      jest.spyOn(require('../utils/file'), 'fileToBase64').mockResolvedValue('base64encodeddata');
      jest.spyOn(require('../utils/file'), 'base64ToFile').mockResolvedValue('/new/path/to/image.jpg');

      // Step 4: Export
      const exportPath = path.join(tempDir, 'media-export.json');
      const exportResult = await controller.exportTemplates(exportPath);

      expect(exportResult.success).toBe(true);

      // Step 4: Verify export contains Base64 data
      const exportContent = await fs.readFile(exportPath, 'utf8');
      const exportData = JSON.parse(exportContent);

      const exportedTemplate = exportData.templates[0];
      expect(exportedTemplate.content.mediaBase64).toBe('base64encodeddata');
      expect(exportedTemplate.content.mediaExtension).toBe('.jpg');

      // Step 5: Import into new account
      const controller2 = new QuickReplyController(
        'test-account-2',
        mockTranslationService,
        controller.whatsappWebInterface,
        tempDir
      );
      await controller2.initialize();

      const importResult = await controller2.importTemplates(exportPath);

      expect(importResult.success).toBe(true);

      // Step 6: Verify media file was decoded
      const importedTemplates = await controller2.templateManager.storage.getAll();
      expect(importedTemplates).toHaveLength(1);
      expect(importedTemplates[0].content.mediaPath).toBe('/new/path/to/image.jpg');
      expect(importedTemplates[0].content.mediaBase64).toBeUndefined();

      // Clean up
      controller2.destroy();
      jest.restoreAllMocks();
    });

    test('should complete round-trip export and import preserving all data', async () => {
      // Step 1: Create complex data structure
      const parentGroup = await controller.groupManager.createGroup('Parent');
      const childGroup = await controller.groupManager.createGroup('Child', parentGroup.id);

      const textTemplate = await controller.templateManager.createTemplate(
        parentGroup.id,
        TEMPLATE_TYPES.TEXT,
        'Text Template',
        { text: 'Sample text' }
      );

      const mixedTemplate = await controller.templateManager.createTemplate(
        childGroup.id,
        TEMPLATE_TYPES.MIXED,
        'Mixed Template',
        { mediaPath: '/path/to/media.jpg', text: 'Caption text' }
      );

      const contactTemplate = await controller.templateManager.createTemplate(
        childGroup.id,
        TEMPLATE_TYPES.CONTACT,
        'Contact Template',
        { contactInfo: { name: 'John Doe', phone: '+1234567890', email: 'john@example.com' } }
      );

      // Record usage
      await controller.templateManager.recordUsage(textTemplate.id);
      await controller.templateManager.recordUsage(mixedTemplate.id);
      await controller.templateManager.recordUsage(mixedTemplate.id);

      // Step 2: Export
      const exportPath = path.join(tempDir, 'roundtrip-test.json');
      await controller.exportTemplates(exportPath);

      // Step 3: Clear current data
      await controller.templateManager.batchDeleteTemplates([
        textTemplate.id,
        mixedTemplate.id,
        contactTemplate.id
      ]);
      // Delete child group first, then parent
      await controller.groupManager.deleteGroup(childGroup.id);
      await controller.groupManager.deleteGroup(parentGroup.id);

      // Step 4: Import back
      const importResult = await controller.importTemplates(exportPath, { merge: false });

      expect(importResult.success).toBe(true);
      expect(importResult.groupsImported).toBe(2);
      expect(importResult.templatesImported).toBe(3);

      // Step 5: Verify all data is preserved
      const groups = await controller.groupManager.getAllGroups();
      expect(groups).toHaveLength(2);

      const templates = await controller.templateManager.storage.getAll();
      expect(templates).toHaveLength(3);

      // Verify template types
      const types = templates.map(t => t.type).sort();
      expect(types).toEqual([TEMPLATE_TYPES.CONTACT, TEMPLATE_TYPES.MIXED, TEMPLATE_TYPES.TEXT].sort());

      // Verify usage counts
      const textT = templates.find(t => t.type === TEMPLATE_TYPES.TEXT);
      const mixedT = templates.find(t => t.type === TEMPLATE_TYPES.MIXED);
      expect(textT.usageCount).toBe(1);
      expect(mixedT.usageCount).toBe(2);

      // Verify contact info
      const contactT = templates.find(t => t.type === TEMPLATE_TYPES.CONTACT);
      expect(contactT.content.contactInfo.name).toBe('John Doe');
      expect(contactT.content.contactInfo.phone).toBe('+1234567890');
    });
  });

  describe('E2E: Multi-Account Switching Workflow', () => {
    test('should complete account switch workflow with data isolation', async () => {
      // Step 1: Create data for account 1
      const account1Group = await controller.groupManager.createGroup('Account 1 Group');
      const account1Template = await controller.templateManager.createTemplate(
        account1Group.id,
        TEMPLATE_TYPES.TEXT,
        'Account 1 Template',
        { text: 'This is from account 1' }
      );

      // Step 2: Verify account 1 data
      let groups = await controller.groupManager.getAllGroups();
      let templates = await controller.templateManager.storage.getAll();
      expect(groups).toHaveLength(1);
      expect(templates).toHaveLength(1);
      expect(templates[0].label).toBe('Account 1 Template');

      // Step 3: Switch to account 2
      await controller.switchAccount('test-account-2');

      // Step 4: Verify account 2 has no data initially
      groups = await controller.groupManager.getAllGroups();
      templates = await controller.templateManager.storage.getAll();
      expect(groups).toHaveLength(0);
      expect(templates).toHaveLength(0);

      // Step 5: Create data for account 2
      const account2Group = await controller.groupManager.createGroup('Account 2 Group');
      const account2Template = await controller.templateManager.createTemplate(
        account2Group.id,
        TEMPLATE_TYPES.TEXT,
        'Account 2 Template',
        { text: 'This is from account 2' }
      );

      // Step 6: Verify account 2 data
      groups = await controller.groupManager.getAllGroups();
      templates = await controller.templateManager.storage.getAll();
      expect(groups).toHaveLength(1);
      expect(templates).toHaveLength(1);
      expect(templates[0].label).toBe('Account 2 Template');

      // Step 7: Switch back to account 1
      await controller.switchAccount('test-account');

      // Step 8: Verify account 1 data is still intact
      groups = await controller.groupManager.getAllGroups();
      templates = await controller.templateManager.storage.getAll();
      expect(groups).toHaveLength(1);
      expect(templates).toHaveLength(1);
      expect(templates[0].label).toBe('Account 1 Template');
      expect(templates[0].id).toBe(account1Template.id);

      // Step 9: Verify account 1 data is not mixed with account 2
      expect(templates[0].text).not.toBe('This is from account 2');
    });

    test('should handle account switch with active operations', async () => {
      // Step 1: Create a group first
      const group = await controller.groupManager.createGroup('Test Group');
      
      // Step 2: Create template in account 1
      const template = await controller.templateManager.createTemplate(
        group.id,
        TEMPLATE_TYPES.TEXT,
        'Test Template',
        { text: 'Test message' }
      );

      // Step 3: Mock WhatsApp interface
      controller.whatsappWebInterface.sendMessage = jest.fn().mockResolvedValue(true);

      // Step 4: Send template
      await controller.sendTemplate(template.id, SEND_MODES.ORIGINAL);

      // Step 5: Verify usage was recorded
      let stats = await controller.templateManager.getUsageStats(template.id);
      expect(stats.usageCount).toBe(1);

      // Step 6: Switch to account 2
      await controller.switchAccount('test-account-2');

      // Step 6: Try to access account 1 template (should not exist)
      const account2Template = await controller.templateManager.getTemplate(template.id);
      expect(account2Template).toBeNull();

      // Step 7: Switch back to account 1
      await controller.switchAccount('test-account');

      // Step 8: Verify template and usage stats are preserved
      const retrievedTemplate = await controller.templateManager.getTemplate(template.id);
      expect(retrievedTemplate).toBeDefined();
      expect(retrievedTemplate.id).toBe(template.id);

      stats = await controller.templateManager.getUsageStats(template.id);
      expect(stats.usageCount).toBe(1);
    });

    test('should maintain separate configurations per account', async () => {
      // Step 1: Create and configure account 1
      const ConfigStorage = require('../storage/ConfigStorage');
      const config1 = new ConfigStorage('test-account', tempDir);
      
      await config1.update({
        sendMode: SEND_MODES.ORIGINAL,
        expandedGroups: ['group1', 'group2']
      });

      let savedConfig = await config1.get();
      expect(savedConfig.sendMode).toBe(SEND_MODES.ORIGINAL);
      expect(savedConfig.expandedGroups).toEqual(['group1', 'group2']);

      // Step 2: Switch to account 2
      await controller.switchAccount('test-account-2');

      // Step 3: Configure account 2 differently
      const config2 = new ConfigStorage('test-account-2', tempDir);
      
      await config2.update({
        sendMode: SEND_MODES.TRANSLATED,
        expandedGroups: ['group3']
      });

      savedConfig = await config2.get();
      expect(savedConfig.sendMode).toBe(SEND_MODES.TRANSLATED);
      expect(savedConfig.expandedGroups).toEqual(['group3']);

      // Step 4: Switch back to account 1
      await controller.switchAccount('test-account');

      // Step 5: Verify account 1 config is unchanged
      savedConfig = await config1.get();
      expect(savedConfig.sendMode).toBe(SEND_MODES.ORIGINAL);
      expect(savedConfig.expandedGroups).toEqual(['group1', 'group2']);
    });

    test('should handle rapid account switching', async () => {
      // Step 1: Create data for multiple accounts
      const accounts = ['account-1', 'account-2', 'account-3'];
      const accountData = {};

      for (const accountId of accounts) {
        await controller.switchAccount(accountId);
        
        const group = await controller.groupManager.createGroup(`${accountId} Group`);
        const template = await controller.templateManager.createTemplate(
          group.id,
          TEMPLATE_TYPES.TEXT,
          `${accountId} Template`,
          { text: `Message from ${accountId}` }
        );

        accountData[accountId] = { group, template };
      }

      // Step 2: Rapidly switch between accounts and verify data
      for (let i = 0; i < 3; i++) {
        for (const accountId of accounts) {
          await controller.switchAccount(accountId);

          const groups = await controller.groupManager.getAllGroups();
          const templates = await controller.templateManager.storage.getAll();

          expect(groups).toHaveLength(1);
          expect(groups[0].name).toBe(`${accountId} Group`);
          expect(templates).toHaveLength(1);
          expect(templates[0].label).toBe(`${accountId} Template`);
        }
      }
    });

    test('should handle account switch during import/export', async () => {
      // Step 1: Create data in account 1
      const group1 = await controller.groupManager.createGroup('Export Group');
      await controller.templateManager.createTemplate(
        group1.id,
        TEMPLATE_TYPES.TEXT,
        'Export Template',
        { text: 'Export this' }
      );

      // Step 2: Export from account 1
      const exportPath = path.join(tempDir, 'switch-export.json');
      await controller.exportTemplates(exportPath);

      // Step 3: Switch to account 2
      await controller.switchAccount('test-account-2');

      // Step 4: Import into account 2
      const importResult = await controller.importTemplates(exportPath);

      expect(importResult.success).toBe(true);
      expect(importResult.groupsImported).toBe(1);
      expect(importResult.templatesImported).toBe(1);

      // Step 5: Verify data is in account 2
      const groups = await controller.groupManager.getAllGroups();
      const templates = await controller.templateManager.storage.getAll();

      expect(groups).toHaveLength(1);
      expect(templates).toHaveLength(1);
      expect(templates[0].label).toBe('Export Template');

      // Step 6: Switch back to account 1
      await controller.switchAccount('test-account');

      // Step 7: Verify account 1 still has original data
      const account1Groups = await controller.groupManager.getAllGroups();
      const account1Templates = await controller.templateManager.storage.getAll();

      expect(account1Groups).toHaveLength(1);
      expect(account1Templates).toHaveLength(1);
      expect(account1Templates[0].label).toBe('Export Template');
    });

    test('should emit events during account switch', async () => {
      // Step 1: Set up event listeners
      const events = [];
      
      controller.on('account:switching', (data) => {
        events.push({ type: 'switching', data });
      });
      
      controller.on('account:switched', (data) => {
        events.push({ type: 'switched', data });
      });

      // Step 2: Switch account
      await controller.switchAccount('test-account-2');

      // Step 3: Verify events were emitted
      expect(events).toHaveLength(2);
      
      expect(events[0].type).toBe('switching');
      expect(events[0].data.oldAccountId).toBe('test-account');
      expect(events[0].data.newAccountId).toBe('test-account-2');
      
      expect(events[1].type).toBe('switched');
      expect(events[1].data.oldAccountId).toBe('test-account');
      expect(events[1].data.newAccountId).toBe('test-account-2');
    });

    test('should handle translation service during account switch', async () => {
      // Step 1: Create a group first
      const group1 = await controller.groupManager.createGroup('Translation Group 1');
      
      // Step 2: Create template in account 1
      const template1 = await controller.templateManager.createTemplate(
        group1.id,
        TEMPLATE_TYPES.TEXT,
        'Chinese Template',
        { text: '你好' }
      );

      // Step 3: Mock WhatsApp interface
      controller.whatsappWebInterface.sendMessage = jest.fn().mockResolvedValue(true);

      // Step 4: Send with translation
      await controller.sendTemplate(template1.id, SEND_MODES.TRANSLATED);

      expect(mockTranslationService.translate).toHaveBeenCalled();

      // Step 5: Switch to account 2
      await controller.switchAccount('test-account-2');

      // Step 6: Create a group for account 2
      const group2 = await controller.groupManager.createGroup('Translation Group 2');
      
      // Step 7: Create template in account 2
      const template2 = await controller.templateManager.createTemplate(
        group2.id,
        TEMPLATE_TYPES.TEXT,
        'English Template',
        { text: 'Hello' }
      );

      // Step 8: Send with translation from account 2
      mockTranslationService.translate.mockClear();
      await controller.sendTemplate(template2.id, SEND_MODES.TRANSLATED);

      // Step 9: Verify translation service works for account 2
      expect(mockTranslationService.translate).toHaveBeenCalled();
    });
  });

  describe('E2E: Complex Workflows', () => {
    test('should handle complete workflow with all features', async () => {
      // This test combines multiple features in a realistic scenario
      
      // Step 1: Set up account structure
      const salesGroup = await controller.groupManager.createGroup('Sales');
      const supportGroup = await controller.groupManager.createGroup('Support');
      const followUpGroup = await controller.groupManager.createGroup('Follow-ups', salesGroup.id);

      // Step 2: Create various templates
      const welcomeTemplate = await controller.templateManager.createTemplate(
        salesGroup.id,
        TEMPLATE_TYPES.TEXT,
        'Welcome',
        { text: 'Welcome to our service!' }
      );

      const productTemplate = await controller.templateManager.createTemplate(
        salesGroup.id,
        TEMPLATE_TYPES.MIXED,
        'Product Info',
        { mediaPath: '/path/to/product.jpg', text: 'Check out our product!' }
      );

      const supportTemplate = await controller.templateManager.createTemplate(
        supportGroup.id,
        TEMPLATE_TYPES.TEXT,
        'Support Response',
        { text: 'We are here to help!' }
      );

      const followUpTemplate = await controller.templateManager.createTemplate(
        followUpGroup.id,
        TEMPLATE_TYPES.TEXT,
        'Follow Up',
        { text: 'Just checking in...' }
      );

      // Step 3: Use templates and record usage
      controller.whatsappWebInterface.sendMessage = jest.fn().mockResolvedValue(true);
      controller.whatsappWebInterface.sendImage = jest.fn().mockResolvedValue(true);

      await controller.sendTemplate(welcomeTemplate.id, SEND_MODES.ORIGINAL);
      await controller.sendTemplate(welcomeTemplate.id, SEND_MODES.ORIGINAL);
      await controller.sendTemplate(supportTemplate.id, SEND_MODES.ORIGINAL);

      // Step 4: Search for templates
      const searchResults = await controller.searchTemplates('product');
      expect(searchResults.templates).toHaveLength(1);
      expect(searchResults.templates[0].id).toBe(productTemplate.id);

      // Step 5: Export data
      const exportPath = path.join(tempDir, 'complete-workflow.json');
      const exportResult = await controller.exportTemplates(exportPath);
      expect(exportResult.success).toBe(true);

      // Step 6: Switch to new account
      await controller.switchAccount('backup-account');

      // Step 7: Import data
      const importResult = await controller.importTemplates(exportPath);
      expect(importResult.success).toBe(true);

      // Step 8: Verify all data was imported correctly
      const groups = await controller.groupManager.getAllGroups();
      const templates = await controller.templateManager.storage.getAll();

      expect(groups).toHaveLength(3);
      expect(templates).toHaveLength(4);

      // Step 9: Verify usage statistics were preserved
      const importedWelcome = templates.find(t => t.label === 'Welcome');
      expect(importedWelcome.usageCount).toBe(2);

      const importedSupport = templates.find(t => t.label === 'Support Response');
      expect(importedSupport.usageCount).toBe(1);

      // Step 10: Verify hierarchy was preserved
      const childGroups = await controller.groupManager.getChildGroups(
        groups.find(g => g.name === 'Sales').id
      );
      expect(childGroups).toHaveLength(1);
      expect(childGroups[0].name).toBe('Follow-ups');
    });
  });
});
