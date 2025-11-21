/**
 * 测试代理检测服务
 */

const ProxyDetectionService = require('../src/services/ProxyDetectionService');

async function testNetworkDetection() {
  console.log('=== 测试网络检测功能 ===\n');
  
  const service = new ProxyDetectionService();
  
  try {
    console.log('正在检测当前网络...');
    const result = await service.getCurrentNetworkInfo();
    
    console.log('\n检测结果:');
    console.log('成功:', result.success);
    
    if (result.success) {
      console.log('IP 地址:', result.ip);
      console.log('位置:', result.location);
      console.log('国家:', result.country);
      console.log('国家代码:', result.countryCode);
      console.log('响应时间:', result.responseTime, 'ms');
    } else {
      console.log('错误:', result.error);
    }
  } catch (error) {
    console.error('测试失败:', error);
  }
}

async function testProxyDetection() {
  console.log('\n\n=== 测试代理检测功能 ===\n');
  
  const service = new ProxyDetectionService();
  
  // 测试一个公共的测试代理（这个可能不可用，仅用于测试）
  const testProxy = {
    protocol: 'http',
    host: '127.0.0.1',
    port: 8080
  };
  
  try {
    console.log('正在测试代理:', testProxy);
    const result = await service.testProxy(testProxy);
    
    console.log('\n检测结果:');
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
    console.error('测试失败:', error);
  }
}

// 运行测试
(async () => {
  await testNetworkDetection();
  await testProxyDetection();
})();
