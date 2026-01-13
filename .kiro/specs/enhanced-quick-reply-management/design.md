# 增强快捷回复管理功能设计文档

## 概述

本设计文档描述增强版快捷回复管理功能的技术实现方案。该功能在现有快捷回复系统基础上，添加独立的管理窗口和增强的侧边栏功能，支持分组管理、多媒体内容管理、批量操作、导入导出等功能。

### 核心目标

1. **管理入口优化**：在侧边栏添加快捷回复管理入口，支持标签切换（全部/公共/个人）
2. **独立管理窗口**：创建功能完整的管理窗口，支持分组和内容的全面管理
3. **多媒体支持**：支持文本、图片、音频、视频、图文等多种内容类型
4. **数据同步**：确保侧边栏和管理窗口的数据实时同步
5. **用户体验**：提供直观的操作界面和流畅的交互体验

### 用户场景

- 客服人员通过侧边栏快速访问和使用快捷回复
- 客服人员通过管理窗口批量创建和管理快捷回复内容
- 客服主管通过导入导出功能分享和备份快捷回复模板
- 多账号用户需要为不同账号管理独立的快捷回复库

## 架构

### 目录结构

```
src/quick-reply/
├── index.js                              # 模块入口
├── controllers/
│   └── QuickReplyController.js           # 主控制器（扩展）
├── managers/
│   ├── TemplateManager.js                # 模板管理器（扩展）
│   ├── GroupManager.js                   # 分组管理器（扩展）
│   ├── SendManager.js                    # 发送管理器
│   └── SyncManager.js                    # 数据同步管理器（新增）
├── storage/
│   ├── TemplateStorage.js                # 模板存储
│   ├── GroupStorage.js                   # 分组存储
│   └── ConfigStorage.js                  # 配置存储
├── ui/
│   ├── sidebar/                          # 侧边栏组件（重构）
│   │   ├── SidebarPanel.jsx              # 侧边栏主面板
│   │   ├── TabSwitcher.jsx               # 标签切换器（全部/公共/个人）
│   │   ├── SearchBox.jsx                 # 搜索框
│   │   ├── GroupTree.jsx                 # 分组树
│   │   ├── ContentItem.jsx               # 内容项
│   │   └── ActionButtons.jsx             # 发送/输入框提示按钮
│   ├── management-window/                # 管理窗口组件（新增）
│   │   ├── ManagementWindow.jsx          # 管理窗口主组件
│   │   ├── Toolbar.jsx                   # 顶部工具栏
│   │   ├── GroupPanel.jsx                # 左侧分组面板
│   │   ├── ContentArea.jsx               # 右侧内容区域
│   │   ├── ContentCard.jsx               # 内容卡片
│   │   ├── MediaPlayer.jsx               # 媒体播放器
│   │   ├── ImportExportBar.jsx           # 底部导入导出栏
│   │   └── dialogs/                      # 对话框组件
│   │       ├── TextEditor.jsx            # 文本编辑对话框
│   │       ├── ImageUploader.jsx         # 图片上传对话框
│   │       ├── AudioUploader.jsx         # 音频上传对话框
│   │       ├── VideoUploader.jsx         # 视频上传对话框
│   │       ├── ImageTextEditor.jsx       # 图文编辑对话框
│   │       ├── ImportDialog.jsx          # 导入对话框
│   │       └── ExportDialog.jsx          # 导出对话框
│   └── common/                           # 通用组件
│       ├── Button.jsx
│       ├── Input.jsx
│       ├── Modal.jsx
│       ├── Dropdown.jsx
│       └── Toast.jsx
├── models/
│   ├── Template.js                       # 模板模型（扩展）
│   ├── Group.js                          # 分组模型
│   └── Config.js                         # 配置模型（扩展）
├── utils/
│   ├── validation.js                     # 验证工具
│   ├── search.js                         # 搜索工具
│   ├── file.js                           # 文件处理工具
│   ├── sync.js                           # 同步工具（新增）
│   └── export.js                         # 导出工具（新增）
├── constants/
│   ├── templateTypes.js                  # 模板类型常量
│   ├── contentTypes.js                   # 内容类型常量（新增）
│   ├── tabTypes.js                       # 标签类型常量（新增）
│   └── limits.js                         # 限制常量
└── __tests__/
    ├── unit/
    ├── property/
    └── integration/
```

