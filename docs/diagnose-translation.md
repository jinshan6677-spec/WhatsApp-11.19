# 翻译功能诊断指南

## 问题描述

翻译功能全部不正常。

## 可能的原因

### 1. 应用未重启

**症状:** 修改了代码但错误仍然存在

**解决方案:**
1. 完全关闭应用（不是最小化）
2. 重新运行 `npm run dev`
3. 检查启动日志中是否有错误

### 2. translation:apply-config 处理器未注册

**检查方法:**
查看启动日志中是否有：
```
[IPC] Single-window handlers registered
```

**如果没有，检查:**
- `src/single-window/ipcHandlers.js` 是否被正确加载
- `registerSingleWindowIPCHandlers` 是否被调用

### 3. 翻译 API 未暴露到前端

**检查方法:**
在浏览器控制台（F12）中输入：
```javascript
window.electronAPI.applyTranslationConfig
```

**应该返回:** 一个函数

**如果返回 undefined:**
- 检查 `src/single-window/renderer/preload-main.js`
- 确保 `applyTranslationConfig` 已定义

### 4. 翻译内容脚本未注入

**检查方法:**
在 WhatsApp 页面的控制台中输入：
```javascript
window.WhatsAppTranslation
```

**应该返回:** 一个对象

**如果返回 undefined:**
- 检查 preload 脚本是否正确加载
- 检查内容脚本是否被注入

## 诊断步骤

### 步骤 1: 检查应用是否使用新代码

1. 完全关闭应用
2. 删除 `node_modules/.cache` (如果存在)
3. 运行 `npm run dev`
4. 查看启动日志

### 步骤 2: 检查 IPC 处理器注册

在启动日志中查找：
```
[INFO] 单窗口IPC处理器注册完成
[INFO] 翻译IPC处理器注册完成 (legacy)
[INFO] 翻译服务IPC处理器注册完成 (IPCRouter - 13 channels)
```

### 步骤 3: 测试翻译配置保存

1. 打开翻译设置面板
2. 修改任何设置
3. 查看控制台是否有错误

**预期行为:** 设置应该保存成功，没有错误

**如果有错误:**
- 记录完整的错误信息
- 检查是哪个 IPC 通道失败

### 步骤 4: 测试翻译功能

1. 确保自动翻译已启用
2. 发送或接收消息
3. 检查消息是否被翻译

**如果没有翻译:**
- 打开浏览器控制台（F12）
- 查看是否有 JavaScript 错误
- 检查 `window.WhatsAppTranslation` 是否存在

## 常见问题和解决方案

### 问题 1: "No handler registered for 'translation:apply-config'"

**原因:** 应用仍在使用旧代码

**解决方案:**
1. 完全关闭应用
2. 确认 `src/single-window/ipcHandlers.js` 包含 `translation:apply-config` 处理器
3. 重新启动应用

### 问题 2: 翻译设置面板打不开

**可能原因:**
- 前端代码错误
- IPC 通道未注册

**检查:**
1. 浏览器控制台是否有错误
2. 主进程日志是否有错误

### 问题 3: 消息不翻译

**可能原因:**
- 翻译功能未启用
- 内容脚本未注入
- 翻译 API 调用失败

**检查:**
1. 翻译设置中"自动翻译"是否启用
2. `window.WhatsAppTranslation` 是否存在
3. 网络请求是否成功（查看 Network 标签）

### 问题 4: 翻译 API 调用失败

**可能原因:**
- API 密钥无效
- 网络问题
- 翻译服务未初始化

**检查:**
1. 查看主进程日志中的错误
2. 检查 API 密钥是否正确
3. 测试网络连接

## 需要提供的信息

如果问题仍然存在，请提供：

1. **启动日志** (startup_error.log 的最后 200 行)
2. **浏览器控制台错误** (F12 -> Console)
3. **具体症状:**
   - 翻译设置面板能否打开？
   - 能否保存设置？
   - 消息是否翻译？
   - 有什么错误信息？

4. **测试结果:**
   ```javascript
   // 在主窗口控制台运行
   window.electronAPI.applyTranslationConfig
   
   // 在 WhatsApp 页面控制台运行
   window.WhatsAppTranslation
   ```

## 快速修复尝试

### 方法 1: 清理并重启

```bash
# 关闭应用
# 然后运行：
npm run dev
```

### 方法 2: 检查文件完整性

确认以下文件存在且内容正确：
- `src/single-window/ipcHandlers.js` - 包含 translation:apply-config
- `src/main-refactored.js` - 调用 registerSingleWindowIPCHandlers
- `src/single-window/renderer/preload-main.js` - 定义 applyTranslationConfig

### 方法 3: 回退到旧版本

如果新代码有问题，可以临时使用旧的 main.js：

```json
// package.json
{
  "main": "src/main.js"  // 改回旧的入口
}
```

## 下一步

根据诊断结果，我可以：
1. 修复特定的 IPC 处理器问题
2. 修复内容脚本注入问题
3. 修复翻译 API 调用问题
4. 提供更详细的调试信息

请告诉我具体的症状和错误信息，我会提供针对性的解决方案。
