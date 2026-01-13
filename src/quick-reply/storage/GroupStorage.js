/**
 * GroupStorage
 * 
 * Storage implementation for group data.
 * Implements account-level data isolation and hierarchical group management.
 * 
 * Requirements: 2.1-2.11, 19.1-19.7
 */

const IStorage = require('./IStorage');
const Group = require('../models/Group');
const StorageError = require('../errors/StorageError');
const { sanitizeAccountId } = require('../utils/file');
const { detectVersion, needsMigration, migrateGroupsFrom_0_0_0_to_1_0_0, validateMigratedData, createBackup, CURRENT_VERSION } = require('../utils/migration');
const { createLogger, getDefaultLogLevel } = require('../utils/logger');
const fs = require('fs').promises;
const path = require('path');

// Create logger instance
const logger = createLogger('GroupStorage', getDefaultLogLevel());

class GroupStorage extends IStorage {
  /**
   * @param {string} accountId - The WhatsApp account ID
   * @param {string} [userDataPath] - Optional user data path (for testing)
   */
  constructor(accountId, userDataPath = null) {
    super();
    
    if (!accountId) {
      throw new Error('accountId is required');
    }
    
    this.accountId = accountId;
    this.storageKey = `quick_reply_groups_${accountId}`;
    
    // Sanitize accountId for file path
    const sanitized = sanitizeAccountId(accountId);
    
    // Determine storage path
    if (userDataPath) {
      this.storagePath = path.join(userDataPath, 'quick-reply', sanitized, 'groups.json');
    } else {
      try {
        const { app } = require('electron');
        this.storagePath = path.join(app.getPath('userData'), 'quick-reply', sanitized, 'groups.json');
      } catch (error) {
        // Fallback for testing or non-Electron environments
        this.storagePath = path.join(process.cwd(), 'session-data', 'quick-reply', sanitized, 'groups.json');
      }
    }
    
    this._cache = null;
    this._cacheTimestamp = null;
  }

  /**
   * Ensure storage directory exists
   * @private
   */
  async _ensureDirectory() {
    const dir = path.dirname(this.storagePath);
    try {
      await fs.mkdir(dir, { recursive: true });
    } catch (error) {
      throw new StorageError(`Failed to create storage directory: ${error.message}`);
    }
  }

  /**
   * Load groups from file
   * @private
   * @returns {Promise<Array>} Groups array
   */
  async _load() {
    try {
      await this._ensureDirectory();
      
      try {
        const data = await fs.readFile(this.storagePath, 'utf8');
        const parsed = JSON.parse(data);
        
        // Detect version and migrate if needed
        const version = detectVersion(parsed);
        logger.info('GroupStorage', `Loaded data version: ${version}`);
        
        let migratedData = parsed;
        if (needsMigration(version)) {
          logger.info('GroupStorage', `Migration needed from ${version} to ${CURRENT_VERSION}`);
          
          // Create backup before migration
          await createBackup(parsed, this.storagePath);
          
          // Migrate data
          migratedData = migrateGroupsFrom_0_0_0_to_1_0_0(parsed);
          
          // Validate migrated data
          validateMigratedData(migratedData, 'groups');
          
          // Save migrated data
          await this._save(migratedData.groups);
          
          logger.info('GroupStorage', 'Migration completed successfully');
        }
        
        this._cache = migratedData.groups || [];
        this._cacheTimestamp = Date.now();
        return this._cache;
      } catch (error) {
        if (error.code === 'ENOENT') {
          // File doesn't exist yet, return empty array
          this._cache = [];
          this._cacheTimestamp = Date.now();
          return this._cache;
        }
        throw error;
      }
    } catch (error) {
      throw new StorageError(`Failed to load groups: ${error.message}`);
    }
  }

  /**
   * Save groups to file
   * @private
   * @param {Array} groups - Groups array
   */
  async _save(groups) {
    try {
      await this._ensureDirectory();
      
      const data = {
        version: CURRENT_VERSION,
        accountId: this.accountId,
        groups: groups,
        updatedAt: Date.now()
      };
      
      await fs.writeFile(this.storagePath, JSON.stringify(data, null, 2), 'utf8');
      this._cache = groups;
      this._cacheTimestamp = Date.now();
    } catch (error) {
      throw new StorageError(`Failed to save groups: ${error.message}`);
    }
  }

