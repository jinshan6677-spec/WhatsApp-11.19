/**
 * Property-Based Tests for PortAllocator
 * 
 * Tests Properties 1 and 2 from the correctness properties document
 */

import * as fc from 'fast-check';
import { PortAllocator } from '../../src/infrastructure/proxy/PortAllocator';

describe('PortAllocator Property Tests', () => {
  let portAllocator: PortAllocator;

  beforeEach(() => {
    portAllocator = new PortAllocator({
      logger: () => {} // Silent logger for tests
    });
  });

  afterEach(async () => {
    // Clean up all allocations
    portAllocator.cleanup();
  });

  /**
   * Feature: professional-fingerprint-browser, Property 1: 端口唯一性
   * Validates: Requirements 1.1
   * 
   * For any two concurrently running accounts, their allocated local proxy ports must be different
   */
  test('Property 1: Port uniqueness for concurrent accounts', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate an array of 2-10 unique account IDs
        fc.array(
          fc.string({ minLength: 5, maxLength: 20 }),
          { minLength: 2, maxLength: 10 }
        ).map(ids => Array.from(new Set(ids))), // Ensure unique IDs
        async (accountIds) => {
          // Skip if we don't have at least 2 unique IDs
          if (accountIds.length < 2) {
            return true;
          }

          const allocatedPorts: number[] = [];

          try {
            // Allocate ports for all accounts
            for (const accountId of accountIds) {
              const port = await portAllocator.allocate(accountId);
              allocatedPorts.push(port);
            }

            // Verify all ports are unique
            const uniquePorts = new Set(allocatedPorts);
            expect(uniquePorts.size).toBe(allocatedPorts.length);

            // Verify no duplicate ports
            for (let i = 0; i < allocatedPorts.length; i++) {
              for (let j = i + 1; j < allocatedPorts.length; j++) {
                expect(allocatedPorts[i]).not.toBe(allocatedPorts[j]);
              }
            }

            return true;
          } finally {
            // Clean up: release all allocated ports
            for (const accountId of accountIds) {
              portAllocator.releaseByAccountId(accountId);
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: professional-fingerprint-browser, Property 2: 端口范围约束
   * Validates: Requirements 1.1
   * 
   * For any account startup, the allocated local port must be within the range 10000-60000
   */
  test('Property 2: Port range constraint (10000-60000)', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate random account IDs
        fc.string({ minLength: 5, maxLength: 20 }),
        async (accountId) => {
          try {
            // Allocate a port
            const port = await portAllocator.allocate(accountId);

            // Verify port is within valid range
            expect(port).toBeGreaterThanOrEqual(10000);
            expect(port).toBeLessThanOrEqual(60000);

            // Additional check: port should be a valid port number
            expect(Number.isInteger(port)).toBe(true);
            expect(port).toBeGreaterThan(0);
            expect(port).toBeLessThan(65536);

            return true;
          } finally {
            // Clean up
            portAllocator.releaseByAccountId(accountId);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Additional property test: Port allocation idempotency
   * 
   * For any account, allocating a port multiple times should return the same port
   */
  test('Property: Port allocation idempotency', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 5, maxLength: 20 }),
        async (accountId) => {
          try {
            // Allocate port first time
            const port1 = await portAllocator.allocate(accountId);

            // Allocate port second time (should return same port)
            const port2 = await portAllocator.allocate(accountId);

            // Verify same port is returned
            expect(port1).toBe(port2);

            return true;
          } finally {
            portAllocator.releaseByAccountId(accountId);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Additional property test: Port release and reallocation
   * 
   * For any account, after releasing a port, it should be available for reallocation
   */
  test('Property: Port release and reallocation', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.tuple(
          fc.string({ minLength: 5, maxLength: 20 }),
          fc.string({ minLength: 5, maxLength: 20 })
        ).filter(([id1, id2]) => id1 !== id2), // Ensure different account IDs
        async ([accountId1, accountId2]) => {
          try {
            // Allocate port for first account
            const port1 = await portAllocator.allocate(accountId1);

            // Release the port
            const released = portAllocator.release(port1);
            expect(released).toBe(true);

            // Allocate port for second account
            // It might get the same port (since it's now available) or a different one
            const port2 = await portAllocator.allocate(accountId2);

            // Verify port2 is valid
            expect(port2).toBeGreaterThanOrEqual(10000);
            expect(port2).toBeLessThanOrEqual(60000);

            // Verify the port is actually allocated to accountId2
            const foundPort = portAllocator.findPortByAccountId(accountId2);
            expect(foundPort).toBe(port2);

            return true;
          } finally {
            portAllocator.releaseByAccountId(accountId1);
            portAllocator.releaseByAccountId(accountId2);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Additional property test: Statistics accuracy
   * 
   * For any set of allocations, the statistics should accurately reflect the state
   */
  test('Property: Statistics accuracy', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.string({ minLength: 5, maxLength: 20 }),
          { minLength: 1, maxLength: 20 }
        ).map(ids => Array.from(new Set(ids))), // Ensure unique IDs
        async (accountIds) => {
          try {
            // Allocate ports for all accounts
            for (const accountId of accountIds) {
              await portAllocator.allocate(accountId);
            }

            // Get statistics
            const stats = portAllocator.getStats();

            // Verify statistics
            expect(stats.allocatedPorts).toBe(accountIds.length);
            expect(stats.totalPorts).toBe(60000 - 10000 + 1); // 50001 ports
            expect(stats.availablePorts).toBe(stats.totalPorts - stats.allocatedPorts);
            expect(stats.utilizationPercent).toBeCloseTo(
              (accountIds.length / stats.totalPorts) * 100,
              2
            );

            return true;
          } finally {
            for (const accountId of accountIds) {
              portAllocator.releaseByAccountId(accountId);
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
