/**
 * TemplateStorage
 * 
 * Storage implementation for template data.
 * Implements account-level data isolation using file system storage.
 * 
 * Requirements: 11.1-11.7
 */

const IStorage = require('./IStorage');
const Template = require('../models/Template');
const StorageError = require('../errors/StorageError');
const { sanitizeAccountId } = require('../utils/file');
const { detectVersion, needsMigration, migrateFrom_0_0_0_to_1_0_0, validateMigratedData, createBackup, CURRENT_VERSION } = require('../utils/migration');
const { createLogger, getDefaultLogLevel } = require('../utils/logger');
const fs = require('fs').promises;
const path = require('path');

// Create logger instance
const logger = createLogger('TemplateStorage', getDefaultLogLevel());

class TemplateStorage extends IStorage {
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
    this.storageKey = `quick_reply_templates_${accountId}`;
    
    // Sanitize accountId for file path
    const sanitized = sanitizeAccountId(accountId);
    
    // Determine storage path
    if (userDataPath) {
      this.storagePath = path.join(userDataPath, 'quick-reply', sanitized, 'templates.json');
    } else {
      try {
        const { app } = require('electron');
        this.storagePath = path.join(app.getPath('userData'), 'quick-reply', sanitized, 'templates.json');
      } catch (error) {
        // Fallback for testing or non-Electron environments
        this.storagePath = path.join(process.cwd(), 'session-data', 'quick-reply', sanitized, 'templates.json');
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
   * Load templates from file
   * @private
   * @returns {Promise<Array>} Templates array
   */
  async _load() {
    try {
      await this._ensureDirectory();
      
      try {
        const data = await fs.readFile(this.storagePath, 'utf8');
        const parsed = JSON.parse(data);
        
        // Detect version and migrate if needed
        const version = detectVersion(parsed);
        logger.info('TemplateStorage', `Loaded data version: ${version}`);
        
        let migratedData = parsed;
        if (needsMigration(version)) {
          logger.info('TemplateStorage', `Migration needed from ${version} to ${CURRENT_VERSION}`);
          
          // Create backup before migration
          await createBackup(parsed, this.storagePath);
          
          // Migrate data
          migratedData = migrateFrom_0_0_0_to_1_0_0(parsed);
          
          // Validate migrated data
          validateMigratedData(migratedData, 'templates');
          
          // Save migrated data
          await this._save(migratedData.templates);
          
          logger.info('TemplateStorage', 'Migration completed successfully');
        }
        
        this._cache = migratedData.templates || [];
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
      throw new StorageError(`Failed to load templates: ${error.message}`);
    }
  }

  /**
   * Save templates to file
   * @private
   * @param {Array} templates - Templates array
   */
  async _save(templates) {
    try {
      await this._ensureDirectory();
      
      const data = {
        version: CURRENT_VERSION,
        accountId: this.accountId,
        templates: templates,
        updatedAt: Date.now()
      };
      
      await fs.writeFile(this.storagePath, JSON.stringify(data, null, 2), 'utf8');
      this._cache = templates;
      this._cacheTimestamp = Date.now();
    } catch (error) {
      throw new StorageError(`Failed to save templates: ${error.message}`);
    }
  }

  /**
   * Save template
   * @param {Object} template - Template to save
   * @returns {Promise<Object>} Saved template
   */
  async save(template) {
    try {
      const templates = await this._load();
      
      // Check if template already exists
      const existingIndex = templates.findIndex(t => t.id === template.id);
      
      if (existingIndex >= 0) {
        // Update existing template
        templates[existingIndex] = template;
      } else {
        // Add new template
        templates.push(template);
      }
      
      await this._save(templates);
      return template;
    } catch (error) {
      if (error instanceof StorageError) {
        throw error;
      }
      throw new StorageError(`Failed to save template: ${error.message}`);
    }
  }

  /**
   * Get template by ID
   * @param {string} templateId - Template ID
   * @returns {Promise<Object|null>} Template or null if not found
   */
  async get(templateId) {
    try {
      const templates = await this._load();
      const template = templates.find(t => t.id === templateId);
      return template || null;
    } catch (error) {
      if (error instanceof StorageError) {
        throw error;
      }
      throw new StorageError(`Failed to get template: ${error.message}`);
    }
  }

  /**
   * Get all templates
   * @returns {Promise<Array>} All templates
   */
  async getAll() {
    try {
      return await this._load();
    } catch (error) {
      if (error instanceof StorageError) {
        throw error;
      }
      throw new StorageError(`Failed to get all templates: ${error.message}`);
    }
  }

  /**
   * Get templates by group
   * @param {string} groupId - Group ID
   * @returns {Promise<Array>} Templates in group
   */
  async getByGroup(groupId) {
    try {
      const templates = await this._load();
      return templates.filter(t => t.groupId === groupId);
    } catch (error) {
      if (error instanceof StorageError) {
        throw error;
      }
      throw new StorageError(`Failed to get templates by group: ${error.message}`);
    }
  }

  /**
   * Update template
   * @param {string} templateId - Template ID
   * @param {Object} updates - Updates to apply
   * @returns {Promise<Object|null>} Updated template or null if not found
   */
  async update(templateId, updates) {
    try {
      const templates = await this._load();
      const index = templates.findIndex(t => t.id === templateId);
      
      if (index < 0) {
        return null;
      }
      
      // Apply updates
      templates[index] = {
        ...templates[index],
        ...updates,
        id: templateId, // Ensure ID doesn't change
        updatedAt: Date.now()
      };
      
      await this._save(templates);
      return templates[index];
    } catch (error) {
      if (error instanceof StorageError) {
        throw error;
      }
      throw new StorageError(`Failed to update template: ${error.message}`);
    }
  }

  /**
   * Delete template
   * @param {string} templateId - Template ID
   * @returns {Promise<boolean>} True if deleted, false if not found
   */
  async delete(templateId) {
    try {
      const templates = await this._load();
      const index = templates.findIndex(t => t.id === templateId);
      
      if (index < 0) {
        return false;
      }
      
      templates.splice(index, 1);
      await this._save(templates);
      return true;
    } catch (error) {
      if (error instanceof StorageError) {
        throw error;
      }
      throw new StorageError(`Failed to delete template: ${error.message}`);
    }
  }

  /**
   * Batch delete templates
   * @param {Array<string>} templateIds - Template IDs
   * @returns {Promise<number>} Number of templates deleted
   */
  async batchDelete(templateIds) {
    try {
      const templates = await this._load();
      const idsSet = new Set(templateIds);
      const originalLength = templates.length;
      
      const filtered = templates.filter(t => !idsSet.has(t.id));
      await this._save(filtered);
      
      return originalLength - filtered.length;
    } catch (error) {
      if (error instanceof StorageError) {
        throw error;
      }
      throw new StorageError(`Failed to batch delete templates: ${error.message}`);
    }
  }

  /**
   * Search templates by keyword
   * @param {string} keyword - Search keyword
   * @returns {Promise<Array>} Matching templates
   */
  async search(keyword) {
    try {
      if (!keyword || keyword.trim().length === 0) {
        return [];
      }
      
      const templates = await this._load();
      const lowerKeyword = keyword.toLowerCase().trim();
      
      return templates.filter(template => {
        // Search in label
        if (template.label && template.label.toLowerCase().includes(lowerKeyword)) {
          return true;
        }
        
        // Search in text content
        if (template.content && template.content.text && 
            template.content.text.toLowerCase().includes(lowerKeyword)) {
          return true;
        }
        
        // Search in contact info
        if (template.content && template.content.contactInfo) {
          const contact = template.content.contactInfo;
          if ((contact.name && contact.name.toLowerCase().includes(lowerKeyword)) ||
              (contact.phone && contact.phone.includes(lowerKeyword)) ||
              (contact.email && contact.email.toLowerCase().includes(lowerKeyword))) {
            return true;
          }
        }
        
        return false;
      });
    } catch (error) {
      if (error instanceof StorageError) {
        throw error;
      }
      throw new StorageError(`Failed to search templates: ${error.message}`);
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

module.exports = TemplateStorage;
