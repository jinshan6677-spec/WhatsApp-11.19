/**
 * WhatsApp Desktop - Electron 主进程（单窗口架构）
 * 
 * 这个应用支持在单个窗口中管理多个 WhatsApp 账号
 * 使用 BrowserView 提供完全的会话隔离、存储隔离和网络隔离
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

// 导入 IPC 处理器
const { registerIPCHandlers: registerSingleWindowIPCHandlers, unregisterIPCHandlers: unregisterSingleWindowIPCHandlers } = require('./single-window/ipcHandlers');
const { registerIPCHandlers: registerTranslationIPCHandlers, unregisterIPCHandlers: unregisterTranslationIPCHandlers } = require('./translation/ipcHandlers');

// 导入迁移管理器
const MigrationManager = require('./single-window/migration/MigrationManager');
const MigrationDialog = require('./single-window/migration/MigrationDialog');

// 导入错误处理工具
const { getErrorLogger, ErrorCategory } = require('./utils/ErrorLogger');

// 导入自动清理工具
const OrphanedDataCleaner = require('./utils/OrphanedDataCleaner');
const { setupGlobalErrorHandlers } = require('./utils/ErrorHandler');

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



/**
 * 确保所有账号都启用了翻译功能
 */
async function ensureTranslationEnabled(accountManager) {
  try {
    const accounts = await accountManager.loadAccounts();
    let updatedCount = 0;

    for (const account of accounts) {
      let needsUpdate = false;

      // 如果账号没有翻译配置或翻译未启用，则启用它
      if (!account.translation) {
        account.translation = {
          enabled: true,
          targetLanguage: 'zh-CN',
          engine: 'google',
          apiKey: '',
          autoTranslate: false,
          translateInput: false,
          friendSettings: {}
        };
        needsUpdate = true;
      } else if (!account.translation.enabled) {
        account.translation.enabled = true;
        needsUpdate = true;
      }

      if (needsUpdate) {
        await accountManager.saveAccount(account);
        updatedCount++;
        log('info', `已为账号 ${account.name} 启用翻译功能`);
      }
    }

    if (updatedCount > 0) {
      log('info', `已为 ${updatedCount} 个账号启用翻译功能`);
    }
  } catch (error) {
    log('error', '检查翻译配置时出错:', error);
  }
}

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
 * 初始化所有管理器
 */
async function initializeManagers() {
  log('info', '初始化管理器...');

  try {
    // 0. 初始化错误日志记录器
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
    setupGlobalErrorHandlers();
    log('info', '全局错误处理器已设置');

    // 1. 初始化账号配置管理器
    accountConfigManager = new AccountConfigManager({
      cwd: app.getPath('userData')
    });
    log('info', '账号配置管理器初始化完成');

    // 1.1 确保所有账号都启用了翻译功能
    await ensureTranslationEnabled(accountConfigManager);
    log('info', '翻译配置检查完成');

    // 2. 初始化会话管理器
    sessionManager = new SessionManager({
      userDataPath: app.getPath('userData')
    });
    log('info', '会话管理器初始化完成');

    // 3. 初始化通知管理器
    notificationManager = new NotificationManager();
    log('info', '通知管理器初始化完成');

    // 4. 初始化翻译集成
    translationIntegration = new TranslationIntegration(null);
    await translationIntegration.initialize();
    log('info', '翻译集成初始化完成');

    // 5. 初始化主窗口
    mainWindow = new MainWindow({
      width: 1400,
      height: 900,
      minWidth: 1000,
      minHeight: 600,
      title: 'WhatsApp Desktop',
      preloadPath: path.join(__dirname, 'single-window', 'renderer', 'preload-main.js'),
      htmlPath: path.join(__dirname, 'single-window', 'renderer', 'app.html')
    });
    mainWindow.initialize();
    log('info', '主窗口初始化完成');

    // 设置窗口关闭事件处理器
    setupMainWindowCloseHandler();
    log('info', '窗口关闭处理器已设置');

    // 6. 初始化 ViewManager
    viewManager = new ViewManager(mainWindow, sessionManager, {
      defaultSidebarWidth: 280,
      translationIntegration: translationIntegration
    });
    log('info', 'ViewManager 初始化完成');

    // 7. 设置通知管理器的主窗口引用
    notificationManager.setMainWindow(mainWindow);

    // 8. 初始化系统托盘（如果启用）
    if (config.trayConfig && config.trayConfig.enabled) {
      try {
        trayManager = new TrayManager();
        trayManager.initialize(mainWindow.getWindow(), config.trayConfig);
        
        // 设置托盘管理器引用
        notificationManager.setTrayManager(trayManager);
        
        log('info', '系统托盘初始化完成');
      } catch (error) {
        log('error', '系统托盘初始化失败:', error);
      }
    }

    log('info', '所有管理器初始化完成');
  } catch (error) {
    log('error', '管理器初始化失败:', error);
    throw error;
  }
}

