#!/usr/bin/env node
/**
 * Proxy Functionality Verification Script
 * 
 * This script verifies the completeness of the proxy security infrastructure
 * as required by task 27.8 and Requirements 12.1, 12.2, 12.3.
 * 
 * Tests:
 * 1. Proxy configuration save and load
 * 2. Proxy connection and disconnection
 * 3. Proxy pre-check and IP verification
 * 4. WebRTC blocking (IP protection)
 * 5. Kill-Switch trigger and reconnection
 * 6. Proxy error handling (no fallback to direct)
 * 
 * @module scripts/verify-proxy-functionality
 */

'use strict';

const path = require('path');

// Test results tracking
const results = {
  passed: 0,
  failed: 0,
  tests: []
};

function logTest(name, passed, details = '') {
  const status = passed ? '✓ PASS' : '✗ FAIL';
  const color = passed ? '\x1b[32m' : '\x1b[31m';
  console.log(`${color}${status}\x1b[0m ${name}${details ? ` - ${details}` : ''}`);
  
  results.tests.push({ name, passed, details });
  if (passed) {
    results.passed++;
  } else {
    results.failed++;
  }
}

function logSection(title) {
  console.log(`\n\x1b[36m=== ${title} ===\x1b[0m\n`);
}

// ==================== Test 1: Proxy Configuration ====================

async function testProxyConfiguration() {
  logSection('1. Proxy Configuration Save/Load');
  
  try {
    const ProxyConfig = require('../src/domain/entities/ProxyConfig');
    const ProxyRepository = require('../src/infrastructure/repositories/ProxyRepository');
    
    // Test ProxyConfig creation
    const config = new ProxyConfig({
      id: 'test-proxy-1',
      enabled: true,
      protocol: 'socks5',
      host: '127.0.0.1',
      port: 1080,
      username: 'testuser',
      password: 'testpass',
      killSwitchEnabled: true,
      verifyIPBeforeConnect: true
    });
    
    logTest('ProxyConfig creation', config !== null);
    logTest('ProxyConfig has required fields', 
      config.host === '127.0.0.1' && 
      config.port === 1080 && 
      config.protocol === 'socks5'
    );
    
    // Test validation
    const validation = config.validate();
    logTest('ProxyConfig validation passes for valid config', validation.valid);
    
    // Test invalid config
    const invalidConfig = new ProxyConfig({
      protocol: 'socks5',
      host: '', // Invalid - empty host
      port: 1080,
      enabled: true
    });
    const invalidValidation = invalidConfig.validate();
    logTest('ProxyConfig validation fails for invalid config', !invalidValidation.valid);
    
    // Test serialization round-trip
    const json = config.toJSON();
    const restored = ProxyConfig.fromJSON(json);
    logTest('ProxyConfig serialization round-trip', 
      restored.host === config.host && 
      restored.port === config.port &&
      restored.protocol === config.protocol
    );
    
    // Test ProxyRepository
    const repo = new ProxyRepository();
    await repo.save(config);
    const loaded = await repo.findById('test-proxy-1');
    logTest('ProxyRepository save and load', loaded !== null && loaded.host === '127.0.0.1');
    
    // Test security fields
    logTest('ProxyConfig has killSwitchEnabled field', config.killSwitchEnabled === true);
    logTest('ProxyConfig has verifyIPBeforeConnect field', config.verifyIPBeforeConnect === true);
    
    // Cleanup
    await repo.delete('test-proxy-1');
    
  } catch (error) {
    logTest('Proxy configuration tests', false, error.message);
  }
}

// ==================== Test 2: Proxy Connection/Disconnection ====================

