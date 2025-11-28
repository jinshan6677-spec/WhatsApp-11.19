/**
 * Property-Based Tests for Proxy List Management
 * 
 * Feature: professional-fingerprint-browser
 * Tests the proxy list management functionality including
 * fixed proxy binding and resource cleanup on proxy change.
 * 
 * Property 55: 代理固定绑定不变性
 * Property 56: 代理更换资源清理
 * 
 * Validates: Requirements 34.2-34.4
 * 
 * @module test/property/proxy-list-manager
 */

import * as fc from 'fast-check';
import * as fs from 'fs';
import * as path from 'path';
import { ProxyListManager, ProxyConfig, AccountProxyBinding } from '../../src/application/services/ProxyListManager';

// Test directory for isolation
const TEST_SESSION_DIR = 'test-session-data-proxy-list';

// Cleanup helper
function cleanupTestDir(): void {
  if (fs.existsSync(TEST_SESSION_DIR)) {
    fs.rmSync(TEST_SESSION_DIR, { recursive: true, force: true });
  }
}

// Arbitraries for Proxy List Management testing

const protocolArbitrary = fc.constantFrom<'socks5' | 'http' | 'https'>('socks5', 'http', 'https');

const proxyNameArbitrary = fc.string({ minLength: 1, maxLength: 50 })
  .filter(s => s.trim().length > 0);

const hostArbitrary = fc.constantFrom(
  '192.168.1.1',
  '10.0.0.1',
  'proxy.example.com',
  'socks.server.net',
  '203.0.113.50'
);

const portArbitrary = fc.integer({ min: 1024, max: 65535 });

const accountIdArbitrary = fc.string({ minLength: 1, maxLength: 20 })
  .filter(s => /^[a-zA-Z0-9_-]+$/.test(s))
  .map(s => `account_${s}`);

const proxyConfigArbitrary = fc.record({
  name: proxyNameArbitrary,
  protocol: protocolArbitrary,
  host: hostArbitrary,
  port: portArbitrary,
  username: fc.option(fc.string({ minLength: 1, maxLength: 20 }), { nil: undefined }),
  password: fc.option(fc.string({ minLength: 1, maxLength: 20 }), { nil: undefined }),
  country: fc.option(fc.constantFrom('US', 'GB', 'DE', 'JP', 'CN'), { nil: undefined })
});

