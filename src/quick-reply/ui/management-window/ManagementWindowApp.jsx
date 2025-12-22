import React, { createContext, useContext, useReducer, useEffect, useCallback, useMemo } from 'react';
import Toolbar from './Toolbar';
import ImportExportBar from './ImportExportBar';
import SearchBox from './SearchBox';
import BatchOperationsBar from './BatchOperationsBar';
import './ManagementWindowApp.css';
import './SearchBox.css';
import './BatchOperationsBar.css';

// Context for management window state
const ManagementWindowContext = createContext();

// Initial state
const initialState = {
  accountId: null,
  selectedGroupId: null,
  selectedTemplateIds: new Set(),
  groups: [],
  templates: [],
  filteredTemplates: [],
  filteredGroups: [],
  searchKeyword: '',
  isSearching: false,
  isLoading: false,
  error: null,
  expandedGroups: new Set()
};

// Reducer for state management
function managementWindowReducer(state, action) {
  switch (action.type) {
    case 'SET_ACCOUNT_ID':
      return { ...state, accountId: action.payload };
    
    case 'SET_SELECTED_GROUP':
      return { ...state, selectedGroupId: action.payload };
    
    case 'SET_GROUPS':
      return { ...state, groups: action.payload };
    
    case 'SET_TEMPLATES':
      return { ...state, templates: action.payload };
    
    case 'SET_FILTERED_TEMPLATES':
      return { ...state, filteredTemplates: action.payload };
    
    case 'SET_FILTERED_GROUPS':
      return { ...state, filteredGroups: action.payload };
    
    case 'SET_SEARCH_KEYWORD':
      return { ...state, searchKeyword: action.payload, isSearching: action.payload.length > 0 };
    
    case 'CLEAR_SEARCH':
      return { 
        ...state, 
        searchKeyword: '', 
        isSearching: false,
        filteredTemplates: [],
        filteredGroups: []
      };
    
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    
    case 'SET_ERROR':
      return { ...state, error: action.payload };
    
    case 'TOGGLE_GROUP_EXPAND':
      const newExpandedGroups = new Set(state.expandedGroups);
      if (newExpandedGroups.has(action.payload)) {
        newExpandedGroups.delete(action.payload);
      } else {
        newExpandedGroups.add(action.payload);
      }
      return { ...state, expandedGroups: newExpandedGroups };
    
    case 'TOGGLE_TEMPLATE_SELECTION':
      const newSelectedTemplates = new Set(state.selectedTemplateIds);
      if (newSelectedTemplates.has(action.payload)) {
        newSelectedTemplates.delete(action.payload);
      } else {
        newSelectedTemplates.add(action.payload);
      }
      return { ...state, selectedTemplateIds: newSelectedTemplates };
    
    case 'CLEAR_TEMPLATE_SELECTION':
      return { ...state, selectedTemplateIds: new Set() };
    
    case 'SELECT_ALL_TEMPLATES':
      const allTemplateIds = new Set(action.payload || []);
      return { ...state, selectedTemplateIds: allTemplateIds };
    
    case 'RESET_STATE':
      return { ...initialState };
    
    default:
      return state;
  }
}

// Custom hook to use management window context
export function useManagementWindow() {
  const context = useContext(ManagementWindowContext);
  if (!context) {
    throw new Error('useManagementWindow must be used within ManagementWindowProvider');
  }
  return context;
}

/**
 * Highlights search keyword in text
 * Requirements: 7.4
 * @param {string} text - Text to highlight in
 * @param {string} keyword - Keyword to highlight
 * @returns {React.ReactNode} - Text with highlighted keyword
 */
function HighlightedText({ text, keyword }) {
  if (!text || !keyword) {
    return <>{text}</>;
  }

  const lowerText = text.toLowerCase();
  const lowerKeyword = keyword.toLowerCase();
  const index = lowerText.indexOf(lowerKeyword);

  if (index === -1) {
    return <>{text}</>;
  }

  const before = text.substring(0, index);
  const match = text.substring(index, index + keyword.length);
  const after = text.substring(index + keyword.length);

  return (
    <>
      {before}
      <mark className="mw-search-highlight">{match}</mark>
      {after}
    </>
  );
}

