/**
 * IPC Handlers for Main Application Window
 * 
 * 处理主窗口与主进程之间的 IPC 通信
 */

const { ipcMain } = require('electron');
const { v4: uuidv4 } = require('uuid');
const AccountConfig = require('../models/AccountConfig');

/**
 * 注册 IPC 处理器
 * @param {AccountConfigManager} configManager - 账号配置管理器
 * @param {InstanceManager} instanceManager - 实例管理器
 * @param {MainApplicationWindow} mainWindow - 主窗口
 * @param {string} [userDataPath] - 用户数据路径
 */
function registerIPCHandlers(configManager, instanceManager, mainWindow, userDataPath) {
  /**
   * 获取所有账号
   */
  ipcMain.handle('accounts:get-all', async () => {
    try {
      const accounts = await configManager.loadAccounts();
      
      // 附加实例状态信息
      const accountsWithStatus = accounts.map(account => {
        const status = instanceManager.getInstanceStatus(account.id);
        return {
          ...account,
          status: status?.status || 'stopped',
          unreadCount: status?.unreadCount || 0,
          lastActiveAt: status?.lastHeartbeat || account.lastActiveAt
        };
      });
      
      return accountsWithStatus;
    } catch (error) {
      console.error('[IPC] Failed to get accounts:', error);
      throw error;
    }
  });

  /**
   * 创建账号
   */
  ipcMain.handle('account:create', async (event, config) => {
    try {
      // 创建账号配置实例
      const accountConfig = new AccountConfig({
        id: uuidv4(),
        name: config.name,
        createdAt: new Date().toISOString(),
        lastActiveAt: null,
        proxy: config.proxy,
        translation: config.translation,
        window: config.window,
        notifications: config.notifications
      });
      
      // 保存配置
      const result = await configManager.saveAccount(accountConfig);
      
      if (!result.success) {
        throw new Error(result.errors.join(', '));
      }
      
      // 刷新主窗口
      const accounts = await configManager.loadAccounts();
      mainWindow.renderAccountList(accounts);
      
      return accountConfig.toJSON();
    } catch (error) {
      console.error('[IPC] Failed to create account:', error);
      throw error;
    }
  });

  /**
   * 更新账号
   */
  ipcMain.handle('account:update', async (event, accountId, config) => {
    try {
      // 获取现有配置
      const existingAccount = await configManager.getAccount(accountId);
      if (!existingAccount) {
        throw new Error(`Account ${accountId} not found`);
      }
      
      // 合并配置
      const updatedAccount = {
        ...existingAccount,
        name: config.name,
        proxy: config.proxy,
        translation: config.translation
      };
      
      // 保存配置
      await configManager.updateAccount(accountId, updatedAccount);
      
      // 如果实例正在运行，应用新配置
      const status = instanceManager.getInstanceStatus(accountId);
      if (status && status.status === 'running') {
        // 更新代理配置
        if (config.proxy && config.proxy.enabled) {
          await instanceManager.applyProxyConfig(accountId, config.proxy);
        }
        
        // 更新翻译配置
        if (config.translation) {
          await instanceManager.injectTranslationScripts(accountId);
        }
      }
      
      // 刷新主窗口
      const accounts = await configManager.loadAccounts();
      mainWindow.renderAccountList(accounts);
      
      return updatedAccount;
    } catch (error) {
      console.error('[IPC] Failed to update account:', error);
      throw error;
    }
  });

  /**
   * 删除账号
   */
  ipcMain.handle('account:delete', async (event, accountId) => {
    try {
      // 如果实例正在运行，先停止
      const status = instanceManager.getInstanceStatus(accountId);
      if (status && status.status === 'running') {
        await instanceManager.destroyInstance(accountId);
      }
      
      // 删除配置和数据 - 默认清理用户数据
      const deleteOptions = {
        deleteUserData: true,
        userDataPath: userDataPath
      };
      
      const result = await configManager.deleteAccount(accountId, deleteOptions);
      
      if (!result.success) {
        throw new Error(result.errors.join(', '));
      }
      
      console.log(`[IPC] Account ${accountId} and associated data deleted successfully`);
      
      // 刷新主窗口
      const accounts = await configManager.loadAccounts();
      mainWindow.renderAccountList(accounts);
    } catch (error) {
      console.error('[IPC] Failed to delete account:', error);
      throw error;
    }
  });

  /**
   * 启动实例
   */
  ipcMain.handle('instance:start', async (event, accountId) => {
    try {
      // 获取账号配置
      const accountConfig = await configManager.getAccount(accountId);
      if (!accountConfig) {
        throw new Error(`Account ${accountId} not found`);
      }
      
      // 更新状态为 starting
      mainWindow.updateAccountStatus(accountId, { status: 'starting' });
      
      // 创建实例
      const result = await instanceManager.createInstance(accountConfig);
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to create instance');
      }
      
      // 更新最后活跃时间
      await configManager.updateAccount(accountId, {
        ...accountConfig,
        lastActiveAt: new Date().toISOString()
      });
      
      // 更新状态为 running
      mainWindow.updateAccountStatus(accountId, { status: 'running' });
    } catch (error) {
      console.error('[IPC] Failed to start instance:', error);
      mainWindow.updateAccountStatus(accountId, { status: 'error' });
      throw error;
    }
  });

  /**
   * 停止实例
   */
  ipcMain.handle('instance:stop', async (event, accountId) => {
    try {
      await instanceManager.destroyInstance(accountId);
      mainWindow.updateAccountStatus(accountId, { status: 'stopped' });
    } catch (error) {
      console.error('[IPC] Failed to stop instance:', error);
      throw error;
    }
  });

  /**
   * 重启实例
   */
  ipcMain.handle('instance:restart', async (event, accountId) => {
    try {
      // 获取账号配置
      const accountConfig = await configManager.getAccount(accountId);
      if (!accountConfig) {
        throw new Error(`Account ${accountId} not found`);
      }
      
      // 更新状态为 starting
      mainWindow.updateAccountStatus(accountId, { status: 'starting' });
      
      // 重启实例
      await instanceManager.restartInstance(accountId);
      
      // 更新状态为 running
      mainWindow.updateAccountStatus(accountId, { status: 'running' });
    } catch (error) {
      console.error('[IPC] Failed to restart instance:', error);
      mainWindow.updateAccountStatus(accountId, { status: 'error' });
      throw error;
    }
  });

  /**
   * 请求状态更新
   */
  ipcMain.handle('status:request', async (event, accountId) => {
    try {
      if (accountId) {
        // 获取单个账号的状态
        const status = instanceManager.getInstanceStatus(accountId);
        const account = await configManager.getAccount(accountId);
        
        if (!account) {
          throw new Error(`Account ${accountId} not found`);
        }
        
        return {
          accountId,
          status: status?.status || 'stopped',
          memoryUsage: status?.memoryUsage || 0,
          cpuUsage: status?.cpuUsage || 0,
          unreadCount: status?.unreadCount || 0,
          isLoggedIn: status?.isLoggedIn || false,
          lastHeartbeat: status?.lastHeartbeat || null,
          error: status?.error || null
        };
      } else {
        // 获取所有账号的状态
        const accounts = await configManager.loadAccounts();
        const statuses = accounts.map(account => {
          const status = instanceManager.getInstanceStatus(account.id);
          return {
            accountId: account.id,
            status: status?.status || 'stopped',
            memoryUsage: status?.memoryUsage || 0,
            cpuUsage: status?.cpuUsage || 0,
            unreadCount: status?.unreadCount || 0,
            isLoggedIn: status?.isLoggedIn || false,
            lastHeartbeat: status?.lastHeartbeat || null,
            error: status?.error || null
          };
        });
        
        return statuses;
      }
    } catch (error) {
      console.error('[IPC] Failed to get status:', error);
      throw error;
    }
  });

  /**
   * 获取翻译配置
   */
  ipcMain.handle('translation:config-get', async (event, accountId) => {
    try {
      const account = await configManager.getAccount(accountId);
      if (!account) {
        throw new Error(`Account ${accountId} not found`);
      }
      
      return account.translation || {
        enabled: false,
        targetLanguage: 'zh-CN',
        engine: 'google',
        autoTranslate: false,
        translateInput: false,
        friendSettings: {}
      };
    } catch (error) {
      console.error('[IPC] Failed to get translation config:', error);
      throw error;
    }
  });

  /**
   * 更新翻译配置
   */
  ipcMain.handle('translation:config-update', async (event, accountId, config) => {
    try {
      const account = await configManager.getAccount(accountId);
      if (!account) {
        throw new Error(`Account ${accountId} not found`);
      }
      
      // 更新翻译配置
      const updatedAccount = {
        ...account,
        translation: {
          ...account.translation,
          ...config
        }
      };
      
      await configManager.updateAccount(accountId, updatedAccount);
      
      // 如果实例正在运行，应用新的翻译配置
      const status = instanceManager.getInstanceStatus(accountId);
      if (status && status.status === 'running') {
        await instanceManager.injectTranslationScripts(accountId);
      }
      
      return updatedAccount.translation;
    } catch (error) {
      console.error('[IPC] Failed to update translation config:', error);
      throw error;
    }
  });

  /**
   * 获取翻译状态
   */
  ipcMain.handle('translation:status', async (event, accountId) => {
    try {
      const account = await configManager.getAccount(accountId);
      if (!account) {
        throw new Error(`Account ${accountId} not found`);
      }
      
      const status = instanceManager.getInstanceStatus(accountId);
      const translationConfig = account.translation || {};
      
      return {
        enabled: translationConfig.enabled || false,
        engine: translationConfig.engine || 'google',
        targetLanguage: translationConfig.targetLanguage || 'zh-CN',
        isRunning: status?.status === 'running',
        lastError: null // TODO: Track translation errors
      };
    } catch (error) {
      console.error('[IPC] Failed to get translation status:', error);
      throw error;
    }
  });

  /**
   * 检查会话数据是否存在
   */
  ipcMain.handle('session:has-data', async (event, accountId) => {
    try {
      const hasData = await instanceManager.hasSessionData(accountId);
      return hasData;
    } catch (error) {
      console.error('[IPC] Failed to check session data:', error);
      throw error;
    }
  });

  /**
   * 清除会话数据（强制重新登录）
   */
  ipcMain.handle('session:clear', async (event, accountId) => {
    try {
      const result = await instanceManager.clearSessionData(accountId);
      
      if (result.success) {
        // 更新主窗口状态
        mainWindow.updateAccountStatus(accountId, { 
          isLoggedIn: false,
          error: 'Session cleared, please login again'
        });
      }
      
      return result;
    } catch (error) {
      console.error('[IPC] Failed to clear session data:', error);
      throw error;
    }
  });

  /**
   * 获取会话数据统计
   */
  ipcMain.handle('session:stats', async (event, accountId) => {
    try {
      const stats = await instanceManager.getSessionDataStats(accountId);
      return stats;
    } catch (error) {
      console.error('[IPC] Failed to get session stats:', error);
      throw error;
    }
  });

  console.log('[IPC] Main window handlers registered');
}

/**
 * 注销 IPC 处理器
 */
function unregisterIPCHandlers() {
  ipcMain.removeHandler('accounts:get-all');
  ipcMain.removeHandler('account:create');
  ipcMain.removeHandler('account:update');
  ipcMain.removeHandler('account:delete');
  ipcMain.removeHandler('instance:start');
  ipcMain.removeHandler('instance:stop');
  ipcMain.removeHandler('instance:restart');
  ipcMain.removeHandler('status:request');
  ipcMain.removeHandler('translation:config-get');
  ipcMain.removeHandler('translation:config-update');
  ipcMain.removeHandler('translation:status');
  ipcMain.removeHandler('session:has-data');
  ipcMain.removeHandler('session:clear');
  ipcMain.removeHandler('session:stats');
  
  console.log('[IPC] Main window handlers unregistered');
}

module.exports = {
  registerIPCHandlers,
  unregisterIPCHandlers
};
