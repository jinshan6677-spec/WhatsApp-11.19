/**
 * SendError
 * 
 * Thrown when message sending fails.
 */

class SendError extends Error {
  /**
   * @param {string} message - Error message
   * @param {Error} cause - Original error that caused this error
   */
  constructor(message, cause = null) {
    super(message);
    this.name = 'SendError';
    this.cause = cause;
    
    // Maintains proper stack trace for where our error was thrown
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, SendError);
    }
  }
}

module.exports = SendError;
