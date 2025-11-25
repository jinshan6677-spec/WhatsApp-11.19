/**
 * WhatsApp Desktop - Electron 主进程（单窗口架构）
 * 
 * 这个应用支持在单个窗口中管理多个 WhatsApp 账号
 * 使用 BrowserView 提供完全的会话隔离、存储隔离和网络隔离
 */

/**
 * 备份说明：
 * 这是旧架构的主入口文件 (main.js) 的备份
 * 在2025年11月25日进行架构现代化时创建
 * 如需参考旧代码，请查看此文件
 * 
 * 当前已使用新的现代化架构 (main-refactored.js)
 */

const { app } = require('electron');
const config = require('./config');
const path = require('path');

// 导入单窗口架构组件
const MainWindow = require('./single-window/MainWindow');
const ViewManager = require('./single-window/ViewManager');
const AccountConfigManager = require('./managers/AccountConfigManager');
const SessionManager = require('./managers/SessionManager');
const TranslationIntegration = require('./managers/TranslationIntegration');
const NotificationManager = require('./managers/NotificationManager');
const TrayManager = require('./managers/TrayManager');

// 导入代理管理组件
const ProxyConfigManager = require('./managers/ProxyConfigManager');
const ProxyDetectionService = require('./services/ProxyDetectionService');

// 导入 IPC 处理器
const { registerIPCHandlers: registerSingleWindowIPCHandlers, unregisterIPCHandlers: unregisterSingleWindowIPCHandlers } = require('./single-window/ipcHandlers');
const { registerIPCHandlers: registerTranslationIPCHandlers, unregisterIPCHandlers: unregisterTranslationIPCHandlers } = require('./translation/ipcHandlers');
const { registerProxyIPCHandlers, unregisterProxyIPCHandlers } = require('./ipc/proxyIPCHandlers');

// 导入迁移管理器
const MigrationManager = require('./single-window/migration/MigrationManager');
const MigrationDialog = require('./single-window/migration/MigrationDialog');

/**
 * WhatsApp Desktop - Electron 主进程（单窗口架构）
 * 
 * 这个应用支持在单个窗口中管理多个 WhatsApp 账号
 * 使用 BrowserView 提供完全的会话隔离、存储隔离和网络隔离
 * 
 * 重构版本：使用新的架构和依赖注入
 */

const { app } = require('electron');
const path = require('path');

// 导入新的应用引导器
const { initializeApp } = require('./app/bootstrap');

// 导入错误处理工具
const { getErrorLogger, ErrorCategory } = require('./utils/ErrorLogger');
const { getErrorHandler } = require('./shared/utils/ErrorHandler');

// 全局应用实例
let appBootstrap = null;
let errorLogger = null;

// 全局管理器实例
let mainWindow = null;
let viewManager = null;
let accountConfigManager = null;
let sessionManager = null;
let translationIntegration = null;
let notificationManager = null;
let trayManager = null;
let migrationManager = null;
let errorLogger = null;
let proxyConfigManager = null;
let proxyDetectionService = null;



/**
 * 日志记录函数
 */