/**
 * 注册所有 IPC 处理器
 */
async function registerAllIPCHandlers() {
  log('info', '注册 IPC 处理器...');

  try {
    // 注册单窗口架构 IPC 处理器
    registerSingleWindowIPCHandlers(accountConfigManager, viewManager, mainWindow, translationIntegration);
    log('info', '单窗口 IPC 处理器注册完成');

    // 注册翻译 IPC 处理器
    await registerTranslationIPCHandlers();
    log('info', '翻译 IPC 处理器注册完成');

    log('info', '所有 IPC 处理器注册完成');
  } catch (error) {
    log('error', 'IPC 处理器注册失败:', error);
    throw error;
  }
}

/**
 * 自动启动配置的账号
 */
async function autoStartAccounts() {
  log('info', '检查自动启动配置...');

  try {
    // 获取所有账号配置
    const accounts = await accountConfigManager.loadAccounts();
    
    // 过滤出配置了自动启动的账号
    const autoStartAccounts = accounts.filter(account => account.autoStart === true);
    
    if (autoStartAccounts.length === 0) {
      log('info', '没有配置自动启动的账号');
      return;
    }

    log('info', `找到 ${autoStartAccounts.length} 个自动启动账号`);

    // 启动第一个自动启动账号（在单窗口架构中）
    if (autoStartAccounts.length > 0) {
      const firstAccount = autoStartAccounts[0];
      
      try {
        log('info', `自动启动账号: ${firstAccount.name} (${firstAccount.id})`);
        
        // 使用 ViewManager 切换到该账号（会自动创建视图）
        const result = await viewManager.switchView(firstAccount.id, {
          createIfMissing: true,
          viewConfig: {
            url: 'https://web.whatsapp.com',
            proxy: firstAccount.proxy,
            translation: firstAccount.translation
          }
        });
        
        if (result.success) {
          log('info', `账号 ${firstAccount.name} 启动成功`);
          
          // 更新最后活跃时间
          await accountConfigManager.updateAccount(firstAccount.id, {
            lastActiveAt: new Date()
          });
        } else {
          log('error', `账号 ${firstAccount.name} 启动失败: ${result.error}`);
        }
        
      } catch (error) {
        log('error', `自动启动账号 ${firstAccount.name} 时出错:`, error);
      }
    }

    log('info', '自动启动完成');
  } catch (error) {
    log('error', '自动启动失败:', error);
  }
}

/**
 * 保存应用状态
 * 保存所有账号状态和应用配置
 */
