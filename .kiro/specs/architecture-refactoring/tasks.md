# Implementation Plan

- [x] 1. 核心基础设施搭建





  - [x] 1.1 创建新的目录结构


    - 创建 `src/core/eventbus/`、`src/core/container/`、`src/core/config/`、`src/core/errors/`、`src/core/state/` 目录
    - 创建 `src/domain/entities/`、`src/domain/repositories/`、`src/domain/events/`、`src/domain/errors/` 目录
    - 创建 `src/application/services/`、`src/application/usecases/`、`src/application/dtos/` 目录
    - 创建 `src/infrastructure/repositories/`、`src/infrastructure/storage/`、`src/infrastructure/plugins/` 目录
    - 创建 `src/presentation/ipc/`、`src/presentation/windows/` 目录
    - _Requirements: 1.1_


  - [x] 1.2 实现基础错误类型层次结构

    - 创建 `src/core/errors/AppError.js` 基类，包含 code、context、recoverable 属性
    - 创建 ValidationError、NetworkError、StorageError、PluginError、IPCError、StateError 子类
    - 实现 toJSON() 和 fromJSON() 序列化方法
    - _Requirements: 6.1, 6.2_


  - [x] 1.3 编写错误类型属性测试

    - **Property 19: Error Context Preservation**
    - **Validates: Requirements 6.2**

- [x] 2. 事件总线系统实现






  - [x] 2.1 实现 EventBus 核心功能

    - 创建 `src/core/eventbus/EventBus.js`
    - 实现 publish()、subscribe()、subscribeOnce() 方法
    - 实现异步事件传递机制
    - 实现事件历史记录功能
    - _Requirements: 3.1, 3.2, 3.5_


  - [x] 2.2 实现事件类型验证

    - 创建 `src/core/eventbus/EventSchema.js` 用于定义事件 schema
    - 实现 payload 验证逻辑
    - 实现订阅者错误隔离机制
    - _Requirements: 3.3, 3.4_


  - [x] 2.3 编写事件总线属性测试

    - **Property 6: Event Delivery Completeness**
    - **Property 7: Event Payload Validation**
    - **Property 8: Subscriber Error Isolation**
    - **Property 9: Event History Retention**
    - **Property 10: Subscription Cleanup**
    - **Validates: Requirements 3.2, 3.3, 3.4, 3.5, 3.6**

- [x] 3. Checkpoint - 确保所有测试通过





  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. 增强依赖注入容器





  - [x] 4.1 扩展 DependencyContainer 支持服务作用域


    - 修改 `src/app/DependencyContainer.js` 或创建新版本
    - 实现 singleton、transient、scoped 三种作用域
    - 实现 createScope() 方法创建作用域
    - _Requirements: 7.1_


  - [x] 4.2 实现循环依赖检测和懒加载

    - 增强 resolve() 方法检测循环依赖
    - 实现 registerLazy() 方法支持懒初始化
    - 实现服务装饰器功能 decorate()
    - _Requirements: 7.2, 7.3, 7.5_


  - [x] 4.3 实现服务接口验证

    - 创建接口验证机制
    - 在注册时验证服务是否实现所需接口
    - 实现友好的错误提示，包含可用服务列表
    - _Requirements: 7.4, 7.6_


  - [x] 4.4 编写依赖容器属性测试

    - **Property 23: Service Scope Behavior**
    - **Property 24: Circular Dependency Detection**
    - **Property 25: Lazy Service Initialization**
    - **Property 26: Service Not Found Error**
    - **Property 27: Service Decoration**
    - **Property 28: Service Interface Validation**
    - **Validates: Requirements 7.1, 7.2, 7.3, 7.4, 7.5, 7.6**

- [x] 5. 配置管理系统实现





  - [x] 5.1 实现 ConfigProvider 核心功能


    - 创建 `src/core/config/ConfigProvider.js`
    - 实现 get()、set()、has()、load()、save() 方法
    - 实现配置 schema 验证
    - _Requirements: 5.1, 5.2_


  - [x] 5.2 实现配置继承和变更通知

    - 实现环境特定配置覆盖机制
    - 实现 onChange() 监听器注册
    - 实现敏感值加密存储
    - _Requirements: 5.3, 5.4, 5.5_


  - [x] 5.3 实现配置序列化和 Pretty Printer

    - 实现 serialize() 和 deserialize() 方法
    - 创建 prettyPrint() 方法用于调试输出
    - _Requirements: 1.5, 5.6_


  - [x] 5.4 编写配置管理属性测试

    - **Property 1: Configuration Round-Trip Consistency**
    - **Property 15: Config Schema Validation**
    - **Property 16: Config Inheritance Override**
    - **Property 17: Config Change Notification**
    - **Property 18: Sensitive Config Encryption**
    - **Validates: Requirements 1.5, 5.2, 5.3, 5.4, 5.5, 5.6**

