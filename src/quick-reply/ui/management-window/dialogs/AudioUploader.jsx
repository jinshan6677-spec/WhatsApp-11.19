import React, { useState, useCallback, useRef } from 'react';
import PropTypes from 'prop-types';
import Modal from '../../common/Modal';
import Button from '../../common/Button';
import { validateTemplateLabel, validateMediaFile } from '../../../utils/validation';
import { VISIBILITY_TYPES } from '../../../constants/visibilityTypes';
import { TEMPLATE_TYPES } from '../../../constants/templateTypes';
import LIMITS from '../../../constants/limits';
import './AudioUploader.css';

/**
 * AudioUploader Dialog Component
 * 
 * Modal dialog for uploading and managing audio templates.
 * Supports audio selection, preview, and validation.
 * 
 * Requirements: 5.4, 6.2
 * - Supports MP3, WAV, OGG formats
 * - Maximum file size: 16MB
 * 
 * @param {Object} props - Component props
 * @param {boolean} props.visible - Whether the dialog is visible
 * @param {Function} props.onClose - Close handler
 * @param {Function} props.onSave - Save handler (receives template data)
 * @param {Object} props.initialData - Initial data for editing (optional)
 * @param {string} props.groupId - Target group ID for new templates
 */
export default function AudioUploader({
  visible = false,
  onClose,
  onSave,
  initialData = null,
  groupId
}) {
  const isEditing = !!initialData?.id;
  const fileInputRef = useRef(null);
  const audioRef = useRef(null);
  
  // Form state
  const [label, setLabel] = useState(initialData?.label || '');
  const [visibility, setVisibility] = useState(
    initialData?.visibility || VISIBILITY_TYPES.PERSONAL
  );
  const [audioFile, setAudioFile] = useState(null);
  const [audioPreview, setAudioPreview] = useState(initialData?.content?.mediaPath || null);
  const [audioDuration, setAudioDuration] = useState(initialData?.content?.mediaDuration || 0);
  const [errors, setErrors] = useState({});
  const [isSaving, setIsSaving] = useState(false);

  // Supported formats
  const SUPPORTED_FORMATS = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/webm', 'audio/aac'];
  const MAX_SIZE_MB = Math.floor(LIMITS.AUDIO_MAX_SIZE / (1024 * 1024));

  // Reset form when dialog opens/closes
  const resetForm = useCallback(() => {
    setLabel(initialData?.label || '');
    setVisibility(initialData?.visibility || VISIBILITY_TYPES.PERSONAL);
    setAudioFile(null);
    setAudioPreview(initialData?.content?.mediaPath || null);
    setAudioDuration(initialData?.content?.mediaDuration || 0);
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

    // Validate audio file
    if (!isEditing && !audioFile) {
      newErrors.audioFile = '请选择音频文件';
    } else if (audioFile) {
      try {
        validateMediaFile(audioFile, TEMPLATE_TYPES.AUDIO);
      } catch (error) {
        newErrors.audioFile = error.message;
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle file selection
  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Clear previous errors
    setErrors(prev => ({ ...prev, audioFile: null }));

    // Validate file type
    if (!SUPPORTED_FORMATS.includes(file.type.toLowerCase())) {
      setErrors(prev => ({
        ...prev,
        audioFile: `不支持的音频格式。支持的格式：MP3, WAV, OGG`
      }));
      return;
    }

    // Validate file size
    if (file.size > LIMITS.AUDIO_MAX_SIZE) {
      setErrors(prev => ({
        ...prev,
        audioFile: `音频大小超过限制（最大 ${MAX_SIZE_MB}MB）`
      }));
      return;
    }

    setAudioFile(file);
    const objectUrl = URL.createObjectURL(file);
    setAudioPreview(objectUrl);

    // Get audio duration
    const audio = new Audio(objectUrl);
    audio.addEventListener('loadedmetadata', () => {
      setAudioDuration(Math.round(audio.duration));
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
        type: TEMPLATE_TYPES.AUDIO,
        label: label.trim(),
        visibility,
        content: {
          mediaPath: audioFile ? URL.createObjectURL(audioFile) : audioPreview,
          mediaDuration: audioDuration,
          mediaSize: audioFile?.size,
          mediaType: audioFile?.type
        },
        // Include the actual file for upload handling
        _file: audioFile
      };

      if (onSave) {
        await onSave(templateData);
      }

      resetForm();
      if (onClose) {
        onClose();
      }
    } catch (error) {
      console.error('Failed to save audio template:', error);
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

  // Handle remove audio
  const handleRemoveAudio = () => {
    setAudioFile(null);
    setAudioPreview(null);
    setAudioDuration(0);
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
    <div className="audio-uploader-footer">
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
      title={isEditing ? '编辑音频' : '添加音频'}
      footer={footer}
      width="550px"
      className="audio-uploader-modal"
    >
      <div className="audio-uploader">
        {errors.general && (
          <div className="audio-uploader-error-banner">{errors.general}</div>
        )}

        <div className="audio-uploader-field">
          <label className="audio-uploader-label">
            模板标签 <span className="required">*</span>
          </label>
          <input
            type="text"
            className={`audio-uploader-input ${errors.label ? 'has-error' : ''}`}
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="请输入模板标签（最多50个字符）"
            maxLength={50}
          />
          {errors.label && (
            <span className="audio-uploader-error">{errors.label}</span>
          )}
        </div>

        <div className="audio-uploader-field">
          <label className="audio-uploader-label">
            可见性 <span className="required">*</span>
          </label>
          <select
            className="audio-uploader-select"
            value={visibility}
            onChange={(e) => setVisibility(e.target.value)}
          >
            <option value={VISIBILITY_TYPES.PERSONAL}>个人</option>
            <option value={VISIBILITY_TYPES.PUBLIC}>公共</option>
          </select>
        </div>

        <div className="audio-uploader-field">
          <label className="audio-uploader-label">
            音频文件 <span className="required">*</span>
          </label>
          
          <div 
            className={`audio-uploader-dropzone ${errors.audioFile ? 'has-error' : ''}`}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onClick={() => !audioPreview && fileInputRef.current?.click()}
          >
            {audioPreview ? (
              <div className="audio-uploader-preview">
                <div className="audio-player-container">
                  <audio 
                    ref={audioRef}
                    src={audioPreview} 
                    controls 
                    className="audio-player"
                  />
                  <div className="audio-duration">
                    时长: {formatDuration(audioDuration)}
                  </div>
                </div>
                <button 
                  className="audio-uploader-remove-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemoveAudio();
                  }}
                  title="移除音频"
                >
                  ×
                </button>
              </div>
            ) : (
              <div className="audio-uploader-placeholder">
                <span className="audio-uploader-icon">🎵</span>
                <span className="audio-uploader-text">
                  点击或拖拽音频到此处
                </span>
                <span className="audio-uploader-hint">
                  支持 MP3, WAV, OGG 格式，最大 {MAX_SIZE_MB}MB
                </span>
              </div>
            )}
          </div>
          
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/mpeg,audio/mp3,audio/wav,audio/ogg,audio/webm,audio/aac"
            onChange={handleFileSelect}
            className="audio-uploader-file-input"
          />
          
          {errors.audioFile && (
            <span className="audio-uploader-error">{errors.audioFile}</span>
          )}
          
          {audioFile && (
            <div className="audio-uploader-file-info">
              <span className="file-name">{audioFile.name}</span>
              <span className="file-size">
                {(audioFile.size / (1024 * 1024)).toFixed(2)} MB
              </span>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}

AudioUploader.propTypes = {
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
      mediaDuration: PropTypes.number
    })
  }),
  groupId: PropTypes.string
};
