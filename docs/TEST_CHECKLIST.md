# 登录状态显示Bug测试清单

## 测试前准备

1. ✅ 确保所有修改已保存
2. ✅ 重启应用：关闭现有实例，运行 `npm start`
3. ✅ 打开DevTools：View > Toggle Developer Tools
4. ✅ 切换到Console标签

## 测试场景1：已登录账号

### 步骤
1. 打开一个已经登录WhatsApp的账号
2. 观察状态变化

### 预期结果
- [ ] 初始显示"加载中..."（橙色点，脉冲动画）
- [ ] 2-7秒后变为"在线"（绿色点）
- [ ] 显示"关闭"按钮

### 控制台日志检查
- [ ] 看到：`[Sidebar] handleViewLoading for account-xxx`
- [ ] 看到：`[Sidebar] handleViewReady for account-xxx: { loginStatus: true, connectionStatus: 'online' }`
- [ ] 看到：`[Sidebar] handleLoginStatusChanged for account-xxx: { isLoggedIn: true, hasQRCode: false }`
- [ ] 看到：`[Sidebar] handleConnectionStatusChanged for account-xxx: { connectionStatus: 'online', isLoggedIn: true }`

### 主进程日志检查
- [ ] 看到：`View loaded for account account-xxx`
- [ ] 看到：`Account account-xxx is logged in`

## 测试场景2：未登录账号（需要扫码）

### 步骤
1. 打开一个未登录的账号（或创建新账号）
2. 观察状态变化

### 预期结果
- [ ] 初始显示"加载中..."（橙色点）
- [ ] 2-7秒后变为"需要登录"（橙色点，不脉冲）
- [ ] 显示"打开"按钮
- [ ] WhatsApp Web显示QR码

### 控制台日志检查
- [ ] 看到：`[Sidebar] handleViewLoading for account-xxx`
- [ ] 看到：`[Sidebar] handleViewReady for account-xxx: { loginStatus: false, connectionStatus: 'offline' }`
- [ ] 看到：`[Sidebar] handleLoginStatusChanged for account-xxx: { isLoggedIn: false, hasQRCode: true }`

### 主进程日志检查
- [ ] 看到：`View loaded for account account-xxx`
- [ ] 看到：`Account account-xxx showing QR code (not logged in)`

## 测试场景3：扫码登录

### 步骤
1. 从场景2继续
2. 用手机扫描QR码并登录
3. 观察状态变化

### 预期结果
- [ ] 状态从"需要登录"变为"在线"
- [ ] 按钮从"打开"变为"关闭"
- [ ] 绿色点出现

### 控制台日志检查
- [ ] 看到：`[Sidebar] handleLoginStatusChanged for account-xxx: { isLoggedIn: true, hasQRCode: false }`
- [ ] 看到：`[Sidebar] handleConnectionStatusChanged for account-xxx: { connectionStatus: 'online', isLoggedIn: true }`

## 测试场景4：多个账号

### 步骤
1. 打开2-3个账号
2. 观察每个账号的状态

### 预期结果
- [ ] 每个账号独立显示正确的状态
- [ ] 已登录的显示"在线"
- [ ] 未登录的显示"需要登录"
- [ ] 没有账号卡在"加载中..."

## 调试步骤（如果测试失败）

### 1. 检查DOM选择器
在DevTools Console中运行：
```javascript
// 检查聊天面板
const chatPane = document.querySelector('#pane-side');
console.log('Chat Pane:', chatPane);
console.log('Chat Pane visible:', chatPane && chatPane.offsetParent !== null);

// 检查聊天项
const chatItems = document.querySelectorAll('[data-testid="cell-frame-container"]');
console.log('Chat Items:', chatItems.length);

// 检查QR码
const qrCode = document.querySelector('canvas[aria-label*="QR"]');
console.log('QR Code:', qrCode);
console.log('QR Code visible:', qrCode && qrCode.offsetParent !== null);
```

### 2. 检查事件流
在sidebar.js的每个handle函数开头添加断点，确认：
- [ ] `handleViewLoading` 被调用
- [ ] `handleViewReady` 被调用
- [ ] `handleLoginStatusChanged` 被调用
- [ ] `handleConnectionStatusChanged` 被调用

### 3. 检查状态更新
在`updateAccountStatus`函数中添加断点，确认：
- [ ] 函数被调用
- [ ] `status` 参数的值正确
- [ ] DOM元素被找到
- [ ] 类名被正确更新
- [ ] 文本被正确设置

### 4. 检查定期检测
等待5秒后，应该看到：
- [ ] 主进程日志：再次检测登录状态
- [ ] 如果状态不明确，应该看到详细的JSON输出

## 常见问题

### Q: 状态一直是"加载中..."
A: 检查：
1. 控制台是否有错误？
2. `handleViewReady` 是否被调用？
3. `loginStatus` 和 `connectionStatus` 的值是什么？
4. DOM选择器是否找到了元素？

### Q: 状态显示"离线"但实际已登录
A: 检查：
1. `isLoggedIn` 的值是否为 `true`？
2. `connectionStatus` 的值是什么？
3. 聊天面板是否真的可见？（`offsetParent !== null`）

### Q: 按钮状态不对
A: 检查：
1. `runningStatus` 的值是什么？
2. `handleAccountOpened` 是否被调用？
3. `updateAccountRunningStatus` 是否正确更新了按钮？

### Q: 定期检测没有运行
A: 检查：
1. `did-finish-load` 事件是否触发？
2. 定时器是否被创建？（检查 `viewState.intervals`）
3. 定时器是否被过早清除？

## 报告问题

如果所有测试都失败，请提供：
1. ✅ 完整的控制台日志（主进程和渲染进程）
2. ✅ DOM检查结果
3. ✅ 截图显示问题
4. ✅ 操作系统和Electron版本
5. ✅ WhatsApp Web的版本（如果可见）
