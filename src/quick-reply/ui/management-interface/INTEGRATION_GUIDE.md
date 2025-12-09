# 管理界面集成指南

## 快速开始

### 1. 导入组件

```javascript
import { 
  ManagementInterface, 
  ManagementInterfaceProvider 
} from './ui/management-interface';
```

### 2. 创建控制器实例

```javascript
import QuickReplyController from './controllers/QuickReplyController';

const controller = new QuickReplyController(
  accountId,
  translationService,
  whatsappWebInterface
);
```

### 3. 使用组件

```javascript
function App() {
  const [showManagement, setShowManagement] = useState(false);

  return (
    <div>
      <button onClick={() => setShowManagement(true)}>
        打开管理界面
      </button>

      {showManagement && (
        <ManagementInterfaceProvider controller={controller}>
          <ManagementInterface 
            onClose={() => setShowManagement(false)} 
          />
        </ManagementInterfaceProvider>
      )}
    </div>
  );
}
```

## 完整示例

### 基础集成

```javascript
import React, { useState } from 'react';
import { 
  ManagementInterface, 
  ManagementInterfaceProvider 
} from './ui/management-interface';
import QuickReplyController from './controllers/QuickReplyController';

function QuickReplyApp({ accountId, translationService, whatsappWebInterface }) {
  const [showManagement, setShowManagement] = useState(false);
  
  // 创建控制器实例
  const controller = new QuickReplyController(
    accountId,
    translationService,
    whatsappWebInterface
  );

  const handleOpenManagement = () => {
    setShowManagement(true);
  };

  const handleCloseManagement = () => {
    setShowManagement(false);
  };

  return (
    <div className="quick-reply-app">
      {/* 主界面 */}
      <div className="main-content">
        <button onClick={handleOpenManagement}>
          管理快捷回复
        </button>
      </div>

      {/* 管理界面 */}
      {showManagement && (
        <ManagementInterfaceProvider controller={controller}>
          <ManagementInterface onClose={handleCloseManagement} />
        </ManagementInterfaceProvider>
      )}
    </div>
  );
}

export default QuickReplyApp;
```

### 与操作面板集成

```javascript
import React, { useState } from 'react';
import { 
  ManagementInterface, 
  ManagementInterfaceProvider 
} from './ui/management-interface';
import { 
  OperationPanel, 
  OperationPanelProvider 
} from './ui/operation-panel';
import QuickReplyController from './controllers/QuickReplyController';

function QuickReplySystem({ accountId, translationService, whatsappWebInterface }) {
  const [showManagement, setShowManagement] = useState(false);
  const [showOperation, setShowOperation] = useState(false);
  
  const controller = new QuickReplyController(
    accountId,
    translationService,
    whatsappWebInterface
  );

  return (
    <div className="quick-reply-system">
      {/* 操作面板 */}
      {showOperation && (
        <OperationPanelProvider controller={controller}>
          <OperationPanel 
            onClose={() => setShowOperation(false)}
            onManagementClick={() => {
              setShowOperation(false);
              setShowManagement(true);
            }}
          />
        </OperationPanelProvider>
      )}

      {/* 管理界面 */}
      {showManagement && (
        <ManagementInterfaceProvider controller={controller}>
          <ManagementInterface 
            onClose={() => setShowManagement(false)} 
          />
        </ManagementInterfaceProvider>
      )}
    </div>
  );
}

export default QuickReplySystem;
```

## 高级用法

### 访问管理界面状态

```javascript
import { useManagementInterface } from './ui/management-interface';

function CustomComponent() {
  const { state, dispatch, controller } = useManagementInterface();

  // 访问状态
  console.log('Selected group:', state.selectedGroupId);
  console.log('Templates:', state.templates);

  // 更新状态
  const selectGroup = (groupId) => {
    dispatch({ type: 'SET_SELECTED_GROUP', payload: groupId });
  };

  // 调用控制器方法
  const createTemplate = async () => {
    const template = await controller.templateManager.createTemplate(
      state.selectedGroupId,
      'text',
      '新模板',
      { text: '模板内容' }
    );
    
    // 重新加载模板
    const templates = await controller.templateManager.getAllTemplates();
    dispatch({ type: 'SET_TEMPLATES', payload: templates });
  };

  return (
    <div>
      <button onClick={createTemplate}>创建模板</button>
    </div>
  );
}
```

### 自定义事件处理

```javascript
function App() {
  const [showManagement, setShowManagement] = useState(false);

  const handleTemplateCreated = (template) => {
    console.log('Template created:', template);
    // 执行自定义逻辑
  };

  const handleTemplateDeleted = (templateId) => {
    console.log('Template deleted:', templateId);
    // 执行自定义逻辑
  };

  return (
    <ManagementInterfaceProvider 
      controller={controller}
      onTemplateCreated={handleTemplateCreated}
      onTemplateDeleted={handleTemplateDeleted}
    >
      <ManagementInterface onClose={() => setShowManagement(false)} />
    </ManagementInterfaceProvider>
  );
}
```

## 状态管理

### 可用的 Actions

