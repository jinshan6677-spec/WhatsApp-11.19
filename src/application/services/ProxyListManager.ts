/**
 * ProxyListManager - Application Service for Proxy List Management
 * 
 * Manages proxy configurations and their bindings to accounts:
 * - Fixed proxy binding to accounts
 * - Proxy change with resource cleanup
 * - Proxy status tracking
 * 
 * Requirements: 34.1-34.6
 */

import * as fs from 'fs';
import * as path from 'path';
import { ProxyRelayService, ProxyRelayInfo, ProxyTestResult } from './ProxyRelayService';

export interface ProxyConfig {
  id: string;
  name: string;
  protocol: 'socks5' | 'http' | 'https';
  host: string;
  port: number;
  username?: string;
  password?: string;
  country?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface AccountProxyBinding {
  accountId: string;
  proxyId: string;
  boundAt: Date;
  lastUsed?: Date;
}

export interface ProxyStatus {
  proxyId: string;
  isOnline: boolean;
  lastCheck: Date;
  responseTime?: number;
  exitIP?: string;
  error?: string;
}

export interface ProxyListManagerOptions {
  sessionDataDir?: string;
  proxyRelayService?: ProxyRelayService;
  logger?: (level: string, message: string, ...args: any[]) => void;
}

export class ProxyListManager {
  private readonly sessionDataDir: string;
  private readonly proxyRelayService: ProxyRelayService | null;
  private readonly log: (level: string, message: string, ...args: any[]) => void;
  
  // In-memory cache
  private proxies: Map<string, ProxyConfig>;
  private bindings: Map<string, AccountProxyBinding>;
  private statuses: Map<string, ProxyStatus>;

  constructor(options: ProxyListManagerOptions = {}) {
    this.sessionDataDir = options.sessionDataDir || 'session-data';
    this.proxyRelayService = options.proxyRelayService || null;
    this.log = options.logger || this.createDefaultLogger();
    
    this.proxies = new Map();
    this.bindings = new Map();
    this.statuses = new Map();
    
    // Load existing data
    this.loadProxies();
    this.loadBindings();
    
    this.log('info', 'ProxyListManager initialized');
  }

  /**
   * Creates a default logger
   */
  private createDefaultLogger(): (level: string, message: string, ...args: any[]) => void {
    return (level: string, message: string, ...args: any[]) => {
      const timestamp = new Date().toISOString();
      const prefix = `[${timestamp}] [ProxyListManager] [${level.toUpperCase()}]`;
      
      if (level === 'error') {
        console.error(prefix, message, ...args);
      } else if (level === 'warn') {
        console.warn(prefix, message, ...args);
      } else {
        console.log(prefix, message, ...args);
      }
    };
  }

  // ==================== Proxy CRUD Operations ====================

