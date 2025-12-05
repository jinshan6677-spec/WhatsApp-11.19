const fs = require('fs').promises;
const path = require('path');

async function fixAccountSessionDirs() {
  console.log('=== 开始修复账号sessionDir路径 ===\n');
  
  // 配置文件路径
  const configPath = path.join(process.env.APPDATA, 'whatsapp-desktop-translation', 'accounts.json');
  
  try {
    // 读取配置文件
    const configData = await fs.readFile(configPath, 'utf8');
    const config = JSON.parse(configData);
    
    if (!config.accounts || typeof config.accounts !== 'object') {
      console.log('❌ 配置文件格式错误：缺少accounts字段');
      return;
    }
    
    let fixedCount = 0;
    const accounts = config.accounts;
    
    // 检查并修复每个账号
    for (const [accountId, account] of Object.entries(accounts)) {
      // 实际存储路径：Partitions/account_{id}
      const actualPath = `Partitions/account_${accountId}`;
      
      if (!account.sessionDir) {
        console.log(`⚠️  账号 ${accountId} (${account.name}) 缺少sessionDir字段`);
        account.sessionDir = actualPath;
        fixedCount++;
        continue;
      }
      
      // 检查sessionDir是否正确指向实际存储路径
      const sessionDirMatch = account.sessionDir.match(/(?:account[_-])([a-f0-9-]+)/);
      if (sessionDirMatch) {
        const sessionDirId = sessionDirMatch[1];
        if (sessionDirId !== accountId || account.sessionDir !== actualPath) {
          console.log(`🔧 修复账号 ${accountId} (${account.name})：`);
          console.log(`   原sessionDir: ${account.sessionDir}`);
          console.log(`   账号ID: ${accountId}`);
          console.log(`   sessionDir中的ID: ${sessionDirId}`);
          console.log(`   实际存储路径: ${actualPath}`);
          
          // 修复sessionDir指向实际存储路径
          account.sessionDir = actualPath;
          console.log(`   新sessionDir: ${account.sessionDir}
`);
          fixedCount++;
        }
      } else {
        // sessionDir格式不正确
        console.log(`⚠️  账号 ${accountId} (${account.name}) 的sessionDir格式不正确：${account.sessionDir}`);
        account.sessionDir = actualPath;
        fixedCount++;
      }
    }
    
    if (fixedCount > 0) {
      // 保存修复后的配置
      await fs.writeFile(configPath, JSON.stringify(config, null, '\t'));
      console.log(`✅ 成功修复 ${fixedCount} 个账号的sessionDir路径`);
      console.log(`📁 配置文件已更新：${configPath}`);
      
      // 创建备份
      const backupPath = configPath + '.backup-' + new Date().toISOString().replace(/[:.]/g, '-');
      await fs.writeFile(backupPath, configData);
      console.log(`💾 原始配置已备份到：${backupPath}`);
    } else {
      console.log('✅ 所有账号的sessionDir路径都正确，无需修复');
    }
    
    // 显示修复后的账号信息
    console.log('\n=== 修复后的账号信息 ===');
    for (const [accountId, account] of Object.entries(accounts)) {
      console.log(`\n账号: ${account.name} (${accountId})`);
      console.log(`  sessionDir: ${account.sessionDir}`);
      console.log(`  order: ${account.order}`);
      console.log(`  autoStart: ${account.autoStart}`);
    }
    
  } catch (error) {
    console.error('❌ 修复过程中出错：', error.message);
    if (error.code === 'ENOENT') {
      console.log('💡 提示：请确保应用已运行过，或者手动创建账号');
    }
  }
}

// 运行修复
fixAccountSessionDirs().catch(console.error);