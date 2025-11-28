/**
 * ProxyRelay Domain Entity
 * 
 * Represents a local proxy relay service that forwards traffic from a local port
 * to a remote proxy server. This solves Chromium's compatibility issues with
 * certain proxy protocols (ERR_NO_SUPPORTED_PROXIES).
 */

import * as net from 'net';

const ProxyConfig = require('./ProxyConfig');

export interface ProxyRelayConfig {
  id?: string;
  accountId: string;
  localPort: number;
  remoteProxy: typeof ProxyConfig;
  status?: ProxyRelayStatus;
  bytesTransferred?: number;
  connectionsCount?: number;
  lastHealthCheck?: Date;
  consecutiveFailures?: number;
  createdAt?: Date;
}

export enum ProxyRelayStatus {
  STARTING = 'starting',
  RUNNING = 'running',
  STOPPED = 'stopped',
  ERROR = 'error',
  RECONNECTING = 'reconnecting'
}

export class ProxyRelay {
  public readonly id: string;
  public readonly accountId: string;
  public readonly localPort: number;
  public readonly remoteProxy: typeof ProxyConfig;
  
  public status: ProxyRelayStatus;
  public server: net.Server | null;
  
  // Statistics
  public bytesTransferred: number;
  public connectionsCount: number;
  public lastHealthCheck: Date | null;
  public consecutiveFailures: number;
  
  // Metadata
  public readonly createdAt: Date;
  public startedAt: Date | null;
  public stoppedAt: Date | null;
  public errorMessage: string | null;

  constructor(config: ProxyRelayConfig) {
    this.id = config.id || this.generateId();
    this.accountId = config.accountId;
    this.localPort = config.localPort;
    this.remoteProxy = config.remoteProxy;
    
    this.status = config.status || ProxyRelayStatus.STOPPED;
    this.server = null;
    
    this.bytesTransferred = config.bytesTransferred || 0;
    this.connectionsCount = config.connectionsCount || 0;
    this.lastHealthCheck = config.lastHealthCheck || null;
    this.consecutiveFailures = config.consecutiveFailures || 0;
    
    this.createdAt = config.createdAt || new Date();
    this.startedAt = null;
    this.stoppedAt = null;
    this.errorMessage = null;
  }

