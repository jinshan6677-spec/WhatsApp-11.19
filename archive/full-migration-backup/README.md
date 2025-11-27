# 完整迁移备份

## 备份日期
2025-11-27

## 备份内容

本目录包含从旧架构迁移到新架构过程中备份的文件。

### 已备份的旧架构文件

1. **archive/old-architecture-backup/**
   - `ErrorHandler-old.js` - 旧错误处理器
   - `main-old.js` - 旧主入口文件
   - `ViewManager-old.js` - 旧视图管理器

2. **archive/proxy-legacy-backup/**
   - `ProxyConfigManager.js` - 旧代理配置管理器
   - `ProxyDetectionService.js` - 旧代理检测服务
   - `proxyIPCHandlers.js` - 旧代理IPC处理器
   - `ViewManager._configureProxy.js` - 旧代理配置方法

### 迁移说明

新架构已完全启用，主要变更：

1. **主入口**: `src/main-refactored.js` (package.json main)
2. **应用引导**: `src/app/bootstrap.js`
3. **核心组件**:
   - EventBus: `src/core/eventbus/`
   - ConfigProvider: `src/core/config/`
   - StateManager: `src/core/state/`
   - DependencyContainer: `src/core/container/`
   - ErrorHandler: `src/core/errors/`

4. **代理安全模块**: `src/infrastructure/proxy/`
   - ProxyService
   - ProxySecurityManager
   - KillSwitch
   - ProxyHealthMonitor
   - IPProtectionInjector
   - IPLeakDetector

5. **IPC路由**: `src/presentation/ipc/`
   - IPCRouter
   - 各功能域IPC处理器

6. **视图管理**: `src/presentation/windows/view-manager/`
   - 模块化拆分后的ViewManager

### 恢复说明

如需恢复旧架构，请：
1. 将备份文件复制回原位置
2. 修改 package.json 的 main 字段
3. 更新相关导入路径

**注意**: 不建议恢复旧架构，新架构提供了更好的安全性和可维护性。
