/**
 * ErrorHandler
 * 
 * Centralized error handling for the quick reply system.
 */

const ValidationError = require('./ValidationError');
const StorageError = require('./StorageError');
const TranslationError = require('./TranslationError');
const SendError = require('./SendError');
const ImportError = require('./ImportError');

class ErrorHandler {
  /**
   * Handle validation error
   * @param {ValidationError} error - Validation error
   * @param {Object} ui - UI instance for displaying messages
   */
  handleValidationError(error, ui) {
    if (ui && ui.showErrorMessage) {
      ui.showErrorMessage(error.message);
    }
    
    if (ui && ui.highlightErrorField && error.field) {
      ui.highlightErrorField(error.field);
    }
    
    this.logError(error);
  }

  /**
   * Handle storage error
   * @param {StorageError} error - Storage error
   * @param {Object} ui - UI instance for displaying messages
   */
  handleStorageError(error, ui) {
    if (ui && ui.showErrorMessage) {
      ui.showErrorMessage('数据保存失败，请重试');
    }
    
    if (ui && ui.showRetryButton) {
      ui.showRetryButton();
    }
    
    this.logError(error);
  }

  /**
   * Handle translation error
   * @param {TranslationError} error - Translation error
   * @param {Object} ui - UI instance for displaying messages
   */
  handleTranslationError(error, ui) {
    if (ui && ui.showErrorMessage) {
      ui.showErrorMessage('翻译失败，是否以原文发送？');
    }
    
    if (ui && ui.showAlternativeOptions) {
      ui.showAlternativeOptions(['以原文发送', '重试翻译']);
    }
    
    this.logError(error);
  }

  /**
   * Handle send error
   * @param {SendError} error - Send error
   * @param {Object} ui - UI instance for displaying messages
   */
  handleSendError(error, ui) {
    if (ui && ui.showErrorMessage) {
      ui.showErrorMessage('消息发送失败');
    }
    
    if (ui && ui.showRetryButton) {
      ui.showRetryButton();
    }
    
    if (ui && ui.preserveMessageContent) {
      ui.preserveMessageContent();
    }
    
    this.logError(error);
  }

  /**
   * Handle import error
   * @param {ImportError} error - Import error
   * @param {Object} ui - UI instance for displaying messages
   */
  handleImportError(error, ui) {
    if (ui && ui.showErrorMessage) {
      ui.showErrorMessage(`导入失败：${error.message}`);
    }
    
    if (ui && ui.showFormatHint) {
      ui.showFormatHint();
    }
    
    this.logError(error);
  }

  /**
   * Log error to console or logging system
   * @param {Error} error - Error to log
   */
  logError(error) {
    console.error(`[QuickReply Error] ${error.name}: ${error.message}`);
    if (error.stack) {
      console.error(error.stack);
    }
    if (error.cause) {
      console.error('Caused by:', error.cause);
    }
  }
}

module.exports = ErrorHandler;
