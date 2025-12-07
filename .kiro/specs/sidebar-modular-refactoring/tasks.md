# Implementation Plan

## JavaScript 模块拆分

- [x] 1. 创建模块目录结构和基础模块





  - [x] 1.1 创建 `src/single-window/renderer/sidebar/` 目录结构


    - 创建必要的子目录
    - _Requirements: 1.1, 3.2_
  - [x] 1.2 实现 state.js 状态管理模块


    - 提取 accounts, activeAccountId, filterQuery, renderVersion, selectionMode, selectedAccountIds 状态
    - 实现状态访问和修改方法
    - _Requirements: 1.1, 6.1_
  - [x] 1.3 实现 utils.js 工具函数模块


    - 提取 getAccountInitial, getAccountColor, getStatusText, copyToClipboard, getFlagEmoji, showError 函数
    - 添加 debounce 工具函数
    - _Requirements: 1.1, 6.4_
  - [x] 1.4 编写 state.js 和 utils.js 的属性测试


    - **Property 1: API Interface Preservation** (部分)
    - **Validates: Requirements 1.3, 4.2**

- [x] 2. 实现渲染和IP信息模块













  - [x] 2.1 实现 render.js 渲染逻辑模块

    - 提取 renderAccountList, createAccountItem, renderStatusDot, renderQuickActions 函数
    - 提取 renderUnreadBadge, applyAccountProfileToItem, updateAccountStatus 函数
    - 提取 updateAccountRunningStatus, setActiveAccount 函数
    - _Requirements: 1.1, 6.3_

  - [x] 2.2 实现 ipInfo.js IP信息模块

    - 提取 fetchAndRenderIPInfo, renderIPDetails, renderIPError 函数
    - 提取 createEnvInfoIcon, getLocalPublicIP, getAccountUA, getProxyIPInfo 函数
    - 提取 refreshAccountIPInfo 函数
    - _Requirements: 1.1_

  - [x] 2.3 编写 render.js 的属性测试





    - **Property 3: User Interaction Equivalence** (渲染部分)
    - **Validates: Requirements 4.4**

- [x] 3. 实现事件处理和用户操作模块














  - [x] 3.1 实现 events.js IPC事件处理模块


    - 提取 setupEventListeners 函数
    - 提取所有 handle* 事件处理函数 (handleAccountsUpdated, handleAccountSwitched 等)
    - _Requirements: 1.1, 6.2_

  - [x] 3.2 实现 actions.js 用户操作模块

    - 提取 loadAccounts, handleAccountSelect, handleAddAccount, handleDeleteAccount 函数
    - 提取 handleOpenAccount, handleCloseAccount, handleRetryAccount 函数
    - 提取 saveAccountNote, openEnvironmentPanel 函数
    - 提取 mergeRunningStatuses, syncAccountStatusWithRunningStatus 函数
    - _Requirements: 1.1_

  - [x] 3.3 编写 events.js 的属性测试




    - **Property 2: IPC Event Handler Equivalence**
    - **Validates: Requirements 4.1**

- [x] 4. Checkpoint - 确保所有测试通过





  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. 实现交互模块





  - [x] 5.1 实现 contextMenu.js 右键菜单模块


    - 提取 handleContextMenu, createContextMenu, positionContextMenu 函数
    - _Requirements: 1.1, 6.5_
  - [x] 5.2 实现 selection.js 批量选择模块


    - 提取 toggleSelectionMode, selectAllAccounts, updateSelectionUI 函数
    - 提取 handleBatchStartAll, handleBatchStartSelected, handleBatchDeleteSelected 函数
    - _Requirements: 1.1, 6.6_
  - [x] 5.3 实现 sidebarToggle.js 侧边栏折叠模块


    - 提取 toggleSidebar, restoreSidebarState 函数
    - _Requirements: 1.1_

- [x] 6. 创建 JavaScript 入口文件





  - [x] 6.1 创建新的 sidebar.js 入口文件


    - 导入所有子模块
    - 实现 init 初始化函数
    - 导出 window.sidebar 公共API（保持向后兼容）
    - _Requirements: 1.3, 1.6, 4.2_
  - [x] 6.2 编写 API 兼容性属性测试


    - **Property 1: API Interface Preservation**
    - **Validates: Requirements 1.3, 4.2**

