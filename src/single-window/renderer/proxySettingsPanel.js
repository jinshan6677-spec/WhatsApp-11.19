(function () {
  'use strict';

  const DEFAULT_PROXY_CONFIG = {
    enabled: false,
    protocol: 'socks5',
    host: '',
    port: 0,
    username: '',
    password: '',
    bypass: ''
  };

  function cloneDefaultConfig() {
    return JSON.parse(JSON.stringify(DEFAULT_PROXY_CONFIG));
  }

  class ProxySettingsPanel {
    constructor(options = {}) {
      this.host = options.host || null;
      this.placeholderEl = options.placeholderEl || null;
      this.onCollapse = options.onCollapse || null;
      this.accountId = null;
      this.panel = null;
      this.config = cloneDefaultConfig();
      this.proxyConfigs = []; // 代理配置列表
      this.detectionResult = null; // 检测结果
    }

    async init() {
      if (!this.host) {
        console.warn('[ProxySettingsPanel] host element not provided');
        return;
      }
      this.injectStyles();
      this.createPanel();
      this.bindEvents();
      await this.loadProxyList(); // 加载代理列表
    }

    injectStyles() {
      if (document.getElementById('proxy-settings-styles')) {
        return;
      }
      const style = document.createElement('style');
      style.id = 'proxy-settings-styles';
      style.textContent = `
.proxy-settings-wrapper {
  width: 100%;
  height: 100%;
}

.proxy-settings-wrapper .settings-container {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  background: #ffffff;
  overflow: hidden;
}

.proxy-settings-wrapper .settings-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 18px;
  background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
  color: #fff;
}

.proxy-settings-wrapper .settings-header h2 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
}

.proxy-settings-wrapper .settings-content {
  flex: 1;
  overflow-y: auto;
  padding: 0;
  background: #fafbff;
}

.proxy-settings-wrapper .settings-section {
  padding: 18px 20px;
  border-bottom: 1px solid #f1f3f7;
  background: #fff;
}

.proxy-settings-wrapper .settings-section h3 {
  margin: 0 0 12px 0;
  font-size: 15px;
  font-weight: 600;
  color: #111827;
}

.proxy-settings-wrapper .setting-item {
  margin-bottom: 14px;
}

.proxy-settings-wrapper .setting-item:last-child {
  margin-bottom: 0;
}

.proxy-settings-wrapper .setting-label {
  display: flex;
  align-items: center;
  gap: 10px;
  font-weight: 600;
  color: #111827;
}

.proxy-settings-wrapper .setting-checkbox {
  width: 16px;
  height: 16px;
}

.proxy-settings-wrapper .setting-title {
  font-size: 14px;
}

.proxy-settings-wrapper .setting-desc {
  margin: 6px 0 0 26px;
  font-size: 12px;
  color: #6b7280;
  line-height: 1.5;
}

.proxy-settings-wrapper .setting-select,
.proxy-settings-wrapper .setting-input {
  width: 100%;
  padding: 8px 10px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #fff;
  font-size: 13px;
  margin-top: 6px;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.proxy-settings-wrapper .setting-select:focus,
.proxy-settings-wrapper .setting-input:focus {
  outline: none;
  border-color: #f59e0b;
  box-shadow: 0 0 0 3px rgba(245, 158, 11, 0.25);
}

.proxy-settings-wrapper .setting-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 10px 14px;
  font-size: 13px;
  border-radius: 8px;
  border: 1px solid #d1d5db;
  cursor: pointer;
  transition: all 0.2s ease;
}

.proxy-settings-wrapper .setting-button.primary {
  background: #f59e0b;
  border-color: #f59e0b;
  color: #fff;
}

.proxy-settings-wrapper .setting-button.primary:hover {
  background: #d97706;
  border-color: #d97706;
}

.proxy-settings-wrapper .setting-button.secondary {
  background: #fff;
}

.proxy-settings-wrapper .setting-button.secondary:hover {
  border-color: #f59e0b;
  color: #d97706;
}

.proxy-settings-wrapper .settings-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 14px 18px;
  border-top: 1px solid #f1f3f7;
  background: #fff;
}

.proxy-settings-wrapper .settings-message {
  position: absolute;
  right: 16px;
  bottom: 16px;
  padding: 10px 14px;
  border-radius: 8px;
  color: #111827;
  background: #e5f6ff;
  border: 1px solid #bae6fd;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}

.proxy-settings-wrapper .settings-message.success {
  background: #ecfdf3;
  border-color: #bbf7d0;
}

.proxy-settings-wrapper .settings-message.error {
  background: #fef2f2;
  border-color: #fecdd3;
  color: #991b1b;
}

.proxy-settings-wrapper .setting-input-group {
  display: flex;
  gap: 8px;
  align-items: flex-start;
}

.proxy-settings-wrapper .setting-input-group .setting-select {
  flex: 1;
}

.proxy-settings-wrapper .setting-input-group .setting-button {
  margin-top: 6px;
  padding: 8px 12px;
  min-width: 40px;
}

.proxy-settings-wrapper .setting-textarea {
  width: 100%;
  padding: 8px 10px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #fff;
  font-size: 13px;
  margin-top: 6px;
  font-family: inherit;
  resize: vertical;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.proxy-settings-wrapper .setting-textarea:focus {
  outline: none;
  border-color: #f59e0b;
  box-shadow: 0 0 0 3px rgba(245, 158, 11, 0.25);
}

.proxy-settings-wrapper .detection-result {
  margin-top: 12px;
  padding: 12px;
  border-radius: 8px;
  background: #ecfdf3;
  border: 1px solid #bbf7d0;
  font-size: 13px;
}

.proxy-settings-wrapper .detection-result.error {
  background: #fef2f2;
  border-color: #fecdd3;
  color: #991b1b;
}

.proxy-settings-wrapper .detection-result .result-item {
  display: flex;
  justify-content: space-between;
  margin-bottom: 6px;
}

.proxy-settings-wrapper .detection-result .result-item:last-child {
  margin-bottom: 0;
}

.proxy-settings-wrapper .detection-result .result-label {
  font-weight: 600;
  color: #065f46;
}

.proxy-settings-wrapper .detection-result.error .result-label {
  color: #991b1b;
}

.proxy-settings-wrapper .detection-result .result-value {
  color: #047857;
}

.proxy-settings-wrapper .detection-result.error .result-value {
  color: #991b1b;
}

.proxy-settings-wrapper .button-group {
  display: flex;
  gap: 10px;
  margin-top: 12px;
}

.proxy-settings-wrapper .setting-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.proxy-settings-wrapper .setting-button.loading {
  position: relative;
  color: transparent;
}

.proxy-settings-wrapper .setting-button.loading::after {
  content: '';
  position: absolute;
  width: 16px;
  height: 16px;
  top: 50%;
  left: 50%;
  margin-left: -8px;
  margin-top: -8px;
  border: 2px solid #fff;
  border-radius: 50%;
  border-top-color: transparent;
  animation: spin 0.6s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.proxy-settings-wrapper .password-input-wrapper {
  position: relative;
}

.proxy-settings-wrapper .password-toggle {
  position: absolute;
  right: 10px;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px;
  color: #6b7280;
  font-size: 16px;
}

.proxy-settings-wrapper .password-toggle:hover {
  color: #f59e0b;
}
.proxy-settings-wrapper .switch {
  position: relative;
  display: inline-block;
  width: 40px;
  height: 22px;
  flex-shrink: 0;
}

.proxy-settings-wrapper .switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

.proxy-settings-wrapper .slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: #e5e7eb;
  transition: .3s;
  border-radius: 22px;
  border: 1px solid #d1d5db;
}

.proxy-settings-wrapper .slider:before {
  position: absolute;
  content: "";
  height: 16px;
  width: 16px;
  left: 2px;
  bottom: 2px;
  background-color: white;
  transition: .3s;
  border-radius: 50%;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
}

.proxy-settings-wrapper input:checked + .slider {
  background-color: #f59e0b;
  border-color: #f59e0b;
}

.proxy-settings-wrapper input:checked + .slider:before {
  transform: translateX(18px);
}
`;
      document.head.appendChild(style);
    }

    createPanel() {
      if (this.panel) return this.panel;
      this.panel = document.createElement('div');
      this.panel.className = 'proxy-settings-wrapper';
      this.panel.innerHTML = `
        <div class="settings-container">
          <div class="settings-header">
            <h2>🔒 代理设置</h2>
          </div>
          
          <div class="settings-content">
            <!-- 基础设置 -->
            <div class="settings-section">
              <h3>📡 代理配置</h3>
              
              <div class="setting-item">
                <label class="setting-label">
                  <label class="switch">
                    <input type="checkbox" id="proxyEnabled">
                    <span class="slider"></span>
                  </label>
                  <span class="setting-title">启用代理</span>
                </label>
                <p class="setting-desc">为此账号启用网络代理</p>
              </div>
              
              <div id="proxyFields" style="display: none;">
                <div class="setting-item">
                  <label class="setting-title">选择代理</label>
                  <div class="setting-input-group">
                    <select id="proxySelect" class="setting-select">
                      <option value="">选择已保存的代理配置</option>
                    </select>
                    <button id="refreshProxyList" class="setting-button secondary" title="刷新列表">🔄</button>
                  </div>
                  <p class="setting-desc">从已保存的配置中选择，或手动填写下方信息</p>
                </div>
                
                <div class="setting-item">
                  <label class="setting-title">代理协议</label>
                  <select id="proxyProtocol" class="setting-select">
                    <option value="socks5">SOCKS5</option>
                    <option value="http">HTTP</option>
                    <option value="https">HTTPS</option>
                  </select>
                  <p class="setting-desc">选择代理服务器协议类型</p>
                </div>
                
                <div class="setting-item">
                  <label class="setting-title">代理主机</label>
                  <input type="text" id="proxyHost" class="setting-input" placeholder="例如: 127.0.0.1">
                  <p class="setting-desc">代理服务器的 IP 地址或域名</p>
                </div>
                
                <div class="setting-item">
                  <label class="setting-title">代理端口</label>
                  <input type="number" id="proxyPort" class="setting-input" placeholder="例如: 1080" min="1" max="65535">
                  <p class="setting-desc">代理服务器的端口号 (1-65535)</p>
                </div>
                
                <div class="setting-item">
                  <label class="setting-label">
                    <label class="switch">
                      <input type="checkbox" id="proxyAuthEnabled">
                      <span class="slider"></span>
                    </label>
                    <span class="setting-title">需要身份验证</span>
                  </label>
                  <p class="setting-desc">代理服务器需要用户名和密码</p>
                </div>
                
                <div id="proxyAuthFields" style="display: none;">
                  <div class="setting-item">
                    <label class="setting-title">用户名</label>
                    <input type="text" id="proxyUsername" class="setting-input" placeholder="代理用户名">
                  </div>
                  
                  <div class="setting-item">
                    <label class="setting-title">密码</label>
                    <div class="password-input-wrapper">
                      <input type="password" id="proxyPassword" class="setting-input" placeholder="代理密码">
                      <button type="button" id="togglePassword" class="password-toggle" title="显示/隐藏密码">👁️</button>
                    </div>
                  </div>
                </div>
                
                <div class="setting-item">
                  <label class="setting-title">绕过代理的地址 (可选)</label>
                  <input type="text" id="proxyBypass" class="setting-input" placeholder="例如: localhost,127.0.0.1">
                  <p class="setting-desc">不使用代理的地址列表，用逗号分隔</p>
                </div>
                
                <div class="setting-item">
                  <label class="setting-title">智能填写</label>
                  <textarea id="smartFillInput" class="setting-textarea" placeholder="粘贴代理信息到此处，自动识别&#10;支持格式:&#10;- protocol://host:port&#10;- host:port:username:password&#10;- protocol://username:password@host:port&#10;- JSON 格式" rows="3"></textarea>
                  <p class="setting-desc">粘贴代理信息后自动解析并填充上方字段</p>
                </div>
                
                <div class="setting-item">
                  <div class="button-group">
                    <button id="testProxyBtn" class="setting-button secondary">🔍 检测代理服务</button>
                    <button id="testNetworkBtn" class="setting-button secondary">🌐 检测当前网络</button>
                  </div>
                </div>
                
                <div id="detectionResult" class="detection-result" style="display: none;">
                  <!-- 检测结果将动态插入这里 -->
                </div>
              </div>
            </div>
            
            <!-- 帮助信息 -->
            <div class="settings-section">
              <h3>💡 使用说明</h3>
              <div style="background: #f9fafb; border: 1px dashed #e5e7eb; padding: 12px; border-radius: 8px; font-size: 13px; color: #374151; line-height: 1.6;">
                <p style="margin: 0 0 8px 0;"><strong>代理协议说明：</strong></p>
                <ul style="margin: 0; padding-left: 20px;">
                  <li><strong>SOCKS5</strong>: 最常用的代理协议，支持 TCP 和 UDP</li>
                  <li><strong>HTTP/HTTPS</strong>: 适用于 Web 浏览的代理协议</li>
                </ul>
                <p style="margin: 12px 0 8px 0;"><strong>注意事项：</strong></p>
                <ul style="margin: 0; padding-left: 20px;">
                  <li>修改代理设置后需要重启账号才能生效</li>
                  <li>请确保代理服务器地址和端口正确</li>
                  <li>如果连接失败，请检查代理服务器是否正常运行</li>
                </ul>
              </div>
            </div>
          </div>
          
          <div class="settings-footer">
            <button id="generateConfigBtn" class="setting-button secondary">💾 一键生成结构</button>
            <button id="resetProxyBtn" class="setting-button secondary">重置设置</button>
            <button id="saveProxyBtn" class="setting-button primary">应用设置</button>
          </div>
        </div>
      `;
      this.host.innerHTML = '';
      this.host.appendChild(this.panel);
      return this.panel;
    }

    bindEvents() {
      const proxyEnabled = this.panel.querySelector('#proxyEnabled');
      proxyEnabled?.addEventListener('change', () => {
        this.toggleProxyFields();
      });

      const proxyAuthEnabled = this.panel.querySelector('#proxyAuthEnabled');
      proxyAuthEnabled?.addEventListener('change', () => {
        this.toggleProxyAuthFields();
      });

      // 代理选择
      this.panel.querySelector('#proxySelect')?.addEventListener('change', (e) => {
        this.selectProxy(e.target.value);
      });

      // 刷新代理列表
      this.panel.querySelector('#refreshProxyList')?.addEventListener('click', () => {
        this.refreshProxyList();
      });

      // 密码可见性切换
      this.panel.querySelector('#togglePassword')?.addEventListener('click', () => {
        this.togglePasswordVisibility();
      });

      // 智能填写
      this.panel.querySelector('#smartFillInput')?.addEventListener('input', (e) => {
        if (e.target.value.trim()) {
          this.parseSmartFill(e.target.value);
        }
      });

      // 检测按钮
      this.panel.querySelector('#testProxyBtn')?.addEventListener('click', () => {
        this.testProxyService();
      });

      this.panel.querySelector('#testNetworkBtn')?.addEventListener('click', () => {
        this.testCurrentNetwork();
      });

      // 一键生成
      this.panel.querySelector('#generateConfigBtn')?.addEventListener('click', () => {
        this.generateProxyConfig();
      });

      this.panel.querySelector('#saveProxyBtn')?.addEventListener('click', () => {
        this.saveSettings();
      });

      this.panel.querySelector('#resetProxyBtn')?.addEventListener('click', () => {
        this.resetSettings();
      });
    }

    toggleProxyFields() {
      const enabled = this.panel.querySelector('#proxyEnabled').checked;
      const fields = this.panel.querySelector('#proxyFields');
      if (fields) {
        fields.style.display = enabled ? 'block' : 'none';
      }
    }

    toggleProxyAuthFields() {
      const enabled = this.panel.querySelector('#proxyAuthEnabled').checked;
      const fields = this.panel.querySelector('#proxyAuthFields');
      if (fields) {
        fields.style.display = enabled ? 'block' : 'none';
      }
    }

    setPlaceholderVisible(visible) {
      if (!this.placeholderEl) return;
      this.placeholderEl.style.display = visible ? 'block' : 'none';
      if (this.host) {
        // 控制设置内容host的可见性
        this.host.style.display = visible ? 'none' : 'block';
      }
    }

    async setAccount(accountId) {
      this.accountId = accountId;
      if (!accountId) {
        this.config = cloneDefaultConfig();
        this.setPlaceholderVisible(true);
        return;
      }
      this.setPlaceholderVisible(false);
      await this.loadSettings();
    }

    async loadSettings() {
      try {
        if (!window.electronAPI) {
          throw new Error('electronAPI 未初始化');
        }
        const response = await window.electronAPI.invoke('get-account', this.accountId);
        if (response && response.proxy) {
          this.config = response.proxy;
        } else {
          this.config = cloneDefaultConfig();
        }
        this.updateUI();
      } catch (error) {
        console.error('[ProxySettingsPanel] loadSettings error:', error);
        this.showMessage('加载配置失败：' + error.message, 'error');
      }
    }

    updateUI() {
      if (!this.config || !this.panel) return;

      this.panel.querySelector('#proxyEnabled').checked = !!this.config.enabled;
      this.panel.querySelector('#proxyProtocol').value = this.config.protocol || 'socks5';
      this.panel.querySelector('#proxyHost').value = this.config.host || '';
      this.panel.querySelector('#proxyPort').value = this.config.port || '';
      this.panel.querySelector('#proxyBypass').value = this.config.bypass || '';

      const hasAuth = this.config.username || this.config.password;
      this.panel.querySelector('#proxyAuthEnabled').checked = hasAuth;
      this.panel.querySelector('#proxyUsername').value = this.config.username || '';
      this.panel.querySelector('#proxyPassword').value = this.config.password || '';

      this.toggleProxyFields();
      this.toggleProxyAuthFields();
    }

    async saveSettings() {
      try {
        if (!this.accountId) {
          throw new Error('请先选择账号');
        }

        const newConfig = this.collectConfigFromUI();

        // 验证配置
        if (newConfig.enabled) {
          if (!newConfig.host) {
            throw new Error('请填写代理主机地址');
          }
          if (!newConfig.port || newConfig.port < 1 || newConfig.port > 65535) {
            throw new Error('请填写有效的代理端口 (1-65535)');
          }
        }

        // 获取完整账号信息
        const account = await window.electronAPI.invoke('get-account', this.accountId);
        if (!account) {
          throw new Error('账号不存在');
        }

        // 更新代理配置
        account.proxy = newConfig;

        const response = await window.electronAPI.invoke('update-account', this.accountId, account);
        if (response.success) {
          this.config = newConfig;
          this.showMessage('代理设置已保存，重启账号后生效', 'success');
        } else {
          this.showMessage('保存失败：' + (response.error || '未知错误'), 'error');
        }
      } catch (error) {
        console.error('[ProxySettingsPanel] saveSettings error:', error);
        this.showMessage('保存失败：' + error.message, 'error');
      }
    }

    collectConfigFromUI() {
      const enabled = this.panel.querySelector('#proxyEnabled').checked;
      const authEnabled = this.panel.querySelector('#proxyAuthEnabled').checked;

      return {
        enabled: enabled,
        protocol: this.panel.querySelector('#proxyProtocol').value,
        host: this.panel.querySelector('#proxyHost').value.trim(),
        port: parseInt(this.panel.querySelector('#proxyPort').value, 10) || 0,
        username: authEnabled ? this.panel.querySelector('#proxyUsername').value.trim() : '',
        password: authEnabled ? this.panel.querySelector('#proxyPassword').value : '',
        bypass: this.panel.querySelector('#proxyBypass').value.trim()
      };
    }

    resetSettings() {
      if (confirm('确定要重置代理设置吗？')) {
        this.config = cloneDefaultConfig();
        this.updateUI();
      }
    }

    showMessage(message, type = 'info') {
      const msgEl = document.createElement('div');
      msgEl.className = `settings-message ${type}`;
      msgEl.textContent = message;
      this.panel.appendChild(msgEl);
      setTimeout(() => msgEl.remove(), 3000);
    }

    // ============================================================================
    // 新增功能方法
    // ============================================================================

    /**
     * 加载代理列表
     */
    async loadProxyList() {
      try {
        if (!window.proxyAPI) {
          console.warn('[ProxySettingsPanel] proxyAPI not available');
          return;
        }

        const response = await window.proxyAPI.getAllConfigs();
        if (response.success) {
          this.proxyConfigs = response.configs || [];
          this.updateProxySelect();
        }
      } catch (error) {
        console.error('[ProxySettingsPanel] loadProxyList error:', error);
      }
    }

    /**
     * 更新代理选择下拉框
     */
    updateProxySelect() {
      const select = this.panel.querySelector('#proxySelect');
      if (!select) return;

      // 清空现有选项
      select.innerHTML = '<option value="">选择已保存的代理配置</option>';

      // 添加代理配置选项
      this.proxyConfigs.forEach(config => {
        const option = document.createElement('option');
        option.value = config.id;
        option.textContent = config.name;
        select.appendChild(option);
      });
    }

    /**
     * 选择代理配置
     */
    async selectProxy(proxyId) {
      if (!proxyId) return;

      try {
        const config = this.proxyConfigs.find(c => c.id === proxyId);
        if (!config) return;

        // 填充表单
        this.panel.querySelector('#proxyProtocol').value = config.protocol;
        this.panel.querySelector('#proxyHost').value = config.host;
        this.panel.querySelector('#proxyPort').value = config.port;

        if (config.username || config.password) {
          this.panel.querySelector('#proxyAuthEnabled').checked = true;
          this.panel.querySelector('#proxyUsername').value = config.username || '';
          this.panel.querySelector('#proxyPassword').value = config.password || '';
          this.toggleProxyAuthFields();
        }

        this.showMessage('已加载代理配置：' + config.name, 'success');
      } catch (error) {
        console.error('[ProxySettingsPanel] selectProxy error:', error);
        this.showMessage('加载代理配置失败', 'error');
      }
    }

    /**
     * 刷新代理列表
     */
    async refreshProxyList() {
      await this.loadProxyList();
      this.showMessage('代理列表已刷新', 'success');
    }

    /**
     * 切换密码可见性
     */
    togglePasswordVisibility() {
      const passwordInput = this.panel.querySelector('#proxyPassword');
      const toggleBtn = this.panel.querySelector('#togglePassword');

      if (passwordInput.type === 'password') {
        passwordInput.type = 'text';
        toggleBtn.textContent = '🙈';
      } else {
        passwordInput.type = 'password';
        toggleBtn.textContent = '👁️';
      }
    }

    /**
     * 解析智能填写
     */
    parseSmartFill(text) {
      // 使用防抖，避免频繁解析
      if (this.parseTimeout) {
        clearTimeout(this.parseTimeout);
      }

      this.parseTimeout = setTimeout(async () => {
        try {
          // 这里我们在前端简单实现解析逻辑
          const trimmed = text.trim();

          // 尝试解析 protocol://host:port
          let match = trimmed.match(/^(socks5|http|https):\/\/([^:@]+):(\d+)$/i);
          if (match) {
            this.panel.querySelector('#proxyProtocol').value = match[1].toLowerCase();
            this.panel.querySelector('#proxyHost').value = match[2];
            this.panel.querySelector('#proxyPort').value = match[3];
            this.panel.querySelector('#smartFillInput').value = '';
            this.showMessage('已自动填充代理信息', 'success');
            return;
          }

          // 尝试解析 protocol://username:password@host:port
          match = trimmed.match(/^(socks5|http|https):\/\/([^:@]+):([^@]+)@([^:]+):(\d+)$/i);
          if (match) {
            this.panel.querySelector('#proxyProtocol').value = match[1].toLowerCase();
            this.panel.querySelector('#proxyUsername').value = match[2];
            this.panel.querySelector('#proxyPassword').value = match[3];
            this.panel.querySelector('#proxyHost').value = match[4];
            this.panel.querySelector('#proxyPort').value = match[5];
            this.panel.querySelector('#proxyAuthEnabled').checked = true;
            this.toggleProxyAuthFields();
            this.panel.querySelector('#smartFillInput').value = '';
            this.showMessage('已自动填充代理信息（含认证）', 'success');
            return;
          }

          // 尝试解析 host:port:username:password
          const parts = trimmed.split(':');
          if (parts.length === 4) {
            this.panel.querySelector('#proxyHost').value = parts[0];
            this.panel.querySelector('#proxyPort').value = parts[1];
            this.panel.querySelector('#proxyUsername').value = parts[2];
            this.panel.querySelector('#proxyPassword').value = parts[3];
            this.panel.querySelector('#proxyAuthEnabled').checked = true;
            this.toggleProxyAuthFields();
            this.panel.querySelector('#smartFillInput').value = '';
            this.showMessage('已自动填充代理信息', 'success');
            return;
          }

          // 尝试解析 host:port
          if (parts.length === 2) {
            this.panel.querySelector('#proxyHost').value = parts[0];
            this.panel.querySelector('#proxyPort').value = parts[1];
            this.panel.querySelector('#smartFillInput').value = '';
            this.showMessage('已自动填充代理信息', 'success');
            return;
          }

          // 尝试解析 JSON
          try {
            const json = JSON.parse(trimmed);
            if (json.host && json.port) {
              if (json.protocol) this.panel.querySelector('#proxyProtocol').value = json.protocol;
              this.panel.querySelector('#proxyHost').value = json.host;
              this.panel.querySelector('#proxyPort').value = json.port;
              if (json.username) {
                this.panel.querySelector('#proxyUsername').value = json.username;
                this.panel.querySelector('#proxyAuthEnabled').checked = true;
              }
              if (json.password) {
                this.panel.querySelector('#proxyPassword').value = json.password;
                this.panel.querySelector('#proxyAuthEnabled').checked = true;
              }
              this.toggleProxyAuthFields();
              this.panel.querySelector('#smartFillInput').value = '';
              this.showMessage('已自动填充代理信息', 'success');
              return;
            }
          } catch (e) {
            // 不是 JSON 格式
          }

        } catch (error) {
          console.error('[ProxySettingsPanel] parseSmartFill error:', error);
        }
      }, 500);
    }

    /**
     * 测试代理服务
     */
    async testProxyService() {
      try {
        if (!window.proxyAPI) {
          throw new Error('proxyAPI 未初始化');
        }

        const config = {
          protocol: this.panel.querySelector('#proxyProtocol').value,
          host: this.panel.querySelector('#proxyHost').value.trim(),
          port: parseInt(this.panel.querySelector('#proxyPort').value, 10),
          username: this.panel.querySelector('#proxyUsername').value.trim(),
          password: this.panel.querySelector('#proxyPassword').value
        };

        // 验证必填字段
        if (!config.host || !config.port) {
          throw new Error('请填写代理主机和端口');
        }

        // 显示加载状态
        const btn = this.panel.querySelector('#testProxyBtn');
        btn.classList.add('loading');
        btn.disabled = true;

        const result = await window.proxyAPI.testService(config);

        btn.classList.remove('loading');
        btn.disabled = false;

        this.displayDetectionResult(result);
      } catch (error) {
        console.error('[ProxySettingsPanel] testProxyService error:', error);
        const btn = this.panel.querySelector('#testProxyBtn');
        btn.classList.remove('loading');
        btn.disabled = false;
        this.showMessage('检测失败：' + error.message, 'error');
      }
    }

    /**
     * 测试当前网络
     */
    async testCurrentNetwork() {
      try {
        console.log('[ProxySettingsPanel] 开始测试当前网络');

        if (!window.proxyAPI) {
          throw new Error('proxyAPI 未初始化');
        }

        // 显示加载状态
        const btn = this.panel.querySelector('#testNetworkBtn');
        btn.classList.add('loading');
        btn.disabled = true;

        console.log('[ProxySettingsPanel] 调用 proxyAPI.testNetwork()');
        const result = await window.proxyAPI.testNetwork();
        console.log('[ProxySettingsPanel] 收到检测结果:', result);

        btn.classList.remove('loading');
        btn.disabled = false;

        this.displayDetectionResult(result);
      } catch (error) {
        console.error('[ProxySettingsPanel] testCurrentNetwork error:', error);
        const btn = this.panel.querySelector('#testNetworkBtn');
        btn.classList.remove('loading');
        btn.disabled = false;
        this.showMessage('检测失败：' + error.message, 'error');
      }
    }

    /**
     * 显示检测结果
     */
    displayDetectionResult(result) {
      console.log('[ProxySettingsPanel] 显示检测结果:', result);

      const resultEl = this.panel.querySelector('#detectionResult');
      if (!resultEl) {
        console.warn('[ProxySettingsPanel] 找不到检测结果元素');
        return;
      }

      if (result.success) {
        console.log('[ProxySettingsPanel] 检测成功，显示结果');
        resultEl.className = 'detection-result';
        resultEl.innerHTML = `
          <div class="result-item">
            <span class="result-label">IP 地址:</span>
            <span class="result-value">${result.ip || 'N/A'}</span>
          </div>
          <div class="result-item">
            <span class="result-label">位置:</span>
            <span class="result-value">${result.location || 'Unknown'}</span>
          </div>
          <div class="result-item">
            <span class="result-label">国家:</span>
            <span class="result-value">${result.country || 'Unknown'} (${result.countryCode || 'N/A'})</span>
          </div>
          <div class="result-item">
            <span class="result-label">响应时间:</span>
            <span class="result-value">${result.responseTime || 'N/A'} ms</span>
          </div>
        `;
      } else {
        console.log('[ProxySettingsPanel] 检测失败，显示错误');
        resultEl.className = 'detection-result error';
        resultEl.innerHTML = `
          <div class="result-item">
            <span class="result-label">错误:</span>
            <span class="result-value">${result.error || '未知错误'}</span>
          </div>
        `;
      }

      resultEl.style.display = 'block';
      this.detectionResult = result;
    }

    /**
     * 一键生成配置
     */
    async generateProxyConfig() {
      try {
        if (!window.proxyAPI) {
          throw new Error('proxyAPI 未初始化');
        }

        const config = {
          protocol: this.panel.querySelector('#proxyProtocol').value,
          host: this.panel.querySelector('#proxyHost').value.trim(),
          port: parseInt(this.panel.querySelector('#proxyPort').value, 10),
          username: this.panel.querySelector('#proxyUsername').value.trim(),
          password: this.panel.querySelector('#proxyPassword').value
        };

        // 验证必填字段
        if (!config.host || !config.port) {
          throw new Error('请填写代理主机和端口');
        }

        // 生成配置名称
        const nameResponse = await window.proxyAPI.generateName(config);
        if (!nameResponse.success) {
          throw new Error('生成配置名称失败');
        }

        config.name = nameResponse.name;

        // 保存配置
        const saveResponse = await window.proxyAPI.saveConfig(config);
        if (!saveResponse.success) {
          throw new Error(saveResponse.errors ? saveResponse.errors.join(', ') : '保存失败');
        }

        // 刷新列表
        await this.loadProxyList();

        this.showMessage('代理配置已保存：' + config.name, 'success');
      } catch (error) {
        console.error('[ProxySettingsPanel] generateProxyConfig error:', error);
        this.showMessage('保存失败：' + error.message, 'error');
      }
    }
  }

  window.ProxySettingsPanel = ProxySettingsPanel;
})();
