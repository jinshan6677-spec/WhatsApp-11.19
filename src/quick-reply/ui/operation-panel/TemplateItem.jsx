import React, { useState, useRef } from 'react';
import { useOperationPanel } from './OperationPanel';
import TemplatePreview from './TemplatePreview';
import SendStatusFeedback from './SendStatusFeedback';
import './TemplateItem.css';

/**
 * TemplateItem component
 * Displays a single template with send and insert buttons
 * Requirements: 4.1-4.12, 26.1-26.5, 27.1-27.6, 28.1-28.8, 14.1-14.7, 1.1.8
 * 
 * @param {Object} template - Template object to display
 * @param {number} index - Sequence number to display (1-based, continuous)
 *                         Requirement 1.1.8: Display sequence number on left side
 */
export default function TemplateItem({ template, index }) {
  const { state, controller } = useOperationPanel();
  const [showPreview, setShowPreview] = useState(false);
  const [sendStatus, setSendStatus] = useState('idle');
  const [sendError, setSendError] = useState(null);
  const operationIdRef = useRef(null);

  // Handle send button click
  const handleSend = async (e) => {
    e.stopPropagation();
    
    // Generate operation ID
    const operationId = `send_${template.id}_${Date.now()}`;
    operationIdRef.current = operationId;
    
    try {
      setSendStatus('sending');
      setSendError(null);
      
      // Status change callback
      const onStatusChange = (status, data) => {
        setSendStatus(status);
        if (data && data.error) {
          setSendError(data.error);
        }
      };
      
      if (state.sendMode === 'original') {
        await controller.sendManager.sendOriginal(template, operationId, onStatusChange);
      } else {
        // Get translation config from controller
        const targetLanguage = 'en'; // TODO: Get from translation settings
        const style = 'default'; // TODO: Get from translation settings
        await controller.sendManager.sendTranslated(template, targetLanguage, style, operationId, onStatusChange);
      }

      // Record usage
      await controller.templateManager.recordUsage(template.id);
      
      // Auto-hide success status after 2 seconds
      setTimeout(() => {
        setSendStatus('idle');
        setSendError(null);
      }, 2000);
    } catch (error) {
      console.error('Failed to send template:', error);
      setSendError(error.message || '发送失败');
      
      // Auto-hide error status after 5 seconds
      setTimeout(() => {
        if (sendStatus === 'error' || sendStatus === 'network_error') {
          setSendStatus('idle');
          setSendError(null);
        }
      }, 5000);
    }
  };

  // Handle cancel send
  const handleCancelSend = () => {
    if (operationIdRef.current) {
      controller.sendManager.cancelSend(operationIdRef.current);
      setSendStatus('cancelled');
      setSendError(null);
      
      // Auto-hide cancelled status after 2 seconds
      setTimeout(() => {
        setSendStatus('idle');
      }, 2000);
    }
  };

  // Handle retry send
  const handleRetrySend = (e) => {
    handleSend(e);
  };

  // Handle insert button click
  const handleInsert = async (e) => {
    e.stopPropagation();
    
    try {
      if (state.sendMode === 'original') {
        await controller.sendManager.insertOriginal(template);
      } else {
        // Get translation config from controller
        const targetLanguage = 'en'; // TODO: Get from translation settings
        const style = 'default'; // TODO: Get from translation settings
        await controller.sendManager.insertTranslated(template, targetLanguage, style);
      }

      // Record usage
      await controller.templateManager.recordUsage(template.id);
    } catch (error) {
      console.error('Failed to insert template:', error);
      // TODO: Show error toast
    }
  };

  // Handle preview click
  const handlePreviewClick = () => {
    setShowPreview(true);
  };

  // Handle preview close
  const handlePreviewClose = () => {
    setShowPreview(false);
  };

  const isProcessing = sendStatus !== 'idle' && sendStatus !== 'success' && sendStatus !== 'error' && sendStatus !== 'network_error' && sendStatus !== 'cancelled';

  return (
    <>
      <div className="template-item">
        <div className="template-item-number">{index}</div>

        <div 
          className="template-item-content"
          onClick={handlePreviewClick}
        >
          <TemplatePreview template={template} compact={true} />
        </div>

        <div className="template-item-actions">
          {sendStatus !== 'idle' ? (
            <SendStatusFeedback
              status={sendStatus}
              error={sendError}
              onCancel={isProcessing ? handleCancelSend : null}
              onRetry={(sendStatus === 'error' || sendStatus === 'network_error') ? handleRetrySend : null}
            />
          ) : (
            <>
              <button
                className="template-item-button template-item-send"
                onClick={handleSend}
                disabled={isProcessing}
                aria-label="发送模板"
              >
                发送
              </button>

              <button
                className="template-item-button template-item-insert"
                onClick={handleInsert}
                aria-label="插入到输入框"
              >
                输入框提示
              </button>
            </>
          )}
        </div>
      </div>

      {showPreview && (
        <div className="template-preview-modal" onClick={handlePreviewClose}>
          <div 
            className="template-preview-modal-content"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="template-preview-modal-header">
              <h3 className="template-preview-modal-title">{template.label}</h3>
              <button
                className="template-preview-modal-close"
                onClick={handlePreviewClose}
                aria-label="关闭预览"
              >
                ×
              </button>
            </div>
            <div className="template-preview-modal-body">
              <TemplatePreview template={template} compact={false} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
