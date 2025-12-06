'use strict';

const crypto = require('crypto');

/**
 * Account Status Enum
 * @readonly
 * @enum {string}
 */
const AccountStatus = {
  Inactive: 'inactive',
  Loading: 'loading',
  Active: 'active',
  Error: 'error'
};

/**
 * Generate a UUID v4
 * @returns {string}
 */
function uuidv4() {
  return crypto.randomUUID();
}

/**
 * Account Domain Entity
 * 
 * Represents a WhatsApp account with its configuration and state.
 * Contains domain methods for account lifecycle management.
 */
class Account {
  /**
   * Creates an Account instance
   * @param {Object} config - Account configuration
   */
  constructor(config = {}) {
    this.id = config.id || uuidv4();
    this.name = config.name || '';
    this.phoneNumber = config.phoneNumber || null;
    this.status = config.status || AccountStatus.Inactive;
    this.autoStart = config.autoStart !== undefined ? config.autoStart : false;
    this.createdAt = config.createdAt ? new Date(config.createdAt) : new Date();
    this.lastActiveAt = config.lastActiveAt ? new Date(config.lastActiveAt) : null;

    // Optional nested configurations (stored as IDs or embedded objects)
    this.translationConfigId = config.translationConfigId || null;

    // Session directory for data isolation
    this.sessionDir = config.sessionDir || `Partitions/account_${this.id}`;

    // Additional metadata
    this.profileName = config.profileName || null;
    this.avatarUrl = config.avatarUrl || null;
    this.note = config.note || '';
    this.order = config.order !== undefined ? config.order : 0;
  }

  // ==================== Domain Methods ====================

  /**
   * Activates the account
   */
  activate() {
    this.status = AccountStatus.Active;
    this.lastActiveAt = new Date();
  }

  /**
   * Deactivates the account
   */
  deactivate() {
    this.status = AccountStatus.Inactive;
  }

  /**
   * Sets the account to loading state
   */
  setLoading() {
    this.status = AccountStatus.Loading;
  }

  /**
   * Sets the account to error state
   */
  setError() {
    this.status = AccountStatus.Error;
  }

  /**
   * Checks if the account is active
   * @returns {boolean}
   */
  isActive() {
    return this.status === AccountStatus.Active;
  }

  /**
   * Checks if the account is loading
   * @returns {boolean}
   */
  isLoading() {
    return this.status === AccountStatus.Loading;
  }



  /**
   * Updates the translation configuration reference
   * @param {string|null} translationConfigId - Translation configuration ID
   */
  updateTranslation(translationConfigId) {
    this.translationConfigId = translationConfigId;
  }

  /**
   * Updates the last active timestamp
   */
  updateLastActive() {
    this.lastActiveAt = new Date();
  }

  // ==================== Validation ====================

  /**
   * Validates the account data
   * @returns {{valid: boolean, errors: string[]}}
   */
  validate() {
    const errors = [];

    // Validate ID
    if (!this.id || typeof this.id !== 'string' || this.id.trim().length === 0) {
      errors.push('Account ID is required and must be a non-empty string');
    }

    // Validate name
    if (this.name && this.name.length > 100) {
      errors.push('Account name must not exceed 100 characters');
    }

    // Validate status
    if (!Object.values(AccountStatus).includes(this.status)) {
      errors.push(`Status must be one of: ${Object.values(AccountStatus).join(', ')}`);
    }

    // Validate autoStart
    if (typeof this.autoStart !== 'boolean') {
      errors.push('autoStart must be a boolean');
    }

    // Validate order
    if (typeof this.order !== 'number' || this.order < 0 || !Number.isInteger(this.order)) {
      errors.push('Order must be a non-negative integer');
    }

    // Validate sessionDir
    if (!this.sessionDir || typeof this.sessionDir !== 'string' || this.sessionDir.trim().length === 0) {
      errors.push('Session directory is required');
    }

    // Validate phoneNumber (optional)
    if (this.phoneNumber !== null && this.phoneNumber !== undefined) {
      if (typeof this.phoneNumber !== 'string') {
        errors.push('Phone number must be a string');
      } else if (this.phoneNumber.length > 32) {
        errors.push('Phone number must not exceed 32 characters');
      }
    }

    // Validate createdAt
    if (!(this.createdAt instanceof Date) || isNaN(this.createdAt.getTime())) {
      errors.push('createdAt must be a valid Date');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  // ==================== Serialization ====================

  /**
   * Converts the account to a JSON-serializable object
   * @returns {Object}
   */
  toJSON() {
    return {
      id: this.id,
      name: this.name,
      phoneNumber: this.phoneNumber,
      status: this.status,
      autoStart: this.autoStart,
      createdAt: this.createdAt instanceof Date ? this.createdAt.toISOString() : this.createdAt,
      lastActiveAt: this.lastActiveAt instanceof Date ? this.lastActiveAt.toISOString() : this.lastActiveAt,
      translationConfigId: this.translationConfigId,
      sessionDir: this.sessionDir,
      profileName: this.profileName,
      avatarUrl: this.avatarUrl,
      note: this.note,
      order: this.order
    };
  }

  /**
   * Creates an Account instance from a JSON object
   * @param {Object} json - JSON representation
   * @returns {Account}
   */
  static fromJSON(json) {
    if (!json || typeof json !== 'object') {
      throw new Error('Invalid JSON: expected an object');
    }
    return new Account({
      id: json.id,
      name: json.name,
      phoneNumber: json.phoneNumber,
      status: json.status,
      autoStart: json.autoStart,
      createdAt: json.createdAt,
      lastActiveAt: json.lastActiveAt,
      translationConfigId: json.translationConfigId,
      sessionDir: json.sessionDir,
      profileName: json.profileName,
      avatarUrl: json.avatarUrl,
      note: json.note,
      order: json.order
    });
  }

  /**
   * Returns a human-readable string representation for debugging
   * @param {Account} account - Account instance
   * @returns {string}
   */
  static prettyPrint(account) {
    const lines = [
      '┌─────────────────────────────────────────────────────────────┐',
      '│                        ACCOUNT                             │',
      '├─────────────────────────────────────────────────────────────┤',
      `│ ID:           ${(account.id || 'N/A').padEnd(44)} │`,
      `│ Name:         ${(account.name || 'N/A').substring(0, 44).padEnd(44)} │`,
      `│ Status:       ${(account.status || 'N/A').padEnd(44)} │`,
      `│ Phone:        ${(account.phoneNumber || 'N/A').padEnd(44)} │`,
      `│ Auto Start:   ${String(account.autoStart).padEnd(44)} │`,
      `│ Order:        ${String(account.order).padEnd(44)} │`,
      `│ Created:      ${(account.createdAt instanceof Date ? account.createdAt.toISOString() : String(account.createdAt)).substring(0, 44).padEnd(44)} │`,
      `│ Last Active:  ${(account.lastActiveAt instanceof Date ? account.lastActiveAt.toISOString() : String(account.lastActiveAt || 'Never')).substring(0, 44).padEnd(44)} │`,
      `│ Session Dir:  ${(account.sessionDir || 'N/A').substring(0, 44).padEnd(44)} │`,
      `│ Translation:  ${(account.translationConfigId || 'None').substring(0, 44).padEnd(44)} │`,
      '└─────────────────────────────────────────────────────────────┘'
    ];
    return lines.join('\n');
  }
}

// Export the class and enum
Account.Status = AccountStatus;
module.exports = Account;
