import React from 'react';
import MediaPlayer from './MediaPlayer';
import './TemplatePreview.css';

/**
 * TemplatePreview component
 * Displays preview of different template types
 * Requirements: 4.1-4.12
 */
export default function TemplatePreview({ template, compact = false }) {
  const { type, content, label } = template;

  // Render text preview
  const renderTextPreview = () => {
    const text = content.text || '';
    
    if (compact) {
      // Show first two lines in compact mode
      const lines = text.split('\n').slice(0, 2);
      const displayText = lines.join('\n');
      const hasMore = text.split('\n').length > 2;
      
      return (
        <div className="template-preview-text compact">
          <p className="template-preview-text-content">
            {displayText}
            {hasMore && <span className="template-preview-text-more">...</span>}
          </p>
        </div>
      );
    }
    
    return (
      <div className="template-preview-text">
        <p className="template-preview-text-content">{text}</p>
      </div>
    );
  };

  // Render image preview
  const renderImagePreview = () => {
    const imagePath = content.mediaPath;
    
    return (
      <div className="template-preview-image">
        <div className="template-preview-image-badge">图</div>
        {imagePath ? (
          <img 
            src={imagePath} 
            alt={label}
            className={`template-preview-image-img ${compact ? 'compact' : ''}`}
          />
        ) : (
          <div className="template-preview-image-placeholder">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span>图片模板</span>
          </div>
        )}
      </div>
    );
  };

  // Render audio preview
  const renderAudioPreview = () => {
    const audioPath = content.mediaPath;
    
    return (
      <div className="template-preview-audio">
        <MediaPlayer 
          type="audio" 
          src={audioPath} 
          compact={compact}
        />
      </div>
    );
  };

  // Render video preview
  const renderVideoPreview = () => {
    const videoPath = content.mediaPath;
    
    return (
      <div className="template-preview-video">
        <MediaPlayer 
          type="video" 
          src={videoPath} 
          compact={compact}
        />
      </div>
    );
  };

  // Render mixed (image + text) preview
  const renderMixedPreview = () => {
    const imagePath = content.mediaPath;
    const text = content.text || '';
    
    return (
      <div className="template-preview-mixed">
        <div className="template-preview-mixed-image">
          {imagePath ? (
            <img 
              src={imagePath} 
              alt={label}
              className={`template-preview-image-img ${compact ? 'compact' : ''}`}
            />
          ) : (
            <div className="template-preview-image-placeholder small">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
          )}
        </div>
        <div className="template-preview-mixed-text">
          {compact ? (
            <p className="template-preview-text-content compact">
              {text.split('\n').slice(0, 2).join('\n')}
              {text.split('\n').length > 2 && <span className="template-preview-text-more">...</span>}
            </p>
          ) : (
            <p className="template-preview-text-content">{text}</p>
          )}
        </div>
      </div>
    );
  };

  // Render contact preview
  const renderContactPreview = () => {
    const contactInfo = content.contactInfo || {};
    const { name, phone, email } = contactInfo;
    
    return (
      <div className="template-preview-contact">
        <div className="template-preview-contact-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        </div>
        <div className="template-preview-contact-info">
          <div className="template-preview-contact-name">{name || '未命名联系人'}</div>
          {!compact && (
            <>
              {phone && <div className="template-preview-contact-detail">{phone}</div>}
              {email && <div className="template-preview-contact-detail">{email}</div>}
            </>
          )}
          <div className="template-preview-contact-badge">名片模板</div>
        </div>
      </div>
    );
  };

  // Render based on type
  switch (type) {
    case 'text':
      return renderTextPreview();
    case 'image':
      return renderImagePreview();
    case 'audio':
      return renderAudioPreview();
    case 'video':
      return renderVideoPreview();
    case 'mixed':
      return renderMixedPreview();
    case 'contact':
      return renderContactPreview();
    default:
      return (
        <div className="template-preview-unknown">
          <span>未知模板类型</span>
        </div>
      );
  }
}
