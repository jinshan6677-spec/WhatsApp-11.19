/**
 * Property-Based Tests for Port Scan Protection
 * 
 * Feature: professional-fingerprint-browser
 * Tests the port scan protection functionality that blocks
 * connections to local addresses and sensitive ports.
 * 
 * Property 47: 本地地址连接阻止
 * Property 48: 敏感端口连接阻止
 * 
 * Validates: Requirements 18.2, 18.3
 * 
 * @module test/property/port-scan-protection
 */

import * as fc from 'fast-check';
import { 
  PortScanProtectionGenerator, 
  PortScanProtectionConfig 
} from '../../src/infrastructure/fingerprint/generators/PortScanProtectionGenerator';

// Arbitraries for Port Scan Protection testing

// Local address patterns
const localAddressArbitrary = fc.constantFrom(
  '127.0.0.1',
  'localhost',
  '0.0.0.0',
  '::1',
  '192.168.0.1',
  '192.168.1.1',
  '192.168.1.100',
  '192.168.255.255',
  '10.0.0.1',
  '10.1.2.3',
  '10.255.255.255',
  '172.16.0.1',
  '172.16.1.1',
  '172.31.255.255'
);

// Non-local (public) addresses
const publicAddressArbitrary = fc.constantFrom(
  '8.8.8.8',
  '1.1.1.1',
  '208.67.222.222',
  '142.250.185.78',
  '151.101.1.140',
  'google.com',
  'example.com',
  'github.com'
);

// Sensitive ports
const sensitivePortArbitrary = fc.constantFrom(
  22,    // SSH
  21,    // FTP
  23,    // Telnet
  25,    // SMTP
  3306,  // MySQL
  5432,  // PostgreSQL
  27017, // MongoDB
  6379,  // Redis
  3389,  // RDP
  5900,  // VNC
  445,   // SMB
  3000,  // Dev server
  8080   // Alternate HTTP port
);

// Non-sensitive ports
const nonSensitivePortArbitrary = fc.constantFrom(
  80,    // HTTP (when not blocking)
  443,   // HTTPS (when not blocking)
  8888,  // Random high port
  9999,  // Random high port
  12345, // Random high port
  54321  // Random high port
);

// Random port in valid range
const randomPortArbitrary = fc.integer({ min: 1, max: 65535 });

// Random IP address
const randomIPArbitrary = fc.tuple(
  fc.integer({ min: 1, max: 255 }),
  fc.integer({ min: 0, max: 255 }),
  fc.integer({ min: 0, max: 255 }),
  fc.integer({ min: 1, max: 254 })
).map(([a, b, c, d]) => `${a}.${b}.${c}.${d}`);

