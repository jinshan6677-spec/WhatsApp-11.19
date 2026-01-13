/**
 * AccountSwitchHandler
 * 
 * Handles account switching for the Quick Reply feature.
 * Manages state persistence, data unloading/loading, and UI refresh.
 * 
 * Requirements: 11.1-11.7
 */

const EventEmitter = require('events');
const { Logger } = require('../utils/logger');
const ConfigStorage = require('../storage/ConfigStorage');

class AccountSwitchHandler extends EventEmitter {
  /**
   * @param {Object} controller - QuickReplyController instance
   * @param {string} [userDataPath] - Optional user data path (for testing)
   */
  constructor(controller, userDataPath = null) {
    super();
    
    if (!controller) {
      throw new Error('Controller is required');
    }
    
    this.controller = controller;
    this.userDataPath = userDataPath;
    this.logger = new Logger('AccountSwitchHandler');
    
    // Current state
    this.currentAccountId = controller.accountId;
    this.savedStates = new Map(); // accountId -> state
    this.isListening = false;
    
    this.logger.info('AccountSwitchHandler initialized', { 
      accountId: this.currentAccountId 
    });
  }

  /**
   * Start listening for account switch events
   * Requirements: 11.1
   */
  startListening() {
    if (this.isListening) {
      this.logger.debug('Already listening for account switch events');
      return;
    }
    
    try {
      // Listen for account switch events from the main application
      if (typeof window !== 'undefined' && window.electronAPI) {
        window.electronAPI.on('account-switched', this.handleAccountSwitch.bind(this));
        this.logger.info('Listening for account-switched events via electronAPI');
      }
      
      // Also listen for account:active-changed events
      if (typeof window !== 'undefined' && window.electronAPI) {
        window.electronAPI.on('account:active-changed', this.handleAccountSwitch.bind(this));
        this.logger.info('Listening for account:active-changed events via electronAPI');
      }
      
      this.isListening = true;
      this.emit('listening:started');
      
      this.logger.info('Started listening for account switch events');
    } catch (error) {
      this.logger.error('Failed to start listening', error);
      throw error;
    }
  }

  /**
   * Stop listening for account switch events
   */
  stopListening() {
    if (!this.isListening) {
      this.logger.debug('Not currently listening');
      return;
    }
    
    try {
      // Remove event listeners
      if (typeof window !== 'undefined' && window.electronAPI) {
        // Note: electronAPI.off might not be available, so we just mark as not listening
        this.logger.info('Stopped listening for account switch events');
      }
      
      this.isListening = false;
      this.emit('listening:stopped');
      
      this.logger.info('Stopped listening for account switch events');
    } catch (error) {
      this.logger.error('Failed to stop listening', error);
      throw error;
    }
  }

  /**
   * Handle account switch event
   * Requirements: 11.1
   * @param {string} newAccountId - New account ID
   */
  async handleAccountSwitch(newAccountId) {
    try {
      if (!newAccountId) {
        this.logger.warn('Received account switch event with no account ID');
        return;
      }
      
      if (newAccountId === this.currentAccountId) {
        this.logger.debug('Already on this account', { accountId: newAccountId });
        return;
      }
      
      this.logger.info('Handling account switch', { 
        from: this.currentAccountId, 
        to: newAccountId 
      });
      
      // Emit switching event
      this.emit('switching', { 
        oldAccountId: this.currentAccountId, 
        newAccountId 
      });
      
      // Save current state
      await this.saveCurrentState();
      
      // Unload current data
      await this.unloadCurrentData();
      
      // Switch account in controller
      await this.controller.switchAccount(newAccountId);
      
      // Update current account ID
      this.currentAccountId = newAccountId;
      
      // Load new account data
      await this.loadAccountData(newAccountId);
      
      // Restore saved state for new account
      await this.restoreAccountState(newAccountId);
      
      // Refresh UI
      await this.refreshUI();
      
      // Emit switched event
      this.emit('switched', { 
        oldAccountId: this.currentAccountId, 
        newAccountId 
      });
      
      this.logger.info('Account switch completed', { 
        from: this.currentAccountId, 
        to: newAccountId 
      });
    } catch (error) {
      this.logger.error('Failed to handle account switch', error);
      
      // Emit error event
      this.emit('switch:error', { 
        accountId: newAccountId, 
        error 
      });
      
      throw error;
    }
  }

