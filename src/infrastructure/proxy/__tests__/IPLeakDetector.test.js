/**
 * IPLeakDetector Unit Tests
 * Tests IP verification and leak detection functionality
 */

'use strict';

const IPLeakDetector = require('../IPLeakDetector');
const ProxyConfig = require('../../../domain/entities/ProxyConfig');

// Mock http/https modules
jest.mock('https', () => ({
  request: jest.fn()
}));

jest.mock('http', () => ({
  request: jest.fn()
}));

// Mock proxy agents
jest.mock('socks-proxy-agent', () => ({
  SocksProxyAgent: jest.fn().mockImplementation(() => ({}))
}));

jest.mock('https-proxy-agent', () => ({
  HttpsProxyAgent: jest.fn().mockImplementation(() => ({}))
}));

describe('IPLeakDetector', () => {
  let detector;
  let mockEventBus;

  beforeEach(() => {
    mockEventBus = {
      publish: jest.fn().mockResolvedValue(undefined)
    };

    detector = new IPLeakDetector({
      eventBus: mockEventBus,
      checkTimeout: 1000
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    test('should create instance with default options', () => {
      const defaultDetector = new IPLeakDetector();
      
      expect(defaultDetector.checkTimeout).toBe(IPLeakDetector.Defaults.CHECK_TIMEOUT);
      expect(defaultDetector.minSourcesRequired).toBe(IPLeakDetector.Defaults.MIN_SOURCES_REQUIRED);
    });

    test('should create instance with custom options', () => {
      const customDetector = new IPLeakDetector({
        checkTimeout: 3000,
        minSourcesRequired: 3
      });
      
      expect(customDetector.checkTimeout).toBe(3000);
      expect(customDetector.minSourcesRequired).toBe(3);
    });
  });

  describe('verifyExitIP', () => {
    test('should return error for missing expected IP', async () => {
      const result = await detector.verifyExitIP(null);
      
      expect(result.success).toBe(false);
      expect(result.match).toBe(false);
      expect(result.error).toContain('Expected IP is required');
    });

    test('should return error for invalid expected IP type', async () => {
      const result = await detector.verifyExitIP(123);
      
      expect(result.success).toBe(false);
      expect(result.match).toBe(false);
    });
  });

  describe('Expected IP Management', () => {
    test('should set and get expected IP', () => {
      detector.setExpectedIP('account-1', '1.2.3.4');
      
      expect(detector.getExpectedIP('account-1')).toBe('1.2.3.4');
    });

    test('should return null for unknown account', () => {
      expect(detector.getExpectedIP('unknown')).toBeNull();
    });

    test('should clear expected IP', () => {
      detector.setExpectedIP('account-1', '1.2.3.4');
      detector.clearExpectedIP('account-1');
      
      expect(detector.getExpectedIP('account-1')).toBeNull();
    });

    test('should get all expected IPs', () => {
      detector.setExpectedIP('account-1', '1.2.3.4');
      detector.setExpectedIP('account-2', '5.6.7.8');
      
      const allIPs = detector.getAllExpectedIPs();
      
      expect(Object.keys(allIPs)).toHaveLength(2);
      expect(allIPs['account-1'].ip).toBe('1.2.3.4');
      expect(allIPs['account-2'].ip).toBe('5.6.7.8');
    });
  });

  describe('Detection History', () => {
    test('should get empty history initially', () => {
      const history = detector.getDetectionHistory();
      
      expect(history).toEqual([]);
    });

    test('should clear history', () => {
      // Add some history by calling internal method
      detector._recordDetection({ type: 'test', timestamp: new Date() });
      detector.clearHistory();
      
      expect(detector.getDetectionHistory()).toEqual([]);
    });

    test('should limit history size', () => {
      // Add more than max history size
      for (let i = 0; i < 150; i++) {
        detector._recordDetection({ type: 'test', index: i });
      }
      
      const history = detector.getDetectionHistory(200);
      expect(history.length).toBeLessThanOrEqual(100);
    });
  });

  describe('IP Validation', () => {
    test('should validate valid IPv4 addresses', () => {
      expect(detector._isValidIP('192.168.1.1')).toBe(true);
      expect(detector._isValidIP('10.0.0.1')).toBe(true);
      expect(detector._isValidIP('255.255.255.255')).toBe(true);
      expect(detector._isValidIP('0.0.0.0')).toBe(true);
    });

    test('should reject invalid IPv4 addresses', () => {
      expect(detector._isValidIP('256.1.1.1')).toBe(false);
      expect(detector._isValidIP('1.2.3')).toBe(false);
      expect(detector._isValidIP('1.2.3.4.5')).toBe(false);
      expect(detector._isValidIP('abc.def.ghi.jkl')).toBe(false);
    });

    test('should reject null and undefined', () => {
      expect(detector._isValidIP(null)).toBe(false);
      expect(detector._isValidIP(undefined)).toBe(false);
      expect(detector._isValidIP('')).toBe(false);
    });
  });

  describe('IP Normalization', () => {
    test('should normalize IP addresses', () => {
      expect(detector._normalizeIP('  192.168.1.1  ')).toBe('192.168.1.1');
      expect(detector._normalizeIP('192.168.1.1')).toBe('192.168.1.1');
    });

    test('should handle null/undefined', () => {
      expect(detector._normalizeIP(null)).toBe('');
      expect(detector._normalizeIP(undefined)).toBe('');
    });
  });

  describe('Constants', () => {
    test('should export LeakType constants', () => {
      expect(IPLeakDetector.LeakType.NONE).toBe('none');
      expect(IPLeakDetector.LeakType.IP_MISMATCH).toBe('ip_mismatch');
      expect(IPLeakDetector.LeakType.WEBRTC).toBe('webrtc');
      expect(IPLeakDetector.LeakType.DNS).toBe('dns');
    });

    test('should export Defaults', () => {
      expect(IPLeakDetector.Defaults.CHECK_TIMEOUT).toBe(5000);
      expect(IPLeakDetector.Defaults.VERIFICATION_INTERVAL).toBe(300000);
      expect(IPLeakDetector.Defaults.MIN_SOURCES_REQUIRED).toBe(2);
    });

    test('should export IPSources', () => {
      expect(IPLeakDetector.IPSources.PRIMARY).toBeDefined();
      expect(IPLeakDetector.IPSources.SECONDARY).toBeDefined();
      expect(IPLeakDetector.IPSources.PRIMARY.length).toBeGreaterThan(0);
    });
  });
});
