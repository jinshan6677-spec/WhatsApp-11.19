# IPC 迁移问题修复总结

## 🚨 发现的问题

### 问题 1：IPC 处理器未注册到 ipcMain ✅ 已修复
```
Error: No handler registered for 'translation:saveConfig'
Error: No handler registered for 'translation:getConfig'
```

**根本原因**：`IPCRouter` 只是一个内部路由器，它注册了处理器，但是**没有与 Electron 的 `ipcMain` 连接**！

### 问题 2：WhatsAppTranslation 对象检测失败 ✅ 已修复
```
[Preload-View] ✗ WhatsAppTranslation is not available after injection
```

**根本原因**：通过 `<script>` 标签注入的脚本运行在页面的主世界（main world）中，而 preload 脚本运行在隔离的世界（isolated world）中。

### 问题 3：IPC 请求参数格式不匹配 ✅ 已修复
```javascript
// Preload 调用方式
saveConfig: (accountId, config) => ipcRenderer.invoke('translation:saveConfig', accountId, config)

// Handler 期望的格式
const { accountId, config } = request.payload;
```

**根本原因**：IPCRouter 期望 payload 是一个对象，但 preload 脚本传递的是多个参数。

### 问题 4：IPC 响应格式不一致 ✅ 已修复（新发现）
```javascript
// Handler 返回格式
return { success: true, data: result };

// 但 ipcMain.handle 只返回 response.data
if (response.success) {
  return response.data;  // 渲染进程收到的是 result，不是 { success, data }
}
```

**根本原因**：内容脚本检查 `response.success`，但实际收到的是直接的结果对象。

## ✅ 修复方案

### 修复 1：将 IPCRouter 处理器注册到 ipcMain

**文件**：`src/presentation/ipc/handlers/TranslationServiceIPCHandlers.js`

```javascript
// 在 registerWithRouter 函数中添加
const { ipcMain } = require('electron');

// 注册到 ipcMain
for (const channel of TRANSLATION_CHANNELS) {
  ipcMain.handle(channel, async (event, ...args) => {
    const request = {
      payload: args.length === 1 ? args[0] : args,
      requestId: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    };
    
    const response = await router.handle(channel, request);
    
    if (response.success) {
      return response.data;
    } else {
      throw new Error(response.error?.message || 'Unknown error');
    }
  });
}
```

### 修复 2：使用脚本注入检查主世界中的对象

**文件**：`src/preload-view.js`

```javascript
// 使用脚本注入来检查和配置主世界中的 WhatsAppTranslation
const configScript = document.createElement('script');
configScript.textContent = `
  (function() {
    if (typeof window.WhatsAppTranslation !== 'undefined') {
      console.log('[Preload-View] ✓ WhatsAppTranslation is available in main world');
      window.WhatsAppTranslation.accountId = '${accountId}';
      // ...
    }
  })();
`;
(document.head || document.documentElement).appendChild(configScript);
```

### 修复 3：统一 IPC 请求参数格式

**修改的文件**：
- `src/preload-view.js`
- `src/preload.js`
- `src/single-window/renderer/preload-main.js`

```javascript
// 修改前
saveConfig: (accountId, config) => ipcRenderer.invoke('translation:saveConfig', accountId, config)

// 修改后
saveConfig: (accountId, config) => ipcRenderer.invoke('translation:saveConfig', { accountId, config })
```

## 📁 修改的文件清单

1. **`src/presentation/ipc/handlers/TranslationServiceIPCHandlers.js`**
   - 添加 `TRANSLATION_CHANNELS` 常量
   - 在 `registerWithRouter` 中添加 `ipcMain.handle` 注册
   - 在 `unregisterFromRouter` 中添加 `ipcMain.removeHandler` 注销

2. **`src/preload-view.js`**
   - 修复 `saveConfig` 和 `saveEngineConfig` 的参数格式
   - 使用脚本注入检查主世界中的 `WhatsAppTranslation`

3. **`src/preload.js`**
   - 修复 `saveConfig` 和 `saveEngineConfig` 的参数格式

4. **`src/single-window/renderer/preload-main.js`**
   - 修复 `saveConfig` 和 `saveEngineConfig` 的参数格式

## 🧪 预期结果

重启应用后，应该看到：

**主进程日志**：
```
[IPC:Translation] Translation service handlers registered with IPCRouter
[IPC:Translation] ✓ Registered ipcMain.handle for: translation:translate
[IPC:Translation] ✓ Registered ipcMain.handle for: translation:detectLanguage
[IPC:Translation] ✓ Registered ipcMain.handle for: translation:getConfig
[IPC:Translation] ✓ Registered ipcMain.handle for: translation:saveConfig
... (13 个通道)
[IPC:Translation] ✓ All 13 channels registered with ipcMain
```

**渲染进程日志**：
```
[Preload-View] ✓ All translation modules injected
[Preload-View] ✓ WhatsAppTranslation is available in main world
[Preload-View] ✓ Translation system ready with account: xxx
```

## 🔄 如果仍有问题

### 调试步骤

1. **检查主进程日志**：
   - 是否看到 "✓ Registered ipcMain.handle for: translation:saveConfig"
   - 是否看到 "✓ All 13 channels registered with ipcMain"

2. **检查渲染进程日志**：
   - 是否看到 "✓ WhatsAppTranslation is available in main world"

3. **手动测试 IPC**：
   ```javascript
   // 在 DevTools Console 中测试
   await window.translationAPI.getConfig('your-account-id');
   await window.translationAPI.saveConfig('your-account-id', { test: true });
   ```