  /**
   * Save group
   * @param {Object} group - Group to save
   * @returns {Promise<Object>} Saved group
   */
  async save(group) {
    try {
      const groups = await this._load();
      
      // Check if group already exists
      const existingIndex = groups.findIndex(g => g.id === group.id);
      
      if (existingIndex >= 0) {
        // Update existing group
        groups[existingIndex] = group;
      } else {
        // Add new group
        groups.push(group);
      }
      
      await this._save(groups);
      return group;
    } catch (error) {
      if (error instanceof StorageError) {
        throw error;
      }
      throw new StorageError(`Failed to save group: ${error.message}`);
    }
  }

  /**
   * Get group by ID
   * @param {string} groupId - Group ID
   * @returns {Promise<Object|null>} Group or null if not found
   */
  async get(groupId) {
    try {
      const groups = await this._load();
      const group = groups.find(g => g.id === groupId);
      return group || null;
    } catch (error) {
      if (error instanceof StorageError) {
        throw error;
      }
      throw new StorageError(`Failed to get group: ${error.message}`);
    }
  }

  /**
   * Get all groups
   * @returns {Promise<Array>} All groups
   */
  async getAll() {
    try {
      return await this._load();
    } catch (error) {
      if (error instanceof StorageError) {
        throw error;
      }
      throw new StorageError(`Failed to get all groups: ${error.message}`);
    }
  }

  /**
   * Get child groups
   * @param {string|null} parentId - Parent group ID (null for top-level groups)
   * @returns {Promise<Array>} Child groups
   */
  async getChildren(parentId) {
    try {
      const groups = await this._load();
      return groups.filter(g => g.parentId === parentId);
    } catch (error) {
      if (error instanceof StorageError) {
        throw error;
      }
      throw new StorageError(`Failed to get child groups: ${error.message}`);
    }
  }

  /**
   * Update group
   * @param {string} groupId - Group ID
   * @param {Object} updates - Updates to apply
   * @returns {Promise<Object|null>} Updated group or null if not found
   */
  async update(groupId, updates) {
    try {
      const groups = await this._load();
      const index = groups.findIndex(g => g.id === groupId);
      
      if (index < 0) {
        return null;
      }
      
      // Apply updates
      groups[index] = {
        ...groups[index],
        ...updates,
        id: groupId, // Ensure ID doesn't change
        updatedAt: Date.now()
      };
      
      await this._save(groups);
      return groups[index];
    } catch (error) {
      if (error instanceof StorageError) {
        throw error;
      }
      throw new StorageError(`Failed to update group: ${error.message}`);
    }
  }

  /**
   * Delete group
   * @param {string} groupId - Group ID
   * @returns {Promise<boolean>} True if deleted, false if not found
   */
  async delete(groupId) {
    try {
      let groups = await this._load();
      const index = groups.findIndex(g => g.id === groupId);
      
      if (index < 0) {
        return false;
      }
      
      // Also delete all child groups recursively
      const childGroups = await this.getChildren(groupId);
      for (const child of childGroups) {
        await this.delete(child.id);
      }
      
      // Reload groups after recursive deletions to avoid stale data
      groups = await this._load();
      const currentIndex = groups.findIndex(g => g.id === groupId);
      
      if (currentIndex >= 0) {
        groups.splice(currentIndex, 1);
        await this._save(groups);
      }
      
      return true;
    } catch (error) {
      if (error instanceof StorageError) {
        throw error;
      }
      throw new StorageError(`Failed to delete group: ${error.message}`);
    }
  }

  /**
   * Batch delete groups
   * @param {Array<string>} groupIds - Group IDs
   * @returns {Promise<number>} Number of groups deleted
   */
  async batchDelete(groupIds) {
    try {
      let deletedCount = 0;
      
      // Delete each group (which will also delete children)
      for (const groupId of groupIds) {
        const deleted = await this.delete(groupId);
        if (deleted) {
          deletedCount++;
        }
      }
      
      return deletedCount;
    } catch (error) {
      if (error instanceof StorageError) {
        throw error;
      }
      throw new StorageError(`Failed to batch delete groups: ${error.message}`);
    }
  }

  /**
   * Get all descendants of a group (children, grandchildren, etc.)
   * @param {string} groupId - Group ID
   * @returns {Promise<Array>} All descendant groups
   */
  async getDescendants(groupId) {
    try {
      const descendants = [];
      const children = await this.getChildren(groupId);
      
      for (const child of children) {
        descendants.push(child);
        const grandchildren = await this.getDescendants(child.id);
        descendants.push(...grandchildren);
      }
      
      return descendants;
    } catch (error) {
      if (error instanceof StorageError) {
        throw error;
      }
      throw new StorageError(`Failed to get descendants: ${error.message}`);
    }
  }

  /**
   * Clear cache (useful for testing)
   */
  clearCache() {
    this._cache = null;
    this._cacheTimestamp = null;
  }
}

module.exports = GroupStorage;
