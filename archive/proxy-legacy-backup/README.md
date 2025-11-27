# 旧代理代码备份

备份日期: 2025-11-27
删除日期: 2025-11-27 (任务27.7)

## 备份原因

任务22（代理功能完全重写）已完成新的代理安全模块，但未正确集成到应用中。
旧的代理代码存在以下问题：
1. 代理失败时会回退到直连（严重安全漏洞）
2. 没有注入IP保护脚本（WebRTC泄露）
3. 没有使用新的安全代理模块

## 备份文件清单

### 1. 旧代理配置管理器
- `ProxyConfigManager.js` - 原位置: `src/managers/ProxyConfigManager.js` ✅ 已删除
- `ProxyConfigManagerAdapter.js` - 原位置: `src/managers/ProxyConfigManagerAdapter.js` (已更新为使用ProxyRepository)

### 2. 旧代理检测服务
- `ProxyDetectionService.js` - 原位置: `src/services/ProxyDetectionService.js` ✅ 已删除

### 3. 旧代理IPC处理器
- `proxyIPCHandlers.js` - 原位置: `src/ipc/proxyIPCHandlers.js` ✅ 已删除
- `proxyIPCHandlersRouter.js` - 原位置: `src/ipc/proxyIPCHandlersRouter.js` ✅ 已删除

### 4. ViewManager中的旧代理方法
- `ViewManager._configureProxy.js` - 从 `src/single-window/ViewManager.js` 提取的 `_configureProxy()` 方法

## 删除的文件 (任务27.7)

以下文件已从源代码中删除，备份保留在此目录：

1. `src/managers/ProxyConfigManager.js` → 已被 `ProxyRepository` 替代
2. `src/services/ProxyDetectionService.js` → 已被 `ProxyPreChecker` 替代
3. `src/ipc/proxyIPCHandlers.js` → 已被新架构 `ProxyIPCHandlers.js` 替代
4. `src/ipc/proxyIPCHandlersRouter.js` → 已被新架构 `ProxyIPCHandlers.js` 替代

## 更新的文件 (任务27.7)

以下文件已更新以使用新架构：

1. `src/core/managers/index.js` - 移除 ProxyConfigManager 导出，添加 ProxyRepository
2. `src/core/services/index.js` - 使用 ProxyPreChecker 替代 ProxyDetectionService
3. `src/managers/ProxyConfigManagerAdapter.js` - 现在始终使用 ProxyRepository
4. `src/app/bootstrap.js` - 使用新架构组件
5. `src/ipc/index.js` - 使用新架构 ProxyIPCHandlers
6. `scripts/test-specific-proxy.js` - 使用 ProxyPreChecker
7. `scripts/test-proxy-detection.js` - 使用 ProxyPreChecker

## 新架构替代方案

| 旧模块 | 新模块 |
|--------|--------|
| ProxyConfigManager | ProxyRepository + ProxyConfig实体 |
| ProxyDetectionService | ProxyPreChecker + IPLeakDetector |
| proxyIPCHandlers.js | ProxyIPCHandlers.js (新架构) |
| proxyIPCHandlersRouter.js | ProxyIPCHandlers.js (新架构) |
| ViewManager._configureProxy() | ViewProxyIntegration.secureConfigureProxy() |

## 新架构位置

- `src/application/services/ProxyService.js` - 代理服务层
- `src/infrastructure/proxy/` - 代理基础设施
  - `ProxySecurityManager.js` - 安全策略管理
  - `ProxyConnectionManager.js` - 连接管理
  - `KillSwitch.js` - Kill-Switch机制
  - `IPProtectionInjector.js` - IP保护脚本注入
  - `ProxyPreChecker.js` - 代理预检测
  - `ProxyHealthMonitor.js` - 健康监控
- `src/infrastructure/repositories/ProxyRepository.js` - 代理数据访问层
- `src/presentation/windows/view-manager/ViewProxyIntegration.js` - 视图代理集成
- `src/presentation/ipc/handlers/ProxyIPCHandlers.js` - 代理IPC处理器

## 恢复说明

如需恢复旧代码，将备份文件复制回原位置即可。
但强烈建议使用新架构，因为旧代码存在安全漏洞。

**注意**: 恢复旧代码后，还需要恢复以下文件的旧版本：
- `src/core/managers/index.js`
- `src/core/services/index.js`
- `src/managers/ProxyConfigManagerAdapter.js`
- `src/app/bootstrap.js`
- `src/ipc/index.js`
