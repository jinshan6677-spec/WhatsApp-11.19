# 实现计划

## 说明

本任务列表基于现有 `src/quick-reply/` 模块进行扩展，不需要重新创建基础架构。现有模块已包含：
- 管理界面组件（ui/management-interface/）
- 操作面板组件（ui/operation-panel/）
- 通用组件（ui/common/）
- 管理器（managers/）、存储（storage/）、模型（models/）等

## 任务列表

- [x] 1. 扩展数据模型和常量定义





  - [x] 1.1 扩展现有Template模型（src/quick-reply/models/Template.js）


    - 添加visibility属性（'public' | 'personal'）
    - 添加thumbnailPath字段用于媒体缩略图
    - 更新验证逻辑
    - _需求: 1.1.2, 1.1.3, 1.1.4_
  - [x] 1.2 扩展现有Config模型（src/quick-reply/models/Config.js）


    - 添加activeTab字段
    - 添加windowSize和windowPosition字段
    - 添加windowExpandedGroups字段
    - _需求: 2.6, 15.7_
  - [x] 1.3 在现有constants目录添加新常量文件


    - 创建tabTypes.js定义标签类型常量（全部/公共/个人）
    - 更新index.js导出新常量
    - _需求: 1.1.1_
  - [x] 1.4 编写属性测试：标签过滤正确性


    - **Property 1: 标签过滤正确性**
    - **验证需求: 1.1.2, 1.1.3, 1.1.4**

- [x] 2. 扩展侧边栏操作面板（src/quick-reply/ui/operation-panel/）





  - [x] 2.1 创建TabSwitcher组件


    - 在ui/operation-panel/目录创建TabSwitcher.jsx和TabSwitcher.css
    - 实现三个标签按钮：全部、公共、个人
    - 实现标签切换逻辑和高亮样式（蓝色背景）
    - _需求: 1.1.1, 1.1.5_
  - [x] 2.2 更新现有OperationPanel组件（src/quick-reply/ui/operation-panel/OperationPanel.jsx）


    - 集成TabSwitcher组件到顶部
    - 实现根据标签过滤内容的逻辑
    - 保持搜索框和分组结构显示状态
    - _需求: 1.1.6_
  - [x] 2.3 更新现有TemplateItem组件显示序号


    - 修改TemplateItem.jsx在每个内容项左侧显示序号
    - 序号从1开始连续递增
    - _需求: 1.1.8_
  - [x] 2.4 编写属性测试：序号连续性
 

    - **Property 2: 序号连续性**
    - **验证需求: 1.1.8**

- [x] 3. 创建独立管理窗口（基于现有管理界面扩展）





  - [x] 3.1 创建ManagementWindow类（src/quick-reply/ui/management-window/ManagementWindow.js）


    - 使用Electron BrowserWindow创建独立窗口
    - 设置窗口大小1200x800，最小800x600
    - 设置窗口标题"分组 专业版，可批量创建的快捷文字平台"
    - _需求: 2.1, 2.2, 2.6_
  - [x] 3.2 重构现有ManagementInterface组件为独立窗口版本


    - 复用现有ui/management-interface/组件
    - 调整布局：顶部工具栏、左侧分组面板、右侧内容区域、底部导入导出栏
    - _需求: 2.3_
  - [x] 3.3 更新QuickReplyController（src/quick-reply/controllers/QuickReplyController.js）


    - 添加openManagementWindow方法
    - 如果窗口已打开则切换焦点
    - 关闭时保存所有更改
    - _需求: 1.2, 1.4, 2.5_


- [x] 4. 扩展管理窗口顶部工具栏




  - [x] 4.1 创建新的Toolbar组件（src/quick-reply/ui/management-window/Toolbar.jsx）


    - 实现添加文本、图片、音频、视频、图文按钮
    - 按钮样式与截图一致（蓝色链接样式）
    - _需求: 2.4, 5.1_
  - [x] 4.2 扩展现有TemplateEditor组件支持文本添加


    - 复用ui/management-interface/TemplateEditor.jsx
    - 支持文本输入和保存
    - _需求: 5.2_
  - [x] 4.3 扩展TemplateEditor支持图片添加


    - 支持图片选择和预览
    - 使用现有utils/validation.js验证文件格式和大小（JPG/PNG/GIF，最大5MB）
    - _需求: 5.3, 6.1_
  - [x] 4.4 扩展TemplateEditor支持音频添加


    - 支持音频选择和预览
    - 验证文件格式和大小（MP3/WAV/OGG，最大16MB）
    - _需求: 5.4, 6.2_
  - [x] 4.5 扩展TemplateEditor支持视频添加


    - 支持视频选择和预览
    - 验证文件格式和大小（MP4/WEBM，最大64MB）
    - _需求: 5.5, 6.3_
  - [x] 4.6 扩展TemplateEditor支持图文添加


    - 同时支持图片和文本输入
    - _需求: 5.6_
  - [x] 4.7 编写属性测试：文件大小验证


    - **Property 7: 文件大小验证**
    - **验证需求: 6.1, 6.2, 6.3, 6.9**
  - [x] 4.8 编写属性测试：内容添加分组归属


    - **Property 6: 内容添加分组归属**
    - **验证需求: 5.7**


