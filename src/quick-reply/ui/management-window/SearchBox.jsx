import React, { useState, useCallback, useRef, useEffect } from 'react';
import PropTypes from 'prop-types';
import { debounce } from '../../utils/search';
import './SearchBox.css';

/**
 * SearchBox Component for Management Window
 * 
 * Provides search functionality with:
 * - Real-time filtering
 * - Debounced input
 * - Clear button
 * - Search history (optional)
 * 
 * Requirements: 7.1, 7.2, 7.5
 */
function SearchBox({
  value = '',
  onChange,
  onClear,
  placeholder = '请输入关键词',
  debounceMs = 300,
  showClearButton = true,
  autoFocus = false,
  className = ''
}) {
  const [localValue, setLocalValue] = useState(value);
  const inputRef = useRef(null);

  // Sync local value with prop value
  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  // Create debounced onChange handler
  const debouncedOnChange = useCallback(
    debounce((newValue) => {
      if (onChange) {
        onChange(newValue);
      }
    }, debounceMs),
    [onChange, debounceMs]
  );

  // Handle input change
  const handleChange = (e) => {
    const newValue = e.target.value;
    setLocalValue(newValue);
    debouncedOnChange(newValue);
  };

  // Handle clear button click
  const handleClear = () => {
    setLocalValue('');
    if (onChange) {
      onChange('');
    }
    if (onClear) {
      onClear();
    }
    // Focus input after clearing
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  // Handle key down events
  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      handleClear();
    }
  };

  // Auto focus on mount if specified
  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus]);

  return (
    <div className={`mw-search-box-container ${className}`}>
      <div className="mw-search-box-wrapper">
        <span className="mw-search-icon">
          <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
            <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" />
          </svg>
        </span>
        <input
          ref={inputRef}
          type="text"
          className="mw-search-input-field"
          placeholder={placeholder}
          value={localValue}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          aria-label="搜索"
        />
        {showClearButton && localValue && (
          <button
            type="button"
            className="mw-search-clear-btn"
            onClick={handleClear}
            aria-label="清空搜索"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}

SearchBox.propTypes = {
  value: PropTypes.string,
  onChange: PropTypes.func,
  onClear: PropTypes.func,
  placeholder: PropTypes.string,
  debounceMs: PropTypes.number,
  showClearButton: PropTypes.bool,
  autoFocus: PropTypes.bool,
  className: PropTypes.string
};

export default SearchBox;
