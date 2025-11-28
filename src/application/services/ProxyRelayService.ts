/**
 * ProxyRelayService - Application Service for Proxy Relay Management
 * 
 * Manages the lifecycle of proxy relay servers, including:
 * - Starting and stopping relay servers
 * - Port allocation and management
 * - Health monitoring
 * - Exit IP verification
 * - Proxy testing
 */

import { PortAllocator } from '../../infrastructure/proxy/PortAllocator';
import { ProxyRelayServer } from '../../infrastructure/proxy/ProxyRelayServer';
import { ProxyRelay, ProxyRelayStatus } from '../../domain/entities/ProxyRelay';
import axios from 'axios';

const ProxyConfig = require('../../domain/entities/ProxyConfig');

export interface ProxyRelayServiceOptions {
  portAllocator?: PortAllocator;
  logger?: (level: string, message: string, ...args: any[]) => void;
  eventBus?: any;
}

export interface ProxyRelayInfo {
  accountId: string;
  localPort: number;
  remoteProxy: typeof ProxyConfig;
  status: ProxyRelayStatus;
  exitIP?: string;
  startedAt: Date;
}

export interface ProxyTestResult {
  success: boolean;
  exitIP?: string;
  responseTime?: number;
  error?: string;
}

export class ProxyRelayService {
  private readonly portAllocator: PortAllocator;
  private readonly log: (level: string, message: string, ...args: any[]) => void;
  private readonly eventBus: any;
  
  // Track active relays: accountId -> ProxyRelay
  private activeRelays: Map<string, ProxyRelay>;
  
  // Track relay servers: accountId -> ProxyRelayServer
  private relayServers: Map<string, ProxyRelayServer>;

  constructor(options: ProxyRelayServiceOptions = {}) {
    this.portAllocator = options.portAllocator || new PortAllocator({
      logger: options.logger
    });
    this.log = options.logger || this.createDefaultLogger();
    this.eventBus = options.eventBus || null;
    
    this.activeRelays = new Map();
    this.relayServers = new Map();
    
    this.log('info', 'ProxyRelayService initialized');
  }

  /**
   * Creates a default logger
   */
  private createDefaultLogger(): (level: string, message: string, ...args: any[]) => void {
    return (level: string, message: string, ...args: any[]) => {
      const timestamp = new Date().toISOString();
      const prefix = `[${timestamp}] [ProxyRelayService] [${level.toUpperCase()}]`;
      
      if (level === 'error') {
        console.error(prefix, message, ...args);
      } else if (level === 'warn') {
        console.warn(prefix, message, ...args);
      } else {
        console.log(prefix, message, ...args);
      }
    };
  }

