/**
 * Translation Integration Tests
 * 
 * Tests for translation service integration with quick reply
 * Requirements: 8.1-8.9
 */

const TranslationIntegration = require('../services/TranslationIntegration');
const TranslationError = require('../errors/TranslationError');

describe('TranslationIntegration', () => {
  let mockTranslationService;
  let mockConfigManager;
  let translationIntegration;
  const testAccountId = 'test-account-123';

  beforeEach(() => {
    // Mock ConfigManager
    mockConfigManager = {
      getEngineConfig: jest.fn().mockReturnValue({
        enabled: true,
        apiKey: 'test-key'
      })
    };

    // Mock TranslationService
    mockTranslationService = {
      initialized: true,
      configManager: mockConfigManager,
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

    translationIntegration = new TranslationIntegration(mockTranslationService, testAccountId);
  });

  describe('Initialization', () => {
    test('should initialize successfully', async () => {
      await translationIntegration.initialize();
      
      expect(mockTranslationService.getConfig).toHaveBeenCalledWith(testAccountId);
      expect(translationIntegration.config).toBeDefined();
    });

    test('should initialize translation service if not initialized', async () => {
      mockTranslationService.initialized = false;
      
      await translationIntegration.initialize();
      
      expect(mockTranslationService.initialize).toHaveBeenCalled();
    });

    test('should use default config if loading fails', async () => {
      mockTranslationService.getConfig.mockImplementation(() => {
        throw new Error('Config load failed');
      });
      
      await translationIntegration.initialize();
      
      expect(translationIntegration.config).toEqual(translationIntegration.getDefaultConfig());
    });
  });

  describe('Configuration', () => {
    beforeEach(async () => {
      await translationIntegration.initialize();
    });

    test('should check if translation is available', () => {
      expect(translationIntegration.isAvailable()).toBe(true);
      
      mockTranslationService.initialized = false;
      expect(translationIntegration.isAvailable()).toBe(false);
    });

    test('should check if translation is configured', () => {
      expect(translationIntegration.isConfigured()).toBe(true);
    });

    test('should return false for configured if no config', () => {
      translationIntegration.config = null;
      expect(translationIntegration.isConfigured()).toBe(false);
    });

    test('should return true for Google engine (always available)', () => {
      translationIntegration.config.inputBox.engine = 'google';
      expect(translationIntegration.isConfigured()).toBe(true);
    });

    test('should check API key for non-Google engines', () => {
      translationIntegration.config.inputBox.engine = 'gpt4';
      mockConfigManager.getEngineConfig.mockReturnValue({
        enabled: true,
        apiKey: 'test-key'
      });
      
      expect(translationIntegration.isConfigured()).toBe(true);
    });

    test('should return false if engine not enabled', () => {
      translationIntegration.config.inputBox.engine = 'gpt4';
      mockConfigManager.getEngineConfig.mockReturnValue({
        enabled: false,
        apiKey: 'test-key'
      });
      
      expect(translationIntegration.isConfigured()).toBe(false);
    });

    test('should get configured engine', () => {
      expect(translationIntegration.getConfiguredEngine()).toBe('google');
    });

    test('should get configured style', () => {
      expect(translationIntegration.getConfiguredStyle()).toBe('通用');
    });

    test('should get configured target language', () => {
      expect(translationIntegration.getConfiguredTargetLanguage()).toBe('en');
    });
  });

  describe('Translation', () => {
    beforeEach(async () => {
      await translationIntegration.initialize();
    });

    test('should translate text successfully', async () => {
      const text = 'Hello world';
      const result = await translationIntegration.translate(text);
      
      expect(result).toBe('Translated text');
      expect(mockTranslationService.translate).toHaveBeenCalledWith(
        text,
        'auto',
        'en',
        'google',
        { style: '通用' }
      );
    });

    test('should use custom options if provided', async () => {
      const text = 'Hello world';
      const options = {
        targetLanguage: 'zh-CN',
        style: '正式',
        engine: 'gpt4'
      };
      
      await translationIntegration.translate(text, options);
      
      expect(mockTranslationService.translate).toHaveBeenCalledWith(
        text,
        'auto',
        'zh-CN',
        'gpt4',
        { style: '正式' }
      );
    });

    test('should throw error for empty text', async () => {
      await expect(translationIntegration.translate('')).rejects.toThrow(TranslationError);
      await expect(translationIntegration.translate('   ')).rejects.toThrow(TranslationError);
    });

    test('should throw error if service not available', async () => {
      mockTranslationService.initialized = false;
      
      await expect(translationIntegration.translate('test')).rejects.toThrow(
        'Translation service is not available'
      );
    });

    test('should throw error if not configured', async () => {
      translationIntegration.config = null;
      
      await expect(translationIntegration.translate('test')).rejects.toThrow(
        'Translation is not configured'
      );
    });

    test('should handle translation service returning object with translatedText', async () => {
      mockTranslationService.translate.mockResolvedValue({
        translatedText: 'Translated result'
      });
      
      const result = await translationIntegration.translate('test');
      expect(result).toBe('Translated result');
    });

    test('should handle translation service returning object with text', async () => {
      mockTranslationService.translate.mockResolvedValue({
        text: 'Translated result'
      });
      
      const result = await translationIntegration.translate('test');
      expect(result).toBe('Translated result');
    });

    test('should throw error for invalid translation result', async () => {
      mockTranslationService.translate.mockResolvedValue(null);
      
      await expect(translationIntegration.translate('test')).rejects.toThrow(
        'Translation service returned empty or invalid result'
      );
    });

    test('should throw error for non-string translation result', async () => {
      mockTranslationService.translate.mockResolvedValue({ invalid: 'result' });
      
      await expect(translationIntegration.translate('test')).rejects.toThrow(
        'Translation service returned empty or invalid result'
      );
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      await translationIntegration.initialize();
    });

    test('should handle "not available" error', () => {
      const error = new Error('Translation service not available');
      const result = translationIntegration.handleTranslationError(error);
      
      expect(result.message).toBe('翻译服务不可用');
      expect(result.canRetry).toBe(true);
      expect(result.canSendOriginal).toBe(true);
      expect(result.suggestions).toContain('请检查网络连接');
    });

    test('should handle "not configured" error', () => {
      const error = new Error('Translation not configured');
      const result = translationIntegration.handleTranslationError(error);
      
      expect(result.message).toBe('翻译服务未配置');
      expect(result.canRetry).toBe(false);
      expect(result.suggestions).toContain('请在设置中配置翻译引擎');
    });

    test('should handle API key error', () => {
      const error = new Error('Invalid API key');
      const result = translationIntegration.handleTranslationError(error);
      
      expect(result.message).toBe('翻译引擎API密钥无效');
      expect(result.canRetry).toBe(false);
      expect(result.suggestions).toContain('请检查翻译设置中的API密钥');
    });

    test('should handle network error', () => {
      const error = new Error('Network timeout');
      const result = translationIntegration.handleTranslationError(error);
      
      expect(result.message).toBe('网络连接失败');
      expect(result.canRetry).toBe(true);
      expect(result.suggestions).toContain('请检查网络连接后重试');
    });

    test('should handle rate limit error', () => {
      const error = new Error('Rate limit exceeded');
      const result = translationIntegration.handleTranslationError(error);
      
      expect(result.message).toBe('翻译请求过于频繁');
      expect(result.canRetry).toBe(true);
      expect(result.suggestions).toContain('请稍后再试');
    });

    test('should handle generic error', () => {
      const error = new Error('Unknown error');
      const result = translationIntegration.handleTranslationError(error);
      
      expect(result.message).toContain('翻译失败');
      expect(result.canRetry).toBe(true);
      expect(result.canSendOriginal).toBe(true);
    });
  });

  describe('Account Management', () => {
    beforeEach(async () => {
      await translationIntegration.initialize();
    });

    test('should reload configuration', async () => {
      mockTranslationService.getConfig.mockReturnValue({
        inputBox: {
          enabled: true,
          engine: 'gpt4',
          style: '正式',
          targetLang: 'zh-CN'
        }
      });
      
      await translationIntegration.reloadConfig();
      
      expect(translationIntegration.getConfiguredEngine()).toBe('gpt4');
      expect(translationIntegration.getConfiguredStyle()).toBe('正式');
    });

    test('should switch account', async () => {
      const newAccountId = 'new-account-456';
      mockTranslationService.getConfig.mockReturnValue({
        inputBox: {
          enabled: true,
          engine: 'gemini',
          style: '口语',
          targetLang: 'ja'
        }
      });
      
      await translationIntegration.switchAccount(newAccountId);
      
      expect(translationIntegration.accountId).toBe(newAccountId);
      expect(mockTranslationService.getConfig).toHaveBeenCalledWith(newAccountId);
      expect(translationIntegration.getConfiguredEngine()).toBe('gemini');
    });

    test('should get status', () => {
      const status = translationIntegration.getStatus();
      
      expect(status).toEqual({
        available: true,
        configured: true,
        engine: 'google',
        style: '通用',
        targetLanguage: 'en',
        accountId: testAccountId
      });
    });
  });

  describe('Cleanup', () => {
    test('should cleanup resources', () => {
      translationIntegration.cleanup();
      
      expect(translationIntegration.config).toBeNull();
      expect(translationIntegration.translationService).toBeNull();
    });
  });
});
