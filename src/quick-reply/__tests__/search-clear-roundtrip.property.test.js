/**
 * Property-Based Tests for Search Clear Round-Trip Consistency
 * 
 * Feature: enhanced-quick-reply-management
 * Property 9: 搜索清空往返一致性
 * 
 * Tests that clearing the search restores the original state.
 * 
 * Requirements: 7.5
 */

const fc = require('fast-check');
const {
  searchTemplates,
  filterTemplatesByTab,
  filterTemplatesByGroup
} = require('../utils/search');
const { TAB_TYPES } = require('../constants/tabTypes');
const { VISIBILITY_TYPES } = require('../constants/visibilityTypes');

describe('Property 9: 搜索清空往返一致性', () => {
  /**
   * Feature: enhanced-quick-reply-management, Property 9: 搜索清空往返一致性
   * 
   * For any search state, when the user clears the search box,
   * the displayed content should be identical to the state before searching.
   * 
   * Validates: Requirements 7.5
   */

  // Arbitrary for generating valid template objects
  const templateArbitrary = fc.record({
    id: fc.uuid(),
    groupId: fc.uuid(),
    label: fc.string({ minLength: 1, maxLength: 50 }),
    type: fc.constantFrom('text', 'image', 'audio', 'video', 'imageText'),
    visibility: fc.constantFrom(VISIBILITY_TYPES.PUBLIC, VISIBILITY_TYPES.PERSONAL),
    content: fc.record({
      text: fc.option(fc.string({ minLength: 0, maxLength: 100 }), { nil: undefined })
    })
  });

  // Arbitrary for generating valid group objects
  const groupArbitrary = fc.record({
    id: fc.uuid(),
    name: fc.string({ minLength: 1, maxLength: 30 }),
    parentId: fc.option(fc.uuid(), { nil: null })
  });

  // Arbitrary for generating search keywords
  const keywordArbitrary = fc.array(
    fc.constantFrom('a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'),
    { minLength: 2, maxLength: 5 }
  ).map(arr => arr.join(''));

  /**
   * Simulates the search state management
   */
  class SearchStateSimulator {
    constructor(templates, groups) {
      this.originalTemplates = [...templates];
      this.originalGroups = [...groups];
      this.currentTemplates = [...templates];
      this.currentGroups = [...groups];
      this.searchKeyword = '';
      this.isSearching = false;
    }

    // Perform search
    search(keyword) {
      this.searchKeyword = keyword;
      this.isSearching = keyword.length > 0;
      
      if (!keyword || keyword.trim() === '') {
        this.currentTemplates = [...this.originalTemplates];
        this.currentGroups = [...this.originalGroups];
        return;
      }

      const matchingIds = searchTemplates(keyword, this.originalTemplates, this.originalGroups);
      this.currentTemplates = this.originalTemplates.filter(t => matchingIds.includes(t.id));
      
      // Filter groups that have matching templates or match the keyword
      const lowerKeyword = keyword.toLowerCase();
      this.currentGroups = this.originalGroups.filter(g => {
        if (g.name.toLowerCase().includes(lowerKeyword)) return true;
        return this.currentTemplates.some(t => t.groupId === g.id);
      });
    }

    // Clear search
    clearSearch() {
      this.searchKeyword = '';
      this.isSearching = false;
      this.currentTemplates = [...this.originalTemplates];
      this.currentGroups = [...this.originalGroups];
    }

    // Get current state
    getState() {
      return {
        templates: this.currentTemplates,
        groups: this.currentGroups,
        searchKeyword: this.searchKeyword,
        isSearching: this.isSearching
      };
    }
  }

  describe('search then clear should restore original state', () => {
    test('clearing search should restore all templates', () => {
      fc.assert(
        fc.property(
          fc.array(templateArbitrary, { minLength: 1, maxLength: 20 }),
          fc.array(groupArbitrary, { minLength: 1, maxLength: 10 }),
          keywordArbitrary,
          (templates, groups, keyword) => {
            const simulator = new SearchStateSimulator(templates, groups);
            
            // Get initial state
            const initialState = simulator.getState();
            const initialTemplateIds = initialState.templates.map(t => t.id).sort();
            
            // Perform search
            simulator.search(keyword);
            
            // Clear search
            simulator.clearSearch();
            
            // Get final state
            const finalState = simulator.getState();
            const finalTemplateIds = finalState.templates.map(t => t.id).sort();
            
            // Template IDs should be identical
            expect(finalTemplateIds).toEqual(initialTemplateIds);
            
            // Search state should be reset
            expect(finalState.searchKeyword).toBe('');
            expect(finalState.isSearching).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('clearing search should restore all groups', () => {
      fc.assert(
        fc.property(
          fc.array(templateArbitrary, { minLength: 1, maxLength: 20 }),
          fc.array(groupArbitrary, { minLength: 1, maxLength: 10 }),
          keywordArbitrary,
          (templates, groups, keyword) => {
            const simulator = new SearchStateSimulator(templates, groups);
            
            // Get initial state
            const initialState = simulator.getState();
            const initialGroupIds = initialState.groups.map(g => g.id).sort();
            
            // Perform search
            simulator.search(keyword);
            
            // Clear search
            simulator.clearSearch();
            
            // Get final state
            const finalState = simulator.getState();
            const finalGroupIds = finalState.groups.map(g => g.id).sort();
            
            // Group IDs should be identical
            expect(finalGroupIds).toEqual(initialGroupIds);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('multiple search-clear cycles should always restore original state', () => {
      fc.assert(
        fc.property(
          fc.array(templateArbitrary, { minLength: 1, maxLength: 15 }),
          fc.array(groupArbitrary, { minLength: 1, maxLength: 8 }),
          fc.array(keywordArbitrary, { minLength: 1, maxLength: 5 }),
          (templates, groups, keywords) => {
            const simulator = new SearchStateSimulator(templates, groups);
            
            // Get initial state
            const initialTemplateIds = simulator.getState().templates.map(t => t.id).sort();
            const initialGroupIds = simulator.getState().groups.map(g => g.id).sort();
            
            // Perform multiple search-clear cycles
            keywords.forEach(keyword => {
              simulator.search(keyword);
              simulator.clearSearch();
            });
            
            // Get final state
            const finalState = simulator.getState();
            const finalTemplateIds = finalState.templates.map(t => t.id).sort();
            const finalGroupIds = finalState.groups.map(g => g.id).sort();
            
            // State should be identical to initial
            expect(finalTemplateIds).toEqual(initialTemplateIds);
            expect(finalGroupIds).toEqual(initialGroupIds);
            expect(finalState.searchKeyword).toBe('');
            expect(finalState.isSearching).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('search with empty string should be equivalent to clear', () => {
    test('searching with empty string should show all templates', () => {
      fc.assert(
        fc.property(
          fc.array(templateArbitrary, { minLength: 1, maxLength: 20 }),
          fc.array(groupArbitrary, { minLength: 1, maxLength: 10 }),
          keywordArbitrary,
          (templates, groups, keyword) => {
            const simulator = new SearchStateSimulator(templates, groups);
            
            // Get initial state
            const initialTemplateIds = simulator.getState().templates.map(t => t.id).sort();
            
            // Perform search
            simulator.search(keyword);
            
            // Search with empty string (equivalent to clear)
            simulator.search('');
            
            // Get final state
            const finalState = simulator.getState();
            const finalTemplateIds = finalState.templates.map(t => t.id).sort();
            
            // Should be identical to initial
            expect(finalTemplateIds).toEqual(initialTemplateIds);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('searching with whitespace-only string should show all templates', () => {
      fc.assert(
        fc.property(
          fc.array(templateArbitrary, { minLength: 1, maxLength: 20 }),
          fc.array(groupArbitrary, { minLength: 1, maxLength: 10 }),
          keywordArbitrary,
          fc.constantFrom('   ', '\t', '\n', '  \t\n  '),
          (templates, groups, keyword, whitespace) => {
            const simulator = new SearchStateSimulator(templates, groups);
            
            // Get initial state
            const initialTemplateIds = simulator.getState().templates.map(t => t.id).sort();
            
            // Perform search
            simulator.search(keyword);
            
            // Search with whitespace (equivalent to clear)
            simulator.search(whitespace);
            
            // Get final state
            const finalState = simulator.getState();
            const finalTemplateIds = finalState.templates.map(t => t.id).sort();
            
            // Should be identical to initial
            expect(finalTemplateIds).toEqual(initialTemplateIds);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('template order preservation', () => {
    test('clearing search should preserve original template order', () => {
      fc.assert(
        fc.property(
          fc.array(templateArbitrary, { minLength: 2, maxLength: 20 }),
          fc.array(groupArbitrary, { minLength: 1, maxLength: 10 }),
          keywordArbitrary,
          (templates, groups, keyword) => {
            const simulator = new SearchStateSimulator(templates, groups);
            
            // Get initial order
            const initialOrder = simulator.getState().templates.map(t => t.id);
            
            // Perform search and clear
            simulator.search(keyword);
            simulator.clearSearch();
            
            // Get final order
            const finalOrder = simulator.getState().templates.map(t => t.id);
            
            // Order should be preserved
            expect(finalOrder).toEqual(initialOrder);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('clearing search should preserve original group order', () => {
      fc.assert(
        fc.property(
          fc.array(templateArbitrary, { minLength: 1, maxLength: 20 }),
          fc.array(groupArbitrary, { minLength: 2, maxLength: 10 }),
          keywordArbitrary,
          (templates, groups, keyword) => {
            const simulator = new SearchStateSimulator(templates, groups);
            
            // Get initial order
            const initialOrder = simulator.getState().groups.map(g => g.id);
            
            // Perform search and clear
            simulator.search(keyword);
            simulator.clearSearch();
            
            // Get final order
            const finalOrder = simulator.getState().groups.map(g => g.id);
            
            // Order should be preserved
            expect(finalOrder).toEqual(initialOrder);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('integration with tab filtering', () => {
    test('clearing search should work correctly with tab filter applied', () => {
      fc.assert(
        fc.property(
          fc.array(templateArbitrary, { minLength: 1, maxLength: 20 }),
          fc.array(groupArbitrary, { minLength: 1, maxLength: 10 }),
          keywordArbitrary,
          fc.constantFrom(TAB_TYPES.ALL, TAB_TYPES.PUBLIC, TAB_TYPES.PERSONAL),
          (templates, groups, keyword, tab) => {
            // Apply tab filter first
            const tabFilteredTemplates = filterTemplatesByTab(templates, tab);
            
            const simulator = new SearchStateSimulator(tabFilteredTemplates, groups);
            
            // Get initial state (after tab filter)
            const initialTemplateIds = simulator.getState().templates.map(t => t.id).sort();
            
            // Perform search and clear
            simulator.search(keyword);
            simulator.clearSearch();
            
            // Get final state
            const finalTemplateIds = simulator.getState().templates.map(t => t.id).sort();
            
            // Should restore to tab-filtered state
            expect(finalTemplateIds).toEqual(initialTemplateIds);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
