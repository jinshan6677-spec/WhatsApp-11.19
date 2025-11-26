/**
 * Property-Based Tests for Proxy Security Module
 * 
 * Tests the core security properties of the proxy system:
 * - Never fall back to direct connection
 * - WebRTC always disabled
 * - DNS leak prevention
 * - Kill-Switch activation
 * - IP verification
 * - Health check accuracy
 * - Reconnection mechanism
 * - View preservation
 * 
 * @module infrastructure/proxy/__tests__/ProxySecurity.property.test
 * Requirements: 12.1, 12.2, 12.3
 */

'use strict';

const fc = require('fast-check');
const ProxyConnectionManager = require('../ProxyConnectionManager');
const KillSwitch = require('../KillSwitch');
const IPProtectionInjector = require('../IPProtectionInjector');
const WebRTCBlocker = require('../WebRTCBlocker');
const DNSLeakPrevention = require('../DNSLeakPrevention');
const ProxyHealthMonitor = require('../ProxyHealthMonitor');
const ProxyReconnectionManager = require('../ProxyReconnectionManager');
const ProxyConfig = require('../../../domain/entities/ProxyConfig');
const ProxyError = require('../../../domain/errors/ProxyError');
const KillSwitchActivatedEvent = require('../../../domain/events/KillSwitchActivatedEvent');

// ==================== Test Arbitraries ====================

const validProxyConfigArbitrary = fc.record({
  id: fc.uuid(),
  enabled: fc.constant(true),
  protocol: fc.constantFrom('http', 'https', 'socks5'),
  host: fc.oneof(fc.domain(), fc.ipV4(), fc.constant('localhost')),
  port: fc.integer({ min: 1, max: 65535 }),
  username: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: null }),
  password: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: null }),
  killSwitchEnabled: fc.constant(true),
  verifyIPBeforeConnect: fc.boolean()
});

const accountIdArbitrary = fc.uuid();
const ipAddressArbitrary = fc.ipV4();
const errorMessageArbitrary = fc.string({ minLength: 1, maxLength: 200 });


const killSwitchTriggerArbitrary = fc.constantFrom(
  KillSwitchActivatedEvent.Trigger.PROXY_DISCONNECTED,
  KillSwitchActivatedEvent.Trigger.CONSECUTIVE_FAILURES,
  KillSwitchActivatedEvent.Trigger.IP_LEAK_DETECTED,
  KillSwitchActivatedEvent.Trigger.IP_MISMATCH,
  KillSwitchActivatedEvent.Trigger.HEALTH_CHECK_FAILED
);

const reconnectionDelaysArbitrary = fc.array(
  fc.integer({ min: 100, max: 10000 }),
  { minLength: 1, maxLength: 5 }
);

// ==================== Mock Factories ====================

function createMockSession() {
  return {
    setProxy: jest.fn().mockResolvedValue(undefined),
    webRequest: {
      onBeforeRequest: jest.fn(),
      onBeforeSendHeaders: jest.fn()
    }
  };
}

function createMockWebContents() {
  return {
    executeJavaScript: jest.fn().mockResolvedValue(true),
    on: jest.fn(),
    removeListener: jest.fn()
  };
}

function createMockEventBus() {
  const events = [];
  return {
    publish: jest.fn((event, payload) => {
      events.push({ event, payload });
      return Promise.resolve();
    }),
    getEvents: () => events
  };
}

function createMockSecurityManager() {
  const enforcedSessions = new Map();
  return {
    enforceProxyOnly: jest.fn().mockResolvedValue(true),
    blockDirectConnections: jest.fn().mockResolvedValue(true),
    configureProxyRules: jest.fn().mockResolvedValue({ success: true }),
    releaseEnforcement: jest.fn().mockReturnValue(true),
    isEnforced: jest.fn((sessionId) => enforcedSessions.has(sessionId)),
    _enforcedSessions: enforcedSessions,
    getEnforcedSessions: jest.fn(() => Array.from(enforcedSessions.values()))
  };
}

// ==================== Property Tests ====================

