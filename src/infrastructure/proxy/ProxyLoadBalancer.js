'use strict';

const ProxyConfig = require('../../domain/entities/ProxyConfig');

/**
 * Selection Strategy
 * @readonly
 * @enum {string}
 */
const SelectionStrategy = {
  LOWEST_LATENCY: 'lowest_latency',
  HIGHEST_SUCCESS_RATE: 'highest_success_rate',
  LEAST_RECENTLY_USED: 'least_recently_used',
  ROUND_ROBIN: 'round_robin',
  RANDOM: 'random'
};

/**
 * ProxyLoadBalancer - Proxy Pool Load Balancing
 * 
 * Manages proxy pools for accounts with intelligent selection:
 * - Multiple selection strategies
 * - Automatic failover on proxy failure
 * - Performance-based proxy selection
 * 
 * @class
 */
class ProxyLoadBalancer {
  /**
   * Creates a ProxyLoadBalancer instance
   * @param {Object} [options={}] - Configuration options
   * @param {Function} [options.logger] - Logger function
   * @param {Object} [options.eventBus] - Event bus for publishing events
   * @param {string} [options.defaultStrategy] - Default selection strategy
   */
  constructor(options = {}) {
    this.options = options;
    this.log = options.logger || this._createLogger();
    this.eventBus = options.eventBus || null;
    this.defaultStrategy = options.defaultStrategy || SelectionStrategy.LOWEST_LATENCY;
    
    // Track proxy pools per account: accountId -> ProxyPool
    this._pools = new Map();
    
    // Track proxy metrics: proxyId -> Metrics
    this._metrics = new Map();
    
    // Round-robin index per account
    this._roundRobinIndex = new Map();
  }

  /**
   * Creates a default logger
   * @private
   * @returns {Function}
   */
  _createLogger() {
    return (level, message, ...args) => {
      const timestamp = new Date().toISOString();
      const prefix = `[${timestamp}] [ProxyLoadBalancer] [${level.toUpperCase()}]`;
      
      if (level === 'error') {
        console.error(prefix, message, ...args);
      } else if (level === 'warn') {
        console.warn(prefix, message, ...args);
      } else {
        console.log(prefix, message, ...args);
      }
    };
  }

  // ==================== Core Methods ====================

  /**
   * Sets the proxy pool for an account
   * @param {string} accountId - Account ID
   * @param {Array<ProxyConfig|Object>} proxies - Array of proxy configurations
   * @param {Object} [options={}] - Pool options
   * @param {string} [options.strategy] - Selection strategy
   * @returns {boolean} True if pool was set
   */
  setProxyPool(accountId, proxies, options = {}) {
    if (!accountId) {
      this.log('error', 'Account ID is required');
      return false;
    }

    if (!Array.isArray(proxies) || proxies.length === 0) {
      this.log('error', 'Proxies array is required and must not be empty');
      return false;
    }

    // Normalize proxies to ProxyConfig instances
    const normalizedProxies = proxies.map(p => 
      p instanceof ProxyConfig ? p : new ProxyConfig(p)
    );

    // Filter out invalid proxies
    const validProxies = normalizedProxies.filter(p => {
      const validation = p.validate();
      if (!validation.valid) {
        this.log('warn', `Skipping invalid proxy ${p.id}: ${validation.errors.map(e => e.reason).join(', ')}`);
        return false;
      }
      return true;
    });

    if (validProxies.length === 0) {
      this.log('error', 'No valid proxies in the pool');
      return false;
    }

    // Initialize metrics for each proxy
    for (const proxy of validProxies) {
      if (!this._metrics.has(proxy.id)) {
        this._metrics.set(proxy.id, {
          proxyId: proxy.id,
          latency: null,
          successCount: 0,
          failureCount: 0,
          lastUsedAt: null,
          isBlacklisted: false
        });
      }
    }

    // Create pool
    const pool = {
      accountId,
      proxies: validProxies,
      strategy: options.strategy || this.defaultStrategy,
      currentProxyId: null,
      createdAt: new Date()
    };

    this._pools.set(accountId, pool);
    this._roundRobinIndex.set(accountId, 0);

    this.log('info', `Set proxy pool for account ${accountId} with ${validProxies.length} proxies (strategy: ${pool.strategy})`);

    return true;
  }

