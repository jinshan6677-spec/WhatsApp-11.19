/**
 * FirstRunWizard - 首次启动向导
 * 
 * 负责检测首次启动并显示欢迎界面和迁移说明
 * 自动执行数据迁移流程
 */

const { BrowserWindow, ipcMain } = require('electron');
const path = require('path');

class FirstRunWizard {
  constructor(options = {}) {
    this.window = null;
    this.migrationManager = options.migrationManager;
    this.onComplete = options.onComplete || (() => {});
    this.onSkip = options.onSkip || (() => {});
  }

  /**
   * 检查是否需要显示首次启动向导
   * @returns {Promise<boolean>}
   */
  async shouldShow() {
    if (!this.migrationManager) {
      return false;
    }

    try {
      const needsMigration = await this.migrationManager.needsMigration();
      return needsMigration;
    } catch (error) {
      console.error('[FirstRunWizard] Error checking if wizard should show:', error);
      return false;
    }
  }

  /**
   * 显示首次启动向导窗口
   * @returns {Promise<void>}
   */
  async show() {
    if (this.window) {
      this.window.focus();
      return;
    }

    return new Promise((resolve, reject) => {
      this.window = new BrowserWindow({
        width: 800,
        height: 600,
        resizable: false,
        minimizable: false,
        maximizable: false,
        title: 'WhatsApp Desktop - 欢迎',
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          sandbox: true,
          preload: path.join(__dirname, 'preload-wizard.js')
        },
        backgroundColor: '#ffffff',
        show: false,
        modal: true,
        center: true
      });

      // 加载向导 HTML
      this.window.loadFile(path.join(__dirname, 'wizard.html'));

      // 窗口准备好后显示
      this.window.once('ready-to-show', () => {
        this.window.show();
        resolve();
      });

      // 窗口关闭事件
      this.window.on('closed', () => {
        this.cleanup();
        this.window = null;
      });

      // 开发模式下打开开发者工具
      if (process.env.NODE_ENV === 'development') {
        this.window.webContents.openDevTools();
      }
    });
  }

  /**
   * 执行迁移流程
   * @returns {Promise<Object>}
   */
  async executeMigration() {
    if (!this.migrationManager) {
      return {
        success: false,
        message: 'Migration manager not available'
      };
    }

    try {
      // 发送迁移开始事件
      this.sendToWindow('migration:started');

      // 执行迁移
      const result = await this.migrationManager.migrate();

      // 发送迁移完成事件
      if (result.success) {
        this.sendToWindow('migration:completed', result);
      } else {
        this.sendToWindow('migration:failed', result);
      }

      return result;
    } catch (error) {
      console.error('[FirstRunWizard] Migration execution error:', error);
      const errorResult = {
        success: false,
        message: `Migration failed: ${error.message}`,
        details: { error: error.stack }
      };
      this.sendToWindow('migration:failed', errorResult);
      return errorResult;
    }
  }

  /**
   * 发送消息到向导窗口
   * @param {string} channel - IPC 通道
   * @param {*} data - 数据
   */
  sendToWindow(channel, data) {
    if (this.window && this.window.webContents) {
      this.window.webContents.send(channel, data);
    }
  }

  /**
   * 关闭向导窗口
   */
  close() {
    if (this.window) {
      this.window.close();
    }
  }

  /**
   * 注册 IPC 处理器
   */
  registerHandlers() {
    // 开始迁移
    ipcMain.handle('wizard:start-migration', async () => {
      return await this.executeMigration();
    });

    // 跳过迁移
    ipcMain.handle('wizard:skip', async () => {
      this.close();
      this.onSkip();
      return { success: true };
    });

    // 完成向导
    ipcMain.handle('wizard:complete', async () => {
      this.close();
      this.onComplete();
      return { success: true };
    });

    // 获取迁移状态
    ipcMain.handle('wizard:get-status', async () => {
      if (!this.migrationManager) {
        return { needsMigration: false };
      }
      return await this.migrationManager.getMigrationStatus();
    });
  }

  /**
   * 清理 IPC 处理器
   */
  cleanup() {
    ipcMain.removeHandler('wizard:start-migration');
    ipcMain.removeHandler('wizard:skip');
    ipcMain.removeHandler('wizard:complete');
    ipcMain.removeHandler('wizard:get-status');
  }
}

module.exports = FirstRunWizard;
