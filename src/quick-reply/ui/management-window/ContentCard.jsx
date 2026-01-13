import React, { useState, useRef, useEffect } from 'react';
import './ContentCard.css';

/**
 * ContentCard Component
 * 
 * Displays content preview based on type with selection and delete support.
 * 
 * Requirements: 4.2, 4.3, 4.4, 4.5, 4.6, 4.7
 * - 4.2: Mixed content displays both image and text
 * - 4.3: Image displays thumbnail
 * - 4.4: Video displays player and duration
 * - 4.5: Audio displays player controls (0:00/0:04 format)
 * - 4.6: Text displays text box
 * - 4.7: Delete button with × icon in top right
 */
export default function ContentCard({ 
  template, 
  isSelected = false, 
  onSelect, 
  onDelete,
  onEdit
}) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(template?.content?.mediaDuration || 0);
  const audioRef = useRef(null);

  // Format duration as m:ss format (e.g., 0:04)
  const formatDuration = (seconds) => {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Handle audio play/pause
  const handleAudioPlayPause = (e) => {
    e.stopPropagation();
    if (!audioRef.current) return;
    
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  // Audio event handlers
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
    const handleLoadedMetadata = () => setDuration(audio.duration);
    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('ended', handleEnded);
    };
  }, []);

  const renderPreview = () => {
    switch (template.type) {
      case 'text':
        // Requirement 4.6: Text displays text box
        return (
          <div className="content-card-preview text">
            <div className="content-card-text-box">
              {template.content?.text || template.label || ''}
            </div>
          </div>
        );

      case 'image':
        // Requirement 4.3: Image displays thumbnail
        return (
          <div className="content-card-preview image">
            {template.content?.mediaPath ? (
              <img 
                src={template.content.thumbnailPath || template.content.mediaPath} 
                alt={template.label}
                loading="lazy"
              />
            ) : (
              <div className="content-card-placeholder">🖼️ 图片</div>
            )}
          </div>
        );

      case 'audio':
        // Requirement 4.5: Audio displays player controls (0:00/0:04 format)
        return (
          <div className="content-card-preview audio">
            {template.content?.mediaPath && (
              <audio 
                ref={audioRef} 
                src={template.content.mediaPath} 
                preload="metadata"
              />
            )}
            <div className="content-card-audio-player">
              <button 
                className="audio-play-btn" 
                onClick={handleAudioPlayPause}
                aria-label={isPlaying ? '暂停' : '播放'}
              >
                {isPlaying ? (
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                )}
              </button>
              <div className="audio-progress">
                <div 
                  className="audio-progress-bar" 
                  style={{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }}
                />
              </div>
              <div className="audio-controls">
                <button className="audio-volume-btn" aria-label="音量">
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z" />
                  </svg>
                </button>
                <button className="audio-more-btn" aria-label="更多选项">
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
                  </svg>
                </button>
              </div>
              <span className="audio-time">
                {formatDuration(currentTime)}/{formatDuration(duration || template.content?.mediaDuration)}
              </span>
            </div>
          </div>
        );

      case 'video':
        // Requirement 4.4: Video displays player and duration
        return (
          <div className="content-card-preview video">
            {(template.content?.thumbnailPath || template.content?.mediaPath) ? (
              <img 
                src={template.content.thumbnailPath || template.content.mediaPath} 
                alt={template.label}
                loading="lazy"
              />
            ) : (
              <div className="content-card-placeholder">🎬 视频</div>
            )}
            <div className="video-overlay">
              <span className="video-play-icon">▶</span>
            </div>
            {(template.content?.mediaDuration || template.content?.mediaDuration === 0) && (
              <span className="video-duration">
                {formatDuration(template.content.mediaDuration)}
              </span>
            )}
          </div>
        );

      case 'imageText':
        // Requirement 4.2: Mixed content displays both
        return (
          <div className="content-card-preview imageText">
            {template.content?.mediaPath && (
              <div className="imagetext-image">
                <img 
                  src={template.content.thumbnailPath || template.content.mediaPath} 
                  alt={template.label}
                  loading="lazy"
                />
              </div>
            )}
            <div className="imagetext-text">
              {template.content?.text || ''}
            </div>
          </div>
        );

      default:
        return (
          <div className="content-card-preview text">
            <div className="content-card-text-box">
              {template.label || '未知类型'}
            </div>
          </div>
        );
    }
  };

  return (
    <div 
      className={`content-card ${isSelected ? 'selected' : ''}`} 
      data-id={template.id}
      data-type={template.type}
      onClick={(e) => onSelect && onSelect(template.id, e)}
      onDoubleClick={() => onEdit && onEdit(template.id)}
    >
      {/* Requirement 4.7: Delete button with × icon in top right */}
      <button 
        className="content-card-delete-btn" 
        onClick={(e) => {
          e.stopPropagation();
          onDelete && onDelete(template.id);
        }}
        title="删除"
        aria-label="删除内容"
      >
        ×
      </button>
      {renderPreview()}
      {/* Requirement 11.1: Display usage count */}
      {(template.usageCount !== undefined && template.usageCount > 0) && (
        <div className="content-card-usage-count" title={`使用次数: ${template.usageCount}`}>
          <span className="usage-icon">📊</span>
          <span className="usage-number">{template.usageCount}</span>
        </div>
      )}
    </div>
  );
}

// Export helper function for content type detection
export function getContentTypeIcon(type) {
  switch (type) {
    case 'text': return '📝';
    case 'image': return '🖼️';
    case 'audio': return '🎵';
    case 'video': return '🎬';
    case 'imageText': return '📄';
    default: return '📋';
  }
}

// Export helper function for content type label
export function getContentTypeLabel(type) {
  switch (type) {
    case 'text': return '文本';
    case 'image': return '图片';
    case 'audio': return '音频';
    case 'video': return '视频';
    case 'imageText': return '图文';
    default: return '未知';
  }
}
