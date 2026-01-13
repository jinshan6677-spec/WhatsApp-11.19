/**
 * ValidationError
 * 
 * Thrown when validation fails.
 */

class ValidationError extends Error {
  /**
   * @param {string} message - Error message
   * @param {string} field - Field that failed validation
   */
  constructor(message, field = null) {
    super(message);
    this.name = 'ValidationError';
    this.field = field;
    
    // Maintains proper stack trace for where our error was thrown
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ValidationError);
    }
  }
}

module.exports = ValidationError;
