'use strict';

const IRepository = require('./IRepository');

/**
 * Proxy Repository Interface
 * 
 * Extends the base repository with proxy-specific operations.
 * 
 * @extends IRepository<ProxyConfig, string>
 */
class IProxyRepository extends IRepository {
  /**
   * Finds proxy configurations by protocol
   * @param {string} protocol - Proxy protocol (http, https, socks5)
   * @returns {Promise<ProxyConfig[]>} Array of matching proxy configs
   */
  async findByProtocol(protocol) {
    throw new Error('Method not implemented: findByProtocol');
  }

  /**
   * Finds all enabled proxy configurations
   * @returns {Promise<ProxyConfig[]>} Array of enabled proxy configs
   */
  async findEnabled() {
    throw new Error('Method not implemented: findEnabled');
  }

  /**
   * Finds proxy configurations by host
   * @param {string} host - Proxy host
   * @returns {Promise<ProxyConfig[]>} Array of matching proxy configs
   */
  async findByHost(host) {
    throw new Error('Method not implemented: findByHost');
  }

  /**
   * Finds a proxy configuration by name
   * @param {string} name - Proxy name
   * @returns {Promise<ProxyConfig|null>} The proxy config or null if not found
   */
  async findByName(name) {
    throw new Error('Method not implemented: findByName');
  }

  /**
   * Updates the last used timestamp for a proxy
   * @param {string} id - Proxy identifier
   * @returns {Promise<void>}
   */
  async updateLastUsed(id) {
    throw new Error('Method not implemented: updateLastUsed');
  }

  /**
   * Validates a proxy configuration
   * @param {ProxyConfig} proxy - Proxy configuration to validate
   * @returns {Promise<{valid: boolean, errors: Array<{field: string, reason: string}>}>}
   */
  async validate(proxy) {
    throw new Error('Method not implemented: validate');
  }
}

module.exports = IProxyRepository;