  /**
   * Save current account state
   * Requirements: 11.1
   * @returns {Promise<void>}
   */
  async saveCurrentState() {
    try {
      this.logger.debug('Saving current state', { 
        accountId: this.currentAccountId 
      });
      
      // Get current controller state
      const controllerState = this.controller.getState();
      
      // Get current UI state (if available)
      let uiState = {};
      
      // Save operation panel state
      if (this.controller.operationPanel) {
        uiState.operationPanel = {
          isOpen: controllerState.isOperationPanelOpen,
          sendMode: this.controller.operationPanel.sendMode || 'original',
          searchKeyword: this.controller.operationPanel.searchKeyword || '',
          expandedGroups: Array.from(
            this.controller.operationPanel.expandedGroups || new Set()
          )
        };
      }
      
      // Save management interface state
      if (this.controller.managementInterface) {
        uiState.managementInterface = {
          isOpen: controllerState.isManagementInterfaceOpen,
          selectedGroupId: this.controller.managementInterface.selectedGroupId || null,
          activeTab: this.controller.managementInterface.activeTab || 'all'
        };
      }
      
      // Get expanded groups from config storage
      const configStorage = new ConfigStorage(this.currentAccountId, this.userDataPath);
      const config = await configStorage.get();
      
      const state = {
        accountId: this.currentAccountId,
        controller: controllerState,
        ui: uiState,
        config: config || {},
        savedAt: Date.now()
      };
      
      // Save to memory
      this.savedStates.set(this.currentAccountId, state);
      
      // Also persist to storage
      if (config) {
        await configStorage.update({
          lastSavedState: state,
          updatedAt: Date.now()
        });
      }
      
      this.emit('state:saved', { 
        accountId: this.currentAccountId, 
        state 
      });
      
      this.logger.info('Current state saved', { 
        accountId: this.currentAccountId 
      });
    } catch (error) {
      this.logger.error('Failed to save current state', error);
      // Don't throw - state saving failure shouldn't block account switch
    }
  }

  /**
   * Unload current account data
   * Requirements: 11.1
   * @returns {Promise<void>}
   */
  async unloadCurrentData() {
    try {
      this.logger.debug('Unloading current data', { 
        accountId: this.currentAccountId 
      });
      
      // Close any open panels/interfaces
      if (this.controller.isOperationPanelOpen) {
        this.controller.closeOperationPanel();
      }
      
      if (this.controller.isManagementInterfaceOpen) {
        this.controller.closeManagementInterface();
      }
      
      // Clear any cached data
      // (The controller will handle this when switching accounts)
      
      this.emit('data:unloaded', { 
        accountId: this.currentAccountId 
      });
      
      this.logger.info('Current data unloaded', { 
        accountId: this.currentAccountId 
      });
    } catch (error) {
      this.logger.error('Failed to unload current data', error);
      // Don't throw - unload failure shouldn't block account switch
    }
  }

  /**
   * Load account data
   * Requirements: 11.1, 11.6
   * @param {string} accountId - Account ID to load
   * @returns {Promise<void>}
   */
  async loadAccountData(accountId) {
    try {
      this.logger.debug('Loading account data', { accountId });
      
      // The controller's switchAccount method already loads the data
      // This method is here for any additional loading logic
      
      // Check if this is the first time using this account by checking if config file exists
      const configStorage = new ConfigStorage(accountId, this.userDataPath);
      const fs = require('fs').promises;
      
      let isFirstUse = false;
      try {
        await fs.access(configStorage.storagePath);
        // File exists, not first use
      } catch (error) {
        if (error.code === 'ENOENT') {
          // File doesn't exist, this is first use
          isFirstUse = true;
        }
      }
      
      let config = await configStorage.get();
      
      if (isFirstUse) {
        // First time using this account
        this.logger.info('First time using account', { 
          accountId 
        });
        
        // Save the default config
        await configStorage.save(config);
        
        this.emit('account:first-use', { accountId });
      }
      
      this.emit('data:loaded', { 
        accountId, 
        config 
      });
      
      this.logger.info('Account data loaded', { accountId });
    } catch (error) {
      this.logger.error('Failed to load account data', error);
      throw error;
    }
  }

