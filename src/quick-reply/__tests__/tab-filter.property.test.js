/**
 * Property-Based Tests for Tab Filter Correctness
 * 
 * Feature: enhanced-quick-reply-management, Property 1: 标签过滤正确性
 * 
 * Tests the correctness of tab filtering functionality.
 * Uses fast-check for property-based testing with 100 iterations per property.
 * 
 * Requirements: 1.1.2, 1.1.3, 1.1.4
 */

const fc = require('fast-check');
const { filterTemplatesByTab } = require('../utils/search');
const { TAB_TYPES } = require('../constants/tabTypes');
const { VISIBILITY_TYPES } = require('../constants/visibilityTypes');
const { TEMPLATE_TYPES } = require('../constants/templateTypes');

// Test configuration
const NUM_RUNS = 100;

/**
 * Generate a valid template with visibility
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
const templateListArbitrary = () => fc.array(templateArbitrary(), { minLength: 0, maxLength: 20 });

describe('Tab Filter Property-Based Tests', () => {
  
  /**
   * Feature: enhanced-quick-reply-management, Property 1: 标签过滤正确性
   * **Validates: Requirements 1.1.2, 1.1.3, 1.1.4**
   * 
   * For any content item, when user selects "public" tab, all displayed content
   * should have visibility='public'; when selecting "personal" tab, all displayed
   * content should have visibility='personal'; when selecting "all" tab, all
   * content should be displayed.
   */
  describe('Property 1: Tab Filter Correctness', () => {
    
    /**
     * When tab is 'all', all templates should be returned
     * Validates: Requirement 1.1.2 (全部标签显示所有类型)
     */
    test('Property 1a: "all" tab returns all templates', () => {
      fc.assert(
        fc.property(
          templateListArbitrary(),
          (templates) => {
            const filtered = filterTemplatesByTab(templates, TAB_TYPES.ALL);
            
            // All templates should be returned
            expect(filtered.length).toBe(templates.length);
            
            // All original templates should be in the result
            const filteredIds = new Set(filtered.map(t => t.id));
            templates.forEach(t => {
              expect(filteredIds.has(t.id)).toBe(true);
            });
            
            return true;
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    /**
     * When tab is 'public', only templates with visibility='public' should be returned
     * Validates: Requirement 1.1.3 (公共标签仅显示公共类型)
     */
    test('Property 1b: "public" tab returns only public templates', () => {
      fc.assert(
        fc.property(
          templateListArbitrary(),
          (templates) => {
            const filtered = filterTemplatesByTab(templates, TAB_TYPES.PUBLIC);
            
            // All returned templates should have visibility='public'
            filtered.forEach(t => {
              expect(t.visibility).toBe(VISIBILITY_TYPES.PUBLIC);
            });
            
            // Count of filtered should match count of public templates
            const publicCount = templates.filter(t => t.visibility === VISIBILITY_TYPES.PUBLIC).length;
            expect(filtered.length).toBe(publicCount);
            
            return true;
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    /**
     * When tab is 'personal', only templates with visibility='personal' should be returned
     * Validates: Requirement 1.1.4 (个人标签仅显示个人类型)
     */
    test('Property 1c: "personal" tab returns only personal templates', () => {
      fc.assert(
        fc.property(
          templateListArbitrary(),
          (templates) => {
            const filtered = filterTemplatesByTab(templates, TAB_TYPES.PERSONAL);
            
            // All returned templates should have visibility='personal'
            filtered.forEach(t => {
              expect(t.visibility).toBe(VISIBILITY_TYPES.PERSONAL);
            });
            
            // Count of filtered should match count of personal templates
            const personalCount = templates.filter(t => t.visibility === VISIBILITY_TYPES.PERSONAL).length;
            expect(filtered.length).toBe(personalCount);
            
            return true;
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    /**
     * Filter preserves template data integrity
     * Validates: Requirements 1.1.2, 1.1.3, 1.1.4
     */
    test('Property 1d: Filter preserves template data integrity', () => {
      fc.assert(
        fc.property(
          templateListArbitrary(),
          fc.constantFrom(...Object.values(TAB_TYPES)),
          (templates, tab) => {
            const filtered = filterTemplatesByTab(templates, tab);
            
            // Each filtered template should be identical to the original
            filtered.forEach(filteredTemplate => {
              const original = templates.find(t => t.id === filteredTemplate.id);
              expect(original).toBeDefined();
              expect(filteredTemplate).toEqual(original);
            });
            
            return true;
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    /**
     * Public + Personal count equals All count
     * Validates: Requirements 1.1.2, 1.1.3, 1.1.4
     */
    test('Property 1e: Public + Personal count equals All count', () => {
      fc.assert(
        fc.property(
          templateListArbitrary(),
          (templates) => {
            const allFiltered = filterTemplatesByTab(templates, TAB_TYPES.ALL);
            const publicFiltered = filterTemplatesByTab(templates, TAB_TYPES.PUBLIC);
            const personalFiltered = filterTemplatesByTab(templates, TAB_TYPES.PERSONAL);
            
            // Public + Personal should equal All
            expect(publicFiltered.length + personalFiltered.length).toBe(allFiltered.length);
            
            return true;
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    /**
     * No overlap between public and personal filtered results
     * Validates: Requirements 1.1.3, 1.1.4
     */
    test('Property 1f: No overlap between public and personal results', () => {
      fc.assert(
        fc.property(
          templateListArbitrary(),
          (templates) => {
            const publicFiltered = filterTemplatesByTab(templates, TAB_TYPES.PUBLIC);
            const personalFiltered = filterTemplatesByTab(templates, TAB_TYPES.PERSONAL);
            
            const publicIds = new Set(publicFiltered.map(t => t.id));
            const personalIds = new Set(personalFiltered.map(t => t.id));
            
            // No template should appear in both results
            publicIds.forEach(id => {
              expect(personalIds.has(id)).toBe(false);
            });
            
            return true;
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    /**
     * Empty array input returns empty array
     */
    test('Property 1g: Empty array returns empty array', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...Object.values(TAB_TYPES)),
          (tab) => {
            const filtered = filterTemplatesByTab([], tab);
            expect(filtered).toEqual([]);
            return true;
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    /**
     * Null/undefined input returns empty array
     */
    test('Property 1h: Null/undefined input returns empty array', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...Object.values(TAB_TYPES)),
          (tab) => {
            expect(filterTemplatesByTab(null, tab)).toEqual([]);
            expect(filterTemplatesByTab(undefined, tab)).toEqual([]);
            return true;
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

  });

});
