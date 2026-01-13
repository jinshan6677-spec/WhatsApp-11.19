import React, { useState, useRef } from 'react';
import { useManagementInterface } from './ManagementInterface';
import Dropdown from '../common/Dropdown';
import './GroupListItem.css';

/**
 * GroupListItem Component
 * 
 * Displays a single group item with:
 * - Checkbox for batch selection
 * - Group name
 * - Add button (+) for adding templates or subgroups
 * - More options button (...) for group operations
 * - Drag and drop support
 * 
 * Requirements: 23.1-23.9, 21.1-21.6
 */
export default function GroupListItem({
  group,
  isSelected,
  isChecked,
  onSelect,
  onCheckboxToggle,
  dragDropHandlers
}) {
  const elementRef = useRef(null);
  const { controller, dispatch } = useManagementInterface();
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);

  // Handle group click
  const handleClick = () => {
    onSelect(group.id);
  };

  // Handle checkbox click
  const handleCheckboxClick = (e) => {
    e.stopPropagation();
    onCheckboxToggle(group.id);
  };

  // Handle add button click
  const handleAddClick = (e) => {
    e.stopPropagation();
    setShowAddMenu(!showAddMenu);
  };

  // Handle more button click
  const handleMoreClick = (e) => {
    e.stopPropagation();
    setShowMoreMenu(!showMoreMenu);
  };

  // Handle add subgroup
  const handleAddSubgroup = async () => {
    try {
      await controller.groupManager.createGroup('新子分组', group.id);
      dispatch({ type: 'SET_GROUPS', payload: await controller.groupManager.getAllGroups() });
      setShowAddMenu(false);
    } catch (error) {
      console.error('Failed to create subgroup:', error);
    }
  };

  // Handle add template
  const handleAddTemplate = () => {
    dispatch({ type: 'SHOW_TEMPLATE_EDITOR', payload: { groupId: group.id } });
    setShowAddMenu(false);
  };

  // Handle rename
  const handleRename = async () => {
    const newName = window.prompt('请输入新的分组名称:', group.name);
    if (!newName || newName === group.name) return;

    try {
      await controller.groupManager.updateGroup(group.id, { name: newName });
      dispatch({ type: 'SET_GROUPS', payload: await controller.groupManager.getAllGroups() });
      setShowMoreMenu(false);
    } catch (error) {
      console.error('Failed to rename group:', error);
    }
  };

  // Handle delete
  const handleDelete = async () => {
    const confirmed = window.confirm(
      `确定要删除分组"${group.name}"吗？这将同时删除分组下的所有模板。`
    );
    if (!confirmed) return;

    try {
      await controller.groupManager.deleteGroup(group.id);
      dispatch({ type: 'SET_GROUPS', payload: await controller.groupManager.getAllGroups() });
      setShowMoreMenu(false);
    } catch (error) {
      console.error('Failed to delete group:', error);
    }
  };

  // Handle copy
  const handleCopy = async () => {
    try {
      // TODO: Implement copy functionality
      console.log('Copy group:', group.id);
      setShowMoreMenu(false);
    } catch (error) {
      console.error('Failed to copy group:', error);
    }
  };

  // Add menu options
  const addMenuOptions = [
    { label: '新建子分组', onClick: handleAddSubgroup },
    { label: '添加模板', onClick: handleAddTemplate }
  ];

  // More menu options
  const moreMenuOptions = [
    { label: '重命名', onClick: handleRename },
    { label: '复制', onClick: handleCopy },
    { label: '删除', onClick: handleDelete, danger: true }
  ];

  // Drag and drop handlers
  const handleDragStart = (e) => {
    if (dragDropHandlers) {
      dragDropHandlers.handleDragStart(e, group, elementRef.current);
    }
  };

  const handleDragOver = (e) => {
    if (dragDropHandlers) {
      dragDropHandlers.handleDragOver(e, group, elementRef.current);
    }
  };

  const handleDragLeave = (e) => {
    if (dragDropHandlers) {
      dragDropHandlers.handleDragLeave(e, elementRef.current);
    }
  };

  const handleDrop = (e) => {
    if (dragDropHandlers) {
      dragDropHandlers.handleDrop(e, group, elementRef.current);
    }
  };

  const handleDragEnd = (e) => {
    if (dragDropHandlers) {
      dragDropHandlers.handleDragEnd(e);
    }
  };

  const isDragging = dragDropHandlers?.isDragging(group.id);

  return (
    <div
      ref={elementRef}
      className={`group-list-item ${isSelected ? 'selected' : ''} ${isDragging ? 'dragging' : ''}`}
      onClick={handleClick}
      draggable
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onDragEnd={handleDragEnd}
    >
      <input
        type="checkbox"
        className="group-list-item-checkbox"
        checked={isChecked}
        onChange={handleCheckboxClick}
        onClick={(e) => e.stopPropagation()}
      />

      <span className="group-list-item-name">{group.name}</span>

      <div className="group-list-item-actions">
        <button
          className="group-list-item-action-button"
          onClick={handleAddClick}
          title="添加"
        >
          +
        </button>

        <div className="group-list-item-dropdown">
          <button
            className="group-list-item-action-button"
            onClick={handleMoreClick}
            title="更多操作"
          >
            ⋯
          </button>
          {showMoreMenu && (
            <Dropdown
              options={moreMenuOptions}
              onClose={() => setShowMoreMenu(false)}
            />
          )}
        </div>
      </div>

      {showAddMenu && (
        <div className="group-list-item-add-menu">
          {addMenuOptions.map((option, index) => (
            <button
              key={index}
              className="group-list-item-add-menu-option"
              onClick={option.onClick}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