  /**
   * Generates a unique ID for the relay
   */
  private generateId(): string {
    return `relay_${this.accountId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // ==================== Status Management ====================

  /**
   * Marks the relay as starting
   */
  markAsStarting(): void {
    this.status = ProxyRelayStatus.STARTING;
    this.errorMessage = null;
  }

  /**
   * Marks the relay as running
   */
  markAsRunning(): void {
    this.status = ProxyRelayStatus.RUNNING;
    this.startedAt = new Date();
    this.stoppedAt = null;
    this.errorMessage = null;
    this.consecutiveFailures = 0;
  }

  /**
   * Marks the relay as stopped
   */
  markAsStopped(): void {
    this.status = ProxyRelayStatus.STOPPED;
    this.stoppedAt = new Date();
    this.server = null;
  }

  /**
   * Marks the relay as error
   */
  markAsError(error: string): void {
    this.status = ProxyRelayStatus.ERROR;
    this.errorMessage = error;
    this.consecutiveFailures++;
  }

  /**
   * Marks the relay as reconnecting
   */
  markAsReconnecting(): void {
    this.status = ProxyRelayStatus.RECONNECTING;
  }

  /**
   * Checks if relay is running
   */
  isRunning(): boolean {
    return this.status === ProxyRelayStatus.RUNNING;
  }

  /**
   * Checks if relay is stopped
   */
  isStopped(): boolean {
    return this.status === ProxyRelayStatus.STOPPED;
  }

  /**
   * Checks if relay has error
   */
  hasError(): boolean {
    return this.status === ProxyRelayStatus.ERROR;
  }

  // ==================== Statistics ====================

  /**
   * Records bytes transferred
   */
  recordBytesTransferred(bytes: number): void {
    this.bytesTransferred += bytes;
  }

  /**
   * Increments connection count
   */
  incrementConnectionCount(): void {
    this.connectionsCount++;
  }

  /**
   * Records a successful health check
   */
  recordHealthCheckSuccess(): void {
    this.lastHealthCheck = new Date();
    this.consecutiveFailures = 0;
  }

  /**
   * Records a failed health check
   */
  recordHealthCheckFailure(): void {
    this.lastHealthCheck = new Date();
    this.consecutiveFailures++;
  }

  /**
   * Resets statistics
   */
  resetStatistics(): void {
    this.bytesTransferred = 0;
    this.connectionsCount = 0;
    this.consecutiveFailures = 0;
  }

  /**
   * Gets uptime in milliseconds
   */
  getUptime(): number | null {
    if (!this.startedAt) {
      return null;
    }
    
    const endTime = this.stoppedAt || new Date();
    return endTime.getTime() - this.startedAt.getTime();
  }

  /**
   * Gets uptime in human-readable format
   */
  getUptimeFormatted(): string {
    const uptime = this.getUptime();
    
    if (uptime === null) {
      return 'N/A';
    }

    const seconds = Math.floor(uptime / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) {
      return `${days}d ${hours % 24}h ${minutes % 60}m`;
    } else if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }

  // ==================== Validation ====================

  /**
   * Validates the relay configuration
   */
  validate(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!this.accountId || typeof this.accountId !== 'string') {
      errors.push('Account ID is required and must be a string');
    }

    if (typeof this.localPort !== 'number' || this.localPort < 1 || this.localPort > 65535) {
      errors.push('Local port must be between 1 and 65535');
    }

    if (!this.remoteProxy) {
      errors.push('Remote proxy configuration is required');
    } else {
      const proxyValidation = this.remoteProxy.validate();
      if (!proxyValidation.valid) {
        errors.push(`Remote proxy validation failed: ${proxyValidation.errors.map((e: any) => e.reason).join(', ')}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  // ==================== Serialization ====================

  /**
   * Converts to JSON-serializable object
   */
  toJSON(): object {
    return {
      id: this.id,
      accountId: this.accountId,
      localPort: this.localPort,
      remoteProxy: this.remoteProxy.toJSON(),
      status: this.status,
      bytesTransferred: this.bytesTransferred,
      connectionsCount: this.connectionsCount,
      lastHealthCheck: this.lastHealthCheck?.toISOString() || null,
      consecutiveFailures: this.consecutiveFailures,
      createdAt: this.createdAt.toISOString(),
      startedAt: this.startedAt?.toISOString() || null,
      stoppedAt: this.stoppedAt?.toISOString() || null,
      errorMessage: this.errorMessage,
      uptime: this.getUptime(),
      uptimeFormatted: this.getUptimeFormatted()
    };
  }

  /**
   * Creates a ProxyRelay from JSON
   */
  static fromJSON(json: any): ProxyRelay {
    if (!json || typeof json !== 'object') {
      throw new Error('Invalid JSON: expected an object');
    }

    const ProxyConfigClass = require('./ProxyConfig');
    
    const relay = new ProxyRelay({
      id: json.id,
      accountId: json.accountId,
      localPort: json.localPort,
      remoteProxy: ProxyConfigClass.fromJSON(json.remoteProxy),
      status: json.status,
      bytesTransferred: json.bytesTransferred,
      connectionsCount: json.connectionsCount,
      lastHealthCheck: json.lastHealthCheck ? new Date(json.lastHealthCheck) : undefined,
      consecutiveFailures: json.consecutiveFailures,
      createdAt: json.createdAt ? new Date(json.createdAt) : undefined
    });

    if (json.startedAt) {
      relay.startedAt = new Date(json.startedAt);
    }
    if (json.stoppedAt) {
      relay.stoppedAt = new Date(json.stoppedAt);
    }
    if (json.errorMessage) {
      relay.errorMessage = json.errorMessage;
    }

    return relay;
  }

  /**
   * Returns a human-readable string representation
   */
  toString(): string {
    return `ProxyRelay[${this.id}] ${this.accountId} -> 127.0.0.1:${this.localPort} -> ${this.remoteProxy.host}:${this.remoteProxy.port} [${this.status}]`;
  }
}
