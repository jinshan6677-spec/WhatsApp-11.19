import React, { forwardRef } from 'react';
import PropTypes from 'prop-types';

/**
 * Input Component
 * 
 * A reusable input component with validation states and icons.
 * 
 * @param {Object} props - Component props
 * @param {string} props.type - Input type
 * @param {string} props.value - Input value
 * @param {Function} props.onChange - Change handler
 * @param {string} props.placeholder - Placeholder text
 * @param {boolean} props.disabled - Whether the input is disabled
 * @param {boolean} props.readOnly - Whether the input is read-only
 * @param {string} props.error - Error message
 * @param {string} props.label - Input label
 * @param {boolean} props.required - Whether the input is required
 * @param {number} props.maxLength - Maximum length
 * @param {string} props.className - Additional CSS classes
 * @param {React.ReactNode} props.prefix - Prefix icon or text
 * @param {React.ReactNode} props.suffix - Suffix icon or text
 * @param {Object} props.style - Inline styles
 */
const Input = forwardRef(({
  type = 'text',
  value,
  onChange,
  onBlur,
  onFocus,
  placeholder = '',
  disabled = false,
  readOnly = false,
  error = '',
  label = '',
  required = false,
  maxLength,
  className = '',
  prefix,
  suffix,
  style = {},
  ...rest
}, ref) => {
  const containerStyles = {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    width: '100%',
    ...style,
  };

  const labelStyles = {
    fontSize: '14px',
    fontWeight: 500,
    color: '#333',
    marginBottom: '4px',
  };

  const inputWrapperStyles = {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    border: `1px solid ${error ? '#dc3545' : '#ced4da'}`,
    borderRadius: '4px',
    backgroundColor: disabled ? '#e9ecef' : '#ffffff',
    transition: 'border-color 0.2s ease',
    overflow: 'hidden',
  };

  const inputStyles = {
    flex: 1,
    padding: '8px 12px',
    fontSize: '14px',
    border: 'none',
    outline: 'none',
    backgroundColor: 'transparent',
    color: disabled ? '#6c757d' : '#333',
    fontFamily: 'inherit',
  };

  const affixStyles = {
    display: 'flex',
    alignItems: 'center',
    padding: '0 8px',
    color: '#6c757d',
    fontSize: '14px',
  };

  const errorStyles = {
    fontSize: '12px',
    color: '#dc3545',
    marginTop: '4px',
  };

  const characterCountStyles = {
    fontSize: '12px',
    color: '#6c757d',
    textAlign: 'right',
    marginTop: '4px',
  };

  return (
    <div style={containerStyles} className={`qr-input-container ${className}`}>
      {label && (
        <label style={labelStyles}>
          {label}
          {required && <span style={{ color: '#dc3545', marginLeft: '4px' }}>*</span>}
        </label>
      )}
      
      <div style={inputWrapperStyles} className="qr-input-wrapper">
        {prefix && (
          <div style={affixStyles} className="qr-input-prefix">
            {prefix}
          </div>
        )}
        
        <input
          ref={ref}
          type={type}
          value={value}
          onChange={onChange}
          onBlur={onBlur}
          onFocus={onFocus}
          placeholder={placeholder}
          disabled={disabled}
          readOnly={readOnly}
          maxLength={maxLength}
          required={required}
          style={inputStyles}
          className="qr-input"
          {...rest}
        />
        
        {suffix && (
          <div style={affixStyles} className="qr-input-suffix">
            {suffix}
          </div>
        )}
      </div>
      
      {error && (
        <div style={errorStyles} className="qr-input-error">
          {error}
        </div>
      )}
      
      {maxLength && value && (
        <div style={characterCountStyles} className="qr-input-count">
          {value.length} / {maxLength}
        </div>
      )}
    </div>
  );
});

Input.displayName = 'Input';

Input.propTypes = {
  type: PropTypes.string,
  value: PropTypes.string,
  onChange: PropTypes.func,
  onBlur: PropTypes.func,
  onFocus: PropTypes.func,
  placeholder: PropTypes.string,
  disabled: PropTypes.bool,
  readOnly: PropTypes.bool,
  error: PropTypes.string,
  label: PropTypes.string,
  required: PropTypes.bool,
  maxLength: PropTypes.number,
  className: PropTypes.string,
  prefix: PropTypes.node,
  suffix: PropTypes.node,
  style: PropTypes.object,
};

export default Input;