async function testProxyConnection() {
  logSection('2. Proxy Connection and Disconnection');
  
  try {
    const ProxyConnectionManager = require('../src/infrastructure/proxy/ProxyConnectionManager');
    const ProxyConfig = require('../src/domain/entities/ProxyConfig');
    const KillSwitch = require('../src/infrastructure/proxy/KillSwitch');
    
    // Create mock event bus
    const mockEventBus = {
      events: [],
      publish: async function(event, payload) {
        this.events.push({ event, payload });
      }
    };
    
    // Create mock security manager
    const mockSecurityManager = {
      enforceProxyOnly: async () => true,
      configureProxyRules: async () => ({ success: true }),
      releaseEnforcement: () => true,
      blockDirectConnections: async () => true,
      _enforcedSessions: new Map()
    };
    
    const killSwitch = new KillSwitch({ eventBus: mockEventBus });
    
    const connectionManager = new ProxyConnectionManager({
      eventBus: mockEventBus,
      securityManager: mockSecurityManager,
      killSwitch
    });
    
    logTest('ProxyConnectionManager creation', connectionManager !== null);
    
    // Test connection with successful pre-check
    const config = new ProxyConfig({
      id: 'test-proxy-conn',
      enabled: true,
      protocol: 'socks5',
      host: '127.0.0.1',
      port: 1080,
      verifyIPBeforeConnect: true,
      killSwitchEnabled: true
    });
    
    const result = await connectionManager.connect('test-account', config, {
      preCheckCallback: async () => ({ success: true }),
      ipVerifyCallback: async () => ({ success: true, ip: '1.2.3.4' })
    });
    
    logTest('Connection succeeds with valid pre-check', result.success === true);
    logTest('Connection returns exit IP', result.exitIP === '1.2.3.4');
    
    // Test disconnection
    const disconnectResult = await connectionManager.disconnect('test-account');
    logTest('Disconnection succeeds', disconnectResult === true);
    
    // Cleanup
    connectionManager.cleanup();
    killSwitch.cleanup();
    
  } catch (error) {
    logTest('Proxy connection tests', false, error.message);
  }
}

// ==================== Test 3: Pre-check and IP Verification ====================

async function testPreCheckAndIPVerification() {
  logSection('3. Proxy Pre-check and IP Verification');
  
  try {
    const ProxyPreChecker = require('../src/infrastructure/proxy/ProxyPreChecker');
    const IPLeakDetector = require('../src/infrastructure/proxy/IPLeakDetector');
    const ProxyConfig = require('../src/domain/entities/ProxyConfig');
    
    const preChecker = new ProxyPreChecker();
    const ipLeakDetector = new IPLeakDetector();
    
    logTest('ProxyPreChecker creation', preChecker !== null);
    logTest('IPLeakDetector creation', ipLeakDetector !== null);
    
    // Test pre-checker methods exist
    logTest('PreChecker has testConnectivity method', typeof preChecker.testConnectivity === 'function');
    logTest('PreChecker has measureLatency method', typeof preChecker.measureLatency === 'function');
    logTest('PreChecker has getExitIP method', typeof preChecker.getExitIP === 'function');
    logTest('PreChecker has performFullCheck method', typeof preChecker.performFullCheck === 'function');
    
    // Test IP leak detector methods exist
    logTest('IPLeakDetector has verifyExitIP method', typeof ipLeakDetector.verifyExitIP === 'function');
    logTest('IPLeakDetector has detectLeak method', typeof ipLeakDetector.detectLeak === 'function');
    
    // Test connection failure blocks view creation
    const ProxyConnectionManager = require('../src/infrastructure/proxy/ProxyConnectionManager');
    const mockEventBus = { events: [], publish: async (e, p) => { mockEventBus.events.push({ e, p }); } };
    
    const connectionManager = new ProxyConnectionManager({ eventBus: mockEventBus });
    
    const config = new ProxyConfig({
      enabled: true,
      protocol: 'socks5',
      host: '127.0.0.1',
      port: 1080,
      verifyIPBeforeConnect: true
    });
    
    // Test pre-check failure blocks connection
    const failResult = await connectionManager.connect('test-account-fail', config, {
      preCheckCallback: async () => ({ success: false, error: 'Connection refused' })
    });
    
    logTest('Pre-check failure blocks connection', failResult.success === false);
    logTest('Pre-check failure returns BEFORE_OPEN scenario', 
      failResult.scenario === ProxyConnectionManager.FailureScenario.BEFORE_OPEN
    );
    
    // Test IP verification failure blocks connection
    const ipFailResult = await connectionManager.connect('test-account-ip-fail', config, {
      preCheckCallback: async () => ({ success: true }),
      ipVerifyCallback: async () => ({ success: false, error: 'IP verification failed' })
    });
    
    logTest('IP verification failure blocks connection', ipFailResult.success === false);
    
    connectionManager.cleanup();
    
  } catch (error) {
    logTest('Pre-check and IP verification tests', false, error.message);
  }
}

