'use strict';

const ProxyPreChecker = require('../ProxyPreChecker');
const ProxyConfig = require('../../../domain/entities/ProxyConfig');

// Mock the proxy agents
jest.mock('socks-proxy-agent', () => ({
  SocksProxyAgent: jest.fn().mockImplementation(() => ({
    protocol: 'socks5:'
  }))
}));

jest.mock('https-proxy-agent', () => ({
  HttpsProxyAgent: jest.fn().mockImplementation(() => ({
    protocol: 'https:'
  }))
}));

// Mock http and https modules
jest.mock('http', () => {
  const originalHttp = jest.requireActual('http');
  return {
    ...originalHttp,
    request: jest.fn()
  };
});

jest.mock('https', () => {
  const originalHttps = jest.requireActual('https');
  return {
    ...originalHttps,
    request: jest.fn()
  };
});

const http = require('http');
const https = require('https');

/**
 * Creates a mock HTTP response
 */
function createMockResponse(statusCode, data) {
  const response = {
    statusCode,
    on: jest.fn((event, handler) => {
      if (event === 'data' && data) {
        handler(JSON.stringify(data));
      }
      if (event === 'end') {
        setImmediate(handler);
      }
      return response;
    })
  };
  return response;
}

/**
 * Creates a mock HTTP request
 */
function createMockRequest(response, shouldError = false, errorMessage = 'Connection error') {
  const request = {
    on: jest.fn((event, handler) => {
      if (event === 'error' && shouldError) {
        setImmediate(() => handler(new Error(errorMessage)));
      }
      if (event === 'timeout' && shouldError && errorMessage.includes('timeout')) {
        setImmediate(handler);
      }
      return request;
    }),
    end: jest.fn(),
    destroy: jest.fn()
  };
  return request;
}

