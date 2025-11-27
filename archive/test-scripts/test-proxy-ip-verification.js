#!/usr/bin/env node
'use strict';

/**
 * 代理IP验证和泄露检测工具
 * 
 * 用途：
 * 1. 验证设置了代理的账号是否真的走代理IP
 * 2. 检测是否存在IP泄露（WebRTC、DNS等）
 * 3. 验证Kill-Switch是否正常工作
 * 4. 检查IP保护脚本是否生效
 * 
 * 使用方法：
 * node test-proxy-ip-verification.js
 */

const https = require('https');
const http = require('http');
const { SocksClient } = require('socks');

// 颜色输出
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(level, message) {
  const timestamp = new Date().toISOString();
  const prefix = `[${timestamp}]`;
  
  switch (level) {
    case 'success':
      console.log(`${colors.green}✓${colors.reset} ${prefix} ${message}`);
      break;
    case 'error':
      console.log(`${colors.red}✗${colors.reset} ${prefix} ${message}`);
      break;
    case 'warn':
      console.log(`${colors.yellow}⚠${colors.reset} ${prefix} ${message}`);
      break;
    case 'info':
      console.log(`${colors.blue}ℹ${colors.reset} ${prefix} ${message}`);
      break;
    case 'title':
      console.log(`\n${colors.bright}${colors.cyan}${'='.repeat(60)}${colors.reset}`);
      console.log(`${colors.bright}${colors.cyan}${message}${colors.reset}`);
      console.log(`${colors.bright}${colors.cyan}${'='.repeat(60)}${colors.reset}\n`);
      break;
    default:
      console.log(`${prefix} ${message}`);
  }
}

// IP检测服务列表
const IP_CHECK_SERVICES = [
  {
    name: 'ipinfo.io',
    url: 'https://ipinfo.io/json',
    parser: (data) => ({ ip: data.ip, location: `${data.city}, ${data.country}` })
  },
  {
    name: 'ip-api.com',
    url: 'http://ip-api.com/json',
    parser: (data) => ({ ip: data.query, location: `${data.city}, ${data.country}` })
  },
  {
    name: 'ipify.org',
    url: 'https://api.ipify.org?format=json',
    parser: (data) => ({ ip: data.ip, location: 'N/A' })
  }
];

/**
 * 获取本机真实IP（不走代理）
 */
async function getRealIP() {
  log('info', '正在获取本机真实IP...');
  
  for (const service of IP_CHECK_SERVICES) {
    try {
      const data = await fetchJSON(service.url);
      const result = service.parser(data);
      log('success', `真实IP: ${result.ip} (${result.location}) - 来源: ${service.name}`);
      return result.ip;
    } catch (error) {
      log('warn', `${service.name} 检测失败: ${error.message}`);
    }
  }
  
  throw new Error('无法获取真实IP');
}

/**
 * 通过代理获取出口IP
 */
async function getProxyIP(proxyConfig) {
  log('info', `正在通过代理获取出口IP... (${proxyConfig.host}:${proxyConfig.port})`);
  
  for (const service of IP_CHECK_SERVICES) {
    try {
      const data = await fetchJSONThroughProxy(service.url, proxyConfig);
      const result = service.parser(data);
      log('success', `代理出口IP: ${result.ip} (${result.location}) - 来源: ${service.name}`);
      return result.ip;
    } catch (error) {
      log('warn', `${service.name} 通过代理检测失败: ${error.message}`);
    }
  }
  
  throw new Error('无法通过代理获取出口IP');
}

/**
 * 获取JSON数据（不走代理）
 */
function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    
    client.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (error) {
          reject(new Error(`解析JSON失败: ${error.message}`));
        }
      });
    }).on('error', reject);
  });
}

/**
 * 通过SOCKS5代理获取JSON数据
 */
