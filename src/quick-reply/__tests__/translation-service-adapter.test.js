/**
 * TranslationServiceAdapter Tests
 * 
 * Tests for the translation service adapter that wraps the main translation service
 */

const TranslationServiceAdapter = require('../services/TranslationServiceAdapter');
const TranslationError = require('../errors/TranslationError');

describe('TranslationServiceAdapter', () => {
  let mockTranslationService;
  let adapter;

  beforeEach(() => {
    // Mock translation service
    mockTranslationService = {
      initialized: false,
      initialize: jest.fn().mockResolvedValue(undefined),
      translate: jest.fn().mockResolvedValue('Translated text'),
      detectLanguage: jest.fn().mockResolvedValue('en'),
      getConfig: jest.fn().mockReturnValue({
        inputBox: {
          enabled: true,
          engine: 'google',
          style: '通用',
          targetLang: 'auto'
        }
      }),
      saveConfig: jest.fn(),
      getStats: jest.fn().mockReturnValue({
        translation: {},
        today: {},
        total: {}
      }),
      configManager: {
        getEngineConfig: jest.fn().mockReturnValue({
          enabled: true,
          apiKey: 'test-key'
        })
      }
    };

    adapter = new TranslationServiceAdapter(mockTranslationService);
  });

  describe('initialize', () => {
    test('should initialize translation service if not initialized', async () => {
      mockTranslationService.initialized = false;

      await adapter.initialize();

      expect(mockTranslationService.initialize).toHaveBeenCalled();
      expect(adapter.initialized).toBe(true);
    });

    test('should not reinitialize if already initialized', async () => {
      mockTranslationService.initialized = true;
      await adapter.initialize();

      mockTranslationService.initialize.mockClear();
      await adapter.initialize();

      expect(mockTranslationService.initialize).not.toHaveBeenCalled();
    });

    test('should throw TranslationError on initialization failure', async () => {
      mockTranslationService.initialize.mockRejectedValue(new Error('Init failed'));

      await expect(adapter.initialize()).rejects.toThrow(TranslationError);
    });
  });

  describe('isAvailable', () => {
    test('should return true when service is initialized', () => {
      mockTranslationService.initialized = true;

      expect(adapter.isAvailable()).toBe(true);
    });

    test('should return false when service is not initialized', () => {
      mockTranslationService.initialized = false;

      expect(adapter.isAvailable()).toBe(false);
    });
  });

  describe('getConfig', () => {
    test('should get config for account', () => {
      const accountId = 'test-account';
      const config = adapter.getConfig(accountId);

      expect(mockTranslationService.getConfig).toHaveBeenCalledWith(accountId);
      expect(config).toHaveProperty('inputBox');
    });

    test('should return default config on error', () => {
      mockTranslationService.getConfig.mockImplementation(() => {
        throw new Error('Config error');
      });

      const config = adapter.getConfig('test-account');

      expect(config).toEqual({
        inputBox: {
          enabled: true,
          engine: 'google',
          style: '通用',
          targetLang: 'auto'
        }
      });
    });
  });

  describe('translate', () => {
    beforeEach(async () => {
      mockTranslationService.initialized = true;
      await adapter.initialize();
    });

    test('should translate text successfully', async () => {
      const text = 'Hello';
      const result = await adapter.translate(text, 'auto', 'zh-CN', 'google');

      expect(mockTranslationService.translate).toHaveBeenCalledWith(
        text,
        'auto',
        'zh-CN',
        'google',
        {}
      );
      expect(result).toBe('Translated text');
    });

    test('should handle result as object with translatedText', async () => {
      mockTranslationService.translate.mockResolvedValue({
        translatedText: 'Translated result'
      });

      const result = await adapter.translate('Hello', 'auto', 'zh-CN', 'google');

      expect(result).toBe('Translated result');
    });

    test('should handle result as object with text property', async () => {
      mockTranslationService.translate.mockResolvedValue({
        text: 'Translated result'
      });

      const result = await adapter.translate('Hello', 'auto', 'zh-CN', 'google');

      expect(result).toBe('Translated result');
    });

    test('should throw error if service not available', async () => {
      mockTranslationService.initialized = false;
      adapter.initialized = false;

      await expect(
        adapter.translate('Hello', 'auto', 'zh-CN', 'google')
      ).rejects.toThrow(TranslationError);
    });

    test('should throw error on invalid result', async () => {
      mockTranslationService.translate.mockResolvedValue(null);

      await expect(
        adapter.translate('Hello', 'auto', 'zh-CN', 'google')
      ).rejects.toThrow(TranslationError);
    });

    test('should use default source language', async () => {
      await adapter.translate('Hello', undefined, 'zh-CN', 'google');

      expect(mockTranslationService.translate).toHaveBeenCalledWith(
        'Hello',
        'auto',
        'zh-CN',
        'google',
        {}
      );
    });
  });

  describe('detectLanguage', () => {
    beforeEach(async () => {
      mockTranslationService.initialized = true;
      await adapter.initialize();
    });

    test('should detect language successfully', async () => {
      const result = await adapter.detectLanguage('Hello');

      expect(mockTranslationService.detectLanguage).toHaveBeenCalledWith('Hello');
      expect(result).toBe('en');
    });

    test('should throw error if service not available', async () => {
      mockTranslationService.initialized = false;
      adapter.initialized = false;

      await expect(adapter.detectLanguage('Hello')).rejects.toThrow(TranslationError);
    });
  });

  describe('saveConfig', () => {
    test('should save config for account', () => {
      const accountId = 'test-account';
      const config = { inputBox: { enabled: true } };

      adapter.saveConfig(accountId, config);

      expect(mockTranslationService.saveConfig).toHaveBeenCalledWith(accountId, config);
    });

    test('should throw error on save failure', () => {
      mockTranslationService.saveConfig.mockImplementation(() => {
        throw new Error('Save failed');
      });

      expect(() => {
        adapter.saveConfig('test-account', {});
      }).toThrow(TranslationError);
    });
  });

  describe('getStats', () => {
    test('should get stats when service available', () => {
      mockTranslationService.initialized = true;

      const stats = adapter.getStats();

      expect(mockTranslationService.getStats).toHaveBeenCalled();
      expect(stats).toHaveProperty('translation');
      expect(stats).toHaveProperty('today');
      expect(stats).toHaveProperty('total');
    });

    test('should return empty stats when service not available', () => {
      mockTranslationService.initialized = false;

      const stats = adapter.getStats();

      expect(stats).toEqual({
        translation: {},
        today: {},
        total: {}
      });
    });
  });

  describe('cleanup', () => {
    test('should cleanup resources', () => {
      adapter.initialized = true;

      adapter.cleanup();

      expect(adapter.initialized).toBe(false);
    });
  });
});