describe('ProxyPreChecker', () => {
  let checker;
  let mockLogger;

  beforeEach(() => {
    jest.clearAllMocks();
    mockLogger = jest.fn();
    checker = new ProxyPreChecker({
      logger: mockLogger,
      connectivityTimeout: 3000,
      ipCheckTimeout: 5000
    });
  });

  describe('constructor', () => {
    it('should create instance with default options', () => {
      const defaultChecker = new ProxyPreChecker();
      expect(defaultChecker.connectivityTimeout).toBe(ProxyPreChecker.Defaults.CONNECTIVITY_TIMEOUT);
      expect(defaultChecker.latencySamples).toBe(ProxyPreChecker.Defaults.LATENCY_SAMPLES);
      expect(defaultChecker.ipCheckTimeout).toBe(ProxyPreChecker.Defaults.IP_CHECK_TIMEOUT);
    });

    it('should accept custom options', () => {
      const customChecker = new ProxyPreChecker({
        connectivityTimeout: 5000,
        latencySamples: 5,
        ipCheckTimeout: 10000
      });
      expect(customChecker.connectivityTimeout).toBe(5000);
      expect(customChecker.latencySamples).toBe(5);
      expect(customChecker.ipCheckTimeout).toBe(10000);
    });

    it('should accept custom logger', () => {
      const customLogger = jest.fn();
      const customChecker = new ProxyPreChecker({ logger: customLogger });
      expect(customChecker.log).toBe(customLogger);
    });

    it('should have default IP endpoints', () => {
      expect(checker.ipEndpoints).toEqual(ProxyPreChecker.IPEndpoints);
      expect(checker.ipEndpoints.length).toBeGreaterThan(0);
    });
  });

  describe('testConnectivity', () => {
    it('should return success for valid proxy config', async () => {
      const mockResponse = createMockResponse(200, { query: '1.2.3.4' });
      const mockRequest = createMockRequest(mockResponse);
      
      http.request.mockImplementation((options, callback) => {
        setImmediate(() => callback(mockResponse));
        return mockRequest;
      });

      const config = new ProxyConfig({
        protocol: 'socks5',
        host: 'proxy.example.com',
        port: 1080,
        enabled: true
      });

      const result = await checker.testConnectivity(config);
      
      expect(result.success).toBe(true);
      expect(result.latency).toBeDefined();
      expect(typeof result.latency).toBe('number');
    });

    it('should return failure for invalid config', async () => {
      const config = {
        protocol: 'socks5',
        host: '', // Invalid - empty host
        port: 1080,
        enabled: true
      };

      const result = await checker.testConnectivity(config);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid configuration');
    });

    it('should return failure on connection error', async () => {
      const mockRequest = createMockRequest(null, true, 'ECONNREFUSED');
      
      http.request.mockImplementation(() => mockRequest);

      const config = new ProxyConfig({
        protocol: 'socks5',
        host: 'proxy.example.com',
        port: 1080,
        enabled: true
      });

      const result = await checker.testConnectivity(config);
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should accept plain object config', async () => {
      const mockResponse = createMockResponse(200, { query: '1.2.3.4' });
      const mockRequest = createMockRequest(mockResponse);
      
      http.request.mockImplementation((options, callback) => {
        setImmediate(() => callback(mockResponse));
        return mockRequest;
      });

      const result = await checker.testConnectivity({
        protocol: 'socks5',
        host: 'proxy.example.com',
        port: 1080,
        enabled: true
      });
      
      expect(result.success).toBe(true);
    });
  });

  describe('measureLatency', () => {
    it('should measure latency with multiple samples', async () => {
      const mockResponse = createMockResponse(200, { query: '1.2.3.4' });
      const mockRequest = createMockRequest(mockResponse);
      
      http.request.mockImplementation((options, callback) => {
        setImmediate(() => callback(mockResponse));
        return mockRequest;
      });

      const config = new ProxyConfig({
        protocol: 'socks5',
        host: 'proxy.example.com',
        port: 1080,
        enabled: true
      });

      const result = await checker.measureLatency(config, 3);
      
      expect(result.success).toBe(true);
      expect(result.latency).toBeDefined();
      expect(result.latency.min).toBeDefined();
      expect(result.latency.max).toBeDefined();
      expect(result.latency.avg).toBeDefined();
      expect(result.samples).toBe(3);
    });

    it('should return failure if all samples fail', async () => {
      const mockRequest = createMockRequest(null, true, 'Connection error');
      
      http.request.mockImplementation(() => mockRequest);

      const config = new ProxyConfig({
        protocol: 'socks5',
        host: 'proxy.example.com',
        port: 1080,
        enabled: true
      });

      const result = await checker.measureLatency(config, 2);
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('All latency samples failed');
    });

    it('should use default sample count if not specified', async () => {
      const mockResponse = createMockResponse(200, { query: '1.2.3.4' });
      const mockRequest = createMockRequest(mockResponse);
      
      http.request.mockImplementation((options, callback) => {
        setImmediate(() => callback(mockResponse));
        return mockRequest;
      });

      const config = new ProxyConfig({
        protocol: 'socks5',
        host: 'proxy.example.com',
        port: 1080,
        enabled: true
      });

      const result = await checker.measureLatency(config);
      
      expect(result.success).toBe(true);
      expect(result.samples).toBe(ProxyPreChecker.Defaults.LATENCY_SAMPLES);
    });
  });

  describe('getExitIP', () => {
    it('should return IP from first successful source', async () => {
      const mockResponse = createMockResponse(200, { ip: '203.0.113.1' });
      const mockRequest = createMockRequest(mockResponse);
      
      http.request.mockImplementation((options, callback) => {
        setImmediate(() => callback(mockResponse));
        return mockRequest;
      });

      https.request.mockImplementation((options, callback) => {
        setImmediate(() => callback(mockResponse));
        return mockRequest;
      });

      const config = new ProxyConfig({
        protocol: 'socks5',
        host: 'proxy.example.com',
        port: 1080,
        enabled: true
      });

      const result = await checker.getExitIP(config);
      
      expect(result.success).toBe(true);
      expect(result.ip).toBeDefined();
      expect(result.source).toBeDefined();
    });

    it('should try multiple sources on failure', async () => {
      let callCount = 0;
      const mockRequest = createMockRequest(null, true, 'Connection error');
      const mockSuccessResponse = createMockResponse(200, { query: '203.0.113.1' });
      const mockSuccessRequest = createMockRequest(mockSuccessResponse);
      
      http.request.mockImplementation((options, callback) => {
        callCount++;
        if (callCount <= 1) {
          return mockRequest;
        }
        setImmediate(() => callback(mockSuccessResponse));
        return mockSuccessRequest;
      });

      const config = new ProxyConfig({
        protocol: 'socks5',
        host: 'proxy.example.com',
        port: 1080,
        enabled: true
      });

      // Use custom endpoints for testing
      checker.ipEndpoints = [
        { url: 'http://first.example.com', parser: (data) => data.ip },
        { url: 'http://second.example.com', parser: (data) => data.query }
      ];

      const result = await checker.getExitIP(config);
      
      // Should have tried at least 2 sources
      expect(callCount).toBeGreaterThanOrEqual(1);
    });

    it('should return failure if all sources fail', async () => {
      const mockRequest = createMockRequest(null, true, 'Connection error');
      
      http.request.mockImplementation(() => mockRequest);
      https.request.mockImplementation(() => mockRequest);

      const config = new ProxyConfig({
        protocol: 'socks5',
        host: 'proxy.example.com',
        port: 1080,
        enabled: true
      });

      const result = await checker.getExitIP(config);
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to detect exit IP from all sources');
    });
  });

  describe('performFullCheck', () => {
    it('should perform complete pre-check', async () => {
      const mockResponse = createMockResponse(200, { ip: '203.0.113.1', query: '203.0.113.1' });
      const mockRequest = createMockRequest(mockResponse);
      
      http.request.mockImplementation((options, callback) => {
        setImmediate(() => callback(mockResponse));
        return mockRequest;
      });

      https.request.mockImplementation((options, callback) => {
        setImmediate(() => callback(mockResponse));
        return mockRequest;
      });

      const config = new ProxyConfig({
        protocol: 'socks5',
        host: 'proxy.example.com',
        port: 1080,
        enabled: true
      });

      const result = await checker.performFullCheck(config);
      
      expect(result.success).toBe(true);
      expect(result.connectivity).toBeDefined();
      expect(result.ip).toBeDefined();
    });

    it('should fail if connectivity test fails', async () => {
      const mockRequest = createMockRequest(null, true, 'ECONNREFUSED');
      
      http.request.mockImplementation(() => mockRequest);

      const config = new ProxyConfig({
        protocol: 'socks5',
        host: 'proxy.example.com',
        port: 1080,
        enabled: true
      });

      const result = await checker.performFullCheck(config);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Connectivity failed');
    });
  });

  describe('_isValidIP', () => {
    it('should validate IPv4 addresses', () => {
      expect(checker._isValidIP('192.168.1.1')).toBe(true);
      expect(checker._isValidIP('10.0.0.1')).toBe(true);
      expect(checker._isValidIP('255.255.255.255')).toBe(true);
      expect(checker._isValidIP('0.0.0.0')).toBe(true);
    });

    it('should reject invalid IPv4 addresses', () => {
      expect(checker._isValidIP('256.1.1.1')).toBe(false);
      expect(checker._isValidIP('1.2.3')).toBe(false);
      expect(checker._isValidIP('1.2.3.4.5')).toBe(false);
      expect(checker._isValidIP('abc.def.ghi.jkl')).toBe(false);
    });

    it('should reject null and undefined', () => {
      expect(checker._isValidIP(null)).toBe(false);
      expect(checker._isValidIP(undefined)).toBe(false);
      expect(checker._isValidIP('')).toBe(false);
    });
  });

  describe('_formatError', () => {
    it('should format timeout errors', () => {
      const error = new Error('Connection timeout');
      expect(checker._formatError(error)).toContain('timeout');
    });

    it('should format connection refused errors', () => {
      const error = new Error('ECONNREFUSED');
      expect(checker._formatError(error)).toContain('refused');
    });

    it('should format host not found errors', () => {
      const error = new Error('ENOTFOUND');
      expect(checker._formatError(error)).toContain('not found');
    });

    it('should return original message for unknown errors', () => {
      const error = new Error('Unknown error');
      expect(checker._formatError(error)).toBe('Unknown error');
    });
  });

  describe('_createProxyAgent', () => {
    it('should create SocksProxyAgent for SOCKS5', () => {
      const { SocksProxyAgent } = require('socks-proxy-agent');
      
      const config = new ProxyConfig({
        protocol: 'socks5',
        host: 'proxy.example.com',
        port: 1080,
        enabled: true
      });

      checker._createProxyAgent(config);
      
      expect(SocksProxyAgent).toHaveBeenCalled();
    });

    it('should create HttpsProxyAgent for HTTP/HTTPS', () => {
      const { HttpsProxyAgent } = require('https-proxy-agent');
      
      const config = new ProxyConfig({
        protocol: 'http',
        host: 'proxy.example.com',
        port: 8080,
        enabled: true
      });

      checker._createProxyAgent(config);
      
      expect(HttpsProxyAgent).toHaveBeenCalled();
    });
  });

  describe('Defaults', () => {
    it('should export default values', () => {
      expect(ProxyPreChecker.Defaults.CONNECTIVITY_TIMEOUT).toBe(3000);
      expect(ProxyPreChecker.Defaults.LATENCY_SAMPLES).toBe(3);
      expect(ProxyPreChecker.Defaults.IP_CHECK_TIMEOUT).toBe(5000);
    });
  });

  describe('IPEndpoints', () => {
    it('should export IP endpoints', () => {
      expect(ProxyPreChecker.IPEndpoints).toBeDefined();
      expect(Array.isArray(ProxyPreChecker.IPEndpoints)).toBe(true);
      expect(ProxyPreChecker.IPEndpoints.length).toBeGreaterThan(0);
      
      // Each endpoint should have url and parser
      ProxyPreChecker.IPEndpoints.forEach(endpoint => {
        expect(endpoint.url).toBeDefined();
        expect(typeof endpoint.parser).toBe('function');
      });
    });
  });
});
