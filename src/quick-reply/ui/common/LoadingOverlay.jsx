import React from 'react';
import PropTypes from 'prop-types';
import LoadingSpinner from './LoadingSpinner';

/**
 * LoadingOverlay Component
 * 
 * A full-screen or container overlay with loading spinner and optional message.
 * Requirements: 17.1, 17.5
 * 
 * @param {Object} props - Component props
 * @param {boolean} props.visible - Whether the overlay is visible
 * @param {string} props.message - Loading message to display
 * @param {boolean} props.fullScreen - Whether to cover the full screen
 * @param {string} props.className - Additional CSS classes
 */
const LoadingOverlay = ({
  visible = false,
  message = '加载中...',
  fullScreen = false,
  className = ''
}) => {
  if (!visible) {
    return null;
  }

  const overlayStyles = {
    position: fullScreen ? 'fixed' : 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: fullScreen ? 9999 : 100,
    animation: 'qr-fade-in 0.2s ease'
  };

  const messageStyles = {
    marginTop: '12px',
    fontSize: '14px',
    color: '#666',
    textAlign: 'center'
  };

  return (
    <>
      <style>
        {`
          @keyframes qr-fade-in {
            from { opacity: 0; }
            to { opacity: 1; }
          }
        `}
      </style>
      <div style={overlayStyles} className={`qr-loading-overlay ${className}`}>
        <LoadingSpinner size="large" />
        {message && <div style={messageStyles}>{message}</div>}
      </div>
    </>
  );
};

LoadingOverlay.propTypes = {
  visible: PropTypes.bool,
  message: PropTypes.string,
  fullScreen: PropTypes.bool,
  className: PropTypes.string
};

export default LoadingOverlay;