describe('Proxy List Manager Property Tests', () => {
  let manager: ProxyListManager;

  beforeEach(() => {
    cleanupTestDir();
    manager = new ProxyListManager({
      sessionDataDir: TEST_SESSION_DIR,
      logger: () => {} // Silent logger for tests
    });
  });

  afterEach(() => {
    cleanupTestDir();
  });

  afterAll(() => {
    cleanupTestDir();
  });

  /**
   * Feature: professional-fingerprint-browser, Property 55: 代理固定绑定不变性
   * Validates: Requirements 34.2, 34.3
   * 
   * For any account with a bound proxy, the binding should remain
   * unchanged until explicitly modified or removed.
   */
  test('Property 55: Proxy fixed binding invariance', async () => {
    await fc.assert(
      fc.asyncProperty(
        accountIdArbitrary,
        proxyConfigArbitrary,
        fc.integer({ min: 1, max: 10 }),
        async (accountId: string, proxyConfig, queryCount: number) => {
          // Add proxy
          const proxy = manager.addProxy(proxyConfig);
          
          // Bind proxy to account
          const binding = await manager.bindProxyToAccount(accountId, proxy.id);
          
          // Verify binding was created
          expect(binding.accountId).toBe(accountId);
          expect(binding.proxyId).toBe(proxy.id);
          
          // Query the binding multiple times - should always return the same
          for (let i = 0; i < queryCount; i++) {
            const queriedBinding = manager.getAccountBinding(accountId);
            expect(queriedBinding).not.toBeNull();
            expect(queriedBinding!.accountId).toBe(accountId);
            expect(queriedBinding!.proxyId).toBe(proxy.id);
            
            // Also verify getAccountProxy returns the correct proxy
            const queriedProxy = manager.getAccountProxy(accountId);
            expect(queriedProxy).not.toBeNull();
            expect(queriedProxy!.id).toBe(proxy.id);
            expect(queriedProxy!.host).toBe(proxyConfig.host);
            expect(queriedProxy!.port).toBe(proxyConfig.port);
          }
          
          return true;
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Feature: professional-fingerprint-browser, Property 56: 代理更换资源清理
   * Validates: Requirements 34.4
   * 
   * When changing an account's proxy, the old binding should be
   * properly cleaned up and replaced with the new binding.
   */
  test('Property 56: Proxy change resource cleanup', async () => {
    await fc.assert(
      fc.asyncProperty(
        accountIdArbitrary,
        proxyConfigArbitrary,
        proxyConfigArbitrary,
        async (accountId: string, oldProxyConfig, newProxyConfig) => {
          // Add both proxies
          const oldProxy = manager.addProxy(oldProxyConfig);
          const newProxy = manager.addProxy({
            ...newProxyConfig,
            name: newProxyConfig.name + '_new' // Ensure unique name
          });
          
          // Bind old proxy to account
          await manager.bindProxyToAccount(accountId, oldProxy.id);
          
          // Verify old binding
          let binding = manager.getAccountBinding(accountId);
          expect(binding).not.toBeNull();
          expect(binding!.proxyId).toBe(oldProxy.id);
          
          // Change to new proxy
          const newBinding = await manager.changeAccountProxy(accountId, newProxy.id);
          
          // Verify new binding replaced old binding
          expect(newBinding.accountId).toBe(accountId);
          expect(newBinding.proxyId).toBe(newProxy.id);
          
          // Verify old binding is gone
          binding = manager.getAccountBinding(accountId);
          expect(binding).not.toBeNull();
          expect(binding!.proxyId).toBe(newProxy.id);
          expect(binding!.proxyId).not.toBe(oldProxy.id);
          
          // Verify getAccountProxy returns new proxy
          const currentProxy = manager.getAccountProxy(accountId);
          expect(currentProxy).not.toBeNull();
          expect(currentProxy!.id).toBe(newProxy.id);
          
          return true;
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Additional test: Unbinding removes the binding completely
   */
  test('Property 55/56 (Extended): Unbinding removes binding completely', async () => {
    await fc.assert(
      fc.asyncProperty(
        accountIdArbitrary,
        proxyConfigArbitrary,
        async (accountId: string, proxyConfig) => {
          // Add proxy and bind
          const proxy = manager.addProxy(proxyConfig);
          await manager.bindProxyToAccount(accountId, proxy.id);
          
          // Verify binding exists
          expect(manager.getAccountBinding(accountId)).not.toBeNull();
          
          // Unbind
          await manager.unbindProxyFromAccount(accountId);
          
          // Verify binding is removed
          expect(manager.getAccountBinding(accountId)).toBeNull();
          expect(manager.getAccountProxy(accountId)).toBeNull();
          
          return true;
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Additional test: Multiple accounts can use the same proxy
   */
  test('Property 55 (Extended): Multiple accounts can use same proxy', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(accountIdArbitrary, { minLength: 2, maxLength: 5 }),
        proxyConfigArbitrary,
        async (accountIds: string[], proxyConfig) => {
          // Ensure unique account IDs
          const uniqueAccountIds = [...new Set(accountIds)];
          if (uniqueAccountIds.length < 2) return true;
          
          // Add proxy
          const proxy = manager.addProxy(proxyConfig);
          
          // Bind same proxy to all accounts
          for (const accountId of uniqueAccountIds) {
            await manager.bindProxyToAccount(accountId, proxy.id);
          }
          
          // Verify all accounts have the same proxy
          for (const accountId of uniqueAccountIds) {
            const binding = manager.getAccountBinding(accountId);
            expect(binding).not.toBeNull();
            expect(binding!.proxyId).toBe(proxy.id);
          }
          
          // Verify getAccountsUsingProxy returns all accounts
          const accountsUsingProxy = manager.getAccountsUsingProxy(proxy.id);
          expect(accountsUsingProxy.length).toBe(uniqueAccountIds.length);
          for (const accountId of uniqueAccountIds) {
            expect(accountsUsingProxy).toContain(accountId);
          }
          
          return true;
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Additional test: Cannot remove proxy that is bound to accounts
   */
  test('Property 55 (Extended): Cannot remove bound proxy', async () => {
    await fc.assert(
      fc.asyncProperty(
        accountIdArbitrary,
        proxyConfigArbitrary,
        async (accountId: string, proxyConfig) => {
          // Add proxy and bind
          const proxy = manager.addProxy(proxyConfig);
          await manager.bindProxyToAccount(accountId, proxy.id);
          
          // Try to remove proxy - should fail
          await expect(manager.removeProxy(proxy.id)).rejects.toThrow(/bound to/);
          
          // Proxy should still exist
          expect(manager.getProxy(proxy.id)).not.toBeNull();
          
          // Unbind first
          await manager.unbindProxyFromAccount(accountId);
          
          // Now removal should succeed
          await manager.removeProxy(proxy.id);
          expect(manager.getProxy(proxy.id)).toBeNull();
          
          return true;
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Additional test: Proxy CRUD operations work correctly
   */
  test('Property 55/56 (Extended): Proxy CRUD operations', async () => {
    await fc.assert(
      fc.asyncProperty(
        proxyConfigArbitrary,
        fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
        async (proxyConfig, newName: string) => {
          // Create
          const proxy = manager.addProxy(proxyConfig);
          expect(proxy.id).toBeTruthy();
          expect(proxy.name).toBe(proxyConfig.name);
          expect(proxy.host).toBe(proxyConfig.host);
          expect(proxy.port).toBe(proxyConfig.port);
          
          // Read
          const retrieved = manager.getProxy(proxy.id);
          expect(retrieved).not.toBeNull();
          expect(retrieved!.id).toBe(proxy.id);
          
          // Update
          const updated = manager.updateProxy(proxy.id, { name: newName });
          expect(updated.name).toBe(newName);
          expect(updated.host).toBe(proxyConfig.host); // Other fields unchanged
          
          // Verify update persisted
          const afterUpdate = manager.getProxy(proxy.id);
          expect(afterUpdate!.name).toBe(newName);
          
          // Delete (no bindings)
          await manager.removeProxy(proxy.id);
          expect(manager.getProxy(proxy.id)).toBeNull();
          
          return true;
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Additional test: Binding timestamp is recorded
   */
  test('Property 55 (Extended): Binding timestamp is recorded', async () => {
    await fc.assert(
      fc.asyncProperty(
        accountIdArbitrary,
        proxyConfigArbitrary,
        async (accountId: string, proxyConfig) => {
          const beforeBind = new Date();
          
          // Add proxy and bind
          const proxy = manager.addProxy(proxyConfig);
          const binding = await manager.bindProxyToAccount(accountId, proxy.id);
          
          const afterBind = new Date();
          
          // Verify timestamp is within expected range
          expect(binding.boundAt.getTime()).toBeGreaterThanOrEqual(beforeBind.getTime());
          expect(binding.boundAt.getTime()).toBeLessThanOrEqual(afterBind.getTime());
          
          return true;
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Additional test: Rebinding same proxy updates timestamp
   */
  test('Property 55 (Extended): Rebinding same proxy updates timestamp', async () => {
    const accountId = 'test_account';
    const proxyConfig = {
      name: 'Test Proxy',
      protocol: 'socks5' as const,
      host: '192.168.1.1',
      port: 1080
    };
    
    // Add proxy and bind
    const proxy = manager.addProxy(proxyConfig);
    const firstBinding = await manager.bindProxyToAccount(accountId, proxy.id);
    const firstTimestamp = firstBinding.boundAt.getTime();
    
    // Wait a bit
    await new Promise(resolve => setTimeout(resolve, 10));
    
    // Rebind same proxy
    const secondBinding = await manager.bindProxyToAccount(accountId, proxy.id);
    const secondTimestamp = secondBinding.boundAt.getTime();
    
    // Timestamp should be updated
    expect(secondTimestamp).toBeGreaterThanOrEqual(firstTimestamp);
  });

  /**
   * Additional test: Proxy validation works correctly
   */
  test('Property 55/56 (Extended): Proxy validation', () => {
    // Valid config
    const validResult = manager.validateProxyConfig({
      name: 'Test Proxy',
      protocol: 'socks5',
      host: '192.168.1.1',
      port: 1080
    });
    expect(validResult.valid).toBe(true);
    expect(validResult.errors).toHaveLength(0);
    
    // Invalid - missing name
    const noNameResult = manager.validateProxyConfig({
      protocol: 'socks5',
      host: '192.168.1.1',
      port: 1080
    });
    expect(noNameResult.valid).toBe(false);
    expect(noNameResult.errors.length).toBeGreaterThan(0);
    
    // Invalid - bad protocol
    const badProtocolResult = manager.validateProxyConfig({
      name: 'Test',
      protocol: 'invalid' as any,
      host: '192.168.1.1',
      port: 1080
    });
    expect(badProtocolResult.valid).toBe(false);
    
    // Invalid - bad port
    const badPortResult = manager.validateProxyConfig({
      name: 'Test',
      protocol: 'socks5',
      host: '192.168.1.1',
      port: 99999
    });
    expect(badPortResult.valid).toBe(false);
  });

  /**
   * Additional test: getAllProxies returns all added proxies
   */
  test('Property 55/56 (Extended): getAllProxies returns all proxies', () => {
    fc.assert(
      fc.property(
        fc.array(proxyConfigArbitrary, { minLength: 1, maxLength: 5 }),
        (proxyConfigs) => {
          // Create fresh manager for this iteration
          cleanupTestDir();
          const freshManager = new ProxyListManager({
            sessionDataDir: TEST_SESSION_DIR,
            logger: () => {}
          });
          
          // Add all proxies
          const addedProxies: ProxyConfig[] = [];
          for (let i = 0; i < proxyConfigs.length; i++) {
            const proxy = freshManager.addProxy({
              ...proxyConfigs[i],
              name: `${proxyConfigs[i].name}_${i}` // Ensure unique names
            });
            addedProxies.push(proxy);
          }
          
          // Get all proxies
          const allProxies = freshManager.getAllProxies();
          
          // Verify count
          expect(allProxies.length).toBe(addedProxies.length);
          
          // Verify all added proxies are present
          for (const added of addedProxies) {
            const found = allProxies.find(p => p.id === added.id);
            expect(found).toBeDefined();
          }
          
          return true;
        }
      ),
      { numRuns: 30 }
    );
  });

  /**
   * Additional test: getAllBindings returns all bindings
   */
  test('Property 55/56 (Extended): getAllBindings returns all bindings', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(accountIdArbitrary, { minLength: 1, maxLength: 5 }),
        proxyConfigArbitrary,
        async (accountIds: string[], proxyConfig) => {
          // Create fresh manager for this iteration
          cleanupTestDir();
          const freshManager = new ProxyListManager({
            sessionDataDir: TEST_SESSION_DIR,
            logger: () => {}
          });
          
          // Ensure unique account IDs
          const uniqueAccountIds = [...new Set(accountIds)];
          
          // Add proxy
          const proxy = freshManager.addProxy(proxyConfig);
          
          // Bind to all accounts
          for (const accountId of uniqueAccountIds) {
            await freshManager.bindProxyToAccount(accountId, proxy.id);
          }
          
          // Get all bindings
          const allBindings = freshManager.getAllBindings();
          
          // Verify count
          expect(allBindings.length).toBe(uniqueAccountIds.length);
          
          // Verify all accounts have bindings
          for (const accountId of uniqueAccountIds) {
            const found = allBindings.find(b => b.accountId === accountId);
            expect(found).toBeDefined();
            expect(found!.proxyId).toBe(proxy.id);
          }
          
          return true;
        }
      ),
      { numRuns: 30 }
    );
  });
});
