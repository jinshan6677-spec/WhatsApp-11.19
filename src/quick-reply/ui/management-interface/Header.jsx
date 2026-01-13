import React from 'react';
import { useManagementInterface } from './ManagementInterface';
import Button from '../common/Button';
import './Header.css';

/**
 * Header Component
 * 
 * Displays the header section of the management interface with:
 * - Title and description
 * - Download template button
 * - Import/Add button
 * - Close button
 * 
 * Requirements: 30.1-30.5
 */
export default function Header({ onClose }) {
  const { controller } = useManagementInterface();

  // Handle download template
  const handleDownloadTemplate = () => {
    // TODO: Implement download template functionality
    console.log('Download template');
  };

  // Handle import
  const handleImport = async () => {
    try {
      // TODO: Implement import functionality
      console.log('Import templates');
    } catch (error) {
      console.error('Import failed:', error);
    }
  };

  // Handle add new template
  const handleAdd = () => {
    // TODO: Implement add new template functionality
    console.log('Add new template');
  };

  return (
    <div className="management-header">
      <div className="management-header-left">
        <h1 className="management-header-title">快捷回复</h1>
        <p className="management-header-description">
          预先设置一些常用的回复内容，帮助您更高效地回复消息
        </p>
      </div>
      
      <div className="management-header-right">
        <Button
          variant="ghost"
          size="medium"
          onClick={handleDownloadTemplate}
          className="management-header-button"
        >
          下载模板
        </Button>
        
        <Button
          variant="primary"
          size="medium"
          onClick={handleImport}
          className="management-header-button"
        >
          导入/添加
        </Button>
        
        <button
          className="management-header-close"
          onClick={onClose}
          aria-label="关闭管理界面"
        >
          ×
        </button>
      </div>
    </div>
  );
}
