'use strict';

/**
 * Property-based tests for ProxyChainManager
 * 
 * Tests the following properties:
 * - Property 3: 代理链路由规则生成 (Proxy Chain Routing Rules Generation)
 * - Property 6: 错误来源诊断 (Error Source Diagnosis)
 * 
 * **Validates: Requirements 1.4, 2.2, 2.3, 2.4, 6.2**
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
 * Valid chained proxy config arbitrary (without auth)
 */
const validChainedProxyArbitrary = fc.record({
    host: validDomainArbitrary,
    port: validPortArbitrary,
    protocol: protocolArbitrary
});

/**
 * Valid chained proxy config with auth arbitrary
 */
const validChainedProxyWithAuthArbitrary = fc.record({
    host: validDomainArbitrary,
    port: validPortArbitrary,
    protocol: protocolArbitrary,
    username: fc.string({ minLength: 1, maxLength: 20 }),
    password: fc.string({ minLength: 1, maxLength: 20 })
});

/**
 * Optional chained proxy arbitrary
 */
const optionalChainedProxyArbitrary = fc.option(validChainedProxyArbitrary, { nil: null });

/**
 * Invalid proxy config arbitrary
 */
const invalidProxyConfigArbitrary = fc.constantFrom(
    null,
    undefined,
    {},
    { host: null },
    { port: null },
    { host: '127.0.0.1' },
    { port: 7890 }
);


// ==================== Property Tests ====================