```javascript
// 界面控制
dispatch({ type: 'OPEN_INTERFACE' });
dispatch({ type: 'CLOSE_INTERFACE' });

// 分组选择
dispatch({ type: 'SET_SELECTED_GROUP', payload: groupId });

// 模板选择
dispatch({ type: 'TOGGLE_TEMPLATE_SELECTION', payload: templateId });
dispatch({ type: 'CLEAR_TEMPLATE_SELECTION' });
dispatch({ type: 'SELECT_ALL_TEMPLATES' });

// 分组选择
dispatch({ type: 'TOGGLE_GROUP_SELECTION', payload: groupId });
dispatch({ type: 'CLEAR_GROUP_SELECTION' });

// 标签页切换
dispatch({ type: 'SET_ACTIVE_TAB', payload: 'text' });

// 数据更新
dispatch({ type: 'SET_TEMPLATES', payload: templates });
dispatch({ type: 'SET_GROUPS', payload: groups });
dispatch({ type: 'SET_FILTERED_TEMPLATES', payload: filteredTemplates });

// 搜索
dispatch({ type: 'SET_SEARCH_KEYWORD', payload: keyword });

// 加载状态
dispatch({ type: 'SET_LOADING', payload: true });
dispatch({ type: 'SET_ERROR', payload: errorMessage });

// 模板编辑器
dispatch({ type: 'SHOW_TEMPLATE_EDITOR', payload: template });
dispatch({ type: 'HIDE_TEMPLATE_EDITOR' });

// 重置状态
dispatch({ type: 'RESET_STATE' });
```

### 状态结构

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

## 样式定制

### 覆盖默认样式

```css
/* 自定义管理界面样式 */
.management-interface {
  /* 覆盖背景色 */
  background-color: rgba(0, 0, 0, 0.7);
}

.management-interface-container {
  /* 覆盖容器样式 */
  max-width: 1400px;
  border-radius: 12px;
}

/* 自定义按钮样式 */
.management-header-button {
  /* 覆盖按钮样式 */
}
```

### 使用 CSS 变量

```css
:root {
  --management-primary-color: #007bff;
  --management-background-color: #ffffff;
  --management-border-color: #e0e0e0;
  --management-text-color: #212529;
}
```

## 错误处理

### 捕获错误

```javascript
function App() {
  const handleError = (error) => {
    console.error('Management interface error:', error);
    // 显示错误提示
    alert(`错误：${error.message}`);
  };

  return (
    <ManagementInterfaceProvider 
      controller={controller}
      onError={handleError}
    >
      <ManagementInterface onClose={() => setShowManagement(false)} />
    </ManagementInterfaceProvider>
  );
}
```

### 错误边界

```javascript
import React from 'react';

class ManagementErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Management interface error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return <h1>管理界面出错了，请刷新页面重试。</h1>;
    }

    return this.props.children;
  }
}

// 使用
<ManagementErrorBoundary>
  <ManagementInterfaceProvider controller={controller}>
    <ManagementInterface onClose={handleClose} />
  </ManagementInterfaceProvider>
</ManagementErrorBoundary>
```

## 性能优化

### 懒加载

```javascript
import React, { lazy, Suspense } from 'react';

const ManagementInterface = lazy(() => 
  import('./ui/management-interface').then(module => ({
    default: module.ManagementInterface
  }))
);

function App() {
  return (
    <Suspense fallback={<div>加载中...</div>}>
      <ManagementInterfaceProvider controller={controller}>
        <ManagementInterface onClose={handleClose} />
      </ManagementInterfaceProvider>
    </Suspense>
  );
}
```

### 虚拟滚动

对于大量模板，建议使用虚拟滚动：

```javascript
import { FixedSizeList } from 'react-window';

function TemplateListView() {
  const { state } = useManagementInterface();

  return (
    <FixedSizeList
      height={600}
      itemCount={state.filteredTemplates.length}
      itemSize={80}
      width="100%"
    >
      {({ index, style }) => (
        <div style={style}>
          <TemplateListItem template={state.filteredTemplates[index]} />
        </div>
      )}
    </FixedSizeList>
  );
}
```

## 测试

### 单元测试示例

```javascript
import { render, screen, fireEvent } from '@testing-library/react';
import { ManagementInterface, ManagementInterfaceProvider } from './management-interface';

describe('ManagementInterface', () => {
  const mockController = {
    templateManager: {
      getAllTemplates: jest.fn().mockResolvedValue([]),
    },
    groupManager: {
      getAllGroups: jest.fn().mockResolvedValue([]),
    },
  };

  test('renders management interface', () => {
    render(
      <ManagementInterfaceProvider controller={mockController}>
        <ManagementInterface onClose={() => {}} />
      </ManagementInterfaceProvider>
    );

    expect(screen.getByText('快捷回复')).toBeInTheDocument();
  });

  test('closes on close button click', () => {
    const handleClose = jest.fn();
    
    render(
      <ManagementInterfaceProvider controller={mockController}>
        <ManagementInterface onClose={handleClose} />
      </ManagementInterfaceProvider>
    );

    fireEvent.click(screen.getByLabelText('关闭管理界面'));
    expect(handleClose).toHaveBeenCalled();
  });
});
```

## 常见问题

### Q: 如何在管理界面中添加自定义功能？

A: 可以通过扩展控制器或创建自定义组件来添加功能。

### Q: 如何处理大量模板的性能问题？

A: 使用虚拟滚动（react-window）和懒加载来优化性能。

### Q: 如何自定义样式？

A: 可以通过覆盖 CSS 类或使用 CSS 变量来自定义样式。

### Q: 如何集成到现有应用？

A: 参考本文档的"完整示例"部分，将管理界面作为独立组件集成。

## 相关资源

- [组件文档](./README.md)
- [任务总结](./TASK-10-SUMMARY.md)
- [演示示例](./demo.jsx)
- [需求文档](../../requirements.md)
- [设计文档](../../design.md)