### 系统架构图

```
┌─────────────────────────────────────────────────────────────────────┐
│                        WhatsApp 桌面客户端                            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌─────────────────────┐              ┌─────────────────────────┐   │
│  │   侧边栏面板         │              │   独立管理窗口           │   │
│  │   (SidebarPanel)    │◄────────────►│   (ManagementWindow)    │   │
│  │                     │   数据同步    │                         │   │
│  │  ┌───────────────┐  │              │  ┌───────────────────┐  │   │
│  │  │ TabSwitcher   │  │              │  │ Toolbar           │  │   │
│  │  │ 全部/公共/个人 │  │              │  │ 添加文本/图片/... │  │   │
│  │  └───────────────┘  │              │  └───────────────────┘  │   │
│  │  ┌───────────────┐  │              │  ┌─────────┬─────────┐  │   │
│  │  │ SearchBox     │  │              │  │GroupPanel│ContentArea│ │   │
│  │  └───────────────┘  │              │  │ 分组树  │ 内容网格 │  │   │
│  │  ┌───────────────┐  │              │  └─────────┴─────────┘  │   │
│  │  │ GroupTree     │  │              │  ┌───────────────────┐  │   │
│  │  │ ContentItem   │  │              │  │ ImportExportBar   │  │   │
│  │  │ ActionButtons │  │              │  │ 我要导入/我要导出  │  │   │
│  │  └───────────────┘  │              │  └───────────────────┘  │   │
│  └─────────────────────┘              └─────────────────────────┘   │
│                                                                       │
│           ┌─────────────────────────────────────────┐                │
│           │         QuickReplyController            │                │
│           │         (扩展：支持管理窗口)             │                │
│           └─────────────────────────────────────────┘                │
│                              │                                        │
│      ┌───────────────────────┼───────────────────────┐               │
│      │                       │                       │               │
│  ┌───▼────┐           ┌─────▼─────┐           ┌─────▼─────┐         │
│  │Template │           │  Group    │           │  Sync     │         │
│  │Manager  │           │  Manager  │           │  Manager  │         │
│  └───┬────┘           └─────┬─────┘           └─────┬─────┘         │
│      │                       │                       │               │
│      └───────────────────────┼───────────────────────┘               │
│                              │                                        │
│           ┌──────────────────▼──────────────────┐                    │
│           │           Storage Layer             │                    │
│           │  TemplateStorage | GroupStorage     │                    │
│           └─────────────────────────────────────┘                    │
│                                                                       │
└─────────────────────────────────────────────────────────────────────┘
```

## 组件和接口

### 1. 侧边栏组件

#### TabSwitcher（标签切换器）

```javascript
/**
 * 标签切换器组件
 * 显示"全部"、"公共"、"个人"三个标签
 */
class TabSwitcher extends React.Component {
  constructor(props) {
    this.state = {
      activeTab: 'all' // 'all' | 'public' | 'personal'
    };
  }

  // 切换标签
  handleTabChange(tab) { }

  // 渲染标签
  render() { }
}
```

#### SidebarPanel（侧边栏主面板）

```javascript
/**
 * 侧边栏主面板组件
 * 包含标签切换、搜索框、分组树、内容列表
 */
class SidebarPanel extends React.Component {
  constructor(props) {
    this.state = {
      activeTab: 'all',
      searchKeyword: '',
      expandedGroups: new Set()
    };
  }

  // 打开管理窗口
  openManagementWindow() { }

  // 处理搜索
  handleSearch(keyword) { }

  // 处理发送
  handleSend(contentId) { }

  // 处理插入到输入框
  handleInsert(contentId) { }

  render() { }
}
```

### 2. 管理窗口组件

#### ManagementWindow（管理窗口主组件）

