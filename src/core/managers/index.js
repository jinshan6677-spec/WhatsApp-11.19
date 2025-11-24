/**
 * 核心管理器统一导出
 * 
 * 提供所有核心管理器的统一导入接口
 * 避免使用复杂的相对路径引用
 */

// 基础管理器
const AccountConfigManager = require('../../managers/AccountConfigManager');
const InstanceManager = require('../../managers/InstanceManager');
const SessionManager = require('../../managers/SessionManager');
const NotificationManager = require('../../managers/NotificationManager');
const TrayManager = require('../../managers/TrayManager');

// 增强管理器
const ProxyConfigManager = require('../../managers/ProxyConfigManager');
const MigrationManager = require('../../managers/MigrationManager');
const ResourceManager = require('../../managers/ResourceManager');

// 集成管理器
const TranslationIntegration = require('../../managers/TranslationIntegration');

// 导出统一接口
module.exports = {
  // 基础管理器
  AccountConfigManager,
  InstanceManager,
  SessionManager,
  NotificationManager,
  TrayManager,
  
  // 增强管理器
  ProxyConfigManager,
  MigrationManager,
  ResourceManager,
  
  // 集成管理器
  TranslationIntegration,
  
  // 便捷方法
  createAccountConfigManager: (options) => new AccountConfigManager(options),
  createInstanceManager: (options) => new InstanceManager(options),
  createSessionManager: (options) => new SessionManager(options),
  createTranslationIntegration: (options) => new TranslationIntegration(options),
  createNotificationManager: () => new NotificationManager(),
  createTrayManager: () => new TrayManager(),
  createProxyConfigManager: () => new ProxyConfigManager(),
  createMigrationManager: () => new MigrationManager(),
  createResourceManager: () => new ResourceManager()
};