- [x] 5. Checkpoint - 确保所有测试通过




  - 确保所有测试通过，如有问题请询问用户

- [x] 6. 扩展左侧分组面板（复用现有组件）





  - [x] 6.1 复用现有GroupPanel组件（src/quick-reply/ui/management-interface/GroupPanel.jsx）


    - 确保搜索框显示"请输入关键词"
    - 确保分组树形结构显示正确
    - _需求: 2.7, 3.1_
  - [x] 6.2 确认分组展开/折叠功能正常


    - 验证展开/折叠箭头图标（▼/▶）显示
    - 验证展开时显示分组下的模板列表
    - _需求: 3.2, 3.4, 3.7_

  - [x] 6.3 更新GroupManager（src/quick-reply/managers/GroupManager.js）

    - 确保新建分组默认名称为"新分组N"
    - N为当前最大序号+1
    - _需求: 3.3_
  - [x] 6.4 扩展GroupListItem组件添加右键菜单


    - 包含新建子分组、重命名、删除、移动选项
    - _需求: 3.8_
  - [x] 6.5 确认分组拖拽排序功能（复用现有useDragDrop.js）


    - 支持分组重新排序和层级调整
    - _需求: 3.5_

  - [x] 6.6 确认删除分组功能

    - 显示确认对话框
    - 同时删除分组内的所有模板
    - _需求: 3.6_

  - [x] 6.7 编写属性测试：分组命名规则

    - **Property 4: 分组命名规则**
    - **验证需求: 3.3**

- [x] 7. 扩展右侧内容区域（复用现有组件）






  - [x] 7.1 复用现有ContentArea组件（src/quick-reply/ui/management-interface/ContentArea.jsx）

    - 调整为网格布局显示内容
    - 支持内容选中状态
    - _需求: 4.1, 4.8, 4.10_
  - [x] 7.2 创建ContentCard组件（src/quick-reply/ui/management-window/ContentCard.jsx）


    - 根据内容类型显示不同预览
    - 图片显示缩略图
    - 视频显示播放器和时长
    - 音频显示播放控件（0:00/0:04格式），复用现有MediaPlayer组件
    - 文本显示文本框
    - _需求: 4.2, 4.3, 4.4, 4.5, 4.6_
  - [x] 7.3 添加内容删除功能


    - 在内容项右上角显示删除按钮（"+"图标）
    - _需求: 4.7_
  - [x] 7.4 实现空状态提示


    - 当分组为空时显示提示信息
    - _需求: 4.9_
  - [x] 7.5 编写属性测试：内容类型展示正确性


    - **Property 5: 内容类型展示正确性**
    - **验证需求: 4.3, 4.4, 4.5, 4.6**

- [x] 8. 实现数据同步功能





  - [x] 8.1 创建SyncManager类（src/quick-reply/managers/SyncManager.js）


    - 实现发布-订阅模式
    - 支持多个订阅者
    - 更新managers/index.js导出
    - _需求: 1.2.1-1.2.7_
  - [x] 8.2 实现分组变更同步


    - 管理窗口修改分组后同步到侧边栏
    - _需求: 1.2.3_
  - [x] 8.3 实现内容变更同步


    - 管理窗口添加/删除/编辑内容后同步到侧边栏
    - _需求: 1.2.1, 1.2.2, 1.2.5_
  - [x] 8.4 集成现有StatisticsManager实现使用统计同步


    - 侧边栏使用快捷回复后更新管理窗口统计
    - _需求: 1.2.4_
  - [x] 8.5 编写属性测试：数据同步一致性


    - **Property 3: 数据同步一致性**
    - **验证需求: 1.2.1, 1.2.2, 1.2.3, 1.2.5**

- [x] 9. Checkpoint - 确保所有测试通过





  - 确保所有测试通过，如有问题请询问用户

- [x] 10. 扩展搜索功能（复用现有utils/search.js）
  - [x] 10.1 确认管理窗口搜索功能
    - 复用现有SearchBox组件
    - 实时过滤分组和内容
    - _需求: 7.1, 7.2_
  - [x] 10.2 实现搜索结果高亮
    - 高亮显示匹配的内容
    - _需求: 7.4_
  - [x] 10.3 确认搜索清空功能
    - 清空搜索框后恢复显示所有内容
    - _需求: 7.5_
  - [x] 10.4 实现无结果提示
    - 搜索无结果时显示提示信息
    - _需求: 7.6_
  - [x] 10.5 编写属性测试：搜索结果正确性
    - **Property 8: 搜索结果正确性**
    - **验证需求: 7.2, 7.3, 7.4**
  - [x] 10.6 编写属性测试：搜索清空往返一致性
    - **Property 9: 搜索清空往返一致性**
    - **验证需求: 7.5**

