/**
 * Preload Script for Main Application Window
 * 
 * 为主窗口渲染进程暴露安全的 API
 */

const { contextBridge, ipcRenderer } = require('electron');

// 暴露主窗口 API
contextBridge.exposeInMainWorld('mainAPI', {
  /**
   * 获取所有账号
   * @returns {Promise<Array>} 账号列表
   */
  getAccounts: () => {
    return ipcRenderer.invoke('accounts:get-all');
  },

  /**
   * 创建账号
   * @param {Object} config - 账号配置
   * @returns {Promise<Object>} 创建的账号
   */
  createAccount: (config) => {
    return ipcRenderer.invoke('account:create', config);
  },

  /**
   * 更新账号
   * @param {string} accountId - 账号 ID
   * @param {Object} config - 账号配置
   * @returns {Promise<Object>} 更新后的账号
   */
  updateAccount: (accountId, config) => {
    return ipcRenderer.invoke('account:update', accountId, config);
  },

  /**
   * 删除账号
   * @param {string} accountId - 账号 ID
   * @returns {Promise<void>}
   */
  deleteAccount: (accountId) => {
    return ipcRenderer.invoke('account:delete', accountId);
  },

  /**
   * 启动实例
   * @param {string} accountId - 账号 ID
   * @returns {Promise<void>}
   */
  startInstance: (accountId) => {
    return ipcRenderer.invoke('instance:start', accountId);
  },

  /**
   * 停止实例
   * @param {string} accountId - 账号 ID
   * @returns {Promise<void>}
   */
  stopInstance: (accountId) => {
    return ipcRenderer.invoke('instance:stop', accountId);
  },

  /**
   * 重启实例
   * @param {string} accountId - 账号 ID
   * @returns {Promise<void>}
   */
  restartInstance: (accountId) => {
    return ipcRenderer.invoke('instance:restart', accountId);
  },

  /**
   * 监听账号列表渲染事件
   * @param {Function} callback - 回调函数
   */
  onAccountsRender: (callback) => {
    ipcRenderer.on('accounts:render', (event, accounts) => {
      callback(accounts);
    });
  },

  /**
   * 监听账号状态更新事件
   * @param {Function} callback - 回调函数
   */
  onAccountStatusUpdate: (callback) => {
    ipcRenderer.on('account:status-update', (event, data) => {
      callback(data);
    });
  },

  /**
   * 监听通知显示事件
   * @param {Function} callback - 回调函数
   */
  onNotificationShow: (callback) => {
    ipcRenderer.on('notification:show', (event, data) => {
      callback(data);
    });
  },

  /**
   * 请求状态更新
   * @param {string} accountId - 账号 ID（可选，不传则获取所有）
   * @returns {Promise<Object>} 状态信息
   */
  requestStatus: (accountId) => {
    return ipcRenderer.invoke('status:request', accountId);
  },

  /**
   * 获取翻译配置
   * @param {string} accountId - 账号 ID
   * @returns {Promise<Object>} 翻译配置
   */
  getTranslationConfig: (accountId) => {
    return ipcRenderer.invoke('translation:config-get', accountId);
  },

  /**
   * 更新翻译配置
   * @param {string} accountId - 账号 ID
   * @param {Object} config - 翻译配置
   * @returns {Promise<void>}
   */
  updateTranslationConfig: (accountId, config) => {
    return ipcRenderer.invoke('translation:config-update', accountId, config);
  },

  /**
   * 获取翻译状态
   * @param {string} accountId - 账号 ID
   * @returns {Promise<Object>} 翻译状态
   */
  getTranslationStatus: (accountId) => {
    return ipcRenderer.invoke('translation:status', accountId);
  }
});

console.log('[Preload] Main window API exposed');
