/**
 * Group Model
 * 
 * Represents a template group.
 * 
 * Requirements: 2.1-2.11, 19.1-19.7
 */

const { v4: uuidv4 } = require('../utils/uuid');

class Group {
  /**
   * @param {Object} data - Group data
   * @param {string} data.id - Group unique identifier
   * @param {string} data.name - Group name
   * @param {string|null} data.parentId - Parent group ID (null for top-level)
   * @param {number} data.order - Order within same level
   * @param {boolean} data.expanded - Expanded/collapsed state
   * @param {number} data.createdAt - Creation timestamp
   * @param {number} data.updatedAt - Last update timestamp
   */
  constructor(data = {}) {
    this.id = data.id || uuidv4();
    this.name = data.name || '';
    this.parentId = data.parentId || null;
    this.order = data.order || 0;
    this.expanded = data.expanded !== undefined ? data.expanded : true;
    this.createdAt = data.createdAt || Date.now();
    this.updatedAt = data.updatedAt || Date.now();
  }

  /**
   * Convert to plain object
   * @returns {Object} Plain object representation
   */
  toJSON() {
    return {
      id: this.id,
      name: this.name,
      parentId: this.parentId,
      order: this.order,
      expanded: this.expanded,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }

  /**
   * Create from plain object
   * @param {Object} data - Plain object data
   * @returns {Group} Group instance
   */
  static fromJSON(data) {
    return new Group(data);
  }

  /**
   * Validate group data
   * @returns {Object} Validation result { valid: boolean, errors: string[] }
   */
  validate() {
    const errors = [];

    if (!this.name || this.name.trim().length === 0) {
      errors.push('Group name is required');
    }

    if (this.name.length > 100) {
      errors.push('Group name exceeds maximum length of 100 characters');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Check if this is a top-level group
   * @returns {boolean} Is top-level
   */
  isTopLevel() {
    return this.parentId === null;
  }

  /**
   * Update the group's updated timestamp
   */
  touch() {
    this.updatedAt = Date.now();
  }

  /**
   * Toggle expanded state
   */
  toggleExpanded() {
    this.expanded = !this.expanded;
    this.touch();
  }

  /**
   * Set expanded state
   * @param {boolean} expanded - New expanded state
   */
  setExpanded(expanded) {
    this.expanded = expanded;
    this.touch();
  }
}

module.exports = Group;
