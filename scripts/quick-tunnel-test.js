/**
 * Quick Tunnel Test
 *
 * Simple test to verify V2RayN mixed port is accessible
 */

const http = require('http');

function testProxy(host, port) {
  return new Promise((resolve) => {
    console.log(`Testing ${host}:${port}...`);

    const options = {
      hostname: 'www.google.com',
      port: 443,
      path: '/',
      method: 'GET',
      // Note: This won't work for HTTPS, just testing if proxy is listening
      // For actual HTTPS proxy testing, we need https-proxy-agent
    };

    const req = http.request(options, (res) => {
      console.log(`✓ Proxy is responding`);
      console.log(`  Status: ${res.statusCode}`);
      resolve(true);
    });

    req.on('error', (error) => {
      console.log(`✗ Proxy not accessible`);
      console.log(`  Error: ${error.message}`);
      console.log(`  Code: ${error.code}`);
      resolve(false);
    });

    req.setTimeout(5000, () => {
      req.destroy();
      console.log(`✗ Connection timeout`);
      resolve(false);
    });

    req.end();
  });
}

async function runTests() {
  console.log('Quick Tunnel Test');
  console.log('==================\n');

  // Test common ports
  const tests = [
    { host: '127.0.0.1', port: 10808, name: 'V2RayN Mixed' },
    { host: '127.0.0.1', port: 1080, name: 'V2RayN SOCKS5' },
    { host: '127.0.0.1', port: 7890, name: 'Clash' }
  ];

  for (const test of tests) {
    console.log(`\n[${test.name}] ${test.host}:${test.port}`);
    console.log('Checking if port is open...');

    const net = require('net');
    const socket = new net.Socket();

    const isOpen = await new Promise((resolve) => {
      socket.setTimeout(2000);

      socket.connect(test.port, test.host, () => {
        console.log('✓ Port is open (listening)');
        socket.destroy();
        resolve(true);
      });

      socket.on('error', () => {
        console.log('✗ Port is closed (not listening)');
        resolve(false);
      });

      socket.on('timeout', () => {
        console.log('✗ Connection timeout');
        socket.destroy();
        resolve(false);
      });
    });

    if (isOpen) {
      console.log(`✓ ${test.name} is running and accessible`);
    } else {
      console.log(`✗ ${test.name} is not running or not accessible`);
    }
  }

  console.log('\n==================');
  console.log('If V2RayN Mixed (127.0.0.1:10808) shows as open,');
  console.log('then your V2RayN is configured correctly.');
  console.log('\nNext steps:');
  console.log('1. In the app, configure tunnel as:');
  console.log('   - Type: HTTP');
  console.log('   - Host: 127.0.0.1');
  console.log('   - Port: 10808');
  console.log('2. Click "Test Tunnel Connection"');
  console.log('3. If test passes, save and try opening account');
}

runTests().catch(console.error);