## CSS 模块拆分

- [x] 7. 创建 CSS 模块目录和基础样式





  - [x] 7.1 创建 `src/single-window/renderer/styles/` 目录


    - _Requirements: 2.1_
  - [x] 7.2 实现 base.css 基础样式模块


    - 提取 CSS Reset 样式
    - 提取 :root CSS 变量定义
    - 提取全局字体和颜色样式
    - _Requirements: 2.1, 2.4_
  - [x] 7.3 实现 layout.css 布局样式模块


    - 提取 #app, #sidebar, .sidebar-header 样式
    - 提取 #view-container, .resize-handle 样式
    - _Requirements: 2.1, 2.4_

- [x] 8. 实现组件样式模块






  - [x] 8.1 实现 accountItem.css 账号条目样式模块

    - 提取 .account-item 及其所有子元素样式
    - 提取 .account-avatar, .account-info, .account-name 等样式
    - _Requirements: 2.1, 2.4_

  - [x] 8.2 实现 buttons.css 按钮样式模块

    - 提取 .btn-primary, .btn-icon, .action-btn 样式
    - 提取 .open-btn, .close-btn, .retry-btn 样式
    - _Requirements: 2.1, 2.4_

  - [x] 8.3 实现 status.css 状态指示器样式模块

    - 提取 .status-dot 及其状态变体样式
    - 提取 .unread-badge, .spinner 样式
    - 提取 @keyframes spin, pulse 动画
    - _Requirements: 2.1, 2.4_

- [x] 9. 实现功能样式模块






  - [x] 9.1 实现 contextMenu.css 右键菜单样式模块

    - 提取 .custom-context-menu, .menu-item 样式
    - _Requirements: 2.1, 2.4_
  - [x] 9.2 实现 translatePanel.css 翻译面板样式模块


    - 提取 .translate-panel 及其所有子元素样式
    - _Requirements: 2.1, 2.4_
  - [x] 9.3 实现 selection.css 选择模式样式模块


    - 提取 .selection-action-bar, .selection-btn 样式
    - 提取 .selection-checkbox, .account-item.selected 样式
    - _Requirements: 2.1, 2.4_

- [x] 10. 实现响应式和状态样式模块





  - [x] 10.1 实现 responsive.css 响应式样式模块


    - 提取所有 @media 查询样式
    - _Requirements: 2.1, 2.4_
  - [x] 10.2 实现 collapsed.css 折叠状态样式模块


    - 提取 #sidebar[data-collapsed="true"] 相关样式
    - _Requirements: 2.1, 2.4_



- [x] 11. 创建 CSS 入口文件



  - [x] 11.1 创建新的 styles.css 入口文件


    - 使用 @import 导入所有子模块
    - _Requirements: 2.1_
  - [x] 11.2 编写 CSS 完整性属性测试


    - **Property 4: CSS Class Style Preservation**
    - **Validates: Requirements 4.5, 4.6**

- [x] 12. Checkpoint - 确保所有测试通过





  - Ensure all tests pass, ask the user if questions arise.

## 验证和文档

- [x] 13. 验证和清理






  - [x] 13.1 验证所有文件行数不超过500行

    - 检查每个 JS 模块文件行数
    - 检查每个 CSS 模块文件行数
    - _Requirements: 1.4, 2.3, 7.1_

  - [x] 13.2 验证功能完整性

    - 测试账号列表渲染
    - 测试账号操作（添加、删除、打开、关闭）
    - 测试批量选择功能
    - 测试侧边栏折叠
    - _Requirements: 4.3, 4.4, 7.5_
  - [x] 13.3 备份原始文件并替换


    - 备份原始 sidebar.js 到 archive 目录
    - 备份原始 styles.css 到 archive 目录
    - 用新的入口文件替换原始文件
    - _Requirements: 1.6_

- [x] 14. 更新文档






  - [x] 14.1 更新模块结构文档


    - 在 README 或相关文档中记录新的模块结构
    - 记录模块依赖关系
    - _Requirements: 3.1_

- [x] 15. Final Checkpoint - 确保所有测试通过





  - Ensure all tests pass, ask the user if questions arise.
