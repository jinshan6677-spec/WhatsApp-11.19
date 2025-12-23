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
 * Get MIME type from file extension
 * @param {string} filePath - File path
 * @returns {string} MIME type
 */
function getMimeType(filePath) {
  const ext = filePath.toLowerCase().split('.').pop();
  const mimeTypes = {
    // Images
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'webp': 'image/webp',
    'bmp': 'image/bmp',
    'svg': 'image/svg+xml',
    // Videos
    'mp4': 'video/mp4',
    'webm': 'video/webm',
    'avi': 'video/x-msvideo',
    'mov': 'video/quicktime',
    'mkv': 'video/x-matroska',
    '3gp': 'video/3gpp',
    '3gpp': 'video/3gpp',
    // Audio
    'mp3': 'audio/mpeg',
    'wav': 'audio/wav',
    'ogg': 'audio/ogg',
    'm4a': 'audio/mp4',
    'aac': 'audio/aac',
    'flac': 'audio/flac',
    'wma': 'audio/x-ms-wma',
    // Documents
    'pdf': 'application/pdf',
    'doc': 'application/msword',
    'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'xls': 'application/vnd.ms-excel',
    'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'ppt': 'application/vnd.ms-powerpoint',
    'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'txt': 'text/plain',
    'zip': 'application/zip',
    'rar': 'application/x-rar-compressed'
  };
  return mimeTypes[ext] || 'application/octet-stream';
}

/**
 * Generate JavaScript code to find attach button in WhatsApp Web
 * @returns {string} JavaScript code string
 */
