'use strict';

/**
 * LogSanitizer - Utility for sanitizing sensitive data before logging
 * 
 * Provides functions to remove or mask sensitive information such as
 * passwords, authentication tokens, and other credentials from objects
 * before they are written to logs.
 * 
 * **Validates: Requirements 6.4**
 */

/**
 * Default sensitive field names that should be sanitized
 */
const SENSITIVE_FIELDS = [
    'password',
    'passwd',
    'pwd',
    'secret',
    'token',
    'apiKey',
    'api_key',
    'apikey',
    'auth',
    'authorization',
    'credential',
    'credentials',
    'privateKey',
    'private_key',
    'accessToken',
    'access_token',
    'refreshToken',
    'refresh_token',
    'sessionToken',
    'session_token',
    'cookie',
    'cookies'
];

/**
 * Default mask string used to replace sensitive values
 */
const DEFAULT_MASK = '****';

/**
 * Check if a field name is sensitive (case-insensitive)
 * @param {string} fieldName - The field name to check
 * @param {string[]} sensitiveFields - List of sensitive field names
 * @returns {boolean} True if the field is sensitive
 */
function isSensitiveField(fieldName, sensitiveFields = SENSITIVE_FIELDS) {
    if (typeof fieldName !== 'string') {
        return false;
    }
    
    const lowerFieldName = fieldName.toLowerCase();
    return sensitiveFields.some(sensitive => 
        lowerFieldName === sensitive.toLowerCase() ||
        lowerFieldName.includes(sensitive.toLowerCase())
    );
}

/**
 * Sanitize a single value if it appears to be sensitive
 * @param {*} value - The value to potentially sanitize
 * @param {string} mask - The mask string to use
 * @returns {*} The sanitized or original value
 */
function sanitizeValue(value, mask = DEFAULT_MASK) {
    // Only mask non-empty strings
    if (typeof value === 'string' && value.length > 0) {
        return mask;
    }
    // For other types, return the mask if value is truthy
    if (value !== null && value !== undefined && value !== '') {
        return mask;
    }
    return value;
}

/**
 * Recursively sanitize an object, masking sensitive fields
 * @param {*} obj - The object to sanitize
 * @param {Object} options - Sanitization options
 * @param {string[]} options.sensitiveFields - List of sensitive field names
 * @param {string} options.mask - The mask string to use
 * @param {number} options.maxDepth - Maximum recursion depth
 * @param {number} currentDepth - Current recursion depth (internal)
 * @returns {*} The sanitized object
 */
function sanitizeObject(obj, options = {}, currentDepth = 0) {
    const {
        sensitiveFields = SENSITIVE_FIELDS,
        mask = DEFAULT_MASK,
        maxDepth = 10
    } = options;

    // Prevent infinite recursion
    if (currentDepth > maxDepth) {
        return '[MAX_DEPTH_EXCEEDED]';
    }

    // Handle null/undefined
    if (obj === null || obj === undefined) {
        return obj;
    }

    // Handle primitive types
    if (typeof obj !== 'object') {
        return obj;
    }

    // Handle arrays
    if (Array.isArray(obj)) {
        return obj.map(item => sanitizeObject(item, options, currentDepth + 1));
    }

    // Handle Date objects
    if (obj instanceof Date) {
        return obj;
    }

    // Handle regular objects
    const sanitized = {};
    
    for (const [key, value] of Object.entries(obj)) {
        if (typeof value === 'object' && value !== null) {
            // Always recursively sanitize nested objects first
            // This ensures we sanitize fields inside objects like 'auth'
            sanitized[key] = sanitizeObject(value, options, currentDepth + 1);
        } else if (isSensitiveField(key, sensitiveFields)) {
            // Mask sensitive primitive fields
            sanitized[key] = sanitizeValue(value, mask);
        } else {
            // Keep non-sensitive primitive values as-is
            sanitized[key] = value;
        }
    }

    return sanitized;
}

/**
 * Sanitize a proxy configuration object for logging
 * 
 * This function specifically handles proxy configuration objects,
 * masking passwords and authentication credentials while preserving
 * other configuration details for debugging purposes.
 * 
 * @param {Object} config - The proxy configuration to sanitize
 * @param {Object} options - Sanitization options
 * @param {string} options.mask - The mask string to use (default: '****')
 * @param {string[]} options.additionalFields - Additional field names to sanitize
 * @returns {Object} The sanitized configuration
 * 
 * @example
 * const config = {
 *     host: 'proxy.example.com',
 *     port: 8080,
 *     username: 'user123',
 *     password: 'secretPassword'
 * };
 * 
 * const sanitized = sanitizeForLogging(config);
 * // Result: { host: 'proxy.example.com', port: 8080, username: 'user123', password: '****' }
 */
function sanitizeForLogging(config, options = {}) {
    const {
        mask = DEFAULT_MASK,
        additionalFields = []
    } = options;

    // Handle null/undefined input
    if (config === null || config === undefined) {
        return config;
    }

    // Handle non-object input
    if (typeof config !== 'object') {
        return config;
    }

    // Combine default sensitive fields with any additional ones
    const sensitiveFields = [...SENSITIVE_FIELDS, ...additionalFields];

    return sanitizeObject(config, {
        sensitiveFields,
        mask,
        maxDepth: 10
    });
}

/**
 * Create a sanitized copy of proxy chain configuration
 * 
 * @param {Object} localProxy - Local proxy configuration
 * @param {Object|null} chainedProxy - Chained proxy configuration
 * @returns {Object} Sanitized configuration object
 */
function sanitizeProxyChainConfig(localProxy, chainedProxy) {
    return {
        localProxy: sanitizeForLogging(localProxy),
        chainedProxy: chainedProxy ? sanitizeForLogging(chainedProxy) : null
    };
}

/**
 * Sanitize an error object for logging
 * 
 * @param {Error|Object} error - The error to sanitize
 * @returns {Object} Sanitized error object
 */
function sanitizeError(error) {
    if (!error) {
        return error;
    }

    const sanitized = {
        message: error.message || String(error),
        name: error.name || 'Error'
    };

    // Include stack trace if available
    if (error.stack) {
        sanitized.stack = error.stack;
    }

    // Sanitize any additional properties
    if (typeof error === 'object') {
        for (const [key, value] of Object.entries(error)) {
            if (!['message', 'name', 'stack'].includes(key)) {
                if (isSensitiveField(key)) {
                    sanitized[key] = DEFAULT_MASK;
                } else if (typeof value === 'object' && value !== null) {
                    sanitized[key] = sanitizeForLogging(value);
                } else {
                    sanitized[key] = value;
                }
            }
        }
    }

    return sanitized;
}

module.exports = {
    sanitizeForLogging,
    sanitizeObject,
    sanitizeProxyChainConfig,
    sanitizeError,
    isSensitiveField,
    SENSITIVE_FIELDS,
    DEFAULT_MASK
};
