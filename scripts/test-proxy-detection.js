/**
 * 测试代理检测服务
 * 
 * 注意：ProxyDetectionService已被ProxyPreChecker替代
 */

const ProxyPreChecker = require('../src/infrastructure/proxy/ProxyPreChecker');

async function testNetworkDetection() {
  console.log('=== 测试网络检测功能 ===\n');
  
  const service = new ProxyPreChecker();
  
  try {
    console.log('正在检测当前网络...');
    console.log('注意: ProxyPreChecker不支持直接检测当前网络，需要通过代理测试');
    console.log('跳过此测试...\n');
  } catch (error) {
    console.error('测试失败:', error);
  }
}

async function testProxyDetection() {
  console.log('\n\n=== 测试代理检测功能 ===\n');
  
  const service = new ProxyPreChecker();
  
  // 测试一个公共的测试代理（这个可能不可用，仅用于测试）
  const testProxy = {
    protocol: 'http',
    host: '127.0.0.1',
    port: 8080
  };
  
  try {
    console.log('正在测试代理:', testProxy);
    // 使用新的ProxyPreChecker API
    const result = await service.performFullCheck(testProxy);
    
    console.log('\n检测结果:');
    console.log('成功:', result.success);
    
    if (result.success) {
      console.log('IP 地址:', result.ip);
      console.log('IP 来源:', result.ipSource);
      console.log('连接延迟:', result.connectivity?.latency, 'ms');
      if (result.latency) {
        console.log('平均延迟:', result.latency.avg, 'ms');
      }
    } else {
      console.log('错误:', result.error);
    }
  } catch (error) {
    console.error('测试失败:', error);
  }
}

// 运行测试
(async () => {
  await testNetworkDetection();
  await testProxyDetection();
})();
