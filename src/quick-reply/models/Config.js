/**
 * Config Model
 * 
 * Represents quick reply configuration for an account.
 * 
 * Requirements: 11.1-11.7
 */

const { SEND_MODES } = require('../constants');

class Config {
  /**
   * @param {Object} data - Config data
   * @param {string} data.accountId - Account ID
   * @param {string} data.sendMode - Send mode ('original' or 'translated')
   * @param {string[]} data.expandedGroups - List of expanded group IDs
   * @param {string|null} data.lastSelectedGroupId - Last selected group ID
   * @param {number} data.createdAt - Creation timestamp
   * @param {number} data.updatedAt - Last update timestamp
   */
  constructor(data = {}) {
    this.accountId = data.accountId || null;
    this.sendMode = data.sendMode || SEND_MODES.ORIGINAL;
    this.expandedGroups = data.expandedGroups || [];
    this.lastSelectedGroupId = data.lastSelectedGroupId || null;
    this.createdAt = data.createdAt || Date.now();
    this.updatedAt = data.updatedAt || Date.now();
  }

  /**
   * Convert to plain object
   * @returns {Object} Plain object representation
   */
  toJSON() {
    return {
      accountId: this.accountId,
      sendMode: this.sendMode,
      expandedGroups: this.expandedGroups,
      lastSelectedGroupId: this.lastSelectedGroupId,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }

  /**
   * Create from plain object
   * @param {Object} data - Plain object data
   * @returns {Config} Config instance
   */
  static fromJSON(data) {
    return new Config(data);
  }

  /**
   * Validate config data
   * @returns {Object} Validation result { valid: boolean, errors: string[] }
   */
  validate() {
    const errors = [];

    if (!this.accountId) {
      errors.push('Account ID is required');
    }

    if (!Object.values(SEND_MODES).includes(this.sendMode)) {
      errors.push(`Invalid send mode: ${this.sendMode}`);
    }

    if (!Array.isArray(this.expandedGroups)) {
      errors.push('Expanded groups must be an array');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Get default configuration
   * @param {string} accountId - Account ID
   * @returns {Config} Default config
   */
  static getDefault(accountId) {
    return new Config({
      accountId,
      sendMode: SEND_MODES.ORIGINAL,
      expandedGroups: [],
      lastSelectedGroupId: null
    });
  }

  /**
   * Update the config's updated timestamp
   */
  touch() {
    this.updatedAt = Date.now();
  }

  /**
   * Set send mode
   * @param {string} mode - Send mode
   */
  setSendMode(mode) {
    if (Object.values(SEND_MODES).includes(mode)) {
      this.sendMode = mode;
      this.touch();
    }
  }

  /**
   * Add group to expanded list
   * @param {string} groupId - Group ID
   */
  addExpandedGroup(groupId) {
    if (!this.expandedGroups.includes(groupId)) {
      this.expandedGroups.push(groupId);
      this.touch();
    }
  }

  /**
   * Remove group from expanded list
   * @param {string} groupId - Group ID
   */
  removeExpandedGroup(groupId) {
    const index = this.expandedGroups.indexOf(groupId);
    if (index > -1) {
      this.expandedGroups.splice(index, 1);
      this.touch();
    }
  }

  /**
   * Check if group is expanded
   * @param {string} groupId - Group ID
   * @returns {boolean}
   */
  isGroupExpanded(groupId) {
    return this.expandedGroups.includes(groupId);
  }

  /**
   * Set last selected group
   * @param {string} groupId - Group ID
   */
  setLastSelectedGroup(groupId) {
    this.lastSelectedGroupId = groupId;
    this.touch();
  }
}

module.exports = Config;
