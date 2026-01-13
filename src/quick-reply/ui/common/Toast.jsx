import React, { useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';

/**
 * Toast Component
 * 
 * A notification toast component with different types and auto-dismiss.
 * 
 * @param {Object} props - Component props
 * @param {string} props.message - Toast message
 * @param {string} props.type - Toast type: 'success', 'error', 'warning', 'info'
 * @param {number} props.duration - Auto-dismiss duration in milliseconds (0 = no auto-dismiss)
 * @param {Function} props.onClose - Close handler
 * @param {string} props.position - Toast position: 'top-left', 'top-center', 'top-right', 'bottom-left', 'bottom-center', 'bottom-right'
 * @param {boolean} props.closable - Whether the toast can be manually closed
 */
const Toast = ({
  message,
  type = 'info',
  duration = 3000,
  onClose,
  position = 'top-center',
  closable = true,
}) => {
  const [visible, setVisible] = useState(true);

  const handleClose = useCallback(() => {
    setVisible(false);
    if (onClose) {
      setTimeout(onClose, 300); // Wait for animation to complete
    }
  }, [onClose]);

  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(() => {
        handleClose();
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [duration, handleClose]);

  if (!visible) {
    return null;
  }

  const getPositionStyles = () => {
    const positions = {
      'top-left': { top: '20px', left: '20px' },
      'top-center': { top: '20px', left: '50%', transform: 'translateX(-50%)' },
      'top-right': { top: '20px', right: '20px' },
      'bottom-left': { bottom: '20px', left: '20px' },
      'bottom-center': { bottom: '20px', left: '50%', transform: 'translateX(-50%)' },
      'bottom-right': { bottom: '20px', right: '20px' },
    };
    return positions[position] || positions['top-center'];
  };

  const getTypeStyles = () => {
    const types = {
      success: {
        backgroundColor: '#28a745',
        icon: '✓',
      },
      error: {
        backgroundColor: '#dc3545',
        icon: '✕',
      },
      warning: {
        backgroundColor: '#ffc107',
        icon: '⚠',
        color: '#333',
      },
      info: {
        backgroundColor: '#17a2b8',
        icon: 'ℹ',
      },
    };
    return types[type] || types.info;
  };

  const typeStyles = getTypeStyles();

  const toastStyles = {
    position: 'fixed',
    ...getPositionStyles(),
    backgroundColor: typeStyles.backgroundColor,
    color: typeStyles.color || '#ffffff',
    padding: '12px 16px',
    borderRadius: '4px',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    minWidth: '300px',
    maxWidth: '500px',
    zIndex: 2000,
    animation: 'toastSlideIn 0.3s ease',
  };

  const iconStyles = {
    fontSize: '18px',
    fontWeight: 'bold',
    flexShrink: 0,
  };

  const messageStyles = {
    flex: 1,
    fontSize: '14px',
    lineHeight: '1.5',
  };

  const closeButtonStyles = {
    background: 'none',
    border: 'none',
    color: 'inherit',
    fontSize: '20px',
    cursor: 'pointer',
    padding: '0',
    width: '24px',
    height: '24px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '4px',
    flexShrink: 0,
    opacity: 0.8,
    transition: 'opacity 0.2s ease',
  };

  return (
    <>
      <style>
        {`
          @keyframes toastSlideIn {
            from {
              opacity: 0;
              transform: translateY(-20px) ${position.includes('center') ? 'translateX(-50%)' : ''};
            }
            to {
              opacity: 1;
              transform: translateY(0) ${position.includes('center') ? 'translateX(-50%)' : ''};
            }
          }
          
          .qr-toast-close:hover {
            opacity: 1;
          }
        `}
      </style>
      
      <div style={toastStyles} className={`qr-toast qr-toast--${type}`}>
        <div style={iconStyles} className="qr-toast-icon">
          {typeStyles.icon}
        </div>
        
        <div style={messageStyles} className="qr-toast-message">
          {message}
        </div>
        
        {closable && (
          <button
            style={closeButtonStyles}
            className="qr-toast-close"
            onClick={handleClose}
            aria-label="Close"
          >
            ×
          </button>
        )}
      </div>
    </>
  );
};

Toast.propTypes = {
  message: PropTypes.string.isRequired,
  type: PropTypes.oneOf(['success', 'error', 'warning', 'info']),
  duration: PropTypes.number,
  onClose: PropTypes.func,
  position: PropTypes.oneOf([
    'top-left',
    'top-center',
    'top-right',
    'bottom-left',
    'bottom-center',
    'bottom-right',
  ]),
  closable: PropTypes.bool,
};

/**
 * ToastContainer Component
 * 
 * A container to manage multiple toast notifications.
 */
export const ToastContainer = ({ toasts = [], onRemove }) => {
  return (
    <>
      {toasts.map((toast) => (
        <Toast
          key={toast.id}
          message={toast.message}
          type={toast.type}
          duration={toast.duration}
          position={toast.position}
          closable={toast.closable}
          onClose={() => onRemove(toast.id)}
        />
      ))}
    </>
  );
};

ToastContainer.propTypes = {
  toasts: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      message: PropTypes.string.isRequired,
      type: PropTypes.string,
      duration: PropTypes.number,
      position: PropTypes.string,
      closable: PropTypes.bool,
    })
  ),
  onRemove: PropTypes.func.isRequired,
};

export default Toast;