- [x] 11. 确认批量操作功能（复用现有BatchOperations组件）
  - [x] 11.1 确认多选功能
    - 复用现有ui/management-interface/BatchOperations.jsx
    - 支持勾选多个模板
    - 显示已选择数量
    - _需求: 8.1, 8.2_
  - [x] 11.2 确认全选/取消选择
    - 全选当前分组所有模板
    - 取消所有选中状态
    - _需求: 8.3, 8.4_
  - [x] 11.3 确认批量删除
    - 显示确认对话框
    - 删除所有选中模板
    - _需求: 8.5, 8.6_
  - [x] 11.4 确认批量移动
    - 显示分组选择对话框
    - 移动选中模板到目标分组
    - _需求: 8.7, 8.8_
  - [x] 11.5 编写属性测试：批量删除完整性
    - **Property 10: 批量删除完整性**
    - **验证需求: 8.6**

- [x] 12. 实现导入导出功能
  - [x] 12.1 创建ImportExportBar组件（src/quick-reply/ui/management-window/ImportExportBar.jsx）
    - 显示"我要导入"和"我要导出"按钮
    - 使用蓝色背景按钮样式
    - _需求: 9.1, 9.9_
  - [x] 12.2 扩展现有导出功能（复用utils/file.js）
    - 创建ExportDialog对话框
    - 支持导出全部、当前分组、选中项
    - 支持JSON和ZIP格式
    - _需求: 9.2, 9.3, 9.4_
  - [x] 12.3 扩展现有导入功能
    - 创建ImportDialog对话框
    - 支持JSON和ZIP文件
    - 验证文件格式和数据完整性
    - _需求: 9.5, 9.6_
  - [x] 12.4 实现冲突解决
    - 显示冲突解决对话框
    - 提供跳过、覆盖、重命名选项
    - _需求: 9.7_
  - [x] 12.5 实现导入结果报告
    - 显示成功和失败数量
    - _需求: 9.8_
  - [x] 12.6 编写属性测试：导入导出往返一致性
    - **Property 11: 导入导出往返一致性**
    - **验证需求: 9.1-9.8**

- [x] 13. Checkpoint - 确保所有测试通过
  - 确保所有测试通过，如有问题请询问用户

- [x] 14. 确认使用统计功能（复用现有StatisticsManager）
  - [x] 14.1 确认使用次数记录
    - 复用现有managers/StatisticsManager.js
    - 每次发送后增加usageCount
    - _需求: 11.1_
  - [x] 14.2 确认使用次数显示
    - 复用现有ui/management-interface/TemplateUsageStats.jsx
    - 在模板列表中显示使用次数
    - _需求: 11.1_
  - [x] 14.3 编写属性测试：使用统计递增
    - **Property 12: 使用统计递增**
    - **验证需求: 11.1**

- [x] 15. 确认账号数据隔离（复用现有AccountSwitchHandler）
  - [x] 15.1 确认存储层账号隔离
    - 复用现有handlers/AccountSwitchHandler.js
    - 使用accountId作为数据命名空间
    - _需求: 16.9_
  - [x] 15.2 确认账号切换时数据加载
    - 切换账号时自动加载对应数据
    - _需求: 16.9_
  - [x] 15.3 编写属性测试：账号数据隔离
    - **Property 13: 账号数据隔离**
    - **验证需求: 16.9**

- [x] 16. 确认侧边栏发送功能（复用现有SendManager）
  - [x] 16.1 确认ActionButtons组件功能
    - 复用现有ui/operation-panel/TemplateItem.jsx中的发送按钮
    - 确认"发送"按钮功能正常
    - 确认"输入框提示"按钮功能正常
    - _需求: 1.1.9_
  - [x] 16.2 确认发送管理器集成
    - 复用现有managers/SendManager.js
    - 更新使用统计
    - _需求: 1.1.9, 11.1_

- [x] 17. 实现用户体验优化
  - [x] 17.1 实现操作反馈
    - 按钮点击效果
    - 加载状态显示
    - _需求: 17.1, 17.5_
  - [x] 17.2 实现确认对话框
    - 删除操作确认
    - _需求: 17.3_
  - [x] 17.3 实现成功/错误提示
    - 操作成功提示
    - 错误信息显示
    - _需求: 17.6, 17.7_
  - [x] 17.4 实现拖拽预览
    - 拖拽时显示预览效果
    - _需求: 17.4_

- [x] 18. Final Checkpoint - 确保所有测试通过
  - 确保所有测试通过，如有问题请询问用户
