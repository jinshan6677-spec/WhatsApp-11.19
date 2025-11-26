# 如何检查翻译功能是否工作

## 步骤 1: 打开浏览器控制台

### 方法 A: 使用快捷键（最简单）
1. 确保应用窗口处于活动状态
2. 按 **F12** 键

### 方法 B: 使用组合键
- **Windows/Linux**: `Ctrl + Shift + I`
- **Mac**: `Cmd + Option + I`

### 方法 C: 右键菜单
1. 在 WhatsApp Web 页面的任意位置右键点击
2. 选择"检查"或"Inspect"

## 步骤 2: 查看控制台日志

打开 DevTools 后，切换到 **Console** 标签，你应该看到：

### ✅ 成功的标志
```
[Translation] executeJavaScript test successful
[Translation] Account ID injected: <your-account-id>
[Translation] Verification result: {hasWhatsAppTranslation: true, ...}
[Translation] Content script initializing...
[Translation] WhatsApp Web loaded
[Translation] Config loaded: {...}
[Translation] Initialized successfully
```

### ❌ 失败的标志
- 没有看到任何 `[Translation]` 日志
- 看到 JavaScript 错误
- 看到 CSP (Content Security Policy) 错误

## 步骤 3: 手动验证

在 Console 中执行以下命令：

### 检查 window.WhatsAppTranslation
```javascript
console.log('WhatsAppTranslation:', window.WhatsAppTranslation);
```

**预期结果**: 应该看到一个对象，包含 `init`, `config`, `translateMessage` 等属性

**如果是 undefined**: 说明脚本没有注入成功

### 检查 window.translationAPI
```javascript
console.log('translationAPI:', window.translationAPI);
```

**预期结果**: 应该看到一个对象，包含 `translate`, `getConfig` 等方法

**如果是 undefined**: 说明 preload 脚本没有正确暴露 API

### 检查 window.ACCOUNT_ID
```javascript
console.log('ACCOUNT_ID:', window.ACCOUNT_ID);
```

**预期结果**: 应该看到你的账号 ID（一个字符串）

**如果是 undefined**: 说明账号 ID 没有注入

### 完整检查
```javascript
console.log({
  hasWhatsAppTranslation: typeof window.WhatsAppTranslation !== 'undefined',
  hasTranslationAPI: typeof window.translationAPI !== 'undefined',
  hasAccountId: typeof window.ACCOUNT_ID !== 'undefined',
  accountId: window.ACCOUNT_ID,
  initialized: window.WhatsAppTranslation?.initialized,
  config: window.WhatsAppTranslation?.config
});
```

## 步骤 4: 测试翻译功能

如果上述检查都通过，可以测试翻译功能：

### 测试基本功能
```javascript
// 测试 WhatsAppTranslation 对象
if (window.WhatsAppTranslation) {
  console.log('✓ WhatsAppTranslation 可用');
  console.log('  - initialized:', window.WhatsAppTranslation.initialized);
  console.log('  - config:', window.WhatsAppTranslation.config);
} else {
  console.log('✗ WhatsAppTranslation 不可用');
}
```

### 手动初始化（如果需要）
```javascript
// 如果 initialized 是 false，可以手动初始化
if (window.WhatsAppTranslation && !window.WhatsAppTranslation.initialized) {
  window.WhatsAppTranslation.init().then(() => {
    console.log('✓ 翻译系统初始化成功');
  }).catch(error => {
    console.error('✗ 翻译系统初始化失败:', error);
  });
}
```

## 步骤 5: 查看主进程日志

同时检查主进程（Node.js）的日志输出：

### 应该看到的日志
```
[TranslationIntegration] [INFO] Initializing translation integration
[TranslationIntegration] [INFO] Translation scripts loaded to cache
[ViewManager] [INFO] Injecting translation scripts for account <id>
[TranslationIntegration] [INFO] Page loaded for account <id>, URL: https://web.whatsapp.com
[TranslationIntegration] [INFO] Waiting 2 seconds for page to fully initialize...
[TranslationIntegration] [INFO] executeJavaScript test result: TEST_OK
[TranslationIntegration] [INFO] Account ID injected for <id>
[TranslationIntegration] [INFO] Optimizer injected for account <id>
[TranslationIntegration] [INFO] Injecting content script (128744 chars)...
[TranslationIntegration] [INFO] Content script injected for account <id>
[TranslationIntegration] [INFO] Verification result: {"hasWhatsAppTranslation":true,...}
[TranslationIntegration] [INFO] Initialization result: {"success":true}
[TranslationIntegration] [INFO] Translation scripts successfully injected for account <id>
```

## 常见问题排查

### 问题 1: DevTools 无法打开
**解决方案**: 
1. 确保点击的是 WhatsApp Web 页面，而不是侧边栏
2. 尝试不同的快捷键组合
3. 检查应用是否在开发模式运行

### 问题 2: 看不到 [Translation] 日志
**可能原因**:
- 脚本没有注入
- 页面还在加载中
- 脚本注入失败

**解决方案**:
1. 等待页面完全加载（看到 WhatsApp 界面）
2. 刷新页面（Ctrl+R 或 Cmd+R）
3. 查看主进程日志是否有错误

### 问题 3: window.WhatsAppTranslation 是 undefined
**可能原因**:
- executeJavaScript 失败
- CSP 阻止脚本执行
- 脚本有语法错误

**解决方案**:
1. 查看 Console 是否有 JavaScript 错误
2. 查看是否有 CSP 错误
3. 尝试手动执行 test-injection-script.js 的内容

### 问题 4: 有 CSP 错误
**错误示例**:
```
Refused to execute inline script because it violates the following 
Content Security Policy directive...
```

**解决方案**:
这是一个已知问题，需要修改 BrowserView 配置或使用 preload 脚本注入。

## 手动测试脚本

如果自动注入失败，可以手动执行测试脚本：

### 1. 复制 test-injection-script.js 的内容
打开项目根目录的 `test-injection-script.js` 文件

### 2. 在 Console 中粘贴并执行
将整个脚本内容粘贴到 Console 中，按 Enter

### 3. 验证结果
```javascript
console.log(window.WhatsAppTranslation);
window.WhatsAppTranslation.test();
```

应该看到:
```
[Test] WhatsAppTranslation.test() called
Translation system is working!
```

## 报告问题

如果翻译功能仍不工作，请提供：

1. **浏览器控制台截图**
   - 包含所有 [Translation] 日志
   - 包含任何错误消息

2. **手动验证结果**
   ```javascript
   console.log({
     hasWhatsAppTranslation: typeof window.WhatsAppTranslation !== 'undefined',
     hasTranslationAPI: typeof window.translationAPI !== 'undefined',
     hasAccountId: typeof window.ACCOUNT_ID !== 'undefined',
     accountId: window.ACCOUNT_ID
   });
   ```

3. **主进程日志**
   - 从应用启动到打开账号的完整日志
   - 特别是包含 [TranslationIntegration] 的行

4. **错误信息**
   - 任何 JavaScript 错误
   - 任何 CSP 错误
   - 任何主进程错误

---

**提示**: 如果你看到 `window.WhatsAppTranslation` 存在但翻译功能仍不工作，可能是配置或 UI 的问题，而不是注入的问题。
