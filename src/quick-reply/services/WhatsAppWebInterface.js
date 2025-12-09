/**
 * WhatsAppWebInterface
 * 
 * Interface for interacting with WhatsApp Web through content scripts.
 * Provides methods to send messages, attach media, and insert content into input box.
 * 
 * Requirements: 7.1-7.9, 9.1-9.8
 */

const { Logger } = require('../utils/logger');
const SendError = require('../errors/SendError');
const ValidationError = require('../errors/ValidationError');

class WhatsAppWebInterface {
  /**
   * @param {Object} webContents - Electron webContents instance for the WhatsApp Web view
   */
  constructor(webContents) {
    if (!webContents) {
      throw new ValidationError('webContents is required', 'webContents');
    }
    
    this.webContents = webContents;
    this.logger = new Logger('WhatsAppWebInterface');
    this.initialized = false;
  }

  /**
   * Initialize the interface
   * @returns {Promise<void>}
   */
  async initialize() {
    try {
      // Check if WhatsApp Web is loaded
      const isLoaded = await this.executeScript(`
        typeof window !== 'undefined' && 
        document.readyState === 'complete'
      `);
      
      if (!isLoaded) {
        throw new SendError('WhatsApp Web is not loaded');
      }
      
      this.initialized = true;
      this.logger.info('WhatsApp Web interface initialized');
    } catch (error) {
      this.logger.error('Failed to initialize WhatsApp Web interface', error);
      throw error;
    }
  }

  /**
   * Execute JavaScript in the WhatsApp Web context
   * @param {string} script - JavaScript code to execute
   * @returns {Promise<any>} Result of the script execution
   */
  async executeScript(script) {
    try {
      if (!this.webContents) {
        throw new SendError('webContents not available');
      }
      
      return await this.webContents.executeJavaScript(script);
    } catch (error) {
      this.logger.error('Failed to execute script', error);
      throw new SendError(`Failed to execute script: ${error.message}`, error);
    }
  }

  /**
   * Get the input box element
   * @returns {Promise<boolean>} True if input box is found
   */
  async getInputBox() {
    const script = `
      (function() {
        // Try multiple selectors for WhatsApp Web input box
        const selectors = [
          'div[contenteditable="true"][data-tab="10"]',
          'div[contenteditable="true"][role="textbox"]',
          'div[contenteditable="true"]._13NKt',
          'div[contenteditable="true"].copyable-text'
        ];
        
        for (const selector of selectors) {
          const element = document.querySelector(selector);
          if (element) {
            return true;
          }
        }
        
        return false;
      })();
    `;
    
    return await this.executeScript(script);
  }

  /**
   * Send a text message
   * @param {string} text - Text content to send
   * @returns {Promise<void>}
   */
  async sendMessage(text) {
    try {
      if (!text || typeof text !== 'string' || text.trim().length === 0) {
        throw new ValidationError('Text content is required', 'text');
      }
      
      this.logger.debug('Sending text message', { length: text.length });
      
      // Insert text into input box and send
      const script = `
        (async function() {
          // Find input box
          const selectors = [
            'div[contenteditable="true"][data-tab="10"]',
            'div[contenteditable="true"][role="textbox"]',
            'div[contenteditable="true"]._13NKt',
            'div[contenteditable="true"].copyable-text'
          ];
          
          let inputBox = null;
          for (const selector of selectors) {
            inputBox = document.querySelector(selector);
            if (inputBox) break;
          }
          
          if (!inputBox) {
            throw new Error('Input box not found');
          }
          
          // Insert text
          const text = ${JSON.stringify(text)};
          inputBox.focus();
          
          // Use DataTransfer for better compatibility
          const dataTransfer = new DataTransfer();
          dataTransfer.setData('text/plain', text);
          const pasteEvent = new ClipboardEvent('paste', {
            clipboardData: dataTransfer,
            bubbles: true,
            cancelable: true
          });
          inputBox.dispatchEvent(pasteEvent);
          
          // Alternative: Direct text insertion
          if (inputBox.textContent !== text) {
            inputBox.textContent = text;
            inputBox.dispatchEvent(new Event('input', { bubbles: true }));
          }
          
          // Wait a bit for WhatsApp to process
          await new Promise(resolve => setTimeout(resolve, 100));
          
          // Find and click send button
          const sendSelectors = [
            'button[data-tab="11"]',
            'span[data-icon="send"]',
            'button._4sWnG'
          ];
          
          let sendButton = null;
          for (const selector of sendSelectors) {
            const btn = document.querySelector(selector);
            if (btn) {
              sendButton = btn.closest('button') || btn;
              break;
            }
          }
          
          if (!sendButton) {
            throw new Error('Send button not found');
          }
          
          sendButton.click();
          
          return true;
        })();
      `;
      
      const result = await this.executeScript(script);
      
      if (!result) {
        throw new SendError('Failed to send message');
      }
      
      this.logger.debug('Text message sent successfully');
    } catch (error) {
      this.logger.error('Failed to send text message', error);
      if (error instanceof SendError || error instanceof ValidationError) {
        throw error;
      }
      throw new SendError(`Failed to send text message: ${error.message}`, error);
    }
  }

