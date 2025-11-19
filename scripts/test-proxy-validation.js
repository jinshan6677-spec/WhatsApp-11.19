/**
 * Simple unit test for proxy validation logic
 * Tests the validation without requiring Electron runtime
 */

// Mock the validation function from SessionManager
function validateProxyConfig(proxyConfig) {
  if (!proxyConfig) {
    return { valid: false, error: 'Proxy config is required' };
  }
  
  const { protocol, host, port, username, password } = proxyConfig;
  
  // 验证协议
  const validProtocols = ['http', 'https', 'socks5', 'socks4'];
  if (!protocol || !validProtocols.includes(protocol.toLowerCase())) {
    return { valid: false, error: `Invalid protocol: ${protocol}. Must be one of: ${validProtocols.join(', ')}` };
  }
  
  // 验证主机
  if (!host || typeof host !== 'string' || host.trim() === '') {
    return { valid: false, error: 'Invalid host: must be a non-empty string' };
  }
  
  // 验证主机格式（基本检查）
  const hostPattern = /^[a-zA-Z0-9.-]+$/;
  const ipPattern = /^(\d{1,3}\.){3}\d{1,3}$/;
  if (!hostPattern.test(host) && !ipPattern.test(host)) {
    return { valid: false, error: 'Invalid host format: must be a valid hostname or IP address' };
  }
  
  // 验证端口
  if (!port || typeof port !== 'number' || port < 1 || port > 65535) {
    return { valid: false, error: 'Invalid port: must be a number between 1 and 65535' };
  }
  
  // 验证认证信息（如果提供）
  if (username !== undefined || password !== undefined) {
    if (username && typeof username !== 'string') {
      return { valid: false, error: 'Invalid username: must be a string' };
    }
    if (password && typeof password !== 'string') {
      return { valid: false, error: 'Invalid password: must be a string' };
    }
    // 如果提供了用户名或密码，两者都应该提供
    if ((username && !password) || (!username && password)) {
      return { valid: false, error: 'Both username and password must be provided for authentication' };
    }
  }
  
  return { valid: true };
}

// Test cases
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
    name: 'Valid SOCKS4 proxy',
    config: {
      protocol: 'socks4',
      host: 'localhost',
      port: 9050
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
    name: 'Invalid port (zero)',
    config: {
      protocol: 'http',
      host: '127.0.0.1',
      port: 0
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
    name: 'Invalid host format (spaces)',
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
  },
  {
    name: 'Missing protocol',
    config: {
      host: '127.0.0.1',
      port: 8080
    },
    shouldPass: false
  },
  {
    name: 'Missing host',
    config: {
      protocol: 'http',
      port: 8080
    },
    shouldPass: false
  },
  {
    name: 'Missing port',
    config: {
      protocol: 'http',
      host: '127.0.0.1'
    },
    shouldPass: false
  }
];

// Run tests
console.log('='.repeat(70));
console.log('Proxy Configuration Validation Test Suite');
console.log('='.repeat(70));
console.log();

let passed = 0;
let failed = 0;

for (const testCase of testCases) {
  const validation = validateProxyConfig(testCase.config);
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
console.log('='.repeat(70));
console.log('Test Summary');
console.log('='.repeat(70));
console.log(`Total tests: ${passed + failed}`);
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);
console.log();

if (failed === 0) {
  console.log('✓ All tests passed!');
  process.exit(0);
} else {
  console.log('✗ Some tests failed');
  process.exit(1);
}
