/**
 * WhatsAppWebInterfaceFactory
 * 
 * Factory for creating WhatsAppWebInterface instances connected to the active WhatsApp Web view.
 * Integrates with the ViewManager to get the current active BrowserView's webContents.
 * 
 * Requirements: 7.1-7.9, 9.1-9.8
 */

const WhatsAppWebInterface = require('./WhatsAppWebInterface');
const { Logger } = require('../utils/logger');
const ValidationError = require('../errors/ValidationError');

class WhatsAppWebInterfaceFactory {
  /**
   * @param {ViewManager} viewManager - ViewManager instance from the main application
   */
  constructor(viewManager) {
    if (!viewManager) {
      throw new ValidationError('ViewManager is required', 'viewManager');
    }
    
    this.viewManager = viewManager;
    this.logger = new Logger('WhatsAppWebInterfaceFactory');
    this.currentInterface = null;
    this.currentAccountId = null;
  }

  /**
   * Get WhatsAppWebInterface for the currently active account
   * @returns {WhatsAppWebInterface|null} Interface instance or null if no active view
   */
  getCurrentInterface() {
    try {
      const activeAccountId = this.viewManager.getActiveAccountId();
      
      if (!activeAccountId) {
        this.logger.warn('No active account');
        return null;
      }
      
      // If we already have an interface for this account, return it
      if (this.currentInterface && this.currentAccountId === activeAccountId) {
        return this.currentInterface;
      }
      
      // Get the active BrowserView
      const activeView = this.viewManager.getActiveView();
      
      if (!activeView) {
        this.logger.warn(`No active view found for account ${activeAccountId}`);
        return null;
      }
      
      // Get webContents from the BrowserView
      const webContents = activeView.webContents;
      
      if (!webContents || webContents.isDestroyed()) {
        this.logger.warn(`WebContents not available or destroyed for account ${activeAccountId}`);
        return null;
      }
      
      // Create new interface
      this.currentInterface = new WhatsAppWebInterface(webContents);
      this.currentAccountId = activeAccountId;
      
      this.logger.info(`Created WhatsAppWebInterface for account ${activeAccountId}`);
      
      return this.currentInterface;
    } catch (error) {
      this.logger.error('Failed to get current interface', error);
      return null;
    }
  }

  /**
   * Get WhatsAppWebInterface for a specific account
   * @param {string} accountId - Account ID
   * @returns {WhatsAppWebInterface|null} Interface instance or null if view not found
   */
  getInterfaceForAccount(accountId) {
    try {
      if (!accountId) {
        throw new ValidationError('Account ID is required', 'accountId');
      }
      
      // Check if this is the current active account
      const activeAccountId = this.viewManager.getActiveAccountId();
      if (activeAccountId === accountId && this.currentInterface) {
        return this.currentInterface;
      }
      
      // Get the view for this account
      const view = this.viewManager.getView(accountId);
      
      if (!view) {
        this.logger.warn(`No view found for account ${accountId}`);
        return null;
      }
      
      // Get webContents from the BrowserView
      const webContents = view.webContents;
      
      if (!webContents || webContents.isDestroyed()) {
        this.logger.warn(`WebContents not available or destroyed for account ${accountId}`);
        return null;
      }
      
      // Create new interface
      const waInterface = new WhatsAppWebInterface(webContents);
      
      this.logger.info(`Created WhatsAppWebInterface for account ${accountId}`);
      
      return waInterface;
    } catch (error) {
      this.logger.error(`Failed to get interface for account ${accountId}`, error);
      return null;
    }
  }

  /**
   * Check if WhatsApp Web is ready for the current account
   * @returns {Promise<boolean>}
   */
  async isCurrentAccountReady() {
    const waInterface = this.getCurrentInterface();
    if (!waInterface) {
      return false;
    }
    
    try {
      return await waInterface.isReady();
    } catch (error) {
      this.logger.error('Failed to check if current account is ready', error);
      return false;
    }
  }

  /**
   * Get current chat information for the active account
   * @returns {Promise<Object|null>}
   */
  async getCurrentChat() {
    const waInterface = this.getCurrentInterface();
    if (!waInterface) {
      return null;
    }
    
    try {
      return await waInterface.getCurrentChat();
    } catch (error) {
      this.logger.error('Failed to get current chat', error);
      return null;
    }
  }

  /**
   * Clear cached interface (call when account switches)
   */
  clearCache() {
    this.currentInterface = null;
    this.currentAccountId = null;
    this.logger.debug('Cleared interface cache');
  }

  /**
   * Handle account switch event
   * @param {string} newAccountId - New active account ID
   */
  handleAccountSwitch(newAccountId) {
    this.logger.info(`Account switched to ${newAccountId}`);
    
    // Clear cache if switching to a different account
    if (this.currentAccountId !== newAccountId) {
      this.clearCache();
    }
  }

  /**
   * Destroy the factory and clean up resources
   */
  destroy() {
    this.clearCache();
    this.viewManager = null;
    this.logger.info('WhatsAppWebInterfaceFactory destroyed');
  }
}

module.exports = WhatsAppWebInterfaceFactory;
