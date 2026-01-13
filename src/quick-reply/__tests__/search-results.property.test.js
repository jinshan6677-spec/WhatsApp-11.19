/**
 * Property-Based Tests for Search Results Correctness
 * 
 * Feature: enhanced-quick-reply-management
 * Property 8: 搜索结果正确性
 * 
 * Tests that search results correctly contain the search keyword.
 * 
 * Requirements: 7.2, 7.3, 7.4
 */

const fc = require('fast-check');
const {
  searchTemplates,
  matchesTemplateContent,
  matchesGroupName,
  highlightKeyword,
  escapeRegex
} = require('../utils/search');

describe('Property 8: 搜索结果正确性', () => {
  /**
   * Feature: enhanced-quick-reply-management, Property 8: 搜索结果正确性
   * 
   * For any search keyword, all returned results should contain that keyword
   * in their label or content.
   * 
   * Validates: Requirements 7.2, 7.3, 7.4
   */

  // Arbitrary for generating valid template objects
  const templateArbitrary = fc.record({
    id: fc.uuid(),
    groupId: fc.uuid(),
    label: fc.string({ minLength: 0, maxLength: 100 }),
    type: fc.constantFrom('text', 'image', 'audio', 'video', 'imageText'),
    content: fc.record({
      text: fc.option(fc.string({ minLength: 0, maxLength: 200 }), { nil: undefined })
    })
  });

  // Arbitrary for generating valid group objects
  const groupArbitrary = fc.record({
    id: fc.uuid(),
    name: fc.string({ minLength: 1, maxLength: 50 }),
    parentId: fc.option(fc.uuid(), { nil: null })
  });

  // Arbitrary for generating search keywords (non-empty, lowercase alphabetic)
  const keywordArbitrary = fc.array(
    fc.constantFrom('a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm'),
    { minLength: 2, maxLength: 6 }
  ).map(arr => arr.join(''));

  describe('searchTemplates function', () => {
    test('all search results should contain the keyword in label or content', () => {
      fc.assert(
        fc.property(
          keywordArbitrary,
          fc.integer({ min: 1, max: 5 }),
          fc.integer({ min: 1, max: 5 }),
          (keyword, numMatching, numNonMatching) => {
            const groupId = 'test-group-1';
            
            // Create templates that contain the keyword
            const matchingTemplates = Array.from({ length: numMatching }, (_, i) => ({
              id: `match-${i}`,
              groupId: groupId,
              label: `Template with ${keyword} in label`,
              type: 'text',
              content: { text: `Some text with ${keyword}` }
            }));
            
            // Create templates that definitely don't contain the keyword
            // Use completely different characters (numbers and special prefix)
            const nonMatchingTemplates = Array.from({ length: numNonMatching }, (_, i) => ({
              id: `nomatch-${i}`,
              groupId: groupId,
              label: `ZZZZZ ${i}`,
              type: 'text',
              content: { text: `99999 ${i}` }
            }));
            
            const templates = [...matchingTemplates, ...nonMatchingTemplates];
            // Use a group name that doesn't contain the keyword
            const groups = [{ id: groupId, name: 'YYYYY', parentId: null }];
            
            const results = searchTemplates(keyword, templates, groups);
            
            // All matching templates should be in results
            matchingTemplates.forEach(template => {
              expect(results).toContain(template.id);
            });
            
            // Non-matching templates should not be in results
            nonMatchingTemplates.forEach(template => {
              expect(results).not.toContain(template.id);
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    test('empty keyword should return all templates', () => {
      fc.assert(
        fc.property(
          fc.array(templateArbitrary, { minLength: 1, maxLength: 20 }),
          fc.array(groupArbitrary, { minLength: 1, maxLength: 10 }),
          (templates, groups) => {
            const results = searchTemplates('', templates, groups);
            expect(results.length).toBe(templates.length);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('whitespace-only keyword should return all templates', () => {
      fc.assert(
        fc.property(
          fc.array(templateArbitrary, { minLength: 1, maxLength: 20 }),
          fc.array(groupArbitrary, { minLength: 1, maxLength: 10 }),
          fc.constantFrom('   ', '\t', '\n', '  \t\n  '),
          (templates, groups, whitespace) => {
            const results = searchTemplates(whitespace, templates, groups);
            expect(results.length).toBe(templates.length);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('search should be case-insensitive', () => {
      fc.assert(
        fc.property(
          keywordArbitrary,
          fc.boolean(),
          (keyword, useUpperCase) => {
            const groupId = 'test-group';
            const searchKeyword = useUpperCase ? keyword.toUpperCase() : keyword.toLowerCase();
            
            // Create template with keyword in different case
            const templates = [{
              id: 'test-1',
              groupId: groupId,
              label: `Contains ${keyword.toLowerCase()}`,
              type: 'text',
              content: { text: '' }
            }];
            
            const groups = [{ id: groupId, name: 'Test Group', parentId: null }];
            
            const results = searchTemplates(searchKeyword, templates, groups);
            
            // Should find the template regardless of case
            expect(results).toContain('test-1');
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('matchesTemplateContent function', () => {
    test('should return true when label contains keyword', () => {
      fc.assert(
        fc.property(
          keywordArbitrary,
          fc.string({ minLength: 0, maxLength: 20 }),
          fc.string({ minLength: 0, maxLength: 20 }),
          (keyword, prefix, suffix) => {
            const template = {
              id: 'test',
              label: `${prefix}${keyword}${suffix}`,
              content: {}
            };
            
            expect(matchesTemplateContent(template, keyword.toLowerCase())).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('should return true when text content contains keyword', () => {
      fc.assert(
        fc.property(
          keywordArbitrary,
          fc.string({ minLength: 0, maxLength: 20 }),
          fc.string({ minLength: 0, maxLength: 20 }),
          (keyword, prefix, suffix) => {
            const template = {
              id: 'test',
              label: 'No match here',
              content: { text: `${prefix}${keyword}${suffix}` }
            };
            
            expect(matchesTemplateContent(template, keyword.toLowerCase())).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('should return false when neither label nor content contains keyword', () => {
      fc.assert(
        fc.property(
          keywordArbitrary,
          (keyword) => {
            const template = {
              id: 'test',
              label: 'ZZZZZ',
              content: { text: '99999' }
            };
            
            expect(matchesTemplateContent(template, keyword.toLowerCase())).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('matchesGroupName function', () => {
    test('should return true when group name contains keyword', () => {
      fc.assert(
        fc.property(
          keywordArbitrary,
          fc.string({ minLength: 0, maxLength: 20 }),
          fc.string({ minLength: 0, maxLength: 20 }),
          (keyword, prefix, suffix) => {
            const group = {
              id: 'test',
              name: `${prefix}${keyword}${suffix}`
            };
            
            expect(matchesGroupName(group, keyword.toLowerCase())).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('should return false when group name does not contain keyword', () => {
      fc.assert(
        fc.property(
          keywordArbitrary,
          (keyword) => {
            const group = {
              id: 'test',
              name: 'ZZZZZ'
            };
            
            expect(matchesGroupName(group, keyword.toLowerCase())).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('highlightKeyword function', () => {
    test('should wrap keyword with mark tags', () => {
      fc.assert(
        fc.property(
          keywordArbitrary,
          fc.string({ minLength: 0, maxLength: 20 }),
          fc.string({ minLength: 0, maxLength: 20 }),
          (keyword, prefix, suffix) => {
            const text = `${prefix}${keyword}${suffix}`;
            const result = highlightKeyword(text, keyword);
            
            // Result should contain the mark tag
            expect(result).toContain('<mark>');
            expect(result).toContain('</mark>');
            
            // The keyword should be wrapped
            expect(result).toContain(`<mark>${keyword}</mark>`);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('should return original text when keyword is empty', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 100 }),
          (text) => {
            expect(highlightKeyword(text, '')).toBe(text);
            expect(highlightKeyword(text, null)).toBe(text);
            expect(highlightKeyword(text, undefined)).toBe(text);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('should return original text when text is empty', () => {
      fc.assert(
        fc.property(
          keywordArbitrary,
          (keyword) => {
            expect(highlightKeyword('', keyword)).toBe('');
            expect(highlightKeyword(null, keyword)).toBe(null);
            expect(highlightKeyword(undefined, keyword)).toBe(undefined);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('should be case-insensitive', () => {
      fc.assert(
        fc.property(
          keywordArbitrary,
          fc.boolean(),
          (keyword, useUpperCase) => {
            const text = `Contains ${keyword.toLowerCase()} here`;
            const searchKeyword = useUpperCase ? keyword.toUpperCase() : keyword.toLowerCase();
            const result = highlightKeyword(text, searchKeyword);
            
            // Should contain mark tags
            expect(result).toContain('<mark>');
            expect(result).toContain('</mark>');
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('escapeRegex function', () => {
    test('should escape special regex characters', () => {
      const specialChars = ['*', '+', '?', '^', '$', '{', '}', '(', ')', '|', '[', ']', '\\', '.'];
      
      fc.assert(
        fc.property(
          fc.constantFrom(...specialChars),
          fc.string({ minLength: 0, maxLength: 10 }),
          fc.string({ minLength: 0, maxLength: 10 }),
          (specialChar, prefix, suffix) => {
            const input = `${prefix}${specialChar}${suffix}`;
            const escaped = escapeRegex(input);
            
            // The escaped string should be usable in a regex without errors
            expect(() => new RegExp(escaped)).not.toThrow();
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('search with group matching', () => {
    test('searching by group name should return all templates in that group', () => {
      fc.assert(
        fc.property(
          keywordArbitrary,
          fc.integer({ min: 1, max: 5 }),
          (keyword, numTemplates) => {
            const groupId = 'matching-group';
            
            // Create templates in the group (without keyword in their content)
            const templates = Array.from({ length: numTemplates }, (_, i) => ({
              id: `template-${i}`,
              groupId: groupId,
              label: `ZZZZZ ${i}`,
              type: 'text',
              content: { text: `99999 ${i}` }
            }));
            
            // Create a group with the keyword in its name
            const groups = [{
              id: groupId,
              name: `Group with ${keyword}`,
              parentId: null
            }];
            
            const results = searchTemplates(keyword, templates, groups);
            
            // All templates in the matching group should be returned
            templates.forEach(template => {
              expect(results).toContain(template.id);
            });
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
