# 老板稳了！天天旺 - 项目上下文

## 项目概述

这是一个基于 Electron 的专业 WhatsApp 桌面应用程序，项目名称为"老板稳了！天天旺"（Boss Stable Everyday Prosperity）。应用支持多账号管理、实时翻译、快捷回复、代理设置、指纹系统等高级功能。项目采用 Clean Architecture 分层架构（v2.0），专注于为跨境电商和客服团队提供高效的 WhatsApp 管理解决方案。

### 核心特性

- **多账号管理**：同时运行多个 WhatsApp 账号，完全隔离，支持一键切换
- **手动账户控制**：按需打开/关闭账号，节省系统资源，支持自动启动配置
- **智能翻译系统**：支持 Google 翻译、GPT-4、Gemini、DeepSeek、自定义 API 翻译等多种翻译引擎
- **输入框翻译**：发送前自动翻译消息，支持 11 种风格定制（通用、正式、口语化、亲切、幽默、礼貌、强硬、简洁、激励、中立、专业）
- **好友独立翻译配置**：为每个联系人设置不同的翻译偏好
- **快捷回复功能**：预设常用回复模板，支持文本、图片、音频、视频、图文、名片等多种类型，分组管理，一键发送
- **代理设置**：支持 HTTP/HTTPS 代理配置，智能填写，代理检测，网络状态监控
- **指纹系统**：专业级浏览器指纹管理，支持 WebGL、WebRTC、Canvas、Audio、设备信息等全方位环境配置
- **进程级隔离**：每个账号在独立进程中运行，互不影响
- **会话持久化**：自动保存登录状态，无需重复扫码
- **跨平台支持**：Windows、macOS、Linux 全平台支持
- **数据安全**：账号级数据隔离，支持导入导出，数据备份恢复

## 技术栈

- **Electron 39.2.5** - 桌面应用框架（Chromium 132.x + Node.js 20.x）
- **Node.js 18+** - 运行时环境（推荐 20.x）
- **React 19.2.1** - UI 框架（用于部分界面组件）
- **Clean Architecture** - 分层架构设计
- **Jest 29.7.0** - 测试框架
- **Fast-check 4.3.0** - 属性测试库
- **ESLint 8.56.0** - 代码检查工具
- **electron-builder 26.0.12** - 应用打包工具
- **axios 1.13.2** - HTTP 客户端
- **electron-store 8.1.0** - 本地存储
- **https-proxy-agent 7.0.6** - 代理支持
- **node-fetch 2.7.0** - 网络请求

## 项目结构

