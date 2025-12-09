/**
 * StoragePathConfig
 * 
 * Centralized configuration for all quick-reply storage paths.
 * Provides consistent path management for templates, groups, config, and media files.
 * 
 * Requirements: 11.1-11.7
 */

const path = require('path');
const fs = require('fs').promises;
const StorageError = require('../errors/StorageError');
const { sanitizeAccountId } = require('../utils/file');

class StoragePathConfig {
  /**
   * @param {string} accountId - The WhatsApp account ID
   * @param {string} [userDataPath] - Optional user data path (for testing)
   */
  constructor(accountId, userDataPath = null) {
    if (!accountId) {
      throw new Error('accountId is required');
    }
    
    this.accountId = accountId;
    this.sanitizedAccountId = sanitizeAccountId(accountId);
    
    // Determine base storage path
    if (userDataPath) {
      this.baseStoragePath = userDataPath;
    } else {
      try {
        const { app } = require('electron');
        this.baseStoragePath = app.getPath('userData');
      } catch (error) {
        // Fallback for testing or non-Electron environments
        this.baseStoragePath = path.join(process.cwd(), 'session-data');
      }
    }
    
    // Define all storage paths
    this._initializePaths();
  }

  /**
   * Initialize all storage paths
   * @private
   */
  _initializePaths() {
    // Root directory for quick-reply data
    this.quickReplyRoot = path.join(this.baseStoragePath, 'quick-reply');
    
    // Account-specific root directory
    this.accountRoot = path.join(this.quickReplyRoot, this.sanitizedAccountId);
    
    // Data file paths
    this.templatesPath = path.join(this.accountRoot, 'templates.json');
    this.groupsPath = path.join(this.accountRoot, 'groups.json');
    this.configPath = path.join(this.accountRoot, 'config.json');
    
    // Media directory
    this.mediaDirectory = path.join(this.accountRoot, 'media');
    
    // Backup directory
    this.backupDirectory = path.join(this.accountRoot, 'backups');
  }

  /**
   * Get the templates data file path
   * @returns {string} Templates file path
   */
  getTemplatesPath() {
    return this.templatesPath;
  }

  /**
   * Get the groups data file path
   * @returns {string} Groups file path
   */
  getGroupsPath() {
    return this.groupsPath;
  }

  /**
   * Get the config data file path
   * @returns {string} Config file path
   */
  getConfigPath() {
    return this.configPath;
  }

  /**
   * Get the media directory path
   * @returns {string} Media directory path
   */
  getMediaDirectory() {
    return this.mediaDirectory;
  }

  /**
   * Get the backup directory path
   * @returns {string} Backup directory path
   */
  getBackupDirectory() {
    return this.backupDirectory;
  }

  /**
   * Get the account root directory path
   * @returns {string} Account root directory path
   */
  getAccountRoot() {
    return this.accountRoot;
  }

  /**
   * Get the quick-reply root directory path
   * @returns {string} Quick-reply root directory path
   */
  getQuickReplyRoot() {
    return this.quickReplyRoot;
  }

  /**
   * Get the full path for a media file
   * @param {string} relativePath - Relative media file path (e.g., 'media/template-id.jpg')
   * @returns {string} Full media file path
   */
  getMediaFilePath(relativePath) {
    if (!relativePath) {
      return null;
    }
    return path.join(this.accountRoot, relativePath);
  }

  /**
   * Ensure all required directories exist
   * @returns {Promise<void>}
   */
  async ensureDirectories() {
    try {
      // Create all directories with recursive option
      await fs.mkdir(this.accountRoot, { recursive: true });
      await fs.mkdir(this.mediaDirectory, { recursive: true });
      await fs.mkdir(this.backupDirectory, { recursive: true });
    } catch (error) {
      throw new StorageError(`Failed to create storage directories: ${error.message}`);
    }
  }

  /**
   * Verify directory permissions
   * @returns {Promise<boolean>} True if all directories are accessible
   */
  async verifyPermissions() {
    try {
      // Ensure directories exist first
      await this.ensureDirectories();
      
      // Test write permissions by creating and deleting a test file
      const testFile = path.join(this.accountRoot, '.permission-test');
      await fs.writeFile(testFile, 'test', 'utf8');
      await fs.unlink(testFile);
      
      return true;
    } catch (error) {
      throw new StorageError(`Storage directory permissions check failed: ${error.message}`);
    }
  }

  /**
   * Get storage information
   * @returns {Promise<Object>} Storage information
   */
  async getStorageInfo() {
    try {
      await this.ensureDirectories();
      
      // Get directory sizes
      const templatesSize = await this._getFileSize(this.templatesPath);
      const groupsSize = await this._getFileSize(this.groupsPath);
      const configSize = await this._getFileSize(this.configPath);
      const mediaSize = await this._getDirectorySize(this.mediaDirectory);
      
      return {
        accountId: this.accountId,
        paths: {
          accountRoot: this.accountRoot,
          templates: this.templatesPath,
          groups: this.groupsPath,
          config: this.configPath,
          media: this.mediaDirectory,
          backups: this.backupDirectory
        },
        sizes: {
          templates: templatesSize,
          groups: groupsSize,
          config: configSize,
          media: mediaSize,
          total: templatesSize + groupsSize + configSize + mediaSize
        }
      };
    } catch (error) {
      throw new StorageError(`Failed to get storage info: ${error.message}`);
    }
  }

  /**
   * Get file size in bytes
   * @private
   * @param {string} filePath - File path
   * @returns {Promise<number>} File size in bytes
   */
  async _getFileSize(filePath) {
    try {
      const stats = await fs.stat(filePath);
      return stats.size;
    } catch (error) {
      if (error.code === 'ENOENT') {
        return 0;
      }
      throw error;
    }
  }

  /**
   * Get directory size in bytes (recursive)
   * @private
   * @param {string} dirPath - Directory path
   * @returns {Promise<number>} Directory size in bytes
   */
  async _getDirectorySize(dirPath) {
    try {
      let totalSize = 0;
      const files = await fs.readdir(dirPath);
      
      for (const file of files) {
        const filePath = path.join(dirPath, file);
        const stats = await fs.stat(filePath);
        
        if (stats.isDirectory()) {
          totalSize += await this._getDirectorySize(filePath);
        } else {
          totalSize += stats.size;
        }
      }
      
      return totalSize;
    } catch (error) {
      if (error.code === 'ENOENT') {
        return 0;
      }
      throw error;
    }
  }

  /**
   * Clean up all storage for this account
   * WARNING: This will delete all data for the account
   * @returns {Promise<void>}
   */
  async cleanup() {
    try {
      await fs.rm(this.accountRoot, { recursive: true, force: true });
    } catch (error) {
      throw new StorageError(`Failed to cleanup storage: ${error.message}`);
    }
  }

  /**
   * Create a static instance for an account
   * @param {string} accountId - Account ID
   * @param {string} [userDataPath] - Optional user data path
   * @returns {StoragePathConfig} Storage path config instance
   */
  static forAccount(accountId, userDataPath = null) {
    return new StoragePathConfig(accountId, userDataPath);
  }
}

module.exports = StoragePathConfig;
