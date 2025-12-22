import React from 'react';
import './ImportExportBar.css';

/**
 * ImportExportBar Component
 * 
 * Displays the bottom bar with import and export buttons.
 * 
 * Requirements: 9.1, 9.9
 */
export default function ImportExportBar({ onImport, onExport }) {
  return (
    <div className="import-export-bar">
      <button 
        className="import-export-btn import-btn" 
        onClick={onImport}
        title="导入快捷回复数据"
      >
        我要导入
      </button>
      
      <button 
        className="import-export-btn export-btn" 
        onClick={onExport}
        title="导出快捷回复数据"
      >
        我要导出
      </button>
    </div>
  );
}