- [x] 6. Checkpoint - 确保所有测试通过









  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. 领域实体和 Repository 实现






  - [x] 7.1 重构领域实体

    - 创建 `src/domain/entities/Account.js` 包含领域方法
    - 创建 `src/domain/entities/ProxyConfig.js`
    - 创建 `src/domain/entities/TranslationConfig.js`
    - 实现 toJSON()、fromJSON()、prettyPrint() 方法
    - _Requirements: 4.1, 4.6_


  - [x] 7.2 编写实体序列化属性测试

    - **Property 14: Data Model Round-Trip**
    - **Validates: Requirements 4.6**

  - [x] 7.3 定义 Repository 接口


    - 创建 `src/domain/repositories/IRepository.js` 基础接口
    - 创建 `src/domain/repositories/IAccountRepository.js`
    - 创建 `src/domain/repositories/IProxyRepository.js`
    - 创建 `src/domain/repositories/ITranslationRepository.js`
    - _Requirements: 4.1_



  - [x] 7.4 实现 Repository 具体类
    - 创建 `src/infrastructure/repositories/AccountRepository.js`
    - 创建 `src/infrastructure/repositories/ProxyRepository.js`
    - 实现数据验证和错误处理
    - _Requirements: 4.2, 4.4_


  - [x] 7.5 编写 Repository 属性测试

    - **Property 12: Validation Error Detail**
    - **Validates: Requirements 4.4**


  - [x] 7.6 实现 Unit of Work 模式

    - 创建 `src/infrastructure/repositories/UnitOfWork.js`
    - 实现事务性操作和回滚机制
    - _Requirements: 4.3_


  - [x] 7.7 编写 Unit of Work 属性测试

    - **Property 11: Unit of Work Atomicity**
    - **Validates: Requirements 4.3**

- [x] 8. 数据迁移系统






  - [x] 8.1 实现数据迁移框架

    - 创建 `src/infrastructure/storage/MigrationRunner.js`
    - 实现迁移版本管理
    - 实现迁移回滚功能
    - _Requirements: 4.5_


  - [x] 8.2 编写迁移属性测试

    - **Property 13: Migration Rollback**
    - **Validates: Requirements 4.5**

- [x] 9. Checkpoint - 确保所有测试通过





  - Ensure all tests pass, ask the user if questions arise.

- [x] 10. 状态管理系统实现





  - [x] 10.1 实现 StateManager 核心功能


    - 创建 `src/core/state/StateManager.js`
    - 实现 getState()、setState()、getSlice()、setSlice() 方法
    - 实现观察者模式 subscribe()、subscribeToSlice()
    - _Requirements: 9.1, 9.2_


  - [x] 10.2 实现状态持久化和快照

    - 实现 persist() 和 restore() 方法
    - 实现状态完整性验证
    - 实现 snapshot() 方法用于调试
    - _Requirements: 9.3, 9.4, 9.5_


  - [x] 10.3 实现状态序列化

    - 实现 serialize() 和 deserialize() 方法
    - 处理状态损坏情况
    - _Requirements: 9.6_


  - [x] 10.4 编写状态管理属性测试

    - **Property 33: State Change Notification**
    - **Property 34: State Persistence Round-Trip**
    - **Property 35: State Corruption Handling**
    - **Property 36: State Snapshot Accuracy**
    - **Property 37: State Serialization Round-Trip**
    - **Validates: Requirements 9.2, 9.3, 9.4, 9.5, 9.6**

- [x] 11. 插件系统实现





  - [x] 11.1 实现 PluginManager 核心功能


    - 创建 `src/infrastructure/plugins/PluginManager.js`
    - 实现 register()、unregister()、enable()、disable() 方法
    - 实现插件接口验证
    - _Requirements: 2.1, 2.2_


  - [x] 11.2 实现插件生命周期管理

    - 实现依赖排序和初始化顺序
    - 实现插件错误隔离
    - 实现资源清理机制
    - _Requirements: 2.3, 2.4, 2.6_


  - [x] 11.3 实现 PluginContext

    - 创建 `src/infrastructure/plugins/PluginContext.js`
    - 提供 eventBus、container、config 访问
    - 实现 registerService()、registerIPCHandler() 钩子
    - _Requirements: 2.5_


  - [x] 11.4 编写插件系统属性测试

    - **Property 2: Plugin Interface Validation**
    - **Property 3: Plugin Dependency Order**
    - **Property 4: Plugin Error Isolation**
    - **Property 5: Plugin Resource Cleanup**
    - **Validates: Requirements 2.2, 2.3, 2.4, 2.6**

- [x] 12. Checkpoint - 确保所有测试通过









  - Ensure all tests pass, ask the user if questions arise.

- [x] 13. IPC 通信层重构






  - [x] 13.1 实现 IPCRouter 核心功能

    - 创建 `src/presentation/ipc/IPCRouter.js`
    - 实现 register()、unregister()、handle() 方法
    - 实现请求 schema 验证
    - _Requirements: 8.1, 8.2_


  - [x] 13.2 实现超时和批处理

    - 实现请求超时处理
    - 实现 batch() 方法批量处理请求
    - 实现结构化错误响应
    - _Requirements: 8.3, 8.4, 8.5_


  - [x] 13.3 生成 IPC 通道文档

    - 创建文档生成工具
    - 从类型定义生成 API 文档
    - _Requirements: 8.6_


  - [x] 13.4 编写 IPC 属性测试

    - **Property 29: IPC Payload Validation**
    - **Property 30: IPC Timeout Handling**
    - **Property 31: IPC Error Response**
    - **Property 32: IPC Batch Processing**
    - **Validates: Requirements 8.2, 8.3, 8.4, 8.5**

