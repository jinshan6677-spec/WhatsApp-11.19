/**
 * Property-Based Tests for File Size Validation
 * 
 * Feature: enhanced-quick-reply-management, Property 7: 文件大小验证
 * 
 * Tests the correctness of file size validation functionality.
 * Uses fast-check for property-based testing with 100 iterations per property.
 * 
 * Requirements: 6.1, 6.2, 6.3, 6.9
 */

const fc = require('fast-check');
const { validateMediaFile } = require('../utils/validation');
const { TEMPLATE_TYPES } = require('../constants/templateTypes');
const LIMITS = require('../constants/limits');
const ValidationError = require('../errors/ValidationError');

// Test configuration
const NUM_RUNS = 100;

/**
 * Generate a mock file object with specified size and type
 */
const createMockFile = (size, mimeType) => ({
  size,
  type: mimeType,
  name: `test-file.${mimeType.split('/')[1] || 'bin'}`
});

/**
 * Generate valid image MIME types
 */
const validImageMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];

/**
 * Generate valid audio MIME types
 */
const validAudioMimeTypes = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/webm', 'audio/aac'];

/**
 * Generate valid video MIME types
 */
const validVideoMimeTypes = ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime'];

describe('File Size Validation Property-Based Tests', () => {
  
  /**
   * Feature: enhanced-quick-reply-management, Property 7: 文件大小验证
   * **Validates: Requirements 6.1, 6.2, 6.3, 6.9**
   * 
   * For any uploaded media file, if the file size exceeds the limit
   * (image 5MB, audio 16MB, video 64MB), the system should reject
   * the upload and display an error message.
   */
  describe('Property 7: File Size Validation', () => {
    
    /**
     * Property 7a: Image files within size limit should be accepted
     * Validates: Requirement 6.1 (image max 5MB)
     */
    test('Property 7a: Image files within size limit are accepted', () => {
      fc.assert(
        fc.property(
          // Generate file sizes from 1 byte to just under the limit
          fc.integer({ min: 1, max: LIMITS.IMAGE_MAX_SIZE - 1 }),
          fc.constantFrom(...validImageMimeTypes),
          (fileSize, mimeType) => {
            const mockFile = createMockFile(fileSize, mimeType);
            
            // Should not throw for valid files
            expect(() => validateMediaFile(mockFile, TEMPLATE_TYPES.IMAGE)).not.toThrow();
            expect(validateMediaFile(mockFile, TEMPLATE_TYPES.IMAGE)).toBe(true);
            
            return true;
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    /**
     * Property 7b: Image files exceeding size limit should be rejected
     * Validates: Requirement 6.1, 6.9 (error message for oversized files)
     */
    test('Property 7b: Image files exceeding size limit are rejected', () => {
      fc.assert(
        fc.property(
          // Generate file sizes from limit to 2x limit
          fc.integer({ min: LIMITS.IMAGE_MAX_SIZE + 1, max: LIMITS.IMAGE_MAX_SIZE * 2 }),
          fc.constantFrom(...validImageMimeTypes),
          (fileSize, mimeType) => {
            const mockFile = createMockFile(fileSize, mimeType);
            
            // Should throw ValidationError for oversized files
            expect(() => validateMediaFile(mockFile, TEMPLATE_TYPES.IMAGE)).toThrow(ValidationError);
            
            return true;
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    /**
     * Property 7c: Audio files within size limit should be accepted
     * Validates: Requirement 6.2 (audio max 16MB)
     */
    test('Property 7c: Audio files within size limit are accepted', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: LIMITS.AUDIO_MAX_SIZE - 1 }),
          fc.constantFrom(...validAudioMimeTypes),
          (fileSize, mimeType) => {
            const mockFile = createMockFile(fileSize, mimeType);
            
            expect(() => validateMediaFile(mockFile, TEMPLATE_TYPES.AUDIO)).not.toThrow();
            expect(validateMediaFile(mockFile, TEMPLATE_TYPES.AUDIO)).toBe(true);
            
            return true;
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    /**
     * Property 7d: Audio files exceeding size limit should be rejected
     * Validates: Requirement 6.2, 6.9
     */
    test('Property 7d: Audio files exceeding size limit are rejected', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: LIMITS.AUDIO_MAX_SIZE + 1, max: LIMITS.AUDIO_MAX_SIZE * 2 }),
          fc.constantFrom(...validAudioMimeTypes),
          (fileSize, mimeType) => {
            const mockFile = createMockFile(fileSize, mimeType);
            
            expect(() => validateMediaFile(mockFile, TEMPLATE_TYPES.AUDIO)).toThrow(ValidationError);
            
            return true;
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    /**
     * Property 7e: Video files within size limit should be accepted
     * Validates: Requirement 6.3 (video max 64MB)
     */
    test('Property 7e: Video files within size limit are accepted', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: LIMITS.VIDEO_MAX_SIZE - 1 }),
          fc.constantFrom(...validVideoMimeTypes),
          (fileSize, mimeType) => {
            const mockFile = createMockFile(fileSize, mimeType);
            
            expect(() => validateMediaFile(mockFile, TEMPLATE_TYPES.VIDEO)).not.toThrow();
            expect(validateMediaFile(mockFile, TEMPLATE_TYPES.VIDEO)).toBe(true);
            
            return true;
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    /**
     * Property 7f: Video files exceeding size limit should be rejected
     * Validates: Requirement 6.3, 6.9
     */
    test('Property 7f: Video files exceeding size limit are rejected', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: LIMITS.VIDEO_MAX_SIZE + 1, max: LIMITS.VIDEO_MAX_SIZE * 2 }),
          fc.constantFrom(...validVideoMimeTypes),
          (fileSize, mimeType) => {
            const mockFile = createMockFile(fileSize, mimeType);
            
            expect(() => validateMediaFile(mockFile, TEMPLATE_TYPES.VIDEO)).toThrow(ValidationError);
            
            return true;
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    /**
     * Property 7g: Files at exact size limit should be accepted
     * Validates: Requirements 6.1, 6.2, 6.3 (boundary condition)
     */
    test('Property 7g: Files at exact size limit are accepted', () => {
      // Test image at exact limit
      const imageFile = createMockFile(LIMITS.IMAGE_MAX_SIZE, 'image/jpeg');
      expect(() => validateMediaFile(imageFile, TEMPLATE_TYPES.IMAGE)).not.toThrow();
      
      // Test audio at exact limit
      const audioFile = createMockFile(LIMITS.AUDIO_MAX_SIZE, 'audio/mpeg');
      expect(() => validateMediaFile(audioFile, TEMPLATE_TYPES.AUDIO)).not.toThrow();
      
      // Test video at exact limit
      const videoFile = createMockFile(LIMITS.VIDEO_MAX_SIZE, 'video/mp4');
      expect(() => validateMediaFile(videoFile, TEMPLATE_TYPES.VIDEO)).not.toThrow();
    });

    /**
     * Property 7h: Files 1 byte over limit should be rejected
     * Validates: Requirements 6.1, 6.2, 6.3, 6.9 (boundary condition)
     */
    test('Property 7h: Files 1 byte over limit are rejected', () => {
      // Test image 1 byte over limit
      const imageFile = createMockFile(LIMITS.IMAGE_MAX_SIZE + 1, 'image/jpeg');
      expect(() => validateMediaFile(imageFile, TEMPLATE_TYPES.IMAGE)).toThrow(ValidationError);
      
      // Test audio 1 byte over limit
      const audioFile = createMockFile(LIMITS.AUDIO_MAX_SIZE + 1, 'audio/mpeg');
      expect(() => validateMediaFile(audioFile, TEMPLATE_TYPES.AUDIO)).toThrow(ValidationError);
      
      // Test video 1 byte over limit
      const videoFile = createMockFile(LIMITS.VIDEO_MAX_SIZE + 1, 'video/mp4');
      expect(() => validateMediaFile(videoFile, TEMPLATE_TYPES.VIDEO)).toThrow(ValidationError);
    });

    /**
     * Property 7i: Invalid file types should be rejected regardless of size
     * Validates: Requirement 6.9 (error for unsupported formats)
     */
    test('Property 7i: Invalid file types are rejected regardless of size', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: LIMITS.IMAGE_MAX_SIZE }),
          (fileSize) => {
            // Test invalid MIME type for image
            const invalidImageFile = createMockFile(fileSize, 'application/pdf');
            expect(() => validateMediaFile(invalidImageFile, TEMPLATE_TYPES.IMAGE)).toThrow(ValidationError);
            
            // Test invalid MIME type for audio
            const invalidAudioFile = createMockFile(fileSize, 'text/plain');
            expect(() => validateMediaFile(invalidAudioFile, TEMPLATE_TYPES.AUDIO)).toThrow(ValidationError);
            
            // Test invalid MIME type for video
            const invalidVideoFile = createMockFile(fileSize, 'image/png');
            expect(() => validateMediaFile(invalidVideoFile, TEMPLATE_TYPES.VIDEO)).toThrow(ValidationError);
            
            return true;
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    /**
     * Property 7j: Null or undefined files should be rejected
     * Validates: Requirement 6.9 (error handling)
     */
    test('Property 7j: Null or undefined files are rejected', () => {
      expect(() => validateMediaFile(null, TEMPLATE_TYPES.IMAGE)).toThrow(ValidationError);
      expect(() => validateMediaFile(undefined, TEMPLATE_TYPES.IMAGE)).toThrow(ValidationError);
      expect(() => validateMediaFile(null, TEMPLATE_TYPES.AUDIO)).toThrow(ValidationError);
      expect(() => validateMediaFile(undefined, TEMPLATE_TYPES.VIDEO)).toThrow(ValidationError);
    });

    /**
     * Property 7k: Files with missing type or size should be rejected
     * Validates: Requirement 6.9 (error handling)
     */
    test('Property 7k: Files with missing type or size are rejected', () => {
      // Missing type
      expect(() => validateMediaFile({ size: 1000 }, TEMPLATE_TYPES.IMAGE)).toThrow(ValidationError);
      
      // Missing size
      expect(() => validateMediaFile({ type: 'image/jpeg' }, TEMPLATE_TYPES.IMAGE)).toThrow(ValidationError);
      
      // Empty object
      expect(() => validateMediaFile({}, TEMPLATE_TYPES.IMAGE)).toThrow(ValidationError);
    });

    /**
     * Property 7l: Size limits are correctly defined
     * Validates: Requirements 6.1, 6.2, 6.3
     */
    test('Property 7l: Size limits are correctly defined', () => {
      // Image: 5MB
      expect(LIMITS.IMAGE_MAX_SIZE).toBe(5 * 1024 * 1024);
      
      // Audio: 16MB
      expect(LIMITS.AUDIO_MAX_SIZE).toBe(16 * 1024 * 1024);
      
      // Video: 64MB
      expect(LIMITS.VIDEO_MAX_SIZE).toBe(64 * 1024 * 1024);
    });

  });

});
