# 实现计划：本地代理端口支持

## 概述

本实现计划将增强现有代理系统，添加本地代理端口支持，让中国用户可以通过外部代理客户端（如 Clash、V2rayN）的本地 HTTP 端口访问 WhatsApp 和翻译服务。

## 任务列表

- [x] 1. 实现 LocalProxyManager 核心模块
  - [x] 1.1 创建 LocalProxyManager 类和预设配置
    - 创建 `src/environment/LocalProxyManager.js` 文件
    - 实现 PRESETS 静态属性（Clash: 7890, V2rayN: 10808, Shadowsocks: 1080）
    - 实现 `getPreset(presetId)` 方法
    - 实现 `buildProxyUrl(config)` 方法
    - _Requirements: 1.3_

  - [x] 1.2 实现本地代理端口验证
    - 实现 `validateLocalProxy(host, port)` 方法
    - 验证主机地址（127.0.0.1 或 localhost）
    - 验证端口范围（1-65535）
    - 返回验证结果和错误信息
    - _Requirements: 1.1, 1.2_

  - [x] 1.3 编写 Property 1 属性测试：代理端口格式验证
    - **Property 1: 代理端口格式验证**
    - **Validates: Requirements 1.1, 1.2**

  - [x] 1.4 编写 Property 2 属性测试：预设端口自动填充
    - **Property 2: 预设端口自动填充**
    - **Validates: Requirements 1.3, 5.3**

  - [x] 1.5 实现本地代理连通性测试
    - 实现 `testLocalProxy(config)` 方法
    - 使用 axios 发送测试请求
    - 返回连接状态、延迟和错误信息
    - _Requirements: 1.5_

- [x] 2. 实现 ProxyChainManager 代理链模块
  - [x] 2.1 创建 ProxyChainManager 类
    - 创建 `src/environment/ProxyChainManager.js` 文件
    - 实现 `buildProxyChainRules(localProxy, chainedProxy)` 方法
    - 生成正确的代理规则字符串
    - _Requirements: 2.2, 2.3_

  - [x] 2.2 编写 Property 3 属性测试：代理链路由规则生成
    - **Property 3: 代理链路由规则生成**
    - **Validates: Requirements 1.4, 2.2, 2.3**

  - [x] 2.3 实现链式代理验证
    - 实现 `validateChainedProxy(localProxy, chainedProxy)` 方法
    - 通过本地代理测试链式代理连通性
    - _Requirements: 2.5_

  - [x] 2.4 实现代理链应用到 Session
    - 实现 `applyProxyChain(session, localProxy, chainedProxy)` 方法
    - 调用 Electron session.setProxy() 应用代理规则
    - _Requirements: 1.4, 2.1_

  - [x] 2.5 实现代理链诊断功能
    - 实现 `diagnoseProxyChain(localProxy, chainedProxy)` 方法
    - 区分本地代理问题和链式代理问题
    - _Requirements: 6.2, 6.3_

  - [x] 2.6 编写 Property 6 属性测试：错误来源诊断
    - **Property 6: 错误来源诊断**
    - **Validates: Requirements 6.2**

- [x] 3. 检查点 - 核心模块完成
  - 确保所有测试通过，如有问题请询问用户

- [x] 4. 实现 ProxyHealthMonitor 健康监控模块
  - [x] 4.1 创建 ProxyHealthMonitor 类
    - 创建 `src/environment/ProxyHealthMonitor.js` 文件
    - 实现构造函数，接受 checkInterval 和 onStatusChange 回调
    - 实现 `start(proxyConfig)` 方法
    - 实现 `stop()` 方法
    - _Requirements: 4.1_

  - [x] 4.2 实现定期连接检查
    - 使用 setInterval 每 60 秒检查连接
    - 实现 `checkNow()` 方法用于手动检查
    - 实现 `getStatus()` 方法获取当前状态
    - _Requirements: 4.1, 4.4_

  - [x] 4.3 实现状态变化通知
    - 检测连接状态变化（connected/disconnected/error）
    - 调用 onStatusChange 回调通知状态变化
    - _Requirements: 4.2_