### 回滚方案

如果修复失败，可以恢复到旧的 IPC 处理器：

```bash
# 恢复旧的 ipcHandlers.js
git checkout src/translation/ipcHandlers.js

# 在 main-refactored.js 中重新启用旧的处理器
```

## 📋 架构说明

### IPCRouter 与 ipcMain 的关系

```
┌─────────────────────────────────────────────────────────────┐
│                    渲染进程 (Renderer)                       │
├─────────────────────────────────────────────────────────────┤
│  ipcRenderer.invoke('translation:saveConfig', payload)      │
└─────────────────────────────────────────────────────────────┘
                              │
                              ↓ IPC 通信
┌─────────────────────────────────────────────────────────────┐
│                    主进程 (Main)                             │
├─────────────────────────────────────────────────────────────┤
│  ipcMain.handle('translation:saveConfig', handler)          │
│                              │                              │
│                              ↓                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                    IPCRouter                         │   │
│  │  - 请求验证                                          │   │
│  │  - 超时处理                                          │   │
│  │  - 错误处理                                          │   │
│  │  - 路由到具体处理器                                   │   │
│  └─────────────────────────────────────────────────────┘   │
│                              │                              │
│                              ↓                              │
│  TranslationServiceIPCHandlers.handlers.saveConfig()        │
└─────────────────────────────────────────────────────────────┘
```

**关键点**：
- `ipcMain.handle` 是 Electron 的 IPC 入口点
- `IPCRouter` 是内部路由器，提供验证、超时、错误处理等功能
- 两者必须配合使用：`ipcMain.handle` 接收请求，`IPCRouter` 处理请求

## 🎯 总结

这次修复解决了三个关键问题：

1. ✅ **IPC 处理器注册**：将 IPCRouter 的处理器同时注册到 ipcMain
2. ✅ **主世界检测**：使用脚本注入检查主世界中的对象
3. ✅ **参数格式统一**：确保所有 preload 脚本使用正确的参数格式

**请重启应用并测试！**


## ✅ 第二轮修复（响应格式问题）

### 修复 4：统一响应格式处理

**修改的文件**：
- `src/presentation/translation/content-script/ContentScriptCore.js`
- `src/presentation/translation/content-script/MessageTranslator.js`
- `src/presentation/translation/content-script/InputBoxTranslator.js`

**修复方式**：所有响应处理都支持两种格式：

```javascript
// 处理两种响应格式
if (response) {
  if (response.success !== undefined) {
    // 包装格式: { success: true, data: result }
    translationResult = response.data;
  } else if (response.translatedText) {
    // 直接格式: { translatedText: '...', ... }
    translationResult = response;
  }
}
```

### 修复的函数

1. **ContentScriptCore.js**
   - `loadConfig()` - 配置加载

2. **MessageTranslator.js**
   - `translateMessage()` - 消息翻译

3. **InputBoxTranslator.js**
   - `translateInputBox()` - 输入框翻译
   - `detectChatLanguage()` - 语言检测
   - `showInputBoxReverseTranslation()` - 反向翻译
   - `setupRealtimeTranslation()` - 实时翻译

## 📊 修复后的预期行为

### 配置加载
```
[Translation] Config loaded: {global: {...}, inputBox: {...}, advanced: {...}, friendConfigs: {...}}
```

### 消息翻译
```
[Translation] 🔄 Chat window translation, using engine: google (no style)
[Translation] ✅ Translation successful, using engine: google
```

### 输入框翻译
```
[Translation] 🎨 Input box translation, using engine: google, style: 通用
[Translation] Translation successful: [翻译结果]
[Translation] Text set to input box
```

## 🧪 测试步骤

1. **重启应用**

2. **测试配置加载**：
   - 打开 DevTools Console
   - 检查是否看到 `[Translation] Config loaded: {...}`
   - 配置对象应该包含 `global`, `inputBox`, `advanced` 等字段

3. **测试自动翻译**：
   - 在翻译设置面板中启用"自动翻译"
   - 切换到一个聊天
   - 检查是否看到翻译结果

4. **测试输入框翻译**：
   - 在输入框中输入中文
   - 点击翻译按钮（🌐）
   - 检查是否翻译成功

5. **测试实时翻译**：
   - 在翻译设置面板中启用"实时翻译"
   - 在输入框中输入文字
   - 检查是否显示实时翻译预览

## 📁 完整修改文件清单

### 第一轮修复
1. `src/presentation/ipc/handlers/TranslationServiceIPCHandlers.js` - 添加 ipcMain 注册
2. `src/preload-view.js` - 修复参数格式和主世界检测
3. `src/preload.js` - 修复参数格式
4. `src/single-window/renderer/preload-main.js` - 修复参数格式

### 第二轮修复
5. `src/presentation/translation/content-script/ContentScriptCore.js` - 修复响应格式处理
6. `src/presentation/translation/content-script/MessageTranslator.js` - 修复响应格式处理
7. `src/presentation/translation/content-script/InputBoxTranslator.js` - 修复响应格式处理

## 🎯 总结

这次修复解决了四个关键问题：

1. ✅ **IPC 处理器注册**：将 IPCRouter 的处理器同时注册到 ipcMain
2. ✅ **主世界检测**：使用脚本注入检查主世界中的对象
3. ✅ **参数格式统一**：确保所有 preload 脚本使用正确的参数格式
4. ✅ **响应格式处理**：支持包装格式和直接格式两种响应

**请重启应用并测试！**
