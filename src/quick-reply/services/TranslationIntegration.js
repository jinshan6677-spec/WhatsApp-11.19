/**
 * TranslationIntegration
 * 
 * Integrates with the existing translation service to provide translation
 * functionality for quick reply templates.
 * 
 * Requirements: 8.1-8.9
 */

const TranslationError = require('../errors/TranslationError');
const { Logger } = require('../utils/logger');

class TranslationIntegration {
  /**
   * @param {Object} translationService - The main translation service instance
   * @param {string} accountId - Current account ID
   */
  constructor(translationService, accountId) {
    this.translationService = translationService;
    this.accountId = accountId;
    this.logger = new Logger('TranslationIntegration');
    this.config = null;
  }

  /**
   * Initialize translation integration
   * Loads translation configuration for the current account
   */
  async initialize() {
    try {
      this.logger.info('Initializing translation integration', { accountId: this.accountId });
      
      // Ensure translation service is initialized
      if (!this.translationService.initialized) {
        this.logger.debug('Translation service not initialized, initializing...');
        await this.translationService.initialize();
      }
      
      // Load account configuration
      await this.loadConfig();
      
      this.logger.info('Translation integration initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize translation integration', error);
      throw new TranslationError(`Failed to initialize translation integration: ${error.message}`, error);
    }
  }

