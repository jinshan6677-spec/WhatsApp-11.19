/**
 * BatchOperationsBar Component
 * 
 * Provides batch operation controls for the management window:
 * - Select all / Clear selection
 * - Batch delete
 * - Batch move to group
 * - Display selected count
 * 
 * Requirements: 8.1-8.8
 */

import React, { useState, useCallback } from 'react';
import { useManagementWindow } from './ManagementWindowApp';
import './BatchOperationsBar.css';

export default function BatchOperationsBar() {
  const { state, dispatch, sendAction } = useManagementWindow();
  const [showMoveDialog, setShowMoveDialog] = useState(false);
  const [selectedTargetGroupId, setSelectedTargetGroupId] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const selectedCount = state.selectedTemplateIds.size;

  // Get templates to display based on search state
  const currentTemplates = React.useMemo(() => {
    if (state.isSearching && state.filteredTemplates.length > 0) {
      return state.filteredTemplates;
    }
    if (state.isSearching && state.searchKeyword) {
      const keyword = state.searchKeyword.toLowerCase();
      return state.templates.filter(t => {
        if (t.label && t.label.toLowerCase().includes(keyword)) return true;
        if (t.content?.text && t.content.text.toLowerCase().includes(keyword)) return true;
        return false;
      });
    }
    return state.templates.filter(t => !state.selectedGroupId || t.groupId === state.selectedGroupId);
  }, [state.templates, state.filteredTemplates, state.isSearching, state.searchKeyword, state.selectedGroupId]);

  // Handle select all - Requirement 8.3
  const handleSelectAll = useCallback(() => {
    currentTemplates.forEach(template => {
      if (!state.selectedTemplateIds.has(template.id)) {
        dispatch({ type: 'TOGGLE_TEMPLATE_SELECTION', payload: template.id });
      }
    });
  }, [currentTemplates, state.selectedTemplateIds, dispatch]);

  // Handle clear selection - Requirement 8.4
  const handleClearSelection = useCallback(() => {
    dispatch({ type: 'CLEAR_TEMPLATE_SELECTION' });
  }, [dispatch]);

  // Handle batch delete - Requirements 8.5, 8.6
  const handleBatchDelete = useCallback(async () => {
    if (selectedCount === 0) return;

    const confirmed = window.confirm(
      `确定要删除选中的 ${selectedCount} 个模板吗？此操作不可撤销。`
    );
    if (!confirmed) return;

    setIsProcessing(true);

    try {
      // Send batch delete action to main process
      sendAction('batchDeleteTemplates', {
        templateIds: Array.from(state.selectedTemplateIds)
      });
      
      // Clear selection after delete
      dispatch({ type: 'CLEAR_TEMPLATE_SELECTION' });
    } catch (error) {
      console.error('Failed to batch delete templates:', error);
      alert(`批量删除失败: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  }, [selectedCount, state.selectedTemplateIds, sendAction, dispatch]);

  // Handle batch move - Requirements 8.7, 8.8
  const handleBatchMove = useCallback(() => {
    if (selectedCount === 0) return;
    setShowMoveDialog(true);
  }, [selectedCount]);

  // Handle move dialog confirm
  const handleMoveConfirm = useCallback(async () => {
    if (!selectedTargetGroupId) {
      alert('请选择目标分组');
      return;
    }

    setIsProcessing(true);

    try {
      // Send batch move action to main process
      sendAction('batchMoveTemplates', {
        templateIds: Array.from(state.selectedTemplateIds),
        targetGroupId: selectedTargetGroupId
      });
      
      // Clear selection and close dialog
      dispatch({ type: 'CLEAR_TEMPLATE_SELECTION' });
      setShowMoveDialog(false);
      setSelectedTargetGroupId(null);
    } catch (error) {
      console.error('Failed to batch move templates:', error);
      alert(`批量移动失败: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  }, [selectedTargetGroupId, state.selectedTemplateIds, sendAction, dispatch]);

  // Handle move dialog cancel
  const handleMoveCancel = useCallback(() => {
    setShowMoveDialog(false);
    setSelectedTargetGroupId(null);
  }, []);

  // Check if all current templates are selected
  const allSelected = currentTemplates.length > 0 && 
    currentTemplates.every(t => state.selectedTemplateIds.has(t.id));

  // Don't render if no templates selected - Requirement 8.1
  if (selectedCount === 0) {
    return null;
  }

  return (
    <>
      {/* Batch Operations Toolbar - Requirement 8.2 */}
      <div className="batch-operations-bar">
        <div className="batch-operations-info">
          <span className="batch-operations-count">
            已选中 {selectedCount} 个模板
          </span>
        </div>

        <div className="batch-operations-actions">
          {/* Select All / Clear Selection */}
          {allSelected ? (
            <button
              className="batch-btn ghost"
              onClick={handleClearSelection}
              disabled={isProcessing}
            >
              取消全选
            </button>
          ) : (
            <button
              className="batch-btn ghost"
              onClick={handleSelectAll}
              disabled={isProcessing}
            >
              全选
            </button>
          )}

          {/* Batch Move - Requirement 8.7 */}
          <button
            className="batch-btn primary"
            onClick={handleBatchMove}
            disabled={isProcessing}
          >
            移动到分组
          </button>

          {/* Batch Delete - Requirement 8.5 */}
          <button
            className="batch-btn danger"
            onClick={handleBatchDelete}
            disabled={isProcessing}
          >
            {isProcessing ? '删除中...' : '删除'}
          </button>

          {/* Clear Selection - Requirement 8.4 */}
          <button
            className="batch-btn ghost"
            onClick={handleClearSelection}
            disabled={isProcessing}
          >
            取消选择
          </button>
        </div>
      </div>

      {/* Move to Group Dialog - Requirement 8.7, 8.8 */}
      {showMoveDialog && (
        <div className="batch-move-overlay" onClick={handleMoveCancel}>
          <div className="batch-move-dialog" onClick={e => e.stopPropagation()}>
            <div className="batch-move-header">
              <h3>移动到分组</h3>
              <button className="batch-move-close" onClick={handleMoveCancel}>×</button>
            </div>
            
            <div className="batch-move-body">
              <p className="batch-move-text">
                选择目标分组以移动 {selectedCount} 个模板
              </p>

              <div className="batch-move-groups">
                {state.groups.map(group => (
                  <div
                    key={group.id}
                    className={`batch-move-group ${
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
                    <span className="batch-move-group-name">
                      {group.name}
                    </span>
                  </div>
                ))}
                
                {state.groups.length === 0 && (
                  <div className="batch-move-empty">
                    暂无可用分组
                  </div>
                )}
              </div>
            </div>

            <div className="batch-move-footer">
              <button
                className="batch-btn ghost"
                onClick={handleMoveCancel}
                disabled={isProcessing}
              >
                取消
              </button>
              <button
                className="batch-btn primary"
                onClick={handleMoveConfirm}
                disabled={isProcessing || !selectedTargetGroupId}
              >
                {isProcessing ? '移动中...' : '确认移动'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
