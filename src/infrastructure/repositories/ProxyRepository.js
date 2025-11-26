'use strict';

const fs = require('fs').promises;
const path = require('path');
const IProxyRepository = require('../../domain/repositories/IProxyRepository');
const ProxyConfig = require('../../domain/entities/ProxyConfig');
const ValidationError = require('../../core/errors/ValidationError');
const StorageError = require('../../core/errors/StorageError');

/**
 * Proxy Repository Implementation
 * 
 * Provides data access for ProxyConfig entities using file-based storage.
 * 
 * @extends IProxyRepository
 */
class ProxyRepository extends IProxyRepository {
  /**
   * Creates a ProxyRepository instance
   * @param {Object} options - Repository options
   * @param {string} [options.storagePath] - Path to storage directory
   * @param {string} [options.fileName] - Name of the proxies file
   */
  constructor(options = {}) {
    super();
    this.storagePath = options.storagePath || 'session-data';
    this.fileName = options.fileName || 'proxies.json';
    this.filePath = path.join(this.storagePath, this.fileName);
    this._cache = null;
    this._cacheTime = null;
    this._cacheTTL = options.cacheTTL || 5000; // 5 seconds cache
  }

  /**
   * Loads proxies from storage
   * @private
   * @returns {Promise<Map<string, ProxyConfig>>}
   */
  async _load() {
    // Check cache
    if (this._cache && this._cacheTime && (Date.now() - this._cacheTime < this._cacheTTL)) {
      return this._cache;
    }

    try {
      const data = await fs.readFile(this.filePath, 'utf-8');
      const parsed = JSON.parse(data);
      const proxies = new Map();
      
      for (const item of (Array.isArray(parsed) ? parsed : [])) {
        const proxy = ProxyConfig.fromJSON(item);
        proxies.set(proxy.id, proxy);
      }
      
      this._cache = proxies;
      this._cacheTime = Date.now();
      return proxies;
    } catch (error) {
      if (error.code === 'ENOENT') {
        // File doesn't exist, return empty map
        this._cache = new Map();
        this._cacheTime = Date.now();
        return this._cache;
      }
      throw StorageError.readFailed(this.filePath, error);
    }
  }

  /**
   * Saves proxies to storage
   * @private
   * @param {Map<string, ProxyConfig>} proxies
   * @returns {Promise<void>}
   */
  async _save(proxies) {
    try {
      // Ensure directory exists
      await fs.mkdir(this.storagePath, { recursive: true });
      
      const data = Array.from(proxies.values()).map(p => p.toJSON());
      await fs.writeFile(this.filePath, JSON.stringify(data, null, 2), 'utf-8');
      
      // Update cache
      this._cache = proxies;
      this._cacheTime = Date.now();
    } catch (error) {
      throw StorageError.writeFailed(this.filePath, error);
    }
  }

  /**
   * Invalidates the cache
   */
  invalidateCache() {
    this._cache = null;
    this._cacheTime = null;
  }

  // ==================== IRepository Methods ====================

  async findById(id) {
    const proxies = await this._load();
    const proxy = proxies.get(id);
    return proxy || null;
  }

  async findAll() {
    const proxies = await this._load();
    return Array.from(proxies.values());
  }

  async findBy(criteria) {
    const proxies = await this._load();
    return Array.from(proxies.values()).filter(proxy => {
      for (const [key, value] of Object.entries(criteria)) {
        if (proxy[key] !== value) {
          return false;
        }
      }
      return true;
    });
  }

  async save(entity) {
    // Validate before saving
    const validation = entity.validate();
    if (!validation.valid) {
      throw new ValidationError('ProxyConfig validation failed', {
        fields: validation.errors
      });
    }

    const proxies = await this._load();
    proxies.set(entity.id, entity);
    await this._save(proxies);
    return entity;
  }

  async update(id, data) {
    const proxies = await this._load();
    const existing = proxies.get(id);
    
    if (!existing) {
      throw new ValidationError(`ProxyConfig not found: ${id}`, {
        fields: [{ field: 'id', reason: 'ProxyConfig does not exist', value: id }]
      });
    }

    // Create updated proxy
    const updated = new ProxyConfig({
      ...existing.toJSON(),
      ...data,
      id: existing.id // Ensure ID cannot be changed
    });

    // Validate updated proxy
    const validation = updated.validate();
    if (!validation.valid) {
      throw new ValidationError('ProxyConfig validation failed', {
        fields: validation.errors
      });
    }

    proxies.set(id, updated);
    await this._save(proxies);
    return updated;
  }

  async delete(id) {
    const proxies = await this._load();
    const existed = proxies.has(id);
    
    if (existed) {
      proxies.delete(id);
      await this._save(proxies);
    }
    
    return existed;
  }

  async exists(id) {
    const proxies = await this._load();
    return proxies.has(id);
  }

  async count() {
    const proxies = await this._load();
    return proxies.size;
  }

  async deleteAll() {
    await this._save(new Map());
  }

  // ==================== IProxyRepository Methods ====================

  async findByProtocol(protocol) {
    const proxies = await this._load();
    return Array.from(proxies.values()).filter(
      proxy => proxy.protocol === protocol
    );
  }

  async findEnabled() {
    const proxies = await this._load();
    return Array.from(proxies.values()).filter(
      proxy => proxy.enabled === true
    );
  }

  async findByHost(host) {
    const proxies = await this._load();
    return Array.from(proxies.values()).filter(
      proxy => proxy.host === host
    );
  }

  async findByName(name) {
    const proxies = await this._load();
    for (const proxy of proxies.values()) {
      if (proxy.name === name) {
        return proxy;
      }
    }
    return null;
  }

