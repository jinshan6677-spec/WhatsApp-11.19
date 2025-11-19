# Main Application Window (主应用窗口)

主应用窗口模块，提供账号管理界面和用户交互功能。

## 文件结构

```
src/container/
├── MainApplicationWindow.js  # 主窗口管理类
├── ipcHandlers.js           # IPC 通信处理器
├── preload-main.js          # 预加载脚本
├── index.html               # 主窗口 HTML
├── styles.css               # 样式表
├── renderer.js              # 渲染进程脚本
└── README.md                # 本文档
```

## 功能特性

### 1. 账号管理界面

- **账号列表视图**：网格布局展示所有账号
- **账号卡片**：显示账号名称、状态、最后活跃时间、未读消息数
- **状态指示器**：实时显示账号状态（运行中/已停止/启动中/错误）
- **搜索功能**：按账号名称搜索
- **过滤功能**：按状态过滤账号
- **响应式布局**：适配不同屏幕尺寸

### 2. 账号操作

- **添加账号**：创建新的 WhatsApp 账号配置
- **编辑账号**：修改账号配置（名称、代理、翻译设置）
- **删除账号**：删除账号及其所有数据
- **启动实例**：启动 WhatsApp 账号实例
- **停止实例**：停止运行中的账号实例
- **重启实例**：重启账号实例

### 3. 配置对话框

- **基本信息**：账号名称
- **代理设置**：
  - 启用/禁用代理
  - 协议选择（SOCKS5/HTTP/HTTPS）
  - 主机和端口
  - 认证信息（用户名/密码）
- **翻译设置**：
  - 启用/禁用翻译
  - 目标语言选择
  - 翻译引擎选择
  - 自动翻译开关

### 4. 主题支持

- **浅色主题**：默认主题
- **深色主题**：护眼模式
- **主题切换**：一键切换，自动保存偏好

## 使用方法

### 基本使用

```javascript
const MainApplicationWindow = require('./container/MainApplicationWindow');
const { registerIPCHandlers } = require('./container/ipcHandlers');

// 创建主窗口
const mainWindow = new MainApplicationWindow();
mainWindow.initialize();

// 注册 IPC 处理器
registerIPCHandlers(configManager, instanceManager, mainWindow);

// 渲染账号列表
const accounts = await configManager.loadAccounts();
mainWindow.renderAccountList(accounts);

// 更新账号状态
mainWindow.updateAccountStatus(accountId, {
  status: 'running',
  unreadCount: 5
});

// 显示通知
mainWindow.showNotification(accountId, '新消息');
```

### 完整示例

参见 `src/examples/main-window-example.js`

## API 文档

### MainApplicationWindow

#### 方法

##### `initialize()`

初始化主窗口。

**返回值**：`BrowserWindow` - Electron 窗口对象

**示例**：
```javascript
const mainWindow = new MainApplicationWindow();
mainWindow.initialize();
```

##### `renderAccountList(accounts)`

渲染账号列表。

**参数**：
- `accounts` (Array): 账号配置数组

**示例**：
```javascript
mainWindow.renderAccountList([
  {
    id: 'uuid-1',
    name: '工作账号',
    status: 'running',
    unreadCount: 3,
    lastActiveAt: '2024-01-01T12:00:00Z'
  }
]);
```

##### `updateAccountStatus(accountId, status)`

更新单个账号的状态。

**参数**：
- `accountId` (string): 账号 ID
- `status` (Object): 状态对象
  - `status` (string): 状态值（running/stopped/starting/error）
  - `unreadCount` (number): 未读消息数
  - `lastActiveAt` (string): 最后活跃时间

**示例**：
```javascript
mainWindow.updateAccountStatus('uuid-1', {
  status: 'running',
  unreadCount: 5,
  lastActiveAt: new Date().toISOString()
});
```

##### `showNotification(accountId, message)`

显示通知消息。

**参数**：
- `accountId` (string): 账号 ID
- `message` (string): 通知消息

**示例**：
```javascript
mainWindow.showNotification('uuid-1', '实例启动成功');
```

##### `getWindow()`

获取 Electron 窗口对象。

**返回值**：`BrowserWindow|null`

##### `close()`

关闭主窗口。

##### `focus()`

聚焦主窗口（如果最小化则恢复）。

### IPC 通道

#### 主进程 → 渲染进程

- `accounts:render` - 渲染账号列表
- `account:status-update` - 更新账号状态
- `notification:show` - 显示通知

#### 渲染进程 → 主进程

- `accounts:get-all` - 获取所有账号
- `account:create` - 创建账号
- `account:update` - 更新账号
- `account:delete` - 删除账号
- `instance:start` - 启动实例
- `instance:stop` - 停止实例
- `instance:restart` - 重启实例

## 样式定制

### CSS 变量

可以通过修改 CSS 变量来定制主题：

```css
:root {
  /* 主色调 */
  --primary: #25d366;
  --primary-hover: #20bd5a;
  
  /* 背景色 */
  --bg-primary: #ffffff;
  --bg-secondary: #f5f5f5;
  
  /* 文字颜色 */
  --text-primary: #1f2937;
  --text-secondary: #6b7280;
  
  /* 状态颜色 */
  --status-running: #10b981;
  --status-stopped: #6b7280;
  --status-error: #ef4444;
}
```

### 深色主题

深色主题通过 `[data-theme="dark"]` 选择器定义：

```css
[data-theme="dark"] {
  --bg-primary: #1f2937;
  --bg-secondary: #111827;
  --text-primary: #f9fafb;
  /* ... */
}
```

## 安全性

### Content Security Policy

主窗口使用严格的 CSP 策略：

```html
<meta http-equiv="Content-Security-Policy" 
      content="default-src 'self'; 
               style-src 'self' 'unsafe-inline'; 
               script-src 'self'">
```

### Context Isolation

所有 IPC 通信通过 `contextBridge` 暴露，确保渲染进程无法直接访问 Node.js API。

### Sandbox

渲染进程运行在沙箱模式下，增强安全性。

## 响应式设计

主窗口支持响应式布局：

- **桌面端**（> 768px）：网格布局，多列显示
- **移动端**（≤ 768px）：单列布局，工具栏自适应

## 性能优化

- **虚拟滚动**：大量账号时使用虚拟滚动（待实现）
- **防抖搜索**：搜索输入使用防抖，减少渲染次数
- **增量更新**：状态更新只重新渲染变化的卡片
- **CSS 动画**：使用 GPU 加速的 CSS 动画

## 开发调试

### 开启开发者工具

设置环境变量：

```bash
NODE_ENV=development npm start
```

### 查看日志

主窗口的日志会输出到控制台：

```
[Preload] Main window API exposed
[IPC] Main window handlers registered
```

## 已知问题

1. **大量账号性能**：超过 100 个账号时可能出现性能问题（计划实现虚拟滚动）
2. **通知系统**：当前通知较简单，计划实现更丰富的通知 UI

## 未来改进

- [ ] 实现虚拟滚动支持大量账号
- [ ] 添加账号分组功能
- [ ] 实现拖拽排序
- [ ] 添加批量操作功能
- [ ] 实现更丰富的通知系统
- [ ] 添加账号导入/导出功能
- [ ] 支持自定义主题颜色

## 相关文档

- [设计文档](../../.kiro/specs/multi-instance-architecture/design.md)
- [需求文档](../../.kiro/specs/multi-instance-architecture/requirements.md)
- [任务列表](../../.kiro/specs/multi-instance-architecture/tasks.md)
