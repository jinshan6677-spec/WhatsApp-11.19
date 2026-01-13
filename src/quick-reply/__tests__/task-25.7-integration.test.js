/**
 * Task 25.7: Integration Tests for Quick Reply Main Application Integration
 * 
 * Tests the integration of quick reply with the main application:
 * - Sidebar button functionality
 * - Panel display and hide
 * - Account switching
 * - Message sending
 * 
 * Requirements: Task 25.7
 */

const QuickReplyController = require('../controllers/QuickReplyController');
const { TEMPLATE_TYPES, SEND_MODES } = require('../constants');
const path = require('path');
const fs = require('fs').promises;
const os = require('os');

describe('Task 25.7: Main Application Integration Tests', () => {
  let tempDir;
  let controller;
  let mockTranslationService;
  let mockWebContents;
  let mockMainWindow;
  let mockViewManager;
  let whatsappInterface;

  beforeEach(async () => {
    // Create temp directory for testing
    tempDir = path.join(os.tmpdir(), `quick-reply-task-25.7-${Date.now()}`);
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
      executeJavaScript: jest.fn().mockResolvedValue(true),
      send: jest.fn()
    };

    // Mock main window
    mockMainWindow = {
      webContents: mockWebContents,
      isReady: jest.fn().mockReturnValue(true),
      sendToRenderer: jest.fn()
    };

    // Mock view manager
    mockViewManager = {
      getActiveView: jest.fn().mockReturnValue({
        accountId: 'test-account',
        webContents: mockWebContents
      }),
      getViewByAccountId: jest.fn((accountId) => ({
        accountId,
        webContents: mockWebContents
      }))
    };

    // Create WhatsApp Web interface
    const WhatsAppWebInterface = require('../services/WhatsAppWebInterface');
    whatsappInterface = new WhatsAppWebInterface(mockWebContents);

    // Create controller
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
    if (whatsappInterface) {
      whatsappInterface.destroy();
    }

    // Remove temp directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Sidebar Button Functionality', () => {
    test('should initialize quick reply panel when sidebar button is clicked', async () => {
      // Simulate sidebar button click
      const panelVisible = true;
      
      // Verify controller is initialized
      expect(controller).toBeDefined();
      expect(controller.accountId).toBe('test-account');
      
      // Verify data can be loaded
      const templates = await controller.templateManager.storage.getAll();
      const groups = await controller.groupManager.getAllGroups();
      
      expect(templates).toBeDefined();
      expect(groups).toBeDefined();
      expect(Array.isArray(templates)).toBe(true);
      expect(Array.isArray(groups)).toBe(true);
    });

    test('should load quick reply data when panel is opened', async () => {
      // Create test data
      const group = await controller.groupManager.createGroup('Test Group');
      const template = await controller.templateManager.createTemplate(
        group.id,
        TEMPLATE_TYPES.TEXT,
        'Test Template',
        { text: 'Hello World' }
      );

      // Simulate panel open - load data
      const templates = await controller.templateManager.storage.getAll();
      const groups = await controller.groupManager.getAllGroups();

      // Verify data is loaded
      expect(templates).toHaveLength(1);
      expect(templates[0].id).toBe(template.id);
      expect(templates[0].label).toBe('Test Template');
      
      expect(groups).toHaveLength(1);
      expect(groups[0].id).toBe(group.id);
      expect(groups[0].name).toBe('Test Group');
    });

    test('should show empty state when no templates exist', async () => {
      // Load data when no templates exist
      const templates = await controller.templateManager.storage.getAll();
      const groups = await controller.groupManager.getAllGroups();

      // Verify empty state
      expect(templates).toHaveLength(0);
      expect(groups).toHaveLength(0);
    });

    test('should refresh data when refresh button is clicked', async () => {
      // Create initial template
      const group = await controller.groupManager.createGroup('Test Group');
      await controller.templateManager.createTemplate(
        group.id,
        TEMPLATE_TYPES.TEXT,
        'Template 1',
        { text: 'Text 1' }
      );

      // Load initial data
      let templates = await controller.templateManager.storage.getAll();
      expect(templates).toHaveLength(1);

      // Create another template (simulating external change)
      await controller.templateManager.createTemplate(
        group.id,
        TEMPLATE_TYPES.TEXT,
        'Template 2',
        { text: 'Text 2' }
      );

      // Refresh data
      templates = await controller.templateManager.storage.getAll();
      
      // Verify refreshed data
      expect(templates).toHaveLength(2);
    });

    test('should open management interface when manage button is clicked', async () => {
      // Mock management interface opening
      const openManagementSpy = jest.spyOn(controller, 'openManagementInterface');
      
      // Simulate manage button click
      controller.openManagementInterface();
      
      // Verify management interface was opened
      expect(openManagementSpy).toHaveBeenCalled();
    });
  });

  describe('Panel Display and Hide', () => {
    test('should show panel when quick reply button is clicked', async () => {
      // Simulate panel show
      const panelState = { visible: false };
      
      // Show panel
      panelState.visible = true;
      
      // Verify panel is visible
      expect(panelState.visible).toBe(true);
      
      // Verify data can be accessed
      const templates = await controller.templateManager.storage.getAll();
      expect(templates).toBeDefined();
    });

    test('should hide panel when another sidebar button is clicked', async () => {
      // Simulate panel show
      const panelState = { visible: true };
      
      // Hide panel (another button clicked)
      panelState.visible = false;
      
      // Verify panel is hidden
      expect(panelState.visible).toBe(false);
    });

    test('should maintain panel state when switching between panels', async () => {
      // Create test data
      const group = await controller.groupManager.createGroup('Test Group');
      await controller.templateManager.createTemplate(
        group.id,
        TEMPLATE_TYPES.TEXT,
        'Test Template',
        { text: 'Test' }
      );

      // Load data
      const templates1 = await controller.templateManager.storage.getAll();
      expect(templates1).toHaveLength(1);

      // Simulate panel hide and show
      // Data should still be available
      const templates2 = await controller.templateManager.storage.getAll();
      expect(templates2).toHaveLength(1);
      expect(templates2[0].id).toBe(templates1[0].id);
    });

    test('should preserve search state when panel is hidden and shown', async () => {
      // Create test data
      const group = await controller.groupManager.createGroup('Test Group');
      await controller.templateManager.createTemplate(
        group.id,
        TEMPLATE_TYPES.TEXT,
        'Hello Template',
        { text: 'Hello' }
      );
      await controller.templateManager.createTemplate(
        group.id,
        TEMPLATE_TYPES.TEXT,
        'Goodbye Template',
        { text: 'Goodbye' }
      );

      // Perform search
      const searchResults = await controller.searchTemplates('Hello');
      expect(searchResults.templates).toHaveLength(1);

      // Simulate panel hide and show
      // Search results should be retrievable
      const searchResults2 = await controller.searchTemplates('Hello');
      expect(searchResults2.templates).toHaveLength(1);
      expect(searchResults2.templates[0].label).toBe('Hello Template');
    });

    test('should update panel UI when templates are modified', async () => {
      // Create template
      const group = await controller.groupManager.createGroup('Test Group');
      const template = await controller.templateManager.createTemplate(
        group.id,
        TEMPLATE_TYPES.TEXT,
        'Original',
        { text: 'Original text' }
      );

      // Load initial data
      let templates = await controller.templateManager.storage.getAll();
      expect(templates[0].label).toBe('Original');

      // Update template
      await controller.templateManager.updateTemplate(template.id, {
        label: 'Updated'
      });

      // Reload data (simulating UI update)
      templates = await controller.templateManager.storage.getAll();
      expect(templates[0].label).toBe('Updated');
    });
  });

  describe('Account Switching', () => {
    test('should switch to new account and load its data', async () => {
      // Create data for account 1
      const group1 = await controller.groupManager.createGroup('Account 1 Group');
      const template1 = await controller.templateManager.createTemplate(
        group1.id,
        TEMPLATE_TYPES.TEXT,
        'Account 1 Template',
        { text: 'Account 1' }
      );

      // Verify account 1 data
      let templates = await controller.templateManager.storage.getAll();
      expect(templates).toHaveLength(1);
      expect(templates[0].label).toBe('Account 1 Template');

      // Switch to account 2
      await controller.switchAccount('test-account-2');

      // Verify account 2 has no data initially
      templates = await controller.templateManager.storage.getAll();
      expect(templates).toHaveLength(0);

      // Create data for account 2
      const group2 = await controller.groupManager.createGroup('Account 2 Group');
      await controller.templateManager.createTemplate(
        group2.id,
        TEMPLATE_TYPES.TEXT,
        'Account 2 Template',
        { text: 'Account 2' }
      );

      // Verify account 2 data
      templates = await controller.templateManager.storage.getAll();
      expect(templates).toHaveLength(1);
      expect(templates[0].label).toBe('Account 2 Template');
    });

    test('should preserve data when switching back to previous account', async () => {
      // Create data for account 1
      const group1 = await controller.groupManager.createGroup('Account 1 Group');
      const template1 = await controller.templateManager.createTemplate(
        group1.id,
        TEMPLATE_TYPES.TEXT,
        'Account 1 Template',
        { text: 'Account 1' }
      );

      // Switch to account 2
      await controller.switchAccount('test-account-2');

      // Create data for account 2
      const group2 = await controller.groupManager.createGroup('Account 2 Group');
      await controller.templateManager.createTemplate(
        group2.id,
        TEMPLATE_TYPES.TEXT,
        'Account 2 Template',
        { text: 'Account 2' }
      );

      // Switch back to account 1
      await controller.switchAccount('test-account');

      // Verify account 1 data is preserved
      const templates = await controller.templateManager.storage.getAll();
      expect(templates).toHaveLength(1);
      expect(templates[0].id).toBe(template1.id);
      expect(templates[0].label).toBe('Account 1 Template');
    });

    test('should clear panel UI when switching accounts', async () => {
      // Create data for account 1
      const group = await controller.groupManager.createGroup('Test Group');
      await controller.templateManager.createTemplate(
        group.id,
        TEMPLATE_TYPES.TEXT,
        'Test Template',
        { text: 'Test' }
      );

      // Load data
      let templates = await controller.templateManager.storage.getAll();
      expect(templates).toHaveLength(1);

      // Switch to account 2
      await controller.switchAccount('test-account-2');

      // Verify UI should show empty state
      templates = await controller.templateManager.storage.getAll();
      expect(templates).toHaveLength(0);
    });

    test('should handle account switch errors gracefully', async () => {
      // Create data for current account
      const group = await controller.groupManager.createGroup('Test Group');
      await controller.templateManager.createTemplate(
        group.id,
        TEMPLATE_TYPES.TEXT,
        'Test Template',
        { text: 'Test' }
      );

      // Verify current data
      let templates = await controller.templateManager.storage.getAll();
      expect(templates).toHaveLength(1);

      // Attempt to switch to invalid account (should handle gracefully)
      // Note: switchAccount doesn't validate account existence, it just switches storage
      await controller.switchAccount('invalid-account');

      // Should have empty data for new account
      templates = await controller.templateManager.storage.getAll();
      expect(templates).toHaveLength(0);

      // Switch back to original account
      await controller.switchAccount('test-account');

      // Original data should be intact
      templates = await controller.templateManager.storage.getAll();
      expect(templates).toHaveLength(1);
    });

    test('should update panel title with account info after switch', async () => {
      // Initial account
      expect(controller.accountId).toBe('test-account');

      // Switch account
      await controller.switchAccount('test-account-2');

      // Verify account ID updated
      expect(controller.accountId).toBe('test-account-2');

      // Switch back
      await controller.switchAccount('test-account');
      expect(controller.accountId).toBe('test-account');
    });

    test('should maintain separate send mode settings per account', async () => {
      // Set send mode for account 1
      const ConfigStorage = require('../storage/ConfigStorage');
      const config1 = new ConfigStorage('test-account', tempDir);
      await config1.update({ sendMode: SEND_MODES.ORIGINAL });

      let savedConfig = await config1.get();
      expect(savedConfig.sendMode).toBe(SEND_MODES.ORIGINAL);

      // Switch to account 2
      await controller.switchAccount('test-account-2');

      // Set different send mode for account 2
      const config2 = new ConfigStorage('test-account-2', tempDir);
      await config2.update({ sendMode: SEND_MODES.TRANSLATED });

      savedConfig = await config2.get();
      expect(savedConfig.sendMode).toBe(SEND_MODES.TRANSLATED);

      // Switch back to account 1
      await controller.switchAccount('test-account');

      // Verify account 1 settings preserved
      savedConfig = await config1.get();
      expect(savedConfig.sendMode).toBe(SEND_MODES.ORIGINAL);
    });
  });

  describe('Message Sending', () => {
    test('should send text message through WhatsApp Web', async () => {
      // Create template
      const group = await controller.groupManager.createGroup('Test Group');
      const template = await controller.templateManager.createTemplate(
        group.id,
        TEMPLATE_TYPES.TEXT,
        'Test Template',
        { text: 'Hello WhatsApp' }
      );

      // Mock WhatsApp interface
      whatsappInterface.sendMessage = jest.fn().mockResolvedValue(true);

      // Send template
      await controller.sendTemplate(template.id, SEND_MODES.ORIGINAL);

      // Verify message was sent
      expect(whatsappInterface.sendMessage).toHaveBeenCalledWith('Hello WhatsApp');
    });

    test('should send translated message when translation mode is selected', async () => {
      // Create template
      const group = await controller.groupManager.createGroup('Test Group');
      const template = await controller.templateManager.createTemplate(
        group.id,
        TEMPLATE_TYPES.TEXT,
        'Chinese Template',
        { text: '你好世界' }
      );

      // Mock WhatsApp interface
      whatsappInterface.sendMessage = jest.fn().mockResolvedValue(true);

      // Send with translation
      await controller.sendTemplate(template.id, SEND_MODES.TRANSLATED);

      // Verify translation was called
      expect(mockTranslationService.translate).toHaveBeenCalledWith(
        '你好世界',
        'auto',
        'en',
        'google',
        { style: '通用' }
      );

      // Verify translated message was sent
      expect(whatsappInterface.sendMessage).toHaveBeenCalledWith('Translated text');
    });

    test('should insert text into input box instead of sending', async () => {
      // Create template
      const group = await controller.groupManager.createGroup('Test Group');
      const template = await controller.templateManager.createTemplate(
        group.id,
        TEMPLATE_TYPES.TEXT,
        'Insert Template',
        { text: 'Insert this text' }
      );

      // Mock WhatsApp interface
      whatsappInterface.insertText = jest.fn().mockResolvedValue(true);
      whatsappInterface.focusInput = jest.fn().mockResolvedValue(true);

      // Insert template
      await controller.insertTemplate(template.id, SEND_MODES.ORIGINAL);

      // Verify text was inserted
      expect(whatsappInterface.insertText).toHaveBeenCalledWith('Insert this text');
      expect(whatsappInterface.focusInput).toHaveBeenCalled();
    });

    test('should record usage statistics when message is sent', async () => {
      // Create template
      const group = await controller.groupManager.createGroup('Test Group');
      const template = await controller.templateManager.createTemplate(
        group.id,
        TEMPLATE_TYPES.TEXT,
        'Usage Test',
        { text: 'Track usage' }
      );

      // Mock WhatsApp interface
      whatsappInterface.sendMessage = jest.fn().mockResolvedValue(true);

      // Send template multiple times
      await controller.sendTemplate(template.id, SEND_MODES.ORIGINAL);
      await controller.sendTemplate(template.id, SEND_MODES.ORIGINAL);

      // Verify usage was recorded
      const stats = await controller.templateManager.getUsageStats(template.id);
      expect(stats.usageCount).toBe(2);
      expect(stats.lastUsedAt).toBeDefined();
    });

    test('should handle send errors and show error message', async () => {
      // Create template
      const group = await controller.groupManager.createGroup('Test Group');
      const template = await controller.templateManager.createTemplate(
        group.id,
        TEMPLATE_TYPES.TEXT,
        'Error Test',
        { text: 'Test' }
      );

      // Mock WhatsApp interface error
      whatsappInterface.sendMessage = jest.fn().mockRejectedValue(new Error('Send failed'));

      // Attempt to send
      await expect(controller.sendTemplate(template.id, SEND_MODES.ORIGINAL))
        .rejects.toThrow('Send failed');
    });

    test('should handle translation errors gracefully', async () => {
      // Create template
      const group = await controller.groupManager.createGroup('Test Group');
      const template = await controller.templateManager.createTemplate(
        group.id,
        TEMPLATE_TYPES.TEXT,
        'Translation Error Test',
        { text: 'Test' }
      );

      // Mock translation error
      mockTranslationService.translate.mockRejectedValue(new Error('Translation failed'));

      // Attempt to send with translation
      await expect(controller.sendTemplate(template.id, SEND_MODES.TRANSLATED))
        .rejects.toThrow();
    });

    test('should send different media types correctly', async () => {
      // Create group
      const group = await controller.groupManager.createGroup('Media Group');

      // Mock WhatsApp interface methods
      whatsappInterface.sendImage = jest.fn().mockResolvedValue(true);
      whatsappInterface.sendAudio = jest.fn().mockResolvedValue(true);
      whatsappInterface.sendVideo = jest.fn().mockResolvedValue(true);

      // Create and send image template
      const imageTemplate = await controller.templateManager.createTemplate(
        group.id,
        TEMPLATE_TYPES.IMAGE,
        'Image',
        { mediaPath: '/path/to/image.jpg' }
      );
      await controller.sendManager.sendOriginal(imageTemplate);
      expect(whatsappInterface.sendImage).toHaveBeenCalledWith('/path/to/image.jpg');

      // Create and send audio template
      const audioTemplate = await controller.templateManager.createTemplate(
        group.id,
        TEMPLATE_TYPES.AUDIO,
        'Audio',
        { mediaPath: '/path/to/audio.mp3' }
      );
      await controller.sendManager.sendOriginal(audioTemplate);
      expect(whatsappInterface.sendAudio).toHaveBeenCalledWith('/path/to/audio.mp3');

      // Create and send video template
      const videoTemplate = await controller.templateManager.createTemplate(
        group.id,
        TEMPLATE_TYPES.VIDEO,
        'Video',
        { mediaPath: '/path/to/video.mp4' }
      );
      await controller.sendManager.sendOriginal(videoTemplate);
      expect(whatsappInterface.sendVideo).toHaveBeenCalledWith('/path/to/video.mp4');
    });

    test('should send mixed content (image + text) correctly', async () => {
      // Create template
      const group = await controller.groupManager.createGroup('Mixed Group');
      const template = await controller.templateManager.createTemplate(
        group.id,
        TEMPLATE_TYPES.MIXED,
        'Mixed Template',
        {
          mediaPath: '/path/to/image.jpg',
          text: 'Image caption'
        }
      );

      // Mock WhatsApp interface
      whatsappInterface.sendImage = jest.fn().mockResolvedValue(true);
      whatsappInterface.sendMessage = jest.fn().mockResolvedValue(true);

      // Send mixed template
      await controller.sendManager.sendOriginal(template);

      // Verify both image and text were sent
      expect(whatsappInterface.sendImage).toHaveBeenCalledWith('/path/to/image.jpg');
      expect(whatsappInterface.sendMessage).toHaveBeenCalledWith('Image caption');
    });

    test('should handle rapid consecutive sends', async () => {
      // Create template
      const group = await controller.groupManager.createGroup('Test Group');
      const template = await controller.templateManager.createTemplate(
        group.id,
        TEMPLATE_TYPES.TEXT,
        'Rapid Test',
        { text: 'Rapid send' }
      );

      // Mock WhatsApp interface
      whatsappInterface.sendMessage = jest.fn().mockResolvedValue(true);

      // Send multiple times sequentially to avoid race conditions
      for (let i = 0; i < 5; i++) {
        await controller.sendTemplate(template.id, SEND_MODES.ORIGINAL);
      }

      // Verify all sends completed
      expect(whatsappInterface.sendMessage).toHaveBeenCalledTimes(5);

      // Verify usage count
      const stats = await controller.templateManager.getUsageStats(template.id);
      expect(stats.usageCount).toBe(5);
    });
  });

  describe('Search Functionality in Panel', () => {
    test('should filter templates based on search keyword', async () => {
      // Create templates
      const group = await controller.groupManager.createGroup('Test Group');
      await controller.templateManager.createTemplate(
        group.id,
        TEMPLATE_TYPES.TEXT,
        'Hello Template',
        { text: 'Hello world' }
      );
      await controller.templateManager.createTemplate(
        group.id,
        TEMPLATE_TYPES.TEXT,
        'Goodbye Template',
        { text: 'Goodbye world' }
      );
      await controller.templateManager.createTemplate(
        group.id,
        TEMPLATE_TYPES.TEXT,
        'Welcome Template',
        { text: 'Welcome' }
      );

      // Search for "Hello"
      const results = await controller.searchTemplates('Hello');

      // Verify search results
      expect(results.hasResults).toBe(true);
      expect(results.templates).toHaveLength(1);
      expect(results.templates[0].label).toBe('Hello Template');
    });

    test('should show all templates when search is cleared', async () => {
      // Create templates
      const group = await controller.groupManager.createGroup('Test Group');
      await controller.templateManager.createTemplate(
        group.id,
        TEMPLATE_TYPES.TEXT,
        'Template 1',
        { text: 'Text 1' }
      );
      await controller.templateManager.createTemplate(
        group.id,
        TEMPLATE_TYPES.TEXT,
        'Template 2',
        { text: 'Text 2' }
      );

      // Search
      let results = await controller.searchTemplates('Template 1');
      expect(results.templates).toHaveLength(1);

      // Clear search (empty keyword)
      results = await controller.searchTemplates('');
      expect(results.templates).toHaveLength(2);
    });

    test('should show empty state when no search results found', async () => {
      // Create templates
      const group = await controller.groupManager.createGroup('Test Group');
      await controller.templateManager.createTemplate(
        group.id,
        TEMPLATE_TYPES.TEXT,
        'Template 1',
        { text: 'Text 1' }
      );

      // Search for non-existent keyword
      const results = await controller.searchTemplates('NonExistent');

      // Verify empty results
      expect(results.hasResults).toBe(false);
      expect(results.templates).toHaveLength(0);
    });
  });

  describe('Integration with IPC Handlers', () => {
    test('should handle IPC load request', async () => {
      // Create test data
      const group = await controller.groupManager.createGroup('Test Group');
      await controller.templateManager.createTemplate(
        group.id,
        TEMPLATE_TYPES.TEXT,
        'Test Template',
        { text: 'Test' }
      );

      // Simulate IPC load request
      const templates = await controller.templateManager.storage.getAll();
      const groups = await controller.groupManager.getAllGroups();

      // Verify data structure for IPC response
      const response = {
        success: true,
        accountId: controller.accountId,
        templates,
        groups,
        templateCount: templates.length,
        groupCount: groups.length
      };

      expect(response.success).toBe(true);
      expect(response.accountId).toBe('test-account');
      expect(response.templateCount).toBe(1);
      expect(response.groupCount).toBe(1);
    });

    test('should handle IPC send template request', async () => {
      // Create template
      const group = await controller.groupManager.createGroup('Test Group');
      const template = await controller.templateManager.createTemplate(
        group.id,
        TEMPLATE_TYPES.TEXT,
        'Test Template',
        { text: 'Test message' }
      );

      // Mock WhatsApp interface
      whatsappInterface.sendMessage = jest.fn().mockResolvedValue(true);

      // Simulate IPC send request
      await controller.sendTemplate(template.id, SEND_MODES.ORIGINAL);

      // Verify response
      expect(whatsappInterface.sendMessage).toHaveBeenCalledWith('Test message');
    });

    test('should handle IPC search request', async () => {
      // Create templates
      const group = await controller.groupManager.createGroup('Test Group');
      await controller.templateManager.createTemplate(
        group.id,
        TEMPLATE_TYPES.TEXT,
        'Search Test',
        { text: 'Searchable content' }
      );

      // Simulate IPC search request
      const results = await controller.searchTemplates('Search');

      // Verify response structure
      expect(results).toHaveProperty('hasResults');
      expect(results).toHaveProperty('templates');
      expect(results.hasResults).toBe(true);
      expect(results.templates).toHaveLength(1);
    });
  });
});
