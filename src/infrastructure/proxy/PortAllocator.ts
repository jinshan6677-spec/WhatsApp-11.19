/**
 * PortAllocator - Manages local port allocation for proxy relay services
 * 
 * Implements efficient port allocation with conflict detection and retry logic.
 * Uses a bitmap-based approach for fast port availability checking.
 * 
 * Port Range: 10000-60000
 * Max Retries: 10
 */

import * as net from 'net';

interface PortAllocationOptions {
  minPort?: number;
  maxPort?: number;
  maxRetries?: number;
  logger?: (level: string, message: string, ...args: any[]) => void;
}

interface PortAllocation {
  port: number;
  accountId: string;
  allocatedAt: Date;
}

export class PortAllocator {
  private readonly minPort: number;
  private readonly maxPort: number;
  private readonly maxRetries: number;
  private readonly log: (level: string, message: string, ...args: any[]) => void;
  
  // Track allocated ports: port -> allocation info
  private allocatedPorts: Map<number, PortAllocation>;
  
  // Bitmap for fast port availability checking
  private portBitmap: Uint8Array;
  private readonly bitmapOffset: number;

  constructor(options: PortAllocationOptions = {}) {
    this.minPort = options.minPort || 10000;
    this.maxPort = options.maxPort || 60000;
    this.maxRetries = options.maxRetries || 10;
    this.log = options.logger || this.createDefaultLogger();
    
    this.allocatedPorts = new Map();
    
    // Initialize bitmap (1 bit per port)
    const portRange = this.maxPort - this.minPort + 1;
    this.bitmapOffset = this.minPort;
    this.portBitmap = new Uint8Array(Math.ceil(portRange / 8));
    
    this.log('info', `PortAllocator initialized: range ${this.minPort}-${this.maxPort}`);
  }

