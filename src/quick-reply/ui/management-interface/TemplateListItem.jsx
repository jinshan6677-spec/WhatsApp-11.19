import React, { useRef } from 'react';
import './TemplateListItem.css';

/**
 * TemplateListItem Component
 * 
 * Displays a single template item with:
 * - Checkbox for batch selection
 * - Type indicator badge
 * - Template label
 * - Edit and delete buttons
 * - Drag and drop support
 * 
 * Requirements: 24.1-24.12, 21.1-21.6
 */
export default function TemplateListItem({
  template,
  isChecked,
  onCheckboxToggle,
  onEdit,
  onDelete,
  dragDropHandlers
}) {
  const elementRef = useRef(null);
  // Get type badge text
  const getTypeBadge = (type) => {
    const badges = {
      text: '模板',
      image: '模板',
      video: '模板',
      audio: '模板',
      mixed: '图片模板',
      contact: '图片模板'
    };
    return badges[type] || '模板';
  };

  // Get type icon
  const getTypeIcon = (type) => {
    const icons = {
      text: '📝',
      image: '🖼️',
      video: '🎬',
      audio: '🎵',
      mixed: '🖼️',
      contact: '👤'
    };
    return icons[type] || '📄';
  };

  // Handle checkbox click
  const handleCheckboxClick = (e) => {
    e.stopPropagation();
    onCheckboxToggle(template.id);
  };

  // Handle edit click
  const handleEditClick = (e) => {
    e.stopPropagation();
    onEdit(template);
  };

  // Handle delete click
  const handleDeleteClick = (e) => {
    e.stopPropagation();
    onDelete(template.id);
  };

  // Drag and drop handlers
  const handleDragStart = (e) => {
    if (dragDropHandlers) {
      dragDropHandlers.handleDragStart(e, template, elementRef.current);
    }
  };

  const handleDragOver = (e) => {
    if (dragDropHandlers) {
      dragDropHandlers.handleDragOver(e, template, elementRef.current);
    }
  };

  const handleDragLeave = (e) => {
    if (dragDropHandlers) {
      dragDropHandlers.handleDragLeave(e, elementRef.current);
    }
  };

  const handleDrop = (e) => {
    if (dragDropHandlers) {
      dragDropHandlers.handleDrop(e, template, elementRef.current);
    }
  };

  const handleDragEnd = (e) => {
    if (dragDropHandlers) {
      dragDropHandlers.handleDragEnd(e);
    }
  };

  const isDragging = dragDropHandlers?.isDragging(template.id);

  return (
    <div
      ref={elementRef}
      className={`template-list-item ${isDragging ? 'dragging' : ''}`}
      draggable
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onDragEnd={handleDragEnd}
    >
      <input
        type="checkbox"
        className="template-list-item-checkbox"
        checked={isChecked}
        onChange={handleCheckboxClick}
        onClick={(e) => e.stopPropagation()}
      />

      <span className="template-list-item-icon">{getTypeIcon(template.type)}</span>

      <span className="template-list-item-badge">{getTypeBadge(template.type)}</span>

      <span className="template-list-item-label">{template.label}</span>

      {/* Requirement 11.1: Display usage count */}
      {(template.usageCount !== undefined && template.usageCount > 0) && (
        <span className="template-list-item-usage" title={`使用次数: ${template.usageCount}`}>
          {template.usageCount}次
        </span>
      )}

      <div className="template-list-item-actions">
        <button
          className="template-list-item-action-button edit"
          onClick={handleEditClick}
          title="编辑"
        >
          ✏️
        </button>
        <button
          className="template-list-item-action-button delete"
          onClick={handleDeleteClick}
          title="删除"
        >
          🗑️
        </button>
      </div>
    </div>
  );
}
