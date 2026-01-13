# 使用统计功能集成示例

## 快速开始

### 1. 在管理界面中添加统计按钮

```jsx
// ManagementInterface.jsx
import React, { useState } from 'react';
import StatisticsReport from './StatisticsReport';
import StatisticsManager from '../../managers/StatisticsManager';

function ManagementInterface({ accountId }) {
  const [showStatistics, setShowStatistics] = useState(false);
  const statisticsManager = new StatisticsManager(accountId);

  const handleShowStatistics = () => {
    setShowStatistics(true);
  };

  const handleTemplateClick = (templateId) => {
    // 跳转到模板详情页面
    setSelectedTemplateId(templateId);
    setShowStatistics(false);
  };

  return (
    <div className="management-interface">
      <div className="header">
        <h1>快捷回复管理</h1>
        <button onClick={handleShowStatistics}>
          📊 查看统计
        </button>
      </div>

      {showStatistics && (
        <StatisticsReport
          statisticsManager={statisticsManager}
          onTemplateClick={handleTemplateClick}
          onClose={() => setShowStatistics(false)}
        />
      )}

      {/* 其他管理界面内容 */}
    </div>
  );
}
```

### 2. 在模板详情中显示统计

```jsx
// TemplateEditor.jsx
import React from 'react';
import TemplateUsageStats from './TemplateUsageStats';

function TemplateEditor({ template, onSave, onCancel }) {
  return (
    <div className="template-editor">
      <h2>编辑模板</h2>
      
      {/* 模板编辑表单 */}
      <form>
        <input 
          type="text" 
          value={template.label} 
          placeholder="模板标签"
        />
        <textarea 
          value={template.content.text}
          placeholder="模板内容"
        />
      </form>

      {/* 显示使用统计 */}
      <TemplateUsageStats template={template} />

      <div className="actions">
        <button onClick={onSave}>保存</button>
        <button onClick={onCancel}>取消</button>
      </div>
    </div>
  );
}
```

### 3. 在发送时记录使用

```jsx
// SendManager.js 或 QuickReplyController.js
import TemplateManager from '../managers/TemplateManager';

class SendManager {
  constructor(accountId, translationService, whatsappWebInterface) {
    this.templateManager = new TemplateManager(accountId);
    this.translationService = translationService;
    this.whatsappWebInterface = whatsappWebInterface;
  }

  async sendTemplate(templateId, mode = 'original') {
    try {
      // 获取模板
      const template = await this.templateManager.getTemplate(templateId);
      
      if (!template) {
        throw new Error('Template not found');
      }

      // 发送消息
      if (mode === 'translated') {
        const translated = await this.translateContent(template.content);
        await this.whatsappWebInterface.sendMessage(translated);
      } else {
        await this.whatsappWebInterface.sendMessage(template.content);
      }

      // 记录使用（重要！）
      await this.templateManager.recordUsage(templateId);

      return { success: true };
    } catch (error) {
      console.error('Failed to send template:', error);
      throw error;
    }
  }
}
```

## 完整示例：带统计的管理界面

```jsx
import React, { useState, useEffect } from 'react';
import StatisticsReport from './StatisticsReport';
import TemplateUsageStats from './TemplateUsageStats';
import StatisticsManager from '../../managers/StatisticsManager';
import TemplateManager from '../../managers/TemplateManager';
import GroupManager from '../../managers/GroupManager';

function QuickReplyManagement({ accountId }) {
  const [view, setView] = useState('templates'); // 'templates' | 'statistics'
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [templates, setTemplates] = useState([]);
  const [groups, setGroups] = useState([]);

  const statisticsManager = new StatisticsManager(accountId);
  const templateManager = new TemplateManager(accountId);
  const groupManager = new GroupManager(accountId);

  useEffect(() => {
    loadData();
  }, [accountId]);

  const loadData = async () => {
    const allTemplates = await templateManager.storage.getAll();
    const allGroups = await groupManager.getAllGroups();
    setTemplates(allTemplates);
    setGroups(allGroups);
  };

  const handleTemplateClick = async (templateId) => {
    const template = await templateManager.getTemplate(templateId);
    setSelectedTemplate(template);
    setView('template-detail');
  };

  const handleSendTemplate = async (templateId) => {
    try {
      // 发送逻辑...
      
      // 记录使用
      await templateManager.recordUsage(templateId);
      
      // 刷新数据
      await loadData();
      
      alert('发送成功！');
    } catch (error) {
      alert('发送失败：' + error.message);
    }
  };

  return (
    <div className="quick-reply-management">
      {/* 导航栏 */}
      <nav className="nav-bar">
        <button 
          className={view === 'templates' ? 'active' : ''}
          onClick={() => setView('templates')}
        >
          📝 模板管理
        </button>
        <button 
          className={view === 'statistics' ? 'active' : ''}
          onClick={() => setView('statistics')}
        >
          📊 使用统计
        </button>
      </nav>

      {/* 内容区域 */}
      <div className="content-area">
        {view === 'templates' && (
          <div className="templates-view">
            <h2>模板列表</h2>
            {templates.map(template => (
              <div key={template.id} className="template-item">
                <div className="template-info">
                  <h3>{template.label}</h3>
                  <p>使用次数: {template.usageCount || 0}</p>
                </div>
                <div className="template-actions">
                  <button onClick={() => handleTemplateClick(template.id)}>
                    查看详情
                  </button>
                  <button onClick={() => handleSendTemplate(template.id)}>
                    发送
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {view === 'statistics' && (
          <StatisticsReport
            statisticsManager={statisticsManager}
            onTemplateClick={handleTemplateClick}
            onClose={() => setView('templates')}
          />
        )}

        {view === 'template-detail' && selectedTemplate && (
          <div className="template-detail">
            <button onClick={() => setView('templates')}>
              ← 返回列表
            </button>
            
            <h2>{selectedTemplate.label}</h2>
            
            <div className="template-content">
              <p>{selectedTemplate.content.text}</p>
            </div>

            <TemplateUsageStats template={selectedTemplate} />

            <div className="actions">
              <button onClick={() => handleSendTemplate(selectedTemplate.id)}>
                发送此模板
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default QuickReplyManagement;
```

