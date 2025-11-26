/**
 * ContentScriptCore - Core initialization and configuration management
 * Handles initialization, configuration loading, and lifecycle management
 */

class ContentScriptCore {
  constructor() {
    this.config = null;
    this.initialized = false;
    this.accountId = 'default';
    this._lastContactId = null;
    this._lastLogTime = {};
  }

  /**
   * Initialize the translation system
   */
  async init() {
    if (this.initialized) {
      console.log('[Translation] Already initialized');
      return;
    }

    try {
      // Wait for WhatsApp Web to load
      await this.waitForWhatsApp();
      console.log('[Translation] WhatsApp Web loaded');

      // Load configuration
      await this.loadConfig();
      console.log('[Translation] Config loaded:', this.config);

      this.initialized = true;
      console.log('[Translation] Core initialized successfully');

    } catch (error) {
      console.error('[Translation] Initialization failed:', error);
    }
  }

  /**
   * Wait for WhatsApp Web to load
   */
  waitForWhatsApp() {
    return new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        // Check if chat container exists
        const chatContainer = document.querySelector('[data-testid="conversation-panel-messages"]') ||
          document.querySelector('#main') ||
          document.querySelector('[role="application"]');

        if (chatContainer) {
          clearInterval(checkInterval);
          // Wait an extra second to ensure full load
          setTimeout(resolve, 1000);
        }
      }, 500);

      // Timeout protection
      setTimeout(() => {
        clearInterval(checkInterval);
        resolve();
      }, 30000); // 30 second timeout
    });
  }

  /**
   * Load configuration
   */
  async loadConfig() {
    try {
      if (window.translationAPI) {
        const response = await window.translationAPI.getConfig(this.accountId);
        
        // The IPC handler returns the config directly (not wrapped in { success, data })
        // because ipcMain.handle returns response.data
        if (response) {
          // Check if response is the config object itself or wrapped
          if (response.success !== undefined) {
            // Wrapped response: { success: true, data: config }
            this.config = response.data || response.config || this.getDefaultConfig();
          } else if (response.global || response.inputBox || response.advanced) {
            // Direct config object
            this.config = response;
          } else {
            console.warn('[Translation] Unexpected config format:', response);
            this.config = this.getDefaultConfig();
          }
        } else {
          console.error('[Translation] Empty config response');
          this.config = this.getDefaultConfig();
        }
      } else {
        console.warn('[Translation] translationAPI not available, using default config');
        this.config = this.getDefaultConfig();
      }
    } catch (error) {
      console.error('[Translation] Error loading config:', error);
      this.config = this.getDefaultConfig();
    }
  }

  /**
   * Get default configuration
   */
  getDefaultConfig() {
    return {
      global: {
        autoTranslate: false,
        engine: 'google',
        sourceLang: 'auto',
        targetLang: 'zh-CN',
        groupTranslation: false
      },
      inputBox: {
        enabled: false,
        engine: 'google',
        style: '通用',
        targetLang: 'auto'
      },
      advanced: {
        friendIndependent: false,
        blockChinese: false,
        realtime: false,
        reverseTranslation: false,
        voiceTranslation: false,
        imageTranslation: false
      },
      friendConfigs: {}
    };
  }

  /**
   * Get current contact ID
   */
  getCurrentContactId() {
    try {
      // Method 1: Get from URL hash (WhatsApp Web uses hash-based routing)
      const hash = window.location.hash;
      if (hash) {
        // Format: #/chat/1234567890@c.us or similar
        const hashMatch = hash.match(/\/chat\/([^/]+)/);
        if (hashMatch && hashMatch[1]) {
          const contactId = decodeURIComponent(hashMatch[1]);
          if (this._lastContactId !== contactId) {
            console.log('[Translation] Contact ID from hash:', contactId);
            this._lastContactId = contactId;
          }
          return contactId;
        }
      }

      // Method 2: Get from URL path
      const urlMatch = window.location.href.match(/\/chat\/([^/]+)/);
      if (urlMatch && urlMatch[1]) {
        const contactId = decodeURIComponent(urlMatch[1]);
        if (this._lastContactId !== contactId) {
          console.log('[Translation] Contact ID from URL:', contactId);
          this._lastContactId = contactId;
        }
        return contactId;
      }

      // Method 3: Get from chat header - try multiple selectors
      const headerSelectors = [
        // Primary: conversation info header with title
        '#main header [data-testid="conversation-info-header-chat-title"]',
        '#main header [data-testid="conversation-title"]',
        // Secondary: header span with contact name
        '#main header span[title]',
        '#main header span[dir="auto"][title]',
        // Tertiary: any span in header area
        '#main header ._amig span[dir="auto"]',
        '#main header ._amie span[dir="auto"]',
        '#main [data-testid="conversation-header"] span[dir="auto"]',
        // Fallback: conversation info header
        '#main header [data-testid="conversation-info-header"]',
        '#main header span[dir="auto"]'
      ];

      for (const selector of headerSelectors) {
        const element = document.querySelector(selector);
        if (element) {
          // Try to get title attribute first (more reliable)
          let contactName = element.getAttribute('title');
          if (!contactName) {
            contactName = element.textContent?.trim();
          }
          
          if (contactName && contactName.length > 0) {
            if (this._lastContactId !== contactName) {
              console.log('[Translation] Contact ID from header (' + selector + '):', contactName);
              this._lastContactId = contactName;
            }
            return contactName;
          }
        }
      }

      // Method 4: Get from active chat in chat list
      const activeChatSelectors = [
        '[data-testid="cell-frame-container"][aria-selected="true"] span[title]',
        '._ak8l[aria-selected="true"] span[title]',
        '[role="listitem"][aria-selected="true"] span[title]'
      ];

      for (const selector of activeChatSelectors) {
        const element = document.querySelector(selector);
        if (element) {
          const contactName = element.getAttribute('title') || element.textContent?.trim();
          if (contactName && contactName.length > 0) {
            if (this._lastContactId !== contactName) {
              console.log('[Translation] Contact ID from active chat:', contactName);
              this._lastContactId = contactName;
            }
            return contactName;
          }
        }
      }

      // Method 5: Check if #main exists (chat is open)
      const mainPanel = document.querySelector('#main');
      if (!mainPanel) {
        // No chat is open
        if (this._lastContactId !== null) {
          console.log('[Translation] No chat open, clearing contact ID');
          this._lastContactId = null;
        }
        return null;
      }

      // Chat panel exists but couldn't find contact name
      // Try one more approach: look for any visible contact name in header
      const headerArea = document.querySelector('#main header');
      if (headerArea) {
        const spans = headerArea.querySelectorAll('span[dir="auto"]');
        for (const span of spans) {
          const text = span.textContent?.trim();
          // Filter out common UI text
          if (text && text.length > 0 && 
              !text.includes('点击') && 
              !text.includes('click') &&
              !text.includes('在线') &&
              !text.includes('online') &&
              !text.includes('离线') &&
              !text.includes('offline') &&
              !text.includes('正在输入') &&
              !text.includes('typing')) {
            if (this._lastContactId !== text) {
              console.log('[Translation] Contact ID from header span:', text);
              this._lastContactId = text;
            }
            return text;
          }
        }
      }

      if (this._lastContactId !== null) {
        console.warn('[Translation] Could not determine contact ID');
        this._lastContactId = null;
      }
      return null;
    } catch (error) {
      console.error('[Translation] Error getting contact ID:', error);
      return null;
    }
  }

  /**
   * Get contact configuration (prioritize independent config)
   */
  getContactConfig(contactId) {
    console.log('[Translation] getContactConfig called with contactId:', contactId);
    console.log('[Translation] friendIndependent enabled:', this.config.advanced.friendIndependent);
    console.log('[Translation] friendConfigs:', this.config.friendConfigs);

    // If friend independent config is not enabled, return global config
    if (!this.config.advanced.friendIndependent) {
      console.log('[Translation] Friend independent config is disabled, using global config');
      return this.config.global;
    }

    // Check if there's an independent config for this contact
    if (contactId && this.config.friendConfigs && this.config.friendConfigs[contactId]) {
      const friendConfig = this.config.friendConfigs[contactId];
      console.log('[Translation] Found friend config for', contactId, ':', friendConfig);

      if (friendConfig.enabled) {
        const mergedConfig = {
          ...this.config.global,
          targetLang: friendConfig.targetLang || this.config.global.targetLang,
          blockChinese: friendConfig.blockChinese !== undefined ? friendConfig.blockChinese : this.config.advanced.blockChinese
        };
        console.log('[Translation] ✓ Using friend-specific config:', mergedConfig);
        return mergedConfig;
      } else {
        console.log('[Translation] Friend config exists but is disabled');
      }
    } else {
      console.log('[Translation] No friend config found for:', contactId);
    }

    // Return global config
    console.log('[Translation] Using global config');
    return this.config.global;
  }

  /**
   * Check if it's a group chat
   */
  isGroupChat() {
    const header = document.querySelector('[data-testid="conversation-info-header"]');
    if (!header) return false;

    const groupIcon = header.querySelector('[data-icon="default-group"]') ||
      header.querySelector('[data-icon="group"]');

    return !!groupIcon;
  }

  /**
   * Check if text contains Chinese
   */
  containsChinese(text) {
    return /[\u4e00-\u9fa5]/.test(text);
  }

  /**
   * Check if text is primarily Chinese
   */
  isChinese(text) {
    // Check for Japanese kana
    const hasHiragana = /[\u3040-\u309f]/.test(text);
    const hasKatakana = /[\u30a0-\u30ff]/.test(text);

    if (hasHiragana || hasKatakana) {
      return false;
    }

    // Check for Korean
    const hasKorean = /[\uac00-\ud7af]/.test(text);
    if (hasKorean) {
      return false;
    }

    // Count Chinese characters
    const chineseChars = text.match(/[\u4e00-\u9fa5]/g);
    const chineseCount = chineseChars ? chineseChars.length : 0;

    // If Chinese characters exceed 50%, consider it Chinese
    const totalChars = text.replace(/\s/g, '').length;
    const chineseRatio = totalChars > 0 ? chineseCount / totalChars : 0;

    return chineseRatio > 0.5;
  }

  /**
   * Calculate similarity between two texts (for reverse translation validation)
   */
  calculateSimilarity(text1, text2) {
    // Normalize text
    const normalize = (text) => {
      return text.toLowerCase()
        .replace(/[^\w\s\u4e00-\u9fa5]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
    };

    const s1 = normalize(text1);
    const s2 = normalize(text2);

    if (s1 === s2) return 1.0;

    // Calculate Levenshtein distance
    const len1 = s1.length;
    const len2 = s2.length;

    if (len1 === 0) return len2 === 0 ? 1.0 : 0.0;
    if (len2 === 0) return 0.0;

    const matrix = [];

    // Initialize matrix
    for (let i = 0; i <= len1; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= len2; j++) {
      matrix[0][j] = j;
    }

    // Fill matrix
    for (let i = 1; i <= len1; i++) {
      for (let j = 1; j <= len2; j++) {
        const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,      // deletion
          matrix[i][j - 1] + 1,      // insertion
          matrix[i - 1][j - 1] + cost // substitution
        );
      }
    }

    const distance = matrix[len1][len2];
    const maxLen = Math.max(len1, len2);

    // Return similarity (0-1)
    return 1 - (distance / maxLen);
  }

  /**
   * Decode HTML entities in browser
   */
  decodeHTMLEntitiesInBrowser(text) {
    if (!text) return text;

    const textarea = document.createElement('textarea');
    let decoded = text;
    let prevDecoded;
    let iterations = 0;

    // Decode multiple times to handle double encoding
    do {
      prevDecoded = decoded;
      textarea.innerHTML = decoded;
      decoded = textarea.value;
      iterations++;
    } while (decoded !== prevDecoded && iterations < 3);

    return decoded;
  }

  /**
   * Escape HTML
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Cleanup resources
   */
  cleanup() {
    this.initialized = false;
    this._lastContactId = null;
    this._lastLogTime = {};
    console.log('[Translation] Core cleaned up');
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ContentScriptCore;
}
