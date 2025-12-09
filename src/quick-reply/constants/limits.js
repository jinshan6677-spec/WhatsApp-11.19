/**
 * Limit Constants
 * 
 * Defines various limits for the quick reply system.
 */

const LIMITS = {
  // Template label limits
  LABEL_MAX_LENGTH: 50,
  LABEL_MIN_LENGTH: 1,

  // Media file size limits (in bytes)
  IMAGE_MAX_SIZE: 16 * 1024 * 1024,  // 16 MB
  AUDIO_MAX_SIZE: 16 * 1024 * 1024,  // 16 MB
  VIDEO_MAX_SIZE: 64 * 1024 * 1024,  // 64 MB

  // Group hierarchy limits
  MAX_GROUP_DEPTH: 3,

  // Text content limits
  TEXT_MAX_LENGTH: 4096,  // WhatsApp message limit

  // Search limits
  SEARCH_MIN_LENGTH: 1,
  SEARCH_DEBOUNCE_MS: 300,

  // Batch operation limits
  BATCH_DELETE_MAX: 100,
  BATCH_MOVE_MAX: 100
};

module.exports = LIMITS;
