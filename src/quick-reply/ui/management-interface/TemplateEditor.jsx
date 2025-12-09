import React, { useState, useEffect } from 'react';
import { useManagementInterface } from './ManagementInterface';
import Modal from '../common/Modal';
import Input from '../common/Input';
import Button from '../common/Button';
import './TemplateEditor.css';

/**
 * TemplateEditor Component
 * 
 * Modal dialog for creating and editing templates with:
 * - Template type selection
 * - Label input
 * - Content input/upload based on type
 * - Save and cancel actions
 * 
 * Requirements: 3.1-3.13, 5.1-5.5, 22.1-22.7
 */
export default function TemplateEditor() {
  const { state, dispatch, controller } = useManagementInterface();
  const { editingTemplate } = state;

  // Form state
  const [type, setType] = useState(editingTemplate?.type || 'text');
  const [label, setLabel] = useState(editingTemplate?.label || '');
  const [textContent, setTextContent] = useState(editingTemplate?.content?.text || '');
  const [mediaFile, setMediaFile] = useState(null);
  const [mediaPreview, setMediaPreview] = useState(editingTemplate?.content?.mediaPath || null);
  const [contactInfo, setContactInfo] = useState(
    editingTemplate?.content?.contactInfo || { name: '', phone: '', email: '' }
  );
  const [errors, setErrors] = useState({});
  const [isSaving, setIsSaving] = useState(false);

  // Check if editing existing template
  const isEditing = editingTemplate && editingTemplate.id;

  // Handle close
  const handleClose = () => {
    dispatch({ type: 'HIDE_TEMPLATE_EDITOR' });
  };

  // Validate form
  const validateForm = () => {
    const newErrors = {};

    // Validate label
    if (!label.trim()) {
      newErrors.label = '模板标签不能为空';
    } else if (label.length > 50) {
      newErrors.label = '模板标签不能超过50个字符';
    }

    // Validate content based on type
    if (type === 'text' || type === 'mixed') {
      if (!textContent.trim()) {
        newErrors.textContent = '文本内容不能为空';
      }
    }

    if (type === 'image' || type === 'video' || type === 'audio') {
      if (!isEditing && !mediaFile) {
        newErrors.mediaFile = '请选择媒体文件';
      }
    }

    if (type === 'mixed') {
      if (!isEditing && !mediaFile) {
        newErrors.mediaFile = '请选择图片文件';
      }
    }

    if (type === 'contact') {
      if (!contactInfo.name.trim()) {
        newErrors.contactName = '联系人姓名不能为空';
      }
      if (!contactInfo.phone.trim()) {
        newErrors.contactPhone = '联系人电话不能为空';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle save
  const handleSave = async () => {
    if (!validateForm()) return;

    setIsSaving(true);

    try {
      // Prepare content based on type
      let content = {};

      if (type === 'text') {
        content = { text: textContent };
      } else if (type === 'image' || type === 'video' || type === 'audio') {
        if (mediaFile) {
          // TODO: Handle file upload
          content = { mediaPath: URL.createObjectURL(mediaFile) };
        } else {
          content = { mediaPath: mediaPreview };
        }
      } else if (type === 'mixed') {
        if (mediaFile) {
          content = { 
            text: textContent,
            mediaPath: URL.createObjectURL(mediaFile)
          };
        } else {
          content = { 
            text: textContent,
            mediaPath: mediaPreview
          };
        }
      } else if (type === 'contact') {
        content = { contactInfo };
      }

      // Create or update template
      if (isEditing) {
        await controller.templateManager.updateTemplate(editingTemplate.id, {
          type,
          label,
          content
        });
      } else {
        await controller.templateManager.createTemplate(
          editingTemplate.groupId,
          type,
          label,
          content
        );
      }

      // Reload templates
      dispatch({ 
        type: 'SET_TEMPLATES', 
        payload: await controller.templateManager.getAllTemplates() 
      });

      // Close editor
      handleClose();
    } catch (error) {
      console.error('Failed to save template:', error);
      setErrors({ general: error.message });
    } finally {
      setIsSaving(false);
    }
  };

  // Handle media file change
  const handleMediaFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setMediaFile(file);
    setMediaPreview(URL.createObjectURL(file));
  };

  // Render content editor based on type
  const renderContentEditor = () => {
    switch (type) {
      case 'text':
        return (
          <div className="template-editor-field">
            <label className="template-editor-label">文本内容 *</label>
            <textarea
              className="template-editor-textarea"
              value={textContent}
              onChange={(e) => setTextContent(e.target.value)}
              placeholder="请输入文本内容..."
              rows={6}
            />
            {errors.textContent && (
              <span className="template-editor-error">{errors.textContent}</span>
            )}
          </div>
        );

      case 'image':
      case 'video':
      case 'audio':
        return (
          <div className="template-editor-field">
            <label className="template-editor-label">
              {type === 'image' ? '图片' : type === 'video' ? '视频' : '音频'}文件 *
            </label>
            <input
              type="file"
              accept={
                type === 'image' ? 'image/*' :
                type === 'video' ? 'video/*' :
                'audio/*'
              }
              onChange={handleMediaFileChange}
              className="template-editor-file-input"
            />
            {mediaPreview && (
              <div className="template-editor-preview">
                {type === 'image' && (
                  <img src={mediaPreview} alt="Preview" />
                )}
                {type === 'video' && (
                  <video src={mediaPreview} controls />
                )}
                {type === 'audio' && (
                  <audio src={mediaPreview} controls />
                )}
              </div>
            )}
            {errors.mediaFile && (
              <span className="template-editor-error">{errors.mediaFile}</span>
            )}
          </div>
        );

      case 'mixed':
        return (
          <>
            <div className="template-editor-field">
              <label className="template-editor-label">图片文件 *</label>
              <input
                type="file"
                accept="image/*"
                onChange={handleMediaFileChange}
                className="template-editor-file-input"
              />
              {mediaPreview && (
                <div className="template-editor-preview">
                  <img src={mediaPreview} alt="Preview" />
                </div>
              )}
              {errors.mediaFile && (
                <span className="template-editor-error">{errors.mediaFile}</span>
              )}
            </div>
            <div className="template-editor-field">
              <label className="template-editor-label">文本内容 *</label>
              <textarea
                className="template-editor-textarea"
                value={textContent}
                onChange={(e) => setTextContent(e.target.value)}
                placeholder="请输入文本内容..."
                rows={4}
              />
              {errors.textContent && (
                <span className="template-editor-error">{errors.textContent}</span>
              )}
            </div>
          </>
        );

      case 'contact':
        return (
          <>
            <div className="template-editor-field">
              <label className="template-editor-label">联系人姓名 *</label>
              <Input
                type="text"
                value={contactInfo.name}
                onChange={(e) => setContactInfo({ ...contactInfo, name: e.target.value })}
                placeholder="请输入联系人姓名"
              />
              {errors.contactName && (
                <span className="template-editor-error">{errors.contactName}</span>
              )}
            </div>
            <div className="template-editor-field">
              <label className="template-editor-label">联系人电话 *</label>
              <Input
                type="tel"
                value={contactInfo.phone}
                onChange={(e) => setContactInfo({ ...contactInfo, phone: e.target.value })}
                placeholder="请输入联系人电话"
              />
              {errors.contactPhone && (
                <span className="template-editor-error">{errors.contactPhone}</span>
              )}
            </div>
            <div className="template-editor-field">
              <label className="template-editor-label">联系人邮箱</label>
              <Input
                type="email"
                value={contactInfo.email}
                onChange={(e) => setContactInfo({ ...contactInfo, email: e.target.value })}
                placeholder="请输入联系人邮箱（可选）"
              />
            </div>
          </>
        );

      default:
        return null;
    }
  };

  return (
    <Modal
      isOpen={true}
      onClose={handleClose}
      title={isEditing ? '编辑模板' : '创建模板'}
      className="template-editor-modal"
    >
      <div className="template-editor">
        {errors.general && (
          <div className="template-editor-error-banner">{errors.general}</div>
        )}

        <div className="template-editor-field">
          <label className="template-editor-label">模板类型 *</label>
          <select
            className="template-editor-select"
            value={type}
            onChange={(e) => setType(e.target.value)}
            disabled={isEditing}
          >
            <option value="text">文本</option>
            <option value="image">图片</option>
            <option value="video">视频</option>
            <option value="audio">音频</option>
            <option value="mixed">图文</option>
            <option value="contact">名片</option>
          </select>
        </div>

        <div className="template-editor-field">
          <label className="template-editor-label">模板标签 *</label>
          <Input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="请输入模板标签（最多50个字符）"
            maxLength={50}
          />
          {errors.label && (
            <span className="template-editor-error">{errors.label}</span>
          )}
        </div>

        {renderContentEditor()}

        <div className="template-editor-actions">
          <Button
            variant="ghost"
            onClick={handleClose}
            disabled={isSaving}
          >
            取消
          </Button>
          <Button
            variant="primary"
            onClick={handleSave}
            loading={isSaving}
          >
            {isEditing ? '保存' : '创建'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
