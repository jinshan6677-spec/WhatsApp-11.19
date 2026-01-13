import React from 'react';
import { useManagementInterface } from './ManagementInterface';
import './TabBar.css';

/**
 * TabBar Component
 * 
 * Displays tabs for filtering templates by content type:
 * - 全部 (All)
 * - 活跃文本 (Text)
 * - 活跃图文 (Mixed)
 * - 活跃图片 (Image)
 * - 活跃视频 (Video)
 * - 活跃名片 (Contact)
 * 
 * Requirements: 17.1-17.8, 25.1-25.8
 */
export default function TabBar() {
  const { state, dispatch } = useManagementInterface();

  // Tab definitions
  const tabs = [
    { id: 'all', label: '全部', icon: '📋' },
    { id: 'text', label: '活跃文本', icon: '📝' },
    { id: 'mixed', label: '活跃图文', icon: '🖼️' },
    { id: 'image', label: '活跃图片', icon: '🖼️' },
    { id: 'video', label: '活跃视频', icon: '🎬' },
    { id: 'contact', label: '活跃名片', icon: '👤' }
  ];

  // Handle tab click
  const handleTabClick = (tabId) => {
    dispatch({ type: 'SET_ACTIVE_TAB', payload: tabId });
  };

  // Count templates by type
  const getTemplateCount = (type) => {
    if (!state.selectedGroupId) return 0;
    
    const groupTemplates = state.templates.filter(
      t => t.groupId === state.selectedGroupId
    );

    if (type === 'all') {
      return groupTemplates.length;
    }

    return groupTemplates.filter(t => t.type === type).length;
  };

  return (
    <div className="tab-bar">
      <div className="tab-bar-list">
        {tabs.map(tab => {
          const count = getTemplateCount(tab.id);
          const isActive = state.activeTab === tab.id;

          return (
            <button
              key={tab.id}
              className={`tab-bar-item ${isActive ? 'active' : ''}`}
              onClick={() => handleTabClick(tab.id)}
            >
              <span className="tab-bar-item-icon">{tab.icon}</span>
              <span className="tab-bar-item-label">{tab.label}</span>
              {count > 0 && (
                <span className="tab-bar-item-count">({count})</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
