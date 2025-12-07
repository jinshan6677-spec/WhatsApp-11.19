/**
 * Property-based tests for Sidebar Utils Module
 * 
 * **Feature: sidebar-modular-refactoring, Property 1: API Interface Preservation** (partial)
 * **Validates: Requirements 1.3, 4.2**
 * 
 * Tests that utility functions behave correctly across all valid inputs.
 */

'use strict';

const fc = require('fast-check');
const SidebarUtils = require('../utils');

// ==================== Arbitraries ====================

/**
 * Account ID arbitrary - generates valid UUID-like strings
 */
const accountIdArbitrary = fc.uuid();

/**
 * Account name arbitrary - non-empty strings
 */
const accountNameArbitrary = fc.string({ minLength: 1, maxLength: 100 });

/**
 * Status arbitrary
 */
const statusArbitrary = fc.constantFrom('online', 'offline', 'error', 'loading');

/**
 * Country code arbitrary - two uppercase letters
 */
const countryCodeArbitrary = fc.tuple(
  fc.constantFrom('A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M',
                  'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'),
  fc.constantFrom('A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M',
                  'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z')
).map(([a, b]) => a + b);

/**
 * Delay arbitrary for debounce/throttle tests
 */
const delayArbitrary = fc.integer({ min: 10, max: 500 });

// ==================== Property Tests ====================

