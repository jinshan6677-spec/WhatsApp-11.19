# 旧架构备份

此目录包含在2025年11月27日完全迁移到新架构时备份的旧代码文件。

## 备份文件清单

| 原始位置 | 备份文件 | 说明 |
|---------|---------|------|
| src/main-backup-old-architecture.js.backup | main-old.js | 旧架构主入口文件 |
| src/single-window/ViewManager.js.backup | ViewManager-old.js | 旧ViewManager备份 |
| src/utils/ErrorHandler.js.backup | ErrorHandler-old.js | 旧错误处理器备份 |

## 新架构说明

新架构已完全启用，主要变更：

1. **主入口**: `src/main-refactored.js`
2. **代理管理**: 使用 `ProxyService` + `ProxyRepository` 替代旧的 `ProxyConfigManager`
3. **代理检测**: 使用 `ProxyPreChecker` 替代旧的 `ProxyDetectionService`
4. **ViewManager**: 已拆分为模块化组件在 `src/presentation/windows/view-manager/`
5. **IPC处理器**: 已迁移到 `src/presentation/ipc/handlers/`

## 如需恢复

如果需要参考旧代码，可以查看此目录中的备份文件。
但不建议恢复使用旧架构，因为新架构提供了更好的：
- 代理安全防护（Kill-Switch、IP泄露检测）
- 模块化设计
- 依赖注入
- 事件总线
- 状态管理

## 备份时间

2025年11月27日