- [x] 5. 实现 TranslationProxyAdapter 翻译代理模块
  - [x] 5.1 创建 TranslationProxyAdapter 类
    - 创建 `src/environment/TranslationProxyAdapter.js` 文件
    - 实现 `configure(proxyConfig, mode)` 方法
    - 支持 'always'、'auto'、'never' 三种模式
    - _Requirements: 3.4_

  - [x] 5.2 实现翻译服务封锁检测
    - 实现 `detectBlocked()` 方法
    - 尝试直接访问翻译服务 API
    - 根据响应判断是否被封锁
    - _Requirements: 3.2_

  - [x] 5.3 实现代理翻译请求
    - 实现 `translateWithProxy(text, targetLang, proxyConfig)` 方法
    - 使用 https-proxy-agent 通过代理发送请求
    - _Requirements: 3.1, 3.3_

  - [x] 5.4 编写 Property 5 属性测试：翻译服务代理配置
    - **Property 5: 翻译服务代理配置**
    - **Validates: Requirements 3.1, 3.4**

- [x] 6. 检查点 - 后端模块完成
  - 确保所有测试通过，如有问题请询问用户

- [x] 7. 实现日志脱敏工具
  - [x] 7.1 创建日志脱敏函数
    - 在 `src/utils/` 目录创建或扩展日志工具
    - 实现 `sanitizeForLogging(config)` 函数
    - 脱敏密码和认证信息
    - _Requirements: 6.4_

  - [x] 7.2 编写 Property 7 属性测试：日志敏感数据脱敏
    - **Property 7: 日志敏感数据脱敏**
    - **Validates: Requirements 6.4**

- [x] 8. 集成到现有代理系统
  - [x] 8.1 扩展 ProxyManager
    - 修改 `src/environment/ProxyManager.js`
    - 添加对本地代理配置的支持
    - 集成 LocalProxyManager 和 ProxyChainManager
    - _Requirements: 1.4_

  - [x] 8.2 修改 ViewFactory 代理应用逻辑
    - 修改 `src/presentation/windows/view-manager/ViewFactory.js`
    - 支持本地代理和代理链配置
    - _Requirements: 1.4, 2.4_

  - [x] 8.3 编写 Property 4 属性测试：多账号链式代理隔离
    - **Property 4: 多账号链式代理隔离**
    - **Validates: Requirements 2.4**

- [x] 9. 实现用户界面
  - [x] 9.1 扩展 ProxySettingsPanel
    - 添加"本地代理"选项区域
    - 添加代理客户端预设下拉选择
    - 添加自定义端口输入框
    - _Requirements: 5.1, 5.2_

  - [x] 9.2 实现预设自动填充
    - 选择预设时自动填充端口
    - 显示当前连接模式
    - _Requirements: 5.3, 5.4_

  - [x] 9.3 实现连接状态指示器
    - 添加状态指示器 UI（绿色/黄色/红色）
    - 添加"测试连接"按钮
    - 集成 ProxyHealthMonitor 状态
    - _Requirements: 4.3, 4.4_

  - [x] 9.4 实现错误消息显示
    - 显示用户友好的错误消息
    - 使用 ERROR_MESSAGES 映射
    - _Requirements: 5.5, 6.1_

- [x] 10. 集成翻译服务代理
  - [x] 10.1 修改翻译服务配置
    - 在翻译设置中添加代理选项
    - 支持 'always'、'auto'、'never' 模式选择
    - _Requirements: 3.4_

  - [x] 10.2 集成 TranslationProxyAdapter
    - 修改翻译服务调用逻辑
    - 根据配置决定是否使用代理
    - 实现失败重试逻辑
    - _Requirements: 3.1, 3.3_

- [x] 11. 最终检查点
  - 确保所有测试通过
  - 验证所有功能正常工作
  - 如有问题请询问用户

## 说明

- 所有任务都必须完成，包括属性测试
- 每个任务都引用了对应的需求编号
- 属性测试任务引用了设计文档中的属性编号
- 检查点任务用于确保阶段性完成
