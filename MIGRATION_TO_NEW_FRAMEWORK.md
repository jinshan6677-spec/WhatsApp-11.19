# 翻译功能迁移到新框架计划

## 备份信息

✅ **备份已完成**：`backups/translation-old-framework-20251126-214951/`

备份内容：
- `src/translation/` - 整个旧翻译目录
- `src/preload-view.js` - 旧的 Preload 脚本
- `src/managers/TranslationIntegration.js` - 旧的注入管理器

## 当前架构分析

### 旧框架文件（需要迁移/删除）

1. **翻译逻辑**：
   - `src/translation/contentScript.js` - 4000+ 行的翻译核心逻辑
   - `src/translation/contentScriptWithOptimizer.js` - 性能优化器

2. **IPC 处理**：
   - `src/translation/ipcHandlers.js` - 翻译 IPC 处理器

3. **服务层**：
   - `src/translation/translationService.js` - 翻译服务
   - `src/translation/TranslationManager.js` - 翻译管理器
   - `src/translation/CacheManager.js` - 缓存管理器
   - `src/translation/ConfigManager.js` - 配置管理器

4. **翻译引擎**：
   - `src/translation/engines/` - 各种翻译引擎实现

5. **注入管理**：
   - `src/managers/TranslationIntegration.js` - 脚本注入管理
   - `src/preload-view.js` - BrowserView Preload 脚本

### 新框架文件（已存在）

1. **视图管理**：
   - `src/presentation/windows/view-manager/ViewTranslationIntegration.js` - 翻译集成

2. **IPC 处理**：
   - `src/presentation/ipc/handlers/TranslationServiceIPCHandlers.js` - 新的 IPC 处理器

## 迁移策略

### ⚠️ 重要警告

这是一个**大型重构任务**，涉及：
- 4000+ 行的翻译逻辑代码
- 多个翻译引擎
- 复杂的配置管理
- IPC 通信机制
- UI 集成

**风险**：
- 翻译功能可能完全失效
- 需要大量测试
- 可能需要数天时间完成

### 建议的迁移方案

#### 方案 A：渐进式迁移（推荐）✅

**优点**：
- 风险低
- 可以逐步测试
- 随时可以回滚

**步骤**：
1. 保持旧代码运行
2. 在新框架中逐步实现功能
3. 并行测试新旧实现
4. 确认新实现稳定后再删除旧代码

**时间**：2-3 周

#### 方案 B：一次性迁移（高风险）⚠️

**优点**：
- 快速清理旧代码
- 架构更清晰

**缺点**：
- 高风险
- 可能导致翻译功能完全失效
- 需要大量调试时间

**时间**：1-2 周（但可能需要更多时间修复问题）

## 当前问题

**翻译功能正在工作**，但控制开关失效。我已经修复了这个问题：

✅ 暴露 `window.WhatsAppTranslation` 对象
✅ 添加配置更新方法
✅ 添加配置变更通知

## 建议

### 选项 1：先测试当前修复 ⭐ 推荐

1. **重启应用**，测试控制开关是否工作
2. 如果工作正常，**暂时保持当前架构**
3. 规划详细的迁移计划
4. 在新分支上进行迁移工作

### 选项 2：立即开始迁移

如果你坚持立即迁移，我需要：

1. **创建详细的迁移规范**
2. **设计新的架构**
3. **逐步实现每个模块**
4. **编写测试**
5. **验证功能**

这将是一个**多天的大型任务**。

## 你的选择

请告诉我你想要：

**A. 先测试当前修复，确认功能正常后再规划迁移** ⭐ 推荐
- 风险低
- 可以先解决当前问题
- 有时间规划完整的迁移方案

**B. 立即开始迁移到新框架**
- 需要创建详细的迁移规范
- 需要数天时间
- 高风险

**C. 创建迁移规范，但暂不实施**
- 规划未来的迁移路径
- 保持当前代码运行
- 为将来的迁移做准备

请选择 A、B 或 C。
