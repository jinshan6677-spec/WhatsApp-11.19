/**
 * Preload script for BrowserView (WhatsApp Web)
 * 
 * This script runs in the BrowserView context and injects the modular translation system
 * Injects modules in correct order to maintain dependencies
 */

const { contextBridge, ipcRenderer } = require('electron');
const fs = require('fs');
const path = require('path');

console.log('[Preload-View] Starting preload script for BrowserView');

// Get account ID from additional arguments or environment
const accountArg = (process.argv || []).find(a => typeof a === 'string' && a.startsWith('--account-id='));
const accountId = accountArg ? (accountArg.split('=')[1] || 'unknown') : (process.env.ACCOUNT_ID || 'unknown');
console.log('[Preload-View] Account ID:', accountId);

// Inject account ID into page
window.ACCOUNT_ID = accountId;

// Fingerprint injection
try {
  const fpArg = (process.argv || []).find(a => typeof a === 'string' && a.startsWith('--fp-config='));
  let fpConfig = null;
  if (fpArg) {
    const encoded = fpArg.split('=')[1] || '';
    if (encoded) {
      fpConfig = JSON.parse(Buffer.from(encoded, 'base64').toString('utf8'));
    }
  }
  const injectFingerprint = async (config) => {
    if (!config) return;
    try {
      const { FingerprintInjector } = require('./infrastructure/fingerprint');
      const { webFrame } = require('electron');
      const injector = new FingerprintInjector(config, {
        minify: true,
        includeWorkerInterceptor: true,
        includeIframeProtection: true,
        strictMode: true
      });
      const essentialModules = ['navigator','webgl','canvas','fonts','clientRects','timezone','geolocation','mediaDevices','webrtc','screen'];
      const injectionScript = injector.getInjectionScript({ minify: true, includeWorkerInterceptor: false, include: essentialModules });
      await webFrame.executeJavaScript(injectionScript, true);
      console.log('[Preload-View] ✓ Fingerprint injected at preload');
    } catch (e) {
      console.error('[Preload-View] ✗ Fingerprint preload injection failed:', e);
    }
  };
  if (fpConfig) {
    injectFingerprint(fpConfig);
  } else {
    ipcRenderer.invoke('fingerprint:get', accountId).then(res => {
      if (res && res.success && res.config) {
        injectFingerprint(res.config);
      }
    }).catch(() => {});
  }
} catch (e) {
  console.error('[Preload-View] ✗ Fingerprint setup error:', e);
}

// Expose translation API to the page
// Note: The IPCRouter expects payload as a single object, so we wrap parameters accordingly
contextBridge.exposeInMainWorld('translationAPI', {
  translate: (request) => ipcRenderer.invoke('translation:translate', request),
  detectLanguage: (text) => ipcRenderer.invoke('translation:detectLanguage', text),
  getConfig: (accountId) => ipcRenderer.invoke('translation:getConfig', accountId),
  // saveConfig expects { accountId, config } as payload
  saveConfig: (accountId, config) => ipcRenderer.invoke('translation:saveConfig', { accountId, config }),
  getStats: () => ipcRenderer.invoke('translation:getStats'),
  clearCache: (accountId = null) => ipcRenderer.invoke('translation:clearCache', accountId),
  // saveEngineConfig expects { engineName, config } as payload
  saveEngineConfig: (engineName, config) => ipcRenderer.invoke('translation:saveEngineConfig', { engineName, config }),
  getEngineConfig: (engineName) => ipcRenderer.invoke('translation:getEngineConfig', engineName),
  
  // 配置变更监听
  onConfigChanged: (callback) => {
    ipcRenderer.on('translation:configChanged', (_, config) => callback(config));
  }
});

console.log('[Preload-View] Translation API exposed');

/**
 * Inject a script file into the page
 * @param {string} scriptPath - Path to the script file
 * @param {string} scriptId - ID for the script element
 * @returns {Promise<void>}
 */
function injectScript(scriptPath, scriptId) {
  return new Promise((resolve, reject) => {
    try {
      const scriptContent = fs.readFileSync(scriptPath, 'utf8');
      const script = document.createElement('script');
      script.textContent = scriptContent;
      script.id = scriptId;
      (document.head || document.documentElement).appendChild(script);
      console.log(`[Preload-View] ✓ Injected: ${scriptId}`);
      resolve();
    } catch (error) {
      console.error(`[Preload-View] ✗ Failed to inject ${scriptId}:`, error);
      reject(error);
    }
  });
}

// Load and inject translation scripts when DOM is ready
window.addEventListener('DOMContentLoaded', async () => {
  console.log('[Preload-View] DOMContentLoaded, injecting modular translation scripts');
  
  try {
    // Define module paths in dependency order
    // Using new framework location: src/presentation/translation/content-script/
    const modulesDir = path.join(__dirname, 'presentation/translation/content-script');
    
    const modules = [
      { file: 'ContentScriptCore.js', id: 'translation-core' },
      { file: 'TranslationUI.js', id: 'translation-ui' },
      { file: 'MessageTranslator.js', id: 'translation-message' },
      { file: 'InputBoxTranslator.js', id: 'translation-inputbox' },
      { file: 'DOMObserver.js', id: 'translation-observer' },
      { file: 'index.js', id: 'translation-main' }
    ];

    console.log(`[Preload-View] Injecting ${modules.length} translation modules...`);

    // Inject modules in order
    for (const module of modules) {
      const modulePath = path.join(modulesDir, module.file);
      await injectScript(modulePath, module.id);
    }

    console.log('[Preload-View] ✓ All translation modules injected');

    // Verify injection and set account ID
    // Note: Scripts injected via <script> tags run in the main world,
    // while preload scripts run in an isolated world. We need to use
    // a script injection to check and set values in the main world.
    setTimeout(() => {
      // Inject a script to check and configure WhatsAppTranslation in the main world
      const configScript = document.createElement('script');
      configScript.textContent = `
        (function() {
          if (typeof window.WhatsAppTranslation !== 'undefined') {
            console.log('[Preload-View] ✓ WhatsAppTranslation is available in main world');
            
            // Set account ID
            window.WhatsAppTranslation.accountId = '${accountId}';
            if (window.WhatsAppTranslation.core) {
              window.WhatsAppTranslation.core.accountId = '${accountId}';
            }
            
            console.log('[Preload-View] ✓ Translation system ready with account: ${accountId}');
          } else {
            console.error('[Preload-View] ✗ WhatsAppTranslation is not available in main world');
          }
        })();
      `;
      configScript.id = 'translation-config';
      (document.head || document.documentElement).appendChild(configScript);
    }, 500);
    
  } catch (error) {
    console.error('[Preload-View] Failed to inject translation scripts:', error);
  }
});

console.log('[Preload-View] Preload script completed');
