'use strict';

/**
 * Property-based tests for ViewFactory proxy isolation
 * 
 * Tests the following properties:
 * - Property 4: 多账号链式代理隔离 (Multi-account Chained Proxy Isolation)
 * 
 * **Validates: Requirements 2.4**
 */

const fc = require('fast-check');
const ProxyChainManager = require('../../src/environment/ProxyChainManager');
const LocalProxyManager = require('../../src/environment/LocalProxyManager');

// ==================== Arbitraries ====================

/**
 * Valid local host arbitrary
 */
const validLocalHostArbitrary = fc.constantFrom('127.0.0.1', 'localhost');

/**
 * Valid port arbitrary (1-65535)
 */
const validPortArbitrary = fc.integer({ min: 1, max: 65535 });

/**
 * Protocol arbitrary
 */
const protocolArbitrary = fc.constantFrom('http', 'https');

/**
 * Valid local proxy config arbitrary
 */
const validLocalProxyArbitrary = fc.record({
    enabled: fc.constant(true),
    host: validLocalHostArbitrary,
    port: validPortArbitrary,
    protocol: protocolArbitrary
});

/**
 * Valid domain name arbitrary (simplified)
 */
const validDomainArbitrary = fc.string({ minLength: 3, maxLength: 15 })
    .filter(s => /^[a-z0-9]+$/.test(s))
    .map(s => s + '.com');

/**
 * Valid chained proxy config arbitrary
 */
const validChainedProxyArbitrary = fc.record({
    enabled: fc.constant(true),
    host: validDomainArbitrary,
    port: validPortArbitrary,
    protocol: protocolArbitrary
});

/**
 * Valid chained proxy config with auth arbitrary
 */
const validChainedProxyWithAuthArbitrary = fc.record({
    enabled: fc.constant(true),
    host: validDomainArbitrary,
    port: validPortArbitrary,
    protocol: protocolArbitrary,
    username: fc.string({ minLength: 1, maxLength: 20 }).filter(s => /^[a-zA-Z0-9]+$/.test(s)),
    password: fc.string({ minLength: 1, maxLength: 20 }).filter(s => /^[a-zA-Z0-9]+$/.test(s))
});

/**
 * Account ID arbitrary
 */
const accountIdArbitrary = fc.string({ minLength: 5, maxLength: 20 })
    .filter(s => /^[a-zA-Z0-9_-]+$/.test(s));

/**
 * Generate two different chained proxy configs
 */
const twoDifferentChainedProxiesArbitrary = fc.tuple(
    validChainedProxyArbitrary,
    validChainedProxyArbitrary
).filter(([proxy1, proxy2]) => {
    // Ensure the two proxies are different (different host or port)
    return proxy1.host !== proxy2.host || proxy1.port !== proxy2.port;
});

// ==================== Property Tests ====================