function getAttachButtonFinderScript() {
  return `
    // Find attach button - WhatsApp Web uses different selectors in different versions
    // 2024-2025 WhatsApp Web selectors
    const attachSelectors = [
      // Primary selectors - most common in recent versions
      '[data-testid="attach-menu-plus"]',
      '[data-testid="clip"]',
      'span[data-icon="attach-menu-plus"]',
      'span[data-icon="clip"]',
      'span[data-icon="plus"]',
      // Button with aria-label (internationalized)
      'button[aria-label*="Attach"]',
      'button[aria-label*="attach"]',
      'button[aria-label*="附"]',
      'button[aria-label*="Adjuntar"]',
      'div[aria-label*="Attach"]',
      'div[aria-label*="attach"]',
      'div[aria-label*="附"]',
      // Button with title
      'div[title="Attach"]',
      'div[title="附加"]',
      'div[title="附件"]',
      'button[title="Attach"]',
      'button[title="附加"]',
      // Footer area buttons
      'footer button[aria-label*="Attach"]',
      'footer button[aria-label*="附"]',
      // Plus button in compose area
      '[data-testid="compose-btn-attach"]',
      '[data-testid="attach-menu"]',
      // Generic plus icon
      'footer span[data-icon="plus"]',
      'footer [data-icon="clip"]',
      // Fallback: any clickable element with clip/attach icon
      '[data-icon="clip"]',
      '[data-icon="attach"]',
      '[data-icon="attach-menu-plus"]',
      // SVG based selectors
      'button svg[viewBox="0 0 24 24"]'
    ];
    
    console.log('[QuickReply] Looking for attach button...');
    console.log('[QuickReply] Current URL:', window.location.href);
    
    let attachButton = null;
    for (const selector of attachSelectors) {
      try {
        const btn = document.querySelector(selector);
        if (btn) {
          console.log('[QuickReply] Found element with selector:', selector);
          // Try to find the clickable parent
          attachButton = btn.closest('button') || btn.closest('[role="button"]') || btn.closest('div[tabindex]') || btn.parentElement || btn;
          console.log('[QuickReply] Using element:', attachButton.tagName, attachButton.className);
          break;
        }
      } catch (e) {
        console.log('[QuickReply] Selector error:', selector, e.message);
      }
    }
    
    // If still not found, try to find by looking at footer buttons
    if (!attachButton) {
      console.log('[QuickReply] Trying fallback: looking for footer area...');
      
      // Try multiple footer selectors
      const footerSelectors = [
        'footer',
        '#main footer',
        '[data-testid="conversation-compose-box"]',
        '[data-testid="compose-box"]',
        'div[class*="compose"]',
        'div[class*="footer"]'
      ];
      
      let footer = null;
      for (const sel of footerSelectors) {
        footer = document.querySelector(sel);
        if (footer) {
          console.log('[QuickReply] Found footer with selector:', sel);
          break;
        }
      }
      
      if (footer) {
        // Look for buttons or clickable elements
        const clickables = footer.querySelectorAll('button, [role="button"], div[tabindex="0"]');
        console.log('[QuickReply] Found', clickables.length, 'clickable elements in footer');
        
        // Log all clickable elements for debugging
        clickables.forEach((el, i) => {
          console.log('[QuickReply] Clickable', i, ':', el.tagName, el.className, el.getAttribute('aria-label') || '', el.getAttribute('data-testid') || '');
        });
        
        // Usually the attach button is one of the first buttons
        // Look for one with an icon or specific attributes
        for (const el of clickables) {
          const hasIcon = el.querySelector('span[data-icon]') || el.querySelector('svg');
          const ariaLabel = el.getAttribute('aria-label') || '';
          if (hasIcon && !ariaLabel.toLowerCase().includes('send') && !ariaLabel.toLowerCase().includes('发送')) {
            attachButton = el;
            console.log('[QuickReply] Using clickable element with icon as attach button');
            break;
          }
        }
        
        // Last resort: use first clickable
        if (!attachButton && clickables.length > 0) {
          attachButton = clickables[0];
          console.log('[QuickReply] Using first clickable element as attach button');
        }
      }
    }
    
    // Debug: log all data-testid elements
    if (!attachButton) {
      console.log('[QuickReply] Debugging: listing all data-testid elements...');
      const testIdElements = document.querySelectorAll('[data-testid]');
      testIdElements.forEach(el => {
        console.log('[QuickReply] data-testid:', el.getAttribute('data-testid'));
      });
      
      console.log('[QuickReply] Debugging: listing all data-icon elements...');
      const iconElements = document.querySelectorAll('[data-icon]');
      iconElements.forEach(el => {
        console.log('[QuickReply] data-icon:', el.getAttribute('data-icon'));
      });
    }
    
    if (!attachButton) {
      console.error('[QuickReply] Attach button not found. Please make sure:');
      console.error('[QuickReply] 1. You have opened a chat conversation');
      console.error('[QuickReply] 2. WhatsApp Web is fully loaded');
      console.error('[QuickReply] 3. The compose area is visible');
      throw new Error('Attach button not found - please open a chat first');
    }
  `;
}

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
      const view = viewManager.getView(accountId);
      if (!view || !view.webContents) {
        throw new Error('View not found for account');
      }
      
      const fs = require('fs');
      const path = require('path');
      
      // Verify file exists
      if (!fs.existsSync(imagePath)) {
        throw new Error(`Image file not found: ${imagePath}`);
      }
      
      // Check file size
      const stats = fs.statSync(imagePath);
      const fileSizeMB = stats.size / (1024 * 1024);
      console.log(`[QuickReply] Image file size: ${fileSizeMB.toFixed(2)} MB`);
      
      // Read file as base64
      const fileBuffer = fs.readFileSync(imagePath);
      const base64Data = fileBuffer.toString('base64');
      const fileName = path.basename(imagePath);
      const mimeType = getMimeType(imagePath);
      
      console.log(`[QuickReply] Sending image: ${fileName}, type: ${mimeType}`);
      
      const scriptResult = await view.webContents.executeJavaScript(`
        (async function() {
          try {
            console.log('[QuickReply] Starting image send process...');
            
            // Convert base64 to File object
            const base64Data = '${base64Data}';
            const fileName = '${fileName}';
            const mimeType = '${mimeType}';
            
            const byteCharacters = atob(base64Data);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
              byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            const blob = new Blob([byteArray], { type: mimeType });
            const file = new File([blob], fileName, { type: mimeType });
            
            console.log('[QuickReply] File created:', file.name, file.size, 'bytes');
            
            ${getAttachButtonFinderScript()}
            
            // Click attach button to open menu
            console.log('[QuickReply] Clicking attach button...');
            attachButton.click();
            
            // Wait for menu to appear
            await new Promise(resolve => setTimeout(resolve, 600));
            
            // Find and click "照片和视频" (Photos and Videos) option
            // This is the second item in the menu based on the screenshot
            console.log('[QuickReply] Looking for 照片和视频 option...');
            
            let photoVideoOption = null;
            
            // Method 1: Find by text content "照片和视频"
            const allElements = document.querySelectorAll('div, span, li, button');
            for (const el of allElements) {
              const text = el.textContent?.trim();
              if (text === '照片和视频' || text === 'Photos & videos' || text === 'Photos and videos') {
                // Make sure this is a clickable element or find its parent
                photoVideoOption = el.closest('[role="button"]') || el.closest('li') || el.closest('button') || el;
                console.log('[QuickReply] Found 照片和视频 by exact text match');
                break;
              }
            }
            
            // Method 2: Find by aria-label
            if (!photoVideoOption) {
              const ariaSelectors = [
                '[aria-label="照片和视频"]',
                '[aria-label*="照片"]',
                '[aria-label*="Photos"]'
              ];
              for (const selector of ariaSelectors) {
                const el = document.querySelector(selector);
                if (el) {
                  photoVideoOption = el;
                  console.log('[QuickReply] Found by aria-label:', selector);
                  break;
                }
              }
            }
            
            // Method 3: Find menu items and select the one with photo icon
            if (!photoVideoOption) {
              // Look for the menu container
              const menuItems = document.querySelectorAll('li[role="button"], div[role="button"]');
              console.log('[QuickReply] Found', menuItems.length, 'menu items');
              
              for (const item of menuItems) {
                const text = item.textContent || '';
                // Check for photo/video related text, exclude sticker
                if ((text.includes('照片') || text.includes('视频') || text.includes('Photo') || text.includes('Video')) &&
                    !text.includes('贴图') && !text.includes('Sticker') && !text.includes('新建')) {
                  photoVideoOption = item;
                  console.log('[QuickReply] Found menu item with text:', text);
                  break;
                }
              }
            }
            
            if (!photoVideoOption) {
              console.error('[QuickReply] 照片和视频 option not found!');
              // List all visible text for debugging
              const visibleTexts = [];
              document.querySelectorAll('li, [role="button"]').forEach(el => {
                if (el.textContent?.trim()) visibleTexts.push(el.textContent.trim().substring(0, 50));
              });
              console.log('[QuickReply] Visible menu items:', visibleTexts);
              throw new Error('照片和视频 option not found in attach menu');
            }
            
            // Click the Photos and Videos option
            console.log('[QuickReply] Clicking 照片和视频 option...');
            photoVideoOption.click();
            
            // Wait for file dialog or input to be ready
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // Now find the file input that was activated
            // After clicking 照片和视频, a file input should be ready
            const allInputs = document.querySelectorAll('input[type="file"]');
            console.log('[QuickReply] Found', allInputs.length, 'file inputs after clicking menu');
            
            let fileInput = null;
            
            // Find the input that accepts images and videos (not just webp for stickers)
            for (const input of allInputs) {
              const accept = input.accept || '';
              console.log('[QuickReply] Checking input with accept:', accept);
              
              // The photo/video input should accept video formats
              if (accept.includes('video/mp4') || accept.includes('video/3gpp')) {
                fileInput = input;
                console.log('[QuickReply] Selected photo/video input');
                break;
              }
            }
            
            // Fallback: find input with image/* and video/*
            if (!fileInput) {
              for (const input of allInputs) {
                const accept = input.accept || '';
                if (accept.includes('image/*') && accept.includes('video/')) {
                  fileInput = input;
                  console.log('[QuickReply] Selected input with image/* and video/');
                  break;
                }
              }
            }
            
            if (!fileInput) {
              throw new Error('Photo/Video file input not found after clicking menu option');
            }
            
            // Set the file to the input
            console.log('[QuickReply] Setting file to input...');
            const dataTransfer = new DataTransfer();
            dataTransfer.items.add(file);
            fileInput.files = dataTransfer.files;
            
            // Trigger change event
            fileInput.dispatchEvent(new Event('change', { bubbles: true }));
            console.log('[QuickReply] File input change event dispatched');
            
            // Wait for preview to load
            console.log('[QuickReply] Waiting for preview to load...');
            await new Promise(resolve => setTimeout(resolve, 1500));
            
            // Find and click send button
            console.log('[QuickReply] Looking for send button...');
            const sendSelectors = [
              '[data-testid="send"]',
              'span[data-icon="send"]',
              'div[role="button"][aria-label*="Send"]',
              'div[role="button"][aria-label*="发送"]',
              'button[aria-label*="Send"]',
              'button[aria-label*="发送"]'
            ];
            
            await new Promise(resolve => setTimeout(resolve, 500));
            
            let sendButton = null;
            for (const selector of sendSelectors) {
              sendButton = document.querySelector(selector);
              if (sendButton) {
                sendButton = sendButton.closest('button') || sendButton.closest('[role="button"]') || sendButton;
                console.log('[QuickReply] Found send button');
                break;
              }
            }
            
            if (sendButton) {
              sendButton.click();
              console.log('[QuickReply] Send button clicked');
              return { success: true, message: 'Image sent successfully' };
            } else {
              console.log('[QuickReply] Send button not found, image attached but not sent');
              return { success: true, message: 'Image attached, please send manually' };
            }
          } catch (error) {
            console.error('[QuickReply] Error in image send:', error);
            return { success: false, error: error.message };
          }
        })();
      `);
      
      console.log('[QuickReply] Image send script result:', scriptResult);
      
      if (scriptResult && !scriptResult.success) {
        throw new Error(scriptResult.error || 'Failed to send image');
      }
    },
    
    sendAudio: async (audioPath) => {
      const view = viewManager.getView(accountId);
      if (!view || !view.webContents) {
        throw new Error('View not found for account');
      }
      
      const fs = require('fs');
      const path = require('path');
      
      // Verify file exists
      if (!fs.existsSync(audioPath)) {
        throw new Error(`Audio file not found: ${audioPath}`);
      }
      
      // Check file size
      const stats = fs.statSync(audioPath);
      const fileSizeMB = stats.size / (1024 * 1024);
      console.log(`[QuickReply] Audio file size: ${fileSizeMB.toFixed(2)} MB`);
      
      // Read file as base64
      const fileBuffer = fs.readFileSync(audioPath);
      const base64Data = fileBuffer.toString('base64');
      const fileName = path.basename(audioPath);
      const mimeType = getMimeType(audioPath);
      
      console.log(`[QuickReply] Sending audio: ${fileName}, type: ${mimeType}`);
      
      const scriptResult = await view.webContents.executeJavaScript(`
        (async function() {
          try {
            console.log('[QuickReply] Starting audio send process...');
            
            // Convert base64 to File object
            const base64Data = '${base64Data}';
            const fileName = '${fileName}';
            const mimeType = '${mimeType}';
            
            const byteCharacters = atob(base64Data);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
              byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            const blob = new Blob([byteArray], { type: mimeType });
            const file = new File([blob], fileName, { type: mimeType });
            
            console.log('[QuickReply] File created:', file.name, file.size, 'bytes');
            
            ${getAttachButtonFinderScript()}
            
            // Click attach button
            console.log('[QuickReply] Clicking attach button...');
            attachButton.click();
            
            // Wait for menu to appear
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // Find document input (audio files go through document option)
            console.log('[QuickReply] Looking for file input...');
            const allInputs = document.querySelectorAll('input[type="file"]');
            console.log('[QuickReply] Found', allInputs.length, 'file inputs');
            
            allInputs.forEach((input, i) => {
              console.log('[QuickReply] Input', i, '- accept:', input.accept);
            });
            
            let fileInput = null;
            for (const input of allInputs) {
              // Prefer the document input (accepts all files)
              if (input.accept === '*' || !input.accept || input.accept.includes('audio')) {
                fileInput = input;
                console.log('[QuickReply] Selected input with accept:', input.accept || '*');
                break;
              }
            }
            
            if (!fileInput && allInputs.length > 0) {
              fileInput = allInputs[allInputs.length - 1]; // Last input is usually document
              console.log('[QuickReply] Using last file input');
            }
            
            if (!fileInput) {
              throw new Error('File input not found - attach menu may not have opened');
            }
            
            // Create DataTransfer and set file
            console.log('[QuickReply] Setting file to input...');
            const dataTransfer = new DataTransfer();
            dataTransfer.items.add(file);
            fileInput.files = dataTransfer.files;
            
            // Trigger change event
            fileInput.dispatchEvent(new Event('change', { bubbles: true }));
            console.log('[QuickReply] File input change event dispatched');
            
            // Wait for preview to load
            console.log('[QuickReply] Waiting for preview to load...');
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Find and click send button
            console.log('[QuickReply] Looking for send button...');
            const sendSelectors = [
              '[data-testid="send"]',
              'span[data-icon="send"]',
              'div[role="button"][aria-label*="Send"]',
              'div[role="button"][aria-label*="发送"]',
              'button[aria-label*="Send"]',
              'button[aria-label*="发送"]'
            ];
            
            await new Promise(resolve => setTimeout(resolve, 500));
            
            let sendButton = null;
            for (const selector of sendSelectors) {
              sendButton = document.querySelector(selector);
              if (sendButton) {
                sendButton = sendButton.closest('button') || sendButton.closest('[role="button"]') || sendButton;
                console.log('[QuickReply] Found send button with selector:', selector);
                break;
              }
            }
            
            if (sendButton) {
              sendButton.click();
              console.log('[QuickReply] Send button clicked');
              return { success: true, message: 'Audio sent successfully' };
            } else {
              console.log('[QuickReply] Send button not found, audio attached but not sent');
              return { success: true, message: 'Audio attached, please send manually' };
            }
          } catch (error) {
            console.error('[QuickReply] Error in audio send:', error);
            return { success: false, error: error.message };
          }
        })();
      `);
      
      console.log('[QuickReply] Audio send script result:', scriptResult);
      
      if (scriptResult && !scriptResult.success) {
        throw new Error(scriptResult.error || 'Failed to send audio');
      }
    },
    
    sendVideo: async (videoPath) => {
      const view = viewManager.getView(accountId);
      if (!view || !view.webContents) {
        throw new Error('View not found for account');
      }
      
      const fs = require('fs');
      const path = require('path');
      
      // Verify file exists
      if (!fs.existsSync(videoPath)) {
        throw new Error(`Video file not found: ${videoPath}`);
      }
      
      // Check file size (WhatsApp has a 64MB limit for videos)
      const stats = fs.statSync(videoPath);
      const fileSizeMB = stats.size / (1024 * 1024);
      console.log(`[QuickReply] Video file size: ${fileSizeMB.toFixed(2)} MB`);
      
      if (fileSizeMB > 64) {
        throw new Error(`Video file too large: ${fileSizeMB.toFixed(2)} MB. Maximum size is 64MB.`);
      }
      
      // Read file as base64
      const fileBuffer = fs.readFileSync(videoPath);
      const base64Data = fileBuffer.toString('base64');
      const fileName = path.basename(videoPath);
      const mimeType = getMimeType(videoPath);
      
      console.log(`[QuickReply] Sending video: ${fileName}, type: ${mimeType}, size: ${fileSizeMB.toFixed(2)} MB`);
      
      const scriptResult = await view.webContents.executeJavaScript(`
        (async function() {
          try {
            console.log('[QuickReply] Starting video send process...');
            
            // Convert base64 to File object
            const base64Data = '${base64Data}';
            const fileName = '${fileName}';
            const mimeType = '${mimeType}';
            
            console.log('[QuickReply] Creating file from base64, length:', base64Data.length);
            
            const byteCharacters = atob(base64Data);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
              byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            const blob = new Blob([byteArray], { type: mimeType });
            const file = new File([blob], fileName, { type: mimeType });
            
            console.log('[QuickReply] File created:', file.name, file.size, 'bytes');
            
            ${getAttachButtonFinderScript()}
            
            // Click attach button to open menu
            console.log('[QuickReply] Clicking attach button...');
            attachButton.click();
            
            // Wait for menu to appear
            await new Promise(resolve => setTimeout(resolve, 600));
            
            // Find and click "照片和视频" (Photos and Videos) option
            console.log('[QuickReply] Looking for 照片和视频 option...');
            
            let photoVideoOption = null;
            
            // Method 1: Find by text content "照片和视频"
            const allElements = document.querySelectorAll('div, span, li, button');
            for (const el of allElements) {
              const text = el.textContent?.trim();
              if (text === '照片和视频' || text === 'Photos & videos' || text === 'Photos and videos') {
                photoVideoOption = el.closest('[role="button"]') || el.closest('li') || el.closest('button') || el;
                console.log('[QuickReply] Found 照片和视频 by exact text match');
                break;
              }
            }
            
            // Method 2: Find menu items and select the one with photo/video text
            if (!photoVideoOption) {
              const menuItems = document.querySelectorAll('li[role="button"], div[role="button"]');
              for (const item of menuItems) {
                const text = item.textContent || '';
                if ((text.includes('照片') || text.includes('视频') || text.includes('Photo') || text.includes('Video')) &&
                    !text.includes('贴图') && !text.includes('Sticker') && !text.includes('新建')) {
                  photoVideoOption = item;
                  console.log('[QuickReply] Found menu item with text:', text);
                  break;
                }
              }
            }
            
            if (!photoVideoOption) {
              throw new Error('照片和视频 option not found in attach menu');
            }
            
            // Click the Photos and Videos option
            console.log('[QuickReply] Clicking 照片和视频 option...');
            photoVideoOption.click();
            
            // Wait for file input to be ready
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // Find the file input
            const allInputs = document.querySelectorAll('input[type="file"]');
            console.log('[QuickReply] Found', allInputs.length, 'file inputs');
            
            let fileInput = null;
            
            // Find the input that accepts videos
            for (const input of allInputs) {
              const accept = input.accept || '';
              if (accept.includes('video/mp4') || accept.includes('video/3gpp')) {
                fileInput = input;
                console.log('[QuickReply] Selected video input');
                break;
              }
            }
            
            if (!fileInput) {
              for (const input of allInputs) {
                const accept = input.accept || '';
                if (accept.includes('image/*') && accept.includes('video/')) {
                  fileInput = input;
                  break;
                }
              }
            }
            
            if (!fileInput) {
              throw new Error('Video file input not found');
            }
            
            // Set the file to the input
            console.log('[QuickReply] Setting file to input...');
            const dataTransfer = new DataTransfer();
            dataTransfer.items.add(file);
            fileInput.files = dataTransfer.files;
            
            // Trigger change event
            fileInput.dispatchEvent(new Event('change', { bubbles: true }));
            console.log('[QuickReply] File input change event dispatched');
            
            // Wait for preview to load (videos take longer)
            console.log('[QuickReply] Waiting for preview to load...');
            await new Promise(resolve => setTimeout(resolve, 2500));
            
            // Find and click send button
            console.log('[QuickReply] Looking for send button...');
            const sendSelectors = [
              '[data-testid="send"]',
              'span[data-icon="send"]',
              'div[role="button"][aria-label*="Send"]',
              'div[role="button"][aria-label*="发送"]',
              'button[aria-label*="Send"]',
              'button[aria-label*="发送"]'
            ];
            
            await new Promise(resolve => setTimeout(resolve, 500));
            
            let sendButton = null;
            for (const selector of sendSelectors) {
              sendButton = document.querySelector(selector);
              if (sendButton) {
                sendButton = sendButton.closest('button') || sendButton.closest('[role="button"]') || sendButton;
                break;
              }
            }
            
            if (sendButton) {
              sendButton.click();
              console.log('[QuickReply] Send button clicked');
              return { success: true, message: 'Video sent successfully' };
            } else {
              return { success: true, message: 'Video attached, please send manually' };
            }
          } catch (error) {
            console.error('[QuickReply] Error in video send:', error);
            return { success: false, error: error.message };
          }
        })();
      `);
      
      console.log('[QuickReply] Video send script result:', scriptResult);
      
      if (scriptResult && !scriptResult.success) {
        throw new Error(scriptResult.error || 'Failed to send video');
      }
    },
    
    sendContact: async (contactInfo) => {
      // Contact sending requires WhatsApp Web API integration
      throw new Error('Contact sending not yet implemented');
    },
    
    attachMedia: async (mediaPath) => {
      const view = viewManager.getView(accountId);
      if (!view || !view.webContents) {
        throw new Error('View not found for account');
      }
      
      const fs = require('fs');
      const path = require('path');
      
      // Verify file exists
      if (!fs.existsSync(mediaPath)) {
        throw new Error(`Media file not found: ${mediaPath}`);
      }
      
      // Check file size
      const stats = fs.statSync(mediaPath);
      const fileSizeMB = stats.size / (1024 * 1024);
      console.log(`[QuickReply] Media file size: ${fileSizeMB.toFixed(2)} MB`);
      
      // Read file as base64
      const fileBuffer = fs.readFileSync(mediaPath);
      const base64Data = fileBuffer.toString('base64');
      const fileName = path.basename(mediaPath);
      const mimeType = getMimeType(mediaPath);
      
      console.log(`[QuickReply] Attaching media: ${fileName}, type: ${mimeType}`);
      
      const scriptResult = await view.webContents.executeJavaScript(`
        (async function() {
          try {
            console.log('[QuickReply] Starting media attach process...');
            
            // Convert base64 to File object
            const base64Data = '${base64Data}';
            const fileName = '${fileName}';
            const mimeType = '${mimeType}';
            
            const byteCharacters = atob(base64Data);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
              byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            const blob = new Blob([byteArray], { type: mimeType });
            const file = new File([blob], fileName, { type: mimeType });
            
            console.log('[QuickReply] File created:', file.name, file.size, 'bytes');
            
            ${getAttachButtonFinderScript()}
            
            // Click attach button
            console.log('[QuickReply] Clicking attach button...');
            attachButton.click();
            
            // Wait for menu to appear
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // For image/video, click "Photos & Videos" option first
            if (mimeType.startsWith('image/') || mimeType.startsWith('video/')) {
              console.log('[QuickReply] Looking for Photos & Videos option...');
              
              const photoVideoSelectors = [
                '[data-testid="attach-image"]',
                '[data-testid="mi-attach-media"]',
                'span[data-icon="attach-image"]',
                'span[data-icon="image"]',
                'button[aria-label*="Photos"]',
                'button[aria-label*="图片"]',
                'div[aria-label*="Photos"]',
                'li[data-testid="mi-attach-media"]'
              ];
              
              let photoVideoOption = null;
              for (const selector of photoVideoSelectors) {
                const el = document.querySelector(selector);
                if (el) {
                  photoVideoOption = el.closest('button') || el.closest('[role="button"]') || el.closest('li') || el;
                  console.log('[QuickReply] Found Photos & Videos option');
                  break;
                }
              }
              
              if (photoVideoOption) {
                photoVideoOption.click();
                await new Promise(resolve => setTimeout(resolve, 300));
              }
            }
            
            // Find appropriate file input
            console.log('[QuickReply] Looking for file input...');
            const allInputs = document.querySelectorAll('input[type="file"]');
            console.log('[QuickReply] Found', allInputs.length, 'file inputs');
            
            allInputs.forEach((input, i) => {
              console.log('[QuickReply] Input', i, '- accept:', input.accept);
            });
            
            let fileInput = null;
            
            if (mimeType.startsWith('image/') || mimeType.startsWith('video/')) {
              // Use image/video input - specifically look for one that accepts both
              for (const input of allInputs) {
                if (input.accept && input.accept.includes('image/*') && input.accept.includes('video/')) {
                  fileInput = input;
                  console.log('[QuickReply] Selected image+video input');
                  break;
                }
              }
              // Fallback to any image input
              if (!fileInput) {
                for (const input of allInputs) {
                  if (input.accept && input.accept.includes('image/') && !input.accept.includes('webp')) {
                    fileInput = input;
                    console.log('[QuickReply] Selected image input');
                    break;
                  }
                }
              }
            } else {
              // Use document input for other files
              for (const input of allInputs) {
                if (input.accept === '*' || !input.accept) {
                  fileInput = input;
                  console.log('[QuickReply] Selected document input');
                  break;
                }
              }
            }
            
            if (!fileInput && allInputs.length > 0) {
              fileInput = allInputs[0];
              console.log('[QuickReply] Using first available file input');
            }
            
            if (!fileInput) {
              throw new Error('File input not found - attach menu may not have opened');
            }
            
            // Create DataTransfer and set file
            console.log('[QuickReply] Setting file to input...');
            const dataTransfer = new DataTransfer();
            dataTransfer.items.add(file);
            fileInput.files = dataTransfer.files;
            
            // Trigger change event
            fileInput.dispatchEvent(new Event('change', { bubbles: true }));
            console.log('[QuickReply] File input change event dispatched');
            
            // Don't auto-send for attachMedia - just attach and let user review
            console.log('[QuickReply] Media attached, waiting for user to send');
            return { success: true, message: 'Media attached successfully' };
          } catch (error) {
            console.error('[QuickReply] Error in media attach:', error);
            return { success: false, error: error.message };
          }
        })();
      `);
      
      console.log('[QuickReply] Media attach script result:', scriptResult);
      
      if (scriptResult && !scriptResult.success) {
        throw new Error(scriptResult.error || 'Failed to attach media');
      }
    },
    
    attachContact: async (contactInfo) => {
      // Contact attachment requires WhatsApp Web API integration
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

  // Open management window
  ipcMain.handle('quick-reply:open-management', async (event) => {
    console.log('[QuickReply IPC] quick-reply:open-management handler called');
    try {
      const accountId = getCurrentAccountId(dependencies.viewManager);
      console.log(`[QuickReply IPC] Opening management window for account ${accountId}`);
      
      const controller = getController(accountId);
      console.log(`[QuickReply IPC] Got controller for account ${accountId}`);
      
      // Initialize controller if not already initialized
      if (!controller._initialized) {
        console.log(`[QuickReply IPC] Initializing controller for account ${accountId}`);
        await controller.initialize();
        controller._initialized = true;
        console.log(`[QuickReply IPC] Controller initialized for account ${accountId}`);
      }
      
      // Call openManagementWindow() which actually creates the BrowserWindow
      console.log(`[QuickReply IPC] Calling openManagementWindow for account ${accountId}`);
      await controller.openManagementWindow();
      console.log(`[QuickReply IPC] Management window opened for account ${accountId}`);
      
      return { success: true };
    } catch (error) {
      console.error('[QuickReply IPC] Open management window error:', error);
      console.error('[QuickReply IPC] Error stack:', error.stack);
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

  // ============================================
  // Management Window IPC Handlers
  // ============================================

  // Handle management window ready event
  ipcMain.on('management-window-ready', async (event, { accountId }) => {
    try {
      console.log(`[QuickReply IPC] Management window ready for account: ${accountId}`);
      
      const controller = getController(accountId);
      
      // Initialize controller if not already initialized
      if (!controller._initialized) {
        await controller.initialize();
        controller._initialized = true;
      }
      
      // Load and send data to the management window
      const templates = await controller.templateManager.storage.getAll();
      const groups = await controller.groupManager.getAllGroups();
      
      // Send data back to the management window
      event.sender.send('management-window-data', {
        groups,
        templates
      });
      
      console.log(`[QuickReply IPC] Sent initial data to management window: ${templates.length} templates, ${groups.length} groups`);
    } catch (error) {
      console.error('[QuickReply IPC] Management window ready error:', error);
    }
  });

  // Handle management window actions
  ipcMain.on('management-window-action', async (event, actionData) => {
    const { action, accountId, ...data } = actionData;
    
    try {
      console.log(`[QuickReply IPC] Management window action: ${action} for account: ${accountId}`);
      
      const controller = getController(accountId);
      
      // Initialize controller if not already initialized
      if (!controller._initialized) {
        await controller.initialize();
        controller._initialized = true;
      }
      
      switch (action) {
        case 'selectGroup': {
          // Filter templates by group and send back
          const templates = await controller.templateManager.storage.getAll();
          const filteredTemplates = data.groupId 
            ? templates.filter(t => t.groupId === data.groupId)
            : templates;
          
          event.sender.send('management-window-data', {
            templates: filteredTemplates,
            filteredTemplates
          });
          break;
        }
        
        case 'search': {
          // Search templates
          const results = await controller.searchTemplates(data.keyword || '');
          event.sender.send('management-window-data', {
            templates: results.templates,
            filteredTemplates: results.templates,
            groups: results.groups
          });
          break;
        }
        
        case 'addText': {
          // Create a new text template with default content
          const groups = await controller.groupManager.getAllGroups();
          // Use provided groupId or fall back to first group
          let groupId = data.groupId || (groups.length > 0 ? groups[0].id : null);
          
          if (!groupId) {
            // Create default group if none exists
            const defaultGroup = await controller.groupManager.createGroup('默认分组');
            groupId = defaultGroup.id;
          }
          
          // Use a default placeholder text to pass validation
          const newTemplate = await controller.templateManager.createTemplate(
            groupId,
            'text',
            '新建文本',
            { text: '请编辑此文本内容...' }
          );
          
          // Refresh data
          const allTemplates = await controller.templateManager.storage.getAll();
          const allGroups = await controller.groupManager.getAllGroups();
          event.sender.send('management-window-data', {
            groups: allGroups,
            templates: allTemplates
          });
          
          console.log(`[QuickReply IPC] Created new text template: ${newTemplate.id}`);
          break;
        }
        
        case 'addImage': {
          // Open file dialog to select image
          const { dialog } = require('electron');
          const imageResult = await dialog.showOpenDialog({
            title: '选择图片',
            filters: [
              { name: '图片文件', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp'] }
            ],
            properties: ['openFile']
          });
          
          if (!imageResult.canceled && imageResult.filePaths.length > 0) {
            const groups = await controller.groupManager.getAllGroups();
            let groupId = data.groupId || (groups.length > 0 ? groups[0].id : null);
            
            if (!groupId) {
              const defaultGroup = await controller.groupManager.createGroup('默认分组');
              groupId = defaultGroup.id;
            }
            
            const newTemplate = await controller.templateManager.createTemplate(
              groupId,
              'image',
              '新建图片',
              { mediaPath: imageResult.filePaths[0] }
            );
            
            // Refresh data
            const allTemplates = await controller.templateManager.storage.getAll();
            const allGroups = await controller.groupManager.getAllGroups();
            event.sender.send('management-window-data', {
              groups: allGroups,
              templates: allTemplates
            });
            
            console.log(`[QuickReply IPC] Created new image template: ${newTemplate.id}`);
          }
          break;
        }
        
        case 'addAudio': {
          // Open file dialog to select audio
          const { dialog: audioDialog } = require('electron');
          const audioResult = await audioDialog.showOpenDialog({
            title: '选择音频',
            filters: [
              { name: '音频文件', extensions: ['mp3', 'wav', 'ogg', 'm4a', 'aac'] }
            ],
            properties: ['openFile']
          });
          
          if (!audioResult.canceled && audioResult.filePaths.length > 0) {
            const groups = await controller.groupManager.getAllGroups();
            let groupId = data.groupId || (groups.length > 0 ? groups[0].id : null);
            
            if (!groupId) {
              const defaultGroup = await controller.groupManager.createGroup('默认分组');
              groupId = defaultGroup.id;
            }
            
            const newTemplate = await controller.templateManager.createTemplate(
              groupId,
              'audio',
              '新建音频',
              { mediaPath: audioResult.filePaths[0] }
            );
            
            // Refresh data
            const allTemplates = await controller.templateManager.storage.getAll();
            const allGroups = await controller.groupManager.getAllGroups();
            event.sender.send('management-window-data', {
              groups: allGroups,
              templates: allTemplates
            });
            
            console.log(`[QuickReply IPC] Created new audio template: ${newTemplate.id}`);
          }
          break;
        }
        
        case 'addVideo': {
          // Open file dialog to select video
          const { dialog: videoDialog } = require('electron');
          const videoResult = await videoDialog.showOpenDialog({
            title: '选择视频',
            filters: [
              { name: '视频文件', extensions: ['mp4', 'webm', 'avi', 'mov', 'mkv'] }
            ],
            properties: ['openFile']
          });
          
          if (!videoResult.canceled && videoResult.filePaths.length > 0) {
            const groups = await controller.groupManager.getAllGroups();
            let groupId = data.groupId || (groups.length > 0 ? groups[0].id : null);
            
            if (!groupId) {
              const defaultGroup = await controller.groupManager.createGroup('默认分组');
              groupId = defaultGroup.id;
            }
            
            const newTemplate = await controller.templateManager.createTemplate(
              groupId,
              'video',
              '新建视频',
              { mediaPath: videoResult.filePaths[0] }
            );
            
            // Refresh data
            const allTemplates = await controller.templateManager.storage.getAll();
            const allGroups = await controller.groupManager.getAllGroups();
            event.sender.send('management-window-data', {
              groups: allGroups,
              templates: allTemplates
            });
            
            console.log(`[QuickReply IPC] Created new video template: ${newTemplate.id}`);
          }
          break;
        }
        
        case 'addImageText': {
          // Open file dialog to select image for image+text
          const { dialog: imageTextDialog } = require('electron');
          const imageTextResult = await imageTextDialog.showOpenDialog({
            title: '选择图片（图文模板）',
            filters: [
              { name: '图片文件', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp'] }
            ],
            properties: ['openFile']
          });
          
          if (!imageTextResult.canceled && imageTextResult.filePaths.length > 0) {
            const groups = await controller.groupManager.getAllGroups();
            let groupId = data.groupId || (groups.length > 0 ? groups[0].id : null);
            
            if (!groupId) {
              const defaultGroup = await controller.groupManager.createGroup('默认分组');
              groupId = defaultGroup.id;
            }
            
            const newTemplate = await controller.templateManager.createTemplate(
              groupId,
              'mixed',
              '新建图文',
              { 
                mediaPath: imageTextResult.filePaths[0],
                text: '请编辑图文描述...'
              }
            );
            
            // Refresh data
            const allTemplates = await controller.templateManager.storage.getAll();
            const allGroups = await controller.groupManager.getAllGroups();
            event.sender.send('management-window-data', {
              groups: allGroups,
              templates: allTemplates
            });
            
            console.log(`[QuickReply IPC] Created new image+text template: ${newTemplate.id}`);
          }
          break;
        }
        
        case 'deleteTemplate': {
          // Delete template
          await controller.templateManager.deleteTemplate(data.templateId);
          
          // Refresh data
          const allTemplates = await controller.templateManager.storage.getAll();
          const allGroups = await controller.groupManager.getAllGroups();
          event.sender.send('management-window-data', {
            groups: allGroups,
            templates: allTemplates
          });
          
          console.log(`[QuickReply IPC] Deleted template: ${data.templateId}`);
          break;
        }
        
        case 'import': {
          // TODO: Implement import functionality
          const { dialog } = require('electron');
          const result = await dialog.showOpenDialog({
            title: '导入快捷回复',
            filters: [
              { name: 'JSON Files', extensions: ['json'] }
            ],
            properties: ['openFile']
          });
          
          if (!result.canceled && result.filePaths.length > 0) {
            try {
              const fs = require('fs').promises;
              const content = await fs.readFile(result.filePaths[0], 'utf-8');
              const importData = JSON.parse(content);
              
              // Import templates
              if (importData.templates && Array.isArray(importData.templates)) {
                for (const template of importData.templates) {
                  await controller.templateManager.createTemplate(
                    template.groupId || (await controller.groupManager.getAllGroups())[0]?.id,
                    template.type || 'text',
                    template.label || '导入的模板',
                    template.content || { text: '' }
                  );
                }
              }
              
              // Refresh data
              const allTemplates = await controller.templateManager.storage.getAll();
              const allGroups = await controller.groupManager.getAllGroups();
              event.sender.send('management-window-data', {
                groups: allGroups,
                templates: allTemplates
              });
              
              console.log(`[QuickReply IPC] Imported templates from: ${result.filePaths[0]}`);
            } catch (importError) {
              console.error('[QuickReply IPC] Import error:', importError);
            }
          }
          break;
        }
        
        case 'editTemplate': {
          // Edit template based on type
          const { dialog } = require('electron');
          const template = data.template;
          
          if (!template) {
            console.error('[QuickReply IPC] No template data for edit');
            break;
          }
          
          console.log(`[QuickReply IPC] Editing template: ${template.id}, type: ${template.type}`);
          
          let updates = null;
          
          switch (template.type) {
            case 'text': {
              // Show input dialog for text editing
              const { BrowserWindow } = require('electron');
              const focusedWindow = BrowserWindow.getFocusedWindow();
              
              // Create a simple prompt dialog using a modal window
              const promptWindow = new BrowserWindow({
                width: 500,
                height: 300,
                parent: focusedWindow,
                modal: true,
                show: false,
                resizable: false,
                webPreferences: {
                  nodeIntegration: false,
                  contextIsolation: true
                }
              });
              
              const currentText = template.content?.text || '';
              const promptHTML = `
                <!DOCTYPE html>
                <html>
                <head>
                  <meta charset="UTF-8">
                  <style>
                    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 20px; background: #fff; }
                    h3 { margin-bottom: 15px; color: #333; }
                    textarea { width: 100%; height: 120px; padding: 10px; border: 1px solid #d9d9d9; border-radius: 4px; font-size: 14px; resize: none; }
                    textarea:focus { border-color: #1890ff; outline: none; }
                    .buttons { margin-top: 20px; text-align: right; }
                    button { padding: 8px 20px; margin-left: 10px; border-radius: 4px; cursor: pointer; font-size: 14px; }
                    .cancel { background: #fff; border: 1px solid #d9d9d9; color: #666; }
                    .save { background: #1890ff; border: 1px solid #1890ff; color: #fff; }
                    .cancel:hover { border-color: #40a9ff; color: #40a9ff; }
                    .save:hover { background: #40a9ff; border-color: #40a9ff; }
                  </style>
                </head>
                <body>
                  <h3>编辑文本内容</h3>
                  <textarea id="textInput">${currentText.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</textarea>
                  <div class="buttons">
                    <button class="cancel" onclick="window.close()">取消</button>
                    <button class="save" onclick="save()">保存</button>
                  </div>
                  <script>
                    function save() {
                      const text = document.getElementById('textInput').value;
                      require('electron').ipcRenderer.send('edit-template-result', { text });
                      window.close();
                    }
                  </script>
                </body>
                </html>
              `;
              
              // Use a different approach - show native dialog
              // For simplicity, use a prompt-like approach with showMessageBox
              const { ipcMain: ipcMainLocal } = require('electron');
              
              // For text templates, we'll use a simpler approach with prompt
              // Since Electron doesn't have native prompt, we'll update directly with a default
              const newText = await new Promise((resolve) => {
                const editWindow = new BrowserWindow({
                  width: 500,
                  height: 350,
                  parent: focusedWindow,
                  modal: true,
                  show: false,
                  resizable: false,
                  autoHideMenuBar: true,
                  webPreferences: {
                    nodeIntegration: true,
                    contextIsolation: false
                  }
                });
                
                const editHTML = `
                  <!DOCTYPE html>
                  <html>
                  <head>
                    <meta charset="UTF-8">
                    <style>
                      body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 20px; background: #fff; margin: 0; }
                      h3 { margin-bottom: 15px; color: #333; font-size: 16px; }
                      textarea { width: 100%; height: 150px; padding: 10px; border: 1px solid #d9d9d9; border-radius: 4px; font-size: 14px; resize: none; box-sizing: border-box; }
                      textarea:focus { border-color: #1890ff; outline: none; }
                      .buttons { margin-top: 20px; text-align: right; }
                      button { padding: 8px 24px; margin-left: 10px; border-radius: 4px; cursor: pointer; font-size: 14px; }
                      .cancel { background: #fff; border: 1px solid #d9d9d9; color: #666; }
                      .save { background: #1890ff; border: 1px solid #1890ff; color: #fff; }
                      .cancel:hover { border-color: #40a9ff; color: #40a9ff; }
                      .save:hover { background: #40a9ff; border-color: #40a9ff; }
                    </style>
                  </head>
                  <body>
                    <h3>编辑文本内容</h3>
                    <textarea id="textInput">${currentText.replace(/`/g, '\\`').replace(/\$/g, '\\$')}</textarea>
                    <div class="buttons">
                      <button class="cancel" id="cancelBtn">取消</button>
                      <button class="save" id="saveBtn">保存</button>
                    </div>
                    <script>
                      const { ipcRenderer } = require('electron');
                      document.getElementById('cancelBtn').onclick = () => {
                        ipcRenderer.send('edit-text-result', null);
                        window.close();
                      };
                      document.getElementById('saveBtn').onclick = () => {
                        const text = document.getElementById('textInput').value;
                        ipcRenderer.send('edit-text-result', text);
                        window.close();
                      };
                      document.getElementById('textInput').focus();
                    </script>
                  </body>
                  </html>
                `;
                
                editWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(editHTML)}`);
                editWindow.once('ready-to-show', () => editWindow.show());
                
                const resultHandler = (evt, result) => {
                  ipcMainLocal.removeListener('edit-text-result', resultHandler);
                  resolve(result);
                };
                ipcMainLocal.on('edit-text-result', resultHandler);
                
                editWindow.on('closed', () => {
                  ipcMainLocal.removeListener('edit-text-result', resultHandler);
                  resolve(null);
                });
              });
              
              if (newText !== null && newText.trim().length > 0) {
                updates = { content: { text: newText } };
              }
              break;
            }
            
            case 'image':
            case 'audio':
            case 'video': {
              // Open file dialog to select new media
              const filters = {
                image: [{ name: '图片文件', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp'] }],
                audio: [{ name: '音频文件', extensions: ['mp3', 'wav', 'ogg', 'm4a', 'aac'] }],
                video: [{ name: '视频文件', extensions: ['mp4', 'webm', 'avi', 'mov', 'mkv'] }]
              };
              
              const titles = {
                image: '选择新图片',
                audio: '选择新音频',
                video: '选择新视频'
              };
              
              const mediaResult = await dialog.showOpenDialog({
                title: titles[template.type],
                filters: filters[template.type],
                properties: ['openFile']
              });
              
              if (!mediaResult.canceled && mediaResult.filePaths.length > 0) {
                updates = { content: { mediaPath: mediaResult.filePaths[0] } };
              }
              break;
            }
            
            case 'mixed': {
              // For mixed (image+text), show dialog to edit both
              const { BrowserWindow } = require('electron');
              const focusedWindow = BrowserWindow.getFocusedWindow();
              
              const currentMixedText = template.content?.text || '';
              const currentMediaPath = template.content?.mediaPath || '';
              
              const mixedResult = await new Promise((resolve) => {
                const { ipcMain: ipcMainLocal } = require('electron');
                
                const editWindow = new BrowserWindow({
                  width: 550,
                  height: 450,
                  parent: focusedWindow,
                  modal: true,
                  show: false,
                  resizable: false,
                  autoHideMenuBar: true,
                  webPreferences: {
                    nodeIntegration: true,
                    contextIsolation: false
                  }
                });
                
                const editHTML = `
                  <!DOCTYPE html>
                  <html>
                  <head>
                    <meta charset="UTF-8">
                    <style>
                      body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 20px; background: #fff; margin: 0; }
                      h3 { margin-bottom: 15px; color: #333; font-size: 16px; }
                      label { display: block; margin-bottom: 8px; color: #666; font-size: 14px; }
                      textarea { width: 100%; height: 100px; padding: 10px; border: 1px solid #d9d9d9; border-radius: 4px; font-size: 14px; resize: none; box-sizing: border-box; }
                      textarea:focus { border-color: #1890ff; outline: none; }
                      .field { margin-bottom: 20px; }
                      .media-field { display: flex; align-items: center; gap: 10px; }
                      .media-path { flex: 1; padding: 8px 10px; border: 1px solid #d9d9d9; border-radius: 4px; font-size: 13px; color: #666; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
                      .browse-btn { padding: 8px 16px; background: #fff; border: 1px solid #1890ff; color: #1890ff; border-radius: 4px; cursor: pointer; font-size: 14px; }
                      .browse-btn:hover { background: #e6f7ff; }
                      .buttons { margin-top: 20px; text-align: right; }
                      button { padding: 8px 24px; margin-left: 10px; border-radius: 4px; cursor: pointer; font-size: 14px; }
                      .cancel { background: #fff; border: 1px solid #d9d9d9; color: #666; }
                      .save { background: #1890ff; border: 1px solid #1890ff; color: #fff; }
                    </style>
                  </head>
                  <body>
                    <h3>编辑图文内容</h3>
                    <div class="field">
                      <label>图片路径</label>
                      <div class="media-field">
                        <span class="media-path" id="mediaPath">${currentMediaPath.replace(/`/g, '\\`')}</span>
                        <button class="browse-btn" id="browseBtn">浏览...</button>
                      </div>
                    </div>
                    <div class="field">
                      <label>文本内容</label>
                      <textarea id="textInput">${currentMixedText.replace(/`/g, '\\`').replace(/\$/g, '\\$')}</textarea>
                    </div>
                    <div class="buttons">
                      <button class="cancel" id="cancelBtn">取消</button>
                      <button class="save" id="saveBtn">保存</button>
                    </div>
                    <script>
                      const { ipcRenderer } = require('electron');
                      let mediaPath = '${currentMediaPath.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}';
                      
                      document.getElementById('browseBtn').onclick = () => {
                        ipcRenderer.send('browse-image-request');
                      };
                      
                      ipcRenderer.on('browse-image-result', (evt, path) => {
                        if (path) {
                          mediaPath = path;
                          document.getElementById('mediaPath').textContent = path;
                        }
                      });
                      
                      document.getElementById('cancelBtn').onclick = () => {
                        ipcRenderer.send('edit-mixed-result', null);
                        window.close();
                      };
                      
                      document.getElementById('saveBtn').onclick = () => {
                        const text = document.getElementById('textInput').value;
                        ipcRenderer.send('edit-mixed-result', { text, mediaPath });
                        window.close();
                      };
                    </script>
                  </body>
                  </html>
                `;
                
                editWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(editHTML)}`);
                editWindow.once('ready-to-show', () => editWindow.show());
                
                // Handle browse image request
                const browseHandler = async () => {
                  const browseResult = await dialog.showOpenDialog(editWindow, {
                    title: '选择图片',
                    filters: [{ name: '图片文件', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp'] }],
                    properties: ['openFile']
                  });
                  
                  if (!browseResult.canceled && browseResult.filePaths.length > 0) {
                    editWindow.webContents.send('browse-image-result', browseResult.filePaths[0]);
                  }
                };
                ipcMainLocal.on('browse-image-request', browseHandler);
                
                const resultHandler = (evt, result) => {
                  ipcMainLocal.removeListener('edit-mixed-result', resultHandler);
                  ipcMainLocal.removeListener('browse-image-request', browseHandler);
                  resolve(result);
                };
                ipcMainLocal.on('edit-mixed-result', resultHandler);
                
                editWindow.on('closed', () => {
                  ipcMainLocal.removeListener('edit-mixed-result', resultHandler);
                  ipcMainLocal.removeListener('browse-image-request', browseHandler);
                  resolve(null);
                });
              });
              
              if (mixedResult && mixedResult.text && mixedResult.text.trim().length > 0 && mixedResult.mediaPath) {
                updates = { content: { text: mixedResult.text, mediaPath: mixedResult.mediaPath } };
              }
              break;
            }
            
            default:
              console.warn(`[QuickReply IPC] Unknown template type for edit: ${template.type}`);
          }
          
          // Apply updates if any
          if (updates) {
            await controller.templateManager.updateTemplate(template.id, updates);
            
            // Refresh data
            const allTemplates = await controller.templateManager.storage.getAll();
            const allGroups = await controller.groupManager.getAllGroups();
            event.sender.send('management-window-data', {
              groups: allGroups,
              templates: allTemplates
            });
            
            console.log(`[QuickReply IPC] Template updated: ${template.id}`);
          }
          break;
        }
        
        case 'export': {
          // Export templates
          const { dialog } = require('electron');
          const result = await dialog.showSaveDialog({
            title: '导出快捷回复',
            defaultPath: 'quick-replies.json',
            filters: [
              { name: 'JSON Files', extensions: ['json'] }
            ]
          });
          
          if (!result.canceled && result.filePath) {
            try {
              const fs = require('fs').promises;
              const templates = await controller.templateManager.storage.getAll();
              const groups = await controller.groupManager.getAllGroups();
              
              const exportData = {
                version: '1.0',
                exportedAt: new Date().toISOString(),
                groups,
                templates
              };
              
              await fs.writeFile(result.filePath, JSON.stringify(exportData, null, 2), 'utf-8');
              console.log(`[QuickReply IPC] Exported templates to: ${result.filePath}`);
            } catch (exportError) {
              console.error('[QuickReply IPC] Export error:', exportError);
            }
          }
          break;
        }
        
        case 'addGroup': {
          // Add new group
          const newGroup = await controller.groupManager.createGroup('新分组');
          
          // Refresh data
          const allTemplates = await controller.templateManager.storage.getAll();
          const allGroups = await controller.groupManager.getAllGroups();
          event.sender.send('management-window-data', {
            groups: allGroups,
            templates: allTemplates
          });
          
          console.log(`[QuickReply IPC] Created new group: ${newGroup.id}`);
          break;
        }
        
        case 'renameGroup': {
          // Rename group
          if (data.groupId && data.newName) {
            await controller.groupManager.updateGroup(data.groupId, { name: data.newName });
            
            // Refresh data
            const allTemplates = await controller.templateManager.storage.getAll();
            const allGroups = await controller.groupManager.getAllGroups();
            event.sender.send('management-window-data', {
              groups: allGroups,
              templates: allTemplates
            });
            
            console.log(`[QuickReply IPC] Renamed group: ${data.groupId} to ${data.newName}`);
          }
          break;
        }
        
        case 'deleteGroup': {
          // Delete group
          if (data.groupId) {
            await controller.groupManager.deleteGroup(data.groupId);
            
            // Refresh data
            const allTemplates = await controller.templateManager.storage.getAll();
            const allGroups = await controller.groupManager.getAllGroups();
            event.sender.send('management-window-data', {
              groups: allGroups,
              templates: allTemplates
            });
            
            console.log(`[QuickReply IPC] Deleted group: ${data.groupId}`);
          }
          break;
        }
        
        case 'moveTemplate': {
          // Move template to another group
          if (data.templateId && data.targetGroupId) {
            await controller.templateManager.moveTemplate(data.templateId, data.targetGroupId);
            
            // Refresh data
            const allTemplates = await controller.templateManager.storage.getAll();
            const allGroups = await controller.groupManager.getAllGroups();
            event.sender.send('management-window-data', {
              groups: allGroups,
              templates: allTemplates
            });
            
            console.log(`[QuickReply IPC] Moved template ${data.templateId} to group ${data.targetGroupId}`);
          }
          break;
        }
        
        case 'updateText': {
          // Update text content directly (inline editing)
          if (data.templateId && data.text !== undefined) {
            // Get existing template to preserve other content fields
            const existing = await controller.templateManager.getTemplate(data.templateId);
            if (existing) {
              const updatedContent = { ...existing.content, text: data.text };
              await controller.templateManager.updateTemplate(data.templateId, {
                content: updatedContent
              });
              console.log(`[QuickReply IPC] Updated text for template: ${data.templateId}`);
            }
          }
          break;
        }
        
        case 'changeMedia': {
          // Change media file for image/video/audio templates
          const { dialog } = require('electron');
          const mediaType = data.mediaType;
          
          const filters = {
            image: [{ name: '图片文件', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp'] }],
            video: [{ name: '视频文件', extensions: ['mp4', 'webm', 'avi', 'mov', 'mkv'] }],
            audio: [{ name: '音频文件', extensions: ['mp3', 'wav', 'ogg', 'm4a', 'aac'] }]
          };
          
          const titles = {
            image: '选择新图片',
            video: '选择新视频',
            audio: '选择新音频'
          };
          
          const result = await dialog.showOpenDialog({
            title: titles[mediaType] || '选择文件',
            filters: filters[mediaType] || [],
            properties: ['openFile']
          });
          
          if (!result.canceled && result.filePaths.length > 0) {
            // Get existing template to preserve text content
            const existing = await controller.templateManager.getTemplate(data.templateId);
            if (existing) {
              const updatedContent = { ...existing.content, mediaPath: result.filePaths[0] };
              await controller.templateManager.updateTemplate(data.templateId, {
                content: updatedContent
              });
              
              // Refresh data
              const allTemplates = await controller.templateManager.storage.getAll();
              const allGroups = await controller.groupManager.getAllGroups();
              event.sender.send('management-window-data', {
                groups: allGroups,
                templates: allTemplates
              });
              
              console.log(`[QuickReply IPC] Changed media for template: ${data.templateId}`);
            }
          }
          break;
        }
        
        default:
          console.warn(`[QuickReply IPC] Unknown management window action: ${action}`);
      }
    } catch (error) {
      console.error(`[QuickReply IPC] Management window action error (${action}):`, error);
    }
  });

  console.log('[QuickReply IPC] Handlers registered (11 channels + management window handlers)');
}

/**
 * Unregister quick reply IPC handlers
 */
function unregisterQuickReplyHandlers() {
  console.log('[QuickReply IPC] Unregistering handlers...');
  
  // Remove handle-based handlers
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
  
  // Remove on-based handlers for management window
  ipcMain.removeAllListeners('management-window-ready');
  ipcMain.removeAllListeners('management-window-action');
  
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
