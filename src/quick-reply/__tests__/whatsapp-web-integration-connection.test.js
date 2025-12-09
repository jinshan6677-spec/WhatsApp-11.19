/**
 * Tests for WhatsAppWebIntegration connection
 * 
 * Verifies that the integration correctly connects to ViewManager
 * and provides access to WhatsApp Web functionality.
 */

const WhatsAppWebIntegration = require('../services/WhatsAppWebIntegration');
const WhatsAppWebInterfaceFactory = require('../services/WhatsAppWebInterfaceFactory');

describe('WhatsAppWebIntegration', () => {
  let integration;
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
  });

  afterEach(() => {
    if (integration) {
      integration.destroy();
    }
  });

  describe('constructor', () => {
    test('should throw error if ViewManager is not provided', () => {
      expect(() => new WhatsAppWebIntegration(null)).toThrow('ViewManager is required');
    });

    test('should initialize with ViewManager', () => {
      integration = new WhatsAppWebIntegration(mockViewManager);

      expect(integration.viewManager).toBe(mockViewManager);
      expect(integration.factory).toBeInstanceOf(WhatsAppWebInterfaceFactory);
    });
  });

  describe('getCurrentInterface', () => {
    test('should return interface from factory', () => {
      mockViewManager.getActiveAccountId.mockReturnValue('account-1');
      mockViewManager.getActiveView.mockReturnValue(mockView);

      integration = new WhatsAppWebIntegration(mockViewManager);
      const result = integration.getCurrentInterface();

      expect(result).not.toBeNull();
      expect(result.webContents).toBe(mockWebContents);
    });

    test('should return null if no active account', () => {
      mockViewManager.getActiveAccountId.mockReturnValue(null);

      integration = new WhatsAppWebIntegration(mockViewManager);
      const result = integration.getCurrentInterface();

      expect(result).toBeNull();
    });
  });

  describe('getInterfaceForAccount', () => {
    test('should return interface for specific account', () => {
      mockViewManager.getView.mockReturnValue(mockView);

      integration = new WhatsAppWebIntegration(mockViewManager);
      const result = integration.getInterfaceForAccount('account-1');

      expect(result).not.toBeNull();
      expect(result.webContents).toBe(mockWebContents);
    });
  });

  describe('isReady', () => {
    test('should return ready status from factory', async () => {
      mockViewManager.getActiveAccountId.mockReturnValue('account-1');
      mockViewManager.getActiveView.mockReturnValue(mockView);
      mockWebContents.executeJavaScript.mockResolvedValue(true);

      integration = new WhatsAppWebIntegration(mockViewManager);
      const result = await integration.isReady();

      expect(result).toBe(true);
    });

    test('should return false if no active account', async () => {
      mockViewManager.getActiveAccountId.mockReturnValue(null);

      integration = new WhatsAppWebIntegration(mockViewManager);
      const result = await integration.isReady();

      expect(result).toBe(false);
    });
  });

  describe('getCurrentChat', () => {
    test('should return chat info from factory', async () => {
      const mockChatInfo = { name: 'Test Chat', timestamp: Date.now() };
      mockViewManager.getActiveAccountId.mockReturnValue('account-1');
      mockViewManager.getActiveView.mockReturnValue(mockView);
      mockWebContents.executeJavaScript.mockResolvedValue(mockChatInfo);

      integration = new WhatsAppWebIntegration(mockViewManager);
      const result = await integration.getCurrentChat();

      expect(result).toEqual(mockChatInfo);
    });
  });

  describe('sendMessage', () => {
    test('should send message using current interface', async () => {
      mockViewManager.getActiveAccountId.mockReturnValue('account-1');
      mockViewManager.getActiveView.mockReturnValue(mockView);
      mockWebContents.executeJavaScript.mockResolvedValue(true);

      integration = new WhatsAppWebIntegration(mockViewManager);
      await integration.sendMessage('Hello World');

      expect(mockWebContents.executeJavaScript).toHaveBeenCalled();
    });

    test('should throw error if no active interface', async () => {
      mockViewManager.getActiveAccountId.mockReturnValue(null);

      integration = new WhatsAppWebIntegration(mockViewManager);

      await expect(integration.sendMessage('Hello')).rejects.toThrow(
        'No active WhatsApp Web interface available'
      );
    });
  });

  describe('insertText', () => {
    test('should insert text using current interface', async () => {
      mockViewManager.getActiveAccountId.mockReturnValue('account-1');
      mockViewManager.getActiveView.mockReturnValue(mockView);
      mockWebContents.executeJavaScript.mockResolvedValue(true);

      integration = new WhatsAppWebIntegration(mockViewManager);
      await integration.insertText('Hello World');

      expect(mockWebContents.executeJavaScript).toHaveBeenCalled();
    });

    test('should throw error if no active interface', async () => {
      mockViewManager.getActiveAccountId.mockReturnValue(null);

      integration = new WhatsAppWebIntegration(mockViewManager);

      await expect(integration.insertText('Hello')).rejects.toThrow(
        'No active WhatsApp Web interface available'
      );
    });
  });

  describe('handleAccountSwitch', () => {
    test('should notify factory of account switch', () => {
      mockViewManager.getActiveAccountId.mockReturnValue('account-1');
      mockViewManager.getActiveView.mockReturnValue(mockView);

      integration = new WhatsAppWebIntegration(mockViewManager);
      
      // Create interface for account-1
      integration.getCurrentInterface();

      // Switch to account-2
      integration.handleAccountSwitch('account-2');

      // Factory should have cleared cache
      expect(integration.factory.currentAccountId).toBeNull();
    });
  });

  describe('clearCache', () => {
    test('should clear factory cache', () => {
      mockViewManager.getActiveAccountId.mockReturnValue('account-1');
      mockViewManager.getActiveView.mockReturnValue(mockView);

      integration = new WhatsAppWebIntegration(mockViewManager);
      
      // Create interface
      integration.getCurrentInterface();
      expect(integration.factory.currentInterface).not.toBeNull();

      // Clear cache
      integration.clearCache();
      expect(integration.factory.currentInterface).toBeNull();
    });
  });

  describe('destroy', () => {
    test('should clean up resources', () => {
      mockViewManager.getActiveAccountId.mockReturnValue('account-1');
      mockViewManager.getActiveView.mockReturnValue(mockView);

      integration = new WhatsAppWebIntegration(mockViewManager);
      
      // Create interface
      integration.getCurrentInterface();

      // Destroy
      integration.destroy();

      expect(integration.viewManager).toBeNull();
    });
  });
});
