/**
 * 测试特定的代理配置
 * 
 * 注意：ProxyDetectionService已被ProxyPreChecker替代
 */

const ProxyPreChecker = require('../src/infrastructure/proxy/ProxyPreChecker');

async function testProxy() {
  console.log('=== 测试代理连接 ===\n');
  
  const service = new ProxyPreChecker();
  
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
    // 使用新的ProxyPreChecker API
    const result = await service.performFullCheck(proxyConfig);
    
    console.log('\n测试结果:');
    console.log('成功:', result.success);
    
    if (result.success) {
      console.log('IP 地址:', result.ip);
      console.log('IP 来源:', result.ipSource);
      console.log('连接延迟:', result.connectivity?.latency, 'ms');
      if (result.latency) {
        console.log('平均延迟:', result.latency.avg, 'ms');
        console.log('最小延迟:', result.latency.min, 'ms');
        console.log('最大延迟:', result.latency.max, 'ms');
      }
    } else {
      console.log('错误:', result.error);
    }
  } catch (error) {
    console.error('测试失败:', error.message);
  }
}

testProxy();
