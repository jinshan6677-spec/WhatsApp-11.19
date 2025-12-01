/**
 * 环境设置面板 - 代理配置
 * 
 * 为每个账号提供独立的代理配置界面
 * 
 * Note: 指纹设置UI已移除，作为专业指纹系统重构的一部分。
 * 新的指纹设置UI将在新指纹系统实现后添加。
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

        <!-- 指纹设置区域占位符 -->
        <!-- Note: 指纹设置UI已移除，作为专业指纹系统重构的一部分。
             新的指纹设置UI将在新指纹系统实现后添加到此处。
             TODO: 集成新的指纹设置UI -->
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

    // Note: 指纹生成事件监听器已移除，作为专业指纹系统重构的一部分
    // TODO: 新的指纹事件监听器将在新指纹系统实现后添加

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
   * Note: 指纹相关的条件字段已移除，作为专业指纹系统重构的一部分
   * TODO: 新的指纹条件字段将在新指纹系统实现后添加
   */
  function setupConditionalFields() {
    // 指纹相关的条件字段已移除
    // 新的指纹系统将在此处添加条件字段设置
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

    // Note: 指纹设置表单填充已移除，作为专业指纹系统重构的一部分
    // TODO: 新的指纹表单填充将在新指纹系统实现后添加
  }

  /**
   * 从表单收集配置
   * Note: 指纹配置收集已移除，作为专业指纹系统重构的一部分
   * TODO: 新的指纹配置收集将在新指纹系统实现后添加
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
      }
      // Note: fingerprint配置将在新指纹系统实现后添加
    };

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

  // Note: generateUserAgent和generateFingerprint函数已移除，作为专业指纹系统重构的一部分
  // TODO: 新的指纹生成函数将在新指纹系统实现后添加



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
