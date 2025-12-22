/**
 * QuickReplyController
 * 
 * Main controller for the Quick Reply feature.
 * Coordinates between UI components, managers, and handles user interactions.
 * 
 * Requirements: 1.1-1.7, 1.2, 1.4, 2.5, 12.1-12.14
 */

const EventEmitter = require('events');
const TemplateManager = require('../managers/TemplateManager');
const GroupManager = require('../managers/GroupManager');
const SendManager = require('../managers/SendManager');
const SyncManager = require('../managers/SyncManager');
const AccountSwitchHandler = require('../handlers/AccountSwitchHandler');
const { searchTemplates } = require('../utils/search');
const { Logger } = require('../utils/logger');
const ValidationError = require('../errors/ValidationError');
const SendError = require('../errors/SendError');
const TranslationError = require('../errors/TranslationError');
const { ManagementWindow } = require('../ui/management-window');

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
    this.syncManager = new SyncManager(accountId);
    
    // Initialize account switch handler
    this.accountSwitchHandler = new AccountSwitchHandler(this, userDataPath);
    
    // Set up sync manager event forwarding
    this._setupSyncManagerEvents();
    
    // UI components (will be set by UI layer)
    this.operationPanel = null;
    this.managementInterface = null;
    
    // Management window instance
    this.managementWindow = null;
    
    // State
    this.isOperationPanelOpen = false;
    this.isManagementInterfaceOpen = false;
    this.isManagementWindowOpen = false;
    
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
   * Open the standalone management window
   * Requirements: 1.2, 1.4, 2.5
   * @param {Object} [options] - Window options
   * @returns {Promise<void>}
   */
  async openManagementWindow(options = {}) {
    try {
      // If window already exists and is open, just focus it
      if (this.managementWindow && this.managementWindow.isOpen()) {
        this.logger.debug('Management window already open, focusing');
        this.managementWindow.focus();
        return;
      }

      this.logger.info('Opening management window', { accountId: this.accountId });

      // Create new management window
      this.managementWindow = new ManagementWindow(this.accountId, options);

      // Set up event handlers
      this._setupManagementWindowEvents();

      // Create and show the window
      await this.managementWindow.create();

      this.isManagementWindowOpen = true;
      this.emit('management-window:open');

      // Send initial data to the window
      await this._sendDataToManagementWindow();

      this.logger.info('Management window opened successfully');
    } catch (error) {
      this.logger.error('Failed to open management window', error);
      this.emit('management-window:error', { error });
      throw error;
    }
  }

  /**
   * Close the standalone management window
   * Requirements: 2.5
   */
  closeManagementWindow() {
    try {
      if (!this.managementWindow || !this.managementWindow.isOpen()) {
        this.logger.debug('Management window already closed');
        return;
      }

      // Save any pending changes before closing
      this._saveManagementWindowState();

      this.managementWindow.close();
      this.isManagementWindowOpen = false;
      this.emit('management-window:close');

      this.logger.info('Management window closed');
    } catch (error) {
      this.logger.error('Failed to close management window', error);
      throw error;
    }
  }

  /**
   * Set up event handlers for the management window
   * @private
   */
  _setupManagementWindowEvents() {
    if (!this.managementWindow) return;

    // Handle window closing
    this.managementWindow.on('closing', () => {
      this._saveManagementWindowState();
    });

    // Handle window closed
    this.managementWindow.on('closed', () => {
      this.isManagementWindowOpen = false;
      this.managementWindow = null;
      this.emit('management-window:closed');
    });

    // Handle window ready
    this.managementWindow.on('ready', () => {
      this._sendDataToManagementWindow();
    });

    // Handle window resize (for persistence)
    this.managementWindow.on('resize', (size) => {
      this.emit('management-window:resize', size);
    });

    // Handle window move (for persistence)
    this.managementWindow.on('move', (position) => {
      this.emit('management-window:move', position);
    });
  }

  /**
   * Set up event handlers for the sync manager
   * Forwards sync events to controller events and updates UI components
   * Requirements: 1.2.1-1.2.7
   * @private
   */
  _setupSyncManagerEvents() {
    if (!this.syncManager) return;

    const { SYNC_EVENTS } = require('../managers/SyncManager');

    // Forward all sync events to controller events
    Object.values(SYNC_EVENTS).forEach(eventType => {
      this.syncManager.on(eventType, (eventData) => {
        // Forward to controller event listeners
        this.emit(`sync:${eventType}`, eventData);
        
        // Update management window if open
        if (this.managementWindow && this.managementWindow.isOpen()) {
          this.managementWindow.sendUpdate(eventType, eventData);
        }
      });
    });

    // Subscribe to sync events for sidebar updates
    this.syncManager.subscribe((event, eventData) => {
      // Emit a general sync event for sidebar
      this.emit('data:sync', eventData);
    });

    this.logger.debug('Sync manager events configured');
  }

  /**
   * Get the sync manager instance
   * @returns {SyncManager} The sync manager
   */
  getSyncManager() {
    return this.syncManager;
  }

  /**
   * Subscribe to data synchronization events
   * @param {Function} callback - Callback function (event, data) => void
   * @returns {Function} Unsubscribe function
   */
  subscribeToSync(callback) {
    if (!this.syncManager) {
      throw new Error('SyncManager not initialized');
    }
    return this.syncManager.subscribe(callback);
  }

  /**
   * Send data to the management window
   * @private
   * @returns {Promise<void>}
   */
  async _sendDataToManagementWindow() {
    if (!this.managementWindow || !this.managementWindow.isOpen()) return;

    try {
      const groups = await this.groupManager.getAllGroups();
      const templates = await this.templateManager.storage.getAll();

      this.managementWindow.sendData({
        groups,
        templates
      });
    } catch (error) {
      this.logger.error('Failed to send data to management window', error);
    }
  }

  /**
   * Save management window state (size, position, etc.)
   * @private
   */
  _saveManagementWindowState() {
    if (!this.managementWindow) return;

    try {
      const config = this.managementWindow.getConfig();
      this.emit('management-window:state-changed', config);
    } catch (error) {
      this.logger.error('Failed to save management window state', error);
    }
  }

  /**
   * Handle action from management window
   * @param {Object} actionData - Action data from the window
   * @returns {Promise<void>}
   */
  async handleManagementWindowAction(actionData) {
    const { action, ...data } = actionData;

    try {
      switch (action) {
        case 'selectGroup':
          this.emit('management-window:group-selected', data);
          await this._sendFilteredTemplates(data.groupId);
          break;

        case 'search':
          await this._handleManagementWindowSearch(data.keyword);
          break;

        case 'createGroup':
          await this._handleCreateGroup();
          break;

        case 'deleteTemplate':
          await this._handleDeleteTemplate(data.templateId);
          break;

        case 'addText':
        case 'addImage':
        case 'addAudio':
        case 'addVideo':
        case 'addImageText':
          this.emit('management-window:add-content', { type: action.replace('add', '').toLowerCase() });
          break;

        case 'import':
          await this.importTemplates();
          break;

        case 'export':
          await this.exportTemplates();
          break;

        default:
          this.logger.warn('Unknown management window action', { action });
      }
    } catch (error) {
      this.logger.error('Failed to handle management window action', { action, error });
      throw error;
    }
  }

  /**
   * Send filtered templates to management window
   * @private
   * @param {string} groupId - Group ID to filter by
   */
  async _sendFilteredTemplates(groupId) {
    if (!this.managementWindow || !this.managementWindow.isOpen()) return;

    try {
      const templates = await this.templateManager.storage.getAll();
      const filteredTemplates = groupId 
        ? templates.filter(t => t.groupId === groupId)
        : templates;

      this.managementWindow.sendData({ filteredTemplates });
    } catch (error) {
      this.logger.error('Failed to send filtered templates', error);
    }
  }

  /**
   * Handle search from management window
   * @private
   * @param {string} keyword - Search keyword
   */
  async _handleManagementWindowSearch(keyword) {
    if (!this.managementWindow || !this.managementWindow.isOpen()) return;

    try {
      const results = await this.searchTemplates(keyword);
      this.managementWindow.sendData({ 
        filteredTemplates: results.templates,
        groups: results.groups
      });
    } catch (error) {
      this.logger.error('Failed to handle management window search', error);
    }
  }

  /**
   * Handle create group from management window
   * Requirements: 1.2.3
   * @private
   */
  async _handleCreateGroup() {
    try {
      const newGroup = await this.groupManager.createGroup();
      
      // Sync group creation to all subscribers
      if (this.syncManager) {
        this.syncManager.syncGroupCreated(newGroup);
      }
      
      // Refresh data in management window
      await this._sendDataToManagementWindow();
      
      this.emit('group:created', newGroup);
      return newGroup;
    } catch (error) {
      this.logger.error('Failed to create group', error);
      if (this.syncManager) {
        this.syncManager.syncError(error, 'createGroup');
      }
      throw error;
    }
  }

  /**
   * Handle delete group
   * Requirements: 1.2.3
   * @param {string} groupId - Group ID to delete
   * @returns {Promise<boolean>}
   */
  async deleteGroup(groupId) {
    try {
      const group = await this.groupManager.getGroup(groupId);
      const groupName = group ? group.name : '';
      
      const deleted = await this.groupManager.deleteGroup(groupId);
      
      if (deleted && this.syncManager) {
        this.syncManager.syncGroupDeleted(groupId, groupName);
      }
      
      // Refresh data in management window
      await this._sendDataToManagementWindow();
      
      this.emit('group:deleted', { groupId, groupName });
      return deleted;
    } catch (error) {
      this.logger.error('Failed to delete group', error);
      if (this.syncManager) {
        this.syncManager.syncError(error, 'deleteGroup');
      }
      throw error;
    }
  }

  /**
   * Handle update group (rename, etc.)
   * Requirements: 1.2.3
   * @param {string} groupId - Group ID to update
   * @param {Object} updates - Updates to apply
   * @returns {Promise<Object|null>}
   */
  async updateGroup(groupId, updates) {
    try {
      const updatedGroup = await this.groupManager.updateGroup(groupId, updates);
      
      if (updatedGroup && this.syncManager) {
        this.syncManager.syncGroupUpdated(updatedGroup, updates);
      }
      
      // Refresh data in management window
      await this._sendDataToManagementWindow();
      
      this.emit('group:updated', { groupId, updates, group: updatedGroup });
      return updatedGroup;
    } catch (error) {
      this.logger.error('Failed to update group', error);
      if (this.syncManager) {
        this.syncManager.syncError(error, 'updateGroup');
      }
      throw error;
    }
  }

  /**
   * Handle move group
   * Requirements: 1.2.3
   * @param {string} groupId - Group ID to move
   * @param {string|null} newParentId - New parent group ID
   * @returns {Promise<Object|null>}
   */
  async moveGroup(groupId, newParentId) {
    try {
      const existingGroup = await this.groupManager.getGroup(groupId);
      const fromParentId = existingGroup ? existingGroup.parentId : null;
      
      const movedGroup = await this.groupManager.moveGroup(groupId, newParentId);
      
      if (movedGroup && this.syncManager) {
        this.syncManager.syncGroupMoved(groupId, fromParentId, newParentId, movedGroup.order);
      }
      
      // Refresh data in management window
      await this._sendDataToManagementWindow();
      
      this.emit('group:moved', { groupId, fromParentId, toParentId: newParentId });
      return movedGroup;
    } catch (error) {
      this.logger.error('Failed to move group', error);
      if (this.syncManager) {
        this.syncManager.syncError(error, 'moveGroup');
      }
      throw error;
    }
  }

  /**
   * Handle delete template from management window
   * Requirements: 1.2.2
   * @private
   * @param {string} templateId - Template ID to delete
   */
  async _handleDeleteTemplate(templateId) {
    try {
      const template = await this.templateManager.getTemplate(templateId);
      const groupId = template ? template.groupId : null;
      
      await this.templateManager.deleteTemplate(templateId);
      
      // Sync content deletion to all subscribers
      if (this.syncManager) {
        this.syncManager.syncContentDeleted(templateId, groupId);
      }
      
      // Refresh data in management window
      await this._sendDataToManagementWindow();
      
      this.emit('template:deleted', { templateId, groupId });
    } catch (error) {
      this.logger.error('Failed to delete template', error);
      if (this.syncManager) {
        this.syncManager.syncError(error, 'deleteTemplate');
      }
      throw error;
    }
  }

  /**
   * Create a new template (content)
   * Requirements: 1.2.1
   * @param {string} groupId - Group ID
   * @param {string} type - Template type
   * @param {string} label - Template label
   * @param {Object} content - Template content
   * @returns {Promise<Object>} Created template
   */
  async createTemplate(groupId, type, label, content) {
    try {
      const template = await this.templateManager.createTemplate(groupId, type, label, content);
      
      // Sync content addition to all subscribers
      if (this.syncManager) {
        this.syncManager.syncContentAdded(template);
      }
      
      // Refresh data in management window
      await this._sendDataToManagementWindow();
      
      this.emit('template:created', template);
      return template;
    } catch (error) {
      this.logger.error('Failed to create template', error);
      if (this.syncManager) {
        this.syncManager.syncError(error, 'createTemplate');
      }
      throw error;
    }
  }

  /**
   * Update a template (content)
   * Requirements: 1.2.5
   * @param {string} templateId - Template ID
   * @param {Object} updates - Updates to apply
   * @returns {Promise<Object|null>} Updated template
   */
  async updateTemplate(templateId, updates) {
    try {
      const updatedTemplate = await this.templateManager.updateTemplate(templateId, updates);
      
      if (updatedTemplate && this.syncManager) {
        this.syncManager.syncContentUpdated(updatedTemplate, updates);
      }
      
      // Refresh data in management window
      await this._sendDataToManagementWindow();
      
      this.emit('template:updated', { templateId, updates, template: updatedTemplate });
      return updatedTemplate;
    } catch (error) {
      this.logger.error('Failed to update template', error);
      if (this.syncManager) {
        this.syncManager.syncError(error, 'updateTemplate');
      }
      throw error;
    }
  }

  /**
   * Delete a template (content)
   * Requirements: 1.2.2
   * @param {string} templateId - Template ID
   * @returns {Promise<boolean>} True if deleted
   */
  async deleteTemplate(templateId) {
    try {
      const template = await this.templateManager.getTemplate(templateId);
      const groupId = template ? template.groupId : null;
      
      const deleted = await this.templateManager.deleteTemplate(templateId);
      
      if (deleted && this.syncManager) {
        this.syncManager.syncContentDeleted(templateId, groupId);
      }
      
      // Refresh data in management window
      await this._sendDataToManagementWindow();
      
      this.emit('template:deleted', { templateId, groupId });
      return deleted;
    } catch (error) {
      this.logger.error('Failed to delete template', error);
      if (this.syncManager) {
        this.syncManager.syncError(error, 'deleteTemplate');
      }
      throw error;
    }
  }

  /**
   * Move a template to another group
   * Requirements: 1.2.5
   * @param {string} templateId - Template ID
   * @param {string} targetGroupId - Target group ID
   * @returns {Promise<Object|null>} Updated template
   */
  async moveTemplate(templateId, targetGroupId) {
    try {
      const existingTemplate = await this.templateManager.getTemplate(templateId);
      const fromGroupId = existingTemplate ? existingTemplate.groupId : null;
      
      const movedTemplate = await this.templateManager.moveTemplate(templateId, targetGroupId);
      
      if (movedTemplate && this.syncManager) {
        this.syncManager.syncContentMoved(templateId, fromGroupId, targetGroupId);
      }
      
      // Refresh data in management window
      await this._sendDataToManagementWindow();
      
      this.emit('template:moved', { templateId, fromGroupId, toGroupId: targetGroupId });
      return movedTemplate;
    } catch (error) {
      this.logger.error('Failed to move template', error);
      if (this.syncManager) {
        this.syncManager.syncError(error, 'moveTemplate');
      }
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
        const updatedTemplate = await this.templateManager.recordUsage(templateId);
        
        // Sync usage statistics update (Requirement: 1.2.4)
        if (updatedTemplate && this.syncManager) {
          this.syncManager.syncUsageUpdated(
            templateId, 
            updatedTemplate.usageCount, 
            updatedTemplate.lastUsedAt
          );
        }
        
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
        const updatedTemplate = await this.templateManager.recordUsage(templateId);
        
        // Sync usage statistics update (Requirement: 1.2.4)
        if (updatedTemplate && this.syncManager) {
          this.syncManager.syncUsageUpdated(
            templateId, 
            updatedTemplate.usageCount, 
            updatedTemplate.lastUsedAt
          );
        }
        
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
      isManagementInterfaceOpen: this.isManagementInterfaceOpen,
      isManagementWindowOpen: this.isManagementWindowOpen,
      managementWindowConfig: this.managementWindow ? this.managementWindow.getConfig() : null
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
      
      // Destroy sync manager
      if (this.syncManager) {
        this.syncManager.destroy();
        this.syncManager = null;
      }
      
      // Destroy management window
      if (this.managementWindow) {
        this.managementWindow.destroy();
        this.managementWindow = null;
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
