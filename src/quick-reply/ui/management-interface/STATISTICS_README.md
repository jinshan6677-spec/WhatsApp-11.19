# 使用统计功能 (Usage Statistics Feature)

## 概述

使用统计功能为快捷回复系统提供了全面的模板使用分析能力，帮助客服主管了解哪些模板最常用，从而优化模板库。

## 功能特性

### 1. 使用记录 (Requirement 15.1)

每次使用模板发送消息时，系统会自动记录：
- 使用次数递增
- 最后使用时间更新

```javascript
// 记录模板使用
await templateManager.recordUsage(templateId);
```

### 2. 模板详情统计 (Requirement 15.2)

在管理界面查看模板详情时，显示：
- 使用次数
- 最后使用时间
- 创建时间
- 相对时间（如"2小时前"）

### 3. 统计报告 (Requirement 15.3)

点击"统计"按钮显示完整的使用统计报告，包括：
- 总模板数
- 总使用次数
- 平均使用次数
- 未使用模板数量
- 最常用模板高亮显示

### 4. 排序功能 (Requirement 15.4)

统计报告中的模板按使用次数降序排列，最常用的模板显示在最前面。

### 5. 使用率计算 (Requirement 15.5)

每个模板显示：
- 使用次数
- 使用率（占总发送次数的百分比）

### 6. 模板导航 (Requirement 15.6)

在统计报告中点击模板可以跳转到该模板的详情页面。

### 7. 数据清理 (Requirement 15.7)

删除模板时，自动删除该模板的使用统计数据。

## 组件说明

### StatisticsManager

统计管理器，负责生成各种统计报告。

**主要方法：**

```javascript
// 生成完整统计报告
const report = await statisticsManager.generateReport();

// 生成分组统计报告
const groupReport = await statisticsManager.generateGroupReport(groupId);

// 获取最常用的N个模板
const topTemplates = await statisticsManager.getTopTemplates(10);

// 获取未使用的模板
const unusedTemplates = await statisticsManager.getUnusedTemplates();

// 获取最近使用的模板
const recentTemplates = await statisticsManager.getRecentlyUsedTemplates(10);
```

### StatisticsReport 组件

显示完整的统计报告界面。

**Props:**
- `statisticsManager`: StatisticsManager 实例
- `onTemplateClick`: 点击模板时的回调函数
- `onClose`: 关闭报告时的回调函数

**功能：**
- 显示汇总统计卡片
- 高亮显示最常用模板
- 提供过滤选项（全部/Top 10/未使用/最近使用）
- 表格展示详细数据
- 支持刷新和关闭

### TemplateUsageStats 组件

在模板详情中显示使用统计。

**Props:**
- `template`: 模板对象

**显示内容：**
- 使用次数（大数字显示）
- 最后使用时间（绝对时间和相对时间）
- 创建时间
- 未使用提示（如果从未使用）

## 使用示例

### 1. 在管理界面集成统计报告

```jsx
import StatisticsReport from './StatisticsReport';
import StatisticsManager from '../../managers/StatisticsManager';

function ManagementInterface({ accountId }) {
  const [showStats, setShowStats] = useState(false);
  const statsManager = new StatisticsManager(accountId);

  const handleShowStats = () => {
    setShowStats(true);
  };

  const handleTemplateClick = (templateId) => {
    // 跳转到模板详情
    navigateToTemplate(templateId);
  };

  return (
    <div>
      <button onClick={handleShowStats}>查看统计</button>
      
      {showStats && (
        <StatisticsReport
          statisticsManager={statsManager}
          onTemplateClick={handleTemplateClick}
          onClose={() => setShowStats(false)}
        />
      )}
    </div>
  );
}
```

### 2. 在模板详情中显示统计

```jsx
import TemplateUsageStats from './TemplateUsageStats';

function TemplateDetails({ template }) {
  return (
    <div>
      <h2>{template.label}</h2>
      <div>{template.content.text}</div>
      
      <TemplateUsageStats template={template} />
    </div>
  );
}
```