describe('Sidebar Utils Module Property Tests', () => {

  /**
   * **Feature: sidebar-modular-refactoring, Property 1: API Interface Preservation**
   * **Validates: Requirements 1.3, 4.2**
   * 
   * getAccountInitial should always return a single uppercase character or '?'.
   */
  describe('Property 1: getAccountInitial Consistency', () => {
    
    test('getAccountInitial returns first character uppercase for non-empty strings', async () => {
      await fc.assert(
        fc.asyncProperty(
          accountNameArbitrary,
          async (name) => {
            const initial = SidebarUtils.getAccountInitial(name);
            
            // Should be a single character
            expect(initial.length).toBe(1);
            
            // Should be the first character uppercase
            expect(initial).toBe(name.charAt(0).toUpperCase());
          }
        ),
        { numRuns: 100 }
      );
    });

    test('getAccountInitial returns "?" for empty/null/undefined', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom('', null, undefined),
          async (value) => {
            const initial = SidebarUtils.getAccountInitial(value);
            expect(initial).toBe('?');
          }
        ),
        { numRuns: 10 }
      );
    });

    test('getAccountInitial is idempotent', async () => {
      await fc.assert(
        fc.asyncProperty(
          accountNameArbitrary,
          async (name) => {
            const initial1 = SidebarUtils.getAccountInitial(name);
            const initial2 = SidebarUtils.getAccountInitial(name);
            
            expect(initial1).toBe(initial2);
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  /**
   * **Feature: sidebar-modular-refactoring, Property 1: API Interface Preservation**
   * **Validates: Requirements 1.3, 4.2**
   * 
   * getAccountColor should return consistent colors for the same ID.
   */
  describe('Property 1: getAccountColor Consistency', () => {
    
    test('getAccountColor returns same color for same ID (deterministic)', async () => {
      await fc.assert(
        fc.asyncProperty(
          accountIdArbitrary,
          async (accountId) => {
            const color1 = SidebarUtils.getAccountColor(accountId);
            const color2 = SidebarUtils.getAccountColor(accountId);
            
            expect(color1).toBe(color2);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('getAccountColor returns valid CSS gradient', async () => {
      await fc.assert(
        fc.asyncProperty(
          accountIdArbitrary,
          async (accountId) => {
            const color = SidebarUtils.getAccountColor(accountId);
            
            // Should be a linear-gradient
            expect(color).toMatch(/^linear-gradient\(/);
            expect(color).toContain('deg');
            expect(color).toContain('%');
          }
        ),
        { numRuns: 100 }
      );
    });

    test('getAccountColor returns first color for null/undefined', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(null, undefined, ''),
          async (value) => {
            const color = SidebarUtils.getAccountColor(value);
            
            // Should return the first color in the array
            expect(color).toBe(SidebarUtils.AVATAR_COLORS[0]);
          }
        ),
        { numRuns: 10 }
      );
    });

    test('getAccountColor distributes across all colors', async () => {
      // Generate many IDs and check that we get variety
      const colors = new Set();
      
      await fc.assert(
        fc.asyncProperty(
          fc.array(accountIdArbitrary, { minLength: 100, maxLength: 100 }),
          async (accountIds) => {
            accountIds.forEach(id => {
              colors.add(SidebarUtils.getAccountColor(id));
            });
            
            // Should use multiple colors (at least 3 out of 10)
            expect(colors.size).toBeGreaterThanOrEqual(3);
          }
        ),
        { numRuns: 1 }
      );
    });
  });

  /**
   * **Feature: sidebar-modular-refactoring, Property 1: API Interface Preservation**
   * **Validates: Requirements 1.3, 4.2**
   * 
   * getStatusText should return localized text for all valid statuses.
   */
  describe('Property 1: getStatusText Consistency', () => {
    
    test('getStatusText returns non-empty string for valid statuses', async () => {
      await fc.assert(
        fc.asyncProperty(
          statusArbitrary,
          async (status) => {
            const text = SidebarUtils.getStatusText(status);
            
            expect(typeof text).toBe('string');
            expect(text.length).toBeGreaterThan(0);
          }
        ),
        { numRuns: 20 }
      );
    });

    test('getStatusText returns "未知" for invalid statuses', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string().filter(s => !['online', 'offline', 'error', 'loading'].includes(s)),
          async (invalidStatus) => {
            const text = SidebarUtils.getStatusText(invalidStatus);
            expect(text).toBe('未知');
          }
        ),
        { numRuns: 50 }
      );
    });

    test('getStatusText is idempotent', async () => {
      await fc.assert(
        fc.asyncProperty(
          statusArbitrary,
          async (status) => {
            const text1 = SidebarUtils.getStatusText(status);
            const text2 = SidebarUtils.getStatusText(status);
            
            expect(text1).toBe(text2);
          }
        ),
        { numRuns: 20 }
      );
    });

    test('getStatusText maps to expected Chinese text', async () => {
      const expectedMappings = {
        'online': '在线',
        'offline': '离线',
        'error': '错误',
        'loading': '加载中...'
      };
      
      await fc.assert(
        fc.asyncProperty(
          statusArbitrary,
          async (status) => {
            const text = SidebarUtils.getStatusText(status);
            expect(text).toBe(expectedMappings[status]);
          }
        ),
        { numRuns: 20 }
      );
    });
  });

  /**
   * **Feature: sidebar-modular-refactoring, Property 1: API Interface Preservation**
   * **Validates: Requirements 1.3, 4.2**
   * 
   * getFlagEmoji should return valid flag emoji for country codes.
   */
  describe('Property 1: getFlagEmoji Consistency', () => {
    
    test('getFlagEmoji returns empty string for null/undefined/empty', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(null, undefined, ''),
          async (value) => {
            const emoji = SidebarUtils.getFlagEmoji(value);
            expect(emoji).toBe('');
          }
        ),
        { numRuns: 10 }
      );
    });

    test('getFlagEmoji returns non-empty string for valid country codes', async () => {
      await fc.assert(
        fc.asyncProperty(
          countryCodeArbitrary,
          async (countryCode) => {
            const emoji = SidebarUtils.getFlagEmoji(countryCode);
            
            expect(typeof emoji).toBe('string');
            expect(emoji.length).toBeGreaterThan(0);
          }
        ),
        { numRuns: 50 }
      );
    });

    test('getFlagEmoji is case-insensitive', async () => {
      await fc.assert(
        fc.asyncProperty(
          countryCodeArbitrary,
          async (countryCode) => {
            const upperEmoji = SidebarUtils.getFlagEmoji(countryCode.toUpperCase());
            const lowerEmoji = SidebarUtils.getFlagEmoji(countryCode.toLowerCase());
            
            expect(upperEmoji).toBe(lowerEmoji);
          }
        ),
        { numRuns: 50 }
      );
    });

    test('getFlagEmoji is idempotent', async () => {
      await fc.assert(
        fc.asyncProperty(
          countryCodeArbitrary,
          async (countryCode) => {
            const emoji1 = SidebarUtils.getFlagEmoji(countryCode);
            const emoji2 = SidebarUtils.getFlagEmoji(countryCode);
            
            expect(emoji1).toBe(emoji2);
          }
        ),
        { numRuns: 50 }
      );
    });

    test('getFlagEmoji produces different emojis for different codes', async () => {
      await fc.assert(
        fc.asyncProperty(
          countryCodeArbitrary,
          countryCodeArbitrary,
          async (code1, code2) => {
            // Skip if same code
            if (code1.toUpperCase() === code2.toUpperCase()) {
              return;
            }
            
            const emoji1 = SidebarUtils.getFlagEmoji(code1);
            const emoji2 = SidebarUtils.getFlagEmoji(code2);
            
            expect(emoji1).not.toBe(emoji2);
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  /**
   * **Feature: sidebar-modular-refactoring, Property 1: API Interface Preservation**
   * **Validates: Requirements 1.3, 4.2**
   * 
   * debounce should delay function execution.
   */
  describe('Property 1: debounce Behavior', () => {
    
    test('debounce returns a function', async () => {
      await fc.assert(
        fc.asyncProperty(
          delayArbitrary,
          async (delay) => {
            const fn = jest.fn();
            const debounced = SidebarUtils.debounce(fn, delay);
            
            expect(typeof debounced).toBe('function');
          }
        ),
        { numRuns: 20 }
      );
    });

    test('debounce delays execution', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 50, max: 100 }),
          async (delay) => {
            const fn = jest.fn();
            const debounced = SidebarUtils.debounce(fn, delay);
            
            debounced();
            
            // Should not be called immediately
            expect(fn).not.toHaveBeenCalled();
            
            // Wait for delay
            await new Promise(resolve => setTimeout(resolve, delay + 20));
            
            // Should be called after delay
            expect(fn).toHaveBeenCalledTimes(1);
          }
        ),
        { numRuns: 5 }
      );
    });

    test('debounce coalesces rapid calls', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 50, max: 100 }),
          fc.integer({ min: 3, max: 10 }),
          async (delay, callCount) => {
            const fn = jest.fn();
            const debounced = SidebarUtils.debounce(fn, delay);
            
            // Make rapid calls
            for (let i = 0; i < callCount; i++) {
              debounced(i);
            }
            
            // Wait for delay
            await new Promise(resolve => setTimeout(resolve, delay + 50));
            
            // Should only be called once with the last argument
            expect(fn).toHaveBeenCalledTimes(1);
            expect(fn).toHaveBeenCalledWith(callCount - 1);
          }
        ),
        { numRuns: 5 }
      );
    });
  });

  /**
   * **Feature: sidebar-modular-refactoring, Property 1: API Interface Preservation**
   * **Validates: Requirements 1.3, 4.2**
   * 
   * throttle should limit function execution rate.
   */
  describe('Property 1: throttle Behavior', () => {
    
    test('throttle returns a function', async () => {
      await fc.assert(
        fc.asyncProperty(
          delayArbitrary,
          async (limit) => {
            const fn = jest.fn();
            const throttled = SidebarUtils.throttle(fn, limit);
            
            expect(typeof throttled).toBe('function');
          }
        ),
        { numRuns: 20 }
      );
    });

    test('throttle executes immediately on first call', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 100, max: 200 }),
          async (limit) => {
            const fn = jest.fn();
            const throttled = SidebarUtils.throttle(fn, limit);
            
            throttled('first');
            
            // Should be called immediately
            expect(fn).toHaveBeenCalledTimes(1);
            expect(fn).toHaveBeenCalledWith('first');
          }
        ),
        { numRuns: 5 }
      );
    });

    test('throttle limits execution rate', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 100, max: 150 }),
          async (limit) => {
            const fn = jest.fn();
            const throttled = SidebarUtils.throttle(fn, limit);
            
            // First call - immediate
            throttled(1);
            expect(fn).toHaveBeenCalledTimes(1);
            
            // Rapid calls within limit - should be throttled
            throttled(2);
            throttled(3);
            expect(fn).toHaveBeenCalledTimes(1);
            
            // Wait for limit to pass
            await new Promise(resolve => setTimeout(resolve, limit + 50));
            
            // Should have executed the trailing call
            expect(fn).toHaveBeenCalledTimes(2);
          }
        ),
        { numRuns: 5 }
      );
    });
  });

  /**
   * **Feature: sidebar-modular-refactoring, Property 1: API Interface Preservation**
   * **Validates: Requirements 1.3, 4.2**
   * 
   * Constants should be properly exported.
   */
  describe('Property 1: Constants Export', () => {
    
    test('AVATAR_COLORS is an array of valid gradients', () => {
      expect(Array.isArray(SidebarUtils.AVATAR_COLORS)).toBe(true);
      expect(SidebarUtils.AVATAR_COLORS.length).toBeGreaterThan(0);
      
      SidebarUtils.AVATAR_COLORS.forEach(color => {
        expect(color).toMatch(/^linear-gradient\(/);
      });
    });

    test('STATUS_TEXT_MAP contains all expected statuses', () => {
      expect(typeof SidebarUtils.STATUS_TEXT_MAP).toBe('object');
      expect(SidebarUtils.STATUS_TEXT_MAP).toHaveProperty('online');
      expect(SidebarUtils.STATUS_TEXT_MAP).toHaveProperty('offline');
      expect(SidebarUtils.STATUS_TEXT_MAP).toHaveProperty('error');
      expect(SidebarUtils.STATUS_TEXT_MAP).toHaveProperty('loading');
    });
  });
});
