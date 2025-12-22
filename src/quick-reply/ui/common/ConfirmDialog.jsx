import React, { useCallback, useEffect } from 'react';
import PropTypes from 'prop-types';

/**
 * ConfirmDialog Component
 * 
 * A confirmation dialog for destructive operations like delete.
 * Requirements: 17.3 - Delete operation confirmation
 * 
 * @param {Object} props - Component props
 * @param {boolean} props.visible - Whether the dialog is visible
 * @param {string} props.title - Dialog title
 * @param {string} props.message - Confirmation message
 * @param {string} props.confirmText - Text for confirm button
 * @param {string} props.cancelText - Text for cancel button
 * @param {string} props.type - Dialog type: 'warning', 'danger', 'info'
 * @param {Function} props.onConfirm - Handler for confirm action
 * @param {Function} props.onCancel - Handler for cancel action
 * @param {boolean} props.loading - Whether confirm action is in progress
 */
const ConfirmDialog = ({
  visible = false,
  title = '确认操作',
  message = '确定要执行此操作吗？',
  confirmText = '确定',
  cancelText = '取消',
  type = 'warning',
  onConfirm,
  onCancel,
  loading = false
}) => {
  // Handle ESC key press
  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Escape' && !loading && onCancel) {
      onCancel();
    }
  }, [loading, onCancel]);

  useEffect(() => {
    if (visible) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [visible, handleKeyDown]);

  if (!visible) {
    return null;
  }

  const getTypeStyles = () => {
    const types = {
      warning: {
        iconColor: '#faad14',
        icon: '⚠️',
        confirmBg: '#faad14',
        confirmHoverBg: '#d48806'
      },
      danger: {
        iconColor: '#ff4d4f',
        icon: '🗑️',
        confirmBg: '#ff4d4f',
        confirmHoverBg: '#cf1322'
      },
      info: {
        iconColor: '#1890ff',
        icon: 'ℹ️',
        confirmBg: '#1890ff',
        confirmHoverBg: '#096dd9'
      }
    };
    return types[type] || types.warning;
  };

  const typeStyles = getTypeStyles();

  const overlayStyles = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1100,
    animation: 'qr-confirm-fade-in 0.2s ease'
  };

  const dialogStyles = {
    backgroundColor: '#fff',
    borderRadius: '8px',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
    width: '420px',
    maxWidth: '90vw',
    animation: 'qr-confirm-scale-in 0.2s ease'
  };

  const headerStyles = {
    padding: '20px 24px 16px',
    display: 'flex',
    alignItems: 'flex-start',
    gap: '12px'
  };

  const iconStyles = {
    fontSize: '22px',
    flexShrink: 0
  };

  const contentStyles = {
    flex: 1
  };

  const titleStyles = {
    fontSize: '16px',
    fontWeight: 600,
    color: '#333',
    margin: 0,
    marginBottom: '8px'
  };

  const messageStyles = {
    fontSize: '14px',
    color: '#666',
    lineHeight: 1.5,
    margin: 0
  };

  const footerStyles = {
    padding: '12px 24px 20px',
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '8px'
  };

  const buttonBaseStyles = {
    padding: '8px 16px',
    fontSize: '14px',
    fontWeight: 500,
    borderRadius: '4px',
    cursor: loading ? 'not-allowed' : 'pointer',
    transition: 'all 0.2s ease',
    border: 'none',
    minWidth: '80px'
  };

  const cancelButtonStyles = {
    ...buttonBaseStyles,
    backgroundColor: '#fff',
    color: '#666',
    border: '1px solid #d9d9d9'
  };

  const confirmButtonStyles = {
    ...buttonBaseStyles,
    backgroundColor: typeStyles.confirmBg,
    color: '#fff',
    opacity: loading ? 0.7 : 1
  };

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget && !loading && onCancel) {
      onCancel();
    }
  };

  return (
    <>
      <style>
        {`
          @keyframes qr-confirm-fade-in {
            from { opacity: 0; }
            to { opacity: 1; }
          }
          
          @keyframes qr-confirm-scale-in {
            from {
              opacity: 0;
              transform: scale(0.9);
            }
            to {
              opacity: 1;
              transform: scale(1);
            }
          }
          
          .qr-confirm-cancel-btn:hover:not(:disabled) {
            border-color: #40a9ff;
            color: #40a9ff;
          }
          
          .qr-confirm-cancel-btn:active:not(:disabled) {
            transform: scale(0.97);
          }
          
          .qr-confirm-btn:hover:not(:disabled) {
            filter: brightness(1.1);
          }
          
          .qr-confirm-btn:active:not(:disabled) {
            transform: scale(0.97);
          }
          
          .qr-confirm-btn:focus-visible,
          .qr-confirm-cancel-btn:focus-visible {
            box-shadow: 0 0 0 3px rgba(24, 144, 255, 0.3);
            outline: none;
          }
          
          @keyframes qr-confirm-spinner {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
          
          .qr-confirm-spinner {
            display: inline-block;
            width: 14px;
            height: 14px;
            margin-right: 6px;
            animation: qr-confirm-spinner 1s linear infinite;
          }
        `}
      </style>
      
      <div style={overlayStyles} onClick={handleOverlayClick}>
        <div style={dialogStyles} className="qr-confirm-dialog">
          <div style={headerStyles}>
            <span style={iconStyles}>{typeStyles.icon}</span>
            <div style={contentStyles}>
              <h3 style={titleStyles}>{title}</h3>
              <p style={messageStyles}>{message}</p>
            </div>
          </div>
          
          <div style={footerStyles}>
            <button
              style={cancelButtonStyles}
              className="qr-confirm-cancel-btn"
              onClick={onCancel}
              disabled={loading}
            >
              {cancelText}
            </button>
            <button
              style={confirmButtonStyles}
              className="qr-confirm-btn"
              onClick={onConfirm}
              disabled={loading}
            >
              {loading && (
                <svg className="qr-confirm-spinner" viewBox="0 0 24 24" fill="none">
                  <circle
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeDasharray="50 30"
                  />
                </svg>
              )}
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

ConfirmDialog.propTypes = {
  visible: PropTypes.bool,
  title: PropTypes.string,
  message: PropTypes.string,
  confirmText: PropTypes.string,
  cancelText: PropTypes.string,
  type: PropTypes.oneOf(['warning', 'danger', 'info']),
  onConfirm: PropTypes.func,
  onCancel: PropTypes.func,
  loading: PropTypes.bool
};

export default ConfirmDialog;
