import React, { useState } from 'react';
import { useManagementInterface } from './ManagementInterface';
import GroupListItem from './GroupListItem';
import BatchOperations from './BatchOperations';
import Input from '../common/Input';
import { useGroupDragDrop } from './useDragDrop';
import './GroupPanel.css';
import './DragDrop.css';

/**
 * GroupPanel Component
 * 
 * Displays the group management panel with:
 * - Group search box
 * - Group list
 * - Batch selection support
 * - Drag and drop sorting
 * 
 * Requirements: 23.1-23.9, 21.1-21.6
 */
export default function GroupPanel() {
  const { state, dispatch, controller } = useManagementInterface();
  const [searchKeyword, setSearchKeyword] = useState('');

  // Filter groups based on search keyword
  const filteredGroups = state.groups.filter(group => {
    if (!searchKeyword) return true;
    return group.name.toLowerCase().includes(searchKeyword.toLowerCase());
  });

  // Handle group reorder
  const handleGroupReorder = async (groupId, newIndex) => {
    try {
      await controller.groupManager.reorderGroup(groupId, newIndex);
      dispatch({ type: 'SET_GROUPS', payload: await controller.groupManager.getAllGroups() });
    } catch (error) {
      console.error('Failed to reorder group:', error);
      throw error;
    }
  };

  // Drag and drop handlers
  const dragDropHandlers = useGroupDragDrop({
    groups: filteredGroups,
    allGroups: state.groups,
    onReorder: handleGroupReorder
  });

  // Handle search input change
  const handleSearchChange = (e) => {
    setSearchKeyword(e.target.value);
  };

  // Handle group selection
  const handleGroupSelect = (groupId) => {
    dispatch({ type: 'SET_SELECTED_GROUP', payload: groupId });
  };

  // Handle group checkbox toggle
  const handleGroupCheckboxToggle = (groupId) => {
    dispatch({ type: 'TOGGLE_GROUP_SELECTION', payload: groupId });
  };

  // Handle create new group
  const handleCreateGroup = async () => {
    try {
      const newGroup = await controller.groupManager.createGroup('新分组');
      dispatch({ type: 'SET_GROUPS', payload: await controller.groupManager.getAllGroups() });
    } catch (error) {
      console.error('Failed to create group:', error);
    }
  };

  return (
    <div className="group-panel">
      <div className="group-panel-header">
        <h3 className="group-panel-title">分组</h3>
        <p className="group-panel-hint">可拖动排序，可批量选择后支持</p>
      </div>

      <div className="group-panel-search">
        <Input
          type="text"
          placeholder="搜索分组..."
          value={searchKeyword}
          onChange={handleSearchChange}
          className="group-panel-search-input"
        />
      </div>

      <div className="group-panel-actions">
        <button
          className="group-panel-action-button"
          onClick={handleCreateGroup}
        >
          + 新建分组
        </button>
      </div>

      {/* Batch Operations for Groups */}
      <BatchOperations type="group" />

      <div className="group-panel-list">
        {filteredGroups.length === 0 ? (
          <div className="group-panel-empty">
            {searchKeyword ? '未找到匹配的分组' : '暂无分组'}
          </div>
        ) : (
          filteredGroups.map(group => (
            <GroupListItem
              key={group.id}
              group={group}
              isSelected={state.selectedGroupId === group.id}
              isChecked={state.selectedGroupIds.has(group.id)}
              onSelect={handleGroupSelect}
              onCheckboxToggle={handleGroupCheckboxToggle}
              dragDropHandlers={dragDropHandlers}
            />
          ))
        )}
      </div>
    </div>
  );
}
