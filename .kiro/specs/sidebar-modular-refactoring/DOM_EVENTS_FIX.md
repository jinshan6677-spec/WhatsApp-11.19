# DOM事件监听器修复

## 问题描述

模块化重构后，应用启动正常但所有按钮功能都不能使用，包括：
- 添加账号按钮
- 批量启动按钮
- 选择模式按钮
- 搜索输入框
- 侧边栏折叠按钮
- 选择操作栏按钮

## 根本原因

在将 `sidebar.js` 拆分为模块时，**DOM事件监听器的设置代码被遗漏了**。

### 原始代码结构
在原始的单体文件中，有一个 `setupEventListeners()` 函数负责：
1. 绑定所有按钮的点击事件
2. 绑定搜索输入框的input事件
3. 设置IPC事件监听器

```javascript
function setupEventListeners() {
  // DOM事件
  addAccountBtn.addEventListener('click', handleAddAccount);
  batchStartBtn.addEventListener('click', handleBatchStartAll);
  selectionModeBtn.addEventListener('click', toggleSelectionMode);
  // ... 等等
  
  // IPC事件
  window.electronAPI.on('accounts-updated', handleAccountsUpdated);
  // ... 等等
}
```

### 模块化后的问题
拆分时：
- ✅ IPC事件监听器被正确迁移到 `events.js` 模块
- ❌ DOM事件监听器（按钮点击等）**完全遗漏**，没有迁移到任何模块

结果：
- 应用可以正常启动和渲染
- IPC通信正常（可以接收主进程的事件）
- 但用户点击任何按钮都没有反应

## 解决方案

在 `sidebar.js` 入口文件的 `init()` 函数中添加 `setupDOMEventListeners()` 函数，负责绑定所有DOM事件：

### 修改内容

**文件**: `src/single-window/renderer/sidebar.js`

**添加的函数**:
```javascript
/**
 * Setup DOM event listeners for sidebar buttons and inputs
 */
function setupDOMEventListeners() {
  // 添加账号按钮
  const addAccountBtn = document.getElementById('add-account');
  if (addAccountBtn && window.SidebarActions) {
    addAccountBtn.addEventListener('click', window.SidebarActions.handleAddAccount);
  }

  // 搜索输入框（带防抖）
  const searchInput = document.getElementById('account-search');
  if (searchInput && window.SidebarState && window.SidebarRender) {
    let searchDebounceTimer = null;
    searchInput.addEventListener('input', (e) => {
      const filterQuery = e.target.value.trim().toLowerCase();
      window.SidebarState.setFilterQuery(filterQuery);
      
      if (searchDebounceTimer) {
        clearTimeout(searchDebounceTimer);
      }
      searchDebounceTimer = setTimeout(() => {
        searchDebounceTimer = null;
        window.SidebarRender.renderAccountList();
      }, 150);
    });
  }

  // 侧边栏折叠按钮
  const sidebarToggleBtn = document.getElementById('sidebar-toggle');
  if (sidebarToggleBtn && window.SidebarToggle) {
    sidebarToggleBtn.addEventListener('click', window.SidebarToggle.toggleSidebar);
  }

  // 批量启动按钮
  const batchStartBtn = document.getElementById('batch-start');
  if (batchStartBtn && window.SidebarActions) {
    batchStartBtn.addEventListener('click', window.SidebarActions.handleBatchStartAll);
  }

  // 选择模式按钮
  const selectionModeBtn = document.getElementById('selection-mode-btn');
  if (selectionModeBtn && window.SidebarSelection) {
    selectionModeBtn.addEventListener('click', window.SidebarSelection.toggleSelectionMode);
  }

  // 选择操作栏按钮（事件委托）
  const selectionActionBar = document.getElementById('selection-action-bar');
  if (selectionActionBar && window.SidebarSelection) {
    selectionActionBar.addEventListener('click', (e) => {
      const btn = e.target.closest('.selection-btn');
      if (!btn) return;
      
      const action = btn.dataset.action;
      switch (action) {
        case 'select-all':
          window.SidebarSelection.selectAllAccounts();
          break;
        case 'start-selected':
          window.SidebarSelection.handleBatchStartSelected();
          break;
        case 'delete-selected':
          window.SidebarSelection.handleBatchDeleteSelected();
          break;
        case 'cancel':
          window.SidebarSelection.toggleSelectionMode();
          break;
      }
    });
  }

  console.log('[Sidebar] DOM event listeners setup complete');
}
```

**在 init() 函数中调用**:
```javascript
async function init() {
  try {
    await waitForModules();
    console.log('[Sidebar] All modules loaded, initializing...');

    // 添加这一行 - 设置DOM事件监听器
    setupDOMEventListeners();

    // Setup IPC event listeners
    if (window.SidebarEvents && typeof window.SidebarEvents.setupEventListeners === 'function') {
      window.SidebarEvents.setupEventListeners();
    }

    // ... 其余初始化代码
  } catch (error) {
    console.error('[Sidebar] Initialization failed:', error);
  }
}
```

## 绑定的事件列表

| 元素ID | 事件类型 | 处理函数 | 所属模块 |
|--------|---------|---------|---------|
| `add-account` | click | `handleAddAccount` | SidebarActions |
| `account-search` | input | 搜索过滤（防抖） | SidebarState + SidebarRender |
| `sidebar-toggle` | click | `toggleSidebar` | SidebarToggle |
| `batch-start` | click | `handleBatchStartAll` | SidebarActions |
| `selection-mode-btn` | click | `toggleSelectionMode` | SidebarSelection |
| `selection-action-bar` | click | 事件委托处理多个按钮 | SidebarSelection |

## 验证步骤

修复后，请测试以下功能：

### 1. 添加账号
- [ ] 点击 "+" 按钮
- [ ] 应该弹出账号创建对话框或直接创建账号

### 2. 搜索功能
- [ ] 在搜索框输入文字
- [ ] 账号列表应该实时过滤

### 3. 侧边栏折叠
- [ ] 点击 "«" 按钮
- [ ] 侧边栏应该折叠/展开

### 4. 批量启动
- [ ] 点击 "⚡" 按钮
- [ ] 所有未运行的账号应该开始启动

### 5. 选择模式
- [ ] 点击 "☑" 按钮
- [ ] 进入选择模式，显示复选框
- [ ] 底部显示操作栏
- [ ] 可以选择账号并执行批量操作

### 6. 账号操作
- [ ] 点击账号条目上的"打开"按钮
- [ ] 账号应该开始加载
- [ ] 点击"关闭"按钮应该关闭账号

## 技术说明

### 为什么放在 sidebar.js 而不是单独模块？

1. **职责清晰**: `sidebar.js` 作为入口文件，负责协调所有模块的初始化
2. **依赖关系**: DOM事件监听器需要访问多个模块（Actions, Selection, Toggle等）
3. **初始化顺序**: 必须在所有模块加载完成后才能绑定事件
4. **向后兼容**: 保持与原始代码相似的初始化流程

### 事件委托的使用

对于 `selection-action-bar`，使用了事件委托模式：
- 只在父元素上绑定一个监听器
- 通过 `e.target.closest('.selection-btn')` 找到被点击的按钮
- 根据 `data-action` 属性分发到不同的处理函数

优点：
- 减少事件监听器数量
- 动态添加的按钮也能响应事件
- 更好的性能

## 状态

✅ **已修复** - DOM事件监听器已添加到 `sidebar.js` 入口文件

所有按钮功能现在应该可以正常使用了。