  async updateLastUsed(id) {
    const proxies = await this._load();
    const proxy = proxies.get(id);
    
    if (!proxy) {
      throw new ValidationError(`ProxyConfig not found: ${id}`, {
        fields: [{ field: 'id', reason: 'ProxyConfig does not exist', value: id }]
      });
    }

    proxy.updateLastUsed();
    await this._save(proxies);
  }

  async validate(proxy) {
    return proxy.validate();
  }

  // ==================== Connection Statistics Methods ====================

  /**
   * Adds connection statistics to a proxy
   * @param {string} id - Proxy ID
   * @param {Object} stats - Statistics to add
   * @param {number} [stats.latency] - Connection latency in ms
   * @param {boolean} [stats.success] - Whether connection was successful
   * @param {string} [stats.ip] - Verified exit IP
   * @returns {Promise<ProxyConfig>}
   */
  async addConnectionStats(id, stats) {
    const proxies = await this._load();
    const proxy = proxies.get(id);
    
    if (!proxy) {
      throw new ValidationError(`ProxyConfig not found: ${id}`, {
        fields: [{ field: 'id', reason: 'ProxyConfig does not exist', value: id }]
      });
    }

    // Update connection count
    proxy.connectionCount = (proxy.connectionCount || 0) + 1;
    
    // Update success/failure counts
    if (stats.success) {
      proxy.successCount = (proxy.successCount || 0) + 1;
    } else {
      proxy.failureCount = (proxy.failureCount || 0) + 1;
    }
    
    // Update last connected time
    if (stats.success) {
      proxy.lastConnectedAt = new Date();
    }
    
    // Update last verified IP
    if (stats.ip) {
      proxy.lastVerifiedIP = stats.ip;
    }

    await this._save(proxies);
    return proxy;
  }

  /**
   * Gets connection statistics for a proxy
   * @param {string} id - Proxy ID
   * @returns {Promise<Object|null>}
   */
  async getConnectionStats(id) {
    const proxy = await this.findById(id);
    
    if (!proxy) {
      return null;
    }

    return {
      connectionCount: proxy.connectionCount || 0,
      successCount: proxy.successCount || 0,
      failureCount: proxy.failureCount || 0,
      successRate: this._calculateSuccessRate(proxy),
      lastConnectedAt: proxy.lastConnectedAt,
      lastVerifiedIP: proxy.lastVerifiedIP
    };
  }

  /**
   * Increments the success count for a proxy
   * @param {string} id - Proxy ID
   * @returns {Promise<void>}
   */
  async incrementSuccessCount(id) {
    const proxies = await this._load();
    const proxy = proxies.get(id);
    
    if (!proxy) {
      throw new ValidationError(`ProxyConfig not found: ${id}`, {
        fields: [{ field: 'id', reason: 'ProxyConfig does not exist', value: id }]
      });
    }

    proxy.successCount = (proxy.successCount || 0) + 1;
    proxy.connectionCount = (proxy.connectionCount || 0) + 1;
    proxy.lastConnectedAt = new Date();
    
    await this._save(proxies);
  }

  /**
   * Increments the failure count for a proxy
   * @param {string} id - Proxy ID
   * @returns {Promise<void>}
   */
  async incrementFailureCount(id) {
    const proxies = await this._load();
    const proxy = proxies.get(id);
    
    if (!proxy) {
      throw new ValidationError(`ProxyConfig not found: ${id}`, {
        fields: [{ field: 'id', reason: 'ProxyConfig does not exist', value: id }]
      });
    }

    proxy.failureCount = (proxy.failureCount || 0) + 1;
    proxy.connectionCount = (proxy.connectionCount || 0) + 1;
    
    await this._save(proxies);
  }

  /**
   * Gets the success rate for a proxy
   * @param {string} id - Proxy ID
   * @returns {Promise<number>} Success rate as percentage (0-100)
   */
  async getSuccessRate(id) {
    const proxy = await this.findById(id);
    
    if (!proxy) {
      return 0;
    }

    return this._calculateSuccessRate(proxy);
  }

  /**
   * Calculates success rate for a proxy
   * @private
   * @param {ProxyConfig} proxy - Proxy configuration
   * @returns {number} Success rate as percentage (0-100)
   */
  _calculateSuccessRate(proxy) {
    const total = (proxy.connectionCount || 0);
    if (total === 0) {
      return 0;
    }
    
    const success = (proxy.successCount || 0);
    return Math.round((success / total) * 100);
  }

  /**
   * Resets connection statistics for a proxy
   * @param {string} id - Proxy ID
   * @returns {Promise<void>}
   */
  async resetConnectionStats(id) {
    const proxies = await this._load();
    const proxy = proxies.get(id);
    
    if (!proxy) {
      throw new ValidationError(`ProxyConfig not found: ${id}`, {
        fields: [{ field: 'id', reason: 'ProxyConfig does not exist', value: id }]
      });
    }

    proxy.connectionCount = 0;
    proxy.successCount = 0;
    proxy.failureCount = 0;
    proxy.lastConnectedAt = null;
    proxy.lastVerifiedIP = null;
    
    await this._save(proxies);
  }

  /**
   * Gets proxies sorted by success rate
   * @param {boolean} [ascending=false] - Sort order
   * @returns {Promise<ProxyConfig[]>}
   */
  async findBySuccessRate(ascending = false) {
    const proxies = await this.findAll();
    
    return proxies.sort((a, b) => {
      const rateA = this._calculateSuccessRate(a);
      const rateB = this._calculateSuccessRate(b);
      return ascending ? rateA - rateB : rateB - rateA;
    });
  }
}

module.exports = ProxyRepository;
