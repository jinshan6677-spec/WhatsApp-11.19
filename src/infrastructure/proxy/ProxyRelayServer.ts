/**
 * ProxyRelayServer - Local SOCKS5/HTTP proxy relay implementation
 * 
 * Creates a local proxy server that forwards traffic to a remote proxy.
 * This solves Chromium's ERR_NO_SUPPORTED_PROXIES issue with certain proxy types.
 * 
 * Supports:
 * - SOCKS5 proxies (with and without authentication)
 * - HTTP/HTTPS proxies
 * - Traffic statistics
 * - Connection monitoring
 */

import * as net from 'net';
import * as http from 'http';
import { SocksClient, SocksClientOptions, SocksProxy } from 'socks';

const ProxyConfig = require('../../domain/entities/ProxyConfig');

export interface ProxyRelayServerOptions {
  localPort: number;
  remoteProxy: typeof ProxyConfig;
  logger?: (level: string, message: string, ...args: any[]) => void;
}

export interface RelayStatistics {
  bytesTransferred: number;
  connectionsCount: number;
  activeConnections: number;
  startedAt: Date | null;
}

export class ProxyRelayServer {
  private readonly localPort: number;
  private readonly remoteProxy: typeof ProxyConfig;
  private readonly log: (level: string, message: string, ...args: any[]) => void;
  
  private server: net.Server | http.Server | null;
  private isRunning: boolean;
  
  // Statistics
  private bytesTransferred: number;
  private connectionsCount: number;
  private activeConnections: Set<net.Socket>;
  private startedAt: Date | null;

  constructor(options: ProxyRelayServerOptions) {
    this.localPort = options.localPort;
    this.remoteProxy = options.remoteProxy;
    this.log = options.logger || this.createDefaultLogger();
    
    this.server = null;
    this.isRunning = false;
    
    this.bytesTransferred = 0;
    this.connectionsCount = 0;
    this.activeConnections = new Set();
    this.startedAt = null;
  }

  /**
   * Creates a default logger
   */
  private createDefaultLogger(): (level: string, message: string, ...args: any[]) => void {
    return (level: string, message: string, ...args: any[]) => {
      const timestamp = new Date().toISOString();
      const prefix = `[${timestamp}] [ProxyRelayServer:${this.localPort}] [${level.toUpperCase()}]`;
      
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
   * Starts the relay server
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      this.log('warn', 'Server is already running');
      return;
    }

    this.log('info', `Starting proxy relay server on port ${this.localPort}`);
    this.log('info', `Remote proxy: ${this.remoteProxy.protocol}://${this.remoteProxy.host}:${this.remoteProxy.port}`);

    try {
      if (this.remoteProxy.protocol === 'socks5' || this.remoteProxy.protocol === 'socks4') {
        await this.startSocksRelay();
      } else if (this.remoteProxy.protocol === 'http' || this.remoteProxy.protocol === 'https') {
        await this.startHttpRelay();
      } else {
        throw new Error(`Unsupported proxy protocol: ${this.remoteProxy.protocol}`);
      }

      this.isRunning = true;
      this.startedAt = new Date();
      
      this.log('info', `✓ Proxy relay server started successfully on port ${this.localPort}`);
    } catch (error) {
      this.log('error', `Failed to start proxy relay server: ${(error as Error).message}`);
      throw error;
    }
  }

  /**
   * Stops the relay server
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      this.log('warn', 'Server is not running');
      return;
    }

    this.log('info', 'Stopping proxy relay server...');

    try {
      // Close all active connections
      for (const socket of this.activeConnections) {
        socket.destroy();
      }
      this.activeConnections.clear();

      // Close the server
      if (this.server) {
        await new Promise<void>((resolve, reject) => {
          this.server!.close((err) => {
            if (err) reject(err);
            else resolve();
          });
        });
      }

      this.server = null;
      this.isRunning = false;
      
      this.log('info', `✓ Proxy relay server stopped (transferred ${this.formatBytes(this.bytesTransferred)}, ${this.connectionsCount} connections)`);
    } catch (error) {
      this.log('error', `Error stopping server: ${(error as Error).message}`);
      throw error;
    }
  }

  /**
   * Starts a SOCKS relay server
   */
  private async startSocksRelay(): Promise<void> {
    this.server = net.createServer((clientSocket) => {
      this.handleSocksConnection(clientSocket);
    });

    return new Promise((resolve, reject) => {
      this.server!.listen(this.localPort, '127.0.0.1', () => {
        this.log('info', `SOCKS relay listening on 127.0.0.1:${this.localPort}`);
        resolve();
      });

      this.server!.on('error', (error) => {
        this.log('error', `Server error: ${error.message}`);
        reject(error);
      });
    });
  }

