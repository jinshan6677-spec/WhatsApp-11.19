;(function(){
  'use strict';
  class TranslateSettingsPanel {
    constructor(options = {}) {
      this.host = options.host || null;
      this.placeholderEl = options.placeholderEl || null;
      this.onCollapse = options.onCollapse || null;
      this.getActiveChatInfo = options.getActiveChatInfo || (async () => ({}));
      this.applyConfigToView = options.applyConfigToView || (async () => ({ success: true }));
      this.accountId = null;
      this.panel = null;
      this.config = window.TranslateSettingsState.cloneDefault();
      this.currentEngine = null;
    }
    async init(){
      if (!this.host) return;
      this.panel = window.TranslateSettingsRender.render(this.host);
      window.TranslateSettingsRender.bindEvents(this.panel, this);
    }
    autoSave(){ return this.saveSettings(true); }
    setPlaceholderVisible(visible){
      if (!this.placeholderEl) return;
      this.placeholderEl.style.display = visible ? 'block' : 'none';
      if (this.host) this.host.style.display = visible ? 'none' : 'flex';
    }
    async setAccount(accountId){
      this.accountId = accountId;
      if (!accountId) {
        this.config = window.TranslateSettingsState.cloneDefault();
        this.setPlaceholderVisible(true);
        return;
      }
      this.setPlaceholderVisible(false);
      await this.loadSettings();
    }
    async loadSettings(){
      try {
        if (!window.translationAPI) throw new Error('translationAPI 未初始化');
        const response = await window.translationAPI.getConfig(this.accountId);
        if (response && (response.global || response.inputBox || response.advanced)) {
          this.config = response;
        } else if (response && response.success && (response.config || response.data)) {
          this.config = response.config || response.data;
        } else {
          this.config = window.TranslateSettingsState.cloneDefault();
        }
        await this.updateUI();
        await window.TranslateSettingsFriends.loadCurrentFriendConfig(this);
        window.TranslateSettingsStats.loadStats(this.panel);
      } catch (error) {
        this.showMessage('加载配置失败：' + error.message, 'error');
      }
    }
    async updateUI(){
      if (!this.config || !this.panel) return;
      this.panel.querySelector('#autoTranslate').checked = !!this.config.global.autoTranslate;
      this.panel.querySelector('#groupTranslation').checked = !!this.config.global.groupTranslation;
      this.panel.querySelector('#translationEngine').value = this.config.global.engine;
      this.panel.querySelector('#targetLanguage').value = this.config.global.targetLang;
      this.currentEngine = this.config.global.engine;
      this.panel.querySelector('#inputBoxEnabled').checked = !!this.config.inputBox.enabled;
      this.panel.querySelector('#inputBoxEngine').value = this.config.inputBox.engine || this.config.global.engine;
      this.panel.querySelector('#inputBoxTargetLang').value = this.config.inputBox.targetLang || 'auto';
      this.panel.querySelector('#translationStyle').value = this.config.inputBox.style || '通用';
      this.panel.querySelector('#blockChinese').checked = !!this.config.advanced.blockChinese;
      this.panel.querySelector('#friendIndependent').checked = !!this.config.advanced.friendIndependent;
      this.panel.querySelector('#realtimeTranslation').checked = !!this.config.advanced.realtime;
      this.panel.querySelector('#reverseTranslation').checked = !!this.config.advanced.reverseTranslation;
      this.panel.querySelector('#voiceTranslation').checked = !!this.config.advanced.voiceTranslation;
      const groqApiKeyEl = this.panel.querySelector('#groqApiKey');
      const groqSttModelEl = this.panel.querySelector('#groqSttModel');
      const groqTextModelEl = this.panel.querySelector('#groqTextModel');
      const groqTextModelFallbackEl = this.panel.querySelector('#groqTextModelFallback');
      if (groqApiKeyEl) groqApiKeyEl.value = this.config.advanced.groqApiKey || '';
      if (groqSttModelEl) groqSttModelEl.value = this.config.advanced.groqModel || 'whisper-large-v3';
      if (groqTextModelEl) groqTextModelEl.value = this.config.advanced.groqTextModel || 'llama-3.1-70b-versatile';
      if (groqTextModelFallbackEl) groqTextModelFallbackEl.value = this.config.advanced.groqTextModelFallback || 'llama-3.1-8b-instant';
      // Update proxy settings (Requirements 3.4)
      const proxyConfig = this.config.proxy || { mode: 'auto', useLocalProxy: true };
      const proxyModeEl = this.panel.querySelector('#translationProxyMode');
      const useLocalProxyEl = this.panel.querySelector('#translationUseLocalProxy');
      if (proxyModeEl) proxyModeEl.value = proxyConfig.mode || 'auto';
      if (useLocalProxyEl) useLocalProxyEl.checked = proxyConfig.useLocalProxy !== false;
      // Update proxy status display
      this.updateTranslationProxyStatus();
      window.TranslateSettingsFriends.updateFriendConfigVisibility(this);
      this.updateTranslationStyleVisibility();
      await this.updateAPIConfigVisibility();
    }
    updateTranslationProxyStatus(){
      const statusEl = this.panel.querySelector('#translationProxyStatus');
      const indicatorEl = this.panel.querySelector('#translationProxyIndicator');
      const statusTextEl = this.panel.querySelector('#translationProxyStatusText');
      if (!statusEl || !indicatorEl || !statusTextEl) return;
      const proxyMode = this.panel.querySelector('#translationProxyMode').value;
      const useLocalProxy = this.panel.querySelector('#translationUseLocalProxy').checked;
      if (proxyMode === 'never') {
        statusEl.style.display = 'none';
        return;
      }
      statusEl.style.display = 'flex';
      if (useLocalProxy) {
        // Check if local proxy is configured via environment settings
        if (window.electronAPI && window.electronAPI.getLocalProxyConfig) {
          window.electronAPI.getLocalProxyConfig().then(config => {
            if (config && config.port) {
              indicatorEl.className = 'env-status-indicator connected';
              statusTextEl.textContent = '使用本地代理 :' + config.port;
            } else {
              indicatorEl.className = 'env-status-indicator disconnected';
              statusTextEl.textContent = '未配置本地代理';
            }
          }).catch(() => {
            indicatorEl.className = 'env-status-indicator disconnected';
            statusTextEl.textContent = '无法获取代理状态';
          });
        } else {
          indicatorEl.className = 'env-status-indicator connecting';
          statusTextEl.textContent = '将使用环境设置中的代理';
        }
      } else {
        indicatorEl.className = 'env-status-indicator disconnected';
        statusTextEl.textContent = '未启用本地代理';
      }
    }
    updateTranslationStyleVisibility(){
      const styleItem = this.panel.querySelector('#translationStyle')?.closest('.setting-item');
      const inputBoxEngine = this.panel.querySelector('#inputBoxEngine').value;
      if (!styleItem) return;
      styleItem.style.display = inputBoxEngine === 'google' ? 'none' : 'block';
    }
    async updateAPIConfigVisibility(){
      const chatEngine = this.panel.querySelector('#translationEngine').value;
      const inputBoxEngine = this.panel.querySelector('#inputBoxEngine').value;
      const apiSection = this.panel.querySelector('#apiConfigSection');
      const customEndpoint = this.panel.querySelector('#customEndpointItem');
      const customModel = this.panel.querySelector('#customModelItem');
      const apiEngines = new Set(['custom','gpt4','gemini','deepseek']);
      const show = (el, cond) => { if (el) el.style.display = cond ? 'block' : 'none'; };
      const needsAPI = apiEngines.has(chatEngine) || apiEngines.has(inputBoxEngine);
      show(apiSection, needsAPI);
      const needsCustom = chatEngine === 'custom' || inputBoxEngine === 'custom';
      show(customEndpoint, needsCustom);
      show(customModel, needsCustom);
      const enginesToLoad = [chatEngine, inputBoxEngine].filter(e => apiEngines.has(e));
      if (enginesToLoad.length) {
        await Promise.all(enginesToLoad.map(e => window.TranslateSettingsEngine.loadEngineConfig(this.panel, e)));
      }
    }
    async loadEngineConfig(engineName){
      await window.TranslateSettingsEngine.loadEngineConfig(this.panel, engineName);
    }
    async saveCurrentEngineConfig(engineName){
      await window.TranslateSettingsEngine.saveCurrentEngineConfig(this.panel, engineName);
    }
    async saveSettings(isAutoSave = false){
      try {
        if (!this.accountId) throw new Error('请先选择账号');
        const newConfig = {
          global: {
            autoTranslate: this.panel.querySelector('#autoTranslate').checked,
            engine: this.panel.querySelector('#translationEngine').value,
            targetLang: this.panel.querySelector('#targetLanguage').value,
            groupTranslation: this.panel.querySelector('#groupTranslation').checked
          },
          inputBox: {
            enabled: this.panel.querySelector('#inputBoxEnabled').checked,
            engine: this.panel.querySelector('#inputBoxEngine').value,
            style: this.panel.querySelector('#translationStyle').value,
            targetLang: this.panel.querySelector('#inputBoxTargetLang').value
          },
          advanced: {
            friendIndependent: this.panel.querySelector('#friendIndependent').checked,
            blockChinese: this.panel.querySelector('#blockChinese').checked,
            realtime: this.panel.querySelector('#realtimeTranslation').checked,
            reverseTranslation: this.panel.querySelector('#reverseTranslation').checked,
            voiceTranslation: this.panel.querySelector('#voiceTranslation').checked,
            imageTranslation: false,
            groqApiKey: this.panel.querySelector('#groqApiKey').value,
            groqModel: this.panel.querySelector('#groqSttModel').value || 'whisper-large-v3',
            groqTextModel: this.panel.querySelector('#groqTextModel').value || 'llama-3.1-70b-versatile',
            groqTextModelFallback: this.panel.querySelector('#groqTextModelFallback').value || 'llama-3.1-8b-instant'
          },
          // Translation proxy settings (Requirements 3.4)
          proxy: {
            mode: this.panel.querySelector('#translationProxyMode').value || 'auto',
            useLocalProxy: this.panel.querySelector('#translationUseLocalProxy').checked
          },
          friendConfigs: this.config.friendConfigs || {}
        };
        if (!newConfig.advanced.groqApiKey || !String(newConfig.advanced.groqApiKey).trim().length) {
          newConfig.advanced.voiceTranslation = false;
        }
        const currentEngine = newConfig.global.engine;
        if (['custom', 'gpt4', 'gemini', 'deepseek'].includes(currentEngine)) {
          await window.TranslateSettingsEngine.saveCurrentEngineConfig(this.panel, currentEngine);
        }
        const inputBoxEngine = newConfig.inputBox.engine;
        if (['custom', 'gpt4', 'gemini', 'deepseek'].includes(inputBoxEngine) && inputBoxEngine !== currentEngine) {
          await window.TranslateSettingsEngine.saveCurrentEngineConfig(this.panel, inputBoxEngine);
        }
        const response = await window.translationAPI.saveConfig(this.accountId, newConfig);
        const saveOk = !response || (response && response.success === true);
        if (saveOk) {
          this.config = newConfig;
          try {
            const gKey = (newConfig.advanced.groqApiKey || '').trim();
            const gModel = (newConfig.advanced.groqModel || 'whisper-large-v3').trim();
            if (gKey && window.translationAPI && typeof window.translationAPI.saveEngineConfig === 'function') {
              await window.translationAPI.saveEngineConfig('groqSTT', { apiKey: gKey, model: gModel, enabled: true });
            } else if (window.translationAPI && typeof window.translationAPI.saveEngineConfig === 'function') {
              await window.translationAPI.saveEngineConfig('groqSTT', { enabled: false });
            }
          } catch (_) {}
          try {
            const gKeySync = (newConfig.advanced.groqApiKey || '').trim();
            if (window.electronAPI && typeof window.electronAPI.invoke === 'function' && window.translationAPI) {
              const accResp = await window.electronAPI.invoke('get-accounts');
              const accounts = Array.isArray(accResp) ? accResp : (accResp?.accounts || accResp?.data || []);
              for (const acc of accounts) {
                const accId = acc && acc.id ? acc.id : acc;
                if (!accId || accId === this.accountId) continue;
                const cfgResp = await window.translationAPI.getConfig(accId);
                const cfg = (cfgResp && cfgResp.success) ? (cfgResp.config || cfgResp.data || {}) : {};
                const hasKey = cfg && cfg.advanced && cfg.advanced.groqApiKey && String(cfg.advanced.groqApiKey).trim().length > 0;
                if (!cfg.global || typeof cfg.global !== 'object') cfg.global = this.config.global || {};
                if (!cfg.inputBox || typeof cfg.inputBox !== 'object') cfg.inputBox = this.config.inputBox || {};
                if (!cfg.advanced || typeof cfg.advanced !== 'object') cfg.advanced = {};
                if (!cfg.friendConfigs || typeof cfg.friendConfigs !== 'object') cfg.friendConfigs = cfg.friendConfigs || {};
                if (gKeySync) {
                  if (hasKey) continue;
                  cfg.advanced.groqApiKey = gKeySync;
                  cfg.advanced.groqModel = newConfig.advanced.groqModel || cfg.advanced.groqModel || 'whisper-large-v3';
                  cfg.advanced.groqTextModel = newConfig.advanced.groqTextModel || cfg.advanced.groqTextModel || 'llama-3.1-70b-versatile';
                  cfg.advanced.groqTextModelFallback = newConfig.advanced.groqTextModelFallback || cfg.advanced.groqTextModelFallback || 'llama-3.1-8b-instant';
                } else {
                  cfg.advanced.groqApiKey = '';
                  cfg.advanced.voiceTranslation = false;
                }
                await window.translationAPI.saveConfig(accId, cfg);
              }
            }
          } catch (_) {}
          if (this.applyConfigToView) {
            const applyResult = await this.applyConfigToView(this.accountId, newConfig);
            if (!applyResult || !applyResult.success) {
              if (!isAutoSave) {
                this.showMessage('设置已保存，但应用到视图失败，请尝试刷新页面', 'error');
                return;
              }
            }
          }
          if (isAutoSave) {
            this.showMessage('配置已自动保存', 'success');
          } else {
            this.showMessage('设置已保存并应用', 'success');
          }
        } else {
          const errMsg = response && response.error ? response.error : '未知错误';
          this.showMessage('保存失败：' + errMsg, 'error');
        }
      } catch (error) {
        this.showMessage('保存失败：' + error.message, 'error');
      }
    }
    async clearCache(){
      try {
        const response = await window.translationAPI.clearCache(this.accountId);
        if (response.success) {
          this.showMessage('缓存已清除', 'success');
        } else {
          this.showMessage('清除缓存失败：' + (response.error || '未知错误'), 'error');
        }
      } catch (error) {
        this.showMessage('清除缓存失败：' + error.message, 'error');
      }
    }
    async testAPI(){ await window.TranslateSettingsEngine.testAPI(this); }
    async loadCurrentFriendConfig(){ await window.TranslateSettingsFriends.loadCurrentFriendConfig(this); }
    updateFriendConfigVisibility(){ window.TranslateSettingsFriends.updateFriendConfigVisibility(this); }
    updateFriendConfigOptions(){ window.TranslateSettingsFriends.updateFriendConfigOptions(this); }
    async saveCurrentFriendConfig(){ await window.TranslateSettingsFriends.saveCurrentFriendConfig(this); }
    showFriendConfigManager(){ window.TranslateSettingsFriends.showFriendConfigManager(this); }
    async resetSettings(){
      this.config = window.TranslateSettingsState.cloneDefault();
      await this.updateUI();
      this.loadCurrentFriendConfig();
    }
    showMessage(message, type = 'info'){
      const msgEl = document.createElement('div');
      msgEl.className = `env-message-toast ${type}`;
      msgEl.textContent = message;
      this.panel.appendChild(msgEl);
      setTimeout(() => { msgEl.style.opacity = '0'; msgEl.style.transition = 'opacity 0.3s ease'; setTimeout(() => msgEl.remove(), 300); }, 3000);
    }
    updateForPanelState(state){
      if (!this.panel) return;
      const content = this.panel.querySelector('.env-section-content');
      const footer = this.panel.querySelector('.env-panel-footer');
      const header = this.panel.querySelector('.env-panel-header');
      if (state === 'compact' || state === 'collapsed') {
        if (content) content.style.display = 'none';
        if (footer) footer.style.display = 'none';
        if (header) header.style.borderBottom = 'none';
      } else {
        if (content) content.style.display = 'block';
        if (footer) footer.style.display = 'flex';
        if (header) header.style.borderBottom = '';
      }
    }
  }
  window.TranslateSettingsPanel = TranslateSettingsPanel;
})();
