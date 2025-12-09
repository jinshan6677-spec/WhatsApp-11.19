/**
 * QuickReplyController
 * 
 * Main controller for the Quick Reply feature.
 * Coordinates between UI components, managers, and handles user interactions.
 * 
 * Requirements: 1.1-1.7, 12.1-12.14
 */

const EventEmitter = require('events');
const TemplateManager = require('../managers/TemplateManager');
const GroupManager = require('../managers/GroupManager');
const SendManager = require('../managers/SendManager');
const AccountSwitchHandler = require('../handlers/AccountSwitchHandler');
const { searchTemplates } = require('../utils/search');
const { Logger } = require('../utils/logger');
const ValidationError = require('../errors/ValidationError');
const SendError = require('../errors/SendError');
const TranslationError = require('../errors/TranslationError');

class QuickReplyController extends EventEmitter {
  /**
   * @param {string} accountId - The WhatsApp account ID
   * @param {Object} translationService - Translation service instance
   * @param {Object} whatsappWebInterface - WhatsApp Web interface instance
   * @param {string} [userDataPath] - Optional user data path (for testing)
   */
  constructor(accountId, translationService, whatsappWebInterface, userDataPath = null) {
    super();
    
    if (!accountId) {
      throw new Error('accountId is required');
    }
    
    this.accountId = accountId;
    this.translationService = translationService;
    this.whatsappWebInterface = whatsappWebInterface;
    this.userDataPath = userDataPath;
    this.logger = new Logger('QuickReplyController');
    
    // Initialize managers
    this.templateManager = new TemplateManager(accountId, userDataPath);
    this.groupManager = new GroupManager(accountId, userDataPath);
    this.sendManager = new SendManager(translationService, whatsappWebInterface, accountId);
    
    // Initialize account switch handler
    this.accountSwitchHandler = new AccountSwitchHandler(this, userDataPath);
    
    // UI components (will be set by UI layer)
    this.operationPanel = null;
    this.managementInterface = null;
    
    // State
    this.isOperationPanelOpen = false;
    this.isManagementInterfaceOpen = false;
    
    this.logger.info('QuickReplyController initialized', { accountId });
  }

  /**
   * Initialize the controller
   * @returns {Promise<void>}
   */
  async initialize() {
    try {
      this.logger.info('Initializing controller');
      
      // Initialize translation integration
      if (this.translationService) {
        await this.sendManager.initializeTranslation(this.accountId);
        this.logger.debug('Translation integration initialized');
      }
      
      // Load initial data
      await this.loadData();
      
      // Start listening for account switch events
      this.accountSwitchHandler.startListening();
      
      // Forward account switch events
      this.accountSwitchHandler.on('switching', (data) => {
        this.emit('account:switching', data);
      });
      
      this.accountSwitchHandler.on('switched', (data) => {
        this.emit('account:switched', data);
      });
      
      this.accountSwitchHandler.on('switch:error', (data) => {
        this.emit('account:switch-error', data);
      });
      
      this.emit('initialized');
      this.logger.info('Controller initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize controller', error);
      throw error;
    }
  }

  /**
   * Load data for current account
   * @returns {Promise<void>}
   */
  async loadData() {
    try {
      const groups = await this.groupManager.getAllGroups();
      const templates = await this.templateManager.storage.getAll();
      
      this.emit('data:loaded', { groups, templates });
      
      this.logger.debug('Data loaded', { 
        groupsCount: groups.length, 
        templatesCount: templates.length 
      });
    } catch (error) {
      this.logger.error('Failed to load data', error);
      throw error;
    }
  }

  /**
   * Open the operation panel (sidebar)
   * Requirements: 1.1-1.7
   */
  openOperationPanel() {
    try {
      if (this.isOperationPanelOpen) {
        this.logger.debug('Operation panel already open');
        return;
      }
      
      this.isOperationPanelOpen = true;
      this.emit('operation-panel:open');
      
      this.logger.info('Operation panel opened');
    } catch (error) {
      this.logger.error('Failed to open operation panel', error);
      throw error;
    }
  }

  /**
   * Close the operation panel
   * Requirements: 1.6
   */
  closeOperationPanel() {
    try {
      if (!this.isOperationPanelOpen) {
        this.logger.debug('Operation panel already closed');
        return;
      }
      
      this.isOperationPanelOpen = false;
      this.emit('operation-panel:close');
      
      this.logger.info('Operation panel closed');
    } catch (error) {
      this.logger.error('Failed to close operation panel', error);
      throw error;
    }
  }

