import React, { useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';

/**
 * Modal Component
 * 
 * A reusable modal dialog component with overlay and animations.
 * 
 * @param {Object} props - Component props
 * @param {boolean} props.visible - Whether the modal is visible
 * @param {Function} props.onClose - Close handler
 * @param {string} props.title - Modal title
 * @param {React.ReactNode} props.children - Modal content
 * @param {React.ReactNode} props.footer - Modal footer content
 * @param {string} props.width - Modal width
 * @param {boolean} props.closable - Whether the modal can be closed
 * @param {boolean} props.maskClosable - Whether clicking the mask closes the modal
 * @param {string} props.className - Additional CSS classes
 */
const Modal = ({
  visible = false,
  onClose,
  title = '',
  children,
  footer,
  width = '520px',
  closable = true,
  maskClosable = true,
  className = '',
}) => {
  // Handle ESC key press
  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Escape' && closable && onClose) {
      onClose();
    }
  }, [closable, onClose]);

  useEffect(() => {
    if (visible) {
      document.addEventListener('keydown', handleKeyDown);
      // Prevent body scroll when modal is open
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

  const overlayStyles = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    animation: 'fadeIn 0.2s ease',
  };

  const modalStyles = {
    backgroundColor: '#ffffff',
    borderRadius: '8px',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
    width: width,
    maxWidth: '90vw',
    maxHeight: '90vh',
    display: 'flex',
    flexDirection: 'column',
    animation: 'slideIn 0.3s ease',
  };

  const headerStyles = {
    padding: '16px 24px',
    borderBottom: '1px solid #e9ecef',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  };

  const titleStyles = {
    fontSize: '18px',
    fontWeight: 600,
    color: '#333',
    margin: 0,
  };

  const closeButtonStyles = {
    background: 'none',
    border: 'none',
    fontSize: '24px',
    color: '#6c757d',
    cursor: 'pointer',
    padding: '0',
    width: '32px',
    height: '32px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '4px',
    transition: 'background-color 0.2s ease',
  };

  const bodyStyles = {
    padding: '24px',
    flex: 1,
    overflowY: 'auto',
  };

  const footerStyles = {
    padding: '16px 24px',
    borderTop: '1px solid #e9ecef',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: '8px',
  };

  const handleMaskClick = (e) => {
    if (e.target === e.currentTarget && maskClosable && onClose) {
      onClose();
    }
  };

  return (
    <>
      <style>
        {`
          @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
          }
          
          @keyframes slideIn {
            from {
              opacity: 0;
              transform: translateY(-20px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
          
          .qr-modal-close-button:hover {
            background-color: #f8f9fa;
          }
        `}
      </style>
      
      <div
        style={overlayStyles}
        className="qr-modal-overlay"
        onClick={handleMaskClick}
      >
        <div style={modalStyles} className={`qr-modal ${className}`}>
          {(title || closable) && (
            <div style={headerStyles} className="qr-modal-header">
              <h3 style={titleStyles}>{title}</h3>
              {closable && (
                <button
                  style={closeButtonStyles}
                  className="qr-modal-close-button"
                  onClick={onClose}
                  aria-label="Close"
                >
                  ×
                </button>
              )}
            </div>
          )}
          
          <div style={bodyStyles} className="qr-modal-body">
            {children}
          </div>
          
          {footer && (
            <div style={footerStyles} className="qr-modal-footer">
              {footer}
            </div>
          )}
        </div>
      </div>
    </>
  );
};

Modal.propTypes = {
  visible: PropTypes.bool,
  onClose: PropTypes.func,
  title: PropTypes.string,
  children: PropTypes.node,
  footer: PropTypes.node,
  width: PropTypes.string,
  closable: PropTypes.bool,
  maskClosable: PropTypes.bool,
  className: PropTypes.string,
};

export default Modal;
