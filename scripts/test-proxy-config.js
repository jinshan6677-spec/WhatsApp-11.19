/**
 * Test script for proxy configuration functionality
 * Tests the SessionManager proxy configuration features
 */

const { app, session } = require('electron');
const path = require('path');
const SessionManager = require('../src/managers/SessionManager');

// Test configurations
const testCases = [
  {
    name: 'Valid HTTP proxy without auth',
    config: {
      protocol: 'http',
      host: '127.0.0.1',
      port: 8080
    },
    shouldPass: true
  },
  {
    name: 'Valid HTTPS proxy with auth',
    config: {
      protocol: 'https',
      host: 'proxy.example.com',
      port: 3128,
      username: 'testuser',
      password: 'testpass'
    },
    shouldPass: true
  },
  {
    name: 'Valid SOCKS5 proxy',
    config: {
      protocol: 'socks5',
      host: '192.168.1.100',
      port: 1080
    },
    shouldPass: true
  },
  {
    name: 'Invalid protocol',
    config: {
      protocol: 'ftp',
      host: '127.0.0.1',
      port: 8080
    },
    shouldPass: false
  },
  {
    name: 'Invalid port (too high)',
    config: {
      protocol: 'http',
      host: '127.0.0.1',
      port: 99999
    },
    shouldPass: false
  },
  {
    name: 'Invalid port (negative)',
    config: {
      protocol: 'http',
      host: '127.0.0.1',
      port: -1
    },
    shouldPass: false
  },
  {
    name: 'Empty host',
    config: {
      protocol: 'http',
      host: '',
      port: 8080
    },
    shouldPass: false
  },
  {
    name: 'Invalid host format',
    config: {
      protocol: 'http',
      host: 'invalid host with spaces',
      port: 8080
    },
    shouldPass: false
  },
  {
    name: 'Username without password',
    config: {
      protocol: 'http',
      host: '127.0.0.1',
      port: 8080,
      username: 'testuser'
    },
    shouldPass: false
  },
  {
    name: 'Password without username',
    config: {
      protocol: 'http',
      host: '127.0.0.1',
      port: 8080,
      password: 'testpass'
    },
    shouldPass: false
  }
];

async function runTests() {
  console.log('='.repeat(60));
  console.log('Proxy Configuration Test Suite');
  console.log('='.repeat(60));
  console.log();

  const userDataPath = path.join(app.getPath('userData'), 'test-proxy');
  const sessionManager = new SessionManager({ userDataPath });

  let passed = 0;
  let failed = 0;

  // Test 1: Proxy validation
  console.log('Test 1: Proxy Configuration Validation');
  console.log('-'.repeat(60));

  for (const testCase of testCases) {
    const validation = sessionManager._validateProxyConfig(testCase.config);
    const testPassed = validation.valid === testCase.shouldPass;

    if (testPassed) {
      console.log(`✓ ${testCase.name}`);
      passed++;
    } else {
      console.log(`✗ ${testCase.name}`);
      console.log(`  Expected: ${testCase.shouldPass ? 'valid' : 'invalid'}`);
      console.log(`  Got: ${validation.valid ? 'valid' : 'invalid'}`);
      if (validation.error) {
        console.log(`  Error: ${validation.error}`);
      }
      failed++;
    }
  }

  console.log();

  // Test 2: Session creation with proxy
  console.log('Test 2: Session Creation with Proxy');
  console.log('-'.repeat(60));

  const testAccountId = 'test-account-001';
  const proxyConfig = {
    enabled: true,
    protocol: 'http',
    host: '127.0.0.1',
    port: 8080
  };

  const sessionResult = await sessionManager.createSession(testAccountId, { proxy: proxyConfig });

  if (sessionResult.success) {
    console.log(`✓ Session created successfully for account ${testAccountId}`);
    if (sessionResult.proxyWarning) {
      console.log(`  Warning: ${sessionResult.proxyWarning}`);
    }
    passed++;
  } else {
    console.log(`✗ Failed to create session: ${sessionResult.error}`);
    failed++;
  }

  console.log();

  // Test 3: Get proxy config
  console.log('Test 3: Get Proxy Configuration');
  console.log('-'.repeat(60));

  const retrievedConfig = sessionManager.getProxyConfig(testAccountId);
  if (retrievedConfig) {
    console.log(`✓ Proxy config retrieved for account ${testAccountId}`);
    console.log(`  Protocol: ${retrievedConfig.protocol}`);
    console.log(`  Host: ${retrievedConfig.host}`);
    console.log(`  Port: ${retrievedConfig.port}`);
    passed++;
  } else {
    console.log(`✗ Failed to retrieve proxy config`);
    failed++;
  }

  console.log();

  // Test 4: Update proxy config
  console.log('Test 4: Update Proxy Configuration');
  console.log('-'.repeat(60));

  const newProxyConfig = {
    protocol: 'socks5',
    host: '192.168.1.1',
    port: 1080,
    username: 'user',
    password: 'pass'
  };

  const updateResult = await sessionManager.configureProxy(testAccountId, newProxyConfig);
  if (updateResult.success) {
    console.log(`✓ Proxy config updated for account ${testAccountId}`);
    passed++;
  } else {
    console.log(`✗ Failed to update proxy config: ${updateResult.error}`);
    failed++;
  }

  console.log();

  // Test 5: Clear proxy
  console.log('Test 5: Clear Proxy Configuration');
  console.log('-'.repeat(60));

  const clearResult = await sessionManager.clearProxy(testAccountId);
  if (clearResult.success) {
    console.log(`✓ Proxy cleared for account ${testAccountId}`);
    passed++;

    const clearedConfig = sessionManager.getProxyConfig(testAccountId);
    if (!clearedConfig) {
      console.log(`✓ Proxy config cache cleared`);
      passed++;
    } else {
      console.log(`✗ Proxy config still in cache`);
      failed++;
    }
  } else {
    console.log(`✗ Failed to clear proxy: ${clearResult.error}`);
    failed++;
  }

  console.log();

  // Test 6: Error handling - invalid account
  console.log('Test 6: Error Handling - Invalid Account');
  console.log('-'.repeat(60));

  const invalidResult = await sessionManager.configureProxy('non-existent-account', proxyConfig);
  if (!invalidResult.success) {
    console.log(`✓ Correctly handled invalid account ID`);
    console.log(`  Error: ${invalidResult.error}`);
    passed++;
  } else {
    console.log(`✗ Should have failed for non-existent account`);
    failed++;
  }

  console.log();

  // Test 7: Cleanup
  console.log('Test 7: Cleanup');
  console.log('-'.repeat(60));

  await sessionManager.clearSessionData(testAccountId);
  console.log(`✓ Test session data cleared`);
  passed++;

  console.log();

  // Summary
  console.log('='.repeat(60));
  console.log('Test Summary');
  console.log('='.repeat(60));
  console.log(`Total tests: ${passed + failed}`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log();

  if (failed === 0) {
    console.log('✓ All tests passed!');
    app.quit();
    process.exit(0);
  } else {
    console.log('✗ Some tests failed');
    app.quit();
    process.exit(1);
  }
}

// Run tests when app is ready
app.whenReady().then(() => {
  runTests().catch(error => {
    console.error('Test execution failed:', error);
    app.quit();
    process.exit(1);
  });
});

// Handle errors
process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
  app.quit();
  process.exit(1);
});
