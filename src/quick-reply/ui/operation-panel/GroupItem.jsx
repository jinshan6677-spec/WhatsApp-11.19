import React from 'react';
import { useOperationPanel } from './OperationPanel';
import TemplateList from './TemplateList';
import './GroupItem.css';

/**
 * GroupItem component
 * Displays a single group with expand/collapse functionality
 * Requirements: 2.1-2.11
 */
export default function GroupItem({ 
  group, 
  level, 
  isExpanded, 
  templates, 
  childGroups, 
  renderGroup 
}) {
  const { dispatch } = useOperationPanel();

  // Handle group toggle
  const handleToggle = () => {
    dispatch({ type: 'TOGGLE_GROUP', payload: group.id });
  };

  // Calculate indentation based on level
  const indentStyle = {
    paddingLeft: `${level * 16 + 16}px`
  };

  return (
    <div className="group-item">
      <div 
        className="group-item-header"
        style={indentStyle}
        onClick={handleToggle}
      >
        <button
          className="group-item-toggle"
          aria-label={isExpanded ? '折叠分组' : '展开分组'}
          aria-expanded={isExpanded}
        >
          <svg 
            className={`group-item-toggle-icon ${isExpanded ? 'expanded' : ''}`}
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>

        <span className="group-item-name">{group.name}</span>

        {templates.length === 0 && childGroups.length === 0 && (
          <span className="group-item-empty-badge">暂无模板</span>
        )}
      </div>

      {isExpanded && (
        <div className="group-item-content">
          {/* Render templates */}
          {templates.length > 0 && (
            <TemplateList templates={templates} groupId={group.id} />
          )}

          {/* Render child groups recursively */}
          {childGroups.map(childGroup => renderGroup(childGroup, level + 1))}
        </div>
      )}
    </div>
  );
}
