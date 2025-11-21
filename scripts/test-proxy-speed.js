/**
 * 测试代理速度和连接性
 */

const https = require('https');
const http = require('http');

async function testDirectConnection() {
  console.log('=== 测试直连 ===\n');
  
  const startTime = Date.now();
  
  return new Promise((resolve, reject) => {
    const req = https.request('https://web.whatsapp.com/', {
      method: 'HEAD',
      timeout: 10000
    }, (res) => {
      const responseTime = Date.now() - startTime;
      console.log(`✓ 直连成功`);
      console.log(`  状态码: ${res.statusCode}`);
      console.log(`  响应时间: ${responseTime} ms\n`);
      resolve(responseTime);
    });
    
    req.on('error', (error) => {
      console.log(`✗ 直连失败: ${error.message}\n`);
      reject(error);
    });
    
    req.on('timeout', () => {
      req.destroy();
      console.log(`✗ 直连超时\n`);
      reject(new Error('Timeout'));
    });
    
    req.end();
  });
}

async function testProxyConnection() {
  console.log('=== 测试代理连接 ===\n');
  console.log('注意: 这个测试使用 HTTP 代理方式');
  console.log('如果你的代理是 SOCKS5，可能无法正确测试\n');
  
  const startTime = Date.now();
  
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'web.whatsapp.com',
      port: 443,
      path: '/',
      method: 'HEAD',
      timeout: 10000,
      agent: new http.Agent({
        proxy: {
          host: '72.60.203.176',
          port: 12111
        }
      })
    };
    
    const req = https.request(options, (res) => {
      const responseTime = Date.now() - startTime;
      console.log(`✓ 代理连接成功`);
      console.log(`  状态码: ${res.statusCode}`);
      console.log(`  响应时间: ${responseTime} ms\n`);
      resolve(responseTime);
    });
    
    req.on('error', (error) => {
      console.log(`✗ 代理连接失败: ${error.message}\n`);
      reject(error);
    });
    
    req.on('timeout', () => {
      req.destroy();
      console.log(`✗ 代理连接超时\n`);
      reject(new Error('Timeout'));
    });
    
    req.end();
  });
}

async function main() {
  console.log('=== 代理速度测试 ===\n');
  console.log('目标: https://web.whatsapp.com/\n');
  
  try {
    await testDirectConnection();
  } catch (error) {
    // 直连失败，继续测试代理
  }
  
  try {
    await testProxyConnection();
  } catch (error) {
    // 代理连接失败
  }
  
  console.log('=== 建议 ===\n');
  console.log('如果代理响应时间 > 5000ms，WhatsApp 可能会一直加载');
  console.log('如果代理连接失败，请检查:');
  console.log('  1. 代理服务器是否在线');
  console.log('  2. 用户名和密码是否正确');
  console.log('  3. 代理服务器是否允许访问 WhatsApp');
}

main();
