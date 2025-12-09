/**
 * UUID Helper
 * 
 * Provides CommonJS-compatible UUID generation.
 * Wraps the uuid package to handle ES module compatibility issues.
 */

let uuidModule;

try {
  // Try to load uuid (works in production)
  uuidModule = require('uuid');
} catch (error) {
  // Fallback for testing or if uuid is not available
  uuidModule = {
    v4: () => {
      // Simple UUID v4 generator fallback
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
      });
    }
  };
}

/**
 * Generate a UUID v4
 * @returns {string} UUID string
 */
function generateUUID() {
  if (typeof uuidModule.v4 === 'function') {
    return uuidModule.v4();
  } else if (uuidModule.default && typeof uuidModule.default.v4 === 'function') {
    return uuidModule.default.v4();
  } else {
    // Fallback implementation
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }
}

module.exports = {
  v4: generateUUID,
  generateUUID
};
