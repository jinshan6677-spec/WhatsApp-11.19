'use strict';

/**
 * Property-based tests for LogSanitizer
 * 
 * Tests the following property:
 * - Property 7: 日志敏感数据脱敏 (Log Sensitive Data Sanitization)
 * 
 * **Validates: Requirements 6.4**
 */

const fc = require('fast-check');
const {
    sanitizeForLogging,
    sanitizeObject,
    sanitizeProxyChainConfig,
    sanitizeError,
    isSensitiveField,
    SENSITIVE_FIELDS,
    DEFAULT_MASK
} = require('../../src/utils/LogSanitizer');

// ==================== Arbitraries ====================

/**
 * Domain name arbitrary
 */
const domainArbitrary = fc.oneof(
    fc.constantFrom('proxy.example.com', 'server.test.org', '192.168.1.100'),
    fc.string({ minLength: 3, maxLength: 30 }).filter(s => /^[a-zA-Z0-9.-]+$/.test(s))
);

/**
 * Valid port arbitrary (1-65535)
 */
const validPortArbitrary = fc.integer({ min: 1, max: 65535 });

/**
 * Protocol arbitrary
 */
const protocolArbitrary = fc.constantFrom('http', 'https');

/**
 * Non-empty string arbitrary for credentials
 */
const credentialArbitrary = fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0);

/**
 * Proxy config with credentials arbitrary
 */
const proxyConfigWithCredentialsArbitrary = fc.record({
    host: domainArbitrary,
    port: validPortArbitrary,
    protocol: protocolArbitrary,
    username: credentialArbitrary,
    password: credentialArbitrary
});

/**
 * Proxy config without credentials arbitrary
 */
const proxyConfigWithoutCredentialsArbitrary = fc.record({
    host: domainArbitrary,
    port: validPortArbitrary,
    protocol: protocolArbitrary
});

/**
 * Sensitive field name arbitrary
 */
const sensitiveFieldArbitrary = fc.constantFrom(...SENSITIVE_FIELDS);

/**
 * Non-sensitive field name arbitrary
 */
const nonSensitiveFieldArbitrary = fc.constantFrom(
    'host', 'port', 'protocol', 'enabled', 'name', 'description',
    'timeout', 'retries', 'maxConnections', 'presetId'
);

/**
 * Nested config arbitrary
 */
const nestedConfigArbitrary = fc.record({
    name: fc.string({ minLength: 1, maxLength: 20 }),
    proxy: proxyConfigWithCredentialsArbitrary,
    settings: fc.record({
        timeout: fc.integer({ min: 1000, max: 30000 }),
        auth: fc.record({
            token: credentialArbitrary,
            secret: credentialArbitrary
        })
    })
});


// ==================== Property Tests ====================