async function saveApplicationState() {
  log('info', '保存应用状态...');

  try {
    // 1. 保存活跃账号 ID（由 ViewManager 自动保存）
    if (viewManager) {
      const activeAccountId = viewManager.getActiveAccountId();
      if (activeAccountId) {
        log('info', `当前活跃账号: ${activeAccountId}`);
      }
    }

    // 2. 保存所有账号的最后活跃时间
    if (accountConfigManager && viewManager) {
      const accounts = await accountConfigManager.loadAccounts();
      let updatedCount = 0;

      for (const account of accounts) {
        // 如果账号有活跃的视图，更新最后活跃时间
        if (viewManager.hasView(account.id)) {
          await accountConfigManager.updateAccount(account.id, {
            lastActiveAt: new Date()
          });
          updatedCount++;
        }
      }

      log('info', `已更新 ${updatedCount} 个账号的活跃时间`);
    }

    // 3. 保存窗口状态（由 MainWindow 自动保存）
    if (mainWindow && !mainWindow.isDestroyed()) {
      const bounds = mainWindow.getBounds();
      if (bounds) {
        log('info', `窗口状态已保存: ${bounds.width}x${bounds.height}`);
      }
    }

    // 4. 保存侧边栏宽度（由 MainWindow 自动保存）
    if (mainWindow && !mainWindow.isDestroyed()) {
      const sidebarWidth = mainWindow.getSidebarWidth();
      log('info', `侧边栏宽度已保存: ${sidebarWidth}px`);
    }

    log('info', '应用状态保存完成');
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
    // 1. 保存应用状态
    await saveApplicationState();

    // 2. 停止所有监控
    try {
      if (viewManager) {
        // 停止连接监控
        const stopResult = viewManager.stopAllConnectionMonitoring();
        log('info', `连接监控已停止: ${stopResult.stopped} 个账号`);

        // 停止登录状态监控
        const stopLoginResult = viewManager.stopAllLoginStatusMonitoring();
        log('info', `登录状态监控已停止: ${stopLoginResult.stopped} 个账号`);
      }
    } catch (error) {
      log('error', '停止监控时出错:', error);
    }

    // 3. 优雅关闭所有 BrowserView
    try {
      if (viewManager) {
        log('info', '开始优雅关闭所有 BrowserView...');

        // 获取所有视图
        const allViews = viewManager.getAllViews();
        log('info', `准备关闭 ${allViews.length} 个 BrowserView`);

        // 销毁所有视图
        const result = await viewManager.destroyAllViews();
        log('info', `BrowserView 关闭完成: ${result.destroyed} 个成功, ${result.failed} 个失败`);

        if (result.failed > 0) {
          log('warn', `有 ${result.failed} 个 BrowserView 关闭失败`);
        }
      }
    } catch (error) {
      log('error', '关闭 BrowserView 时出错:', error);
    }

    // 4. 销毁系统托盘
    try {
      if (trayManager) {
        trayManager.destroy();
        trayManager = null;
        log('info', '系统托盘已销毁');
      }
    } catch (error) {
      log('error', '销毁系统托盘时出错:', error);
    }

    // 5. 注销 IPC 处理器
    try {
      unregisterSingleWindowIPCHandlers();
      log('info', '单窗口 IPC 处理器已注销');
    } catch (error) {
      log('error', '注销单窗口 IPC 处理器时出错:', error);
    }

    try {
      unregisterTranslationIPCHandlers();
      log('info', '翻译 IPC 处理器已注销');
    } catch (error) {
      log('error', '注销翻译 IPC 处理器时出错:', error);
    }

    // 6. 清理翻译集成
    try {
      if (translationIntegration) {
        translationIntegration.cleanup();
        log('info', '翻译集成已清理');
      }
    } catch (error) {
      log('error', '清理翻译集成时出错:', error);
    }

    // 7. 清理通知管理器
    try {
      if (notificationManager) {
        notificationManager.clearAll();
        log('info', '通知管理器已清理');
      }
    } catch (error) {
      log('error', '清理通知管理器时出错:', error);
    }

    // 8. 清理会话管理器
    try {
      if (sessionManager) {
        // SessionManager 不需要显式清理，Electron 会自动处理
        log('info', '会话管理器已清理');
      }
    } catch (error) {
      log('error', '清理会话管理器时出错:', error);
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
    // 1. 检查并执行数据迁移
    try {
      log('info', '检查数据迁移...');
      
      migrationManager = new MigrationManager({
        userDataPath: app.getPath('userData')
      });
      
      const detectionResult = await migrationManager.detectMigrationNeeded();
      
      if (detectionResult.needed) {
        log('info', '检测到需要迁移，显示迁移对话框');
        
        // 显示迁移对话框
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
    } catch (error) {
      log('error', '数据迁移检查失败:', error);
      // 不阻止应用启动
    }

    // 2. 初始化所有管理器
    await initializeManagers();

    // 3. 执行自动数据清理
    await performOrphanedDataCleanup();

    // 4. 注册所有 IPC 处理器
    await registerAllIPCHandlers();

    // 4. 加载并显示账号列表
    try {
      const accounts = await accountConfigManager.loadAccounts();
      
      // 发送账号列表到渲染进程
      mainWindow.sendToRenderer('accounts-loaded', {
        accounts: accounts.map(acc => acc.toJSON())
      });
      
      log('info', `加载了 ${accounts.length} 个账号配置`);
    } catch (error) {
      log('error', '加载账号列表失败:', error);
    }

    // 5. 恢复上次活跃的账号或自动启动配置的账号
    try {
      // 首先尝试恢复上次活跃的账号
      const savedAccountId = viewManager.getSavedActiveAccountId();
      
      if (savedAccountId) {
        const account = await accountConfigManager.getAccount(savedAccountId);
        
        if (account) {
          const restoreResult = await viewManager.switchView(savedAccountId, {
            createIfMissing: true,
            viewConfig: {
              url: 'https://web.whatsapp.com',
              proxy: account.proxy,
              translation: account.translation
            }
          });
          
          if (restoreResult.success) {
            log('info', `恢复上次活跃账号: ${savedAccountId}`);
          } else {
            log('warn', `恢复账号失败: ${restoreResult.error}`);
            // 尝试自动启动
            if (config.autoStart !== false) {
              setTimeout(async () => {
                await autoStartAccounts();
              }, 1000);
            }
          }
        } else {
          log('warn', `保存的账号 ${savedAccountId} 不存在`);
          // 尝试自动启动
          if (config.autoStart !== false) {
            setTimeout(async () => {
              await autoStartAccounts();
            }, 1000);
          }
        }
      } else if (config.autoStart !== false) {
        // 如果没有上次活跃的账号，尝试自动启动
        setTimeout(async () => {
          await autoStartAccounts();
        }, 1000);
      }
    } catch (error) {
      log('error', '恢复账号失败:', error);
    }

    log('info', '应用启动完成');

  } catch (error) {
    log('error', '应用启动失败:', error);
    log('error', '错误堆栈:', error.stack);
    app.quit();
  }

  // macOS 特定：点击 dock 图标时显示主窗口
  app.on('activate', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.focus();
    }
  });
});

