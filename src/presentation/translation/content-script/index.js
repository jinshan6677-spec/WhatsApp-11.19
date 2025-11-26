/**
 * Content Script Entry Point
 * Integrates all modular components and maintains backward compatibility
 */

(function () {
  'use strict';

  console.log('[Translation] Content script initializing...');

  // Import modules (in browser context, these are loaded via script tags)
  // For now, we'll include them inline since this is a browser script

  // Main translation system object
  const WhatsAppTranslation = {
    // Core components
    core: null,
    ui: null,
    messageTranslator: null,
    inputBoxTranslator: null,
    domObserver: null,

    // Legacy properties for backward compatibility
    config: null,
    initialized: false,
    accountId: 'default',

    /**
     * Deep merge two configuration objects
     * Arrays are replaced (not merged), nested objects are recursively merged
     * @param {Object} target - Target object to merge into
     * @param {Object} source - Source object to merge from
     * @returns {Object} Merged object
     */
    deepMerge(target, source) {
      // Handle null/undefined cases
      if (!source) return target ? { ...target } : {};
      if (!target) return { ...source };

      const result = { ...target };

      for (const key in source) {
        if (Object.prototype.hasOwnProperty.call(source, key)) {
          const sourceValue = source[key];
          const targetValue = result[key];

          // If source value is an array, replace directly (don't merge arrays)
          if (Array.isArray(sourceValue)) {
            result[key] = [...sourceValue];
          }
          // If source value is an object (not null, not array), recursively merge
          else if (sourceValue !== null && typeof sourceValue === 'object' && !Array.isArray(sourceValue)) {
            if (targetValue !== null && typeof targetValue === 'object' && !Array.isArray(targetValue)) {
              result[key] = this.deepMerge(targetValue, sourceValue);
            } else {
              result[key] = this.deepMerge({}, sourceValue);
            }
          }
          // For primitives (string, number, boolean, null, undefined), replace directly
          else {
            result[key] = sourceValue;
          }
        }
      }

      return result;
    },

    /**
     * Update configuration
     * Merges new config with existing config, saves to backend, and applies changes
     * @param {Object} newConfig - New configuration object to merge
     * @returns {Promise<Object>} Result object with success status
     */
    async updateConfig(newConfig) {
      try {
        console.log('[Translation] Updating config:', newConfig);

        // Get current config or default
        const currentConfig = this.core?.config || this.core?.getDefaultConfig() || this.config || {};

        // Deep merge new config with current config
        const mergedConfig = this.deepMerge(currentConfig, newConfig);

        // Update internal config references
        if (this.core) {
          this.core.config = mergedConfig;
        }
        this.config = mergedConfig;

        // Save to backend via IPC
        if (window.translationAPI && window.translationAPI.saveConfig) {
          const accountId = this.accountId || this.core?.accountId || 'default';
          const response = await window.translationAPI.saveConfig(accountId, mergedConfig);

          if (response && response.success) {
            console.log('[Translation] ✓ Config updated and saved');
            // Apply config changes to all modules
            this.applyConfigChanges();
            return { success: true };
          } else {
            const errorMsg = response?.error || 'Unknown error saving config';
            console.error('[Translation] Failed to save config:', errorMsg);
            // Still apply changes locally even if save failed
            this.applyConfigChanges();
            return { success: false, error: errorMsg };
          }
        } else {
          console.warn('[Translation] translationAPI not available, applying changes locally only');
          // Apply changes locally even without backend
          this.applyConfigChanges();
          return { success: true, warning: 'translationAPI not available, changes applied locally only' };
        }
      } catch (error) {
        console.error('[Translation] Error updating config:', error);
        return { success: false, error: error.message };
      }
    },

    /**
     * Apply configuration changes to all modules
     * Reinitializes components that depend on configuration
     */
    applyConfigChanges() {
      console.log('[Translation] Applying config changes...');

      try {
        // Reinitialize input box translator
        if (this.inputBoxTranslator) {
          console.log('[Translation] Reinitializing input box translator...');
          this.inputBoxTranslator.cleanup();
          this.inputBoxTranslator.initInputBoxTranslation();
        }

        // Reinitialize Chinese block handler
        if (this.domObserver) {
          console.log('[Translation] Reinitializing Chinese block handler...');
          this.domObserver.setupChineseBlock();
        }

        // If auto translate is enabled, translate existing messages
        const config = this.config || this.core?.config;
        if (config?.global?.autoTranslate && this.messageTranslator) {
          console.log('[Translation] Auto translate enabled, translating existing messages...');
          this.messageTranslator.translateExistingMessages();
        }

        console.log('[Translation] ✓ Config changes applied');
      } catch (error) {
        console.error('[Translation] Error applying config changes:', error);
      }
    },

    /**
     * Setup configuration change listener
     * Listens for config changes from IPC and applies them
     * _Requirements: 8.4_
     */
    setupConfigListener() {
      if (window.translationAPI && window.translationAPI.onConfigChanged) {
        window.translationAPI.onConfigChanged((newConfig) => {
          console.log('[Translation] Config changed via IPC, reloading...', newConfig);
          
          // Update internal config references
          if (this.core) {
            this.core.config = newConfig;
          }
          this.config = newConfig;
          
          // Apply the configuration changes to all modules
          this.applyConfigChanges();
        });
        console.log('[Translation] ✓ Config change listener set up');
      } else {
        console.warn('[Translation] translationAPI.onConfigChanged not available, config listener not set up');
      }
    },

    /**
     * Initialize translation system
     */
    async init() {
      if (this.initialized) {
        console.log('[Translation] Already initialized');
        return;
      }

      try {
        // Initialize core
        this.core = new ContentScriptCore();
        await this.core.init();

        // Initialize UI
        this.ui = new TranslationUI(this.core);
        this.ui.injectStyles();

        // Initialize message translator
        this.messageTranslator = new MessageTranslator(this.core, this.ui);

        // Initialize input box translator
        this.inputBoxTranslator = new InputBoxTranslator(this.core, this.ui);

        // Initialize DOM observer
        this.domObserver = new DOMObserver(this.core, this.messageTranslator, this.inputBoxTranslator);

        // Start observing
        this.domObserver.observeMessages();
        this.domObserver.observeChatSwitch();

        // Setup input box
        this.inputBoxTranslator.initInputBoxTranslation();

        // Setup Chinese block
        this.domObserver.setupChineseBlock();

        // Start periodic check
        this.messageTranslator.startPeriodicCheck();

        // Expose config for backward compatibility
        this.config = this.core.config;
        this.initialized = true;

        // Setup config change listener after all modules are initialized
        // _Requirements: 8.4_
        this.setupConfigListener();

        console.log('[Translation] Initialized successfully');

      } catch (error) {
        console.error('[Translation] Initialization failed:', error);
      }
    },

    /**
     * Translate existing messages (exposed for backward compatibility)
     */
    translateExistingMessages() {
      if (this.messageTranslator) {
        this.messageTranslator.translateExistingMessages();
      }
    },

    /**
     * Get current contact ID (exposed for backward compatibility)
     */
    getCurrentContactId() {
      if (this.core) {
        return this.core.getCurrentContactId();
      }
      return null;
    },

    /**
     * Cleanup resources
     */
    cleanup() {
      if (this.domObserver) {
        this.domObserver.cleanup();
      }
      if (this.inputBoxTranslator) {
        this.inputBoxTranslator.cleanup();
      }
      if (this.ui) {
        this.ui.cleanup();
      }
      if (this.core) {
        this.core.cleanup();
      }

      this.initialized = false;
      console.log('[Translation] Cleaned up');
    }
  };

  // Initialize
  WhatsAppTranslation.init();

  // Expose to global (for debugging and manual triggering)
  window.WhatsAppTranslation = WhatsAppTranslation;

  // Add global shortcut functions
  window.translateCurrentChat = function () {
    console.log('[Translation] Manually translating current chat...');
    WhatsAppTranslation.translateExistingMessages();
  };

  // Listen for click events (when clicking chat list)
  document.addEventListener('click', function (e) {
    // Check if clicked on chat list item
    const chatItem = e.target.closest('[data-testid="cell-frame-container"]') ||
      e.target.closest('._ak8l') ||
      e.target.closest('[role="listitem"]');

    if (chatItem) {
      console.log('[Translation] Chat item clicked, will translate after delay');
      // Delay translation, wait for chat to load
      setTimeout(() => {
        WhatsAppTranslation.translateExistingMessages();
      }, 1000);
    }
  }, true);

  console.log('[Translation] Global functions exposed: window.translateCurrentChat()');

})();
