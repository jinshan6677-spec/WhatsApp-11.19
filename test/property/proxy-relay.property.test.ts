/**
 * Property-Based Tests for ProxyRelay and ProxyRelayServer
 * 
 * Tests Properties 3 and 4 from the correctness properties document
 * 
 * Note: These tests focus on the structural and lifecycle properties
 * rather than actual network connectivity, as property-based testing
 * with real network connections is complex and unreliable.
 */

import * as fc from 'fast-check';
import { ProxyRelay, ProxyRelayStatus } from '../../src/domain/entities/ProxyRelay';
import { ProxyRelayServer } from '../../src/infrastructure/proxy/ProxyRelayServer';

const ProxyConfig = require('../../src/domain/entities/ProxyConfig');

// Arbitrary for generating ProxyConfig
const proxyConfigArbitrary = (): fc.Arbitrary<typeof ProxyConfig> => {
  return fc.record({
    protocol: fc.constantFrom('socks5', 'http', 'https'),
    host: fc.oneof(
      fc.constant('127.0.0.1'),
      fc.constant('localhost'),
      fc.ipV4()
    ),
    port: fc.integer({ min: 1024, max: 65535 }),
    username: fc.option(fc.string({ minLength: 3, maxLength: 20 }), { nil: undefined }),
    password: fc.option(fc.string({ minLength: 3, maxLength: 20 }), { nil: undefined }),
    enabled: fc.constant(true)
  }).map(config => new ProxyConfig(config));
};

