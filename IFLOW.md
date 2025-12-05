# WhatsApp Desktop Translation - 项目上下文

## 项目概述

这是一个基于 Electron 的 WhatsApp 桌面应用程序，支持实时翻译功能。项目采用 Clean Architecture 分层架构（v2.0），支持多账号管理、手动账户控制、智能翻译系统等功能。

### 核心特性
- **多账号管理**：同时运行多个 WhatsApp 账号，完全隔离
- **手动账户控制**：按需打开/关闭账号，节省系统资源
- **智能翻译系统**：支持 Google 翻译、GPT-4、Gemini、DeepSeek 等多种翻译引擎
- **输入框翻译**：发送前自动翻译消息，支持 11 种风格定制
- **好友独立翻译配置**：为每个联系人设置不同的翻译偏好
- **进程级隔离**：每个账号在独立进程中运行，互不影响
- **会话持久化**：自动保存登录状态，无需重复扫码
- **跨平台支持**：Windows、macOS、Linux 全平台支持

## 技术栈

- **Electron 39.1.1** - 桌面应用框架（Chromium 132.x + Node.js 20.x）
- **Node.js 20.x** - 运行时环境
- **Clean Architecture** - 分层架构设计
- **Jest** - 测试框架
- **Fast-check** - 属性测试库
- **ESLint** - 代码检查工具

## 项目结构

```
whatsapp-desktop-translation/
├── src/                          # 源代码目录
│   ├── main-refactored.js       # 🚀 新架构主入口
│   ├── preload.js               # 预加载脚本
│   ├── config.js                # 应用配置
│   ├── app/                     # 📦 应用核心
│   │   ├── bootstrap.js         # 应用启动引导器
│   │   ├── DependencyContainer.js # 依赖注入容器
│   │   └── constants/           # 应用常量
│   ├── core/                    # ⚙️ 核心组件（横切关注点）
│   │   ├── eventbus/            # 事件总线
│   │   ├── config/              # 配置管理
│   │   ├── state/               # 状态管理
│   │   ├── container/           # 依赖容器
│   │   ├── errors/              # 错误处理
│   │   ├── managers/            # 管理器统一导出
│   │   └── services/            # 服务统一导出
│   ├── domain/                  # 🎯 领域层
│   │   ├── entities/            # 领域实体
│   │   ├── events/              # 领域事件
│   │   ├── repositories/        # Repository接口
│   │   └── errors/              # 领域错误
│   ├── application/             # 💼 应用层
│   │   ├── services/            # 应用服务
│   │   ├── usecases/            # 用例
│   │   └── dtos/                # 数据传输对象
│   ├── infrastructure/          # 🔧 基础设施层
│   │   ├── translation/         # 翻译适配器
│   │   ├── repositories/        # Repository实现
│   │   ├── storage/             # 存储适配器
│   │   └── plugins/             # 插件系统
│   ├── presentation/            # 🎨 表现层
│   │   ├── ipc/                 # IPC路由和处理器
│   │   │   ├── IPCRouter.js
│   │   │   └── handlers/
│   │   ├── windows/             # 窗口管理
│   │   │   └── view-manager/
│   │   │       ├── ViewManager.js
│   │   │       ├── ViewFactory.js
│   │   │       ├── ViewLifecycle.js
│   │   │       ├── ViewBoundsManager.js
│   │   │       ├── ViewTranslationIntegration.js
│   │   │       └── ...
│   │   └── translation/         # 翻译内容脚本
│   ├── managers/                # 管理器实现
│   ├── translation/             # 翻译服务
│   ├── single-window/           # 单窗口架构
│   ├── models/                  # 数据模型
│   └── utils/                   # 工具类
├── test/                        # 🧪 测试文件
├── docs/                        # 📖 文档
├── scripts/                     # 🔧 构建和工具脚本
├── profiles/                    # 👤 账号配置文件和数据
├── resources/                   # 🎨 应用资源（图标等）
├── logs/                        # 📝 日志文件
└── dist/                        # 📦 构建输出目录
```

## 构建和运行命令

### 应用管理
```bash
# 启动应用（生产模式）
npm start

# 启动应用（开发模式，带调试）
npm run dev

# 构建应用安装包
npm run build

# 构建特定平台安装包
npm run build:win      # Windows
npm run build:mac      # macOS
npm run build:linux    # Linux
```

### 测试和调试
```bash
# 运行所有测试
npm test

# 监听模式运行测试
npm run test:watch

# 生成覆盖率报告
npm run test:coverage

# 检查系统要求
npm run test:setup

# 检查会话数据
npm run test:session

# 清理会话数据
npm run test:clean

# 运行属性测试
npm test -- --testPathPattern="property"
```

### 开发工具
```bash
# 代码检查
npm run lint

# 自动修复代码风格问题
npm run lint:fix

# 检查 Electron 版本
npm run version

# 数据迁移（从旧版本升级）
npm run migrate
```

### 验证和测试工具
```bash
# 验证会话隔离
npm run verify:isolation

# 测试重连功能
npm run test:reconnect

# 测试构建
npm run test:build

# 测试会话隔离
npm run test:isolation
```

