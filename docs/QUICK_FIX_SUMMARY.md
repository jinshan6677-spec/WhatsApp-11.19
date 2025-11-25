# 登录状态显示Bug修复总结

## 问题
账号打开后，状态一直显示"加载中..."，不会更新为"在线"或"需要登录"。

## 修改内容

### 1. ViewManager.js
- ✅ 添加2秒延迟等待WhatsApp Web渲染
- ✅ 添加定期检测（每5秒，持续1分钟）
- ✅ 改进DOM选择器，增加更多备选方案
- ✅ 添加 `hasChatItems` 检测
- ✅ 确保状态不会卡在 `loading`
- ✅ 总是发送 `connection-status-changed` 事件
- ✅ 添加详细的调试日志
- ✅ 清理定时器防止内存泄漏

### 2. sidebar.js
- ✅ 优化 `handleLoginStatusChanged` 逻辑
- ✅ 只在真正不确定时显示"加载中..."
- ✅ 添加控制台日志用于调试

## 如何测试

### 方法1：直接运行
```bash
npm start
```
然后打开一个账号，观察状态是否在2-7秒内从"加载中..."变为"在线"或"需要登录"。

### 方法2：查看日志
1. 打开应用
2. 打开DevTools (View > Toggle Developer Tools)
3. 查看Console标签
4. 应该看到：
   ```
   [Sidebar] handleViewLoading for account-xxx
   [Sidebar] handleViewReady for account-xxx: { loginStatus: true/false, connectionStatus: 'online'/'offline' }
   [Sidebar] handleLoginStatusChanged for account-xxx: { isLoggedIn: true/false, hasQRCode: true/false }
   ```

### 方法3：手动检查DOM
1. 打开应用和账号
2. 在DevTools Console中运行：
   ```javascript
   // 检查聊天面板
   document.querySelector('#pane-side')
   
   // 检查聊天项
   document.querySelectorAll('[data-testid="cell-frame-container"]').length
   
   // 检查QR码
   document.querySelector('canvas[aria-label*="QR"]')
   ```

## 预期结果

✅ 状态应该在2-7秒内更新  
✅ 已登录账号显示"在线"（绿点）+ "关闭"按钮  
✅ 未登录账号显示"需要登录"（橙点）+ "打开"按钮  
✅ 不应该无限期停留在"加载中..."  

## 如果问题仍然存在

1. **检查控制台日志**：
   - 是否看到 `[Sidebar] handleViewReady` 日志？
   - 是否看到 `[Sidebar] handleLoginStatusChanged` 日志？
   - `loginStatus` 和 `connectionStatus` 的值是什么？

2. **检查主进程日志**：
   - 是否看到 "Account XXX is logged in" 或 "Account XXX showing QR code"？
   - 是否看到 "Account XXX login status unclear"？
   - 如果看到 "unclear"，检查详细的 JSON 输出

3. **检查DOM选择器**：
   - 运行 `node scripts/debug-login-status.js` 查看调试指南
   - 在Console中手动运行选择器，看哪些能找到元素

4. **可能的原因**：
   - WhatsApp Web的DOM结构变化了（需要更新选择器）
   - 网络很慢，2秒延迟不够（增加到3-5秒）
   - 事件没有正确传递（检查preload脚本）
   - React渲染很慢（增加定期检测的频率）

## 回滚方法

如果修改导致其他问题，可以：
```bash
git checkout src/single-window/ViewManager.js
git checkout src/single-window/renderer/sidebar.js
```

## 联系支持

如果问题持续存在，请提供：
1. 控制台日志截图（包括主进程和渲染进程）
2. DOM检查结果（运行debug-login-status.js中的代码）
3. WhatsApp Web的版本（在页面中查看）
