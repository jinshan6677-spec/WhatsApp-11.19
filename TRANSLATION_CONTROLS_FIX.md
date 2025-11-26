# 翻译控制开关修复

## 问题诊断

从日志分析：
```
[Preload-View] ✗ WhatsAppTranslation is not available after injection
```

**根本原因**：
1. `window.WhatsAppTranslation` 对象没有从内容脚本的 IIFE 中暴露出来
2. 配置保存后没有通知 BrowserView 更新配置

## 架构说明

应用使用**新框架**（`src/main-refactored.js`），但翻译功能使用**旧的翻译脚本**：

```
主进程 (main-refactored.js)
  ↓
ViewManager (新框架)
  ↓
TranslationIntegration (注入管理)
  ↓
BrowserView (preload-view.js)
  ↓
contentScript.js (翻译逻辑)
```

**两种注入方式**：
1. **Preload 注入** - `preload-view.js` 在 DOM 加载时注入脚本
2. **executeJavaScript 注入** - `TranslationIntegration.js` 在页面加载后注入

## 已完成的修复

### 1. 暴露 WhatsAppTranslation 对象
**文件**: `src/translation/contentScript.js`

在 IIFE 结束前添加：
```javascript
// 暴露 WhatsAppTranslation 对象到 window，以便外部控制
window.WhatsAppTranslation = WhatsAppTranslation;

// 暴露全局函数（保持向后兼容）
window.translateCurrentChat = () => {
  console.log('[Translation] 手动触发当前聊天翻译');
  WhatsAppTranslation.translateExistingMessages();
};
```

### 2. 添加配置更新方法
**文件**: `src/translation/contentScript.js`

添加了以下方法：
- `updateConfig(newConfig)` - 更新配置并保存
- `deepMerge(target, source)` - 深度合并配置对象
- `applyConfigChanges()` - 应用配置变更
- `disableChineseBlock()` - 禁用中文拦截
- `disableRealtimeTranslation()` - 禁用实时翻译
- `setupConfigListener()` - 监听配置变更

### 3. 添加配置变更监听
**文件**: `src/preload-view.js`

在 translationAPI 中添加：
```javascript
onConfigChanged: (callback) => {
  ipcRenderer.on('translation:configChanged', (event, config) => callback(config));
}
```

### 4. 添加配置变更通知 ⭐ 关键修复
**文件**: `src/translation/ipcHandlers.js`

在保存配置后，通知对应的 BrowserView：
```javascript
// 通知对应的 BrowserView 配置已更改
const { BrowserView } = require('electron');
const allViews = BrowserView.getAllViews();

for (const view of allViews) {
  if (view && view.webContents && !view.webContents.isDestroyed()) {
    const viewAccountId = await view.webContents.executeJavaScript('window.ACCOUNT_ID').catch(() => null);
    
    if (viewAccountId === accountId) {
      console.log(`[IPC] Notifying BrowserView for account ${accountId} about config change`);
      view.webContents.send('translation:configChanged', config);
    }
  }
}
```

## 测试步骤

### 1. 重启应用
修改已完成，需要重启应用使更改生效。

### 2. 打开 DevTools Console
在 WhatsApp Web 的 DevTools 中执行：

```javascript
// 检查对象是否暴露
console.log('WhatsAppTranslation:', window.WhatsAppTranslation);
console.log('Config:', window.WhatsAppTranslation?.config);
```

**预期结果**：应该看到完整的 WhatsAppTranslation 对象和配置。

### 3. 测试手动控制

#### 禁用翻译
```javascript
window.WhatsAppTranslation.updateConfig({
  global: { autoTranslate: false }
});
```

#### 启用翻译
```javascript
window.WhatsAppTranslation.updateConfig({
  global: { autoTranslate: true }
});
```

#### 更改翻译引擎
```javascript
window.WhatsAppTranslation.updateConfig({
  global: { engine: 'deepl' }  // 或 'google', 'baidu'
});
```

#### 禁用中文拦截
```javascript
window.WhatsAppTranslation.updateConfig({
  advanced: { blockChinese: false }
});
```

#### 启用实时翻译
```javascript
window.WhatsAppTranslation.updateConfig({
  advanced: { realtime: true }
});
```

### 4. 验证配置持久化

重新加载页面后，检查配置是否保存：
```javascript
window.WhatsAppTranslation.config
```

## UI 控制集成

修复完成后，UI 控制面板（第三栏）的开关应该能够正常工作：

1. **全局开关** → 控制 `config.global.autoTranslate`
2. **翻译引擎** → 控制 `config.global.engine`
3. **中文拦截** → 控制 `config.advanced.blockChinese`
4. **实时翻译** → 控制 `config.advanced.realtime`
5. **输入框翻译** → 控制 `config.inputBox.enabled`

## 下一步

如果 UI 控制面板仍然无法工作，需要检查：

1. **IPC 通信** - 主窗口的配置更改是否正确发送到 BrowserView
2. **事件触发** - `translation:configChanged` 事件是否正确触发
3. **配置保存** - 配置是否正确保存到磁盘

