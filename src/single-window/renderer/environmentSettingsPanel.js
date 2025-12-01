/**
 * 环境设置面板 - 代理和指纹配置
 * 
 * 为每个账号提供独立的代理和浏览器指纹配置界面
 */

(function () {
  'use strict';

  // 当前活动账号ID
  let currentAccountId = null;

  // 当前配置
  let currentConfig = null;

  // 已保存的代理配置
  let savedProxyConfigs = {};

  // DOM元素
  let container = null;

  /**
   * 初始化环境设置面板
   */
  function init() {
    container = document.getElementById('environment-settings-host');
    if (!container) {
      console.error('[EnvironmentPanel] 找不到容器元素 #environment-settings-host');
      return;
    }

    renderPanelContent();
    setupEventListeners();
    console.log('[EnvironmentPanel] 环境设置面板已初始化');
  }

  /**
   * 渲染面板内容
   */
  function renderPanelContent() {
    container.innerHTML = `
      <div class="env-panel-body">
        <!-- 代理设置区域 -->
        <section class="env-section">
          <h3 class="env-section-title">
            <span>代理设置</span>
            <label class="env-toggle">
              <input type="checkbox" id="proxy-enabled">
              <span class="env-toggle-slider"></span>
            </label>
          </h3>

          <div class="env-section-content" id="proxy-content">
            <!-- 选择已保存的代理 -->
            <div class="env-form-group">
              <label>选择代理配置</label>
              <div class="env-input-group">
                <select id="proxy-select">
                  <option value="">-- 新建代理配置 --</option>
                </select>
                <button class="env-btn-icon" id="refresh-proxy-list" title="刷新列表">🔄</button>
                <button class="env-btn-icon" id="delete-proxy-btn" title="删除配置" style="display: none; color: #ff4d4f;">🗑️</button>
              </div>
            </div>

            <!-- 代理协议 -->
            <div class="env-form-group">
              <label>协议</label>
              <select id="proxy-protocol">
                <option value="http">HTTP</option>
                <option value="https">HTTPS</option>
                <option value="socks5">SOCKS5</option>
              </select>
            </div>

            <!-- 主机和端口 -->
            <div class="env-form-row">
              <div class="env-form-group">
                <label>主机</label>
                <input type="text" id="proxy-host" placeholder="例如: 192.168.1.1">
              </div>
              <div class="env-form-group" style="width: 120px;">
                <label>端口</label>
                <input type="number" id="proxy-port" placeholder="8080" min="1" max="65535">
              </div>
            </div>

            <!-- 用户名和密码 -->
            <div class="env-form-row">
              <div class="env-form-group">
                <label>用户名（可选）</label>
                <input type="text" id="proxy-username" placeholder="用户名">
              </div>
              <div class="env-form-group">
                <label>密码（可选）</label>
                <div class="env-password-group">
                  <input type="password" id="proxy-password" placeholder="密码">
                  <button class="env-btn-icon" id="toggle-password" title="显示/隐藏密码">👁</button>
                </div>
              </div>
            </div>

            <!-- 智能填写 -->
            <div class="env-form-group">
              <label>智能填写（粘贴格式: IP:端口:用户名:密码）</label>
              <textarea id="proxy-smart-paste" rows="2" placeholder="例如: 192.168.1.1:8080:user:pass"></textarea>
              <button class="env-btn-secondary" id="parse-proxy-btn">解析并填充</button>
            </div>

            <!-- 操作按钮 -->
            <div class="env-button-group">
              <button class="env-btn-primary" id="test-proxy-btn">检测代理服务</button>
              <button class="env-btn-secondary" id="detect-network-btn">检测当前网络</button>
              <button class="env-btn-secondary" id="save-proxy-config-btn">保存为配置</button>
            </div>

            <!-- 检测结果 -->
            <div class="env-result-box hidden" id="proxy-result"></div>
          </div>
        </section>

        <!-- 指纹设置区域 -->
        <section class="env-section">
          <h3 class="env-section-title">指纹设置</h3>

          <div class="env-section-content">
            <!-- 浏览器和系统 -->
            <div class="env-form-row">
              <div class="env-form-group">
                <label>浏览器</label>
                <select id="fp-browser">
                  <option value="chrome-108">Chrome 108</option>
                  <option value="chrome-110">Chrome 110</option>
                  <option value="chrome-115">Chrome 115</option>
                  <option value="edge-110">Edge 110</option>
                  <option value="firefox-115">Firefox 115</option>
                </select>
              </div>
              <div class="env-form-group">
                <label>操作系统</label>
                <select id="fp-os">
                  <option value="windows">Windows</option>
                  <option value="macos">MacOS</option>
                </select>
              </div>
            </div>

            <!-- User Agent -->
            <div class="env-form-group">
              <label>User Agent</label>
              <div class="env-input-group">
                <input type="text" id="fp-user-agent" placeholder="自动生成">
                <button class="env-btn-icon" id="generate-ua-btn" title="随机生成">🎲</button>
              </div>
            </div>

            <!-- WebGL 设置 -->
            <div class="env-collapsible">
              <button class="env-collapsible-header">WebGL 设置</button>
              <div class="env-collapsible-content">
                <div class="env-form-group">
                  <label>模式</label>
                  <select id="fp-webgl-mode">
                    <option value="real">真实</option>
                    <option value="custom">自定义</option>
                  </select>
                </div>
                <div class="env-form-group">
                  <label>厂商</label>
                  <input type="text" id="fp-webgl-vendor" placeholder="Google Inc.">
                </div>
                <div class="env-form-group">
                  <label>渲染器</label>
                  <input type="text" id="fp-webgl-renderer" placeholder="ANGLE (Intel...)">
                </div>
                <div class="env-form-group">
                  <label>WebGL 图像</label>
                  <select id="fp-webgl-image">
                    <option value="random">随机</option>
                    <option value="real">真实</option>
                  </select>
                </div>
              </div>
            </div>

            <!-- Canvas & Audio -->
            <div class="env-collapsible">
              <button class="env-collapsible-header">Canvas & Audio</button>
              <div class="env-collapsible-content">
                <div class="env-form-row">
                  <div class="env-form-group">
                    <label>Canvas</label>
                    <select id="fp-canvas">
                      <option value="random">随机</option>
                      <option value="real">真实</option>
                    </select>
                  </div>
                  <div class="env-form-group">
                    <label>Audio</label>
                    <select id="fp-audio">
                      <option value="random">随机</option>
                      <option value="real">真实</option>
                    </select>
                  </div>
                </div>
                <div class="env-form-group">
                  <label>ClientRects</label>
                  <select id="fp-client-rects">
                    <option value="random">随机</option>
                    <option value="real">真实</option>
                  </select>
                </div>
              </div>
            </div>

            <!-- 环境属性 -->
            <div class="env-collapsible">
              <button class="env-collapsible-header">环境属性</button>
              <div class="env-collapsible-content">
                <div class="env-form-group">
                  <label>时区</label>
                  <select id="fp-timezone-mode">
                    <option value="auto">基于IP自动</option>
                    <option value="real">真实</option>
                    <option value="custom">自定义</option>
                  </select>
                  <input type="text" id="fp-timezone-value" placeholder="Asia/Shanghai" class="hidden">
                </div>
                <div class="env-form-group">
                  <label>语言</label>
                  <select id="fp-language-mode">
                    <option value="auto">基于IP自动</option>
                    <option value="custom">自定义</option>
                  </select>
                  <input type="text" id="fp-language-value" placeholder="zh-CN,zh;q=0.9" class="hidden">
                </div>
                <div class="env-form-group">
                  <label>分辨率</label>
                  <select id="fp-resolution-mode">
                    <option value="real">真实</option>
                    <option value="custom">自定义</option>
                  </select>
                  <div id="fp-resolution-custom" class="env-form-row hidden">
                    <input type="number" id="fp-resolution-width" placeholder="1920" style="width: 100px;">
                    <span>×</span>
                    <input type="number" id="fp-resolution-height" placeholder="1080" style="width: 100px;">
                  </div>
                </div>
              </div>
            </div>

            <!-- 设备信息 -->
            <div class="env-collapsible">
              <button class="env-collapsible-header">设备信息</button>
              <div class="env-collapsible-content">
                <div class="env-form-group">
                  <label>CPU 核心数</label>
                  <select id="fp-cpu-mode">
                    <option value="real">真实</option>
                    <option value="custom">自定义</option>
                  </select>
                  <select id="fp-cpu-cores" class="hidden">
                    <option value="2">2核</option>
                    <option value="4">4核</option>
                    <option value="8">8核</option>
                    <option value="16">16核</option>
                  </select>
                </div>
                <div class="env-form-group">
                  <label>内存大小</label>
                  <select id="fp-memory-mode">
                    <option value="real">真实</option>
                    <option value="custom">自定义</option>
                  </select>
                  <select id="fp-memory-size" class="hidden">
                    <option value="2">2GB</option>
                    <option value="4">4GB</option>
                    <option value="8">8GB</option>
                    <option value="16">16GB</option>
                    <option value="32">32GB</option>
                  </select>
                </div>
              </div>
            </div>

            <!-- Cookie 管理 -->
            <div class="env-collapsible">
              <button class="env-collapsible-header">Cookie 管理</button>
              <div class="env-collapsible-content">
                <div class="env-form-group">
                  <label>Cookie JSON（格式: [{"name":"xx","value":"yy","domain":"zz"}]）</label>
                  <textarea id="fp-cookies" rows="4" placeholder='[{"name":"session","value":"abc123","domain":".example.com"}]'></textarea>
                </div>
              </div>
            </div>

            <!-- 全局操作 -->
            <div class="env-button-group">
              <button class="env-btn-primary" id="generate-fingerprint-btn">🎲 一键生成指纹</button>
            </div>
          </div>
        </section>
      </div>

      <div class="env-panel-footer">
        <button class="env-btn-primary" id="apply-btn">应用并保存</button>
      </div>
    `;
  }

  /**
   * 设置事件监听器
   */
  function setupEventListeners() {
    // 代理启用开关
    const proxyEnabled = container.querySelector('#proxy-enabled');
    const proxyContent = container.querySelector('#proxy-content');
    proxyEnabled.addEventListener('change', (e) => {
      proxyContent.classList.toggle('disabled', !e.target.checked);
    });

    // 代理选择
    container.querySelector('#proxy-select').addEventListener('change', handleProxySelect);
    container.querySelector('#refresh-proxy-list').addEventListener('click', loadProxyConfigs);
    container.querySelector('#delete-proxy-btn').addEventListener('click', deleteProxyConfig);

    // 密码显示/隐藏
    container.querySelector('#toggle-password').addEventListener('click', togglePasswordVisibility);

    // 智能解析代理
    container.querySelector('#parse-proxy-btn').addEventListener('click', parseProxyString);

    // 代理操作按钮
    container.querySelector('#test-proxy-btn').addEventListener('click', testProxy);
    container.querySelector('#detect-network-btn').addEventListener('click', detectNetwork);
    container.querySelector('#save-proxy-config-btn').addEventListener('click', saveProxyConfig);

    // 指纹生成
    container.querySelector('#generate-ua-btn').addEventListener('click', generateUserAgent);
    container.querySelector('#generate-fingerprint-btn').addEventListener('click', generateFingerprint);

    // 折叠面板
    container.querySelectorAll('.env-collapsible-header').forEach(header => {
      header.addEventListener('click', () => {
        header.parentElement.classList.toggle('active');
      });
    });

    // 条件显示字段
    setupConditionalFields();

    // 应用按钮
    container.querySelector('#apply-btn').addEventListener('click', applyConfig);


  }

  /**
   * 设置条件显示的字段
   */
  function setupConditionalFields() {
    // 时区模式
    container.querySelector('#fp-timezone-mode').addEventListener('change', (e) => {
      const valueInput = container.querySelector('#fp-timezone-value');
      valueInput.classList.toggle('hidden', e.target.value !== 'custom');
    });

    // 语言模式
    container.querySelector('#fp-language-mode').addEventListener('change', (e) => {
      const valueInput = container.querySelector('#fp-language-value');
      valueInput.classList.toggle('hidden', e.target.value !== 'custom');
    });

    // 分辨率模式
    container.querySelector('#fp-resolution-mode').addEventListener('change', (e) => {
      const customDiv = container.querySelector('#fp-resolution-custom');
      customDiv.classList.toggle('hidden', e.target.value !== 'custom');
    });

    // CPU模式
    container.querySelector('#fp-cpu-mode').addEventListener('change', (e) => {
      const coresSelect = container.querySelector('#fp-cpu-cores');
      coresSelect.classList.toggle('hidden', e.target.value !== 'custom');
    });

    // 内存模式
    container.querySelector('#fp-memory-mode').addEventListener('change', (e) => {
      const sizeSelect = container.querySelector('#fp-memory-size');
      sizeSelect.classList.toggle('hidden', e.target.value !== 'custom');
    });
  }

  /**
   * 设置当前账号
   */
  async function setAccount(accountId) {
    if (!accountId) {
      currentAccountId = null;
      currentConfig = null;
      return;
    }

    currentAccountId = accountId;

    // 加载账号配置
    await loadAccountConfig(accountId);

    // 加载代理配置列表
    await loadProxyConfigs();

    console.log(`[EnvironmentPanel] 已加载账号 ${accountId} 的环境设置`);
  }

  // 兼容旧的 open 接口，但现在只是切换账号
  async function open(accountId) {
    await setAccount(accountId);
  }

  /**
   * 加载账号配置
   */
  async function loadAccountConfig(accountId) {
    if (!window.electronAPI) return;

    try {
      const result = await window.electronAPI.getEnvironmentConfig(accountId);

      if (result.success && result.config) {
        currentConfig = result.config;
        populateForm(result.config);
        console.log('[EnvironmentPanel] 已加载配置:', result.config);
      } else {
        console.warn('[EnvironmentPanel] 加载配置失败:', result.error);
      }
    } catch (error) {
      console.error('[EnvironmentPanel] 加载配置错误:', error);
    }
  }

  /**
   * 填充表单
   */
  function populateForm(config) {
    // 代理设置
    if (config.proxy) {
      container.querySelector('#proxy-enabled').checked = config.proxy.enabled || false;
      container.querySelector('#proxy-content').classList.toggle('disabled', !config.proxy.enabled);
      container.querySelector('#proxy-protocol').value = config.proxy.protocol || 'http';
      container.querySelector('#proxy-host').value = config.proxy.host || '';
      container.querySelector('#proxy-port').value = config.proxy.port || '';
      container.querySelector('#proxy-username').value = config.proxy.username || '';
      container.querySelector('#proxy-password').value = config.proxy.password || '';
    }

    // 指纹设置
    if (config.fingerprint) {
      const fp = config.fingerprint;

      container.querySelector('#fp-browser').value = fp.browser || 'chrome-108';
      container.querySelector('#fp-os').value = fp.os || 'windows';
      container.querySelector('#fp-user-agent').value = fp.userAgent || '';

      // WebGL
      if (fp.webgl) {
        container.querySelector('#fp-webgl-mode').value = fp.webgl.mode || 'real';
        container.querySelector('#fp-webgl-vendor').value = fp.webgl.vendor || '';
        container.querySelector('#fp-webgl-renderer').value = fp.webgl.renderer || '';
        container.querySelector('#fp-webgl-image').value = fp.webgl.image || 'real';
      }

      // Canvas & Audio
      container.querySelector('#fp-canvas').value = fp.canvas || 'real';
      container.querySelector('#fp-audio').value = fp.audio || 'real';
      container.querySelector('#fp-client-rects').value = fp.clientRects || 'real';

      // 时区
      if (fp.timezone) {
        container.querySelector('#fp-timezone-mode').value = fp.timezone.mode || 'real';
        container.querySelector('#fp-timezone-value').value = fp.timezone.value || '';
        container.querySelector('#fp-timezone-value').classList.toggle('hidden', fp.timezone.mode !== 'custom');
      }

      // 语言
      if (fp.language) {
        container.querySelector('#fp-language-mode').value = fp.language.mode || 'real';
        container.querySelector('#fp-language-value').value = fp.language.value || '';
        container.querySelector('#fp-language-value').classList.toggle('hidden', fp.language.mode !== 'custom');
      }

      // 分辨率
      if (fp.resolution) {
        container.querySelector('#fp-resolution-mode').value = fp.resolution.mode || 'real';
        container.querySelector('#fp-resolution-width').value = fp.resolution.width || 1920;
        container.querySelector('#fp-resolution-height').value = fp.resolution.height || 1080;
        container.querySelector('#fp-resolution-custom').classList.toggle('hidden', fp.resolution.mode !== 'custom');
      }

      // CPU
      if (fp.deviceInfo && fp.deviceInfo.cpu) {
        container.querySelector('#fp-cpu-mode').value = fp.deviceInfo.cpu.mode || 'real';
        container.querySelector('#fp-cpu-cores').value = fp.deviceInfo.cpu.cores || 8;
        container.querySelector('#fp-cpu-cores').classList.toggle('hidden', fp.deviceInfo.cpu.mode !== 'custom');
      }

      // 内存
      if (fp.deviceInfo && fp.deviceInfo.memory) {
        container.querySelector('#fp-memory-mode').value = fp.deviceInfo.memory.mode || 'real';
        container.querySelector('#fp-memory-size').value = fp.deviceInfo.memory.size || 16;
        container.querySelector('#fp-memory-size').classList.toggle('hidden', fp.deviceInfo.memory.mode !== 'custom');
      }

      // Cookies
      if (fp.cookies && fp.cookies.length > 0) {
        container.querySelector('#fp-cookies').value = JSON.stringify(fp.cookies, null, 2);
      }
    }
  }

  /**
   * 从表单收集配置
   */
  function collectFormData() {
    const config = {
      proxy: {
        enabled: container.querySelector('#proxy-enabled').checked,
        protocol: container.querySelector('#proxy-protocol').value,
        host: container.querySelector('#proxy-host').value,
        port: container.querySelector('#proxy-port').value,
        username: container.querySelector('#proxy-username').value,
        password: container.querySelector('#proxy-password').value
      },
      fingerprint: {
        browser: container.querySelector('#fp-browser').value,
        os: container.querySelector('#fp-os').value,
        userAgent: container.querySelector('#fp-user-agent').value,
        webgl: {
          mode: container.querySelector('#fp-webgl-mode').value,
          vendor: container.querySelector('#fp-webgl-vendor').value,
          renderer: container.querySelector('#fp-webgl-renderer').value,
          image: container.querySelector('#fp-webgl-image').value
        },
        webrtc: {
          mode: 'real'
        },
        canvas: container.querySelector('#fp-canvas').value,
        audio: container.querySelector('#fp-audio').value,
        clientRects: container.querySelector('#fp-client-rects').value,
        timezone: {
          mode: container.querySelector('#fp-timezone-mode').value,
          value: container.querySelector('#fp-timezone-value').value
        },
        geolocation: {
          mode: 'ask',
          latitude: null,
          longitude: null
        },
        language: {
          mode: container.querySelector('#fp-language-mode').value,
          value: container.querySelector('#fp-language-value').value
        },
        resolution: {
          mode: container.querySelector('#fp-resolution-mode').value,
          width: parseInt(container.querySelector('#fp-resolution-width').value) || 1920,
          height: parseInt(container.querySelector('#fp-resolution-height').value) || 1080
        },
        fonts: {
          mode: 'system'
        },
        deviceInfo: {
          name: { mode: 'real', value: '' },
          mac: { mode: 'real', value: '' },
          cpu: {
            mode: container.querySelector('#fp-cpu-mode').value,
            cores: parseInt(container.querySelector('#fp-cpu-cores').value) || 8
          },
          memory: {
            mode: container.querySelector('#fp-memory-mode').value,
            size: parseInt(container.querySelector('#fp-memory-size').value) || 16
          }
        },
        hardware: {
          bluetooth: true,
          battery: 'real',
          portScanProtection: true
        },
        cookies: []
      }
    };

    // 解析 Cookies
    const cookiesText = container.querySelector('#fp-cookies').value.trim();
    if (cookiesText) {
      try {
        config.fingerprint.cookies = JSON.parse(cookiesText);
      } catch (error) {
        console.warn('[EnvironmentPanel] Cookie JSON 解析失败:', error);
      }
    }

    return config;
  }

  /**
   * 应用配置
   */
  async function applyConfig() {
    console.log('[EnvironmentPanel] applyConfig called');
    if (!window.electronAPI) {
      console.error('[EnvironmentPanel] electronAPI not available');
      return;
    }

    if (!currentAccountId) {
      console.error('[EnvironmentPanel] No account selected');
      showError('请先选择一个账号');
      return;
    }

    const config = collectFormData();

    try {
      const result = await window.electronAPI.saveEnvironmentConfig(currentAccountId, config);

      if (result.success) {
        showSuccess('配置已保存成功！');
        setTimeout(() => closePanel(), 1500);
      } else {
        showError('保存失败: ' + (result.error || '未知错误'));
      }
    } catch (error) {
      console.error('[EnvironmentPanel] 保存配置错误:', error);
      showError('保存失败: ' + error.message);
    }
  }

  /**
   * 加载代理配置列表
   */
  async function loadProxyConfigs() {
    if (!window.electronAPI) return;

    try {
      const result = await window.electronAPI.getProxyConfigs();

      if (result.success && result.configs) {
        savedProxyConfigs = result.configs; // Save to module scope
        const select = container.querySelector('#proxy-select');
        select.innerHTML = '<option value="">-- 新建代理配置 --</option>';

        Object.keys(result.configs).forEach(name => {
          const option = document.createElement('option');
          option.value = name;
          option.textContent = name;
          select.appendChild(option);
        });
      }
    } catch (error) {
      console.error('[EnvironmentPanel] 加载代理配置列表失败:', error);
    }
  }

  /**
   * 处理代理选择
   */
  function handleProxySelect(e) {
    const name = e.target.value;
    const deleteBtn = container.querySelector('#delete-proxy-btn');

    if (!name) {
      // Reset form if "New Proxy Config" is selected
      container.querySelector('#proxy-protocol').value = 'http';
      container.querySelector('#proxy-host').value = '';
      container.querySelector('#proxy-port').value = '';
      container.querySelector('#proxy-username').value = '';
      container.querySelector('#proxy-password').value = '';
      deleteBtn.style.display = 'none';
      return;
    }

    const config = savedProxyConfigs[name];
    if (config) {
      container.querySelector('#proxy-protocol').value = config.protocol || 'http';
      container.querySelector('#proxy-host').value = config.host || '';
      container.querySelector('#proxy-port').value = config.port || '';
      container.querySelector('#proxy-username').value = config.username || '';
      container.querySelector('#proxy-password').value = config.password || '';
      deleteBtn.style.display = 'inline-block';
      showSuccess(`已加载配置: ${name}`);
    }
  }

  /**
   * 删除当前选中的代理配置
   */
  async function deleteProxyConfig() {
    const select = container.querySelector('#proxy-select');
    const name = select.value;

    if (!name) return;

    // 使用内嵌确认框
    showInlineConfirm(`确定要删除代理配置 "${name}" 吗？`, async (confirmed) => {
      if (!confirmed) return;

      try {
        const result = await window.electronAPI.deleteNamedProxy(name);

        if (result.success) {
          showSuccess(`配置 "${name}" 已删除`);
          // Reset form
          select.value = "";
          handleProxySelect({ target: select });
          // Reload list
          await loadProxyConfigs();
        } else {
          showError('删除失败: ' + (result.error || '未知错误'));
        }
      } catch (error) {
        console.error('[EnvironmentPanel] 删除配置失败:', error);
        showError('删除失败: ' + error.message);
      }
    });
  }

  /**
   * 显示内嵌确认框
   */
  function showInlineConfirm(message, callback) {
    const buttonsGroup = container.querySelector('.env-button-group');
    const originalDisplay = buttonsGroup.style.display;
    buttonsGroup.style.display = 'none';

    const confirmContainer = document.createElement('div');
    confirmContainer.style.cssText = `
      padding: 15px;
      background: #fff3e0;
      border: 2px solid #ff9800;
      border-radius: 8px;
      margin-bottom: 15px;
    `;

    confirmContainer.innerHTML = `
      <div style="margin-bottom: 15px; font-weight: bold; color: #ff6f00;">⚠️ ${message}</div>
      <div style="text-align: right;">
        <button id="confirm-no" style="padding: 6px 16px; margin-right: 8px; border: 1px solid #ddd; background: white; border-radius: 4px; cursor: pointer;">取消</button>
        <button id="confirm-yes" style="padding: 6px 16px; border: none; background: #ff4d4f; color: white; border-radius: 4px; cursor: pointer;">删除</button>
      </div>
    `;

    buttonsGroup.parentNode.insertBefore(confirmContainer, buttonsGroup);

    const yesBtn = confirmContainer.querySelector('#confirm-yes');
    const noBtn = confirmContainer.querySelector('#confirm-no');

    const cleanup = () => {
      confirmContainer.remove();
      buttonsGroup.style.display = originalDisplay;
    };

    const handleYes = () => {
      cleanup();
      callback(true);
    };

    const handleNo = () => {
      cleanup();
      callback(false);
    };

    yesBtn.addEventListener('click', handleYes);
    noBtn.addEventListener('click', handleNo);

    confirmContainer.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        handleNo();
      }
    });

    // 聚焦取消按钮（安全选项）
    setTimeout(() => noBtn.focus(), 100);
  }

  /**
   * 显示确认对话框
   */
  function showConfirmDialog(message) {
    return new Promise((resolve) => {
      const overlay = document.createElement('div');
      overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        width: 100vw;
        height: 100vh;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 999999;
        pointer-events: auto;
      `;

      const dialog = document.createElement('div');
      dialog.style.cssText = `
        background: white;
        padding: 20px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        min-width: 300px;
        max-width: 400px;
        pointer-events: auto;
      `;

      dialog.innerHTML = `
        <div style="margin-bottom: 20px; font-size: 14px; color: #333;">${message}</div>
        <div style="text-align: right;">
          <button id="confirm-cancel" style="padding: 6px 16px; margin-right: 8px; border: 1px solid #ddd; background: white; border-radius: 4px; cursor: pointer;">取消</button>
          <button id="confirm-ok" style="padding: 6px 16px; border: none; background: #ff4d4f; color: white; border-radius: 4px; cursor: pointer;">删除</button>
        </div>
      `;

      overlay.appendChild(dialog);

      // IMPORTANT: Append to document.body, not container
      const targetElement = document.body || document.documentElement;
      targetElement.appendChild(overlay);

      const okBtn = dialog.querySelector('#confirm-ok');
      const cancelBtn = dialog.querySelector('#confirm-cancel');

      const handleOk = () => {
        targetElement.removeChild(overlay);
        resolve(true);
      };

      const handleCancel = () => {
        targetElement.removeChild(overlay);
        resolve(false);
      };

      okBtn.addEventListener('click', handleOk);
      cancelBtn.addEventListener('click', handleCancel);

      overlay.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          handleCancel();
        }
      });
    });
  }

  /**
   * 切换密码可见性
   */
  function togglePasswordVisibility() {
    const input = container.querySelector('#proxy-password');
    const btn = container.querySelector('#toggle-password');

    if (input.type === 'password') {
      input.type = 'text';
      btn.textContent = '🙈';
    } else {
      input.type = 'password';
      btn.textContent = '👁';
    }
  }

  /**
   * 解析代理字符串
   */
  async function parseProxyString() {
    if (!window.electronAPI) return;

    const proxyString = container.querySelector('#proxy-smart-paste').value.trim();
    if (!proxyString) {
      showError('请输入代理字符串');
      return;
    }

    try {
      const result = await window.electronAPI.parseProxyString(proxyString);

      if (result.success && result.config) {
        const config = result.config;
        container.querySelector('#proxy-protocol').value = config.protocol || 'http';
        container.querySelector('#proxy-host').value = config.host || '';
        container.querySelector('#proxy-port').value = config.port || '';
        container.querySelector('#proxy-username').value = config.username || '';
        container.querySelector('#proxy-password').value = config.password || '';

        showSuccess('代理信息已自动填充！');
      } else {
        showError('解析失败: ' + (result.error || '格式不正确'));
      }
    } catch (error) {
      console.error('[EnvironmentPanel] 解析代理字符串失败:', error);
      showError('解析失败: ' + error.message);
    }
  }

  /**
   * 测试代理
   */
  async function testProxy() {
    if (!window.electronAPI) return;

    const proxyConfig = {
      protocol: container.querySelector('#proxy-protocol').value,
      host: container.querySelector('#proxy-host').value,
      port: container.querySelector('#proxy-port').value,
      username: container.querySelector('#proxy-username').value,
      password: container.querySelector('#proxy-password').value
    };

    if (!proxyConfig.host || !proxyConfig.port) {
      showError('请先填写代理主机和端口');
      return;
    }

    showLoading('正在测试代理连接...');

    try {
      const result = await window.electronAPI.testProxy(proxyConfig);

      if (result.success) {
        const html = `
          <div class="env-result-success">
            <h4>✓ 代理连接成功</h4>
            <p><strong>IP地址:</strong> ${result.ip}</p>
            <p><strong>位置:</strong> ${result.location.city}, ${result.location.country}</p>
            <p><strong>时区:</strong> ${result.timezone}</p>
            <p><strong>语言:</strong> ${result.language}</p>
            <p><strong>延迟:</strong> ${result.latency}ms</p>
            <p><strong>ISP:</strong> ${result.isp}</p>
          </div>
        `;
        showResult(html);
      } else {
        showError('代理连接失败: ' + (result.error || '未知错误'));
      }
    } catch (error) {
      console.error('[EnvironmentPanel] 测试代理失败:', error);
      showError('测试失败: ' + error.message);
    }
  }

  /**
   * 检测当前网络
   */
  async function detectNetwork() {
    if (!window.electronAPI) return;

    showLoading('正在检测当前网络...');

    try {
      const result = await window.electronAPI.detectNetwork();

      if (result.success) {
        const html = `
          <div class="env-result-success">
            <h4>当前网络信息</h4>
            <p><strong>IP地址:</strong> ${result.ip}</p>
            <p><strong>位置:</strong> ${result.location.city}, ${result.location.country}</p>
            <p><strong>时区:</strong> ${result.timezone}</p>
            <p><strong>语言:</strong> ${result.language}</p>
            <p><strong>ISP:</strong> ${result.isp}</p>
          </div>
        `;
        showResult(html);
      } else {
        showError('检测失败: ' + (result.error || '未知错误'));
      }
    } catch (error) {
      console.error('[EnvironmentPanel] 检测网络失败:', error);
      showError('检测失败: ' + error.message);
    }
  }

  /**
   * 保存代理配置
   */
  async function saveProxyConfig() {
    console.log('[EnvironmentPanel] saveProxyConfig called');

    if (!window.electronAPI) {
      console.error('[EnvironmentPanel] electronAPI not available');
      showError('系统错误: electronAPI 不可用');
      return;
    }

    // 显示内嵌输入框
    showInlineInput('请输入代理配置名称:', async (name) => {
      if (!name || name.trim() === '') {
        console.log('[EnvironmentPanel] No name entered, aborting');
        return;
      }

      const proxyConfig = {
        protocol: container.querySelector('#proxy-protocol').value,
        host: container.querySelector('#proxy-host').value,
        port: container.querySelector('#proxy-port').value,
        username: container.querySelector('#proxy-username').value,
        password: container.querySelector('#proxy-password').value
      };

      console.log('[EnvironmentPanel] Proxy config to save:', proxyConfig);

      try {
        console.log('[EnvironmentPanel] Calling electronAPI.saveProxyConfig...');
        const result = await window.electronAPI.saveProxyConfig(name.trim(), proxyConfig);
        console.log('[EnvironmentPanel] Save result:', result);

        if (result.success) {
          showSuccess(`代理配置 "${name}" 已保存！`);
          await loadProxyConfigs();
        } else {
          showError('保存失败: ' + (result.error || '未知错误'));
        }
      } catch (error) {
        console.error('[EnvironmentPanel] 保存代理配置失败:', error);
        showError('保存失败: ' + error.message);
      }
    });
  }

  /**
   * 显示内嵌输入框（在面板内部显示，不会被遮挡）
   */
  function showInlineInput(message, callback) {
    // 隐藏所有按钮和表单
    const buttonsGroup = container.querySelector('.env-button-group');
    const originalDisplay = buttonsGroup.style.display;
    buttonsGroup.style.display = 'none';

    // 创建输入区域
    const inputContainer = document.createElement('div');
    inputContainer.style.cssText = `
      padding: 15px;
      background: #f0f8ff;
      border: 2px solid #1890ff;
      border-radius: 8px;
      margin-bottom: 15px;
    `;

    inputContainer.innerHTML = `
      <div style="margin-bottom: 10px; font-weight: bold; color: #1890ff;">${message}</div>
      <input type="text" id="inline-input" 
             style="width: 100%; padding: 8px; border: 1px solid #1890ff; border-radius: 4px; font-size: 14px; box-sizing: border-box; margin-bottom: 10px;">
      <div style="text-align: right;">
        <button id="inline-cancel" style="padding: 6px 16px; margin-right: 8px; border: 1px solid #ddd; background: white; border-radius: 4px; cursor: pointer;">取消</button>
        <button id="inline-ok" style="padding: 6px 16px; border: none; background: #1890ff; color: white; border-radius: 4px; cursor: pointer;">确定</button>
      </div>
    `;

    // 插入到按钮组前面
    buttonsGroup.parentNode.insertBefore(inputContainer, buttonsGroup);

    const input = inputContainer.querySelector('#inline-input');
    const okBtn = inputContainer.querySelector('#inline-ok');
    const cancelBtn = inputContainer.querySelector('#inline-cancel');

    // 聚焦输入框
    setTimeout(() => {
      input.focus();
      input.select();
    }, 100);

    const cleanup = () => {
      inputContainer.remove();
      buttonsGroup.style.display = originalDisplay;
    };

    const handleOk = () => {
      const value = input.value;
      cleanup();
      callback(value);
    };

    const handleCancel = () => {
      cleanup();
    };

    okBtn.addEventListener('click', handleOk);
    cancelBtn.addEventListener('click', handleCancel);

    input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        handleOk();
      }
    });

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        handleCancel();
      }
    });
  }

  /**
   * 显示输入对话框（替代 prompt，因为 Electron 不支持）
   */
  function showInputDialog(message, defaultValue = '') {
    return new Promise((resolve) => {
      const overlay = document.createElement('div');
      overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        width: 100vw;
        height: 100vh;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 999999;
        pointer-events: auto;
      `;

      const dialog = document.createElement('div');
      dialog.style.cssText = `
        background: white;
        padding: 20px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        min-width: 300px;
        max-width: 400px;
        pointer-events: auto;
      `;

      dialog.innerHTML = `
        <div style="margin-bottom: 15px; font-size: 14px; color: #333;">${message}</div>
        <input type="text" id="dialog-input" value="${defaultValue}" 
               style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px; box-sizing: border-box;">
        <div style="margin-top: 15px; text-align: right;">
          <button id="dialog-cancel" style="padding: 6px 16px; margin-right: 8px; border: 1px solid #ddd; background: white; border-radius: 4px; cursor: pointer;">取消</button>
          <button id="dialog-ok" style="padding: 6px 16px; border: none; background: #1890ff; color: white; border-radius: 4px; cursor: pointer;">确定</button>
        </div>
      `;

      overlay.appendChild(dialog);

      // IMPORTANT: Append to document.body, not container
      // This ensures it appears above the WhatsApp Web BrowserView
      const targetElement = document.body || document.documentElement;
      targetElement.appendChild(overlay);

      const input = dialog.querySelector('#dialog-input');
      const okBtn = dialog.querySelector('#dialog-ok');
      const cancelBtn = dialog.querySelector('#dialog-cancel');

      setTimeout(() => {
        input.focus();
        input.select();
      }, 100);

      const handleOk = () => {
        const value = input.value;
        targetElement.removeChild(overlay);
        resolve(value);
      };

      const handleCancel = () => {
        targetElement.removeChild(overlay);
        resolve(null);
      };

      okBtn.addEventListener('click', handleOk);
      cancelBtn.addEventListener('click', handleCancel);

      input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          handleOk();
        }
      });

      overlay.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          handleCancel();
        }
      });
    });
  }

  /**
   * 生成 User Agent
   */
  async function generateUserAgent() {
    const browser = container.querySelector('#fp-browser').value;
    const os = container.querySelector('#fp-os').value;

    if (!window.electronAPI) return;

    try {
      const result = await window.electronAPI.generateFingerprint({ browser, os });

      if (result.success && result.fingerprint) {
        container.querySelector('#fp-user-agent').value = result.fingerprint.userAgent;
        showSuccess('User Agent 已生成！');
      }
    } catch (error) {
      console.error('[EnvironmentPanel] 生成 UA 失败:', error);
    }
  }

  /**
   * 一键生成指纹
   */
  async function generateFingerprint() {
    if (!window.electronAPI) return;

    const browser = container.querySelector('#fp-browser').value;
    const os = container.querySelector('#fp-os').value;

    showLoading('正在生成随机指纹...');

    try {
      const result = await window.electronAPI.generateFingerprint({ browser, os });

      if (result.success && result.fingerprint) {
        const fp = result.fingerprint;

        // 填充所有字段
        container.querySelector('#fp-user-agent').value = fp.userAgent;
        container.querySelector('#fp-webgl-vendor').value = fp.webgl.vendor;
        container.querySelector('#fp-webgl-renderer').value = fp.webgl.renderer;
        container.querySelector('#fp-resolution-width').value = fp.resolution.width;
        container.querySelector('#fp-resolution-height').value = fp.resolution.height;
        container.querySelector('#fp-cpu-cores').value = fp.deviceInfo.cpu.cores;
        container.querySelector('#fp-memory-size').value = fp.deviceInfo.memory.size;

        showSuccess('指纹已随机生成！');
      } else {
        showError('生成失败: ' + (result.error || '未知错误'));
      }
    } catch (error) {
      console.error('[EnvironmentPanel] 生成指纹失败:', error);
      showError('生成失败: ' + error.message);
    }
  }



  /**
   * 显示结果
   */
  function showResult(html) {
    const resultBox = container.querySelector('#proxy-result');
    resultBox.innerHTML = html;
    resultBox.classList.remove('hidden');
  }

  /**
   * 显示加载中
   */
  function showLoading(message) {
    const html = `<div class="env-result-loading">${message}</div>`;
    showResult(html);
  }

  /**
   * 显示成功消息
   */
  function showSuccess(message) {
    const html = `<div class="env-result-success">${message}</div>`;
    showResult(html);
    setTimeout(() => {
      container.querySelector('#proxy-result').classList.add('hidden');
    }, 3000);
  }

  /**
   * 显示错误消息
   */
  function showError(message) {
    const html = `<div class="env-result-error">❌ ${message}</div>`;
    showResult(html);
  }

  // Export to window
  window.EnvironmentSettingsPanel = {
    init,
    setAccount,
    open // Keep for backward compatibility if needed
  };

  // 页面加载完成后初始化
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
