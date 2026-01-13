import React, { useState, useEffect, useCallback } from 'react';
import { useOperationPanel } from './OperationPanel';
import { searchTemplates } from '../../utils/search';
import './SearchBox.css';

/**
 * SearchBox component with debouncing
 * Allows users to search templates by keyword
 * Requirements: 6.1-6.6
 */
export default function SearchBox() {
  const { state, dispatch } = useOperationPanel();
  const [inputValue, setInputValue] = useState('');

  // Debounce search
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      dispatch({ type: 'SET_SEARCH_KEYWORD', payload: inputValue });
      performSearch(inputValue);
    }, 300); // 300ms debounce

    return () => clearTimeout(timeoutId);
  }, [inputValue, state.templates, state.groups]);

  // Perform search
  const performSearch = useCallback((keyword) => {
    if (!keyword || keyword.trim() === '') {
      // Show all templates when search is empty
      dispatch({ type: 'SET_FILTERED_TEMPLATES', payload: state.templates });
    } else {
      // Search templates
      const results = searchTemplates(keyword, state.templates, state.groups);
      dispatch({ type: 'SET_FILTERED_TEMPLATES', payload: results });
    }
  }, [state.templates, state.groups, dispatch]);

  // Handle input change
  const handleInputChange = (e) => {
    setInputValue(e.target.value);
  };

  // Handle clear button click
  const handleClear = () => {
    setInputValue('');
    dispatch({ type: 'SET_SEARCH_KEYWORD', payload: '' });
    dispatch({ type: 'SET_FILTERED_TEMPLATES', payload: state.templates });
  };

  return (
    <div className="search-box">
      <div className="search-box-input-wrapper">
        <svg className="search-box-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        
        <input
          type="text"
          className="search-box-input"
          placeholder="请输入关键词"
          value={inputValue}
          onChange={handleInputChange}
          aria-label="搜索快捷回复"
        />

        {inputValue && (
          <button
            className="search-box-clear"
            onClick={handleClear}
            aria-label="清空搜索"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {state.searchKeyword && state.filteredTemplates.length === 0 && (
        <div className="search-box-no-results">
          <svg className="search-box-no-results-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="search-box-no-results-text">未找到匹配的快捷回复</p>
        </div>
      )}
    </div>
  );
}
