# Bug修复：账号登录状态显示一直加载中

## 问题描述

当账号打开并已经登录WhatsApp后，状态显示一直停留在"加载中..."，而不是显示"在线"或"需要登录"。同时，打开/关闭按钮的状态也不正确。

## 问题原因

1. **时序问题**：WhatsApp Web是一个React应用，页面的`did-finish-load`事件触发时，React组件可能还没有完全渲染
2. **检测过早**：登录状态检测在页面加载完成后立即执行，此时DOM元素可能还不存在
3. **状态覆盖**：当登录状态不明确时（既没有QR码也没有聊天界面），UI会显示"加载中..."并且不再更新
4. **缺少重试**：没有定期检测机制来捕获延迟出现的登录状态变化

## 解决方案

### 1. 添加初始化延迟（ViewManager.js）

在`did-finish-load`事件处理器中添加2秒延迟，等待WhatsApp Web完全渲染：

```javascript
// Wait a bit for WhatsApp Web to render the UI
// WhatsApp Web is a React app that needs time to initialize
await new Promise(resolve => setTimeout(resolve, 2000));
```

### 2. 添加定期检测机制（ViewManager.js）

在页面加载后的第一分钟内，每5秒检测一次登录状态：

```javascript
// Set up periodic login status check (every 5 seconds for the first minute)
let checkCount = 0;
const maxChecks = 12; // Check for 1 minute (12 * 5 seconds)
const periodicCheck = setInterval(async () => {
  checkCount++;
  if (checkCount >= maxChecks || !viewState || viewState.status === 'destroyed') {
    clearInterval(periodicCheck);
    return;
  }
  
  try {
    await this._detectLoginStatus(accountId, view);
  } catch (error) {
    this.log('debug', `Periodic login check failed for account ${accountId}:`, error);
    clearInterval(periodicCheck);
  }
}, 5000);
```

### 3. 优化状态更新逻辑（sidebar.js）

修改`handleLoginStatusChanged`函数，当登录状态不明确时，不覆盖已有的明确状态：

```javascript
} else {
  // Loading or unclear status - only update if not already showing a definitive status
  const currentClasses = statusElement.classList;
  if (!currentClasses.contains('online') && !currentClasses.contains('login-required')) {
    statusElement.textContent = '加载中...';
    statusElement.title = '加载中...';
    statusElement.classList.remove('login-required', 'online', 'error', 'offline');
    statusElement.classList.add('loading');
  }
}
```

### 4. 清理定时器（ViewManager.js）

在`destroyView`方法中清理定期检测的定时器，防止内存泄漏：

```javascript
// Clear any periodic check intervals
if (viewState.intervals && Array.isArray(viewState.intervals)) {
  viewState.intervals.forEach(interval => clearInterval(interval));
  viewState.intervals = [];
}

// Mark as destroyed to stop any ongoing checks
viewState.status = 'destroyed';
```

## 修改的文件

1. **src/single-window/ViewManager.js**
   - 在`did-finish-load`事件处理器中添加2秒延迟
   - 添加定期登录状态检测（每5秒，持续1分钟）
   - 在`destroyView`方法中添加定时器清理逻辑

2. **src/single-window/renderer/sidebar.js**
   - 修改`handleLoginStatusChanged`函数，优化状态更新逻辑
   - 添加`loading`类到状态元素

## 测试步骤

1. 启动应用：`npm start`
2. 创建或打开一个账号
3. 观察状态指示器：
   - 应该短暂显示"加载中..."（2-5秒）
   - 然后显示：
     - "在线"（如果已登录，绿点）
     - "需要登录"（如果显示QR码，橙点）
4. 验证按钮状态：
   - 已登录：显示"关闭"按钮
   - 未登录：显示"打开"按钮

## 调试步骤

如果问题仍然存在，按以下步骤调试：

1. **打开开发者工具**：View > Toggle Developer Tools
2. **查看控制台日志**：
   - 主进程日志：查找 "Account XXX is logged in" 或 "Account XXX showing QR code"
   - 渲染进程日志：查找 "[Sidebar] handleLoginStatusChanged" 和 "[Sidebar] handleViewReady"
3. **运行调试脚本**：`node scripts/debug-login-status.js`
4. **在浏览器视图中检查DOM**：
   - 在DevTools的Console中运行调试代码（见debug-login-status.js）
   - 检查哪些选择器能找到元素
5. **检查事件流**：
   - `view-manager:account-opening` → 设置 loading 状态
   - `view-manager:view-loading` → 确认 loading 状态
   - `view-manager:view-ready` → 应该更新为 online/offline
   - `view-manager:login-status-changed` → 应该更新登录状态

## 预期行为

✓ 状态不应该无限期停留在"加载中..."  
✓ 状态应该在打开账号后2-7秒内更新  
✓ 打开/关闭按钮应该与实际账号状态匹配  
✓ 登录状态变化应该及时反映在UI上  

## 技术细节

### 为什么需要延迟？

WhatsApp Web使用React构建，页面加载过程：
1. HTML加载完成（`did-finish-load`触发）
2. JavaScript开始执行
3. React应用初始化
4. 组件渲染
5. DOM元素可见

在步骤1时检测登录状态，DOM元素可能还不存在，导致检测失败。

### 为什么需要定期检测？

即使有初始延迟，某些情况下（网络慢、设备性能低）WhatsApp Web可能需要更长时间才能完全渲染。定期检测确保能够捕获这些延迟出现的状态变化。

### 为什么只检测1分钟？

1. 大多数情况下，WhatsApp Web在10秒内就能完全加载
2. 1分钟足够覆盖99%的情况
3. 避免长期运行的定时器消耗资源
4. 用户可以通过刷新或重新打开账号来触发新的检测

## 相关问题

- 如果问题仍然存在，可能需要增加初始延迟时间（从2秒增加到3-5秒）
- 如果网络很慢，可以增加定期检测的持续时间（从1分钟增加到2分钟）
- 可以考虑使用MutationObserver来监听DOM变化，而不是定时检测

## 版本信息

- 修复日期：2024-11-20
- 影响版本：所有版本
- 修复版本：下一个版本
