/**
 * Template Model
 * 
 * Represents a quick reply template.
 * 
 * Requirements: 3.1-3.13, 29.1-29.8, 1.1.2, 1.1.3, 1.1.4
 */

const { TEMPLATE_TYPES, LIMITS, VISIBILITY_TYPES } = require('../constants');
const { v4: uuidv4 } = require('../utils/uuid');

class Template {
  /**
   * @param {Object} data - Template data
   * @param {string} data.id - Template unique identifier
   * @param {string} data.groupId - Group ID this template belongs to
   * @param {string} data.type - Template type (text, image, audio, video, mixed, contact)
   * @param {string} data.visibility - Visibility type ('public' | 'personal')
   * @param {string} data.label - Template label/name
   * @param {Object} data.content - Template content
   * @param {string} [data.content.text] - Text content
   * @param {string} [data.content.mediaPath] - Media file path
   * @param {string} [data.content.thumbnailPath] - Media thumbnail path
   * @param {number} [data.content.mediaDuration] - Media duration in seconds
   * @param {number} [data.content.mediaSize] - Media file size in bytes
   * @param {Object} [data.content.contactInfo] - Contact information
   * @param {number} data.order - Order within group
   * @param {number} data.createdAt - Creation timestamp
   * @param {number} data.updatedAt - Last update timestamp
   * @param {number} data.usageCount - Number of times used
   * @param {number} data.lastUsedAt - Last usage timestamp
   */
  constructor(data = {}) {
    this.id = data.id || uuidv4();
    this.groupId = data.groupId || null;
    this.type = data.type || TEMPLATE_TYPES.TEXT;
    this.visibility = data.visibility || VISIBILITY_TYPES.PERSONAL;
    this.label = data.label || '';
    this.content = data.content || {};
    this.order = data.order || 0;
    this.createdAt = data.createdAt || Date.now();
    this.updatedAt = data.updatedAt || Date.now();
    this.usageCount = data.usageCount || 0;
    this.lastUsedAt = data.lastUsedAt || null;
  }

  /**
   * Convert to plain object
   * @returns {Object} Plain object representation
   */
  toJSON() {
    return {
      id: this.id,
      groupId: this.groupId,
      type: this.type,
      visibility: this.visibility,
      label: this.label,
      content: this.content,
      order: this.order,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      usageCount: this.usageCount,
      lastUsedAt: this.lastUsedAt
    };
  }

  /**
   * Create from plain object
   * @param {Object} data - Plain object data
   * @returns {Template} Template instance
   */
  static fromJSON(data) {
    return new Template(data);
  }

  /**
   * Validate template data
   * @returns {Object} Validation result { valid: boolean, errors: string[] }
   */
  validate() {
    const errors = [];

    if (!this.groupId) {
      errors.push('Group ID is required');
    }

    if (!this.type) {
      errors.push('Template type is required');
    } else if (!Object.values(TEMPLATE_TYPES).includes(this.type)) {
      errors.push(`Invalid template type: ${this.type}`);
    }

    // Validate visibility (Requirements: 1.1.2, 1.1.3, 1.1.4)
    if (!this.visibility) {
      errors.push('Visibility is required');
    } else if (!Object.values(VISIBILITY_TYPES).includes(this.visibility)) {
      errors.push(`Invalid visibility type: ${this.visibility}`);
    }

    if (!this.label) {
      errors.push('Template label is required');
    } else if (this.label.length > LIMITS.LABEL_MAX_LENGTH) {
      errors.push(`Label exceeds maximum length of ${LIMITS.LABEL_MAX_LENGTH} characters`);
    }

    if (!this.content || typeof this.content !== 'object') {
      errors.push('Template content is required');
    } else {
      // Validate content based on type
      if (this.type === TEMPLATE_TYPES.TEXT && !this.content.text) {
        errors.push('Text content is required for text templates');
      }
      if ([TEMPLATE_TYPES.IMAGE, TEMPLATE_TYPES.AUDIO, TEMPLATE_TYPES.VIDEO].includes(this.type) && !this.content.mediaPath) {
        errors.push('Media path is required for media templates');
      }
      if (this.type === TEMPLATE_TYPES.MIXED && (!this.content.text || !this.content.mediaPath)) {
        errors.push('Both text and media path are required for mixed templates');
      }
      if (this.type === TEMPLATE_TYPES.CONTACT && !this.content.contactInfo) {
        errors.push('Contact info is required for contact templates');
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Update the template's updated timestamp
   */
  touch() {
    this.updatedAt = Date.now();
  }

  /**
   * Increment usage count and update last used timestamp
   */
  recordUsage() {
    this.usageCount++;
    this.lastUsedAt = Date.now();
    this.touch();
  }

  /**
   * Check if template has text content
   * @returns {boolean}
   */
  hasText() {
    return !!(this.content && this.content.text);
  }

  /**
   * Check if template has media content
   * @returns {boolean}
   */
  hasMedia() {
    return !!(this.content && this.content.mediaPath);
  }

  /**
   * Check if template is translatable
   * @returns {boolean}
   */
  isTranslatable() {
    return this.type === TEMPLATE_TYPES.TEXT || this.type === TEMPLATE_TYPES.MIXED;
  }

  /**
   * Check if template is public
   * @returns {boolean}
   */
  isPublic() {
    return this.visibility === VISIBILITY_TYPES.PUBLIC;
  }

  /**
   * Check if template is personal
   * @returns {boolean}
   */
  isPersonal() {
    return this.visibility === VISIBILITY_TYPES.PERSONAL;
  }

  /**
   * Set visibility
   * @param {string} visibility - Visibility type ('public' | 'personal')
   */
  setVisibility(visibility) {
    if (Object.values(VISIBILITY_TYPES).includes(visibility)) {
      this.visibility = visibility;
      this.touch();
    }
  }

  /**
   * Check if template has thumbnail
   * @returns {boolean}
   */
  hasThumbnail() {
    return !!(this.content && this.content.thumbnailPath);
  }

  /**
   * Get thumbnail path
   * @returns {string|null}
   */
  getThumbnailPath() {
    return this.content && this.content.thumbnailPath ? this.content.thumbnailPath : null;
  }

  /**
   * Set thumbnail path
   * @param {string} thumbnailPath - Path to thumbnail file
   */
  setThumbnailPath(thumbnailPath) {
    if (!this.content) {
      this.content = {};
    }
    this.content.thumbnailPath = thumbnailPath;
    this.touch();
  }
}

module.exports = Template;
