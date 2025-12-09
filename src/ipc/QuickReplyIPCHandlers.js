/**
 * Quick Reply IPC Handlers
 * 
 * Handles IPC communication for quick reply functionality
 */

const { ipcMain } = require('electron');
const QuickReplyController = require('../quick-reply/controllers/QuickReplyController');

// Store controller instances per account
const controllers = new Map();

// Store dependencies
let dependencies = null;

/**
 * Get or create controller for account
 * @param {string} accountId - Account ID
 * @returns {QuickReplyController}
 */
function getController(accountId) {
  const controllerKey = accountId;
  
  if (!controllers.has(controllerKey)) {
    console.log(`[QuickReply IPC] Creating controller for account: ${accountId}`);
    
    // Verify QuickReplyController is a constructor
    if (typeof QuickReplyController !== 'function') {
      console.error('[QuickReply IPC] QuickReplyController is not a function:', typeof QuickReplyController);
      throw new Error('QuickReplyController is not properly imported');
    }
    
    // Create WhatsApp Web interface wrapper for this account
    const whatsappWebInterface = createWhatsAppWebInterface(accountId);
    
    try {
      const controller = new QuickReplyController(
        accountId,
        dependencies.translationService,
        whatsappWebInterface
      );
      controllers.set(controllerKey, controller);
      console.log(`[QuickReply IPC] Controller created successfully for account: ${accountId}`);
    } catch (error) {
      console.error(`[QuickReply IPC] Failed to create controller for account ${accountId}:`, error);
      throw error;
    }
  }
  return controllers.get(controllerKey);
}

/**
 * Create WhatsApp Web interface wrapper for account
 * @param {string} accountId - Account ID
 * @returns {Object} WhatsApp Web interface
 */
