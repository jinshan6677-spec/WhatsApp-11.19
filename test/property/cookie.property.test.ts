/**
 * Property-Based Tests for Cookie Management
 * 
 * Feature: professional-fingerprint-browser
 * Tests Cookie validation, injection, and export functionality
 * 
 * @module test/property/cookie
 */

import * as fc from 'fast-check';
import { CookieManager, CookieData } from '../../src/infrastructure/fingerprint/CookieManager';

// Arbitraries for Cookie testing
// Use simple alphanumeric cookie names to avoid JSON escaping issues in tests
const cookieNameArbitrary: fc.Arbitrary<string> = fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9_-]{0,29}$/);

// Use simple alphanumeric cookie values to avoid JSON escaping issues in tests
const cookieValueArbitrary: fc.Arbitrary<string> = fc.stringMatching(/^[a-zA-Z0-9_-]{0,50}$/);

const domainArbitrary = fc.constantFrom(
  'example.com',
  '.example.com',
  'sub.example.com',
  'test.org',
  '.test.org',
  'localhost'
);

const pathArbitrary = fc.constantFrom('/', '/path', '/path/to/resource', '/api');

const sameSiteArbitrary = fc.constantFrom<'Strict' | 'Lax' | 'None'>('Strict', 'Lax', 'None');

// Valid cookie arbitrary
const validCookieArbitrary = fc.record({
  name: cookieNameArbitrary,
  value: cookieValueArbitrary,
  domain: domainArbitrary,
  path: fc.option(pathArbitrary, { nil: undefined }),
  secure: fc.option(fc.boolean(), { nil: undefined }),
  httpOnly: fc.option(fc.boolean(), { nil: undefined }),
  sameSite: fc.option(sameSiteArbitrary, { nil: undefined }),
  expirationDate: fc.option(fc.integer({ min: Math.floor(Date.now() / 1000), max: Math.floor(Date.now() / 1000) + 31536000 }), { nil: undefined })
});

