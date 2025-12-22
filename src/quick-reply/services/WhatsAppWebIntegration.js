/**
 * WhatsAppWebIntegration
 * 
 * Integration module that connects the Quick Reply system with WhatsApp Web.
 * Manages the WhatsAppWebInterfaceFactory and provides a clean API for the QuickReplyController.
 * 
 * Requirements: 7.1-7.9, 9.1-9.8
 */

const WhatsAppWebInterfaceFactory = require('./WhatsAppWebInterfaceFactory');
const { Logger } = require('../utils/logger');
const SendError = require('../errors/SendError');

class WhatsAppWebIntegration {
  /**
   * @param {ViewManager} viewManager - ViewManager instance from the main application
   */
  constructor(viewManager) {
    if (!viewManager) {
      throw new Error('ViewManager is required');
    }
    
    this.viewManager = viewManager;
    this.factory = new WhatsAppWebInterfaceFactory(viewManager);
    this.logger = new Logger('WhatsAppWebIntegration');
    
    // Listen to account switch events from ViewManager
    this._setupEventListeners();
  }

  /**
   * Setup event listeners for ViewManager events
   * @private
   */
  _setupEventListeners() {
    // Note: ViewManager doesn't expose EventEmitter, so we'll handle this differently
    // The factory will be notified when getting the interface
    this.logger.debug('Event listeners setup (handled by factory)');
  }

  /**
   * Get WhatsAppWebInterface for the currently active account
   * @returns {Object|null} Interface instance or null if no active view
   */
  getCurrentInterface() {
    return this.factory.getCurrentInterface();
  }

  /**
   * Get WhatsAppWebInterface for a specific account
   * @param {string} accountId - Account ID
   * @returns {Object|null} Interface instance or null if view not found
   */
  getInterfaceForAccount(accountId) {
    return this.factory.getInterfaceForAccount(accountId);
  }

  /**
   * Check if WhatsApp Web is ready for the current account
   * @returns {Promise<boolean>}
   */
  async isReady() {
    return await this.factory.isCurrentAccountReady();
  }

  /**
   * Get current chat information
   * @returns {Promise<Object|null>}
   */
  async getCurrentChat() {
    return await this.factory.getCurrentChat();
  }

  /**
   * Send a text message using the current active account
   * @param {string} text - Text content to send
   * @returns {Promise<void>}
   */
  async sendMessage(text) {
    const waInterface = this.getCurrentInterface();
    if (!waInterface) {
      throw new SendError('No active WhatsApp Web interface available');
    }
    
    return await waInterface.sendMessage(text);
  }

  /**
   * Insert text into input box using the current active account
   * @param {string} text - Text to insert
   * @returns {Promise<void>}
   */
  async insertText(text) {
    const waInterface = this.getCurrentInterface();
    if (!waInterface) {
      throw new SendError('No active WhatsApp Web interface available');
    }
    
    return await waInterface.insertText(text);
  }

  /**
   * Send an image using the current active account
   * @param {string} imagePath - Path to image file
   * @returns {Promise<void>}
   */
  async sendImage(imagePath) {
    const waInterface = this.getCurrentInterface();
    if (!waInterface) {
      throw new SendError('No active WhatsApp Web interface available');
    }
    
    return await waInterface.sendImage(imagePath);
  }

  /**
   * Send an audio file using the current active account
   * @param {string} audioPath - Path to audio file
   * @returns {Promise<void>}
   */
  async sendAudio(audioPath) {
    const waInterface = this.getCurrentInterface();
    if (!waInterface) {
      throw new SendError('No active WhatsApp Web interface available');
    }
    
    return await waInterface.sendAudio(audioPath);
  }

  /**
   * Send a video file using the current active account
   * @param {string} videoPath - Path to video file
   * @returns {Promise<void>}
   */
  async sendVideo(videoPath) {
    const waInterface = this.getCurrentInterface();
    if (!waInterface) {
      throw new SendError('No active WhatsApp Web interface available');
    }
    
    return await waInterface.sendVideo(videoPath);
  }

  /**
   * Send a contact card using the current active account
   * @param {Object} contactInfo - Contact information
   * @returns {Promise<void>}
   */
  async sendContact(contactInfo) {
    const waInterface = this.getCurrentInterface();
    if (!waInterface) {
      throw new SendError('No active WhatsApp Web interface available');
    }
    
    return await waInterface.sendContact(contactInfo);
  }

  /**
   * Focus the input box using the current active account
   * @returns {Promise<void>}
   */
  async focusInput() {
    const waInterface = this.getCurrentInterface();
    if (!waInterface) {
      throw new SendError('No active WhatsApp Web interface available');
    }
    
    return await waInterface.focusInput();
  }

  /**
   * Handle account switch event
   * @param {string} newAccountId - New active account ID
   */
  handleAccountSwitch(newAccountId) {
    this.logger.info(`Handling account switch to ${newAccountId}`);
    this.factory.handleAccountSwitch(newAccountId);
  }

  /**
   * Clear cached interfaces
   */
  clearCache() {
    this.factory.clearCache();
  }

  /**
   * Destroy the integration and clean up resources
   */
  destroy() {
    this.factory.destroy();
    this.viewManager = null;
    this.logger.info('WhatsAppWebIntegration destroyed');
  }
}

module.exports = WhatsAppWebIntegration;