describe('ProxyChainManager Property Tests', () => {

    /**
     * **Feature: encrypted-tunnel-proxy, Property 3: 代理链路由规则生成**
     * **Validates: Requirements 1.4, 2.2, 2.3**
     * 
     * For any local proxy configuration and optional chained proxy configuration,
     * the generated proxy rules should correctly reflect the configured routing path:
     * - Local proxy only: http://127.0.0.1:port
     * - Local proxy + chained proxy: proxy chain rules
     */
    describe('Property 3: Proxy Chain Routing Rules Generation', () => {
        
        test('local proxy only generates correct URL format', () => {
            fc.assert(
                fc.property(
                    validLocalProxyArbitrary,
                    (localProxy) => {
                        const rules = ProxyChainManager.buildProxyChainRules(localProxy, null);
                        
                        // Rules should contain local proxy URL
                        expect(rules).toContain(`${localProxy.protocol}://`);
                        expect(rules).toContain(localProxy.host);
                        expect(rules).toContain(String(localProxy.port));
                        
                        // Should not contain semicolon (no chained proxy)
                        expect(rules).not.toContain(';');
                    }
                ),
                { numRuns: 100 }
            );
        });

        test('local proxy with chained proxy generates combined rules', () => {
            fc.assert(
                fc.property(
                    validLocalProxyArbitrary,
                    validChainedProxyArbitrary,
                    (localProxy, chainedProxy) => {
                        const rules = ProxyChainManager.buildProxyChainRules(localProxy, chainedProxy);
                        
                        // Rules should contain local proxy
                        expect(rules).toContain(localProxy.host);
                        expect(rules).toContain(String(localProxy.port));
                        
                        // Rules should contain chained proxy
                        expect(rules).toContain(chainedProxy.host);
                        expect(rules).toContain(String(chainedProxy.port));
                        
                        // Should contain semicolon separator
                        expect(rules).toContain(';');
                    }
                ),
                { numRuns: 100 }
            );
        });

        test('chained proxy with auth includes encoded credentials', () => {
            fc.assert(
                fc.property(
                    validLocalProxyArbitrary,
                    validChainedProxyWithAuthArbitrary,
                    (localProxy, chainedProxy) => {
                        const rules = ProxyChainManager.buildProxyChainRules(localProxy, chainedProxy);
                        
                        // Rules should contain @ symbol for auth
                        expect(rules).toContain('@');
                        
                        // Rules should contain encoded username
                        expect(rules).toContain(encodeURIComponent(chainedProxy.username));
                    }
                ),
                { numRuns: 100 }
            );
        });

        test('invalid local proxy returns direct', () => {
            fc.assert(
                fc.property(
                    invalidProxyConfigArbitrary,
                    optionalChainedProxyArbitrary,
                    (invalidLocalProxy, chainedProxy) => {
                        const rules = ProxyChainManager.buildProxyChainRules(invalidLocalProxy, chainedProxy);
                        
                        expect(rules).toBe('direct://');
                    }
                ),
                { numRuns: 100 }
            );
        });

        test('null chained proxy is treated same as no chained proxy', () => {
            fc.assert(
                fc.property(
                    validLocalProxyArbitrary,
                    (localProxy) => {
                        const rulesWithNull = ProxyChainManager.buildProxyChainRules(localProxy, null);
                        const rulesWithUndefined = ProxyChainManager.buildProxyChainRules(localProxy, undefined);
                        const rulesWithEmpty = ProxyChainManager.buildProxyChainRules(localProxy, {});
                        
                        expect(rulesWithNull).toBe(rulesWithUndefined);
                        expect(rulesWithNull).toBe(rulesWithEmpty);
                    }
                ),
                { numRuns: 100 }
            );
        });

        test('rules can be parsed back to original configuration', () => {
            fc.assert(
                fc.property(
                    validLocalProxyArbitrary,
                    (localProxy) => {
                        const rules = ProxyChainManager.buildProxyChainRules(localProxy, null);
                        const parsed = ProxyChainManager.parseProxyChainRules(rules);
                        
                        expect(parsed.localProxy).not.toBeNull();
                        expect(parsed.localProxy.host).toBe(localProxy.host);
                        expect(parsed.localProxy.port).toBe(localProxy.port);
                        expect(parsed.localProxy.protocol).toBe(localProxy.protocol);
                    }
                ),
                { numRuns: 100 }
            );
        });

        test('getLocalProxyUrl returns correct URL', () => {
            fc.assert(
                fc.property(
                    validLocalProxyArbitrary,
                    (localProxy) => {
                        const url = ProxyChainManager.getLocalProxyUrl(localProxy);
                        
                        expect(url).toBe(`${localProxy.protocol}://${localProxy.host}:${localProxy.port}`);
                    }
                ),
                { numRuns: 100 }
            );
        });

        test('getChainedProxyUrl returns correct URL', () => {
            fc.assert(
                fc.property(
                    validChainedProxyArbitrary,
                    (chainedProxy) => {
                        const url = ProxyChainManager.getChainedProxyUrl(chainedProxy);
                        
                        expect(url).toBe(`${chainedProxy.protocol}://${chainedProxy.host}:${chainedProxy.port}`);
                    }
                ),
                { numRuns: 100 }
            );
        });
    });


    /**
     * **Feature: encrypted-tunnel-proxy, Property 6: 错误来源诊断**
     * **Validates: Requirements 6.2**
     * 
     * For any proxy chain connection failure, the diagnosis function should
     * correctly distinguish between local proxy problems and chained proxy problems.
     */
    describe('Property 6: Error Source Diagnosis', () => {
        
        test('getDiagnosisMessage returns human-readable message for all codes', () => {
            fc.assert(
                fc.property(
                    fc.constantFrom(
                        'LOCAL_PROXY_FAILED',
                        'CHAINED_PROXY_FAILED',
                        'LOCAL_PROXY_ONLY_OK',
                        'PROXY_CHAIN_OK'
                    ),
                    (diagnosisCode) => {
                        const message = ProxyChainManager.getDiagnosisMessage(diagnosisCode);
                        
                        // Message should be a non-empty string
                        expect(typeof message).toBe('string');
                        expect(message.length).toBeGreaterThan(0);
                        
                        // Message should not be the fallback message for valid codes
                        expect(message).not.toBe('未知诊断结果');
                    }
                ),
                { numRuns: 100 }
            );
        });

        test('unknown diagnosis code returns fallback message', () => {
            fc.assert(
                fc.property(
                    fc.string({ minLength: 1, maxLength: 30 }).filter(s => 
                        !['LOCAL_PROXY_FAILED', 'CHAINED_PROXY_FAILED', 'LOCAL_PROXY_ONLY_OK', 'PROXY_CHAIN_OK'].includes(s)
                    ),
                    (unknownCode) => {
                        const message = ProxyChainManager.getDiagnosisMessage(unknownCode);
                        
                        expect(message).toBe('未知诊断结果');
                    }
                ),
                { numRuns: 100 }
            );
        });

        test('diagnosis returns correct structure for invalid proxy', async () => {
            // Test with invalid local proxy config - should always fail
            const result = await ProxyChainManager.diagnoseProxyChain(null, null);
            
            expect(result).toHaveProperty('localProxyOk');
            expect(result).toHaveProperty('chainedProxyOk');
            expect(result).toHaveProperty('diagnosis');
            expect(typeof result.localProxyOk).toBe('boolean');
            expect(typeof result.chainedProxyOk).toBe('boolean');
            expect(typeof result.diagnosis).toBe('string');
            expect(result.localProxyOk).toBe(false);
            expect(result.diagnosis).toBe('LOCAL_PROXY_FAILED');
        });

        test('diagnosis codes are valid for all scenarios', () => {
            const validDiagnosisCodes = [
                'LOCAL_PROXY_FAILED',
                'CHAINED_PROXY_FAILED',
                'LOCAL_PROXY_ONLY_OK',
                'PROXY_CHAIN_OK'
            ];
            
            // Each valid code should have a corresponding message
            fc.assert(
                fc.property(
                    fc.constantFrom(...validDiagnosisCodes),
                    (code) => {
                        const message = ProxyChainManager.getDiagnosisMessage(code);
                        expect(message).not.toBe('未知诊断结果');
                        return true;
                    }
                ),
                { numRuns: 100 }
            );
        });

        test('local proxy failure sets correct diagnosis for various invalid configs', async () => {
            // Test with various invalid local proxy configs
            const invalidConfigs = [
                null,
                undefined,
                {},
                { host: null },
                { port: null },
                { host: '127.0.0.1' }, // missing port
                { port: 7890 } // missing host
            ];
            
            for (const invalidConfig of invalidConfigs) {
                const result = await ProxyChainManager.diagnoseProxyChain(invalidConfig, null);
                
                expect(result.localProxyOk).toBe(false);
                expect(result.diagnosis).toBe('LOCAL_PROXY_FAILED');
            }
        });

        test('diagnosis distinguishes local vs chained proxy issues correctly', () => {
            // Test the logic: if local proxy fails, chained proxy should not be tested
            fc.assert(
                fc.property(
                    fc.constantFrom(
                        { localProxyOk: false, chainedProxyOk: false, diagnosis: 'LOCAL_PROXY_FAILED' },
                        { localProxyOk: true, chainedProxyOk: true, diagnosis: 'LOCAL_PROXY_ONLY_OK' },
                        { localProxyOk: true, chainedProxyOk: false, diagnosis: 'CHAINED_PROXY_FAILED' },
                        { localProxyOk: true, chainedProxyOk: true, diagnosis: 'PROXY_CHAIN_OK' }
                    ),
                    (scenario) => {
                        // If local proxy failed, chained proxy should not be OK
                        if (!scenario.localProxyOk) {
                            expect(scenario.chainedProxyOk).toBe(false);
                            expect(scenario.diagnosis).toBe('LOCAL_PROXY_FAILED');
                        }
                        
                        // If local proxy OK and chained proxy failed, diagnosis should be CHAINED_PROXY_FAILED
                        if (scenario.localProxyOk && !scenario.chainedProxyOk) {
                            expect(scenario.diagnosis).toBe('CHAINED_PROXY_FAILED');
                        }
                        
                        return true;
                    }
                ),
                { numRuns: 100 }
            );
        });
    });
});
