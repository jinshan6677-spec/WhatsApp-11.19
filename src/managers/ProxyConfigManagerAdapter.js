/**
 * ProxyConfigManagerAdapter - Adapter for ProxyConfigManager to Repository pattern
 * 
 * Provides backward compatibility while integrating with the new Repository pattern.
 * Wraps the existing ProxyConfigManager and delegates to ProxyRepository when available.
 * 
 * @module managers/ProxyConfigManagerAdapter
 */

'use strict';

const ProxyConfigManager = require('./ProxyConfigManager');
const ProxyRepository = require('../infrastructure/repositories/ProxyRepository');
const ProxyConfig = require('../domain/entities/ProxyConfig');

/**
 * ProxyConfigManagerAdapter class
 * 
 * Provides a unified interface that works with both the legacy ProxyConfigManager
 * and the new ProxyRepository pattern.
 */
class ProxyConfigManagerAdapter {
  /**
   * Creates a ProxyConfigManagerAdapter instance
   * @param {Object} options - Configuration options
   * @param {string} [options.cwd] - Configuration file directory
   * @param {string} [options.storagePath] - Storage path for repository
   * @param {boolean} [options.useRepository=false] - Whether to use the new Repository pattern
   */
  constructor(options = {}) {
    this._options = options;
    this._useRepository = options.useRepository || false;
    
    // Initialize the appropriate backend
    if (this._useRepository) {
      this._repository = new ProxyRepository({
        storagePath: options.storagePath || options.cwd || 'session-data'
      });
      this._legacyManager = null;
    } else {
      this._legacyManager = new ProxyConfigManager(options);
      this._repository = null;
    }
  }


  /**
   * Get all proxy configurations
   * @param {boolean} [decrypt=true] - Whether to decrypt passwords
   * @returns {Promise<Array>}
   */
  async getAllProxyConfigs(decrypt = true) {
    if (this._useRepository) {
      const configs = await this._repository.findAll();
      // Note: Repository doesn't handle encryption, that's done at a higher level
      return configs;
    }
    return this._legacyManager.getAllProxyConfigs(decrypt);
  }

  /**
   * Get a single proxy configuration
   * @param {string} id - Configuration ID
   * @param {boolean} [decrypt=true] - Whether to decrypt password
   * @returns {Promise<Object|null>}
   */
  async getProxyConfig(id, decrypt = true) {
    if (this._useRepository) {
      return this._repository.findById(id);
    }
    return this._legacyManager.getProxyConfig(id, decrypt);
  }

  /**
   * Save a proxy configuration
   * @param {Object} config - Proxy configuration
   * @returns {Promise<{success: boolean, errors?: string[]}>}
   */
  async saveProxyConfig(config) {
    if (this._useRepository) {
      try {
        const proxyConfig = config instanceof ProxyConfig 
          ? config 
          : ProxyConfig.fromJSON(config.toJSON ? config.toJSON() : config);
        await this._repository.save(proxyConfig);
        return { success: true };
      } catch (error) {
        return {
          success: false,
          errors: [error.message]
        };
      }
    }
    return this._legacyManager.saveProxyConfig(config);
  }

  /**
   * Delete a proxy configuration
   * @param {string} id - Configuration ID
   * @returns {Promise<{success: boolean, errors?: string[]}>}
   */
  async deleteProxyConfig(id) {
    if (this._useRepository) {
      try {
        await this._repository.delete(id);
        return { success: true };
      } catch (error) {
        return {
          success: false,
          errors: [error.message]
        };
      }
    }
    return this._legacyManager.deleteProxyConfig(id);
  }

  /**
   * Generate a configuration name
   * @param {Object} config - Configuration object
   * @returns {string}
   */
  generateConfigName(config) {
    if (this._useRepository) {
      const protocol = (config.protocol || 'socks5').toUpperCase();
      const host = config.host || 'unknown';
      const port = config.port || 0;
      
      if (config.username) {
        return `${protocol} - ${config.username}@${host}:${port}`;
      }
      return `${protocol} - ${host}:${port}`;
    }
    return this._legacyManager.generateConfigName(config);
  }