### 3. 记录模板使用

```javascript
// 在发送模板时记录使用
async function sendTemplate(templateId) {
  // 发送消息
  await whatsappWeb.sendMessage(content);
  
  // 记录使用
  await templateManager.recordUsage(templateId);
}
```

## 数据结构

### 统计报告格式

```javascript
{
  totalTemplates: 25,              // 总模板数
  totalUsageCount: 150,            // 总使用次数
  averageUsageCount: '6.00',       // 平均使用次数
  mostUsedTemplate: {              // 最常用模板
    id: 't1',
    label: '早安问候',
    type: 'text',
    usageCount: 45,
    usageRate: '30.00',
    lastUsedAt: 1234567890,
    createdAt: 1234567890
  },
  leastUsedTemplate: { ... },      // 最少使用模板
  unusedTemplates: 5,              // 未使用模板数
  templates: [                     // 所有模板（按使用次数降序）
    {
      id: 't1',
      groupId: 'g1',
      type: 'text',
      label: '早安问候',
      usageCount: 45,
      usageRate: '30.00',
      lastUsedAt: 1234567890,
      createdAt: 1234567890
    },
    // ... 更多模板
  ],
  generatedAt: 1234567890          // 报告生成时间
}
```

## 测试

### 运行单元测试

```bash
npm test -- statistics.test.js
```

### 运行验证脚本

```bash
node src/quick-reply/ui/management-interface/verify-statistics.js
```

### 查看演示页面

在浏览器中打开：
```
src/quick-reply/ui/management-interface/statistics-demo.html
```

## 性能考虑

1. **缓存策略**：统计报告可以缓存一段时间，避免频繁计算
2. **分页加载**：大量模板时使用虚拟滚动或分页
3. **异步计算**：统计计算在后台线程进行，不阻塞UI
4. **增量更新**：使用记录时只更新单个模板，不重新计算整个报告

## 未来扩展

1. **时间范围过滤**：支持查看特定时间段的统计
2. **图表可视化**：使用图表展示使用趋势
3. **导出报告**：支持导出统计报告为PDF或Excel
4. **对比分析**：对比不同时间段或不同账号的使用情况
5. **智能推荐**：基于使用统计推荐常用模板
6. **使用热力图**：显示一天中不同时段的使用情况

## 故障排查

### 问题：使用次数没有更新

**解决方案：**
1. 检查是否正确调用了 `recordUsage` 方法
2. 确认模板ID正确
3. 检查存储层是否正常工作

### 问题：统计报告显示不正确

**解决方案：**
1. 刷新报告重新生成
2. 检查模板数据是否完整
3. 验证计算逻辑是否正确

### 问题：删除模板后统计数据仍然存在

**解决方案：**
1. 确认使用了正确的删除方法
2. 检查存储层的删除操作是否成功
3. 手动清理残留数据

## 相关文件

- `src/quick-reply/managers/StatisticsManager.js` - 统计管理器
- `src/quick-reply/ui/management-interface/StatisticsReport.jsx` - 统计报告组件
- `src/quick-reply/ui/management-interface/StatisticsReport.css` - 统计报告样式
- `src/quick-reply/ui/management-interface/TemplateUsageStats.jsx` - 模板统计组件
- `src/quick-reply/ui/management-interface/TemplateUsageStats.css` - 模板统计样式
- `src/quick-reply/__tests__/statistics.test.js` - 单元测试
- `src/quick-reply/ui/management-interface/verify-statistics.js` - 验证脚本
- `src/quick-reply/ui/management-interface/statistics-demo.html` - 演示页面

## 需求映射

| 需求 | 实现 | 状态 |
|------|------|------|
| 15.1 | 记录使用次数 | ✅ |
| 15.2 | 显示使用统计 | ✅ |
| 15.3 | 生成统计报告 | ✅ |
| 15.4 | 按使用次数排序 | ✅ |
| 15.5 | 显示使用率 | ✅ |
| 15.6 | 点击跳转详情 | ✅ |
| 15.7 | 删除清理数据 | ✅ |
