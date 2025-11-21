/**
 * 检查账号的代理配置
 */

const AccountConfigManager = require('../src/managers/AccountConfigManager');
const path = require('path');
const os = require('os');

async function checkProxyConfig() {
  console.log('=== 检查账号代理配置 ===\n');
  
  // 使用实际的用户数据目录
  const userDataPath = path.join(os.homedir(), 'AppData', 'Roaming', 'whatsapp-desktop-translation');
  
  const manager = new AccountConfigManager({
    cwd: userDataPath
  });
  
  try {
    const accounts = await manager.loadAccounts();
    
    console.log(`找到 ${accounts.length} 个账号\n`);
    
    for (const account of accounts) {
      console.log(`账号: ${account.name} (${account.id})`);
      console.log(`代理配置:`);
      
      if (account.proxy && account.proxy.enabled) {
        console.log(`  ✓ 代理已启用`);
        console.log(`  协议: ${account.proxy.protocol}`);
        console.log(`  主机: ${account.proxy.host}`);
        console.log(`  端口: ${account.proxy.port}`);
        console.log(`  用户名: ${account.proxy.username || '(无)'}`);
        console.log(`  密码: ${account.proxy.password ? '***' : '(无)'}`);
        console.log(`  绕过规则: ${account.proxy.bypass || '(无)'}`);
      } else {
        console.log(`  ✗ 代理未启用`);
      }
      
      console.log('');
    }
  } catch (error) {
    console.error('检查失败:', error);
  }
}

checkProxyConfig();