  /**
   * Open the management interface (separate window)
   * Requirements: 12.1-12.14
   */
  openManagementInterface() {
    try {
      if (this.isManagementInterfaceOpen) {
        this.logger.debug('Management interface already open');
        return;
      }
      
      this.isManagementInterfaceOpen = true;
      this.emit('management-interface:open');
      
      this.logger.info('Management interface opened');
    } catch (error) {
      this.logger.error('Failed to open management interface', error);
      throw error;
    }
  }

  /**
   * Close the management interface
   * Requirements: 12.11
   */
  closeManagementInterface() {
    try {
      if (!this.isManagementInterfaceOpen) {
        this.logger.debug('Management interface already closed');
        return;
      }
      
      this.isManagementInterfaceOpen = false;
      this.emit('management-interface:close');
      
      this.logger.info('Management interface closed');
    } catch (error) {
      this.logger.error('Failed to close management interface', error);
      throw error;
    }
  }

  /**
   * Send a template
   * Requirements: 7.1-7.9, 8.1-8.9
   * @param {string} templateId - Template ID
   * @param {string} mode - Send mode: 'original' or 'translated'
   * @param {Object} [options] - Additional options (targetLanguage, style)
   * @returns {Promise<void>}
   */
  async sendTemplate(templateId, mode = 'original', options = {}) {
    try {
      if (!templateId) {
        throw new ValidationError('Template ID is required', 'templateId');
      }
      
      if (mode !== 'original' && mode !== 'translated') {
        throw new ValidationError('Invalid send mode. Must be "original" or "translated"', 'mode');
      }
      
      this.logger.info('Sending template', { templateId, mode });
      
      // Get template
      const template = await this.templateManager.getTemplate(templateId);
      if (!template) {
        throw new ValidationError('Template not found', 'templateId');
      }
      
      // Emit sending event
      this.emit('template:sending', { templateId, mode });
      
      try {
        // Send based on mode
        if (mode === 'original') {
          await this.sendManager.sendOriginal(template);
        } else {
          const { targetLanguage, style } = options;
          await this.sendManager.sendTranslated(template, targetLanguage, style);
        }
        
        // Record usage
        await this.templateManager.recordUsage(templateId);
        
        // Emit success event
        this.emit('template:sent', { templateId, mode, success: true });
        
        this.logger.info('Template sent successfully', { templateId, mode });
      } catch (sendError) {
        // Emit error event
        this.emit('template:sent', { templateId, mode, success: false, error: sendError });
        
        this.logger.error('Failed to send template', sendError);
        throw sendError;
      }
    } catch (error) {
      this.logger.error('Send template operation failed', error);
      throw error;
    }
  }

  /**
   * Insert template into input box
   * Requirements: 9.1-9.8
   * @param {string} templateId - Template ID
   * @param {string} mode - Send mode: 'original' or 'translated'
   * @param {Object} [options] - Additional options (targetLanguage, style)
   * @returns {Promise<void>}
   */
  async insertTemplate(templateId, mode = 'original', options = {}) {
    try {
      if (!templateId) {
        throw new ValidationError('Template ID is required', 'templateId');
      }
      
      if (mode !== 'original' && mode !== 'translated') {
        throw new ValidationError('Invalid send mode. Must be "original" or "translated"', 'mode');
      }
      
      this.logger.info('Inserting template', { templateId, mode });
      
      // Get template
      const template = await this.templateManager.getTemplate(templateId);
      if (!template) {
        throw new ValidationError('Template not found', 'templateId');
      }
      
      // Emit inserting event
      this.emit('template:inserting', { templateId, mode });
      
      try {
        // Insert based on mode
        if (mode === 'original') {
          await this.sendManager.insertOriginal(template);
        } else {
          const { targetLanguage, style } = options;
          await this.sendManager.insertTranslated(template, targetLanguage, style);
        }
        
        // Record usage
        await this.templateManager.recordUsage(templateId);
        
        // Emit success event
        this.emit('template:inserted', { templateId, mode, success: true });
        
        this.logger.info('Template inserted successfully', { templateId, mode });
      } catch (insertError) {
        // Emit error event
        this.emit('template:inserted', { templateId, mode, success: false, error: insertError });
        
        this.logger.error('Failed to insert template', insertError);
        throw insertError;
      }
    } catch (error) {
      this.logger.error('Insert template operation failed', error);
      throw error;
    }
  }

