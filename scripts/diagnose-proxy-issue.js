/**
 * 代理问题诊断工具
 * 
 * 这个脚本会帮助诊断代理配置导致的启动和崩溃问题
 */

const { app, session, BrowserWindow } = require('electron');
const path = require('path');

// 代理配置（从你的实际配置中获取）
const PROXY_CONFIG = {
  protocol: 'socks5',
  host: '72.60.203.176',
  port: 12111,
  username: 'txy',
  password: '' // 填入实际密码
};

let testWindow = null;
let testResults = {
  proxyConfigTime: null,
  proxyConfigSuccess: false,
  proxyConfigError: null,
  pageLoadTime: null,
  pageLoadSuccess: false,
  pageLoadError: null,
  directLoadTime: null,
  directLoadSuccess: false,
  directLoadError: null
};

async function runDiagnostics() {
  console.log('='.repeat(60));
  console.log('代理问题诊断工具');
  console.log('='.repeat(60));
  console.log('');
  
  // 测试 1: 代理配置测试
  console.log('测试 1: 代理配置速度测试');
  console.log('-'.repeat(60));
  await testProxyConfiguration();
  console.log('');
  
  // 测试 2: 通过代理加载 WhatsApp
  console.log('测试 2: 通过代理加载 WhatsApp Web');
  console.log('-'.repeat(60));
  await testProxyLoad();
  console.log('');
  
  // 测试 3: 直连加载 WhatsApp（对比）
  console.log('测试 3: 直连加载 WhatsApp Web（对比）');
  console.log('-'.repeat(60));
  await testDirectLoad();
  console.log('');
  
  // 输出诊断结果
  console.log('='.repeat(60));
  console.log('诊断结果汇总');
  console.log('='.repeat(60));
  printDiagnosticResults();
  
  // 退出
  setTimeout(() => {
    app.quit();
  }, 2000);
}

async function testProxyConfiguration() {
  try {
    const testSession = session.fromPartition('persist:proxy-test');
    
    const { protocol, host, port, username, password } = PROXY_CONFIG;
    
    if (!password) {
      console.log('❌ 错误: 未提供代理密码');
      testResults.proxyConfigSuccess = false;
      testResults.proxyConfigError = '未提供代理密码';
      return;
    }
    
    // 构建代理规则
    let proxyRules;
    if (protocol === 'socks5') {
      if (username && password) {
        proxyRules = `${protocol}://${username}:${password}@${host}:${port}`;
      } else {
        proxyRules = `${protocol}://${host}:${port}`;
      }
    } else {
      proxyRules = `${protocol}://${host}:${port}`;
    }
    
    console.log(`代理配置: ${proxyRules.replace(/:([^:@]+)@/, ':***@')}`);
    
    const startTime = Date.now();
    
    // 设置代理（添加超时）
    const configPromise = testSession.setProxy({
      proxyRules,
      proxyBypassRules: 'localhost,127.0.0.1'
    });
    
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('代理配置超时（5秒）')), 5000);
    });
    
    await Promise.race([configPromise, timeoutPromise]);
    
    const configTime = Date.now() - startTime;
    testResults.proxyConfigTime = configTime;
    testResults.proxyConfigSuccess = true;
    
    console.log(`✓ 代理配置成功，耗时: ${configTime}ms`);
    
    if (configTime > 1000) {
      console.log(`⚠️  警告: 代理配置耗时过长（${configTime}ms），可能导致启动缓慢`);
    }
  } catch (error) {
    testResults.proxyConfigSuccess = false;
    testResults.proxyConfigError = error.message;
    console.log(`✗ 代理配置失败: ${error.message}`);
  }
}

async function testProxyLoad() {
  if (!testResults.proxyConfigSuccess) {
    console.log('⊘ 跳过测试（代理配置失败）');
    return;
  }
  
  try {
    const testSession = session.fromPartition('persist:proxy-test');
    
    testWindow = new BrowserWindow({
      width: 1200,
      height: 800,
      show: false,
      webPreferences: {
        session: testSession,
        nodeIntegration: false,
        contextIsolation: true
      }
    });
    
    const startTime = Date.now();
    let loadTimeout = null;
    let errorOccurred = false;
    
    // 监听加载错误
    testWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
      if (errorCode === -3) return; // 忽略 ERR_ABORTED
      
      errorOccurred = true;
      const loadTime = Date.now() - startTime;
      testResults.pageLoadTime = loadTime;
      testResults.pageLoadSuccess = false;
      testResults.pageLoadError = `${errorDescription} (${errorCode})`;
      
      console.log(`✗ 页面加载失败 (${loadTime}ms): ${errorDescription} (${errorCode})`);
      
      // 检查是否是代理错误
      const proxyErrors = {
        '-120': 'SOCKS 代理连接失败',
        '-130': '代理连接失败',
        '-125': '代理隧道连接失败',
        '-106': '无法连接到代理服务器',
        '-118': '代理认证失败'
      };
      
      if (proxyErrors[errorCode.toString()]) {
        console.log(`   ⚠️  这是一个代理相关错误: ${proxyErrors[errorCode.toString()]}`);
      }
      
      if (loadTimeout) clearTimeout(loadTimeout);
    });
    
    // 监听加载成功
    testWindow.webContents.on('did-finish-load', () => {
      if (errorOccurred) return;
      
      const loadTime = Date.now() - startTime;
      testResults.pageLoadTime = loadTime;
      testResults.pageLoadSuccess = true;
      
      console.log(`✓ 页面加载成功，耗时: ${loadTime}ms`);
      
      if (loadTime > 10000) {
        console.log(`   ⚠️  警告: 加载时间过长（${loadTime}ms），用户体验较差`);
      }
      
      if (loadTimeout) clearTimeout(loadTimeout);
    });
    
    // 设置超时（30秒）
    loadTimeout = setTimeout(() => {
      if (!errorOccurred && !testResults.pageLoadSuccess) {
        testResults.pageLoadSuccess = false;
        testResults.pageLoadError = '加载超时（30秒）';
        console.log('✗ 页面加载超时（30秒）');
      }
    }, 30000);
    
    console.log('开始加载 WhatsApp Web...');
    await testWindow.loadURL('https://web.whatsapp.com');
    
    // 等待一段时间确保加载完成
    await new Promise(resolve => setTimeout(resolve, 5000));
    
  } catch (error) {
    testResults.pageLoadSuccess = false;
    testResults.pageLoadError = error.message;
    console.log(`✗ 加载失败: ${error.message}`);
  } finally {
    if (testWindow && !testWindow.isDestroyed()) {
      testWindow.close();
      testWindow = null;
    }
  }
}