```javascript
/**
 * 管理窗口主组件
 * 独立的Electron BrowserWindow
 */
class ManagementWindow {
  constructor(accountId) {
    this.accountId = accountId;
    this.window = null;
  }

  // 创建窗口
  create() {
    this.window = new BrowserWindow({
      width: 1200,
      height: 800,
      minWidth: 800,
      minHeight: 600,
      title: '分组 专业版，可批量创建的快捷文字平台',
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false
      }
    });
  }

  // 显示窗口
  show() { }

  // 关闭窗口
  close() { }

  // 发送数据更新事件
  sendUpdate(data) { }
}
```

#### Toolbar（顶部工具栏）

```javascript
/**
 * 顶部工具栏组件
 * 包含添加文本、图片、音频、视频、图文按钮
 */
class Toolbar extends React.Component {
  // 添加文本
  handleAddText() { }

  // 添加图片
  handleAddImage() { }

  // 添加音频
  handleAddAudio() { }

  // 添加视频
  handleAddVideo() { }

  // 添加图文
  handleAddImageText() { }

  render() {
    return (
      <div className="toolbar">
        <button onClick={this.handleAddText}>添加文本</button>
        <button onClick={this.handleAddImage}>添加图片</button>
        <button onClick={this.handleAddAudio}>添加音频</button>
        <button onClick={this.handleAddVideo}>添加视频</button>
        <button onClick={this.handleAddImageText}>添加图文</button>
      </div>
    );
  }
}
```

#### GroupPanel（左侧分组面板）

```javascript
/**
 * 左侧分组面板组件
 * 包含搜索框和分组树形结构
 */
class GroupPanel extends React.Component {
  constructor(props) {
    this.state = {
      searchKeyword: '',
      selectedGroupId: null,
      expandedGroups: new Set()
    };
  }

  // 创建新分组
  handleCreateGroup() { }

  // 选择分组
  handleSelectGroup(groupId) { }

  // 展开/折叠分组
  handleToggleGroup(groupId) { }

  // 删除分组
  handleDeleteGroup(groupId) { }

  render() { }
}
```

#### ContentArea（右侧内容区域）

```javascript
/**
 * 右侧内容区域组件
 * 以网格形式显示选中分组的内容
 */
class ContentArea extends React.Component {
  constructor(props) {
    this.state = {
      selectedContentIds: new Set()
    };
  }

  // 选择内容
  handleSelectContent(contentId) { }

  // 删除内容
  handleDeleteContent(contentId) { }

  // 编辑内容
  handleEditContent(contentId) { }

  render() { }
}
```

#### ContentCard（内容卡片）

```javascript
/**
 * 内容卡片组件
 * 根据内容类型显示不同的预览
 */
class ContentCard extends React.Component {
  // 渲染图片内容
  renderImage() { }

  // 渲染视频内容
  renderVideo() { }

  // 渲染音频内容
  renderAudio() { }

  // 渲染文本内容
  renderText() { }

  // 渲染图文内容
  renderImageText() { }

  render() {
    const { content } = this.props;
    switch (content.type) {
      case 'image': return this.renderImage();
      case 'video': return this.renderVideo();
      case 'audio': return this.renderAudio();
      case 'text': return this.renderText();
      case 'imageText': return this.renderImageText();
      default: return null;
    }
  }
}
```

#### ImportExportBar（底部导入导出栏）

```javascript
/**
 * 底部导入导出栏组件
 * 包含"我要导入"和"我要导出"按钮
 */
class ImportExportBar extends React.Component {
  // 处理导入
  handleImport() { }

  // 处理导出
  handleExport() { }

  render() {
    return (
      <div className="import-export-bar">
        <button className="import-btn" onClick={this.handleImport}>
          我要导入
        </button>
        <button className="export-btn primary" onClick={this.handleExport}>
          我要导出
        </button>
      </div>
    );
  }
}
```

### 3. 数据同步管理器

```javascript
/**
 * 数据同步管理器
 * 负责侧边栏和管理窗口之间的数据同步
 */
class SyncManager extends EventEmitter {
  constructor() {
    super();
    this.subscribers = new Set();
  }

  // 订阅数据变更
  subscribe(callback) {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }

  // 通知数据变更
  notify(event, data) {
    this.subscribers.forEach(callback => callback(event, data));
    this.emit(event, data);
  }

  // 同步分组变更
  syncGroupChange(groupId, action, data) {
    this.notify('group:change', { groupId, action, data });
  }

  // 同步内容变更
  syncContentChange(contentId, action, data) {
    this.notify('content:change', { contentId, action, data });
  }
}
```

