/**
 * 快速禁用所有账户的代理配置
 * 
 * 用于紧急情况下快速恢复应用正常运行
 */

const fs = require('fs');
const path = require('path');

const ACCOUNTS_FILE = path.join(__dirname, '../userData/accounts.json');

function disableAllProxies() {
  console.log('='.repeat(60));
  console.log('快速禁用所有代理配置');
  console.log('='.repeat(60));
  console.log('');
  
  // 检查文件是否存在
  if (!fs.existsSync(ACCOUNTS_FILE)) {
    console.log('✓ 账户配置文件不存在，无需操作');
    return;
  }
  
  try {
    // 读取账户配置
    const accountsData = fs.readFileSync(ACCOUNTS_FILE, 'utf8');
    const accounts = JSON.parse(accountsData);
    
    if (!Array.isArray(accounts) || accounts.length === 0) {
      console.log('✓ 没有账户配置，无需操作');
      return;
    }
    
    console.log(`找到 ${accounts.length} 个账户配置`);
    console.log('');
    
    let modifiedCount = 0;
    
    // 禁用所有账户的代理
    accounts.forEach((account, index) => {
      if (account.proxy && account.proxy.enabled) {
        console.log(`账户 ${index + 1}: ${account.name || account.id}`);
        console.log(`  当前代理: ${account.proxy.protocol}://${account.proxy.host}:${account.proxy.port}`);
        console.log(`  操作: 禁用代理`);
        
        account.proxy.enabled = false;
        modifiedCount++;
      }
    });
    
    console.log('');
    
    if (modifiedCount === 0) {
      console.log('✓ 所有账户的代理已经是禁用状态');
      return;
    }
    
    // 备份原文件
    const backupFile = ACCOUNTS_FILE + '.backup.' + Date.now();
    fs.copyFileSync(ACCOUNTS_FILE, backupFile);
    console.log(`✓ 已备份原配置到: ${path.basename(backupFile)}`);
    
    // 保存修改后的配置
    fs.writeFileSync(ACCOUNTS_FILE, JSON.stringify(accounts, null, 2), 'utf8');
    console.log(`✓ 已禁用 ${modifiedCount} 个账户的代理配置`);
    console.log('');
    console.log('='.repeat(60));
    console.log('操作完成！现在可以重新启动应用了');
    console.log('='.repeat(60));
    
  } catch (error) {
    console.error('✗ 操作失败:', error.message);
    process.exit(1);
  }
}

disableAllProxies();