  /**
   * Handles a SOCKS connection
   */
  private async handleSocksConnection(clientSocket: net.Socket): Promise<void> {
    this.connectionsCount++;
    this.activeConnections.add(clientSocket);

    const connectionId = `conn_${this.connectionsCount}`;
    this.log('info', `[${connectionId}] New SOCKS connection from ${clientSocket.remoteAddress}`);

    try {
      // Read SOCKS5 handshake
      const handshake = await this.readSocksHandshake(clientSocket);
      
      if (!handshake) {
        throw new Error('Failed to read SOCKS handshake');
      }

      // Send handshake response (no authentication required from client)
      clientSocket.write(Buffer.from([0x05, 0x00]));

      // Read SOCKS5 request
      const request = await this.readSocksRequest(clientSocket);
      
      if (!request) {
        throw new Error('Failed to read SOCKS request');
      }

      const { host, port } = request;
      this.log('info', `[${connectionId}] SOCKS request: ${host}:${port}`);

      // Connect to remote proxy
      const proxySocket = await this.connectToRemoteProxy(host, port);

      // Send success response to client
      const response = Buffer.from([
        0x05, // SOCKS version
        0x00, // Success
        0x00, // Reserved
        0x01, // IPv4
        0x00, 0x00, 0x00, 0x00, // IP (0.0.0.0)
        0x00, 0x00 // Port (0)
      ]);
      clientSocket.write(response);

      // Pipe data between client and proxy
      this.pipeConnections(clientSocket, proxySocket, connectionId);

    } catch (error) {
      this.log('error', `[${connectionId}] Connection error: ${(error as Error).message}`);
      clientSocket.destroy();
      this.activeConnections.delete(clientSocket);
    }
  }

  /**
   * Reads SOCKS5 handshake
   */
  private readSocksHandshake(socket: net.Socket): Promise<boolean> {
    return new Promise((resolve) => {
      const onData = (data: Buffer) => {
        socket.off('data', onData);
        
        if (data.length < 2 || data[0] !== 0x05) {
          resolve(false);
          return;
        }
        
        resolve(true);
      };

      socket.once('data', onData);
      socket.once('error', () => resolve(false));
      socket.once('close', () => resolve(false));
    });
  }

  /**
   * Reads SOCKS5 request
   */
  private readSocksRequest(socket: net.Socket): Promise<{ host: string; port: number } | null> {
    return new Promise((resolve) => {
      const onData = (data: Buffer) => {
        socket.off('data', onData);
        
        try {
          if (data.length < 4 || data[0] !== 0x05) {
            resolve(null);
            return;
          }

          const addressType = data[3];
          let host: string;
          let portOffset: number;

          if (addressType === 0x01) {
            // IPv4
            host = `${data[4]}.${data[5]}.${data[6]}.${data[7]}`;
            portOffset = 8;
          } else if (addressType === 0x03) {
            // Domain name
            const domainLength = data[4];
            host = data.slice(5, 5 + domainLength).toString();
            portOffset = 5 + domainLength;
          } else if (addressType === 0x04) {
            // IPv6
            const ipv6Parts: string[] = [];
            for (let i = 0; i < 16; i += 2) {
              ipv6Parts.push(data.readUInt16BE(4 + i).toString(16));
            }
            host = ipv6Parts.join(':');
            portOffset = 20;
          } else {
            resolve(null);
            return;
          }

          const port = data.readUInt16BE(portOffset);
          resolve({ host, port });
        } catch (error) {
          resolve(null);
        }
      };

      socket.once('data', onData);
      socket.once('error', () => resolve(null));
      socket.once('close', () => resolve(null));
    });
  }

  /**
   * Connects to the remote proxy using socks library
   */
  private async connectToRemoteProxy(destinationHost: string, destinationPort: number): Promise<net.Socket> {
    const socksOptions: SocksClientOptions = {
      proxy: {
        host: this.remoteProxy.host,
        port: this.remoteProxy.port,
        type: this.remoteProxy.protocol === 'socks4' ? 4 : 5,
        userId: this.remoteProxy.username || undefined,
        password: this.remoteProxy.password || undefined
      } as SocksProxy,
      command: 'connect',
      destination: {
        host: destinationHost,
        port: destinationPort
      }
    };

    const info = await SocksClient.createConnection(socksOptions);
    return info.socket;
  }

  /**
   * Starts an HTTP relay server
   */
  private async startHttpRelay(): Promise<void> {
    this.server = http.createServer();

    // Handle CONNECT method for HTTPS
    (this.server as http.Server).on('connect', (req, clientSocket, head) => {
      this.handleHttpConnect(req, clientSocket as net.Socket, head);
    });

    // Handle regular HTTP requests
    (this.server as http.Server).on('request', (req, res) => {
      this.handleHttpRequest(req, res);
    });

    return new Promise((resolve, reject) => {
      this.server!.listen(this.localPort, '127.0.0.1', () => {
        this.log('info', `HTTP relay listening on 127.0.0.1:${this.localPort}`);
        resolve();
      });

      this.server!.on('error', (error) => {
        this.log('error', `Server error: ${error.message}`);
        reject(error);
      });
    });
  }