## 数据模型

### 扩展的模板模型

```javascript
{
  id: string,                    // 唯一标识符
  groupId: string,               // 所属分组ID
  type: string,                  // 类型：'text' | 'image' | 'audio' | 'video' | 'imageText'
  visibility: string,            // 可见性：'public' | 'personal'（新增）
  label: string,                 // 标签名称
  content: {
    text?: string,               // 文本内容
    mediaPath?: string,          // 媒体文件路径
    mediaDuration?: number,      // 媒体时长（秒）
    mediaSize?: number,          // 媒体文件大小（字节）
    thumbnailPath?: string       // 缩略图路径（新增）
  },
  order: number,                 // 排序序号
  createdAt: timestamp,
  updatedAt: timestamp,
  usageCount: number,
  lastUsedAt: timestamp
}
```

### 扩展的配置模型

```javascript
{
  accountId: string,
  activeTab: string,             // 当前选中的标签：'all' | 'public' | 'personal'（新增）
  sidebarExpandedGroups: string[], // 侧边栏展开的分组
  windowExpandedGroups: string[], // 管理窗口展开的分组（新增）
  lastSelectedGroupId: string,
  windowSize: {                  // 管理窗口大小（新增）
    width: number,
    height: number
  },
  windowPosition: {              // 管理窗口位置（新增）
    x: number,
    y: number
  }
}
```

## 正确性属性

*一个属性是一个特征或行为，应该在系统的所有有效执行中保持为真——本质上是关于系统应该做什么的正式陈述。属性作为人类可读规范和机器可验证正确性保证之间的桥梁。*

### 属性 1：标签过滤正确性

*对于任何*内容项，当用户选择"公共"标签时，显示的所有内容的visibility属性都应该为"public"；当选择"个人"标签时，显示的所有内容的visibility属性都应该为"personal"；当选择"全部"标签时，应该显示所有内容。

**验证需求：1.1.2, 1.1.3, 1.1.4**

### 属性 2：序号连续性

*对于任何*分组，该分组下显示的内容序号应该从1开始连续递增，不存在重复或跳跃。

**验证需求：1.1.8**

### 属性 3：数据同步一致性

*对于任何*在管理窗口中进行的数据修改（添加、删除、编辑），侧边栏中的对应数据应该立即更新，保持两个界面的数据一致。

**验证需求：1.2.1, 1.2.2, 1.2.3, 1.2.5**

### 属性 4：分组命名规则

*对于任何*新创建的分组，如果用户未指定名称，系统应该自动生成"新分组N"格式的名称，其中N为当前最大序号+1。

**验证需求：3.3**

### 属性 5：内容类型展示正确性

*对于任何*内容项，系统应该根据其type属性显示对应的预览组件：图片显示缩略图，视频显示播放器，音频显示播放控件，文本显示文本框。

**验证需求：4.3, 4.4, 4.5, 4.6**

### 属性 6：内容添加分组归属

*对于任何*通过工具栏添加的内容，该内容应该被添加到当前选中的分组中，且在右侧内容区域立即显示。

**验证需求：5.7**

### 属性 7：文件大小验证

*对于任何*上传的媒体文件，如果文件大小超过限制（图片5MB、音频16MB、视频64MB），系统应该拒绝上传并显示错误提示。

**验证需求：6.1, 6.2, 6.3, 6.9**

### 属性 8：搜索结果正确性

*对于任何*搜索关键词，搜索结果中的所有内容都应该在其标签或内容中包含该关键词。

**验证需求：7.2, 7.3, 7.4**

### 属性 9：搜索清空往返一致性

*对于任何*搜索状态，当用户清空搜索框后，显示的内容应该与搜索前完全一致。

**验证需求：7.5**

### 属性 10：批量删除完整性

*对于任何*批量删除操作，所有被选中的内容都应该被删除，且只有被选中的内容被删除。

**验证需求：8.6**

### 属性 11：导入导出往返一致性

