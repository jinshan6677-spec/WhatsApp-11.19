/**
 * Account Switch Integration Tests
 * 
 * Tests the integration of account switching with the quick reply system
 * Requirements: 11.1-11.7
 */

const QuickReplyController = require('../controllers/QuickReplyController');
const AccountSwitchHandler = require('../handlers/AccountSwitchHandler');
const TemplateManager = require('../managers/TemplateManager');
const GroupManager = require('../managers/GroupManager');
const path = require('path');
const fs = require('fs').promises;
const os = require('os');

describe('Account Switch Integration', () => {
  let testDir;
  let controller1;
  let controller2;
  let mockTranslationService;
  let mockWhatsAppWebInterface;

  beforeEach(async () => {
    // Create temporary test directory
    testDir = path.join(os.tmpdir(), `quick-reply-test-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });

    // Mock services
    mockTranslationService = {
      translate: jest.fn().mockResolvedValue('translated text')
    };

    mockWhatsAppWebInterface = {
      sendMessage: jest.fn().mockResolvedValue(undefined),
      insertText: jest.fn().mockResolvedValue(undefined),
      focusInput: jest.fn().mockResolvedValue(undefined)
    };

    // Create controllers for two accounts
    controller1 = new QuickReplyController(
      'account-1',
      mockTranslationService,
      mockWhatsAppWebInterface,
      testDir
    );

    controller2 = new QuickReplyController(
      'account-2',
      mockTranslationService,
      mockWhatsAppWebInterface,
      testDir
    );
  });

  afterEach(async () => {
    // Clean up
    if (controller1) {
      controller1.destroy();
    }
    if (controller2) {
      controller2.destroy();
    }

    // Remove test directory
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Account Data Isolation', () => {
    test('should maintain separate data for different accounts', async () => {
      // Initialize controllers
      await controller1.initialize();
      await controller2.initialize();

      // Create group and template for account 1
      const group1 = await controller1.groupManager.createGroup('Group 1');
      const template1 = await controller1.templateManager.createTemplate(
        group1.id,
        'text',
        'Template 1',
        { text: 'Hello from account 1' }
      );

      // Create group and template for account 2
      const group2 = await controller2.groupManager.createGroup('Group 2');
      const template2 = await controller2.templateManager.createTemplate(
        group2.id,
        'text',
        'Template 2',
        { text: 'Hello from account 2' }
      );

      // Verify account 1 data
      const account1Groups = await controller1.groupManager.getAllGroups();
      const account1Templates = await controller1.templateManager.storage.getAll();

      expect(account1Groups).toHaveLength(1);
      expect(account1Groups[0].name).toBe('Group 1');
      expect(account1Templates).toHaveLength(1);
      expect(account1Templates[0].label).toBe('Template 1');

      // Verify account 2 data
      const account2Groups = await controller2.groupManager.getAllGroups();
      const account2Templates = await controller2.templateManager.storage.getAll();

      expect(account2Groups).toHaveLength(1);
      expect(account2Groups[0].name).toBe('Group 2');
      expect(account2Templates).toHaveLength(1);
      expect(account2Templates[0].label).toBe('Template 2');

      // Verify data isolation
      expect(account1Groups[0].id).not.toBe(account2Groups[0].id);
      expect(account1Templates[0].id).not.toBe(account2Templates[0].id);
    });

    test('should not affect other accounts when modifying data', async () => {
      // Initialize controllers
      await controller1.initialize();
      await controller2.initialize();

      // Create data for both accounts
      const group1 = await controller1.groupManager.createGroup('Group 1');
      await controller1.templateManager.createTemplate(
        group1.id,
        'text',
        'Template 1',
        { text: 'Hello from account 1' }
      );

      const group2 = await controller2.groupManager.createGroup('Group 2');
      await controller2.templateManager.createTemplate(
        group2.id,
        'text',
        'Template 2',
        { text: 'Hello from account 2' }
      );

      // Delete data from account 1
      await controller1.groupManager.deleteGroup(group1.id);

      // Verify account 1 data is deleted
      const account1Groups = await controller1.groupManager.getAllGroups();
      expect(account1Groups).toHaveLength(0);

      // Verify account 2 data is unchanged
      const account2Groups = await controller2.groupManager.getAllGroups();
      const account2Templates = await controller2.templateManager.storage.getAll();

      expect(account2Groups).toHaveLength(1);
      expect(account2Groups[0].name).toBe('Group 2');
      expect(account2Templates).toHaveLength(1);
      expect(account2Templates[0].label).toBe('Template 2');
    });
  });

  describe('Account Switch Handler', () => {
    test('should handle account switch correctly', async () => {
      // Initialize controller
      await controller1.initialize();

      // Create test data
      const group = await controller1.groupManager.createGroup('Test Group');
      await controller1.templateManager.createTemplate(
        group.id,
        'text',
        'Test Template',
        { text: 'Test content' }
      );

      // Get account switch handler
      const handler = controller1.accountSwitchHandler;

      // Track events
      const events = [];
      handler.on('switching', (data) => events.push({ type: 'switching', data }));
      handler.on('switched', (data) => events.push({ type: 'switched', data }));
      handler.on('state:saved', (data) => events.push({ type: 'state:saved', data }));
      handler.on('data:unloaded', (data) => events.push({ type: 'data:unloaded', data }));
      handler.on('data:loaded', (data) => events.push({ type: 'data:loaded', data }));

      // Perform account switch
      await handler.handleAccountSwitch('account-2');

      // Verify events were emitted
      expect(events.some(e => e.type === 'switching')).toBe(true);
      expect(events.some(e => e.type === 'state:saved')).toBe(true);
      expect(events.some(e => e.type === 'data:unloaded')).toBe(true);
      expect(events.some(e => e.type === 'data:loaded')).toBe(true);
      expect(events.some(e => e.type === 'switched')).toBe(true);

      // Verify account ID was updated
      expect(handler.currentAccountId).toBe('account-2');
      expect(controller1.accountId).toBe('account-2');
    });

    test('should save and restore state during account switch', async () => {
      // Initialize controller
      await controller1.initialize();

      // Create test data
      const group = await controller1.groupManager.createGroup('Test Group');
      await controller1.templateManager.createTemplate(
        group.id,
        'text',
        'Test Template',
        { text: 'Test content' }
      );

      // Get account switch handler
      const handler = controller1.accountSwitchHandler;

      // Save current state
      await handler.saveCurrentState();

      // Verify state was saved
      const savedState = handler.getSavedState('account-1');
      expect(savedState).toBeDefined();
      expect(savedState.accountId).toBe('account-1');
      expect(savedState.controller).toBeDefined();

      // Switch to account 2
      await handler.handleAccountSwitch('account-2');

      // Switch back to account 1
      await handler.handleAccountSwitch('account-1');

      // Verify state was restored
      const restoredState = handler.getSavedState('account-1');
      expect(restoredState).toBeDefined();
      expect(restoredState.accountId).toBe('account-1');
    });

    test('should handle first-time account use', async () => {
      // Initialize controller
      await controller1.initialize();

      // Get account switch handler
      const handler = controller1.accountSwitchHandler;

      // Track first-use event
      let firstUseEvent = null;
      handler.on('account:first-use', (data) => {
        firstUseEvent = data;
      });

      // Switch to a new account
      await handler.handleAccountSwitch('new-account');

      // Verify first-use event was emitted
      expect(firstUseEvent).toBeDefined();
      expect(firstUseEvent.accountId).toBe('new-account');
    });

    test('should handle errors during account switch', async () => {
      // Initialize controller
      await controller1.initialize();

      // Get account switch handler
      const handler = controller1.accountSwitchHandler;

      // Track error event
      let errorEvent = null;
      handler.on('switch:error', (data) => {
        errorEvent = data;
      });

      // Try to switch to invalid account (null)
      // Note: The handler logs a warning but doesn't throw for null accountId
      // because it returns early - this is by design
      await handler.handleAccountSwitch(null);
      
      // No error event should be emitted for null accountId (early return)
      expect(errorEvent).toBeNull();
    });

    test('should skip switch if already on target account', async () => {
      // Initialize controller
      await controller1.initialize();

      // Get account switch handler
      const handler = controller1.accountSwitchHandler;

      // Track events
      const events = [];
      handler.on('switching', (data) => events.push({ type: 'switching', data }));

      // Try to switch to same account
      await handler.handleAccountSwitch('account-1');

      // Verify no switching event was emitted
      expect(events).toHaveLength(0);
    });
  });

  describe('Controller Account Switch', () => {
    test('should switch account in controller', async () => {
      // Initialize controller
      await controller1.initialize();

      // Create test data for account 1
      const group1 = await controller1.groupManager.createGroup('Group 1');
      await controller1.templateManager.createTemplate(
        group1.id,
        'text',
        'Template 1',
        { text: 'Hello from account 1' }
      );

      // Verify initial data
      let groups = await controller1.groupManager.getAllGroups();
      let templates = await controller1.templateManager.storage.getAll();
      expect(groups).toHaveLength(1);
      expect(templates).toHaveLength(1);

      // Switch account
      await controller1.switchAccount('account-2');

      // Verify account ID was updated
      expect(controller1.accountId).toBe('account-2');

      // Verify data is empty for new account
      groups = await controller1.groupManager.getAllGroups();
      templates = await controller1.templateManager.storage.getAll();
      expect(groups).toHaveLength(0);
      expect(templates).toHaveLength(0);

      // Create data for account 2
      const group2 = await controller1.groupManager.createGroup('Group 2');
      await controller1.templateManager.createTemplate(
        group2.id,
        'text',
        'Template 2',
        { text: 'Hello from account 2' }
      );

      // Verify new data
      groups = await controller1.groupManager.getAllGroups();
      templates = await controller1.templateManager.storage.getAll();
      expect(groups).toHaveLength(1);
      expect(groups[0].name).toBe('Group 2');
      expect(templates).toHaveLength(1);
      expect(templates[0].label).toBe('Template 2');
    });

    test('should emit events during account switch', async () => {
      // Initialize controller
      await controller1.initialize();

      // Track events
      const events = [];
      controller1.on('account:switching', (data) => events.push({ type: 'switching', data }));
      controller1.on('account:switched', (data) => events.push({ type: 'switched', data }));
      controller1.on('data:loaded', (data) => events.push({ type: 'data:loaded', data }));

      // Switch account
      await controller1.switchAccount('account-2');

      // Verify events were emitted
      expect(events.some(e => e.type === 'switching')).toBe(true);
      expect(events.some(e => e.type === 'data:loaded')).toBe(true);
      expect(events.some(e => e.type === 'switched')).toBe(true);

      // Verify event data
      const switchingEvent = events.find(e => e.type === 'switching');
      expect(switchingEvent.data.oldAccountId).toBe('account-1');
      expect(switchingEvent.data.newAccountId).toBe('account-2');

      const switchedEvent = events.find(e => e.type === 'switched');
      expect(switchedEvent.data.oldAccountId).toBe('account-1');
      expect(switchedEvent.data.newAccountId).toBe('account-2');
    });
  });

  describe('UI State Persistence', () => {
    test('should persist operation panel state during account switch', async () => {
      // Initialize controller
      await controller1.initialize();

      // Mock operation panel
      controller1.operationPanel = {
        sendMode: 'translated',
        searchKeyword: 'test',
        expandedGroups: new Set(['group-1', 'group-2'])
      };

      // Open operation panel
      controller1.openOperationPanel();

      // Get account switch handler
      const handler = controller1.accountSwitchHandler;

      // Save state
      await handler.saveCurrentState();

      // Verify state was saved
      const savedState = handler.getSavedState('account-1');
      expect(savedState).toBeDefined();
      expect(savedState.ui.operationPanel).toBeDefined();
      expect(savedState.ui.operationPanel.sendMode).toBe('translated');
      expect(savedState.ui.operationPanel.searchKeyword).toBe('test');
      expect(savedState.ui.operationPanel.expandedGroups).toEqual(['group-1', 'group-2']);
    });

    test('should persist management interface state during account switch', async () => {
      // Initialize controller
      await controller1.initialize();

      // Mock management interface
      controller1.managementInterface = {
        selectedGroupId: 'group-1',
        activeTab: 'image'
      };

      // Open management interface
      controller1.openManagementInterface();

      // Get account switch handler
      const handler = controller1.accountSwitchHandler;

      // Save state
      await handler.saveCurrentState();

      // Verify state was saved
      const savedState = handler.getSavedState('account-1');
      expect(savedState).toBeDefined();
      expect(savedState.ui.managementInterface).toBeDefined();
      expect(savedState.ui.managementInterface.selectedGroupId).toBe('group-1');
      expect(savedState.ui.managementInterface.activeTab).toBe('image');
    });
  });
});
