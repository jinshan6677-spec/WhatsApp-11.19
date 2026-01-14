'use strict';

/**
 * Property-based tests for TranslationProxyAdapter
 * 
 * Tests the following properties:
 * - Property 5: 翻译服务代理配置 (Translation Service Proxy Configuration)
 * 
 * **Validates: Requirements 3.1, 3.4**
 */

const fc = require('fast-check');
const TranslationProxyAdapter = require('../../src/environment/TranslationProxyAdapter');

// ==================== Arbitraries ====================

/**
 * Valid proxy mode arbitrary
 */
const validModeArbitrary = fc.constantFrom('always', 'auto', 'never');

/**
 * Invalid proxy mode arbitrary
 */
const invalidModeArbitrary = fc.string({ minLength: 1, maxLength: 20 })
    .filter(s => !['always', 'auto', 'never'].includes(s.toLowerCase().trim()));

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
 * Valid proxy config arbitrary
 */
const validProxyConfigArbitrary = fc.record({
    host: validLocalHostArbitrary,
    port: validPortArbitrary,
    protocol: protocolArbitrary,
    username: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: undefined }),
    password: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: undefined })
});

/**
 * Invalid proxy config arbitrary
 */
const invalidProxyConfigArbitrary = fc.constantFrom(
    null,
    undefined,
    {},
    { host: null },
    { port: null },
    { host: '127.0.0.1' }, // missing port
    { port: 7890 } // missing host
);

/**
 * Valid translation text arbitrary
 */
const validTextArbitrary = fc.string({ minLength: 1, maxLength: 500 })
    .filter(s => s.trim().length > 0);

/**
 * Valid language code arbitrary
 */
const validLangArbitrary = fc.constantFrom('en', 'zh', 'ja', 'ko', 'es', 'fr', 'de', 'ru', 'pt', 'it');


// ==================== Property Tests ====================

