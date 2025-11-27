# Preload 脚本注入修复

## 问题诊断

通过 DevTools 检查发现：
```
✅ translationAPI: 存在（preload 工作）
❌ WhatsAppTranslation: undefined（executeJavaScript 失败）
❌ ACCOUNT_ID: undefined（executeJavaScript 失败）
```

**根本原因**: `webContents.executeJavaScript()` 无法注入脚本到 BrowserView 中。

可能的原因：
1. CSP (Content Security Policy) 阻止
2. Sandbox 模式限制
3. contextIsolation 隔离
4. WhatsApp Web 的安全策略

## 解决方案：使用 Preload 脚本注入

Preload 脚本在页面加载前运行，不受 CSP 限制，是最可靠的注入方式。

### 实施的修复

#### 1. 创建专用的 BrowserView Preload 脚本 ✅
**文件**: `src/preload-view.js`

**功能**:
- 在页面加载前注入 `window.ACCOUNT_ID`
- 暴露 `window.translationAPI`
- 在 DOMContentLoaded 时注入翻译脚本
- 自动初始化翻译系统

**关键代码**:
```javascript
// 注入 account ID
window.ACCOUNT_ID = accountId;

// 在 DOM 加载后注入脚本
window.addEventListener('DOMContentLoaded', () => {
  const contentScript = fs.readFileSync(contentScriptPath, 'utf8');
  const script = document.createElement('script');
  script.textContent = contentScript;
  document.head.appendChild(script);
});
```

#### 2. 修改 BrowserView 配置 ✅
**文件**: 
- `src/single-window/ViewManager.js`
- `src/presentation/windows/view-manager/ViewFactory.js`

**更改**:
```javascript
webPreferences: {
  sandbox: false,  // 必须禁用 sandbox
  preload: path.join(__dirname, '../preload-view.js'),  // 使用新的 preload
  additionalArguments: [`--account-id=${accountId}`]
}
```

**重要**: `sandbox: false` 是必需的，否则 preload 脚本无法读取文件系统。

## 工作原理

### 传统方式（失败）
```
App 启动 → 创建 BrowserView → 加载页面 → executeJavaScript 注入
                                              ↑
                                            被 CSP 阻止
```

### 新方式（成功）
```
App 启动 → 创建 BrowserView → Preload 运行 → 注入脚本 → 加载页面
                                ↑
                          在页面加载前，不受 CSP 限制
```

## 验证步骤

### 1. 重启应用
```cmd
npm start
```

或使用调试模式：
```cmd
start-with-debug.bat
```

### 2. 打开账号
在应用中打开一个 WhatsApp 账号

### 3. 打开 DevTools
按 F12 键

### 4. 查看 Console 日志
应该看到：
```
[Preload-View] Starting preload script for BrowserView
[Preload-View] Account ID: <your-account-id>
[Preload-View] Translation API exposed
[Preload-View] DOMContentLoaded, injecting translation scripts
[Preload-View] Content script loaded, size: 128744
[Preload-View] Translation script injected into page
[Preload-View] ✓ WhatsAppTranslation is available
[Preload-View] ✓ Translation system initialized
[Translation] Content script initializing...
[Translation] WhatsApp Web loaded
[Translation] Initialized successfully
```

### 5. 验证注入
在 Console 中执行：
```javascript
console.log({
  WhatsAppTranslation: window.WhatsAppTranslation,
  translationAPI: window.translationAPI,
  ACCOUNT_ID: window.ACCOUNT_ID
});
```

**预期结果**:
```javascript
{
  WhatsAppTranslation: {init: ƒ, config: {...}, ...},  // ✓ 对象
  translationAPI: {translate: ƒ, ...},                  // ✓ 对象
  ACCOUNT_ID: "your-account-id"                         // ✓ 字符串
}
```

## 优势

### Preload 注入 vs executeJavaScript

| 特性 | Preload | executeJavaScript |
|------|---------|-------------------|
| 执行时机 | 页面加载前 | 页面加载后 |
| CSP 限制 | ❌ 不受限制 | ✅ 受限制 |
| 可靠性 | ✅ 高 | ❌ 低 |
| 文件系统访问 | ✅ 可以 | ❌ 不可以 |
| 需要 sandbox | ❌ 必须禁用 | ✅ 可以启用 |

## 安全考虑

### Sandbox 禁用的影响
- **风险**: 禁用 sandbox 降低了安全隔离
- **缓解**: 
  - 仍然启用 contextIsolation
  - 仍然启用 webSecurity
  - 只在 preload 中访问文件系统
  - 不暴露 Node.js API 到页面

### 最佳实践
1. ✅ 保持 `contextIsolation: true`
2. ✅ 保持 `webSecurity: true`
3. ✅ 使用 `contextBridge` 暴露 API
4. ✅ 不在页面中使用 `nodeIntegration`
5. ⚠️ 只在必要时禁用 `sandbox`

## 故障排除

### 问题 A: 仍然看到 WhatsAppTranslation undefined
**检查**:
1. Console 中是否有 `[Preload-View]` 日志？
2. 是否有错误消息？
3. preload-view.js 文件是否存在？

**解决**:
```javascript
// 在 Console 中检查
console.log('Preload script loaded:', typeof window.ACCOUNT_ID !== 'undefined');
```

### 问题 B: 看到 "Cannot read file" 错误
**原因**: sandbox 仍然启用

**解决**: 确认 `sandbox: false` 已应用

### 问题 C: 脚本注入但不初始化
**检查**: Console 中的错误消息

**解决**: 手动初始化
```javascript
if (window.WhatsAppTranslation) {
  window.WhatsAppTranslation.init();
}
```

## 文件清单

### 新增文件
1. ✅ `src/preload-view.js` - BrowserView 专用 preload 脚本

### 修改文件
1. ✅ `src/single-window/ViewManager.js` - 使用新 preload
2. ✅ `src/presentation/windows/view-manager/ViewFactory.js` - 使用新 preload

### 文档文件
1. ✅ `PRELOAD_INJECTION_FIX.md` - 本文档

## 下一步

1. **重启应用**
2. **打开账号**
3. **按 F12 打开 DevTools**
4. **查看 Console 日志**
5. **执行验证命令**
6. **报告结果**

---

**状态**: ✅ Preload 注入已实施
**预期**: window.WhatsAppTranslation 应该可用
**如果成功**: 翻译功能应该完全工作