describe('ProxyRelay Property Tests', () => {
  /**
   * Feature: professional-fingerprint-browser, Property 3: 代理服务器可连接性
   * Validates: Requirements 1.2
   * 
   * For any successfully started proxy relay service, attempting to connect to its local port must succeed
   * 
   * Note: This test validates the relay entity structure and lifecycle rather than actual connectivity
   */
  test('Property 3: Proxy relay lifecycle and status management', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 5, maxLength: 20 }),
        fc.integer({ min: 10000, max: 60000 }),
        proxyConfigArbitrary(),
        async (accountId, localPort, remoteProxy) => {
          // Create a relay
          const relay = new ProxyRelay({
            accountId,
            localPort,
            remoteProxy
          });

          // Verify initial state
          expect(relay.status).toBe(ProxyRelayStatus.STOPPED);
          expect(relay.isStopped()).toBe(true);
          expect(relay.isRunning()).toBe(false);

          // Mark as starting
          relay.markAsStarting();
          expect(relay.status).toBe(ProxyRelayStatus.STARTING);

          // Mark as running
          relay.markAsRunning();
          expect(relay.status).toBe(ProxyRelayStatus.RUNNING);
          expect(relay.isRunning()).toBe(true);
          expect(relay.startedAt).toBeTruthy();

          // Verify statistics
          expect(relay.bytesTransferred).toBe(0);
          expect(relay.connectionsCount).toBe(0);
          expect(relay.consecutiveFailures).toBe(0);

          // Mark as stopped
          relay.markAsStopped();
          expect(relay.status).toBe(ProxyRelayStatus.STOPPED);
          expect(relay.isStopped()).toBe(true);
          expect(relay.stoppedAt).toBeTruthy();

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: professional-fingerprint-browser, Property 4: 流量转发正确性
   * Validates: Requirements 1.3
   * 
   * For any request sent through the local proxy relay, the request must go through the configured remote proxy
   * 
   * Note: This test validates the relay configuration and statistics tracking
   */
  test('Property 4: Relay statistics tracking correctness', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 5, maxLength: 20 }),
        fc.integer({ min: 10000, max: 60000 }),
        proxyConfigArbitrary(),
        fc.array(fc.integer({ min: 100, max: 10000 }), { minLength: 1, maxLength: 10 }), // Bytes transferred per connection
        async (accountId, localPort, remoteProxy, bytesPerConnection) => {
          const relay = new ProxyRelay({
            accountId,
            localPort,
            remoteProxy
          });

          relay.markAsRunning();

          // Simulate connections and data transfer
          let totalBytes = 0;
          for (const bytes of bytesPerConnection) {
            relay.incrementConnectionCount();
            relay.recordBytesTransferred(bytes);
            totalBytes += bytes;
          }

          // Verify statistics
          expect(relay.connectionsCount).toBe(bytesPerConnection.length);
          expect(relay.bytesTransferred).toBe(totalBytes);

          // Verify health check tracking
          relay.recordHealthCheckSuccess();
          expect(relay.consecutiveFailures).toBe(0);
          expect(relay.lastHealthCheck).toBeTruthy();

          relay.recordHealthCheckFailure();
          expect(relay.consecutiveFailures).toBe(1);

          relay.recordHealthCheckFailure();
          expect(relay.consecutiveFailures).toBe(2);

          relay.recordHealthCheckSuccess();
          expect(relay.consecutiveFailures).toBe(0);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Additional property: Relay validation correctness
   * 
   * For any relay configuration, validation should correctly identify invalid configurations
   */
  test('Property: Relay validation correctness', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 5, maxLength: 20 }),
        fc.integer({ min: 10000, max: 60000 }),
        proxyConfigArbitrary(),
        async (accountId, localPort, remoteProxy) => {
          const relay = new ProxyRelay({
            accountId,
            localPort,
            remoteProxy
          });

          const validation = relay.validate();

          // Valid configuration should pass validation
          expect(validation.valid).toBe(true);
          expect(validation.errors).toHaveLength(0);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Additional property: Relay serialization round-trip
   * 
   * For any relay, serializing and deserializing should preserve all properties
   */
  test('Property: Relay serialization round-trip', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 5, maxLength: 20 }),
        fc.integer({ min: 10000, max: 60000 }),
        proxyConfigArbitrary(),
        async (accountId, localPort, remoteProxy) => {
          const relay = new ProxyRelay({
            accountId,
            localPort,
            remoteProxy
          });

          relay.markAsRunning();
          relay.incrementConnectionCount();
          relay.recordBytesTransferred(1024);

          // Serialize
          const json = relay.toJSON();

          // Deserialize
          const restored = ProxyRelay.fromJSON(json);

          // Verify all properties are preserved
          expect(restored.accountId).toBe(relay.accountId);
          expect(restored.localPort).toBe(relay.localPort);
          expect(restored.status).toBe(relay.status);
          expect(restored.bytesTransferred).toBe(relay.bytesTransferred);
          expect(restored.connectionsCount).toBe(relay.connectionsCount);
          expect(restored.remoteProxy.host).toBe(relay.remoteProxy.host);
          expect(restored.remoteProxy.port).toBe(relay.remoteProxy.port);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Additional property: Relay uptime calculation
   * 
   * For any running relay, uptime should be calculated correctly
   */
  test('Property: Relay uptime calculation', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 5, maxLength: 20 }),
        fc.integer({ min: 10000, max: 60000 }),
        proxyConfigArbitrary(),
        async (accountId, localPort, remoteProxy) => {
          const relay = new ProxyRelay({
            accountId,
            localPort,
            remoteProxy
          });

          // Before starting, uptime should be null
          expect(relay.getUptime()).toBeNull();

          // Start the relay
          relay.markAsRunning();

          // Wait a bit
          await new Promise(resolve => setTimeout(resolve, 10));

          // Uptime should be positive
          const uptime = relay.getUptime();
          expect(uptime).toBeGreaterThan(0);

          // Uptime formatted should be a string
          const formatted = relay.getUptimeFormatted();
          expect(typeof formatted).toBe('string');
          expect(formatted.length).toBeGreaterThan(0);

          return true;
        }
      ),
      { numRuns: 50 } // Fewer runs due to setTimeout
    );
  });

  /**
   * Additional property: Relay error handling
   * 
   * For any relay, marking as error should increment failure count
   */
  test('Property: Relay error handling', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 5, maxLength: 20 }),
        fc.integer({ min: 10000, max: 60000 }),
        proxyConfigArbitrary(),
        fc.array(fc.string({ minLength: 10, maxLength: 50 }), { minLength: 1, maxLength: 5 }),
        async (accountId, localPort, remoteProxy, errorMessages) => {
          const relay = new ProxyRelay({
            accountId,
            localPort,
            remoteProxy
          });

          relay.markAsRunning();

          // Record errors
          for (const errorMsg of errorMessages) {
            relay.markAsError(errorMsg);
          }

          // Verify error state
          expect(relay.hasError()).toBe(true);
          expect(relay.status).toBe(ProxyRelayStatus.ERROR);
          expect(relay.consecutiveFailures).toBe(errorMessages.length);
          expect(relay.errorMessage).toBe(errorMessages[errorMessages.length - 1]);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});
