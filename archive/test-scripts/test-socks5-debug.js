/**
 * SOCKS5 代理调试测试脚本
 * 
 * 用于诊断 Electron BrowserView 中 SOCKS5 代理认证问题
 * 
 * 使用方法：
 * 1. 修改下面的 PROXY_CONFIG 填入实际的代理凭据
 * 2. 运行: npx electron test-socks5-debug.js
 */

const { app, BrowserWindow, BrowserView, session } = require('electron');
const { SocksProxyAgent } = require('socks-proxy-agent');
const https = require('https');
const http = require('http');

// 代理配置 - 请填入实际的用户名和密码
const PROXY_CONFIG = {
  protocol: 'socks5',
  host: '72.60.203.176',
  port: 12111,
  // ⚠️ 请填入实际的用户名和密码
  username: process.env.PROXY_USER || 'YOUR_USERNAME',
  password: process.env.PROXY_PASS || 'YOUR_PASSWORD'
};

async function testNodeJsProxy() {
  console.log('\n=== 测试 1: Node.js SOCKS5 代理连接 ===');
  
  try {
    const agent = new SocksProxyAgent({
      hostname: PROXY_CONFIG.host,
      port: PROXY_CONFIG.port,
      username: PROXY_CONFIG.username,
      password: PROXY_CONFIG.password
    });

    const response = await new Promise((resolve, reject) => {
      const req = https.get('https://api.ipify.org?format=json', { agent }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve({ status: res.statusCode, data }));
      });
      req.on('error', reject);
      req.setTimeout(10000, () => reject(new Error('Timeout')));
    });

    console.log('✓ Node.js 代理连接成功');
    console.log('  响应:', response.data);
    return true;
  } catch (error) {
    console.log('✗ Node.js 代理连接失败:', error.message);
    return false;
  }
}

async function testElectronProxy() {
  console.log('\n=== 测试 2: Electron Session 代理配置 ===');
  
  // 创建测试 session
  const testSession = session.fromPartition('test-socks5-debug');
  
  // 测试不同的代理 URL 格式
  const formats = [
    {
      name: 'URL 嵌入凭据',
      rules: `socks5://${encodeURIComponent(PROXY_CONFIG.username)}:${encodeURIComponent(PROXY_CONFIG.password)}@${PROXY_CONFIG.host}:${PROXY_CONFIG.port}`
    },
    {
      name: 'SOCKS5H (主机名解析)',
      rules: `socks5h://${encodeURIComponent(PROXY_CONFIG.username)}:${encodeURIComponent(PROXY_CONFIG.password)}@${PROXY_CONFIG.host}:${PROXY_CONFIG.port}`
    },
    {
      name: '无凭据 (依赖 login 事件)',
      rules: `socks5://${PROXY_CONFIG.host}:${PROXY_CONFIG.port}`
    }
  ];

  for (const format of formats) {
    console.log(`\n--- 测试格式: ${format.name} ---`);
    console.log(`  规则: ${format.rules.replace(/:([^:@]+)@/, ':***@')}`);
    
    try {
      await testSession.setProxy({
        proxyRules: format.rules,
        proxyBypassRules: '<local>'
      });
      
      const resolution = await testSession.resolveProxy('https://web.whatsapp.com/');
      console.log(`  代理解析: ${resolution}`);
      
      // 检查是否正确解析
      if (resolution.includes('SOCKS') || resolution.includes('PROXY')) {
        console.log('  ✓ 代理规则配置成功');
      } else if (resolution === 'DIRECT') {
        console.log('  ✗ 代理规则未生效 (DIRECT)');
      }
    } catch (error) {
      console.log(`  ✗ 配置失败: ${error.message}`);
    }
  }
}