  /**
   * Search templates by keyword
   * Requirements: 6.1-6.6
   * @param {string} keyword - Search keyword
   * @returns {Promise<Object>} Search results with templates and groups
   */
  async searchTemplates(keyword) {
    try {
      this.logger.debug('Searching templates', { keyword });
      
      // Get all templates and groups
      const templates = await this.templateManager.storage.getAll();
      const groups = await this.groupManager.getAllGroups();
      
      // Perform search
      const matchingTemplateIds = searchTemplates(keyword, templates, groups);
      
      // Get matching templates
      const matchingTemplates = templates.filter(t => matchingTemplateIds.includes(t.id));
      
      // Get groups that contain matching templates
      const matchingGroupIds = new Set(matchingTemplates.map(t => t.groupId));
      const matchingGroups = groups.filter(g => matchingGroupIds.has(g.id));
      
      const results = {
        keyword,
        templates: matchingTemplates,
        groups: matchingGroups,
        hasResults: matchingTemplates.length > 0
      };
      
      // Emit search event
      this.emit('templates:searched', results);
      
      this.logger.debug('Search completed', { 
        keyword, 
        resultsCount: matchingTemplates.length 
      });
      
      return results;
    } catch (error) {
      this.logger.error('Search failed', error);
      throw error;
    }
  }

  /**
   * Refresh data (reload from storage)
   * Requirements: 20.2
   * @returns {Promise<void>}
   */
  async refresh() {
    try {
      this.logger.info('Refreshing data');
      
      await this.loadData();
      
      this.emit('refreshed');
      
      this.logger.info('Data refreshed successfully');
    } catch (error) {
      this.logger.error('Failed to refresh data', error);
      throw error;
    }
  }

  /**
   * Handle account switch
   * Requirements: 11.1-11.7
   * @param {string} newAccountId - New account ID
   * @returns {Promise<void>}
   */
  async switchAccount(newAccountId) {
    try {
      if (!newAccountId) {
        throw new ValidationError('New account ID is required', 'newAccountId');
      }
      
      if (newAccountId === this.accountId) {
        this.logger.debug('Already on this account', { accountId: newAccountId });
        return;
      }
      
      this.logger.info('Switching account', { 
        from: this.accountId, 
        to: newAccountId 
      });
      
      // Emit switching event
      this.emit('account:switching', { 
        oldAccountId: this.accountId, 
        newAccountId 
      });
      
      // Update account ID
      const oldAccountId = this.accountId;
      this.accountId = newAccountId;
      
      // Reinitialize managers with new account
      this.templateManager = new TemplateManager(newAccountId, this.userDataPath);
      this.groupManager = new GroupManager(newAccountId, this.userDataPath);
      
      // Switch translation account
      if (this.translationService) {
        await this.sendManager.switchAccount(newAccountId);
        this.logger.debug('Translation account switched');
      }
      
      // Load data for new account
      await this.loadData();
      
      // Emit switched event
      this.emit('account:switched', { 
        oldAccountId, 
        newAccountId 
      });
      
      this.logger.info('Account switched successfully', { 
        from: oldAccountId, 
        to: newAccountId 
      });
    } catch (error) {
      this.logger.error('Failed to switch account', error);
      throw error;
    }
  }

