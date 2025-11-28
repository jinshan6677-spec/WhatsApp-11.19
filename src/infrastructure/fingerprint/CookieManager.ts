/**
 * CookieManager
 * 
 * Manages cookie configuration for browser fingerprint including
 * JSON validation, injection, and export functionality.
 * 
 * Requirements: 10.1-10.5
 */

export interface CookieData {
  name: string;
  value: string;
  domain: string;
  path?: string;
  secure?: boolean;
  httpOnly?: boolean;
  sameSite?: 'Strict' | 'Lax' | 'None';
  expirationDate?: number;
}

export interface CookieValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  cookies: CookieData[];
}

export interface CookieInjectionResult {
  success: boolean;
  injected: number;
  failed: number;
  errors: string[];
}

export class CookieManager {
  /**
   * Validates a single cookie object
   * Requirements: 10.2
   */
  static validateCookie(cookie: any): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (!cookie || typeof cookie !== 'object') {
      errors.push('Cookie must be an object');
      return { valid: false, errors };
    }
    
    // Required fields
    if (!cookie.name || typeof cookie.name !== 'string') {
      errors.push('Cookie must have a "name" field (string)');
    }
    
    if (cookie.value === undefined || cookie.value === null) {
      errors.push('Cookie must have a "value" field');
    }
    
    if (!cookie.domain || typeof cookie.domain !== 'string') {
      errors.push('Cookie must have a "domain" field (string)');
    }

    
    // Optional field validation
    if (cookie.path !== undefined && typeof cookie.path !== 'string') {
      errors.push('Cookie "path" must be a string');
    }
    
    if (cookie.secure !== undefined && typeof cookie.secure !== 'boolean') {
      errors.push('Cookie "secure" must be a boolean');
    }
    
    if (cookie.httpOnly !== undefined && typeof cookie.httpOnly !== 'boolean') {
      errors.push('Cookie "httpOnly" must be a boolean');
    }
    
    if (cookie.sameSite !== undefined) {
      if (!['Strict', 'Lax', 'None'].includes(cookie.sameSite)) {
        errors.push('Cookie "sameSite" must be "Strict", "Lax", or "None"');
      }
    }
    
    if (cookie.expirationDate !== undefined) {
      if (typeof cookie.expirationDate !== 'number') {
        errors.push('Cookie "expirationDate" must be a number (Unix timestamp)');
      }
    }
    
    // Domain validation
    if (cookie.domain && typeof cookie.domain === 'string') {
      if (!cookie.domain.match(/^\.?[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)*$/)) {
        errors.push('Cookie "domain" has invalid format');
      }
    }
    