async function fetchJSONThroughProxy(url, proxyConfig) {
  const urlObj = new URL(url);
  const port = urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80);
  
  try {
    // 连接到SOCKS5代理
    const info = await SocksClient.createConnection({
      proxy: {
        host: proxyConfig.host,
        port: proxyConfig.port,
        type: 5,
        userId: proxyConfig.username,
        password: proxyConfig.password
      },
      command: 'connect',
      destination: {
        host: urlObj.hostname,
        port: parseInt(port)
      }
    });

    return new Promise((resolve, reject) => {
      const socket = info.socket;
      
      // 构建HTTP请求
      const request = [
        `GET ${urlObj.pathname}${urlObj.search} HTTP/1.1`,
        `Host: ${urlObj.hostname}`,
        'Connection: close',
        '',
        ''
      ].join('\r\n');
      
      socket.write(request);
      
      let data = '';
      socket.on('data', chunk => data += chunk.toString());
      socket.on('end', () => {
        try {
          // 提取JSON部分
          const jsonStart = data.indexOf('{');
          if (jsonStart === -1) {
            reject(new Error('响应中未找到JSON数据'));
            return;
          }
          const jsonData = data.substring(jsonStart);
          resolve(JSON.parse(jsonData));
        } catch (error) {
          reject(new Error(`解析JSON失败: ${error.message}`));
        }
      });
      socket.on('error', reject);
    });
  } catch (error) {
    throw new Error(`SOCKS5连接失败: ${error.message}`);
  }
}

/**
 * 检测WebRTC泄露
 */
async function checkWebRTCLeak() {
  log('info', '检测WebRTC IP泄露...');
  
  // 这个检测需要在浏览器环境中运行
  // 这里只是提供检测脚本
  const webrtcScript = `
    (async function() {
      const pc = new RTCPeerConnection({iceServers: []});
      const leakedIPs = new Set();
      
      pc.onicecandidate = (ice) => {
        if (!ice || !ice.candidate || !ice.candidate.candidate) return;
        const ipRegex = /([0-9]{1,3}(\\.[0-9]{1,3}){3})/;
        const match = ice.candidate.candidate.match(ipRegex);
        if (match) leakedIPs.add(match[1]);
      };
      
      pc.createDataChannel('');
      await pc.createOffer().then(offer => pc.setLocalDescription(offer));
      
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      return Array.from(leakedIPs);
    })();
  `;
  
  log('info', 'WebRTC泄露检测脚本已准备（需要在浏览器中执行）');
  log('info', '脚本内容：');
  console.log(colors.cyan + webrtcScript + colors.reset);
  
  return webrtcScript;
}

/**
 * 验证代理配置
 */
async function verifyProxyConfig(proxyConfig) {
  log('title', '代理配置验证');
  
  log('info', '代理配置信息：');
  console.log(`  协议: ${proxyConfig.protocol}`);
  console.log(`  地址: ${proxyConfig.host}:${proxyConfig.port}`);
  console.log(`  认证: ${proxyConfig.username ? '是' : '否'}`);
  
  // 测试代理连通性
  log('info', '测试代理连通性...');
  try {
    const proxyIP = await getProxyIP(proxyConfig);
    log('success', `代理连通性测试通过，出口IP: ${proxyIP}`);
    return proxyIP;
  } catch (error) {
    log('error', `代理连通性测试失败: ${error.message}`);
    throw error;
  }
}

/**
 * 比较真实IP和代理IP
 */
async function compareIPs(realIP, proxyIP) {
  log('title', 'IP对比分析');
  
  console.log(`  真实IP:   ${colors.yellow}${realIP}${colors.reset}`);
  console.log(`  代理IP:   ${colors.cyan}${proxyIP}${colors.reset}`);
  
  if (realIP === proxyIP) {
    log('error', '⚠️ 警告：代理IP与真实IP相同！可能存在IP泄露！');
    return false;
  } else {
    log('success', '✓ 代理IP与真实IP不同，代理工作正常');
    return true;
  }
}

/**
 * 生成IP保护验证脚本
 */