async function testDirectLoad() {
  try {
    const testSession = session.fromPartition('persist:direct-test');
    
    // 清除代理配置
    await testSession.setProxy({ proxyRules: '' });
    
    testWindow = new BrowserWindow({
      width: 1200,
      height: 800,
      show: false,
      webPreferences: {
        session: testSession,
        nodeIntegration: false,
        contextIsolation: true
      }
    });
    
    const startTime = Date.now();
    let loadTimeout = null;
    let errorOccurred = false;
    
    testWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
      if (errorCode === -3) return;
      
      errorOccurred = true;
      const loadTime = Date.now() - startTime;
      testResults.directLoadTime = loadTime;
      testResults.directLoadSuccess = false;
      testResults.directLoadError = `${errorDescription} (${errorCode})`;
      
      console.log(`✗ 直连加载失败 (${loadTime}ms): ${errorDescription} (${errorCode})`);
      
      if (loadTimeout) clearTimeout(loadTimeout);
    });
    
    testWindow.webContents.on('did-finish-load', () => {
      if (errorOccurred) return;
      
      const loadTime = Date.now() - startTime;
      testResults.directLoadTime = loadTime;
      testResults.directLoadSuccess = true;
      
      console.log(`✓ 直连加载成功，耗时: ${loadTime}ms`);
      
      if (loadTimeout) clearTimeout(loadTimeout);
    });
    
    loadTimeout = setTimeout(() => {
      if (!errorOccurred && !testResults.directLoadSuccess) {
        testResults.directLoadSuccess = false;
        testResults.directLoadError = '加载超时（30秒）';
        console.log('✗ 直连加载超时（30秒）');
      }
    }, 30000);
    
    console.log('开始直连加载 WhatsApp Web...');
    await testWindow.loadURL('https://web.whatsapp.com');
    
    await new Promise(resolve => setTimeout(resolve, 5000));
    
  } catch (error) {
    testResults.directLoadSuccess = false;
    testResults.directLoadError = error.message;
    console.log(`✗ 直连加载失败: ${error.message}`);
  } finally {
    if (testWindow && !testWindow.isDestroyed()) {
      testWindow.close();
      testWindow = null;
    }
  }
}

function printDiagnosticResults() {
  console.log('');
  console.log('1. 代理配置:');
  if (testResults.proxyConfigSuccess) {
    console.log(`   ✓ 成功 (${testResults.proxyConfigTime}ms)`);
  } else {
    console.log(`   ✗ 失败: ${testResults.proxyConfigError}`);
  }
  
  console.log('');
  console.log('2. 代理加载:');
  if (testResults.pageLoadSuccess) {
    console.log(`   ✓ 成功 (${testResults.pageLoadTime}ms)`);
  } else {
    console.log(`   ✗ 失败: ${testResults.pageLoadError || '未测试'}`);
  }
  
  console.log('');
  console.log('3. 直连加载:');
  if (testResults.directLoadSuccess) {
    console.log(`   ✓ 成功 (${testResults.directLoadTime}ms)`);
  } else {
    console.log(`   ✗ 失败: ${testResults.directLoadError || '未测试'}`);
  }
  
  console.log('');
  console.log('='.repeat(60));
  console.log('诊断建议:');
  console.log('='.repeat(60));
  
  if (!testResults.proxyConfigSuccess) {
    console.log('❌ 代理配置失败');
    console.log('   建议: 检查代理服务器地址、端口和认证信息是否正确');
  } else if (!testResults.pageLoadSuccess && testResults.directLoadSuccess) {
    console.log('❌ 代理可以配置但无法加载页面，直连正常');
    console.log('   建议: 代理服务器可能无法访问 WhatsApp，或者速度太慢');
    console.log('   解决方案: 暂时使用直连，或更换代理服务器');
  } else if (!testResults.pageLoadSuccess && !testResults.directLoadSuccess) {
    console.log('❌ 代理和直连都无法加载');
    console.log('   建议: 检查网络连接，可能是本地网络问题');
  } else if (testResults.pageLoadSuccess && testResults.pageLoadTime > 10000) {
    console.log('⚠️  代理可以工作但速度很慢');
    console.log(`   代理加载时间: ${testResults.pageLoadTime}ms`);
    console.log(`   直连加载时间: ${testResults.directLoadTime}ms`);
    console.log('   建议: 考虑更换更快的代理服务器');
  } else if (testResults.pageLoadSuccess) {
    console.log('✓ 代理工作正常');
    console.log(`   代理加载时间: ${testResults.pageLoadTime}ms`);
    console.log(`   直连加载时间: ${testResults.directLoadTime}ms`);
  }
  
  console.log('');
}

// Electron app ready
app.whenReady().then(() => {
  runDiagnostics();
});

app.on('window-all-closed', () => {
  // 不退出，等待诊断完成
});
