/**
 * TranslationServiceIPCHandlers Integration Tests
 * 
 * Tests the migration of translation IPC handlers to IPCRouter architecture.
 * Verifies that all 13 translation IPC channels are properly registered and functional.
 */

'use strict';

const { IPCRouter } = require('../../IPCRouter');
const TranslationServiceIPCHandlers = require('../TranslationServiceIPCHandlers');

describe('TranslationServiceIPCHandlers', () => {
  let router;
  let mockTranslationService;

  beforeEach(() => {
    // Create a fresh IPCRouter instance
    router = new IPCRouter({ logger: () => {} });

    // Create mock translation service
    mockTranslationService = {
      initialized: true,
      translate: jest.fn().mockResolvedValue({ translatedText: 'translated', detectedLanguage: 'en' }),
      detectLanguage: jest.fn().mockResolvedValue('en'),
      getConfig: jest.fn().mockReturnValue({ enabled: true, targetLanguage: 'zh-CN', engine: 'google' }),
      saveConfig: jest.fn(),
      getStats: jest.fn().mockReturnValue({ totalTranslations: 100, cacheHits: 50 }),
      cacheManager: {
        clearByAccount: jest.fn().mockResolvedValue(),
        clear: jest.fn().mockResolvedValue()
      },
      configManager: {
        saveEngineConfig: jest.fn(),
        getEngineConfig: jest.fn().mockReturnValue({ apiKey: 'test-key' })
      },
      registerEngines: jest.fn(),
      clearTranslationHistory: jest.fn().mockResolvedValue(),
      clearAllUserData: jest.fn().mockResolvedValue(),
      clearAllData: jest.fn().mockResolvedValue(),
      getPrivacyReport: jest.fn().mockReturnValue({ dataStored: true, cacheSize: 1024 })
    };

    // Register handlers with router
    TranslationServiceIPCHandlers.registerWithRouter(router, { translationService: mockTranslationService });
  });

  afterEach(() => {
    // Unregister handlers
    TranslationServiceIPCHandlers.unregisterFromRouter(router);
  });

  describe('Handler Registration', () => {
    test('should register all 13 translation IPC channels', () => {
      const channels = router.getChannels();
      const translationChannels = channels.filter(ch => ch.channel.startsWith('translation:'));
      
      expect(translationChannels).toHaveLength(13);
      
      const expectedChannels = [
        'translation:translate',
        'translation:detectLanguage',
        'translation:getConfig',
        'translation:saveConfig',
        'translation:getStats',
        'translation:clearCache',
        'translation:saveEngineConfig',
        'translation:getEngineConfig',
        'translation:clearHistory',
        'translation:clearUserData',
        'translation:clearAllData',
        'translation:getPrivacyReport',
        'translation:getAccountStats'
      ];

      expectedChannels.forEach(channel => {
        expect(router.hasChannel(channel)).toBe(true);
      });
    });

    test('should unregister all channels on cleanup', () => {
      TranslationServiceIPCHandlers.unregisterFromRouter(router);
      
      const channels = router.getChannels();
      const translationChannels = channels.filter(ch => ch.channel.startsWith('translation:'));
      
      expect(translationChannels).toHaveLength(0);
    });
  });

  describe('translation:translate', () => {
    test('should handle translation request with account routing', async () => {
      const request = {
        channel: 'translation:translate',
        payload: {
          accountId: 'test-account',
          text: 'Hello',
          sourceLang: 'en',
          targetLang: 'zh-CN'
        },
        requestId: 'test-req-1'
      };

      const response = await router.handle('translation:translate', request);

      expect(response.success).toBe(true);
      expect(response.data).toBeDefined();
      expect(mockTranslationService.translate).toHaveBeenCalled();
    });

    test('should reject translation request without accountId', async () => {
      const request = {
        channel: 'translation:translate',
        payload: {
          text: 'Hello'
        },
        requestId: 'test-req-2'
      };

      const response = await router.handle('translation:translate', request);

      expect(response.success).toBe(false);
      expect(response.error).toBeDefined();
      expect(response.error.message).toContain('Account ID is required');
    });
  });

  describe('translation:getConfig', () => {
    test('should get account-specific configuration', async () => {
      const request = {
        channel: 'translation:getConfig',
        payload: 'test-account',
        requestId: 'test-req-3'
      };

      const response = await router.handle('translation:getConfig', request);

      expect(response.success).toBe(true);
      expect(response.data).toBeDefined();
      expect(mockTranslationService.getConfig).toHaveBeenCalledWith('test-account');
    });
  });

  describe('translation:saveConfig', () => {
    test('should save account-specific configuration', async () => {
      const config = { enabled: true, targetLanguage: 'es' };
      const request = {
        channel: 'translation:saveConfig',
        payload: {
          accountId: 'test-account',
          config
        },
        requestId: 'test-req-4'
      };

      const response = await router.handle('translation:saveConfig', request);

      expect(response.success).toBe(true);
      expect(mockTranslationService.saveConfig).toHaveBeenCalledWith('test-account', config);
    });
  });

  describe('translation:clearCache', () => {
    test('should clear cache for specific account', async () => {
      const request = {
        channel: 'translation:clearCache',
        payload: 'test-account',
        requestId: 'test-req-5'
      };

      const response = await router.handle('translation:clearCache', request);

      expect(response.success).toBe(true);
      expect(mockTranslationService.cacheManager.clearByAccount).toHaveBeenCalledWith('test-account');
    });

    test('should clear all cache when no accountId provided', async () => {
      const request = {
        channel: 'translation:clearCache',
        payload: null,
        requestId: 'test-req-6'
      };

      const response = await router.handle('translation:clearCache', request);

      expect(response.success).toBe(true);
      expect(mockTranslationService.cacheManager.clear).toHaveBeenCalled();
    });
  });

  describe('translation:getStats', () => {
    test('should get translation statistics', async () => {
      const request = {
        channel: 'translation:getStats',
        payload: {},
        requestId: 'test-req-7'
      };

      const response = await router.handle('translation:getStats', request);

      expect(response.success).toBe(true);
      expect(response.data).toBeDefined();
      expect(response.data.totalTranslations).toBe(100);
    });
  });

  describe('Privacy Handlers', () => {
    test('should clear translation history', async () => {
      const request = {
        channel: 'translation:clearHistory',
        payload: {},
        requestId: 'test-req-8'
      };

      const response = await router.handle('translation:clearHistory', request);

      expect(response.success).toBe(true);
      expect(mockTranslationService.clearTranslationHistory).toHaveBeenCalled();
    });

    test('should clear user data', async () => {
      const request = {
        channel: 'translation:clearUserData',
        payload: {},
        requestId: 'test-req-9'
      };

      const response = await router.handle('translation:clearUserData', request);

      expect(response.success).toBe(true);
      expect(mockTranslationService.clearAllUserData).toHaveBeenCalled();
    });

    test('should get privacy report', async () => {
      const request = {
        channel: 'translation:getPrivacyReport',
        payload: {},
        requestId: 'test-req-10'
      };

      const response = await router.handle('translation:getPrivacyReport', request);

      expect(response.success).toBe(true);
      expect(response.data).toBeDefined();
      expect(response.data.dataStored).toBe(true);
    });
  });

  describe('Engine Configuration', () => {
    test('should save engine configuration', async () => {
      const config = { apiKey: 'new-key' };
      const request = {
        channel: 'translation:saveEngineConfig',
        payload: {
          engineName: 'google',
          config
        },
        requestId: 'test-req-11'
      };

      const response = await router.handle('translation:saveEngineConfig', request);

      expect(response.success).toBe(true);
      expect(mockTranslationService.configManager.saveEngineConfig).toHaveBeenCalledWith('google', config);
      expect(mockTranslationService.registerEngines).toHaveBeenCalled();
    });

    test('should get engine configuration', async () => {
      const request = {
        channel: 'translation:getEngineConfig',
        payload: 'google',
        requestId: 'test-req-12'
      };

      const response = await router.handle('translation:getEngineConfig', request);

      expect(response.success).toBe(true);
      expect(response.data).toBeDefined();
      expect(response.data.apiKey).toBe('test-key');
    });
  });

  describe('Error Handling', () => {
    test('should handle translation service errors gracefully', async () => {
      mockTranslationService.translate.mockRejectedValueOnce(new Error('Translation failed'));

      const request = {
        channel: 'translation:translate',
        payload: {
          accountId: 'test-account',
          text: 'Hello'
        },
        requestId: 'test-req-13'
      };

      const response = await router.handle('translation:translate', request);

      expect(response.success).toBe(false);
      expect(response.error).toBeDefined();
      expect(response.error.message).toContain('Translation failed');
    });
  });
});
