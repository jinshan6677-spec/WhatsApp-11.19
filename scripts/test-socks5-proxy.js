/**
 * Test SOCKS5 Proxy Connection
 *
 * This script tests if SOCKS5 proxy is working correctly
 */

const { net } = require('electron');

async function testSocks5Proxy(host, port) {
  console.log(`[Test] Testing SOCKS5 proxy: ${host}:${port}`);

  try {
    // Create a request to test the proxy
    const request = net.request({
      method: 'GET',
      url: 'https://www.google.com',
      useSessionCookies: false
    });

    // Set proxy
    request.on('response', (response) => {
      console.log('[Test] ✓ Proxy connection successful!');
      console.log('[Test] Status:', response.statusCode);
      console.log('[Test] Headers:', response.headers);
    });

    request.on('error', (error) => {
      console.error('[Test] ✗ Proxy connection failed:', error.message);
      console.error('[Test] Error code:', error.code);
    });

    request.end();

    return true;
  } catch (error) {
    console.error('[Test] ✗ Test failed:', error);
    return false;
  }
}

// Test with common SOCKS5 ports
async function runTests() {
  console.log('[Test] Starting SOCKS5 proxy tests...\n');

  const testCases = [
    { host: '127.0.0.1', port: 1080, name: 'V2RayN SOCKS5' },
    { host: '127.0.0.1', port: 10808, name: 'V2RayN Mixed' },
    { host: '127.0.0.1', port: 7890, name: 'Clash SOCKS5' }
  ];

  for (const testCase of testCases) {
    console.log(`\n[Test] Testing: ${testCase.name} (${testCase.host}:${testCase.port})`);
    await testSocks5Proxy(testCase.host, testCase.port);
  }

  console.log('\n[Test] Tests completed.');
}

// Run tests
runTests().catch(console.error);