// ==================== Test 4: WebRTC Blocking ====================

async function testWebRTCBlocking() {
  logSection('4. WebRTC Blocking (IP Protection)');
  
  try {
    const IPProtectionInjector = require('../src/infrastructure/proxy/IPProtectionInjector');
    const WebRTCBlocker = require('../src/infrastructure/proxy/WebRTCBlocker');
    const DNSLeakPrevention = require('../src/infrastructure/proxy/DNSLeakPrevention');
    
    const ipProtection = new IPProtectionInjector();
    const webrtcBlocker = new WebRTCBlocker();
    const dnsLeakPrevention = new DNSLeakPrevention();
    
    logTest('IPProtectionInjector creation', ipProtection !== null);
    logTest('WebRTCBlocker creation', webrtcBlocker !== null);
    logTest('DNSLeakPrevention creation', dnsLeakPrevention !== null);
    
    // Test IP protection script contains WebRTC blocking
    const protectionScript = ipProtection.getProtectionScript();
    logTest('IP protection script blocks RTCPeerConnection', protectionScript.includes('RTCPeerConnection'));
    logTest('IP protection script blocks getUserMedia', protectionScript.includes('getUserMedia'));
    logTest('IP protection script blocks navigator.connection', protectionScript.includes('navigator.connection'));
    logTest('IP protection script blocks getBattery', protectionScript.includes('getBattery'));
    
    // Test WebRTC blocker script
    const webrtcScript = webrtcBlocker.getBlockingScript();
    logTest('WebRTC blocker script exists', webrtcScript.length > 0);
    logTest('WebRTC blocker blocks RTCPeerConnection', webrtcScript.includes('RTCPeerConnection'));
    logTest('WebRTC blocker blocks RTCSessionDescription', webrtcScript.includes('RTCSessionDescription'));
    logTest('WebRTC blocker blocks RTCIceCandidate', webrtcScript.includes('RTCIceCandidate'));
    
    // Test DNS leak prevention
    const dnsScript = dnsLeakPrevention.getPreventionScript();
    logTest('DNS leak prevention script exists', dnsScript.length > 0);
    logTest('DNS leak prevention blocks prefetch', dnsScript.includes('prefetch'));
    logTest('DNS leak prevention blocks preconnect', dnsScript.includes('preconnect'));
    
    // Test DoH blocking configuration
    const dnsConfig = dnsLeakPrevention.getConfig();
    logTest('DNS config has DoH endpoints to block', 
      dnsConfig.blockDoHEndpoints && dnsConfig.blockDoHEndpoints.length > 0
    );
    
  } catch (error) {
    logTest('WebRTC blocking tests', false, error.message);
  }
}

// ==================== Test 5: Kill-Switch ====================