  /**
   * Starts a proxy relay for an account
   * 
   * @param accountId - Account identifier
   * @param remoteProxy - Remote proxy configuration
   * @returns Relay information
   */
  async startRelay(accountId: string, remoteProxy: typeof ProxyConfig): Promise<ProxyRelayInfo> {
    if (!accountId) {
      throw new Error('Account ID is required');
    }

    if (!remoteProxy) {
      throw new Error('Remote proxy configuration is required');
    }

    // Check if relay already exists
    if (this.activeRelays.has(accountId)) {
      const existing = this.activeRelays.get(accountId)!;
      if (existing.isRunning()) {
        this.log('warn', `Relay already running for account ${accountId} on port ${existing.localPort}`);
        return this.getRelayInfo(existing);
      } else {
        // Clean up old relay
        await this.stopRelay(accountId);
      }
    }

    this.log('info', `Starting proxy relay for account ${accountId}`);

    try {
      // Step 1: Allocate a local port
      this.log('info', `Step 1/3: Allocating local port...`);
      const localPort = await this.portAllocator.allocate(accountId);
      this.log('info', `✓ Port ${localPort} allocated`);

      // Step 2: Create relay entity
      const relay = new ProxyRelay({
        accountId,
        localPort,
        remoteProxy,
        status: ProxyRelayStatus.STARTING
      });

      // Validate relay configuration
      const validation = relay.validate();
      if (!validation.valid) {
        throw new Error(`Invalid relay configuration: ${validation.errors.join(', ')}`);
      }

      // Step 3: Create and start relay server
      this.log('info', `Step 2/3: Starting relay server on port ${localPort}...`);
      const relayServer = new ProxyRelayServer({
        localPort,
        remoteProxy,
        logger: this.log
      });

      await relayServer.start();
      relay.markAsRunning();
      relay.server = null; // Server is managed separately
      
      this.log('info', `✓ Relay server started`);

      // Step 4: Verify exit IP
      this.log('info', `Step 3/3: Verifying exit IP...`);
      let exitIP: string | undefined;
      try {
        exitIP = await this.getExitIP(accountId);
        this.log('info', `✓ Exit IP verified: ${exitIP}`);
      } catch (error) {
        this.log('warn', `Could not verify exit IP: ${(error as Error).message}`);
      }

      // Store relay and server
      this.activeRelays.set(accountId, relay);
      this.relayServers.set(accountId, relayServer);

      // Emit event
      if (this.eventBus) {
        await this.eventBus.publish('proxy:relay:started', {
          accountId,
          localPort,
          remoteProxy: remoteProxy.toJSON(),
          exitIP,
          timestamp: new Date().toISOString()
        });
      }

      this.log('info', `✓ Proxy relay started for ${accountId} (127.0.0.1:${localPort} -> ${remoteProxy.host}:${remoteProxy.port})`);

      return this.getRelayInfo(relay, exitIP);

    } catch (error) {
      this.log('error', `Failed to start relay for ${accountId}: ${(error as Error).message}`);
      
      // Clean up on failure
      await this.stopRelay(accountId);
      
      throw error;
    }
  }

  /**
   * Stops a proxy relay for an account
   * 
   * @param accountId - Account identifier
   */
  async stopRelay(accountId: string): Promise<void> {
    if (!accountId) {
      throw new Error('Account ID is required');
    }

    const relay = this.activeRelays.get(accountId);
    const relayServer = this.relayServers.get(accountId);

    if (!relay && !relayServer) {
      this.log('warn', `No relay found for account ${accountId}`);
      return;
    }

    this.log('info', `Stopping proxy relay for account ${accountId}`);

    try {
      // Stop relay server
      if (relayServer) {
        await relayServer.stop();
        this.relayServers.delete(accountId);
      }

      // Update relay status
      if (relay) {
        relay.markAsStopped();
        this.activeRelays.delete(accountId);
      }

      // Release port
      if (relay) {
        this.portAllocator.release(relay.localPort);
      }

      // Emit event
      if (this.eventBus) {
        await this.eventBus.publish('proxy:relay:stopped', {
          accountId,
          timestamp: new Date().toISOString()
        });
      }

      this.log('info', `✓ Proxy relay stopped for ${accountId}`);

    } catch (error) {
      this.log('error', `Error stopping relay for ${accountId}: ${(error as Error).message}`);
      throw error;
    }
  }

  /**
   * Gets the status of a relay
   * 
   * @param accountId - Account identifier
   * @returns Relay status or null if not found
   */
  async getRelayStatus(accountId: string): Promise<ProxyRelayInfo | null> {
    const relay = this.activeRelays.get(accountId);
    
    if (!relay) {
      return null;
    }

    return this.getRelayInfo(relay);
  }

  /**
   * Tests a proxy configuration
   * 
   * @param proxyConfig - Proxy configuration to test
   * @returns Test result
   */
  async testProxy(proxyConfig: typeof ProxyConfig): Promise<ProxyTestResult> {
    this.log('info', `Testing proxy ${proxyConfig.host}:${proxyConfig.port}`);

    const startTime = Date.now();

    try {
      // Create a temporary relay for testing
      const testAccountId = `test_${Date.now()}`;
      const localPort = await this.portAllocator.allocate(testAccountId);

      try {
        // Start temporary relay server
        const relayServer = new ProxyRelayServer({
          localPort,
          remoteProxy: proxyConfig,
          logger: this.log
        });

        await relayServer.start();

        // Test by getting exit IP
        const exitIP = await this.getExitIPViaPort(localPort);
        const responseTime = Date.now() - startTime;

        // Stop temporary relay
        await relayServer.stop();
        this.portAllocator.release(localPort);

        this.log('info', `✓ Proxy test passed (IP: ${exitIP}, ${responseTime}ms)`);

        return {
          success: true,
          exitIP,
          responseTime
        };

      } catch (error) {
        // Clean up on error
        this.portAllocator.release(localPort);
        throw error;
      }

    } catch (error) {
      const responseTime = Date.now() - startTime;
      this.log('error', `✗ Proxy test failed: ${(error as Error).message}`);

      return {
        success: false,
        error: (error as Error).message,
        responseTime
      };
    }
  }