describe('Port Scan Protection Property Tests', () => {
  /**
   * Feature: professional-fingerprint-browser, Property 47: 本地地址连接阻止
   * Validates: Requirements 18.2
   * 
   * For any local address (127.0.0.1, localhost, 192.168.x.x, etc.),
   * the port scan protection must block the connection when enabled.
   */
  test('Property 47: Local address connection blocking', () => {
    fc.assert(
      fc.property(
        localAddressArbitrary,
        randomPortArbitrary,
        (address: string, port: number) => {
          // Create config with local address blocking enabled
          const config = PortScanProtectionGenerator.createConfig({
            enabled: true,
            blockLocalAddresses: true,
            blockSensitivePorts: false
          });
          
          // Construct URL - wrap IPv6 addresses in brackets
          const formattedAddress = address.includes(':') ? `[${address}]` : address;
          const url = `http://${formattedAddress}:${port}/test`;
          
          // Check if URL should be blocked
          const result = PortScanProtectionGenerator.shouldBlockUrl(url, config);
          
          // Local addresses should be blocked
          expect(result.blocked).toBe(true);
          expect(result.reason).toContain('Local address');
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: professional-fingerprint-browser, Property 48: 敏感端口连接阻止
   * Validates: Requirements 18.3
   * 
   * For any sensitive port (22, 3389, 5900, etc.),
   * the port scan protection must block the connection when enabled.
   */
  test('Property 48: Sensitive port connection blocking', () => {
    fc.assert(
      fc.property(
        publicAddressArbitrary,
        sensitivePortArbitrary,
        (address: string, port: number) => {
          // Create config with sensitive port blocking enabled
          const config = PortScanProtectionGenerator.createConfig({
            enabled: true,
            blockLocalAddresses: false,
            blockSensitivePorts: true
          });
          
          // Construct URL
          const url = `http://${address}:${port}/test`;
          
          // Check if URL should be blocked
          const result = PortScanProtectionGenerator.shouldBlockUrl(url, config);
          
          // Sensitive ports should be blocked
          expect(result.blocked).toBe(true);
          expect(result.reason).toContain('Sensitive port');
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Additional test: Public addresses with non-sensitive ports are allowed
   * 
   * When protection is enabled but the address is public and port is not sensitive,
   * the connection should be allowed.
   */
  test('Property 47/48 (Extended): Public addresses with non-sensitive ports are allowed', () => {
    fc.assert(
      fc.property(
        publicAddressArbitrary,
        (address: string) => {
          // Create config with both protections enabled
          const config = PortScanProtectionGenerator.createConfig({
            enabled: true,
            blockLocalAddresses: true,
            blockSensitivePorts: true
          });
          
          // Use a non-sensitive port that's not in the default list
          const url = `http://${address}:8888/test`;
          
          // Check if URL should be blocked
          const result = PortScanProtectionGenerator.shouldBlockUrl(url, config);
          
          // Public addresses with non-sensitive ports should be allowed
          expect(result.blocked).toBe(false);
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Additional test: Disabled protection allows all connections
   * 
   * When protection is disabled, all connections should be allowed.
   */
  test('Property 47/48 (Extended): Disabled protection allows all connections', () => {
    fc.assert(
      fc.property(
        localAddressArbitrary,
        sensitivePortArbitrary,
        (address: string, port: number) => {
          // Create disabled config
          const config = PortScanProtectionGenerator.createDisabledConfig();
          
          // Construct URL with local address and sensitive port
          const url = `http://${address}:${port}/test`;
          
          // Check if URL should be blocked
          const result = PortScanProtectionGenerator.shouldBlockUrl(url, config);
          
          // Nothing should be blocked when disabled
          expect(result.blocked).toBe(false);
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Additional test: isLocalAddress correctly identifies local addresses
   */
  test('Property 47 (Extended): isLocalAddress correctly identifies local addresses', () => {
    fc.assert(
      fc.property(
        localAddressArbitrary,
        (address: string) => {
          const isLocal = PortScanProtectionGenerator.isLocalAddress(address);
          expect(isLocal).toBe(true);
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Additional test: isLocalAddress correctly identifies public addresses
   */
  test('Property 47 (Extended): isLocalAddress correctly identifies public addresses', () => {
    fc.assert(
      fc.property(
        publicAddressArbitrary,
        (address: string) => {
          const isLocal = PortScanProtectionGenerator.isLocalAddress(address);
          expect(isLocal).toBe(false);
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Additional test: isSensitivePort correctly identifies sensitive ports
   */
  test('Property 48 (Extended): isSensitivePort correctly identifies sensitive ports', () => {
    fc.assert(
      fc.property(
        sensitivePortArbitrary,
        (port: number) => {
          const isSensitive = PortScanProtectionGenerator.isSensitivePort(port);
          expect(isSensitive).toBe(true);
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Additional test: Custom blocked ports are respected
   */
  test('Property 48 (Extended): Custom blocked ports are respected', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 49152, max: 65535 }), // High ports not in default list
        (customPort: number) => {
          // Create config with custom blocked port
          const config = PortScanProtectionGenerator.createConfig({
            enabled: true,
            blockLocalAddresses: false,
            blockSensitivePorts: true,
            customBlockedPorts: [customPort]
          });
          
          // Construct URL with custom port
          const url = `http://example.com:${customPort}/test`;
          
          // Check if URL should be blocked
          const result = PortScanProtectionGenerator.shouldBlockUrl(url, config);
          
          // Custom port should be blocked
          expect(result.blocked).toBe(true);
          expect(result.reason).toContain('Sensitive port');
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Additional test: Custom blocked addresses are respected
   */
  test('Property 47 (Extended): Custom blocked addresses are respected', () => {
    const customAddresses = ['custom.local', 'internal.test'];
    
    for (const customAddr of customAddresses) {
      // Create config with custom blocked address
      const config = PortScanProtectionGenerator.createConfig({
        enabled: true,
        blockLocalAddresses: true,
        blockSensitivePorts: false,
        customBlockedAddresses: [customAddr]
      });
      
      // Construct URL with custom address
      const url = `http://${customAddr}:8080/test`;
      
      // Check if URL should be blocked
      const result = PortScanProtectionGenerator.shouldBlockUrl(url, config);
      
      // Custom address should be blocked
      expect(result.blocked).toBe(true);
      expect(result.reason).toContain('Local address');
    }
  });

  /**
   * Additional test: Generated script contains protection logic
   */
  test('Property 47/48 (Extended): Generated script contains protection logic', () => {
    const config = PortScanProtectionGenerator.createDefaultConfig();
    const script = PortScanProtectionGenerator.generateScript(config);
    
    // Verify script contains key components
    expect(script).toContain('Port Scan Protection');
    expect(script).toContain('LOCAL_ADDRESSES');
    expect(script).toContain('SENSITIVE_PORTS');
    expect(script).toContain('isLocalAddress');
    expect(script).toContain('isSensitivePort');
    expect(script).toContain('shouldBlock');
    
    // Verify script overrides WebSocket
    expect(script).toContain('WebSocket');
    
    // Verify script overrides fetch
    expect(script).toContain('fetch');
    
    // Verify script overrides XMLHttpRequest
    expect(script).toContain('XMLHttpRequest');
  });

  /**
   * Additional test: Disabled config generates minimal script
   */
  test('Property 47/48 (Extended): Disabled config generates minimal script', () => {
    const config = PortScanProtectionGenerator.createDisabledConfig();
    const script = PortScanProtectionGenerator.generateScript(config);
    
    // Verify script indicates disabled state
    expect(script).toContain('Disabled');
    
    // Verify script does not contain protection logic
    expect(script).not.toContain('shouldBlock');
  });

  /**
   * Additional test: Config validation works correctly
   */
  test('Property 47/48 (Extended): Config validation works correctly', () => {
    // Valid config
    const validConfig = PortScanProtectionGenerator.createDefaultConfig();
    const validResult = PortScanProtectionGenerator.validateConfig(validConfig);
    expect(validResult.valid).toBe(true);
    expect(validResult.errors).toHaveLength(0);
    
    // Invalid port
    const invalidPortConfig: PortScanProtectionConfig = {
      ...validConfig,
      customBlockedPorts: [99999] // Invalid port
    };
    const invalidPortResult = PortScanProtectionGenerator.validateConfig(invalidPortConfig);
    expect(invalidPortResult.valid).toBe(false);
    expect(invalidPortResult.errors.length).toBeGreaterThan(0);
    
    // Invalid address
    const invalidAddrConfig: PortScanProtectionConfig = {
      ...validConfig,
      customBlockedAddresses: [''] // Empty string
    };
    const invalidAddrResult = PortScanProtectionGenerator.validateConfig(invalidAddrConfig);
    expect(invalidAddrResult.valid).toBe(false);
    expect(invalidAddrResult.errors.length).toBeGreaterThan(0);
  });

  /**
   * Additional test: Default sensitive ports list is comprehensive
   */
  test('Property 48 (Extended): Default sensitive ports list is comprehensive', () => {
    const sensitivePorts = PortScanProtectionGenerator.getDefaultSensitivePorts();
    
    // Verify we have a reasonable number of ports
    expect(sensitivePorts.length).toBeGreaterThan(20);
    
    // Verify critical ports are included
    expect(sensitivePorts).toContain(22);   // SSH
    expect(sensitivePorts).toContain(3389); // RDP
    expect(sensitivePorts).toContain(5900); // VNC
    expect(sensitivePorts).toContain(3306); // MySQL
    expect(sensitivePorts).toContain(5432); // PostgreSQL
    expect(sensitivePorts).toContain(27017); // MongoDB
    expect(sensitivePorts).toContain(6379); // Redis
  });

  /**
   * Additional test: Default local addresses list is comprehensive
   */
  test('Property 47 (Extended): Default local addresses list is comprehensive', () => {
    const localAddresses = PortScanProtectionGenerator.getDefaultLocalAddresses();
    
    // Verify we have a reasonable number of addresses
    expect(localAddresses.length).toBeGreaterThan(10);
    
    // Verify critical addresses are included
    expect(localAddresses).toContain('127.0.0.1');
    expect(localAddresses).toContain('localhost');
    expect(localAddresses).toContain('0.0.0.0');
    expect(localAddresses).toContain('::1');
    expect(localAddresses).toContain('192.168.');
    expect(localAddresses).toContain('10.');
    expect(localAddresses).toContain('172.16.');
  });

  /**
   * Additional test: Both local address and sensitive port blocking work together
   */
  test('Property 47/48 (Extended): Combined blocking works correctly', () => {
    fc.assert(
      fc.property(
        localAddressArbitrary,
        sensitivePortArbitrary,
        (address: string, port: number) => {
          // Create config with both protections enabled
          const config = PortScanProtectionGenerator.createConfig({
            enabled: true,
            blockLocalAddresses: true,
            blockSensitivePorts: true
          });
          
          // Construct URL with local address and sensitive port
          // Wrap IPv6 addresses in brackets
          const formattedAddress = address.includes(':') ? `[${address}]` : address;
          const url = `http://${formattedAddress}:${port}/test`;
          
          // Check if URL should be blocked
          const result = PortScanProtectionGenerator.shouldBlockUrl(url, config);
          
          // Should be blocked (local address takes precedence in reason)
          expect(result.blocked).toBe(true);
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Additional test: WebSocket URLs are handled correctly
   */
  test('Property 47/48 (Extended): WebSocket URLs are handled correctly', () => {
    const config = PortScanProtectionGenerator.createDefaultConfig();
    
    // Local WebSocket should be blocked
    const localWsResult = PortScanProtectionGenerator.shouldBlockUrl('ws://127.0.0.1:8080/socket', config);
    expect(localWsResult.blocked).toBe(true);
    
    // Secure WebSocket to local should be blocked
    const localWssResult = PortScanProtectionGenerator.shouldBlockUrl('wss://localhost:443/socket', config);
    expect(localWssResult.blocked).toBe(true);
    
    // Public WebSocket with non-sensitive port should be allowed
    const publicWsResult = PortScanProtectionGenerator.shouldBlockUrl('ws://example.com:8888/socket', config);
    expect(publicWsResult.blocked).toBe(false);
  });

  /**
   * Additional test: Invalid URLs don't cause errors
   */
  test('Property 47/48 (Extended): Invalid URLs are handled gracefully', () => {
    const config = PortScanProtectionGenerator.createDefaultConfig();
    
    // Invalid or non-http URLs should not be blocked (and should not throw)
    const nonBlockedUrls = [
      'not-a-url',
      '',
      'ftp://example.com',  // Non-http protocol
      '://missing-protocol',
      'file:///local/path',
      'data:text/html,<h1>test</h1>'
    ];
    
    for (const url of nonBlockedUrls) {
      const result = PortScanProtectionGenerator.shouldBlockUrl(url, config);
      expect(result.blocked).toBe(false);
    }
  });
});