/**
 * 主窗口关闭事件处理
 * 在窗口关闭时保存状态
 */
function setupMainWindowCloseHandler() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }

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
  if (config.trayConfig && config.trayConfig.minimizeToTray && trayManager) {
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
    // 执行清理
    await cleanup();
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
  if (mainWindow && mainWindow.isReady()) {
    mainWindow.sendToRenderer('account-error', {
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
  if (mainWindow && mainWindow.isReady()) {
    mainWindow.sendToRenderer('global-error', {
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
  if (mainWindow && mainWindow.isReady()) {
    mainWindow.sendToRenderer('error-cleared', {
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

    const userDataPath = app.getPath('userData');
    const cleaner = new OrphanedDataCleaner({
      userDataPath,
      logFunction: (level, message, ...args) => log(level, `OrphanedDataCleaner: ${message}`, ...args)
    });

    // 获取当前所有账号 ID
    const accounts = await accountConfigManager.loadAccounts();
    const accountIds = accounts.map(acc => acc.id);

    log('info', `当前账号数量: ${accounts.length}`);
    
    // 执行清理
    const cleanupResult = await cleaner.scanAndClean(accountIds);

    if (cleanupResult.success) {
      log('info', `自动清理完成: 清理了 ${cleanupResult.cleaned} 个遗留目录`);
      if (cleanupResult.details.totalSizeFreed > 0) {
        log('info', `释放磁盘空间: ${cleanupResult.details.totalSizeFreed} 字节`);
      }
      
      // 可以选择向用户报告清理结果（可选）
      if (cleanupResult.cleaned > 0 && mainWindow && mainWindow.isReady()) {
        mainWindow.sendToRenderer('cleanup-completed', {
          cleaned: cleanupResult.cleaned,
          totalSizeFreed: cleanupResult.details.totalSizeFreed,
          message: `自动清理完成: 清理了 ${cleanupResult.cleaned} 个遗留目录，释放了 ${Math.round(cleanupResult.details.totalSizeFreed / 1024)} KB 磁盘空间`
        });
      }
    } else {
      log('warn', `自动清理完成但有错误: ${cleanupResult.errors.join(', ')}`);
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