  /**
   * Export templates and groups to JSON file
   * Requirements: 10.1-10.8
   * @param {string} [filePath] - Optional file path (if not provided, will show save dialog)
   * @returns {Promise<Object>} Export result with file path and stats
   */
  async exportTemplates(filePath = null) {
    try {
      this.logger.info('Exporting templates');
      
      // Get all templates and groups
      const templates = await this.templateManager.storage.getAll();
      const groups = await this.groupManager.getAllGroups();
      
      // Emit exporting event
      this.emit('templates:exporting', { 
        templatesCount: templates.length,
        groupsCount: groups.length
      });
      
      // Convert media files to Base64
      const { fileToBase64 } = require('../utils/file');
      const templatesWithBase64 = await Promise.all(
        templates.map(async (template) => {
          const templateCopy = { ...template };
          
          // If template has media file, convert to Base64
          if (templateCopy.content && templateCopy.content.mediaPath) {
            try {
              const base64Data = await fileToBase64(
                templateCopy.content.mediaPath,
                this.accountId
              );
              
              // Store Base64 data and file extension
              const path = require('path');
              const extension = path.extname(templateCopy.content.mediaPath);
              
              templateCopy.content = {
                ...templateCopy.content,
                mediaBase64: base64Data,
                mediaExtension: extension,
                // Keep original path for reference
                originalMediaPath: templateCopy.content.mediaPath
              };
            } catch (error) {
              this.logger.warn('Failed to encode media file', { 
                templateId: template.id,
                error: error.message
              });
              // Continue without Base64 data
            }
          }
          
          return templateCopy;
        })
      );
      
      // Create export data structure
      const exportData = {
        version: '1.0.0',
        exportedAt: Date.now(),
        accountId: this.accountId,
        groups: groups,
        templates: templatesWithBase64
      };
      
      // If no file path provided, show save dialog
      let finalFilePath = filePath;
      if (!finalFilePath) {
        try {
          const { dialog } = require('electron');
          const result = await dialog.showSaveDialog({
            title: '导出快捷回复模板',
            defaultPath: `quick-reply-export-${Date.now()}.json`,
            filters: [
              { name: 'JSON Files', extensions: ['json'] },
              { name: 'All Files', extensions: ['*'] }
            ]
          });
          
          if (result.canceled || !result.filePath) {
            this.logger.info('Export canceled by user');
            return { canceled: true };
          }
          
          finalFilePath = result.filePath;
        } catch (error) {
          // Fallback for non-Electron environment
          const path = require('path');
          finalFilePath = path.join(
            process.cwd(),
            `quick-reply-export-${Date.now()}.json`
          );
        }
      }
      
      // Write to file
      const fs = require('fs').promises;
      await fs.writeFile(
        finalFilePath,
        JSON.stringify(exportData, null, 2),
        'utf8'
      );
      
      const result = {
        success: true,
        filePath: finalFilePath,
        templatesCount: templates.length,
        groupsCount: groups.length,
        exportedAt: exportData.exportedAt
      };
      
      // Emit exported event
      this.emit('templates:exported', result);
      
      this.logger.info('Templates exported successfully', result);
      
      return result;
    } catch (error) {
      this.logger.error('Failed to export templates', error);
      
      // Emit error event
      this.emit('templates:export-error', { error });
      
      throw error;
    }
  }

