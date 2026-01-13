; (function () {
  'use strict';
  if (!window.EnvSettingsState) {
    window.EnvSettingsState = {
      currentAccountId: null,
      currentConfig: null,
      currentFingerprintConfig: null,
      fingerprintEnabled: false,  // 指纹保护默认禁用
      tunnelEnabled: false,  // 隧道是否启用
      savedProxyConfigs: {},
      savedFingerprintTemplates: [],
      container: null
    };
  }
})();