describe('ViewFactory Proxy Isolation Property Tests', () => {

    /**
     * **Feature: encrypted-tunnel-proxy, Property 4: 多账号链式代理隔离**
     * **Validates: Requirements 2.4**
     * 
     * For any two different account configurations, if they have different
     * chained proxies configured, the proxy rules applied to their respective
     * sessions should be different.
     */
    describe('Property 4: Multi-account Chained Proxy Isolation', () => {
        
        test('different chained proxies produce different proxy rules', () => {
            fc.assert(
                fc.property(
                    validLocalProxyArbitrary,
                    twoDifferentChainedProxiesArbitrary,
                    (localProxy, [chainedProxy1, chainedProxy2]) => {
                        // Build proxy rules for two different accounts with different chained proxies
                        const rules1 = ProxyChainManager.buildProxyChainRules(localProxy, chainedProxy1);
                        const rules2 = ProxyChainManager.buildProxyChainRules(localProxy, chainedProxy2);
                        
                        // The rules should be different since the chained proxies are different
                        expect(rules1).not.toBe(rules2);
                        
                        // Both rules should contain the local proxy
                        expect(rules1).toContain(localProxy.host);
                        expect(rules2).toContain(localProxy.host);
                        
                        // Each rule should contain its respective chained proxy
                        expect(rules1).toContain(chainedProxy1.host);
                        expect(rules2).toContain(chainedProxy2.host);
                    }
                ),
                { numRuns: 100 }
            );
        });

        test('same chained proxy produces same proxy rules', () => {
            fc.assert(
                fc.property(
                    validLocalProxyArbitrary,
                    validChainedProxyArbitrary,
                    (localProxy, chainedProxy) => {
                        // Build proxy rules twice with the same configuration
                        const rules1 = ProxyChainManager.buildProxyChainRules(localProxy, chainedProxy);
                        const rules2 = ProxyChainManager.buildProxyChainRules(localProxy, chainedProxy);
                        
                        // The rules should be identical
                        expect(rules1).toBe(rules2);
                    }
                ),
                { numRuns: 100 }
            );
        });

        test('accounts with different chained proxies have isolated configurations', () => {
            fc.assert(
                fc.property(
                    fc.tuple(accountIdArbitrary, accountIdArbitrary).filter(([id1, id2]) => id1 !== id2),
                    validLocalProxyArbitrary,
                    twoDifferentChainedProxiesArbitrary,
                    ([accountId1, accountId2], localProxy, [chainedProxy1, chainedProxy2]) => {
                        // Simulate account configurations
                        const account1Config = {
                            accountId: accountId1,
                            localProxy: localProxy,
                            chainedProxy: chainedProxy1
                        };
                        
                        const account2Config = {
                            accountId: accountId2,
                            localProxy: localProxy,
                            chainedProxy: chainedProxy2
                        };
                        
                        // Build proxy rules for each account
                        const rules1 = ProxyChainManager.buildProxyChainRules(
                            account1Config.localProxy, 
                            account1Config.chainedProxy
                        );
                        const rules2 = ProxyChainManager.buildProxyChainRules(
                            account2Config.localProxy, 
                            account2Config.chainedProxy
                        );
                        
                        // Verify isolation: different accounts with different chained proxies
                        // should have different proxy rules
                        expect(rules1).not.toBe(rules2);
                        
                        // Verify each account's chained proxy is in its rules
                        expect(rules1).toContain(chainedProxy1.host);
                        expect(rules1).toContain(String(chainedProxy1.port));
                        expect(rules2).toContain(chainedProxy2.host);
                        expect(rules2).toContain(String(chainedProxy2.port));
                    }
                ),
                { numRuns: 100 }
            );
        });

        test('chained proxy with auth produces unique rules per account', () => {
            fc.assert(
                fc.property(
                    validLocalProxyArbitrary,
                    fc.tuple(
                        validChainedProxyWithAuthArbitrary,
                        validChainedProxyWithAuthArbitrary
                    ).filter(([p1, p2]) => p1.host !== p2.host || p1.port !== p2.port || p1.username !== p2.username),
                    (localProxy, [chainedProxy1, chainedProxy2]) => {
                        const rules1 = ProxyChainManager.buildProxyChainRules(localProxy, chainedProxy1);
                        const rules2 = ProxyChainManager.buildProxyChainRules(localProxy, chainedProxy2);
                        
                        // Rules should be different
                        expect(rules1).not.toBe(rules2);
                        
                        // Each should contain encoded credentials
                        if (chainedProxy1.username && chainedProxy1.password) {
                            expect(rules1).toContain('@');
                        }
                        if (chainedProxy2.username && chainedProxy2.password) {
                            expect(rules2).toContain('@');
                        }
                    }
                ),
                { numRuns: 100 }
            );
        });

        test('local proxy URL is consistent across accounts', () => {
            fc.assert(
                fc.property(
                    validLocalProxyArbitrary,
                    twoDifferentChainedProxiesArbitrary,
                    (localProxy, [chainedProxy1, chainedProxy2]) => {
                        // Get local proxy URLs for both configurations
                        const localUrl1 = ProxyChainManager.getLocalProxyUrl(localProxy);
                        const localUrl2 = ProxyChainManager.getLocalProxyUrl(localProxy);
                        
                        // Local proxy URL should be the same (shared local proxy)
                        expect(localUrl1).toBe(localUrl2);
                        
                        // But chained proxy URLs should be different
                        const chainedUrl1 = ProxyChainManager.getChainedProxyUrl(chainedProxy1);
                        const chainedUrl2 = ProxyChainManager.getChainedProxyUrl(chainedProxy2);
                        
                        expect(chainedUrl1).not.toBe(chainedUrl2);
                    }
                ),
                { numRuns: 100 }
            );
        });

        test('proxy rules can be parsed back to verify isolation', () => {
            fc.assert(
                fc.property(
                    validLocalProxyArbitrary,
                    twoDifferentChainedProxiesArbitrary,
                    (localProxy, [chainedProxy1, chainedProxy2]) => {
                        const rules1 = ProxyChainManager.buildProxyChainRules(localProxy, chainedProxy1);
                        const rules2 = ProxyChainManager.buildProxyChainRules(localProxy, chainedProxy2);
                        
                        // Parse the rules back
                        const parsed1 = ProxyChainManager.parseProxyChainRules(rules1);
                        const parsed2 = ProxyChainManager.parseProxyChainRules(rules2);
                        
                        // Local proxy should be the same
                        expect(parsed1.localProxy.host).toBe(parsed2.localProxy.host);
                        expect(parsed1.localProxy.port).toBe(parsed2.localProxy.port);
                        
                        // Chained proxies should be different (either host or port)
                        const chainedProxiesAreDifferent = 
                            parsed1.chainedProxy.host !== parsed2.chainedProxy.host ||
                            parsed1.chainedProxy.port !== parsed2.chainedProxy.port;
                        expect(chainedProxiesAreDifferent).toBe(true);
                    }
                ),
                { numRuns: 100 }
            );
        });
    });
});
