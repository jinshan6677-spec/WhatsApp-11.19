import React from 'react';
import PropTypes from 'prop-types';
import Modal from '../../common/Modal';
import Button from '../../common/Button';
import './ImportResultDialog.css';

/**
 * ImportResultDialog Component
 * 
 * Modal dialog for displaying import results.
 * Shows success and failure counts.
 * 
 * Requirements: 9.8
 * 
 * @param {Object} props - Component props
 * @param {boolean} props.visible - Whether the dialog is visible
 * @param {Function} props.onClose - Close handler
 * @param {Object} props.result - Import result object
 */
export default function ImportResultDialog({
  visible = false,
  onClose,
  result = null
}) {
  if (!result) return null;

  const { success, summary, errors, warnings } = result;
  
  // Calculate totals
  const totalImported = (summary?.groupsImported || 0) + (summary?.templatesImported || 0);
  const totalSkipped = (summary?.groupsSkipped || 0) + (summary?.templatesSkipped || 0);
  const totalFailed = (summary?.groupsFailed || 0) + (summary?.templatesFailed || 0);

  const footer = (
    <div className="import-result-footer">
      <Button variant="primary" onClick={onClose}>
        确定
      </Button>
    </div>
  );

  return (
    <Modal
      visible={visible}
      onClose={onClose}
      title="导入结果"
      footer={footer}
      width="450px"
      className="import-result-modal"
    >
      <div className="import-result-dialog">
        {/* Status Icon */}
        <div className={`import-result-status ${success ? 'success' : 'partial'}`}>
          <span className="import-result-status-icon">
            {success ? '✅' : totalFailed > 0 ? '⚠️' : '✅'}
          </span>
          <span className="import-result-status-text">
            {success 
              ? '导入完成' 
              : totalFailed > 0 
                ? '部分导入成功' 
                : '导入完成'}
          </span>
        </div>

        {/* Summary Stats */}
        <div className="import-result-summary">
          <div className="import-result-stat success">
            <span className="import-result-stat-value">{totalImported}</span>
            <span className="import-result-stat-label">成功导入</span>
          </div>
          
          {totalSkipped > 0 && (
            <div className="import-result-stat skipped">
              <span className="import-result-stat-value">{totalSkipped}</span>
              <span className="import-result-stat-label">已跳过</span>
            </div>
          )}
          
          {totalFailed > 0 && (
            <div className="import-result-stat failed">
              <span className="import-result-stat-value">{totalFailed}</span>
              <span className="import-result-stat-label">导入失败</span>
            </div>
          )}
        </div>

        {/* Detailed Breakdown */}
        <div className="import-result-details">
          <div className="import-result-detail-section">
            <div className="import-result-detail-header">详细信息</div>
            <div className="import-result-detail-items">
              <div className="import-result-detail-item">
                <span className="import-result-detail-icon">📁</span>
                <span className="import-result-detail-label">分组：</span>
                <span className="import-result-detail-value">
                  {summary?.groupsImported || 0} 成功
                  {summary?.groupsSkipped > 0 && `, ${summary.groupsSkipped} 跳过`}
                  {summary?.groupsFailed > 0 && `, ${summary.groupsFailed} 失败`}
                </span>
              </div>
              <div className="import-result-detail-item">
                <span className="import-result-detail-icon">📄</span>
                <span className="import-result-detail-label">模板：</span>
                <span className="import-result-detail-value">
                  {summary?.templatesImported || 0} 成功
                  {summary?.templatesSkipped > 0 && `, ${summary.templatesSkipped} 跳过`}
                  {summary?.templatesFailed > 0 && `, ${summary.templatesFailed} 失败`}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Warnings */}
        {warnings && warnings.length > 0 && (
          <div className="import-result-warnings">
            <div className="import-result-warnings-header">
              <span className="import-result-warnings-icon">⚠️</span>
              <span>警告 ({warnings.length})</span>
            </div>
            <ul className="import-result-warnings-list">
              {warnings.slice(0, 5).map((warning, index) => (
                <li key={index}>{warning}</li>
              ))}
              {warnings.length > 5 && (
                <li className="import-result-warnings-more">
                  还有 {warnings.length - 5} 条警告...
                </li>
              )}
            </ul>
          </div>
        )}

        {/* Errors */}
        {errors && errors.length > 0 && (
          <div className="import-result-errors">
            <div className="import-result-errors-header">
              <span className="import-result-errors-icon">❌</span>
              <span>错误 ({errors.length})</span>
            </div>
            <ul className="import-result-errors-list">
              {errors.slice(0, 5).map((error, index) => (
                <li key={index}>{error}</li>
              ))}
              {errors.length > 5 && (
                <li className="import-result-errors-more">
                  还有 {errors.length - 5} 条错误...
                </li>
              )}
            </ul>
          </div>
        )}
      </div>
    </Modal>
  );
}

ImportResultDialog.propTypes = {
  visible: PropTypes.bool,
  onClose: PropTypes.func,
  result: PropTypes.shape({
    success: PropTypes.bool,
    summary: PropTypes.shape({
      groupsImported: PropTypes.number,
      groupsSkipped: PropTypes.number,
      groupsFailed: PropTypes.number,
      templatesImported: PropTypes.number,
      templatesSkipped: PropTypes.number,
      templatesFailed: PropTypes.number
    }),
    errors: PropTypes.arrayOf(PropTypes.string),
    warnings: PropTypes.arrayOf(PropTypes.string)
  })
};
