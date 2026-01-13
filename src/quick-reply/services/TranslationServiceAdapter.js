/**
 * TranslationServiceAdapter
 * 
 * Adapter that wraps the main translation service to provide a consistent
 * interface for the quick reply module.
 * 
 * This adapter:
 * - Ensures the translation service is initialized
 * - Provides account-specific translation configuration
 * - Handles translation errors gracefully
 * - Integrates with TranslationIntegration for account-specific settings
 */

const { Logger } = require('../utils/logger');
const TranslationError = require('../errors/TranslationError');

class TranslationServiceAdapter {
  /**
   * @param {Object} translationService - Main translation service instance
   */
  constructor(translationService) {
    this.translationService = translationService;
    this.logger = new Logger('TranslationServiceAdapter');
    this.initialized = false;
  }

  /**
   * Initialize the adapter
   * Ensures the underlying translation service is ready
   */
  async initialize() {
    try {
      if (this.initialized) {
        this.logger.debug('Adapter already initialized');
        return;
      }

      // Ensure translation service is initialized
      if (!this.translationService.initialized) {
        this.logger.info('Initializing translation service...');
        await this.translationService.initialize();
      }

      this.initialized = true;
      this.logger.info('Translation service adapter initialized');
    } catch (error) {
      this.logger.error('Failed to initialize translation service adapter', error);
      throw new TranslationError(`Failed to initialize translation adapter: ${error.message}`, error);
    }
  }

  /**
   * Check if translation service is available
   * @returns {boolean}
   */
  isAvailable() {
    return this.translationService && this.translationService.initialized;
  }

  /**
   * Get translation configuration for account
   * @param {string} accountId - Account ID
   * @returns {Object} Translation configuration
   */
  getConfig(accountId) {
    try {
      return this.translationService.getConfig(accountId);
    } catch (error) {
      this.logger.warn('Failed to get config for account', { accountId, error: error.message });
      return this.getDefaultConfig();
    }
  }

  /**
   * Get default translation configuration
   * @returns {Object} Default configuration
   */
  getDefaultConfig() {
    return {
      inputBox: {
        enabled: true,
        engine: 'google',
        style: '通用',
        targetLang: 'auto'
      }
    };
  }

  /**
   * Translate text
   * @param {string} text - Text to translate
   * @param {string} sourceLang - Source language (default: 'auto')
   * @param {string} targetLang - Target language
   * @param {string} engineName - Translation engine name
   * @param {Object} options - Translation options
   * @returns {Promise<string>} Translated text
   */
  async translate(text, sourceLang = 'auto', targetLang, engineName, options = {}) {
    try {
      // Ensure initialized
      if (!this.initialized) {
        await this.initialize();
      }

      if (!this.isAvailable()) {
        throw new TranslationError('Translation service not available');
      }

      this.logger.debug('Translating text', {
        textLength: text.length,
        sourceLang,
        targetLang,
        engine: engineName
      });

      // Call translation service
      const result = await this.translationService.translate(
        text,
        sourceLang,
        targetLang,
        engineName,
        options
      );

      // Extract translated text from result
      let translatedText;
      if (typeof result === 'string') {
        translatedText = result;
      } else if (result && result.translatedText) {
        translatedText = result.translatedText;
      } else if (result && result.text) {
        translatedText = result.text;
      } else {
        throw new TranslationError('Translation service returned invalid result');
      }

      if (!translatedText || typeof translatedText !== 'string') {
        throw new TranslationError('Translation service returned empty result');
      }

      this.logger.debug('Translation successful', {
        originalLength: text.length,
        translatedLength: translatedText.length
      });

      return translatedText;
    } catch (error) {
      this.logger.error('Translation failed', error);
      
      if (error instanceof TranslationError) {
        throw error;
      }
      
      throw new TranslationError(`Translation failed: ${error.message}`, error);
    }
  }

  /**
   * Detect language of text
   * @param {string} text - Text to detect
   * @returns {Promise<string>} Language code
   */
  async detectLanguage(text) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      if (!this.isAvailable()) {
        throw new TranslationError('Translation service not available');
      }

      return await this.translationService.detectLanguage(text);
    } catch (error) {
      this.logger.error('Language detection failed', error);
      throw new TranslationError(`Language detection failed: ${error.message}`, error);
    }
  }

  /**
   * Save translation configuration for account
   * @param {string} accountId - Account ID
   * @param {Object} config - Configuration object
   */
  saveConfig(accountId, config) {
    try {
      this.translationService.saveConfig(accountId, config);
      this.logger.info('Saved translation config', { accountId });
    } catch (error) {
      this.logger.error('Failed to save config', { accountId, error: error.message });
      throw new TranslationError(`Failed to save config: ${error.message}`, error);
    }
  }

  /**
   * Get translation statistics
   * @returns {Object} Statistics
   */
  getStats() {
    try {
      if (!this.isAvailable()) {
        return {
          translation: {},
          today: {},
          total: {}
        };
      }

      return this.translationService.getStats();
    } catch (error) {
      this.logger.error('Failed to get stats', error);
      return {
        translation: {},
        today: {},
        total: {}
      };
    }
  }

  /**
   * Get config manager
   * @returns {Object} Config manager
   */
  get configManager() {
    return this.translationService.configManager;
  }

  /**
   * Cleanup resources
   */
  cleanup() {
    this.logger.info('Cleaning up translation service adapter');
    this.initialized = false;
  }
}

module.exports = TranslationServiceAdapter;