```
whatsapp-desktop-translation/
├── src/                          # 源代码目录
│   ├── main-refactored.js       # 🚀 新架构主入口
│   ├── preload.js               # 预加载脚本
│   ├── preload-view.js          # 视图预加载脚本
│   ├── config.js                # 应用配置
│   │
│   ├── app/                     # 📦 应用核心
│   │   ├── bootstrap.js         # 应用启动引导器
│   │   ├── DependencyContainer.js # 依赖注入容器
│   │   └── constants/           # 应用常量
│   │
│   ├── core/                    # ⚙️ 核心组件（横切关注点）
│   │   ├── eventbus/            # 事件总线
│   │   ├── config/              # 配置管理
│   │   ├── state/               # 状态管理
│   │   ├── container/           # 依赖容器
│   │   ├── errors/              # 错误处理
│   │   ├── managers/            # 管理器统一导出
│   │   └── services/            # 服务统一导出
│   │
│   ├── domain/                  # 🎯 领域层
│   │   ├── entities/            # 领域实体
│   │   ├── events/              # 领域事件
│   │   ├── repositories/        # Repository接口
│   │   └── errors/              # 领域错误
│   │
│   ├── application/             # 💼 应用层
│   │   ├── services/            # 应用服务
│   │   ├── usecases/            # 用例
│   │   └── dtos/                # 数据传输对象
│   │
│   ├── infrastructure/          # 🔧 基础设施层
│   │   ├── translation/         # 翻译适配器
│   │   ├── repositories/        # Repository实现
│   │   ├── storage/             # 存储适配器
│   │   └── plugins/             # 插件系统
│   │
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
│   │
│   ├── quick-reply/             # 💬 快捷回复模块
│   │   ├── controllers/         # 控制器层
│   │   ├── managers/            # 管理器层
│   │   ├── storage/             # 存储层
│   │   ├── models/              # 数据模型
│   │   ├── ui/                  # UI组件
│   │   └── __tests__/           # 测试文件
│   │
│   ├── single-window/           # 🖼️ 单窗口架构
│   │   ├── renderer/            # 渲染进程组件
│   │   │   ├── sidebar.js       # 侧边栏入口（模块化）
│   │   │   ├── sidebar/         # 侧边栏模块
│   │   │   ├── styles.css       # 样式入口
│   │   │   └── styles/          # CSS 模块
│   │   └── docs/                # 单窗口文档
│   │
│   ├── managers/                # 管理器实现
│   │   ├── instance/            # 实例管理
│   │   └── session/             # 会话管理
│   ├── translation/             # 翻译服务
│   ├── models/                  # 数据模型
│   ├── environment/             # 环境配置
│   ├── ui/                      # UI 组件
│   ├── utils/                   # 工具类
│   └── config/                  # 配置管理
│
├── test/                        # 🧪 测试文件
│   ├── __tests__/               # 测试用例
│   ├── arbitraries/             # 属性测试
│   ├── fingerprint/             # 指纹测试
│   ├── helpers/                 # 测试辅助
│   ├── mocks/                   # Mock 数据
│   └── proxy/                   # 代理测试
│
├── docs/                        # 📖 文档
│   ├── 需求.md                  # 完整需求文档
│   ├── BUILD_GUIDE.md           # 构建指南
│   ├── BUILD_VERIFICATION_REPORT.md # 构建验证报告
│   ├── FINAL_BUILD_REPORT.md    # 最终构建报告
│   ├── 代理与指纹系统安全检测报告.md # 安全报告
│   ├── 技术安全实现建议.md      # 安全建议
│   ├── 语音翻译验证成功VOICE_TRANSLATION_VERIFICATION.md # 语音翻译验证
│   └── ...                      # 其他文档
│
├── scripts/                     # 🔧 构建和工具脚本
│   ├── prepare-build.js         # 构建准备
│   ├── afterPack.js             # 打包后处理
│   ├── check-*.js               # 各种检查脚本
│   ├── test-*.js                # 各种测试脚本
│   └── ...                      # 其他脚本
│
├── profiles/                    # 👤 账号配置文件和数据
├── resources/                   # 🎨 应用资源（图标等）
│   ├── icon.ico                 # Windows 图标
│   ├── icon.icns                # macOS 图标
│   ├── icons/                   # Linux 图标
│   └── ...                      # 其他资源
│
├── .kiro/specs/                 # 📋 规格说明
│   ├── architecture-refactoring/ # 架构重构规格
│   ├── enhanced-proxy-settings/  # 增强代理设置规格
│   ├── enhanced-quick-reply-management/ # 增强快捷回复管理规格
│   ├── manual-account-control/  # 手动账户控制规格
│   ├── multi-account-single-window/ # 多账号单窗口规格
│   ├── professional-fingerprint-browser/ # 专业指纹浏览器规格
│   └── ...                      # 其他规格
│
├── archive/                     # 📦 旧架构备份
├── backups/                     # 💾 备份文件
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

# 构建所有平台
npm run build:all

# 仅打包不构建安装程序
npm run pack
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

# 测试重连功能
npm run test:reconnect

# 清理会话数据
npm run test:clean

# 测试构建
npm run test:build

# 测试会话隔离
npm run test:isolation

# 验证会话隔离
npm run verify:isolation
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
- 快捷回复模块测试覆盖率 99.4%

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
5. **模块化设计**：每个功能模块独立，可单独测试和维护

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
- 快捷回复数据（`quick-reply/` 子目录）

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
支持多种翻译引擎（Google、GPT-4、Gemini、DeepSeek、自定义 API）和翻译风格配置。

### StateManager（状态管理）
集中状态管理，支持状态订阅和更新。

### IPCRouter（IPC 路由）
处理主进程和渲染进程之间的 IPC 通信。

### QuickReplyModule（快捷回复模块）
提供预设回复模板的创建、管理和快速发送功能，支持多种媒体类型和分组管理。

### ProxyManager（代理管理器）
支持 HTTP/HTTPS 代理配置，代理检测，网络状态监控。

### FingerprintManager（指纹管理器）
专业级浏览器指纹管理，支持 WebGL、WebRTC、Canvas、Audio、设备信息等全方位环境配置。

## 主要功能模块

### 1. 多账号管理
- 同时运行多个 WhatsApp 账号，完全隔离
- 一键切换账号
- 账号启动/停止控制
- 账号状态监控
- 自动启动配置

### 2. 手动账户控制
- 按需打开/关闭账号，节省系统资源
- 应用启动时不自动加载所有账号
- 一键打开/关闭账号，操作简单快捷
- 支持自动启动配置，常用账号自动打开
- 关闭后会话保持，重新打开无需扫码

### 3. 翻译系统
- **聊天窗口翻译**：理解对方消息，支持 Google 翻译（免费）、GPT-4、Gemini、DeepSeek、自定义 API
- **输入框翻译**：发送前自动翻译消息，支持 11 种风格定制
- **好友独立配置**：为每个联系人设置不同的翻译偏好
- **语音翻译**：支持语音消息翻译
- **图片翻译**：支持图片内容翻译
- **实时翻译**：输入时实时显示翻译预览
- **反向翻译**：验证翻译准确性

### 4. 快捷回复
- 支持文本、图片、音频、视频、图文、名片等多种模板类型
- 分组管理，层级结构，轻松组织大量模板
- 与翻译系统深度集成，支持原文或翻译后发送
- 每个账号独立配置，数据完全隔离
- 支持导入导出，批量操作，拖拽排序
- 使用统计，性能优化，虚拟滚动
- 搜索功能，快速定位模板

### 5. 代理设置
- 启用/禁用代理
- 支持 HTTP/HTTPS 代理
- 手动配置代理信息（主机、端口、用户名、密码）
- 智能填写（粘贴 IP 信息自动识别）
- 代理检测服务
- 当前网络状态检测
- 代理历史记录

### 6. 指纹系统
- **浏览器设置**：Chrome、Edge、Firefox 等浏览器选择
- **操作系统**：Windows、MacOS 选择
- **User Agent**：可手动修改或随机生成
- **WebGL**：元数据配置（厂商、渲染器），图像随机/真实
- **WebRTC**：替换/真实/禁用模式
- **时区**：基于 IP/真实/自定义
- **地理位置**：询问/禁止/基于 IP 生成
- **语言**：基于 IP/自定义
- **分辨率**：真实/自定义
- **字体**：继承系统/自定义
- **Canvas & Audio**：随机/真实
- **设备信息**：设备名称、MAC 地址、CPU 内核数、内存大小
- **其他硬件**：蓝牙、电池、端口扫描保护
- **Cookie**：自定义 Cookie 配置
- 一键生成指纹

### 7. 客户画像
- 客户信息管理（昵称、电话、地址、生日、性别、备注、国家、标签）
- 销售信息（客户价值、销售阶段、社媒来源）
- 公司信息（公司名称、部门、职位）
- 备注录（历史记录展示）

### 8. 联系人管理
- 搜索联系人（手机号/ID）
- 标签筛选
- 会话类型筛选（全部/私聊/群聊）
- 消息状态筛选（全部/未读/未回/已读未回）
- 联系人信息展示
- 批量选择
- 群发消息选择

### 9. 群发消息
- 创建群发任务
- 任务管理（查看详情、编辑、删除、重试）
- 任务控制（批量删除、一键清空、一键停止）
- 顺序发送
- 保持在线提醒
- 风控保护（速率限制、随机间隔、每日限额、失败重试）

## 故障排除

### 常见问题
1. **应用无法启动**：检查 Node.js 版本（需要 18.0.0+），清理缓存，重新安装依赖
2. **账号加载失败**：检查网络配置，验证网络连接，查看日志
3. **翻译不工作**：检查 API 密钥，验证网络连接，查看翻译日志
4. **内存占用过高**：关闭不必要的账号，清理缓存，重启应用
5. **快捷回复无法保存**：确保已选择账号，检查模板内容是否符合要求
6. **代理连接失败**：验证代理配置，检查代理服务是否可用
7. **指纹设置无效**：重启账号使设置生效，检查指纹配置是否正确

### 调试模式
```bash
# 启用详细日志
DEBUG=* npm start

