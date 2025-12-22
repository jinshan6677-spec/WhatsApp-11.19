import React, { useState, useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
import Modal from '../../common/Modal';
import Button from '../../common/Button';
import './ConflictDialog.css';

/**
 * ConflictDialog Component
 * 
 * Modal dialog for resolving import conflicts.
 * Provides skip, overwrite, and rename options for each conflict.
 * 
 * Requirements: 9.7
 * 
 * @param {Object} props - Component props
 * @param {boolean} props.visible - Whether the dialog is visible
 * @param {Function} props.onClose - Close handler
 * @param {Function} props.onResolve - Resolve handler (receives resolutions object)
 * @param {Object} props.conflicts - Conflicts object { groups: [], templates: [] }
 */
export default function ConflictDialog({
  visible = false,
  onClose,
  onResolve,
  conflicts = { groups: [], templates: [] }
}) {
  // Resolution state: { 'group_id': 'skip'|'overwrite'|'rename', 'template_id': ... }
  const [resolutions, setResolutions] = useState({});
  const [isResolving, setIsResolving] = useState(false);
  const [error, setError] = useState(null);

  // Total conflicts count
  const totalConflicts = useMemo(() => {
    return (conflicts.groups?.length || 0) + (conflicts.templates?.length || 0);
  }, [conflicts]);

  // Initialize resolutions with default 'skip' for all conflicts
  const initializeResolutions = useCallback(() => {
    const initial = {};
    conflicts.groups?.forEach(conflict => {
      initial[`group_${conflict.importItem.id}`] = 'skip';
    });
    conflicts.templates?.forEach(conflict => {
      initial[`template_${conflict.importItem.id}`] = 'skip';
    });
    setResolutions(initial);
  }, [conflicts]);

  // Reset when dialog opens
  React.useEffect(() => {
    if (visible) {
      initializeResolutions();
      setError(null);
    }
  }, [visible, initializeResolutions]);

  // Handle resolution change
  const handleResolutionChange = (key, value) => {
    setResolutions(prev => ({
      ...prev,
      [key]: value
    }));
  };

  // Apply same resolution to all
  const applyToAll = (resolution) => {
    const newResolutions = {};
    conflicts.groups?.forEach(conflict => {
      newResolutions[`group_${conflict.importItem.id}`] = resolution;
    });
    conflicts.templates?.forEach(conflict => {
      newResolutions[`template_${conflict.importItem.id}`] = resolution;
    });
    setResolutions(newResolutions);
  };

  // Handle resolve
  const handleResolve = async () => {
    setIsResolving(true);
    setError(null);

    try {
      if (onResolve) {
        await onResolve(resolutions);
      }
      if (onClose) {
        onClose();
      }
    } catch (err) {
      console.error('Resolve failed:', err);
      setError(err.message || '解决冲突失败，请重试');
    } finally {
      setIsResolving(false);
    }
  };

  // Handle close (cancel import)
  const handleClose = () => {
    if (onClose) {
      onClose();
    }
  };

  // Render conflict item
  const renderConflictItem = (conflict, type) => {
    const key = `${type}_${conflict.importItem.id}`;
    const resolution = resolutions[key] || 'skip';
    const isGroup = type === 'group';
    const itemName = isGroup ? conflict.importItem.name : conflict.importItem.label;
    const existingName = isGroup ? conflict.existingItem?.name : conflict.existingItem?.label;

    return (
      <div key={key} className="conflict-item">
        <div className="conflict-item-header">
          <span className="conflict-item-icon">
            {isGroup ? '📁' : '📄'}
          </span>
          <span className="conflict-item-name">{itemName}</span>
          <span className="conflict-item-type">
            {conflict.type === 'id' ? '(ID冲突)' : isGroup ? '(名称冲突)' : '(标签冲突)'}
          </span>
        </div>
        
        <div className="conflict-item-details">
          <span className="conflict-item-message">{conflict.message}</span>
          {existingName && existingName !== itemName && (
            <span className="conflict-item-existing">
              现有: {existingName}
            </span>
          )}
        </div>

        <div className="conflict-item-options">
          <label className="conflict-option">
            <input
              type="radio"
              name={key}
              value="skip"
              checked={resolution === 'skip'}
              onChange={() => handleResolutionChange(key, 'skip')}
            />
            <span className="conflict-option-text">跳过</span>
            <span className="conflict-option-desc">不导入此项</span>
          </label>
          
          <label className="conflict-option">
            <input
              type="radio"
              name={key}
              value="overwrite"
              checked={resolution === 'overwrite'}
              onChange={() => handleResolutionChange(key, 'overwrite')}
            />
            <span className="conflict-option-text">覆盖</span>
            <span className="conflict-option-desc">替换现有内容</span>
          </label>
          
          <label className="conflict-option">
            <input
              type="radio"
              name={key}
              value="rename"
              checked={resolution === 'rename'}
              onChange={() => handleResolutionChange(key, 'rename')}
            />
            <span className="conflict-option-text">重命名</span>
            <span className="conflict-option-desc">创建新项目</span>
          </label>
        </div>
      </div>
    );
  };

  const footer = (
    <div className="conflict-dialog-footer">
      <Button variant="ghost" onClick={handleClose} disabled={isResolving}>
        取消导入
      </Button>
      <Button 
        variant="primary" 
        onClick={handleResolve} 
        loading={isResolving}
      >
        确认并继续
      </Button>
    </div>
  );

  return (
    <Modal
      visible={visible}
      onClose={handleClose}
      title="解决导入冲突"
      footer={footer}
      width="600px"
      className="conflict-dialog-modal"
    >
      <div className="conflict-dialog">
        {error && (
          <div className="conflict-dialog-error">{error}</div>
        )}

        {/* Summary */}
        <div className="conflict-dialog-summary">
          <span className="conflict-dialog-summary-icon">⚠️</span>
          <span className="conflict-dialog-summary-text">
            发现 {totalConflicts} 个冲突项，请选择处理方式
          </span>
        </div>

        {/* Quick Actions */}
        <div className="conflict-dialog-quick-actions">
          <span className="conflict-dialog-quick-label">快速操作：</span>
          <button 
            className="conflict-dialog-quick-btn"
            onClick={() => applyToAll('skip')}
          >
            全部跳过
          </button>
          <button 
            className="conflict-dialog-quick-btn"
            onClick={() => applyToAll('overwrite')}
          >
            全部覆盖
          </button>
          <button 
            className="conflict-dialog-quick-btn"
            onClick={() => applyToAll('rename')}
          >
            全部重命名
          </button>
        </div>

        {/* Conflicts List */}
        <div className="conflict-dialog-list">
          {/* Group Conflicts */}
          {conflicts.groups?.length > 0 && (
            <div className="conflict-section">
              <div className="conflict-section-header">
                <span className="conflict-section-title">分组冲突</span>
                <span className="conflict-section-count">({conflicts.groups.length})</span>
              </div>
              <div className="conflict-section-items">
                {conflicts.groups.map(conflict => renderConflictItem(conflict, 'group'))}
              </div>
            </div>
          )}

          {/* Template Conflicts */}
          {conflicts.templates?.length > 0 && (
            <div className="conflict-section">
              <div className="conflict-section-header">
                <span className="conflict-section-title">模板冲突</span>
                <span className="conflict-section-count">({conflicts.templates.length})</span>
              </div>
              <div className="conflict-section-items">
                {conflicts.templates.map(conflict => renderConflictItem(conflict, 'template'))}
              </div>
            </div>
          )}
        </div>

        {/* Info */}
        <div className="conflict-dialog-info">
          <div className="conflict-dialog-info-item">
            <span className="conflict-dialog-info-label">跳过：</span>
            <span className="conflict-dialog-info-desc">不导入该项，保留现有内容</span>
          </div>
          <div className="conflict-dialog-info-item">
            <span className="conflict-dialog-info-label">覆盖：</span>
            <span className="conflict-dialog-info-desc">用导入内容替换现有内容</span>
          </div>
          <div className="conflict-dialog-info-item">
            <span className="conflict-dialog-info-label">重命名：</span>
            <span className="conflict-dialog-info-desc">为导入内容生成新的ID和名称</span>
          </div>
        </div>
      </div>
    </Modal>
  );
}

ConflictDialog.propTypes = {
  visible: PropTypes.bool,
  onClose: PropTypes.func,
  onResolve: PropTypes.func,
  conflicts: PropTypes.shape({
    groups: PropTypes.arrayOf(PropTypes.shape({
      type: PropTypes.string,
      importItem: PropTypes.object,
      existingItem: PropTypes.object,
      message: PropTypes.string
    })),
    templates: PropTypes.arrayOf(PropTypes.shape({
      type: PropTypes.string,
      importItem: PropTypes.object,
      existingItem: PropTypes.object,
      message: PropTypes.string
    }))
  })
};