  /**
   * Creates a default logger
   */
  private createDefaultLogger(): (level: string, message: string, ...args: any[]) => void {
    return (level: string, message: string, ...args: any[]) => {
      const timestamp = new Date().toISOString();
      const prefix = `[${timestamp}] [PortAllocator] [${level.toUpperCase()}]`;
      
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
   * Allocates a port for an account
   * Implements conflict detection and retry logic
   * 
   * @param accountId - Account identifier
   * @returns Allocated port number
   * @throws Error if unable to allocate port after max retries
   */
  async allocate(accountId: string): Promise<number> {
    if (!accountId) {
      throw new Error('Account ID is required for port allocation');
    }

    // Check if account already has a port allocated
    const existing = this.findPortByAccountId(accountId);
    if (existing !== null) {
      this.log('info', `Account ${accountId} already has port ${existing} allocated`);
      return existing;
    }

    let attempts = 0;
    let lastError: Error | null = null;

    while (attempts < this.maxRetries) {
      attempts++;
      
      try {
        // Find a candidate port
        const candidatePort = this.findAvailablePort();
        
        if (candidatePort === null) {
          throw new Error('No available ports in range');
        }

        // Test if port is actually available (not just in our bitmap)
        const isAvailable = await this.testPortAvailability(candidatePort);
        
        if (isAvailable) {
          // Allocate the port
          this.markPortAsAllocated(candidatePort, accountId);
          
          this.log('info', `✓ Port ${candidatePort} allocated to account ${accountId} (attempt ${attempts}/${this.maxRetries})`);
          
          return candidatePort;
        } else {
          // Port is in use by another process, mark it in bitmap and retry
          this.markPortAsUsed(candidatePort);
          this.log('warn', `Port ${candidatePort} is in use by another process, retrying... (attempt ${attempts}/${this.maxRetries})`);
        }
      } catch (error) {
        lastError = error as Error;
        this.log('warn', `Port allocation attempt ${attempts} failed: ${(error as Error).message}`);
      }
    }

    // Max retries exceeded
    const errorMessage = `Failed to allocate port after ${this.maxRetries} attempts. Last error: ${lastError?.message || 'Unknown'}`;
    this.log('error', errorMessage);
    throw new Error(errorMessage);
  }

  /**
   * Releases a port allocation
   * 
   * @param port - Port number to release
   * @returns true if port was released, false if port was not allocated
   */
  release(port: number): boolean {
    if (!this.isPortInRange(port)) {
      this.log('warn', `Attempted to release port ${port} which is outside valid range`);
      return false;
    }

    const allocation = this.allocatedPorts.get(port);
    
    if (!allocation) {
      this.log('warn', `Attempted to release port ${port} which is not allocated`);
      return false;
    }

    // Remove from allocated ports
    this.allocatedPorts.delete(port);
    
    // Clear bitmap
    this.clearPortInBitmap(port);
    
    this.log('info', `✓ Port ${port} released (was allocated to ${allocation.accountId})`);
    
    return true;
  }

  /**
   * Releases all ports allocated to an account
   * 
   * @param accountId - Account identifier
   * @returns Number of ports released
   */
  releaseByAccountId(accountId: string): number {
    const portsToRelease: number[] = [];
    
    for (const [port, allocation] of this.allocatedPorts.entries()) {
      if (allocation.accountId === accountId) {
        portsToRelease.push(port);
      }
    }

    let releasedCount = 0;
    for (const port of portsToRelease) {
      if (this.release(port)) {
        releasedCount++;
      }
    }

    if (releasedCount > 0) {
      this.log('info', `Released ${releasedCount} port(s) for account ${accountId}`);
    }

    return releasedCount;
  }

  /**
   * Finds the port allocated to an account
   * 
   * @param accountId - Account identifier
   * @returns Port number or null if not found
   */
  findPortByAccountId(accountId: string): number | null {
    for (const [port, allocation] of this.allocatedPorts.entries()) {
      if (allocation.accountId === accountId) {
        return port;
      }
    }
    return null;
  }

  /**
   * Gets allocation info for a port
   * 
   * @param port - Port number
   * @returns Allocation info or null if not allocated
   */
  getAllocationInfo(port: number): PortAllocation | null {
    return this.allocatedPorts.get(port) || null;
  }

  /**
   * Gets all current allocations
   * 
   * @returns Array of allocations
   */
  getAllAllocations(): PortAllocation[] {
    return Array.from(this.allocatedPorts.values());
  }

  /**
   * Gets statistics about port allocation
   * 
   * @returns Statistics object
   */
  getStats(): {
    totalPorts: number;
    allocatedPorts: number;
    availablePorts: number;
    utilizationPercent: number;
  } {
    const totalPorts = this.maxPort - this.minPort + 1;
    const allocatedPorts = this.allocatedPorts.size;
    const availablePorts = totalPorts - allocatedPorts;
    const utilizationPercent = (allocatedPorts / totalPorts) * 100;

    return {
      totalPorts,
      allocatedPorts,
      availablePorts,
      utilizationPercent: Math.round(utilizationPercent * 100) / 100
    };
  }

  // ==================== Private Helper Methods ====================

  /**
   * Finds an available port using bitmap
   * 
   * @returns Port number or null if no ports available
   */
  private findAvailablePort(): number | null {
    const portRange = this.maxPort - this.minPort + 1;
    
    // Start from a random position to distribute load
    const startOffset = Math.floor(Math.random() * portRange);
    
    for (let i = 0; i < portRange; i++) {
      const offset = (startOffset + i) % portRange;
      const port = this.minPort + offset;
      
      if (!this.isPortMarkedInBitmap(port)) {
        return port;
      }
    }

    return null;
  }

  /**
   * Tests if a port is actually available by attempting to bind to it
   * 
   * @param port - Port to test
   * @returns Promise<boolean> - true if available
   */
  private testPortAvailability(port: number): Promise<boolean> {
    return new Promise((resolve) => {
      const server = net.createServer();
      
      server.once('error', (err: NodeJS.ErrnoException) => {
        if (err.code === 'EADDRINUSE') {
          resolve(false);
        } else {
          // Other errors also mean port is not available
          resolve(false);
        }
      });

      server.once('listening', () => {
        server.close(() => {
          resolve(true);
        });
      });

      server.listen(port, '127.0.0.1');
    });
  }

  /**
   * Marks a port as allocated in both bitmap and allocation map
   * 
   * @param port - Port number
   * @param accountId - Account identifier
   */
  private markPortAsAllocated(port: number, accountId: string): void {
    this.setPortInBitmap(port);
    
    this.allocatedPorts.set(port, {
      port,
      accountId,
      allocatedAt: new Date()
    });
  }

  /**
   * Marks a port as used in bitmap (but not allocated by us)
   * 
   * @param port - Port number
   */
  private markPortAsUsed(port: number): void {
    this.setPortInBitmap(port);
  }

  /**
   * Checks if port is in valid range
   * 
   * @param port - Port number
   * @returns true if in range
   */
  private isPortInRange(port: number): boolean {
    return port >= this.minPort && port <= this.maxPort;
  }

  /**
   * Checks if port is marked in bitmap
   * 
   * @param port - Port number
   * @returns true if marked
   */
  private isPortMarkedInBitmap(port: number): boolean {
    if (!this.isPortInRange(port)) {
      return true; // Treat out-of-range as marked
    }

    const bitIndex = port - this.bitmapOffset;
    const byteIndex = Math.floor(bitIndex / 8);
    const bitOffset = bitIndex % 8;
    
    return (this.portBitmap[byteIndex] & (1 << bitOffset)) !== 0;
  }

  /**
   * Sets a port bit in bitmap
   * 
   * @param port - Port number
   */
  private setPortInBitmap(port: number): void {
    if (!this.isPortInRange(port)) {
      return;
    }

    const bitIndex = port - this.bitmapOffset;
    const byteIndex = Math.floor(bitIndex / 8);
    const bitOffset = bitIndex % 8;
    
    this.portBitmap[byteIndex] |= (1 << bitOffset);
  }

  /**
   * Clears a port bit in bitmap
   * 
   * @param port - Port number
   */
  private clearPortInBitmap(port: number): void {
    if (!this.isPortInRange(port)) {
      return;
    }

    const bitIndex = port - this.bitmapOffset;
    const byteIndex = Math.floor(bitIndex / 8);
    const bitOffset = bitIndex % 8;
    
    this.portBitmap[byteIndex] &= ~(1 << bitOffset);
  }

  /**
   * Cleans up all allocations
   */
  cleanup(): void {
    this.log('info', 'Cleaning up PortAllocator...');
    
    const count = this.allocatedPorts.size;
    this.allocatedPorts.clear();
    this.portBitmap.fill(0);
    
    this.log('info', `PortAllocator cleanup complete (released ${count} ports)`);
  }
}