  /**
   * Restore account state
   * Requirements: 11.1
   * @param {string} accountId - Account ID
   * @returns {Promise<void>}
   */
  async restoreAccountState(accountId) {
    try {
      this.logger.debug('Restoring account state', { accountId });
      
      // Check if we have saved state for this account
      let savedState = this.savedStates.get(accountId);
      
      // If not in memory, try to load from storage
      if (!savedState) {
        const configStorage = new ConfigStorage(accountId, this.userDataPath);
        const config = await configStorage.get();
        
        if (config && config.lastSavedState) {
          savedState = config.lastSavedState;
          this.savedStates.set(accountId, savedState);
        }
      }
      
      if (savedState) {
        // Restore UI state
        if (savedState.ui) {
          // Restore operation panel state
          if (savedState.ui.operationPanel && this.controller.operationPanel) {
            if (savedState.ui.operationPanel.isOpen) {
              this.controller.openOperationPanel();
            }
            
            if (this.controller.operationPanel.sendMode !== undefined) {
              this.controller.operationPanel.sendMode = 
                savedState.ui.operationPanel.sendMode;
            }
            
            if (this.controller.operationPanel.searchKeyword !== undefined) {
              this.controller.operationPanel.searchKeyword = 
                savedState.ui.operationPanel.searchKeyword;
            }
            
            if (this.controller.operationPanel.expandedGroups !== undefined) {
              this.controller.operationPanel.expandedGroups = 
                new Set(savedState.ui.operationPanel.expandedGroups);
            }
          }
          
          // Restore management interface state
          if (savedState.ui.managementInterface && this.controller.managementInterface) {
            if (savedState.ui.managementInterface.isOpen) {
              this.controller.openManagementInterface();
            }
            
            if (this.controller.managementInterface.selectedGroupId !== undefined) {
              this.controller.managementInterface.selectedGroupId = 
                savedState.ui.managementInterface.selectedGroupId;
            }
            
            if (this.controller.managementInterface.activeTab !== undefined) {
              this.controller.managementInterface.activeTab = 
                savedState.ui.managementInterface.activeTab;
            }
          }
        }
        
        this.emit('state:restored', { 
          accountId, 
          state: savedState 
        });
        
        this.logger.info('Account state restored', { accountId });
      } else {
        this.logger.debug('No saved state found for account', { accountId });
      }
    } catch (error) {
      this.logger.error('Failed to restore account state', error);
      // Don't throw - state restoration failure shouldn't block account switch
    }
  }

  /**
   * Refresh UI
   * Requirements: 11.1
   * @returns {Promise<void>}
   */
  async refreshUI() {
    try {
      this.logger.debug('Refreshing UI');
      
      // Emit refresh event for UI components to handle
      this.emit('ui:refresh');
      
      // Trigger controller refresh
      await this.controller.refresh();
      
      this.logger.info('UI refreshed');
    } catch (error) {
      this.logger.error('Failed to refresh UI', error);
      // Don't throw - UI refresh failure shouldn't block account switch
    }
  }

  /**
   * Get saved state for an account
   * @param {string} accountId - Account ID
   * @returns {Object|null} Saved state or null
   */
  getSavedState(accountId) {
    return this.savedStates.get(accountId) || null;
  }

  /**
   * Clear saved state for an account
   * @param {string} accountId - Account ID
   */
  clearSavedState(accountId) {
    this.savedStates.delete(accountId);
    this.logger.debug('Cleared saved state', { accountId });
  }

  /**
   * Clear all saved states
   */
  clearAllSavedStates() {
    this.savedStates.clear();
    this.logger.debug('Cleared all saved states');
  }

  /**
   * Destroy the handler and clean up resources
   */
  destroy() {
    try {
      this.logger.info('Destroying AccountSwitchHandler');
      
      // Stop listening
      this.stopListening();
      
      // Clear saved states
      this.clearAllSavedStates();
      
      // Remove all event listeners
      this.removeAllListeners();
      
      // Clear references
      this.controller = null;
      
      this.logger.info('AccountSwitchHandler destroyed');
    } catch (error) {
      this.logger.error('Failed to destroy AccountSwitchHandler', error);
      throw error;
    }
  }
}

module.exports = AccountSwitchHandler;