## 临时解决方案

在 UI 控制面板修复之前，可以使用 DevTools Console 手动控制翻译：

```javascript
// 快速禁用翻译
window.WhatsAppTranslation.config.global.autoTranslate = false;

// 快速启用翻译
window.WhatsAppTranslation.config.global.autoTranslate = true;

// 手动翻译当前聊天
window.translateCurrentChat();
```

## 总结

✅ **已修复**：`window.WhatsAppTranslation` 对象暴露
✅ **已添加**：配置更新方法
✅ **已添加**：配置变更监听
⏳ **待测试**：重启应用后验证功能

**请重启应用并测试！**


## 配置更新流程

```
UI 面板 (translateSettingsPanel.js)
  ↓ window.translationAPI.saveConfig(accountId, config)
IPC 主进程 (ipcHandlers.js)
  ↓ translationService.saveConfig()
  ↓ 查找对应的 BrowserView
  ↓ view.webContents.send('translation:configChanged', config)
Preload (preload-view.js)
  ↓ ipcRenderer.on('translation:configChanged')
  ↓ 触发回调
内容脚本 (contentScript.js)
  ↓ setupConfigListener() 接收配置
  ↓ applyConfigChanges() 应用配置
  ✓ 翻译行为更新
```

## 测试步骤

### 1. 重启应用
修改已完成，需要重启应用使更改生效。

### 2. 打开 DevTools Console
在 WhatsApp Web 的 DevTools 中执行：

```javascript
// 检查对象是否暴露
console.log('WhatsAppTranslation:', window.WhatsAppTranslation);
console.log('Config:', window.WhatsAppTranslation?.config);
```

**预期结果**：应该看到完整的 WhatsAppTranslation 对象和配置。

### 3. 测试 UI 控制面板

在主窗口的第三栏（翻译设置面板）中：

1. **切换自动翻译开关** → 观察翻译是否立即启用/禁用
2. **更改翻译引擎** → 观察新消息是否使用新引擎
3. **切换中文拦截** → 观察是否能发送中文
4. **切换实时翻译** → 观察输入框是否显示实时翻译预览

### 4. 测试手动控制（备用方案）

如果 UI 控制面板仍有问题，可以在 DevTools Console 中手动控制：

#### 禁用翻译
```javascript
window.WhatsAppTranslation.updateConfig({
  global: { autoTranslate: false }
});
```

#### 启用翻译
```javascript
window.WhatsAppTranslation.updateConfig({
  global: { autoTranslate: true }
});
```

#### 更改翻译引擎
```javascript
window.WhatsAppTranslation.updateConfig({
  global: { engine: 'deepl' }  // 或 'google', 'baidu'
});
```

#### 禁用中文拦截
```javascript
window.WhatsAppTranslation.updateConfig({
  advanced: { blockChinese: false }
});
```

#### 启用实时翻译
```javascript
window.WhatsAppTranslation.updateConfig({
  advanced: { realtime: true }
});
```

### 5. 验证配置持久化

重新加载页面后，检查配置是否保存：
```javascript
window.WhatsAppTranslation.config
```

## UI 控制集成

修复完成后，UI 控制面板（第三栏）的开关应该能够正常工作：

1. **全局开关** → 控制 `config.global.autoTranslate`
2. **翻译引擎** → 控制 `config.global.engine`
3. **中文拦截** → 控制 `config.advanced.blockChinese`
4. **实时翻译** → 控制 `config.advanced.realtime`
5. **输入框翻译** → 控制 `config.inputBox.enabled`

## 调试日志

重启后，应该看到以下日志：

```
[Preload-View] Translation API exposed
[Translation] Content script initializing...
[Translation] Config loaded: {...}
[Translation] Config change listener set up
[Translation] Initialized successfully
```

当更改配置时，应该看到：

```
[IPC] Translation config saved for account xxx
[IPC] Notifying BrowserView for account xxx about config change
[Translation] Config changed, reloading...
[Translation] Applying config changes...
[Translation] ✓ Config changes applied
```

## 临时解决方案

在 UI 控制面板修复之前，可以使用 DevTools Console 手动控制翻译：

```javascript
// 快速禁用翻译
window.WhatsAppTranslation.config.global.autoTranslate = false;

// 快速启用翻译
window.WhatsAppTranslation.config.global.autoTranslate = true;

// 手动翻译当前聊天
window.translateCurrentChat();
```

## 总结

✅ **已修复**：`window.WhatsAppTranslation` 对象暴露
✅ **已添加**：配置更新方法
✅ **已添加**：配置变更监听
✅ **已添加**：配置变更通知（IPC → BrowserView）
⏳ **待测试**：重启应用后验证功能

**请重启应用并测试！**

## 如果问题仍然存在

如果重启后控制开关仍然失效，请提供以下信息：

1. DevTools Console 中 `window.WhatsAppTranslation` 的输出
2. 更改配置时的完整日志
3. 是否看到 `[IPC] Notifying BrowserView` 日志
4. 是否看到 `[Translation] Config changed` 日志
