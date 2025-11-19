# First Run Wizard - 首次启动向导

## 概述

首次启动向导是一个用户友好的界面，用于引导用户完成从单实例架构到多实例架构的迁移过程。它会自动检测是否需要迁移，并提供清晰的说明和进度反馈。

## 功能特性

### 1. 自动检测
- 检测是否存在旧的 `session-data` 目录
- 检测是否已经完成迁移
- 只在需要时显示向导

### 2. 用户友好的界面
- 清晰的欢迎界面，说明新功能
- 实时的迁移进度显示
- 成功/失败状态反馈
- 文档链接快速访问

### 3. 自动迁移
- 一键启动迁移流程
- 实时进度更新
- 详细的步骤说明
- 错误处理和重试机制

### 4. 灵活集成
- 可以显示完整向导界面
- 可以静默自动迁移
- 可以混合使用两种模式

## 文件结构

```
src/
├── container/
│   ├── FirstRunWizard.js          # 向导窗口类
│   ├── preload-wizard.js          # 向导预加载脚本
│   ├── wizard.html                # 向导界面 HTML
│   └── FIRST_RUN_WIZARD_README.md # 本文档
├── managers/
│   ├── FirstRunWizardIntegration.js # 集成模块
│   └── MigrationManager.js        # 迁移管理器
└── examples/
    └── first-run-wizard-integration-example.js # 集成示例
```

## 使用方法

### 方式 1: 显示向导界面（推荐）

这是最用户友好的方式，适合桌面应用。

```javascript
const { app } = require('electron');
const { checkAndShowWizard } = require('./managers/FirstRunWizardIntegration');

app.whenReady().then(async () => {
  const userDataPath = app.getPath('userData');

  const wizardResult = await checkAndShowWizard({
    userDataPath,
    onComplete: () => {
      console.log('Migration completed, starting app...');
      initializeApplication();
    },
    onSkip: () => {
      console.log('User skipped wizard, starting app...');
      initializeApplication();
    }
  });

  if (!wizardResult.shown) {
    // 不需要显示向导，直接启动应用
    initializeApplication();
  }
});
```

### 方式 2: 静默自动迁移

适合命令行工具或需要无人值守的场景。

```javascript
const { app } = require('electron');
const { autoMigrate } = require('./managers/FirstRunWizardIntegration');

app.whenReady().then(async () => {
  const userDataPath = app.getPath('userData');

  const result = await autoMigrate({
    userDataPath,
    silent: false // 设置为 true 可以完全静默
  });

  if (result.migrated) {
    console.log('Migration successful');
  }

  initializeApplication();
});
```

### 方式 3: 混合模式

先尝试自动迁移，失败时显示向导。

```javascript
const { app } = require('electron');
const { autoMigrate, checkAndShowWizard } = require('./managers/FirstRunWizardIntegration');

app.whenReady().then(async () => {
  const userDataPath = app.getPath('userData');

  // 先尝试自动迁移
  const migrationResult = await autoMigrate({
    userDataPath,
    silent: true
  });

  if (migrationResult.migrated) {
    // 成功，直接启动
    initializeApplication();
  } else if (migrationResult.result && !migrationResult.result.success) {
    // 失败，显示向导
    await checkAndShowWizard({
      userDataPath,
      onComplete: () => initializeApplication(),
      onSkip: () => initializeApplication()
    });
  } else {
    // 不需要迁移
    initializeApplication();
  }
});
```

## API 文档

### checkAndShowWizard(options)

显示首次启动向导（如果需要）。

**参数：**
- `options.userDataPath` (string, 必需): 用户数据目录路径
- `options.onComplete` (function, 可选): 向导完成时的回调
- `options.onSkip` (function, 可选): 用户跳过向导时的回调

**返回值：**
```javascript
{
  shown: boolean,      // 是否显示了向导
  migrated: boolean,   // 是否完成了迁移
  wizard?: Object      // 向导实例（如果显示了）
}
```

### autoMigrate(options)

自动执行迁移（不显示界面）。

**参数：**
- `options.userDataPath` (string, 必需): 用户数据目录路径
- `options.silent` (boolean, 可选): 是否静默执行，默认 false

**返回值：**
```javascript
{
  migrated: boolean,   // 是否完成了迁移
  result?: Object      // 迁移结果详情
}
```

### getMigrationStatus(userDataPath)

获取迁移状态。

**参数：**
- `userDataPath` (string, 必需): 用户数据目录路径

**返回值：**
```javascript
{
  completed: boolean,      // 是否已完成迁移
  needsMigration: boolean, // 是否需要迁移
  migrationDate?: string,  // 迁移日期
  version?: string         // 迁移版本
}
```

## 向导界面

### 步骤 1: 欢迎界面