// Group List Item Component with context menu support
function GroupListItem({ group, level = 0, templates = [], searchKeyword = '' }) {
  const { state, dispatch, sendAction } = useManagementWindow();
  const [showContextMenu, setShowContextMenu] = React.useState(false);
  const [contextMenuPosition, setContextMenuPosition] = React.useState({ x: 0, y: 0 });
  const itemRef = React.useRef(null);

  const isExpanded = state.expandedGroups.has(group.id);
  const isSelected = state.selectedGroupId === group.id;
  const groupTemplates = templates.filter(t => t.groupId === group.id);
  const childGroups = state.groups.filter(g => g.parentId === group.id);

  const handleGroupSelect = () => {
    dispatch({ type: 'SET_SELECTED_GROUP', payload: group.id });
    sendAction('selectGroup', { groupId: group.id });
  };

  const handleGroupToggle = (e) => {
    e.stopPropagation();
    dispatch({ type: 'TOGGLE_GROUP_EXPAND', payload: group.id });
  };

  const handleContextMenu = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenuPosition({ x: e.clientX, y: e.clientY });
    setShowContextMenu(true);
  };

  const handleCloseContextMenu = () => {
    setShowContextMenu(false);
  };

  const handleCreateSubgroup = () => {
    sendAction('createSubgroup', { parentId: group.id });
    handleCloseContextMenu();
  };

  const handleRename = () => {
    const newName = window.prompt('请输入新的分组名称:', group.name);
    if (newName && newName.trim() && newName !== group.name) {
      sendAction('renameGroup', { groupId: group.id, name: newName.trim() });
    }
    handleCloseContextMenu();
  };

  const handleDelete = () => {
    const confirmed = window.confirm(
      `确定要删除分组"${group.name}"吗？这将同时删除分组内的所有模板。`
    );
    if (confirmed) {
      sendAction('deleteGroup', { groupId: group.id });
    }
    handleCloseContextMenu();
  };

  const handleMove = () => {
    sendAction('showMoveGroupDialog', { groupId: group.id });
    handleCloseContextMenu();
  };

  // Close context menu when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (e) => {
      if (showContextMenu && itemRef.current && !itemRef.current.contains(e.target)) {
        handleCloseContextMenu();
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [showContextMenu]);

  return (
    <div ref={itemRef}>
      <div
        className={`mw-group-item ${isSelected ? 'selected' : ''}`}
        style={{ paddingLeft: `${16 + level * 16}px` }}
        onClick={handleGroupSelect}
        onContextMenu={handleContextMenu}
        draggable
        onDragStart={(e) => {
          e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'group', id: group.id }));
          e.dataTransfer.effectAllowed = 'move';
        }}
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
        }}
        onDrop={(e) => {
          e.preventDefault();
          try {
            const data = JSON.parse(e.dataTransfer.getData('text/plain'));
            if (data.type === 'group' && data.id !== group.id) {
              sendAction('moveGroup', { groupId: data.id, targetParentId: group.id });
            }
          } catch (err) {
            console.error('Drop error:', err);
          }
        }}
      >
        <span 
          className="mw-group-icon"
          onClick={handleGroupToggle}
        >
          {(childGroups.length > 0 || groupTemplates.length > 0) 
            ? (isExpanded ? '▼' : '▶') 
            : '•'}
        </span>
        <span className="mw-group-name">
          <HighlightedText text={group.name} keyword={searchKeyword} />
        </span>
        <span className="mw-group-count">({groupTemplates.length})</span>
      </div>

      {/* Context Menu */}
      {showContextMenu && (
        <div 
          className="mw-context-menu"
          style={{ 
            position: 'fixed', 
            left: contextMenuPosition.x, 
            top: contextMenuPosition.y,
            zIndex: 1000
          }}
        >
          <div className="mw-context-menu-item" onClick={handleCreateSubgroup}>
            新建子分组
          </div>
          <div className="mw-context-menu-item" onClick={handleRename}>
            重命名
          </div>
          <div className="mw-context-menu-item" onClick={handleMove}>
            移动
          </div>
          <div className="mw-context-menu-divider"></div>
          <div className="mw-context-menu-item danger" onClick={handleDelete}>
            删除
          </div>
        </div>
      )}

      {/* Expanded content: child groups and templates */}
      {isExpanded && (
        <div className="mw-group-children">
          {/* Child groups */}
          {childGroups.map(childGroup => (
            <GroupListItem 
              key={childGroup.id} 
              group={childGroup} 
              level={level + 1}
              templates={templates}
              searchKeyword={searchKeyword}
            />
          ))}
          
          {/* Templates in this group */}
          {groupTemplates.map(template => (
            <div 
              key={template.id}
              className="mw-template-item"
              style={{ paddingLeft: `${32 + level * 16}px` }}
            >
              <span className="mw-template-icon">
                {template.type === 'text' ? '📝' : 
                 template.type === 'image' ? '🖼️' : 
                 template.type === 'audio' ? '🎵' : 
                 template.type === 'video' ? '🎬' : 
                 template.type === 'imageText' ? '📄' : '📋'}
              </span>
              <span className="mw-template-name">
                <HighlightedText text={template.label || '未命名'} keyword={searchKeyword} />
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Group Panel Component
// Requirements: 7.1, 7.2, 7.5, 7.6
function GroupPanel() {
  const { state, dispatch, sendAction, performSearch } = useManagementWindow();

  // Handle search input change
  const handleSearchChange = useCallback((keyword) => {
    dispatch({ type: 'SET_SEARCH_KEYWORD', payload: keyword });
    performSearch(keyword);
  }, [dispatch, performSearch]);

  // Handle search clear
  const handleSearchClear = useCallback(() => {
    dispatch({ type: 'CLEAR_SEARCH' });
  }, [dispatch]);

  const handleCreateGroup = () => {
    sendAction('createGroup');
  };

  // Use filtered groups when searching, otherwise use all groups
  const displayGroups = useMemo(() => {
    if (state.isSearching && state.filteredGroups.length > 0) {
      return state.filteredGroups;
    }
    if (state.isSearching && state.searchKeyword) {
      // Filter groups based on search keyword locally
      return state.groups.filter(group => 
        group.name.toLowerCase().includes(state.searchKeyword.toLowerCase())
      );
    }
    return state.groups;
  }, [state.groups, state.filteredGroups, state.isSearching, state.searchKeyword]);

  // Get top-level groups (no parent)
  const topLevelGroups = useMemo(() => {
    return displayGroups.filter(g => !g.parentId);
  }, [displayGroups]);

  // Determine if we should show no results message
  const showNoResults = state.isSearching && topLevelGroups.length === 0;

  return (
    <div className="mw-group-panel">
      <div className="mw-search-box">
        <SearchBox
          value={state.searchKeyword}
          onChange={handleSearchChange}
          onClear={handleSearchClear}
          placeholder="请输入关键词"
          debounceMs={300}
        />
      </div>
      
      <div className="mw-group-actions">
        <button className="mw-create-group-btn" onClick={handleCreateGroup}>
          + 新建分组
        </button>
      </div>
      
      <div className="mw-group-list">
        {showNoResults ? (
          // Requirement 7.6: No results message
          <div className="mw-search-no-results">
            <div className="mw-search-no-results-icon">🔍</div>
            <div className="mw-search-no-results-text">未找到匹配的内容</div>
            <div className="mw-search-no-results-hint">请尝试其他关键词</div>
          </div>
        ) : topLevelGroups.length === 0 ? (
          <div className="mw-empty-groups">暂无分组</div>
        ) : (
          topLevelGroups.map(group => (
            <GroupListItem 
              key={group.id} 
              group={group} 
              level={0}
              templates={state.templates}
              searchKeyword={state.searchKeyword}
            />
          ))
        )}
      </div>
    </div>
  );
}

// Content Card Component
// Requirements: 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 7.4, 8.1
function ContentCard({ template, isSelected, onSelect, onDelete, onCheckboxToggle, searchKeyword = '' }) {
  // Format duration as m:ss format (e.g., 0:04)
  const formatDuration = (seconds) => {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const renderPreview = () => {
    switch (template.type) {
      case 'text':
        // Requirement 4.6: Text displays text box
        // Requirement 7.4: Highlight search keyword
        return (
          <div className="mw-content-preview text">
            <div className="mw-text-content">
              <HighlightedText 
                text={template.content?.text || template.label || ''} 
                keyword={searchKeyword} 
              />
            </div>
          </div>
        );
      case 'image':
        // Requirement 4.3: Image displays thumbnail
        return (
          <div className="mw-content-preview image">
            {template.content?.mediaPath ? (
              <img 
                src={template.content.thumbnailPath || template.content.mediaPath} 
                alt={template.label}
                loading="lazy"
              />
            ) : (
              <div className="mw-media-placeholder">🖼️ 图片</div>
            )}
          </div>
        );
      case 'audio':
        // Requirement 4.5: Audio displays player controls with 0:00/0:04 format
        return (
          <div className="mw-content-preview audio">
            <div className="mw-audio-player-card">
              <button className="mw-audio-play-btn" aria-label="播放">
                <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </button>
              <div className="mw-audio-progress">
                <div className="mw-audio-progress-bar"></div>
              </div>
              <div className="mw-audio-controls">
                <button className="mw-audio-volume-btn" aria-label="音量">
                  <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
                    <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z" />
                  </svg>
                </button>
                <button className="mw-audio-more-btn" aria-label="更多选项">
                  <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
                    <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
                  </svg>
                </button>
              </div>
              <span className="mw-audio-time">
                0:00/{formatDuration(template.content?.mediaDuration)}
              </span>
            </div>
          </div>
        );
      case 'video':
        // Requirement 4.4: Video displays player and duration
        return (
          <div className="mw-content-preview video">
            {(template.content?.thumbnailPath || template.content?.mediaPath) ? (
              <img 
                src={template.content.thumbnailPath || template.content.mediaPath} 
                alt={template.label}
                loading="lazy"
              />
            ) : (
              <div className="mw-media-placeholder">🎬 视频</div>
            )}
            <div className="mw-video-overlay">
              <span className="mw-play-icon">▶</span>
            </div>
            {template.content?.mediaDuration && (
              <span className="mw-video-duration">
                {formatDuration(template.content.mediaDuration)}
              </span>
            )}
          </div>
        );
      case 'imageText':
        // Requirement 4.2: Mixed content displays both
        return (
          <div className="mw-content-preview imageText">
            {template.content?.mediaPath && (
              <img 
                src={template.content.thumbnailPath || template.content.mediaPath} 
                alt={template.label}
                loading="lazy"
              />
            )}
            <div className="mw-imagetext-text">
              <HighlightedText 
                text={template.content?.text || ''} 
                keyword={searchKeyword} 
              />
            </div>
          </div>
        );
      default:
        return (
          <div className="mw-content-preview text">
            {template.label || '未知类型'}
          </div>
        );
    }
  };

  // Handle checkbox click for batch selection - Requirement 8.1
  const handleCheckboxClick = (e) => {
    e.stopPropagation();
    if (onCheckboxToggle) {
      onCheckboxToggle(template.id);
    }
  };

  return (
    <div 
      className={`mw-content-card ${isSelected ? 'selected' : ''}`} 
      data-id={template.id}
      data-type={template.type}
      onClick={(e) => onSelect && onSelect(template.id, e)}
    >
      {/* Requirement 8.1: Checkbox for batch selection */}
      <input
        type="checkbox"
        className="mw-content-checkbox"
        checked={isSelected}
        onChange={handleCheckboxClick}
        onClick={(e) => e.stopPropagation()}
        aria-label="选择此内容"
      />
      
      {/* Requirement 4.7: Delete button with × icon in top right */}
      <button 
        className="mw-delete-btn" 
        onClick={(e) => {
          e.stopPropagation();
          onDelete(template.id);
        }}
        title="删除"
        aria-label="删除内容"
      >
        ×
      </button>
      {renderPreview()}
    </div>
  );
}

// Content Area Component
// Requirements: 4.1, 4.8, 4.9, 4.10, 7.4, 7.6, 8.1
function ContentArea() {
  const { state, dispatch, sendAction } = useManagementWindow();

  const handleDeleteTemplate = (templateId) => {
    const confirmed = window.confirm('确定要删除此内容吗？');
    if (confirmed) {
      sendAction('deleteTemplate', { templateId });
    }
  };

  const handleSelectTemplate = (templateId, event) => {
    // Support multi-select with Ctrl/Cmd key
    if (event && (event.ctrlKey || event.metaKey)) {
      dispatch({ type: 'TOGGLE_TEMPLATE_SELECTION', payload: templateId });
    } else {
      // Single select - clear others and select this one
      dispatch({ type: 'CLEAR_TEMPLATE_SELECTION' });
      dispatch({ type: 'TOGGLE_TEMPLATE_SELECTION', payload: templateId });
    }
  };

  // Handle checkbox toggle for batch selection - Requirement 8.1
  const handleCheckboxToggle = useCallback((templateId) => {
    dispatch({ type: 'TOGGLE_TEMPLATE_SELECTION', payload: templateId });
  }, [dispatch]);

  // Get templates to display based on search state
  const templates = useMemo(() => {
    // If searching and have filtered results, use them
    if (state.isSearching && state.filteredTemplates.length > 0) {
      return state.filteredTemplates;
    }
    
    // If searching but no filtered results from server, filter locally
    if (state.isSearching && state.searchKeyword) {
      const keyword = state.searchKeyword.toLowerCase();
      return state.templates.filter(t => {
        // Match by label
        if (t.label && t.label.toLowerCase().includes(keyword)) {
          return true;
        }
        // Match by text content
        if (t.content?.text && t.content.text.toLowerCase().includes(keyword)) {
          return true;
        }
        return false;
      });
    }
    
    // Not searching - filter by selected group
    return state.templates.filter(t => !state.selectedGroupId || t.groupId === state.selectedGroupId);
  }, [state.templates, state.filteredTemplates, state.isSearching, state.searchKeyword, state.selectedGroupId]);

  // Determine if we should show no results message
  const showNoResults = state.isSearching && templates.length === 0;

  return (
    <div className="mw-content-area">
      <div className="mw-content-grid">
        {showNoResults ? (
          // Requirement 7.6: No results message
          <div className="mw-empty-state">
            <div className="mw-empty-icon">🔍</div>
            <div className="mw-empty-text">未找到匹配的内容</div>
            <div className="mw-empty-hint">请尝试其他关键词</div>
          </div>
        ) : templates.length === 0 ? (
          <div className="mw-empty-state">
            <div className="mw-empty-icon">📝</div>
            <div className="mw-empty-text">
              {state.selectedGroupId 
                ? '该分组暂无内容，请通过顶部工具栏添加'
                : '请选择分组或通过顶部工具栏添加内容'
              }
            </div>
          </div>
        ) : (
          templates.map(template => (
            <ContentCard
              key={template.id}
              template={template}
              isSelected={state.selectedTemplateIds.has(template.id)}
              onSelect={handleSelectTemplate}
              onDelete={handleDeleteTemplate}
              onCheckboxToggle={handleCheckboxToggle}
              searchKeyword={state.searchKeyword}
            />
          ))
        )}
      </div>
    </div>
  );
}

// Main ManagementWindowApp component
export default function ManagementWindowApp({ accountId }) {
  const [state, dispatch] = useReducer(managementWindowReducer, {
    ...initialState,
    accountId
  });

  // Send action to main process via IPC
  const sendAction = useCallback((action, data = {}) => {
    if (typeof window !== 'undefined' && window.require) {
      try {
        const { ipcRenderer } = window.require('electron');
        ipcRenderer.send('management-window-action', {
          action,
          accountId: state.accountId,
          ...data
        });
      } catch (error) {
        console.error('Failed to send IPC action:', error);
      }
    }
  }, [state.accountId]);

  // Perform search - sends to main process and filters locally
  // Requirements: 7.1, 7.2
  const performSearch = useCallback((keyword) => {
    // Send search action to main process for server-side filtering
    sendAction('search', { keyword });
    
    // Also filter locally for immediate feedback
    if (!keyword || keyword.trim() === '') {
      dispatch({ type: 'SET_FILTERED_TEMPLATES', payload: [] });
      dispatch({ type: 'SET_FILTERED_GROUPS', payload: [] });
      return;
    }

    const lowerKeyword = keyword.toLowerCase().trim();
    
    // Filter templates locally
    const filteredTemplates = state.templates.filter(template => {
      // Match by label
      if (template.label && template.label.toLowerCase().includes(lowerKeyword)) {
        return true;
      }
      // Match by text content
      if (template.content?.text && template.content.text.toLowerCase().includes(lowerKeyword)) {
        return true;
      }
      return false;
    });
    
    // Filter groups locally
    const filteredGroups = state.groups.filter(group => {
      // Match by group name
      if (group.name && group.name.toLowerCase().includes(lowerKeyword)) {
        return true;
      }
      // Include groups that have matching templates
      const hasMatchingTemplate = filteredTemplates.some(t => t.groupId === group.id);
      return hasMatchingTemplate;
    });
    
    dispatch({ type: 'SET_FILTERED_TEMPLATES', payload: filteredTemplates });
    dispatch({ type: 'SET_FILTERED_GROUPS', payload: filteredGroups });
  }, [sendAction, state.templates, state.groups]);

  // Listen for data updates from main process
  useEffect(() => {
    if (typeof window !== 'undefined' && window.require) {
      try {
        const { ipcRenderer } = window.require('electron');
        
        const handleData = (event, data) => {
          if (data.groups) {
            dispatch({ type: 'SET_GROUPS', payload: data.groups });
          }
          if (data.templates) {
            dispatch({ type: 'SET_TEMPLATES', payload: data.templates });
          }
          if (data.filteredTemplates) {
            dispatch({ type: 'SET_FILTERED_TEMPLATES', payload: data.filteredTemplates });
          }
        };

        ipcRenderer.on('management-window-data', handleData);

        // Request initial data
        ipcRenderer.send('management-window-ready', { accountId });

        return () => {
          ipcRenderer.removeListener('management-window-data', handleData);
        };
      } catch (error) {
        console.error('Failed to set up IPC listener:', error);
      }
    }
  }, [accountId]);

  // Toolbar action handlers
  const handleAddText = () => sendAction('addText');
  const handleAddImage = () => sendAction('addImage');
  const handleAddAudio = () => sendAction('addAudio');
  const handleAddVideo = () => sendAction('addVideo');
  const handleAddImageText = () => sendAction('addImageText');
  const handleImport = () => sendAction('import');
  const handleExport = () => sendAction('export');

  const contextValue = {
    state,
    dispatch,
    sendAction,
    performSearch
  };

  return (
    <ManagementWindowContext.Provider value={contextValue}>
      <div className="management-window-app">
        <Toolbar
          onAddText={handleAddText}
          onAddImage={handleAddImage}
          onAddAudio={handleAddAudio}
          onAddVideo={handleAddVideo}
          onAddImageText={handleAddImageText}
          selectedGroupId={state.selectedGroupId}
        />
        
        {/* Batch Operations Bar - Requirements 8.1, 8.2 */}
        <BatchOperationsBar />
        
        <div className="mw-main-content">
          <GroupPanel />
          <ContentArea />
        </div>
        
        <ImportExportBar
          onImport={handleImport}
          onExport={handleExport}
        />
      </div>
    </ManagementWindowContext.Provider>
  );
}

// Export context hook
export { useManagementWindow };