  /**
   * Gets the exit IP for an account's relay
   * 
   * @param accountId - Account identifier
   * @returns Exit IP address
   */
  async getExitIP(accountId: string): Promise<string> {
    const relay = this.activeRelays.get(accountId);
    
    if (!relay) {
      throw new Error(`No relay found for account ${accountId}`);
    }

    if (!relay.isRunning()) {
      throw new Error(`Relay for account ${accountId} is not running`);
    }

    return this.getExitIPViaPort(relay.localPort);
  }

  /**
   * Gets exit IP by making a request through a specific port
   * 
   * @param port - Local port to use
   * @returns Exit IP address
   */
  private async getExitIPViaPort(port: number): Promise<string> {
    try {
      // Use axios with proxy configuration
      const response = await axios.get('https://api.ipify.org?format=json', {
        proxy: {
          host: '127.0.0.1',
          port,
          protocol: 'http'
        },
        timeout: 10000
      });

      if (response.data && response.data.ip) {
        return response.data.ip;
      }

      throw new Error('Invalid response from IP service');

    } catch (error) {
      throw new Error(`Failed to get exit IP: ${(error as Error).message}`);
    }
  }

  /**
   * Reloads a proxy configuration (hot reload)
   * 
   * @param accountId - Account identifier
   * @param newProxy - New proxy configuration
   */
  async reloadProxy(accountId: string, newProxy: typeof ProxyConfig): Promise<void> {
    this.log('info', `Reloading proxy for account ${accountId}`);

    // Stop existing relay
    await this.stopRelay(accountId);

    // Start new relay
    await this.startRelay(accountId, newProxy);

    this.log('info', `✓ Proxy reloaded for ${accountId}`);
  }

  /**
   * Gets all active relays
   * 
   * @returns Array of relay information
   */
  getAllRelays(): ProxyRelayInfo[] {
    const relays: ProxyRelayInfo[] = [];
    
    for (const relay of this.activeRelays.values()) {
      relays.push(this.getRelayInfo(relay));
    }

    return relays;
  }

  /**
   * Gets port allocator statistics
   * 
   * @returns Port allocation statistics
   */
  getPortStats(): {
    totalPorts: number;
    allocatedPorts: number;
    availablePorts: number;
    utilizationPercent: number;
  } {
    return this.portAllocator.getStats();
  }

  /**
   * Converts a ProxyRelay to ProxyRelayInfo
   * 
   * @param relay - Proxy relay entity
   * @param exitIP - Optional exit IP
   * @returns Relay information
   */
  private getRelayInfo(relay: ProxyRelay, exitIP?: string): ProxyRelayInfo {
    return {
      accountId: relay.accountId,
      localPort: relay.localPort,
      remoteProxy: relay.remoteProxy,
      status: relay.status,
      exitIP,
      startedAt: relay.startedAt || relay.createdAt
    };
  }

  /**
   * Cleans up all resources
   */
  async cleanup(): Promise<void> {
    this.log('info', 'Cleaning up ProxyRelayService...');

    // Stop all relays
    const accountIds = Array.from(this.activeRelays.keys());
    for (const accountId of accountIds) {
      try {
        await this.stopRelay(accountId);
      } catch (error) {
        this.log('error', `Error stopping relay for ${accountId}: ${(error as Error).message}`);
      }
    }

    // Clean up port allocator
    this.portAllocator.cleanup();

    this.log('info', 'ProxyRelayService cleanup complete');
  }
}
