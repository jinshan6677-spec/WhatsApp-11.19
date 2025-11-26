# 如何启用 WhatsApp Web 的 DevTools

## 问题
无法打开 WhatsApp Web 的浏览器控制台（DevTools），只能看到主进程控制台。

## 解决方案

我已经添加了代码来启用 DevTools。现在有两种方式打开：

### 方式 1: 使用调试模式启动（推荐）

#### Windows
双击运行 `start-with-debug.bat` 文件

或者在命令行中：
```cmd
set NODE_ENV=development
set DEBUG_TRANSLATION=true
npm start
```

#### Linux/Mac
```bash
NODE_ENV=development DEBUG_TRANSLATION=true npm start
```

**效果**: 
- 每个账号打开时会自动打开 DevTools
- 可以看到详细的翻译日志
- F12 键可以切换 DevTools

### 方式 2: 在运行中的应用中使用 F12

1. 启动应用（正常启动即可）
2. 打开一个账号
3. **确保焦点在 WhatsApp Web 页面上**（点击聊天区域）
4. 按 **F12** 键

**或者使用组合键**:
- Windows/Linux: `Ctrl + Shift + I`
- Mac: `Cmd + Option + I`

**注意**: 必须确保焦点在 WhatsApp Web 页面上，而不是侧边栏或其他区域。

## 验证 DevTools 是否打开

成功打开后，你会看到一个新窗口，包含以下标签：
- **Console** - 查看 JavaScript 日志
- **Elements** - 查看 HTML 结构
- **Network** - 查看网络请求
- **Sources** - 查看源代码

## 检查翻译功能

### 1. 切换到 Console 标签

### 2. 查找翻译日志
应该看到：
```
[Translation] executeJavaScript test successful
[Translation] Account ID injected: <your-account-id>
[Translation] Verification result: {hasWhatsAppTranslation: true, ...}
[Translation] Content script initializing...
[Translation] WhatsApp Web loaded
[Translation] Config loaded: {...}
[Translation] Initialized successfully
```

### 3. 手动验证
在 Console 中执行：
```javascript
console.log({
  WhatsAppTranslation: window.WhatsAppTranslation,
  translationAPI: window.translationAPI,
  ACCOUNT_ID: window.ACCOUNT_ID
});
```

### 4. 查看主进程日志
同时查看主进程控制台，应该看到：
```
[TranslationIntegration] [INFO] Translation scripts loaded to cache
[TranslationIntegration] [INFO] executeJavaScript test result: TEST_OK
[TranslationIntegration] [INFO] Verification result: {"hasWhatsAppTranslation":true,...}
[TranslationIntegration] [INFO] Translation scripts successfully injected
```

## 如果 DevTools 仍然无法打开

### 检查 1: 确认焦点位置
- 点击 WhatsApp Web 的聊天区域
- 确保不是点击在侧边栏或标题栏
- 然后按 F12

### 检查 2: 使用调试模式启动
使用 `start-with-debug.bat` 启动，DevTools 会自动打开

### 检查 3: 检查代码是否生效
查看主进程日志，应该看到：
```
[ViewFactory] [INFO] BrowserView created for account <id>
```

或
```
[ViewManager] [INFO] Session isolation verified for account <id>
```

## 调试翻译功能的完整流程

### 步骤 1: 使用调试模式启动
```cmd
start-with-debug.bat
```

### 步骤 2: 打开账号
在应用中打开一个 WhatsApp 账号

### 步骤 3: 等待 DevTools 自动打开
应该会自动弹出一个 DevTools 窗口

### 步骤 4: 查看 Console
切换到 Console 标签，查找 `[Translation]` 日志

### 步骤 5: 验证注入
执行：
```javascript
console.log(window.WhatsAppTranslation);
```

### 步骤 6: 查看主进程日志
在主控制台查看 `[TranslationIntegration]` 日志

## 常见问题

### Q: DevTools 打开了但是空白
**A**: 等待几秒钟，DevTools 需要时间加载

### Q: 按 F12 没反应
**A**: 
1. 确保焦点在 WhatsApp Web 页面
2. 尝试使用调试模式启动
3. 尝试 Ctrl+Shift+I

### Q: DevTools 打开了但看不到 [Translation] 日志
**A**: 
1. 等待页面完全加载
2. 刷新页面（Ctrl+R）
3. 查看主进程日志是否有错误

### Q: 主进程日志显示注入成功，但 DevTools 中 window.WhatsAppTranslation 是 undefined
**A**: 这是关键问题！说明：
1. executeJavaScript 可能被 CSP 阻止
2. 脚本执行时有错误
3. 需要查看 Console 中的错误消息

## 下一步

一旦 DevTools 打开并且可以看到 Console：

1. **如果看到 [Translation] 日志** → 翻译脚本正在工作，检查配置
2. **如果没有 [Translation] 日志** → 脚本没有注入，查看主进程日志
3. **如果有 JavaScript 错误** → 脚本注入但执行失败，需要修复错误
4. **如果有 CSP 错误** → 需要修改 CSP 策略或使用 preload 注入

---

**重要**: 使用调试模式启动是最可靠的方式，因为它会自动打开 DevTools 并启用详细日志。
