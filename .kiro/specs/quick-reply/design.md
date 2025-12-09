# 快捷回复功能设计文档

## 概述

快捷回复功能是 WhatsApp 桌面客户端的核心功能模块，旨在通过预设的回复模板提升客服人员的工作效率。该功能包含两个主要界面：操作面板（用于快速使用）和管理界面（用于预先设置），支持多种媒体类型、翻译集成、分组管理和账号级配置隔离。

### 核心目标

1. **提升回复效率**：通过预设模板减少重复输入，快速响应客户
2. **多媒体支持**：支持文本、图片、音频、视频、图文混合、名片等多种内容类型
3. **翻译集成**：与现有翻译系统深度集成，支持原文和翻译后发送
4. **灵活管理**：提供分组、搜索、批量操作等管理功能
5. **数据隔离**：每个账号拥有独立的模板库，互不干扰

### 用户场景

- 客服人员在聊天过程中需要快速发送常用回复（如问候语、常见问题解答）
- 客服人员需要发送包含图片、视频的产品介绍
- 客服人员需要将中文回复翻译成客户的语言后发送
- 客服主管需要为团队创建和维护标准化的回复模板库
- 使用多个 WhatsApp 账号的客服人员需要为不同账号定制不同的模板

## 架构

### 目录结构

```
src/
├── quick-reply/                          # 快捷回复功能根目录
│   ├── index.js                          # 模块入口，导出QuickReplyController
│   ├── controllers/                      # 控制器层
│   │   └── QuickReplyController.js       # 主控制器
│   ├── managers/                         # 管理器层
│   │   ├── TemplateManager.js            # 模板管理器
│   │   ├── GroupManager.js               # 分组管理器
│   │   └── SendManager.js                # 发送管理器
│   ├── storage/                          # 存储层
│   │   ├── TemplateStorage.js            # 模板存储
│   │   ├── GroupStorage.js               # 分组存储
│   │   └── ConfigStorage.js              # 配置存储
│   ├── ui/                               # UI组件层
│   │   ├── operation-panel/              # 操作面板
│   │   │   ├── OperationPanel.jsx        # 操作面板主组件
│   │   │   ├── Toolbar.jsx               # 工具栏组件
│   │   │   ├── SendModeSelector.jsx      # 发送模式选择器
│   │   │   ├── SearchBox.jsx             # 搜索框组件
│   │   │   ├── GroupList.jsx             # 分组列表组件
│   │   │   ├── GroupItem.jsx             # 分组项组件
│   │   │   ├── TemplateList.jsx          # 模板列表组件
│   │   │   ├── TemplateItem.jsx          # 模板项组件
│   │   │   ├── TemplatePreview.jsx       # 模板预览组件
│   │   │   └── MediaPlayer.jsx           # 媒体播放器组件
│   │   ├── management-interface/         # 管理界面
│   │   │   ├── ManagementInterface.jsx   # 管理界面主组件
│   │   │   ├── Header.jsx                # 顶部区域组件
│   │   │   ├── PlatformSelector.jsx      # 平台选择器组件
│   │   │   ├── GroupPanel.jsx            # 分组管理面板
│   │   │   ├── GroupListItem.jsx         # 分组列表项组件
│   │   │   ├── ContentArea.jsx           # 内容编辑区域
│   │   │   ├── TabBar.jsx                # 标签页组件
│   │   │   ├── TemplateListView.jsx      # 模板列表视图
│   │   │   ├── TemplateListItem.jsx      # 模板列表项组件
│   │   │   └── TemplateEditor.jsx        # 模板编辑器组件
│   │   └── common/                       # 通用UI组件
│   │       ├── Button.jsx                # 按钮组件
│   │       ├── Input.jsx                 # 输入框组件
│   │       ├── Modal.jsx                 # 模态框组件
│   │       ├── Dropdown.jsx              # 下拉菜单组件
│   │       └── Toast.jsx                 # 提示消息组件
│   ├── models/                           # 数据模型
│   │   ├── Template.js                   # 模板模型
│   │   ├── Group.js                      # 分组模型
│   │   └── Config.js                     # 配置模型
│   ├── utils/                            # 工具函数
│   │   ├── validation.js                 # 验证工具
│   │   ├── search.js                     # 搜索工具
│   │   ├── file.js                       # 文件处理工具
│   │   ├── logger.js                     # 日志工具
│   │   └── concurrency.js                # 并发控制工具
│   ├── errors/                           # 错误定义
│   │   ├── ValidationError.js            # 验证错误
│   │   ├── StorageError.js               # 存储错误
│   │   ├── TranslationError.js           # 翻译错误
│   │   ├── SendError.js                  # 发送错误
│   │   └── ImportError.js                # 导入错误
│   ├── constants/                        # 常量定义
│   │   ├── templateTypes.js              # 模板类型常量
│   │   ├── sendModes.js                  # 发送模式常量
│   │   └── limits.js                     # 限制常量
│   └── __tests__/                        # 测试文件
│       ├── unit/                         # 单元测试
│       │   ├── TemplateManager.test.js
│       │   ├── GroupManager.test.js
│       │   ├── SendManager.test.js
│       │   └── storage/
│       │       ├── TemplateStorage.test.js
│       │       ├── GroupStorage.test.js
│       │       └── ConfigStorage.test.js
│       ├── property/                     # 属性测试
│       │   ├── template-retrieval.property.test.js
│       │   ├── group-toggle.property.test.js
│       │   ├── search-roundtrip.property.test.js
│       │   └── ... (其他属性测试)
│       ├── integration/                  # 集成测试
│       │   ├── panel-sync.test.js
│       │   ├── translation-integration.test.js
│       │   └── whatsapp-integration.test.js
│       ├── e2e/                          # 端到端测试
│       │   ├── create-and-send.test.js
│       │   ├── import-export.test.js
│       │   └── account-switch.test.js
│       └── helpers/                      # 测试辅助工具
│           ├── arbitraries.js            # 数据生成器
│           ├── mocks.js                  # Mock对象
│           └── fixtures.js               # 测试数据
```

### 模块化设计说明

#### 1. 分层架构

系统采用清晰的分层架构，每层职责明确：