- [x] 14. 错误处理系统完善






  - [x] 14.1 实现 ErrorHandler 核心功能

    - 创建 `src/core/errors/ErrorHandler.js`
    - 实现 handle()、recover() 方法
    - 实现恢复策略注册机制
    - _Requirements: 6.3_



  - [x] 14.2 实现错误日志和本地化
    - 实现结构化错误日志
    - 实现错误消息本地化
    - 实现关键错误时状态保存
    - _Requirements: 6.4, 6.5, 6.6_


  - [x] 14.3 编写错误处理属性测试

    - **Property 20: Error Recovery Execution**
    - **Property 21: Error Logging Completeness**
    - **Property 22: Error Message Localization**
    - **Validates: Requirements 6.3, 6.5, 6.6**

- [x] 15. Checkpoint - 确保所有测试通过





  - Ensure all tests pass, ask the user if questions arise.

- [x] 16. 测试基础设施搭建





  - [x] 16.1 创建 Mock 实现


    - 创建 `test/mocks/ElectronMock.js`
    - 创建 `test/mocks/StorageMock.js`
    - 创建 `test/mocks/NetworkMock.js`
    - _Requirements: 10.1_

  - [x] 16.2 创建测试生成器 (Arbitraries)


    - 创建 `test/arbitraries/index.js`
    - 实现 accountArbitrary、proxyConfigArbitrary 等
    - 实现 eventArbitrary、pluginArbitrary 等
    - _Requirements: 10.3, 10.6_

  - [x] 16.3 配置测试环境隔离


    - 配置 Jest 测试隔离
    - 实现测试前后清理钩子
    - _Requirements: 10.2_

  - [x] 16.4 编写测试基础设施属性测试






    - **Property 38: Test Environment Isolation**
    - **Property 39: Test Failure Context**
    - **Validates: Requirements 10.2, 10.4**

- [x] 17. 集成和迁移


  - [x] 17.1 更新应用引导器
    - 修改 `src/app/bootstrap.js` 使用新架构组件
    - 集成 EventBus、ConfigProvider、StateManager
    - 集成 PluginManager、IPCRouter
    - _Requirements: 1.1, 1.2, 1.3_

  - [x] 17.2 迁移现有管理器
    - 将 AccountConfigManager 迁移到新 Repository 模式
    - 将 ProxyConfigManager 迁移到新 Repository 模式
    - 保持向后兼容性
    - _Requirements: 1.4, 4.2_

  - [x] 17.3 更新 IPC 处理器
    - 将现有 IPC 处理器迁移到 IPCRouter
    - 添加请求验证和错误处理
    - _Requirements: 8.1, 8.2_

- [x] 18. Final Checkpoint - 确保所有测试通过



  - Ensure all tests pass, ask the user if questions arise.



- [x] 19. 大文件拆分 - ViewManager.js (4096行)






  - [x] 19.1 创建视图管理模块目录结构





    - 创建 `src/presentation/windows/view-manager/` 目录（新架构位置）
    - 创建模块索引文件 `index.js`
    - 原 `src/single-window/ViewManager.js` 保留作为入口，导入新模块
    - _Requirements: 1.1, 13_


  - [x] 19.2 提取视图创建和生命周期模块

    - 提取 `ViewFactory.js` 到 `src/presentation/windows/view-manager/`
    - 提取 `ViewLifecycle.js` 生命周期管理（创建、销毁、重载）
    - 保持现有功能不变
    - _Requirements: 1.1, 13_


  - [x] 19.3 提取视图布局和边界模块

    - 提取 `ViewBoundsManager.js` 边界计算和布局管理
    - 提取 `ViewResizeHandler.js` 窗口大小调整处理
    - 保持现有功能不变
    - _Requirements: 1.1, 13_

  - [x] 19.4 提取内存和性能管理模块


    - 提取 `ViewMemoryManager.js` 内存管理
    - 提取 `ViewPerformanceOptimizer.js` 性能优化
    - 保持现有功能不变
    - _Requirements: 1.1, 13_


  - [x] 19.5 提取代理集成模块（为代理重写做准备）

    - 提取 `ViewProxyIntegration.js` 代理相关逻辑
    - 保持现有代理功能不变（包括回退直连逻辑）
    - **在回退直连代码处添加注释**：`// TODO: 任务22.11将删除此回退逻辑`
    - 为后续代理重写做准备
    - _Requirements: 1.1, 13_


  - [x] 19.6 提取翻译集成模块

    - 提取 `ViewTranslationIntegration.js` 翻译相关逻辑
    - 保持现有翻译功能不变
    - _Requirements: 1.1, 13_


  - [x] 19.7 重构ViewManager主文件

    - 将 `src/presentation/windows/view-manager/ViewManager.js` 作为新主文件（500行以下）
    - 使用依赖注入引用拆分后的模块
    - 更新 `src/single-window/ViewManager.js` 作为兼容层，导出新模块
    - 保持API向后兼容
    - _Requirements: 1.1, 13_

