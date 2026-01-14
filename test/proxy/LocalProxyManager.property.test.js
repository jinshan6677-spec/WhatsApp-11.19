'use strict';

/**
 * Property-based tests for LocalProxyManager
 * 
 * Tests the following properties:
 * - Property 1: 代理端口格式验证 (Proxy Port Format Validation)
 * - Property 2: 预设端口自动填充 (Preset Port Auto-Fill)
 * 
 * **Validates: Requirements 1.1, 1.2, 1.3, 5.3**
 */

const fc = require('fast-check');
const LocalProxyManager = require('../../src/environment/LocalProxyManager');

// ==================== Arbitraries ====================

/**
 * Valid local host arbitrary
 */
const validLocalHostArbitrary = fc.constantFrom('127.0.0.1', 'localhost');

/**
 * Invalid local host arbitrary - hosts that are not local
 */
const invalidLocalHostArbitrary = fc.oneof(
    fc.string({ minLength: 1, maxLength: 50 }).filter(s => 
        s !== '127.0.0.1' && 
        s.toLowerCase() !== 'localhost' &&
        s.trim().length > 0
    ),
    fc.constantFrom('192.168.1.1', '10.0.0.1', '0.0.0.0', 'google.com', '8.8.8.8')
);

/**
 * Valid port arbitrary (1-65535)
 */
const validPortArbitrary = fc.integer({ min: 1, max: 65535 });

/**
 * Invalid port arbitrary (outside 1-65535 range)
 */
const invalidPortArbitrary = fc.oneof(
    fc.integer({ min: -10000, max: 0 }),
    fc.integer({ min: 65536, max: 100000 })
);

/**
 * Preset ID arbitrary
 */
const presetIdArbitrary = fc.constantFrom('clash', 'v2rayn', 'shadowsocks', 'custom');

/**
 * Invalid preset ID arbitrary
 */
const invalidPresetIdArbitrary = fc.string({ minLength: 1, maxLength: 20 })
    .filter(s => !['clash', 'v2rayn', 'shadowsocks', 'custom'].includes(s.toLowerCase()));

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


// ==================== Property Tests ====================