    return { valid: errors.length === 0, errors };
  }
  
  /**
   * Validates a JSON string containing cookies
   * Requirements: 10.2
   */
  static validateCookieJSON(jsonString: string): CookieValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const cookies: CookieData[] = [];
    
    // Try to parse JSON
    let parsed: any;
    try {
      parsed = JSON.parse(jsonString);
    } catch (e) {
      errors.push(`Invalid JSON: ${(e as Error).message}`);
      return { valid: false, errors, warnings, cookies };
    }
    
    // Ensure it's an array
    if (!Array.isArray(parsed)) {
      errors.push('Cookie JSON must be an array of cookie objects');
      return { valid: false, errors, warnings, cookies };
    }
    
    // Validate each cookie
    for (let i = 0; i < parsed.length; i++) {
      const cookie = parsed[i];
      const validation = this.validateCookie(cookie);
      
      if (!validation.valid) {
        errors.push(`Cookie at index ${i}: ${validation.errors.join(', ')}`);
      } else {
        cookies.push(this.normalizeCookie(cookie));
      }
    }
    
    // Check for duplicate cookies
    const seen = new Set<string>();
    for (const cookie of cookies) {
      const key = `${cookie.name}|${cookie.domain}|${cookie.path || '/'}`;
      if (seen.has(key)) {
        warnings.push(`Duplicate cookie: ${cookie.name} for domain ${cookie.domain}`);
      }
      seen.add(key);
    }
    
    return {
      valid: errors.length === 0,
      errors,
      warnings,
      cookies
    };
  }
  
  /**
   * Normalizes a cookie object to ensure all fields have proper types
   */
  static normalizeCookie(cookie: any): CookieData {
    return {
      name: String(cookie.name),
      value: String(cookie.value),
      domain: String(cookie.domain),
      path: cookie.path ? String(cookie.path) : '/',
      secure: Boolean(cookie.secure),
      httpOnly: Boolean(cookie.httpOnly),
      sameSite: cookie.sameSite || 'Lax',
      expirationDate: cookie.expirationDate ? Number(cookie.expirationDate) : undefined
    };
  }
  
  /**
   * Generates cookie injection script for preload
   * Requirements: 10.3
   */
  static generateCookieInjectionScript(cookies: CookieData[]): string {
    if (!cookies || cookies.length === 0) {
      return '// No cookies to inject';
    }
    
    const cookiesJson = JSON.stringify(cookies);
    
    return `
(function() {
  // Cookie Injection
  const cookiesToInject = ${cookiesJson};
  
  for (const cookie of cookiesToInject) {
    let cookieString = encodeURIComponent(cookie.name) + '=' + encodeURIComponent(cookie.value);
    
    if (cookie.path) {
      cookieString += '; path=' + cookie.path;
    }
    
    if (cookie.domain) {
      cookieString += '; domain=' + cookie.domain;
    }
    
    if (cookie.secure) {
      cookieString += '; secure';
    }
    
    if (cookie.sameSite) {
      cookieString += '; samesite=' + cookie.sameSite;
    }
    
    if (cookie.expirationDate) {
      const date = new Date(cookie.expirationDate * 1000);
      cookieString += '; expires=' + date.toUTCString();
    }
    
    try {
      document.cookie = cookieString;
    } catch (e) {
      console.warn('Failed to inject cookie:', cookie.name, e);
    }
  }
})();
`;
  }
  
  /**
   * Generates cookie export script
   * Requirements: 10.5
   */
  static generateCookieExportScript(): string {
    return `
(function() {
  // Cookie Export
  const cookies = document.cookie.split(';').map(function(cookie) {
    const parts = cookie.trim().split('=');
    const name = decodeURIComponent(parts[0]);
    const value = decodeURIComponent(parts.slice(1).join('='));
    
    return {
      name: name,
      value: value,
      domain: window.location.hostname,
      path: '/'
    };
  }).filter(function(cookie) {
    return cookie.name && cookie.name.length > 0;
  });
  
  return JSON.stringify(cookies, null, 2);
})();
`;
  }
  
  /**
   * Creates a cookie data object
   */
  static createCookie(
    name: string,
    value: string,
    domain: string,
    options?: Partial<Omit<CookieData, 'name' | 'value' | 'domain'>>
  ): CookieData {
    return {
      name,
      value,
      domain,
      path: options?.path || '/',
      secure: options?.secure || false,
      httpOnly: options?.httpOnly || false,
      sameSite: options?.sameSite || 'Lax',
      expirationDate: options?.expirationDate
    };
  }
  
  /**
   * Converts cookies to JSON string
   */
  static toJSON(cookies: CookieData[]): string {
    return JSON.stringify(cookies, null, 2);
  }
  
  /**
   * Parses cookies from JSON string
   */
  static fromJSON(jsonString: string): CookieData[] {
    const validation = this.validateCookieJSON(jsonString);
    if (!validation.valid) {
      throw new Error(`Invalid cookie JSON: ${validation.errors.join(', ')}`);
    }
    return validation.cookies;
  }
  
  /**
   * Merges two cookie arrays, with newer cookies taking precedence
   */
  static mergeCookies(existing: CookieData[], newCookies: CookieData[]): CookieData[] {
    const merged = new Map<string, CookieData>();
    
    // Add existing cookies
    for (const cookie of existing) {
      const key = `${cookie.name}|${cookie.domain}|${cookie.path || '/'}`;
      merged.set(key, cookie);
    }
    
    // Override with new cookies
    for (const cookie of newCookies) {
      const key = `${cookie.name}|${cookie.domain}|${cookie.path || '/'}`;
      merged.set(key, cookie);
    }
    
    return Array.from(merged.values());
  }
  
  /**
   * Filters cookies by domain
   */
  static filterByDomain(cookies: CookieData[], domain: string): CookieData[] {
    return cookies.filter(cookie => {
      // Exact match
      if (cookie.domain === domain) return true;
      
      // Subdomain match (cookie domain starts with .)
      if (cookie.domain.startsWith('.')) {
        return domain.endsWith(cookie.domain) || domain === cookie.domain.slice(1);
      }
      
      return false;
    });
  }
  
  /**
   * Removes expired cookies
   */
  static removeExpired(cookies: CookieData[]): CookieData[] {
    const now = Math.floor(Date.now() / 1000);
    return cookies.filter(cookie => {
      if (!cookie.expirationDate) return true;
      return cookie.expirationDate > now;
    });
  }
}

export default CookieManager;