/**
 * MainApplicationWindow 使用示例
 * 
 * 演示如何使用主应用窗口管理类
 */

const { app } = require('electron');
const MainApplicationWindow = require('../container/MainApplicationWindow');
const AccountConfigManager = require('../managers/AccountConfigManager');
const InstanceManager = require('../managers/InstanceManager');
const { registerIPCHandlers } = require('../container/ipcHandlers');

// 初始化管理器
let mainWindow;
let configManager;
let instanceManager;

/**
 * 应用启动
 */
app.whenReady().then(async () => {
  console.log('=== MainApplicationWindow 示例 ===\n');

  // 1. 创建配置管理器
  console.log('1. 初始化配置管理器...');
  configManager = new AccountConfigManager();
  await configManager.initialize();
  console.log('   ✓ 配置管理器初始化完成\n');

  // 2. 创建实例管理器
  console.log('2. 初始化实例管理器...');
  instanceManager = new InstanceManager(configManager);
  console.log('   ✓ 实例管理器初始化完成\n');

  // 3. 创建主窗口
  console.log('3. 创建主应用窗口...');
  mainWindow = new MainApplicationWindow();
  mainWindow.initialize();
  console.log('   ✓ 主窗口创建完成\n');

  // 4. 注册 IPC 处理器
  console.log('4. 注册 IPC 处理器...');
  registerIPCHandlers(configManager, instanceManager, mainWindow);
  console.log('   ✓ IPC 处理器注册完成\n');

  // 5. 加载并渲染账号列表
  console.log('5. 加载账号列表...');
  const accounts = await configManager.loadAccounts();
  console.log(`   ✓ 加载了 ${accounts.length} 个账号\n`);

  // 附加状态信息
  const accountsWithStatus = accounts.map(account => {
    const status = instanceManager.getInstanceStatus(account.id);
    return {
      ...account,
      status: status?.status || 'stopped',
      unreadCount: status?.unreadCount || 0
    };
  });

  mainWindow.renderAccountList(accountsWithStatus);
  console.log('   ✓ 账号列表已渲染\n');

  // 6. 监听实例状态变化
  console.log('6. 设置状态监听...');
  setInterval(() => {
    const runningInstances = instanceManager.getRunningInstances();
    runningInstances.forEach(instanceId => {
      const status = instanceManager.getInstanceStatus(instanceId);
      if (status) {
        mainWindow.updateAccountStatus(instanceId, {
          status: status.status,
          unreadCount: status.unreadCount,
          lastActiveAt: status.lastHeartbeat
        });
      }
    });
  }, 5000);
  console.log('   ✓ 状态监听已设置（每 5 秒更新）\n');

  console.log('=== 主窗口已启动 ===');
  console.log('现在可以通过 UI 进行以下操作：');
  console.log('  • 添加新账号');
  console.log('  • 编辑账号配置');
  console.log('  • 启动/停止/重启账号实例');
  console.log('  • 删除账号');
  console.log('  • 搜索和过滤账号');
  console.log('  • 切换主题\n');
});

/**
 * 所有窗口关闭
 */
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

/**
 * 应用退出前清理
 */
app.on('before-quit', async () => {
  console.log('\n清理资源...');
  
  // 停止所有运行中的实例
  const runningInstances = instanceManager.getRunningInstances();
  for (const instanceId of runningInstances) {
    try {
      await instanceManager.destroyInstance(instanceId);
      console.log(`  ✓ 实例 ${instanceId} 已停止`);
    } catch (error) {
      console.error(`  ✗ 停止实例 ${instanceId} 失败:`, error.message);
    }
  }
  
  console.log('清理完成');
});

/**
 * 错误处理
 */
process.on('uncaughtException', (error) => {
  console.error('未捕获的异常:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('未处理的 Promise 拒绝:', reason);
});
