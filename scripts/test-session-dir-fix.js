/**
 * 测试sessionDir修复逻辑
 */

const AccountConfigManager = require('../src/managers/AccountConfigManager');
const path = require('path');
const os = require('os');
const fs = require('fs').promises;

async function testSessionDirFix() {
  console.log('=== 测试sessionDir修复逻辑 ===\n');
  
  // 创建临时目录
  const tempDir = path.join(os.tmpdir(), `test-session-dir-fix-${Date.now()}`);
  await fs.mkdir(tempDir, { recursive: true });
  
  try {
    // 创建管理器
    const manager = new AccountConfigManager({
      configName: 'test-session-dir',
      cwd: tempDir
    });
    
    // 测试1：创建新账号，sessionDir应该使用正确的ID
    console.log('测试1：创建新账号');
    const result1 = await manager.createAccount({ name: '测试账号1' });
    if (!result1.success) {
      throw new Error(`创建账号失败: ${result1.errors?.join(', ')}`);
    }
    
    const account1 = result1.account;
    const expectedSessionDir1 = `session-data/account-${account1.id}`;
    if (account1.sessionDir !== expectedSessionDir1) {
      throw new Error(`sessionDir不匹配: ${account1.sessionDir} != ${expectedSessionDir1}`);
    }
    console.log(`✓ 新账号sessionDir正确: ${account1.sessionDir}`);
    
    // 测试2：模拟旧配置（sessionDir中的ID与账号ID不匹配）
    console.log('\n测试2：模拟旧配置修复');
    
    // 手动创建有问题的配置
    const AccountConfig = require('../src/models/AccountConfig');
    const oldAccountId = 'old-account-id-123';
    const wrongSessionDirId = 'wrong-session-id-456';
    const oldAccountData = {
      id: oldAccountId,
      name: '旧账号',
      sessionDir: `session-data/account-${wrongSessionDirId}`
    };
    
    // 创建AccountConfig实例
    const oldAccount = new AccountConfig(oldAccountData);
    
    // 直接操作store来模拟旧配置
    manager.accountsCache.set(oldAccountId, oldAccount);
    manager._saveCacheToStore();
    
    // 重新加载触发修复逻辑
    manager._loadAccountsToCache();
    
    const fixedAccount = await manager.getAccount(oldAccountId);
    const expectedSessionDir2 = `session-data/account-${oldAccountId}`;
    
    if (!fixedAccount) {
      throw new Error('修复后账号不存在');
    }
    
    if (fixedAccount.sessionDir !== expectedSessionDir2) {
      throw new Error(`修复后sessionDir不匹配: ${fixedAccount.sessionDir} != ${expectedSessionDir2}`);
    }
    console.log(`✓ 旧配置修复成功: ${fixedAccount.sessionDir}`);
    
    // 测试3：验证修复后的配置已保存
    console.log('\n测试3：验证配置持久化');
    
    // 创建新管理器实例来验证持久化
    const manager2 = new AccountConfigManager({
      configName: 'test-session-dir',
      cwd: tempDir
    });
    
    const reloadedAccount = await manager2.getAccount(oldAccountId);
    if (!reloadedAccount) {
      throw new Error('重新加载后账号不存在');
    }
    
    if (reloadedAccount.sessionDir !== expectedSessionDir2) {
      throw new Error(`重新加载后sessionDir不匹配: ${reloadedAccount.sessionDir} != ${expectedSessionDir2}`);
    }
    console.log(`✓ 配置持久化正确: ${reloadedAccount.sessionDir}`);
    
    // 测试4：测试删除账号时的路径处理
    console.log('\n测试4：测试删除逻辑');
    const deleteResult = await manager.deleteAccount(account1.id, {
      deleteUserData: true,
      userDataPath: tempDir
    });
    
    if (!deleteResult.success) {
      throw new Error(`删除账号失败: ${deleteResult.errors?.join(', ')}`);
    }
    
    const deletedAccount = await manager.getAccount(account1.id);
    if (deletedAccount) {
      throw new Error('账号删除失败');
    }
    console.log('✓ 账号删除成功');
    
    console.log('\n✅ 所有测试通过！');
    
  } finally {
    // 清理临时目录
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      console.warn('清理临时目录失败:', error.message);
    }
  }
}

// 运行测试
testSessionDirFix().catch(error => {
  console.error('❌ 测试失败:', error.message);
  console.error(error.stack);
  process.exit(1);
});