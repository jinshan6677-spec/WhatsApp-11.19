/**
 * MainApplicationWindow - 主应用窗口管理类
 * 
 * 负责创建和管理主应用窗口，提供账号管理界面
 */

const { BrowserWindow } = require('electron');
const path = require('path');

class MainApplicationWindow {
  constructor() {
    this.window = null;
  }

  /**
   * 初始化主窗口
   */
  initialize() {
    if (this.window) {
      this.window.focus();
      return this.window;
    }

    this.window = new BrowserWindow({
      width: 1200,
      height: 800,
      minWidth: 800,
      minHeight: 600,
      title: 'WhatsApp 账号管理',
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
        preload: path.join(__dirname, 'preload-main.js')
      },
      backgroundColor: '#f5f5f5',
      show: false
    });

    // 加载主窗口 HTML
    this.window.loadFile(path.join(__dirname, 'index.html'));

    // 窗口准备好后显示
    this.window.once('ready-to-show', () => {
      this.window.show();
    });

    // 窗口关闭事件
    this.window.on('closed', () => {
      this.window = null;
    });

    // 开发模式下打开开发者工具
    if (process.env.NODE_ENV === 'development') {
      this.window.webContents.openDevTools();
    }

    return this.window;
  }

  /**
   * 渲染账号列表
   * @param {Array} accounts - 账号配置数组
   */
  renderAccountList(accounts) {
    if (!this.window || !this.window.webContents) {
      return;
    }

    this.window.webContents.send('accounts:render', accounts);
  }

  /**
   * 更新账号状态
   * @param {string} accountId - 账号 ID
   * @param {Object} status - 状态对象
   */
  updateAccountStatus(accountId, status) {
    if (!this.window || !this.window.webContents) {
      return;
    }

    this.window.webContents.send('account:status-update', {
      accountId,
      status
    });
  }

  /**
   * 显示通知
   * @param {string} accountId - 账号 ID
   * @param {string} message - 通知消息
   */
  showNotification(accountId, message) {
    if (!this.window || !this.window.webContents) {
      return;
    }

    this.window.webContents.send('notification:show', {
      accountId,
      message
    });
  }

  /**
   * 获取窗口对象
   * @returns {BrowserWindow|null}
   */
  getWindow() {
    return this.window;
  }

  /**
   * 关闭窗口
   */
  close() {
    if (this.window) {
      this.window.close();
    }
  }

  /**
   * 聚焦窗口
   */
  focus() {
    if (this.window) {
      if (this.window.isMinimized()) {
        this.window.restore();
      }
      this.window.focus();
    }
  }
}

module.exports = MainApplicationWindow;