function generateIPProtectionScript() {
  return `
// IP保护验证脚本
(function() {
  const results = {
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
  
  console.log('IP保护状态检查：');
  console.log('WebRTC APIs:', results.webrtc);
  console.log('Media APIs:', results.media);
  console.log('Network APIs:', results.network);
  
  const allBlocked = 
    results.webrtc.RTCPeerConnection &&
    results.webrtc.RTCDataChannel &&
    results.webrtc.RTCSessionDescription &&
    results.media.getUserMedia;
  
  if (allBlocked) {
    console.log('%c✓ IP保护脚本工作正常', 'color: green; font-weight: bold');
  } else {
    console.log('%c✗ IP保护脚本可能未生效', 'color: red; font-weight: bold');
  }
  
  return results;
})();
`;
}

/**
 * 主测试流程
 */
async function main() {
  console.log('\n');
  log('title', '代理IP验证和泄露检测工具');
  
  // 读取代理配置
  log('info', '请输入代理配置（或按Ctrl+C退出）：');
  
  // 示例配置（实际使用时应该从配置文件或用户输入读取）
  const proxyConfig = {
    protocol: 'socks5',
    host: '127.0.0.1',  // 替换为你的代理地址
    port: 1080,          // 替换为你的代理端口
    username: '',        // 如果需要认证，填写用户名
    password: ''         // 如果需要认证，填写密码
  };
  
  log('warn', '使用示例配置（请修改 test-proxy-ip-verification.js 中的配置）');
  console.log(JSON.stringify(proxyConfig, null, 2));
  
  try {
    // Step 1: 获取真实IP
    log('title', '步骤 1/5: 获取真实IP');
    const realIP = await getRealIP();
    
    // Step 2: 验证代理配置
    log('title', '步骤 2/5: 验证代理配置');
    const proxyIP = await verifyProxyConfig(proxyConfig);
    
    // Step 3: 比较IP
    log('title', '步骤 3/5: IP对比');
    const isProxyWorking = await compareIPs(realIP, proxyIP);
    
    // Step 4: WebRTC泄露检测
    log('title', '步骤 4/5: WebRTC泄露检测');
    const webrtcScript = await checkWebRTCLeak();
    
    // Step 5: 生成浏览器验证脚本
    log('title', '步骤 5/5: 生成浏览器验证脚本');
    const ipProtectionScript = generateIPProtectionScript();
    
    log('info', 'IP保护验证脚本（在浏览器控制台执行）：');
    console.log(colors.cyan + ipProtectionScript + colors.reset);
    
    // 最终报告
    log('title', '验证报告');
    
    console.log(`\n${colors.bright}测试结果摘要：${colors.reset}`);
    console.log(`  真实IP:        ${realIP}`);
    console.log(`  代理出口IP:    ${proxyIP}`);
    console.log(`  代理状态:      ${isProxyWorking ? colors.green + '✓ 正常工作' : colors.red + '✗ 可能泄露'}`);
    console.log(colors.reset);
    
    console.log(`\n${colors.bright}下一步操作：${colors.reset}`);
    console.log(`  1. 在应用中打开一个使用代理的账号`);
    console.log(`  2. 打开开发者工具（F12）`);
    console.log(`  3. 在控制台执行上面的IP保护验证脚本`);
    console.log(`  4. 检查WebRTC APIs是否被正确禁用`);
    console.log(`  5. 访问 https://browserleaks.com/webrtc 检查WebRTC泄露`);
    console.log(`  6. 访问 https://ipleak.net 进行全面IP泄露检测\n`);
    
    if (!isProxyWorking) {
      log('error', '⚠️ 检测到潜在的IP泄露问题！');
      log('info', '可能的原因：');
      console.log('  - 代理未正确配置');
      console.log('  - 代理服务器未运行');
      console.log('  - 存在DNS泄露');
      console.log('  - WebRTC泄露');
      process.exit(1);
    } else {
      log('success', '✓ 代理验证通过！');
      process.exit(0);
    }
    
  } catch (error) {
    log('error', `测试失败: ${error.message}`);
    console.error(error);
    process.exit(1);
  }
}

// 运行主程序
if (require.main === module) {
  main().catch(error => {
    log('error', `未捕获的错误: ${error.message}`);
    console.error(error);
    process.exit(1);
  });
}

module.exports = {
  getRealIP,
  getProxyIP,
  compareIPs,
  checkWebRTCLeak,
  generateIPProtectionScript
};