- **UI层** (`ui/`)：负责用户界面展示和交互
  - 操作面板：聊天界面右侧的快捷回复面板
  - 管理界面：独立窗口的管理界面
  - 通用组件：可复用的UI组件

- **控制器层** (`controllers/`)：协调各个模块，处理业务逻辑
  - QuickReplyController：主控制器，协调所有子模块

- **管理器层** (`managers/`)：负责具体的业务逻辑
  - TemplateManager：模板的CRUD和业务逻辑
  - GroupManager：分组的CRUD和层级管理
  - SendManager：发送逻辑和翻译集成

- **存储层** (`storage/`)：负责数据持久化
  - TemplateStorage：模板数据存储
  - GroupStorage：分组数据存储
  - ConfigStorage：配置数据存储

- **模型层** (`models/`)：定义数据结构和验证规则
  - Template：模板数据模型
  - Group：分组数据模型
  - Config：配置数据模型

- **工具层** (`utils/`)：提供通用工具函数
  - 验证、搜索、文件处理、日志、并发控制等

#### 2. 模块独立性

每个模块都是独立的，可以单独测试和维护：

```javascript
// 模板管理器独立使用
import TemplateManager from './managers/TemplateManager';
const templateManager = new TemplateManager(accountId);
const template = await templateManager.createTemplate(groupId, type, label, content);

// 分组管理器独立使用
import GroupManager from './managers/GroupManager';
const groupManager = new GroupManager(accountId);
const group = await groupManager.createGroup(name, parentId);

// 发送管理器独立使用
import SendManager from './managers/SendManager';
const sendManager = new SendManager(translationService, whatsappWebInterface);
await sendManager.sendOriginal(template);
```

#### 3. 依赖注入

使用依赖注入模式，降低模块间耦合：

```javascript
// QuickReplyController 通过构造函数注入依赖
class QuickReplyController {
  constructor(accountId, translationService, whatsappWebInterface) {
    this.accountId = accountId;
    this.translationService = translationService;
    this.whatsappWebInterface = whatsappWebInterface;
    
    // 创建子模块实例
    this.templateManager = new TemplateManager(accountId);
    this.groupManager = new GroupManager(accountId);
    this.sendManager = new SendManager(translationService, whatsappWebInterface);
  }
}

// 使用时注入依赖
const controller = new QuickReplyController(
  currentAccountId,
  translationService,
  whatsappWebInterface
);
```

#### 4. 接口抽象

定义清晰的接口，便于扩展和替换实现：

```javascript
// 存储接口抽象
class IStorage {
  async save(data) { throw new Error('Not implemented'); }
  async get(id) { throw new Error('Not implemented'); }
  async getAll() { throw new Error('Not implemented'); }
  async update(id, updates) { throw new Error('Not implemented'); }
  async delete(id) { throw new Error('Not implemented'); }
}

// 具体实现
class TemplateStorage extends IStorage {
  async save(template) { /* 实现 */ }
  async get(templateId) { /* 实现 */ }
  // ... 其他方法
}

// 可以轻松替换为其他存储实现（如数据库）
class DatabaseTemplateStorage extends IStorage {
  async save(template) { /* 数据库实现 */ }
  async get(templateId) { /* 数据库实现 */ }
  // ... 其他方法
}
```

#### 5. 事件驱动

使用事件机制实现模块间通信，降低耦合：

```javascript
import EventEmitter from 'events';

class QuickReplyController extends EventEmitter {
  async createTemplate(groupId, type, label, content) {
    const template = await this.templateManager.createTemplate(groupId, type, label, content);
    
    // 发出事件
    this.emit('template:created', template);
    
    return template;
  }
}

// 其他模块监听事件
controller.on('template:created', (template) => {
  // 更新UI
  operationPanel.addTemplate(template);
  managementInterface.addTemplate(template);
});
```

### 系统架构图

```
┌─────────────────────────────────────────────────────────────┐
│                     WhatsApp 桌面客户端                        │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────────┐         ┌──────────────────┐          │
│  │   操作面板 UI     │         │   管理界面 UI     │          │
│  │  (Operation      │         │  (Management     │          │
│  │   Panel)         │         │   Interface)     │          │
│  └────────┬─────────┘         └────────┬─────────┘          │
│           │                            │                     │
│           └────────────┬───────────────┘                     │
│                        │                                     │
│           ┌────────────▼─────────────┐                       │
│           │  快捷回复控制器           │                       │
│           │  (QuickReplyController)  │                       │
│           └────────────┬─────────────┘                       │
│                        │                                     │
│      ┌─────────────────┼─────────────────┐                  │
│      │                 │                 │                  │
│  ┌───▼────┐      ┌────▼─────┐     ┌────▼─────┐             │
│  │ 模板    │      │ 分组     │     │ 发送     │             │
│  │ 管理器  │      │ 管理器   │     │ 管理器   │             │
│  └───┬────┘      └────┬─────┘     └────┬─────┘             │
│      │                │                 │                  │
│      └────────────────┼─────────────────┘                  │
│                       │                                     │
│           ┌───────────▼──────────────┐                      │
│           │  数据存储层               │                      │
│           │  (Storage Layer)         │                      │
│           └───────────┬──────────────┘                      │
│                       │                                     │
│      ┌────────────────┼────────────────┐                   │
│      │                │                │                   │
│  ┌───▼────┐      ┌───▼────┐      ┌───▼────┐               │
│  │ 模板   │      │ 分组   │      │ 配置   │               │
│  │ 存储   │      │ 存储   │      │ 存储   │               │
│  └────────┘      └────────┘      └────────┘               │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│                     外部依赖                                 │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐ │
│  │ 翻译服务     │    │ WhatsApp Web │    │ 文件系统     │ │
│  └──────────────┘    └──────────────┘    └──────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### 模块职责

1. **操作面板 UI (Operation Panel)**
   - 显示在聊天界面右侧
   - 提供快速选择和发送模板的界面
   - 支持搜索、过滤、预览功能

2. **管理界面 UI (Management Interface)**
   - 独立窗口，用于预先设置和管理模板
   - 提供分组管理、模板编辑、批量操作功能
   - 支持导入导出模板

3. **快捷回复控制器 (QuickReplyController)**
   - 协调操作面板和管理界面的交互
   - 处理用户操作事件
   - 管理应用状态

4. **模板管理器 (TemplateManager)**
   - 负责模板的 CRUD 操作
   - 管理模板的序号、排序
   - 处理模板的验证和默认值

5. **分组管理器 (GroupManager)**
   - 负责分组的 CRUD 操作
   - 管理分组的层级结构
   - 处理分组的展开/折叠状态

6. **发送管理器 (SendManager)**
   - 处理模板的发送逻辑
   - 集成翻译服务
   - 处理不同媒体类型的发送

7. **数据存储层 (Storage Layer)**
   - 提供统一的数据访问接口
   - 管理账号级数据隔离
   - 处理数据持久化


## 组件和接口

### 核心组件

#### 1. QuickReplyController

快捷回复的主控制器，负责协调各个子模块。

```javascript
class QuickReplyController {
  constructor(accountId, translationService, whatsappWebInterface) {
    this.accountId = accountId;
    this.translationService = translationService;
    this.whatsappWebInterface = whatsappWebInterface;
    this.templateManager = new TemplateManager(accountId);
    this.groupManager = new GroupManager(accountId);
    this.sendManager = new SendManager(translationService, whatsappWebInterface);
    this.operationPanel = null;
    this.managementInterface = null;
  }

