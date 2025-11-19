/**
 * 首次启动向导集成示例
 * 
 * 展示如何在 main.js 中集成首次启动向导
 */

const { app, BrowserWindow } = require('electron');
const { checkAndShowWizard, autoMigrate } = require('../managers/FirstRunWizardIntegration');

// ============================================================================
// 方式 1: 显示向导界面（推荐用于桌面应用）
// ============================================================================

async function startAppWithWizard() {
  await app.whenReady();

  const userDataPath = app.getPath('userData');

  try {
    // 检查并显示首次启动向导
    const wizardResult = await checkAndShowWizard({
      userDataPath,
      onComplete: () => {
        console.log('Wizard completed, starting main application...');
        // 启动主应用
        createMainWindow();
      },
      onSkip: () => {
        console.log('Wizard skipped, starting main application...');
        // 启动主应用
        createMainWindow();
      }
    });

    if (!wizardResult.shown) {
      // 不需要显示向导，直接启动主应用
      console.log('No wizard needed, starting main application...');
      createMainWindow();
    }
  } catch (error) {
    console.error('Error during wizard:', error);
    // 即使向导失败，也尝试启动主应用
    createMainWindow();
  }
}

// ============================================================================
// 方式 2: 静默自动迁移（推荐用于命令行工具或服务）
// ============================================================================

async function startAppWithAutoMigration() {
  await app.whenReady();

  const userDataPath = app.getPath('userData');

  try {
    // 自动执行迁移（不显示界面）
    const migrationResult = await autoMigrate({
      userDataPath,
      silent: false // 设置为 true 可以完全静默
    });

    if (migrationResult.migrated) {
      console.log('Migration completed successfully');
      if (migrationResult.result && migrationResult.result.details) {
        console.log('Migration details:', migrationResult.result.details);
      }
    } else {
      console.log('No migration needed or migration failed');
    }

    // 启动主应用
    createMainWindow();
  } catch (error) {
    console.error('Error during migration:', error);
    // 即使迁移失败，也尝试启动主应用
    createMainWindow();
  }
}

// ============================================================================
// 方式 3: 混合模式 - 先尝试自动迁移，失败时显示向导
// ============================================================================

async function startAppWithHybridMode() {
  await app.whenReady();

  const userDataPath = app.getPath('userData');

  try {
    // 先尝试自动迁移
    const migrationResult = await autoMigrate({
      userDataPath,
      silent: true
    });

    if (migrationResult.migrated) {
      // 迁移成功，直接启动主应用
      console.log('Auto migration successful');
      createMainWindow();
    } else if (migrationResult.result && !migrationResult.result.success) {
      // 迁移失败，显示向导让用户手动处理
      console.log('Auto migration failed, showing wizard');
      await checkAndShowWizard({
        userDataPath,
        onComplete: () => createMainWindow(),
        onSkip: () => createMainWindow()
      });
    } else {
      // 不需要迁移，直接启动主应用
      console.log('No migration needed');
      createMainWindow();
    }
  } catch (error) {
    console.error('Error during startup:', error);
    createMainWindow();
  }
}

// ============================================================================
// 辅助函数
// ============================================================================

function createMainWindow() {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    title: 'WhatsApp Desktop'
  });

  mainWindow.loadURL('https://web.whatsapp.com');
  
  console.log('Main application window created');
}

// ============================================================================
// 在实际的 main.js 中使用
// ============================================================================

/*
// 在 main.js 中添加以下代码：

const { app } = require('electron');
const { checkAndShowWizard } = require('./managers/FirstRunWizardIntegration');

app.whenReady().then(async () => {
  const userDataPath = app.getPath('userData');

  try {
    const wizardResult = await checkAndShowWizard({
      userDataPath,
      onComplete: () => {
        // 向导完成后的逻辑
        initializeApplication();
      },
      onSkip: () => {
        // 用户跳过向导后的逻辑
        initializeApplication();
      }
    });

    if (!wizardResult.shown) {
      // 不需要显示向导，直接初始化应用
      initializeApplication();
    }
  } catch (error) {
    console.error('Error during wizard:', error);
    // 错误处理
    initializeApplication();
  }
});

function initializeApplication() {
  // 初始化翻译服务
  // 创建主窗口
  // 注册 IPC 处理器
  // 等等...
}
*/

// ============================================================================
// 导出示例函数（仅用于演示）
// ============================================================================

module.exports = {
  startAppWithWizard,
  startAppWithAutoMigration,
  startAppWithHybridMode
};
