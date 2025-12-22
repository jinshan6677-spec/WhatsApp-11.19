import React, { createContext, useContext, useReducer, useEffect } from 'react';
import Toolbar from './Toolbar';
import TabSwitcher from './TabSwitcher';
import SendModeSelector from './SendModeSelector';
import SearchBox from './SearchBox';
import GroupList from './GroupList';
import { TAB_TYPES } from '../../constants';
import { filterTemplatesByTab } from '../../utils/search';
import './OperationPanel.css';

// Context for operation panel state
const OperationPanelContext = createContext();

// Initial state
const initialState = {
  isOpen: false,
  sendMode: 'original', // 'original' or 'translated'
  activeTab: TAB_TYPES.ALL, // 'all' | 'public' | 'personal' - Requirement 1.1.1
  searchKeyword: '',
  expandedGroups: new Set(),
  templates: [],
  groups: [],
  filteredTemplates: [],
  selectedTemplateId: null,
  isLoading: false,
  error: null
};

// Reducer for state management
function operationPanelReducer(state, action) {
  switch (action.type) {
    case 'OPEN_PANEL':
      return { ...state, isOpen: true };
    
    case 'CLOSE_PANEL':
      return { ...state, isOpen: false };
    
    case 'SET_SEND_MODE':
      return { ...state, sendMode: action.payload };
    
    case 'SET_ACTIVE_TAB':
      // Requirement 1.1.6: Keep search and group structure when switching tabs
      return { ...state, activeTab: action.payload };
    
    case 'SET_SEARCH_KEYWORD':
      return { ...state, searchKeyword: action.payload };
    
    case 'SET_TEMPLATES':
      return { ...state, templates: action.payload };
    
    case 'SET_GROUPS':
      return { ...state, groups: action.payload };
    
    case 'SET_FILTERED_TEMPLATES':
      return { ...state, filteredTemplates: action.payload };
    
    case 'TOGGLE_GROUP':
      const newExpandedGroups = new Set(state.expandedGroups);
      if (newExpandedGroups.has(action.payload)) {
        newExpandedGroups.delete(action.payload);
      } else {
        newExpandedGroups.add(action.payload);
      }
      return { ...state, expandedGroups: newExpandedGroups };
    
    case 'SET_SELECTED_TEMPLATE':
      return { ...state, selectedTemplateId: action.payload };
    
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    
    case 'SET_ERROR':
      return { ...state, error: action.payload };
    
    case 'RESET_STATE':
      return { ...initialState };
    
    default:
      return state;
  }
}

// Custom hook to use operation panel context
export function useOperationPanel() {
  const context = useContext(OperationPanelContext);
  if (!context) {
    throw new Error('useOperationPanel must be used within OperationPanelProvider');
  }
  return context;
}

// Provider component
export function OperationPanelProvider({ children, controller }) {
  const [state, dispatch] = useReducer(operationPanelReducer, initialState);

  // Load initial data when panel opens
  useEffect(() => {
    if (state.isOpen && controller) {
      loadData();
    }
  }, [state.isOpen, controller]);

  // Update filtered templates when tab changes - Requirement 1.1.6
  useEffect(() => {
    if (state.templates.length > 0) {
      const filtered = filterTemplatesByTab(state.templates, state.activeTab);
      dispatch({ type: 'SET_FILTERED_TEMPLATES', payload: filtered });
    }
  }, [state.activeTab, state.templates]);

  // Load templates and groups
  const loadData = async () => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      
      const templates = await controller.templateManager.getAllTemplates();
      const groups = await controller.groupManager.getAllGroups();
      
      dispatch({ type: 'SET_TEMPLATES', payload: templates });
      dispatch({ type: 'SET_GROUPS', payload: groups });
      // Apply tab filter to initial templates
      const filtered = filterTemplatesByTab(templates, state.activeTab);
      dispatch({ type: 'SET_FILTERED_TEMPLATES', payload: filtered });
      dispatch({ type: 'SET_ERROR', payload: null });
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: error.message });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  };

  // Handle tab change - Requirement 1.1.1, 1.1.5, 1.1.6
  const handleTabChange = (tab) => {
    dispatch({ type: 'SET_ACTIVE_TAB', payload: tab });
  };

  const value = {
    state,
    dispatch,
    controller,
    loadData,
    handleTabChange
  };

  return (
    <OperationPanelContext.Provider value={value}>
      {children}
    </OperationPanelContext.Provider>
  );
}

// Main OperationPanel component
export default function OperationPanel({ controller, onClose }) {
  const { state, dispatch, handleTabChange } = useOperationPanel();

  // Handle panel close
  const handleClose = () => {
    dispatch({ type: 'CLOSE_PANEL' });
    if (onClose) {
      onClose();
    }
  };

  // Don't render if not open
  if (!state.isOpen) {
    return null;
  }

  return (
    <div className="operation-panel">
      <div className="operation-panel-header">
        <h2 className="operation-panel-title">快捷回复</h2>
        <button 
          className="operation-panel-close"
          onClick={handleClose}
          aria-label="关闭快捷回复面板"
        >
          ×
        </button>
      </div>

      <div className="operation-panel-content">
        {state.isLoading && (
          <div className="operation-panel-loading">加载中...</div>
        )}
        
        {state.error && (
          <div className="operation-panel-error">{state.error}</div>
        )}
        
        {!state.isLoading && !state.error && (
          <>
            {/* Tab Switcher - Requirement 1.1.1, 1.1.5, 1.1.6 */}
            <TabSwitcher
              activeTab={state.activeTab}
              onTabChange={handleTabChange}
            />

            <Toolbar
              onManagementClick={() => {
                // TODO: Open management interface
                console.log('Open management interface');
              }}
              onImport={() => {
                // TODO: Handle import
                console.log('Import templates');
              }}
              onExport={() => {
                // TODO: Handle export
                console.log('Export templates');
              }}
              onClearCache={() => {
                // TODO: Handle clear cache
                console.log('Clear cache');
              }}
            />

            <SendModeSelector />

            <SearchBox />

            <GroupList />
          </>
        )}
      </div>
    </div>
  );
}

// Export both the component and provider
export { OperationPanel, OperationPanelProvider };