## 样式示例

```css
/* 管理界面样式 */
.quick-reply-management {
  display: flex;
  flex-direction: column;
  height: 100vh;
}

.nav-bar {
  display: flex;
  gap: 8px;
  padding: 16px;
  background: #fff;
  border-bottom: 1px solid #e8e8e8;
}

.nav-bar button {
  padding: 8px 16px;
  border: 1px solid #d9d9d9;
  border-radius: 4px;
  background: #fff;
  cursor: pointer;
  transition: all 0.3s;
}

.nav-bar button.active {
  background: #1890ff;
  color: #fff;
  border-color: #1890ff;
}

.content-area {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
}

.template-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  background: #fff;
  border-radius: 8px;
  margin-bottom: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.template-actions {
  display: flex;
  gap: 8px;
}

.template-actions button {
  padding: 6px 12px;
  border: 1px solid #1890ff;
  border-radius: 4px;
  background: #fff;
  color: #1890ff;
  cursor: pointer;
}

.template-actions button:hover {
  background: #1890ff;
  color: #fff;
}
```

## API使用示例

### 生成统计报告

```javascript
const statisticsManager = new StatisticsManager(accountId);

// 生成完整报告
const report = await statisticsManager.generateReport();
console.log('总模板数:', report.totalTemplates);
console.log('总使用次数:', report.totalUsageCount);
console.log('最常用模板:', report.mostUsedTemplate.label);

// 生成分组报告
const groupReport = await statisticsManager.generateGroupReport(groupId);
console.log('分组模板数:', groupReport.totalTemplates);

// 获取Top 10模板
const topTemplates = await statisticsManager.getTopTemplates(10);
topTemplates.forEach((t, i) => {
  console.log(`${i + 1}. ${t.label}: ${t.usageCount}次`);
});

// 获取未使用模板
const unusedTemplates = await statisticsManager.getUnusedTemplates();
console.log('未使用模板数:', unusedTemplates.length);

// 获取最近使用的模板
const recentTemplates = await statisticsManager.getRecentlyUsedTemplates(5);
recentTemplates.forEach(t => {
  console.log(`${t.label}: ${new Date(t.lastUsedAt).toLocaleString()}`);
});
```

### 记录和查询使用

```javascript
const templateManager = new TemplateManager(accountId);

// 记录使用
await templateManager.recordUsage(templateId);

// 查询使用统计
const stats = await templateManager.getUsageStats(templateId);
console.log('使用次数:', stats.usageCount);
console.log('最后使用:', new Date(stats.lastUsedAt).toLocaleString());
```

## 注意事项

1. **记录使用时机**：在消息成功发送后记录，而不是发送前
2. **错误处理**：记录使用失败不应影响消息发送
3. **性能优化**：大量模板时考虑使用缓存
4. **数据一致性**：删除模板时自动清理统计数据
5. **UI响应**：统计计算应该异步进行，不阻塞UI

## 故障排查

### 问题1：使用次数没有更新
```javascript
// 检查是否正确调用
await templateManager.recordUsage(templateId);

// 验证模板存在
const template = await templateManager.getTemplate(templateId);
console.log('Template exists:', !!template);
```

### 问题2：统计报告为空
```javascript
// 检查是否有模板
const allTemplates = await templateManager.storage.getAll();
console.log('Total templates:', allTemplates.length);

// 检查是否有使用记录
const usedTemplates = allTemplates.filter(t => t.usageCount > 0);
console.log('Used templates:', usedTemplates.length);
```

### 问题3：UI不更新
```javascript
// 确保在记录使用后刷新数据
await templateManager.recordUsage(templateId);
await loadData(); // 重新加载数据
```

## 测试建议

```javascript
// 测试记录使用
test('should record usage correctly', async () => {
  const template = await templateManager.createTemplate(
    groupId,
    'text',
    'Test',
    { text: 'Content' }
  );

  await templateManager.recordUsage(template.id);
  
  const updated = await templateManager.getTemplate(template.id);
  expect(updated.usageCount).toBe(1);
  expect(updated.lastUsedAt).toBeDefined();
});

// 测试统计报告
test('should generate report correctly', async () => {
  const report = await statisticsManager.generateReport();
  
  expect(report.totalTemplates).toBeGreaterThan(0);
  expect(report.templates).toBeInstanceOf(Array);
  expect(report.generatedAt).toBeDefined();
});
```

## 更多资源

- [功能文档](./STATISTICS_README.md)
- [API文档](../../managers/StatisticsManager.js)
- [演示页面](./statistics-demo.html)
- [单元测试](../../__tests__/statistics.test.js)