  // 打开操作面板
  openOperationPanel() { }

  // 关闭操作面板
  closeOperationPanel() { }

  // 打开管理界面
  openManagementInterface() { }

  // 关闭管理界面
  closeManagementInterface() { }

  // 发送模板
  sendTemplate(templateId, mode) { }

  // 插入模板到输入框
  insertTemplate(templateId, mode) { }

  // 搜索模板
  searchTemplates(keyword) { }
}
```

#### 2. TemplateManager

模板管理器，负责模板的 CRUD 操作。

```javascript
class TemplateManager {
  constructor(accountId) {
    this.accountId = accountId;
    this.storage = new TemplateStorage(accountId);
  }

  // 创建模板
  createTemplate(groupId, type, label, content) { }

  // 获取模板
  getTemplate(templateId) { }

  // 更新模板
  updateTemplate(templateId, updates) { }

  // 删除模板
  deleteTemplate(templateId) { }

  // 获取分组下的所有模板
  getTemplatesByGroup(groupId) { }

  // 获取指定类型的模板
  getTemplatesByType(groupId, type) { }

  // 移动模板到其他分组
  moveTemplate(templateId, targetGroupId) { }

  // 调整模板顺序
  reorderTemplate(templateId, newIndex) { }

  // 批量删除模板
  batchDeleteTemplates(templateIds) { }

  // 批量移动模板
  batchMoveTemplates(templateIds, targetGroupId) { }

  // 验证模板内容
  validateTemplate(type, content) { }

  // 生成默认标签
  generateDefaultLabel(type) { }

  // 记录模板使用
  recordUsage(templateId) { }

  // 获取模板使用统计
  getUsageStats(templateId) { }
}
```

#### 3. GroupManager

分组管理器，负责分组的 CRUD 操作和层级管理。

```javascript
class GroupManager {
  constructor(accountId) {
    this.accountId = accountId;
    this.storage = new GroupStorage(accountId);
  }

  // 创建分组
  createGroup(name, parentId = null) { }

  // 获取分组
  getGroup(groupId) { }

  // 更新分组
  updateGroup(groupId, updates) { }

  // 删除分组
  deleteGroup(groupId) { }

  // 获取所有分组
  getAllGroups() { }

  // 获取子分组
  getChildGroups(parentId) { }

  // 移动分组
  moveGroup(groupId, newParentId) { }

  // 调整分组顺序
  reorderGroup(groupId, newIndex) { }

  // 切换展开/折叠状态
  toggleExpanded(groupId) { }

  // 获取分组的展开状态
  getExpandedState(groupId) { }

  // 批量删除分组
  batchDeleteGroups(groupIds) { }
}
```

#### 4. SendManager

发送管理器，负责处理模板的发送逻辑。

```javascript
class SendManager {
  constructor(translationService, whatsappWebInterface) {
    this.translationService = translationService;
    this.whatsappWebInterface = whatsappWebInterface;
  }

  // 发送模板（原文）
  sendOriginal(template) { }

  // 发送模板（翻译后）
  sendTranslated(template, targetLanguage, style) { }

  // 插入模板到输入框（原文）
  insertOriginal(template) { }

  // 插入模板到输入框（翻译后）
  insertTranslated(template, targetLanguage, style) { }

  // 发送文本
  sendText(text) { }

  // 发送图片
  sendImage(imagePath) { }

  // 发送音频
  sendAudio(audioPath) { }

  // 发送视频
  sendVideo(videoPath) { }

  // 发送图文
  sendImageWithText(imagePath, text) { }

  // 发送名片
  sendContact(contactInfo) { }

  // 翻译文本
  translateText(text, targetLanguage, style) { }
}
```


#### 5. OperationPanel

操作面板 UI 组件，显示在聊天界面右侧。

```javascript
class OperationPanel {
  constructor(controller) {
    this.controller = controller;
    this.sendMode = 'original'; // 'original' or 'translated'
    this.searchKeyword = '';
    this.expandedGroups = new Set();
  }

  // 渲染面板
  render() { }

  // 渲染工具栏
  renderToolbar() { }

  // 渲染发送模式选择器
  renderSendModeSelector() { }

  // 渲染搜索框
  renderSearchBox() { }

  // 渲染分组和模板列表
  renderGroupsAndTemplates() { }

  // 渲染单个分组
  renderGroup(group) { }

  // 渲染单个模板
  renderTemplate(template) { }

  // 渲染模板预览
  renderTemplatePreview(template) { }

  // 渲染媒体播放器
  renderMediaPlayer(template) { }

  // 处理发送按钮点击
  handleSendClick(templateId) { }

  // 处理插入按钮点击
  handleInsertClick(templateId) { }

  // 处理搜索输入
  handleSearchInput(keyword) { }

  // 处理分组展开/折叠
  handleGroupToggle(groupId) { }

  // 处理刷新按钮点击
  handleRefreshClick() { }

