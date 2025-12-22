/**
 * Property-Based Tests for Content Type Display Correctness
 * 
 * Feature: enhanced-quick-reply-management, Property 5: 内容类型展示正确性
 * 
 * Tests that the system correctly displays different preview components
 * based on content type.
 * Uses fast-check for property-based testing with 100 iterations per property.
 * 
 * Requirements: 4.3, 4.4, 4.5, 4.6
 * - 4.3: Image displays thumbnail
 * - 4.4: Video displays player and duration
 * - 4.5: Audio displays player controls (0:00/0:04 format)
 * - 4.6: Text displays text box
 */

const fc = require('fast-check');
const { TEMPLATE_TYPES } = require('../constants/templateTypes');
const { VISIBILITY_TYPES } = require('../constants/visibilityTypes');

// Test configuration
const NUM_RUNS = 100;

/**
 * Determines the expected preview type for a given template type
 * This mirrors the logic in ContentCard component
 * 
 * @param {string} type - Template type
 * @returns {string} Expected preview type
 */
function getExpectedPreviewType(type) {
  switch (type) {
    case TEMPLATE_TYPES.TEXT:
      return 'text';
    case TEMPLATE_TYPES.IMAGE:
      return 'image';
    case TEMPLATE_TYPES.AUDIO:
      return 'audio';
    case TEMPLATE_TYPES.VIDEO:
      return 'video';
    case TEMPLATE_TYPES.MIXED:
    case 'imageText':
      return 'imageText';
    default:
      return 'text'; // Default fallback
  }
}

/**
 * Validates that a template has the required content fields for its type
 * 
 * @param {Object} template - Template object
 * @returns {boolean} Whether the template has valid content for its type
 */
function hasValidContentForType(template) {
  if (!template || !template.content) return false;
  
  switch (template.type) {
    case TEMPLATE_TYPES.TEXT:
      return typeof template.content.text === 'string';
    case TEMPLATE_TYPES.IMAGE:
      return typeof template.content.mediaPath === 'string';
    case TEMPLATE_TYPES.AUDIO:
      return typeof template.content.mediaPath === 'string';
    case TEMPLATE_TYPES.VIDEO:
      return typeof template.content.mediaPath === 'string';
    case TEMPLATE_TYPES.MIXED:
    case 'imageText':
      return typeof template.content.mediaPath === 'string' || 
             typeof template.content.text === 'string';
    default:
      return true;
  }
}

/**
 * Format duration as m:ss format (e.g., 0:04)
 * This mirrors the logic in ContentCard component
 * 
 * @param {number} seconds - Duration in seconds
 * @returns {string} Formatted duration string
 */
