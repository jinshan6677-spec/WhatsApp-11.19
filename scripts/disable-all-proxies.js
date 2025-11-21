/**
 * 禁用所有账号的代理
 */

const AccountConfigManager = require('../src/managers/AccountConfigManager');
const path = require('path');
const os = require('os');

async function disableAllProxies() {
  console.log('=== 禁用所有账号的代理 ===\n');
  
  const userDataPath = path.join(os.homedir(), 'AppData', 'Roaming', 'whatsapp-desktop-translation');
  
  const manager = new AccountConfigManager({
    cwd: userDataPath
  });
  
  try {
    const accounts = await manager.loadAccounts();
    
    let disabledCount = 0;
    
    for (const account of accounts) {
      if (account.proxy && account.proxy.enabled) {
        console.log(`禁用账号 "${account.name}" 的代理...`);
        account.proxy.enabled = false;
        await manager.saveAccount(account);
        disabledCount++;
      }
    }
    
    console.log(`\n✓ 已禁用 ${disabledCount} 个账号的代理`);
    console.log('\n请重启应用以使更改生效');
  } catch (error) {
    console.error('操作失败:', error);
  }
}

disableAllProxies();
