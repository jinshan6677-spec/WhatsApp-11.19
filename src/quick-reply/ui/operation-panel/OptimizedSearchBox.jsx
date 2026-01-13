/**
 * OptimizedSearchBox Component
 * 
 * Enhanced search box with:
 * - Debounced input
 * - Cached search results
 * - Performance optimizations
 * 
 * Requirements: 6.1-6.6, Performance optimization
 */

import React, { useState, useCallback, useMemo } from 'react';
import { useOperationPanel } from './OperationPanel';
import { searchTemplates } from '../../utils/search';
import { useDebounce, useCachedSearch } from '../../hooks/usePerformance';
import './SearchBox.css';

export default function OptimizedSearchBox() {
  const { state, dispatch } = useOperationPanel();
  const [inputValue, setInputValue] = useState('');

  // Debounce the input value
  const debouncedKeyword = useDebounce(inputValue, 300);

  // Memoize search function
  const searchFn = useCallback((keyword, templates) => {
    return searchTemplates(keyword, templates, state.groups);
  }, [state.groups]);

  // Use cached search results
  const filteredTemplates = useCachedSearch(
    searchFn,
    debouncedKeyword,
    state.templates,
    [state.groups]
  );

  // Update filtered templates when search results change
  React.useEffect(() => {
    dispatch({ type: 'SET_SEARCH_KEYWORD', payload: debouncedKeyword });
    dispatch({ type: 'SET_FILTERED_TEMPLATES', payload: filteredTemplates });
  }, [debouncedKeyword, filteredTemplates, dispatch]);

  // Handle input change
  const handleInputChange = useCallback((e) => {
    setInputValue(e.target.value);
  }, []);

  // Handle clear button click
  const handleClear = useCallback(() => {
    setInputValue('');
    dispatch({ type: 'SET_SEARCH_KEYWORD', payload: '' });
    dispatch({ type: 'SET_FILTERED_TEMPLATES', payload: state.templates });
  }, [dispatch, state.templates]);

  // Show no results message
  const showNoResults = debouncedKeyword && filteredTemplates.length === 0;

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

      {showNoResults && (
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
