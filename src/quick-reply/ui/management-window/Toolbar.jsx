import React, { useState, useCallback } from 'react';
import PropTypes from 'prop-types';
import './Toolbar.css';

/**
 * ToolbarButton Component
 * 
 * Individual toolbar button with click feedback effects.
 * Requirements: 17.1 - Button click effects
 */
function ToolbarButton({ 
  icon, 
  text, 
  onClick, 
  disabled, 
  loading = false,
  title,
  ariaLabel 
}) {
  const [isPressed, setIsPressed] = useState(false);

  const handleMouseDown = useCallback(() => {
    if (!disabled && !loading) {
      setIsPressed(true);
    }
  }, [disabled, loading]);

  const handleMouseUp = useCallback(() => {
    setIsPressed(false);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setIsPressed(false);
  }, []);

  const handleClick = useCallback((e) => {
    if (!disabled && !loading && onClick) {
      onClick(e);
    }
  }, [disabled, loading, onClick]);

  const buttonClass = `toolbar-btn toolbar-btn-link ${isPressed ? 'pressed' : ''} ${loading ? 'loading' : ''}`;

  return (
    <button 
      className={buttonClass}
      onClick={handleClick}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
      disabled={disabled || loading}
      title={title}
      aria-label={ariaLabel}
    >
      {loading ? (
        <span className="toolbar-btn-spinner">
          <svg 
            className="spinner-icon" 
            viewBox="0 0 24 24" 
            fill="none"
          >
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
        </span>
      ) : (
        <span className="toolbar-btn-icon">{icon}</span>
      )}
      <span className="toolbar-btn-text">{text}</span>
    </button>
  );
}

ToolbarButton.propTypes = {
  icon: PropTypes.string.isRequired,
  text: PropTypes.string.isRequired,
  onClick: PropTypes.func,
  disabled: PropTypes.bool,
  loading: PropTypes.bool,
  title: PropTypes.string,
  ariaLabel: PropTypes.string
};

/**
 * Toolbar Component
 * 
 * Displays the top toolbar with buttons for adding different content types:
 * - 添加文本 (Add Text)
 * - 添加图片 (Add Image)
 * - 添加音频 (Add Audio)
 * - 添加视频 (Add Video)
 * - 添加图文 (Add Image+Text)
 * 
 * Requirements: 2.4, 5.1, 17.1, 17.5
 * 
 * @param {Object} props - Component props
 * @param {Function} props.onAddText - Handler for adding text content
 * @param {Function} props.onAddImage - Handler for adding image content
 * @param {Function} props.onAddAudio - Handler for adding audio content
 * @param {Function} props.onAddVideo - Handler for adding video content
 * @param {Function} props.onAddImageText - Handler for adding image+text content
 * @param {boolean} props.disabled - Whether all buttons should be disabled
 * @param {string} props.selectedGroupId - Currently selected group ID (required for adding content)
 * @param {Object} props.loadingStates - Loading states for each button type
 */
export default function Toolbar({ 
  onAddText, 
  onAddImage, 
  onAddAudio, 
  onAddVideo, 
  onAddImageText,
  disabled = false,
  selectedGroupId = null,
  loadingStates = {}
}) {
  // Buttons are disabled if no group is selected or if explicitly disabled
  const isDisabled = disabled || !selectedGroupId;

  return (
    <div className="management-toolbar">
      <div className="toolbar-buttons">
        <ToolbarButton
          icon="📝"
          text="添加文本"
          onClick={onAddText}
          disabled={isDisabled}
          loading={loadingStates.text}
          title={isDisabled ? "请先选择分组" : "添加文本内容"}
          ariaLabel="添加文本"
        />
        
        <ToolbarButton
          icon="🖼️"
          text="添加图片"
          onClick={onAddImage}
          disabled={isDisabled}
          loading={loadingStates.image}
          title={isDisabled ? "请先选择分组" : "添加图片内容"}
          ariaLabel="添加图片"
        />
        
        <ToolbarButton
          icon="🎵"
          text="添加音频"
          onClick={onAddAudio}
          disabled={isDisabled}
          loading={loadingStates.audio}
          title={isDisabled ? "请先选择分组" : "添加音频内容"}
          ariaLabel="添加音频"
        />
        
        <ToolbarButton
          icon="🎬"
          text="添加视频"
          onClick={onAddVideo}
          disabled={isDisabled}
          loading={loadingStates.video}
          title={isDisabled ? "请先选择分组" : "添加视频内容"}
          ariaLabel="添加视频"
        />
        
        <ToolbarButton
          icon="📄"
          text="添加图文"
          onClick={onAddImageText}
          disabled={isDisabled}
          loading={loadingStates.imageText}
          title={isDisabled ? "请先选择分组" : "添加图文内容"}
          ariaLabel="添加图文"
        />
      </div>
      
      {isDisabled && !disabled && (
        <div className="toolbar-hint">
          请先选择一个分组以添加内容
        </div>
      )}
    </div>
  );
}

Toolbar.propTypes = {
  onAddText: PropTypes.func,
  onAddImage: PropTypes.func,
  onAddAudio: PropTypes.func,
  onAddVideo: PropTypes.func,
  onAddImageText: PropTypes.func,
  disabled: PropTypes.bool,
  selectedGroupId: PropTypes.string,
  loadingStates: PropTypes.shape({
    text: PropTypes.bool,
    image: PropTypes.bool,
    audio: PropTypes.bool,
    video: PropTypes.bool,
    imageText: PropTypes.bool
  })
};