describe('LocalProxyManager Property Tests', () => {

    /**
     * **Feature: encrypted-tunnel-proxy, Property 1: 代理端口格式验证**
     * **Validates: Requirements 1.1, 1.2**
     * 
     * For any proxy port configuration, if the host is 127.0.0.1 or localhost
     * and the port is in the range 1-65535, validation should return valid;
     * otherwise it should return invalid with error messages.
     */
    describe('Property 1: Proxy Port Format Validation', () => {
        
        test('valid local host and port should pass validation', () => {
            fc.assert(
                fc.property(
                    validLocalHostArbitrary,
                    validPortArbitrary,
                    (host, port) => {
                        const result = LocalProxyManager.validateLocalProxy(host, port);
                        
                        expect(result.valid).toBe(true);
                        expect(result.errors).toHaveLength(0);
                    }
                ),
                { numRuns: 100 }
            );
        });

        test('invalid host should fail validation', () => {
            fc.assert(
                fc.property(
                    invalidLocalHostArbitrary,
                    validPortArbitrary,
                    (host, port) => {
                        const result = LocalProxyManager.validateLocalProxy(host, port);
                        
                        expect(result.valid).toBe(false);
                        expect(result.errors.length).toBeGreaterThan(0);
                        expect(result.errors.some(e => e.includes('127.0.0.1') || e.includes('localhost'))).toBe(true);
                    }
                ),
                { numRuns: 100 }
            );
        });

        test('invalid port should fail validation', () => {
            fc.assert(
                fc.property(
                    validLocalHostArbitrary,
                    invalidPortArbitrary,
                    (host, port) => {
                        const result = LocalProxyManager.validateLocalProxy(host, port);
                        
                        expect(result.valid).toBe(false);
                        expect(result.errors.length).toBeGreaterThan(0);
                        expect(result.errors.some(e => e.includes('端口') || e.includes('1-65535'))).toBe(true);
                    }
                ),
                { numRuns: 100 }
            );
        });

        test('both invalid host and port should fail validation with multiple errors', () => {
            fc.assert(
                fc.property(
                    invalidLocalHostArbitrary,
                    invalidPortArbitrary,
                    (host, port) => {
                        const result = LocalProxyManager.validateLocalProxy(host, port);
                        
                        expect(result.valid).toBe(false);
                        // Should have errors for both host and port
                        expect(result.errors.length).toBeGreaterThanOrEqual(2);
                    }
                ),
                { numRuns: 100 }
            );
        });

        test('port validation is consistent across integer range', () => {
            fc.assert(
                fc.property(
                    fc.integer({ min: -1000, max: 70000 }),
                    (port) => {
                        const result = LocalProxyManager.validateLocalProxy('127.0.0.1', port);
                        const isValidPort = port >= 1 && port <= 65535;
                        
                        expect(result.valid).toBe(isValidPort);
                    }
                ),
                { numRuns: 100 }
            );
        });

        test('localhost variations should be handled correctly', () => {
            fc.assert(
                fc.property(
                    fc.constantFrom('localhost', 'LOCALHOST', 'LocalHost', 'LOCALHOST'),
                    validPortArbitrary,
                    (host, port) => {
                        const result = LocalProxyManager.validateLocalProxy(host, port);
                        
                        // All case variations of localhost should be valid
                        expect(result.valid).toBe(true);
                    }
                ),
                { numRuns: 100 }
            );
        });
    });


    /**
     * **Feature: encrypted-tunnel-proxy, Property 2: 预设端口自动填充**
     * **Validates: Requirements 1.3, 5.3**
     * 
     * For any proxy client preset selection, the system should automatically
     * fill in the corresponding default port (Clash: 7890, V2rayN: 10808, Shadowsocks: 1080).
     */
    describe('Property 2: Preset Port Auto-Fill', () => {
        
        const expectedPorts = {
            clash: 7890,
            v2rayn: 10808,
            shadowsocks: 1080,
            custom: 0
        };

        test('preset selection returns correct default port', () => {
            fc.assert(
                fc.property(
                    presetIdArbitrary,
                    (presetId) => {
                        const preset = LocalProxyManager.getPreset(presetId);
                        
                        expect(preset).not.toBeNull();
                        expect(preset.port).toBe(expectedPorts[presetId]);
                    }
                ),
                { numRuns: 100 }
            );
        });

        test('all presets have valid local host', () => {
            fc.assert(
                fc.property(
                    presetIdArbitrary,
                    (presetId) => {
                        const preset = LocalProxyManager.getPreset(presetId);
                        
                        expect(preset).not.toBeNull();
                        expect(preset.host).toBe('127.0.0.1');
                    }
                ),
                { numRuns: 100 }
            );
        });

        test('all presets have valid protocol (http or socks5)', () => {
            fc.assert(
                fc.property(
                    presetIdArbitrary,
                    (presetId) => {
                        const preset = LocalProxyManager.getPreset(presetId);
                        
                        expect(preset).not.toBeNull();
                        // Presets can have http or socks5 protocol
                        expect(['http', 'socks5']).toContain(preset.protocol);
                    }
                ),
                { numRuns: 100 }
            );
        });

        test('invalid preset ID returns null', () => {
            fc.assert(
                fc.property(
                    invalidPresetIdArbitrary,
                    (invalidPresetId) => {
                        const preset = LocalProxyManager.getPreset(invalidPresetId);
                        
                        expect(preset).toBeNull();
                    }
                ),
                { numRuns: 100 }
            );
        });

        test('preset ID is case-insensitive', () => {
            fc.assert(
                fc.property(
                    fc.constantFrom('CLASH', 'Clash', 'V2RAYN', 'V2rayN', 'SHADOWSOCKS', 'Shadowsocks'),
                    (presetId) => {
                        const preset = LocalProxyManager.getPreset(presetId);
                        
                        expect(preset).not.toBeNull();
                        expect(preset.port).toBe(expectedPorts[presetId.toLowerCase()]);
                    }
                ),
                { numRuns: 100 }
            );
        });

        // Expected protocols for each preset
        // V2rayN and Clash use mixed mode, which works with HTTP protocol
        const expectedProtocols = {
            clash: 'http',
            v2rayn: 'http',
            shadowsocks: 'socks5'
        };

        test('createConfigFromPreset returns valid configuration', () => {
            fc.assert(
                fc.property(
                    fc.constantFrom('clash', 'v2rayn', 'shadowsocks'),
                    (presetId) => {
                        const config = LocalProxyManager.createConfigFromPreset(presetId);
                        
                        expect(config).not.toBeNull();
                        expect(config.enabled).toBe(true);
                        expect(config.presetId).toBe(presetId);
                        expect(config.host).toBe('127.0.0.1');
                        expect(config.port).toBe(expectedPorts[presetId]);
                        // Protocol should match the preset's protocol
                        expect(config.protocol).toBe(expectedProtocols[presetId]);
                    }
                ),
                { numRuns: 100 }
            );
        });

        test('custom preset uses provided port', () => {
            fc.assert(
                fc.property(
                    validPortArbitrary,
                    (customPort) => {
                        const config = LocalProxyManager.createConfigFromPreset('custom', customPort);
                        
                        expect(config).not.toBeNull();
                        expect(config.presetId).toBe('custom');
                        expect(config.port).toBe(customPort);
                    }
                ),
                { numRuns: 100 }
            );
        });
    });


    /**
     * Additional property tests for buildProxyUrl
     */
    describe('buildProxyUrl Properties', () => {
        
        test('buildProxyUrl produces valid URL format', () => {
            fc.assert(
                fc.property(
                    validProxyConfigArbitrary,
                    (config) => {
                        const url = LocalProxyManager.buildProxyUrl(config);
                        
                        expect(url).toBeTruthy();
                        expect(url).toContain('://');
                        expect(url).toContain(config.host);
                        expect(url).toContain(String(config.port));
                    }
                ),
                { numRuns: 100 }
            );
        });

        test('buildProxyUrl includes authentication when provided', () => {
            fc.assert(
                fc.property(
                    fc.record({
                        host: validLocalHostArbitrary,
                        port: validPortArbitrary,
                        protocol: protocolArbitrary,
                        username: fc.string({ minLength: 1, maxLength: 20 }),
                        password: fc.string({ minLength: 1, maxLength: 20 })
                    }),
                    (config) => {
                        const url = LocalProxyManager.buildProxyUrl(config);
                        
                        expect(url).toContain('@');
                        expect(url).toContain(encodeURIComponent(config.username));
                    }
                ),
                { numRuns: 100 }
            );
        });

        test('buildProxyUrl returns empty string for invalid config', () => {
            fc.assert(
                fc.property(
                    fc.constantFrom(null, undefined, {}, { host: null }, { port: null }),
                    (invalidConfig) => {
                        const url = LocalProxyManager.buildProxyUrl(invalidConfig);
                        
                        expect(url).toBe('');
                    }
                ),
                { numRuns: 100 }
            );
        });
    });
});
