/**
 * Property-Based Tests for Chromium Proxy Arguments
 * 
 * Tests Property 7 from the correctness properties document
 */

import * as fc from 'fast-check';
import {
  generateChromiumProxyArgs,
  toChromiumArgs,
  validateChromiumProxyArgs
} from '../../src/infrastructure/proxy/ProxyRelayIntegration';

describe('Chromium Proxy Arguments Property Tests', () => {
  /**
   * Feature: professional-fingerprint-browser, Property 7: Chromium 代理参数正确性
   * Validates: Requirements 1.6
   * 
   * For any created Chromium instance, its startup parameters must include `--proxy-server=socks5://127.0.0.1:allocated_port`
   */
  test('Property 7: Chromium proxy parameter correctness', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 10000, max: 60000 }), // Local port
        fc.option(fc.string({ minLength: 5, maxLength: 50 }), { nil: undefined }), // Bypass list
        async (localPort, bypassList) => {
          // Generate Chromium proxy arguments
          const proxyArgs = generateChromiumProxyArgs(localPort, bypassList);

          // Verify proxy server format
          expect(proxyArgs.proxyServer).toBe(`socks5://127.0.0.1:${localPort}`);

          // Verify bypass list
          if (bypassList) {
            expect(proxyArgs.proxyBypassList).toBe(bypassList);
          } else {
            expect(proxyArgs.proxyBypassList).toBe('<local>');
          }

          // Convert to Chromium args
          const chromiumArgs = toChromiumArgs(proxyArgs);

          // Verify args array contains proxy server
          expect(chromiumArgs).toContain(`--proxy-server=socks5://127.0.0.1:${localPort}`);

          // Verify args array contains bypass list if provided
          if (bypassList) {
            expect(chromiumArgs).toContain(`--proxy-bypass-list=${bypassList}`);
          }

          // Validate using validation function
          const isValid = validateChromiumProxyArgs(chromiumArgs, localPort);
          expect(isValid).toBe(true);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Additional property: Proxy server format consistency
   * 
   * For any local port, the proxy server string must always follow the format socks5://127.0.0.1:port
   */
  test('Property: Proxy server format consistency', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 10000, max: 60000 }),
        async (localPort) => {
          const proxyArgs = generateChromiumProxyArgs(localPort);

          // Verify format
          const expectedFormat = `socks5://127.0.0.1:${localPort}`;
          expect(proxyArgs.proxyServer).toBe(expectedFormat);

          // Verify it's a valid URL-like string
          expect(proxyArgs.proxyServer).toMatch(/^socks5:\/\/127\.0\.0\.1:\d+$/);

          // Verify port is correctly embedded
          const portMatch = proxyArgs.proxyServer.match(/:(\d+)$/);
          expect(portMatch).toBeTruthy();
          expect(parseInt(portMatch![1], 10)).toBe(localPort);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Additional property: Chromium args array structure
   * 
   * For any proxy configuration, the Chromium args array must be well-formed
   */
  test('Property: Chromium args array structure', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 10000, max: 60000 }),
        fc.option(fc.string({ minLength: 5, maxLength: 50 }), { nil: undefined }),
        async (localPort, bypassList) => {
          const proxyArgs = generateChromiumProxyArgs(localPort, bypassList);
          const chromiumArgs = toChromiumArgs(proxyArgs);

          // Verify it's an array
          expect(Array.isArray(chromiumArgs)).toBe(true);

          // Verify minimum length
          expect(chromiumArgs.length).toBeGreaterThanOrEqual(1);

          // Verify all elements are strings
          for (const arg of chromiumArgs) {
            expect(typeof arg).toBe('string');
          }

          // Verify all args start with --
          for (const arg of chromiumArgs) {
            expect(arg.startsWith('--')).toBe(true);
          }

          // Verify proxy-server arg exists
          const hasProxyServer = chromiumArgs.some(arg => arg.startsWith('--proxy-server='));
          expect(hasProxyServer).toBe(true);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Additional property: Validation function correctness
   * 
   * For any valid Chromium args, the validation function should return true
   */
  test('Property: Validation function correctness', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 10000, max: 60000 }),
        async (localPort) => {
          const proxyArgs = generateChromiumProxyArgs(localPort);
          const chromiumArgs = toChromiumArgs(proxyArgs);

          // Validation should pass for correctly generated args
          expect(validateChromiumProxyArgs(chromiumArgs, localPort)).toBe(true);

          // Validation should fail for wrong port
          const wrongPort = localPort === 10000 ? 10001 : 10000;
          expect(validateChromiumProxyArgs(chromiumArgs, wrongPort)).toBe(false);

          // Validation should fail for empty args
          expect(validateChromiumProxyArgs([], localPort)).toBe(false);

          // Validation should fail for args without proxy-server
          const invalidArgs = ['--some-other-arg=value'];
          expect(validateChromiumProxyArgs(invalidArgs, localPort)).toBe(false);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Additional property: Port range preservation
   * 
   * For any port in the valid range, it should be correctly embedded in the proxy server string
   */
  test('Property: Port range preservation', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 10000, max: 60000 }),
        async (localPort) => {
          const proxyArgs = generateChromiumProxyArgs(localPort);

          // Extract port from proxy server string
          const match = proxyArgs.proxyServer.match(/:(\d+)$/);
          expect(match).toBeTruthy();

          const extractedPort = parseInt(match![1], 10);

          // Verify port is preserved exactly
          expect(extractedPort).toBe(localPort);

          // Verify port is in valid range
          expect(extractedPort).toBeGreaterThanOrEqual(10000);
          expect(extractedPort).toBeLessThanOrEqual(60000);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Additional property: Bypass list handling
   * 
   * For any bypass list, it should be correctly included in the arguments
   */
  test('Property: Bypass list handling', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 10000, max: 60000 }),
        fc.oneof(
          fc.constant(undefined),
          fc.constant('<local>'),
          fc.constant('localhost,127.0.0.1'),
          fc.string({ minLength: 5, maxLength: 50 })
        ),
        async (localPort, bypassList) => {
          const proxyArgs = generateChromiumProxyArgs(localPort, bypassList);
          const chromiumArgs = toChromiumArgs(proxyArgs);

          if (bypassList) {
            // Bypass list should be in proxy args
            expect(proxyArgs.proxyBypassList).toBe(bypassList);

            // Bypass list should be in chromium args
            const bypassArg = chromiumArgs.find(arg => arg.startsWith('--proxy-bypass-list='));
            expect(bypassArg).toBeTruthy();
            expect(bypassArg).toBe(`--proxy-bypass-list=${bypassList}`);
          } else {
            // Default bypass list should be used
            expect(proxyArgs.proxyBypassList).toBe('<local>');
          }

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Additional property: Idempotency of argument generation
   * 
   * For any port and bypass list, generating arguments multiple times should produce identical results
   */
  test('Property: Idempotency of argument generation', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 10000, max: 60000 }),
        fc.option(fc.string({ minLength: 5, maxLength: 50 }), { nil: undefined }),
        async (localPort, bypassList) => {
          // Generate arguments twice
          const args1 = generateChromiumProxyArgs(localPort, bypassList);
          const args2 = generateChromiumProxyArgs(localPort, bypassList);

          // Verify they are identical
          expect(args1.proxyServer).toBe(args2.proxyServer);
          expect(args1.proxyBypassList).toBe(args2.proxyBypassList);

          // Convert to chromium args twice
          const chromiumArgs1 = toChromiumArgs(args1);
          const chromiumArgs2 = toChromiumArgs(args2);

          // Verify they are identical
          expect(chromiumArgs1).toEqual(chromiumArgs2);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});