## 开发约定

### 代码风格
- 使用 2 空格缩进
- 遵循 ESLint 配置（见 `.eslintrc.json`）
- 使用有意义的变量名
- 添加适当的注释和文档

### 测试要求
- 新功能必须包含测试
- 所有测试必须通过
- 测试覆盖率不低于 80%
- 包含属性测试和单元测试

### 提交规范
```
<type>(<scope>): <subject>

<body>

<footer>
```

**Type 类型**：
- `feat`: 新功能
- `fix`: 修复 bug
- `docs`: 文档更新
- `style`: 代码风格
- `refactor`: 代码重构
- `perf`: 性能优化
- `test`: 测试相关
- `chore`: 构建/工具

### 架构原则
1. **分层架构**：遵循 Clean Architecture 分层原则
2. **依赖注入**：使用依赖注入容器管理依赖
3. **事件驱动**：模块间通过事件总线通信
4. **属性测试优先**：优先使用属性测试覆盖边界情况

## 配置说明

### 环境变量
- `SESSION_PATH` - 会话数据存储路径（默认：`./session-data`）
- `LOG_LEVEL` - 日志级别（默认：`info`）
- `NODE_ENV` - 运行环境（`development` 或 `production`）
- `MAX_INSTANCES` - 最大并发实例数（默认：30）
- `PROFILES_DIR` - profiles 目录路径
- `ACCOUNTS_CONFIG_PATH` - 账号配置文件路径

### 会话数据
每个账号的会话数据独立存储在 `profiles/account-{uuid}/` 目录中，包含：
- WhatsApp 认证令牌和会话信息
- Cookie 和 LocalStorage
- IndexedDB 数据库
- 浏览器缓存
- Service Workers

**重要**：
- 不要手动删除 profiles 目录，否则所有账号需要重新登录
- 删除账号时，应用会自动清理对应的数据目录
- 每个账号的数据完全隔离，互不影响

## 核心组件

### EventBus（事件总线）
模块间解耦通信，支持异步事件处理。

### DependencyContainer（依赖注入容器）
统一管理所有依赖，便于测试和维护。

### TranslationService（翻译服务）
支持多种翻译引擎和翻译风格配置。

### StateManager（状态管理）
集中状态管理，支持状态订阅和更新。

### IPCRouter（IPC 路由）
处理主进程和渲染进程之间的 IPC 通信。

## 故障排除

### 常见问题
1. **应用无法启动**：检查 Node.js 版本（需要 18.0.0+），清理缓存，重新安装依赖
2. **账号加载失败**：检查网络配置，验证网络连接，查看日志
3. **翻译不工作**：检查 API 密钥，验证网络连接，查看翻译日志
4. **内存占用过高**：关闭不必要的账号，清理缓存，重启应用

### 调试模式
```bash
# 启用详细日志
DEBUG=* npm start

# 启用特定模块日志
DEBUG=whatsapp:* npm start
```

### 日志位置
- **应用日志**：`./logs/app.log`
- **翻译日志**：`./logs/translation.log`
- **错误日志**：`./logs/error.log`

## 性能参考

### 启动性能
- 应用启动时间：3-5 秒
- 基础内存占用：150-200MB
- 每个账号额外占用：200-400MB

### 系统要求
- **操作系统**：Windows 10+, macOS 10.14+, Ubuntu 20.04+
- **内存**：8GB RAM（支持 5 个并发账号）
- **处理器**：双核 2.0GHz 或更高
- **磁盘空间**：500MB + 每个账号约 200MB
- **网络**：稳定的互联网连接

## 文档资源

### 用户文档
- `docs/USER_GUIDE.md` - 完整的功能使用说明
- `docs/MANUAL_ACCOUNT_CONTROL_GUIDE.md` - 手动账户控制指南
- `docs/SINGLE_WINDOW_USER_GUIDE.md` - 单窗口界面使用说明
- `docs/FAQ.md` - 常见问题解答

### 开发者文档
- `docs/DEVELOPER_GUIDE.md` - 开发环境设置和工作流
- `docs/API.md` - 完整的 API 接口文档
- `docs/BUILD_GUIDE.md` - 打包和发布流程
- `docs/TESTING_GUIDE.md` - 详细测试指南

### 架构文档
- `ARCHITECTURE_MIGRATION_COMPLETE.md` - 新架构完整说明
- `REFACTORING_COMPLETE_REPORT.md` - 重构完成报告

## 注意事项

### 安全使用
- 本项目仅供学习和个人使用
- 使用本项目时请遵守 WhatsApp 的服务条款
- 不要用于自动化消息发送或滥用
- 不要用于商业目的
- 遵守当地法律法规
- 尊重他人隐私

### 数据备份
```bash
# 备份 profiles 目录
cp -r profiles/ profiles-backup-$(date +%Y%m%d)/
```

### 版本信息
- **应用版本**: v2.0.0 (新架构)
- **Electron**: 39.1.1 (最新稳定版)
- **Node.js**: 20.x (推荐)

---

**最后更新**: 2025-12-06  
**项目状态**: 生产就绪  
**架构版本**: Clean Architecture v2.0