  /**
   * Send an image
   * @param {string} imagePath - Path to image file
   * @returns {Promise<void>}
   */
  async sendImage(imagePath) {
    try {
      if (!imagePath || typeof imagePath !== 'string') {
        throw new ValidationError('Image path is required', 'imagePath');
      }
      
      this.logger.debug('Sending image', { path: imagePath });
      
      // Use file input to attach image
      const script = `
        (async function() {
          const path = ${JSON.stringify(imagePath)};
          
          // Find attach button
          const attachSelectors = [
            'span[data-icon="clip"]',
            'span[data-icon="attach-menu-plus"]',
            'div[title="Attach"]'
          ];
          
          let attachButton = null;
          for (const selector of attachSelectors) {
            const btn = document.querySelector(selector);
            if (btn) {
              attachButton = btn.closest('button') || btn;
              break;
            }
          }
          
          if (!attachButton) {
            throw new Error('Attach button not found');
          }
          
          // Click attach button
          attachButton.click();
          
          // Wait for menu to appear
          await new Promise(resolve => setTimeout(resolve, 200));
          
          // Find image/photo input
          const fileInputSelectors = [
            'input[accept*="image"]',
            'input[type="file"][accept*="image"]'
          ];
          
          let fileInput = null;
          for (const selector of fileInputSelectors) {
            fileInput = document.querySelector(selector);
            if (fileInput) break;
          }
          
          if (!fileInput) {
            throw new Error('File input not found');
          }
          
          // Note: We cannot directly set file path in browser for security reasons
          // This would need to be handled through Electron's dialog or file system
          throw new Error('Direct file attachment requires Electron dialog integration');
        })();
      `;
      
      // For now, throw an error indicating this needs Electron integration
      throw new SendError('Image sending requires Electron dialog integration. Use attachMedia method instead.');
      
    } catch (error) {
      this.logger.error('Failed to send image', error);
      if (error instanceof SendError || error instanceof ValidationError) {
        throw error;
      }
      throw new SendError(`Failed to send image: ${error.message}`, error);
    }
  }

  /**
   * Send an audio file
   * @param {string} audioPath - Path to audio file
   * @returns {Promise<void>}
   */
  async sendAudio(audioPath) {
    try {
      if (!audioPath || typeof audioPath !== 'string') {
        throw new ValidationError('Audio path is required', 'audioPath');
      }
      
      this.logger.debug('Sending audio', { path: audioPath });
      
      // Similar to image, requires Electron integration
      throw new SendError('Audio sending requires Electron dialog integration. Use attachMedia method instead.');
      
    } catch (error) {
      this.logger.error('Failed to send audio', error);
      if (error instanceof SendError || error instanceof ValidationError) {
        throw error;
      }
      throw new SendError(`Failed to send audio: ${error.message}`, error);
    }
  }

