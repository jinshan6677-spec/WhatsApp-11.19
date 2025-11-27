# 翻译功能修复指南

## 当前状态

根据代码分析，翻译功能的架构是完整的：

### ✅ 已正常工作的部分

1. **IPC 通道注册** - 所有翻译 IPC 通道都已注册
   - `translation:getConfig`
   - `translation:saveConfig`
   - `translation:translate`
   - `translation:detectLanguage`
   - `translation:getStats`
   - `translation:clearCache`

2. **翻译服务** - TranslationService 已初始化并通过 IPCRouter 注册

3. **内容脚本** - 翻译内容脚本已实现

### ⚠️ 刚修复的部分

1. **translation:apply-config** - 刚添加的处理器，需要重启应用生效

## 立即修复步骤

### 步骤 1: 重启应用

```bash
# 1. 完全关闭当前运行的应用
# 2. 重新启动
npm run dev
```

### 步骤 2: 验证 IPC 处理器

启动后，检查日志中是否有：
```
[INFO] 单窗口IPC处理器注册完成
[INFO] 翻译IPC处理器注册完成 (legacy)
[INFO] 翻译服务IPC处理器注册完成 (IPCRouter - 13 channels)
```

### 步骤 3: 测试翻译设置

1. 打开应用
2. 点击翻译设置面板
3. 修改任何设置（如启用自动翻译）
4. 检查是否有错误

**预期结果:** 设置应该保存成功，不再有 "No handler registered for 'translation:apply-config'" 错误

## 如果问题仍然存在

### 问题 A: 消息不翻译

**可能原因:**
1. 自动翻译未启用
2. 翻译引擎配置错误
3. 内容脚本未注入

**检查步骤:**
1. 打开翻译设置，确认"自动翻译"已启用
2. 在 WhatsApp 页面按 F12，在控制台输入：
   ```javascript
   window.WhatsAppTranslation
   ```
   应该返回一个对象，不是 undefined

3. 检查是否有 JavaScript 错误

### 问题 B: 翻译设置无法保存

**症状:** 修改设置后刷新页面，设置恢复原样

**可能原因:**
1. IPC 调用失败
2. 配置文件写入失败

**检查步骤:**
1. 打开浏览器控制台（F12）
2. 修改设置
3. 查看是否有错误信息
4. 检查主进程日志

### 问题 C: 翻译按钮不显示

**可能原因:**
1. 输入框翻译未启用
2. UI 组件未正确加载

**检查步骤:**
1. 打开翻译设置
2. 确认"启用输入框翻译按钮"已勾选
3. 刷新 WhatsApp 页面

### 问题 D: 翻译 API 调用失败

**症状:** 点击翻译但没有反应

**可能原因:**
1. API 密钥未配置（对于 AI 引擎）
2. 网络问题
3. 翻译服务错误

**检查步骤:**
1. 如果使用 AI 引擎（GPT-4, Gemini, DeepSeek），确认已配置 API 密钥
2. 检查网络连接
3. 查看主进程日志中的错误

## 详细诊断

### 诊断命令 1: 检查前端 API

在主窗口控制台（F12）运行：
```javascript
// 检查 electronAPI 是否存在
console.log('electronAPI:', window.electronAPI);

// 检查翻译 API 方法
console.log('translationAPI:', window.translationAPI);

// 测试 getConfig
window.translationAPI.getConfig('test-account').then(console.log);
```

### 诊断命令 2: 检查内容脚本

在 WhatsApp 页面控制台运行：
```javascript
// 检查翻译对象
console.log('WhatsAppTranslation:', window.WhatsAppTranslation);

// 检查配置
if (window.WhatsAppTranslation) {
  console.log('Config:', window.WhatsAppTranslation.config);
}
```

### 诊断命令 3: 测试翻译功能

在 WhatsApp 页面控制台运行：
```javascript
// 测试翻译
if (window.translationAPI) {
  window.translationAPI.translate({
    accountId: 'test',
    text: 'Hello World',
    sourceLang: 'en',
    targetLang: 'zh-CN',
    engineName: 'google'
  }).then(console.log);
}
```

## 常见错误和解决方案

### 错误 1: "translationAPI 未初始化"

**原因:** Preload 脚本未正确加载

**解决方案:**
1. 检查 `src/single-window/renderer/preload-main.js`
2. 确认 `translationAPI` 已定义并导出
3. 重启应用

### 错误 2: "No handler registered for 'translation:apply-config'"

**原因:** 应用使用旧代码

**解决方案:**
1. 确认 `src/single-window/ipcHandlers.js` 包含 `translation:apply-config` 处理器
2. 完全关闭应用
3. 重新运行 `npm run dev`

### 错误 3: "Cannot read properties of undefined"

**原因:** 对象未初始化

**解决方案:**
1. 检查浏览器控制台的完整错误堆栈
2. 确认相关对象已正确初始化
3. 检查是否有异步加载问题

## 紧急回退方案

如果新代码有严重问题，可以临时回退：

### 方案 1: 使用旧的 main.js

```json
// package.json
{
  "main": "src/main.js"  // 改回旧的入口
}
```

### 方案 2: 禁用新的 IPC 处理器

在 `src/main-refactored.js` 中注释掉：
```javascript
// 注释掉这行
// registerSingleWindowIPCHandlers(accountManager, viewManager, mainWindow, translationIntegration);
```

## 需要的信息

如果问题仍然存在，请提供：

1. **具体症状** - 详细描述什么不工作
   - [ ] 消息不翻译
   - [ ] 设置无法保存
   - [ ] 翻译按钮不显示
   - [ ] API 调用失败
   - [ ] 其他：__________

2. **错误信息**
   - 浏览器控制台错误（F12 -> Console）
   - 主进程日志错误

3. **测试结果**
   - `window.electronAPI` 的输出
   - `window.translationAPI` 的输出
   - `window.WhatsAppTranslation` 的输出

4. **环境信息**
   - 应用是否完全重启过
   - 使用的翻译引擎（Google/GPT-4/等）
   - 是否配置了 API 密钥

## 下一步行动

1. **立即:** 重启应用，验证 `translation:apply-config` 错误是否消失
2. **然后:** 测试具体的翻译功能
3. **如果仍有问题:** 提供详细的错误信息和症状

我会根据你提供的具体信息进行针对性修复。
