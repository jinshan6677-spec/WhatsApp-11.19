'use strict';

const ProxyHealthMonitor = require('../ProxyHealthMonitor');
const ProxyConfig = require('../../../domain/entities/ProxyConfig');
const ProxyHealthStats = require('../../../domain/entities/ProxyHealthStats');

// Mock dependencies
jest.mock('../ProxyPreChecker');
jest.mock('../IPLeakDetector');
jest.mock('../KillSwitch');

const ProxyPreChecker = require('../ProxyPreChecker');
const IPLeakDetector = require('../IPLeakDetector');
const KillSwitch = require('../KillSwitch');

describe('ProxyHealthMonitor', () => {
  let monitor;
  let mockLogger;
  let mockEventBus;
  let mockKillSwitch;
  let mockPreChecker;
  let mockIPLeakDetector;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    
    mockLogger = jest.fn();
    mockEventBus = {
      publish: jest.fn().mockResolvedValue(undefined)
    };
    
    mockKillSwitch = {
      trigger: jest.fn().mockResolvedValue(undefined),
      reset: jest.fn().mockResolvedValue(undefined)
    };
    
    mockPreChecker = {
      testConnectivity: jest.fn().mockResolvedValue({ success: true, latency: 100 })
    };
    
    mockIPLeakDetector = {
      verifyExitIP: jest.fn().mockResolvedValue({ success: true, match: true, detectedIP: '1.2.3.4' }),
      setExpectedIP: jest.fn(),
      clearExpectedIP: jest.fn()
    };

    ProxyPreChecker.mockImplementation(() => mockPreChecker);
    IPLeakDetector.mockImplementation(() => mockIPLeakDetector);
    KillSwitch.mockImplementation(() => mockKillSwitch);

    monitor = new ProxyHealthMonitor({
      logger: mockLogger,
      eventBus: mockEventBus,
      killSwitch: mockKillSwitch,
      preChecker: mockPreChecker,
      ipLeakDetector: mockIPLeakDetector,
      healthCheckInterval: 1000,
      ipVerificationInterval: 5000,
      failureThreshold: 3
    });
  });

  afterEach(() => {
    monitor.destroy();
    jest.useRealTimers();
  });


  describe('constructor', () => {
    it('should create instance with default options', () => {
      const defaultMonitor = new ProxyHealthMonitor();
      expect(defaultMonitor.healthCheckInterval).toBe(ProxyHealthMonitor.Defaults.HEALTH_CHECK_INTERVAL);
      expect(defaultMonitor.ipVerificationInterval).toBe(ProxyHealthMonitor.Defaults.IP_VERIFICATION_INTERVAL);
      expect(defaultMonitor.failureThreshold).toBe(ProxyHealthMonitor.Defaults.FAILURE_THRESHOLD);
      defaultMonitor.destroy();
    });

    it('should accept custom options', () => {
      expect(monitor.healthCheckInterval).toBe(1000);
      expect(monitor.ipVerificationInterval).toBe(5000);
      expect(monitor.failureThreshold).toBe(3);
    });

    it('should accept custom logger', () => {
      expect(monitor.log).toBe(mockLogger);
    });
  });

  describe('startMonitoring', () => {
    it('should start monitoring for an account', () => {
      const config = new ProxyConfig({
        protocol: 'socks5',
        host: 'proxy.example.com',
        port: 1080,
        enabled: true
      });

      const result = monitor.startMonitoring('account-1', config, '1.2.3.4');
      
      expect(result).toBe(true);
      expect(monitor.isMonitoring('account-1')).toBe(true);
      expect(mockIPLeakDetector.setExpectedIP).toHaveBeenCalledWith('account-1', '1.2.3.4');
    });

    it('should return false for missing accountId', () => {
      const config = new ProxyConfig({
        protocol: 'socks5',
        host: 'proxy.example.com',
        port: 1080,
        enabled: true
      });

      const result = monitor.startMonitoring(null, config);
      
      expect(result).toBe(false);
    });

    it('should return false for missing config', () => {
      const result = monitor.startMonitoring('account-1', null);
      
      expect(result).toBe(false);
    });

    it('should stop existing monitoring before starting new', () => {
      const config = new ProxyConfig({
        protocol: 'socks5',
        host: 'proxy.example.com',
        port: 1080,
        enabled: true
      });

      monitor.startMonitoring('account-1', config, '1.2.3.4');
      monitor.startMonitoring('account-1', config, '5.6.7.8');
      
      expect(monitor.getMonitoredAccounts().length).toBe(1);
    });

    it('should accept plain object config', () => {
      const result = monitor.startMonitoring('account-1', {
        protocol: 'socks5',
        host: 'proxy.example.com',
        port: 1080,
        enabled: true
      }, '1.2.3.4');
      
      expect(result).toBe(true);
    });
  });

  describe('stopMonitoring', () => {
    it('should stop monitoring for an account', () => {
      const config = new ProxyConfig({
        protocol: 'socks5',
        host: 'proxy.example.com',
        port: 1080,
        enabled: true
      });

      monitor.startMonitoring('account-1', config);
      const result = monitor.stopMonitoring('account-1');
      
      expect(result).toBe(true);
      expect(monitor.isMonitoring('account-1')).toBe(false);
      expect(mockIPLeakDetector.clearExpectedIP).toHaveBeenCalledWith('account-1');
    });

    it('should return false for non-monitored account', () => {
      const result = monitor.stopMonitoring('unknown-account');
      
      expect(result).toBe(false);
    });
  });


  describe('checkHealth', () => {
    it('should perform health check for monitored account', async () => {
      const config = new ProxyConfig({
        protocol: 'socks5',
        host: 'proxy.example.com',
        port: 1080,
        enabled: true
      });

      monitor.startMonitoring('account-1', config);
      
      const result = await monitor.checkHealth('account-1');
      
      expect(result.healthy).toBe(true);
      expect(result.latency).toBe(100);
    });

    it('should return error for non-monitored account', async () => {
      const result = await monitor.checkHealth('unknown-account');
      
      expect(result.healthy).toBe(false);
      expect(result.error).toBe('Account not being monitored');
    });

    it('should handle health check failure', async () => {
      mockPreChecker.testConnectivity.mockResolvedValue({ 
        success: false, 
        error: 'Connection timeout' 
      });

      const config = new ProxyConfig({
        protocol: 'socks5',
        host: 'proxy.example.com',
        port: 1080,
        enabled: true
      });

      monitor.startMonitoring('account-1', config);
      
      const result = await monitor.checkHealth('account-1');
      
      expect(result.healthy).toBe(false);
      expect(result.error).toBe('Connection timeout');
      expect(result.consecutiveFailures).toBe(1);
    });
  });

  describe('getStats', () => {
    it('should return stats for monitored account', () => {
      const config = new ProxyConfig({
        protocol: 'socks5',
        host: 'proxy.example.com',
        port: 1080,
        enabled: true
      });

      monitor.startMonitoring('account-1', config, '1.2.3.4');
      
      const stats = monitor.getStats('account-1');
      
      expect(stats).toBeInstanceOf(ProxyHealthStats);
      expect(stats.initialIP).toBe('1.2.3.4');
    });

    it('should return null for non-monitored account', () => {
      const stats = monitor.getStats('unknown-account');
      
      expect(stats).toBeNull();
    });
  });

  describe('getHealthStatus', () => {
    it('should return healthy status', async () => {
      const config = new ProxyConfig({
        protocol: 'socks5',
        host: 'proxy.example.com',
        port: 1080,
        enabled: true
      });

      monitor.startMonitoring('account-1', config);
      await monitor.checkHealth('account-1');
      
      const status = monitor.getHealthStatus('account-1');
      
      expect(status.status).toBe(ProxyHealthMonitor.HealthStatus.HEALTHY);
      expect(status.details.consecutiveFailures).toBe(0);
    });

    it('should return unknown for non-monitored account', () => {
      const status = monitor.getHealthStatus('unknown-account');
      
      expect(status.status).toBe(ProxyHealthMonitor.HealthStatus.UNKNOWN);
    });

    it('should return unhealthy after consecutive failures', async () => {
      mockPreChecker.testConnectivity.mockResolvedValue({ 
        success: false, 
        error: 'Connection timeout' 
      });

      const config = new ProxyConfig({
        protocol: 'socks5',
        host: 'proxy.example.com',
        port: 1080,
        enabled: true
      });

      monitor.startMonitoring('account-1', config);
      
      // Simulate 3 consecutive failures
      await monitor.checkHealth('account-1');
      await monitor.checkHealth('account-1');
      await monitor.checkHealth('account-1');
      
      const status = monitor.getHealthStatus('account-1');
      
      expect(status.status).toBe(ProxyHealthMonitor.HealthStatus.UNHEALTHY);
      expect(status.details.consecutiveFailures).toBe(3);
    });
  });


  describe('verifyIPPeriodically', () => {
    it('should verify IP matches expected', async () => {
      const config = new ProxyConfig({
        protocol: 'socks5',
        host: 'proxy.example.com',
        port: 1080,
        enabled: true
      });

      monitor.startMonitoring('account-1', config, '1.2.3.4');
      
      const result = await monitor.verifyIPPeriodically('account-1');
      
      expect(result.verified).toBe(true);
      expect(result.ip).toBe('1.2.3.4');
    });

    it('should skip verification if no initial IP', async () => {
      const config = new ProxyConfig({
        protocol: 'socks5',
        host: 'proxy.example.com',
        port: 1080,
        enabled: true
      });

      monitor.startMonitoring('account-1', config); // No initial IP
      
      const result = await monitor.verifyIPPeriodically('account-1');
      
      expect(result.verified).toBe(true);
      expect(result.skipped).toBe(true);
    });

    it('should detect IP change and trigger Kill-Switch', async () => {
      mockIPLeakDetector.verifyExitIP.mockResolvedValue({ 
        success: true, 
        match: false, 
        detectedIP: '9.9.9.9' 
      });

      const config = new ProxyConfig({
        protocol: 'socks5',
        host: 'proxy.example.com',
        port: 1080,
        enabled: true
      });

      monitor.startMonitoring('account-1', config, '1.2.3.4');
      
      const result = await monitor.verifyIPPeriodically('account-1');
      
      expect(result.verified).toBe(false);
      expect(result.error).toBe('IP mismatch detected');
      expect(mockKillSwitch.trigger).toHaveBeenCalled();
      expect(mockEventBus.publish).toHaveBeenCalledWith(
        'proxy:ip-change-detected',
        expect.objectContaining({
          accountId: 'account-1',
          expectedIP: '1.2.3.4',
          actualIP: '9.9.9.9'
        })
      );
    });
  });

  describe('Kill-Switch triggering', () => {
    it('should trigger Kill-Switch after consecutive failures', async () => {
      mockPreChecker.testConnectivity.mockResolvedValue({ 
        success: false, 
        error: 'Connection timeout' 
      });

      const config = new ProxyConfig({
        protocol: 'socks5',
        host: 'proxy.example.com',
        port: 1080,
        enabled: true
      });

      monitor.startMonitoring('account-1', config);
      
      // Simulate 3 consecutive failures
      await monitor.checkHealth('account-1');
      await monitor.checkHealth('account-1');
      await monitor.checkHealth('account-1');
      
      expect(mockKillSwitch.trigger).toHaveBeenCalledWith(
        'account-1',
        expect.stringContaining('Health check failures')
      );
      expect(mockEventBus.publish).toHaveBeenCalledWith(
        'proxy:health-failure',
        expect.objectContaining({
          accountId: 'account-1',
          consecutiveFailures: 3
        })
      );
    });
  });

  describe('Query methods', () => {
    it('should get monitored accounts', () => {
      const config = new ProxyConfig({
        protocol: 'socks5',
        host: 'proxy.example.com',
        port: 1080,
        enabled: true
      });

      monitor.startMonitoring('account-1', config);
      monitor.startMonitoring('account-2', config);
      
      const accounts = monitor.getMonitoredAccounts();
      
      expect(accounts).toContain('account-1');
      expect(accounts).toContain('account-2');
      expect(accounts.length).toBe(2);
    });

    it('should check if account is being monitored', () => {
      const config = new ProxyConfig({
        protocol: 'socks5',
        host: 'proxy.example.com',
        port: 1080,
        enabled: true
      });

      monitor.startMonitoring('account-1', config);
      
      expect(monitor.isMonitoring('account-1')).toBe(true);
      expect(monitor.isMonitoring('account-2')).toBe(false);
    });

    it('should get all stats', async () => {
      const config = new ProxyConfig({
        protocol: 'socks5',
        host: 'proxy.example.com',
        port: 1080,
        enabled: true
      });

      monitor.startMonitoring('account-1', config, '1.2.3.4');
      monitor.startMonitoring('account-2', config, '5.6.7.8');
      
      const allStats = monitor.getAllStats();
      
      expect(allStats['account-1']).toBeDefined();
      expect(allStats['account-2']).toBeDefined();
    });
  });


  describe('resetFailureCounter', () => {
    it('should reset failure counter', async () => {
      mockPreChecker.testConnectivity.mockResolvedValue({ 
        success: false, 
        error: 'Connection timeout' 
      });

      const config = new ProxyConfig({
        protocol: 'socks5',
        host: 'proxy.example.com',
        port: 1080,
        enabled: true
      });

      monitor.startMonitoring('account-1', config);
      
      // Simulate failures
      await monitor.checkHealth('account-1');
      await monitor.checkHealth('account-1');
      
      let status = monitor.getHealthStatus('account-1');
      expect(status.details.consecutiveFailures).toBe(2);
      
      // Reset counter
      monitor.resetFailureCounter('account-1');
      
      status = monitor.getHealthStatus('account-1');
      expect(status.details.consecutiveFailures).toBe(0);
    });
  });

  describe('updateInitialIP', () => {
    it('should update initial IP', () => {
      const config = new ProxyConfig({
        protocol: 'socks5',
        host: 'proxy.example.com',
        port: 1080,
        enabled: true
      });

      monitor.startMonitoring('account-1', config, '1.2.3.4');
      monitor.updateInitialIP('account-1', '9.9.9.9');
      
      const stats = monitor.getStats('account-1');
      expect(stats.initialIP).toBe('9.9.9.9');
      expect(mockIPLeakDetector.setExpectedIP).toHaveBeenCalledWith('account-1', '9.9.9.9');
    });
  });

  describe('stopAll', () => {
    it('should stop all monitoring', () => {
      const config = new ProxyConfig({
        protocol: 'socks5',
        host: 'proxy.example.com',
        port: 1080,
        enabled: true
      });

      monitor.startMonitoring('account-1', config);
      monitor.startMonitoring('account-2', config);
      
      monitor.stopAll();
      
      expect(monitor.getMonitoredAccounts().length).toBe(0);
    });
  });

  describe('destroy', () => {
    it('should clean up all resources', () => {
      const config = new ProxyConfig({
        protocol: 'socks5',
        host: 'proxy.example.com',
        port: 1080,
        enabled: true
      });

      monitor.startMonitoring('account-1', config);
      monitor.startMonitoring('account-2', config);
      
      monitor.destroy();
      
      expect(monitor.getMonitoredAccounts().length).toBe(0);
      expect(monitor.getAllStats()).toEqual({});
    });
  });

  describe('Defaults and Constants', () => {
    it('should export default values', () => {
      expect(ProxyHealthMonitor.Defaults.HEALTH_CHECK_INTERVAL).toBe(30000);
      expect(ProxyHealthMonitor.Defaults.IP_VERIFICATION_INTERVAL).toBe(300000);
      expect(ProxyHealthMonitor.Defaults.LATENCY_THRESHOLD).toBe(500);
      expect(ProxyHealthMonitor.Defaults.FAILURE_THRESHOLD).toBe(3);
    });

    it('should export health status enum', () => {
      expect(ProxyHealthMonitor.HealthStatus.HEALTHY).toBe('healthy');
      expect(ProxyHealthMonitor.HealthStatus.DEGRADED).toBe('degraded');
      expect(ProxyHealthMonitor.HealthStatus.UNHEALTHY).toBe('unhealthy');
      expect(ProxyHealthMonitor.HealthStatus.UNKNOWN).toBe('unknown');
    });
  });
});
