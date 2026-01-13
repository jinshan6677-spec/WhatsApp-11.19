/**
 * TranslationError
 * 
 * Thrown when translation operations fail.
 */

class TranslationError extends Error {
  /**
   * @param {string} message - Error message
   * @param {Error} cause - Original error that caused this error
   */
  constructor(message, cause = null) {
    super(message);
    this.name = 'TranslationError';
    this.cause = cause;
    
    // Maintains proper stack trace for where our error was thrown
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, TranslationError);
    }
  }
}

module.exports = TranslationError;