- [x] 20. 大文件拆分 - ipcHandlers.js (1933行)





  - [x] 20.1 创建IPC处理器目录结构


    - 创建 `src/presentation/ipc/handlers/` 目录（新架构位置）
    - 创建模块索引文件 `index.js`
    - 原 `src/single-window/ipcHandlers.js` 保留作为入口，导入新模块
    - _Requirements: 8.1, 13_

  - [x] 20.2 按功能域拆分IPC处理器


    - 提取 `AccountIPCHandlers.js` 到 `src/presentation/ipc/handlers/`
    - 提取 `ViewIPCHandlers.js` 视图相关IPC
    - 提取 `SystemIPCHandlers.js` 系统相关IPC
    - 保持现有功能不变
    - _Requirements: 8.1, 13_

  - [x] 20.3 提取代理IPC处理器（为任务22.10代理重写做准备）


    - 从 `src/single-window/ipcHandlers.js` 提取代理相关IPC到 `src/presentation/ipc/handlers/ProxyIPCHandlers.js`
    - **注意**：此任务只是拆分文件，保持现有8个IPC通道功能不变
    - **后续任务22.10将在此基础上重写**，添加安全功能和新IPC通道
    - 保持现有功能不变
    - _Requirements: 8.1, 13_

  - [x] 20.4 提取翻译IPC处理器


    - 提取 `TranslationIPCHandlers.js` 翻译相关IPC
    - 保持现有功能不变
    - _Requirements: 8.1, 13_

  - [x] 20.5 重构ipcHandlers主文件


    - 创建 `src/presentation/ipc/handlers/index.js` 作为新主文件（200行以下）
    - 使用模块聚合方式组织
    - 更新 `src/single-window/ipcHandlers.js` 作为兼容层，导出新模块
    - 保持API向后兼容
    - _Requirements: 8.1, 13_

- [x] 21. Checkpoint - 确保大文件拆分后测试通过





  - Ensure all tests pass, ask the user if questions arise.

- [ ] 22. 代理功能完全重写（企业级IP安全防护 - 参考AdsPower/Multilogin设计）
  - [x] 22.1 分析现有代理功能并记录





    - 分析 `src/managers/ProxyConfigManager.js` 现有功能
    - 分析 `src/ipc/proxyIPCHandlers.js` 现有8个IPC通道
    - 分析 `src/services/ProxyDetectionService.js` 代理检测服务
    - 分析 `ViewManager._configureProxy()` 代理配置逻辑
    - **记录当前回退直连的问题代码位置**
    - 记录所有现有功能点，确保重写后功能完整
    - _Requirements: 12_


  - [x] 22.2 扩展代理领域实体和创建新事件



    - 扩展 `src/domain/entities/ProxyConfig.js`（已存在，添加安全属性）：
      - **保留现有属性**：id、enabled、protocol、host、port、username、password、bypass、name、createdAt、lastUsedAt
      - **新增安全属性**：
        - killSwitchEnabled: boolean - 是否启用Kill-Switch（默认true）
        - verifyIPBeforeConnect: boolean - 连接前是否验证IP（默认true）
        - healthCheckInterval: number - 健康检查间隔（默认30000毫秒）
        - maxConsecutiveFailures: number - 最大连续失败次数（默认3）
      - **新增统计属性**：
        - connectionCount: number - 连接次数（默认0）
        - successCount: number - 成功次数（默认0）
        - failureCount: number - 失败次数（默认0）
        - lastConnectedAt: Date - 最后连接时间
        - lastVerifiedIP: string - 最后验证的出口IP
    - 创建 `src/domain/entities/ProxyConnectionStatus.js` 连接状态实体（新建）
    - 创建 `src/domain/entities/ProxyHealthStats.js` 健康统计实体（新建）
    - 创建 `src/domain/errors/ProxyError.js` 代理错误类型（新建，含错误码）
    - 创建领域事件（新建）：
      - `src/domain/events/ProxyConnectedEvent.js`
      - `src/domain/events/ProxyDisconnectedEvent.js`
      - `src/domain/events/KillSwitchActivatedEvent.js`
      - `src/domain/events/IPLeakDetectedEvent.js`
    - _Requirements: 12, 4.1, 3.1_
  
  - [x] 22.2.1 创建ProxyConfig数据迁移







    - 创建迁移脚本 `src/infrastructure/storage/migrations/AddProxySecurityFields.js`
    - 为现有代理配置添加默认安全属性：
      - killSwitchEnabled: true
      - verifyIPBeforeConnect: true
      - healthCheckInterval: 30000
      - maxConsecutiveFailures: 3
    - 初始化统计字段为0：
      - connectionCount: 0
      - successCount: 0
      - failureCount: 0
    - 使用 MigrationRunner 执行迁移
    - _Requirements: 4.5, 12_

-

  - [x] 22.3 创建代理安全核心模块（零信任网络模型）



    - 创建 `src/infrastructure/proxy/` 目录结构
    - 创建 `ProxySecurityManager.js` 安全策略管理器：
      - enforceProxyOnly(session) - 强制所有请求通过代理
      - blockDirectConnections(session) - 拦截并阻止直连请求
      - configureProxyRules(session, config) - 配置代理规则
      - setupRequestInterceptor(session) - 设置请求拦截器
    - _Requirements: 12.1, 12.2_

  - [x] 22.4 实现多层IP泄露防护





    - 创建 `IPProtectionInjector.js` IP保护脚本注入：
      - 完全禁用WebRTC（RTCPeerConnection、RTCDataChannel、RTCSessionDescription）
      - 禁用mediaDevices.getUserMedia
      - 覆盖navigator.connection返回undefined
      - 禁用navigator.getBattery
    - 创建 `WebRTCBlocker.js` WebRTC阻断模块
    - 创建 `DNSLeakPrevention.js` DNS泄露防护：
      - 配置proxyDNS确保DNS通过代理
      - 禁用浏览器预连接和预取
    - _Requirements: 12.2_

