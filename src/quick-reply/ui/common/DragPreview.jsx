import React, { useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';

/**
 * DragPreview Component
 * 
 * A floating preview that follows the cursor during drag operations.
 * Requirements: 17.4 - Drag preview effect
 * 
 * @param {Object} props - Component props
 * @param {boolean} props.visible - Whether the preview is visible
 * @param {string} props.type - Content type: 'group', 'template', 'text', 'image', 'audio', 'video'
 * @param {string} props.label - Label to display
 * @param {string} props.icon - Icon to display
 * @param {number} props.count - Number of items being dragged (for multi-select)
 * @param {Object} props.position - Current position { x, y }
 */
const DragPreview = ({
  visible = false,
  type = 'template',
  label = '',
  icon,
  count = 1,
  position = { x: 0, y: 0 }
}) => {
  if (!visible) {
    return null;
  }

  const getTypeIcon = () => {
    if (icon) return icon;
    
    const icons = {
      group: '📁',
      template: '📋',
      text: '📝',
      image: '🖼️',
      audio: '🎵',
      video: '🎬',
      imageText: '📄'
    };
    return icons[type] || icons.template;
  };

  const previewStyles = {
    position: 'fixed',
    left: position.x + 15,
    top: position.y + 15,
    backgroundColor: '#fff',
    border: '2px solid #1890ff',
    borderRadius: '8px',
    padding: '8px 12px',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    zIndex: 10000,
    pointerEvents: 'none',
    maxWidth: '200px',
    animation: 'qr-drag-preview-appear 0.15s ease'
  };

  const iconStyles = {
    fontSize: '18px',
    flexShrink: 0
  };

  const labelStyles = {
    fontSize: '13px',
    color: '#333',
    fontWeight: 500,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
  };

  const countBadgeStyles = {
    position: 'absolute',
    top: '-8px',
    right: '-8px',
    backgroundColor: '#1890ff',
    color: '#fff',
    fontSize: '11px',
    fontWeight: 600,
    minWidth: '18px',
    height: '18px',
    borderRadius: '9px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '0 4px'
  };

  return (
    <>
      <style>
        {`
          @keyframes qr-drag-preview-appear {
            from {
              opacity: 0;
              transform: scale(0.8);
            }
            to {
              opacity: 1;
              transform: scale(1);
            }
          }
        `}
      </style>
      <div style={previewStyles} className="qr-drag-preview">
        <span style={iconStyles}>{getTypeIcon()}</span>
        <span style={labelStyles}>{label || '拖拽中...'}</span>
        {count > 1 && (
          <span style={countBadgeStyles}>{count}</span>
        )}
      </div>
    </>
  );
};

DragPreview.propTypes = {
  visible: PropTypes.bool,
  type: PropTypes.string,
  label: PropTypes.string,
  icon: PropTypes.string,
  count: PropTypes.number,
  position: PropTypes.shape({
    x: PropTypes.number,
    y: PropTypes.number
  })
};

/**
 * useDragPreview Hook
 * 
 * Hook to manage drag preview state and position.
 * Requirements: 17.4 - Drag preview effect
 * 
 * @returns {Object} Drag preview state and handlers
 */
export const useDragPreview = () => {
  const [previewState, setPreviewState] = useState({
    visible: false,
    type: 'template',
    label: '',
    icon: null,
    count: 1,
    position: { x: 0, y: 0 }
  });

  // Track mouse position during drag
  const handleMouseMove = useCallback((e) => {
    if (previewState.visible) {
      setPreviewState(prev => ({
        ...prev,
        position: { x: e.clientX, y: e.clientY }
      }));
    }
  }, [previewState.visible]);

  // Add/remove mouse move listener
  useEffect(() => {
    if (previewState.visible) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('dragover', handleMouseMove);
    }
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('dragover', handleMouseMove);
    };
  }, [previewState.visible, handleMouseMove]);

  const showPreview = useCallback((options = {}) => {
    setPreviewState({
      visible: true,
      type: options.type || 'template',
      label: options.label || '',
      icon: options.icon || null,
      count: options.count || 1,
      position: options.position || { x: 0, y: 0 }
    });
  }, []);

  const hidePreview = useCallback(() => {
    setPreviewState(prev => ({
      ...prev,
      visible: false
    }));
  }, []);

  const updatePosition = useCallback((x, y) => {
    setPreviewState(prev => ({
      ...prev,
      position: { x, y }
    }));
  }, []);

  return {
    previewState,
    showPreview,
    hidePreview,
    updatePosition,
    DragPreviewComponent: () => <DragPreview {...previewState} />
  };
};

/**
 * DragPreviewProvider Component
 * 
 * Provides drag preview context to the application.
 */
export const DragPreviewContext = React.createContext(null);

export const DragPreviewProvider = ({ children }) => {
  const dragPreview = useDragPreview();

  return (
    <DragPreviewContext.Provider value={dragPreview}>
      {children}
      <dragPreview.DragPreviewComponent />
    </DragPreviewContext.Provider>
  );
};

DragPreviewProvider.propTypes = {
  children: PropTypes.node.isRequired
};

/**
 * useDragPreviewContext Hook
 * 
 * Hook to access drag preview context.
 */
export const useDragPreviewContext = () => {
  const context = React.useContext(DragPreviewContext);
  if (!context) {
    throw new Error('useDragPreviewContext must be used within a DragPreviewProvider');
  }
  return context;
};

export default DragPreview;