  /**
   * Import templates and groups from JSON file
   * Requirements: 10.1-10.8
   * @param {string} [filePath] - Optional file path (if not provided, will show open dialog)
   * @param {Object} [options] - Import options
   * @param {boolean} [options.merge=true] - If true, merge with existing data; if false, replace
   * @returns {Promise<Object>} Import result with stats
   */
  async importTemplates(filePath = null, options = {}) {
    try {
      const { merge = true } = options;
      
      this.logger.info('Importing templates', { filePath, merge });
      
      // If no file path provided, show open dialog
      let finalFilePath = filePath;
      if (!finalFilePath) {
        try {
          const { dialog } = require('electron');
          const result = await dialog.showOpenDialog({
            title: '导入快捷回复模板',
            filters: [
              { name: 'JSON Files', extensions: ['json'] },
              { name: 'All Files', extensions: ['*'] }
            ],
            properties: ['openFile']
          });
          
          if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
            this.logger.info('Import canceled by user');
            return { canceled: true };
          }
          
          finalFilePath = result.filePaths[0];
        } catch (error) {
          throw new ValidationError('File path is required for import', 'filePath');
        }
      }
      
      // Emit importing event
      this.emit('templates:importing', { filePath: finalFilePath });
      
      // Read and parse file
      const fs = require('fs').promises;
      const ImportError = require('../errors/ImportError');
      
      let fileContent;
      try {
        fileContent = await fs.readFile(finalFilePath, 'utf8');
      } catch (error) {
        throw new ImportError(`无法读取文件: ${error.message}`, error);
      }
      
      let importData;
      try {
        importData = JSON.parse(fileContent);
      } catch (error) {
        throw new ImportError('文件格式无效，不是有效的JSON格式', error);
      }
      
      // Validate import data structure
      if (!importData.version) {
        throw new ImportError('文件格式无效，缺少版本信息');
      }
      
      if (!Array.isArray(importData.groups)) {
        throw new ImportError('文件格式无效，缺少分组数据');
      }
      
      if (!Array.isArray(importData.templates)) {
        throw new ImportError('文件格式无效，缺少模板数据');
      }
      
      // Get existing data if merging
      let existingGroups = [];
      let existingTemplates = [];
      
      if (merge) {
        existingGroups = await this.groupManager.getAllGroups();
        existingTemplates = await this.templateManager.storage.getAll();
      }
      
      // Handle group name conflicts
      const existingGroupNames = new Set(existingGroups.map(g => g.name));
      const groupIdMap = new Map(); // Map old IDs to new IDs
      const importedGroups = [];
      
      for (const group of importData.groups) {
        let groupName = group.name;
        let suffix = 1;
        
        // Resolve name conflicts
        while (existingGroupNames.has(groupName)) {
          groupName = `${group.name} (${suffix})`;
          suffix++;
        }
        
        // Generate new ID
        const { generateUUID } = require('../utils/uuid');
        const newGroupId = generateUUID();
        groupIdMap.set(group.id, newGroupId);
        
        // Create new group with resolved name and new ID
        const newGroup = {
          ...group,
          id: newGroupId,
          name: groupName,
          // Update parent ID if it exists in the import
          parentId: group.parentId && groupIdMap.has(group.parentId) 
            ? groupIdMap.get(group.parentId) 
            : group.parentId,
          createdAt: Date.now(),
          updatedAt: Date.now()
        };
        
        importedGroups.push(newGroup);
        existingGroupNames.add(groupName);
      }
      
      // Convert Base64 media files back to files
      const { base64ToFile } = require('../utils/file');
      const importedTemplates = [];
      
      for (const template of importData.templates) {
        // Generate new ID
        const { generateUUID } = require('../utils/uuid');
        const newTemplateId = generateUUID();
        
        // Update group ID
        const newGroupId = groupIdMap.get(template.groupId);
        if (!newGroupId) {
          this.logger.warn('Template references non-existent group, skipping', {
            templateId: template.id,
            groupId: template.groupId
          });
          continue;
        }
        
        const newTemplate = {
          ...template,
          id: newTemplateId,
          groupId: newGroupId,
          createdAt: Date.now(),
          updatedAt: Date.now()
        };
        
        // Handle media files
        if (newTemplate.content && newTemplate.content.mediaBase64) {
          try {
            const extension = newTemplate.content.mediaExtension || '.jpg';
            const mediaPath = await base64ToFile(
              newTemplate.content.mediaBase64,
              this.accountId,
              newTemplateId,
              extension
            );
            
            // Update content with new media path
            newTemplate.content = {
              ...newTemplate.content,
              mediaPath: mediaPath
            };
            
            // Remove Base64 data from template
            delete newTemplate.content.mediaBase64;
            delete newTemplate.content.mediaExtension;
            delete newTemplate.content.originalMediaPath;
          } catch (error) {
            this.logger.warn('Failed to decode media file', {
              templateId: newTemplateId,
              error: error.message
            });
            // Continue without media file
            delete newTemplate.content.mediaPath;
            delete newTemplate.content.mediaBase64;
            delete newTemplate.content.mediaExtension;
            delete newTemplate.content.originalMediaPath;
          }
        }
        
        importedTemplates.push(newTemplate);
      }
      
      // Save imported data
      for (const group of importedGroups) {
        await this.groupManager.storage.save(group);
      }
      
      for (const template of importedTemplates) {
        await this.templateManager.storage.save(template);
      }
      
      // Reload data
      await this.loadData();
      
      const result = {
        success: true,
        filePath: finalFilePath,
        groupsImported: importedGroups.length,
        templatesImported: importedTemplates.length,
        merged: merge,
        importedAt: Date.now()
      };
      
      // Emit imported event
      this.emit('templates:imported', result);
      
      this.logger.info('Templates imported successfully', result);
      
      return result;
    } catch (error) {
      this.logger.error('Failed to import templates', error);
      
      // Emit error event
      this.emit('templates:import-error', { error });
      
      throw error;
    }
  }

  /**
   * Get current state
   * @returns {Object} Current state
   */
  getState() {
    return {
      accountId: this.accountId,
      isOperationPanelOpen: this.isOperationPanelOpen,
      isManagementInterfaceOpen: this.isManagementInterfaceOpen
    };
  }

  /**
   * Destroy the controller and clean up resources
   */
  destroy() {
    try {
      this.logger.info('Destroying controller');
      
      // Destroy account switch handler
      if (this.accountSwitchHandler) {
        this.accountSwitchHandler.destroy();
        this.accountSwitchHandler = null;
      }
      
      // Remove all event listeners
      this.removeAllListeners();
      
      // Clear references
      this.templateManager = null;
      this.groupManager = null;
      this.sendManager = null;
      this.operationPanel = null;
      this.managementInterface = null;
      this.translationService = null;
      this.whatsappWebInterface = null;
      
      this.logger.info('Controller destroyed');
    } catch (error) {
      this.logger.error('Failed to destroy controller', error);
      throw error;
    }
  }
}

module.exports = QuickReplyController;