  /**
   * Handles HTTP CONNECT method (for HTTPS tunneling)
   */
  private async handleHttpConnect(req: http.IncomingMessage, clientSocket: net.Socket, head: Buffer): Promise<void> {
    this.connectionsCount++;
    this.activeConnections.add(clientSocket);

    const connectionId = `conn_${this.connectionsCount}`;
    const targetUrl = req.url || '';
    
    this.log('info', `[${connectionId}] HTTP CONNECT to ${targetUrl}`);

    try {
      // Parse target host and port
      const [host, portStr] = targetUrl.split(':');
      const port = parseInt(portStr, 10);

      // Connect to remote proxy
      const proxySocket = await this.connectToHttpProxy(host, port);

      // Send success response
      clientSocket.write('HTTP/1.1 200 Connection Established\r\n\r\n');

      // Pipe data
      this.pipeConnections(clientSocket, proxySocket, connectionId);

    } catch (error) {
      this.log('error', `[${connectionId}] CONNECT error: ${(error as Error).message}`);
      clientSocket.write('HTTP/1.1 502 Bad Gateway\r\n\r\n');
      clientSocket.destroy();
      this.activeConnections.delete(clientSocket);
    }
  }

  /**
   * Handles regular HTTP requests
   */
  private async handleHttpRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    this.connectionsCount++;
    
    const connectionId = `conn_${this.connectionsCount}`;
    this.log('info', `[${connectionId}] HTTP ${req.method} ${req.url}`);

    try {
      // Forward request through remote proxy
      const proxyReq = http.request({
        host: this.remoteProxy.host,
        port: this.remoteProxy.port,
        method: req.method,
        path: req.url,
        headers: req.headers
      });

      req.pipe(proxyReq);

      proxyReq.on('response', (proxyRes) => {
        res.writeHead(proxyRes.statusCode || 200, proxyRes.headers);
        proxyRes.pipe(res);
      });

      proxyReq.on('error', (error) => {
        this.log('error', `[${connectionId}] Proxy request error: ${error.message}`);
        res.writeHead(502);
        res.end('Bad Gateway');
      });

    } catch (error) {
      this.log('error', `[${connectionId}] Request error: ${(error as Error).message}`);
      res.writeHead(500);
      res.end('Internal Server Error');
    }
  }

  /**
   * Connects to HTTP proxy
   */
  private async connectToHttpProxy(destinationHost: string, destinationPort: number): Promise<net.Socket> {
    // For HTTP proxies, we use CONNECT method
    const socket = net.connect(this.remoteProxy.port, this.remoteProxy.host);

    return new Promise((resolve, reject) => {
      socket.on('connect', () => {
        // Send CONNECT request
        const connectReq = `CONNECT ${destinationHost}:${destinationPort} HTTP/1.1\r\nHost: ${destinationHost}:${destinationPort}\r\n`;
        
        // Add proxy authentication if needed
        if (this.remoteProxy.username && this.remoteProxy.password) {
          const auth = Buffer.from(`${this.remoteProxy.username}:${this.remoteProxy.password}`).toString('base64');
          socket.write(connectReq + `Proxy-Authorization: Basic ${auth}\r\n\r\n`);
        } else {
          socket.write(connectReq + '\r\n');
        }

        // Wait for response
        socket.once('data', (data) => {
          const response = data.toString();
          if (response.includes('200')) {
            resolve(socket);
          } else {
            reject(new Error(`Proxy returned: ${response.split('\r\n')[0]}`));
          }
        });
      });

      socket.on('error', reject);
    });
  }

  /**
   * Pipes data between two sockets and tracks statistics
   */
  private pipeConnections(clientSocket: net.Socket, proxySocket: net.Socket, connectionId: string): void {
    // Track bytes transferred
    clientSocket.on('data', (data) => {
      this.bytesTransferred += data.length;
    });

    proxySocket.on('data', (data) => {
      this.bytesTransferred += data.length;
    });

    // Pipe data bidirectionally
    clientSocket.pipe(proxySocket);
    proxySocket.pipe(clientSocket);

    // Handle connection close
    const cleanup = () => {
      clientSocket.destroy();
      proxySocket.destroy();
      this.activeConnections.delete(clientSocket);
      this.log('info', `[${connectionId}] Connection closed`);
    };

    clientSocket.on('error', (error) => {
      this.log('warn', `[${connectionId}] Client socket error: ${error.message}`);
      cleanup();
    });

    proxySocket.on('error', (error) => {
      this.log('warn', `[${connectionId}] Proxy socket error: ${error.message}`);
      cleanup();
    });

    clientSocket.on('close', cleanup);
    proxySocket.on('close', cleanup);
  }

  /**
   * Gets relay statistics
   */
  getStatistics(): RelayStatistics {
    return {
      bytesTransferred: this.bytesTransferred,
      connectionsCount: this.connectionsCount,
      activeConnections: this.activeConnections.size,
      startedAt: this.startedAt
    };
  }

  /**
   * Checks if server is running
   */
  getIsRunning(): boolean {
    return this.isRunning;
  }

  /**
   * Formats bytes to human-readable format
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
  }
}
