# 快捷回复功能 API 文档

## 目录

1. [概述](#概述)
2. [QuickReplyController](#quickreplycontroller)
3. [TemplateManager](#templatemanager)
4. [GroupManager](#groupmanager)
5. [SendManager](#sendmanager)
6. [Storage APIs](#storage-apis)
7. [Models](#models)
8. [Constants](#constants)
9. [Errors](#errors)
10. [Utils](#utils)

---

## 概述

本文档提供快捷回复功能的完整 API 参考。所有 API 都遵循以下约定：

- 异步方法返回 Promise
- 错误通过抛出异常处理
- 所有 ID 使用 UUID v4 格式
- 时间戳使用 Unix 时间戳（毫秒）

### 安装和导入

```javascript
// 导入主控制器
const { QuickReplyController } = require('./quick-reply');

// 导入管理器
const { TemplateManager, GroupManager, SendManager } = require('./quick-reply/managers');

// 导入存储
const { TemplateStorage, GroupStorage, ConfigStorage } = require('./quick-reply/storage');

// 导入模型
const { Template, Group, Config } = require('./quick-reply/models');

// 导入常量
const { TEMPLATE_TYPES, SEND_MODES, LIMITS } = require('./quick-reply/constants');

// 导入错误
const { ValidationError, StorageError, TranslationError, SendError, ImportError } = require('./quick-reply/errors');
```

---

## QuickReplyController

主控制器，协调所有子模块。

### 构造函数

```javascript
new QuickReplyController(accountId, translationService, whatsappWebInterface)
```

**参数**:
- `accountId` (string): 账号唯一标识符
- `translationService` (object): 翻译服务实例
- `whatsappWebInterface` (object): WhatsApp Web 接口实例

**示例**:
```javascript
const controller = new QuickReplyController(
  'account-123',
  translationService,
  whatsappWebInterface
);
```

### 方法

#### openOperationPanel()

打开操作面板。

**返回**: `void`

**示例**:
```javascript
controller.openOperationPanel();
```

#### closeOperationPanel()

关闭操作面板。

**返回**: `void`

**示例**:
```javascript
controller.closeOperationPanel();
```

#### openManagementInterface()

打开管理界面。

**返回**: `void`

**示例**:
```javascript
controller.openManagementInterface();
```

#### closeManagementInterface()

关闭管理界面。

**返回**: `void`

**示例**:
```javascript
controller.closeManagementInterface();
```

#### sendTemplate(templateId, mode)

发送模板。

**参数**:
- `templateId` (string): 模板 ID
- `mode` (string): 发送模式，'original' 或 'translated'

**返回**: `Promise<void>`

**抛出**:
- `SendError`: 发送失败
- `TranslationError`: 翻译失败（仅在 translated 模式）

**示例**:
```javascript
// 原文发送
await controller.sendTemplate('template-123', 'original');

// 翻译后发送
await controller.sendTemplate('template-123', 'translated');
```

#### insertTemplate(templateId, mode)

将模板插入到输入框。

**参数**:
- `templateId` (string): 模板 ID
- `mode` (string): 发送模式，'original' 或 'translated'

**返回**: `Promise<void>`

**抛出**:
- `TranslationError`: 翻译失败（仅在 translated 模式）

**示例**:
```javascript
await controller.insertTemplate('template-123', 'original');
```

#### searchTemplates(keyword)

搜索模板。

**参数**:
- `keyword` (string): 搜索关键词

**返回**: `Promise<Template[]>` - 匹配的模板列表

**示例**:
```javascript
const results = await controller.searchTemplates('问候');
console.log(`找到 ${results.length} 个模板`);
```

### 事件

QuickReplyController 继承自 EventEmitter，支持以下事件：

#### template:created

模板创建时触发。

**回调参数**: `(template: Template)`

**示例**:
```javascript
controller.on('template:created', (template) => {
  console.log('模板已创建:', template.label);
});
```

#### template:updated

模板更新时触发。

**回调参数**: `(template: Template)`

#### template:deleted

模板删除时触发。

**回调参数**: `(templateId: string)`

#### group:created

分组创建时触发。

**回调参数**: `(group: Group)`

#### group:updated

分组更新时触发。

**回调参数**: `(group: Group)`

#### group:deleted

分组删除时触发。

**回调参数**: `(groupId: string)`

---

## TemplateManager

模板管理器，负责模板的 CRUD 操作。

### 构造函数

```javascript
new TemplateManager(accountId)
```

**参数**:
- `accountId` (string): 账号唯一标识符

### 方法

#### createTemplate(groupId, type, label, content)

创建模板。

**参数**:
- `groupId` (string): 分组 ID
- `type` (string): 模板类型（见 TEMPLATE_TYPES）
- `label` (string): 模板标签
- `content` (object): 模板内容

**返回**: `Promise<Template>` - 创建的模板

**抛出**:
- `ValidationError`: 验证失败
- `StorageError`: 存储失败

**示例**:
```javascript
const manager = new TemplateManager('account-123');

// 创建文本模板
const textTemplate = await manager.createTemplate(
  'group-1',
  'text',
  '问候语',
  { text: '您好，有什么可以帮您？' }
);

// 创建图片模板
const imageTemplate = await manager.createTemplate(
  'group-1',
  'image',
  '产品图片',
  { mediaPath: '/path/to/image.jpg' }
);

// 创建图文模板
const mixedTemplate = await manager.createTemplate(
  'group-1',
  'mixed',
  '产品介绍',
  {
    text: '这是我们的新产品',
    mediaPath: '/path/to/image.jpg'
  }
);
```

#### getTemplate(templateId)

获取模板。

**参数**:
- `templateId` (string): 模板 ID

**返回**: `Promise<Template | null>` - 模板对象，不存在时返回 null

**示例**:
```javascript
const template = await manager.getTemplate('template-123');
if (template) {
  console.log('模板标签:', template.label);
}
```

#### updateTemplate(templateId, updates)

更新模板。

**参数**:
- `templateId` (string): 模板 ID
- `updates` (object): 更新的字段

**返回**: `Promise<Template>` - 更新后的模板

**抛出**:
- `ValidationError`: 验证失败
- `StorageError`: 存储失败

**示例**:
```javascript
const updated = await manager.updateTemplate('template-123', {
  label: '新标签',
  content: { text: '新内容' }
});
```

#### deleteTemplate(templateId)

删除模板。

**参数**:
- `templateId` (string): 模板 ID

**返回**: `Promise<void>`

**抛出**:
- `StorageError`: 存储失败

**示例**:
```javascript
await manager.deleteTemplate('template-123');
```

#### getTemplatesByGroup(groupId)

获取分组下的所有模板。

**参数**:
- `groupId` (string): 分组 ID

**返回**: `Promise<Template[]>` - 模板列表

**示例**:
```javascript
const templates = await manager.getTemplatesByGroup('group-1');
console.log(`分组包含 ${templates.length} 个模板`);
```

#### getTemplatesByType(groupId, type)

获取指定类型的模板。

**参数**:
- `groupId` (string): 分组 ID
- `type` (string): 模板类型

**返回**: `Promise<Template[]>` - 模板列表

**示例**:
```javascript
const textTemplates = await manager.getTemplatesByType('group-1', 'text');
```

#### moveTemplate(templateId, targetGroupId)

移动模板到其他分组。

**参数**:
- `templateId` (string): 模板 ID
- `targetGroupId` (string): 目标分组 ID

**返回**: `Promise<Template>` - 更新后的模板

**示例**:
```javascript
await manager.moveTemplate('template-123', 'group-2');
```

#### reorderTemplate(templateId, newIndex)

调整模板顺序。

**参数**:
- `templateId` (string): 模板 ID
- `newIndex` (number): 新的序号

**返回**: `Promise<void>`

**示例**:
```javascript
await manager.reorderTemplate('template-123', 0); // 移到第一位
```

#### batchDeleteTemplates(templateIds)

批量删除模板。

**参数**:
- `templateIds` (string[]): 模板 ID 列表

**返回**: `Promise<void>`

**示例**:
```javascript
await manager.batchDeleteTemplates(['template-1', 'template-2', 'template-3']);
```

#### batchMoveTemplates(templateIds, targetGroupId)

批量移动模板。

**参数**:
- `templateIds` (string[]): 模板 ID 列表
- `targetGroupId` (string): 目标分组 ID

**返回**: `Promise<void>`

**示例**:
```javascript
await manager.batchMoveTemplates(['template-1', 'template-2'], 'group-2');
```

#### validateTemplate(type, content)

验证模板内容。

**参数**:
- `type` (string): 模板类型
- `content` (object): 模板内容

**返回**: `boolean` - 是否有效

**抛出**:
- `ValidationError`: 验证失败

**示例**:
```javascript
try {
  manager.validateTemplate('text', { text: '内容' });
  console.log('验证通过');
} catch (error) {
  console.error('验证失败:', error.message);
}
```

#### generateDefaultLabel(type)

生成默认标签。

**参数**:
- `type` (string): 模板类型

**返回**: `string` - 默认标签

**示例**:
```javascript
const label = manager.generateDefaultLabel('text'); // "新模板"
const imageLabel = manager.generateDefaultLabel('image'); // "图片模板"
```

#### recordUsage(templateId)

记录模板使用。

**参数**:
- `templateId` (string): 模板 ID

**返回**: `Promise<void>`

**示例**:
```javascript
await manager.recordUsage('template-123');
```

#### getUsageStats(templateId)

获取模板使用统计。

**参数**:
- `templateId` (string): 模板 ID

**返回**: `Promise<object>` - 统计信息

**返回对象**:
```javascript
{
  usageCount: number,      // 使用次数
  lastUsedAt: timestamp    // 最后使用时间
}
```

**示例**:
```javascript
const stats = await manager.getUsageStats('template-123');
console.log(`使用次数: ${stats.usageCount}`);
console.log(`最后使用: ${new Date(stats.lastUsedAt).toLocaleString()}`);
```

---

## GroupManager

分组管理器，负责分组的 CRUD 操作和层级管理。

### 构造函数

```javascript
new GroupManager(accountId)
```

**参数**:
- `accountId` (string): 账号唯一标识符

### 方法

#### createGroup(name, parentId)

创建分组。

**参数**:
- `name` (string): 分组名称
- `parentId` (string, optional): 父分组 ID，null 表示顶级分组

**返回**: `Promise<Group>` - 创建的分组

**抛出**:
- `ValidationError`: 验证失败
- `StorageError`: 存储失败

**示例**:
```javascript
const manager = new GroupManager('account-123');

// 创建顶级分组
const group = await manager.createGroup('常用问候');

// 创建子分组
const subGroup = await manager.createGroup('工作日问候', group.id);
```

#### getGroup(groupId)

获取分组。

**参数**:
- `groupId` (string): 分组 ID

**返回**: `Promise<Group | null>` - 分组对象，不存在时返回 null

**示例**:
```javascript
const group = await manager.getGroup('group-123');
```

#### updateGroup(groupId, updates)

更新分组。

**参数**:
- `groupId` (string): 分组 ID
- `updates` (object): 更新的字段

**返回**: `Promise<Group>` - 更新后的分组

**示例**:
```javascript
await manager.updateGroup('group-123', { name: '新名称' });
```

#### deleteGroup(groupId)

删除分组（级联删除子分组和模板）。

**参数**:
- `groupId` (string): 分组 ID

**返回**: `Promise<void>`

**示例**:
```javascript
await manager.deleteGroup('group-123');
```

#### getAllGroups()

获取所有分组。

**返回**: `Promise<Group[]>` - 分组列表

**示例**:
```javascript
const groups = await manager.getAllGroups();
```

#### getChildGroups(parentId)

获取子分组。

**参数**:
- `parentId` (string): 父分组 ID

**返回**: `Promise<Group[]>` - 子分组列表

**示例**:
```javascript
const children = await manager.getChildGroups('group-123');
```

#### moveGroup(groupId, newParentId)

移动分组。

**参数**:
- `groupId` (string): 分组 ID
- `newParentId` (string | null): 新的父分组 ID

**返回**: `Promise<Group>` - 更新后的分组

**示例**:
```javascript
await manager.moveGroup('group-123', 'group-456');
```

#### reorderGroup(groupId, newIndex)

调整分组顺序。

**参数**:
- `groupId` (string): 分组 ID
- `newIndex` (number): 新的序号

**返回**: `Promise<void>`

**示例**:
```javascript
await manager.reorderGroup('group-123', 0);
```

#### toggleExpanded(groupId)

切换展开/折叠状态。

**参数**:
- `groupId` (string): 分组 ID

**返回**: `Promise<boolean>` - 新的展开状态

**示例**:
```javascript
const expanded = await manager.toggleExpanded('group-123');
console.log(expanded ? '已展开' : '已折叠');
```

#### getExpandedState(groupId)

获取分组的展开状态。

**参数**:
- `groupId` (string): 分组 ID

**返回**: `Promise<boolean>` - 展开状态

**示例**:
```javascript
const expanded = await manager.getExpandedState('group-123');
```

#### batchDeleteGroups(groupIds)

批量删除分组。

**参数**:
- `groupIds` (string[]): 分组 ID 列表

**返回**: `Promise<void>`

**示例**:
```javascript
await manager.batchDeleteGroups(['group-1', 'group-2']);
```

---

## SendManager

发送管理器，负责处理模板的发送逻辑。

### 构造函数

```javascript
new SendManager(translationService, whatsappWebInterface)
```

**参数**:
- `translationService` (object): 翻译服务实例
- `whatsappWebInterface` (object): WhatsApp Web 接口实例

### 方法

#### sendOriginal(template)

发送模板（原文）。

**参数**:
- `template` (Template): 模板对象

**返回**: `Promise<void>`

**抛出**:
- `SendError`: 发送失败

**示例**:
```javascript
const manager = new SendManager(translationService, whatsappWebInterface);
await manager.sendOriginal(template);
```

#### sendTranslated(template, targetLanguage, style)

发送模板（翻译后）。

**参数**:
- `template` (Template): 模板对象
- `targetLanguage` (string): 目标语言
- `style` (string, optional): 翻译风格

**返回**: `Promise<void>`

**抛出**:
- `TranslationError`: 翻译失败
- `SendError`: 发送失败

**示例**:
```javascript
await manager.sendTranslated(template, 'en', 'formal');
```

#### insertOriginal(template)

插入模板到输入框（原文）。

**参数**:
- `template` (Template): 模板对象

**返回**: `Promise<void>`

**示例**:
```javascript
await manager.insertOriginal(template);
```

#### insertTranslated(template, targetLanguage, style)

插入模板到输入框（翻译后）。

**参数**:
- `template` (Template): 模板对象
- `targetLanguage` (string): 目标语言
- `style` (string, optional): 翻译风格

**返回**: `Promise<void>`

**抛出**:
- `TranslationError`: 翻译失败

**示例**:
```javascript
await manager.insertTranslated(template, 'en');
```

#### sendText(text)

发送文本。

**参数**:
- `text` (string): 文本内容

**返回**: `Promise<void>`

**示例**:
```javascript
await manager.sendText('您好');
```

#### sendImage(imagePath)

发送图片。

**参数**:
- `imagePath` (string): 图片文件路径

**返回**: `Promise<void>`

**示例**:
```javascript
await manager.sendImage('/path/to/image.jpg');
```

#### sendAudio(audioPath)

发送音频。

**参数**:
- `audioPath` (string): 音频文件路径

**返回**: `Promise<void>`

**示例**:
```javascript
await manager.sendAudio('/path/to/audio.mp3');
```

#### sendVideo(videoPath)

发送视频。

**参数**:
- `videoPath` (string): 视频文件路径

**返回**: `Promise<void>`

**示例**:
```javascript
await manager.sendVideo('/path/to/video.mp4');
```

#### sendImageWithText(imagePath, text)

发送图文。

**参数**:
- `imagePath` (string): 图片文件路径
- `text` (string): 文本内容

**返回**: `Promise<void>`

**示例**:
```javascript
await manager.sendImageWithText('/path/to/image.jpg', '产品介绍');
```

#### sendContact(contactInfo)

发送名片。

**参数**:
- `contactInfo` (object): 联系人信息

**contactInfo 对象**:
```javascript
{
  name: string,
  phone: string,
  email?: string
}
```

**返回**: `Promise<void>`

**示例**:
```javascript
await manager.sendContact({
  name: '张三',
  phone: '+86 138 0000 0000',
  email: 'zhangsan@example.com'
});
```

#### translateText(text, targetLanguage, style)

翻译文本。

**参数**:
- `text` (string): 文本内容
- `targetLanguage` (string): 目标语言
- `style` (string, optional): 翻译风格

**返回**: `Promise<string>` - 翻译后的文本

**抛出**:
- `TranslationError`: 翻译失败

**示例**:
```javascript
const translated = await manager.translateText('您好', 'en');
console.log(translated); // "Hello"
```

---

## Storage APIs

### TemplateStorage

模板数据存储。

#### 构造函数

```javascript
new TemplateStorage(accountId)
```

#### 方法

- `save(template)`: 保存模板
- `get(templateId)`: 获取模板
- `getAll()`: 获取所有模板
- `getByGroup(groupId)`: 获取分组下的模板
- `update(templateId, updates)`: 更新模板
- `delete(templateId)`: 删除模板
- `batchDelete(templateIds)`: 批量删除模板
- `search(keyword)`: 搜索模板

### GroupStorage

分组数据存储。

#### 构造函数

```javascript
new GroupStorage(accountId)
```

#### 方法

- `save(group)`: 保存分组
- `get(groupId)`: 获取分组
- `getAll()`: 获取所有分组
- `getChildren(parentId)`: 获取子分组
- `update(groupId, updates)`: 更新分组
- `delete(groupId)`: 删除分组
- `batchDelete(groupIds)`: 批量删除分组

### ConfigStorage

配置数据存储。

#### 构造函数

```javascript
new ConfigStorage(accountId)
```

#### 方法

- `save(config)`: 保存配置
- `get()`: 获取配置
- `update(updates)`: 更新配置
- `reset()`: 重置配置

---

## Models

### Template

模板数据模型。

#### 构造函数

```javascript
new Template(data)
```

**参数**:
```javascript
{
  id?: string,              // 自动生成
  groupId: string,
  type: string,
  label: string,
  content: object,
  order?: number,           // 自动生成
  createdAt?: timestamp,    // 自动生成
  updatedAt?: timestamp,    // 自动生成
  usageCount?: number,      // 默认 0
  lastUsedAt?: timestamp    // 默认 null
}
```

#### 方法

- `validate()`: 验证模板数据
- `toJSON()`: 转换为 JSON 对象
- `static fromJSON(json)`: 从 JSON 创建实例

### Group

分组数据模型。

#### 构造函数

```javascript
new Group(data)
```

**参数**:
```javascript
{
  id?: string,              // 自动生成
  name: string,
  parentId?: string | null, // 默认 null
  order?: number,           // 自动生成
  expanded?: boolean,       // 默认 true
  createdAt?: timestamp,    // 自动生成
  updatedAt?: timestamp     // 自动生成
}
```

#### 方法

- `validate()`: 验证分组数据
- `toJSON()`: 转换为 JSON 对象
- `static fromJSON(json)`: 从 JSON 创建实例

### Config

配置数据模型。

#### 构造函数

```javascript
new Config(data)
```

**参数**:
```javascript
{
  accountId: string,
  sendMode?: string,              // 默认 'original'
  expandedGroups?: string[],      // 默认 []
  lastSelectedGroupId?: string,   // 默认 null
  createdAt?: timestamp,          // 自动生成
  updatedAt?: timestamp           // 自动生成
}
```

#### 方法

- `validate()`: 验证配置数据
- `toJSON()`: 转换为 JSON 对象
- `static fromJSON(json)`: 从 JSON 创建实例

---

## Constants

### TEMPLATE_TYPES

模板类型常量。

```javascript
{
  TEXT: 'text',
  IMAGE: 'image',
  AUDIO: 'audio',
  VIDEO: 'video',
  MIXED: 'mixed',
  CONTACT: 'contact'
}
```

### SEND_MODES

发送模式常量。

```javascript
{
  ORIGINAL: 'original',
  TRANSLATED: 'translated'
}
```

### LIMITS

限制常量。

```javascript
{
  LABEL_MAX_LENGTH: 50,
  IMAGE_MAX_SIZE: 16777216,    // 16MB
  AUDIO_MAX_SIZE: 16777216,    // 16MB
  VIDEO_MAX_SIZE: 67108864,    // 64MB
  GROUP_MAX_DEPTH: 3
}
```

---

## Errors

### ValidationError

验证错误。

```javascript
throw new ValidationError('标签长度超过限制', 'label');
```

### StorageError

存储错误。

```javascript
throw new StorageError('保存失败');
```

### TranslationError

翻译错误。

```javascript
throw new TranslationError('翻译服务不可用');
```

### SendError

发送错误。

```javascript
throw new SendError('消息发送失败');
```

### ImportError

导入错误。

```javascript
throw new ImportError('文件格式无效');
```

---

## Utils

### validation

验证工具函数。

```javascript
const { validateLabel, validateMediaFile, sanitizeInput } = require('./quick-reply/utils/validation');

// 验证标签
validateLabel('问候语'); // true

// 验证媒体文件
validateMediaFile('/path/to/image.jpg', 'image'); // true

// 清理输入
const clean = sanitizeInput('<script>alert("xss")</script>'); // 转义后的字符串
```

### search

搜索工具函数。

```javascript
const { searchTemplates, searchGroups } = require('./quick-reply/utils/search');

// 搜索模板
const results = searchTemplates('问候', templates);

// 搜索分组
const groups = searchGroups('常用', allGroups);
```

### file

文件处理工具函数。

```javascript
const { copyMediaFile, deleteMediaFile, encodeBase64, decodeBase64 } = require('./quick-reply/utils/file');

// 复制媒体文件
await copyMediaFile('/source/image.jpg', '/dest/image.jpg');

// 删除媒体文件
await deleteMediaFile('/path/to/image.jpg');

// Base64 编码
const base64 = await encodeBase64('/path/to/image.jpg');

// Base64 解码
await decodeBase64(base64, '/path/to/image.jpg');
```

### logger

日志工具。

```javascript
const { Logger } = require('./quick-reply/utils/logger');

const logger = new Logger('QuickReply');
logger.info('信息日志');
logger.warn('警告日志');
logger.error('错误日志');
logger.debug('调试日志');
```

### concurrency

并发控制工具。

```javascript
const { ConcurrencyController } = require('./quick-reply/utils/concurrency');

const controller = new ConcurrencyController();

// 获取锁
await controller.acquire('template-123');
try {
  // 执行操作
} finally {
  // 释放锁
  controller.release('template-123');
}
```

---

## 完整示例

### 创建和使用模板

```javascript
const { QuickReplyController } = require('./quick-reply');
const { TemplateManager, GroupManager } = require('./quick-reply/managers');

// 初始化
const accountId = 'account-123';
const templateManager = new TemplateManager(accountId);
const groupManager = new GroupManager(accountId);

// 创建分组
const group = await groupManager.createGroup('常用问候');

// 创建模板
const template = await templateManager.createTemplate(
  group.id,
  'text',
  '问候语',
  { text: '您好，有什么可以帮您？' }
);

// 使用控制器发送
const controller = new QuickReplyController(
  accountId,
  translationService,
  whatsappWebInterface
);

await controller.sendTemplate(template.id, 'original');
```

### 搜索和批量操作

```javascript
// 搜索模板
const results = await controller.searchTemplates('问候');

// 批量删除
const templateIds = results.map(t => t.id);
await templateManager.batchDeleteTemplates(templateIds);
```

### 导入导出

```javascript
const { exportTemplates, importTemplates } = require('./quick-reply/utils/import-export');

// 导出
const data = await exportTemplates(accountId);
await fs.writeFile('templates.json', JSON.stringify(data, null, 2));

// 导入
const imported = await fs.readFile('templates.json', 'utf8');
await importTemplates(accountId, JSON.parse(imported));
```

---

**文档版本**: v1.0.0  
**最后更新**: 2024-12-09