async function testKillSwitch() {
  logSection('5. Kill-Switch Trigger and Reconnection');
  
  try {
    const KillSwitch = require('../src/infrastructure/proxy/KillSwitch');
    const ProxyReconnectionManager = require('../src/infrastructure/proxy/ProxyReconnectionManager');
    const KillSwitchActivatedEvent = require('../src/domain/events/KillSwitchActivatedEvent');
    
    const mockEventBus = {
      events: [],
      publish: async function(event, payload) {
        this.events.push({ event, payload });
      }
    };
    
    const killSwitch = new KillSwitch({ eventBus: mockEventBus });
    const reconnectionManager = new ProxyReconnectionManager({ 
      eventBus: mockEventBus,
      delays: [100, 200, 300] // Short delays for testing
    });
    
    logTest('KillSwitch creation', killSwitch !== null);
    logTest('ProxyReconnectionManager creation', reconnectionManager !== null);
    
    // Test kill-switch enable
    const enableResult = killSwitch.enable('test-account-ks', { proxyId: 'test-proxy' });
    logTest('Kill-switch enable succeeds', enableResult === true);
    logTest('Kill-switch is enabled', killSwitch.isEnabled('test-account-ks'));
    
    // Test kill-switch trigger
    await killSwitch.trigger('test-account-ks', KillSwitchActivatedEvent.Trigger.PROXY_DISCONNECTED, {
      message: 'Test trigger'
    });
    logTest('Kill-switch is active after trigger', killSwitch.isActive('test-account-ks'));
    
    // Test kill-switch state
    const state = killSwitch.getState('test-account-ks');
    logTest('Kill-switch state has correct trigger', 
      state.trigger === KillSwitchActivatedEvent.Trigger.PROXY_DISCONNECTED
    );
    
    // Test kill-switch requires confirmation to reset
    const resetWithoutConfirm = await killSwitch.reset('test-account-ks', false);
    logTest('Kill-switch reset without confirmation fails', resetWithoutConfirm === false);
    
    // Test kill-switch reset with confirmation
    const resetWithConfirm = await killSwitch.reset('test-account-ks', true);
    logTest('Kill-switch reset with confirmation succeeds', resetWithConfirm === true);
    logTest('Kill-switch is inactive after reset', !killSwitch.isActive('test-account-ks'));
    
    // Test reconnection manager delays
    logTest('Reconnection manager has correct delays', 
      JSON.stringify(reconnectionManager.delays) === JSON.stringify([100, 200, 300])
    );
    
    // Test default delays
    logTest('Default reconnection delays are 2s, 3s, 5s',
      JSON.stringify(ProxyReconnectionManager.DEFAULT_DELAYS) === JSON.stringify([2000, 3000, 5000])
    );
    
    // Cleanup
    killSwitch.cleanup();
    reconnectionManager.cleanup();
    
  } catch (error) {
    logTest('Kill-switch tests', false, error.message);
  }
}

// ==================== Test 6: No Fallback to Direct ====================

