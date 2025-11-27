/**
 * 浏览器内IP验证脚本
 * 
 * 使用方法：
 * 1. 在应用中打开一个使用代理的账号
 * 2. 打开开发者工具（F12）
 * 3. 将此脚本复制到控制台执行
 * 
 * 此脚本将：
 * - 检测当前出口IP
 * - 检测WebRTC泄露
 * - 验证IP保护脚本是否生效
 * - 检测DNS泄露
 */

(async function() {
  console.log('%c=== 代理IP验证和泄露检测 ===', 'color: cyan; font-size: 16px; font-weight: bold');
  
  const results = {
    currentIP: null,
    webrtcLeaks: [],
    ipProtection: {},
    dnsLeaks: [],
    timestamp: new Date().toISOString()
  };
  
  // ==================== 1. 检测当前出口IP ====================
  console.log('\n%c[1/4] 检测当前出口IP...', 'color: blue; font-weight: bold');
  
  try {
    const ipServices = [
      { name: 'ipinfo.io', url: 'https://ipinfo.io/json' },
      { name: 'ipify.org', url: 'https://api.ipify.org?format=json' },
      { name: 'ip-api.com', url: 'http://ip-api.com/json' }
    ];
    
    for (const service of ipServices) {
      try {
        const response = await fetch(service.url);
        const data = await response.json();
        const ip = data.ip || data.query;
        
        if (ip) {
          results.currentIP = {
            ip,
            service: service.name,
            location: data.city ? `${data.city}, ${data.country}` : 'N/A'
          };
          
          console.log(`%c✓ 当前出口IP: ${ip}`, 'color: green');
          console.log(`  来源: ${service.name}`);
          if (data.city) {
            console.log(`  位置: ${data.city}, ${data.country}`);
          }
          break;
        }
      } catch (error) {
        console.log(`%c✗ ${service.name} 检测失败: ${error.message}`, 'color: orange');
      }
    }
    
    if (!results.currentIP) {
      console.log('%c✗ 无法检测出口IP', 'color: red');
    }
  } catch (error) {
    console.error('IP检测错误:', error);
  }
  
  // ==================== 2. 检测WebRTC泄露 ====================
  console.log('\n%c[2/4] 检测WebRTC IP泄露...', 'color: blue; font-weight: bold');
  
  try {
    // 检查WebRTC APIs是否被禁用
    const webrtcAPIs = {
      RTCPeerConnection: typeof RTCPeerConnection !== 'undefined',
      RTCDataChannel: typeof RTCDataChannel !== 'undefined',
      RTCSessionDescription: typeof RTCSessionDescription !== 'undefined',
      getUserMedia: typeof navigator.mediaDevices?.getUserMedia !== 'undefined'
    };
    
    console.log('WebRTC APIs状态:');
    for (const [api, available] of Object.entries(webrtcAPIs)) {
      const status = available ? '❌ 可用（可能泄露）' : '✓ 已禁用';
      const color = available ? 'red' : 'green';
      console.log(`  ${api}: %c${status}`, `color: ${color}`);
    }
    
    // 如果WebRTC可用，尝试检测泄露的IP
    if (webrtcAPIs.RTCPeerConnection) {
      console.log('\n尝试通过WebRTC获取本地IP...');
      
      const pc = new RTCPeerConnection({iceServers: []});
      const leakedIPs = new Set();
      
      pc.onicecandidate = (ice) => {
        if (!ice || !ice.candidate || !ice.candidate.candidate) return;
        
        const ipRegex = /([0-9]{1,3}(\.[0-9]{1,3}){3})/;
        const match = ice.candidate.candidate.match(ipRegex);
        
        if (match && match[1]) {
          const ip = match[1];
          // 过滤掉本地IP
          if (!ip.startsWith('127.') && !ip.startsWith('0.')) {
            leakedIPs.add(ip);
            console.log(`%c⚠️ 检测到泄露的IP: ${ip}`, 'color: red; font-weight: bold');
          }
        }
      };
      
      pc.createDataChannel('');
      await pc.createOffer().then(offer => pc.setLocalDescription(offer));
      
      // 等待ICE候选收集
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      results.webrtcLeaks = Array.from(leakedIPs);
      
      if (results.webrtcLeaks.length > 0) {
        console.log(`%c✗ WebRTC泄露检测: 发现 ${results.webrtcLeaks.length} 个泄露的IP`, 'color: red; font-weight: bold');
        results.webrtcLeaks.forEach(ip => {
          console.log(`  - ${ip}`);
        });
      } else {
        console.log('%c✓ WebRTC泄露检测: 未发现泄露', 'color: green');
      }
      
      pc.close();
    } else {
      console.log('%c✓ WebRTC已被禁用，无法进行泄露测试', 'color: green');
      results.webrtcLeaks = null; // WebRTC被禁用
    }
  } catch (error) {
    console.error('WebRTC检测错误:', error);
    results.webrtcLeaks = ['检测失败: ' + error.message];
  }
  
  // ==================== 3. 验证IP保护脚本 ====================
  console.log('\n%c[3/4] 验证IP保护脚本...', 'color: blue; font-weight: bold');
  
  results.ipProtection = {
    webrtc: {
      RTCPeerConnection: typeof RTCPeerConnection === 'undefined',
      RTCDataChannel: typeof RTCDataChannel === 'undefined',
      RTCSessionDescription: typeof RTCSessionDescription === 'undefined'
    },
    media: {
      getUserMedia: typeof navigator.mediaDevices?.getUserMedia === 'undefined'
    },
    network: {
      connection: typeof navigator.connection === 'undefined',
      battery: typeof navigator.getBattery === 'undefined'
    }
  };
  
  console.log('IP保护状态:');
  console.log('  WebRTC APIs:');
  for (const [api, blocked] of Object.entries(results.ipProtection.webrtc)) {
    const status = blocked ? '✓ 已禁用' : '❌ 未禁用';
    const color = blocked ? 'green' : 'red';
    console.log(`    ${api}: %c${status}`, `color: ${color}`);
  }
  
  console.log('  Media APIs:');
  for (const [api, blocked] of Object.entries(results.ipProtection.media)) {
    const status = blocked ? '✓ 已禁用' : '❌ 未禁用';
    const color = blocked ? 'green' : 'red';
    console.log(`    ${api}: %c${status}`, `color: ${color}`);
  }
  
  console.log('  Network APIs:');
  for (const [api, blocked] of Object.entries(results.ipProtection.network)) {
    const status = blocked ? '✓ 已禁用' : '⚠️ 未禁用（可选）';
    const color = blocked ? 'green' : 'orange';
    console.log(`    ${api}: %c${status}`, `color: ${color}`);
  }
  
  const allCriticalBlocked = 
    results.ipProtection.webrtc.RTCPeerConnection &&
    results.ipProtection.webrtc.RTCDataChannel &&
    results.ipProtection.webrtc.RTCSessionDescription &&
    results.ipProtection.media.getUserMedia;
  
  if (allCriticalBlocked) {
    console.log('%c✓ IP保护脚本工作正常', 'color: green; font-weight: bold');
  } else {
    console.log('%c✗ IP保护脚本可能未生效', 'color: red; font-weight: bold');
  }
  
  // ==================== 4. DNS泄露检测提示 ====================
  console.log('\n%c[4/4] DNS泄露检测...', 'color: blue; font-weight: bold');
  console.log('DNS泄露需要访问外部服务检测，建议访问:');
  console.log('  - https://dnsleaktest.com');
  console.log('  - https://ipleak.net');
  console.log('  - https://browserleaks.com/dns');
  
  // ==================== 最终报告 ====================
  console.log('\n%c=== 验证报告 ===', 'color: cyan; font-size: 16px; font-weight: bold');
  
  console.log('\n%c当前状态:', 'color: yellow; font-weight: bold');
  if (results.currentIP) {
    console.log(`  出口IP: ${results.currentIP.ip}`);
    console.log(`  位置: ${results.currentIP.location}`);
  } else {
    console.log('  出口IP: 无法检测');
  }
  
  console.log('\n%cWebRTC泄露:', 'color: yellow; font-weight: bold');
  if (results.webrtcLeaks === null) {
    console.log('%c  ✓ WebRTC已禁用（最安全）', 'color: green');
  } else if (results.webrtcLeaks.length === 0) {
    console.log('%c  ✓ 未检测到泄露', 'color: green');
  } else {
    console.log(`%c  ✗ 检测到 ${results.webrtcLeaks.length} 个泄露的IP`, 'color: red');
    results.webrtcLeaks.forEach(ip => {
      console.log(`    - ${ip}`);
    });
  }
  
  console.log('\n%cIP保护:', 'color: yellow; font-weight: bold');
  if (allCriticalBlocked) {
    console.log('%c  ✓ 关键API已禁用', 'color: green');
  } else {
    console.log('%c  ✗ 部分API未禁用', 'color: red');
  }
  
  // 安全评分
  console.log('\n%c安全评分:', 'color: yellow; font-weight: bold');
  let score = 100;
  const issues = [];
  
  if (!results.currentIP) {
    score -= 20;
    issues.push('无法检测出口IP');
  }
  
  if (results.webrtcLeaks && results.webrtcLeaks.length > 0) {
    score -= 40;
    issues.push('WebRTC泄露');
  } else if (results.webrtcLeaks === null) {
    // WebRTC被禁用，加分
    score += 0;
  }
  
  if (!allCriticalBlocked) {
    score -= 30;
    issues.push('IP保护脚本未完全生效');
  }
  
  const scoreColor = score >= 80 ? 'green' : score >= 60 ? 'orange' : 'red';
  console.log(`%c  评分: ${score}/100`, `color: ${scoreColor}; font-weight: bold; font-size: 14px`);
  
  if (issues.length > 0) {
    console.log('\n%c发现的问题:', 'color: red; font-weight: bold');
    issues.forEach(issue => {
      console.log(`  ✗ ${issue}`);
    });
  } else {
    console.log('\n%c✓ 未发现安全问题', 'color: green; font-weight: bold');
  }
  
  // 建议
  console.log('\n%c建议:', 'color: yellow; font-weight: bold');
  if (score < 100) {
    if (!allCriticalBlocked) {
      console.log('  1. 确保IP保护脚本已正确注入');
      console.log('  2. 检查ViewProxyIntegration.injectIPProtection()是否被调用');
    }
    if (results.webrtcLeaks && results.webrtcLeaks.length > 0) {
      console.log('  3. WebRTC泄露检测到，但这可能是因为IP保护脚本未生效');
      console.log('  4. 重新加载页面并再次测试');
    }
    console.log('  5. 访问 https://browserleaks.com 进行全面检测');
    console.log('  6. 访问 https://ipleak.net 检查DNS泄露');
  } else {
    console.log('  ✓ 代理配置正确，IP保护生效');
    console.log('  ✓ 建议定期检查以确保持续安全');
  }
  
  // 返回结果供进一步分析
  console.log('\n%c完整结果对象:', 'color: cyan');
  console.log(results);
  
  return results;
})();