*对于任何*数据集，执行导出后再导入，导入后的数据应该与导出前的数据在内容上一致（ID和时间戳可能不同）。

**验证需求：9.1-9.8**

### 属性 12：使用统计递增

*对于任何*内容，每次通过"发送"按钮使用后，该内容的usageCount应该增加1。

**验证需求：11.1**

### 属性 13：账号数据隔离

*对于任何*两个不同的账号，在一个账号下创建或修改的内容不应该出现在另一个账号的数据中。

**验证需求：16.9**

## 错误处理

### 错误类型

1. **文件上传错误**：文件格式不支持、文件大小超限、上传失败
2. **数据同步错误**：侧边栏和管理窗口数据不一致
3. **存储错误**：磁盘空间不足、文件系统权限不足
4. **导入导出错误**：文件格式无效、数据损坏
5. **窗口错误**：管理窗口创建失败、窗口通信失败

### 错误处理策略

```javascript
class ErrorHandler {
  // 处理文件上传错误
  handleUploadError(error) {
    if (error.code === 'FILE_TOO_LARGE') {
      this.showToast('文件大小超过限制', 'error');
    } else if (error.code === 'INVALID_FORMAT') {
      this.showToast('不支持的文件格式', 'error');
    } else {
      this.showToast('上传失败，请重试', 'error');
    }
  }

  // 处理同步错误
  handleSyncError(error) {
    this.showToast('数据同步失败，请刷新页面', 'warning');
    this.logError(error);
  }

  // 处理导入错误
  handleImportError(error) {
    this.showDialog({
      title: '导入失败',
      message: error.message,
      buttons: ['确定']
    });
  }
}
```

## 测试策略

### 单元测试

- TabSwitcher组件的标签切换逻辑
- GroupPanel组件的分组管理逻辑
- ContentArea组件的内容展示逻辑
- SyncManager的数据同步逻辑
- 文件验证工具函数

### 属性测试

使用 **fast-check** 库，每个属性测试运行至少 **100次迭代**。

```javascript
/**
 * Feature: enhanced-quick-reply-management, Property 1: 标签过滤正确性
 * 验证需求：1.1.2, 1.1.3, 1.1.4
 */
test('property: tab filter correctness', () => {
  fc.assert(
    fc.property(
      contentListArbitrary(),
      fc.constantFrom('all', 'public', 'personal'),
      (contents, tab) => {
        const filtered = filterByTab(contents, tab);
        if (tab === 'all') {
          return filtered.length === contents.length;
        }
        return filtered.every(c => c.visibility === tab);
      }
    ),
    { numRuns: 100 }
  );
});

/**
 * Feature: enhanced-quick-reply-management, Property 2: 序号连续性
 * 验证需求：1.1.8
 */
test('property: sequence number continuity', () => {
  fc.assert(
    fc.property(
      contentListArbitrary(),
      (contents) => {
        const numbered = assignSequenceNumbers(contents);
        for (let i = 0; i < numbered.length; i++) {
          if (numbered[i].sequenceNumber !== i + 1) return false;
        }
        return true;
      }
    ),
    { numRuns: 100 }
  );
});
```

### 集成测试

- 侧边栏与管理窗口的数据同步
- 导入导出功能的完整流程
- 多账号切换时的数据隔离

## 技术决策

### 1. 管理窗口实现

**决策**：使用Electron的BrowserWindow创建独立窗口

**理由**：
- 提供更大的操作空间
- 支持独立的窗口管理（最小化、最大化、调整大小）
- 与主窗口解耦，不影响聊天功能

### 2. 数据同步机制

**决策**：使用EventEmitter实现发布-订阅模式

**理由**：
- 解耦侧边栏和管理窗口
- 支持多个订阅者
- 易于扩展和维护

### 3. 内容展示布局

**决策**：使用CSS Grid实现网格布局

**理由**：
- 自适应不同窗口大小
- 支持不同尺寸的内容卡片
- 现代浏览器原生支持

### 4. 媒体文件处理

**决策**：生成缩略图存储，原文件按需加载

**理由**：
- 提高列表加载速度
- 减少内存占用
- 支持大文件预览