  /**
   * Adds a new proxy to the list
   * Requirements: 34.1
   */
  addProxy(config: Omit<ProxyConfig, 'id' | 'createdAt' | 'updatedAt'>): ProxyConfig {
    const proxy: ProxyConfig = {
      ...config,
      id: this.generateId(),
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    this.proxies.set(proxy.id, proxy);
    this.saveProxies();
    
    this.log('info', `Added proxy: ${proxy.name} (${proxy.host}:${proxy.port})`);
    
    return proxy;
  }

  /**
   * Updates an existing proxy
   */
  updateProxy(proxyId: string, updates: Partial<Omit<ProxyConfig, 'id' | 'createdAt'>>): ProxyConfig {
    const proxy = this.proxies.get(proxyId);
    
    if (!proxy) {
      throw new Error(`Proxy not found: ${proxyId}`);
    }
    
    const updated: ProxyConfig = {
      ...proxy,
      ...updates,
      updatedAt: new Date()
    };
    
    this.proxies.set(proxyId, updated);
    this.saveProxies();
    
    this.log('info', `Updated proxy: ${updated.name}`);
    
    return updated;
  }

  /**
   * Removes a proxy from the list
   */
  async removeProxy(proxyId: string): Promise<void> {
    const proxy = this.proxies.get(proxyId);
    
    if (!proxy) {
      throw new Error(`Proxy not found: ${proxyId}`);
    }
    
    // Check if proxy is bound to any accounts
    const boundAccounts = this.getAccountsUsingProxy(proxyId);
    if (boundAccounts.length > 0) {
      throw new Error(`Cannot remove proxy: bound to ${boundAccounts.length} account(s)`);
    }
    
    this.proxies.delete(proxyId);
    this.statuses.delete(proxyId);
    this.saveProxies();
    
    this.log('info', `Removed proxy: ${proxy.name}`);
  }

  /**
   * Gets a proxy by ID
   */
  getProxy(proxyId: string): ProxyConfig | null {
    return this.proxies.get(proxyId) || null;
  }

  /**
   * Gets all proxies
   * Requirements: 34.1
   */
  getAllProxies(): ProxyConfig[] {
    return Array.from(this.proxies.values());
  }

  // ==================== Proxy Binding Operations ====================

  /**
   * Binds a proxy to an account (fixed binding)
   * Requirements: 34.2, 34.3
   */
  async bindProxyToAccount(accountId: string, proxyId: string): Promise<AccountProxyBinding> {
    const proxy = this.proxies.get(proxyId);
    
    if (!proxy) {
      throw new Error(`Proxy not found: ${proxyId}`);
    }
    
    // Check if account already has a binding
    const existingBinding = this.bindings.get(accountId);
    if (existingBinding && existingBinding.proxyId !== proxyId) {
      // Unbind old proxy first (with cleanup)
      await this.unbindProxyFromAccount(accountId);
    }
    
    const binding: AccountProxyBinding = {
      accountId,
      proxyId,
      boundAt: new Date()
    };
    
    this.bindings.set(accountId, binding);
    this.saveBindings();
    
    this.log('info', `Bound proxy ${proxy.name} to account ${accountId}`);
    
    return binding;
  }

  /**
   * Unbinds a proxy from an account with resource cleanup
   * Requirements: 34.4
   */
  async unbindProxyFromAccount(accountId: string): Promise<void> {
    const binding = this.bindings.get(accountId);
    
    if (!binding) {
      this.log('warn', `No proxy binding found for account ${accountId}`);
      return;
    }
    
    // Stop relay if running
    if (this.proxyRelayService) {
      try {
        await this.proxyRelayService.stopRelay(accountId);
        this.log('info', `Stopped relay for account ${accountId}`);
      } catch (error) {
        this.log('warn', `Error stopping relay: ${(error as Error).message}`);
      }
    }
    
    this.bindings.delete(accountId);
    this.saveBindings();
    
    this.log('info', `Unbound proxy from account ${accountId}`);
  }

  /**
   * Changes the proxy for an account (with resource cleanup)
   * Requirements: 34.4
   */
  async changeAccountProxy(accountId: string, newProxyId: string): Promise<AccountProxyBinding> {
    const newProxy = this.proxies.get(newProxyId);
    
    if (!newProxy) {
      throw new Error(`Proxy not found: ${newProxyId}`);
    }
    
    // Get old binding
    const oldBinding = this.bindings.get(accountId);
    
    // Stop old relay if running
    if (this.proxyRelayService) {
      try {
        await this.proxyRelayService.stopRelay(accountId);
        this.log('info', `Stopped old relay for account ${accountId}`);
      } catch (error) {
        this.log('warn', `Error stopping old relay: ${(error as Error).message}`);
      }
    }
    
    // Create new binding
    const newBinding: AccountProxyBinding = {
      accountId,
      proxyId: newProxyId,
      boundAt: new Date()
    };
    
    this.bindings.set(accountId, newBinding);
    this.saveBindings();
    
    this.log('info', `Changed proxy for account ${accountId}: ${oldBinding?.proxyId || 'none'} -> ${newProxyId}`);
    
    return newBinding;
  }

  /**
   * Gets the proxy binding for an account
   */
  getAccountBinding(accountId: string): AccountProxyBinding | null {
    return this.bindings.get(accountId) || null;
  }

  /**
   * Gets the proxy configuration for an account
   * Requirements: 34.3
   */
  getAccountProxy(accountId: string): ProxyConfig | null {
    const binding = this.bindings.get(accountId);
    
    if (!binding) {
      return null;
    }
    
    return this.proxies.get(binding.proxyId) || null;
  }

  /**
   * Gets all accounts using a specific proxy
   */
  getAccountsUsingProxy(proxyId: string): string[] {
    const accounts: string[] = [];
    
    for (const [accountId, binding] of this.bindings) {
      if (binding.proxyId === proxyId) {
        accounts.push(accountId);
      }
    }
    
    return accounts;
  }

  /**
   * Gets all bindings
   */
  getAllBindings(): AccountProxyBinding[] {
    return Array.from(this.bindings.values());
  }

  // ==================== Proxy Status Operations ====================

  /**
   * Updates the status of a proxy
   * Requirements: 34.6
   */
  updateProxyStatus(proxyId: string, status: Omit<ProxyStatus, 'proxyId'>): void {
    this.statuses.set(proxyId, {
      proxyId,
      ...status
    });
  }

  /**
   * Gets the status of a proxy
   * Requirements: 34.6
   */
  getProxyStatus(proxyId: string): ProxyStatus | null {
    return this.statuses.get(proxyId) || null;
  }

  /**
   * Gets all proxy statuses
   */
  getAllProxyStatuses(): ProxyStatus[] {
    return Array.from(this.statuses.values());
  }

  /**
   * Tests a proxy and updates its status
   * Requirements: 34.5
   */
  async testProxyAndUpdateStatus(proxyId: string): Promise<ProxyStatus> {
    const proxy = this.proxies.get(proxyId);
    
    if (!proxy) {
      throw new Error(`Proxy not found: ${proxyId}`);
    }
    
    if (!this.proxyRelayService) {
      throw new Error('ProxyRelayService not available');
    }
    
    // Create a ProxyConfig object for testing
    const proxyConfig = {
      protocol: proxy.protocol,
      host: proxy.host,
      port: proxy.port,
      username: proxy.username,
      password: proxy.password,
      toJSON: () => ({
        protocol: proxy.protocol,
        host: proxy.host,
        port: proxy.port,
        username: proxy.username,
        password: proxy.password
      })
    };
    
    const result = await this.proxyRelayService.testProxy(proxyConfig);
    
    const status: ProxyStatus = {
      proxyId,
      isOnline: result.success,
      lastCheck: new Date(),
      responseTime: result.responseTime,
      exitIP: result.exitIP,
      error: result.error
    };
    
    this.statuses.set(proxyId, status);
    
    return status;
  }

  // ==================== Persistence ====================

  /**
   * Gets the proxies file path
   */
  private getProxiesPath(): string {
    return path.join(this.sessionDataDir, 'proxies.json');
  }

  /**
   * Gets the bindings file path
   */
  private getBindingsPath(): string {
    return path.join(this.sessionDataDir, 'proxy-bindings.json');
  }

  /**
   * Loads proxies from disk
   */
  private loadProxies(): void {
    try {
      const filePath = this.getProxiesPath();
      
      if (!fs.existsSync(filePath)) {
        return;
      }
      
      const data = fs.readFileSync(filePath, 'utf-8');
      const proxies = JSON.parse(data);
      
      for (const proxy of proxies) {
        this.proxies.set(proxy.id, {
          ...proxy,
          createdAt: new Date(proxy.createdAt),
          updatedAt: new Date(proxy.updatedAt)
        });
      }
      
      this.log('info', `Loaded ${this.proxies.size} proxies`);
    } catch (error) {
      this.log('error', `Error loading proxies: ${(error as Error).message}`);
    }
  }

  /**
   * Saves proxies to disk
   */
  private saveProxies(): void {
    try {
      const filePath = this.getProxiesPath();
      const dir = path.dirname(filePath);
      
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      
      const proxies = Array.from(this.proxies.values());
      fs.writeFileSync(filePath, JSON.stringify(proxies, null, 2), 'utf-8');
    } catch (error) {
      this.log('error', `Error saving proxies: ${(error as Error).message}`);
    }
  }

  /**
   * Loads bindings from disk
   */
  private loadBindings(): void {
    try {
      const filePath = this.getBindingsPath();
      
      if (!fs.existsSync(filePath)) {
        return;
      }
      
      const data = fs.readFileSync(filePath, 'utf-8');
      const bindings = JSON.parse(data);
      
      for (const binding of bindings) {
        this.bindings.set(binding.accountId, {
          ...binding,
          boundAt: new Date(binding.boundAt),
          lastUsed: binding.lastUsed ? new Date(binding.lastUsed) : undefined
        });
      }
      
      this.log('info', `Loaded ${this.bindings.size} proxy bindings`);
    } catch (error) {
      this.log('error', `Error loading bindings: ${(error as Error).message}`);
    }
  }

  /**
   * Saves bindings to disk
   */
  private saveBindings(): void {
    try {
      const filePath = this.getBindingsPath();
      const dir = path.dirname(filePath);
      
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      
      const bindings = Array.from(this.bindings.values());
      fs.writeFileSync(filePath, JSON.stringify(bindings, null, 2), 'utf-8');
    } catch (error) {
      this.log('error', `Error saving bindings: ${(error as Error).message}`);
    }
  }

  // ==================== Utilities ====================

  /**
   * Generates a unique ID
   */
  private generateId(): string {
    return `proxy_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Validates a proxy configuration
   */
  validateProxyConfig(config: Partial<ProxyConfig>): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (!config.name || config.name.trim().length === 0) {
      errors.push('Proxy name is required');
    }
    
    if (!config.protocol || !['socks5', 'http', 'https'].includes(config.protocol)) {
      errors.push('Invalid protocol (must be socks5, http, or https)');
    }
    
    if (!config.host || config.host.trim().length === 0) {
      errors.push('Host is required');
    }
    
    if (!config.port || config.port < 1 || config.port > 65535) {
      errors.push('Port must be between 1 and 65535');
    }
    
    return { valid: errors.length === 0, errors };
  }

  /**
   * Cleans up all resources
   */
  async cleanup(): Promise<void> {
    this.log('info', 'Cleaning up ProxyListManager...');
    
    // Stop all relays
    if (this.proxyRelayService) {
      for (const accountId of this.bindings.keys()) {
        try {
          await this.proxyRelayService.stopRelay(accountId);
        } catch (error) {
          this.log('warn', `Error stopping relay for ${accountId}: ${(error as Error).message}`);
        }
      }
    }
    
    this.log('info', 'ProxyListManager cleanup complete');
  }
}

export default ProxyListManager;
