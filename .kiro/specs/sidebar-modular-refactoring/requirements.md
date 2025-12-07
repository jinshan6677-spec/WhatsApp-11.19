# Requirements Document

## Introduction

本规范定义了对 `src/single-window/renderer/sidebar.js`（约2600行）和 `src/single-window/renderer/styles.css`（约1760行）进行模块化拆分重构的需求。

**重构策略：直接拆分**
- 采用一次性直接拆分的方式，而非渐进式重构
- 原始大文件将被替换为模块入口文件（负责导入和协调各子模块）
- 所有功能代码将被移动到对应的子模块文件中

**核心保证：**
1. 拆分后不再存在超大文件（每个文件≤500行）
2. 所有原有功能100%保留，行为完全一致
3. 所有原有样式100%保留，视觉效果完全一致
4. 对外API接口（window.sidebar）保持不变

## Glossary

- **Sidebar**: 侧边栏组件，负责账号列表的渲染、选择和CRUD操作
- **Account Item**: 账号列表中的单个账号条目，包含头像、状态、操作按钮等
- **Selection Mode**: 多选模式，允许用户批量选择账号进行操作
- **Running Status**: 账号的运行状态（not_started, loading, connected, error）
- **Login Status**: 账号的登录状态（已登录/未登录/需要扫码）
- **IP Info**: 账号的网络信息，包括代理IP、本地IP、位置等
- **Context Menu**: 右键菜单，提供账号的快捷操作
- **Quick Actions**: 账号条目上的快速操作按钮（打开/关闭/重试）

## Requirements

### Requirement 1

**User Story:** As a developer, I want the sidebar.js file to be directly split into logical modules, so that I can maintain and extend the code more easily.

#### Acceptance Criteria

1. WHEN the sidebar module is loaded THEN the System SHALL initialize all sub-modules and maintain the same functionality as the original monolithic file
2. WHEN a sub-module is modified THEN the System SHALL not require changes to unrelated sub-modules
3. WHEN the sidebar API is accessed externally THEN the System SHALL expose the same `window.sidebar` interface as before (loadAccounts, renderAccountList, setActiveAccount, getAccounts, getActiveAccountId, renderQuickActions, syncAccountStatusesWithRunningStatus, toggleSidebar, toggleSelectionMode, handleBatchStartAll)
4. WHEN any module file is examined THEN the System SHALL ensure the file contains no more than 500 lines of code
5. WHEN modules are imported THEN the System SHALL use ES6 module syntax or IIFE pattern consistent with the existing codebase
6. WHEN the original sidebar.js is replaced THEN the System SHALL create a new entry file that imports and coordinates all sub-modules

### Requirement 2

**User Story:** As a developer, I want the styles.css file to be split into component-specific stylesheets, so that I can locate and modify styles more efficiently.

#### Acceptance Criteria

1. WHEN the main styles.css is loaded THEN the System SHALL import all component-specific stylesheets
2. WHEN a component's styles are modified THEN the System SHALL not affect unrelated component styles
3. WHEN any stylesheet file is examined THEN the System SHALL ensure the file contains no more than 500 lines of CSS
4. WHEN stylesheets are organized THEN the System SHALL group related styles by component or feature

### Requirement 3

**User Story:** As a developer, I want clear module boundaries and dependencies, so that I can understand the codebase architecture quickly.

#### Acceptance Criteria

1. WHEN the module structure is documented THEN the System SHALL provide a dependency relationship diagram
2. WHEN a module depends on another THEN the System SHALL explicitly declare the dependency
3. WHEN circular dependencies are detected THEN the System SHALL refactor to eliminate them
4. WHEN the module structure is reviewed THEN the System SHALL show clear separation of concerns

### Requirement 4

**User Story:** As a developer, I want the refactored code to maintain 100% backward compatibility, so that existing functionality and appearance remain unchanged.

#### Acceptance Criteria

1. WHEN the refactored sidebar is loaded THEN the System SHALL handle all existing IPC events identically to the original (accounts-updated, account-switched, account-status-changed, view-manager events, etc.)
2. WHEN external code calls `window.sidebar` methods THEN the System SHALL return the same results as before
3. WHEN the application starts THEN the System SHALL render the account list with the exact same visual appearance as before
4. WHEN user interactions occur THEN the System SHALL respond with the same behavior as the original implementation
5. WHEN the refactored styles are loaded THEN the System SHALL produce the exact same visual rendering as the original styles.css
6. WHEN any CSS class is used THEN the System SHALL apply the same styles as defined in the original file

### Requirement 5

**User Story:** As a developer, I want the build and hot-reload process to work seamlessly with the modular structure, so that development workflow is not disrupted.

#### Acceptance Criteria

1. WHEN the application is built THEN the System SHALL include all modular files in the output
2. WHEN a module file is changed during development THEN the System SHALL support hot-reload if previously supported
3. WHEN the application runs THEN the System SHALL load modules in the correct order based on dependencies

### Requirement 6

**User Story:** As a developer, I want each module to have a single responsibility, so that the code is easier to test and maintain.

#### Acceptance Criteria

1. WHEN the state management module is examined THEN the System SHALL contain only state-related logic (accounts array, activeAccountId, selection state)
2. WHEN the event handlers module is examined THEN the System SHALL contain only IPC event handling logic
3. WHEN the render module is examined THEN the System SHALL contain only DOM rendering logic
4. WHEN the utility module is examined THEN the System SHALL contain only helper functions (color generation, clipboard, etc.)
5. WHEN the context menu module is examined THEN the System SHALL contain only context menu related logic
6. WHEN the selection mode module is examined THEN the System SHALL contain only batch selection and operation logic


### Requirement 7

**User Story:** As a developer, I want verification that the refactoring is complete and correct, so that I can be confident the changes are safe.

#### Acceptance Criteria

1. WHEN the refactoring is complete THEN the System SHALL verify that no file exceeds 500 lines
2. WHEN the refactoring is complete THEN the System SHALL verify that all original functions exist in the new module structure
3. WHEN the refactoring is complete THEN the System SHALL verify that all original CSS classes and rules are preserved
4. WHEN the refactoring is complete THEN the System SHALL verify that the total line count of all modules approximately equals the original files (allowing for import/export statements)
5. WHEN the application is tested THEN the System SHALL demonstrate identical behavior to the pre-refactoring state