  /**
   * Validate a proxy configuration
   * @param {Object} config - Proxy configuration
   * @returns {{valid: boolean, errors: string[]}}
   */
  validateProxyConfig(config) {
    if (this._useRepository) {
      const proxyConfig = config instanceof ProxyConfig 
        ? config 
        : new ProxyConfig(config);
      return proxyConfig.validate();
    }
    return this._legacyManager.validateProxyConfig(config);
  }

  /**
   * Check if a configuration exists
   * @param {string} id - Configuration ID
   * @returns {boolean}
   */
  configExists(id) {
    if (this._useRepository) {
      return this._repository._cache ? this._repository._cache.has(id) : false;
    }
    return this._legacyManager.configExists(id);
  }

  /**
   * Get all configuration IDs
   * @returns {string[]}
   */
  getAllConfigIds() {
    if (this._useRepository) {
      return this._repository._cache ? Array.from(this._repository._cache.keys()) : [];
    }
    return this._legacyManager.getAllConfigIds();
  }

  /**
   * Get configuration count
   * @returns {number}
   */
  getConfigCount() {
    if (this._useRepository) {
      return this._repository._cache ? this._repository._cache.size : 0;
    }
    return this._legacyManager.getConfigCount();
  }


  /**
   * Clear all configurations
   * @returns {Promise<{success: boolean}>}
   */
  async clearAllConfigs() {
    if (this._useRepository) {
      try {
        await this._repository.deleteAll();
        return { success: true };
      } catch (error) {
        return { success: false };
      }
    }
    return this._legacyManager.clearAllConfigs();
  }

  /**
   * Export all configurations
   * @returns {Promise<Object>}
   */
  async exportConfigs() {
    if (this._useRepository) {
      const configs = await this._repository.findAll();
      return {
        version: '1.0.0',
        exportDate: new Date().toISOString(),
        configs: configs.map(c => c.toJSON())
      };
    }
    return this._legacyManager.exportConfigs();
  }

  /**
   * Import configurations
   * @param {Object} data - Import data
   * @param {Object} [options] - Import options
   * @returns {Promise<{success: boolean, imported: number, skipped: number, errors: string[]}>}
   */
  async importConfigs(data, options = {}) {
    if (this._useRepository) {
      const errors = [];
      let imported = 0;
      let skipped = 0;

      if (!data.configs || !Array.isArray(data.configs)) {
        return {
          success: false,
          imported: 0,
          skipped: 0,
          errors: ['Invalid import data format']
        };
      }

      for (const configData of data.configs) {
        try {
          const config = ProxyConfig.fromJSON(configData);
          const exists = await this._repository.exists(config.id);
          
          if (exists && !options.overwrite) {
            skipped++;
            continue;
          }

          await this._repository.save(config);
          imported++;
        } catch (error) {
          errors.push(`Failed to import config: ${error.message}`);
          skipped++;
        }
      }

      return {
        success: errors.length === 0,
        imported,
        skipped,
        errors
      };
    }
    return this._legacyManager.importConfigs(data, options);
  }

  /**
   * Find configurations by protocol
   * @param {string} protocol - Protocol type
   * @returns {Promise<Array>}
   */
  async findByProtocol(protocol) {
    if (this._useRepository) {
      return this._repository.findByProtocol(protocol);
    }
    // Legacy manager doesn't have this method, filter manually
    const configs = await this._legacyManager.getAllProxyConfigs();
    return configs.filter(c => c.protocol === protocol);
  }

  /**
   * Find enabled configurations
   * @returns {Promise<Array>}
   */
  async findEnabled() {
    if (this._useRepository) {
      return this._repository.findEnabled();
    }
    // Legacy manager doesn't have this method, filter manually
    const configs = await this._legacyManager.getAllProxyConfigs();
    return configs.filter(c => c.enabled === true);
  }

  /**
   * Get the underlying repository (for advanced use)
   * @returns {ProxyRepository|null}
   */
  getRepository() {
    return this._repository;
  }

  /**
   * Get the underlying legacy manager (for backward compatibility)
   * @returns {ProxyConfigManager|null}
   */
  getLegacyManager() {
    return this._legacyManager;
  }

  /**
   * Check if using repository mode
   * @returns {boolean}
   */
  isUsingRepository() {
    return this._useRepository;
  }
}

module.exports = ProxyConfigManagerAdapter;
