/**
 * Tests for WhatsAppWebInterfaceFactory
 * 
 * Verifies that the factory correctly creates WhatsAppWebInterface instances
 * connected to the active BrowserView's webContents.
 */

const WhatsAppWebInterfaceFactory = require('../services/WhatsAppWebInterfaceFactory');
const WhatsAppWebInterface = require('../services/WhatsAppWebInterface');

describe('WhatsAppWebInterfaceFactory', () => {
  let factory;
  let mockViewManager;
  let mockWebContents;
  let mockView;

  beforeEach(() => {
    // Create mock webContents
    mockWebContents = {
      isDestroyed: jest.fn(() => false),
      executeJavaScript: jest.fn(),
      loadURL: jest.fn(),
    };

    // Create mock view
    mockView = {
      webContents: mockWebContents,
    };

    // Create mock ViewManager
    mockViewManager = {
      getActiveAccountId: jest.fn(),
      getActiveView: jest.fn(),
      getView: jest.fn(),
    };

    factory = new WhatsAppWebInterfaceFactory(mockViewManager);
  });

  afterEach(() => {
    if (factory) {
      factory.destroy();
    }
  });

  describe('constructor', () => {
    test('should throw error if ViewManager is not provided', () => {
      expect(() => new WhatsAppWebInterfaceFactory(null)).toThrow('ViewManager is required');
    });

    test('should initialize with ViewManager', () => {
      expect(factory.viewManager).toBe(mockViewManager);
      expect(factory.currentInterface).toBeNull();
      expect(factory.currentAccountId).toBeNull();
    });
  });

  describe('getCurrentInterface', () => {
    test('should return null if no active account', () => {
      mockViewManager.getActiveAccountId.mockReturnValue(null);

      const result = factory.getCurrentInterface();

      expect(result).toBeNull();
      expect(mockViewManager.getActiveAccountId).toHaveBeenCalled();
    });

    test('should return null if no active view', () => {
      mockViewManager.getActiveAccountId.mockReturnValue('account-1');
      mockViewManager.getActiveView.mockReturnValue(null);

      const result = factory.getCurrentInterface();

      expect(result).toBeNull();
      expect(mockViewManager.getActiveView).toHaveBeenCalled();
    });

    test('should return null if webContents is destroyed', () => {
      mockViewManager.getActiveAccountId.mockReturnValue('account-1');
      mockViewManager.getActiveView.mockReturnValue(mockView);
      mockWebContents.isDestroyed.mockReturnValue(true);

      const result = factory.getCurrentInterface();

      expect(result).toBeNull();
    });

    test('should create and return WhatsAppWebInterface for active account', () => {
      mockViewManager.getActiveAccountId.mockReturnValue('account-1');
      mockViewManager.getActiveView.mockReturnValue(mockView);

      const result = factory.getCurrentInterface();

      expect(result).toBeInstanceOf(WhatsAppWebInterface);
      expect(result.webContents).toBe(mockWebContents);
      expect(factory.currentAccountId).toBe('account-1');
    });

    test('should return cached interface for same account', () => {
      mockViewManager.getActiveAccountId.mockReturnValue('account-1');
      mockViewManager.getActiveView.mockReturnValue(mockView);

      const result1 = factory.getCurrentInterface();
      const result2 = factory.getCurrentInterface();

      expect(result1).toBe(result2);
      expect(mockViewManager.getActiveView).toHaveBeenCalledTimes(1);
    });

    test('should create new interface when account changes', () => {
      // First account
      mockViewManager.getActiveAccountId.mockReturnValue('account-1');
      mockViewManager.getActiveView.mockReturnValue(mockView);
      const result1 = factory.getCurrentInterface();

      // Second account
      const mockWebContents2 = { ...mockWebContents };
      const mockView2 = { webContents: mockWebContents2 };
      mockViewManager.getActiveAccountId.mockReturnValue('account-2');
      mockViewManager.getActiveView.mockReturnValue(mockView2);
      const result2 = factory.getCurrentInterface();

      expect(result1).not.toBe(result2);
      expect(factory.currentAccountId).toBe('account-2');
    });
  });

  describe('getInterfaceForAccount', () => {
    test('should return null if account ID is not provided', () => {
      // The method catches the error and returns null
      const result = factory.getInterfaceForAccount(null);
      expect(result).toBeNull();
    });

    test('should return null if view not found', () => {
      mockViewManager.getView.mockReturnValue(null);

      const result = factory.getInterfaceForAccount('account-1');

      expect(result).toBeNull();
      expect(mockViewManager.getView).toHaveBeenCalledWith('account-1');
    });

    test('should return null if webContents is destroyed', () => {
      mockViewManager.getView.mockReturnValue(mockView);
      mockWebContents.isDestroyed.mockReturnValue(true);

      const result = factory.getInterfaceForAccount('account-1');

      expect(result).toBeNull();
    });

    test('should create and return WhatsAppWebInterface for specific account', () => {
      mockViewManager.getView.mockReturnValue(mockView);

      const result = factory.getInterfaceForAccount('account-1');

      expect(result).toBeInstanceOf(WhatsAppWebInterface);
      expect(result.webContents).toBe(mockWebContents);
    });

    test('should return cached interface if requesting current active account', () => {
      mockViewManager.getActiveAccountId.mockReturnValue('account-1');
      mockViewManager.getActiveView.mockReturnValue(mockView);

      // Create interface for active account
      const result1 = factory.getCurrentInterface();

      // Request same account
      const result2 = factory.getInterfaceForAccount('account-1');

      expect(result1).toBe(result2);
    });
  });

  describe('isCurrentAccountReady', () => {
    test('should return false if no active interface', async () => {
      mockViewManager.getActiveAccountId.mockReturnValue(null);

      const result = await factory.isCurrentAccountReady();

      expect(result).toBe(false);
    });

    test('should return result from interface.isReady()', async () => {
      mockViewManager.getActiveAccountId.mockReturnValue('account-1');
      mockViewManager.getActiveView.mockReturnValue(mockView);
      mockWebContents.executeJavaScript.mockResolvedValue(true);

      const result = await factory.isCurrentAccountReady();

      expect(result).toBe(true);
    });

    test('should return false if isReady() throws error', async () => {
      mockViewManager.getActiveAccountId.mockReturnValue('account-1');
      mockViewManager.getActiveView.mockReturnValue(mockView);
      mockWebContents.executeJavaScript.mockRejectedValue(new Error('Test error'));

      const result = await factory.isCurrentAccountReady();

      expect(result).toBe(false);
    });
  });

  describe('getCurrentChat', () => {
    test('should return null if no active interface', async () => {
      mockViewManager.getActiveAccountId.mockReturnValue(null);

      const result = await factory.getCurrentChat();

      expect(result).toBeNull();
    });

    test('should return chat info from interface', async () => {
      const mockChatInfo = { name: 'Test Chat', timestamp: Date.now() };
      mockViewManager.getActiveAccountId.mockReturnValue('account-1');
      mockViewManager.getActiveView.mockReturnValue(mockView);
      mockWebContents.executeJavaScript.mockResolvedValue(mockChatInfo);

      const result = await factory.getCurrentChat();

      expect(result).toEqual(mockChatInfo);
    });

    test('should return null if getCurrentChat() throws error', async () => {
      mockViewManager.getActiveAccountId.mockReturnValue('account-1');
      mockViewManager.getActiveView.mockReturnValue(mockView);
      mockWebContents.executeJavaScript.mockRejectedValue(new Error('Test error'));

      const result = await factory.getCurrentChat();

      expect(result).toBeNull();
    });
  });

  describe('clearCache', () => {
    test('should clear cached interface and account ID', () => {
      mockViewManager.getActiveAccountId.mockReturnValue('account-1');
      mockViewManager.getActiveView.mockReturnValue(mockView);

      // Create interface
      factory.getCurrentInterface();
      expect(factory.currentInterface).not.toBeNull();
      expect(factory.currentAccountId).toBe('account-1');

      // Clear cache
      factory.clearCache();
      expect(factory.currentInterface).toBeNull();
      expect(factory.currentAccountId).toBeNull();
    });
  });

  describe('handleAccountSwitch', () => {
    test('should clear cache when switching to different account', () => {
      mockViewManager.getActiveAccountId.mockReturnValue('account-1');
      mockViewManager.getActiveView.mockReturnValue(mockView);

      // Create interface for account-1
      factory.getCurrentInterface();
      expect(factory.currentAccountId).toBe('account-1');

      // Switch to account-2
      factory.handleAccountSwitch('account-2');
      expect(factory.currentInterface).toBeNull();
      expect(factory.currentAccountId).toBeNull();
    });

    test('should not clear cache when switching to same account', () => {
      mockViewManager.getActiveAccountId.mockReturnValue('account-1');
      mockViewManager.getActiveView.mockReturnValue(mockView);

      // Create interface for account-1
      const interface1 = factory.getCurrentInterface();
      expect(factory.currentAccountId).toBe('account-1');

      // Switch to same account
      factory.handleAccountSwitch('account-1');
      expect(factory.currentInterface).toBe(interface1);
      expect(factory.currentAccountId).toBe('account-1');
    });
  });

  describe('destroy', () => {
    test('should clean up resources', () => {
      mockViewManager.getActiveAccountId.mockReturnValue('account-1');
      mockViewManager.getActiveView.mockReturnValue(mockView);

      // Create interface
      factory.getCurrentInterface();

      // Destroy
      factory.destroy();

      expect(factory.currentInterface).toBeNull();
      expect(factory.currentAccountId).toBeNull();
      expect(factory.viewManager).toBeNull();
    });
  });
});
