# WhatsApp Desktop Electron 应用重构计划

## 架构分析总结

### 发现的主要问题

1. **重复的主入口文件**
   - `main-refactored.js` (新架构，469行) - 使用依赖注入和模块化设计
   - `main-backup-old-architecture.js` (旧架构备份，615行) - 传统的直接实例化方式

2. **ViewManager系统混乱**
   - 实际使用：`single-window/ViewManager.js` (4096行，功能完整)
   - 占位符：`ui/main-window/ViewManager.js` (仅注释，无实现)
   - 测试文件：`single-window/__tests__/ViewManager.test.js`

3. **错误处理重复**
   - `utils/ErrorHandler.js` (323行) - 提供包装器和工具函数
   - `shared/utils/ErrorHandler.js` (503行) - 统一的错误处理器，包含前者的功能

4. **目录结构问题**
   - `ui/` 和 `single-window/` 功能重叠
   - `core/` 目录为空
   - `features/` 目录为空

### 重构策略

#### 阶段1：清理重复架构
- [ ] 删除 `main-backup-old-architecture.js`
- [ ] 确认 `main-refactored.js` 作为唯一入口
- [ ] 更新 `package.json` 中的 main 字段（如果需要）

#### 阶段2：统一ViewManager系统
- [ ] 删除 `ui/main-window/ViewManager.js` 占位符
- [ ] 更新 `ui/main-window/index.js` 导出逻辑
- [ ] 确保所有引用指向 `single-window/ViewManager.js`

#### 阶段3：整合错误处理
- [ ] 删除 `utils/ErrorHandler.js`
- [ ] 确保所有引用使用 `shared/utils/ErrorHandler.js`
- [ ] 更新相关的导入语句

#### 阶段4：优化目录结构
- [ ] 清理空的 `core/` 和 `features/` 目录
- [ ] 整理 `ui/` 目录结构
- [ ] 优化模块导入路径

#### 阶段5：依赖关系优化
- [ ] 完善 `DependencyContainer.js` 的使用
- [ ] 减少循环依赖
- [ ] 统一依赖注入模式

#### 阶段6：功能验证
- [ ] 测试多账户功能
- [ ] 测试翻译功能
- [ ] 测试代理功能
- [ ] 验证应用启动和关闭

## 风险评估

### 高风险项
- 删除文件可能影响现有功能
- 更新导入语句可能导致编译错误

### 缓解措施
- 分步骤进行，每步验证
- 保留备份文件（重命名为 .backup）
- 充分测试核心功能

## 预期收益

1. **减少代码重复**：移除重复的架构和组件
2. **提高可维护性**：统一的错误处理和依赖管理
3. **清晰的目录结构**：更直观的代码组织
4. **更好的性能**：减少不必要的模块加载