  /**
   * Send a video file
   * @param {string} videoPath - Path to video file
   * @returns {Promise<void>}
   */
  async sendVideo(videoPath) {
    try {
      if (!videoPath || typeof videoPath !== 'string') {
        throw new ValidationError('Video path is required', 'videoPath');
      }
      
      this.logger.debug('Sending video', { path: videoPath });
      
      // Similar to image, requires Electron integration
      throw new SendError('Video sending requires Electron dialog integration. Use attachMedia method instead.');
      
    } catch (error) {
      this.logger.error('Failed to send video', error);
      if (error instanceof SendError || error instanceof ValidationError) {
        throw error;
      }
      throw new SendError(`Failed to send video: ${error.message}`, error);
    }
  }

  /**
   * Send a contact card
   * @param {Object} contactInfo - Contact information
   * @returns {Promise<void>}
   */
  async sendContact(contactInfo) {
    try {
      if (!contactInfo || typeof contactInfo !== 'object') {
        throw new ValidationError('Contact info is required', 'contactInfo');
      }
      
      if (!contactInfo.name || !contactInfo.phone) {
        throw new ValidationError('Contact name and phone are required', 'contactInfo');
      }
      
      this.logger.debug('Sending contact', { name: contactInfo.name });
      
      // Contact sending requires WhatsApp Web API integration
      throw new SendError('Contact sending requires WhatsApp Web API integration');
      
    } catch (error) {
      this.logger.error('Failed to send contact', error);
      if (error instanceof SendError || error instanceof ValidationError) {
        throw error;
      }
      throw new SendError(`Failed to send contact: ${error.message}`, error);
    }
  }

  /**
   * Insert text into input box without sending
   * @param {string} text - Text to insert
   * @returns {Promise<void>}
   */
  async insertText(text) {
    try {
      if (!text || typeof text !== 'string') {
        throw new ValidationError('Text is required', 'text');
      }
      
      this.logger.debug('Inserting text into input box', { length: text.length });
      
      const script = `
        (function() {
          // Find input box
          const selectors = [
            'div[contenteditable="true"][data-tab="10"]',
            'div[contenteditable="true"][role="textbox"]',
            'div[contenteditable="true"]._13NKt',
            'div[contenteditable="true"].copyable-text'
          ];
          
          let inputBox = null;
          for (const selector of selectors) {
            inputBox = document.querySelector(selector);
            if (inputBox) break;
          }
          
          if (!inputBox) {
            throw new Error('Input box not found');
          }
          
          // Get current content
          const currentText = inputBox.textContent || '';
          const text = ${JSON.stringify(text)};
          
          // Append text
          const newText = currentText ? currentText + ' ' + text : text;
          
          inputBox.focus();
          
          // Use DataTransfer for better compatibility
          const dataTransfer = new DataTransfer();
          dataTransfer.setData('text/plain', newText);
          const pasteEvent = new ClipboardEvent('paste', {
            clipboardData: dataTransfer,
            bubbles: true,
            cancelable: true
          });
          inputBox.dispatchEvent(pasteEvent);
          
          // Alternative: Direct text insertion
          if (inputBox.textContent !== newText) {
            inputBox.textContent = newText;
            inputBox.dispatchEvent(new Event('input', { bubbles: true }));
          }
          
          // Move cursor to end
          const range = document.createRange();
          const sel = window.getSelection();
          range.selectNodeContents(inputBox);
          range.collapse(false);
          sel.removeAllRanges();
          sel.addRange(range);
          
          return true;
        })();
      `;
      
      const result = await this.executeScript(script);
      
      if (!result) {
        throw new SendError('Failed to insert text');
      }
      
      this.logger.debug('Text inserted successfully');
    } catch (error) {
      this.logger.error('Failed to insert text', error);
      if (error instanceof SendError || error instanceof ValidationError) {
        throw error;
      }
      throw new SendError(`Failed to insert text: ${error.message}`, error);
    }
  }

  /**
   * Attach media file (requires Electron dialog)
   * @param {string} mediaPath - Path to media file
   * @returns {Promise<void>}
   */
  async attachMedia(mediaPath) {
    try {
      if (!mediaPath || typeof mediaPath !== 'string') {
        throw new ValidationError('Media path is required', 'mediaPath');
      }
      
      this.logger.debug('Attaching media', { path: mediaPath });
      
      // This requires Electron's dialog and file system integration
      // For now, we'll throw an error indicating this needs implementation
      throw new SendError(
        'Media attachment requires Electron dialog integration. ' +
        'This should be implemented in the main process using dialog.showOpenDialog() ' +
        'and then triggering the file input programmatically.'
      );
      
    } catch (error) {
      this.logger.error('Failed to attach media', error);
      if (error instanceof SendError || error instanceof ValidationError) {
        throw error;
      }
      throw new SendError(`Failed to attach media: ${error.message}`, error);
    }
  }

