/**
 * ConfigStorage
 * 
 * Storage implementation for configuration data.
 * Implements account-level configuration persistence.
 * 
 * Requirements: 11.1-11.7
 */

const IStorage = require('./IStorage');
const Config = require('../models/Config');
const StorageError = require('../errors/StorageError');
const { sanitizeAccountId } = require('../utils/file');
const { detectVersion, needsMigration, migrateConfigFrom_0_0_0_to_1_0_0, validateMigratedData, createBackup, CURRENT_VERSION } = require('../utils/migration');
const { createLogger, getDefaultLogLevel } = require('../utils/logger');
const fs = require('fs').promises;
const path = require('path');

// Create logger instance
const logger = createLogger('ConfigStorage', getDefaultLogLevel());

class ConfigStorage extends IStorage {
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
    this.storageKey = `quick_reply_config_${accountId}`;
    
    // Sanitize accountId for file path
    const sanitized = sanitizeAccountId(accountId);
    
    // Determine storage path
    if (userDataPath) {
      this.storagePath = path.join(userDataPath, 'quick-reply', sanitized, 'config.json');
    } else {
      try {
        const { app } = require('electron');
        this.storagePath = path.join(app.getPath('userData'), 'quick-reply', sanitized, 'config.json');
      } catch (error) {
        // Fallback for testing or non-Electron environments
        this.storagePath = path.join(process.cwd(), 'session-data', 'quick-reply', sanitized, 'config.json');
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
   * Load configuration from file
   * @private
   * @returns {Promise<Object>} Configuration object
   */
  async _load() {
    try {
      await this._ensureDirectory();
      
      try {
        const data = await fs.readFile(this.storagePath, 'utf8');
        const parsed = JSON.parse(data);
        
        // Detect version and migrate if needed
        const version = detectVersion(parsed);
        logger.info('ConfigStorage', `Loaded data version: ${version}`);
        
        let migratedData = parsed;
        if (needsMigration(version)) {
          logger.info('ConfigStorage', `Migration needed from ${version} to ${CURRENT_VERSION}`);
          
          // Create backup before migration
          await createBackup(parsed, this.storagePath);
          
          // Migrate data
          migratedData = migrateConfigFrom_0_0_0_to_1_0_0(parsed);
          
          // Validate migrated data
          validateMigratedData(migratedData, 'config');
          
          // Save migrated data
          await this._save(migratedData.config);
          
          logger.info('ConfigStorage', 'Migration completed successfully');
        }
        
        this._cache = migratedData.config || Config.getDefault(this.accountId).toJSON();
        this._cacheTimestamp = Date.now();
        return this._cache;
      } catch (error) {
        if (error.code === 'ENOENT') {
          // File doesn't exist yet, return default config
          const defaultConfig = Config.getDefault(this.accountId).toJSON();
          this._cache = defaultConfig;
          this._cacheTimestamp = Date.now();
          return this._cache;
        }
        throw error;
      }
    } catch (error) {
      throw new StorageError(`Failed to load config: ${error.message}`);
    }
  }

  /**
   * Save configuration to file
   * @private
   * @param {Object} config - Configuration object
   */
  async _save(config) {
    try {
      await this._ensureDirectory();
      
      const data = {
        version: CURRENT_VERSION,
        accountId: this.accountId,
        config: config,
        updatedAt: Date.now()
      };
      
      await fs.writeFile(this.storagePath, JSON.stringify(data, null, 2), 'utf8');
      this._cache = config;
      this._cacheTimestamp = Date.now();
    } catch (error) {
      throw new StorageError(`Failed to save config: ${error.message}`);
    }
  }

  /**
   * Save configuration
   * @param {Object} config - Configuration to save
   * @returns {Promise<Object>} Saved configuration
   */
  async save(config) {
    try {
      // Ensure accountId matches
      const configToSave = {
        ...config,
        accountId: this.accountId,
        updatedAt: Date.now()
      };
      
      await this._save(configToSave);
      return configToSave;
    } catch (error) {
      if (error instanceof StorageError) {
        throw error;
      }
      throw new StorageError(`Failed to save config: ${error.message}`);
    }
  }

  /**
   * Get configuration
   * @returns {Promise<Object>} Configuration
   */
  async get() {
    try {
      return await this._load();
    } catch (error) {
      if (error instanceof StorageError) {
        throw error;
      }
      throw new StorageError(`Failed to get config: ${error.message}`);
    }
  }

  /**
   * Update configuration
   * @param {Object} updates - Updates to apply
   * @returns {Promise<Object>} Updated configuration
   */
  async update(updates) {
    try {
      const config = await this._load();
      
      // Apply updates
      const updatedConfig = {
        ...config,
        ...updates,
        accountId: this.accountId, // Ensure accountId doesn't change
        updatedAt: Date.now()
      };
      
      await this._save(updatedConfig);
      return updatedConfig;
    } catch (error) {
      if (error instanceof StorageError) {
        throw error;
      }
      throw new StorageError(`Failed to update config: ${error.message}`);
    }
  }

  /**
   * Reset configuration to defaults
   * @returns {Promise<Object>} Default configuration
   */
  async reset() {
    try {
      const defaultConfig = Config.getDefault(this.accountId).toJSON();
      await this._save(defaultConfig);
      return defaultConfig;
    } catch (error) {
      if (error instanceof StorageError) {
        throw error;
      }
      throw new StorageError(`Failed to reset config: ${error.message}`);
    }
  }

  /**
   * Clear cache (useful for testing)
   */
  clearCache() {
    this._cache = null;
    this._cacheTimestamp = null;
  }

  // Override unused methods from IStorage
  async getAll() {
    throw new Error('getAll() not applicable for ConfigStorage');
  }

  async delete(id) {
    throw new Error('delete() not applicable for ConfigStorage');
  }
}

module.exports = ConfigStorage;
