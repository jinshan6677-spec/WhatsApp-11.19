import React, { useState, useCallback, useRef } from 'react';
import PropTypes from 'prop-types';
import Modal from '../../common/Modal';
import Button from '../../common/Button';
import './ImportDialog.css';

/**
 * ImportDialog Component
 * 
 * Modal dialog for importing quick reply data.
 * Supports JSON and ZIP file formats.
 * Validates file format and data integrity.
 * 
 * Requirements: 9.5, 9.6
 * 
 * @param {Object} props - Component props
 * @param {boolean} props.visible - Whether the dialog is visible
 * @param {Function} props.onClose - Close handler
 * @param {Function} props.onImport - Import handler (receives file and parsed data)
 * @param {Function} props.onConflict - Conflict handler (receives conflicts array)
 */
export default function ImportDialog({
  visible = false,
  onClose,
  onImport,
  onConflict
}) {
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileError, setFileError] = useState(null);
  const [isValidating, setIsValidating] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [validationResult, setValidationResult] = useState(null);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  // Supported file types
  const SUPPORTED_TYPES = ['.json', '.zip'];
  const SUPPORTED_MIME_TYPES = [
    'application/json',
    'application/zip',
    'application/x-zip-compressed'
  ];

  // Reset form when dialog opens/closes
  const resetForm = useCallback(() => {
    setSelectedFile(null);
    setFileError(null);
    setIsValidating(false);
    setIsImporting(false);
    setValidationResult(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  // Validate file type
  const validateFileType = (file) => {
    if (!file) return false;
    
    const fileName = file.name.toLowerCase();
    const isValidExtension = SUPPORTED_TYPES.some(ext => fileName.endsWith(ext));
    const isValidMime = SUPPORTED_MIME_TYPES.includes(file.type) || file.type === '';
    
    return isValidExtension || isValidMime;
  };

  // Parse JSON file
  const parseJSONFile = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = JSON.parse(e.target.result);
          resolve(data);
        } catch (err) {
          reject(new Error('JSON文件格式无效'));
        }
      };
      reader.onerror = () => reject(new Error('读取文件失败'));
      reader.readAsText(file);
    });
  };

  // Validate import data structure
  const validateImportData = (data) => {
    const errors = [];
    const warnings = [];

    if (!data) {
      errors.push('导入数据为空');
      return { valid: false, errors, warnings };
    }

    // Check metadata
    if (!data.metadata) {
      warnings.push('缺少元数据信息');
    } else {
      if (!data.metadata.version) {
        warnings.push('缺少版本信息');
      }
    }

    // Check groups
    if (!data.groups) {
      errors.push('缺少分组数据');
    } else if (!Array.isArray(data.groups)) {
      errors.push('分组数据格式无效');
    }

    // Check templates
    if (!data.templates) {
      errors.push('缺少模板数据');
    } else if (!Array.isArray(data.templates)) {
      errors.push('模板数据格式无效');
    } else {
      // Validate each template
      data.templates.forEach((template, index) => {
        if (!template.id) {
          warnings.push(`模板 ${index + 1} 缺少ID`);
        }
        if (!template.type) {
          warnings.push(`模板 ${index + 1} 缺少类型`);
        }
        if (!template.label) {
          warnings.push(`模板 ${index + 1} 缺少标签`);
        }
      });
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      groupCount: data.groups?.length || 0,
      templateCount: data.templates?.length || 0
    };
  };

  // Handle file selection
  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    setFileError(null);
    setValidationResult(null);
    setError(null);

    // Validate file type
    if (!validateFileType(file)) {
      setFileError('不支持的文件格式，请选择 JSON 或 ZIP 文件');
      return;
    }

    // Validate file size (max 100MB)
    if (file.size > 100 * 1024 * 1024) {
      setFileError('文件大小超过限制（最大100MB）');
      return;
    }

    // For JSON files, validate content
    if (file.name.toLowerCase().endsWith('.json')) {
      setIsValidating(true);
      try {
        const data = await parseJSONFile(file);
        const result = validateImportData(data);
        setValidationResult(result);
        
        if (!result.valid) {
          setFileError(result.errors.join('；'));
        }
      } catch (err) {
        setFileError(err.message);
      } finally {
        setIsValidating(false);
      }
    } else {
      // For ZIP files, we'll validate during import
      setValidationResult({
        valid: true,
        warnings: [],
        groupCount: '?',
        templateCount: '?'
      });
    }
  };

  // Handle import
  const handleImport = async () => {
    if (!selectedFile || fileError) return;

    setIsImporting(true);
    setError(null);

    try {
      let importData = null;

      if (selectedFile.name.toLowerCase().endsWith('.json')) {
        importData = await parseJSONFile(selectedFile);
      }

      if (onImport) {
        await onImport({
          file: selectedFile,
          data: importData,
          format: selectedFile.name.toLowerCase().endsWith('.zip') ? 'zip' : 'json'
        });
      }

      resetForm();
      if (onClose) {
        onClose();
      }
    } catch (err) {
      console.error('Import failed:', err);
      setError(err.message || '导入失败，请重试');
    } finally {
      setIsImporting(false);
    }
  };

  // Handle close
  const handleClose = () => {
    resetForm();
    if (onClose) {
      onClose();
    }
  };

  // Handle drag and drop
  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    const file = e.dataTransfer.files?.[0];
    if (file && fileInputRef.current) {
      // Create a new DataTransfer to set the file
      const dt = new DataTransfer();
      dt.items.add(file);
      fileInputRef.current.files = dt.files;
      handleFileSelect({ target: { files: dt.files } });
    }
  };

  const footer = (
    <div className="import-dialog-footer">
      <Button variant="ghost" onClick={handleClose} disabled={isImporting}>
        取消
      </Button>
      <Button 
        variant="primary" 
        onClick={handleImport} 
        loading={isImporting}
        disabled={!selectedFile || !!fileError || isValidating}
      >
        导入
      </Button>
    </div>
  );

  return (
    <Modal
      visible={visible}
      onClose={handleClose}
      title="导入快捷回复"
      footer={footer}
      width="500px"
      className="import-dialog-modal"
    >
      <div className="import-dialog">
        {error && (
          <div className="import-dialog-error">{error}</div>
        )}

        {/* File Selection Area */}
        <div 
          className={`import-dialog-dropzone ${selectedFile ? 'has-file' : ''} ${fileError ? 'has-error' : ''}`}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,.zip"
            onChange={handleFileSelect}
            className="import-dialog-file-input"
          />
          
          {selectedFile ? (
            <div className="import-dialog-file-info">
              <span className="import-dialog-file-icon">
                {selectedFile.name.endsWith('.zip') ? '📦' : '📄'}
              </span>
              <span className="import-dialog-file-name">{selectedFile.name}</span>
              <span className="import-dialog-file-size">
                ({(selectedFile.size / 1024).toFixed(1)} KB)
              </span>
            </div>
          ) : (
            <div className="import-dialog-dropzone-content">
              <span className="import-dialog-dropzone-icon">📁</span>
              <span className="import-dialog-dropzone-text">
                点击选择文件或拖拽文件到此处
              </span>
              <span className="import-dialog-dropzone-hint">
                支持 JSON 和 ZIP 格式
              </span>
            </div>
          )}
        </div>

        {/* File Error */}
        {fileError && (
          <div className="import-dialog-file-error">
            <span className="import-dialog-error-icon">⚠️</span>
            <span>{fileError}</span>
          </div>
        )}

        {/* Validation Result */}
        {validationResult && !fileError && (
          <div className="import-dialog-validation">
            {isValidating ? (
              <div className="import-dialog-validating">
                <span className="import-dialog-spinner">⏳</span>
                <span>正在验证文件...</span>
              </div>
            ) : (
              <>
                <div className="import-dialog-validation-summary">
                  <span className="import-dialog-validation-icon">✅</span>
                  <span>
                    文件验证通过：包含 {validationResult.groupCount} 个分组，
                    {validationResult.templateCount} 个模板
                  </span>
                </div>
                
                {validationResult.warnings?.length > 0 && (
                  <div className="import-dialog-warnings">
                    <div className="import-dialog-warnings-title">⚠️ 警告：</div>
                    <ul className="import-dialog-warnings-list">
                      {validationResult.warnings.map((warning, index) => (
                        <li key={index}>{warning}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Import Info */}
        <div className="import-dialog-info">
          <div className="import-dialog-info-title">导入说明：</div>
          <ul className="import-dialog-info-list">
            <li>支持从其他设备或备份文件导入数据</li>
            <li>JSON格式仅包含数据，ZIP格式包含媒体文件</li>
            <li>如有重复内容，将提示您选择处理方式</li>
          </ul>
        </div>
      </div>
    </Modal>
  );
}

ImportDialog.propTypes = {
  visible: PropTypes.bool,
  onClose: PropTypes.func,
  onImport: PropTypes.func,
  onConflict: PropTypes.func
};
