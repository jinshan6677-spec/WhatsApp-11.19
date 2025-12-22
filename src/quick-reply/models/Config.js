/**
 * Config Model
 * 
 * Represents quick reply configuration for an account.
 * 
 * Requirements: 11.1-11.7, 2.6, 15.7
 */

const { SEND_MODES, TAB_TYPES } = require('../constants');

class Config {
  /**
   * @param {Object} data - Config data
   * @param {string} data.accountId - Account ID
   * @param {string} data.sendMode - Send mode ('original' or 'translated')
   * @param {string} data.activeTab - Active tab type ('all' | 'public' | 'personal')
   * @param {string[]} data.expandedGroups - List of expanded group IDs (sidebar)
   * @param {string[]} data.windowExpandedGroups - List of expanded group IDs (management window)
   * @param {string|null} data.lastSelectedGroupId - Last selected group ID
   * @param {Object} data.windowSize - Management window size
   * @param {number} data.windowSize.width - Window width
   * @param {number} data.windowSize.height - Window height
   * @param {Object} data.windowPosition - Management window position
   * @param {number} data.windowPosition.x - Window x position
   * @param {number} data.windowPosition.y - Window y position
   * @param {number} data.createdAt - Creation timestamp
   * @param {number} data.updatedAt - Last update timestamp
   */
  constructor(data = {}) {
    this.accountId = data.accountId || null;
    this.sendMode = data.sendMode || SEND_MODES.ORIGINAL;
    this.activeTab = data.activeTab || TAB_TYPES.ALL;
    this.expandedGroups = data.expandedGroups || [];
    this.windowExpandedGroups = data.windowExpandedGroups || [];
    this.lastSelectedGroupId = data.lastSelectedGroupId || null;
    this.windowSize = data.windowSize || { width: 1200, height: 800 };
    this.windowPosition = data.windowPosition || null;
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
      activeTab: this.activeTab,
      expandedGroups: this.expandedGroups,
      windowExpandedGroups: this.windowExpandedGroups,
      lastSelectedGroupId: this.lastSelectedGroupId,
      windowSize: this.windowSize,
      windowPosition: this.windowPosition,
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

    if (!Object.values(TAB_TYPES).includes(this.activeTab)) {
      errors.push(`Invalid active tab: ${this.activeTab}`);
    }

    if (!Array.isArray(this.expandedGroups)) {
      errors.push('Expanded groups must be an array');
    }

    if (!Array.isArray(this.windowExpandedGroups)) {
      errors.push('Window expanded groups must be an array');
    }

    if (this.windowSize) {
      if (typeof this.windowSize.width !== 'number' || this.windowSize.width < 800) {
        errors.push('Window width must be at least 800 pixels');
      }
      if (typeof this.windowSize.height !== 'number' || this.windowSize.height < 600) {
        errors.push('Window height must be at least 600 pixels');
      }
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
      activeTab: TAB_TYPES.ALL,
      expandedGroups: [],
      windowExpandedGroups: [],
      lastSelectedGroupId: null,
      windowSize: { width: 1200, height: 800 },
      windowPosition: null
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

  /**
   * Set active tab
   * @param {string} tab - Tab type ('all' | 'public' | 'personal')
   */
  setActiveTab(tab) {
    if (Object.values(TAB_TYPES).includes(tab)) {
      this.activeTab = tab;
      this.touch();
    }
  }

  /**
   * Get active tab
   * @returns {string} Active tab type
   */
  getActiveTab() {
    return this.activeTab;
  }

  /**
   * Add group to window expanded list
   * @param {string} groupId - Group ID
   */
  addWindowExpandedGroup(groupId) {
    if (!this.windowExpandedGroups.includes(groupId)) {
      this.windowExpandedGroups.push(groupId);
      this.touch();
    }
  }

  /**
   * Remove group from window expanded list
   * @param {string} groupId - Group ID
   */
  removeWindowExpandedGroup(groupId) {
    const index = this.windowExpandedGroups.indexOf(groupId);
    if (index > -1) {
      this.windowExpandedGroups.splice(index, 1);
      this.touch();
    }
  }

  /**
   * Check if group is expanded in window
   * @param {string} groupId - Group ID
   * @returns {boolean}
   */
  isWindowGroupExpanded(groupId) {
    return this.windowExpandedGroups.includes(groupId);
  }

  /**
   * Set window size
   * @param {number} width - Window width
   * @param {number} height - Window height
   */
  setWindowSize(width, height) {
    this.windowSize = {
      width: Math.max(800, width),
      height: Math.max(600, height)
    };
    this.touch();
  }

  /**
   * Get window size
   * @returns {Object} Window size { width, height }
   */
  getWindowSize() {
    return this.windowSize || { width: 1200, height: 800 };
  }

  /**
   * Set window position
   * @param {number} x - Window x position
   * @param {number} y - Window y position
   */
  setWindowPosition(x, y) {
    this.windowPosition = { x, y };
    this.touch();
  }

  /**
   * Get window position
   * @returns {Object|null} Window position { x, y } or null
   */
  getWindowPosition() {
    return this.windowPosition;
  }
}

module.exports = Config;
