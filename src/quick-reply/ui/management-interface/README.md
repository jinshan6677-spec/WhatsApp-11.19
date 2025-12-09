# 快捷回复管理界面 (Management Interface)

## 概述

管理界面是快捷回复功能的核心管理工具，提供独立窗口用于预先设置、创建、编辑和组织回复模板。

## 组件结构

```
management-interface/
├── ManagementInterface.jsx    # 主组件和状态管理
├── Header.jsx                  # 顶部标题和操作按钮
├── PlatformSelector.jsx        # 平台选择器（WhatsApp）
├── GroupPanel.jsx              # 分组管理面板
├── GroupListItem.jsx           # 分组列表项
├── ContentArea.jsx             # 内容编辑区域
├── TabBar.jsx                  # 内容类型标签页
├── TemplateListView.jsx        # 模板列表视图
├── TemplateListItem.jsx        # 模板列表项
└── TemplateEditor.jsx          # 模板编辑器
```

## 主要功能

### 1. ManagementInterface (主组件)

**功能：**
- 独立窗口创建和管理
- 全局状态管理（使用 Context + useReducer）
- 数据加载和同步
- 模板过滤和搜索

**状态管理：**
```javascript
{
  isOpen: boolean,              // 界面是否打开
  selectedGroupId: string,      // 当前选中的分组ID
  selectedTemplateIds: Set,     // 批量选中的模板ID集合
  selectedGroupIds: Set,        // 批量选中的分组ID集合
  activeTab: string,            // 当前激活的标签页
  templates: Array,             // 所有模板
  groups: Array,                // 所有分组
  filteredTemplates: Array,     // 过滤后的模板
  searchKeyword: string,        // 搜索关键词
  isLoading: boolean,           // 加载状态
  error: string,                // 错误信息
  editingTemplate: Object,      // 正在编辑的模板
  showTemplateEditor: boolean   // 是否显示编辑器
}
```

**使用示例：**
```javascript
import { ManagementInterface, ManagementInterfaceProvider } from './management-interface';

function App() {
  return (
    <ManagementInterfaceProvider controller={quickReplyController}>
      <ManagementInterface onClose={handleClose} />
    </ManagementInterfaceProvider>
  );
}
```

### 2. Header (顶部区域)

**功能：**
- 显示标题和描述
- 下载模板按钮
- 导入/添加按钮
- 关闭按钮

**需求：** 30.1-30.5

### 3. PlatformSelector (平台选择器)

**功能：**
- 显示 WhatsApp 图标和名称
- 支持未来扩展其他平台

**需求：** 12.4

### 4. GroupPanel (分组管理面板)

**功能：**
- 分组搜索
- 分组列表显示
- 批量选择分组
- 拖拽排序
- 新建分组
- 批量删除分组

**需求：** 23.1-23.9

### 5. GroupListItem (分组列表项)

**功能：**
- 显示分组名称
- 复选框（批量选择）
- 添加按钮（+）：新建子分组或添加模板
- 更多操作按钮（...）：重命名、复制、删除
- 拖拽支持

**需求：** 23.1-23.9

### 6. ContentArea (内容编辑区域)

**功能：**
- 显示标签页
- 显示模板列表
- 显示模板编辑器
- 空状态提示

**需求：** 25.1-25.8

### 7. TabBar (标签页)

**功能：**
- 按内容类型过滤模板
- 显示每个类型的模板数量
- 标签页切换

**标签页类型：**
- 全部
- 活跃文本
- 活跃图文
- 活跃图片
- 活跃视频
- 活跃名片

**需求：** 17.1-17.8, 25.1-25.8

### 8. TemplateListView (模板列表视图)

**功能：**
- 显示模板列表
- 全选/取消选择
- 批量操作工具栏
- 批量删除
- 批量移动
- 拖拽排序
- 添加新模板

**需求：** 24.1-24.12

### 9. TemplateListItem (模板列表项)

