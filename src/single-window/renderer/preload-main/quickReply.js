/**
 * Quick Reply Preload API
 * 
 * Provides IPC communication for quick reply functionality
 */

/**
 * Create quick reply API
 * @param {Electron.IpcRenderer} ipcRenderer - IPC renderer instance
 * @returns {Object} Quick reply API wrapped in quickReply namespace
 */
function createQuickReplyAPI(ipcRenderer) {
  // Create the quickReply namespace object
  const quickReplyAPI = {
    /**
     * Load quick reply for account
     * @param {string} accountId - Account ID
     * @returns {Promise<Object>} Quick reply data
     */
    load: (accountId) => {
      return ipcRenderer.invoke('quick-reply:load', accountId);
    },

    /**
     * Send template
     * @param {string} templateId - Template ID
     * @param {string} mode - Send mode ('original' or 'translated')
     * @returns {Promise<void>}
     */
    sendTemplate: (templateId, mode) => {
      return ipcRenderer.invoke('quick-reply:send-template', { templateId, mode });
    },

    /**
     * Insert template to input box
     * @param {string} templateId - Template ID
     * @param {string} mode - Send mode ('original' or 'translated')
     * @returns {Promise<void>}
     */
    insertTemplate: (templateId, mode) => {
      return ipcRenderer.invoke('quick-reply:insert-template', { templateId, mode });
    },

    /**
     * Search templates
     * @param {string} keyword - Search keyword
     * @returns {Promise<Array>} Search results
     */
    searchTemplates: (keyword) => {
      return ipcRenderer.invoke('quick-reply:search', keyword);
    },

    /**
     * Open management interface
     * @returns {Promise<void>}
     */
    openManagement: () => {
      return ipcRenderer.invoke('quick-reply:open-management');
    },

    /**
     * Create a new template
     * @param {Object} template - Template data
     * @param {string} template.label - Template name
     * @param {string} template.content - Template content (text)
     * @param {string} [template.groupId] - Group ID
     * @returns {Promise<Object>} Created template
     */
    createTemplate: (template) => {
      return ipcRenderer.invoke('quick-reply:create-template', template);
    },

    /**
     * Delete a template
     * @param {string} templateId - Template ID
     * @returns {Promise<void>}
     */
    deleteTemplate: (templateId) => {
      return ipcRenderer.invoke('quick-reply:delete-template', templateId);
    },

    /**
     * Update a template
     * @param {string} templateId - Template ID
     * @param {Object} updates - Updates to apply
     * @returns {Promise<Object>} Updated template
     */
    updateTemplate: (templateId, updates) => {
      return ipcRenderer.invoke('quick-reply:update-template', { templateId, updates });
    },

    /**
     * Create a new group
     * @param {string} name - Group name
     * @param {string} [parentId] - Parent group ID
     * @returns {Promise<Object>} Created group
     */
    createGroup: (name, parentId) => {
      return ipcRenderer.invoke('quick-reply:create-group', { name, parentId });
    },

    /**
     * Delete a group
     * @param {string} groupId - Group ID
     * @returns {Promise<void>}
     */
    deleteGroup: (groupId) => {
      return ipcRenderer.invoke('quick-reply:delete-group', groupId);
    },

    /**
     * Update a group
     * @param {string} groupId - Group ID
     * @param {Object} updates - Updates to apply
     * @returns {Promise<Object>} Updated group
     */
    updateGroup: (groupId, updates) => {
      return ipcRenderer.invoke('quick-reply:update-group', { groupId, updates });
    },

    /**
     * Listen for quick reply events
     * @param {Function} callback - Event callback
     * @returns {Function} Cleanup function
     */
    onQuickReplyEvent: (callback) => {
      const handler = (_event, eventName, data) => {
        callback(eventName, data);
      };
      ipcRenderer.on('quick-reply:event', handler);
      return () => {
        ipcRenderer.removeListener('quick-reply:event', handler);
      };
    },

    /**
     * Listen for account switch events
     * @param {Function} callback - Event callback
     * @returns {Function} Cleanup function
     */
    onAccountSwitch: (callback) => {
      // Listen for both account:active-changed and quick-reply:account-switched
      const handler1 = (_event, data) => {
        const accountId = typeof data === 'string' ? data : data?.accountId;
        if (accountId) {
          callback(accountId);
        }
      };
      
      const handler2 = (_event, data) => {
        const accountId = typeof data === 'string' ? data : data?.accountId;
        if (accountId) {
          callback(accountId);
        }
      };
      
      ipcRenderer.on('account:active-changed', handler1);
      ipcRenderer.on('quick-reply:account-switched', handler2);
      
      return () => {
        ipcRenderer.removeListener('account:active-changed', handler1);
        ipcRenderer.removeListener('quick-reply:account-switched', handler2);
      };
    },

    /**
     * Listen for account switch errors
     * @param {Function} callback - Error callback
     * @returns {Function} Cleanup function
     */
    onAccountSwitchError: (callback) => {
      const handler = (_event, data) => {
        callback(data);
      };
      ipcRenderer.on('quick-reply:account-switch-error', handler);
      return () => {
        ipcRenderer.removeListener('quick-reply:account-switch-error', handler);
      };
    }
  };

  // Return wrapped in quickReply namespace
  return {
    quickReply: quickReplyAPI
  };
}

module.exports = createQuickReplyAPI;