  // 处理编辑管理按钮点击
  handleManagementClick() { }
}
```

#### 6. ManagementInterface

管理界面 UI 组件，独立窗口。

```javascript
class ManagementInterface {
  constructor(controller) {
    this.controller = controller;
    this.selectedGroupId = null;
    this.selectedTemplateIds = new Set();
    this.selectedGroupIds = new Set();
    this.activeTab = 'all'; // 'all', 'text', 'image', 'video', 'audio', 'contact'
  }

  // 渲染界面
  render() { }

  // 渲染顶部区域
  renderHeader() { }

  // 渲染平台选择区域
  renderPlatformSelector() { }

  // 渲染分组管理面板
  renderGroupPanel() { }

  // 渲染分组列表
  renderGroupList() { }

  // 渲染单个分组
  renderGroupItem(group) { }

  // 渲染内容编辑区域
  renderContentArea() { }

  // 渲染标签页
  renderTabs() { }

  // 渲染模板列表
  renderTemplateList() { }

  // 渲染单个模板
  renderTemplateItem(template) { }

  // 渲染模板编辑对话框
  renderTemplateEditor(template) { }

  // 处理新建分组
  handleCreateGroup() { }

  // 处理编辑分组
  handleEditGroup(groupId) { }

  // 处理删除分组
  handleDeleteGroup(groupId) { }

  // 处理新建模板
  handleCreateTemplate(groupId, type) { }

  // 处理编辑模板
  handleEditTemplate(templateId) { }

  // 处理删除模板
  handleDeleteTemplate(templateId) { }

  // 处理批量操作
  handleBatchOperation(operation) { }

  // 处理导入
  handleImport() { }

  // 处理导出
  handleExport() { }

  // 处理标签页切换
  handleTabChange(tab) { }

  // 处理分组拖拽
  handleGroupDrag(groupId, targetIndex) { }

  // 处理模板拖拽
  handleTemplateDrag(templateId, targetGroupId, targetIndex) { }
}
```

### 数据存储接口

#### 1. TemplateStorage

模板数据存储接口。

```javascript
class TemplateStorage {
  constructor(accountId) {
    this.accountId = accountId;
    this.storageKey = `quick_reply_templates_${accountId}`;
  }

  // 保存模板
  save(template) { }

  // 获取模板
  get(templateId) { }

  // 获取所有模板
  getAll() { }

  // 获取分组下的模板
  getByGroup(groupId) { }

  // 更新模板
  update(templateId, updates) { }

  // 删除模板
  delete(templateId) { }

  // 批量删除模板
  batchDelete(templateIds) { }

  // 搜索模板
  search(keyword) { }
}
```

#### 2. GroupStorage

分组数据存储接口。

```javascript
class GroupStorage {
  constructor(accountId) {
    this.accountId = accountId;
    this.storageKey = `quick_reply_groups_${accountId}`;
  }

  // 保存分组
  save(group) { }

  // 获取分组
  get(groupId) { }

  // 获取所有分组
  getAll() { }

  // 获取子分组
  getChildren(parentId) { }

  // 更新分组
  update(groupId, updates) { }

  // 删除分组
  delete(groupId) { }

  // 批量删除分组
  batchDelete(groupIds) { }
}
```

#### 3. ConfigStorage

配置数据存储接口。

```javascript
class ConfigStorage {
  constructor(accountId) {
    this.accountId = accountId;
    this.storageKey = `quick_reply_config_${accountId}`;
  }

  // 保存配置
  save(config) { }

  // 获取配置
  get() { }

  // 更新配置
  update(updates) { }

