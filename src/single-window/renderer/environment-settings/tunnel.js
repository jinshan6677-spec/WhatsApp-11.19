/**
 * Tunnel Settings Module
 *
 * Handles tunnel configuration UI and logic
 */

function container() {
  return window.EnvSettingsState.container;
}

async function loadTunnelConfig() {
  if (!window.EnvSettingsState.currentAccountId) {
    console.warn('[TunnelSettings] No account selected');
    return;
  }

  try {
    const result = await window.electronAPI.getEnvironmentConfig(window.EnvSettingsState.currentAccountId);
    if (result.success && result.config && result.config.tunnel) {
      populateTunnelForm(result.config);
    }
  } catch (error) {
    console.error('[TunnelSettings] Failed to load tunnel config:', error);
  }
}

function populateTunnelForm(config) {
  if (config && config.tunnel) {
    container().querySelector('#tunnel-enabled').checked = config.tunnel.enabled || false;
    container().querySelector('#tunnel-content').classList.toggle('disabled', !config.tunnel.enabled);
    container().querySelector('#tunnel-type').value = config.tunnel.type || 'socks5';
    container().querySelector('#tunnel-host').value = config.tunnel.host || '127.0.0.1';
    container().querySelector('#tunnel-port').value = config.tunnel.port || 1080;
    container().querySelector('#tunnel-username').value = config.tunnel.username || '';
    container().querySelector('#tunnel-password').value = config.tunnel.password || '';
  }
}

function handleTunnelToggle(e) {
  const tunnelContent = container().querySelector('#tunnel-content');
  tunnelContent.classList.toggle('disabled', !e.target.checked);
  window.EnvSettingsState.tunnelEnabled = e.target.checked;
}

function toggleTunnelPasswordVisibility() {
  const input = container().querySelector('#tunnel-password');
  input.type = input.type === 'password' ? 'text' : 'password';
}

async function parseTunnelString() {
  const tunnelString = container().querySelector('#tunnel-smart-paste').value.trim();
  if (!tunnelString) {
    showTunnelError('请输入隧道字符串');
    return;
  }

  try {
    const result = await window.electronAPI.parseTunnelString(tunnelString);
    if (result.success) {
      const config = result.config;
      container().querySelector('#tunnel-type').value = config.type || 'socks5';
      container().querySelector('#tunnel-host').value = config.host || '';
      container().querySelector('#tunnel-port').value = config.port || '';
      container().querySelector('#tunnel-username').value = config.username || '';
      container().querySelector('#tunnel-password').value = config.password || '';
      showTunnelSuccess('隧道信息已自动填充！');
    } else {
      showTunnelError('解析失败: ' + (result.error || '格式不正确'));
    }
  } catch (error) {
    console.error('[TunnelSettings] Failed to parse tunnel string:', error);
    showTunnelError('解析失败: ' + error.message);
  }
}

async function testTunnel() {
  const tunnelConfig = collectTunnelFormData().tunnel;
  if (!tunnelConfig.host || !tunnelConfig.port) {
    showTunnelError('请先填写隧道地址和端口');
    return;
  }

  showTunnelLoading('正在测试隧道连接...');

  try {
    const result = await window.electronAPI.testTunnel(tunnelConfig);
    if (result.success) {
      const html =
        '<h4>✓ 隧道连接成功</h4>' +
        '<div class="env-result-details">' +
        `<p><strong>隧道地址:</strong> ${result.tunnelUrl || 'N/A'}</p>` +
        `<p><strong>响应时间:</strong> ${result.responseTime || 'N/A'}</p>` +
        '</div>';
      showTunnelResult(html);
    } else {
      showTunnelError('隧道连接失败: ' + (result.error || '未知错误'));
    }
  } catch (error) {
    console.error('[TunnelSettings] Failed to test tunnel:', error);
    showTunnelError('测试失败: ' + error.message);
  }
}

function collectTunnelFormData() {
  const c = container();
  return {
    tunnel: {
      enabled: c.querySelector('#tunnel-enabled').checked,
      type: c.querySelector('#tunnel-type').value,
      host: c.querySelector('#tunnel-host').value,
      port: c.querySelector('#tunnel-port').value,
      username: c.querySelector('#tunnel-username').value,
      password: c.querySelector('#tunnel-password').value
    }
  };
}

function showTunnelResult(html) {
  const resultBox = container().querySelector('#tunnel-result');
  resultBox.innerHTML = html;
  resultBox.classList.remove('hidden');
}

function showTunnelLoading(message) {
  showTunnelResult('<div class="env-result-loading">' + message + '</div>');
}

function showTunnelSuccess(message) {
  showTunnelResult('<div class="env-result-success">' + message + '</div>');
  setTimeout(() => {
    container().querySelector('#tunnel-result').classList.add('hidden');
  }, 3000);
}

function showTunnelError(message) {
  showTunnelResult('<div class="env-result-error">❌ ' + message + '</div>');
}

// Export functions
window.TunnelSettings = {
  loadTunnelConfig,
  populateTunnelForm,
  handleTunnelToggle,
  toggleTunnelPasswordVisibility,
  parseTunnelString,
  testTunnel,
  collectTunnelFormData,
  showTunnelResult,
  showTunnelLoading,
  showTunnelSuccess,
  showTunnelError
};