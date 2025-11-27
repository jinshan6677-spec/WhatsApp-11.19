# 翻译功能流程全面排查

## 问题现象
1. `window.WhatsAppTranslation` 返回 `undefined`
2. 翻译面板无法获取活动聊天信息
3. IPC 处理器已注册但功能不工作

## 排查流程

### 1. 检查 TranslationIntegration 初始化
- [ ] TranslationIntegration 是否被创建
- [ ] initialize() 是否被调用
- [ ] 脚本是否成功加载到缓存

### 2. 检查 ViewManager 初始化
- [ ] ViewManager 是否接收到 translationIntegration
- [ ] ViewTranslationIntegration 是否被正确创建

### 3. 检查账号打开流程
- [ ] openAccount 是否调用 injectScripts
- [ ] injectScripts 是否成功执行
- [ ] 脚本是否注入到正确的 webContents

### 4. 检查脚本注入时机
- [ ] did-finish-load 事件是否触发
- [ ] 页面 URL 是否正确（web.whatsapp.com）
- [ ] executeJavaScript 是否成功

### 5. 检查内容脚本
- [ ] contentScript.js 是否正确导出 window.WhatsAppTranslation
- [ ] 脚本执行是否有错误

## 开始排查...