  // 重置配置
  reset() { }
}
```


## 数据模型

### 模板数据模型 (Template)

```javascript
{
  id: string,                    // 模板唯一标识符
  groupId: string,               // 所属分组ID
  type: string,                  // 模板类型：'text', 'image', 'audio', 'video', 'mixed', 'contact'
  label: string,                 // 模板标签（用户自定义备注）
  content: {                     // 模板内容
    text?: string,               // 文本内容
    mediaPath?: string,          // 媒体文件路径
    contactInfo?: {              // 名片信息
      name: string,
      phone: string,
      email?: string
    }
  },
  order: number,                 // 在分组内的排序序号
  createdAt: timestamp,          // 创建时间
  updatedAt: timestamp,          // 更新时间
  usageCount: number,            // 使用次数
  lastUsedAt: timestamp          // 最后使用时间
}
```

### 分组数据模型 (Group)

```javascript
{
  id: string,                    // 分组唯一标识符
  name: string,                  // 分组名称
  parentId: string | null,       // 父分组ID，null表示顶级分组
  order: number,                 // 在同级分组中的排序序号
  expanded: boolean,             // 展开/折叠状态
  createdAt: timestamp,          // 创建时间
  updatedAt: timestamp           // 更新时间
}
```

### 配置数据模型 (Config)

```javascript
{
  accountId: string,             // 账号ID
  sendMode: string,              // 默认发送模式：'original' or 'translated'
  expandedGroups: string[],      // 展开的分组ID列表
  lastSelectedGroupId: string,   // 最后选择的分组ID
  createdAt: timestamp,          // 创建时间
  updatedAt: timestamp           // 更新时间
}
```

### 导入导出数据格式

```javascript
{
  version: string,               // 数据格式版本
  exportedAt: timestamp,         // 导出时间
  accountId: string,             // 账号ID
  groups: Group[],               // 分组列表
  templates: Template[]          // 模板列表
}
```


## 正确性属性

*一个属性是一个特征或行为，应该在系统的所有有效执行中保持为真——本质上是关于系统应该做什么的正式陈述。属性作为人类可读规范和机器可验证正确性保证之间的桥梁。*

### 属性 1：模板创建后可检索

*对于任何*有效的模板数据（类型、标签、内容），当创建模板后，通过模板ID应该能够检索到该模板，且检索到的模板数据应该与创建时的数据一致。

**验证需求：3.11, 3.13**

### 属性 2：分组展开折叠往返一致性

*对于任何*分组，当执行展开操作后再执行折叠操作，分组的状态应该回到初始状态（折叠状态）。

**验证需求：2.6**

### 属性 3：搜索清空往返一致性

*对于任何*模板列表状态，当输入搜索关键词后再清空搜索框，显示的模板列表应该与搜索前的列表一致。

**验证需求：6.5**

### 属性 4：模板删除后不可检索

*对于任何*已存在的模板，当删除该模板后，通过模板ID应该无法检索到该模板。

**验证需求：5.4**

### 属性 5：分组删除级联删除模板

*对于任何*包含模板的分组，当删除该分组后，该分组下的所有模板也应该被删除。

**验证需求：2.5**

### 属性 6：搜索结果包含匹配项

*对于任何*搜索关键词，搜索结果中的所有模板的标签或内容都应该包含该关键词。

**验证需求：6.2**

### 属性 7：分组搜索包含子项

*对于任何*匹配分组名称的搜索关键词，搜索结果应该包含该分组下的所有模板。

**验证需求：6.3**

### 属性 8：模板序号唯一性

*对于任何*分组，该分组下的所有模板的序号应该是唯一的，且序号范围应该是从1到模板总数。

**验证需求：26.3, 26.4**

### 属性 9：模板移动后分组变更

*对于任何*模板，当将模板从分组A移动到分组B后，该模板的groupId应该变更为分组B的ID，且在分组A中不再存在该模板。

**验证需求：13.4**

### 属性 10：批量删除一致性

*对于任何*模板ID集合，批量删除操作后，所有指定ID的模板都应该被删除，且只有这些模板被删除。

**验证需求：13.6**

### 属性 11：导入导出往返一致性

*对于任何*模板库状态，当执行导出操作后再执行导入操作，导入后的模板库应该与导出前的模板库一致（除了ID和时间戳可能不同）。

**验证需求：10.5**

### 属性 12：账号数据隔离

*对于任何*两个不同的账号A和B，在账号A下创建或修改的模板不应该出现在账号B的模板库中。

**验证需求：11.2**

### 属性 13：模板使用计数递增

*对于任何*模板，每次使用该模板发送消息后，该模板的使用次数应该增加1。

**验证需求：15.1**

### 属性 14：默认标签生成规则

*对于任何*未指定标签的新模板，系统应该根据模板类型生成对应的默认标签（文本→"新模板"，图片→"图片模板"等）。

**验证需求：29.1-29.6**

### 属性 15：标签页过滤正确性

*对于任何*内容类型标签页，该标签页显示的所有模板的类型都应该与标签页对应的类型一致。

**验证需求：17.2-17.6**

### 属性 16：分组层级结构一致性

*对于任何*子分组，该子分组的parentId应该指向其父分组的ID，且父分组的子分组列表中应该包含该子分组。

**验证需求：19.2**

### 属性 17：模板标签长度限制

*对于任何*模板标签输入，系统应该拒绝超过50个字符的标签输入。

**验证需求：3.8**

### 属性 18：媒体文件大小验证

*对于任何*上传的媒体文件，如果文件大小超过WhatsApp限制，系统应该拒绝保存并显示错误提示。

**验证需求：3.12**

### 属性 19：发送模式影响发送行为

*对于任何*模板，当发送模式为"原文发送"时，发送的内容应该与模板的原始内容一致；当发送模式为"翻译后发送"时，发送的内容应该是翻译后的内容。

**验证需求：7.1, 8.1**

### 属性 20：空搜索结果提示

*对于任何*不匹配任何模板或分组的搜索关键词，系统应该显示"未找到匹配的快捷回复"提示。

**验证需求：6.4**


## 错误处理

### 错误类型

#### 1. 验证错误 (ValidationError)

当用户输入的数据不符合要求时抛出。

**场景：**
- 模板标签超过50个字符
- 媒体文件超过大小限制
- 必填字段为空

**处理策略：**
- 在UI层进行前置验证，阻止无效数据提交
- 显示友好的错误提示信息
- 保留用户已输入的有效数据

#### 2. 存储错误 (StorageError)

当数据存储操作失败时抛出。

**场景：**
- 磁盘空间不足
- 文件系统权限不足
- 数据库连接失败

**处理策略：**
- 捕获错误并显示用户友好的提示
- 提供重试机制
- 记录错误日志供调试

#### 3. 翻译错误 (TranslationError)

当翻译服务调用失败时抛出。

**场景：**
- 翻译服务不可用
- API密钥无效
- 网络连接失败

**处理策略：**
- 提示用户翻译失败
- 提供"以原文发送"的备选方案
- 记录错误日志

#### 4. 发送错误 (SendError)

当消息发送失败时抛出。

**场景：**
- WhatsApp Web连接断开
- 消息格式不支持
- 网络连接失败

**处理策略：**
- 显示发送失败提示
- 提供重试按钮
- 保留消息内容供用户重新发送

#### 5. 导入错误 (ImportError)

当导入模板文件失败时抛出。

**场景：**
- 文件格式无效
- 文件损坏
- 数据版本不兼容

**处理策略：**
- 显示详细的错误信息
- 提示用户检查文件格式
- 不影响现有数据

### 错误处理流程

```javascript
class ErrorHandler {
  // 处理验证错误
  handleValidationError(error) {
    // 显示错误提示
    this.showErrorMessage(error.message);
    // 高亮错误字段
    this.highlightErrorField(error.field);
  }

  // 处理存储错误
  handleStorageError(error) {
    // 显示错误提示
    this.showErrorMessage('数据保存失败，请重试');
    // 提供重试按钮
    this.showRetryButton();
    // 记录错误日志
    this.logError(error);
  }

  // 处理翻译错误
  handleTranslationError(error) {
    // 显示错误提示
    this.showErrorMessage('翻译失败，是否以原文发送？');
    // 提供备选方案
    this.showAlternativeOptions(['以原文发送', '重试翻译']);
    // 记录错误日志
    this.logError(error);
  }

  // 处理发送错误
  handleSendError(error) {
    // 显示错误提示
    this.showErrorMessage('消息发送失败');
    // 提供重试按钮
    this.showRetryButton();
    // 保留消息内容
    this.preserveMessageContent();
    // 记录错误日志
    this.logError(error);
  }

  // 处理导入错误
  handleImportError(error) {
    // 显示详细错误信息
    this.showErrorMessage(`导入失败：${error.message}`);
    // 提示检查文件格式
    this.showFormatHint();
    // 记录错误日志
    this.logError(error);
  }

  // 显示错误消息
  showErrorMessage(message) { }

  // 显示重试按钮
  showRetryButton() { }

