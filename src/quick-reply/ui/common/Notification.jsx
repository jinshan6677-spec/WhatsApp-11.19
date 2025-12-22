import React, { useState, useEffect, useCallback, createContext, useContext } from 'react';
import PropTypes from 'prop-types';

/**
 * Notification Component
 * 
 * A notification component for success/error/warning/info messages.
 * Requirements: 17.6, 17.7 - Success and error notifications
 * 
 * @param {Object} props - Component props
 * @param {string} props.id - Unique notification ID
 * @param {string} props.type - Notification type: 'success', 'error', 'warning', 'info'
 * @param {string} props.title - Notification title
 * @param {string} props.message - Notification message
 * @param {number} props.duration - Auto-dismiss duration in ms (0 = no auto-dismiss)
 * @param {Function} props.onClose - Close handler
 */
const Notification = ({
  id,
  type = 'info',
  title,
  message,
  duration = 4000,
  onClose
}) => {
  const [isVisible, setIsVisible] = useState(true);
  const [isExiting, setIsExiting] = useState(false);

  const handleClose = useCallback(() => {
    setIsExiting(true);
    setTimeout(() => {
      setIsVisible(false);
      if (onClose) {
        onClose(id);
      }
    }, 300);
  }, [id, onClose]);

  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(handleClose, duration);
      return () => clearTimeout(timer);
    }
  }, [duration, handleClose]);

  if (!isVisible) {
    return null;
  }

  const getTypeConfig = () => {
    const configs = {
      success: {
        icon: '✓',
        bgColor: '#f6ffed',
        borderColor: '#b7eb8f',
        iconBg: '#52c41a',
        titleColor: '#52c41a'
      },
      error: {
        icon: '✕',
        bgColor: '#fff2f0',
        borderColor: '#ffccc7',
        iconBg: '#ff4d4f',
        titleColor: '#ff4d4f'
      },
      warning: {
        icon: '!',
        bgColor: '#fffbe6',
        borderColor: '#ffe58f',
        iconBg: '#faad14',
        titleColor: '#faad14'
      },
      info: {
        icon: 'i',
        bgColor: '#e6f7ff',
        borderColor: '#91d5ff',
        iconBg: '#1890ff',
        titleColor: '#1890ff'
      }
    };
    return configs[type] || configs.info;
  };

  const config = getTypeConfig();

  const containerStyles = {
    display: 'flex',
    alignItems: 'flex-start',
    padding: '12px 16px',
    backgroundColor: config.bgColor,
    border: `1px solid ${config.borderColor}`,
    borderRadius: '6px',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
    marginBottom: '8px',
    maxWidth: '380px',
    animation: isExiting 
      ? 'qr-notification-exit 0.3s ease forwards' 
      : 'qr-notification-enter 0.3s ease',
    position: 'relative'
  };

  const iconContainerStyles = {
    width: '24px',
    height: '24px',
    borderRadius: '50%',
    backgroundColor: config.iconBg,
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '14px',
    fontWeight: 'bold',
    flexShrink: 0,
    marginRight: '12px'
  };

  const contentStyles = {
    flex: 1,
    minWidth: 0
  };

  const titleStyles = {
    fontSize: '14px',
    fontWeight: 600,
    color: config.titleColor,
    margin: 0,
    marginBottom: message ? '4px' : 0
  };

  const messageStyles = {
    fontSize: '13px',
    color: '#666',
    margin: 0,
    lineHeight: 1.5,
    wordBreak: 'break-word'
  };

  const closeButtonStyles = {
    position: 'absolute',
    top: '8px',
    right: '8px',
    width: '20px',
    height: '20px',
    border: 'none',
    background: 'none',
    cursor: 'pointer',
    color: '#999',
    fontSize: '16px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '4px',
    transition: 'background-color 0.2s, color 0.2s'
  };

  return (
    <div style={containerStyles} className={`qr-notification qr-notification--${type}`}>
      <div style={iconContainerStyles}>
        {config.icon}
      </div>
      <div style={contentStyles}>
        {title && <h4 style={titleStyles}>{title}</h4>}
        {message && <p style={messageStyles}>{message}</p>}
      </div>
      <button
        style={closeButtonStyles}
        className="qr-notification-close"
        onClick={handleClose}
        aria-label="关闭"
      >
        ×
      </button>
    </div>
  );
};

