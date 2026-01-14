;(function(){
  'use strict';
  const state = window.EnvSettingsState;
  function container(){ return state.container; }

  // Error messages mapping (Requirements 5.5, 6.1)
  const ERROR_MESSAGES = {
    LOCAL_PROXY_NOT_RUNNING: '请检查代理客户端是否已启动',
    LOCAL_PROXY_PORT_INVALID: '端口格式错误，请输入 1-65535 之间的数字',
    LOCAL_PROXY_CONNECTION_REFUSED: '无法连接到本地代理，请确认代理客户端正在运行',
    CHAINED_PROXY_UNREACHABLE: '链式代理服务器不可达，请检查配置',
    CHAINED_PROXY_AUTH_FAILED: '链式代理认证失败，请检查用户名和密码',
    TRANSLATION_SERVICE_BLOCKED: '翻译服务可能被封锁，建议启用代理',
    CONNECTION_TIMEOUT: '连接超时，请检查网络',
    UNKNOWN_ERROR: '未知错误，请稍后重试'
  };

  // Error code to message mapping
  const ERROR_CODE_MAP = {
    'ECONNREFUSED': 'LOCAL_PROXY_CONNECTION_REFUSED',
    'ETIMEDOUT': 'CONNECTION_TIMEOUT',
    'ECONNABORTED': 'CONNECTION_TIMEOUT',
    'ENOTFOUND': 'LOCAL_PROXY_NOT_RUNNING',
    'ECONNRESET': 'CONNECTION_TIMEOUT'
  };

  // Preset port mapping (Requirements 1.3, 5.3)
  const PRESET_PORTS = {
    clash: 7890,
    v2rayn: 10808,
    shadowsocks: 1080
  };

  // Preset protocol mapping
  // V2rayN and Clash use mixed mode, which works with HTTP protocol in Electron
  const PRESET_PROTOCOLS = {
    clash: 'http',
    v2rayn: 'http',       // V2rayN mixed port works with HTTP
    shadowsocks: 'socks5', // Shadowsocks is typically SOCKS5 only
    custom: 'http'
  };

  // Preset names for display
  const PRESET_NAMES = {
    clash: 'Clash',
    v2rayn: 'V2rayN',
    shadowsocks: 'Shadowsocks',
    custom: '自定义'
  };

  // Current proxy mode: 'direct' or 'local'
  let currentProxyMode = 'direct';
  
  // Health status listener cleanup function
  let healthStatusCleanup = null;
  
  // Current connection status
  let currentConnectionStatus = 'disconnected';

  /**
   * Initialize local proxy settings
   */
  function init() {
    setupProxyModeTabs();
    setupLocalProxyPreset();
    setupChainedProxyToggle();
    setupLocalProxyButtons();
    setupHealthMonitorListener();
    // Note: Collapsible sections are handled by EnvSettingsRender.setupCollapsibles()
    // Do NOT add duplicate handlers here as it would toggle the class twice
    initializeConnectionStatus();
  }
  
  /**
   * Initialize connection status display
   */
  function initializeConnectionStatus() {
    updateConnectionStatus('disconnected');
    updateConnectionModeDisplay();
  }

  /**
   * Setup proxy mode tabs (direct vs local)
   */
  function setupProxyModeTabs() {
    const tabs = container().querySelectorAll('.env-proxy-mode-tab');
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const mode = tab.dataset.mode;
        switchProxyMode(mode);
      });
    });
  }

  /**
   * Switch between direct and local proxy modes
   */
  function switchProxyMode(mode) {
    currentProxyMode = mode;
    const tabs = container().querySelectorAll('.env-proxy-mode-tab');
    const directContent = container().querySelector('#direct-proxy-content');
    const localContent = container().querySelector('#local-proxy-content');
    
    tabs.forEach(tab => {
      tab.classList.toggle('active', tab.dataset.mode === mode);
    });
    
    if (mode === 'direct') {
      directContent.classList.remove('hidden');
      localContent.classList.add('hidden');
    } else {
      directContent.classList.add('hidden');
      localContent.classList.remove('hidden');
    }
    
    updateConnectionModeDisplay();
  }

  /**
   * Setup local proxy preset dropdown (Requirements 5.2, 5.3)
   * Implements preset auto-fill functionality
   */
  function setupLocalProxyPreset() {
    const presetSelect = container().querySelector('#local-proxy-preset');
    const portInput = container().querySelector('#local-proxy-port');
    
    presetSelect.addEventListener('change', async (e) => {
      const presetId = e.target.value;
      
      // Handle empty selection
      if (!presetId) {
        portInput.value = '';
        portInput.readOnly = false;
        portInput.placeholder = '请选择预设或输入端口';
        updateConnectionModeDisplay();
        return;
      }
      
      // Handle custom preset
      if (presetId === 'custom') {
        portInput.value = '';
        portInput.readOnly = false;
        portInput.placeholder = '输入自定义端口';
        portInput.focus();
        updateConnectionModeDisplay();
        return;
      }
      
      // Auto-fill port from preset (Requirements 1.3, 5.3)
      // First try to get from backend, fallback to local mapping
      if (window.electronAPI && window.electronAPI.getLocalProxyPreset) {
        try {
          const result = await window.electronAPI.getLocalProxyPreset(presetId);
          if (result.success && result.preset) {
            portInput.value = result.preset.port;
            portInput.readOnly = true;
            showLocalProxySuccess('已选择 ' + result.preset.name + ' 预设，端口: ' + result.preset.port);
            updateConnectionModeDisplay();
            return;
          }
        } catch (error) {
          console.warn('[LocalProxy] Failed to get preset from backend, using fallback:', error);
        }
      }
      
      // Fallback to hardcoded presets
      const port = PRESET_PORTS[presetId];
      const name = PRESET_NAMES[presetId];
      if (port) {
        portInput.value = port;
        portInput.readOnly = true;
        showLocalProxySuccess('已选择 ' + name + ' 预设，端口: ' + port);
        updateConnectionModeDisplay();
      }
    });
    
    // Also update mode display when port changes manually
    portInput.addEventListener('input', () => {
      updateConnectionModeDisplay();
    });
    
    // Validate port on blur
    portInput.addEventListener('blur', () => {
      const port = parseInt(portInput.value, 10);
      if (portInput.value && (isNaN(port) || port < 1 || port > 65535)) {
        showLocalProxyError(ERROR_MESSAGES.LOCAL_PROXY_PORT_INVALID);
      }
    });
  }

  /**
   * Setup chained proxy toggle
   */
  function setupChainedProxyToggle() {
    const checkbox = container().querySelector('#chained-proxy-enabled');
    const fields = container().querySelector('#chained-proxy-fields');
    
    checkbox.addEventListener('change', (e) => {
      fields.classList.toggle('disabled', !e.target.checked);
    });
  }

  /**
   * Setup local proxy action buttons (Requirements 4.4)
   */
  function setupLocalProxyButtons() {
    const testBtn = container().querySelector('#test-local-proxy-btn');
    const diagnoseBtn = container().querySelector('#diagnose-proxy-btn');
    
    if (testBtn) {
      testBtn.addEventListener('click', testLocalProxy);
    }
    if (diagnoseBtn) {
      diagnoseBtn.addEventListener('click', diagnoseProxyChain);
    }
  }

  /**
   * Setup health monitor status listener (Requirements 4.2, 4.3)
   * Listens for status changes from ProxyHealthMonitor
   */
  function setupHealthMonitorListener() {
    if (window.electronAPI && window.electronAPI.onHealthStatusChanged) {
      healthStatusCleanup = window.electronAPI.onHealthStatusChanged((data) => {
        console.log('[LocalProxy] Health status changed:', data);
        
        // Map health monitor status to UI status
        const status = data.currentStatus || data.status;
        const latency = data.latency;
        const error = data.error;
        
        updateConnectionStatus(status, latency, error);
        
        // Show notification for status changes
        if (status === 'error' || status === 'disconnected') {
          showLocalProxyError(getErrorMessage(error, data.code));
        } else if (status === 'connected' && data.previousStatus !== 'connected') {
          showLocalProxySuccess('代理连接已恢复');
        }
      });
    }
  }

  /**
   * Test local proxy connection
   */
  async function testLocalProxy() {
    if (!window.electronAPI) return;
    
    const config = collectLocalProxyConfig();
    if (!config.host || !config.port) {
      showLocalProxyError('请先填写本地代理端口');
      return;
    }
    
    // Validate first
    const validation = await window.electronAPI.validateLocalProxy(config.host, config.port);
    if (!validation.valid) {
      showLocalProxyError(validation.errors.join(', '));
      return;
    }
    
    showLocalProxyLoading('正在测试本地代理连接...');
    updateConnectionStatus('connecting');
    
    try {
      const result = await window.electronAPI.testLocalProxy(config);
      
      if (result.success) {
        updateConnectionStatus('connected', result.latency);
        showLocalProxySuccess('本地代理连接成功！延迟: ' + result.latency + 'ms');
        
        // Start health monitoring
        if (state.currentAccountId) {
          await window.electronAPI.startHealthMonitor(state.currentAccountId, config);
        }
      } else {
        updateConnectionStatus('error', null, result.error);
        showLocalProxyError(getErrorMessage(result.error, result.code));
      }
    } catch (error) {
      console.error('[LocalProxy] Test failed:', error);
      updateConnectionStatus('error', null, error.message);
      showLocalProxyError('测试失败: ' + error.message);
    }
  }

  /**
   * Diagnose proxy chain issues
   */
  async function diagnoseProxyChain() {
    if (!window.electronAPI) return;
    
    const localConfig = collectLocalProxyConfig();
    if (!localConfig.host || !localConfig.port) {
      showLocalProxyError('请先填写本地代理端口');
      return;
    }
    
    const chainedConfig = collectChainedProxyConfig();
    
    showLocalProxyLoading('正在诊断代理链...');
    
    try {
      const result = await window.electronAPI.diagnoseProxyChain(localConfig, chainedConfig);
      
      if (result.success) {
        showDiagnoseResult(result);
      } else {
        showLocalProxyError('诊断失败: ' + (result.error || '未知错误'));
      }
    } catch (error) {
      console.error('[LocalProxy] Diagnose failed:', error);
      showLocalProxyError('诊断失败: ' + error.message);
    }
  }

  /**
   * Show diagnose result
   */
  function showDiagnoseResult(result) {
    let html = '<div class="env-diagnose-result">';
    
    // Local proxy status
    html += '<div class="env-diagnose-item">';
    html += '<span class="env-diagnose-icon ' + (result.localProxyOk ? 'success' : 'error') + '">' + 
            (result.localProxyOk ? '✓' : '✗') + '</span>';
    html += '<span class="env-diagnose-label">本地代理连接</span>';
    html += '<span class="env-diagnose-status ' + (result.localProxyOk ? 'success' : 'error') + '">' + 
            (result.localProxyOk ? '正常' : '失败') + '</span>';
    html += '</div>';
    
    // Chained proxy status (if configured)
    if (result.chainedProxyOk !== undefined) {
      html += '<div class="env-diagnose-item">';
      html += '<span class="env-diagnose-icon ' + (result.chainedProxyOk ? 'success' : 'error') + '">' + 
              (result.chainedProxyOk ? '✓' : '✗') + '</span>';
      html += '<span class="env-diagnose-label">链式代理连接</span>';
      html += '<span class="env-diagnose-status ' + (result.chainedProxyOk ? 'success' : 'error') + '">' + 
              (result.chainedProxyOk ? '正常' : '失败') + '</span>';
      html += '</div>';
    }
    
    // Error message
    if (result.error) {
      html += '<div class="env-error-message" style="margin-top: 12px;">';
      html += '<span class="env-error-icon">⚠️</span>';
      html += '<div class="env-error-text">' + result.error + '</div>';
      html += '</div>';
    }
    
    html += '</div>';
    
    showLocalProxyResult(html);
  }

  /**
   * Update connection status indicator (Requirements 4.3, 4.4)
   * Displays visual indicator: green=connected, yellow=connecting, red=disconnected/error
   * @param {string} status - Status: 'connected', 'connecting', 'disconnected', 'error'
   * @param {number} [latency] - Latency in milliseconds
   * @param {string} [error] - Error message
   */
  function updateConnectionStatus(status, latency, error) {
    currentConnectionStatus = status;
    
    const statusContainer = container().querySelector('#connection-status');
    const indicator = container().querySelector('#status-indicator');
    const statusText = container().querySelector('#status-text');
    const latencyEl = container().querySelector('#status-latency');
    
    if (!statusContainer || !indicator || !statusText) {
      console.warn('[LocalProxy] Status elements not found');
      return;
    }
    
    // Show status container
    statusContainer.classList.remove('hidden');
    
    // Update indicator class for color (green/yellow/red)
    indicator.className = 'env-status-indicator';
    switch (status) {
      case 'connected':
        indicator.classList.add('connected'); // Green
        break;
      case 'connecting':
        indicator.classList.add('connecting'); // Yellow
        break;
      case 'error':
        indicator.classList.add('error'); // Red
        break;
      case 'disconnected':
      default:
        indicator.classList.add('disconnected'); // Gray/Red
        break;
    }
    
    // Update status text
    const statusTexts = {
      connected: '已连接',
      connecting: '连接中...',
      disconnected: '未连接',
      error: '连接错误'
    };
    statusText.textContent = statusTexts[status] || status;
    
    // Update latency display
    if (latencyEl) {
      if (latency !== undefined && latency !== null && status === 'connected') {
        latencyEl.textContent = latency + 'ms';
        latencyEl.classList.remove('hidden');
        // Color code latency
        latencyEl.className = 'env-status-latency';
        if (latency < 100) {
          latencyEl.classList.add('good');
        } else if (latency < 300) {
          latencyEl.classList.add('medium');
        } else {
          latencyEl.classList.add('slow');
        }
      } else {
        latencyEl.classList.add('hidden');
      }
    }
    
    // Show error message if provided (Task 9.4)
    if (error && (status === 'error' || status === 'disconnected')) {
      showLocalProxyError(error);
    }
  }

  /**
   * Update connection mode display (Requirements 5.4)
   * Shows current mode: direct, local proxy, or local proxy + chained proxy
   */
  function updateConnectionModeDisplay() {
    const statusContainer = container().querySelector('#connection-status');
    const statusText = container().querySelector('#status-text');
    const modeDisplay = container().querySelector('#connection-mode-display');
    
    if (!statusContainer || !statusText) {
      return;
    }
    
    let modeText = '';
    let modeIcon = '';
    
    if (currentProxyMode === 'local') {
      const localConfig = collectLocalProxyConfig();
      const chainedConfig = collectChainedProxyConfig();
      
      // Determine mode text based on preset
      if (localConfig.presetId && localConfig.presetId !== 'custom') {
        modeText = PRESET_NAMES[localConfig.presetId] || '本地代理';
        modeIcon = '🔌';
      } else if (localConfig.port) {
        modeText = '本地代理 :' + localConfig.port;
        modeIcon = '🔌';
      } else {
        modeText = '本地代理';
        modeIcon = '🔌';
      }
      
      // Add chained proxy indicator
      if (chainedConfig && chainedConfig.enabled && chainedConfig.host) {
        modeText += ' → 链式代理';
        modeIcon = '🔗';
      }
    } else {
      // Direct proxy mode
      const proxyEnabled = container().querySelector('#proxy-enabled');
      if (proxyEnabled && proxyEnabled.checked) {
        modeText = '直连代理';
        modeIcon = '🌐';
      } else {
        modeText = '直接连接';
        modeIcon = '📡';
      }
    }
    
    // Update or create mode display element
    if (modeDisplay) {
      modeDisplay.innerHTML = '<span class="env-mode-icon">' + modeIcon + '</span> ' + modeText;
    }
    
    // Update status text if not in connected state
    if (currentConnectionStatus !== 'connected' && currentConnectionStatus !== 'connecting') {
      statusText.textContent = '模式: ' + modeText;
      statusContainer.classList.remove('hidden');
    }
  }

  /**
   * Collect local proxy configuration from form
   */
  function collectLocalProxyConfig() {
    const c = container();
    const presetId = c.querySelector('#local-proxy-preset').value || 'custom';
    
    // Get protocol based on preset
    const protocol = PRESET_PROTOCOLS[presetId] || 'http';
    
    return {
      host: c.querySelector('#local-proxy-host').value || '127.0.0.1',
      port: parseInt(c.querySelector('#local-proxy-port').value, 10) || 0,
      protocol: protocol,
      presetId: presetId
    };
  }

  /**
   * Collect chained proxy configuration from form
   */
  function collectChainedProxyConfig() {
    const c = container();
    const enabled = c.querySelector('#chained-proxy-enabled').checked;
    
    if (!enabled) return null;
    
    return {
      enabled: true,
      protocol: c.querySelector('#chained-proxy-protocol').value,
      host: c.querySelector('#chained-proxy-host').value,
      port: parseInt(c.querySelector('#chained-proxy-port').value, 10) || 0,
      username: c.querySelector('#chained-proxy-username').value,
      password: c.querySelector('#chained-proxy-password').value
    };
  }

  /**
   * Collect full proxy form data (for saving)
   */
  function collectProxyFormData() {
    if (currentProxyMode === 'local') {
      const localConfig = collectLocalProxyConfig();
      const chainedConfig = collectChainedProxyConfig();
      
      // Return in the format expected by EnvironmentConfigManager
      return {
        proxy: {
          enabled: true,
          mode: 'local',
          configName: '',
          protocol: 'http',
          host: '',
          port: '',
          username: '',
          password: ''
        },
        localProxy: {
          enabled: true,
          ...localConfig
        },
        chainedProxy: chainedConfig || {
          enabled: false,
          protocol: 'http',
          host: '',
          port: 0,
          username: '',
          password: ''
        }
      };
    } else {
      // Use existing direct proxy collection
      return window.ProxySettings.collectProxyFormData();
    }
  }

  /**
   * Populate form with local proxy config
   */
  function populateLocalProxyForm(config) {
    if (!config || !config.localProxy) return;
    
    const c = container();
    const localProxy = config.localProxy;
    
    // Set preset
    if (localProxy.presetId) {
      c.querySelector('#local-proxy-preset').value = localProxy.presetId;
    }
    
    // Set port
    if (localProxy.port) {
      c.querySelector('#local-proxy-port').value = localProxy.port;
    }
    
    // Set chained proxy if exists
    if (config.chainedProxy && config.chainedProxy.enabled) {
      c.querySelector('#chained-proxy-enabled').checked = true;
      c.querySelector('#chained-proxy-fields').classList.remove('disabled');
      c.querySelector('#chained-proxy-protocol').value = config.chainedProxy.protocol || 'http';
      c.querySelector('#chained-proxy-host').value = config.chainedProxy.host || '';
      c.querySelector('#chained-proxy-port').value = config.chainedProxy.port || '';
      c.querySelector('#chained-proxy-username').value = config.chainedProxy.username || '';
      c.querySelector('#chained-proxy-password').value = config.chainedProxy.password || '';
    }
  }

  /**
   * Get user-friendly error message (Requirements 5.5, 6.1)
   * Maps error codes and messages to user-friendly Chinese messages
   * @param {string} error - Error message
   * @param {string} [code] - Error code (e.g., ECONNREFUSED)
   * @returns {string} User-friendly error message
   */
  function getErrorMessage(error, code) {
    // First check error code mapping
    if (code && ERROR_CODE_MAP[code]) {
      return ERROR_MESSAGES[ERROR_CODE_MAP[code]];
    }
    
    // Check for specific error patterns
    if (error) {
      const errorLower = error.toLowerCase();
      
      if (errorLower.includes('connection refused') || errorLower.includes('econnrefused')) {
        return ERROR_MESSAGES.LOCAL_PROXY_CONNECTION_REFUSED;
      }
      if (errorLower.includes('timeout') || errorLower.includes('etimedout')) {
        return ERROR_MESSAGES.CONNECTION_TIMEOUT;
      }
      if (errorLower.includes('端口') || errorLower.includes('port')) {
        return ERROR_MESSAGES.LOCAL_PROXY_PORT_INVALID;
      }
      if (errorLower.includes('auth') || errorLower.includes('认证')) {
        return ERROR_MESSAGES.CHAINED_PROXY_AUTH_FAILED;
      }
      if (errorLower.includes('unreachable') || errorLower.includes('不可达')) {
        return ERROR_MESSAGES.CHAINED_PROXY_UNREACHABLE;
      }
      if (errorLower.includes('blocked') || errorLower.includes('封锁')) {
        return ERROR_MESSAGES.TRANSLATION_SERVICE_BLOCKED;
      }
      
      // Return original error if it's already in Chinese
      if (/[\u4e00-\u9fa5]/.test(error)) {
        return error;
      }
    }
    
    return error || ERROR_MESSAGES.UNKNOWN_ERROR;
  }

  /**
   * Get current proxy mode
   */
  function getProxyMode() {
    return currentProxyMode;
  }

  /**
   * Set proxy mode
   */
  function setProxyMode(mode) {
    if (mode === 'local' || mode === 'direct') {
      switchProxyMode(mode);
    }
  }
  
  /**
   * Get current connection status
   */
  function getConnectionStatus() {
    return currentConnectionStatus;
  }

  // Result display helpers
  function showLocalProxyResult(html) {
    const resultBox = container().querySelector('#proxy-result');
    resultBox.innerHTML = html;
    resultBox.classList.remove('hidden');
  }

  function showLocalProxyLoading(message) {
    showLocalProxyResult('<div class="env-result-loading">' + message + '</div>');
  }

  function showLocalProxySuccess(message) {
    showLocalProxyResult('<div class="env-result-success">✓ ' + message + '</div>');
    setTimeout(() => {
      container().querySelector('#proxy-result').classList.add('hidden');
    }, 3000);
  }

  function showLocalProxyError(message) {
    showLocalProxyResult('<div class="env-result-error">❌ ' + message + '</div>');
  }

  /**
   * Cleanup function
   */
  function cleanup() {
    if (healthStatusCleanup) {
      healthStatusCleanup();
      healthStatusCleanup = null;
    }
  }

  // Export to window
  window.LocalProxySettings = {
    init,
    switchProxyMode,
    testLocalProxy,
    diagnoseProxyChain,
    collectLocalProxyConfig,
    collectChainedProxyConfig,
    collectProxyFormData,
    populateLocalProxyForm,
    updateConnectionStatus,
    updateConnectionModeDisplay,
    getProxyMode,
    setProxyMode,
    getConnectionStatus,
    getErrorMessage,
    cleanup,
    ERROR_MESSAGES,
    PRESET_PORTS,
    PRESET_PROTOCOLS,
    PRESET_NAMES
  };
})();