显示新功能介绍和迁移说明：
- 多账号支持
- 完全隔离
- 代理支持
- 翻译功能
- 文档链接

### 步骤 2: 迁移进度

实时显示迁移进度：
- 进度条
- 步骤列表
- 当前状态
- 错误信息（如果有）

### 步骤 3: 完成界面

显示迁移成功信息：
- 成功提示
- 下一步操作建议
- 备份数据说明

## IPC 通信

向导使用以下 IPC 通道与主进程通信：

### 主进程 → 渲染进程

- `migration:started` - 迁移开始
- `migration:completed` - 迁移完成
- `migration:failed` - 迁移失败

### 渲染进程 → 主进程

- `wizard:start-migration` - 开始迁移
- `wizard:skip` - 跳过向导
- `wizard:complete` - 完成向导
- `wizard:get-status` - 获取迁移状态

## 迁移流程

1. **检测阶段**
   - 检查是否存在 `.migration-completed` 标记
   - 检查是否存在旧的 `session-data` 目录
   - 检查是否已有 `profiles` 目录

2. **迁移阶段**
   - 创建 `profiles` 目录
   - 复制会话数据到 `profiles/default`
   - 加载翻译配置
   - 创建默认账号配置
   - 创建迁移完成标记

3. **完成阶段**
   - 显示成功消息
   - 提供下一步操作指引
   - 关闭向导窗口

## 错误处理

向导具有完善的错误处理机制：

1. **迁移失败**
   - 显示错误消息
   - 提供重试选项
   - 保留原始数据

2. **向导崩溃**
   - 不影响主应用启动
   - 可以手动重新触发迁移

3. **用户取消**
   - 可以跳过向导
   - 稍后可以手动迁移

## 自定义样式

向导界面使用内联 CSS，可以通过修改 `wizard.html` 来自定义样式：

```css
/* 主题颜色 */
background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);

/* 按钮样式 */
.btn-primary {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

/* 进度条颜色 */
.progress-bar-fill {
  background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
}
```

## 测试

### 手动测试

1. **测试首次启动**
   ```bash
   # 删除迁移标记
   rm userData/.migration-completed
   
   # 启动应用
   npm start
   ```

2. **测试迁移流程**
   - 确保有旧的 `session-data` 目录
   - 启动应用
   - 观察向导界面
   - 点击"开始迁移"
   - 验证迁移结果

3. **测试错误处理**
   - 模拟迁移失败（如权限问题）
   - 验证错误消息显示
   - 测试重试功能

### 自动化测试

参考 `src/managers/__tests__/MigrationManager.test.js` 中的测试用例。

## 常见问题

### Q: 向导会在每次启动时显示吗？

A: 不会。向导只在检测到需要迁移时显示一次。迁移完成后会创建 `.migration-completed` 标记文件，之后不会再显示。

### Q: 如果用户跳过向导会怎样？

A: 应用会正常启动，但不会执行迁移。用户可以稍后手动触发迁移。

### Q: 迁移失败会影响原始数据吗？

A: 不会。迁移过程使用复制而不是移动，原始数据会被完整保留。

### Q: 可以重新触发迁移吗？

A: 可以。删除 `.migration-completed` 文件后重启应用即可。

### Q: 如何完全禁用向导？

A: 使用 `autoMigrate` 函数并设置 `silent: true`，或者直接不调用向导相关函数。

## 最佳实践

1. **推荐使用方式 1（显示向导）**
   - 提供最好的用户体验
   - 用户可以了解新功能
   - 可以看到迁移进度

2. **在应用启动早期调用**
   - 在 `app.whenReady()` 之后立即调用
   - 在创建主窗口之前完成迁移

3. **提供错误恢复机制**
   - 即使向导失败也要启动应用
   - 提供手动迁移选项
   - 记录详细的错误日志

4. **保留原始数据**
   - 不要删除 `session-data` 目录
   - 作为备份保留至少一个版本周期

## 相关文档

- [迁移指南](../../docs/MIGRATION_GUIDE.md)
- [迁移流程图](../../docs/MIGRATION_FLOW.md)
- [用户指南](../../docs/USER_GUIDE.md)
- [常见问题](../../docs/FAQ.md)

## 维护说明

### 更新向导界面

修改 `wizard.html` 文件即可更新界面。注意保持与 IPC 通信的兼容性。

### 更新迁移逻辑

迁移逻辑在 `MigrationManager.js` 中实现。向导只是提供界面，不包含迁移逻辑。

### 添加新的迁移步骤

1. 在 `MigrationManager.js` 中添加新步骤
2. 在 `wizard.html` 的步骤列表中添加对应项
3. 更新进度计算逻辑

## 版本历史

- v1.0.0 (2024-01-01): 初始版本
  - 基本的向导界面
  - 自动迁移功能
  - 错误处理机制