describe('TranslationProxyAdapter Property Tests', () => {

    // Reset adapter state before each test
    beforeEach(() => {
        TranslationProxyAdapter.reset();
    });

    /**
     * **Feature: encrypted-tunnel-proxy, Property 5: 翻译服务代理配置**
     * **Validates: Requirements 3.1, 3.4**
     * 
     * For any translation service proxy mode configuration (always/auto/never),
     * translation requests should decide whether to use proxy based on the configured mode.
     */
    describe('Property 5: Translation Service Proxy Configuration', () => {
        
        test('configure with valid mode and proxy config should succeed', () => {
            fc.assert(
                fc.property(
                    validProxyConfigArbitrary,
                    fc.constantFrom('always', 'auto'),
                    (proxyConfig, mode) => {
                        const result = TranslationProxyAdapter.configure(proxyConfig, mode);
                        
                        expect(result.success).toBe(true);
                        expect(result.error).toBeUndefined();
                        expect(TranslationProxyAdapter.getMode()).toBe(mode);
                    }
                ),
                { numRuns: 100 }
            );
        });

        test('configure with "never" mode should succeed without proxy config', () => {
            fc.assert(
                fc.property(
                    fc.constantFrom(null, undefined, {}),
                    (proxyConfig) => {
                        const result = TranslationProxyAdapter.configure(proxyConfig, 'never');
                        
                        expect(result.success).toBe(true);
                        expect(TranslationProxyAdapter.getMode()).toBe('never');
                        expect(TranslationProxyAdapter.getProxyConfig()).toBeNull();
                    }
                ),
                { numRuns: 100 }
            );
        });

        test('configure with invalid mode should fail', () => {
            fc.assert(
                fc.property(
                    validProxyConfigArbitrary,
                    invalidModeArbitrary,
                    (proxyConfig, invalidMode) => {
                        const result = TranslationProxyAdapter.configure(proxyConfig, invalidMode);
                        
                        expect(result.success).toBe(false);
                        expect(result.error).toBeTruthy();
                        expect(result.error).toContain('无效的代理模式');
                    }
                ),
                { numRuns: 100 }
            );
        });

        test('configure with "always" or "auto" mode but invalid proxy config should fail', () => {
            fc.assert(
                fc.property(
                    invalidProxyConfigArbitrary,
                    fc.constantFrom('always', 'auto'),
                    (invalidConfig, mode) => {
                        const result = TranslationProxyAdapter.configure(invalidConfig, mode);
                        
                        expect(result.success).toBe(false);
                        expect(result.error).toBeTruthy();
                    }
                ),
                { numRuns: 100 }
            );
        });

        test('shouldUseProxy returns true for "always" mode', async () => {
            await fc.assert(
                fc.asyncProperty(
                    validProxyConfigArbitrary,
                    async (proxyConfig) => {
                        TranslationProxyAdapter.configure(proxyConfig, 'always');
                        
                        const shouldUse = await TranslationProxyAdapter.shouldUseProxy();
                        
                        expect(shouldUse).toBe(true);
                    }
                ),
                { numRuns: 100 }
            );
        });

        test('shouldUseProxy returns false for "never" mode', async () => {
            await fc.assert(
                fc.asyncProperty(
                    validProxyConfigArbitrary,
                    async (proxyConfig) => {
                        // First configure with a valid config, then switch to never
                        TranslationProxyAdapter.configure(proxyConfig, 'always');
                        TranslationProxyAdapter.configure(null, 'never');
                        
                        const shouldUse = await TranslationProxyAdapter.shouldUseProxy();
                        
                        expect(shouldUse).toBe(false);
                    }
                ),
                { numRuns: 100 }
            );
        });

        test('mode is case-insensitive', () => {
            fc.assert(
                fc.property(
                    validProxyConfigArbitrary,
                    fc.constantFrom('ALWAYS', 'Always', 'AUTO', 'Auto', 'NEVER', 'Never'),
                    (proxyConfig, mode) => {
                        const result = TranslationProxyAdapter.configure(proxyConfig, mode);
                        
                        // For 'never' mode, proxy config is not required
                        if (mode.toLowerCase() === 'never') {
                            expect(result.success).toBe(true);
                        } else {
                            expect(result.success).toBe(true);
                        }
                        expect(TranslationProxyAdapter.getMode()).toBe(mode.toLowerCase());
                    }
                ),
                { numRuns: 100 }
            );
        });

        test('getProxyConfig returns copy of config, not reference', () => {
            fc.assert(
                fc.property(
                    validProxyConfigArbitrary,
                    (proxyConfig) => {
                        TranslationProxyAdapter.configure(proxyConfig, 'always');
                        
                        const config1 = TranslationProxyAdapter.getProxyConfig();
                        const config2 = TranslationProxyAdapter.getProxyConfig();
                        
                        // Should be equal but not the same reference
                        expect(config1).toEqual(config2);
                        expect(config1).not.toBe(config2);
                        
                        // Modifying returned config should not affect internal state
                        config1.port = 99999;
                        const config3 = TranslationProxyAdapter.getProxyConfig();
                        expect(config3.port).toBe(proxyConfig.port);
                    }
                ),
                { numRuns: 100 }
            );
        });

        test('reset clears all configuration', () => {
            fc.assert(
                fc.property(
                    validProxyConfigArbitrary,
                    validModeArbitrary,
                    (proxyConfig, mode) => {
                        // Configure first
                        TranslationProxyAdapter.configure(proxyConfig, mode);
                        
                        // Reset
                        TranslationProxyAdapter.reset();
                        
                        // Should be back to defaults
                        expect(TranslationProxyAdapter.getMode()).toBe('auto');
                        expect(TranslationProxyAdapter.getProxyConfig()).toBeNull();
                    }
                ),
                { numRuns: 100 }
            );
        });

        test('getConfigSummary returns correct summary', () => {
            fc.assert(
                fc.property(
                    validProxyConfigArbitrary,
                    fc.constantFrom('always', 'auto'),
                    (proxyConfig, mode) => {
                        TranslationProxyAdapter.configure(proxyConfig, mode);
                        
                        const summary = TranslationProxyAdapter.getConfigSummary();
                        
                        expect(summary.mode).toBe(mode);
                        expect(summary.hasProxyConfig).toBe(true);
                        expect(summary.proxyHost).toBe(proxyConfig.host);
                        expect(summary.proxyPort).toBe(proxyConfig.port);
                    }
                ),
                { numRuns: 100 }
            );
        });
    });


    /**
     * Additional property tests for translateWithProxy input validation
     */
    describe('translateWithProxy Input Validation Properties', () => {
        
        test('translateWithProxy rejects empty text', async () => {
            await fc.assert(
                fc.asyncProperty(
                    fc.constantFrom('', null, undefined),
                    validLangArbitrary,
                    validProxyConfigArbitrary,
                    async (invalidText, targetLang, proxyConfig) => {
                        const result = await TranslationProxyAdapter.translateWithProxy(
                            invalidText,
                            targetLang,
                            proxyConfig
                        );
                        
                        expect(result.success).toBe(false);
                        expect(result.error).toBeTruthy();
                    }
                ),
                { numRuns: 100 }
            );
        });

        test('translateWithProxy rejects empty target language', async () => {
            await fc.assert(
                fc.asyncProperty(
                    validTextArbitrary,
                    fc.constantFrom('', null, undefined),
                    validProxyConfigArbitrary,
                    async (text, invalidLang, proxyConfig) => {
                        const result = await TranslationProxyAdapter.translateWithProxy(
                            text,
                            invalidLang,
                            proxyConfig
                        );
                        
                        expect(result.success).toBe(false);
                        expect(result.error).toBeTruthy();
                    }
                ),
                { numRuns: 100 }
            );
        });

        test('translateWithProxy rejects invalid proxy config', async () => {
            await fc.assert(
                fc.asyncProperty(
                    validTextArbitrary,
                    validLangArbitrary,
                    invalidProxyConfigArbitrary,
                    async (text, targetLang, invalidConfig) => {
                        const result = await TranslationProxyAdapter.translateWithProxy(
                            text,
                            targetLang,
                            invalidConfig
                        );
                        
                        expect(result.success).toBe(false);
                        expect(result.error).toBeTruthy();
                    }
                ),
                { numRuns: 100 }
            );
        });
    });
});