describe('Cookie Property Tests', () => {
  /**
   * Feature: professional-fingerprint-browser, Property 25: Cookie 注入正确性
   * Validates: Requirements 10.3
   * 
   * For any valid cookie configuration, the generated injection script
   * must correctly set document.cookie with all specified properties.
   */
  test('Property 25: Cookie injection correctness', () => {
    fc.assert(
      fc.property(
        fc.array(validCookieArbitrary, { minLength: 1, maxLength: 10 }),
        (cookies: CookieData[]) => {
          // Generate injection script
          const script = CookieManager.generateCookieInjectionScript(cookies);
          
          // Verify script is not empty
          expect(script).toBeTruthy();
          expect(script.length).toBeGreaterThan(0);
          
          // Verify script contains cookie injection logic
          expect(script).toContain('cookiesToInject');
          expect(script).toContain('document.cookie');
          
          // Verify script handles all cookie properties
          expect(script).toContain('path');
          expect(script).toContain('domain');
          expect(script).toContain('secure');
          expect(script).toContain('samesite');
          expect(script).toContain('expires');
          
          // Verify all cookies are in the script
          for (const cookie of cookies) {
            expect(script).toContain(cookie.name);
          }
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });


  /**
   * Additional test: Cookie validation works correctly
   */
  test('Property 25 (Extended): Cookie validation works correctly', () => {
    fc.assert(
      fc.property(
        validCookieArbitrary,
        (cookie: CookieData) => {
          // Validate cookie
          const validation = CookieManager.validateCookie(cookie);
          
          // Valid cookies should pass validation
          expect(validation.valid).toBe(true);
          expect(validation.errors).toHaveLength(0);
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Additional test: Invalid cookies are detected
   */
  test('Property 25 (Extended): Invalid cookies are detected', () => {
    // Missing name
    const noName = CookieManager.validateCookie({ value: 'test', domain: 'example.com' });
    expect(noName.valid).toBe(false);
    
    // Missing value
    const noValue = CookieManager.validateCookie({ name: 'test', domain: 'example.com' });
    expect(noValue.valid).toBe(false);
    
    // Missing domain
    const noDomain = CookieManager.validateCookie({ name: 'test', value: 'test' });
    expect(noDomain.valid).toBe(false);
    
    // Invalid sameSite
    const invalidSameSite = CookieManager.validateCookie({ 
      name: 'test', 
      value: 'test', 
      domain: 'example.com',
      sameSite: 'Invalid' as any
    });
    expect(invalidSameSite.valid).toBe(false);
  });

  /**
   * Additional test: Cookie JSON validation works correctly
   */
  test('Property 25 (Extended): Cookie JSON validation works correctly', () => {
    fc.assert(
      fc.property(
        fc.array(validCookieArbitrary, { minLength: 1, maxLength: 5 }),
        (cookies: CookieData[]) => {
          // Convert to JSON
          const json = CookieManager.toJSON(cookies);
          
          // Validate JSON
          const validation = CookieManager.validateCookieJSON(json);
          
          // Should be valid
          expect(validation.valid).toBe(true);
          expect(validation.errors).toHaveLength(0);
          expect(validation.cookies.length).toBe(cookies.length);
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Additional test: Invalid JSON is detected
   */
  test('Property 25 (Extended): Invalid JSON is detected', () => {
    // Invalid JSON syntax
    const invalidSyntax = CookieManager.validateCookieJSON('not valid json');
    expect(invalidSyntax.valid).toBe(false);
    expect(invalidSyntax.errors.length).toBeGreaterThan(0);
    
    // Not an array
    const notArray = CookieManager.validateCookieJSON('{"name": "test"}');
    expect(notArray.valid).toBe(false);
    
    // Array with invalid cookies
    const invalidCookies = CookieManager.validateCookieJSON('[{"invalid": true}]');
    expect(invalidCookies.valid).toBe(false);
  });

  /**
   * Additional test: Cookie round-trip (toJSON -> fromJSON)
   */
  test('Property 25 (Extended): Cookie round-trip consistency', () => {
    fc.assert(
      fc.property(
        fc.array(validCookieArbitrary, { minLength: 1, maxLength: 5 }),
        (cookies: CookieData[]) => {
          // Convert to JSON and back
          const json = CookieManager.toJSON(cookies);
          const parsed = CookieManager.fromJSON(json);
          
          // Should have same number of cookies
          expect(parsed.length).toBe(cookies.length);
          
          // Each cookie should have required fields
          for (let i = 0; i < parsed.length; i++) {
            expect(parsed[i].name).toBe(cookies[i].name);
            expect(parsed[i].value).toBe(cookies[i].value);
            expect(parsed[i].domain).toBe(cookies[i].domain);
          }
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Additional test: Cookie creation works correctly
   */
  test('Property 25 (Extended): Cookie creation works correctly', () => {
    fc.assert(
      fc.property(
        cookieNameArbitrary,
        cookieValueArbitrary,
        domainArbitrary,
        (name: string, value: string, domain: string) => {
          const cookie = CookieManager.createCookie(name, value, domain);
          
          // Verify cookie properties
          expect(cookie.name).toBe(name);
          expect(cookie.value).toBe(value);
          expect(cookie.domain).toBe(domain);
          expect(cookie.path).toBe('/');
          expect(cookie.secure).toBe(false);
          expect(cookie.httpOnly).toBe(false);
          expect(cookie.sameSite).toBe('Lax');
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Additional test: Cookie merge works correctly
   */
  test('Property 25 (Extended): Cookie merge works correctly', () => {
    fc.assert(
      fc.property(
        fc.array(validCookieArbitrary, { minLength: 1, maxLength: 5 }),
        fc.array(validCookieArbitrary, { minLength: 1, maxLength: 5 }),
        (existing: CookieData[], newCookies: CookieData[]) => {
          const merged = CookieManager.mergeCookies(existing, newCookies);
          
          // Merged should contain all unique cookies
          expect(merged.length).toBeLessThanOrEqual(existing.length + newCookies.length);
          expect(merged.length).toBeGreaterThan(0);
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Additional test: Cookie filter by domain works correctly
   */
  test('Property 25 (Extended): Cookie filter by domain works correctly', () => {
    const cookies: CookieData[] = [
      CookieManager.createCookie('test1', 'value1', 'example.com'),
      CookieManager.createCookie('test2', 'value2', '.example.com'),
      CookieManager.createCookie('test3', 'value3', 'other.com'),
      CookieManager.createCookie('test4', 'value4', 'sub.example.com')
    ];
    
    // Filter for example.com
    const filtered = CookieManager.filterByDomain(cookies, 'example.com');
    
    // Should include exact match and parent domain
    expect(filtered.length).toBe(2);
    expect(filtered.some(c => c.name === 'test1')).toBe(true);
    expect(filtered.some(c => c.name === 'test2')).toBe(true);
  });

  /**
   * Additional test: Expired cookies are removed
   */
  test('Property 25 (Extended): Expired cookies are removed', () => {
    const now = Math.floor(Date.now() / 1000);
    
    const cookies: CookieData[] = [
      { ...CookieManager.createCookie('valid', 'value', 'example.com'), expirationDate: now + 3600 },
      { ...CookieManager.createCookie('expired', 'value', 'example.com'), expirationDate: now - 3600 },
      CookieManager.createCookie('noExpiry', 'value', 'example.com')
    ];
    
    const filtered = CookieManager.removeExpired(cookies);
    
    // Should remove expired cookie
    expect(filtered.length).toBe(2);
    expect(filtered.some(c => c.name === 'valid')).toBe(true);
    expect(filtered.some(c => c.name === 'noExpiry')).toBe(true);
    expect(filtered.some(c => c.name === 'expired')).toBe(false);
  });

  /**
   * Additional test: Empty cookie array produces minimal script
   */
  test('Property 25 (Extended): Empty cookie array produces minimal script', () => {
    const script = CookieManager.generateCookieInjectionScript([]);
    
    expect(script).toContain('No cookies to inject');
  });

  /**
   * Additional test: Cookie export script is valid
   */
  test('Property 25 (Extended): Cookie export script is valid', () => {
    const script = CookieManager.generateCookieExportScript();
    
    // Verify script is not empty
    expect(script).toBeTruthy();
    expect(script.length).toBeGreaterThan(0);
    
    // Verify script reads document.cookie
    expect(script).toContain('document.cookie');
    
    // Verify script returns JSON
    expect(script).toContain('JSON.stringify');
  });
});