  /**
   * Load translation configuration for current account
   */
  async loadConfig() {
    try {
      this.config = this.translationService.getConfig(this.accountId);
      this.logger.debug('Loaded translation config', { 
        hasConfig: !!this.config,
        inputBoxEngine: this.config?.inputBox?.engine,
        inputBoxEnabled: this.config?.inputBox?.enabled
      });
    } catch (error) {
      this.logger.error('Failed to load translation config', error);
      // Use default config if loading fails
      this.config = this.getDefaultConfig();
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
   * Check if translation is available
   * @returns {boolean} True if translation service is available
   */
  isAvailable() {
    return this.translationService && this.translationService.initialized;
  }

  /**
   * Check if translation is configured for the current account
   * @returns {boolean} True if translation is configured
   */
  isConfigured() {
    if (!this.config || !this.config.inputBox) {
      return false;
    }
    
    const engine = this.config.inputBox.engine;
    
    // Google translate is always available
    if (engine === 'google') {
      return true;
    }
    
    // For other engines, check if they have API keys configured
    try {
      const engineConfig = this.translationService.configManager.getEngineConfig(engine);
      return !!(engineConfig && engineConfig.enabled && engineConfig.apiKey);
    } catch (error) {
      this.logger.warn('Failed to check engine configuration', { engine, error: error.message });
      return false;
    }
  }

  /**
   * Get the configured translation engine for input box
   * @returns {string} Engine name (e.g., 'google', 'gpt4', 'gemini')
   */
  getConfiguredEngine() {
    if (!this.config || !this.config.inputBox) {
      return 'google'; // Default to Google
    }
    return this.config.inputBox.engine || 'google';
  }

  /**
   * Get the configured translation style
   * @returns {string} Translation style (e.g., '通用', '正式', '口语')
   */
  getConfiguredStyle() {
    if (!this.config || !this.config.inputBox) {
      return '通用'; // Default style
    }
    return this.config.inputBox.style || '通用';
  }

  /**
   * Get the configured target language
   * @returns {string} Target language code (e.g., 'en', 'zh-CN', 'auto')
   */
  getConfiguredTargetLanguage() {
    if (!this.config || !this.config.inputBox) {
      return 'auto'; // Auto-detect
    }
    return this.config.inputBox.targetLang || 'auto';
  }

  /**
   * Translate text using the configured engine and settings
   * @param {string} text - Text to translate
   * @param {Object} options - Translation options
   * @param {string} options.targetLanguage - Override target language
   * @param {string} options.style - Override translation style
   * @param {string} options.engine - Override translation engine
   * @returns {Promise<string>} Translated text
   */
  async translate(text, options = {}) {
    try {
      // Validate input
      if (!text || typeof text !== 'string' || text.trim().length === 0) {
        throw new TranslationError('Text to translate is required');
      }

      // Check if translation service is available
      if (!this.isAvailable()) {
        throw new TranslationError('Translation service is not available');
      }

      // Check if translation is configured
      if (!this.isConfigured()) {
        throw new TranslationError('Translation is not configured for this account');
      }

      // Get translation parameters
      const engine = options.engine || this.getConfiguredEngine();
      const targetLanguage = options.targetLanguage || this.getConfiguredTargetLanguage();
      const style = options.style || this.getConfiguredStyle();

      this.logger.debug('Translating text', { 
        textLength: text.length,
        engine,
        targetLanguage,
        style
      });

      // Call translation service
      // The translation service expects: translate(text, sourceLang, targetLang, engineName, options)
      const result = await this.translationService.translate(
        text,
        'auto', // Auto-detect source language
        targetLanguage,
        engine,
        { style }
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
        throw new TranslationError('Translation service returned empty or invalid result');
      }

      if (!translatedText || typeof translatedText !== 'string') {
        throw new TranslationError('Translation service returned empty or invalid result');
      }

      this.logger.debug('Translation successful', { 
        originalLength: text.length,
        translatedLength: translatedText.length
      });

      return translatedText;
    } catch (error) {
      this.logger.error('Translation failed', error);
      
      // Re-throw TranslationError as-is
      if (error instanceof TranslationError) {
        throw error;
      }
      
      // Wrap other errors
      throw new TranslationError(`Translation failed: ${error.message}`, error);
    }
  }

  /**
   * Handle translation errors with fallback options
   * @param {Error} error - The translation error
   * @returns {Object} Error handling result with options
   */
  handleTranslationError(error) {
    this.logger.error('Handling translation error', error);

    const errorInfo = {
      error: error,
      message: error.message,
      canRetry: false,
      canSendOriginal: true,
      suggestions: []
    };

    // Analyze error type and provide appropriate options
    const errorMessage = error.message.toLowerCase();
    
    if (errorMessage.includes('not available')) {
      errorInfo.message = '翻译服务不可用';
      errorInfo.suggestions.push('请检查网络连接');
      errorInfo.canRetry = true;
    } else if (errorMessage.includes('not configured')) {
      errorInfo.message = '翻译服务未配置';
      errorInfo.suggestions.push('请在设置中配置翻译引擎');
      errorInfo.canRetry = false;
    } else if (errorMessage.includes('api key')) {
      errorInfo.message = '翻译引擎API密钥无效';
      errorInfo.suggestions.push('请检查翻译设置中的API密钥');
      errorInfo.canRetry = false;
    } else if (errorMessage.includes('network') || errorMessage.includes('timeout')) {
      errorInfo.message = '网络连接失败';
      errorInfo.suggestions.push('请检查网络连接后重试');
      errorInfo.canRetry = true;
    } else if (errorMessage.includes('rate limit')) {
      errorInfo.message = '翻译请求过于频繁';
      errorInfo.suggestions.push('请稍后再试');
      errorInfo.canRetry = true;
    } else {
      errorInfo.message = `翻译失败: ${error.message}`;
      errorInfo.canRetry = true;
    }

    return errorInfo;
  }

  /**
   * Reload configuration (useful when settings change)
   */
  async reloadConfig() {
    this.logger.info('Reloading translation configuration');
    await this.loadConfig();
  }

  /**
   * Update account ID and reload configuration
   * @param {string} newAccountId - New account ID
   */
  async switchAccount(newAccountId) {
    this.logger.info('Switching account', { from: this.accountId, to: newAccountId });
    this.accountId = newAccountId;
    await this.loadConfig();
  }

  /**
   * Get translation service status
   * @returns {Object} Status information
   */
  getStatus() {
    return {
      available: this.isAvailable(),
      configured: this.isConfigured(),
      engine: this.getConfiguredEngine(),
      style: this.getConfiguredStyle(),
      targetLanguage: this.getConfiguredTargetLanguage(),
      accountId: this.accountId
    };
  }

  /**
   * Cleanup resources
   */
  cleanup() {
    this.logger.info('Cleaning up translation integration');
    this.config = null;
    this.translationService = null;
  }
}

module.exports = TranslationIntegration;
