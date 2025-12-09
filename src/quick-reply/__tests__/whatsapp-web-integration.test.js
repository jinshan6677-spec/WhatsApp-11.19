/**
 * WhatsApp Web Integration Tests
 * 
 * Tests for WhatsApp Web interface integration
 * Requirements: 7.1-7.9, 9.1-9.8
 */

const WhatsAppWebInterface = require('../services/WhatsAppWebInterface');
const SendManager = require('../managers/SendManager');
const { TEMPLATE_TYPES } = require('../constants');

describe('WhatsApp Web Integration', () => {
  let mockWebContents;
  let whatsappInterface;
  let sendManager;

  beforeEach(() => {
    // Mock webContents
    mockWebContents = {
      executeJavaScript: jest.fn()
    };

    whatsappInterface = new WhatsAppWebInterface(mockWebContents);
    sendManager = new SendManager(null, whatsappInterface);
  });

  afterEach(() => {
    if (whatsappInterface) {
      whatsappInterface.destroy();
    }
  });

  describe('WhatsAppWebInterface', () => {
    describe('constructor', () => {
      test('should create instance with webContents', () => {
        expect(whatsappInterface).toBeDefined();
        expect(whatsappInterface.webContents).toBe(mockWebContents);
      });

      test('should throw error if webContents is not provided', () => {
        expect(() => new WhatsAppWebInterface(null)).toThrow('webContents is required');
      });
    });

    describe('initialize', () => {
      test('should initialize successfully when WhatsApp Web is loaded', async () => {
        mockWebContents.executeJavaScript.mockResolvedValue(true);

        await whatsappInterface.initialize();

        expect(whatsappInterface.initialized).toBe(true);
        expect(mockWebContents.executeJavaScript).toHaveBeenCalled();
      });

      test('should throw error if WhatsApp Web is not loaded', async () => {
        mockWebContents.executeJavaScript.mockResolvedValue(false);

        await expect(whatsappInterface.initialize()).rejects.toThrow('WhatsApp Web is not loaded');
      });
    });

    describe('sendMessage', () => {
      test('should send text message successfully', async () => {
        mockWebContents.executeJavaScript.mockResolvedValue(true);

        await whatsappInterface.sendMessage('Hello, World!');

        expect(mockWebContents.executeJavaScript).toHaveBeenCalled();
        const script = mockWebContents.executeJavaScript.mock.calls[0][0];
        expect(script).toContain('Hello, World!');
      });

      test('should throw error for empty text', async () => {
        await expect(whatsappInterface.sendMessage('')).rejects.toThrow('Text content is required');
      });

      test('should throw error for non-string text', async () => {
        await expect(whatsappInterface.sendMessage(123)).rejects.toThrow('Text content is required');
      });

      test('should handle send failure', async () => {
        mockWebContents.executeJavaScript.mockResolvedValue(false);

        await expect(whatsappInterface.sendMessage('Test')).rejects.toThrow('Failed to send message');
      });
    });

    describe('insertText', () => {
      test('should insert text into input box', async () => {
        mockWebContents.executeJavaScript.mockResolvedValue(true);

        await whatsappInterface.insertText('Hello');

        expect(mockWebContents.executeJavaScript).toHaveBeenCalled();
        const script = mockWebContents.executeJavaScript.mock.calls[0][0];
        expect(script).toContain('Hello');
      });

      test('should throw error for empty text', async () => {
        await expect(whatsappInterface.insertText('')).rejects.toThrow('Text is required');
      });

      test('should handle insertion failure', async () => {
        mockWebContents.executeJavaScript.mockResolvedValue(false);

        await expect(whatsappInterface.insertText('Test')).rejects.toThrow('Failed to insert text');
      });
    });

    describe('focusInput', () => {
      test('should focus input box', async () => {
        mockWebContents.executeJavaScript.mockResolvedValue(true);

        await whatsappInterface.focusInput();

        expect(mockWebContents.executeJavaScript).toHaveBeenCalled();
      });

      test('should handle focus failure', async () => {
        mockWebContents.executeJavaScript.mockResolvedValue(false);

        await expect(whatsappInterface.focusInput()).rejects.toThrow('Failed to focus input');
      });
    });

    describe('isReady', () => {
      test('should return true when WhatsApp Web is ready', async () => {
        mockWebContents.executeJavaScript.mockResolvedValue(true);

        const ready = await whatsappInterface.isReady();

        expect(ready).toBe(true);
      });

      test('should return false when WhatsApp Web is not ready', async () => {
        mockWebContents.executeJavaScript.mockResolvedValue(false);

        const ready = await whatsappInterface.isReady();

        expect(ready).toBe(false);
      });

      test('should return false on error', async () => {
        mockWebContents.executeJavaScript.mockRejectedValue(new Error('Script error'));

        const ready = await whatsappInterface.isReady();

        expect(ready).toBe(false);
      });
    });

    describe('getCurrentChat', () => {
      test('should return current chat info', async () => {
        const chatInfo = {
          name: 'Test Chat',
          timestamp: Date.now()
        };
        mockWebContents.executeJavaScript.mockResolvedValue(chatInfo);

        const result = await whatsappInterface.getCurrentChat();

        expect(result).toEqual(chatInfo);
      });

      test('should return null when no chat is active', async () => {
        mockWebContents.executeJavaScript.mockResolvedValue(null);

        const result = await whatsappInterface.getCurrentChat();

        expect(result).toBeNull();
      });

      test('should return null on error', async () => {
        mockWebContents.executeJavaScript.mockRejectedValue(new Error('Script error'));

        const result = await whatsappInterface.getCurrentChat();

        expect(result).toBeNull();
      });
    });

    describe('media methods', () => {
      test('sendImage should throw error indicating Electron integration needed', async () => {
        await expect(whatsappInterface.sendImage('/path/to/image.jpg'))
          .rejects.toThrow('Electron dialog integration');
      });

      test('sendAudio should throw error indicating Electron integration needed', async () => {
        await expect(whatsappInterface.sendAudio('/path/to/audio.mp3'))
          .rejects.toThrow('Electron dialog integration');
      });

      test('sendVideo should throw error indicating Electron integration needed', async () => {
        await expect(whatsappInterface.sendVideo('/path/to/video.mp4'))
          .rejects.toThrow('Electron dialog integration');
      });

      test('attachMedia should throw error indicating Electron integration needed', async () => {
        await expect(whatsappInterface.attachMedia('/path/to/file.jpg'))
          .rejects.toThrow('Electron dialog integration');
      });
    });

    describe('contact methods', () => {
      test('sendContact should throw error indicating API integration needed', async () => {
        const contact = { name: 'John Doe', phone: '+1234567890' };
        await expect(whatsappInterface.sendContact(contact))
          .rejects.toThrow('WhatsApp Web API integration');
      });

      test('attachContact should throw error indicating API integration needed', async () => {
        const contact = { name: 'John Doe', phone: '+1234567890' };
        await expect(whatsappInterface.attachContact(contact))
          .rejects.toThrow('WhatsApp Web API integration');
      });
    });
  });

  describe('SendManager Integration', () => {
    beforeEach(() => {
      // Mock WhatsApp interface methods
      whatsappInterface.sendMessage = jest.fn().mockResolvedValue(undefined);
      whatsappInterface.sendImage = jest.fn().mockResolvedValue(undefined);
      whatsappInterface.sendAudio = jest.fn().mockResolvedValue(undefined);
      whatsappInterface.sendVideo = jest.fn().mockResolvedValue(undefined);
      whatsappInterface.sendContact = jest.fn().mockResolvedValue(undefined);
      whatsappInterface.insertText = jest.fn().mockResolvedValue(undefined);
      whatsappInterface.attachMedia = jest.fn().mockResolvedValue(undefined);
      whatsappInterface.attachContact = jest.fn().mockResolvedValue(undefined);
      whatsappInterface.focusInput = jest.fn().mockResolvedValue(undefined);
    });

    describe('sendOriginal', () => {
      test('should send text template', async () => {
        const template = {
          id: 'test-1',
          type: TEMPLATE_TYPES.TEXT,
          content: { text: 'Hello, World!' }
        };

        await sendManager.sendOriginal(template);

        expect(whatsappInterface.sendMessage).toHaveBeenCalledWith('Hello, World!');
      });

      test('should send image template', async () => {
        const template = {
          id: 'test-2',
          type: TEMPLATE_TYPES.IMAGE,
          content: { mediaPath: '/path/to/image.jpg' }
        };

        await sendManager.sendOriginal(template);

        expect(whatsappInterface.sendImage).toHaveBeenCalledWith('/path/to/image.jpg');
      });

      test('should send audio template', async () => {
        const template = {
          id: 'test-3',
          type: TEMPLATE_TYPES.AUDIO,
          content: { mediaPath: '/path/to/audio.mp3' }
        };

        await sendManager.sendOriginal(template);

        expect(whatsappInterface.sendAudio).toHaveBeenCalledWith('/path/to/audio.mp3');
      });

      test('should send video template', async () => {
        const template = {
          id: 'test-4',
          type: TEMPLATE_TYPES.VIDEO,
          content: { mediaPath: '/path/to/video.mp4' }
        };

        await sendManager.sendOriginal(template);

        expect(whatsappInterface.sendVideo).toHaveBeenCalledWith('/path/to/video.mp4');
      });

      test('should send mixed template (image + text)', async () => {
        const template = {
          id: 'test-5',
          type: TEMPLATE_TYPES.MIXED,
          content: {
            mediaPath: '/path/to/image.jpg',
            text: 'Check this out!'
          }
        };

        await sendManager.sendOriginal(template);

        expect(whatsappInterface.sendImage).toHaveBeenCalledWith('/path/to/image.jpg');
        expect(whatsappInterface.sendMessage).toHaveBeenCalledWith('Check this out!');
      });

      test('should send contact template', async () => {
        const template = {
          id: 'test-6',
          type: TEMPLATE_TYPES.CONTACT,
          content: {
            contactInfo: {
              name: 'John Doe',
              phone: '+1234567890'
            }
          }
        };

        await sendManager.sendOriginal(template);

        expect(whatsappInterface.sendContact).toHaveBeenCalledWith({
          name: 'John Doe',
          phone: '+1234567890'
        });
      });
    });

    describe('insertOriginal', () => {
      test('should insert text template', async () => {
        const template = {
          id: 'test-1',
          type: TEMPLATE_TYPES.TEXT,
          content: { text: 'Hello!' }
        };

        await sendManager.insertOriginal(template);

        expect(whatsappInterface.insertText).toHaveBeenCalledWith('Hello!');
        expect(whatsappInterface.focusInput).toHaveBeenCalled();
      });

      test('should attach image template', async () => {
        const template = {
          id: 'test-2',
          type: TEMPLATE_TYPES.IMAGE,
          content: { mediaPath: '/path/to/image.jpg' }
        };

        await sendManager.insertOriginal(template);

        expect(whatsappInterface.attachMedia).toHaveBeenCalledWith('/path/to/image.jpg');
        expect(whatsappInterface.focusInput).toHaveBeenCalled();
      });

      test('should insert mixed template', async () => {
        const template = {
          id: 'test-3',
          type: TEMPLATE_TYPES.MIXED,
          content: {
            mediaPath: '/path/to/image.jpg',
            text: 'Check this!'
          }
        };

        await sendManager.insertOriginal(template);

        expect(whatsappInterface.insertText).toHaveBeenCalledWith('Check this!');
        expect(whatsappInterface.attachMedia).toHaveBeenCalledWith('/path/to/image.jpg');
        expect(whatsappInterface.focusInput).toHaveBeenCalled();
      });

      test('should attach contact template', async () => {
        const template = {
          id: 'test-4',
          type: TEMPLATE_TYPES.CONTACT,
          content: {
            contactInfo: {
              name: 'John Doe',
              phone: '+1234567890'
            }
          }
        };

        await sendManager.insertOriginal(template);

        expect(whatsappInterface.attachContact).toHaveBeenCalledWith({
          name: 'John Doe',
          phone: '+1234567890'
        });
        expect(whatsappInterface.focusInput).toHaveBeenCalled();
      });
    });

    describe('error handling', () => {
      test('should handle send errors', async () => {
        whatsappInterface.sendMessage.mockRejectedValue(new Error('Send failed'));

        const template = {
          id: 'test-1',
          type: TEMPLATE_TYPES.TEXT,
          content: { text: 'Hello!' }
        };

        await expect(sendManager.sendOriginal(template)).rejects.toThrow('Failed to send text message');
      });

      test('should handle insert errors', async () => {
        whatsappInterface.insertText.mockRejectedValue(new Error('Insert failed'));

        const template = {
          id: 'test-1',
          type: TEMPLATE_TYPES.TEXT,
          content: { text: 'Hello!' }
        };

        await expect(sendManager.insertOriginal(template)).rejects.toThrow('Failed to insert template');
      });

      test('should throw error when WhatsApp interface is not available', async () => {
        const sendManagerWithoutInterface = new SendManager(null, null);

        const template = {
          id: 'test-1',
          type: TEMPLATE_TYPES.TEXT,
          content: { text: 'Hello!' }
        };

        await expect(sendManagerWithoutInterface.sendOriginal(template))
          .rejects.toThrow('WhatsApp Web interface not available');
      });
    });
  });

  describe('Requirements Validation', () => {
    test('Requirement 7.1: Should send text message in original mode', async () => {
      whatsappInterface.sendMessage = jest.fn().mockResolvedValue(undefined);

      const template = {
        id: 'test-1',
        type: TEMPLATE_TYPES.TEXT,
        content: { text: 'Test message' }
      };

      await sendManager.sendOriginal(template);

      expect(whatsappInterface.sendMessage).toHaveBeenCalledWith('Test message');
    });

    test('Requirement 7.3: Should send image message', async () => {
      whatsappInterface.sendImage = jest.fn().mockResolvedValue(undefined);

      const template = {
        id: 'test-2',
        type: TEMPLATE_TYPES.IMAGE,
        content: { mediaPath: '/path/to/image.jpg' }
      };

      await sendManager.sendOriginal(template);

      expect(whatsappInterface.sendImage).toHaveBeenCalledWith('/path/to/image.jpg');
    });

    test('Requirement 7.6: Should send image with text', async () => {
      whatsappInterface.sendImage = jest.fn().mockResolvedValue(undefined);
      whatsappInterface.sendMessage = jest.fn().mockResolvedValue(undefined);

      const template = {
        id: 'test-3',
        type: TEMPLATE_TYPES.MIXED,
        content: {
          mediaPath: '/path/to/image.jpg',
          text: 'Caption text'
        }
      };

      await sendManager.sendOriginal(template);

      expect(whatsappInterface.sendImage).toHaveBeenCalledWith('/path/to/image.jpg');
      expect(whatsappInterface.sendMessage).toHaveBeenCalledWith('Caption text');
    });

    test('Requirement 9.1: Should insert text into input box', async () => {
      whatsappInterface.insertText = jest.fn().mockResolvedValue(undefined);
      whatsappInterface.focusInput = jest.fn().mockResolvedValue(undefined);

      const template = {
        id: 'test-4',
        type: TEMPLATE_TYPES.TEXT,
        content: { text: 'Insert this' }
      };

      await sendManager.insertOriginal(template);

      expect(whatsappInterface.insertText).toHaveBeenCalledWith('Insert this');
      expect(whatsappInterface.focusInput).toHaveBeenCalled();
    });

    test('Requirement 9.7: Should set focus to end after insertion', async () => {
      whatsappInterface.insertText = jest.fn().mockResolvedValue(undefined);
      whatsappInterface.focusInput = jest.fn().mockResolvedValue(undefined);

      const template = {
        id: 'test-5',
        type: TEMPLATE_TYPES.TEXT,
        content: { text: 'Test' }
      };

      await sendManager.insertOriginal(template);

      expect(whatsappInterface.focusInput).toHaveBeenCalled();
    });
  });
});
