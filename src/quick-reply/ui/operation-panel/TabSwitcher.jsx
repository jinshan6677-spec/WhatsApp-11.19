import React from 'react';
import { TAB_TYPES, TAB_TYPE_LABELS } from '../../constants';
import './TabSwitcher.css';

/**
 * TabSwitcher Component
 * 
 * Displays tab buttons for filtering quick replies by visibility type.
 * Implements three tabs: 全部 (All), 公共 (Public), 个人 (Personal)
 * 
 * Requirements: 1.1.1, 1.1.5
 * - 1.1.1: Display three tabs at the top of sidebar
 * - 1.1.5: Highlight selected tab with blue background
 */
export default function TabSwitcher({ activeTab, onTabChange }) {
  const tabs = [
    { type: TAB_TYPES.ALL, label: TAB_TYPE_LABELS[TAB_TYPES.ALL] },
    { type: TAB_TYPES.PUBLIC, label: TAB_TYPE_LABELS[TAB_TYPES.PUBLIC] },
    { type: TAB_TYPES.PERSONAL, label: TAB_TYPE_LABELS[TAB_TYPES.PERSONAL] }
  ];

  const handleTabClick = (tabType) => {
    if (onTabChange && tabType !== activeTab) {
      onTabChange(tabType);
    }
  };

  return (
    <div className="tab-switcher" role="tablist" aria-label="快捷回复类型筛选">
      {tabs.map((tab) => (
        <button
          key={tab.type}
          className={`tab-switcher-button ${activeTab === tab.type ? 'tab-switcher-button--active' : ''}`}
          onClick={() => handleTabClick(tab.type)}
          role="tab"
          aria-selected={activeTab === tab.type}
          aria-controls={`tabpanel-${tab.type}`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