-

  - [x] 22.5 实现代理连接管理器（禁止回退直连 - 核心安全）



    - 创建 `ProxyConnectionManager.js`：
      - connect(accountId, config) - 安全连接（含预检测）
      - disconnect(accountId) - 安全断开
      - reconnect(accountId) - 重新连接
      - getStatus(accountId) - 获取连接状态
      - **handleFailure(accountId, error) - 失败处理（阻断而非回退）**
      - **区分两种失败场景**：
        - **打开前失败**：禁止创建视图，显示警告
        - **运行中失败**：保持视图，禁止网络，触发重连机制
    - 创建 `KillSwitch.js` Kill-Switch机制：
      - enable(accountId) - 启用Kill-Switch
      - trigger(accountId, reason) - 触发Kill-Switch
      - reset(accountId) - 重置（需用户确认）
      - **触发条件：代理断开、连续3次健康检查失败、IP泄露检测**
      - **触发动作：阻断所有网络请求、保持BrowserView、显示重连UI**
    - 创建 `ProxyReconnectionManager.js` 重连管理器：
      - startAutoReconnect(accountId, config) - 启动自动重连
      - stopAutoReconnect(accountId) - 停止自动重连
      - manualReconnect(accountId) - 手动重连
      - getReconnectionStatus(accountId) - 获取重连状态
      - **自动重连策略**：3次指数退避（2秒 → 3秒 → 5秒）
      - **重连成功**：解除Kill-Switch，恢复网络，刷新页面
      - **重连失败**：保持Kill-Switch，等待用户操作
    - _Requirements: 12.1_


  - [x] 22.6 实现代理预检测和IP验证（连接前验证 - 关键）




    - 创建 `ProxyPreChecker.js` 代理预检测：
      - testConnectivity(config) - 测试代理连通性（超时3秒）
      - measureLatency(config) - 测量延迟
      - getExitIP(config) - 获取代理出口IP
    - 创建 `IPLeakDetector.js` IP验证和泄露检测：
      - verifyExitIP(expectedIP) - 验证出口IP一致性
      - detectLeak() - 检测IP泄露
      - 多源IP检测（ipinfo.io, ip-api.com, ipify.org）
    - **在创建BrowserView之前必须通过预检测和IP验证**
    - _Requirements: 12.2_



  - [x] 22.7 实现代理健康监控（实时监控 - 连接中验证）

    - 创建 `ProxyHealthMonitor.js`：
      - startMonitoring(accountId, config) - 开始监控
      - stopMonitoring(accountId) - 停止监控
      - checkHealth(accountId) - 执行健康检查
      - getStats(accountId) - 获取健康统计
      - **verifyIPPeriodically(accountId) - 定期验证出口IP（连接后验证）**
    - 监控配置：
      - 健康检查间隔：30秒（可配置）
      - **IP验证间隔：5分钟（可配置）**
      - 延迟阈值：500ms（超过记录日志，不告警）
      - 失败阈值：3次（连续失败触发Kill-Switch）
    - 健康统计：uptime、平均延迟、失败次数、最后检查时间、最后IP验证时间
    - **IP变化检测：如果出口IP与初始IP不一致，立即触发Kill-Switch**
    - **失败处理策略**：
      - **运行中失败**：静默处理，触发Kill-Switch，启动自动重连
      - **不显示警告弹窗**，只在视图内显示重连UI
      - 记录所有事件到日志
    - _Requirements: 12.3_

  - [x] 22.8 重写代理服务层（整合所有安全功能）



    - 创建 `src/application/services/ProxyService.js`：
      - **secureConnect(accountId, config)** - 安全连接核心方法：
        1. 验证代理配置
        2. 代理预检测（测试连通性）
        3. IP验证（验证出口IP）
        4. 创建隔离Session
        5. 启用安全防护（Kill-Switch、请求拦截）
        6. 返回连接结果
      - secureDisconnect(accountId) - 安全断开
      - testProxy(config) - 测试代理（返回出口IP和延迟）
      - validateConfig(config) - 验证配置
      - parseProxyString(input) - 智能填写解析（现有功能）
    - _Requirements: 12, 12.1, 12.2, 12.3_

  - [x] 22.9 扩展代理Repository（在现有基础上增强）



    - 扩展 `src/infrastructure/repositories/ProxyRepository.js`（已存在，添加新功能）
    - **保留现有功能**：CRUD、findByProtocol、findEnabled、findByHost、findByName、updateLastUsed
    - **新增功能**：
      - addConnectionStats(id, stats) - 记录连接统计
      - getConnectionStats(id) - 获取连接统计
      - incrementSuccessCount(id) - 增加成功次数
      - incrementFailureCount(id) - 增加失败次数
      - getSuccessRate(id) - 计算成功率
    - 扩展 ProxyConfig 实体添加统计字段（connectionCount、successCount、failureCount、lastConnectedAt）
    - _Requirements: 4.1, 4.2, 12.3_

  - [x] 22.10 重写代理IPC处理器（在任务20.3拆分的基础上）












    - 重写 `src/presentation/ipc/handlers/ProxyIPCHandlers.js`（任务20.3已拆分到此位置）
    - 使用新的代理安全模块（ProxyService、ProxySecurityManager等）
    - **保留所有现有IPC功能（8个）**：
      - proxy:get-all-configs
      - proxy:get-config
      - proxy:save-config
      - proxy:delete-config
      - proxy:test-service（**增强**：返回出口IP和安全检查结果）
      - proxy:test-network
      - proxy:generate-name
      - proxy:validate-config
    - **添加新的安全IPC（7个）**：
      - proxy:secure-connect（安全连接 - 含预检测和IP验证）
      - proxy:secure-disconnect（安全断开）
      - proxy:health-status（健康状态查询）
      - proxy:kill-switch-status（Kill-Switch状态）
      - proxy:reconnect（手动重连）
      - proxy:reconnection-status（重连状态查询）
      - proxy:switch-proxy（平滑切换代理）
    - _Requirements: 8.1, 8.2_

  - [x] 22.11 集成到ViewManager（修复回退直连问题 - 安全关键）

    - 重写 `src/presentation/windows/view-manager/ViewProxyIntegration.js`（任务19.5已拆分到此位置）
    - 使用新的代理安全模块（ProxyService、KillSwitch、IPProtectionInjector、ProxyReconnectionManager等）
    - **🔴 必须删除现有的回退直连逻辑（3处，通过代码特征定位）**：
      - **特征1**：搜索 `代理配置失败，将使用直连` 注释附近的回退代码
      - **特征2**：搜索 `proxyDisabledDueToError = true` 附近的回退代码
      - **特征3**：搜索 `尝试禁用代理并重新加载` 注释附近的回退代码
      - **删除模式**：所有 `await session.setProxy({ proxyRules: '' })` 清除代理的代码
      - **删除模式**：所有 `config.proxy.enabled = false` 禁用代理的代码
    - **实现新的零妥协安全流程**：
      - **场景1：打开WhatsApp前失败**
        1. 调用 ProxyService.secureConnect() 进行安全连接
        2. 预检测失败 → ⚠️ 显示错误提示，**❌ 不创建视图**
        3. IP验证失败 → ⚠️ 显示错误提示，**❌ 不创建视图**
        4. 连接成功 → ✅ 创建BrowserView
        5. 注入IP保护脚本（在页面加载前）
        6. 启动健康监控
      - **场景2：WhatsApp已打开后失败**
        1. 健康监控检测到代理失败
        2. 触发Kill-Switch → ❌ 禁止网络请求，✅ 保持视图
        3. 🔇 静默处理（不弹窗），在视图内显示重连UI
        4. 启动自动重连机制（3次重试）
        5. 重连成功 → 解除Kill-Switch，恢复网络，刷新页面
        6. 重连失败 → 保持Kill-Switch，等待用户手动操作
    - **实现重连UI（注入到BrowserView）**：
      - 创建 `src/infrastructure/proxy/ui/ReconnectionOverlay.js`
      - 使用 webContents.executeJavaScript() 注入HTML/CSS
      - 实现三种UI状态：
        - 自动重连中：显示进度条和倒计时
        - 重连失败：显示手动重试、更换代理、关闭会话按钮
        - 重连成功：显示成功提示（3秒后自动消失）
      - UI样式：半透明遮罩层，居中显示，不阻挡WhatsApp内容
    - 保持代理认证处理（HTTP/HTTPS代理的Proxy-Authorization头）
    - _Requirements: 12.1, 12.2_

  - [x] 22.12 实现核心补充场景功能





    - 创建 `SharedProxyManager.js` 多账号代理管理：
      - registerProxyUsage(accountId, proxyId) - 注册代理使用
      - getAccountsByProxy(proxyId) - 获取使用同一代理的账号
      - notifyProxyFailure(proxyId, error) - 通知代理失败
      - 每个账号独立健康检查，避免相互影响
    - 创建 `ProxySwitchManager.js` 代理切换管理：
      - switchProxy(accountId, newConfig) - 平滑切换代理
      - 切换流程：验证新代理 → 触发Kill-Switch → 应用新配置 → 重连 → 失败回滚
    - 创建 `ProxyAuthManager.js` 认证管理：
      - isAuthExpired(proxyId) - 检查认证是否过期
      - refreshAuth(proxyId) - 刷新认证信息
      - promptAuthUpdate(accountId) - 提示用户更新
    - 创建 `NetworkChangeDetector.js` 网络变化检测：
      - startMonitoring() - 监听网络变化
      - handleNetworkChange(accountId) - 处理网络变化
      - 网络切换时暂停健康检查，等待稳定后重新验证
    - _Requirements: 12.1, 12.3_
  
  - [x] 22.12.1 实现高级补充场景功能





    - 创建 `ProxyLoadBalancer.js` 负载均衡：
      - setProxyPool(accountId, proxies) - 配置代理池
      - getBestProxy(accountId) - 获取最优代理
      - failover(accountId, failedProxyId) - 故障转移
      - 选择策略：延迟最低、成功率最高、最近使用时间
    - 创建 `ProxyBlacklistManager.js` 黑名单管理：
      - addToBlacklist(proxyId, reason, duration) - 添加黑名单
      - isBlacklisted(proxyId) - 检查黑名单
      - scheduleUnblacklist(proxyId, afterMs) - 定时解除黑名单
      - 检测被封禁信号：403/451错误、频繁验证码
    - 创建 `ProxyPerformanceMonitor.js` 性能监控：
      - getPerformanceMetrics(proxyId) - 获取性能指标
      - setThresholds(thresholds) - 设置告警阈值
      - onPerformanceWarning(callback) - 性能告警回调
      - 监控：平均延迟、P95延迟、成功率、连接稳定性
    - _Requirements: 12.1, 12.3_

  - [x] 22.13 编写代理安全属性测试





    - **Property 47: Proxy Failure Never Falls Back to Direct**
      - 测试：代理连接失败时，验证不会发起直连请求
    - **Property 48: WebRTC Always Disabled**
      - 测试：验证RTCPeerConnection等API被禁用
    - **Property 49: DNS Leak Prevention**
      - 测试：验证DNS请求通过代理
    - **Property 50: Kill-Switch Activation on Proxy Loss**
      - 测试：代理断开时，验证Kill-Switch被触发
    - **Property 51: IP Verification Before Connection**
      - 测试：验证连接前必须通过IP验证
    - **Property 52: Proxy Health Check Accuracy**
      - 测试：验证健康检查准确反映代理状态
    - **Property 53: Consecutive Failure Detection**
      - 测试：验证连续失败达到阈值时触发Kill-Switch
    - **Property 54: Reconnection Mechanism**
      - 测试：验证自动重连机制按指数退避策略执行
    - **Property 55: View Preservation During Failure**
      - 测试：验证运行中失败时保持视图不关闭
    - **Property 56: Connection Blocking Before View Creation**
      - 测试：验证打开前失败时不创建BrowserView
    - **Validates: Requirements 12.1, 12.2, 12.3**

