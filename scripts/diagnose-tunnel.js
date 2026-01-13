/**
 * Tunnel Diagnosis Script
 *
 * This script helps diagnose tunnel/proxy connection issues
 */

const { app, BrowserWindow, session } = require('electron');
const path = require('path');

async function testTunnelConnection(tunnelConfig) {
  console.log('\n========================================');
  console.log('Tunnel Connection Test');
  console.log('========================================\n');

  console.log('Configuration:');
  console.log(`  Type: ${tunnelConfig.type}`);
  console.log(`  Host: ${tunnelConfig.host}`);
  console.log(`  Port: ${tunnelConfig.port}`);
  console.log(`  Auth: ${tunnelConfig.username ? 'Yes' : 'No'}\n`);

  try {
    // Create a test session
    const testSession = session.fromPartition('test-tunnel-session');

    // Build proxy rules
    let proxyRules;
    if (tunnelConfig.type === 'socks5') {
      proxyRules = `socks5://${tunnelConfig.host}:${tunnelConfig.port}`;
    } else if (tunnelConfig.type === 'http') {
      proxyRules = `http://${tunnelConfig.host}:${tunnelConfig.port}`;
    } else {
      throw new Error(`Unsupported type: ${tunnelConfig.type}`);
    }

    console.log(`Applying proxy rules: ${proxyRules}`);

    // Set proxy
    await testSession.setProxy({
      proxyRules: proxyRules,
      proxyBypassRules: '<local>'
    });

    console.log('✓ Proxy configured\n');

    // Verify proxy info
    const proxyInfo = await testSession.getProxyInfo();
    console.log('Proxy Info:', JSON.stringify(proxyInfo, null, 2));

    // Test connection
    console.log('\nTesting connection to https://www.google.com...');

    const { net } = require('electron');
    const request = net.request({
      method: 'GET',
      url: 'https://www.google.com',
      session: testSession
    });

    request.on('response', (response) => {
      console.log(`✓ Connection successful!`);
      console.log(`  Status: ${response.statusCode}`);
      console.log(`  Headers: ${JSON.stringify(response.headers, null, 2)}`);
      app.quit();
    });

    request.on('error', (error) => {
      console.error(`✗ Connection failed!`);
      console.error(`  Error: ${error.message}`);
      console.error(`  Code: ${error.code}`);
      console.error(`  Description: ${error.description}`);
      app.quit();
    });

    // Set timeout
    setTimeout(() => {
      console.error('✗ Connection timeout (10s)');
      app.quit();
    }, 10000);

    request.end();

  } catch (error) {
    console.error('✗ Test failed:', error);
    app.quit();
  }
}

// Run tests
app.whenReady().then(() => {
  console.log('Electron app ready\n');

  // Test common configurations
  const testConfigs = [
    {
      name: 'V2RayN Mixed (HTTP)',
      type: 'http',
      host: '127.0.0.1',
      port: 10808
    },
    {
      name: 'V2RayN SOCKS5',
      type: 'socks5',
      host: '127.0.0.1',
      port: 1080
    },
    {
      name: 'Clash Mixed (HTTP)',
      type: 'http',
      host: '127.0.0.1',
      port: 7890
    }
  ];

  // Test each configuration
  let currentIndex = 0;

  function runNextTest() {
    if (currentIndex >= testConfigs.length) {
      console.log('\n========================================');
      console.log('All tests completed');
      console.log('========================================\n');
      app.quit();
      return;
    }

    const config = testConfigs[currentIndex];
    console.log(`\n[Test ${currentIndex + 1}/${testConfigs.length}] ${config.name}`);

    testTunnelConnection(config).then(() => {
      currentIndex++;
      setTimeout(runNextTest, 2000); // Wait 2s between tests
    });
  }

  runNextTest();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});