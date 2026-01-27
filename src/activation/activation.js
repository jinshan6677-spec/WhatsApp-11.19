/**
 * 激活页面脚本
 */

const activationCodeInput = document.getElementById('activationCode');
const activateBtn = document.getElementById('activateBtn');
const cancelBtn = document.getElementById('cancelBtn');
const errorMessage = document.getElementById('errorMessage');
const activationFormView = document.getElementById('activationFormView');
const successView = document.getElementById('successView');
const loadingOverlay = document.getElementById('loadingOverlay');
const deviceIdText = document.getElementById('deviceIdText');
const expireDateDisplay = document.getElementById('expireDateDisplay');
const expireDateText = document.getElementById('expireDateText');

// 页面加载时获取设备信息和已保存的激活码
window.addEventListener('DOMContentLoaded', () => {
  // 不等待异步操作，先显示页面
  // 在后台异步加载信息

  // 1. 异步获取设备信息
  window.electronAPI.activation.getDeviceInfo().then(deviceInfoData => {
    if (deviceInfoData) {
      // 只显示设备ID的前16位，避免超出窗口
      const shortDeviceId = deviceInfoData.deviceId.substring(0, 16) + '...';
      deviceIdText.textContent = '设备ID: ' + shortDeviceId;
    }
  }).catch(error => {
    console.error('获取设备信息失败:', error);
    deviceIdText.textContent = '设备ID: 获取失败';
  });

  // 2. 异步获取已保存的激活信息
  // 先显示加载提示
  activationCodeInput.placeholder = '// 正在加载激活码...';

  window.electronAPI.activation.getInfo().then(activationInfo => {
    if (activationInfo && activationInfo.activationCode && activationInfo.rememberCode) {
      // 只有用户选择记住时才自动填充激活码
      activationCodeInput.value = activationInfo.activationCode;
      document.getElementById('rememberActivationCode').checked = true;

      // 显示到期日期
      if (activationInfo.expireDate) {
        updateExpireDateDisplay(new Date(activationInfo.expireDate));
      }
    } else {
      // 没有记住的激活码，恢复默认提示
      activationCodeInput.placeholder = '// 请在此粘贴您的产品授权码...';
    }
  }).catch(error => {
    console.error('获取激活信息失败:', error);
    activationCodeInput.placeholder = '// 请在此粘贴您的产品授权码...';
  });
});

// 监听激活错误消息
window.electronAPI.onActivationError((error) => {
  showError(error);
});

// 激活按钮点击事件
activateBtn.addEventListener('click', async () => {
  const activationCode = activationCodeInput.value.trim();

  if (!activationCode) {
    showError('请输入激活码');
    return;
  }

  // 清理激活码（移除空格和换行）
  const cleanedCode = activationCode.replace(/\s+/g, '');

  if (cleanedCode.length < 50) {
    showError('激活码格式不正确，请检查后重试');
    return;
  }

  // 检查是否记住激活码
  const rememberCode = document.getElementById('rememberActivationCode').checked;

  // 显示加载状态
  showLoading(true);
  hideError();

  try {
    const result = await window.electronAPI.activation.activate(cleanedCode, rememberCode);

    if (result.success) {
      // 激活成功
      showSuccess();
      
      // 禁用按钮防止重复点击
      activateBtn.disabled = true;
      cancelBtn.disabled = true;
      
      // 窗口会由主进程自动关闭/跳转
    } else {
      showError(result.error || '激活失败，请检查激活码后重试');
      showLoading(false);
    }
  } catch (error) {
    showError('激活过程中发生错误：' + error.message);
    showLoading(false);
  }
});

// 监听激活码输入，实时显示到期日期
activationCodeInput.addEventListener('input', () => {
  const code = activationCodeInput.value.trim().replace(/\s+/g, '');
  
  if (code.length > 50) {
    try {
      // 尝试解析激活码
      const decoded = JSON.parse(atob(code));
      
      if (decoded.validDays && decoded.createdAt) {
        const createdAt = new Date(decoded.createdAt);
        const expireDate = new Date(createdAt.getTime() + decoded.validDays * 24 * 60 * 60 * 1000);
        updateExpireDateDisplay(expireDate);
      }
    } catch (error) {
      // 激活码格式不正确，隐藏到期日期
      expireDateDisplay.style.display = 'none';
    }
  } else {
    expireDateDisplay.style.display = 'none';
  }
});

// 取消按钮点击事件
cancelBtn.addEventListener('click', () => {
  window.electronAPI.activation.quit();
});

// 辅助函数：更新到期日期显示
function updateExpireDateDisplay(date) {
  const dateStr = date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
  expireDateText.textContent = dateStr;
  expireDateDisplay.style.display = 'flex';
}

  // 显示错误消息
function showError(message) {
  const errorMsg = document.getElementById('errorMessage');
  
  // 简单的错误信息汉化映射
  const errorMap = {
    'Invalid activation code': '激活码无效',
    'Activation failed': '激活失败',
    'Network error': '网络连接错误',
    'Timeout': '请求超时',
    'License expired': '授权已过期',
    'Device limit reached': '设备数量已达上限',
    'Unknown error': '未知错误'
  };

  // 尝试匹配并翻译
  let displayMessage = message;
  for (const [eng, chn] of Object.entries(errorMap)) {
    if (message && message.includes(eng)) {
      displayMessage = message.replace(eng, chn);
    }
  }
  
  // 如果全是英文且没匹配到，尝试添加前缀提示 (可选)
  // if (/^[a-zA-Z\s\.]+$/.test(displayMessage)) {
  //   displayMessage = "系统错误: " + displayMessage;
  // }

  // 查找或创建文本span
  let textSpan = errorMsg.querySelector('span:not(:first-child)');
  if (!textSpan) {
     // 如果没有文本span (第一个通常是icon), 检查结构
     if (errorMsg.children.length > 1) {
         textSpan = errorMsg.children[1];
     } else {
         textSpan = document.createElement('span');
         errorMsg.appendChild(textSpan);
     }
  }
  
  textSpan.textContent = displayMessage;
  errorMsg.style.display = 'flex';
}

// 隐藏错误消息
function hideError() {
  const errorMsg = document.getElementById('errorMessage');
  errorMsg.style.display = 'none';
}

// 显示加载状态
function showLoading(show) {
  if (show) {
    loadingOverlay.classList.add('active');
  } else {
    loadingOverlay.classList.remove('active');
  }
}

// 显示成功消息
function showSuccess() {
  loadingOverlay.classList.remove('active');
  activationFormView.style.display = 'none';
  successView.classList.add('active');

  // 倒计时逻辑
  const countdownEl = document.getElementById('successCountdown');
  if (countdownEl) {
    let count = 3;
    const timer = setInterval(() => {
      count--;
      countdownEl.textContent = count;
      if (count <= 0) {
        clearInterval(timer);
      }
    }, 1000);
  }
}
