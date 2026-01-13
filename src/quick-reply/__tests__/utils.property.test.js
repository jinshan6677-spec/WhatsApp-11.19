/**
 * Property-Based Tests for Utility Functions
 * 
 * Tests correctness properties for validation, search, and file utilities.
 */

const fc = require('fast-check');
const {
  validateTemplateLabel,
  validateMediaFile,
  validateTextContent,
  sanitizeHtml,
  cleanInput
} = require('../utils/validation');
const {
  searchTemplates,
  matchesTemplateContent,
  matchesGroupName,
  getTemplatesInGroupHierarchy
} = require('../utils/search');
const LIMITS = require('../constants/limits');
const { TEMPLATE_TYPES } = require('../constants/templateTypes');
const ValidationError = require('../errors/ValidationError');

describe('Utils Property Tests', () => {
  describe('Property 17: 模板标签长度限制', () => {
    /**
     * Feature: quick-reply, Property 17: 模板标签长度限制
     * 验证需求：3.8
     */
    test('should reject labels exceeding max length', () => {
      fc.assert(
        fc.property(
          // Generate non-whitespace strings that exceed max length
          fc.string({ minLength: LIMITS.LABEL_MAX_LENGTH + 1, maxLength: 100 })
            .filter(s => s.trim().length > LIMITS.LABEL_MAX_LENGTH), // Ensure trimmed length still exceeds limit
          (label) => {
            expect(() => validateTemplateLabel(label)).toThrow(ValidationError);
            expect(() => validateTemplateLabel(label)).toThrow(/不能超过.*个字符/);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('should accept labels within max length', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: LIMITS.LABEL_MAX_LENGTH })
            .filter(s => s.trim().length > 0), // Filter out whitespace-only strings
          (label) => {
            const result = validateTemplateLabel(label);
            expect(result).toBeDefined();
            expect(result.length).toBeLessThanOrEqual(LIMITS.LABEL_MAX_LENGTH);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('should reject empty or whitespace-only labels', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('', '   ', '\t', '\n', '  \t\n  '),
          (label) => {
            expect(() => validateTemplateLabel(label)).toThrow(ValidationError);
            expect(() => validateTemplateLabel(label)).toThrow(/不能为空/);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('should trim whitespace from labels', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: LIMITS.LABEL_MAX_LENGTH - 10 })
            .filter(s => s.trim().length > 0), // Ensure non-empty after trim
          fc.constantFrom('  ', '\t', '\n', ''),
          (label, whitespace) => {
            // Skip if label is only whitespace
            fc.pre(label.trim().length > 0);
            
            const paddedLabel = whitespace + label + whitespace;
            const result = validateTemplateLabel(paddedLabel);
            expect(result).toBe(label.trim());
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 18: 媒体文件大小验证', () => {
    /**
     * Feature: quick-reply, Property 18: 媒体文件大小验证
     * 验证需求：3.12
     */
    test('should reject image files exceeding size limit', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: LIMITS.IMAGE_MAX_SIZE + 1, max: LIMITS.IMAGE_MAX_SIZE * 2 }),
          (size) => {
            const file = {
              type: 'image/jpeg',
              size: size
            };
            expect(() => validateMediaFile(file, TEMPLATE_TYPES.IMAGE)).toThrow(ValidationError);
            expect(() => validateMediaFile(file, TEMPLATE_TYPES.IMAGE)).toThrow(/大小超过限制/);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('should accept image files within size limit', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: LIMITS.IMAGE_MAX_SIZE }),
          (size) => {
            const file = {
              type: 'image/jpeg',
              size: size
            };
            expect(validateMediaFile(file, TEMPLATE_TYPES.IMAGE)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('should reject audio files exceeding size limit', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: LIMITS.AUDIO_MAX_SIZE + 1, max: LIMITS.AUDIO_MAX_SIZE * 2 }),
          (size) => {
            const file = {
              type: 'audio/mpeg',
              size: size
            };
            expect(() => validateMediaFile(file, TEMPLATE_TYPES.AUDIO)).toThrow(ValidationError);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('should reject video files exceeding size limit', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: LIMITS.VIDEO_MAX_SIZE + 1, max: LIMITS.VIDEO_MAX_SIZE * 2 }),
          (size) => {
            const file = {
              type: 'video/mp4',
              size: size
            };
            expect(() => validateMediaFile(file, TEMPLATE_TYPES.VIDEO)).toThrow(ValidationError);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('should reject unsupported file types', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('application/pdf', 'text/plain', 'application/zip'),
          fc.integer({ min: 1, max: LIMITS.IMAGE_MAX_SIZE }),
          (mimeType, size) => {
            const file = {
              type: mimeType,
              size: size
            };
            expect(() => validateMediaFile(file, TEMPLATE_TYPES.IMAGE)).toThrow(ValidationError);
            expect(() => validateMediaFile(file, TEMPLATE_TYPES.IMAGE)).toThrow(/不支持的.*文件类型/);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 6: 搜索结果包含匹配项', () => {
    /**
     * Feature: quick-reply, Property 6: 搜索结果包含匹配项
     * 验证需求：6.2
     */
    test('all search results should contain the keyword', () => {
      fc.assert(
        fc.property(
          // Use simple lowercase alphabetic strings to avoid special characters
          fc.array(fc.constantFrom('a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'), { minLength: 3, maxLength: 6 })
            .map(arr => arr.join('')),
          fc.integer({ min: 1, max: 5 }), // Number of matching templates
          fc.integer({ min: 1, max: 5 }), // Number of non-matching templates
          (keyword, numMatching, numNonMatching) => {
            const groupId = 'group-1';
            
            // Create templates that contain the keyword
            const matchingTemplates = Array.from({ length: numMatching }, (_, i) => ({
              id: `match-${i}`,
              groupId: groupId,
              label: `Template with ${keyword} in label`,
              content: { text: `Some text with ${keyword}` }
            }));
            
            // Create templates that definitely don't contain the keyword
            // Use completely different characters (numbers and special prefix)
            const nonMatchingTemplates = Array.from({ length: numNonMatching }, (_, i) => ({
              id: `nomatch-${i}`,
              groupId: groupId,
              label: `ZZZZZ ${i}`,
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
          fc.array(
            fc.record({
              id: fc.uuid(),
              groupId: fc.uuid(),
              label: fc.string({ maxLength: 50 }),
              content: fc.record({
                text: fc.option(fc.string({ maxLength: 100 }))
              })
            }),
            { minLength: 1, maxLength: 20 }
          ),
          fc.array(
            fc.record({
              id: fc.uuid(),
              name: fc.string({ minLength: 1, maxLength: 30 }),
              parentId: fc.option(fc.uuid())
            }),
            { minLength: 1, maxLength: 10 }
          ),
          (templates, groups) => {
            const results = searchTemplates('', templates, groups);
            expect(results.length).toBe(templates.length);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 7: 分组搜索包含子项', () => {
    /**
     * Feature: quick-reply, Property 7: 分组搜索包含子项
     * 验证需求：6.3
     */
    test('searching by group name should return all templates in that group', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 3, maxLength: 10 }),
          fc.uuid(),
          fc.array(
            fc.record({
              id: fc.uuid(),
              label: fc.string({ maxLength: 50 }),
              content: fc.record({
                text: fc.option(fc.string({ maxLength: 100 }))
              })
            }),
            { minLength: 1, maxLength: 10 }
          ),
          (groupName, groupId, templateData) => {
            // Create templates with the specific group ID
            const templates = templateData.map(t => ({
              ...t,
              groupId: groupId
            }));

            // Create a group with the search keyword in its name
            const groups = [{
              id: groupId,
              name: groupName,
              parentId: null
            }];

            // Search by group name
            const results = searchTemplates(groupName, templates, groups);

            // All templates in the group should be in results
            templates.forEach(template => {
              expect(results).toContain(template.id);
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    test('getTemplatesInGroupHierarchy should include subgroup templates', () => {
      fc.assert(
        fc.property(
          fc.uuid(),
          fc.uuid(),
          fc.array(
            fc.record({
              id: fc.uuid(),
              label: fc.string({ maxLength: 50 }),
              content: fc.record({
                text: fc.option(fc.string({ maxLength: 100 }))
              })
            }),
            { minLength: 1, maxLength: 5 }
          ),
          fc.array(
            fc.record({
              id: fc.uuid(),
              label: fc.string({ maxLength: 50 }),
              content: fc.record({
                text: fc.option(fc.string({ maxLength: 100 }))
              })
            }),
            { minLength: 1, maxLength: 5 }
          ),
          (parentGroupId, subGroupId, parentTemplates, subTemplates) => {
            // Create templates for parent and subgroup
            const templates = [
              ...parentTemplates.map(t => ({ ...t, groupId: parentGroupId })),
              ...subTemplates.map(t => ({ ...t, groupId: subGroupId }))
            ];

            // Create groups with hierarchy
            const groups = [
              { id: parentGroupId, name: 'Parent', parentId: null },
              { id: subGroupId, name: 'Child', parentId: parentGroupId }
            ];

            // Get all templates in hierarchy
            const results = getTemplatesInGroupHierarchy(parentGroupId, templates, groups);

            // Should include both parent and subgroup templates
            expect(results.length).toBe(parentTemplates.length + subTemplates.length);
            
            parentTemplates.forEach(t => {
              expect(results.some(r => r.id === t.id)).toBe(true);
            });
            
            subTemplates.forEach(t => {
              expect(results.some(r => r.id === t.id)).toBe(true);
            });
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Additional Validation Properties', () => {
    test('sanitizeHtml should escape all HTML special characters', () => {
      fc.assert(
        fc.property(
          fc.string(),
          (input) => {
            const sanitized = sanitizeHtml(input);
            
            // Should not contain raw unescaped HTML characters
            // Check that special characters are properly escaped
            if (input.includes('<')) {
              expect(sanitized).toContain('&lt;');
            }
            if (input.includes('>')) {
              expect(sanitized).toContain('&gt;');
            }
            if (input.includes('&')) {
              expect(sanitized).toContain('&amp;');
            }
            if (input.includes('"')) {
              expect(sanitized).toContain('&quot;');
            }
            if (input.includes("'")) {
              expect(sanitized).toContain('&#x27;');
            }
            if (input.includes('/')) {
              expect(sanitized).toContain('&#x2F;');
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    test('cleanInput should normalize whitespace', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 100 }),
          (input) => {
            const cleaned = cleanInput(input);
            
            // Should not have leading/trailing whitespace
            expect(cleaned).toBe(cleaned.trim());
            
            // Should not have multiple consecutive spaces
            expect(cleaned).not.toMatch(/  +/);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('validateTextContent should reject content exceeding limit', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: LIMITS.TEXT_MAX_LENGTH + 1, maxLength: LIMITS.TEXT_MAX_LENGTH + 1000 }),
          (text) => {
            expect(() => validateTextContent(text)).toThrow(ValidationError);
            expect(() => validateTextContent(text)).toThrow(/超过限制/);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
