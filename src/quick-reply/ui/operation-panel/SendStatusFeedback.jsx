import React from 'react';
import PropTypes from 'prop-types';
import './SendStatusFeedback.css';

/**
 * SendStatusFeedback Component
 * 
 * Displays send status feedback with loading, success, error, and translating states.
 * Requirements: 14.1-14.7
 */
const SendStatusFeedback = ({ status, error, onCancel, onRetry }) => {
  if (!status || status === 'idle') {
    return null;
  }

  const renderContent = () => {
    switch (status) {
      case 'sending':
        return (
          <div className="send-status-feedback send-status-sending">
            <div className="send-status-icon">
              <div className="send-status-spinner"></div>
            </div>
            <span className="send-status-text">正在发送...</span>
            {onCancel && (
              <button
                className="send-status-cancel"
                onClick={onCancel}
                aria-label="取消发送"
              >
                取消
              </button>
            )}
          </div>
        );

      case 'translating':
        return (
          <div className="send-status-feedback send-status-translating">
            <div className="send-status-icon">
              <div className="send-status-spinner"></div>
            </div>
            <span className="send-status-text">正在翻译...</span>
            {onCancel && (
              <button
                className="send-status-cancel"
                onClick={onCancel}
                aria-label="取消翻译"
              >
                取消
              </button>
            )}
          </div>
        );

      case 'translated':
        return (
          <div className="send-status-feedback send-status-translated">
            <div className="send-status-icon">
              <div className="send-status-spinner"></div>
            </div>
            <span className="send-status-text">翻译完成，正在发送...</span>
          </div>
        );

      case 'success':
        return (
          <div className="send-status-feedback send-status-success">
            <div className="send-status-icon">
              <svg className="send-status-checkmark" viewBox="0 0 24 24">
                <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
              </svg>
            </div>
            <span className="send-status-text">发送成功</span>
          </div>
        );

      case 'error':
        return (
          <div className="send-status-feedback send-status-error">
            <div className="send-status-icon">
              <svg className="send-status-error-icon" viewBox="0 0 24 24">
                <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
              </svg>
            </div>
            <span className="send-status-text">
              {error || '发送失败'}
            </span>
            {onRetry && (
              <button
                className="send-status-retry"
                onClick={onRetry}
                aria-label="重试"
              >
                重试
              </button>
            )}
          </div>
        );

      case 'cancelled':
        return (
          <div className="send-status-feedback send-status-cancelled">
            <div className="send-status-icon">
              <svg className="send-status-cancelled-icon" viewBox="0 0 24 24">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm3.59-13L12 10.59 8.41 7 7 8.41 10.59 12 7 15.59 8.41 17 12 13.41 15.59 17 17 15.59 13.41 12 17 8.41z" />
              </svg>
            </div>
            <span className="send-status-text">已取消</span>
          </div>
        );

      case 'network_error':
        return (
          <div className="send-status-feedback send-status-error">
            <div className="send-status-icon">
              <svg className="send-status-error-icon" viewBox="0 0 24 24">
                <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
              </svg>
            </div>
            <span className="send-status-text">网络连接失败</span>
            {onRetry && (
              <button
                className="send-status-retry"
                onClick={onRetry}
                aria-label="重试"
              >
                重试
              </button>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  return renderContent();
};

SendStatusFeedback.propTypes = {
  status: PropTypes.oneOf([
    'idle',
    'sending',
    'translating',
    'translated',
    'success',
    'error',
    'cancelled',
    'network_error',
  ]).isRequired,
  error: PropTypes.string,
  onCancel: PropTypes.func,
  onRetry: PropTypes.func,
};

export default SendStatusFeedback;