async function testNoFallbackToDirect() {
  logSection('6. Proxy Error Handling (No Fallback to Direct)');
  
  try {
    const ProxyConnectionManager = require('../src/infrastructure/proxy/ProxyConnectionManager');
    const ProxySecurityManager = require('../src/infrastructure/proxy/ProxySecurityManager');
    const KillSwitch = require('../src/infrastructure/proxy/KillSwitch');
    const ProxyConfig = require('../src/domain/entities/ProxyConfig');
    const ProxyError = require('../src/domain/errors/ProxyError');
    
    const mockEventBus = {
      events: [],
      publish: async function(event, payload) {
        this.events.push({ event, payload });
      }
    };
    
    // Create mock session
    const mockSession = {
      setProxy: async () => {},
      webRequest: {
        onBeforeRequest: () => {},
        onBeforeSendHeaders: () => {}
      }
    };
    
    const securityManager = new ProxySecurityManager({ eventBus: mockEventBus });
    const killSwitch = new KillSwitch({ eventBus: mockEventBus, securityManager });
    
    const connectionManager = new ProxyConnectionManager({
      eventBus: mockEventBus,
      securityManager,
      killSwitch
    });
    
    // Test that failure triggers kill-switch, not direct connection
    const config = new ProxyConfig({
      id: 'test-proxy-no-fallback',
      enabled: true,
      protocol: 'socks5',
      host: '127.0.0.1',
      port: 1080,
      killSwitchEnabled: true,
      verifyIPBeforeConnect: true
    });
    
    // First establish a connection
    await connectionManager.connect('test-account-nf', config, {
      session: mockSession,
      preCheckCallback: async () => ({ success: true }),
      ipVerifyCallback: async () => ({ success: true, ip: '1.2.3.4' })
    });
    
    // Now simulate a failure during session
    const error = new ProxyError('Connection lost', ProxyError.Code.CONNECTION_FAILED);
    await connectionManager.handleFailure(
      'test-account-nf',
      error,
      ProxyConnectionManager.FailureScenario.DURING_SESSION
    );
    
    // Verify kill-switch was triggered
    logTest('Kill-switch activated on failure', killSwitch.isActive('test-account-nf'));
    
    // Verify session_failure event was emitted (not direct connection)
    const sessionFailureEvent = mockEventBus.events.find(e => e.event === 'proxy:session_failure');
    logTest('Session failure event emitted', sessionFailureEvent !== undefined);
    logTest('Session failure indicates kill-switch active', 
      sessionFailureEvent?.payload?.killSwitchActive === true
    );
    logTest('Session failure indicates reconnecting', 
      sessionFailureEvent?.payload?.reconnecting === true
    );
    
    // Verify no direct connection event
    const directConnEvent = mockEventBus.events.find(e => 
      e.event === 'proxy:direct_connection' || 
      e.event === 'proxy:fallback_to_direct'
    );
    logTest('No fallback to direct connection event', directConnEvent === undefined);
    
    // Test ProxySecurityManager blocks direct connections
    await securityManager.enforceProxyOnly(mockSession, 'test-session');
    logTest('Security manager enforces proxy-only mode', securityManager.isEnforced('test-session'));
    
    // Cleanup
    connectionManager.cleanup();
    killSwitch.cleanup();
    securityManager.cleanup();
    
  } catch (error) {
    logTest('No fallback to direct tests', false, error.message);
  }
}

// ==================== Test 7: ProxyService Integration ====================

async function testProxyServiceIntegration() {
  logSection('7. ProxyService Integration');
  
  try {
    const ProxyService = require('../src/application/services/ProxyService');
    const ProxyConfig = require('../src/domain/entities/ProxyConfig');
    
    const mockEventBus = {
      events: [],
      publish: async function(event, payload) {
        this.events.push({ event, payload });
      }
    };
    
    const proxyService = new ProxyService({ eventBus: mockEventBus });
    
    logTest('ProxyService creation', proxyService !== null);
    
    // Test validateConfig
    const validConfig = new ProxyConfig({
      enabled: true,
      protocol: 'socks5',
      host: '127.0.0.1',
      port: 1080
    });
    const validResult = proxyService.validateConfig(validConfig);
    logTest('ProxyService validates valid config', validResult.valid === true);
    
    // Test invalid config validation
    const invalidConfig = new ProxyConfig({
      enabled: true,
      protocol: 'socks5',
      host: '',
      port: 1080
    });
    const invalidResult = proxyService.validateConfig(invalidConfig);
    logTest('ProxyService rejects invalid config', invalidResult.valid === false);
    
    // Test parseProxyString
    const parseResult1 = proxyService.parseProxyString('socks5://127.0.0.1:1080');
    logTest('ProxyService parses socks5://host:port', 
      parseResult1.success && 
      parseResult1.config.host === '127.0.0.1' &&
      parseResult1.config.port === 1080
    );
    
    const parseResult2 = proxyService.parseProxyString('http://user:pass@proxy.example.com:8080');
    logTest('ProxyService parses http://user:pass@host:port',
      parseResult2.success &&
      parseResult2.config.username === 'user' &&
      parseResult2.config.password === 'pass'
    );
    
    const parseResult3 = proxyService.parseProxyString('192.168.1.1:3128');
    logTest('ProxyService parses simple host:port',
      parseResult3.success &&
      parseResult3.config.host === '192.168.1.1' &&
      parseResult3.config.port === 3128
    );
    
    // Test getIPProtectionScript
    const ipScript = proxyService.getIPProtectionScript();
    logTest('ProxyService provides IP protection script', ipScript.length > 0);
    
    // Cleanup
    proxyService.destroy();
    
  } catch (error) {
    logTest('ProxyService integration tests', false, error.message);
  }
}

