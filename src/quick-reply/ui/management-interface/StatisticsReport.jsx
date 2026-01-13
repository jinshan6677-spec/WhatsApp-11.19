/**
 * StatisticsReport Component
 * 
 * Displays usage statistics for templates.
 * 
 * Requirements: 15.3-15.6
 */

import React, { useState, useEffect } from 'react';
import './StatisticsReport.css';

const StatisticsReport = ({ 
  statisticsManager, 
  onTemplateClick,
  onClose 
}) => {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all'); // 'all', 'top', 'unused', 'recent'

  useEffect(() => {
    loadReport();
  }, []);

  const loadReport = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await statisticsManager.generateReport();
      setReport(data);
    } catch (err) {
      setError(err.message);
      console.error('Failed to load statistics report:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    loadReport();
  };

  const handleTemplateClick = (templateId) => {
    if (onTemplateClick) {
      onTemplateClick(templateId);
    }
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return '从未使用';
    const date = new Date(timestamp);
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getFilteredTemplates = () => {
    if (!report) return [];
    
    switch (filter) {
      case 'top':
        return report.templates.slice(0, 10);
      case 'unused':
        return report.templates.filter(t => t.usageCount === 0);
      case 'recent':
        return report.templates
          .filter(t => t.lastUsedAt)
          .sort((a, b) => b.lastUsedAt - a.lastUsedAt)
          .slice(0, 10);
      default:
        return report.templates;
    }
  };

  if (loading) {
    return (
      <div className="statistics-report">
        <div className="statistics-loading">
          <div className="loading-spinner"></div>
          <p>加载统计数据中...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="statistics-report">
        <div className="statistics-error">
          <p>加载失败: {error}</p>
          <button onClick={handleRefresh}>重试</button>
        </div>
      </div>
    );
  }

  if (!report) {
    return null;
  }

  const filteredTemplates = getFilteredTemplates();

  return (
    <div className="statistics-report">
      <div className="statistics-header">
        <h2>使用统计报告</h2>
        <div className="statistics-actions">
          <button onClick={handleRefresh} className="btn-refresh">
            刷新
          </button>
          {onClose && (
            <button onClick={onClose} className="btn-close">
              关闭
            </button>
          )}
        </div>
      </div>

      <div className="statistics-summary">
        <div className="summary-card">
          <div className="summary-label">总模板数</div>
          <div className="summary-value">{report.totalTemplates}</div>
        </div>
        <div className="summary-card">
          <div className="summary-label">总使用次数</div>
          <div className="summary-value">{report.totalUsageCount}</div>
        </div>
        <div className="summary-card">
          <div className="summary-label">平均使用次数</div>
          <div className="summary-value">{report.averageUsageCount}</div>
        </div>
        <div className="summary-card">
          <div className="summary-label">未使用模板</div>
          <div className="summary-value">{report.unusedTemplates}</div>
        </div>
      </div>

      {report.mostUsedTemplate && (
        <div className="statistics-highlights">
          <div className="highlight-card">
            <h3>最常用模板</h3>
            <div className="highlight-content">
              <div className="highlight-label">{report.mostUsedTemplate.label}</div>
              <div className="highlight-stats">
                使用次数: {report.mostUsedTemplate.usageCount} ({report.mostUsedTemplate.usageRate}%)
              </div>
              <div className="highlight-time">
                最后使用: {formatDate(report.mostUsedTemplate.lastUsedAt)}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="statistics-filters">
        <button 
          className={filter === 'all' ? 'active' : ''}
          onClick={() => setFilter('all')}
        >
          全部模板
        </button>
        <button 
          className={filter === 'top' ? 'active' : ''}
          onClick={() => setFilter('top')}
        >
          最常用 (Top 10)
        </button>
        <button 
          className={filter === 'unused' ? 'active' : ''}
          onClick={() => setFilter('unused')}
        >
          未使用
        </button>
        <button 
          className={filter === 'recent' ? 'active' : ''}
          onClick={() => setFilter('recent')}
        >
          最近使用
        </button>
      </div>

      <div className="statistics-table">
        <table>
          <thead>
            <tr>
              <th>排名</th>
              <th>模板标签</th>
              <th>类型</th>
              <th>使用次数</th>
              <th>使用率</th>
              <th>最后使用时间</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {filteredTemplates.length === 0 ? (
              <tr>
                <td colSpan="7" className="no-data">
                  暂无数据
                </td>
              </tr>
            ) : (
              filteredTemplates.map((template, index) => (
                <tr key={template.id}>
                  <td>{index + 1}</td>
                  <td className="template-label">{template.label}</td>
                  <td>{template.type}</td>
                  <td>{template.usageCount}</td>
                  <td>{template.usageRate}%</td>
                  <td>{formatDate(template.lastUsedAt)}</td>
                  <td>
                    <button 
                      className="btn-view"
                      onClick={() => handleTemplateClick(template.id)}
                    >
                      查看详情
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="statistics-footer">
        <p>报告生成时间: {formatDate(report.generatedAt)}</p>
      </div>
    </div>
  );
};

export default StatisticsReport;