- [x] 23. Checkpoint - 确保代理重写后测试通过

  - Ensure all tests pass, ask the user if questions arise.

- [x] 24. 翻译功能渐进式迁移（保持现有功能不变）










  - [x] 24.1 分析现有翻译功能并记录

    - 分析 `src/translation/translationService.js` 翻译服务
    - 分析 `src/translation/ipcHandlers.js` 现有13个IPC通道
    - 分析 `src/translation/adapters/` 现有翻译引擎适配器
    - 分析 `src/managers/TranslationIntegration.js` 翻译集成
    - 记录所有现有功能点，确保迁移后功能完整
    - _Requirements: 11_


  - [x] 24.2 创建翻译适配器接口（新架构）

    - 创建 `src/infrastructure/translation/adapters/ITranslationAdapter.js`
    - 定义标准翻译适配器接口（translate、detectLanguage、validateConfig）
    - 保持现有翻译功能不变
    - _Requirements: 11.1, 11.2_


  - [x] 24.3 包装现有翻译引擎为适配器

    - 包装现有翻译引擎（Google、GPT4、Gemini、DeepSeek、Custom）
    - 不修改现有翻译逻辑，只是包装
    - 保持现有功能不变
    - _Requirements: 11.1, 11.2_



  - [x] 24.4 迁移翻译配置到新Repository
    - 更新 `src/infrastructure/repositories/TranslationRepository.js`
    - 包装现有 TranslationIntegration 功能
    - 保持现有功能不变
    - _Requirements: 11.1, 4.2_


  - [x] 24.5 迁移翻译IPC到IPCRouter






    - 将 `src/translation/ipcHandlers.js` 中的13个IPC通道迁移到IPCRouter
    - 保留所有现有IPC功能：
      - translation:translate（翻译请求）
      - translation:detectLanguage（语言检测）
      - translation:getConfig（获取配置）
      - translation:saveConfig（保存配置）
      - translation:getStats（获取统计）
      - translation:clearCache（清除缓存）
      - translation:saveEngineConfig（保存引擎配置）
      - translation:getEngineConfig（获取引擎配置）
      - translation:clearHistory（清除历史）
      - translation:clearUserData（清除用户数据）
      - translation:clearAllData（清除所有数据）
      - translation:getPrivacyReport（获取隐私报告）
      - translation:getAccountStats（获取账号统计）
    - 添加请求验证
    - 保持现有功能不变
    - _Requirements: 8.1, 8.2_

