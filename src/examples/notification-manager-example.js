/**
 * NotificationManager 使用示例
 * 
 * 演示如何使用 NotificationManager 管理系统通知和未读消息检测
 */

const { app, BrowserWindow } = require('electron');
const NotificationManager = require('../managers/NotificationManager');
const InstanceManager = require('../managers/InstanceManager');
const AccountConfigManager = require('../managers/AccountConfigManager');
const MainApplicationWindow = require('../container/MainApplicationWindow');

// 示例：初始化通知管理器
async function initializeNotificationManager() {
  // 创建主窗口
  const mainWindow = new MainApplicationWindow();
  mainWindow.initialize();
  
  // 创建通知管理器
  const notificationManager = new NotificationManager({
    mainWindow: mainWindow
  });
  
  console.log('NotificationManager initialized');
  
  return notificationManager;
}

// 示例：集成到 InstanceManager
async function integrateWithInstanceManager() {
  const configManager = new AccountConfigManager();
  const notificationManager = new NotificationManager();
  
  // 创建 InstanceManager 并传入 NotificationManager
  const instanceManager = new InstanceManager({
    notificationManager: notificationManager
  });
  
  // 加载账号配置
  const accounts = await configManager.loadAccounts();
  
  // 创建实例（会自动启动未读消息监控）
  for (const account of accounts) {
    if (account.notifications?.enabled) {
      const result = await instanceManager.createInstance(account);
      if (result.success) {
        console.log(`Instance created with notification monitoring: ${account.name}`);
      }
    }
  }
  
  return { instanceManager, notificationManager };
}

// 示例：手动显示系统通知
async function showManualNotification() {
  const notificationManager = new NotificationManager();
  
  // 显示简单通知
  notificationManager.showSystemNotification('account-123', {
    title: 'WhatsApp - 工作账号',
    body: '您有 3 条新消息',
    silent: false
  });
  
  console.log('Manual notification shown');
}

// 示例：检测未读消息数
async function detectUnreadMessages() {
  const notificationManager = new NotificationManager();
  
  // 假设已有一个运行中的实例
  const instanceId = 'account-123';
  const window = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false
  });
  
  await window.loadURL('https://web.whatsapp.com');
  
  // 等待页面加载
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  // 检测未读消息数
  const unreadCount = await notificationManager.detectUnreadCount(instanceId, window);
  console.log(`Unread messages: ${unreadCount}`);
  
  // 获取总未读数
  const totalUnread = notificationManager.getTotalUnreadCount();
  console.log(`Total unread messages: ${totalUnread}`);
  
  window.close();
}

// 示例：启动和停止未读消息监控
async function monitorUnreadMessages() {
  const notificationManager = new NotificationManager();
  
  const instanceId = 'account-123';
  const window = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false
  });
  
  await window.loadURL('https://web.whatsapp.com');
  
  const accountConfig = {
    id: instanceId,
    name: '工作账号',
    notifications: {
      enabled: true,
      sound: true,
      badge: true
    }
  };
  
  // 启动监控（每 5 秒检查一次）
  const monitoringInterval = notificationManager.startUnreadMonitoring(
    instanceId,
    window,
    accountConfig,
    5000
  );
  
  console.log('Unread monitoring started');
  
  // 10 分钟后停止监控
  setTimeout(() => {
    notificationManager.stopUnreadMonitoring(monitoringInterval);
    console.log('Unread monitoring stopped');
    window.close();
  }, 600000);
}

// 示例：获取通知历史
async function getNotificationHistory() {
  const notificationManager = new NotificationManager();
  
  const instanceId = 'account-123';
  
  // 显示一些通知
  notificationManager.showSystemNotification(instanceId, {
    title: 'WhatsApp',
    body: '新消息 1'
  });
  
  notificationManager.showSystemNotification(instanceId, {
    title: 'WhatsApp',
    body: '新消息 2'
  });
  
  // 获取通知历史（最近 10 条）
  const history = notificationManager.getNotificationHistory(instanceId, 10);
  console.log('Notification history:', history);
}

// 示例：清除通知数据
async function clearNotificationData() {
  const notificationManager = new NotificationManager();
  
  const instanceId = 'account-123';
  
  // 清除未读计数
  notificationManager.clearUnreadCount(instanceId);
  console.log('Unread count cleared');
  
  // 清除通知历史
  notificationManager.clearNotificationHistory(instanceId);
  console.log('Notification history cleared');
  
  // 清除所有数据
  notificationManager.clearAll();
  console.log('All notification data cleared');
}

// 示例：配置通知选项
async function configureNotifications() {
  const accountConfig = {
    id: 'account-123',
    name: '工作账号',
    notifications: {
      enabled: true,    // 启用通知
      sound: true,      // 启用声音
      badge: true       // 显示徽章
    }
  };
  
  console.log('Notification configuration:', accountConfig.notifications);
  
  // 禁用通知
  accountConfig.notifications.enabled = false;
  console.log('Notifications disabled');
  
  // 静音通知
  accountConfig.notifications.sound = false;
  console.log('Notification sound disabled');
}

// 主函数
async function main() {
  await app.whenReady();
  
  console.log('=== NotificationManager Examples ===\n');
  
  // 运行示例
  try {
    console.log('1. Initialize NotificationManager');
    await initializeNotificationManager();
    
    console.log('\n2. Show Manual Notification');
    await showManualNotification();
    
    console.log('\n3. Configure Notifications');
    await configureNotifications();
    
    console.log('\n4. Get Notification History');
    await getNotificationHistory();
    
    console.log('\n5. Clear Notification Data');
    await clearNotificationData();
    
    console.log('\n=== Examples completed ===');
  } catch (error) {
    console.error('Error running examples:', error);
  }
  
  // 保持应用运行以查看通知
  setTimeout(() => {
    app.quit();
  }, 5000);
}

// 如果直接运行此文件
if (require.main === module) {
  main();
}

module.exports = {
  initializeNotificationManager,
  integrateWithInstanceManager,
  showManualNotification,
  detectUnreadMessages,
  monitorUnreadMessages,
  getNotificationHistory,
  clearNotificationData,
  configureNotifications
};