async function testBrowserViewLoading() {
  console.log('\n=== 测试 3: BrowserView 加载测试 ===');
  
  // 创建主窗口
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    show: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  // 创建测试 session
  const testSession = session.fromPartition('test-socks5-browserview');
  
  // 配置代理
  const proxyUrl = `socks5://${encodeURIComponent(PROXY_CONFIG.username)}:${encodeURIComponent(PROXY_CONFIG.password)}@${PROXY_CONFIG.host}:${PROXY_CONFIG.port}`;
  
  console.log('配置代理...');
  await testSession.setProxy({
    proxyRules: proxyUrl,
    proxyBypassRules: '<local>'
  });

  // 设置 login 事件监听
  testSession.on('login', (event, details, authInfo, callback) => {
    console.log('\n=== LOGIN 事件触发 ===');
    console.log('  URL:', details?.url || 'N/A');
    console.log('  isProxy:', authInfo.isProxy);
    console.log('  scheme:', authInfo.scheme);
    console.log('  host:', authInfo.host);
    console.log('  port:', authInfo.port);
    console.log('  realm:', authInfo.realm);
    
    if (authInfo.isProxy) {
      console.log('  提供凭据...');
      event.preventDefault();
      callback(PROXY_CONFIG.username, PROXY_CONFIG.password);
    } else {
      callback();
    }
  });

  // 创建 BrowserView
  const view = new BrowserView({
    webPreferences: {
      session: testSession,
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  mainWindow.addBrowserView(view);
  view.setBounds({ x: 0, y: 0, width: 1200, height: 800 });

  // 监听加载事件
  view.webContents.on('did-start-loading', () => {
    console.log('\n[BrowserView] 开始加载...');
  });

  view.webContents.on('did-finish-load', () => {
    console.log('[BrowserView] ✓ 加载完成!');
  });

  view.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    console.log('\n[BrowserView] ✗ 加载失败!');
    console.log('  错误代码:', errorCode);
    console.log('  错误描述:', errorDescription);
    console.log('  URL:', validatedURL);
    
    // 常见 SOCKS 错误代码
    const errorMap = {
      '-120': 'ERR_SOCKS_CONNECTION_FAILED',
      '-130': 'ERR_PROXY_CONNECTION_FAILED',
      '-125': 'ERR_TUNNEL_CONNECTION_FAILED',
      '-106': 'ERR_INTERNET_DISCONNECTED',
      '-118': 'ERR_PROXY_AUTH_UNSUPPORTED',
      '-21': 'ERR_NETWORK_ACCESS_DENIED',
      '-7': 'ERR_TIMED_OUT',
      '-2': 'ERR_FAILED'
    };
    
    if (errorMap[errorCode.toString()]) {
      console.log('  错误类型:', errorMap[errorCode.toString()]);
    }
  });

  view.webContents.on('did-navigate', (event, url) => {
    console.log('[BrowserView] 导航到:', url);
  });

  // 监听证书错误
  view.webContents.on('certificate-error', (event, url, error, certificate, callback) => {
    console.log('\n[BrowserView] 证书错误!');
    console.log('  URL:', url);
    console.log('  错误:', error);
    callback(false); // 不忽略证书错误
  });

  // 加载测试页面
  console.log('\n尝试加载 https://api.ipify.org/...');
  
  try {
    await view.webContents.loadURL('https://api.ipify.org/');
    console.log('✓ 简单页面加载成功');
    
    // 获取页面内容
    const content = await view.webContents.executeJavaScript('document.body.innerText');
    console.log('  IP:', content);
    
    // 尝试加载 WhatsApp
    console.log('\n尝试加载 https://web.whatsapp.com/...');
    await view.webContents.loadURL('https://web.whatsapp.com/');
    
  } catch (error) {
    console.log('✗ 加载失败:', error.message);
  }

  // 保持窗口打开以便观察
  console.log('\n窗口将保持打开状态，按 Ctrl+C 退出...');
}

async function main() {
  console.log('='.repeat(60));
  console.log('SOCKS5 代理调试测试');
  console.log('='.repeat(60));
  console.log('\n代理配置:');
  console.log('  主机:', PROXY_CONFIG.host);
  console.log('  端口:', PROXY_CONFIG.port);
  console.log('  用户名:', PROXY_CONFIG.username ? '***' : '未设置');
  console.log('  密码:', PROXY_CONFIG.password ? '***' : '未设置');
  console.log('\nElectron 版本:', process.versions.electron);
  console.log('Chromium 版本:', process.versions.chrome);
  console.log('Node.js 版本:', process.versions.node);

  // 测试 1: Node.js 代理
  await testNodeJsProxy();
  
  // 测试 2 和 3 需要 Electron app ready
  await app.whenReady();
  
  // 测试 2: Electron Session 代理配置
  await testElectronProxy();
  
  // 测试 3: BrowserView 加载
  await testBrowserViewLoading();
}

main().catch(console.error);