# 启用特定模块日志
DEBUG=whatsapp:* npm start

# 查看快捷回复日志
grep "\[QuickReply\]" ./logs/*.log
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

### 性能优化
- 虚拟滚动（大量模板时）
- 搜索防抖（300ms）
- 媒体懒加载
- 查询缓存
- 自动清理缓存（超过 1 小时未使用）

## 文档资源

### 用户文档
- 📖 [快捷回复使用指南](快捷回复使用指南.md) - 快捷回复功能完整使用说明
- 📖 [快捷回复用户指南](src/quick-reply/USER_GUIDE.md) - 快捷回复详细使用文档
- 📖 [需求文档](docs/需求.md) - 完整的功能需求文档
- 📖 [运行说明](docs/运行说明.txt) - 应用运行说明

### 开发者文档
- 📖 [快捷回复 API 文档](src/quick-reply/API_DOCUMENTATION.md) - 快捷回复 API 接口文档
- 📖 [快捷回复集成指南](src/quick-reply/INTEGRATION_GUIDE.md) - 快捷回复技术集成说明
- 📖 [快捷回复性能集成指南](src/quick-reply/PERFORMANCE_INTEGRATION_GUIDE.md) - 性能优化使用说明
- 📖 [BUILD_GUIDE.md](docs/BUILD_GUIDE.md) - 打包和发布流程
- 📖 [BUILD_VERIFICATION_REPORT.md](docs/BUILD_VERIFICATION_REPORT.md) - 构建验证报告
- 📖 [FINAL_BUILD_REPORT.md](docs/FINAL_BUILD_REPORT.md) - 最终构建报告

### 架构文档
- 📖 [架构重构分析](docs/REFACTORING_ANALYSIS.md) - 架构重构分析
- 📖 [架构重构完成报告](docs/REFACTORING_COMPLETE_REPORT.md) - 架构重构完成报告
- 📖 [架构重构总结](docs/REFACTORING_COMPLETE_SUMMARY.md) - 架构重构总结
- 📖 [代码库架构审计](docs/codebase-architecture-audit.md) - 代码库架构审计
- 📖 [侧边栏模块化结构](src/single-window/renderer/sidebar/MODULE_STRUCTURE.md) - 侧边栏模块化架构文档

### 安全文档
- 📖 [代理与指纹系统安全检测报告](docs/代理与指纹系统安全检测报告.md) - 安全检测报告
- 📖 [技术安全实现建议](docs/技术安全实现建议.md) - 安全实现建议
- 📖 [Profile 提取技术总结](docs/profile-extraction-technical-summary.md) - Profile 提取技术总结

### 其他文档
- 📖 [快捷回复模块 README](src/quick-reply/README.md) - 快捷回复模块说明
- 📖 [单窗口架构 README](src/single-window/README.md) - 单窗口架构说明
- 📖 [管理器 README](src/managers/README.md) - 管理器说明
- 📖 [资源 README](resources/README.md) - 资源说明

## 规格说明文档

项目使用 `.kiro/specs/` 目录管理各种功能规格说明：

- 📋 [架构重构规格](.kiro/specs/architecture-refactoring/) - Clean Architecture 迁移规格
- 📋 [增强代理设置规格](.kiro/specs/enhanced-proxy-settings/) - 代理设置功能规格
- 📋 [增强快捷回复管理规格](.kiro/specs/enhanced-quick-reply-management/) - 快捷回复功能规格
- 📋 [手动账户控制规格](.kiro/specs/manual-account-control/) - 手动账户控制规格
- 📋 [多账号单窗口规格](.kiro/specs/multi-account-single-window/) - 单窗口架构规格
- 📋 [专业指纹浏览器规格](.kiro/specs/professional-fingerprint-browser/) - 指纹系统规格
- 📋 [侧边栏模块化重构规格](.kiro/specs/sidebar-modular-refactoring/) - 侧边栏模块化规格
- 📋 [翻译控制修复规格](.kiro/specs/translation-controls-fix/) - 翻译控制修复规格

## 注意事项

### 安全使用
- 本项目仅供学习和个人使用
- 使用本项目时请遵守 WhatsApp 的服务条款
- 不要用于自动化消息发送或滥用
- 不要用于商业目的
- 遵守当地法律法规
- 尊重他人隐私
- 群发功能可能触发平台风控，请合理控制使用

### 数据备份
```bash
# 备份 profiles 目录
cp -r profiles/ profiles-backup-$(date +%Y%m%d)/
```

### 版本信息
- **应用名称**: 老板稳了！天天旺 (Boss Stable Everyday Prosperity)
- **应用版本**: v1.0.0
- **Electron**: 39.2.5 (最新稳定版)
- **Node.js**: 18+ (推荐 20.x)
- **架构版本**: Clean Architecture v2.0
- **项目状态**: 生产就绪

### 应用信息
- **App ID**: com.laobenwenle.tiantianwang
- **Product Name**: 老板稳了！天天旺
- **Author**: Your Name <your.email@example.com>
- **License**: MIT
- **Repository**: https://github.com/your-org/whatsapp-desktop-translation.git

---

**最后更新**: 2026-01-13  
**项目状态**: 生产就绪  
**架构版本**: Clean Architecture v2.0