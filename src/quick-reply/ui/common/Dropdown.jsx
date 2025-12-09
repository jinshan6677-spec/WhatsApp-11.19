import React, { useState, useRef, useEffect } from 'react';
import PropTypes from 'prop-types';

/**
 * Dropdown Component
 * 
 * A reusable dropdown menu component with customizable trigger and menu items.
 * 
 * @param {Object} props - Component props
 * @param {React.ReactNode} props.trigger - Trigger element
 * @param {Array} props.items - Menu items array
 * @param {Function} props.onSelect - Select handler
 * @param {string} props.placement - Dropdown placement: 'bottom-left', 'bottom-right', 'top-left', 'top-right'
 * @param {boolean} props.disabled - Whether the dropdown is disabled
 * @param {string} props.className - Additional CSS classes
 */
const Dropdown = ({
  trigger,
  items = [],
  onSelect,
  placement = 'bottom-left',
  disabled = false,
  className = '',
}) => {
  const [visible, setVisible] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setVisible(false);
      }
    };

    if (visible) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [visible]);

  const handleTriggerClick = () => {
    if (!disabled) {
      setVisible(!visible);
    }
  };

  const handleItemClick = (item) => {
    if (!item.disabled) {
      if (onSelect) {
        onSelect(item);
      }
      setVisible(false);
    }
  };

  const containerStyles = {
    position: 'relative',
    display: 'inline-block',
  };

  const triggerStyles = {
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.6 : 1,
  };

  const getMenuPosition = () => {
    const positions = {
      'bottom-left': {
        top: '100%',
        left: 0,
        marginTop: '4px',
      },
      'bottom-right': {
        top: '100%',
        right: 0,
        marginTop: '4px',
      },
      'top-left': {
        bottom: '100%',
        left: 0,
        marginBottom: '4px',
      },
      'top-right': {
        bottom: '100%',
        right: 0,
        marginBottom: '4px',
      },
    };
    return positions[placement] || positions['bottom-left'];
  };

  const menuStyles = {
    position: 'absolute',
    ...getMenuPosition(),
    backgroundColor: '#ffffff',
    border: '1px solid #e9ecef',
    borderRadius: '4px',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
    minWidth: '160px',
    maxHeight: '300px',
    overflowY: 'auto',
    zIndex: 1001,
    animation: 'dropdownFadeIn 0.2s ease',
  };

  const itemStyles = (item) => ({
    padding: '8px 16px',
    fontSize: '14px',
    color: item.disabled ? '#adb5bd' : item.danger ? '#dc3545' : '#333',
    cursor: item.disabled ? 'not-allowed' : 'pointer',
    transition: 'background-color 0.2s ease',
    borderBottom: item.divider ? '1px solid #e9ecef' : 'none',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  });

  const dividerStyles = {
    height: '1px',
    backgroundColor: '#e9ecef',
    margin: '4px 0',
  };

  return (
    <>
      <style>
        {`
          @keyframes dropdownFadeIn {
            from {
              opacity: 0;
              transform: translateY(-4px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
          
          .qr-dropdown-item:hover:not(.qr-dropdown-item--disabled) {
            background-color: #f8f9fa;
          }
        `}
      </style>
      
      <div
        ref={dropdownRef}
        style={containerStyles}
        className={`qr-dropdown ${className}`}
      >
        <div
          style={triggerStyles}
          onClick={handleTriggerClick}
          className="qr-dropdown-trigger"
        >
          {trigger}
        </div>
        
        {visible && (
          <div style={menuStyles} className="qr-dropdown-menu">
            {items.map((item, index) => {
              if (item.type === 'divider') {
                return (
                  <div
                    key={`divider-${index}`}
                    style={dividerStyles}
                    className="qr-dropdown-divider"
                  />
                );
              }
              
              return (
                <div
                  key={item.key || index}
                  style={itemStyles(item)}
                  onClick={() => handleItemClick(item)}
                  className={`qr-dropdown-item ${item.disabled ? 'qr-dropdown-item--disabled' : ''}`}
                >
                  {item.icon && <span className="qr-dropdown-item-icon">{item.icon}</span>}
                  <span className="qr-dropdown-item-label">{item.label}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
};

Dropdown.propTypes = {
  trigger: PropTypes.node.isRequired,
  items: PropTypes.arrayOf(
    PropTypes.shape({
      key: PropTypes.string,
      label: PropTypes.string,
      icon: PropTypes.node,
      disabled: PropTypes.bool,
      danger: PropTypes.bool,
      divider: PropTypes.bool,
      type: PropTypes.oneOf(['divider']),
    })
  ),
  onSelect: PropTypes.func,
  placement: PropTypes.oneOf(['bottom-left', 'bottom-right', 'top-left', 'top-right']),
  disabled: PropTypes.bool,
  className: PropTypes.string,
};

export default Dropdown;
