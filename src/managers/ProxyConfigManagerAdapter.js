/**
 * ProxyConfigManagerAdapter - Adapter for ProxyRepository with legacy API compatibility
 * 
 * Provides backward compatibility while using the new Repository pattern.
 * The legacy ProxyConfigManager has been removed - this adapter now uses ProxyRepository directly.
 * 
 * @module managers/ProxyConfigManagerAdapter
 */

'use strict';

const ProxyRepository = require('../infrastructure/repositories/ProxyRepository');
const ProxyConfig = require('../domain/entities/ProxyConfig');

/**
 * ProxyConfigManagerAdapter class
 * 
 * Provides a unified interface that wraps ProxyRepository with the legacy
 * ProxyConfigManager API for backward compatibility.
 * 
 * Note: The legacy ProxyConfigManager has been removed. This adapter now
 * always uses ProxyRepository internally.
 */
class ProxyConfigManagerAdapter {
  /**
   * Creates a ProxyConfigManagerAdapter instance
   * @param {Object} options - Configuration options
   * @param {string} [options.cwd] - Configuration file directory
   * @param {string} [options.storagePath] - Storage path for repository
   * @param {boolean} [options.useRepository=true] - Always true now (legacy option kept for compatibility)
   */
  constructor(options = {}) {
    this._options = options;
    // Always use repository now (legacy ProxyConfigManager has been removed)
    this._useRepository = true;
    
    // Initialize ProxyRepository
    this._repository = new ProxyRepository({
      storagePath: options.storagePath || options.cwd || 'session-data'
    });
    this._legacyManager = null; // No longer available
  }


  /**
   * Get all proxy configurations
   * @param {boolean} [decrypt=true] - Whether to decrypt passwords (kept for API compatibility)
   * @returns {Promise<Array>}
   */
  async getAllProxyConfigs(decrypt = true) {
    const configs = await this._repository.findAll();
    // Note: Repository doesn't handle encryption, that's done at a higher level
    return configs;
  }

  /**
   * Get a single proxy configuration
   * @param {string} id - Configuration ID
   * @param {boolean} [decrypt=true] - Whether to decrypt password (kept for API compatibility)
   * @returns {Promise<Object|null>}
   */
  async getProxyConfig(id, decrypt = true) {
    return this._repository.findById(id);
  }

  /**
   * Save a proxy configuration
   * @param {Object} config - Proxy configuration
   * @returns {Promise<{success: boolean, errors?: string[]}>}
   */
  async saveProxyConfig(config) {
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

  /**
   * Delete a proxy configuration
   * @param {string} id - Configuration ID
   * @returns {Promise<{success: boolean, errors?: string[]}>}
   */
  async deleteProxyConfig(id) {
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

  /**
   * Generate a configuration name
   * @param {Object} config - Configuration object
   * @returns {string}
   */
  generateConfigName(config) {
    const protocol = (config.protocol || 'socks5').toUpperCase();
    const host = config.host || 'unknown';
    const port = config.port || 0;
    
    if (config.username) {
      return `${protocol} - ${config.username}@${host}:${port}`;
    }
    return `${protocol} - ${host}:${port}`;
  }

  /**
   * Validate a proxy configuration
   * @param {Object} config - Proxy configuration
   * @returns {{valid: boolean, errors: string[]}}
   */
  validateProxyConfig(config) {
    const proxyConfig = config instanceof ProxyConfig 
      ? config 
      : new ProxyConfig(config);
    return proxyConfig.validate();
  }

  /**
   * Check if a configuration exists
   * @param {string} id - Configuration ID
   * @returns {boolean}
   */
  configExists(id) {
    return this._repository._cache ? this._repository._cache.has(id) : false;
  }

  /**
   * Get all configuration IDs
   * @returns {string[]}
   */
  getAllConfigIds() {
    return this._repository._cache ? Array.from(this._repository._cache.keys()) : [];
  }

  /**
   * Get configuration count
   * @returns {number}
   */
  getConfigCount() {
    return this._repository._cache ? this._repository._cache.size : 0;
  }


  /**
   * Clear all configurations
   * @returns {Promise<{success: boolean}>}
   */
  async clearAllConfigs() {
    try {
      await this._repository.deleteAll();
      return { success: true };
    } catch (error) {
      return { success: false };
    }
  }

  /**
   * Export all configurations
   * @returns {Promise<Object>}
   */
  async exportConfigs() {
    const configs = await this._repository.findAll();
    return {
      version: '1.0.0',
      exportDate: new Date().toISOString(),
      configs: configs.map(c => c.toJSON())
    };
  }

  /**
   * Import configurations
   * @param {Object} data - Import data
   * @param {Object} [options] - Import options
   * @returns {Promise<{success: boolean, imported: number, skipped: number, errors: string[]}>}
   */
  async importConfigs(data, options = {}) {
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

  /**
   * Find configurations by protocol
   * @param {string} protocol - Protocol type
   * @returns {Promise<Array>}
   */
  async findByProtocol(protocol) {
    return this._repository.findByProtocol(protocol);
  }

  /**
   * Find enabled configurations
   * @returns {Promise<Array>}
   */
  async findEnabled() {
    return this._repository.findEnabled();
  }

  /**
   * Get the underlying repository (for advanced use)
   * @returns {ProxyRepository}
   */
  getRepository() {
    return this._repository;
  }

  /**
   * Get the underlying legacy manager (for backward compatibility)
   * @returns {null} Always returns null - legacy manager has been removed
   * @deprecated Legacy manager has been removed, use getRepository() instead
   */
  getLegacyManager() {
    return null;
  }

  /**
   * Check if using repository mode
   * @returns {boolean} Always returns true
   */
  isUsingRepository() {
    return true;
  }
}

module.exports = ProxyConfigManagerAdapter;