// ==================== Test 8: Property Tests Exist ====================

async function testPropertyTestsExist() {
  logSection('8. Property-Based Tests Verification');
  
  try {
    const fs = require('fs');
    const propertyTestPath = path.join(__dirname, '../src/infrastructure/proxy/__tests__/ProxySecurity.property.test.js');
    
    const exists = fs.existsSync(propertyTestPath);
    logTest('ProxySecurity.property.test.js exists', exists);
    
    if (exists) {
      const content = fs.readFileSync(propertyTestPath, 'utf8');
      
      // Check for required properties
      logTest('Property 47: Proxy Failure Never Falls Back to Direct', 
        content.includes('Property 47'));
      logTest('Property 48: WebRTC Always Disabled', 
        content.includes('Property 48'));
      logTest('Property 49: DNS Leak Prevention', 
        content.includes('Property 49'));
      logTest('Property 50: Kill-Switch Activation on Proxy Loss', 
        content.includes('Property 50'));
      logTest('Property 51: IP Verification Before Connection', 
        content.includes('Property 51'));
      logTest('Property 52: Proxy Health Check Accuracy', 
        content.includes('Property 52'));
      logTest('Property 53: Consecutive Failure Detection', 
        content.includes('Property 53'));
      logTest('Property 54: Reconnection Mechanism', 
        content.includes('Property 54'));
      logTest('Property 55: View Preservation During Failure', 
        content.includes('Property 55'));
      logTest('Property 56: Connection Blocking Before View Creation', 
        content.includes('Property 56'));
    }
    
  } catch (error) {
    logTest('Property tests verification', false, error.message);
  }
}

// ==================== Main ====================

async function main() {
  console.log('\x1b[35m');
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║     Proxy Functionality Verification (Task 27.8)          ║');
  console.log('║     Requirements: 12.1, 12.2, 12.3                        ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log('\x1b[0m');
  
  await testProxyConfiguration();
  await testProxyConnection();
  await testPreCheckAndIPVerification();
  await testWebRTCBlocking();
  await testKillSwitch();
  await testNoFallbackToDirect();
  await testProxyServiceIntegration();
  await testPropertyTestsExist();
  
  // Summary
  console.log('\n\x1b[35m═══════════════════════════════════════════════════════════════\x1b[0m');
  console.log('\x1b[1mSummary:\x1b[0m');
  console.log(`  Total Tests: ${results.passed + results.failed}`);
  console.log(`  \x1b[32mPassed: ${results.passed}\x1b[0m`);
  console.log(`  \x1b[31mFailed: ${results.failed}\x1b[0m`);
  
  if (results.failed > 0) {
    console.log('\n\x1b[31mFailed Tests:\x1b[0m');
    results.tests.filter(t => !t.passed).forEach(t => {
      console.log(`  - ${t.name}${t.details ? `: ${t.details}` : ''}`);
    });
  }
  
  console.log('\x1b[35m═══════════════════════════════════════════════════════════════\x1b[0m\n');
  
  // Exit with appropriate code
  process.exit(results.failed > 0 ? 1 : 0);
}

main().catch(error => {
  console.error('\x1b[31mVerification script failed:\x1b[0m', error);
  process.exit(1);
});
