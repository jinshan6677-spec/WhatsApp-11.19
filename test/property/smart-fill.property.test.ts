/**
 * Smart Fill Parser Property Tests
 * 
 * Feature: professional-fingerprint-browser
 * Property 10: 智能填写解析正确性
 * Property 11: 智能填写格式兼容性
 * Validates: Requirements 2.5, 17.1-17.3
 */

import * as fc from 'fast-check';

// Import the SmartFillParser
const SmartFillParser = require('../../src/utils/SmartFillParser');

describe('Smart Fill Parser Property Tests', () => {
  /**
   * Feature: professional-fingerprint-browser, Property 10: 智能填写解析正确性
   * Validates: Requirements 2.5, 17.1
   * 
   * For any valid proxy configuration, formatting it in a supported format
   * and then parsing it should recover the original configuration.
   */
  describe('Property 10: Smart Fill Parsing Correctness', () => {
    // Arbitrary for valid proxy protocol
    const protocolArb = fc.constantFrom('socks5', 'http', 'https');
    
    // Arbitrary for valid host (IP or hostname)
    const hostArb = fc.oneof(
      // IPv4 address
      fc.tuple(
        fc.integer({ min: 1, max: 254 }),
        fc.integer({ min: 0, max: 255 }),
        fc.integer({ min: 0, max: 255 }),
        fc.integer({ min: 1, max: 254 })
      ).map(([a, b, c, d]) => `${a}.${b}.${c}.${d}`),
      // Simple hostname (no special chars that would break parsing)
      fc.stringMatching(/^[a-z][a-z0-9]{2,14}$/).map(s => s + '.com')
    );
    
    // Arbitrary for valid port
    const portArb = fc.integer({ min: 1, max: 65535 });
    
    // Arbitrary for username (alphanumeric only to avoid parsing issues)
    const usernameArb = fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9]{0,19}$/);
    
    // Arbitrary for password (alphanumeric only to avoid parsing issues)
    const passwordArb = fc.stringMatching(/^[a-zA-Z0-9]{1,20}$/);

    test('Format 1: protocol://host:port round-trip', () => {
      fc.assert(
        fc.property(
          protocolArb,
          hostArb,
          portArb,
          (protocol, host, port) => {
            const input = `${protocol}://${host}:${port}`;
            const result = SmartFillParser.parse(input);
            
            expect(result.success).toBe(true);
            expect(result.data).toBeDefined();
            expect(result.data.protocol).toBe(protocol);
            expect(result.data.host).toBe(host);
            expect(result.data.port).toBe(port);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('Format 2: host:port:username:password round-trip', () => {
      fc.assert(
        fc.property(
          hostArb,
          portArb,
          usernameArb,
          passwordArb,
          (host, port, username, password) => {
            const input = `${host}:${port}:${username}:${password}`;
            const result = SmartFillParser.parse(input);
            
            expect(result.success).toBe(true);
            expect(result.data).toBeDefined();
            expect(result.data.host).toBe(host);
            expect(result.data.port).toBe(port);
            expect(result.data.username).toBe(username);
            expect(result.data.password).toBe(password);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('Format 3: protocol://username:password@host:port round-trip', () => {
      fc.assert(
        fc.property(
          protocolArb,
          hostArb,
          portArb,
          usernameArb,
          passwordArb,
          (protocol, host, port, username, password) => {
            const input = `${protocol}://${username}:${password}@${host}:${port}`;
            const result = SmartFillParser.parse(input);
            
            expect(result.success).toBe(true);
            expect(result.data).toBeDefined();
            expect(result.data.protocol).toBe(protocol);
            expect(result.data.host).toBe(host);
            expect(result.data.port).toBe(port);
            expect(result.data.username).toBe(username);
            expect(result.data.password).toBe(password);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('Format 4: JSON format round-trip', () => {
      fc.assert(
        fc.property(
          protocolArb,
          hostArb,
          portArb,
          fc.option(usernameArb, { nil: undefined }),
          fc.option(passwordArb, { nil: undefined }),
          (protocol, host, port, username, password) => {
            const jsonObj: Record<string, unknown> = { protocol, host, port };
            if (username) jsonObj.username = username;
            if (password) jsonObj.password = password;
            
            const input = JSON.stringify(jsonObj);
            const result = SmartFillParser.parse(input);
            
            expect(result.success).toBe(true);
            expect(result.data).toBeDefined();
            expect(result.data.protocol).toBe(protocol);
            expect(result.data.host).toBe(host);
            expect(result.data.port).toBe(port);
            if (username) {
              expect(result.data.username).toBe(username);
            }
            if (password) {
              expect(result.data.password).toBe(password);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    test('Simple host:port format', () => {
      fc.assert(
        fc.property(
          hostArb,
          portArb,
          (host, port) => {
            const input = `${host}:${port}`;
            const result = SmartFillParser.parse(input);
            
            expect(result.success).toBe(true);
            expect(result.data).toBeDefined();
            expect(result.data.host).toBe(host);
            expect(result.data.port).toBe(port);
            // Default protocol should be socks5
            expect(result.data.protocol).toBe('socks5');
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Feature: professional-fingerprint-browser, Property 11: 智能填写格式兼容性
   * Validates: Requirements 17.1-17.3
   * 
   * For any input string, the parser should either:
   * 1. Successfully parse it and return valid proxy data
   * 2. Return a failure with an error message
   * 
   * It should never throw an exception or return undefined.
   */
  describe('Property 11: Smart Fill Format Compatibility', () => {
    test('Parser never throws exceptions for any input', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 0, maxLength: 500 }),
          (input) => {
            // Parser should never throw
            let result;
            expect(() => {
              result = SmartFillParser.parse(input);
            }).not.toThrow();
            
            // Result should always be defined
            expect(result).toBeDefined();
            
            // Result should have success property
            expect(typeof result.success).toBe('boolean');
            
            // If success, data should be defined with required fields
            if (result.success) {
              expect(result.data).toBeDefined();
              expect(result.data.host).toBeDefined();
              expect(result.data.port).toBeDefined();
              expect(typeof result.data.port).toBe('number');
              expect(result.data.port).toBeGreaterThanOrEqual(1);
              expect(result.data.port).toBeLessThanOrEqual(65535);
            } else {
              // If failure, error should be defined
              expect(result.error).toBeDefined();
              expect(typeof result.error).toBe('string');
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    test('Empty and whitespace inputs are rejected gracefully', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('', ' ', '  ', '\t', '\n', '\r', '   \t\n'),
          (whitespace) => {
            const result = SmartFillParser.parse(whitespace);
            
            // Empty/whitespace should fail
            expect(result.success).toBe(false);
            expect(result.error).toBeDefined();
          }
        ),
        { numRuns: 50 }
      );
    });

    test('Invalid port numbers are rejected', () => {
      const invalidPortArb = fc.oneof(
        fc.integer({ min: -1000, max: 0 }),
        fc.integer({ min: 65536, max: 100000 })
      );

      fc.assert(
        fc.property(
          fc.constantFrom('socks5', 'http', 'https'),
          fc.stringMatching(/^[a-z]{3,10}$/).map(s => s + '.com'),
          invalidPortArb,
          (protocol, host, port) => {
            const input = `${protocol}://${host}:${port}`;
            const result = SmartFillParser.parse(input);
            
            // Invalid port should fail validation
            expect(result.success).toBe(false);
          }
        ),
        { numRuns: 50 }
      );
    });

    test('Protocol is case-insensitive', () => {
      const caseVariantArb = fc.constantFrom(
        'SOCKS5', 'Socks5', 'sOcKs5',
        'HTTP', 'Http', 'hTtP',
        'HTTPS', 'Https', 'hTtPs'
      );

      fc.assert(
        fc.property(
          caseVariantArb,
          fc.tuple(
            fc.integer({ min: 1, max: 254 }),
            fc.integer({ min: 0, max: 255 }),
            fc.integer({ min: 0, max: 255 }),
            fc.integer({ min: 1, max: 254 })
          ).map(([a, b, c, d]) => `${a}.${b}.${c}.${d}`),
          fc.integer({ min: 1, max: 65535 }),
          (protocol, host, port) => {
            const input = `${protocol}://${host}:${port}`;
            const result = SmartFillParser.parse(input);
            
            expect(result.success).toBe(true);
            expect(result.data).toBeDefined();
            // Protocol should be normalized to lowercase
            expect(result.data.protocol).toBe(protocol.toLowerCase());
          }
        ),
        { numRuns: 50 }
      );
    });

    test('Parsed data always has valid structure', () => {
      // Generate various valid formats
      const validInputArb = fc.oneof(
        // Format 1: protocol://host:port
        fc.tuple(
          fc.constantFrom('socks5', 'http', 'https'),
          fc.tuple(
            fc.integer({ min: 1, max: 254 }),
            fc.integer({ min: 0, max: 255 }),
            fc.integer({ min: 0, max: 255 }),
            fc.integer({ min: 1, max: 254 })
          ).map(([a, b, c, d]) => `${a}.${b}.${c}.${d}`),
          fc.integer({ min: 1, max: 65535 })
        ).map(([p, h, port]) => `${p}://${h}:${port}`),
        
        // Format 2: host:port
        fc.tuple(
          fc.tuple(
            fc.integer({ min: 1, max: 254 }),
            fc.integer({ min: 0, max: 255 }),
            fc.integer({ min: 0, max: 255 }),
            fc.integer({ min: 1, max: 254 })
          ).map(([a, b, c, d]) => `${a}.${b}.${c}.${d}`),
          fc.integer({ min: 1, max: 65535 })
        ).map(([h, port]) => `${h}:${port}`)
      );

      fc.assert(
        fc.property(
          validInputArb,
          (input) => {
            const result = SmartFillParser.parse(input);
            
            expect(result.success).toBe(true);
            expect(result.data).toBeDefined();
            
            // Validate structure
            expect(['socks5', 'http', 'https']).toContain(result.data.protocol);
            expect(typeof result.data.host).toBe('string');
            expect(result.data.host.length).toBeGreaterThan(0);
            expect(typeof result.data.port).toBe('number');
            expect(Number.isInteger(result.data.port)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