  /**
   * Gets the best proxy for an account based on the selection strategy
   * @param {string} accountId - Account ID
   * @param {Object} [options={}] - Selection options
   * @param {string} [options.strategy] - Override strategy for this selection
   * @param {string[]} [options.excludeIds] - Proxy IDs to exclude
   * @returns {{proxy: ProxyConfig|null, reason: string}}
   */
  getBestProxy(accountId, options = {}) {
    const pool = this._pools.get(accountId);
    
    if (!pool) {
      return {
        proxy: null,
        reason: 'No proxy pool configured for this account'
      };
    }

    const strategy = options.strategy || pool.strategy;
    const excludeIds = new Set(options.excludeIds || []);

    // Filter available proxies (not blacklisted, not excluded)
    const availableProxies = pool.proxies.filter(p => {
      const metrics = this._metrics.get(p.id);
      return !excludeIds.has(p.id) && (!metrics || !metrics.isBlacklisted);
    });

    if (availableProxies.length === 0) {
      return {
        proxy: null,
        reason: 'No available proxies (all blacklisted or excluded)'
      };
    }

    let selectedProxy;
    let reason;

    switch (strategy) {
      case SelectionStrategy.LOWEST_LATENCY:
        selectedProxy = this._selectByLowestLatency(availableProxies);
        reason = 'Selected by lowest latency';
        break;

      case SelectionStrategy.HIGHEST_SUCCESS_RATE:
        selectedProxy = this._selectByHighestSuccessRate(availableProxies);
        reason = 'Selected by highest success rate';
        break;

      case SelectionStrategy.LEAST_RECENTLY_USED:
        selectedProxy = this._selectByLeastRecentlyUsed(availableProxies);
        reason = 'Selected by least recently used';
        break;

      case SelectionStrategy.ROUND_ROBIN:
        selectedProxy = this._selectByRoundRobin(accountId, availableProxies);
        reason = 'Selected by round-robin';
        break;

      case SelectionStrategy.RANDOM:
        selectedProxy = this._selectRandom(availableProxies);
        reason = 'Selected randomly';
        break;

      default:
        selectedProxy = availableProxies[0];
        reason = 'Selected first available (unknown strategy)';
    }

    // Update current proxy
    pool.currentProxyId = selectedProxy.id;

    // Update last used time
    const metrics = this._metrics.get(selectedProxy.id);
    if (metrics) {
      metrics.lastUsedAt = new Date();
    }

    this.log('info', `Selected proxy ${selectedProxy.id} for account ${accountId} (${reason})`);

    return {
      proxy: selectedProxy,
      reason
    };
  }

  /**
   * Handles failover when a proxy fails
   * @param {string} accountId - Account ID
   * @param {string} failedProxyId - ID of the failed proxy
   * @param {Object} [options={}] - Failover options
   * @param {boolean} [options.blacklist=true] - Whether to blacklist the failed proxy
   * @returns {Promise<{proxy: ProxyConfig|null, reason: string}>}
   */
  async failover(accountId, failedProxyId, options = {}) {
    const pool = this._pools.get(accountId);
    
    if (!pool) {
      return {
        proxy: null,
        reason: 'No proxy pool configured for this account'
      };
    }

    this.log('warn', `Failover triggered for account ${accountId}, failed proxy: ${failedProxyId}`);

    // Record failure
    const metrics = this._metrics.get(failedProxyId);
    if (metrics) {
      metrics.failureCount++;
      
      // Optionally blacklist the failed proxy
      if (options.blacklist !== false) {
        metrics.isBlacklisted = true;
        this.log('info', `Blacklisted proxy ${failedProxyId} due to failure`);
      }
    }

    // Emit failover event
    if (this.eventBus) {
      await this.eventBus.publish('proxy:failover_triggered', {
        accountId,
        failedProxyId,
        timestamp: new Date().toISOString()
      });
    }

    // Get next best proxy (excluding the failed one)
    const result = this.getBestProxy(accountId, {
      excludeIds: [failedProxyId]
    });

    if (result.proxy) {
      this.log('info', `Failover to proxy ${result.proxy.id} for account ${accountId}`);
      
      // Emit success event
      if (this.eventBus) {
        await this.eventBus.publish('proxy:failover_success', {
          accountId,
          failedProxyId,
          newProxyId: result.proxy.id,
          timestamp: new Date().toISOString()
        });
      }
    } else {
      this.log('error', `Failover failed for account ${accountId}: ${result.reason}`);
      
      // Emit failure event
      if (this.eventBus) {
        await this.eventBus.publish('proxy:failover_failed', {
          accountId,
          failedProxyId,
          reason: result.reason,
          timestamp: new Date().toISOString()
        });
      }
    }

    return result;
  }

  /**
   * Records proxy success
   * @param {string} proxyId - Proxy ID
   * @param {number} [latency] - Response latency in ms
   */
  recordSuccess(proxyId, latency = null) {
    const metrics = this._metrics.get(proxyId);
    if (metrics) {
      metrics.successCount++;
      if (latency !== null) {
        // Update latency with exponential moving average
        if (metrics.latency === null) {
          metrics.latency = latency;
        } else {
          metrics.latency = metrics.latency * 0.7 + latency * 0.3;
        }
      }
      metrics.lastUsedAt = new Date();
    }
  }

  /**
   * Records proxy failure
   * @param {string} proxyId - Proxy ID
   */
  recordFailure(proxyId) {
    const metrics = this._metrics.get(proxyId);
    if (metrics) {
      metrics.failureCount++;
    }
  }