  /**
   * Attach contact (requires WhatsApp Web API)
   * @param {Object} contactInfo - Contact information
   * @returns {Promise<void>}
   */
  async attachContact(contactInfo) {
    try {
      if (!contactInfo || typeof contactInfo !== 'object') {
        throw new ValidationError('Contact info is required', 'contactInfo');
      }
      
      this.logger.debug('Attaching contact', { name: contactInfo.name });
      
      // This requires WhatsApp Web API integration
      throw new SendError('Contact attachment requires WhatsApp Web API integration');
      
    } catch (error) {
      this.logger.error('Failed to attach contact', error);
      if (error instanceof SendError || error instanceof ValidationError) {
        throw error;
      }
      throw new SendError(`Failed to attach contact: ${error.message}`, error);
    }
  }

  /**
   * Focus the input box
   * @returns {Promise<void>}
   */
  async focusInput() {
    try {
      this.logger.debug('Focusing input box');
      
      const script = `
        (function() {
          // Find input box
          const selectors = [
            'div[contenteditable="true"][data-tab="10"]',
            'div[contenteditable="true"][role="textbox"]',
            'div[contenteditable="true"]._13NKt',
            'div[contenteditable="true"].copyable-text'
          ];
          
          let inputBox = null;
          for (const selector of selectors) {
            inputBox = document.querySelector(selector);
            if (inputBox) break;
          }
          
          if (!inputBox) {
            throw new Error('Input box not found');
          }
          
          inputBox.focus();
          
          // Move cursor to end
          const range = document.createRange();
          const sel = window.getSelection();
          range.selectNodeContents(inputBox);
          range.collapse(false);
          sel.removeAllRanges();
          sel.addRange(range);
          
          return true;
        })();
      `;
      
      const result = await this.executeScript(script);
      
      if (!result) {
        throw new SendError('Failed to focus input');
      }
      
      this.logger.debug('Input box focused');
    } catch (error) {
      this.logger.error('Failed to focus input', error);
      if (error instanceof SendError) {
        throw error;
      }
      throw new SendError(`Failed to focus input: ${error.message}`, error);
    }
  }

  /**
   * Check if WhatsApp Web is ready
   * @returns {Promise<boolean>}
   */
  async isReady() {
    try {
      const script = `
        (function() {
          // Check if WhatsApp Web is loaded and logged in
          const hasInputBox = !!document.querySelector('div[contenteditable="true"]');
          const hasChats = !!document.querySelector('[data-testid="chat-list"]');
          
          return hasInputBox || hasChats;
        })();
      `;
      
      return await this.executeScript(script);
    } catch (error) {
      this.logger.error('Failed to check if WhatsApp Web is ready', error);
      return false;
    }
  }

  /**
   * Get current chat information
   * @returns {Promise<Object|null>}
   */
  async getCurrentChat() {
    try {
      const script = `
        (function() {
          // Try to get current chat name
          const headerSelectors = [
            'header span[title]',
            'header div[title]',
            'header._2au8k span'
          ];
          
          let chatName = null;
          for (const selector of headerSelectors) {
            const element = document.querySelector(selector);
            if (element && element.title) {
              chatName = element.title;
              break;
            }
          }
          
          if (!chatName) {
            return null;
          }
          
          return {
            name: chatName,
            timestamp: Date.now()
          };
        })();
      `;
      
      return await this.executeScript(script);
    } catch (error) {
      this.logger.error('Failed to get current chat', error);
      return null;
    }
  }

  /**
   * Destroy the interface
   */
  destroy() {
    this.webContents = null;
    this.initialized = false;
    this.logger.info('WhatsApp Web interface destroyed');
  }
}

module.exports = WhatsAppWebInterface;
