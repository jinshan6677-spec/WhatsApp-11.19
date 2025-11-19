/**
 * FirstRunWizardIntegration - 首次启动向导集成模块
 * 
 * 提供简单的 API 来集成首次启动向导到应用启动流程
 */

const FirstRunWizard = require('../container/FirstRunWizard');
const MigrationManager = require('./MigrationManager');
const AccountConfigManager = require('./AccountConfigManager');

/**
 * 检查并显示首次启动向导
 * @param {Object} options - 配置选项
 * @param {string} options.userDataPath - 用户数据路径
 * @param {Function} options.onComplete - 完成回调
 * @param {Function} options.onSkip - 跳过回调
 * @returns {Promise<{shown: boolean, migrated: boolean, result?: Object}>}
 */
async function checkAndShowWizard(options) {
  const {
    userDataPath,
    onComplete = () => {},
    onSkip = () => {}
  } = options;

  if (!userDataPath) {
    throw new Error('userDataPath is required');
  }

  try {
    // 创建账号配置管理器
    const accountConfigManager = new AccountConfigManager({
      userDataPath
    });

    // 创建迁移管理器
    const migrationManager = new MigrationManager({
      userDataPath,
      accountConfigManager
    });

    // 检查是否需要迁移
    const needsMigration = await migrationManager.needsMigration();

    if (!needsMigration) {
      console.log('[FirstRunWizard] No migration needed, skipping wizard');
      return {
        shown: false,
        migrated: false
      };
    }

    console.log('[FirstRunWizard] Migration needed, showing wizard');

    // 创建并显示向导
    const wizard = new FirstRunWizard({
      migrationManager,
      onComplete: () => {
        console.log('[FirstRunWizard] Wizard completed');
        onComplete();
      },
      onSkip: () => {
        console.log('[FirstRunWizard] Wizard skipped');
        onSkip();
      }
    });

    // 注册 IPC 处理器
    wizard.registerHandlers();

    // 显示向导
    await wizard.show();

    return {
      shown: true,
      migrated: false, // 迁移将在用户点击按钮后执行
      wizard
    };
  } catch (error) {
    console.error('[FirstRunWizard] Error showing wizard:', error);
    throw error;
  }
}

/**
 * 自动执行迁移（不显示向导）
 * @param {Object} options - 配置选项
 * @param {string} options.userDataPath - 用户数据路径
 * @param {boolean} options.silent - 是否静默执行
 * @returns {Promise<{migrated: boolean, result?: Object}>}
 */
async function autoMigrate(options) {
  const {
    userDataPath,
    silent = false
  } = options;

  if (!userDataPath) {
    throw new Error('userDataPath is required');
  }

  try {
    // 创建账号配置管理器
    const accountConfigManager = new AccountConfigManager({
      userDataPath
    });

    // 创建迁移管理器
    const migrationManager = new MigrationManager({
      userDataPath,
      accountConfigManager
    });

    // 检查是否需要迁移
    const needsMigration = await migrationManager.needsMigration();

    if (!needsMigration) {
      if (!silent) {
        console.log('[FirstRunWizard] No migration needed');
      }
      return {
        migrated: false
      };
    }

    if (!silent) {
      console.log('[FirstRunWizard] Starting automatic migration...');
    }

    // 执行迁移
    const result = await migrationManager.migrate();

    if (!silent) {
      if (result.success) {
        console.log('[FirstRunWizard] Migration completed successfully');
      } else {
        console.error('[FirstRunWizard] Migration failed:', result.message);
      }
    }

    return {
      migrated: result.success,
      result
    };
  } catch (error) {
    console.error('[FirstRunWizard] Error during auto migration:', error);
    throw error;
  }
}

/**
 * 获取迁移状态
 * @param {string} userDataPath - 用户数据路径
 * @returns {Promise<Object>}
 */
async function getMigrationStatus(userDataPath) {
  if (!userDataPath) {
    throw new Error('userDataPath is required');
  }

  try {
    const accountConfigManager = new AccountConfigManager({
      userDataPath
    });

    const migrationManager = new MigrationManager({
      userDataPath,
      accountConfigManager
    });

    return await migrationManager.getMigrationStatus();
  } catch (error) {
    console.error('[FirstRunWizard] Error getting migration status:', error);
    throw error;
  }
}

module.exports = {
  checkAndShowWizard,
  autoMigrate,
  getMigrationStatus
};
