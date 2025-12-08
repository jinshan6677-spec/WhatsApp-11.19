# Profile Extraction Technical Summary

## Overview
This document summarizes the technical implementation of the WhatsApp profile extraction feature. The goal is to automatically extract the logged-in user's profile name (nickname) and avatar URL without user intervention, ensuring that the account list in the application reflects the actual WhatsApp profile.

## Current Strategy: v6.0 精简版

经过多轮测试和优化，我们采用了一个精简但高效的两步提取策略。

### 昵称提取

#### 方案 1：智能 LocalStorage 扫描（主方案，静默）
- **原理**：WhatsApp Web 会将用户昵称以 Base64 编码的 Key 存储在 `localStorage` 中。
- **方法**：
  1. 遍历所有 `localStorage` 条目
  2. 应用智能过滤规则排除技术数据：
     - 排除已知非名字 Key（如 `mutex`, `Session`, `last-wid`, `Lang`, `Hash` 等）
     - 排除已知非名字值（如 `NOT_ACCEPTED`, `ACCEPTED`, `migrated` 等）
     - 排除纯数字、过长字符串、包含特殊字符的值
  3. 剩余的短字符串候选即为昵称
- **优点**：完全静默，无界面操作，速度极快
- **成功率**：~95%（实测两个不同账号均成功）

#### 方案 2：DOM 点击（备用方案）
- **触发条件**：仅当方案 1 未能提取到昵称时执行
- **方法**：
  1. 定位 `<header>` 中的头像图片
  2. 点击打开个人资料面板
  3. 等待 1.2 秒动画完成
  4. 扫描"姓名"/"Your name"/"Name"/"Nama"标签
  5. 从兄弟元素或父元素中提取名字
  6. 关闭面板（点击返回按钮或发送 Escape 键）
- **优点**：成功率高（只要 UI 可见就能抓取）
- **缺点**：用户可见面板闪烁

### 头像提取

#### IndexedDB 优先
- **来源**：`model-storage` 数据库的 `profile-pic-thumb` 存储
- **方法**：根据手机号 (`rawPhone + '@c.us'`) 匹配记录，提取 `eurl` 或 `imgFull` 字段
- **优点**：静默，高精度

#### 页面扫描备用
- **来源**：页面上的 `<img>` 标签
- **方法**：查找 `src` 包含 `pps.whatsapp.net` 和手机号的图片
- **优点**：无需数据库访问

## 已废弃的方案

以下方案因效果不佳或复杂度过高已被移除：

1. **IndexedDB `contact` 表昵称提取**
   - 问题：部分账号的 `pushname`/`name` 字段为空
   
2. **Webpack 模块注入**
   - 问题：内部模块结构经常变化，维护成本高

3. **固定 LocalStorage Key**
   - 问题：Key 值是随机 Base64 编码，每个账号不同

## 数据流

```
┌─────────────────┐
│  BrowserView    │
│  (WhatsApp Web) │
└────────┬────────┘
         │ 提取脚本运行
         ▼
┌─────────────────┐
│ LocalStorage    │───▶ 昵称
│ 智能扫描        │
└────────┬────────┘
         │ 如果失败
         ▼
┌─────────────────┐
│ DOM 点击提取    │───▶ 昵称
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ IndexedDB       │───▶ 头像 URL
│ profile-pic-thumb│
└────────┬────────┘
         │ electronAPI.invoke('view:update-profile')
         ▼
┌─────────────────┐
│ Main Process    │
│ AccountIPCHandlers│
└────────┬────────┘
         │ 持久化 + IPC 事件
         ▼
┌─────────────────┐
│ Sidebar Renderer│───▶ 更新账号卡片
└─────────────────┘
```

## 版本历史

| 版本 | 描述 |
|------|------|
| v1.0 | 纯 DOM 解析（因不稳定废弃） |
| v2.0 | 仅 IndexedDB（漏掉 LID 记录） |
| v3.0 | IndexedDB + Webpack 注入 |
| v4.0 | 添加固定 LocalStorage Key |
| v5.0 | 四重提取（IDB → Webpack → LS → DOM） |
| **v6.0** | **精简版：智能 LS 扫描 + DOM 备用** |

## 核心代码位置

- `src/scripts/whatsapp-profile-autoextract.js` - 提取脚本
- `src/presentation/preload-view.js` - 脚本注入
- `src/presentation/ipc/handlers/AccountIPCHandlers.js` - IPC 处理
- `src/single-window/renderer/sidebar/render.js` - 侧边栏渲染
