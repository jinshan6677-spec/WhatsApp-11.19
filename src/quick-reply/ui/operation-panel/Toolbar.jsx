import React, { useState, useRef, useEffect } from 'react';
import { useOperationPanel } from './OperationPanel';
import './Toolbar.css';

/**
 * Toolbar component for the operation panel
 * Provides refresh, edit management, copy, and settings menu buttons
 * Requirements: 20.1-20.8
 */
export default function Toolbar({ onManagementClick, onImport, onExport, onClearCache }) {
  const { loadData } = useOperationPanel();
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const [showCopyMenu, setShowCopyMenu] = useState(false);
  const settingsMenuRef = useRef(null);
  const copyMenuRef = useRef(null);

  // Close menus when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (settingsMenuRef.current && !settingsMenuRef.current.contains(event.target)) {
        setShowSettingsMenu(false);
      }
      if (copyMenuRef.current && !copyMenuRef.current.contains(event.target)) {
        setShowCopyMenu(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Handle refresh button click
  const handleRefresh = async () => {
    try {
      await loadData();
    } catch (error) {
      console.error('Failed to refresh data:', error);
    }
  };

  // Handle edit management button click
  const handleManagementClick = () => {
    if (onManagementClick) {
      onManagementClick();
    }
  };

  // Handle copy button click
  const handleCopyClick = () => {
    setShowCopyMenu(!showCopyMenu);
    setShowSettingsMenu(false);
  };

  // Handle settings menu button click
  const handleSettingsClick = () => {
    setShowSettingsMenu(!showSettingsMenu);
    setShowCopyMenu(false);
  };

  // Handle import
  const handleImport = () => {
    setShowSettingsMenu(false);
    if (onImport) {
      onImport();
    }
  };

  // Handle export
  const handleExport = () => {
    setShowSettingsMenu(false);
    if (onExport) {
      onExport();
    }
  };

  // Handle clear cache
  const handleClearCache = () => {
    setShowSettingsMenu(false);
    if (onClearCache) {
      onClearCache();
    }
  };

  // Handle copy current group
  const handleCopyCurrentGroup = () => {
    setShowCopyMenu(false);
    // TODO: Implement copy current group functionality
    console.log('Copy current group');
  };

  // Handle copy all templates
  const handleCopyAllTemplates = () => {
    setShowCopyMenu(false);
    // TODO: Implement copy all templates functionality
    console.log('Copy all templates');
  };

  return (
    <div className="toolbar">
      <button
        className="toolbar-button"
        onClick={handleRefresh}
        title="刷新"
        aria-label="刷新快捷回复列表"
      >
        <svg className="toolbar-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
      </button>

      <button
        className="toolbar-button"
        onClick={handleManagementClick}
        title="编辑管理"
        aria-label="打开管理界面"
      >
        <svg className="toolbar-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
      </button>

      <div className="toolbar-menu-container" ref={copyMenuRef}>
        <button
          className="toolbar-button"
          onClick={handleCopyClick}
          title="复制"
          aria-label="复制选项"
        >
          <svg className="toolbar-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
        </button>

        {showCopyMenu && (
          <div className="toolbar-dropdown-menu">
            <button
              className="toolbar-menu-item"
              onClick={handleCopyCurrentGroup}
            >
              复制当前分组
            </button>
            <button
              className="toolbar-menu-item"
              onClick={handleCopyAllTemplates}
            >
              复制所有模板
            </button>
          </div>
        )}
      </div>

      <div className="toolbar-menu-container" ref={settingsMenuRef}>
        <button
          className="toolbar-button"
          onClick={handleSettingsClick}
          title="设置"
          aria-label="设置菜单"
        >
          <svg className="toolbar-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
          </svg>
        </button>

        {showSettingsMenu && (
          <div className="toolbar-dropdown-menu">
            <button
              className="toolbar-menu-item"
              onClick={handleImport}
            >
              导入模板
            </button>
            <button
              className="toolbar-menu-item"
              onClick={handleExport}
            >
              导出模板
            </button>
            <div className="toolbar-menu-divider" />
            <button
              className="toolbar-menu-item"
              onClick={handleClearCache}
            >
              清空缓存
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
