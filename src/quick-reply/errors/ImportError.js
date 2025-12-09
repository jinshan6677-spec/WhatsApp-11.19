/**
 * ImportError
 * 
 * Thrown when import operations fail.
 */

class ImportError extends Error {
  /**
   * @param {string} message - Error message
   * @param {Error} cause - Original error that caused this error
   */
  constructor(message, cause = null) {
    super(message);
    this.name = 'ImportError';
    this.cause = cause;
    
    // Maintains proper stack trace for where our error was thrown
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ImportError);
    }
  }
}

module.exports = ImportError;