- [x] 25. 其他大文件拆分









  - [x] 25.1 拆分 contentScript.js (3990行)



    - 创建 `src/translation/content-script/` 目录
    - 提取 `ContentScriptCore.js` 核心注入逻辑
    - 提取 `MessageTranslator.js` 消息翻译处理
    - 提取 `InputBoxTranslator.js` 输入框翻译处理
    - 提取 `TranslationUI.js` 翻译UI组件
    - 提取 `DOMObserver.js` DOM变化监听
    - 保持现有功能不变
    - _Requirements: 13_

  - [x] 25.2 拆分 SessionManager.js (1408行)


    - 创建 `src/managers/session/` 目录
    - 提取 `SessionStorage.js` 会话存储
    - 提取 `SessionRecovery.js` 会话恢复
    - 提取 `SessionValidator.js` 会话验证
    - 保持现有功能不变
    - _Requirements: 13_

  - [x] 25.3 拆分 InstanceManager.js (1402行)


    - 创建 `src/managers/instance/` 目录
    - 按职责拆分为多个模块
    - 保持现有功能不变
    - _Requirements: 13_

- [x] 26. Final Checkpoint - 确保所有重构后测试通过















  - Ensure all tests pass, ask the user if questions arise.

- [x] 27. 代理功能迁移集成（修复任务22未完成的集成问题）

  - [x] 27.1 备份旧的代理代码到archive目录


    - 创建 `archive/proxy-legacy-backup/` 目录
    - 备份 `src/single-window/ViewManager.js` 中的 `_configureProxy()` 方法
    - 备份 `src/managers/ProxyConfigManager.js`（旧代理配置管理器）
    - 备份 `src/services/ProxyDetectionService.js`（旧代理检测服务）
    - 备份 `src/ipc/proxyIPCHandlers.js`（旧代理IPC处理器）
    - 记录备份文件清单到 `archive/proxy-legacy-backup/README.md`
    - _Requirements: 12_



  - [x] 27.2 修复新架构ViewManager中的代理方法调用





    - 修改 `src/presentation/windows/view-manager/ViewManager.js`
    - **问题**：当前调用不存在的方法 `configureProxyWithTimeout()` 和 `handleProxyFailureWithFallback()`
    - **修复**：改为调用 `ViewProxyIntegration.secureConfigureProxy()`
    - **修复**：改为调用 `ViewProxyIntegration.handleProxyError()`
    - 添加 `ViewProxyIntegration.injectIPProtection()` 调用
    - _Requirements: 12.1, 12.2_


  - [x] 27.3 删除旧ViewManager中的回退直连代码






    - 修改 `src/single-window/ViewManager.js`
    - **删除特征1**：搜索 `代理配置失败，将使用直连` 注释附近的回退代码
    - **删除特征2**：搜索 `proxyDisabledDueToError = true` 附近的回退代码
    - **删除特征3**：搜索 `尝试禁用代理并重新加载` 注释附近的回退代码
    - **删除模式**：所有 `await session.setProxy({ proxyRules: '' })` 清除代理的代码
    - **删除模式**：所有 `config.proxy.enabled = false` 禁用代理的代码
    - 替换为调用新架构的 `ViewProxyIntegration` 模块
    - _Requirements: 12.1_

  - [x] 27.4 更新旧ViewManager使用新代理模块





    - 修改 `src/single-window/ViewManager.js`
    - 导入 `ViewProxyIntegration` 从新架构位置
    - 在构造函数中初始化 `this.proxyIntegration = new ViewProxyIntegration()`
    - 修改 `createView()` 方法使用 `this.proxyIntegration.secureConfigureProxy()`
    - 修改 `_setupViewEventHandlers()` 使用 `this.proxyIntegration.handleProxyError()`
    - 在页面加载前调用 `this.proxyIntegration.injectIPProtection()`
    - _Requirements: 12.1, 12.2_

  - [x] 27.5 初始化代理服务到应用引导器





    - 修改 `src/app/bootstrap.js` 或 `src/main-refactored.js`
    - 导入并初始化 `ProxyService` 从 `src/application/services/ProxyService.js`
    - 导入并初始化 `ProxySecurityManager` 从 `src/infrastructure/proxy/ProxySecurityManager.js`
    - 导入并初始化 `KillSwitch` 从 `src/infrastructure/proxy/KillSwitch.js`
    - 导入并初始化 `ProxyHealthMonitor` 从 `src/infrastructure/proxy/ProxyHealthMonitor.js`
    - 注册到依赖注入容器
    - _Requirements: 12, 7.1_

  - [x] 27.6 连接代理IPC处理器到IPCRouter












    - 修改 `src/presentation/ipc/handlers/ProxyIPCHandlers.js`
    - 确保使用新的 `ProxyService` 而非旧的 `ProxyConfigManager`
    - 注册所有15个IPC通道（8个现有 + 7个新增安全IPC）
    - 在应用启动时注册到 `IPCRouter`
    - _Requirements: 8.1, 8.2_

  - [x] 27.7 删除旧的代理代码文件





    - 删除 `src/managers/ProxyConfigManager.js`（已被 `ProxyRepository` 替代）
    - 删除 `src/services/ProxyDetectionService.js`（已被 `ProxyPreChecker` 替代）
    - 删除 `src/ipc/proxyIPCHandlers.js`（已被新架构 `ProxyIPCHandlers.js` 替代）
    - 更新所有导入这些文件的地方
    - _Requirements: 12_

  - [x] 27.8 验证代理功能完整性





    - 测试代理配置保存和加载
    - 测试代理连接和断开
    - 测试代理预检测和IP验证
    - 测试WebRTC阻止（运行 `browser-ip-check.js` 验证）
    - 测试Kill-Switch触发和重连
    - 测试代理错误处理（不回退直连）
    - _Requirements: 12.1, 12.2, 12.3_

- [x] 28. Checkpoint - 确保代理迁移后功能正常







  - Ensure all tests pass, ask the user if questions arise.
  - 运行 `browser-ip-check.js` 验证IP保护
  - 验证代理IP与预期出口IP一致
  - 验证WebRTC泄露被阻止
