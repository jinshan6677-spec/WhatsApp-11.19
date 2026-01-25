// 页面加载时初始化
document.addEventListener('DOMContentLoaded', async () => {
  await loadCodes();
  await updateStats();
});

// 激活码类型选择
document.getElementById('codeType').addEventListener('change', (e) => {
  const type = e.target.value;
  const validDaysInput = document.getElementById('validDays');
  
  const presets = {
    trial: 30,
    standard: 365,
    premium: 730,
    permanent: 36500 // 100年，相当于永久
  };
  
  if (presets[type]) {
    validDaysInput.value = presets[type];
  }
});

// 生成激活码
async function generateCodes() {
  const validDays = parseInt(document.getElementById('validDays').value);
  const maxDevices = parseInt(document.getElementById('maxDevices').value);
  const count = parseInt(document.getElementById('count').value);
  const notes = document.getElementById('notes').value;

  if (!validDays || validDays < 1) {
    showToast('请输入有效的有效天数', 'error');
    return;
  }

  if (!maxDevices || maxDevices < 1) {
    showToast('请输入有效的最大设备数', 'error');
    return;
  }

  if (!count || count < 1) {
    showToast('请输入有效的生成数量', 'error');
    return;
  }

  const result = await adminAPI.generateCodes({
    validDays,
    maxDevices,
    count,
    notes
  });

  if (result.success) {
    showToast(`成功生成 ${result.codes.length} 个激活码`, 'success');
    await loadCodes();
    await updateStats();
  } else {
    showToast('生成失败：' + result.error, 'error');
  }
}

// 加载激活码列表
async function loadCodes() {
  const result = await adminAPI.getCodes();
  
  if (result.success) {
    renderCodes(result.codes);
  } else {
    showToast('加载失败：' + result.error, 'error');
  }
}

// 渲染激活码列表
function renderCodes(codes) {
  const codesList = document.getElementById('codesList');
  
  if (!codes || codes.length === 0) {
    codesList.innerHTML = '<div class="empty-state">暂无激活码</div>';
    return;
  }

  codesList.innerHTML = codes.map(code => `
    <div class="code-item">
      <div class="code-item-header">
        <strong>${code.id}</strong>
        <div class="actions">
          <button class="btn btn-secondary" onclick="copyCode('${code.code}')" style="padding: 5px 10px; font-size: 12px;">📋 复制</button>
          <button class="btn btn-danger" onclick="deleteCode('${code.id}')" style="padding: 5px 10px; font-size: 12px;">🗑️ 删除</button>
        </div>
      </div>
      <textarea readonly>${formatCode(code.code)}</textarea>
      <div class="code-item-info">
        <span>📅 有效期：${code.validDays}天</span>
        <span>🖥️ 最大设备：${code.maxDevices}台</span>
        <span>📝 备注：${code.notes || '无'}</span>
        <span>🕐 创建时间：${new Date(code.createdAt).toLocaleString('zh-CN')}</span>
      </div>
    </div>
  `).join('');
}

// 格式化激活码显示
function formatCode(code) {
  // 每64个字符换行
  return code.match(/.{1,64}/g).join('\n');
}

// 复制激活码
function copyCode(code) {
  navigator.clipboard.writeText(code).then(() => {
    showToast('激活码已复制到剪贴板', 'success');
  }).catch(() => {
    showToast('复制失败', 'error');
  });
}

// 删除激活码
async function deleteCode(codeId) {
  if (!confirm('确定要删除这个激活码吗？')) {
    return;
  }

  const result = await adminAPI.deleteCode(codeId);
  
  if (result.success) {
    showToast('删除成功', 'success');
    await loadCodes();
    await updateStats();
  } else {
    showToast('删除失败：' + result.error, 'error');
  }
}

// 更新统计信息
async function updateStats() {
  const result = await adminAPI.getStats();
  
  if (result.success) {
    document.getElementById('totalCodes').textContent = result.stats.totalCodes;
    document.getElementById('totalDevices').textContent = result.stats.totalDevices;
    document.getElementById('usedDevices').textContent = result.stats.usedDevices;
  }
}

// 显示提示消息
function showToast(message, type = 'success') {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, 3000);
}