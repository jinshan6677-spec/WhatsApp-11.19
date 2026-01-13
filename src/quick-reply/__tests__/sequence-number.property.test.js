/**
 * Property-Based Tests for Sequence Number Continuity
 * 
 * Feature: enhanced-quick-reply-management, Property 2: 序号连续性
 * 
 * Tests the correctness of sequence number assignment functionality.
 * Uses fast-check for property-based testing with 100 iterations per property.
 * 
 * Requirements: 1.1.8
 */

const fc = require('fast-check');
const { assignSequenceNumbers } = require('../utils/search');
const { TEMPLATE_TYPES } = require('../constants/templateTypes');
const { VISIBILITY_TYPES } = require('../constants/visibilityTypes');

// Test configuration
const NUM_RUNS = 100;

/**
 * Generate a valid template
 */
const templateArbitrary = () => fc.record({
  id: fc.uuid(),
  groupId: fc.uuid(),
  type: fc.constantFrom(...Object.values(TEMPLATE_TYPES)),
  visibility: fc.constantFrom(...Object.values(VISIBILITY_TYPES)),
  label: fc.string({ minLength: 1, maxLength: 50 }),
  content: fc.record({
    text: fc.string({ minLength: 1, maxLength: 100 })
  }),
  order: fc.nat({ max: 1000 }),
  createdAt: fc.nat(),
  updatedAt: fc.nat(),
  usageCount: fc.nat({ max: 1000 }),
  lastUsedAt: fc.option(fc.nat())
});

/**
 * Generate an array of templates
 */
const templateListArbitrary = () => fc.array(templateArbitrary(), { minLength: 0, maxLength: 50 });

describe('Sequence Number Property-Based Tests', () => {
  
  /**
   * Feature: enhanced-quick-reply-management, Property 2: 序号连续性
   * **Validates: Requirements 1.1.8**
   * 
   * For any group, the sequence numbers displayed for content items should
   * start from 1 and be continuous (no gaps or duplicates).
   */
  describe('Property 2: Sequence Number Continuity', () => {
    
    /**
     * Sequence numbers start from 1
     * Validates: Requirement 1.1.8
     */
    test('Property 2a: Sequence numbers start from 1', () => {
      fc.assert(
        fc.property(
          templateListArbitrary().filter(arr => arr.length > 0),
          (templates) => {
            const numbered = assignSequenceNumbers(templates);
            
            // First sequence number should be 1
            expect(numbered[0].sequenceNumber).toBe(1);
            
            return true;
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    /**
     * Sequence numbers are continuous (no gaps)
     * Validates: Requirement 1.1.8
     */
    test('Property 2b: Sequence numbers are continuous', () => {
      fc.assert(
        fc.property(
          templateListArbitrary(),
          (templates) => {
            const numbered = assignSequenceNumbers(templates);
            
            // Check that each sequence number is exactly 1 more than the previous
            for (let i = 0; i < numbered.length; i++) {
              expect(numbered[i].sequenceNumber).toBe(i + 1);
            }
            
            return true;
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    /**
     * No duplicate sequence numbers
     * Validates: Requirement 1.1.8
     */
    test('Property 2c: No duplicate sequence numbers', () => {
      fc.assert(
        fc.property(
          templateListArbitrary(),
          (templates) => {
            const numbered = assignSequenceNumbers(templates);
            
            // Collect all sequence numbers
            const sequenceNumbers = numbered.map(t => t.sequenceNumber);
            const uniqueNumbers = new Set(sequenceNumbers);
            
            // All sequence numbers should be unique
            expect(uniqueNumbers.size).toBe(sequenceNumbers.length);
            
            return true;
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    /**
     * Output length matches input length
     * Validates: Requirement 1.1.8
     */
    test('Property 2d: Output length matches input length', () => {
      fc.assert(
        fc.property(
          templateListArbitrary(),
          (templates) => {
            const numbered = assignSequenceNumbers(templates);
            
            // Output should have same length as input
            expect(numbered.length).toBe(templates.length);
            
            return true;
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    /**
     * Original template data is preserved
     * Validates: Requirement 1.1.8
     */
    test('Property 2e: Original template data is preserved', () => {
      fc.assert(
        fc.property(
          templateListArbitrary(),
          (templates) => {
            const numbered = assignSequenceNumbers(templates);
            
            // Each numbered template should contain all original properties
            numbered.forEach((numberedTemplate, index) => {
              const original = templates[index];
              
              // Check that all original properties are preserved
              expect(numberedTemplate.id).toBe(original.id);
              expect(numberedTemplate.groupId).toBe(original.groupId);
              expect(numberedTemplate.type).toBe(original.type);
              expect(numberedTemplate.visibility).toBe(original.visibility);
              expect(numberedTemplate.label).toBe(original.label);
              expect(numberedTemplate.content).toEqual(original.content);
              expect(numberedTemplate.order).toBe(original.order);
            });
            
            return true;
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    /**
     * Empty array returns empty array
     */
    test('Property 2f: Empty array returns empty array', () => {
      const result = assignSequenceNumbers([]);
      expect(result).toEqual([]);
    });

    /**
     * Null/undefined input returns empty array
     */
    test('Property 2g: Null/undefined input returns empty array', () => {
      expect(assignSequenceNumbers(null)).toEqual([]);
      expect(assignSequenceNumbers(undefined)).toEqual([]);
    });

    /**
     * Sequence numbers are positive integers
     * Validates: Requirement 1.1.8
     */
    test('Property 2h: Sequence numbers are positive integers', () => {
      fc.assert(
        fc.property(
          templateListArbitrary(),
          (templates) => {
            const numbered = assignSequenceNumbers(templates);
            
            // All sequence numbers should be positive integers
            numbered.forEach(t => {
              expect(Number.isInteger(t.sequenceNumber)).toBe(true);
              expect(t.sequenceNumber).toBeGreaterThan(0);
            });
            
            return true;
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

  });

});