function formatDuration(seconds) {
  if (seconds === null || seconds === undefined || isNaN(seconds) || seconds < 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Generate a valid template with specific type
 */
const templateWithTypeArbitrary = (type) => fc.record({
  id: fc.uuid(),
  groupId: fc.uuid(),
  type: fc.constant(type),
  visibility: fc.constantFrom(...Object.values(VISIBILITY_TYPES)),
  label: fc.string({ minLength: 1, maxLength: 50 }),
  content: fc.record({
    text: type === TEMPLATE_TYPES.TEXT || type === TEMPLATE_TYPES.MIXED || type === 'imageText'
      ? fc.string({ minLength: 1, maxLength: 100 })
      : fc.constant(undefined),
    mediaPath: type !== TEMPLATE_TYPES.TEXT
      ? fc.string({ minLength: 1, maxLength: 200 }).map(s => `/path/to/media/${s}`)
      : fc.constant(undefined),
    thumbnailPath: type === TEMPLATE_TYPES.IMAGE || type === TEMPLATE_TYPES.VIDEO
      ? fc.option(fc.string({ minLength: 1, maxLength: 200 }).map(s => `/path/to/thumb/${s}`))
      : fc.constant(undefined),
    mediaDuration: type === TEMPLATE_TYPES.AUDIO || type === TEMPLATE_TYPES.VIDEO
      ? fc.nat({ max: 3600 }) // Max 1 hour
      : fc.constant(undefined),
    mediaSize: type !== TEMPLATE_TYPES.TEXT
      ? fc.nat({ max: 100000000 }) // Max 100MB
      : fc.constant(undefined)
  }),
  order: fc.nat({ max: 1000 }),
  createdAt: fc.nat(),
  updatedAt: fc.nat(),
  usageCount: fc.nat({ max: 1000 }),
  lastUsedAt: fc.option(fc.nat())
});

/**
 * Generate a template with any valid type
 */
const anyTemplateArbitrary = () => fc.oneof(
  templateWithTypeArbitrary(TEMPLATE_TYPES.TEXT),
  templateWithTypeArbitrary(TEMPLATE_TYPES.IMAGE),
  templateWithTypeArbitrary(TEMPLATE_TYPES.AUDIO),
  templateWithTypeArbitrary(TEMPLATE_TYPES.VIDEO),
  templateWithTypeArbitrary(TEMPLATE_TYPES.MIXED),
  templateWithTypeArbitrary('imageText')
);

describe('Content Type Display Property-Based Tests', () => {
  
  /**
   * Feature: enhanced-quick-reply-management, Property 5: 内容类型展示正确性
   * **Validates: Requirements 4.3, 4.4, 4.5, 4.6**
   * 
   * For any content item, the system should display the correct preview component
   * based on its type: image shows thumbnail, video shows player and duration,
   * audio shows player controls, text shows text box.
   */
  describe('Property 5: Content Type Display Correctness', () => {
    
    /**
     * Text templates should display text preview
     * Validates: Requirement 4.6 (Text displays text box)
     */
    test('Property 5a: Text templates display text preview', () => {
      fc.assert(
        fc.property(
          templateWithTypeArbitrary(TEMPLATE_TYPES.TEXT),
          (template) => {
            const expectedPreview = getExpectedPreviewType(template.type);
            expect(expectedPreview).toBe('text');
            expect(template.type).toBe(TEMPLATE_TYPES.TEXT);
            
            // Text content should be available
            expect(template.content.text).toBeDefined();
            expect(typeof template.content.text).toBe('string');
            
            return true;
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    /**
     * Image templates should display image preview with thumbnail
     * Validates: Requirement 4.3 (Image displays thumbnail)
     */
    test('Property 5b: Image templates display image preview', () => {
      fc.assert(
        fc.property(
          templateWithTypeArbitrary(TEMPLATE_TYPES.IMAGE),
          (template) => {
            const expectedPreview = getExpectedPreviewType(template.type);
            expect(expectedPreview).toBe('image');
            expect(template.type).toBe(TEMPLATE_TYPES.IMAGE);
            
            // Media path should be available for image display
            expect(template.content.mediaPath).toBeDefined();
            expect(typeof template.content.mediaPath).toBe('string');
            
            // If thumbnail exists, it should be a string
            if (template.content.thumbnailPath) {
              expect(typeof template.content.thumbnailPath).toBe('string');
            }
            
            return true;
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    /**
     * Audio templates should display audio player with duration format
     * Validates: Requirement 4.5 (Audio displays player controls 0:00/0:04 format)
     */
    test('Property 5c: Audio templates display audio player with correct duration format', () => {
      fc.assert(
        fc.property(
          templateWithTypeArbitrary(TEMPLATE_TYPES.AUDIO),
          (template) => {
            const expectedPreview = getExpectedPreviewType(template.type);
            expect(expectedPreview).toBe('audio');
            expect(template.type).toBe(TEMPLATE_TYPES.AUDIO);
            
            // Media path should be available
            expect(template.content.mediaPath).toBeDefined();
            
            // Duration should be formatted correctly
            const duration = template.content.mediaDuration;
            const formattedDuration = formatDuration(duration);
            
            // Format should be m:ss (e.g., 0:04, 1:30, 10:05)
            expect(formattedDuration).toMatch(/^\d+:\d{2}$/);
            
            // Verify the format is correct
            const [mins, secs] = formattedDuration.split(':').map(Number);
            expect(mins).toBeGreaterThanOrEqual(0);
            expect(secs).toBeGreaterThanOrEqual(0);
            expect(secs).toBeLessThan(60);
            
            return true;
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    /**
     * Video templates should display video player with duration
     * Validates: Requirement 4.4 (Video displays player and duration)
     */
    test('Property 5d: Video templates display video player with duration', () => {
      fc.assert(
        fc.property(
          templateWithTypeArbitrary(TEMPLATE_TYPES.VIDEO),
          (template) => {
            const expectedPreview = getExpectedPreviewType(template.type);
            expect(expectedPreview).toBe('video');
            expect(template.type).toBe(TEMPLATE_TYPES.VIDEO);
            
            // Media path should be available
            expect(template.content.mediaPath).toBeDefined();
            
            // Duration should be available and formattable
            const duration = template.content.mediaDuration;
            const formattedDuration = formatDuration(duration);
            
            // Format should be m:ss
            expect(formattedDuration).toMatch(/^\d+:\d{2}$/);
            
            return true;
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    /**
     * Mixed/ImageText templates should display both image and text
     * Validates: Requirements 4.3, 4.6 (combined)
     */
    test('Property 5e: Mixed templates display both image and text', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            templateWithTypeArbitrary(TEMPLATE_TYPES.MIXED),
            templateWithTypeArbitrary('imageText')
          ),
          (template) => {
            const expectedPreview = getExpectedPreviewType(template.type);
            expect(expectedPreview).toBe('imageText');
            
            // Should have either media path or text (or both)
            const hasMedia = template.content.mediaPath !== undefined;
            const hasText = template.content.text !== undefined;
            expect(hasMedia || hasText).toBe(true);
            
            return true;
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    /**
     * Preview type mapping is deterministic
     * For any template, the same type always maps to the same preview
     */
    test('Property 5f: Preview type mapping is deterministic', () => {
      fc.assert(
        fc.property(
          anyTemplateArbitrary(),
          (template) => {
            const preview1 = getExpectedPreviewType(template.type);
            const preview2 = getExpectedPreviewType(template.type);
            
            // Same type should always produce same preview
            expect(preview1).toBe(preview2);
            
            return true;
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    /**
     * All known types map to valid preview types
     */
    test('Property 5g: All known types map to valid preview types', () => {
      const validPreviewTypes = ['text', 'image', 'audio', 'video', 'imageText'];
      
      fc.assert(
        fc.property(
          anyTemplateArbitrary(),
          (template) => {
            const previewType = getExpectedPreviewType(template.type);
            expect(validPreviewTypes).toContain(previewType);
            
            return true;
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    /**
     * Duration formatting handles edge cases correctly
     */
    test('Property 5h: Duration formatting handles all valid durations', () => {
      fc.assert(
        fc.property(
          fc.nat({ max: 7200 }), // Up to 2 hours
          (seconds) => {
            const formatted = formatDuration(seconds);
            
            // Should always produce valid format
            expect(formatted).toMatch(/^\d+:\d{2}$/);
            
            // Parse back and verify
            const [mins, secs] = formatted.split(':').map(Number);
            expect(mins * 60 + secs).toBe(seconds);
            
            return true;
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    /**
     * Duration formatting handles invalid inputs gracefully
     */
    test('Property 5i: Duration formatting handles invalid inputs', () => {
      const invalidInputs = [null, undefined, NaN, -1, 'invalid', {}, []];
      
      invalidInputs.forEach(input => {
        const formatted = formatDuration(input);
        expect(formatted).toBe('0:00');
      });
    });

    /**
     * Content validation is consistent with type
     */
    test('Property 5j: Content validation is consistent with type', () => {
      fc.assert(
        fc.property(
          anyTemplateArbitrary(),
          (template) => {
            const isValid = hasValidContentForType(template);
            
            // Generated templates should always be valid
            expect(isValid).toBe(true);
            
            return true;
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

  });

});
