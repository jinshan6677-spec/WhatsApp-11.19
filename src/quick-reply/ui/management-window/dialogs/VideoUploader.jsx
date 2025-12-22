import React, { useState, useCallback, useRef } from 'react';
import PropTypes from 'prop-types';
import Modal from '../../common/Modal';
import Button from '../../common/Button';
import { validateTemplateLabel, validateMediaFile } from '../../../utils/validation';
import { VISIBILITY_TYPES } from '../../../constants/visibilityTypes';
import { TEMPLATE_TYPES } from '../../../constants/templateTypes';
import LIMITS from '../../../constants/limits';
import './VideoUploader.css';

/**
 * VideoUploader Dialog Component
 * 
 * Modal dialog for uploading and managing video templates.
 * Supports video selection, preview, and validation.
 * 
 * Requirements: 5.5, 6.3
 * - Supports MP4, WEBM formats
 * - Maximum file size: 64MB
 * 
 * @param {Object} props - Component props
 * @param {boolean} props.visible - Whether the dialog is visible
 * @param {Function} props.onClose - Close handler
 * @param {Function} props.onSave - Save handler (receives template data)
 * @param {Object} props.initialData - Initial data for editing (optional)
 * @param {string} props.groupId - Target group ID for new templates
 */
export default function VideoUploader({
  visible = false,
  onClose,
  onSave,
  initialData = null,
  groupId
}) {
  const isEditing = !!initialData?.id;
  const fileInputRef = useRef(null);
  const videoRef = useRef(null);
  
  // Form state
  const [label, setLabel] = useState(initialData?.label || '');
  const [visibility, setVisibility] = useState(
    initialData?.visibility || VISIBILITY_TYPES.PERSONAL
  );
  const [videoFile, setVideoFile] = useState(null);
  const [videoPreview, setVideoPreview] = useState(initialData?.content?.mediaPath || null);
  const [videoDuration, setVideoDuration] = useState(initialData?.content?.mediaDuration || 0);
  const [thumbnailUrl, setThumbnailUrl] = useState(initialData?.content?.thumbnailPath || null);
  const [errors, setErrors] = useState({});
  const [isSaving, setIsSaving] = useState(false);

  // Supported formats
  const SUPPORTED_FORMATS = ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime'];
  const MAX_SIZE_MB = Math.floor(LIMITS.VIDEO_MAX_SIZE / (1024 * 1024));

  // Reset form when dialog opens/closes
  const resetForm = useCallback(() => {
    setLabel(initialData?.label || '');
    setVisibility(initialData?.visibility || VISIBILITY_TYPES.PERSONAL);
    setVideoFile(null);
    setVideoPreview(initialData?.content?.mediaPath || null);
    setVideoDuration(initialData?.content?.mediaDuration || 0);
    setThumbnailUrl(initialData?.content?.thumbnailPath || null);
    setErrors({});
    setIsSaving(false);
  }, [initialData]);

  // Validate form
  const validateForm = () => {
    const newErrors = {};

    try {
      validateTemplateLabel(label);
    } catch (error) {
      newErrors.label = error.message;
    }

    // Validate video file
    if (!isEditing && !videoFile) {
      newErrors.videoFile = '请选择视频文件';
    } else if (videoFile) {
      try {
        validateMediaFile(videoFile, TEMPLATE_TYPES.VIDEO);
      } catch (error) {
        newErrors.videoFile = error.message;
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Generate thumbnail from video
  const generateThumbnail = (videoElement) => {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      canvas.width = videoElement.videoWidth;
      canvas.height = videoElement.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', 0.8));
    });
  };

  // Handle file selection
  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Clear previous errors
    setErrors(prev => ({ ...prev, videoFile: null }));

    // Validate file type
    if (!SUPPORTED_FORMATS.includes(file.type.toLowerCase())) {
      setErrors(prev => ({
        ...prev,
        videoFile: `不支持的视频格式。支持的格式：MP4, WEBM`
      }));
      return;
    }

    // Validate file size
    if (file.size > LIMITS.VIDEO_MAX_SIZE) {
      setErrors(prev => ({
        ...prev,
        videoFile: `视频大小超过限制（最大 ${MAX_SIZE_MB}MB）`
      }));
      return;
    }

    setVideoFile(file);
    const objectUrl = URL.createObjectURL(file);
    setVideoPreview(objectUrl);

    // Get video duration and generate thumbnail
    const video = document.createElement('video');
    video.src = objectUrl;
    video.addEventListener('loadedmetadata', () => {
      setVideoDuration(Math.round(video.duration));
    });
    video.addEventListener('loadeddata', async () => {
      // Seek to 1 second or 10% of duration for thumbnail
      video.currentTime = Math.min(1, video.duration * 0.1);
    });
    video.addEventListener('seeked', async () => {
      const thumbnail = await generateThumbnail(video);
      setThumbnailUrl(thumbnail);
    });
  };

  // Handle drag and drop
  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileSelect({ target: { files: [file] } });
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  // Handle save
  const handleSave = async () => {
    if (!validateForm()) return;

    setIsSaving(true);

    try {
      const templateData = {
        id: initialData?.id,
        groupId: groupId || initialData?.groupId,
        type: TEMPLATE_TYPES.VIDEO,
        label: label.trim(),
        visibility,
        content: {
          mediaPath: videoFile ? URL.createObjectURL(videoFile) : videoPreview,
          mediaDuration: videoDuration,
          mediaSize: videoFile?.size,
          mediaType: videoFile?.type,
          thumbnailPath: thumbnailUrl
        },
        // Include the actual file for upload handling
        _file: videoFile
      };

      if (onSave) {
        await onSave(templateData);
      }

      resetForm();
      if (onClose) {
        onClose();
      }
    } catch (error) {
      console.error('Failed to save video template:', error);
      setErrors({ general: error.message || '保存失败，请重试' });
    } finally {
      setIsSaving(false);
    }
  };

  // Handle close
  const handleClose = () => {
    resetForm();
    if (onClose) {
      onClose();
    }
  };

  // Handle remove video
  const handleRemoveVideo = () => {
    setVideoFile(null);
    setVideoPreview(null);
    setVideoDuration(0);
    setThumbnailUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Format duration
  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${String(secs).padStart(2, '0')}`;
  };

  const footer = (
    <div className="video-uploader-footer">
      <Button variant="ghost" onClick={handleClose} disabled={isSaving}>
        取消
      </Button>
      <Button variant="primary" onClick={handleSave} loading={isSaving}>
        {isEditing ? '保存' : '创建'}
      </Button>
    </div>
  );

  return (
    <Modal
      visible={visible}
      onClose={handleClose}
      title={isEditing ? '编辑视频' : '添加视频'}
      footer={footer}
      width="600px"
      className="video-uploader-modal"
    >
      <div className="video-uploader">
        {errors.general && (
          <div className="video-uploader-error-banner">{errors.general}</div>
        )}

        <div className="video-uploader-field">
          <label className="video-uploader-label">
            模板标签 <span className="required">*</span>
          </label>
          <input
            type="text"
            className={`video-uploader-input ${errors.label ? 'has-error' : ''}`}
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="请输入模板标签（最多50个字符）"
            maxLength={50}
          />
          {errors.label && (
            <span className="video-uploader-error">{errors.label}</span>
          )}
        </div>

        <div className="video-uploader-field">
          <label className="video-uploader-label">
            可见性 <span className="required">*</span>
          </label>
          <select
            className="video-uploader-select"
            value={visibility}
            onChange={(e) => setVisibility(e.target.value)}
          >
            <option value={VISIBILITY_TYPES.PERSONAL}>个人</option>
            <option value={VISIBILITY_TYPES.PUBLIC}>公共</option>
          </select>
        </div>

        <div className="video-uploader-field">
          <label className="video-uploader-label">
            视频文件 <span className="required">*</span>
          </label>
          
          <div 
            className={`video-uploader-dropzone ${errors.videoFile ? 'has-error' : ''}`}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onClick={() => !videoPreview && fileInputRef.current?.click()}
          >
            {videoPreview ? (
              <div className="video-uploader-preview">
                <div className="video-player-container">
                  <video 
                    ref={videoRef}
                    src={videoPreview} 
                    controls 
                    className="video-player"
                  />
                  <div className="video-info">
                    <span className="video-duration">
                      时长: {formatDuration(videoDuration)}
                    </span>
                  </div>
                </div>
                <button 
                  className="video-uploader-remove-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemoveVideo();
                  }}
                  title="移除视频"
                >
                  ×
                </button>
              </div>
            ) : (
              <div className="video-uploader-placeholder">
                <span className="video-uploader-icon">🎬</span>
                <span className="video-uploader-text">
                  点击或拖拽视频到此处
                </span>
                <span className="video-uploader-hint">
                  支持 MP4, WEBM 格式，最大 {MAX_SIZE_MB}MB
                </span>
              </div>
            )}
          </div>
          
          <input
            ref={fileInputRef}
            type="file"
            accept="video/mp4,video/webm,video/ogg,video/quicktime"
            onChange={handleFileSelect}
            className="video-uploader-file-input"
          />
          
          {errors.videoFile && (
            <span className="video-uploader-error">{errors.videoFile}</span>
          )}
          
          {videoFile && (
            <div className="video-uploader-file-info">
              <span className="file-name">{videoFile.name}</span>
              <span className="file-size">
                {(videoFile.size / (1024 * 1024)).toFixed(2)} MB
              </span>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}

VideoUploader.propTypes = {
  visible: PropTypes.bool,
  onClose: PropTypes.func,
  onSave: PropTypes.func,
  initialData: PropTypes.shape({
    id: PropTypes.string,
    groupId: PropTypes.string,
    label: PropTypes.string,
    visibility: PropTypes.string,
    content: PropTypes.shape({
      mediaPath: PropTypes.string,
      mediaDuration: PropTypes.number,
      thumbnailPath: PropTypes.string
    })
  }),
  groupId: PropTypes.string
};
