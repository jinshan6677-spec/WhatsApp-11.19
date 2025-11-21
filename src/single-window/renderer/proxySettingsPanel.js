(function() {
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
    }

    async init() {
      if (!this.host) {
        console.warn('[ProxySettingsPanel] host element not provided');
        return;
      }
      this.injectStyles();
      this.createPanel();
      this.bindEvents();
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
                  <input type="checkbox" id="proxyEnabled" class="setting-checkbox">
                  <span class="setting-title">启用代理</span>
                </label>
                <p class="setting-desc">为此账号启用网络代理</p>
              </div>
              
              <div id="proxyFields" style="display: none;">
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
                    <input type="checkbox" id="proxyAuthEnabled" class="setting-checkbox">
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
                    <input type="password" id="proxyPassword" class="setting-input" placeholder="代理密码">
                  </div>
                </div>
                
                <div class="setting-item">
                  <label class="setting-title">绕过代理的地址 (可选)</label>
                  <input type="text" id="proxyBypass" class="setting-input" placeholder="例如: localhost,127.0.0.1">
                  <p class="setting-desc">不使用代理的地址列表，用逗号分隔</p>
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
            <button id="resetProxyBtn" class="setting-button secondary">重置设置</button>
            <button id="saveProxyBtn" class="setting-button primary">保存设置</button>
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
  }

  window.ProxySettingsPanel = ProxySettingsPanel;
})();
