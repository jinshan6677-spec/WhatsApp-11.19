/**
 * SendManager
 * 
 * Manages sending templates with translation integration.
 * 
 * Requirements: 7.1-7.9, 8.1-8.9, 9.1-9.8
 */

const { TEMPLATE_TYPES } = require('../constants');
const SendError = require('../errors/SendError');
const TranslationError = require('../errors/TranslationError');
const ValidationError = require('../errors/ValidationError');
const { Logger } = require('../utils/logger');
const TranslationIntegration = require('../services/TranslationIntegration');

/**
 * Decode HTML entities in text
 * @param {string} text - Text with possible HTML entities
 * @returns {string} Decoded text
 */
function decodeHtmlEntities(text) {
  if (!text || typeof text !== 'string') return text;

  const entities = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#39;': "'",
    '&#x27;': "'",
    '&apos;': "'",
    '&#x2F;': '/',
    '&#47;': '/',
    '&nbsp;': ' '
  };

  let decoded = text;
  for (const [entity, char] of Object.entries(entities)) {
    decoded = decoded.replace(new RegExp(entity, 'g'), char);
  }

  // Also handle numeric entities like &#123;
  decoded = decoded.replace(/&#(\d+);/g, (match, dec) => String.fromCharCode(dec));
  decoded = decoded.replace(/&#x([0-9a-fA-F]+);/g, (match, hex) => String.fromCharCode(parseInt(hex, 16)));

  return decoded;
}

class SendManager {
  /**
   * @param {Object} translationService - Translation service instance
   * @param {Object} whatsappWebInterface - WhatsApp Web interface instance
   * @param {string} accountId - Optional account ID for translation configuration
   */
  constructor(translationService, whatsappWebInterface, accountId = null) {
    this.translationService = translationService;
    this.whatsappWebInterface = whatsappWebInterface;
    this.logger = new Logger('SendManager');
    this.activeSends = new Map(); // Track active send operations

    // Initialize translation integration if account ID is provided
    this.translationIntegration = null;
    if (accountId && translationService) {
      this.translationIntegration = new TranslationIntegration(translationService, accountId);
    }
  }

  /**
   * Cancel an active send operation
   * @param {string} operationId - Operation ID to cancel
   */
  cancelSend(operationId) {
    const operation = this.activeSends.get(operationId);
    if (operation) {
      operation.cancelled = true;
      this.activeSends.delete(operationId);
      this.logger.info('Send operation cancelled', { operationId });
    }
  }

  /**
   * Check if an operation was cancelled
   * @param {string} operationId - Operation ID to check
   * @returns {boolean}
   */
  isCancelled(operationId) {
    const operation = this.activeSends.get(operationId);
    return operation ? operation.cancelled : false;
  }

  /**
   * Register a new send operation
   * @param {string} operationId - Unique operation ID
   * @param {Function} onStatusChange - Status change callback
   * @returns {Object} Operation object
   */
  registerOperation(operationId, onStatusChange) {
    const operation = {
      id: operationId,
      cancelled: false,
      onStatusChange: onStatusChange || (() => { }),
    };
    this.activeSends.set(operationId, operation);
    return operation;
  }

  /**
   * Unregister a send operation
   * @param {string} operationId - Operation ID to unregister
   */
  unregisterOperation(operationId) {
    this.activeSends.delete(operationId);
  }

  /**
   * Update operation status
   * @param {string} operationId - Operation ID
   * @param {string} status - New status
   * @param {Object} data - Additional data
   */
  updateStatus(operationId, status, data = undefined) {
    const operation = this.activeSends.get(operationId);
    if (operation && operation.onStatusChange) {
      operation.onStatusChange(status, data);
    }
  }

  /**
   * Send template with original content
   * @param {Object} template - Template object
   * @param {string} operationId - Optional operation ID for tracking
   * @param {Function} onStatusChange - Optional status change callback
   * @returns {Promise<void>}
   */
  async sendOriginal(template, operationId = null, onStatusChange = null) {
    const opId = operationId || `send_${Date.now()}_${Math.random()}`;

    try {
      if (!template) {
        throw new ValidationError('Template is required', 'template');
      }

      // Register operation
      if (onStatusChange) {
        this.registerOperation(opId, onStatusChange);
      }

      this.logger.info('Sending template (original)', { templateId: template.id, type: template.type });
      this.updateStatus(opId, 'sending');

      // Check for cancellation before starting
      if (this.isCancelled(opId)) {
        this.updateStatus(opId, 'cancelled');
        throw new SendError('Send operation was cancelled');
      }

      // Wrap send operations to check cancellation
      const checkAndExecute = async (fn) => {
        if (this.isCancelled(opId)) {
          this.updateStatus(opId, 'cancelled');
          throw new SendError('Send operation was cancelled');
        }
        return await fn();
      };

      switch (template.type) {
        case TEMPLATE_TYPES.TEXT:
          await checkAndExecute(() => this.sendText(template.content.text));
          break;

        case TEMPLATE_TYPES.IMAGE:
          await checkAndExecute(() => this.sendImage(template.content.mediaPath));
          break;

        case TEMPLATE_TYPES.AUDIO:
          await checkAndExecute(() => this.sendAudio(template.content.mediaPath));
          break;

        case TEMPLATE_TYPES.VIDEO:
          await checkAndExecute(() => this.sendVideo(template.content.mediaPath));
          break;

        case TEMPLATE_TYPES.MIXED:
          await checkAndExecute(() => this.sendImageWithText(template.content.mediaPath, template.content.text));
          break;

        case TEMPLATE_TYPES.CONTACT:
          await checkAndExecute(() => this.sendContact(template.content.contactInfo));
          break;

        default:
          throw new SendError(`Unsupported template type: ${template.type}`);
      }

      // Check for cancellation after send
      if (this.isCancelled(opId)) {
        this.updateStatus(opId, 'cancelled');
        throw new SendError('Send operation was cancelled');
      }

      this.logger.info('Template sent successfully', { templateId: template.id });
      this.updateStatus(opId, 'success');
    } catch (error) {
      this.logger.error('Failed to send template', error);

      // Determine error type
      if (error.message && error.message.includes('network')) {
        this.updateStatus(opId, 'network_error', { error: error.message });
      } else if (error.message && error.message.includes('cancelled')) {
        this.updateStatus(opId, 'cancelled');
      } else {
        this.updateStatus(opId, 'error', { error: error.message });
      }

      if (error instanceof SendError || error instanceof ValidationError) {
        throw error;
      }
      throw new SendError(`Failed to send template: ${error.message}`, error);
    } finally {
      // Unregister operation
      this.unregisterOperation(opId);
    }
  }

  /**
   * Send template with translated content
   * @param {Object} template - Template object
   * @param {string} targetLanguage - Target language code
   * @param {string} style - Translation style
   * @param {string} operationId - Optional operation ID for tracking
   * @param {Function} onStatusChange - Optional status change callback
   * @returns {Promise<void>}
   */
  async sendTranslated(template, targetLanguage, style, operationId = null, onStatusChange = null) {
    const opId = operationId || `send_translated_${Date.now()}_${Math.random()}`;

    try {
      if (!template) {
        throw new ValidationError('Template is required', 'template');
      }

      // Register operation
      if (onStatusChange) {
        this.registerOperation(opId, onStatusChange);
      }

      this.logger.info('Sending template (translated)', {
        templateId: template.id,
        type: template.type,
        targetLanguage
      });

      // Only text and mixed templates can be translated
      if (template.type !== TEMPLATE_TYPES.TEXT && template.type !== TEMPLATE_TYPES.MIXED) {
        // For non-translatable types, send original
        this.logger.debug('Template type not translatable, sending original', { type: template.type });
        return await this.sendOriginal(template, opId, onStatusChange);
      }

      // Check if translation service is available
      if (!this.translationService) {
        throw new TranslationError('Translation service not available');
      }

      // Check for cancellation
      if (this.isCancelled(opId)) {
        this.updateStatus(opId, 'cancelled');
        throw new SendError('Send operation was cancelled');
      }

      try {
        this.updateStatus(opId, 'translating');

        switch (template.type) {
          case TEMPLATE_TYPES.TEXT:
            const translatedText = await this.translateText(template.content.text, targetLanguage, style);

            // Check for cancellation after translation
            if (this.isCancelled(opId)) {
              this.updateStatus(opId, 'cancelled');
              throw new SendError('Send operation was cancelled');
            }

            this.updateStatus(opId, 'translated');
            this.updateStatus(opId, 'sending');
            await this.sendText(translatedText);
            break;

          case TEMPLATE_TYPES.MIXED:
            const translatedMixedText = await this.translateText(template.content.text, targetLanguage, style);

            // Check for cancellation after translation
            if (this.isCancelled(opId)) {
              this.updateStatus(opId, 'cancelled');
              throw new SendError('Send operation was cancelled');
            }

            this.updateStatus(opId, 'translated');
            this.updateStatus(opId, 'sending');
            await this.sendImageWithText(template.content.mediaPath, translatedMixedText);
            break;
        }

        // Check for cancellation after send
        if (this.isCancelled(opId)) {
          this.updateStatus(opId, 'cancelled');
          throw new SendError('Send operation was cancelled');
        }

        this.logger.info('Translated template sent successfully', { templateId: template.id });
        this.updateStatus(opId, 'success');
      } catch (translationError) {
        // If translation fails, ask user if they want to send original
        this.logger.warn('Translation failed, consider sending original', translationError);
        this.updateStatus(opId, 'error', { error: translationError.message });
        throw new TranslationError(
          `Translation failed: ${translationError.message}. Would you like to send the original content?`,
          translationError
        );
      }
    } catch (error) {
      this.logger.error('Failed to send translated template', error);

      // Determine error type
      if (error.message && error.message.includes('network')) {
        this.updateStatus(opId, 'network_error', { error: error.message });
      } else if (error.message && error.message.includes('cancelled')) {
        this.updateStatus(opId, 'cancelled');
      } else {
        this.updateStatus(opId, 'error', { error: error.message });
      }

      if (error instanceof SendError || error instanceof TranslationError || error instanceof ValidationError) {
        throw error;
      }
      throw new SendError(`Failed to send translated template: ${error.message}`, error);
    } finally {
      // Unregister operation
      this.unregisterOperation(opId);
    }
  }

  /**
   * Insert template into input box (original)
   * @param {Object} template - Template object
   * @returns {Promise<void>}
   */
  async insertOriginal(template) {
    try {
      if (!template) {
        throw new ValidationError('Template is required', 'template');
      }

      if (!this.whatsappWebInterface) {
        throw new SendError('WhatsApp Web interface not available');
      }

      this.logger.info('Inserting template (original)', { templateId: template.id, type: template.type });

      switch (template.type) {
        case TEMPLATE_TYPES.TEXT:
          // Decode any HTML entities that may have been accidentally encoded
          await this.whatsappWebInterface.insertText(decodeHtmlEntities(template.content.text));
          break;

        case TEMPLATE_TYPES.IMAGE:
        case TEMPLATE_TYPES.AUDIO:
        case TEMPLATE_TYPES.VIDEO:
          await this.whatsappWebInterface.attachMedia(template.content.mediaPath);
          break;

        case TEMPLATE_TYPES.MIXED:
          // Decode any HTML entities that may have been accidentally encoded
          await this.whatsappWebInterface.insertText(decodeHtmlEntities(template.content.text));
          await this.whatsappWebInterface.attachMedia(template.content.mediaPath);
          break;

        case TEMPLATE_TYPES.CONTACT:
          await this.whatsappWebInterface.attachContact(template.content.contactInfo);
          break;

        default:
          throw new SendError(`Unsupported template type: ${template.type}`);
      }

      // Set focus to end of input
      await this.whatsappWebInterface.focusInput();

      this.logger.info('Template inserted successfully', { templateId: template.id });
    } catch (error) {
      this.logger.error('Failed to insert template', error);
      if (error instanceof SendError || error instanceof ValidationError) {
        throw error;
      }
      throw new SendError(`Failed to insert template: ${error.message}`, error);
    }
  }

  /**
   * Insert template into input box (translated)
   * @param {Object} template - Template object
   * @param {string} targetLanguage - Target language code
   * @param {string} style - Translation style
   * @returns {Promise<void>}
   */
  async insertTranslated(template, targetLanguage, style) {
    try {
      if (!template) {
        throw new ValidationError('Template is required', 'template');
      }

      if (!this.whatsappWebInterface) {
        throw new SendError('WhatsApp Web interface not available');
      }

      this.logger.info('Inserting template (translated)', {
        templateId: template.id,
        type: template.type,
        targetLanguage
      });

      // Only text and mixed templates can be translated
      if (template.type !== TEMPLATE_TYPES.TEXT && template.type !== TEMPLATE_TYPES.MIXED) {
        // For non-translatable types, insert original
        this.logger.debug('Template type not translatable, inserting original', { type: template.type });
        return await this.insertOriginal(template);
      }

      // Check if translation service is available
      if (!this.translationService) {
        throw new TranslationError('Translation service not available');
      }

      try {
        switch (template.type) {
          case TEMPLATE_TYPES.TEXT:
            const translatedText = await this.translateText(template.content.text, targetLanguage, style);
            // Decode HTML entities
            const decodedText = decodeHtmlEntities(translatedText);
            await this.whatsappWebInterface.insertText(decodedText);
            break;

          case TEMPLATE_TYPES.MIXED:
            const translatedMixedText = await this.translateText(template.content.text, targetLanguage, style);
            // Decode HTML entities
            const decodedMixedText = decodeHtmlEntities(translatedMixedText);
            await this.whatsappWebInterface.insertText(decodedMixedText);
            await this.whatsappWebInterface.attachMedia(template.content.mediaPath);
            break;
        }

        // Set focus to end of input
        await this.whatsappWebInterface.focusInput();

        this.logger.info('Translated template inserted successfully', { templateId: template.id });
      } catch (translationError) {
        // If translation fails, ask user if they want to insert original
        this.logger.warn('Translation failed, consider inserting original', translationError);
        throw new TranslationError(
          `Translation failed: ${translationError.message}. Would you like to insert the original content?`,
          translationError
        );
      }
    } catch (error) {
      this.logger.error('Failed to insert translated template', error);
      if (error instanceof SendError || error instanceof TranslationError || error instanceof ValidationError) {
        throw error;
      }
      throw new SendError(`Failed to insert translated template: ${error.message}`, error);
    }
  }

  /**
   * Send text message
   * @param {string} text - Text content
   * @returns {Promise<void>}
   */
  async sendText(text) {
    try {
      if (!text || typeof text !== 'string' || text.trim().length === 0) {
        throw new ValidationError('Text content is required', 'text');
      }

      if (!this.whatsappWebInterface) {
        throw new SendError('WhatsApp Web interface not available');
      }

      // Decode any HTML entities that may have been accidentally encoded
      const decodedText = decodeHtmlEntities(text);

      await this.whatsappWebInterface.sendMessage(decodedText);

      this.logger.debug('Text message sent');
    } catch (error) {
      this.logger.error('Failed to send text message', error);
      if (error instanceof SendError || error instanceof ValidationError) {
        throw error;
      }
      throw new SendError(`Failed to send text message: ${error.message}`, error);
    }
  }

  /**
   * Send image message
   * @param {string} imagePath - Image file path
   * @returns {Promise<void>}
   */
  async sendImage(imagePath) {
    try {
      if (!imagePath || typeof imagePath !== 'string') {
        throw new ValidationError('Image path is required', 'imagePath');
      }

      if (!this.whatsappWebInterface) {
        throw new SendError('WhatsApp Web interface not available');
      }

      await this.whatsappWebInterface.sendImage(imagePath);

      this.logger.debug('Image message sent');
    } catch (error) {
      this.logger.error('Failed to send image message', error);
      if (error instanceof SendError || error instanceof ValidationError) {
        throw error;
      }
      throw new SendError(`Failed to send image message: ${error.message}`, error);
    }
  }

  /**
   * Send audio message
   * @param {string} audioPath - Audio file path
   * @returns {Promise<void>}
   */
  async sendAudio(audioPath) {
    try {
      if (!audioPath || typeof audioPath !== 'string') {
        throw new ValidationError('Audio path is required', 'audioPath');
      }

      if (!this.whatsappWebInterface) {
        throw new SendError('WhatsApp Web interface not available');
      }

      await this.whatsappWebInterface.sendAudio(audioPath);

      this.logger.debug('Audio message sent');
    } catch (error) {
      this.logger.error('Failed to send audio message', error);
      if (error instanceof SendError || error instanceof ValidationError) {
        throw error;
      }
      throw new SendError(`Failed to send audio message: ${error.message}`, error);
    }
  }

  /**
   * Send video message
   * @param {string} videoPath - Video file path
   * @returns {Promise<void>}
   */
  async sendVideo(videoPath) {
    try {
      if (!videoPath || typeof videoPath !== 'string') {
        throw new ValidationError('Video path is required', 'videoPath');
      }

      if (!this.whatsappWebInterface) {
        throw new SendError('WhatsApp Web interface not available');
      }

      await this.whatsappWebInterface.sendVideo(videoPath);

      this.logger.debug('Video message sent');
    } catch (error) {
      this.logger.error('Failed to send video message', error);
      if (error instanceof SendError || error instanceof ValidationError) {
        throw error;
      }
      throw new SendError(`Failed to send video message: ${error.message}`, error);
    }
  }

  /**
   * Send image with text
   * @param {string} imagePath - Image file path
   * @param {string} text - Text content
   * @returns {Promise<void>}
   */
  async sendImageWithText(imagePath, text) {
    try {
      if (!imagePath || typeof imagePath !== 'string') {
        throw new ValidationError('Image path is required', 'imagePath');
      }

      if (!text || typeof text !== 'string' || text.trim().length === 0) {
        throw new ValidationError('Text content is required', 'text');
      }

      if (!this.whatsappWebInterface) {
        throw new SendError('WhatsApp Web interface not available');
      }

      // Send image first, then text
      await this.whatsappWebInterface.sendImage(imagePath);
      // Decode any HTML entities
      const decodedText = decodeHtmlEntities(text);
      await this.whatsappWebInterface.sendMessage(decodedText);

      this.logger.debug('Image with text sent');
    } catch (error) {
      this.logger.error('Failed to send image with text', error);
      if (error instanceof SendError || error instanceof ValidationError) {
        throw error;
      }
      throw new SendError(`Failed to send image with text: ${error.message}`, error);
    }
  }

  /**
   * Send contact card
   * @param {Object} contactInfo - Contact information
   * @returns {Promise<void>}
   */
  async sendContact(contactInfo) {
    try {
      if (!contactInfo || typeof contactInfo !== 'object') {
        throw new ValidationError('Contact info is required', 'contactInfo');
      }

      if (!contactInfo.name || typeof contactInfo.name !== 'string') {
        throw new ValidationError('Contact name is required', 'contactInfo.name');
      }

      if (!contactInfo.phone || typeof contactInfo.phone !== 'string') {
        throw new ValidationError('Contact phone is required', 'contactInfo.phone');
      }

      if (!this.whatsappWebInterface) {
        throw new SendError('WhatsApp Web interface not available');
      }

      await this.whatsappWebInterface.sendContact(contactInfo);

      this.logger.debug('Contact card sent');
    } catch (error) {
      this.logger.error('Failed to send contact card', error);
      if (error instanceof SendError || error instanceof ValidationError) {
        throw error;
      }
      throw new SendError(`Failed to send contact card: ${error.message}`, error);
    }
  }

  /**
   * Initialize translation integration
   * @param {string} accountId - Account ID for translation configuration
   */
  async initializeTranslation(accountId) {
    if (!this.translationService) {
      this.logger.warn('Translation service not available, skipping initialization');
      return;
    }

    try {
      this.translationIntegration = new TranslationIntegration(this.translationService, accountId);
      await this.translationIntegration.initialize();
      this.logger.info('Translation integration initialized', { accountId });
    } catch (error) {
      this.logger.error('Failed to initialize translation integration', error);
      // Don't throw - translation is optional
    }
  }

  /**
   * Check if translation is available and configured
   * @returns {boolean}
   */
  isTranslationAvailable() {
    return this.translationIntegration &&
      this.translationIntegration.isAvailable() &&
      this.translationIntegration.isConfigured();
  }

  /**
   * Get translation configuration status
   * @returns {Object} Status information
   */
  getTranslationStatus() {
    if (!this.translationIntegration) {
      return {
        available: false,
        configured: false,
        error: 'Translation integration not initialized'
      };
    }

    return this.translationIntegration.getStatus();
  }

  /**
   * Translate text using configured translation settings
   * @param {string} text - Text to translate
   * @param {string} targetLanguage - Target language code (optional, uses config if not provided)
   * @param {string} style - Translation style (optional, uses config if not provided)
   * @returns {Promise<string>} Translated text
   */
  async translateText(text, targetLanguage = null, style = null) {
    try {
      if (!text || typeof text !== 'string' || text.trim().length === 0) {
        throw new ValidationError('Text to translate is required', 'text');
      }

      // Check if translation integration is available
      if (!this.translationIntegration) {
        throw new TranslationError('Translation integration not initialized');
      }

      if (!this.translationIntegration.isAvailable()) {
        throw new TranslationError('Translation service not available');
      }

      if (!this.translationIntegration.isConfigured()) {
        throw new TranslationError('Translation not configured for this account. Please configure translation settings.');
      }

      this.logger.debug('Translating text', {
        textLength: text.length,
        targetLanguage: targetLanguage || 'auto',
        style: style || 'default'
      });

      // Use TranslationIntegration to translate
      const options = {};
      if (targetLanguage) options.targetLanguage = targetLanguage;
      if (style) options.style = style;

      const translated = await this.translationIntegration.translate(text, options);

      if (!translated || typeof translated !== 'string') {
        throw new TranslationError('Translation service returned invalid result');
      }

      this.logger.debug('Text translated successfully', {
        originalLength: text.length,
        translatedLength: translated.length
      });

      return translated;
    } catch (error) {
      this.logger.error('Failed to translate text', error);
      if (error instanceof TranslationError || error instanceof ValidationError) {
        throw error;
      }
      throw new TranslationError(`Failed to translate text: ${error.message}`, error);
    }
  }

  /**
   * Handle translation error and provide user-friendly options
   * @param {Error} error - Translation error
   * @returns {Object} Error handling information
   */
  handleTranslationError(error) {
    if (this.translationIntegration) {
      return this.translationIntegration.handleTranslationError(error);
    }

    // Fallback error handling
    return {
      error: error,
      message: error.message || 'Translation failed',
      canRetry: true,
      canSendOriginal: true,
      suggestions: ['Please try again or send original content']
    };
  }

  /**
   * Reload translation configuration
   */
  async reloadTranslationConfig() {
    if (this.translationIntegration) {
      await this.translationIntegration.reloadConfig();
      this.logger.info('Translation configuration reloaded');
    }
  }

  /**
   * Switch account for translation
   * @param {string} newAccountId - New account ID
   */
  async switchAccount(newAccountId) {
    if (this.translationIntegration) {
      await this.translationIntegration.switchAccount(newAccountId);
      this.logger.info('Switched translation account', { accountId: newAccountId });
    } else if (this.translationService) {
      // Initialize translation integration for new account
      await this.initializeTranslation(newAccountId);
    }
  }
}

module.exports = SendManager;
