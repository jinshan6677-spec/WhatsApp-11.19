/**
 * Account Switch Handler Tests
 * 
 * Tests for account switching functionality
 * Requirements: 11.1-11.7
 */

const AccountSwitchHandler = require('../handlers/AccountSwitchHandler');
const QuickReplyController = require('../controllers/QuickReplyController');
const TemplateManager = require('../managers/TemplateManager');
const GroupManager = require('../managers/GroupManager');
const ConfigStorage = require('../storage/ConfigStorage');
const path = require('path');
const fs = require('fs').promises;
const os = require('os');

describe('AccountSwitchHandler', () => {
  let tempDir;
  let controller;
  let handler;
  let mockTranslationService;
  let mockWhatsAppWebInterface;

  beforeEach(async () => {
    // Create temp directory for testing
    tempDir = path.join(os.tmpdir(), `quick-reply-test-${Date.now()}`);
    await fs.mkdir(tempDir, { recursive: true });

    // Mock services
    mockTranslationService = {
      translate: jest.fn().mockResolvedValue('translated text')
    };

    mockWhatsAppWebInterface = {
      sendMessage: jest.fn().mockResolvedValue(true),
      insertText: jest.fn().mockResolvedValue(true)
    };

    // Create controller
    controller = new QuickReplyController(
      'test-account-1',
      mockTranslationService,
      mockWhatsAppWebInterface,
      tempDir
    );

    await controller.initialize();

    // Create handler
    handler = controller.accountSwitchHandler;
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

  describe('Initialization', () => {
    test('should initialize with controller', () => {
      expect(handler).toBeDefined();
      expect(handler.controller).toBe(controller);
      expect(handler.currentAccountId).toBe('test-account-1');
    });

    test('should start listening for account switch events', () => {
      expect(handler.isListening).toBe(true);
    });
  });

  describe('State Management', () => {
    test('should save current state', async () => {
      // Set some state
      controller.isOperationPanelOpen = true;

      // Save state
      await handler.saveCurrentState();

      // Check saved state
      const savedState = handler.getSavedState('test-account-1');
      expect(savedState).toBeDefined();
      expect(savedState.accountId).toBe('test-account-1');
      expect(savedState.controller.isOperationPanelOpen).toBe(true);
    });

    test('should restore account state', async () => {
      // Save state with specific values
      const state = {
        accountId: 'test-account-1',
        controller: {
          isOperationPanelOpen: true,
          isManagementInterfaceOpen: false
        },
        ui: {
          operationPanel: {
            isOpen: true,
            sendMode: 'translated',
            searchKeyword: 'test',
            expandedGroups: ['group1', 'group2']
          }
        },
        savedAt: Date.now()
      };

      handler.savedStates.set('test-account-1', state);

      // Mock operation panel
      controller.operationPanel = {
        sendMode: 'original',
        searchKeyword: '',
        expandedGroups: new Set()
      };

      // Restore state
      await handler.restoreAccountState('test-account-1');

      // Check restored state
      expect(controller.operationPanel.sendMode).toBe('translated');
      expect(controller.operationPanel.searchKeyword).toBe('test');
      expect(Array.from(controller.operationPanel.expandedGroups)).toEqual(['group1', 'group2']);
    });

    test('should clear saved state', () => {
      // Save state
      handler.savedStates.set('test-account-1', { test: 'data' });

      // Clear state
      handler.clearSavedState('test-account-1');

      // Check cleared
      expect(handler.getSavedState('test-account-1')).toBeNull();
    });

    test('should clear all saved states', () => {
      // Save multiple states
      handler.savedStates.set('account-1', { test: 'data1' });
      handler.savedStates.set('account-2', { test: 'data2' });

      // Clear all
      handler.clearAllSavedStates();

      // Check cleared
      expect(handler.getSavedState('account-1')).toBeNull();
      expect(handler.getSavedState('account-2')).toBeNull();
    });
  });

  describe('Account Switching', () => {
    test('should handle account switch', async () => {
      // Create some data for first account
      const templateManager = new TemplateManager('test-account-1', tempDir);
      await templateManager.createTemplate('group1', 'text', 'Test Template', {
        text: 'Hello World'
      });

      // Switch to new account
      await handler.handleAccountSwitch('test-account-2');

      // Check account switched
      expect(handler.currentAccountId).toBe('test-account-2');
      expect(controller.accountId).toBe('test-account-2');
    });

    test('should emit switching and switched events', async () => {
      const switchingListener = jest.fn();
      const switchedListener = jest.fn();

      handler.on('switching', switchingListener);
      handler.on('switched', switchedListener);

      // Switch account
      await handler.handleAccountSwitch('test-account-2');

      // Check events emitted
      expect(switchingListener).toHaveBeenCalledWith({
        oldAccountId: 'test-account-1',
        newAccountId: 'test-account-2'
      });

      expect(switchedListener).toHaveBeenCalled();
    });

    test('should not switch if already on account', async () => {
      const switchingListener = jest.fn();
      handler.on('switching', switchingListener);

      // Try to switch to same account
      await handler.handleAccountSwitch('test-account-1');

      // Check no switch occurred
      expect(switchingListener).not.toHaveBeenCalled();
    });

    test('should save state before switching', async () => {
      const saveStateSpy = jest.spyOn(handler, 'saveCurrentState');

      // Switch account
      await handler.handleAccountSwitch('test-account-2');

      // Check state was saved
      expect(saveStateSpy).toHaveBeenCalled();
    });

    test('should unload data before switching', async () => {
      const unloadDataSpy = jest.spyOn(handler, 'unloadCurrentData');

      // Switch account
      await handler.handleAccountSwitch('test-account-2');

      // Check data was unloaded
      expect(unloadDataSpy).toHaveBeenCalled();
    });

    test('should load new account data', async () => {
      const loadDataSpy = jest.spyOn(handler, 'loadAccountData');

      // Switch account
      await handler.handleAccountSwitch('test-account-2');

      // Check data was loaded
      expect(loadDataSpy).toHaveBeenCalledWith('test-account-2');
    });

    test('should restore state after switching', async () => {
      const restoreStateSpy = jest.spyOn(handler, 'restoreAccountState');

      // Switch account
      await handler.handleAccountSwitch('test-account-2');

      // Check state was restored
      expect(restoreStateSpy).toHaveBeenCalledWith('test-account-2');
    });

    test('should refresh UI after switching', async () => {
      const refreshUISpy = jest.spyOn(handler, 'refreshUI');

      // Switch account
      await handler.handleAccountSwitch('test-account-2');

      // Check UI was refreshed
      expect(refreshUISpy).toHaveBeenCalled();
    });

    test('should handle switch error', async () => {
      const errorListener = jest.fn();
      handler.on('switch:error', errorListener);

      // Mock error in controller
      jest.spyOn(controller, 'switchAccount').mockRejectedValue(new Error('Switch failed'));

      // Try to switch
      await expect(handler.handleAccountSwitch('test-account-2')).rejects.toThrow('Switch failed');

      // Check error event emitted
      expect(errorListener).toHaveBeenCalled();
    });
  });

  describe('Data Loading', () => {
    test('should load account data', async () => {
      await handler.loadAccountData('test-account-2');

      // Check config was created
      const configStorage = new ConfigStorage('test-account-2', tempDir);
      const config = await configStorage.get();

      expect(config).toBeDefined();
      expect(config.accountId).toBe('test-account-2');
    });

    test('should emit first-use event for new account', async () => {
      const firstUseListener = jest.fn();
      handler.on('account:first-use', firstUseListener);

      // Load new account
      await handler.loadAccountData('test-account-new');

      // Check event emitted
      expect(firstUseListener).toHaveBeenCalledWith({
        accountId: 'test-account-new'
      });
    });

    test('should not emit first-use event for existing account', async () => {
      // Create config for account
      const configStorage = new ConfigStorage('test-account-existing', tempDir);
      await configStorage.save({
        accountId: 'test-account-existing',
        sendMode: 'original',
        expandedGroups: [],
        createdAt: Date.now(),
        updatedAt: Date.now()
      });

      const firstUseListener = jest.fn();
      handler.on('account:first-use', firstUseListener);

      // Load existing account
      await handler.loadAccountData('test-account-existing');

      // Check event not emitted
      expect(firstUseListener).not.toHaveBeenCalled();
    });
  });

  describe('Data Unloading', () => {
    test('should close operation panel when unloading', async () => {
      // Open panel
      controller.openOperationPanel();
      expect(controller.isOperationPanelOpen).toBe(true);

      // Unload data
      await handler.unloadCurrentData();

      // Check panel closed
      expect(controller.isOperationPanelOpen).toBe(false);
    });

    test('should close management interface when unloading', async () => {
      // Open interface
      controller.openManagementInterface();
      expect(controller.isManagementInterfaceOpen).toBe(true);

      // Unload data
      await handler.unloadCurrentData();

      // Check interface closed
      expect(controller.isManagementInterfaceOpen).toBe(false);
    });
  });

  describe('UI Refresh', () => {
    test('should emit ui:refresh event', async () => {
      const refreshListener = jest.fn();
      handler.on('ui:refresh', refreshListener);

      // Refresh UI
      await handler.refreshUI();

      // Check event emitted
      expect(refreshListener).toHaveBeenCalled();
    });

    test('should trigger controller refresh', async () => {
      const refreshSpy = jest.spyOn(controller, 'refresh');

      // Refresh UI
      await handler.refreshUI();

      // Check controller refresh called
      expect(refreshSpy).toHaveBeenCalled();
    });
  });

  describe('Listening Control', () => {
    test('should stop listening', () => {
      handler.stopListening();
      expect(handler.isListening).toBe(false);
    });

    test('should start listening again after stopping', () => {
      handler.stopListening();
      handler.startListening();
      expect(handler.isListening).toBe(true);
    });

    test('should not start listening if already listening', () => {
      const initialState = handler.isListening;
      handler.startListening();
      expect(handler.isListening).toBe(initialState);
    });

    test('should not stop listening if not listening', () => {
      handler.stopListening();
      const initialState = handler.isListening;
      handler.stopListening();
      expect(handler.isListening).toBe(initialState);
    });
  });

  describe('Cleanup', () => {
    test('should destroy handler', () => {
      handler.destroy();

      expect(handler.controller).toBeNull();
      expect(handler.isListening).toBe(false);
      expect(handler.savedStates.size).toBe(0);
    });
  });

  describe('Integration with Controller', () => {
    test('should forward account switch events to controller', async () => {
      const controllerSwitchingListener = jest.fn();
      const controllerSwitchedListener = jest.fn();

      controller.on('account:switching', controllerSwitchingListener);
      controller.on('account:switched', controllerSwitchedListener);

      // Switch account
      await handler.handleAccountSwitch('test-account-2');

      // Check controller events emitted
      expect(controllerSwitchingListener).toHaveBeenCalled();
      expect(controllerSwitchedListener).toHaveBeenCalled();
    });

    test('should maintain data isolation between accounts', async () => {
      // Create template for account 1
      const template1 = await controller.templateManager.createTemplate(
        'group1',
        'text',
        'Account 1 Template',
        { text: 'Hello from account 1' }
      );

      // Switch to account 2
      await handler.handleAccountSwitch('test-account-2');

      // Create template for account 2
      const template2 = await controller.templateManager.createTemplate(
        'group2',
        'text',
        'Account 2 Template',
        { text: 'Hello from account 2' }
      );

      // Get templates for account 2
      const account2Templates = await controller.templateManager.storage.getAll();
      expect(account2Templates).toHaveLength(1);
      expect(account2Templates[0].label).toBe('Account 2 Template');

      // Switch back to account 1
      await handler.handleAccountSwitch('test-account-1');

      // Get templates for account 1
      const account1Templates = await controller.templateManager.storage.getAll();
      expect(account1Templates).toHaveLength(1);
      expect(account1Templates[0].label).toBe('Account 1 Template');
    });
  });
});
