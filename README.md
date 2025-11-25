# WhatsApp Desktop Application

<div align="center">

![Electron](https://img.shields.io/badge/Electron-39.1.1-47848F?style=for-the-badge&logo=electron&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-20.x-339933?style=for-the-badge&logo=node.js&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-blue?style=for-the-badge)
![Platform](https://img.shields.io/badge/Platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey?style=for-the-badge)
![Refactored](https://img.shields.io/badge/Refactored-v1.1.0-ff6b6b?style=for-the-badge&logo=refactoring&logoColor=white)

基于 Electron 的 WhatsApp 桌面应用程序，支持实时翻译功能。

[功能特性](#核心特性) • [快速开始](#快速开始) • [架构重构](#-重构后的项目结构-v110) • [文档](#文档) • [测试](#测试)

<div align="left">

## 🔄 重构版亮点 (v1.1.0)

✨ **代码结构全面重构** - 更清晰、更易维护的架构  
⚡ **性能显著提升** - 边界计算优化、内存管理增强  
🔧 **开发体验改善** - 统一导出、依赖注入、模块别名  
📦 **向后兼容** - 现有功能完全兼容，渐进式迁移  

**详情**: 查看 [重构总结报告](REFACTORING_SUMMARY.md)

</div>

</div>

---

## 项目概述

本项目将 WhatsApp Web 封装为独立的桌面应用程序，提供实时翻译功能。用户可以在 Electron 窗口中直接使用完整的官方 WhatsApp Web 界面，并享受强大的翻译支持。

### 核心特性

- ✅ **多账号管理** - 同时运行多个 WhatsApp 账号，完全隔离
- ✨ **手动账户控制** - 按需打开/关闭账号，节省系统资源
  - 应用启动时不自动加载所有账号
  - 一键打开/关闭账号，操作简单快捷
  - 支持自动启动配置，常用账号自动打开
  - 关闭后会话保持，重新打开无需扫码
- ✅ **完整的 WhatsApp Web 功能** - 所有官方功能完整支持
- ✅ **智能翻译系统** - 支持多种翻译引擎（Google、GPT-4、Gemini、DeepSeek）
  - 聊天窗口翻译：理解对方消息，可选谷歌翻译（免费）节省成本
  - 输入框翻译：支持 11 种风格（正式、口语化、亲切等），提升沟通质量
- ✅ **输入框翻译** - 发送前自动翻译消息，支持风格定制
- ✅ **好友独立翻译配置** - 为每个联系人设置不同的翻译偏好
- ✅ **独立代理配置** - 每个账号可配置独立的网络代理（SOCKS5/HTTP/HTTPS）
- ✅ **进程级隔离** - 每个账号在独立进程中运行，互不影响
- ✅ **会话持久化** - 自动保存登录状态，无需重复扫码
- ✅ **跨平台支持** - Windows、macOS、Linux 全平台支持

## 技术栈

- **Electron 39.1.1** - 桌面应用框架（Chromium 132.x + Node.js 20.x）
- **多进程架构** - 每个账号独立进程，完全隔离
- **翻译引擎** - 支持 Google 翻译、GPT-4、Gemini、DeepSeek 等
- **Node.js 18+** - 运行时环境（推荐 20.x）

## 系统要求

### 最低配置

- **操作系统**：Windows 10+, macOS 10.14+, Ubuntu 20.04+
- **内存**：8GB RAM（支持 5 个并发账号）
- **处理器**：双核 2.0GHz 或更高
- **磁盘空间**：500MB + 每个账号约 200MB
- **网络**：稳定的互联网连接

### 推荐配置

- **操作系统**：Windows 11, macOS 12+, Ubuntu 22.04+
- **内存**：16GB RAM（支持 30 个并发账号）
- **处理器**：四核 2.5GHz 或更高
- **磁盘空间**：2GB + 每个账号约 200MB
- **网络**：高速互联网连接

### 性能参考

| 并发账号数 | 推荐内存 | CPU 使用率 | 磁盘占用 |
|-----------|---------|-----------|---------|
| 1-5       | 8GB     | 5-10%     | 1-2GB   |
| 5-15      | 12GB    | 10-20%    | 2-4GB   |
| 15-30     | 16GB    | 20-35%    | 4-8GB   |
| 30+       | 32GB    | 35-50%    | 8GB+    |

## 快速开始

### 本地开发

1. **安装依赖**
```bash
npm install
```

2. **启动应用**
```bash
npm start
```

3. **开发模式**（带调试）
```bash
npm run dev
```

### 🚀 重构后开发 (v1.1.0+)

**使用新的应用入口（推荐）:**
```bash
node src/main-refactored.js
```

**优势:**
- ⚡ 更快的启动速度
- 🛡️ 更好的错误处理
- 📊 统一的性能监控
- 🔗 清晰的依赖管理

**渐进式迁移:**
- 现有代码完全兼容
- 可以逐步迁移到新架构
- 参考 `REFACTORING_SUMMARY.md` 了解详情

### 使用说明

#### 基础使用

1. 启动应用后，会显示账号管理主界面
2. 点击"添加账号"创建新的 WhatsApp 账号实例
3. 为账号设置名称、代理和翻译配置
4. 点击账号旁边的 **▶ 打开** 按钮启动账号
5. 首次使用需要用手机扫描二维码登录
6. 登录后会话会自动保存，下次启动无需重新扫码
7. 使用完毕后，点击 **⏹ 关闭** 按钮停止账号，释放资源

#### 手动账户控制 ✨ 新功能

应用启动时不会自动加载所有账号，您可以按需打开和关闭账号：

**打开账号**：
- 点击账号旁边的 **▶ 打开** 按钮
- 等待 2-5 秒加载完成
- 账号状态变为"已连接"（绿色指示器）

**关闭账号**：
- 点击 **⏹ 关闭** 按钮
- 账号立即停止，释放内存资源
- 会话数据保留，重新打开无需扫码

**自动启动**：
- 在账号设置中启用"自动启动"选项
- 应用启动时会自动打开该账号
- 适合常用账号

**账号状态**：
- 🟢 **已连接** - 账号正在运行
- ⚪ **未启动** - 账号未运行
- 🔵 **加载中** - 正在加载
- 🔴 **错误** - 加载失败，可点击重试

**优势**：
- 💾 节省内存：只运行需要的账号
- ⚡ 启动更快：应用启动时不加载所有账号
- 🎯 灵活管理：随时打开/关闭账号
- 🔄 保持会话：关闭后重新打开无需扫码

详细使用说明请参考 [手动账户控制指南](docs/MANUAL_ACCOUNT_CONTROL_GUIDE.md)

#### 多账号管理

- **添加账号**：点击主界面的"添加账号"按钮，系统会自动生成唯一 ID
- **启动/停止**：每个账号可以独立启动和停止
- **配置账号**：点击账号卡片可以编辑名称、代理和翻译设置
- **删除账号**：删除账号会同时清除其会话数据和配置
- **状态监控**：实时查看每个账号的运行状态和未读消息数

#### 代理配置

每个账号可以配置独立的网络代理，实现 IP 隔离：

```javascript
// 代理配置示例
{
  enabled: true,
  protocol: 'socks5',  // 支持 socks5、http、https
  host: '127.0.0.1',
  port: 1080,
  username: 'user',    // 可选
  password: 'pass',    // 可选
  bypass: 'localhost'  // 可选，绕过代理的地址
}
```

**支持的代理类型**：
- SOCKS5 代理（推荐）
- HTTP 代理
- HTTPS 代理
- 支持用户名/密码认证

#### 翻译配置

每个账号可以独立配置翻译功能，支持两种翻译场景：

**聊天窗口翻译**（接收的消息）：
- **翻译引擎**：Google 翻译（免费）、GPT-4、Gemini、DeepSeek
- **目标语言**：选择翻译的目标语言
- **自动翻译**：自动翻译接收的消息
- **群组翻译**：是否翻译群组消息
- **推荐**：使用谷歌翻译节省成本

**输入框翻译**（发送的消息）：
- **翻译引擎**：Google 翻译（免费）、GPT-4、Gemini、DeepSeek
- **翻译风格**：11 种风格可选（通用、正式、口语化、亲切、幽默、礼貌、强硬、简洁、激励、中立、专业）
- **目标语言**：自动检测或手动选择
- **实时翻译**：输入时实时显示翻译预览
- **反向翻译**：验证翻译准确性
- **推荐**：根据场景选择合适的引擎和风格

**好友独立配置**：
- 为特定联系人设置不同的翻译规则
- 支持独立的目标语言和禁发中文设置

**成本优化建议**：
- 日常聊天：聊天窗口用谷歌翻译（免费），输入框用 AI 翻译 + 风格
- 重要对话：两者都用 AI 翻译获得最佳质量
- 预算有限：两者都用谷歌翻译完全免费

### 应用打包

生成平台特定的安装包：

```bash
npm run build
```

打包后的文件在 `dist/` 目录中。

## 项目结构

### 🏗️ 重构后的项目结构 (v1.1.0+)

```
whatsapp-desktop-container/
├── src/
│   ├── main.js              # Electron 主进程入口 (向后兼容)
│   ├── main-refactored.js   # 重构后的主入口 (新)
│   ├── preload.js           # 预加载脚本
│   ├── config.js            # 应用配置
│   ├── app/                 # 📦 应用核心 (重构新增)
│   │   ├── bootstrap.js     # 🚀 应用启动引导器 (新)
│   │   ├── DependencyContainer.js # 🔗 依赖注入容器 (新)
│   │   └── constants/       # 📊 应用常量集中管理 (新)
│   ├── core/                # ⚙️ 核心模块 (重构新增)
│   │   ├── managers/        # 业务管理器 (统一导出)
│   │   │   └── index.js     # 统一导出接口 (新)
│   │   ├── models/          # 数据模型 (统一导出)
│   │   │   └── index.js     # 统一导出接口 (新)
│   │   └── services/        # 基础服务 (统一导出)
│   │       └── index.js     # 统一导出接口 (新)
│   ├── ui/                  # 🎨 用户界面 (重构新增)
│   │   └── main-window/     # 主窗口组件 (重构拆分)
│   │       ├── ViewManager.js      # 重构后视图管理器
│   │       ├── ViewBoundsManager.js # 边界管理器 (新)
│   │       ├── ViewMemoryManager.js # 内存管理器 (新)
│   │       └── index.js     # 统一导出接口 (新)
│   ├── shared/              # 🛠️ 共享模块 (重构新增)
│   │   ├── utils/           # 工具类 (统一导出 + 错误处理合并)
│   │   ├── validators/      # 验证器
│   │   ├── decorators/      # 装饰器
│   │   └── constants/       # 共享常量
│   ├── features/            # 🔧 功能模块 (重构新增)
│   │   ├── translation/     # 翻译功能
│   │   ├── proxy/          # 代理功能
│   │   └── account/        # 账户功能
│   └── translation/         # 🌐 翻译模块 (保留增强)
│       ├── managers/        # 翻译管理器
│       ├── adapters/        # 翻译引擎适配器
│       └── contentScript.js # 内容脚本注入
├── profiles/                # 📁 账号数据目录（自动生成）
│   ├── account-{uuid}/      # 每个账号的独立存储
│   │   ├── Session Storage/
│   │   ├── Local Storage/
│   │   ├── IndexedDB/
│   │   └── Cache/
├── resources/               # 🎨 应用资源（图标等）
├── docs/                    # 📖 文档目录
│   └── REFACTORING_SUMMARY.md # 🔄 重构总结报告 (新)
├── scripts/                 # 🔧 工具脚本
├── package.json
└── README.md
```

### 🎯 重构核心改进点

#### 架构层面
- **🧩 模块化设计**: 清晰的层次结构，职责明确
- **🔗 依赖注入**: 统一依赖管理，避免循环依赖
- **📦 统一导出**: 简化导入路径，提升开发体验

#### 代码质量
- **🗂️ 文件拆分**: ViewManager(4096行) → 3个专门组件
- **🔄 错误处理**: 合并重复的ErrorHandler，建立统一标准
- **📊 常量管理**: 集中管理应用常量，避免散布

#### 性能优化
- **⚡ 边界计算**: 智能缓存 + 防抖处理
- **🧠 内存管理**: 专用内存监控 + 自动清理
- **🔄 视图池**: BrowserView重用机制

**⚠️ 向后兼容**: 现有API完全兼容，可渐进式迁移
```

## 配置

### 环境变量

- `SESSION_PATH` - 会话数据存储路径（默认：`./session-data`）
- `LOG_LEVEL` - 日志级别（默认：`info`）
- `NODE_ENV` - 运行环境（`development` 或 `production`）

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

### 数据迁移

如果你从旧版本（单账号）升级，应用会自动执行数据迁移：
1. 检测旧的 `session-data/` 目录
2. 将数据迁移到 `profiles/default/`
3. 创建默认账号配置
4. 保留原有的翻译设置

迁移过程完全自动，无需手动操作。

## 版本信息

### 当前版本
- **应用版本**: v1.1.0+ (重构版)
- **Electron**: 39.1.1 (最新稳定版)
- **Node.js**: 20.x (推荐)

### 🔄 重构版本特性
- **v1.1.0**: 完整代码结构重构
  - 🏗️ 全新模块化架构
  - ⚡ 性能优化
  - 🔧 开发体验改善

```bash
# 检查版本信息
npm run version
```

升级说明请参考：
- 📖 [UPGRADE_SUMMARY.md](UPGRADE_SUMMARY.md) - 升级总结
- 📖 [UPGRADE_NOTES.md](UPGRADE_NOTES.md) - 详细升级说明

## 📖 文档

### 用户文档

- **[手动账户控制指南](docs/MANUAL_ACCOUNT_CONTROL_GUIDE.md)** ✨ - 手动打开/关闭账号功能完整说明
- **[单窗口用户指南](docs/SINGLE_WINDOW_USER_GUIDE.md)** - 新版单窗口界面完整使用说明
- **[迁移指南](docs/MIGRATION_GUIDE.md)** - 从多窗口版本迁移到单窗口版本
- **[账号管理快速参考](docs/ACCOUNT_MANAGEMENT_QUICK_REFERENCE.md)** - 账号管理功能快速查询
- **[常见问题](docs/FAQ.md)** - 常见问题解答
- **[用户指南](docs/USER_GUIDE.md)** - 完整的功能使用说明（旧版）
- **[翻译引擎配置](docs/USER_GUIDE.md#翻译引擎配置)** - 各引擎配置指南

### 开发者文档

- **[开发者指南](docs/DEVELOPER_GUIDE.md)** - 开发环境设置和工作流
- **[API 文档](docs/API.md)** - 完整的 API 接口文档
- **[扩展开发指南](docs/EXTENSION_GUIDE.md)** - 创建翻译引擎插件
- **[构建和发布指南](docs/BUILD_GUIDE.md)** - 打包和发布流程

### 重构文档 (v1.1.0+)

- **[🔄 重构总结报告](REFACTORING_SUMMARY.md)** - 完整的重构过程和技术细节
  - 📊 架构改进对比
  - ⚡ 性能优化详情
  - 🛠️ 迁移指南
  - 🔧 开发工具配置

### 测试文档

- **[测试指南](docs/TESTING_GUIDE.md)** - 详细测试指南
- **[发布检查清单](docs/RELEASE_CHECKLIST.md)** - 发布前检查清单

### 其他文档

- **[更新日志](CHANGELOG.md)** - 版本更新记录
- **[安全最佳实践](docs/SECURITY_BEST_PRACTICES.md)** - 安全使用指南
- **[升级说明](docs/UPGRADE_NOTES.md)** - 版本升级指南

## 测试

### 运行测试

```bash
# 运行所有测试
npm test

# 监听模式
npm run test:watch

# 生成覆盖率报告
npm run test:coverage
```

### 测试工具

```bash
# 验证测试环境
npm run test:setup

# 检查会话数据
npm run test:session

# 检查重连配置
npm run test:reconnect

# 清理会话数据
npm run test:clean
```

详细信息请参考 [测试指南](docs/TESTING_GUIDE.md)。

## 常见问题 (FAQ)

### 多账号相关

**Q: 最多可以同时运行多少个账号？**
A: 理论上没有限制，但建议根据系统配置：
- 8GB RAM：最多 5 个账号
- 16GB RAM：最多 30 个账号
- 32GB RAM：50+ 个账号

**Q: 每个账号会占用多少资源？**
A: 每个账号实例大约占用：
- 内存：200-400MB
- CPU：空闲时 <1%，活跃时 2-5%
- 磁盘：50-200MB（取决于聊天记录）

**Q: 账号之间的数据会互相影响吗？**
A: 不会。每个账号运行在独立的进程中，拥有独立的存储空间，完全隔离。

**Q: 可以为不同账号配置不同的代理吗？**
A: 可以。每个账号都可以配置独立的代理服务器，实现 IP 隔离。

**Q: 如果一个账号崩溃，会影响其他账号吗？**
A: 不会。每个账号在独立进程中运行，单个账号崩溃不会影响其他账号。系统会自动尝试重启崩溃的账号（最多 3 次）。

### 代理配置

**Q: 支持哪些类型的代理？**
A: 支持 SOCKS5、HTTP 和 HTTPS 代理，推荐使用 SOCKS5。

**Q: 代理配置错误会怎样？**
A: 如果代理无法连接，账号实例将无法启动，系统会显示错误提示。

**Q: 可以不使用代理吗？**
A: 可以。代理配置是可选的，不配置代理时使用直连网络。

### 翻译功能

**Q: 多账号模式下翻译功能还能用吗？**
A: 可以。每个账号都有独立的翻译配置，互不影响。

**Q: 可以为不同账号配置不同的翻译引擎吗？**
A: 可以。每个账号可以独立选择翻译引擎和目标语言。

### 故障排除

**问题：无法启动 Chromium**

**解决方案**：确保系统已安装 Chromium 依赖。在 Linux 上：
```bash
sudo apt-get install -y chromium fonts-liberation libasound2 libatk-bridge2.0-0
```

**问题：账号实例启动失败**

**解决方案**：
1. 检查代理配置是否正确
2. 确保系统资源充足（内存、CPU）
3. 查看错误日志了解具体原因
4. 尝试删除并重新创建账号

**问题：会话频繁过期**

**解决方案**：
1. 检查 profiles 目录权限
2. 避免同时在多个设备上登录同一账号
3. 确保 profiles 目录没有被杀毒软件隔离

**问题：账号实例反复崩溃**

**解决方案**：
1. 检查系统资源是否充足
2. 尝试降低并发运行的账号数量
3. 清除账号的缓存数据后重启
4. 如果问题持续，请提交 Issue 并附上日志

更多问题排查请参考 [docs/FAQ.md](docs/FAQ.md) 和 [docs/USER_GUIDE.md](docs/USER_GUIDE.md)。

### 控制台错误说明

如果在控制台看到错误信息，请参考 [CONSOLE_ERRORS_EXPLAINED.md](CONSOLE_ERRORS_EXPLAINED.md)。

大多数错误来自 WhatsApp Web 自身，不影响功能。应用已自动过滤这些错误。

## 代理配置示例

### SOCKS5 代理（推荐）

```javascript
{
  enabled: true,
  protocol: 'socks5',
  host: '127.0.0.1',
  port: 1080
}
```

### 带认证的 SOCKS5 代理

```javascript
{
  enabled: true,
  protocol: 'socks5',
  host: 'proxy.example.com',
  port: 1080,
  username: 'your_username',
  password: 'your_password'
}
```

### HTTP 代理

```javascript
{
  enabled: true,
  protocol: 'http',
  host: 'proxy.example.com',
  port: 8080,
  username: 'your_username',  // 可选
  password: 'your_password'   // 可选
}
```

### 绕过本地地址

```javascript
{
  enabled: true,
  protocol: 'socks5',
  host: '127.0.0.1',
  port: 1080,
  bypass: 'localhost,127.0.0.1,*.local'
}
```

### 代理配置最佳实践

1. **使用 SOCKS5**：相比 HTTP 代理，SOCKS5 性能更好，支持 UDP
2. **测试代理**：配置前先测试代理是否可用
3. **IP 隔离**：为每个账号配置不同的代理 IP，避免关联
4. **代理稳定性**：使用稳定的代理服务，避免频繁断线
5. **认证安全**：代理密码会加密存储，但仍建议使用强密码

## 未来计划

### 短期计划（1-3 个月）

- [ ] 账号分组功能
- [ ] 批量操作（批量启动/停止）
- [ ] 导入/导出账号配置
- [ ] 更丰富的状态监控和统计

### 中期计划（3-6 个月）

- [ ] 云同步账号配置
- [ ] 自动化消息处理
- [ ] 高级代理轮换策略
- [ ] 性能分析和优化工具

### 长期计划（6-12 个月）

- [ ] 插件系统
- [ ] RESTful API 接口
- [ ] 移动端管理应用
- [ ] 集群部署支持

## 许可证

MIT

## 📂 项目结构

### 重构后的架构 (v1.1.0+)

```
whatsapp-desktop-translation/
├── src/
│   ├── main.js              # Electron 主进程入口 (原版)
│   ├── main-refactored.js   # 重构后的主入口 (新)
│   ├── preload.js           # 预加载脚本
│   ├── config.js            # 配置文件
│   ├── app/                 # 应用核心 (重构新增)
│   │   ├── bootstrap.js     # 应用启动引导器 (新)
│   │   ├── DependencyContainer.js # 依赖注入容器 (新)
│   │   └── constants/       # 应用常量集中管理 (新)
│   ├── core/                # 核心模块 (重构新增)
│   │   ├── managers/        # 业务管理器 (统一导出)
│   │   │   ├── index.js     # 统一导出接口 (新)
│   │   │   ├── AccountConfigManager.js
│   │   │   ├── InstanceManager.js
│   │   │   └── ...
│   │   ├── models/          # 数据模型 (统一导出)
│   │   │   ├── index.js     # 统一导出接口 (新)
│   │   │   ├── AccountConfig.js
│   │   │   └── ...
│   │   └── services/        # 基础服务 (统一导出)
│   │       ├── index.js     # 统一导出接口 (新)
│   │       └── ...
│   ├── ui/                  # 用户界面 (重构新增)
│   │   └── main-window/     # 主窗口组件 (拆分重构)
│   │       ├── ViewManager.js          # 重构后视图管理器
│   │       ├── ViewBoundsManager.js    # 边界管理器 (新)
│   │       ├── ViewMemoryManager.js    # 内存管理器 (新)
│   │       └── index.js    # 统一导出接口 (新)
│   ├── shared/              # 共享模块 (重构新增)
│   │   ├── utils/           # 工具类 (统一导出)
│   │   │   ├── index.js     # 统一导出接口 (新)
│   │   │   ├── ErrorHandler.js         # 统一错误处理器
│   │   │   └── ...
│   │   ├── validators/      # 验证器
│   │   ├── decorators/      # 装饰器
│   │   └── constants/       # 共享常量
│   ├── features/            # 功能模块 (重构新增)
│   │   ├── translation/     # 翻译功能
│   │   ├── proxy/          # 代理功能
│   │   └── account/        # 账户功能
│   └── translation/         # 翻译模块 (保留原有)
│       ├── managers/        # 翻译管理器
│       ├── adapters/        # 翻译引擎适配器
│       ├── utils/           # 工具类
│       ├── ipcHandlers.js   # IPC 通信处理器
│       └── contentScript.js # 内容脚本
├── scripts/                 # 测试和工具脚本
├── resources/               # 应用资源
├── .kiro/specs/            # 项目规范文档
├── docs/                    # 文档目录
│   ├── USER_GUIDE.md        # 用户指南
│   ├── FAQ.md               # 常见问题
│   ├── DEVELOPER_GUIDE.md   # 开发者指南
│   ├── API.md               # API 文档
│   ├── REFACTORING_SUMMARY.md # 重构总结报告 (新)
│   └── ...
├── CHANGELOG.md             # 更新日志
├── LICENSE                  # 许可证
└── package.json
```

### 重构核心改进

- **🔧 模块化架构**: 清晰的层次结构，易于维护和扩展
- **🎯 职责分离**: 每个模块职责单一，边界清晰
- **🔗 依赖注入**: 统一依赖管理，避免循环依赖
- **📦 统一导出**: 简化导入路径，提升开发体验
- **⚡ 性能优化**: 边界计算、内存管理专门化
```

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

### 贡献指南

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

### 开发规范

- 遵循现有代码风格
- 添加适当的注释
- 更新相关文档
- 运行测试确保功能正常

## 安全性说明

本应用使用与官方 WhatsApp Desktop 相同的技术实现，包括 User-Agent 设置。详细的安全性分析和最佳实践请参考：

📖 **[安全使用最佳实践](SECURITY_BEST_PRACTICES.md)**

关键点：
- ✅ User-Agent 设置是安全的，使用真实的 Chrome 版本
- ✅ 与官方 WhatsApp Desktop 使用相同的方法
- ⚠️ 请勿用于自动化消息发送或滥用
- ⚠️ 遵守 WhatsApp 服务条款

## 免责声明

本项目仅供学习和个人使用。使用本项目时请遵守 WhatsApp 的服务条款。详细信息请参考 [SECURITY_BEST_PRACTICES.md](SECURITY_BEST_PRACTICES.md)。
