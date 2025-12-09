/**
 * BatchOperations Component
 * 
 * Provides batch operation controls for templates and groups:
 * - Select all / Clear selection
 * - Batch delete
 * - Batch move to group
 * 
 * Requirements: 13.1-13.10
 */

import React, { useState } from 'react';
import { useManagementInterface } from './ManagementInterface';
import Button from '../common/Button';
import Modal from '../common/Modal';
import './BatchOperations.css';

export default function BatchOperations({ type = 'template' }) {
  const { state, dispatch, controller } = useManagementInterface();
  const [showMoveDialog, setShowMoveDialog] = useState(false);
  const [selectedTargetGroupId, setSelectedTargetGroupId] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const isTemplate = type === 'template';
  const selectedIds = isTemplate ? state.selectedTemplateIds : state.selectedGroupIds;
  const selectedCount = selectedIds.size;

  // Handle select all
  const handleSelectAll = () => {
    if (isTemplate) {
      dispatch({ type: 'SELECT_ALL_TEMPLATES' });
    } else {
      // Select all groups
      const allGroupIds = new Set(state.groups.map(g => g.id));
      state.groups.forEach(g => {
        dispatch({ type: 'TOGGLE_GROUP_SELECTION', payload: g.id });
      });
    }
  };

  // Handle clear selection
  const handleClearSelection = () => {
    if (isTemplate) {
      dispatch({ type: 'CLEAR_TEMPLATE_SELECTION' });
    } else {
      dispatch({ type: 'CLEAR_GROUP_SELECTION' });
    }
  };

  // Handle batch delete
  const handleBatchDelete = async () => {
    if (selectedCount === 0) return;

    const itemType = isTemplate ? '模板' : '分组';
    const warningMessage = isTemplate
      ? `确定要删除选中的 ${selectedCount} 个${itemType}吗？`
      : `确定要删除选中的 ${selectedCount} 个${itemType}吗？这将同时删除分组下的所有模板。`;

    const confirmed = window.confirm(warningMessage);
    if (!confirmed) return;

    setIsProcessing(true);

    try {
      if (isTemplate) {
        await controller.templateManager.batchDeleteTemplates(Array.from(selectedIds));
        const templates = await controller.templateManager.getAllTemplates();
        dispatch({ type: 'SET_TEMPLATES', payload: templates });
        dispatch({ type: 'CLEAR_TEMPLATE_SELECTION' });
      } else {
        await controller.groupManager.batchDeleteGroups(Array.from(selectedIds));
        const groups = await controller.groupManager.getAllGroups();
        dispatch({ type: 'SET_GROUPS', payload: groups });
        dispatch({ type: 'CLEAR_GROUP_SELECTION' });
      }
    } catch (error) {
      console.error(`Failed to batch delete ${itemType}:`, error);
      alert(`批量删除${itemType}失败: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle batch move (templates only)
  const handleBatchMove = () => {
    if (!isTemplate || selectedCount === 0) return;
    setShowMoveDialog(true);
  };

  // Handle move dialog confirm
  const handleMoveConfirm = async () => {
    if (!selectedTargetGroupId) {
      alert('请选择目标分组');
      return;
    }

    setIsProcessing(true);

    try {
      await controller.templateManager.batchMoveTemplates(
        Array.from(selectedIds),
        selectedTargetGroupId
      );
      const templates = await controller.templateManager.getAllTemplates();
      dispatch({ type: 'SET_TEMPLATES', payload: templates });
      dispatch({ type: 'CLEAR_TEMPLATE_SELECTION' });
      setShowMoveDialog(false);
      setSelectedTargetGroupId(null);
    } catch (error) {
      console.error('Failed to batch move templates:', error);
      alert(`批量移动模板失败: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle move dialog cancel
  const handleMoveCancel = () => {
    setShowMoveDialog(false);
    setSelectedTargetGroupId(null);
  };

  if (selectedCount === 0) {
    return null;
  }

  return (
    <>
      <div className="batch-operations">
        <div className="batch-operations-info">
          <span className="batch-operations-count">
            已选中 {selectedCount} 个{isTemplate ? '模板' : '分组'}
          </span>
        </div>

        <div className="batch-operations-actions">
          {isTemplate && (
            <Button
              variant="ghost"
              size="small"
              onClick={handleBatchMove}
              disabled={isProcessing}
            >
              移动到分组
            </Button>
          )}

          <Button
            variant="danger"
            size="small"
            onClick={handleBatchDelete}
            disabled={isProcessing}
          >
            {isProcessing ? '删除中...' : '删除'}
          </Button>

          <Button
            variant="ghost"
            size="small"
            onClick={handleClearSelection}
            disabled={isProcessing}
          >
            取消选择
          </Button>
        </div>
      </div>

      {/* Move to Group Dialog */}
      {showMoveDialog && (
        <Modal
          isOpen={showMoveDialog}
          onClose={handleMoveCancel}
          title="移动到分组"
        >
          <div className="batch-move-dialog">
            <p className="batch-move-dialog-text">
              选择目标分组以移动 {selectedCount} 个模板
            </p>

            <div className="batch-move-dialog-groups">
              {state.groups.map(group => (
                <div
                  key={group.id}
                  className={`batch-move-dialog-group ${
                    selectedTargetGroupId === group.id ? 'selected' : ''
                  }`}
                  onClick={() => setSelectedTargetGroupId(group.id)}
                >
                  <input
                    type="radio"
                    name="targetGroup"
                    checked={selectedTargetGroupId === group.id}
                    onChange={() => setSelectedTargetGroupId(group.id)}
                  />
                  <span className="batch-move-dialog-group-name">
                    {group.name}
                  </span>
                </div>
              ))}
            </div>

            <div className="batch-move-dialog-actions">
              <Button
                variant="ghost"
                onClick={handleMoveCancel}
                disabled={isProcessing}
              >
                取消
              </Button>
              <Button
                variant="primary"
                onClick={handleMoveConfirm}
                disabled={isProcessing || !selectedTargetGroupId}
              >
                {isProcessing ? '移动中...' : '确认移动'}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