Notification.propTypes = {
  id: PropTypes.string.isRequired,
  type: PropTypes.oneOf(['success', 'error', 'warning', 'info']),
  title: PropTypes.string,
  message: PropTypes.string,
  duration: PropTypes.number,
  onClose: PropTypes.func
};

/**
 * NotificationContainer Component
 * 
 * Container for displaying multiple notifications.
 */
const NotificationContainer = ({ notifications = [], onRemove, position = 'top-right' }) => {
  const getPositionStyles = () => {
    const positions = {
      'top-left': { top: '20px', left: '20px' },
      'top-center': { top: '20px', left: '50%', transform: 'translateX(-50%)' },
      'top-right': { top: '20px', right: '20px' },
      'bottom-left': { bottom: '20px', left: '20px' },
      'bottom-center': { bottom: '20px', left: '50%', transform: 'translateX(-50%)' },
      'bottom-right': { bottom: '20px', right: '20px' }
    };
    return positions[position] || positions['top-right'];
  };

  const containerStyles = {
    position: 'fixed',
    ...getPositionStyles(),
    zIndex: 2000,
    display: 'flex',
    flexDirection: 'column',
    gap: '8px'
  };

  return (
    <>
      <style>
        {`
          @keyframes qr-notification-enter {
            from {
              opacity: 0;
              transform: translateX(100%);
            }
            to {
              opacity: 1;
              transform: translateX(0);
            }
          }
          
          @keyframes qr-notification-exit {
            from {
              opacity: 1;
              transform: translateX(0);
            }
            to {
              opacity: 0;
              transform: translateX(100%);
            }
          }
          
          .qr-notification-close:hover {
            background-color: rgba(0, 0, 0, 0.06);
            color: #666;
          }
        `}
      </style>
      <div style={containerStyles}>
        {notifications.map((notification) => (
          <Notification
            key={notification.id}
            {...notification}
            onClose={onRemove}
          />
        ))}
      </div>
    </>
  );
};

NotificationContainer.propTypes = {
  notifications: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      type: PropTypes.string,
      title: PropTypes.string,
      message: PropTypes.string,
      duration: PropTypes.number
    })
  ),
  onRemove: PropTypes.func.isRequired,
  position: PropTypes.oneOf([
    'top-left',
    'top-center',
    'top-right',
    'bottom-left',
    'bottom-center',
    'bottom-right'
  ])
};

// Notification Context for global notification management
const NotificationContext = createContext(null);

/**
 * NotificationProvider Component
 * 
 * Provides notification context to the application.
 */
export const NotificationProvider = ({ children, position = 'top-right' }) => {
  const [notifications, setNotifications] = useState([]);

  const addNotification = useCallback((notification) => {
    const id = notification.id || `notification-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    setNotifications((prev) => [...prev, { ...notification, id }]);
    return id;
  }, []);

  const removeNotification = useCallback((id) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const success = useCallback((title, message, options = {}) => {
    return addNotification({ type: 'success', title, message, ...options });
  }, [addNotification]);

  const error = useCallback((title, message, options = {}) => {
    return addNotification({ type: 'error', title, message, duration: 6000, ...options });
  }, [addNotification]);

  const warning = useCallback((title, message, options = {}) => {
    return addNotification({ type: 'warning', title, message, ...options });
  }, [addNotification]);

  const info = useCallback((title, message, options = {}) => {
    return addNotification({ type: 'info', title, message, ...options });
  }, [addNotification]);

  const clearAll = useCallback(() => {
    setNotifications([]);
  }, []);

  const contextValue = {
    notifications,
    addNotification,
    removeNotification,
    success,
    error,
    warning,
    info,
    clearAll
  };

  return (
    <NotificationContext.Provider value={contextValue}>
      {children}
      <NotificationContainer
        notifications={notifications}
        onRemove={removeNotification}
        position={position}
      />
    </NotificationContext.Provider>
  );
};

NotificationProvider.propTypes = {
  children: PropTypes.node.isRequired,
  position: PropTypes.string
};

/**
 * useNotification Hook
 * 
 * Hook to access notification functions.
 */
export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
};

export default Notification;
export { NotificationContainer };
