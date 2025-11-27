/**
 * 代理IP不匹配诊断脚本
 * 
 * 用于诊断为什么设置的代理IP和实际出口IP不同
 * 
 * 使用方法：
 * 在浏览器控制台执行此脚本
 */

(async function() {
  console.log('%c=== 代理IP不匹配诊断 ===', 'color: red; font-size: 18px; font-weight: bold');
  
  const expectedProxyIP = '72.60.203.176'; // 你设置的代理IP
  const detectedIP = '1.55.80.179';        // 检测到的出口IP
  
  console.log(`\n%c预期代理IP: ${expectedProxyIP}`, 'color: yellow; font-weight: bold');
  console.log(`%c实际出口IP: ${detectedIP}`, 'color: orange; font-weight: bold');
  console.log(`%c状态: ❌ 不匹配`, 'color: red; font-weight: bold');
  
  const results = {
    expectedIP: expectedProxyIP,
    detectedIP: detectedIP,
    ipMatch: false,
    tests: []
  };
  
  // ==================== 测试1: 多源IP检测 ====================
  console.log('\n%c[测试1/6] 多源IP检测...', 'color: blue; font-weight: bold');
  
  const ipServices = [
    { name: 'ipinfo.io', url: 'https://ipinfo.io/json', parser: d => d.ip },
    { name: 'ipify.org', url: 'https://api.ipify.org?format=json', parser: d => d.ip },
    { name: 'ip-api.com', url: 'http://ip-api.com/json', parser: d => d.query },
    { name: 'ipapi.co', url: 'https://ipapi.co/json', parser: d => d.ip }
  ];
  
  const detectedIPs = new Set();
  
  for (const service of ipServices) {
    try {
      const response = await fetch(service.url);
      const data = await response.json();
      const ip = service.parser(data);
      detectedIPs.add(ip);
      
      const match = ip === expectedProxyIP ? '✓' : '✗';
      const color = ip === expectedProxyIP ? 'green' : 'red';
      console.log(`  ${match} ${service.name}: %c${ip}`, `color: ${color}`);
      
      results.tests.push({
        test: 'ip_detection',
        service: service.name,
        ip,
        match: ip === expectedProxyIP
      });
    } catch (error) {
      console.log(`  ✗ ${service.name}: 失败 (${error.message})`);
    }
  }
  
  console.log(`\n检测到 ${detectedIPs.size} 个不同的IP:`);
  detectedIPs.forEach(ip => {
    const match = ip === expectedProxyIP ? '✓ 匹配' : '✗ 不匹配';
    const color = ip === expectedProxyIP ? 'green' : 'red';
    console.log(`  %c${ip} - ${match}`, `color: ${color}`);
  });
  
  // ==================== 测试2: HTTP头检测 ====================
  console.log('\n%c[测试2/6] HTTP头检测（查找代理链）...', 'color: blue; font-weight: bold');
  
  try {
    const response = await fetch('https://httpbin.org/headers');
    const data = await response.json();
    
    console.log('HTTP头信息:');
    console.log(data.headers);
    
    // 检查代理相关的头
    const proxyHeaders = [
      'X-Forwarded-For',
      'X-Real-Ip',
      'Via',
      'X-Proxy-Id',
      'Forwarded'
    ];
    
    let foundProxyChain = false;
    proxyHeaders.forEach(header => {
      if (data.headers[header]) {
        console.log(`%c  ⚠️ 发现代理头 ${header}: ${data.headers[header]}`, 'color: orange; font-weight: bold');
        foundProxyChain = true;
        
        results.tests.push({
          test: 'proxy_headers',
          header,
          value: data.headers[header],
          indication: 'proxy_chain_detected'
        });
      }
    });
    
    if (!foundProxyChain) {
      console.log('  ✓ 未发现代理链头信息');
    } else {
      console.log('\n%c  💡 可能存在代理链（多层代理）', 'color: orange; font-weight: bold');
    }
  } catch (error) {
    console.error('  ✗ HTTP头检测失败:', error);
  }
  
  // ==================== 测试3: 地理位置对比 ====================
  console.log('\n%c[测试3/6] 地理位置对比...', 'color: blue; font-weight: bold');
  
  try {
    // 检测当前IP的地理位置
    const currentResponse = await fetch('https://ipinfo.io/json');
    const currentData = await currentResponse.json();
    
    console.log('当前IP地理位置:');
    console.log(`  IP: ${currentData.ip}`);
    console.log(`  城市: ${currentData.city}`);
    console.log(`  国家: ${currentData.country}`);
    console.log(`  ISP: ${currentData.org}`);
    console.log(`  时区: ${currentData.timezone}`);
    
    // 检测预期代理IP的地理位置
    try {
      const proxyResponse = await fetch(`https://ipinfo.io/${expectedProxyIP}/json`);
      const proxyData = await proxyResponse.json();
      
      console.log('\n预期代理IP地理位置:');
      console.log(`  IP: ${proxyData.ip}`);
      console.log(`  城市: ${proxyData.city}`);
      console.log(`  国家: ${proxyData.country}`);
      console.log(`  ISP: ${proxyData.org}`);
      console.log(`  时区: ${proxyData.timezone}`);
      
      // 对比
      if (currentData.country !== proxyData.country) {
        console.log(`\n%c  ⚠️ 国家不匹配: ${currentData.country} vs ${proxyData.country}`, 'color: red; font-weight: bold');
      }
      if (currentData.org !== proxyData.org) {
        console.log(`%c  ⚠️ ISP不匹配: ${currentData.org} vs ${proxyData.org}`, 'color: red; font-weight: bold');
      }
      
      results.tests.push({
        test: 'geolocation',
        current: currentData,
        expected: proxyData,
        countryMatch: currentData.country === proxyData.country,
        ispMatch: currentData.org === proxyData.org
      });
    } catch (error) {
      console.error('  ✗ 无法获取预期代理IP的地理位置:', error);
    }
  } catch (error) {
    console.error('  ✗ 地理位置检测失败:', error);
  }
  
  // ==================== 测试4: DNS泄露检测 ====================
  console.log('\n%c[测试4/6] DNS泄露检测...', 'color: blue; font-weight: bold');
  
  console.log('  建议访问以下网站进行详细DNS检测:');
  console.log('  - https://dnsleaktest.com');
  console.log('  - https://ipleak.net');
  console.log('  - https://browserleaks.com/dns');
  
  // ==================== 测试5: WebRTC泄露检测 ====================
  console.log('\n%c[测试5/6] WebRTC泄露检测...', 'color: blue; font-weight: bold');
  
  if (typeof RTCPeerConnection !== 'undefined') {
    console.log('  ⚠️ WebRTC可用，正在检测IP泄露...');
    
    try {
      const pc = new RTCPeerConnection({iceServers: []});
      const leakedIPs = new Set();
      
      pc.onicecandidate = (ice) => {
        if (!ice || !ice.candidate || !ice.candidate.candidate) return;
        
        const ipRegex = /([0-9]{1,3}(\.[0-9]{1,3}){3})/;
        const match = ice.candidate.candidate.match(ipRegex);
        
        if (match && match[1]) {
          const ip = match[1];
          if (!ip.startsWith('127.') && !ip.startsWith('0.')) {
            leakedIPs.add(ip);
            console.log(`  %c⚠️ WebRTC泄露IP: ${ip}`, 'color: red; font-weight: bold');
          }
        }
      };
      
      pc.createDataChannel('');
      await pc.createOffer().then(offer => pc.setLocalDescription(offer));
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      if (leakedIPs.size > 0) {
        console.log(`\n  %c✗ 检测到 ${leakedIPs.size} 个泄露的IP`, 'color: red; font-weight: bold');
        results.tests.push({
          test: 'webrtc_leak',
          leakedIPs: Array.from(leakedIPs),
          severity: 'high'
        });
      } else {
        console.log('  ✓ 未检测到WebRTC IP泄露');
      }
      
      pc.close();
    } catch (error) {
      console.log('  ✓ WebRTC被阻止或检测失败');
    }
  } else {
    console.log('  ✓ WebRTC已被禁用');
  }
  
  // ==================== 测试6: 代理类型检测 ====================
  console.log('\n%c[测试6/6] 代理类型分析...', 'color: blue; font-weight: bold');
  
  console.log('\n可能的原因分析:');
  
  // 分析1: 代理链
  console.log('\n%c1. 代理链（多层代理）', 'color: yellow; font-weight: bold');
  console.log('   你的应用 → 代理A(72.60.203.176) → 代理B(1.55.80.179) → 目标');
  console.log('   可能性: 高');
  console.log('   解决: 联系代理服务商确认是否使用了代理链');
  
  // 分析2: 负载均衡
  console.log('\n%c2. 负载均衡/多出口', 'color: yellow; font-weight: bold');
  console.log('   代理服务器有多个出口IP，根据负载选择不同的出口');
  console.log('   可能性: 中');
  console.log('   解决: 询问代理服务商所有可能的出口IP列表');
  
  // 分析3: 配置错误
  console.log('\n%c3. 配置错误', 'color: yellow; font-weight: bold');
  console.log('   72.60.203.176 可能是入口IP，而非出口IP');
  console.log('   可能性: 中');
  console.log('   解决: 确认代理配置中的IP是入口还是出口');
  
  // 分析4: 代理服务商问题
  console.log('\n%c4. 代理服务商配置', 'color: yellow; font-weight: bold');
  console.log('   代理服务商可能配置了NAT或端口转发');
  console.log('   可能性: 低');
  console.log('   解决: 联系代理服务商技术支持');
  
  // ==================== 最终建议 ====================
  console.log('\n%c=== 诊断结果和建议 ===', 'color: cyan; font-size: 16px; font-weight: bold');
  
  console.log('\n%c问题严重性: 🔴 高', 'color: red; font-weight: bold');
  console.log('代理IP不匹配可能导致:');
  console.log('  - IP验证失败');
  console.log('  - 无法追踪真实出口IP');
  console.log('  - 安全策略失效');
  
  console.log('\n%c立即行动:', 'color: orange; font-weight: bold');
  console.log('  1. 联系代理服务商，询问:');
  console.log('     - 72.60.203.176 是入口还是出口IP？');
  console.log('     - 是否使用了代理链或负载均衡？');
  console.log('     - 所有可能的出口IP列表是什么？');
  console.log('  2. 测试代理连接:');
  console.log('     curl -x socks5://72.60.203.176:端口 https://ipinfo.io/json');
  console.log('  3. 如果1.55.80.179是正确的出口IP:');
  console.log('     - 更新代理配置记录');
  console.log('     - 在IP验证中使用实际出口IP');
  
  console.log('\n%c完整诊断结果:', 'color: cyan');
  console.log(results);
  
  return results;
})();
