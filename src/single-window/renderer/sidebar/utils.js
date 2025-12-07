/**
 * Utility Functions Module for Sidebar
 * Contains helper functions for account display, clipboard operations, etc.
 * 
 * @module sidebar/utils
 */

'use strict';

// ============================================================================
// Constants
// ============================================================================

/**
 * Gradient colors for account avatars
 * @type {string[]}
 */
const AVATAR_COLORS = [
  'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
  'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
  'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
  'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
  'linear-gradient(135deg, #30cfd0 0%, #330867 100%)',
  'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)',
  'linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)',
  'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)',
  'linear-gradient(135deg, #ff6e7f 0%, #bfe9ff 100%)'
];

/**
 * Status text mapping
 * @type {Object<string, string>}
 */
const STATUS_TEXT_MAP = {
  online: '在线',
  offline: '离线',
  error: '错误',
  loading: '加载中...'
};

// ============================================================================
// Account Display Functions
// ============================================================================

/**
 * Get the first letter of account name for avatar display
 * @param {string} name - Account name
 * @returns {string} First character uppercase or '?'
 */
function getAccountInitial(name) {
  if (!name) return '?';
  return String(name).charAt(0).toUpperCase();
}

/**
 * Generate a consistent color for an account based on its ID
 * Uses a hash function to ensure the same ID always gets the same color
 * @param {string} accountId - Account ID
 * @returns {string} CSS gradient string
 */
function getAccountColor(accountId) {
  if (!accountId) {
    return AVATAR_COLORS[0];
  }

  let hash = 0;
  for (let i = 0; i < accountId.length; i++) {
    hash = accountId.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % AVATAR_COLORS.length;
  return AVATAR_COLORS[index];
}

/**
 * Get human-readable status text
 * @param {string} status - Status key
 * @returns {string} Localized status text
 */
function getStatusText(status) {
  // Use hasOwnProperty to avoid prototype chain issues
  if (status && Object.prototype.hasOwnProperty.call(STATUS_TEXT_MAP, status)) {
    return STATUS_TEXT_MAP[status];
  }
  return '未知';
}

// ============================================================================
// Clipboard Functions
// ============================================================================

/**
 * Copy text to clipboard with visual feedback
 * @param {string} text - Text to copy
 * @param {HTMLElement} [element] - Optional element to show feedback on
 */
function copyToClipboard(text, element) {
  if (!text) return;
  
  navigator.clipboard.writeText(text).then(() => {
    console.log('Copied to clipboard');
    if (element) {
      const originalColor = element.style.color;
      element.style.color = '#25d366'; // Success color

      // Show simplified feedback
      const originalText = element.textContent;
      element.textContent = '已复制';

      setTimeout(() => {
        element.style.color = originalColor;
        element.textContent = originalText;
      }, 1000);
    }
  }).catch(err => {
    console.error('Failed to copy to clipboard:', err);
  });
}

// ============================================================================
// Internationalization Functions
// ============================================================================

/**
 * Get flag emoji from country code
 * @param {string} countryCode - Two-letter country code (e.g., 'US', 'CN')
 * @returns {string} Flag emoji or empty string
 */
function getFlagEmoji(countryCode) {
  if (!countryCode) return '';
  const codePoints = countryCode
    .toUpperCase()
    .split('')
    .map(char => 127397 + char.charCodeAt());
  return String.fromCodePoint(...codePoints);
}

// ============================================================================
// Error Handling Functions
// ============================================================================

/**
 * Show error message to user
 * Uses alert for now to maintain current user experience
 * @param {string} message - Error message to display
 */
function showError(message) {
  console.error(message);
  alert(message);
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Create a debounced version of a function
 * @param {Function} fn - Function to debounce
 * @param {number} delay - Delay in milliseconds
 * @returns {Function} Debounced function
 */
function debounce(fn, delay) {
  let timeoutId = null;
  
  return function debounced(...args) {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    
    timeoutId = setTimeout(() => {
      timeoutId = null;
      fn.apply(this, args);
    }, delay);
  };
}

/**
 * Create a throttled version of a function
 * @param {Function} fn - Function to throttle
 * @param {number} limit - Minimum time between calls in milliseconds
 * @returns {Function} Throttled function
 */
function throttle(fn, limit) {
  let lastCall = 0;
  let timeoutId = null;
  
  return function throttled(...args) {
    const now = Date.now();
    const remaining = limit - (now - lastCall);
    
    if (remaining <= 0) {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      lastCall = now;
      fn.apply(this, args);
    } else if (!timeoutId) {
      timeoutId = setTimeout(() => {
        lastCall = Date.now();
        timeoutId = null;
        fn.apply(this, args);
      }, remaining);
    }
  };
}

// ============================================================================
// Exports
// ============================================================================

const utilsExports = {
  // Constants
  AVATAR_COLORS,
  STATUS_TEXT_MAP,
  // Account display
  getAccountInitial,
  getAccountColor,
  getStatusText,
  // Clipboard
  copyToClipboard,
  // Internationalization
  getFlagEmoji,
  // Error handling
  showError,
  // Utilities
  debounce,
  throttle
};

// Export for CommonJS (Node.js/testing)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = utilsExports;
}

// Export for browser global (IIFE pattern)
if (typeof window !== 'undefined') {
  window.SidebarUtils = utilsExports;
}