  // 显示备选方案
  showAlternativeOptions(options) { }

  // 记录错误日志
  logError(error) { }
}
```

### 错误恢复机制

1. **自动重试**：对于网络相关的错误，自动重试最多3次
2. **数据备份**：在执行删除等危险操作前，自动备份数据
3. **状态回滚**：操作失败时，回滚到操作前的状态
4. **离线缓存**：网络断开时，将操作缓存到本地，待网络恢复后自动执行


## 测试策略

### 单元测试

单元测试用于验证各个组件和函数的独立功能。

#### 测试范围

1. **TemplateManager**
   - 模板的CRUD操作
   - 模板验证逻辑
   - 默认标签生成
   - 使用统计记录

2. **GroupManager**
   - 分组的CRUD操作
   - 层级结构管理
   - 展开/折叠状态管理

3. **SendManager**
   - 不同媒体类型的发送逻辑
   - 翻译集成
   - 错误处理

4. **Storage层**
   - 数据的持久化和检索
   - 账号级数据隔离
   - 搜索功能

#### 测试工具

- **测试框架**：Jest
- **断言库**：Jest内置断言
- **模拟库**：Jest Mock

### 属性测试 (Property-Based Testing)

属性测试用于验证系统的通用正确性属性，通过生成大量随机输入来测试。

#### 测试框架

使用 **fast-check** 作为JavaScript的属性测试库。

#### 配置

每个属性测试应该运行至少 **100次迭代**，以确保充分覆盖输入空间。

```javascript
import fc from 'fast-check';

// 配置示例
fc.assert(
  fc.property(/* arbitraries */, /* predicate */),
  { numRuns: 100 }
);
```

#### 测试属性

每个正确性属性都应该有对应的属性测试。测试应该使用以下格式的注释标记：

```javascript
/**
 * Feature: quick-reply, Property 1: 模板创建后可检索
 * 验证需求：3.11, 3.13
 */
test('property: template retrieval after creation', () => {
  fc.assert(
    fc.property(
      templateArbitrary(),
      (templateData) => {
        // 测试逻辑
      }
    ),
    { numRuns: 100 }
  );
});
```

#### 数据生成器 (Arbitraries)

为属性测试创建自定义数据生成器：

```javascript
// 模板数据生成器
function templateArbitrary() {
  return fc.record({
    type: fc.constantFrom('text', 'image', 'audio', 'video', 'mixed', 'contact'),
    label: fc.string({ maxLength: 50 }),
    content: fc.oneof(
      fc.record({ text: fc.string() }),
      fc.record({ mediaPath: fc.string() }),
      fc.record({
        contactInfo: fc.record({
          name: fc.string(),
          phone: fc.string(),
          email: fc.option(fc.emailAddress())
        })
      })
    )
  });
}

// 分组数据生成器
function groupArbitrary() {
  return fc.record({
    name: fc.string({ minLength: 1, maxLength: 50 }),
    parentId: fc.option(fc.uuid())
  });
}

// 搜索关键词生成器
function keywordArbitrary() {
  return fc.string({ minLength: 1, maxLength: 20 });
}
```

### 集成测试

集成测试用于验证多个组件之间的交互。

#### 测试场景

1. **操作面板与管理界面同步**
   - 在管理界面创建模板，验证操作面板是否更新
   - 在操作面板使用模板，验证使用统计是否更新

2. **翻译服务集成**
   - 验证翻译后发送功能
   - 验证翻译失败时的降级处理

3. **WhatsApp Web集成**
   - 验证不同媒体类型的发送
   - 验证输入框插入功能

4. **数据持久化**
   - 验证数据保存和加载
   - 验证账号切换时的数据隔离

### 端到端测试

端到端测试用于验证完整的用户工作流。

#### 测试场景

1. **创建和使用模板的完整流程**
   - 打开管理界面
   - 创建分组和模板
   - 在操作面板中使用模板发送消息

2. **导入导出流程**
   - 导出模板库
   - 清空模板库
   - 导入之前导出的文件
   - 验证数据一致性

3. **多账号切换流程**
   - 在账号A创建模板
   - 切换到账号B
   - 验证账号B看不到账号A的模板
   - 切换回账号A
   - 验证账号A的模板仍然存在

### 测试覆盖率目标

- **单元测试覆盖率**：≥ 80%
- **属性测试覆盖率**：所有正确性属性都有对应的测试
- **集成测试覆盖率**：所有主要交互场景
- **端到端测试覆盖率**：所有关键用户流程


## 技术决策

### 1. 数据存储方案

**决策**：使用 Electron 的本地文件系统存储，结合 JSON 格式。

**理由**：
- 简单易实现，无需额外的数据库依赖
- 数据量不大（预计每个账号最多几百个模板）
- 易于导入导出和备份
- 支持账号级数据隔离

**实现**：
- 每个账号的数据存储在独立的JSON文件中
- 文件路径：`{userData}/quick-reply/{accountId}/templates.json`
- 使用 `fs.promises` 进行异步文件操作
- 使用文件锁防止并发写入冲突

### 2. UI框架选择

**决策**：使用 React 构建UI组件。

**理由**：
- 项目已经使用 React
- 组件化开发，易于维护
- 丰富的生态系统和社区支持
- 支持虚拟DOM，性能优秀

**实现**：
- 操作面板作为侧边栏组件嵌入主界面
- 管理界面作为独立的 BrowserWindow
- 使用 React Hooks 管理状态
- 使用 Context API 共享全局状态

### 3. 状态管理方案

**决策**：使用 React Context + useReducer。

**理由**：
- 状态管理需求不复杂，无需引入 Redux
- Context API 足够满足跨组件状态共享
- useReducer 提供可预测的状态更新

**实现**：
```javascript
const QuickReplyContext = React.createContext();

function quickReplyReducer(state, action) {
  switch (action.type) {
    case 'SET_TEMPLATES':
      return { ...state, templates: action.payload };
    case 'SET_GROUPS':
      return { ...state, groups: action.payload };
    case 'SET_SEND_MODE':
      return { ...state, sendMode: action.payload };
    // ... 其他 actions
    default:
      return state;
  }
}

