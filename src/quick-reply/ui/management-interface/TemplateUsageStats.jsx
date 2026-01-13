/**
 * TemplateUsageStats Component
 * 
 * Displays usage statistics for a single template.
 * 
 * Requirements: 15.2
 */

import React from 'react';
import './TemplateUsageStats.css';

const TemplateUsageStats = ({ template }) => {
  if (!template) {
    return null;
  }

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

  const formatRelativeTime = (timestamp) => {
    if (!timestamp) return null;
    
    const now = Date.now();
    const diff = now - timestamp;
    
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days}天前`;
    if (hours > 0) return `${hours}小时前`;
    if (minutes > 0) return `${minutes}分钟前`;
    return '刚刚';
  };

  const usageCount = template.usageCount || 0;
  const lastUsedAt = template.lastUsedAt;
  const createdAt = template.createdAt;

  return (
    <div className="template-usage-stats">
      <h3>使用统计</h3>
      
      <div className="stats-grid">
        <div className="stat-item">
          <div className="stat-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M2 17L12 22L22 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M2 12L12 17L22 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div className="stat-content">
            <div className="stat-label">使用次数</div>
            <div className="stat-value">{usageCount}</div>
          </div>
        </div>

        <div className="stat-item">
          <div className="stat-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
              <path d="M12 6V12L16 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </div>
          <div className="stat-content">
            <div className="stat-label">最后使用</div>
            <div className="stat-value-small">
              {formatDate(lastUsedAt)}
              {lastUsedAt && (
                <span className="stat-relative">
                  ({formatRelativeTime(lastUsedAt)})
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="stat-item">
          <div className="stat-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <rect x="3" y="4" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="2"/>
              <line x1="16" y1="2" x2="16" y2="6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              <line x1="8" y1="2" x2="8" y2="6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              <line x1="3" y1="10" x2="21" y2="10" stroke="currentColor" strokeWidth="2"/>
            </svg>
          </div>
          <div className="stat-content">
            <div className="stat-label">创建时间</div>
            <div className="stat-value-small">{formatDate(createdAt)}</div>
          </div>
        </div>
      </div>

      {usageCount === 0 && (
        <div className="usage-notice">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
            <line x1="12" y1="8" x2="12" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            <circle cx="12" cy="16" r="1" fill="currentColor"/>
          </svg>
          <span>此模板尚未被使用</span>
        </div>
      )}
    </div>
  );
};

export default TemplateUsageStats;