function log(level, message, ...args) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}`;

  if (level === 'error') {
    console.error(logMessage, ...args);
  } else if (level === 'warn') {
    console.warn(logMessage, ...args);
  } else {
    console.log(logMessage, ...args);
  }
}

/**
 * 初始化全局错误处理
 */
async function initializeGlobalErrorHandling() {
  try {
    // 初始化错误日志记录器
    errorLogger = getErrorLogger({
      logDir: path.join(app.getPath('userData'), 'logs'),
      logFileName: 'error.log',
      maxLogSize: 10 * 1024 * 1024, // 10MB
      maxLogFiles: 5,
      consoleOutput: true
    });
    await errorLogger.initialize();
    log('info', '错误日志记录器初始化完成');

    // 设置全局错误处理器
    const errorHandler = getErrorHandler();
    errorHandler.setupGlobalErrorHandlers();
    log('info', '全局错误处理器已设置');

  } catch (error) {
    log('error', '初始化错误处理失败:', error);
    throw error;
  }
}

/**
 * 注册所有 IPC 处理器
 */
async function registerAllIPCHandlers() {
  log('info', '注册 IPC 处理器...');

  try {
    const accountManager = appBootstrap.getManager('accountConfigManager');
    const viewManager = appBootstrap.getViewManager();
    const mainWindow = appBootstrap.getMainWindow();
    const translationIntegration = appBootstrap.getManager('translationIntegration');
    const proxyConfigManager = appBootstrap.getManager('proxyConfigManager');
    const proxyDetectionService = appBootstrap.getManager('proxyDetectionService');

    // 动态导入IPC处理器
    const { registerIPCHandlers: registerSingleWindowIPCHandlers } = require('./single-window/ipcHandlers');
    const { registerIPCHandlers: registerTranslationIPCHandlers } = require('./translation/ipcHandlers');
    const { registerProxyIPCHandlers } = require('./ipc/proxyIPCHandlers');

    // 注册单窗口架构 IPC 处理器
    registerSingleWindowIPCHandlers(accountManager, viewManager, mainWindow, translationIntegration);
    log('info', '单窗口 IPC 处理器注册完成');

    // 注册翻译 IPC 处理器
    await registerTranslationIPCHandlers();
    log('info', '翻译 IPC 处理器注册完成');

    // 注册代理 IPC 处理器
    registerProxyIPCHandlers(proxyConfigManager, proxyDetectionService);
    log('info', '代理 IPC 处理器注册完成');

    log('info', '所有 IPC 处理器注册完成');
  } catch (error) {
    log('error', 'IPC 处理器注册失败:', error);
    throw error;
  }
}

/**
 * 加载账号列表并发送到渲染进程
 */
async function loadAndSendAccounts() {
  try {
    const accountManager = appBootstrap.getManager('accountConfigManager');
    const mainWindow = appBootstrap.getMainWindow();
    
    const accounts = await accountManager.loadAccounts();
    
    // 发送账号列表到渲染进程（使用 accounts-updated 事件）
    mainWindow.sendToRenderer('accounts-updated', accounts.map(acc => acc.toJSON()));
    
    log('info', `加载了 ${accounts.length} 个账号配置并发送到渲染进程`);
  } catch (error) {
    log('error', '加载账号列表失败:', error);
    
    // 发送空数组，避免 UI 显示错误
    const mainWindow = appBootstrap.getMainWindow();
    mainWindow.sendToRenderer('accounts-updated', []);
  }
}

/**
 * 自动启动配置的账号
 */
async function autoStartAccounts() {
  log('info', '检查自动启动配置...');

  try {
    const accountManager = appBootstrap.getManager('accountConfigManager');
    const viewManager = appBootstrap.getViewManager();
    
    // 获取所有账号配置
    const accounts = await accountManager.loadAccounts();
    
    // 过滤出配置了自动启动的账号
    const autoStartAccounts = accounts.filter(account => account.autoStart === true);
    
    if (autoStartAccounts.length === 0) {
      log('info', '没有配置自动启动的账号');
      return { success: 0, failed: 0, errors: [] };
    }

    log('info', `找到 ${autoStartAccounts.length} 个自动启动账号`);

    // 启动所有配置了自动启动的账号
    const results = {
      success: 0,
      failed: 0,
      errors: []
    };

    for (const account of autoStartAccounts) {
      try {
        log('info', `自动启动账号: ${account.name} (${account.id})`);
        
        // 使用 ViewManager 的 openAccount 方法打开账号
        const result = await viewManager.openAccount(account.id, {
          url: 'https://web.whatsapp.com',
          proxy: account.proxy,
          translation: account.translation
        });
        
        if (result.success) {
          log('info', `账号 ${account.name} 启动成功`);
          results.success++;
          
          // 更新最后活跃时间
          await accountManager.updateAccount(account.id, {
            lastActiveAt: new Date()
          });
        } else {
          log('error', `账号 ${account.name} 启动失败: ${result.error}`);
          results.failed++;
          results.errors.push({
            accountId: account.id,
            accountName: account.name,
            error: result.error
          });
        }
        
      } catch (error) {
        log('error', `自动启动账号 ${account.name} 时出错:`, error);
        results.failed++;
        results.errors.push({
          accountId: account.id,
          accountName: account.name,
          error: error.message
        });
      }
    }

    log('info', `自动启动完成: ${results.success} 成功, ${results.failed} 失败`);
    
    if (results.failed > 0) {
      log('warn', '部分账号启动失败:', results.errors);
    }

    return results;
  } catch (error) {
    log('error', '自动启动失败:', error);
    throw error;
  }
}

/**
 * 保存应用状态
 * 保存所有账号状态和应用配置
 */
async function saveApplicationState() {
  log('info', '保存应用状态...');

  try {
    // 使用bootstrap保存状态
    if (appBootstrap) {
      await appBootstrap.saveApplicationState();
    }
  } catch (error) {
    log('error', '保存应用状态时出错:', error);
    throw error;
  }
}

/**
 * 清理资源
 * 执行优雅关闭，清理所有资源
 */
async function cleanup() {
  log('info', '开始清理资源...');

  try {
    // 使用bootstrap清理资源
    if (appBootstrap) {
      await appBootstrap.cleanup();
    }
    
    log('info', '资源清理完成');
  } catch (error) {
    log('error', '资源清理过程中发生错误:', error);
    // 即使出错也继续，确保应用能够退出
  }
}

/**
 * 应用程序就绪事件
 */
app.whenReady().then(async () => {
  log('info', 'Electron 应用已就绪');

  try {
    // 1. 初始化全局错误处理
    await initializeGlobalErrorHandling();

    // 2. 初始化应用（使用新的引导器）
    appBootstrap = await initializeApp();
    log('info', '应用初始化完成');

    // 3. 检查迁移管理器
    const migrationManager = appBootstrap.getManager('migrationManager');
    if (migrationManager) {
      const detectionResult = await migrationManager.detectMigrationNeeded();
      
      if (detectionResult.needed) {
        log('info', '检测到需要迁移，显示迁移对话框');
        
        const MigrationDialog = require('./single-window/migration/MigrationDialog');
        const migrationDialog = new MigrationDialog();
        const migrationResult = await migrationDialog.showMigrationDialog(migrationManager);
        
        if (migrationResult.success) {
          log('info', '数据迁移完成');
        } else if (migrationResult.cancelled) {
          log('info', '用户取消迁移');
        } else {
          log('warn', `数据迁移失败: ${migrationResult.error}`);
        }
      } else {
        log('info', '无需迁移');
      }
    }

    // 4. 确保所有账号启用翻译
    await appBootstrap.ensureTranslationEnabled();

    // 5. 执行自动数据清理
    await appBootstrap.performOrphanedDataCleanup();

    // 6. 注册所有 IPC 处理器
    await registerAllIPCHandlers();

    // 7. 等待窗口准备好，然后加载并显示账号列表
    try {
      const mainWindow = appBootstrap.getMainWindow();
      if (mainWindow && !mainWindow.isDestroyed()) {
        const window = mainWindow.getWindow();
        if (window && !window.webContents.isLoading()) {
          // 窗口已经加载完成，直接发送
          await loadAndSendAccounts();
        } else {
          // 等待窗口加载完成
          log('info', '等待窗口加载完成...');
          window.webContents.once('did-finish-load', async () => {
            log('info', '窗口加载完成，发送账号列表');
            await loadAndSendAccounts();
          });
        }
      }
    } catch (error) {
      log('error', '加载账号列表失败:', error);
    }

    // 8. 手动账户控制 - 延迟执行自动启动
    try {
      log('info', '手动账户控制模式：等待用户手动打开账号');
      log('info', '提示：如果某些账号配置了"自动启动"，将在 1 秒后自动打开');
      
      // 延迟执行自动启动检查（仅针对配置了 autoStart: true 的账号）
      setTimeout(async () => {
        await autoStartAccounts();
      }, 1000);
    } catch (error) {
      log('error', '自动启动检查失败:', error);
    }

    log('info', '应用启动完成');

  } catch (error) {
    log('error', '应用启动失败:', error);
    log('error', '错误堆栈:', error.stack);
    app.quit();
  }

  // macOS 特定：点击 dock 图标时显示主窗口
  app.on('activate', () => {
    if (appBootstrap && appBootstrap.getMainWindow()) {
      appBootstrap.getMainWindow().focus();
    }
  });
});

/**
 * 主窗口关闭事件处理
 * 在窗口关闭时保存状态
 */
function setupMainWindowCloseHandler() {
  if (!appBootstrap || !appBootstrap.getMainWindow()) {
    return;
  }

  const mainWindow = appBootstrap.getMainWindow();
  const window = mainWindow.getWindow();
  if (!window) {
    return;
  }

  // 监听窗口关闭事件
  window.on('close', async (event) => {
    log('info', '主窗口正在关闭');

    try {
      // 保存应用状态
      await saveApplicationState();
      log('info', '窗口关闭前状态已保存');
    } catch (error) {
      log('error', '保存窗口关闭状态时出错:', error);
    }
  });
}

/**
 * 所有窗口关闭事件
 */
app.on('window-all-closed', async () => {
  log('info', '所有窗口已关闭');

  // 如果启用了最小化到托盘，不退出应用
  const config = require('./config');
  if (config.trayConfig && config.trayConfig.minimizeToTray) {
    log('info', '应用最小化到托盘，继续运行');
    return;
  }

  // 清理资源
  await cleanup();

  // 在 macOS 上，除非用户明确退出，否则应用和菜单栏会保持活动状态
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

/**
 * 应用退出前事件
 * 执行最终清理工作
 */
app.on('before-quit', async (event) => {
  log('info', '应用即将退出');

  // 防止重复清理
  if (app.isQuitting) {
    log('info', '清理已完成，允许退出');
    return;
  }

  // 标记正在退出
  app.isQuitting = true;

  try {
    // 使用bootstrap清理资源
    if (appBootstrap) {
      await appBootstrap.cleanup();
    }
    
    log('info', '退出前清理完成');
  } catch (error) {
    log('error', '退出前清理失败:', error);
  }
});

/**
 * 应用即将退出事件
 * 最后的清理机会
 */
app.on('will-quit', (event) => {
  log('info', '应用正在退出');

  // 确保所有资源都已清理
  if (viewManager) {
    try {
      // 同步停止所有监控
      viewManager.stopAllConnectionMonitoring();
      viewManager.stopAllLoginStatusMonitoring();
    } catch (error) {
      log('error', '停止监控失败:', error);
    }
  }

  log('info', '应用退出完成');
});

/**
 * 未捕获的异常处理
 */
process.on('uncaughtException', (error) => {
  log('error', '未捕获的异常:', error);
  log('error', '错误堆栈:', error.stack);

  // 尝试保存状态
  try {
    if (accountConfigManager && viewManager) {
      saveApplicationState().catch(err => {
        log('error', '紧急保存状态失败:', err);
      });
    }
  } catch (err) {
    log('error', '紧急保存失败:', err);
  }
});

process.on('unhandledRejection', (reason) => {
  log('error', '未处理的 Promise 拒绝:', reason);
  if (reason instanceof Error) {
    log('error', '错误堆栈:', reason.stack);
  }
});

// 启动信息
log('info', '========================================');
log('info', 'WhatsApp Desktop - Single Window Architecture');
log('info', `版本: ${app.getVersion()}`);
log('info', `Node.js: ${process.versions.node}`);
log('info', `Electron: ${process.versions.electron}`);
log('info', `Chromium: ${process.versions.chrome}`);
log('info', `平台: ${process.platform}`);
log('info', `环境: ${process.env.NODE_ENV || 'development'}`);
log('info', `用户数据路径: ${app.getPath('userData')}`);
log('info', '========================================');


/**
 * Send account error to renderer
 * @param {string} accountId - Account ID
 * @param {string} errorMessage - Error message
 * @param {string} category - Error category
 * @param {string} [severity='error'] - Error severity
 */
function sendAccountError(accountId, errorMessage, category, severity = 'error') {
  if (appBootstrap && appBootstrap.getMainWindow() && appBootstrap.getMainWindow().isReady()) {
    appBootstrap.getMainWindow().sendToRenderer('account-error', {
      accountId,
      error: errorMessage,
      category,
      severity,
      timestamp: Date.now()
    });
  }
}

/**
 * Send global error to renderer
 * @param {string} errorMessage - Error message
 * @param {string} category - Error category
 * @param {string} [level='error'] - Error level
 */
function sendGlobalError(errorMessage, category, level = 'error') {
  if (appBootstrap && appBootstrap.getMainWindow() && appBootstrap.getMainWindow().isReady()) {
    appBootstrap.getMainWindow().sendToRenderer('global-error', {
      error: errorMessage,
      category,
      level,
      timestamp: Date.now()
    });
  }
}

/**
 * Clear error from renderer
 * @param {string} [accountId] - Account ID (if account-specific)
 */
function clearError(accountId = null) {
  if (appBootstrap && appBootstrap.getMainWindow() && appBootstrap.getMainWindow().isReady()) {
    appBootstrap.getMainWindow().sendToRenderer('error-cleared', {
      accountId,
      timestamp: Date.now()
    });
  }
}

/**
 * 执行遗留数据自动清理
 * 在应用启动时扫描并清理已删除账号的遗留目录
 */
async function performOrphanedDataCleanup() {
  try {
    log('info', '开始执行自动数据清理...');

    // 使用bootstrap执行自动数据清理
    if (appBootstrap) {
      await appBootstrap.performOrphanedDataCleanup();
    }

  } catch (error) {
    log('error', '自动数据清理失败:', error);
    // 不阻止应用启动，只记录错误
  }
}

// Export error notification functions for use in other modules
module.exports = {
  sendAccountError,
  sendGlobalError,
  clearError
};