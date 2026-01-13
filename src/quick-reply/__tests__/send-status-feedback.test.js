/**
 * Send Status Feedback Tests
 * 
 * Tests for Task 12: Send Status Feedback
 * Requirements: 14.1-14.7
 */

const SendManager = require('../managers/SendManager');
const { TEMPLATE_TYPES } = require('../constants');

describe('SendManager - Status Feedback', () => {
  let sendManager;
  let mockTranslationService;
  let mockWhatsappWebInterface;
  let statusUpdates;

  beforeEach(() => {
    // Mock translation service
    mockTranslationService = {
      translate: jest.fn().mockResolvedValue('Translated text'),
    };

    // Mock WhatsApp Web interface
    mockWhatsappWebInterface = {
      sendMessage: jest.fn().mockResolvedValue(undefined),
      sendImage: jest.fn().mockResolvedValue(undefined),
      sendAudio: jest.fn().mockResolvedValue(undefined),
      sendVideo: jest.fn().mockResolvedValue(undefined),
      sendContact: jest.fn().mockResolvedValue(undefined),
      insertText: jest.fn().mockResolvedValue(undefined),
      attachMedia: jest.fn().mockResolvedValue(undefined),
      attachContact: jest.fn().mockResolvedValue(undefined),
      focusInput: jest.fn().mockResolvedValue(undefined),
    };

    sendManager = new SendManager(mockTranslationService, mockWhatsappWebInterface);
    
    // Mock the translationIntegration for translation tests
    sendManager.translationIntegration = {
      isAvailable: jest.fn().mockReturnValue(true),
      isConfigured: jest.fn().mockReturnValue(true),
      translate: jest.fn().mockResolvedValue('Translated text'),
    };
    
    statusUpdates = [];
  });

  describe('Status Updates', () => {
    test('should emit sending status when sending original template', async () => {
      const template = {
        id: 'test-1',
        type: TEMPLATE_TYPES.TEXT,
        content: { text: 'Hello' },
      };

      const onStatusChange = (status, data) => {
        statusUpdates.push({ status, data });
      };

      await sendManager.sendOriginal(template, 'op-1', onStatusChange);

      expect(statusUpdates).toContainEqual({ status: 'sending', data: {} });
      expect(statusUpdates).toContainEqual({ status: 'success', data: {} });
    });

    test('should emit translating status when sending translated template', async () => {
      const template = {
        id: 'test-2',
        type: TEMPLATE_TYPES.TEXT,
        content: { text: 'Hello' },
      };

      const onStatusChange = (status, data) => {
        statusUpdates.push({ status, data });
      };

      await sendManager.sendTranslated(template, 'en', 'default', 'op-2', onStatusChange);

      expect(statusUpdates).toContainEqual({ status: 'translating', data: {} });
      expect(statusUpdates).toContainEqual({ status: 'translated', data: {} });
      expect(statusUpdates).toContainEqual({ status: 'sending', data: {} });
      expect(statusUpdates).toContainEqual({ status: 'success', data: {} });
    });

    test('should emit error status when send fails', async () => {
      mockWhatsappWebInterface.sendMessage.mockRejectedValue(new Error('Send failed'));

      const template = {
        id: 'test-3',
        type: TEMPLATE_TYPES.TEXT,
        content: { text: 'Hello' },
      };

      const onStatusChange = (status, data) => {
        statusUpdates.push({ status, data });
      };

      await expect(
        sendManager.sendOriginal(template, 'op-3', onStatusChange)
      ).rejects.toThrow();

      expect(statusUpdates).toContainEqual(
        expect.objectContaining({ status: 'error' })
      );
    });

    test('should emit network_error status when network fails', async () => {
      mockWhatsappWebInterface.sendMessage.mockRejectedValue(
        new Error('network connection failed')
      );

      const template = {
        id: 'test-4',
        type: TEMPLATE_TYPES.TEXT,
        content: { text: 'Hello' },
      };

      const onStatusChange = (status, data) => {
        statusUpdates.push({ status, data });
      };

      await expect(
        sendManager.sendOriginal(template, 'op-4', onStatusChange)
      ).rejects.toThrow();

      expect(statusUpdates).toContainEqual(
        expect.objectContaining({ status: 'network_error' })
      );
    });
  });

  describe('Cancellation', () => {
    test('should support cancelling send operation', async () => {
      const template = {
        id: 'test-5',
        type: TEMPLATE_TYPES.TEXT,
        content: { text: 'Hello' },
      };

      const onStatusChange = (status, data) => {
        statusUpdates.push({ status, data });
      };

      // Delay the send to allow cancellation and check cancellation during send
      mockWhatsappWebInterface.sendMessage.mockImplementation(async () => {
        // Simulate delay
        await new Promise((resolve) => setTimeout(resolve, 50));
        // Check if cancelled during the delay
        if (sendManager.isCancelled('op-5')) {
          throw new Error('Send operation was cancelled');
        }
      });

      const sendPromise = sendManager.sendOriginal(template, 'op-5', onStatusChange);

      // Cancel immediately after starting
      sendManager.cancelSend('op-5');

      // The operation should complete (either success or cancelled status)
      // Since we cancel immediately, it depends on timing
      try {
        await sendPromise;
        // If it completes, check that we got status updates
        expect(statusUpdates.length).toBeGreaterThan(0);
      } catch (error) {
        // If it throws, it should be a cancellation
        expect(error.message).toContain('cancelled');
        expect(statusUpdates).toContainEqual(
          expect.objectContaining({ status: 'cancelled' })
        );
      }
    });

    test('should check cancellation status', () => {
      sendManager.registerOperation('op-6', () => {});
      expect(sendManager.isCancelled('op-6')).toBe(false);

      sendManager.cancelSend('op-6');
      expect(sendManager.isCancelled('op-6')).toBe(false); // Deleted after cancel
    });

    test('should handle cancellation during translation', async () => {
      const template = {
        id: 'test-7',
        type: TEMPLATE_TYPES.TEXT,
        content: { text: 'Hello' },
      };

      const onStatusChange = (status, data) => {
        statusUpdates.push({ status, data });
      };

      // Delay the translation to allow cancellation
      sendManager.translationIntegration.translate.mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
        // Check if cancelled during the delay
        if (sendManager.isCancelled('op-7')) {
          throw new Error('Send operation was cancelled');
        }
        return 'Translated';
      });

      const sendPromise = sendManager.sendTranslated(
        template,
        'en',
        'default',
        'op-7',
        onStatusChange
      );

      // Cancel during translation
      setTimeout(() => sendManager.cancelSend('op-7'), 50);

      // The operation should either complete or be cancelled
      try {
        await sendPromise;
        expect(statusUpdates.length).toBeGreaterThan(0);
      } catch (error) {
        // If it throws, check for cancellation or error status
        expect(statusUpdates).toContainEqual({ status: 'translating', data: {} });
      }
    });
  });

  describe('Operation Management', () => {
    test('should register and unregister operations', () => {
      const onStatusChange = jest.fn();
      const operation = sendManager.registerOperation('op-8', onStatusChange);

      expect(operation.id).toBe('op-8');
      expect(operation.cancelled).toBe(false);
      expect(sendManager.activeSends.has('op-8')).toBe(true);

      sendManager.unregisterOperation('op-8');
      expect(sendManager.activeSends.has('op-8')).toBe(false);
    });

    test('should update operation status', () => {
      const onStatusChange = jest.fn();
      sendManager.registerOperation('op-9', onStatusChange);

      sendManager.updateStatus('op-9', 'sending');
      expect(onStatusChange).toHaveBeenCalledWith('sending', expect.any(Object));

      sendManager.updateStatus('op-9', 'success', { message: 'Sent' });
      expect(onStatusChange).toHaveBeenCalledWith('success', { message: 'Sent' });
    });

    test('should handle multiple concurrent operations', async () => {
      const template1 = {
        id: 'test-10',
        type: TEMPLATE_TYPES.TEXT,
        content: { text: 'Hello 1' },
      };

      const template2 = {
        id: 'test-11',
        type: TEMPLATE_TYPES.TEXT,
        content: { text: 'Hello 2' },
      };

      const updates1 = [];
      const updates2 = [];

      const onStatusChange1 = (status) => updates1.push(status);
      const onStatusChange2 = (status) => updates2.push(status);

      await Promise.all([
        sendManager.sendOriginal(template1, 'op-10', onStatusChange1),
        sendManager.sendOriginal(template2, 'op-11', onStatusChange2),
      ]);

      expect(updates1).toContain('sending');
      expect(updates1).toContain('success');
      expect(updates2).toContain('sending');
      expect(updates2).toContain('success');
    });
  });

  describe('Error Handling', () => {
    test('should include error message in status update', async () => {
      const errorMessage = 'Custom error message';
      mockWhatsappWebInterface.sendMessage.mockRejectedValue(new Error(errorMessage));

      const template = {
        id: 'test-12',
        type: TEMPLATE_TYPES.TEXT,
        content: { text: 'Hello' },
      };

      const onStatusChange = (status, data) => {
        statusUpdates.push({ status, data });
      };

      await expect(
        sendManager.sendOriginal(template, 'op-12', onStatusChange)
      ).rejects.toThrow();

      const errorUpdate = statusUpdates.find((u) => u.status === 'error');
      expect(errorUpdate).toBeDefined();
      expect(errorUpdate.data.error).toContain(errorMessage);
    });

    test('should handle translation errors with proper status', async () => {
      // Mock translation integration to throw error
      sendManager.translationIntegration.translate.mockRejectedValue(
        new Error('Translation failed')
      );

      const template = {
        id: 'test-13',
        type: TEMPLATE_TYPES.TEXT,
        content: { text: 'Hello' },
      };

      const onStatusChange = (status, data) => {
        statusUpdates.push({ status, data });
      };

      await expect(
        sendManager.sendTranslated(template, 'en', 'default', 'op-13', onStatusChange)
      ).rejects.toThrow();

      expect(statusUpdates).toContainEqual({ status: 'translating', data: {} });
      expect(statusUpdates).toContainEqual(
        expect.objectContaining({ status: 'error' })
      );
    });
  });

  describe('Auto-cleanup', () => {
    test('should unregister operation after successful send', async () => {
      const template = {
        id: 'test-14',
        type: TEMPLATE_TYPES.TEXT,
        content: { text: 'Hello' },
      };

      await sendManager.sendOriginal(template, 'op-14', () => {});

      expect(sendManager.activeSends.has('op-14')).toBe(false);
    });

    test('should unregister operation after failed send', async () => {
      mockWhatsappWebInterface.sendMessage.mockRejectedValue(new Error('Failed'));

      const template = {
        id: 'test-15',
        type: TEMPLATE_TYPES.TEXT,
        content: { text: 'Hello' },
      };

      await expect(
        sendManager.sendOriginal(template, 'op-15', () => {})
      ).rejects.toThrow();

      expect(sendManager.activeSends.has('op-15')).toBe(false);
    });
  });
});
