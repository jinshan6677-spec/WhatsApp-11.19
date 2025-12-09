import React, { createContext, useContext, useReducer, useEffect } from 'react';
import Header from './Header';
import PlatformSelector from './PlatformSelector';
import GroupPanel from './GroupPanel';
import ContentArea from './ContentArea';
import './ManagementInterface.css';

// Context for management interface state
const ManagementInterfaceContext = createContext();

// Initial state
const initialState = {
  isOpen: false,
  selectedGroupId: null,
  selectedTemplateIds: new Set(),
  selectedGroupIds: new Set(),
  activeTab: 'all', // 'all', 'text', 'image', 'video', 'audio', 'mixed', 'contact'
  templates: [],
  groups: [],
  filteredTemplates: [],
  searchKeyword: '',
  isLoading: false,
  error: null,
  editingTemplate: null,
  showTemplateEditor: false
};

// Reducer for state management
function managementInterfaceReducer(state, action) {
  switch (action.type) {
    case 'OPEN_INTERFACE':
      return { ...state, isOpen: true };
    
    case 'CLOSE_INTERFACE':
      return { ...state, isOpen: false };
    
    case 'SET_SELECTED_GROUP':
      return { ...state, selectedGroupId: action.payload };
    
    case 'TOGGLE_TEMPLATE_SELECTION':
      const newSelectedTemplates = new Set(state.selectedTemplateIds);
      if (newSelectedTemplates.has(action.payload)) {
        newSelectedTemplates.delete(action.payload);
      } else {
        newSelectedTemplates.add(action.payload);
      }
      return { ...state, selectedTemplateIds: newSelectedTemplates };
    
    case 'TOGGLE_GROUP_SELECTION':
      const newSelectedGroups = new Set(state.selectedGroupIds);
      if (newSelectedGroups.has(action.payload)) {
        newSelectedGroups.delete(action.payload);
      } else {
        newSelectedGroups.add(action.payload);
      }
      return { ...state, selectedGroupIds: newSelectedGroups };
    
    case 'CLEAR_TEMPLATE_SELECTION':
      return { ...state, selectedTemplateIds: new Set() };
    
    case 'CLEAR_GROUP_SELECTION':
      return { ...state, selectedGroupIds: new Set() };
    
    case 'SELECT_ALL_TEMPLATES':
      const allTemplateIds = new Set(
        state.filteredTemplates.map(t => t.id)
      );
      return { ...state, selectedTemplateIds: allTemplateIds };
    
    case 'SELECT_ALL_GROUPS':
      const allGroupIds = new Set(
        state.groups.map(g => g.id)
      );
      return { ...state, selectedGroupIds: allGroupIds };
    
    case 'SET_ACTIVE_TAB':
      return { ...state, activeTab: action.payload };
    
    case 'SET_TEMPLATES':
      return { ...state, templates: action.payload };
    
    case 'SET_GROUPS':
      return { ...state, groups: action.payload };
    
    case 'SET_FILTERED_TEMPLATES':
      return { ...state, filteredTemplates: action.payload };
    
    case 'SET_SEARCH_KEYWORD':
      return { ...state, searchKeyword: action.payload };
    
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    
    case 'SET_ERROR':
      return { ...state, error: action.payload };
    
    case 'SHOW_TEMPLATE_EDITOR':
      return { 
        ...state, 
        showTemplateEditor: true,
        editingTemplate: action.payload 
      };
    
    case 'HIDE_TEMPLATE_EDITOR':
      return { 
        ...state, 
        showTemplateEditor: false,
        editingTemplate: null 
      };
    
    case 'RESET_STATE':
      return { ...initialState };
    
    default:
      return state;
  }
}

// Custom hook to use management interface context
export function useManagementInterface() {
  const context = useContext(ManagementInterfaceContext);
  if (!context) {
    throw new Error('useManagementInterface must be used within ManagementInterfaceProvider');
  }
  return context;
}

// Provider component
export function ManagementInterfaceProvider({ children, controller }) {
  const [state, dispatch] = useReducer(managementInterfaceReducer, initialState);

  // Load initial data when interface opens
  useEffect(() => {
    if (state.isOpen && controller) {
      loadData();
    }
  }, [state.isOpen, controller]);

  // Filter templates when search keyword or active tab changes
  useEffect(() => {
    filterTemplates();
  }, [state.searchKeyword, state.activeTab, state.templates, state.selectedGroupId]);

  // Load templates and groups
  const loadData = async () => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      
      const templates = await controller.templateManager.getAllTemplates();
      const groups = await controller.groupManager.getAllGroups();
      
      dispatch({ type: 'SET_TEMPLATES', payload: templates });
      dispatch({ type: 'SET_GROUPS', payload: groups });
      dispatch({ type: 'SET_ERROR', payload: null });
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: error.message });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  };

  // Filter templates based on search keyword, active tab, and selected group
  const filterTemplates = () => {
    let filtered = state.templates;

    // Filter by selected group
    if (state.selectedGroupId) {
      filtered = filtered.filter(t => t.groupId === state.selectedGroupId);
    }

    // Filter by active tab
    if (state.activeTab !== 'all') {
      filtered = filtered.filter(t => t.type === state.activeTab);
    }

    // Filter by search keyword
    if (state.searchKeyword) {
      const keyword = state.searchKeyword.toLowerCase();
      filtered = filtered.filter(t => 
        t.label.toLowerCase().includes(keyword) ||
        (t.content.text && t.content.text.toLowerCase().includes(keyword))
      );
    }

    dispatch({ type: 'SET_FILTERED_TEMPLATES', payload: filtered });
  };

  const value = {
    state,
    dispatch,
    controller,
    loadData,
    filterTemplates
  };

  return (
    <ManagementInterfaceContext.Provider value={value}>
      {children}
    </ManagementInterfaceContext.Provider>
  );
}

// Main ManagementInterface component
export default function ManagementInterface({ controller, onClose }) {
  const { state, dispatch } = useManagementInterface();

  // Handle interface close
  const handleClose = () => {
    dispatch({ type: 'CLOSE_INTERFACE' });
    if (onClose) {
      onClose();
    }
  };

  // Don't render if not open
  if (!state.isOpen) {
    return null;
  }

  return (
    <div className="management-interface">
      <div className="management-interface-container">
        <Header onClose={handleClose} />
        
        <div className="management-interface-body">
          <div className="management-interface-sidebar">
            <PlatformSelector />
            <GroupPanel />
          </div>
          
          <div className="management-interface-main">
            <ContentArea />
          </div>
        </div>
      </div>
    </div>
  );
}

// Export both the component and provider
export { ManagementInterface, ManagementInterfaceProvider };