function createWhatsAppWebInterface(accountId) {
  const { viewManager } = dependencies;
  
  return {
    sendMessage: async (text) => {
      const view = viewManager.getView(accountId);
      if (!view || !view.webContents) {
        throw new Error('View not found for account');
      }
      
      // Execute WhatsApp Web send message script with multiple selector fallbacks
      await view.webContents.executeJavaScript(`
        (async function() {
          // Multiple selectors for input box (WhatsApp Web updates frequently)
          const inputSelectors = [
            '[data-testid="conversation-compose-box-input"]',
            'footer [contenteditable="true"]',
            'div[contenteditable="true"][data-tab="10"]',
            'div[contenteditable="true"][role="textbox"]',
            '#main footer div[contenteditable="true"]'
          ];
          
          let inputBox = null;
          for (const selector of inputSelectors) {
            inputBox = document.querySelector(selector);
            if (inputBox) break;
          }
          
          if (!inputBox) {
            console.error('[QuickReply] Input box not found. Tried selectors:', inputSelectors);
            throw new Error('Input box not found - please open a chat first');
          }
          
          // Focus and insert text
          inputBox.focus();
          
          // Try multiple methods to insert text
          const text = ${JSON.stringify(text)};
          
          // Method 1: execCommand
          if (!document.execCommand('insertText', false, text)) {
            // Method 2: Direct manipulation
            inputBox.textContent = text;
            inputBox.dispatchEvent(new InputEvent('input', { bubbles: true, data: text }));
          }
          
          // Wait for text to be inserted
          await new Promise(resolve => setTimeout(resolve, 100));
          
          // Multiple selectors for send button
          const sendSelectors = [
            '[data-testid="send"]',
            'button[data-testid="send"]',
            'span[data-testid="send"]',
            'button[data-icon="send"]',
            '[data-icon="send"]',
            'footer button[aria-label*="Send"]',
            'footer button[aria-label*="发送"]',
            '#main footer button:last-child'
          ];
          
          let sendButton = null;
          for (const selector of sendSelectors) {
            sendButton = document.querySelector(selector);
            if (sendButton) break;
          }
          
          if (!sendButton) {
            console.error('[QuickReply] Send button not found. Tried selectors:', sendSelectors);
            throw new Error('Send button not found - text has been inserted, please send manually');
          }
          
          sendButton.click();
        })();
      `);
    },
    
    insertText: async (text) => {
      const view = viewManager.getView(accountId);
      if (!view || !view.webContents) {
        throw new Error('View not found for account');
      }
      
      await view.webContents.executeJavaScript(`
        (function() {
          // Multiple selectors for input box
          const inputSelectors = [
            '[data-testid="conversation-compose-box-input"]',
            'footer [contenteditable="true"]',
            'div[contenteditable="true"][data-tab="10"]',
            'div[contenteditable="true"][role="textbox"]',
            '#main footer div[contenteditable="true"]'
          ];
          
          let inputBox = null;
          for (const selector of inputSelectors) {
            inputBox = document.querySelector(selector);
            if (inputBox) break;
          }
          
          if (!inputBox) {
            console.error('[QuickReply] Input box not found. Tried selectors:', inputSelectors);
            throw new Error('Input box not found - please open a chat first');
          }
          
          inputBox.focus();
          
          const text = ${JSON.stringify(text)};
          
          // Try execCommand first
          if (!document.execCommand('insertText', false, text)) {
            // Fallback: append to existing content
            const existingText = inputBox.textContent || '';
            inputBox.textContent = existingText + text;
            inputBox.dispatchEvent(new InputEvent('input', { bubbles: true, data: text }));
          }
          
          // Move cursor to end
          const range = document.createRange();
          const sel = window.getSelection();
          range.selectNodeContents(inputBox);
          range.collapse(false);
          sel.removeAllRanges();
          sel.addRange(range);
        })();
      `);
    },
    
    sendImage: async (imagePath) => {
      // TODO: Implement image sending
      throw new Error('Image sending not yet implemented');
    },
    
    sendAudio: async (audioPath) => {
      // TODO: Implement audio sending
      throw new Error('Audio sending not yet implemented');
    },
    
    sendVideo: async (videoPath) => {
      // TODO: Implement video sending
      throw new Error('Video sending not yet implemented');
    },
    
    sendContact: async (contactInfo) => {
      // TODO: Implement contact sending
      throw new Error('Contact sending not yet implemented');
    },
    
    attachMedia: async (mediaPath) => {
      // TODO: Implement media attachment
      throw new Error('Media attachment not yet implemented');
    },
    
    attachContact: async (contactInfo) => {
      // TODO: Implement contact attachment
      throw new Error('Contact attachment not yet implemented');
    },
    
    focusInput: async () => {
      const view = viewManager.getView(accountId);
      if (!view || !view.webContents) {
        throw new Error('View not found for account');
      }
      
      await view.webContents.executeJavaScript(`
        (function() {
          const inputSelectors = [
            '[data-testid="conversation-compose-box-input"]',
            'footer [contenteditable="true"]',
            'div[contenteditable="true"][data-tab="10"]',
            'div[contenteditable="true"][role="textbox"]',
            '#main footer div[contenteditable="true"]'
          ];
          
          let inputBox = null;
          for (const selector of inputSelectors) {
            inputBox = document.querySelector(selector);
            if (inputBox) break;
          }
          
          if (inputBox) {
            inputBox.focus();
            // Move cursor to end
            const range = document.createRange();
            const sel = window.getSelection();
            range.selectNodeContents(inputBox);
            range.collapse(false);
            sel.removeAllRanges();
            sel.addRange(range);
          }
        })();
      `);
    }
  };
}

/**
 * Register quick reply IPC handlers
 * @param {Object} deps - Dependencies
 * @param {Object} deps.translationService - Translation service
 * @param {Object} deps.viewManager - View manager
 * @param {Object} deps.mainWindow - Main window
 * @param {Object} deps.accountManager - Account manager
 */
