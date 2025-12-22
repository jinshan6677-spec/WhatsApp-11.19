import React, { useState, useCallback } from 'react';
import PropTypes from 'prop-types';
import Modal from '../../common/Modal';
import Button from '../../common/Button';
import './ExportDialog.css';

/**
 * ExportDialog Component
 * 
 * Modal dialog for exporting quick reply data.
 * Supports exporting all, current group, or selected items.
 * Supports JSON and ZIP formats.
 * 
 * Requirements: 9.2, 9.3, 9.4
 * 
 * @param {Object} props - Component props
 * @param {boolean} props.visible - Whether the dialog is visible
 * @param {Function} props.onClose - Close handler
 * @param {Function} props.onExport - Export handler (receives export options)
 * @param {string} props.selectedGroupId - Currently selected group ID
 * @param {string} props.selectedGroupName - Currently selected group name
 * @param {number} props.selectedCount - Number of selected items
 * @param {number} props.totalCount - Total number of items
 */
export default function ExportDialog({
  visible = false,
  onClose,
  onExport,
  selectedGroupId = null,
  selectedGroupName = '',
  selectedCount = 0,
  totalCount = 0
}) {
  // Export scope: 'all' | 'group' | 'selected'
  const [exportScope, setExportScope] = useState('all');
  // Export format: 'json' | 'zip'
  const [exportFormat, setExportFormat] = useState('json');
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState(null);

  // Reset form when dialog opens
  const resetForm = useCallback(() => {
    setExportScope('all');
    setExportFormat('json');
    setIsExporting(false);
    setError(null);
  }, []);

  // Handle export
  const handleExport = async () => {
    setIsExporting(true);
    setError(null);

    try {
      const exportOptions = {
        scope: exportScope,
        format: exportFormat,
        groupId: exportScope === 'group' ? selectedGroupId : null
      };

      if (onExport) {
        await onExport(exportOptions);
      }

      resetForm();
      if (onClose) {
        onClose();
      }
    } catch (err) {
      console.error('Export failed:', err);
      setError(err.message || '导出失败，请重试');
    } finally {
      setIsExporting(false);
    }
  };

  // Handle close
  const handleClose = () => {
    resetForm();
    if (onClose) {
      onClose();
    }
  };

  // Get scope description
  const getScopeDescription = () => {
    switch (exportScope) {
      case 'all':
        return `将导出全部 ${totalCount} 个快捷回复`;
      case 'group':
        return selectedGroupId 
          ? `将导出分组"${selectedGroupName}"中的内容`
          : '请先选择一个分组';
      case 'selected':
        return selectedCount > 0
          ? `将导出选中的 ${selectedCount} 个快捷回复`
          : '请先选择要导出的内容';
      default:
        return '';
    }
  };

  // Check if export is valid
  const isExportValid = () => {
    if (exportScope === 'group' && !selectedGroupId) return false;
    if (exportScope === 'selected' && selectedCount === 0) return false;
    return true;
  };

  const footer = (
    <div className="export-dialog-footer">
      <Button variant="ghost" onClick={handleClose} disabled={isExporting}>
        取消
      </Button>
      <Button 
        variant="primary" 
        onClick={handleExport} 
        loading={isExporting}
        disabled={!isExportValid()}
      >
        导出
      </Button>
    </div>
  );

  return (
    <Modal
      visible={visible}
      onClose={handleClose}
      title="导出快捷回复"
      footer={footer}
      width="480px"
      className="export-dialog-modal"
    >
      <div className="export-dialog">
        {error && (
          <div className="export-dialog-error">{error}</div>
        )}

        {/* Export Scope Selection - Requirement 9.2 */}
        <div className="export-dialog-section">
          <label className="export-dialog-label">导出范围</label>
          <div className="export-dialog-options">
            <label className="export-dialog-option">
              <input
                type="radio"
                name="exportScope"
                value="all"
                checked={exportScope === 'all'}
                onChange={(e) => setExportScope(e.target.value)}
              />
              <span className="export-dialog-option-text">
                导出全部
                <span className="export-dialog-option-count">({totalCount}个)</span>
              </span>
            </label>
            
            <label className={`export-dialog-option ${!selectedGroupId ? 'disabled' : ''}`}>
              <input
                type="radio"
                name="exportScope"
                value="group"
                checked={exportScope === 'group'}
                onChange={(e) => setExportScope(e.target.value)}
                disabled={!selectedGroupId}
              />
              <span className="export-dialog-option-text">
                导出当前分组
                {selectedGroupName && (
                  <span className="export-dialog-option-name">({selectedGroupName})</span>
                )}
              </span>
            </label>
            
            <label className={`export-dialog-option ${selectedCount === 0 ? 'disabled' : ''}`}>
              <input
                type="radio"
                name="exportScope"
                value="selected"
                checked={exportScope === 'selected'}
                onChange={(e) => setExportScope(e.target.value)}
                disabled={selectedCount === 0}
              />
              <span className="export-dialog-option-text">
                导出选中项
                <span className="export-dialog-option-count">({selectedCount}个)</span>
              </span>
            </label>
          </div>
        </div>

        {/* Export Format Selection - Requirements 9.3, 9.4 */}
        <div className="export-dialog-section">
          <label className="export-dialog-label">导出格式</label>
          <div className="export-dialog-options">
            <label className="export-dialog-option">
              <input
                type="radio"
                name="exportFormat"
                value="json"
                checked={exportFormat === 'json'}
                onChange={(e) => setExportFormat(e.target.value)}
              />
              <span className="export-dialog-option-text">
                JSON格式
                <span className="export-dialog-option-desc">仅导出数据，不含媒体文件</span>
              </span>
            </label>
            
            <label className="export-dialog-option">
              <input
                type="radio"
                name="exportFormat"
                value="zip"
                checked={exportFormat === 'zip'}
                onChange={(e) => setExportFormat(e.target.value)}
              />
              <span className="export-dialog-option-text">
                ZIP格式
                <span className="export-dialog-option-desc">包含数据和媒体文件</span>
              </span>
            </label>
          </div>
        </div>

        {/* Export Description */}
        <div className="export-dialog-description">
          <span className="export-dialog-description-icon">ℹ️</span>
          <span className="export-dialog-description-text">{getScopeDescription()}</span>
        </div>
      </div>
    </Modal>
  );
}

ExportDialog.propTypes = {
  visible: PropTypes.bool,
  onClose: PropTypes.func,
  onExport: PropTypes.func,
  selectedGroupId: PropTypes.string,
  selectedGroupName: PropTypes.string,
  selectedCount: PropTypes.number,
  totalCount: PropTypes.number
};