function QuickReplyProvider({ children }) {
  const [state, dispatch] = useReducer(quickReplyReducer, initialState);
  return (
    <QuickReplyContext.Provider value={{ state, dispatch }}>
      {children}
    </QuickReplyContext.Provider>
  );
}
```

### 4. 媒体文件处理

**决策**：媒体文件存储在本地文件系统，模板中只存储文件路径。

**理由**：
- 避免JSON文件过大
- 便于文件管理和清理
- 支持大文件

**实现**：
- 媒体文件存储路径：`{userData}/quick-reply/{accountId}/media/{templateId}.{ext}`
- 上传时自动复制文件到存储目录
- 删除模板时同时删除对应的媒体文件
- 导出时将媒体文件转换为 Base64 编码

### 5. 翻译服务集成

**决策**：复用现有的翻译服务接口。

**理由**：
- 避免重复实现
- 保持翻译配置的一致性
- 减少维护成本

**实现**：
- 从翻译设置中读取当前配置的翻译引擎
- 调用 `TranslationService.translate()` 方法
- 处理翻译失败的降级逻辑

### 6. 搜索实现

**决策**：使用简单的字符串匹配，支持模糊搜索。

**理由**：
- 数据量不大，无需复杂的搜索算法
- 实时搜索，需要快速响应
- 用户习惯简单的关键词搜索

**实现**：
```javascript
function searchTemplates(keyword, templates, groups) {
  const lowerKeyword = keyword.toLowerCase();
  const results = [];

  // 搜索模板内容
  templates.forEach(template => {
    if (
      template.label.toLowerCase().includes(lowerKeyword) ||
      template.content.text?.toLowerCase().includes(lowerKeyword)
    ) {
      results.push(template);
    }
  });

  // 搜索分组名称
  groups.forEach(group => {
    if (group.name.toLowerCase().includes(lowerKeyword)) {
      const groupTemplates = templates.filter(t => t.groupId === group.id);
      results.push(...groupTemplates);
    }
  });

  // 去重
  return Array.from(new Set(results));
}
```

### 7. 拖拽实现

**决策**：使用 HTML5 Drag and Drop API。

**理由**：
- 原生支持，无需额外库
- 性能好
- 浏览器兼容性好

**实现**：
```javascript
// 拖拽开始
function handleDragStart(e, item) {
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', JSON.stringify(item));
}

// 拖拽结束
function handleDrop(e, targetItem) {
  e.preventDefault();
  const draggedItem = JSON.parse(e.dataTransfer.getData('text/plain'));
  // 执行移动逻辑
  moveItem(draggedItem, targetItem);
}
```

### 8. 性能优化

**策略**：
1. **虚拟滚动**：模板列表使用虚拟滚动，只渲染可见区域的模板
2. **懒加载**：媒体文件按需加载，不在列表中预加载
3. **防抖**：搜索输入使用防抖，减少不必要的搜索操作
4. **缓存**：缓存常用的查询结果，减少重复计算
5. **批量更新**：批量操作时使用事务，减少文件IO次数

**实现示例**：
```javascript
// 搜索防抖
const debouncedSearch = useMemo(
  () => debounce((keyword) => {
    const results = searchTemplates(keyword, templates, groups);
    setSearchResults(results);
  }, 300),
  [templates, groups]
);

// 虚拟滚动
import { FixedSizeList } from 'react-window';

function TemplateList({ templates }) {
  return (
    <FixedSizeList
      height={600}
      itemCount={templates.length}
      itemSize={80}
      width="100%"
    >
      {({ index, style }) => (
        <div style={style}>
          <TemplateItem template={templates[index]} />
        </div>
      )}
    </FixedSizeList>
  );
}
```

### 9. 安全性考虑

**措施**：
1. **输入验证**：所有用户输入都进行验证和清理
2. **文件类型检查**：上传的媒体文件进行类型和大小检查
3. **路径安全**：防止路径遍历攻击
4. **XSS防护**：用户输入的文本进行HTML转义
5. **数据加密**：敏感数据（如名片信息）进行加密存储

**实现示例**：
```javascript
// 输入验证
function validateTemplateLabel(label) {
  if (!label || label.trim().length === 0) {
    throw new ValidationError('模板标签不能为空');
  }
  if (label.length > 50) {
    throw new ValidationError('模板标签不能超过50个字符');
  }
  return label.trim();
}

// 文件类型检查
function validateMediaFile(file, type) {
  const allowedTypes = {
    image: ['image/jpeg', 'image/png', 'image/gif'],
    audio: ['audio/mpeg', 'audio/ogg', 'audio/wav'],
    video: ['video/mp4', 'video/webm']
  };

  if (!allowedTypes[type].includes(file.type)) {
    throw new ValidationError(`不支持的${type}文件类型`);
  }

  const maxSizes = {
    image: 5 * 1024 * 1024,  // 5MB
    audio: 16 * 1024 * 1024, // 16MB
    video: 64 * 1024 * 1024  // 64MB
  };

  if (file.size > maxSizes[type]) {
    throw new ValidationError(`${type}文件大小超过限制`);
  }
}
```


## 实现注意事项

### 1. 账号切换处理

当用户切换 WhatsApp 账号时，需要：
1. 保存当前账号的状态（展开的分组、选中的模板等）
2. 卸载当前账号的数据
3. 加载新账号的数据
4. 恢复新账号的状态
5. 刷新UI

```javascript
async function switchAccount(newAccountId) {
  // 保存当前状态
  await saveCurrentState();
  
  // 卸载当前数据
  unloadCurrentData();
  
  // 加载新账号数据
  const newData = await loadAccountData(newAccountId);
  
  // 更新状态
  dispatch({ type: 'SET_ACCOUNT', payload: newAccountId });
  dispatch({ type: 'SET_TEMPLATES', payload: newData.templates });
  dispatch({ type: 'SET_GROUPS', payload: newData.groups });
  
  // 刷新UI
  refreshUI();
}
```

### 2. 并发控制

多个操作可能同时修改数据，需要实现并发控制：

```javascript
class ConcurrencyController {
  constructor() {
    this.locks = new Map();
  }

