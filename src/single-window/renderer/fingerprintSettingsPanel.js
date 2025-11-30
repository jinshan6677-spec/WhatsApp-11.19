/**
 * Fingerprint Settings Panel
 * 
 * Provides UI for configuring browser fingerprint settings including:
 * - Browser/User-Agent selection
 * - WebGL configuration
 * - Canvas/Audio settings
 * - Environment attributes (timezone, language, geolocation)
 * - Device information (CPU, memory, screen)
 * - One-click fingerprint generation
 * 
 * Requirements: 15.1-15.6
 */

(function () {
  'use strict';

  const DEFAULT_FINGERPRINT_CONFIG = {
    userAgent: '',
    browserVersion: 'Chrome 120',
    platform: 'Windows',
    webgl: { vendor: '', renderer: '', mode: 'real' },
    canvas: { mode: 'real', noiseLevel: 1 },
    audio: { mode: 'real', noiseLevel: 1 },
    webrtc: { mode: 'disabled' },
    timezone: { mode: 'real' },
    geolocation: { mode: 'prompt' },
    language: { mode: 'custom', value: 'en-US' },
    screen: { mode: 'real', width: 1920, height: 1080 },
    hardware: { cpuCores: 8, memory: 16 },
    doNotTrack: null,
    battery: { mode: 'real' },
    fonts: { mode: 'system' },
    plugins: { mode: 'real' },
    mediaDevices: { mode: 'real' }
  };

  function cloneDefaultConfig() {
    return JSON.parse(JSON.stringify(DEFAULT_FINGERPRINT_CONFIG));
  }

  class FingerprintSettingsPanel {
    constructor(options = {}) {
      this.host = options.host || null;
      this.placeholderEl = options.placeholderEl || null;
      this.onCollapse = options.onCollapse || null;
      this.accountId = null;
      this.panel = null;
      this.config = cloneDefaultConfig();
      this.templates = [];
      this.isModified = false;
    }

    async init() {
      if (!this.host) {
        console.warn('[FingerprintSettingsPanel] host element not provided');
        return;
      }
      this.injectStyles();
      this.createPanel();
      this.bindEvents();
      await this.loadTemplates();
    }

    injectStyles() {
      if (document.getElementById('fingerprint-settings-styles')) {
        return;
      }
      const style = document.createElement('style');
      style.id = 'fingerprint-settings-styles';
      style.textContent = `
.fingerprint-settings-wrapper {
  width: 100%;
  height: 100%;
}

.fingerprint-settings-wrapper .settings-container {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  background: #ffffff;
  overflow: hidden;
}

.fingerprint-settings-wrapper .settings-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 18px;
  background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);
  color: #fff;
}

.fingerprint-settings-wrapper .settings-header h2 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
}

.fingerprint-settings-wrapper .settings-content {
  flex: 1;
  overflow-y: auto;
  padding: 0;
  background: #fafbff;
}

.fingerprint-settings-wrapper .settings-section {
  padding: 18px 20px;
  border-bottom: 1px solid #f1f3f7;
  background: #fff;
}

.fingerprint-settings-wrapper .settings-section h3 {
  margin: 0 0 12px 0;
  font-size: 15px;
  font-weight: 600;
  color: #111827;
}

.fingerprint-settings-wrapper .setting-item {
  margin-bottom: 14px;
}

.fingerprint-settings-wrapper .setting-item:last-child {
  margin-bottom: 0;
}

.fingerprint-settings-wrapper .setting-label {
  display: flex;
  align-items: center;
  gap: 10px;
  font-weight: 600;
  color: #111827;
}

.fingerprint-settings-wrapper .setting-title {
  font-size: 14px;
  font-weight: 500;
  color: #374151;
  margin-bottom: 4px;
}

.fingerprint-settings-wrapper .setting-desc {
  margin: 6px 0 0 0;
  font-size: 12px;
  color: #6b7280;
  line-height: 1.5;
}

.fingerprint-settings-wrapper .setting-select,
.fingerprint-settings-wrapper .setting-input {
  width: 100%;
  padding: 8px 10px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #fff;
  font-size: 13px;
  margin-top: 6px;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.fingerprint-settings-wrapper .setting-select:focus,
.fingerprint-settings-wrapper .setting-input:focus {
  outline: none;
  border-color: #6366f1;
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.25);
}

.fingerprint-settings-wrapper .setting-button {
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

.fingerprint-settings-wrapper .setting-button.primary {
  background: #6366f1;
  border-color: #6366f1;
  color: #fff;
}

.fingerprint-settings-wrapper .setting-button.primary:hover {
  background: #4f46e5;
  border-color: #4f46e5;
}

.fingerprint-settings-wrapper .setting-button.secondary {
  background: #fff;
}

.fingerprint-settings-wrapper .setting-button.secondary:hover {
  border-color: #6366f1;
  color: #4f46e5;
}

.fingerprint-settings-wrapper .settings-footer {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  padding: 14px 18px;
  border-top: 1px solid #f1f3f7;
  background: #fff;
}

.fingerprint-settings-wrapper .settings-footer .left-buttons {
  display: flex;
  gap: 10px;
}

.fingerprint-settings-wrapper .settings-footer .right-buttons {
  display: flex;
  gap: 10px;
}

.fingerprint-settings-wrapper .settings-message {
  position: absolute;
  right: 16px;
  bottom: 16px;
  padding: 10px 14px;
  border-radius: 8px;
  color: #111827;
  background: #e5f6ff;
  border: 1px solid #bae6fd;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  z-index: 100;
}

.fingerprint-settings-wrapper .settings-message.success {
  background: #ecfdf3;
  border-color: #bbf7d0;
}

.fingerprint-settings-wrapper .settings-message.error {
  background: #fef2f2;
  border-color: #fecdd3;
  color: #991b1b;
}

.fingerprint-settings-wrapper .setting-row {
  display: flex;
  gap: 12px;
  align-items: flex-start;
}

.fingerprint-settings-wrapper .setting-row > * {
  flex: 1;
}

.fingerprint-settings-wrapper .switch {
  position: relative;
  display: inline-block;
  width: 40px;
  height: 22px;
  flex-shrink: 0;
}

.fingerprint-settings-wrapper .switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

.fingerprint-settings-wrapper .slider {
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

.fingerprint-settings-wrapper .slider:before {
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

.fingerprint-settings-wrapper input:checked + .slider {
  background-color: #6366f1;
  border-color: #6366f1;
}

.fingerprint-settings-wrapper input:checked + .slider:before {
  transform: translateX(18px);
}

.fingerprint-settings-wrapper .modified-indicator {
  display: inline-block;
  width: 8px;
  height: 8px;
  background: #f59e0b;
  border-radius: 50%;
  margin-left: 8px;
}

.fingerprint-settings-wrapper .score-badge {
  display: inline-flex;
  align-items: center;
  padding: 4px 10px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
}

.fingerprint-settings-wrapper .score-badge.high {
  background: #ecfdf3;
  color: #065f46;
}

.fingerprint-settings-wrapper .score-badge.medium {
  background: #fef3c7;
  color: #92400e;
}

.fingerprint-settings-wrapper .score-badge.low {
  background: #fef2f2;
  color: #991b1b;
}
`;
      document.head.appendChild(style);
    }

    createPanel() {
      if (this.panel) return this.panel;
      this.panel = document.createElement('div');
      this.panel.className = 'fingerprint-settings-wrapper';
      this.panel.innerHTML = `
        <div class="settings-container">
          <div class="settings-header">
            <h2>🎭 指纹设置<span id="modifiedIndicator" class="modified-indicator" style="display:none;"></span></h2>
            <span id="fingerprintScore" class="score-badge high">评分: --</span>
          </div>
          
          <div class="settings-content">
            <!-- 浏览器设置 -->
            <div class="settings-section">
              <h3>🌐 浏览器设置</h3>
              
              <div class="setting-item">
                <label class="setting-title">浏览器版本</label>
                <select id="browserVersion" class="setting-select">
                  <option value="Chrome 120">Chrome 120</option>
                  <option value="Chrome 119">Chrome 119</option>
                  <option value="Chrome 118">Chrome 118</option>
                  <option value="Edge 120">Edge 120</option>
                  <option value="Firefox 121">Firefox 121</option>
                </select>
                <p class="setting-desc">选择要模拟的浏览器版本</p>
              </div>
              
              <div class="setting-item">
                <label class="setting-title">操作系统</label>
                <select id="platform" class="setting-select">
                  <option value="Windows">Windows</option>
                  <option value="MacOS">MacOS</option>
                  <option value="Linux">Linux</option>
                </select>
                <p class="setting-desc">选择要模拟的操作系统</p>
              </div>
              
              <div class="setting-item">
                <label class="setting-title">User-Agent</label>
                <input type="text" id="userAgent" class="setting-input" placeholder="自动生成或手动输入">
                <p class="setting-desc">浏览器标识字符串，留空则自动生成</p>
              </div>
            </div>
            
            <!-- WebGL 设置 -->
            <div class="settings-section">
              <h3>🎨 WebGL 设置</h3>
              
              <div class="setting-item">
                <label class="setting-title">WebGL 模式</label>
                <select id="webglMode" class="setting-select">
                  <option value="real">真实</option>
                  <option value="custom">自定义</option>
                  <option value="random">随机</option>
                </select>
                <p class="setting-desc">选择 WebGL 指纹处理方式</p>
              </div>
              
              <div id="webglCustomFields" style="display: none;">
                <div class="setting-item">
                  <label class="setting-title">WebGL 厂商</label>
                  <input type="text" id="webglVendor" class="setting-input" placeholder="例如: Google Inc. (NVIDIA)">
                </div>
                
                <div class="setting-item">
                  <label class="setting-title">WebGL 渲染器</label>
                  <input type="text" id="webglRenderer" class="setting-input" placeholder="例如: ANGLE (NVIDIA GeForce GTX 1060)">
                </div>
              </div>
            </div>
            
            <!-- Canvas/Audio 设置 -->
            <div class="settings-section">
              <h3>🖼️ Canvas / Audio 设置</h3>
              
              <div class="setting-row">
                <div class="setting-item">
                  <label class="setting-title">Canvas 模式</label>
                  <select id="canvasMode" class="setting-select">
                    <option value="real">真实</option>
                    <option value="random">随机噪点</option>
                  </select>
                </div>
                
                <div class="setting-item">
                  <label class="setting-title">Audio 模式</label>
                  <select id="audioMode" class="setting-select">
                    <option value="real">真实</option>
                    <option value="random">随机噪声</option>
                  </select>
                </div>
              </div>
              
              <div class="setting-item">
                <label class="setting-title">WebRTC 模式</label>
                <select id="webrtcMode" class="setting-select">
                  <option value="disabled">禁用 (推荐)</option>
                  <option value="replaced">替换 IP</option>
                  <option value="real">真实</option>
                </select>
                <p class="setting-desc">禁用可防止真实 IP 泄露</p>
              </div>
            </div>
            
            <!-- 环境属性 -->
            <div class="settings-section">
              <h3>🌍 环境属性</h3>
              
              <div class="setting-row">
                <div class="setting-item">
                  <label class="setting-title">时区</label>
                  <select id="timezoneMode" class="setting-select">
                    <option value="real">真实</option>
                    <option value="ip-based">基于 IP</option>
                    <option value="custom">自定义</option>
                  </select>
                </div>
                
                <div class="setting-item">
                  <label class="setting-title">语言</label>
                  <select id="languageMode" class="setting-select">
                    <option value="custom">自定义</option>
                    <option value="ip-based">基于 IP</option>
                  </select>
                </div>
              </div>
              
              <div id="customTimezone" class="setting-item" style="display: none;">
                <label class="setting-title">自定义时区</label>
                <select id="timezoneValue" class="setting-select">
                  <option value="America/New_York">America/New_York (UTC-5)</option>
                  <option value="America/Los_Angeles">America/Los_Angeles (UTC-8)</option>
                  <option value="Europe/London">Europe/London (UTC+0)</option>
                  <option value="Europe/Paris">Europe/Paris (UTC+1)</option>
                  <option value="Asia/Tokyo">Asia/Tokyo (UTC+9)</option>
                  <option value="Asia/Shanghai">Asia/Shanghai (UTC+8)</option>
                </select>
              </div>
              
              <div class="setting-item">
                <label class="setting-title">语言代码</label>
                <input type="text" id="languageValue" class="setting-input" placeholder="例如: en-US, zh-CN">
              </div>
              
              <div class="setting-item">
                <label class="setting-title">地理位置</label>
                <select id="geolocationMode" class="setting-select">
                  <option value="prompt">询问</option>
                  <option value="deny">禁止</option>
                  <option value="ip-based">基于 IP</option>
                </select>
              </div>
            </div>
            
            <!-- 设备信息 -->
            <div class="settings-section">
              <h3>💻 设备信息</h3>
              
              <div class="setting-row">
                <div class="setting-item">
                  <label class="setting-title">CPU 内核数</label>
                  <select id="cpuCores" class="setting-select">
                    <option value="2">2 核</option>
                    <option value="4">4 核</option>
                    <option value="8" selected>8 核</option>
                    <option value="16">16 核</option>
                  </select>
                </div>
                
                <div class="setting-item">
                  <label class="setting-title">内存大小</label>
                  <select id="memory" class="setting-select">
                    <option value="4">4 GB</option>
                    <option value="8">8 GB</option>
                    <option value="16" selected>16 GB</option>
                    <option value="32">32 GB</option>
                  </select>
                </div>
              </div>
              
              <div class="setting-row">
                <div class="setting-item">
                  <label class="setting-title">屏幕宽度</label>
                  <input type="number" id="screenWidth" class="setting-input" value="1920" min="800" max="3840">
                </div>
                
                <div class="setting-item">
                  <label class="setting-title">屏幕高度</label>
                  <input type="number" id="screenHeight" class="setting-input" value="1080" min="600" max="2160">
                </div>
              </div>
              
              <div class="setting-item">
                <label class="setting-title">Do Not Track</label>
                <select id="doNotTrack" class="setting-select">
                  <option value="null">未指定</option>
                  <option value="1">启用</option>
                  <option value="0">禁用</option>
                </select>
              </div>
            </div>
            
            <!-- 模板管理 -->
            <div class="settings-section">
              <h3>📋 模板管理</h3>
              
              <div class="setting-item">
                <label class="setting-title">从模板加载</label>
                <div class="setting-row">
                  <select id="templateSelect" class="setting-select">
                    <option value="">选择模板...</option>
                  </select>
                  <button id="loadTemplateBtn" class="setting-button secondary" style="flex: 0; min-width: 80px;">加载</button>
                </div>
              </div>
              
              <div class="setting-item">
                <label class="setting-title">保存为模板</label>
                <div class="setting-row">
                  <input type="text" id="templateName" class="setting-input" placeholder="输入模板名称">
                  <button id="saveTemplateBtn" class="setting-button secondary" style="flex: 0; min-width: 80px;">保存</button>
                </div>
              </div>
            </div>
            
            <!-- 随机化策略 -->
            <div class="settings-section">
              <h3>🎲 随机化策略</h3>
              
              <div class="setting-item">
                <label class="setting-title">指纹策略</label>
                <select id="fingerprintStrategy" class="setting-select">
                  <option value="fixed">固定指纹 - 每次启动使用相同配置</option>
                  <option value="random-on-start">每次启动随机 - 启动时生成新指纹</option>
                  <option value="periodic">定期更换 - 按设定间隔自动更换</option>
                  <option value="partial-random">部分随机 - 仅随机化选定参数</option>
                </select>
                <p class="setting-desc">选择指纹更新策略</p>
              </div>
              
              <div id="periodicIntervalField" class="setting-item" style="display: none;">
                <label class="setting-title">更换间隔（天）</label>
                <input type="number" id="periodicInterval" class="setting-input" value="7" min="1" max="365">
                <p class="setting-desc">指纹自动更换的间隔天数</p>
              </div>
              
              <div id="partialRandomFields" class="setting-item" style="display: none;">
                <label class="setting-title">随机化字段</label>
                <div style="display: flex; flex-direction: column; gap: 8px; margin-top: 8px;">
                  <label style="display: flex; align-items: center; gap: 8px; font-size: 13px;">
                    <input type="checkbox" id="randomCanvas" class="setting-checkbox"> Canvas 指纹
                  </label>
                  <label style="display: flex; align-items: center; gap: 8px; font-size: 13px;">
                    <input type="checkbox" id="randomAudio" class="setting-checkbox"> Audio 指纹
                  </label>
                  <label style="display: flex; align-items: center; gap: 8px; font-size: 13px;">
                    <input type="checkbox" id="randomWebGL" class="setting-checkbox"> WebGL 参数
                  </label>
                  <label style="display: flex; align-items: center; gap: 8px; font-size: 13px;">
                    <input type="checkbox" id="randomScreen" class="setting-checkbox"> 屏幕分辨率
                  </label>
                </div>
                <p class="setting-desc">选择需要随机化的指纹参数</p>
              </div>
            </div>
            
            
            <!-- 端口扫描保护 -->
            <div class="settings-section">
              <h3>🛡️ 端口扫描保护</h3>
              
              <div class="setting-item">
                <label class="setting-label">
                  <label class="switch">
                    <input type="checkbox" id="portScanProtection" checked>
                    <span class="slider"></span>
                  </label>
                  <span class="setting-title">启用端口扫描保护</span>
                </label>
                <p class="setting-desc">阻止网页扫描本地端口和敏感地址</p>
              </div>
              
              <div class="setting-item">
                <label class="setting-title">保护规则</label>
                <div style="display: flex; flex-direction: column; gap: 8px; margin-top: 8px;">
                  <label style="display: flex; align-items: center; gap: 8px; font-size: 13px;">
                    <input type="checkbox" id="blockLocalhost" class="setting-checkbox" checked> 阻止本地地址 (127.0.0.1, localhost)
                  </label>
                  <label style="display: flex; align-items: center; gap: 8px; font-size: 13px;">
                    <input type="checkbox" id="blockPrivateIP" class="setting-checkbox" checked> 阻止私有 IP (192.168.x.x, 10.x.x.x)
                  </label>
                  <label style="display: flex; align-items: center; gap: 8px; font-size: 13px;">
                    <input type="checkbox" id="blockSensitivePorts" class="setting-checkbox" checked> 阻止敏感端口 (22, 3389, 5900)
                  </label>
                </div>
              </div>
            </div>
          </div>
          
          <div class="settings-footer">
            <div class="left-buttons">
              <button id="generateFingerprintBtn" class="setting-button primary">🎲 一键生成指纹</button>
              <button id="detectFingerprintBtn" class="setting-button secondary">🔍 检测指纹</button>
            </div>
            <div class="right-buttons">
              <button id="resetFingerprintBtn" class="setting-button secondary">重置</button>
              <button id="saveFingerprintBtn" class="setting-button primary">应用</button>
            </div>
          </div>
        </div>
      `;
      this.host.innerHTML = '';
      this.host.appendChild(this.panel);
      return this.panel;
    }

    bindEvents() {
      // Browser settings
      this.panel.querySelector('#browserVersion')?.addEventListener('change', () => this.markModified());
      this.panel.querySelector('#platform')?.addEventListener('change', () => this.markModified());
      this.panel.querySelector('#userAgent')?.addEventListener('input', () => this.markModified());

      // WebGL settings
      this.panel.querySelector('#webglMode')?.addEventListener('change', (e) => {
        this.toggleWebGLFields();
        this.markModified();
      });
      this.panel.querySelector('#webglVendor')?.addEventListener('input', () => this.markModified());
      this.panel.querySelector('#webglRenderer')?.addEventListener('input', () => this.markModified());

      // Canvas/Audio settings
      this.panel.querySelector('#canvasMode')?.addEventListener('change', () => this.markModified());
      this.panel.querySelector('#audioMode')?.addEventListener('change', () => this.markModified());
      this.panel.querySelector('#webrtcMode')?.addEventListener('change', () => this.markModified());

      // Environment settings
      this.panel.querySelector('#timezoneMode')?.addEventListener('change', (e) => {
        this.toggleTimezoneField();
        this.markModified();
      });
      this.panel.querySelector('#languageMode')?.addEventListener('change', () => this.markModified());
      this.panel.querySelector('#languageValue')?.addEventListener('input', () => this.markModified());
      this.panel.querySelector('#geolocationMode')?.addEventListener('change', () => this.markModified());
      this.panel.querySelector('#timezoneValue')?.addEventListener('change', () => this.markModified());

      // Device settings
      this.panel.querySelector('#cpuCores')?.addEventListener('change', () => this.markModified());
      this.panel.querySelector('#memory')?.addEventListener('change', () => this.markModified());
      this.panel.querySelector('#screenWidth')?.addEventListener('input', () => this.markModified());
      this.panel.querySelector('#screenHeight')?.addEventListener('input', () => this.markModified());
      this.panel.querySelector('#doNotTrack')?.addEventListener('change', () => this.markModified());

      // Template management
      this.panel.querySelector('#loadTemplateBtn')?.addEventListener('click', () => this.loadTemplate());
      this.panel.querySelector('#saveTemplateBtn')?.addEventListener('click', () => this.saveTemplate());

      // Strategy settings
      this.panel.querySelector('#fingerprintStrategy')?.addEventListener('change', (e) => {
        this.toggleStrategyFields();
        this.markModified();
      });
      this.panel.querySelector('#periodicInterval')?.addEventListener('input', () => this.markModified());
      this.panel.querySelector('#randomCanvas')?.addEventListener('change', () => this.markModified());
      this.panel.querySelector('#randomAudio')?.addEventListener('change', () => this.markModified());
      this.panel.querySelector('#randomWebGL')?.addEventListener('change', () => this.markModified());
      this.panel.querySelector('#randomScreen')?.addEventListener('change', () => this.markModified());

      

      // Port scan protection
      this.panel.querySelector('#portScanProtection')?.addEventListener('change', () => this.markModified());
      this.panel.querySelector('#blockLocalhost')?.addEventListener('change', () => this.markModified());
      this.panel.querySelector('#blockPrivateIP')?.addEventListener('change', () => this.markModified());
      this.panel.querySelector('#blockSensitivePorts')?.addEventListener('change', () => this.markModified());

      // Action buttons
      this.panel.querySelector('#generateFingerprintBtn')?.addEventListener('click', () => this.generateFingerprint());
      this.panel.querySelector('#detectFingerprintBtn')?.addEventListener('click', () => this.detectFingerprint());
      this.panel.querySelector('#resetFingerprintBtn')?.addEventListener('click', () => this.resetSettings());
      this.panel.querySelector('#saveFingerprintBtn')?.addEventListener('click', () => this.saveSettings());
    }

    toggleWebGLFields() {
      const mode = this.panel.querySelector('#webglMode').value;
      const fields = this.panel.querySelector('#webglCustomFields');
      if (fields) {
        fields.style.display = mode === 'custom' ? 'block' : 'none';
      }
    }

    toggleTimezoneField() {
      const mode = this.panel.querySelector('#timezoneMode').value;
      const field = this.panel.querySelector('#customTimezone');
      if (field) {
        field.style.display = mode === 'custom' ? 'block' : 'none';
      }
    }

    toggleStrategyFields() {
      const strategy = this.panel.querySelector('#fingerprintStrategy').value;
      const periodicField = this.panel.querySelector('#periodicIntervalField');
      const partialFields = this.panel.querySelector('#partialRandomFields');
      
      if (periodicField) {
        periodicField.style.display = strategy === 'periodic' ? 'block' : 'none';
      }
      if (partialFields) {
        partialFields.style.display = strategy === 'partial-random' ? 'block' : 'none';
      }
    }

    

    markModified() {
      this.isModified = true;
      const indicator = this.panel.querySelector('#modifiedIndicator');
      if (indicator) {
        indicator.style.display = 'inline-block';
      }
    }

    clearModified() {
      this.isModified = false;
      const indicator = this.panel.querySelector('#modifiedIndicator');
      if (indicator) {
        indicator.style.display = 'none';
      }
    }

    setPlaceholderVisible(visible) {
      if (!this.placeholderEl) return;
      this.placeholderEl.style.display = visible ? 'block' : 'none';
      if (this.host) {
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
        if (!window.fingerprintAPI) {
          console.warn('[FingerprintSettingsPanel] fingerprintAPI not available');
          return;
        }

        const response = await window.fingerprintAPI.get(this.accountId);
        if (response.success && response.fingerprint) {
          this.config = response.fingerprint;
        } else {
          this.config = cloneDefaultConfig();
        }
        this.updateUI();
        this.clearModified();
        await this.updateScore();
      } catch (error) {
        console.error('[FingerprintSettingsPanel] loadSettings error:', error);
        this.showMessage('加载配置失败：' + error.message, 'error');
      }
    }

    async loadTemplates() {
      try {
        if (!window.fingerprintAPI) return;

        const response = await window.fingerprintAPI.getTemplates();
        if (response.success) {
          this.templates = response.templates || [];
          this.updateTemplateSelect();
        }
      } catch (error) {
        console.error('[FingerprintSettingsPanel] loadTemplates error:', error);
      }
    }

    updateTemplateSelect() {
      const select = this.panel.querySelector('#templateSelect');
      if (!select) return;

      select.innerHTML = '<option value="">选择模板...</option>';
      this.templates.forEach(template => {
        const option = document.createElement('option');
        option.value = template.name;
        option.textContent = `${template.name} (${template.platform})`;
        select.appendChild(option);
      });
    }

    updateUI() {
      if (!this.config || !this.panel) return;

      // Browser settings
      this.panel.querySelector('#browserVersion').value = this.config.browserVersion || 'Chrome 120';
      this.panel.querySelector('#platform').value = this.config.platform || 'Windows';
      this.panel.querySelector('#userAgent').value = this.config.userAgent || '';

      // WebGL settings
      this.panel.querySelector('#webglMode').value = this.config.webgl?.mode || 'real';
      this.panel.querySelector('#webglVendor').value = this.config.webgl?.vendor || '';
      this.panel.querySelector('#webglRenderer').value = this.config.webgl?.renderer || '';
      this.toggleWebGLFields();

      // Canvas/Audio settings
      this.panel.querySelector('#canvasMode').value = this.config.canvas?.mode || 'real';
      this.panel.querySelector('#audioMode').value = this.config.audio?.mode || 'real';
      this.panel.querySelector('#webrtcMode').value = this.config.webrtc?.mode || 'disabled';

      // Environment settings
      this.panel.querySelector('#timezoneMode').value = this.config.timezone?.mode || 'real';
      this.panel.querySelector('#timezoneValue').value = this.config.timezone?.value || 'America/New_York';
      this.panel.querySelector('#languageMode').value = this.config.language?.mode || 'custom';
      this.panel.querySelector('#languageValue').value = this.config.language?.value || 'en-US';
      this.panel.querySelector('#geolocationMode').value = this.config.geolocation?.mode || 'prompt';
      this.toggleTimezoneField();

      // Device settings
      this.panel.querySelector('#cpuCores').value = this.config.hardware?.cpuCores || 8;
      this.panel.querySelector('#memory').value = this.config.hardware?.memory || 16;
      this.panel.querySelector('#screenWidth').value = this.config.screen?.width || 1920;
      this.panel.querySelector('#screenHeight').value = this.config.screen?.height || 1080;
      
      const dnt = this.config.doNotTrack;
      this.panel.querySelector('#doNotTrack').value = dnt === null ? 'null' : dnt;
    }

    collectConfigFromUI() {
      const dntValue = this.panel.querySelector('#doNotTrack').value;
      
      return {
        userAgent: this.panel.querySelector('#userAgent').value.trim(),
        browserVersion: this.panel.querySelector('#browserVersion').value,
        platform: this.panel.querySelector('#platform').value,
        webgl: {
          mode: this.panel.querySelector('#webglMode').value,
          vendor: this.panel.querySelector('#webglVendor').value.trim(),
          renderer: this.panel.querySelector('#webglRenderer').value.trim()
        },
        canvas: {
          mode: this.panel.querySelector('#canvasMode').value,
          noiseLevel: 1
        },
        audio: {
          mode: this.panel.querySelector('#audioMode').value,
          noiseLevel: 1
        },
        webrtc: {
          mode: this.panel.querySelector('#webrtcMode').value
        },
        timezone: {
          mode: this.panel.querySelector('#timezoneMode').value,
          value: this.panel.querySelector('#timezoneValue').value
        },
        language: {
          mode: this.panel.querySelector('#languageMode').value,
          value: this.panel.querySelector('#languageValue').value.trim()
        },
        geolocation: {
          mode: this.panel.querySelector('#geolocationMode').value
        },
        screen: {
          mode: 'custom',
          width: parseInt(this.panel.querySelector('#screenWidth').value, 10) || 1920,
          height: parseInt(this.panel.querySelector('#screenHeight').value, 10) || 1080
        },
        hardware: {
          cpuCores: parseInt(this.panel.querySelector('#cpuCores').value, 10) || 8,
          memory: parseInt(this.panel.querySelector('#memory').value, 10) || 16
        },
        doNotTrack: dntValue === 'null' ? null : dntValue,
        battery: { mode: 'real' },
        fonts: { mode: 'system' },
        plugins: { mode: 'real' },
        mediaDevices: { mode: 'real' }
      };
    }

    async saveSettings() {
      try {
        if (!this.accountId) {
          throw new Error('请先选择账号');
        }

        const newConfig = this.collectConfigFromUI();

        // Validate configuration
        if (window.fingerprintAPI) {
          const validation = await window.fingerprintAPI.validate(newConfig);
          if (!validation.success || !validation.valid) {
            const errors = validation.errors || ['配置验证失败'];
            throw new Error(errors.join(', '));
          }
        }

        // Save configuration
        let response;
        if (this.config.id) {
          response = await window.fingerprintAPI.update(this.accountId, newConfig);
        } else {
          response = await window.fingerprintAPI.create(this.accountId, newConfig);
        }

        if (response.success) {
          this.config = response.fingerprint || newConfig;
          this.clearModified();
          await this.updateScore();
          this.showMessage('指纹配置已保存，重启账号后生效', 'success');
        } else {
          throw new Error(response.error?.message || '保存失败');
        }
      } catch (error) {
        console.error('[FingerprintSettingsPanel] saveSettings error:', error);
        this.showMessage('保存失败：' + error.message, 'error');
      }
    }

    resetSettings() {
      if (confirm('确定要重置指纹设置吗？')) {
        this.config = cloneDefaultConfig();
        this.updateUI();
        this.markModified();
      }
    }

    async generateFingerprint() {
      try {
        if (!window.fingerprintAPI) {
          throw new Error('fingerprintAPI 未初始化');
        }

        const btn = this.panel.querySelector('#generateFingerprintBtn');
        btn.disabled = true;
        btn.textContent = '生成中...';

        const platform = this.panel.querySelector('#platform').value;
        const response = await window.fingerprintAPI.generateRandom({ platform });

        btn.disabled = false;
        btn.textContent = '🎲 一键生成指纹';

        if (response.success && response.fingerprint) {
          this.config = response.fingerprint;
          this.updateUI();
          this.markModified();
          await this.updateScore();
          this.showMessage('已生成新的指纹配置', 'success');
        } else {
          throw new Error(response.error?.message || '生成失败');
        }
      } catch (error) {
        console.error('[FingerprintSettingsPanel] generateFingerprint error:', error);
        const btn = this.panel.querySelector('#generateFingerprintBtn');
        btn.disabled = false;
        btn.textContent = '🎲 一键生成指纹';
        this.showMessage('生成失败：' + error.message, 'error');
      }
    }

    async detectFingerprint() {
      try {
        if (!window.detectionAPI) {
          throw new Error('detectionAPI 未初始化');
        }

        const btn = this.panel.querySelector('#detectFingerprintBtn');
        btn.disabled = true;
        btn.textContent = '检测中...';

        const config = this.collectConfigFromUI();
        const response = await window.detectionAPI.getReport(config);

        btn.disabled = false;
        btn.textContent = '🔍 检测指纹';

        if (response.success && response.report) {
          const report = response.report;
          const message = `评分: ${report.score}/100\n风险等级: ${report.riskLevel}\n问题数: ${report.summary.totalIssues}`;
          alert(message);
          await this.updateScore();
        } else {
          throw new Error(response.error?.message || '检测失败');
        }
      } catch (error) {
        console.error('[FingerprintSettingsPanel] detectFingerprint error:', error);
        const btn = this.panel.querySelector('#detectFingerprintBtn');
        btn.disabled = false;
        btn.textContent = '🔍 检测指纹';
        this.showMessage('检测失败：' + error.message, 'error');
      }
    }

    async updateScore() {
      try {
        if (!window.detectionAPI) return;

        const config = this.collectConfigFromUI();
        const response = await window.detectionAPI.getScore(config);

        if (response.success) {
          const badge = this.panel.querySelector('#fingerprintScore');
          if (badge) {
            badge.textContent = `评分: ${response.score}`;
            badge.className = 'score-badge ' + response.riskLevel;
          }
        }
      } catch (error) {
        console.error('[FingerprintSettingsPanel] updateScore error:', error);
      }
    }

    async loadTemplate() {
      try {
        const select = this.panel.querySelector('#templateSelect');
        const templateName = select.value;

        if (!templateName) {
          this.showMessage('请选择一个模板', 'error');
          return;
        }

        if (!window.fingerprintAPI) {
          throw new Error('fingerprintAPI 未初始化');
        }

        const response = await window.fingerprintAPI.loadTemplate(templateName);

        if (response.success && response.template) {
          this.config = response.template;
          this.updateUI();
          this.markModified();
          await this.updateScore();
          this.showMessage('已加载模板：' + templateName, 'success');
        } else {
          throw new Error(response.error?.message || '加载失败');
        }
      } catch (error) {
        console.error('[FingerprintSettingsPanel] loadTemplate error:', error);
        this.showMessage('加载模板失败：' + error.message, 'error');
      }
    }

    async saveTemplate() {
      try {
        const input = this.panel.querySelector('#templateName');
        const templateName = input.value.trim();

        if (!templateName) {
          this.showMessage('请输入模板名称', 'error');
          return;
        }

        if (!window.fingerprintAPI) {
          throw new Error('fingerprintAPI 未初始化');
        }

        const config = this.collectConfigFromUI();
        const response = await window.fingerprintAPI.saveTemplate(templateName, config);

        if (response.success) {
          input.value = '';
          await this.loadTemplates();
          this.showMessage('模板已保存：' + templateName, 'success');
        } else {
          throw new Error(response.error?.message || '保存失败');
        }
      } catch (error) {
        console.error('[FingerprintSettingsPanel] saveTemplate error:', error);
        this.showMessage('保存模板失败：' + error.message, 'error');
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

  window.FingerprintSettingsPanel = FingerprintSettingsPanel;
})();