  // ==================== Selection Strategies ====================

  /**
   * Selects proxy with lowest latency
   * @private
   * @param {ProxyConfig[]} proxies - Available proxies
   * @returns {ProxyConfig}
   */
  _selectByLowestLatency(proxies) {
    let bestProxy = proxies[0];
    let bestLatency = Infinity;

    for (const proxy of proxies) {
      const metrics = this._metrics.get(proxy.id);
      const latency = metrics?.latency ?? Infinity;
      
      if (latency < bestLatency) {
        bestLatency = latency;
        bestProxy = proxy;
      }
    }

    return bestProxy;
  }

  /**
   * Selects proxy with highest success rate
   * @private
   * @param {ProxyConfig[]} proxies - Available proxies
   * @returns {ProxyConfig}
   */
  _selectByHighestSuccessRate(proxies) {
    let bestProxy = proxies[0];
    let bestRate = -1;

    for (const proxy of proxies) {
      const metrics = this._metrics.get(proxy.id);
      if (!metrics) continue;

      const total = metrics.successCount + metrics.failureCount;
      const rate = total > 0 ? metrics.successCount / total : 0.5; // Default 50% for new proxies
      
      if (rate > bestRate) {
        bestRate = rate;
        bestProxy = proxy;
      }
    }

    return bestProxy;
  }

  /**
   * Selects least recently used proxy
   * @private
   * @param {ProxyConfig[]} proxies - Available proxies
   * @returns {ProxyConfig}
   */
  _selectByLeastRecentlyUsed(proxies) {
    let bestProxy = proxies[0];
    let oldestTime = Infinity;

    for (const proxy of proxies) {
      const metrics = this._metrics.get(proxy.id);
      const lastUsed = metrics?.lastUsedAt?.getTime() ?? 0;
      
      if (lastUsed < oldestTime) {
        oldestTime = lastUsed;
        bestProxy = proxy;
      }
    }

    return bestProxy;
  }

  /**
   * Selects proxy using round-robin
   * @private
   * @param {string} accountId - Account ID
   * @param {ProxyConfig[]} proxies - Available proxies
   * @returns {ProxyConfig}
   */
  _selectByRoundRobin(accountId, proxies) {
    let index = this._roundRobinIndex.get(accountId) || 0;
    index = index % proxies.length;
    
    const proxy = proxies[index];
    this._roundRobinIndex.set(accountId, index + 1);
    
    return proxy;
  }

  /**
   * Selects random proxy
   * @private
   * @param {ProxyConfig[]} proxies - Available proxies
   * @returns {ProxyConfig}
   */
  _selectRandom(proxies) {
    const index = Math.floor(Math.random() * proxies.length);
    return proxies[index];
  }

  // ==================== Query Methods ====================

  /**
   * Gets the proxy pool for an account
   * @param {string} accountId - Account ID
   * @returns {Object|null}
   */
  getPool(accountId) {
    const pool = this._pools.get(accountId);
    if (!pool) return null;

    return {
      accountId: pool.accountId,
      proxyCount: pool.proxies.length,
      strategy: pool.strategy,
      currentProxyId: pool.currentProxyId,
      createdAt: pool.createdAt,
      proxies: pool.proxies.map(p => ({
        id: p.id,
        host: p.host,
        port: p.port,
        protocol: p.protocol,
        metrics: this._metrics.get(p.id)
      }))
    };
  }

  /**
   * Gets metrics for a proxy
   * @param {string} proxyId - Proxy ID
   * @returns {Object|null}
   */
  getMetrics(proxyId) {
    return this._metrics.get(proxyId) || null;
  }

  /**
   * Removes blacklist status from a proxy
   * @param {string} proxyId - Proxy ID
   * @returns {boolean}
   */
  unblacklist(proxyId) {
    const metrics = this._metrics.get(proxyId);
    if (metrics) {
      metrics.isBlacklisted = false;
      this.log('info', `Removed blacklist status from proxy ${proxyId}`);
      return true;
    }
    return false;
  }

  /**
   * Removes proxy pool for an account
   * @param {string} accountId - Account ID
   * @returns {boolean}
   */
  removePool(accountId) {
    const removed = this._pools.delete(accountId);
    this._roundRobinIndex.delete(accountId);
    if (removed) {
      this.log('info', `Removed proxy pool for account ${accountId}`);
    }
    return removed;
  }

  // ==================== Lifecycle Methods ====================

  /**
   * Cleans up all resources
   */
  cleanup() {
    this.log('info', 'Cleaning up ProxyLoadBalancer...');
    this._pools.clear();
    this._metrics.clear();
    this._roundRobinIndex.clear();
    this.log('info', 'ProxyLoadBalancer cleanup complete');
  }

  /**
   * Alias for cleanup
   */
  destroy() {
    this.cleanup();
  }
}

// Export class and enums
ProxyLoadBalancer.Strategy = SelectionStrategy;
module.exports = ProxyLoadBalancer;