**功能：**
- 显示模板信息（类型、标签）
- 复选框（批量选择）
- 编辑按钮
- 删除按钮
- 拖拽支持

**需求：** 24.1-24.12

### 10. TemplateEditor (模板编辑器)

**功能：**
- 创建新模板
- 编辑现有模板
- 模板类型选择
- 模板标签输入
- 内容输入/上传（根据类型）
- 表单验证
- 保存和取消

**支持的模板类型：**
- 文本：文本内容输入
- 图片：图片文件上传
- 视频：视频文件上传
- 音频：音频文件上传
- 图文：图片 + 文本
- 名片：联系人信息输入

**需求：** 3.1-3.13, 5.1-5.5, 22.1-22.7

## 数据流

```
用户操作
    ↓
组件事件处理
    ↓
dispatch action
    ↓
reducer 更新状态
    ↓
组件重新渲染
    ↓
调用 controller 方法
    ↓
更新后端数据
    ↓
重新加载数据
    ↓
更新状态
```

## 样式设计

### 布局
- 使用 Flexbox 布局
- 响应式设计，支持不同屏幕尺寸
- 固定高度的模态窗口（90% 视口高度）

### 颜色方案
- 主色：#007bff（蓝色）
- 背景：#ffffff（白色）
- 边框：#e0e0e0（浅灰）
- 文字：#212529（深灰）
- 次要文字：#6c757d（中灰）
- 危险操作：#dc3545（红色）

### 交互效果
- 悬停效果：背景色变化
- 选中状态：蓝色高亮
- 拖拽状态：半透明
- 加载状态：加载动画
- 过渡动画：0.2s ease

## 使用示例

### 打开管理界面

```javascript
import { ManagementInterfaceProvider, useManagementInterface } from './management-interface';

function MyComponent() {
  const { dispatch } = useManagementInterface();

  const openManagementInterface = () => {
    dispatch({ type: 'OPEN_INTERFACE' });
  };

  return (
    <button onClick={openManagementInterface}>
      打开管理界面
    </button>
  );
}
```

### 创建新模板

```javascript
const { dispatch } = useManagementInterface();

// 显示模板编辑器
dispatch({ 
  type: 'SHOW_TEMPLATE_EDITOR', 
  payload: { groupId: 'group-id' } 
});
```

### 编辑现有模板

```javascript
const { dispatch } = useManagementInterface();

// 显示模板编辑器并传入模板数据
dispatch({ 
  type: 'SHOW_TEMPLATE_EDITOR', 
  payload: template 
});
```

### 批量操作

```javascript
const { state, dispatch, controller } = useManagementInterface();

// 选中所有模板
dispatch({ type: 'SELECT_ALL_TEMPLATES' });

// 批量删除
await controller.templateManager.batchDeleteTemplates(
  Array.from(state.selectedTemplateIds)
);

// 清除选择
dispatch({ type: 'CLEAR_TEMPLATE_SELECTION' });
```

## 性能优化

1. **虚拟滚动**：对于大量模板，考虑使用 react-window
2. **防抖搜索**：搜索输入使用防抖，减少不必要的过滤操作
3. **懒加载**：媒体文件按需加载
4. **缓存**：缓存常用查询结果

## 可访问性

- 所有交互元素都有适当的 ARIA 标签
- 支持键盘导航
- 颜色对比度符合 WCAG 标准
- 表单验证提供清晰的错误提示

## 测试

建议测试场景：
1. 创建不同类型的模板
2. 编辑现有模板
3. 删除模板
4. 批量操作
5. 拖拽排序
6. 搜索和过滤
7. 表单验证
8. 错误处理

## 未来改进

1. 支持模板预览
2. 支持模板复制
3. 支持模板导入导出
4. 支持撤销/重做
5. 支持快捷键
6. 支持模板统计
7. 支持模板分享

## 相关文档

- [需求文档](../../requirements.md)
- [设计文档](../../design.md)
- [任务列表](../../tasks.md)