describe('LogSanitizer Property Tests', () => {

    /**
     * **Feature: encrypted-tunnel-proxy, Property 7: 日志敏感数据脱敏**
     * **Validates: Requirements 6.4**
     * 
     * For any proxy configuration containing passwords or authentication information,
     * sensitive data should be masked (e.g., '****') when logged.
     */
    describe('Property 7: Log Sensitive Data Sanitization', () => {

        test('password field should always be masked', () => {
            fc.assert(
                fc.property(
                    proxyConfigWithCredentialsArbitrary,
                    (config) => {
                        const sanitized = sanitizeForLogging(config);
                        
                        // Password should be masked
                        expect(sanitized.password).toBe(DEFAULT_MASK);
                        // Other fields should remain unchanged
                        expect(sanitized.host).toBe(config.host);
                        expect(sanitized.port).toBe(config.port);
                        expect(sanitized.protocol).toBe(config.protocol);
                        expect(sanitized.username).toBe(config.username);
                    }
                ),
                { numRuns: 100 }
            );
        });

        test('all sensitive fields should be masked', () => {
            fc.assert(
                fc.property(
                    sensitiveFieldArbitrary,
                    credentialArbitrary,
                    (fieldName, fieldValue) => {
                        const config = {
                            host: 'proxy.example.com',
                            port: 8080,
                            [fieldName]: fieldValue
                        };
                        
                        const sanitized = sanitizeForLogging(config);
                        
                        // Sensitive field should be masked
                        expect(sanitized[fieldName]).toBe(DEFAULT_MASK);
                        // Non-sensitive fields should remain unchanged
                        expect(sanitized.host).toBe(config.host);
                        expect(sanitized.port).toBe(config.port);
                    }
                ),
                { numRuns: 100 }
            );
        });

        test('non-sensitive fields should remain unchanged', () => {
            fc.assert(
                fc.property(
                    nonSensitiveFieldArbitrary,
                    fc.oneof(fc.string(), fc.integer(), fc.boolean()),
                    (fieldName, fieldValue) => {
                        const config = {
                            [fieldName]: fieldValue
                        };
                        
                        const sanitized = sanitizeForLogging(config);
                        
                        // Non-sensitive field should remain unchanged
                        expect(sanitized[fieldName]).toBe(fieldValue);
                    }
                ),
                { numRuns: 100 }
            );
        });

        test('nested sensitive fields should be masked', () => {
            fc.assert(
                fc.property(
                    nestedConfigArbitrary,
                    (config) => {
                        const sanitized = sanitizeForLogging(config);
                        
                        // Top-level non-sensitive field should remain
                        expect(sanitized.name).toBe(config.name);
                        
                        // Nested password should be masked
                        expect(sanitized.proxy.password).toBe(DEFAULT_MASK);
                        
                        // Nested non-sensitive fields should remain
                        expect(sanitized.proxy.host).toBe(config.proxy.host);
                        expect(sanitized.proxy.port).toBe(config.proxy.port);
                        
                        // Deeply nested sensitive fields should be masked
                        expect(sanitized.settings.auth.token).toBe(DEFAULT_MASK);
                        expect(sanitized.settings.auth.secret).toBe(DEFAULT_MASK);
                        
                        // Deeply nested non-sensitive fields should remain
                        expect(sanitized.settings.timeout).toBe(config.settings.timeout);
                    }
                ),
                { numRuns: 100 }
            );
        });

        test('sanitization should not modify original object', () => {
            fc.assert(
                fc.property(
                    proxyConfigWithCredentialsArbitrary,
                    (config) => {
                        const originalPassword = config.password;
                        const originalHost = config.host;
                        
                        sanitizeForLogging(config);
                        
                        // Original object should not be modified
                        expect(config.password).toBe(originalPassword);
                        expect(config.host).toBe(originalHost);
                    }
                ),
                { numRuns: 100 }
            );
        });

        test('null and undefined inputs should be handled gracefully', () => {
            fc.assert(
                fc.property(
                    fc.constantFrom(null, undefined),
                    (input) => {
                        const result = sanitizeForLogging(input);
                        
                        expect(result).toBe(input);
                    }
                ),
                { numRuns: 100 }
            );
        });

        test('empty objects should return empty objects', () => {
            const result = sanitizeForLogging({});
            expect(result).toEqual({});
        });

        test('arrays with sensitive data should be sanitized', () => {
            fc.assert(
                fc.property(
                    fc.array(proxyConfigWithCredentialsArbitrary, { minLength: 1, maxLength: 5 }),
                    (configs) => {
                        const sanitized = sanitizeForLogging(configs);
                        
                        expect(Array.isArray(sanitized)).toBe(true);
                        expect(sanitized.length).toBe(configs.length);
                        
                        sanitized.forEach((item, index) => {
                            expect(item.password).toBe(DEFAULT_MASK);
                            expect(item.host).toBe(configs[index].host);
                        });
                    }
                ),
                { numRuns: 100 }
            );
        });

        test('case-insensitive field matching for sensitive fields', () => {
            fc.assert(
                fc.property(
                    fc.constantFrom('PASSWORD', 'Password', 'PassWord', 'SECRET', 'Token', 'API_KEY'),
                    credentialArbitrary,
                    (fieldName, fieldValue) => {
                        const config = {
                            host: 'proxy.example.com',
                            [fieldName]: fieldValue
                        };
                        
                        const sanitized = sanitizeForLogging(config);
                        
                        // Case variations of sensitive fields should be masked
                        expect(sanitized[fieldName]).toBe(DEFAULT_MASK);
                    }
                ),
                { numRuns: 100 }
            );
        });

        test('custom mask string should be used when provided', () => {
            fc.assert(
                fc.property(
                    proxyConfigWithCredentialsArbitrary,
                    fc.string({ minLength: 1, maxLength: 10 }),
                    (config, customMask) => {
                        const sanitized = sanitizeForLogging(config, { mask: customMask });
                        
                        expect(sanitized.password).toBe(customMask);
                    }
                ),
                { numRuns: 100 }
            );
        });
    });


    /**
     * Additional tests for sanitizeProxyChainConfig
     */
    describe('sanitizeProxyChainConfig', () => {

        test('should sanitize both local and chained proxy configs', () => {
            fc.assert(
                fc.property(
                    proxyConfigWithCredentialsArbitrary,
                    proxyConfigWithCredentialsArbitrary,
                    (localProxy, chainedProxy) => {
                        const sanitized = sanitizeProxyChainConfig(localProxy, chainedProxy);
                        
                        // Both proxies should have passwords masked
                        expect(sanitized.localProxy.password).toBe(DEFAULT_MASK);
                        expect(sanitized.chainedProxy.password).toBe(DEFAULT_MASK);
                        
                        // Non-sensitive fields should remain
                        expect(sanitized.localProxy.host).toBe(localProxy.host);
                        expect(sanitized.chainedProxy.host).toBe(chainedProxy.host);
                    }
                ),
                { numRuns: 100 }
            );
        });

        test('should handle null chained proxy', () => {
            fc.assert(
                fc.property(
                    proxyConfigWithCredentialsArbitrary,
                    (localProxy) => {
                        const sanitized = sanitizeProxyChainConfig(localProxy, null);
                        
                        expect(sanitized.localProxy.password).toBe(DEFAULT_MASK);
                        expect(sanitized.chainedProxy).toBeNull();
                    }
                ),
                { numRuns: 100 }
            );
        });
    });


    /**
     * Tests for isSensitiveField helper
     */
    describe('isSensitiveField', () => {

        test('should identify all default sensitive fields', () => {
            fc.assert(
                fc.property(
                    sensitiveFieldArbitrary,
                    (fieldName) => {
                        expect(isSensitiveField(fieldName)).toBe(true);
                    }
                ),
                { numRuns: 100 }
            );
        });

        test('should not identify non-sensitive fields as sensitive', () => {
            fc.assert(
                fc.property(
                    nonSensitiveFieldArbitrary,
                    (fieldName) => {
                        expect(isSensitiveField(fieldName)).toBe(false);
                    }
                ),
                { numRuns: 100 }
            );
        });

        test('should handle non-string inputs gracefully', () => {
            fc.assert(
                fc.property(
                    fc.oneof(fc.integer(), fc.boolean(), fc.constant(null), fc.constant(undefined)),
                    (input) => {
                        expect(isSensitiveField(input)).toBe(false);
                    }
                ),
                { numRuns: 100 }
            );
        });
    });


    /**
     * Tests for sanitizeError
     */
    describe('sanitizeError', () => {

        test('should preserve error message and name', () => {
            fc.assert(
                fc.property(
                    fc.string({ minLength: 1, maxLength: 100 }),
                    (message) => {
                        const error = new Error(message);
                        const sanitized = sanitizeError(error);
                        
                        expect(sanitized.message).toBe(message);
                        expect(sanitized.name).toBe('Error');
                    }
                ),
                { numRuns: 100 }
            );
        });

        test('should sanitize sensitive properties in error objects', () => {
            fc.assert(
                fc.property(
                    fc.string({ minLength: 1, maxLength: 50 }),
                    credentialArbitrary,
                    (message, password) => {
                        const error = new Error(message);
                        error.password = password;
                        error.config = { host: 'test.com', password: password };
                        
                        const sanitized = sanitizeError(error);
                        
                        expect(sanitized.message).toBe(message);
                        expect(sanitized.password).toBe(DEFAULT_MASK);
                        expect(sanitized.config.password).toBe(DEFAULT_MASK);
                        expect(sanitized.config.host).toBe('test.com');
                    }
                ),
                { numRuns: 100 }
            );
        });

        test('should handle null/undefined errors', () => {
            expect(sanitizeError(null)).toBeNull();
            expect(sanitizeError(undefined)).toBeUndefined();
        });
    });
});
