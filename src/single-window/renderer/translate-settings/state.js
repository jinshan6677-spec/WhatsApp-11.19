;(function(){
  'use strict';
  const DEFAULT_CONFIG = {
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
      imageTranslation: false,
      groqApiKey: '',
      groqModel: 'whisper-large-v3',
      groqTextModel: 'llama-3.1-70b-versatile',
      groqTextModelFallback: 'llama-3.1-8b-instant'
    },
    // Translation proxy settings (Requirements 3.4)
    proxy: {
      mode: 'auto',  // 'always' | 'auto' | 'never'
      useLocalProxy: true  // Whether to use local proxy settings from environment
    },
    friendConfigs: {}
  };

  function cloneDefault(){
    return JSON.parse(JSON.stringify(DEFAULT_CONFIG));
  }

  const State = window.TranslateSettingsState || (window.TranslateSettingsState = { accountId: null, config: cloneDefault(), panel: null });
  State.cloneDefault = cloneDefault;
})();

