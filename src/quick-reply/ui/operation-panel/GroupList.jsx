import React from 'react';
import { useOperationPanel } from './OperationPanel';
import GroupItem from './GroupItem';
import './GroupList.css';

/**
 * GroupList component
 * Displays a list of template groups
 * Requirements: 2.1-2.11
 */
export default function GroupList() {
  const { state } = useOperationPanel();

  // Get top-level groups (groups without parent)
  const topLevelGroups = state.groups
    .filter(group => !group.parentId)
    .sort((a, b) => a.order - b.order);

  // Get child groups for a parent
  const getChildGroups = (parentId) => {
    return state.groups
      .filter(group => group.parentId === parentId)
      .sort((a, b) => a.order - b.order);
  };

  // Get templates for a group
  const getGroupTemplates = (groupId) => {
    return state.filteredTemplates
      .filter(template => template.groupId === groupId)
      .sort((a, b) => a.order - b.order);
  };

  // Render group with its children recursively
  const renderGroup = (group, level = 0) => {
    const childGroups = getChildGroups(group.id);
    const templates = getGroupTemplates(group.id);
    const isExpanded = state.expandedGroups.has(group.id);

    return (
      <GroupItem
        key={group.id}
        group={group}
        level={level}
        isExpanded={isExpanded}
        templates={templates}
        childGroups={childGroups}
        renderGroup={renderGroup}
      />
    );
  };

  if (state.groups.length === 0) {
    return (
      <div className="group-list-empty">
        <svg className="group-list-empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
        </svg>
        <p className="group-list-empty-text">暂无分组</p>
        <p className="group-list-empty-hint">请在管理界面创建分组和模板</p>
      </div>
    );
  }

  return (
    <div className="group-list">
      {topLevelGroups.map(group => renderGroup(group, 0))}
    </div>
  );
}
