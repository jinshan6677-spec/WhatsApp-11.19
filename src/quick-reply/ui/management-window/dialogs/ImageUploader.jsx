import React, { useState, useCallback, useRef } from 'react';
import PropTypes from 'prop-types';
import Modal from '../../common/Modal';
import Button from '../../common/Button';
import { validateTemplateLabel, validateMediaFile } from '../../../utils/validation';
import { VISIBILITY_TYPES } from '../../../constants/visibilityTypes';
import { TEMPLATE_TYPES } from '../../../constants/templateTypes';
import LIMITS from '../../../constants/limits';
import './ImageUploader.css';

/**
 * ImageUploader Dialog Component
 * 
 * Modal dialog for uploading and managing image templates.
 * Supports image selection, preview, and validation.
 * 
 * Requirements: 5.3, 6.1
 * - Supports JPG, PNG, GIF formats
 * - Maximum file size: 5MB
 * 
 * @param {Object} props - Component props
 * @param {boolean} props.visible - Whether the dialog is visible
 * @param {Function} props.onClose - Close handler
 * @param {Function} props.onSave - Save handler (receives template data)
 * @param {Object} props.initialData - Initial data for editing (optional)
 * @param {string} props.groupId - Target group ID for new templates
 */
export default function ImageUploader({
  visible = false,
  onClose,
  onSave,
  initialData = null,
  groupId
}) {
  const isEditing = !!initialData?.id;
  const fileInputRef = useRef(null);
  
  // Form state
  const [label, setLabel] = useState(initialData?.label || '');
  const [visibility, setVisibility] = useState(
    initialData?.visibility || VISIBILITY_TYPES.PERSONAL
  );
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(initialData?.content?.mediaPath || null);
  const [errors, setErrors] = useState({});
  const [isSaving, setIsSaving] = useState(false);

  // Supported formats
  const SUPPORTED_FORMATS = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
  const MAX_SIZE_MB = Math.floor(LIMITS.IMAGE_MAX_SIZE / (1024 * 1024));

  // Reset form when dialog opens/closes
  const resetForm = useCallback(() => {
    setLabel(initialData?.label || '');
    setVisibility(initialData?.visibility || VISIBILITY_TYPES.PERSONAL);
    setImageFile(null);
    setImagePreview(initialData?.content?.mediaPath || null);
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

    // Validate image file
    if (!isEditing && !imageFile) {
      newErrors.imageFile = '请选择图片文件';
    } else if (imageFile) {
      try {
        validateMediaFile(imageFile, TEMPLATE_TYPES.IMAGE);
      } catch (error) {
        newErrors.imageFile = error.message;
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
    setErrors(prev => ({ ...prev, imageFile: null }));

    // Validate file type
    if (!SUPPORTED_FORMATS.includes(file.type.toLowerCase())) {
      setErrors(prev => ({
        ...prev,
        imageFile: `不支持的图片格式。支持的格式：JPG, PNG, GIF, WEBP`
      }));
      return;
    }

    // Validate file size
    if (file.size > LIMITS.IMAGE_MAX_SIZE) {
      setErrors(prev => ({
        ...prev,
        imageFile: `图片大小超过限制（最大 ${MAX_SIZE_MB}MB）`
      }));
      return;
    }

    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  // Handle drag and drop
  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    const file = e.dataTransfer.files[0];
    if (file) {
      // Create a synthetic event to reuse handleFileSelect logic
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
        type: TEMPLATE_TYPES.IMAGE,
        label: label.trim(),
        visibility,
        content: {
          mediaPath: imageFile ? URL.createObjectURL(imageFile) : imagePreview,
          mediaSize: imageFile?.size,
          mediaType: imageFile?.type
        },
        // Include the actual file for upload handling
        _file: imageFile
      };

      if (onSave) {
        await onSave(templateData);
      }

      resetForm();
      if (onClose) {
        onClose();
      }
    } catch (error) {
      console.error('Failed to save image template:', error);
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

  // Handle remove image
  const handleRemoveImage = () => {
    setImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const footer = (
    <div className="image-uploader-footer">
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
      title={isEditing ? '编辑图片' : '添加图片'}
      footer={footer}
      width="550px"
      className="image-uploader-modal"
    >
      <div className="image-uploader">
        {errors.general && (
          <div className="image-uploader-error-banner">{errors.general}</div>
        )}

        <div className="image-uploader-field">
          <label className="image-uploader-label">
            模板标签 <span className="required">*</span>
          </label>
          <input
            type="text"
            className={`image-uploader-input ${errors.label ? 'has-error' : ''}`}
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="请输入模板标签（最多50个字符）"
            maxLength={50}
          />
          {errors.label && (
            <span className="image-uploader-error">{errors.label}</span>
          )}
        </div>

        <div className="image-uploader-field">
          <label className="image-uploader-label">
            可见性 <span className="required">*</span>
          </label>
          <select
            className="image-uploader-select"
            value={visibility}
            onChange={(e) => setVisibility(e.target.value)}
          >
            <option value={VISIBILITY_TYPES.PERSONAL}>个人</option>
            <option value={VISIBILITY_TYPES.PUBLIC}>公共</option>
          </select>
        </div>

        <div className="image-uploader-field">
          <label className="image-uploader-label">
            图片文件 <span className="required">*</span>
          </label>
          
          <div 
            className={`image-uploader-dropzone ${errors.imageFile ? 'has-error' : ''}`}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onClick={() => fileInputRef.current?.click()}
          >
            {imagePreview ? (
              <div className="image-uploader-preview">
                <img src={imagePreview} alt="Preview" />
                <button 
                  className="image-uploader-remove-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemoveImage();
                  }}
                  title="移除图片"
                >
                  ×
                </button>
              </div>
            ) : (
              <div className="image-uploader-placeholder">
                <span className="image-uploader-icon">🖼️</span>
                <span className="image-uploader-text">
                  点击或拖拽图片到此处
                </span>
                <span className="image-uploader-hint">
                  支持 JPG, PNG, GIF, WEBP 格式，最大 {MAX_SIZE_MB}MB
                </span>
              </div>
            )}
          </div>
          
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
            onChange={handleFileSelect}
            className="image-uploader-file-input"
          />
          
          {errors.imageFile && (
            <span className="image-uploader-error">{errors.imageFile}</span>
          )}
          
          {imageFile && (
            <div className="image-uploader-file-info">
              <span className="file-name">{imageFile.name}</span>
              <span className="file-size">
                {(imageFile.size / 1024).toFixed(1)} KB
              </span>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}

ImageUploader.propTypes = {
  visible: PropTypes.bool,
  onClose: PropTypes.func,
  onSave: PropTypes.func,
  initialData: PropTypes.shape({
    id: PropTypes.string,
    groupId: PropTypes.string,
    label: PropTypes.string,
    visibility: PropTypes.string,
    content: PropTypes.shape({
      mediaPath: PropTypes.string
    })
  }),
  groupId: PropTypes.string
};
