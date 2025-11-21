/**
 * 测试特定的代理配置
 */

const ProxyDetectionService = require('../src/services/ProxyDetectionService');

async function testProxy() {
  console.log('=== 测试代理连接 ===\n');
  
  const service = new ProxyDetectionService();
  
  const proxyConfig = {
    protocol: 'socks5',
    host: '72.60.203.176',
    port: 12111,
    username: 'txy',
    password: '' // 这里需要实际密码，但我们先测试不带认证的
  };
  
  console.log('代理配置:');
  console.log(`  ${proxyConfig.protocol}://${proxyConfig.host}:${proxyConfig.port}`);
  console.log('');
  
  try {
    console.log('正在测试代理连接...');
    const result = await service.testProxy(proxyConfig);
    
    console.log('\n测试结果:');
    console.log('成功:', result.success);
    
    if (result.success) {
      console.log('IP 地址:', result.ip);
      console.log('位置:', result.location);
      console.log('国家:', result.country);
      console.log('响应时间:', result.responseTime, 'ms');
    } else {
      console.log('错误:', result.error);
    }
  } catch (error) {
    console.error('测试失败:', error.message);
  }
}

testProxy();