describe('Proxy Security Property Tests', () => {


  /**
   * **Feature: architecture-refactoring, Property 47: Proxy Failure Never Falls Back to Direct**
   * **Validates: Requirements 12.1**
   */
  describe('Property 47: Proxy Failure Never Falls Back to Direct', () => {
    
    test('connection failure should trigger kill-switch, not direct connection', async () => {
      await fc.assert(
        fc.asyncProperty(
          accountIdArbitrary,
          validProxyConfigArbitrary,
          errorMessageArbitrary,
          async (accountId, configData, errorMessage) => {
            const mockEventBus = createMockEventBus();
            const mockSecurityManager = createMockSecurityManager();
            const mockSession = createMockSession();
            const killSwitch = new KillSwitch({
              eventBus: mockEventBus,
              securityManager: mockSecurityManager
            });
            
            const connectionManager = new ProxyConnectionManager({
              eventBus: mockEventBus,
              securityManager: mockSecurityManager,
              killSwitch
            });
            
            // Create config with kill-switch enabled
            const config = new ProxyConfig({
              ...configData,
              killSwitchEnabled: true,
              verifyIPBeforeConnect: true
            });
            
            // First establish a successful connection to set up session info
            await connectionManager.connect(accountId, config, {
              session: mockSession,
              preCheckCallback: async () => ({ success: true }),
              ipVerifyCallback: async () => ({ success: true, ip: '1.2.3.4' })
            });
            
            // Now simulate a failure during the active session
            const error = new ProxyError(
              errorMessage || 'Connection failed', 
              ProxyError.Code.CONNECTION_FAILED
            );
            await connectionManager.handleFailure(
              accountId, 
              error, 
              ProxyConnectionManager.FailureScenario.DURING_SESSION
            );
            
            // The kill-switch should be activated (blocking network, not falling back to direct)
            const killSwitchActive = killSwitch.isActive(accountId);
            
            connectionManager.cleanup();
            killSwitch.cleanup();
            
            return killSwitchActive === true;
          }
        ),
        { numRuns: 20, timeout: 10000 }
      );
    });

    test('before-open failure should prevent view creation', async () => {
      await fc.assert(
        fc.asyncProperty(
          accountIdArbitrary,
          validProxyConfigArbitrary,
          async (accountId, configData) => {
            const mockEventBus = createMockEventBus();
            const mockSecurityManager = createMockSecurityManager();
            
            const connectionManager = new ProxyConnectionManager({
              eventBus: mockEventBus,
              securityManager: mockSecurityManager
            });
            
            // Force verifyIPBeforeConnect to true so pre-check callback is called
            const config = new ProxyConfig({
              ...configData,
              verifyIPBeforeConnect: true
            });
            
            const result = await connectionManager.connect(accountId, config, {
              preCheckCallback: async () => ({ success: false, error: 'Connection refused' })
            });
            
            connectionManager.cleanup();
            
            // Connection should fail with BEFORE_OPEN scenario
            return result.success === false && 
                   result.scenario === ProxyConnectionManager.FailureScenario.BEFORE_OPEN;
          }
        ),
        { numRuns: 20, timeout: 10000 }
      );
    });
  });


  /**
   * **Feature: architecture-refactoring, Property 48: WebRTC Always Disabled**
   * **Validates: Requirements 12.2**
   */
  describe('Property 48: WebRTC Always Disabled', () => {
    
    test('WebRTC blocking script should disable all WebRTC APIs', () => {
      fc.assert(
        fc.property(fc.constant(null), () => {
          const blocker = new WebRTCBlocker();
          const script = blocker.getBlockingScript();
          
          const blockedAPIs = [
            'RTCPeerConnection',
            'webkitRTCPeerConnection',
            'mozRTCPeerConnection',
            'RTCSessionDescription',
            'RTCIceCandidate',
            'RTCDataChannel'
          ];
          
          return blockedAPIs.every(api => script.includes(api)) &&
                 script.includes('privacy protection');
        }),
        { numRuns: 5 }
      );
    });

    test('IP protection injector should include WebRTC blocking', () => {
      fc.assert(
        fc.property(fc.constant(null), () => {
          const injector = new IPProtectionInjector();
          const script = injector.getProtectionScript();
          
          const protections = [
            'RTCPeerConnection',
            'getUserMedia',
            'navigator.connection',
            'getBattery',
            'prefetch'
          ];
          
          return protections.every(p => script.includes(p));
        }),
        { numRuns: 5 }
      );
    });

    test('injection should succeed on mock webContents', async () => {
      const mockWebContents = createMockWebContents();
      const injector = new IPProtectionInjector();
      
      const result = await injector.inject(mockWebContents);
      
      expect(mockWebContents.executeJavaScript).toHaveBeenCalled();
      expect(result).toBe(true);
    });
  });

  /**
   * **Feature: architecture-refactoring, Property 49: DNS Leak Prevention**
   * **Validates: Requirements 12.2**
   */
  describe('Property 49: DNS Leak Prevention', () => {
    
    test('DNS leak prevention script should block prefetch and DoH', () => {
      fc.assert(
        fc.property(fc.constant(null), () => {
          const prevention = new DNSLeakPrevention();
          const script = prevention.getPreventionScript();
          
          const blockedFeatures = [
            'prefetch',
            'preconnect',
            'dns-prefetch',
            'prerender',
            'sendBeacon'
          ];
          
          return blockedFeatures.every(f => script.includes(f));
        }),
        { numRuns: 5 }
      );
    });

    test('DoH endpoints should be in block list', () => {
      fc.assert(
        fc.property(fc.constant(null), () => {
          const prevention = new DNSLeakPrevention();
          const config = prevention.getConfig();
          
          const expectedEndpoints = ['dns.google', 'cloudflare-dns.com', 'dns.quad9.net'];
          const blockList = config.blockDoHEndpoints.join(' ');
          
          return expectedEndpoints.every(ep => blockList.includes(ep));
        }),
        { numRuns: 5 }
      );
    });
  });


  /**
   * **Feature: architecture-refactoring, Property 50: Kill-Switch Activation on Proxy Loss**
   * **Validates: Requirements 12.1**
   */
  describe('Property 50: Kill-Switch Activation on Proxy Loss', () => {
    
    test('kill-switch should activate on any trigger reason', async () => {
      await fc.assert(
        fc.asyncProperty(
          accountIdArbitrary,
          killSwitchTriggerArbitrary,
          async (accountId, trigger) => {
            const mockEventBus = createMockEventBus();
            const killSwitch = new KillSwitch({ eventBus: mockEventBus });
            
            killSwitch.enable(accountId, { proxyId: 'test-proxy' });
            await killSwitch.trigger(accountId, trigger, { message: 'Test trigger' });
            
            const isActive = killSwitch.isActive(accountId);
            const state = killSwitch.getState(accountId);
            
            killSwitch.cleanup();
            
            return isActive === true && 
                   state.state === KillSwitch.State.ACTIVE &&
                   state.trigger === trigger;
          }
        ),
        { numRuns: 20, timeout: 10000 }
      );
    });

    test('kill-switch should emit activation event', async () => {
      await fc.assert(
        fc.asyncProperty(
          accountIdArbitrary,
          killSwitchTriggerArbitrary,
          async (accountId, trigger) => {
            const mockEventBus = createMockEventBus();
            const killSwitch = new KillSwitch({ eventBus: mockEventBus });
            
            killSwitch.enable(accountId);
            await killSwitch.trigger(accountId, trigger, {});
            
            const events = mockEventBus.getEvents();
            const activationEvent = events.find(
              e => e.event === KillSwitchActivatedEvent.EVENT_NAME
            );
            
            killSwitch.cleanup();
            
            return activationEvent !== undefined &&
                   activationEvent.payload.accountId === accountId;
          }
        ),
        { numRuns: 20, timeout: 10000 }
      );
    });

    test('kill-switch should require user confirmation to reset', async () => {
      await fc.assert(
        fc.asyncProperty(accountIdArbitrary, async (accountId) => {
          const mockEventBus = createMockEventBus();
          const killSwitch = new KillSwitch({ eventBus: mockEventBus });
          
          killSwitch.enable(accountId);
          await killSwitch.trigger(accountId, 'proxy_disconnected', {});
          
          const resetWithoutConfirm = await killSwitch.reset(accountId, false);
          await killSwitch.reset(accountId, true);
          const afterConfirm = killSwitch.isActive(accountId);
          
          killSwitch.cleanup();
          
          return resetWithoutConfirm === false && afterConfirm === false;
        }),
        { numRuns: 20, timeout: 10000 }
      );
    });
  });


  /**
   * **Feature: architecture-refactoring, Property 51: IP Verification Before Connection**
   * **Validates: Requirements 12.2**
   */
  describe('Property 51: IP Verification Before Connection', () => {
    
    test('connection should fail if IP verification fails', async () => {
      await fc.assert(
        fc.asyncProperty(
          accountIdArbitrary,
          validProxyConfigArbitrary,
          async (accountId, configData) => {
            const mockEventBus = createMockEventBus();
            const mockSecurityManager = createMockSecurityManager();
            
            const connectionManager = new ProxyConnectionManager({
              eventBus: mockEventBus,
              securityManager: mockSecurityManager
            });
            
            const config = new ProxyConfig({ ...configData, verifyIPBeforeConnect: true });
            
            const result = await connectionManager.connect(accountId, config, {
              preCheckCallback: async () => ({ success: true }),
              ipVerifyCallback: async () => ({ success: false, error: 'IP verification failed' })
            });
            
            connectionManager.cleanup();
            
            return result.success === false;
          }
        ),
        { numRuns: 20, timeout: 10000 }
      );
    });

    test('connection should succeed if IP verification passes', async () => {
      await fc.assert(
        fc.asyncProperty(
          accountIdArbitrary,
          validProxyConfigArbitrary,
          ipAddressArbitrary,
          async (accountId, configData, exitIP) => {
            const mockEventBus = createMockEventBus();
            const mockSecurityManager = createMockSecurityManager();
            const mockSession = createMockSession();
            
            const connectionManager = new ProxyConnectionManager({
              eventBus: mockEventBus,
              securityManager: mockSecurityManager
            });
            
            const config = new ProxyConfig({ ...configData, verifyIPBeforeConnect: true });
            
            const result = await connectionManager.connect(accountId, config, {
              session: mockSession,
              preCheckCallback: async () => ({ success: true }),
              ipVerifyCallback: async () => ({ success: true, ip: exitIP })
            });
            
            connectionManager.cleanup();
            
            return result.success === true && result.exitIP === exitIP;
          }
        ),
        { numRuns: 20, timeout: 10000 }
      );
    });
  });

  /**
   * **Feature: architecture-refactoring, Property 52: Proxy Health Check Accuracy**
   * **Validates: Requirements 12.3**
   */
  describe('Property 52: Proxy Health Check Accuracy', () => {
    
    test('health status should be healthy or unknown initially', () => {
      fc.assert(
        fc.property(
          accountIdArbitrary,
          validProxyConfigArbitrary,
          (accountId, configData) => {
            const monitor = new ProxyHealthMonitor();
            
            const config = new ProxyConfig(configData);
            monitor.startMonitoring(accountId, config, '1.2.3.4');
            
            const status = monitor.getHealthStatus(accountId);
            
            monitor.destroy();
            
            return status.status === ProxyHealthMonitor.HealthStatus.HEALTHY ||
                   status.status === ProxyHealthMonitor.HealthStatus.UNKNOWN;
          }
        ),
        { numRuns: 20 }
      );
    });

    test('monitoring should track stats correctly', () => {
      fc.assert(
        fc.property(
          accountIdArbitrary,
          validProxyConfigArbitrary,
          ipAddressArbitrary,
          (accountId, configData, initialIP) => {
            const monitor = new ProxyHealthMonitor();
            
            const config = new ProxyConfig(configData);
            monitor.startMonitoring(accountId, config, initialIP);
            
            const stats = monitor.getStats(accountId);
            const isMonitoring = monitor.isMonitoring(accountId);
            
            monitor.destroy();
            
            return isMonitoring === true && 
                   stats !== null &&
                   stats.accountId === accountId;
          }
        ),
        { numRuns: 20 }
      );
    });
  });


  /**
   * **Feature: architecture-refactoring, Property 53: Consecutive Failure Detection**
   * **Validates: Requirements 12.3**
   */
  describe('Property 53: Consecutive Failure Detection', () => {
    
    test('kill-switch should trigger after threshold failures', async () => {
      await fc.assert(
        fc.asyncProperty(
          accountIdArbitrary,
          fc.integer({ min: 1, max: 5 }),
          async (accountId, threshold) => {
            const mockEventBus = createMockEventBus();
            const killSwitch = new KillSwitch({ eventBus: mockEventBus });
            
            killSwitch.enable(accountId, { proxyId: 'test-proxy' });
            
            await killSwitch.trigger(
              accountId, 
              KillSwitchActivatedEvent.Trigger.CONSECUTIVE_FAILURES,
              { failureCount: threshold, threshold }
            );
            
            const isActive = killSwitch.isActive(accountId);
            const state = killSwitch.getState(accountId);
            
            killSwitch.cleanup();
            
            return isActive === true &&
                   state.trigger === KillSwitchActivatedEvent.Trigger.CONSECUTIVE_FAILURES;
          }
        ),
        { numRuns: 20, timeout: 10000 }
      );
    });

    test('failure counter should reset on success', () => {
      fc.assert(
        fc.property(
          accountIdArbitrary,
          validProxyConfigArbitrary,
          (accountId, configData) => {
            const monitor = new ProxyHealthMonitor();
            
            const config = new ProxyConfig(configData);
            monitor.startMonitoring(accountId, config, '1.2.3.4');
            monitor.resetFailureCounter(accountId);
            
            const status = monitor.getHealthStatus(accountId);
            
            monitor.destroy();
            
            return status.details.consecutiveFailures === 0;
          }
        ),
        { numRuns: 20 }
      );
    });
  });

  /**
   * **Feature: architecture-refactoring, Property 54: Reconnection Mechanism**
   * **Validates: Requirements 12.1**
   */
  describe('Property 54: Reconnection Mechanism', () => {
    
    test('reconnection should use configured delays', () => {
      fc.assert(
        fc.property(reconnectionDelaysArbitrary, (delays) => {
          const manager = new ProxyReconnectionManager({ delays });
          const storedDelays = manager.delays;
          manager.cleanup();
          
          return JSON.stringify(storedDelays) === JSON.stringify(delays);
        }),
        { numRuns: 20 }
      );
    });

    test('default delays should be 2s, 3s, 5s', () => {
      const expectedDelays = [2000, 3000, 5000];
      expect(ProxyReconnectionManager.DEFAULT_DELAYS).toEqual(expectedDelays);
    });

    test('reconnection state should track attempts correctly', async () => {
      await fc.assert(
        fc.asyncProperty(
          accountIdArbitrary,
          validProxyConfigArbitrary,
          async (accountId, configData) => {
            const mockEventBus = createMockEventBus();
            const manager = new ProxyReconnectionManager({
              eventBus: mockEventBus,
              delays: [10, 20, 30] // Very short delays for testing
            });
            
            manager.setReconnectCallback(async () => false);
            
            const config = new ProxyConfig(configData);
            await manager.startAutoReconnect(accountId, config);
            
            const status = manager.getReconnectionStatus(accountId);
            
            manager.stopAutoReconnect(accountId);
            manager.cleanup();
            
            return status !== null && 
                   status.accountId === accountId &&
                   status.attempt >= 1;
          }
        ),
        { numRuns: 10, timeout: 10000 }
      );
    });
  });


  /**
   * **Feature: architecture-refactoring, Property 55: View Preservation During Failure**
   * **Validates: Requirements 12.1**
   */
  describe('Property 55: View Preservation During Failure', () => {
    
    test('during-session failure should emit session_failure event', async () => {
      await fc.assert(
        fc.asyncProperty(
          accountIdArbitrary,
          validProxyConfigArbitrary,
          errorMessageArbitrary,
          async (accountId, configData, errorMessage) => {
            const mockEventBus = createMockEventBus();
            const mockSecurityManager = createMockSecurityManager();
            const killSwitch = new KillSwitch({
              eventBus: mockEventBus,
              securityManager: mockSecurityManager
            });
            
            const connectionManager = new ProxyConnectionManager({
              eventBus: mockEventBus,
              securityManager: mockSecurityManager,
              killSwitch
            });
            
            killSwitch.enable(accountId, { proxyId: configData.id });
            
            const error = new ProxyError(errorMessage, ProxyError.Code.CONNECTION_FAILED);
            await connectionManager.handleFailure(
              accountId,
              error,
              ProxyConnectionManager.FailureScenario.DURING_SESSION
            );
            
            const events = mockEventBus.getEvents();
            const sessionFailureEvent = events.find(e => e.event === 'proxy:session_failure');
            
            connectionManager.cleanup();
            killSwitch.cleanup();
            
            return sessionFailureEvent !== undefined &&
                   sessionFailureEvent.payload.killSwitchActive === true &&
                   sessionFailureEvent.payload.reconnecting === true;
          }
        ),
        { numRuns: 20, timeout: 10000 }
      );
    });

    test('kill-switch activation should preserve session state', async () => {
      await fc.assert(
        fc.asyncProperty(accountIdArbitrary, async (accountId) => {
          const mockEventBus = createMockEventBus();
          const killSwitch = new KillSwitch({ eventBus: mockEventBus });
          
          killSwitch.enable(accountId, { proxyId: 'test-proxy' });
          await killSwitch.trigger(accountId, 'proxy_disconnected', {});
          
          const isActive = killSwitch.isActive(accountId);
          const isEnabled = killSwitch.isEnabled(accountId);
          const state = killSwitch.getState(accountId);
          
          killSwitch.cleanup();
          
          return isActive === true && isEnabled === true && state !== null;
        }),
        { numRuns: 20, timeout: 10000 }
      );
    });
  });

  /**
   * **Feature: architecture-refactoring, Property 56: Connection Blocking Before View Creation**
   * **Validates: Requirements 12.1**
   */
  describe('Property 56: Connection Blocking Before View Creation', () => {
    
    test('pre-check failure should emit connection_blocked event', async () => {
      await fc.assert(
        fc.asyncProperty(
          accountIdArbitrary,
          validProxyConfigArbitrary,
          async (accountId, configData) => {
            const mockEventBus = createMockEventBus();
            const mockSecurityManager = createMockSecurityManager();
            
            const connectionManager = new ProxyConnectionManager({
              eventBus: mockEventBus,
              securityManager: mockSecurityManager
            });
            
            // Force verifyIPBeforeConnect to true so pre-check callback is called
            const config = new ProxyConfig({
              ...configData,
              verifyIPBeforeConnect: true
            });
            
            await connectionManager.connect(accountId, config, {
              preCheckCallback: async () => ({ success: false, error: 'Connection refused' })
            });
            
            const events = mockEventBus.getEvents();
            const blockedEvent = events.find(e => e.event === 'proxy:connection_blocked');
            
            connectionManager.cleanup();
            
            return blockedEvent !== undefined &&
                   blockedEvent.payload.accountId === accountId &&
                   blockedEvent.payload.scenario === ProxyConnectionManager.FailureScenario.BEFORE_OPEN;
          }
        ),
        { numRuns: 20, timeout: 10000 }
      );
    });

    test('invalid config should prevent connection', async () => {
      await fc.assert(
        fc.asyncProperty(accountIdArbitrary, async (accountId) => {
          const mockEventBus = createMockEventBus();
          
          const connectionManager = new ProxyConnectionManager({
            eventBus: mockEventBus
          });
          
          const invalidConfig = new ProxyConfig({
            protocol: 'socks5',
            host: '',
            port: 1080,
            enabled: true
          });
          
          const result = await connectionManager.connect(accountId, invalidConfig);
          
          connectionManager.cleanup();
          
          return result.success === false && result.error !== undefined;
        }),
        { numRuns: 20, timeout: 10000 }
      );
    });

    test('disabled proxy should prevent connection', async () => {
      await fc.assert(
        fc.asyncProperty(
          accountIdArbitrary,
          validProxyConfigArbitrary,
          async (accountId, configData) => {
            const mockEventBus = createMockEventBus();
            
            const connectionManager = new ProxyConnectionManager({
              eventBus: mockEventBus
            });
            
            const disabledConfig = new ProxyConfig({ ...configData, enabled: false });
            
            const result = await connectionManager.connect(accountId, disabledConfig);
            
            connectionManager.cleanup();
            
            return result.success === false;
          }
        ),
        { numRuns: 20, timeout: 10000 }
      );
    });
  });
});
