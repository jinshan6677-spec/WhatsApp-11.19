import React, { useState, useCallback } from 'react';
import PropTypes from 'prop-types';
import Modal from '../../common/Modal';
import Button from '../../common/Button';
import { validateTemplateLabel, validateTextContent } from '../../../utils/validation';
import { VISIBILITY_TYPES } from '../../../constants/visibilityTypes';
import './TextEditor.css';

/**
 * TextEditor Dialog Component
 * 
 * Modal dialog for creating and editing text templates.
 * Supports text input with validation and visibility selection.
 * 
 * Requirements: 5.2
 * 
 * @param {Object} props - Component props
 * @param {boolean} props.visible - Whether the dialog is visible
 * @param {Function} props.onClose - Close handler
 * @param {Function} props.onSave - Save handler (receives template data)
 * @param {Object} props.initialData - Initial data for editing (optional)
 * @param {string} props.groupId - Target group ID for new templates
 */
export default function TextEditor({
  visible = false,
  onClose,
  onSave,
  initialData = null,
  groupId
}) {
  const isEditing = !!initialData?.id;
  
  // Form state
  const [label, setLabel] = useState(initialData?.label || '');
  const [textContent, setTextContent] = useState(initialData?.content?.text || '');
  const [visibility, setVisibility] = useState(
    initialData?.visibility || VISIBILITY_TYPES.PERSONAL
  );
  const [errors, setErrors] = useState({});
  const [isSaving, setIsSaving] = useState(false);

  // Reset form when dialog opens/closes
  const resetForm = useCallback(() => {
    setLabel(initialData?.label || '');
    setTextContent(initialData?.content?.text || '');
    setVisibility(initialData?.visibility || VISIBILITY_TYPES.PERSONAL);
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

    try {
      if (!textContent.trim()) {
        newErrors.textContent = '文本内容不能为空';
      } else {
        validateTextContent(textContent);
      }
    } catch (error) {
      newErrors.textContent = error.message;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle save
  const handleSave = async () => {
    if (!validateForm()) return;

    setIsSaving(true);

    try {
      const templateData = {
        id: initialData?.id,
        groupId: groupId || initialData?.groupId,
        type: 'text',
        label: label.trim(),
        visibility,
        content: {
          text: textContent
        }
      };

      if (onSave) {
        await onSave(templateData);
      }

      resetForm();
      if (onClose) {
        onClose();
      }
    } catch (error) {
      console.error('Failed to save text template:', error);
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

  const footer = (
    <div className="text-editor-footer">
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
      title={isEditing ? '编辑文本' : '添加文本'}
      footer={footer}
      width="500px"
      className="text-editor-modal"
    >
      <div className="text-editor">
        {errors.general && (
          <div className="text-editor-error-banner">{errors.general}</div>
        )}

        <div className="text-editor-field">
          <label className="text-editor-label">
            模板标签 <span className="required">*</span>
          </label>
          <input
            type="text"
            className={`text-editor-input ${errors.label ? 'has-error' : ''}`}
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="请输入模板标签（最多50个字符）"
            maxLength={50}
          />
          {errors.label && (
            <span className="text-editor-error">{errors.label}</span>
          )}
        </div>

        <div className="text-editor-field">
          <label className="text-editor-label">
            可见性 <span className="required">*</span>
          </label>
          <select
            className="text-editor-select"
            value={visibility}
            onChange={(e) => setVisibility(e.target.value)}
          >
            <option value={VISIBILITY_TYPES.PERSONAL}>个人</option>
            <option value={VISIBILITY_TYPES.PUBLIC}>公共</option>
          </select>
        </div>

        <div className="text-editor-field">
          <label className="text-editor-label">
            文本内容 <span className="required">*</span>
          </label>
          <textarea
            className={`text-editor-textarea ${errors.textContent ? 'has-error' : ''}`}
            value={textContent}
            onChange={(e) => setTextContent(e.target.value)}
            placeholder="请输入文本内容..."
            rows={8}
          />
          {errors.textContent && (
            <span className="text-editor-error">{errors.textContent}</span>
          )}
          <div className="text-editor-char-count">
            {textContent.length} / 4096 字符
          </div>
        </div>
      </div>
    </Modal>
  );
}

TextEditor.propTypes = {
  visible: PropTypes.bool,
  onClose: PropTypes.func,
  onSave: PropTypes.func,
  initialData: PropTypes.shape({
    id: PropTypes.string,
    groupId: PropTypes.string,
    label: PropTypes.string,
    visibility: PropTypes.string,
    content: PropTypes.shape({
      text: PropTypes.string
    })
  }),
  groupId: PropTypes.string
};