  async acquireLock(key) {
    while (this.locks.has(key)) {
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    this.locks.set(key, true);
  }

  releaseLock(key) {
    this.locks.delete(key);
  }

  async withLock(key, fn) {
    await this.acquireLock(key);
    try {
      return await fn();
    } finally {
      this.releaseLock(key);
    }
  }
}

// 使用示例
const concurrency = new ConcurrencyController();

async function saveTemplate(template) {
  return await concurrency.withLock('templates', async () => {
    // 保存逻辑
  });
}
```

### 3. 数据迁移

当数据格式发生变化时，需要实现数据迁移：

```javascript
const CURRENT_VERSION = '1.0.0';

async function migrateData(data) {
  if (!data.version) {
    // 从旧版本迁移
    data = migrateFromLegacy(data);
  }

  if (data.version === '0.9.0') {
    data = migrateFrom_0_9_0_to_1_0_0(data);
  }

  data.version = CURRENT_VERSION;
  return data;
}

function migrateFrom_0_9_0_to_1_0_0(data) {
  // 添加新字段
  data.templates = data.templates.map(t => ({
    ...t,
    usageCount: 0,
    lastUsedAt: null
  }));
  return data;
}
```

### 4. 内存管理

避免内存泄漏：

```javascript
class QuickReplyController {
  constructor() {
    this.eventListeners = [];
  }

  addEventListener(target, event, handler) {
    target.addEventListener(event, handler);
    this.eventListeners.push({ target, event, handler });
  }

  destroy() {
    // 移除所有事件监听器
    this.eventListeners.forEach(({ target, event, handler }) => {
      target.removeEventListener(event, handler);
    });
    this.eventListeners = [];

    // 清理其他资源
    this.templateManager = null;
    this.groupManager = null;
    this.sendManager = null;
  }
}
```

### 5. 日志记录

实现详细的日志记录，便于调试和问题排查：

```javascript
class Logger {
  constructor(module) {
    this.module = module;
  }

  info(message, data) {
    console.log(`[${this.module}] INFO: ${message}`, data);
  }

  warn(message, data) {
    console.warn(`[${this.module}] WARN: ${message}`, data);
  }

  error(message, error) {
    console.error(`[${this.module}] ERROR: ${message}`, error);
    // 可以发送到错误追踪服务
  }

  debug(message, data) {
    if (process.env.NODE_ENV === 'development') {
      console.debug(`[${this.module}] DEBUG: ${message}`, data);
    }
  }
}

// 使用示例
const logger = new Logger('QuickReply');
logger.info('Template created', { templateId: 'xxx' });
```

### 6. 国际化支持

虽然当前需求是中文，但预留国际化接口：

```javascript
const i18n = {
  'zh-CN': {
    'quick_reply': '快捷回复',
    'send': '发送',
    'insert': '输入框提示',
    'new_template': '新模板',
    'image_template': '图片模板',
    // ... 更多翻译
  },
  'en-US': {
    'quick_reply': 'Quick Reply',
    'send': 'Send',
    'insert': 'Insert',
    'new_template': 'New Template',
    'image_template': 'Image Template',
    // ... 更多翻译
  }
};

function t(key, locale = 'zh-CN') {
  return i18n[locale][key] || key;
}
```

### 7. 可访问性 (Accessibility)

确保UI对所有用户友好：

```javascript
// 键盘导航支持
function handleKeyDown(e) {
  switch (e.key) {
    case 'ArrowUp':
      selectPreviousTemplate();
      break;
    case 'ArrowDown':
      selectNextTemplate();
      break;
    case 'Enter':
      sendSelectedTemplate();
      break;
    case 'Escape':
      closePanel();
      break;
  }
}

// ARIA 属性
<button
  aria-label="发送模板"
  aria-describedby="template-description"
  onClick={handleSend}
>
  发送
</button>
```

### 8. 测试数据生成

为开发和测试提供模拟数据：

```javascript
function generateMockData() {
  const groups = [
    { id: 'g1', name: '常用问候', parentId: null, order: 1, expanded: true },
    { id: 'g2', name: '产品介绍', parentId: null, order: 2, expanded: false },
    { id: 'g3', name: '售后服务', parentId: null, order: 3, expanded: false }
  ];

  const templates = [
    {
      id: 't1',
      groupId: 'g1',
      type: 'text',
      label: '早安问候',
      content: { text: '早上好！有什么可以帮助您的吗？' },
      order: 1,
      usageCount: 10,
      createdAt: Date.now(),
      updatedAt: Date.now()
    },
    {
      id: 't2',
      groupId: 'g1',
      type: 'text',
      label: '晚安问候',
      content: { text: '晚上好！感谢您的咨询。' },
      order: 2,
      usageCount: 5,
      createdAt: Date.now(),
      updatedAt: Date.now()
    },
    // ... 更多模板
  ];

  return { groups, templates };
}
```

## 部署和发布

### 版本管理

使用语义化版本号（Semantic Versioning）：
- 主版本号：不兼容的API修改
- 次版本号：向下兼容的功能性新增
- 修订号：向下兼容的问题修正

### 发布检查清单

1. ✅ 所有单元测试通过
2. ✅ 所有属性测试通过
3. ✅ 所有集成测试通过
4. ✅ 代码审查完成
5. ✅ 文档更新完成
6. ✅ 性能测试通过
7. ✅ 安全审计通过
8. ✅ 用户验收测试通过

### 回滚计划

如果发布后发现严重问题：
1. 立即回滚到上一个稳定版本
2. 分析问题原因
3. 修复问题
4. 重新测试
5. 重新发布

## 未来扩展

### 可能的功能扩展

1. **模板变量**：支持在模板中使用变量（如客户名称、订单号等）
2. **模板分享**：支持在团队成员之间分享模板
3. **模板市场**：提供公共模板库，用户可以下载和使用
4. **智能推荐**：根据聊天内容智能推荐合适的模板
5. **快捷键支持**：为常用模板设置快捷键
6. **模板统计分析**：提供更详细的使用统计和分析报告
7. **多语言模板**：同一个模板支持多种语言版本
8. **模板审核**：团队管理员可以审核和批准模板

### 技术债务

1. **虚拟滚动优化**：当前实现可能在大量模板时性能不佳
2. **搜索算法优化**：考虑使用更高效的搜索算法（如Trie树）
3. **缓存策略优化**：实现更智能的缓存失效策略
4. **错误追踪**：集成专业的错误追踪服务（如Sentry）