function registerQuickReplyHandlers(deps) {
  console.log('[QuickReply IPC] Registering handlers...');
  
  // Store dependencies
  dependencies = deps;

  // Listen for account switch events from the main process
  if (deps.mainWindow) {
    // Hook into account:active-changed event
    const originalSendToRenderer = deps.mainWindow.sendToRenderer;
    if (originalSendToRenderer) {
      deps.mainWindow.sendToRenderer = function(channel, ...args) {
        // Call original method
        originalSendToRenderer.call(this, channel, ...args);
        
        // If this is an account switch event, handle it
        if (channel === 'account:active-changed' && args[0] && args[0].accountId) {
          handleAccountSwitch(args[0].accountId, deps.mainWindow);
        }
      };
    }
  }

  // Load quick reply for account
  ipcMain.handle('quick-reply:load', async (event, accountId) => {
    try {
      console.log(`[QuickReply IPC] Loading data for account: ${accountId}`);
      
      // Get or create controller
      const controller = getController(accountId);
      
      // Initialize controller if not already initialized
      if (!controller._initialized) {
        await controller.initialize();
        controller._initialized = true;
      }
      
      // Load data
      const templates = await controller.templateManager.storage.getAll();
      const groups = await controller.groupManager.getAllGroups();
      
      console.log(`[QuickReply IPC] Loaded ${templates.length} templates, ${groups.length} groups`);
      
      return {
        success: true,
        accountId,
        templates,
        groups,
        templateCount: templates.length,
        groupCount: groups.length
      };
    } catch (error) {
      console.error('[QuickReply IPC] Load error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });

  // Send template
  ipcMain.handle('quick-reply:send-template', async (event, { templateId, mode }) => {
    try {
      const accountId = getCurrentAccountId(dependencies.viewManager);
      console.log(`[QuickReply IPC] Sending template ${templateId} for account ${accountId}, mode: ${mode}`);
      
      const controller = getController(accountId);
      await controller.sendTemplate(templateId, mode);
      
      return { success: true };
    } catch (error) {
      console.error('[QuickReply IPC] Send template error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });

  // Insert template
  ipcMain.handle('quick-reply:insert-template', async (event, { templateId, mode }) => {
    try {
      const accountId = getCurrentAccountId(dependencies.viewManager);
      console.log(`[QuickReply IPC] Inserting template ${templateId} for account ${accountId}, mode: ${mode}`);
      
      const controller = getController(accountId);
      await controller.insertTemplate(templateId, mode);
      
      return { success: true };
    } catch (error) {
      console.error('[QuickReply IPC] Insert template error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });

  // Search templates
  ipcMain.handle('quick-reply:search', async (event, keyword) => {
    try {
      const accountId = getCurrentAccountId(dependencies.viewManager);
      console.log(`[QuickReply IPC] Searching templates for account ${accountId}, keyword: ${keyword}`);
      
      const controller = getController(accountId);
      const results = await controller.searchTemplates(keyword);
      
      return {
        success: true,
        results
      };
    } catch (error) {
      console.error('[QuickReply IPC] Search error:', error);
      return {
        success: false,
        error: error.message,
        results: []
      };
    }
  });

  // Open management interface
  ipcMain.handle('quick-reply:open-management', async (event) => {
    try {
      const accountId = getCurrentAccountId(dependencies.viewManager);
      console.log(`[QuickReply IPC] Opening management interface for account ${accountId}`);
      
      const controller = getController(accountId);
      controller.openManagementInterface();
      
      return { success: true };
    } catch (error) {
      console.error('[QuickReply IPC] Open management error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });

  // Create template
  ipcMain.handle('quick-reply:create-template', async (event, templateData) => {
    try {
      const accountId = getCurrentAccountId(dependencies.viewManager);
      console.log(`[QuickReply IPC] Creating template for account ${accountId}:`, templateData);
      
      const controller = getController(accountId);
      
      // Ensure we have a default group
      let groupId = templateData.groupId;
      if (!groupId) {
        // Get or create default group
        const groups = await controller.groupManager.getAllGroups();
        if (groups.length === 0) {
          // Create default group
          const defaultGroup = await controller.groupManager.createGroup('默认分组');
          groupId = defaultGroup.id;
        } else {
          groupId = groups[0].id;
        }
      }
      
      // Prepare parameters for createTemplate(groupId, type, label, content)
      const type = 'text';
      const label = templateData.label || '未命名模板';
      const content = {
        text: templateData.content || ''
      };
      
      // Use template manager to create
      const created = await controller.templateManager.createTemplate(groupId, type, label, content);
      
      console.log(`[QuickReply IPC] Template created:`, created.id);
      
      return {
        success: true,
        template: created
      };
    } catch (error) {
      console.error('[QuickReply IPC] Create template error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });

  // Delete template
  ipcMain.handle('quick-reply:delete-template', async (event, templateId) => {
    try {
      const accountId = getCurrentAccountId(dependencies.viewManager);
      console.log(`[QuickReply IPC] Deleting template ${templateId} for account ${accountId}`);
      
      const controller = getController(accountId);
      await controller.templateManager.deleteTemplate(templateId);
      
      return { success: true };
    } catch (error) {
      console.error('[QuickReply IPC] Delete template error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });

  // Update template
  ipcMain.handle('quick-reply:update-template', async (event, { templateId, updates }) => {
    try {
      const accountId = getCurrentAccountId(dependencies.viewManager);
      console.log(`[QuickReply IPC] Updating template ${templateId} for account ${accountId}`);
      
      const controller = getController(accountId);
      
      // Get existing template
      const existing = await controller.templateManager.getTemplate(templateId);
      if (!existing) {
        throw new Error('Template not found');
      }
      
      // Apply updates
      const updateData = {};
      if (updates.label !== undefined) updateData.label = updates.label;
      if (updates.content !== undefined) {
        updateData.content = typeof updates.content === 'string' 
          ? { text: updates.content } 
          : updates.content;
      }
      
      const updated = await controller.templateManager.updateTemplate(templateId, updateData);
      
      return {
        success: true,
        template: updated
      };
    } catch (error) {
      console.error('[QuickReply IPC] Update template error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });

  // Create group
  ipcMain.handle('quick-reply:create-group', async (event, { name, parentId }) => {
    try {
      const accountId = getCurrentAccountId(dependencies.viewManager);
      console.log(`[QuickReply IPC] Creating group for account ${accountId}:`, name);
      
      const controller = getController(accountId);
      const created = await controller.groupManager.createGroup(name, parentId);
      
      return {
        success: true,
        group: created
      };
    } catch (error) {
      console.error('[QuickReply IPC] Create group error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });

  // Delete group
  ipcMain.handle('quick-reply:delete-group', async (event, groupId) => {
    try {
      const accountId = getCurrentAccountId(dependencies.viewManager);
      console.log(`[QuickReply IPC] Deleting group ${groupId} for account ${accountId}`);
      
      const controller = getController(accountId);
      await controller.groupManager.deleteGroup(groupId);
      
      return { success: true };
    } catch (error) {
      console.error('[QuickReply IPC] Delete group error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });

  // Update group
  ipcMain.handle('quick-reply:update-group', async (event, { groupId, updates }) => {
    try {
      const accountId = getCurrentAccountId(dependencies.viewManager);
      console.log(`[QuickReply IPC] Updating group ${groupId} for account ${accountId}`);
      
      const controller = getController(accountId);
      const updated = await controller.groupManager.updateGroup(groupId, updates);
      
      return {
        success: true,
        group: updated
      };
    } catch (error) {
      console.error('[QuickReply IPC] Update group error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });

  console.log('[QuickReply IPC] Handlers registered (11 channels)');
}

/**
 * Unregister quick reply IPC handlers
 */
function unregisterQuickReplyHandlers() {
  console.log('[QuickReply IPC] Unregistering handlers...');
  
  ipcMain.removeHandler('quick-reply:load');
  ipcMain.removeHandler('quick-reply:send-template');
  ipcMain.removeHandler('quick-reply:insert-template');
  ipcMain.removeHandler('quick-reply:search');
  ipcMain.removeHandler('quick-reply:open-management');
  ipcMain.removeHandler('quick-reply:create-template');
  ipcMain.removeHandler('quick-reply:delete-template');
  ipcMain.removeHandler('quick-reply:update-template');
  ipcMain.removeHandler('quick-reply:create-group');
  ipcMain.removeHandler('quick-reply:delete-group');
  ipcMain.removeHandler('quick-reply:update-group');
  
  // Clear controller instances
  controllers.clear();
  
  // Clear dependencies
  dependencies = null;
  
  console.log('[QuickReply IPC] Handlers unregistered');
}

/**
 * Get current account ID from view manager
 * @param {Object} viewManager - View manager
 * @returns {string} Account ID
 */
function getCurrentAccountId(viewManager) {
  try {
    // Use getActiveAccountId() method which returns the account ID directly
    const activeAccountId = viewManager.getActiveAccountId();
    if (activeAccountId) {
      return activeAccountId;
    }
    
    // Fallback to default account
    console.warn('[QuickReply IPC] No active view, using default account');
    return 'default-account';
  } catch (error) {
    console.error('[QuickReply IPC] Error getting current account ID:', error);
    return 'default-account';
  }
}

/**
 * Handle account switch event
 * @param {string} accountId - New account ID
 * @param {Object} mainWindow - Main window
 */
async function handleAccountSwitch(accountId, mainWindow) {
  console.log(`[QuickReply IPC] Account switched to: ${accountId}`);
  
  try {
    // Get or create controller for new account
    const controller = getController(accountId);
    
    // Initialize controller if not already initialized
    if (!controller._initialized) {
      await controller.initialize();
      controller._initialized = true;
    }
    
    // Notify renderer process to reload quick reply data
    if (mainWindow && mainWindow.isReady()) {
      mainWindow.sendToRenderer('quick-reply:account-switched', { accountId });
    }
    
    console.log(`[QuickReply IPC] Account switch handled successfully for: ${accountId}`);
  } catch (error) {
    console.error('[QuickReply IPC] Error handling account switch:', error);
    
    // Notify renderer of error
    if (mainWindow && mainWindow.isReady()) {
      mainWindow.sendToRenderer('quick-reply:account-switch-error', { 
        accountId, 
        error: error.message 
      });
    }
  }
}

module.exports = {
  registerQuickReplyHandlers,
  unregisterQuickReplyHandlers,
  handleAccountSwitch
};
