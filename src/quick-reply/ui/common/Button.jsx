import React, { useState, useCallback } from 'react';
import PropTypes from 'prop-types';

/**
 * Button Component
 * 
 * A reusable button component with different variants, states, and click effects.
 * Requirements: 17.1 - Button click effects
 * 
 * @param {Object} props - Component props
 * @param {React.ReactNode} props.children - Button content
 * @param {string} props.variant - Button variant: 'primary', 'secondary', 'danger', 'ghost'
 * @param {string} props.size - Button size: 'small', 'medium', 'large'
 * @param {boolean} props.disabled - Whether the button is disabled
 * @param {boolean} props.loading - Whether the button is in loading state
 * @param {Function} props.onClick - Click handler
 * @param {string} props.className - Additional CSS classes
 * @param {string} props.type - Button type: 'button', 'submit', 'reset'
 * @param {Object} props.style - Inline styles
 * @param {boolean} props.ripple - Whether to show ripple effect on click
 */
const Button = ({
  children,
  variant = 'primary',
  size = 'medium',
  disabled = false,
  loading = false,
  onClick,
  className = '',
  type = 'button',
  style = {},
  ripple = true,
  ...rest
}) => {
  const [isPressed, setIsPressed] = useState(false);
  const [rippleStyle, setRippleStyle] = useState(null);

  const baseStyles = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: 'none',
    borderRadius: '4px',
    cursor: disabled || loading ? 'not-allowed' : 'pointer',
    fontFamily: 'inherit',
    fontWeight: 500,
    transition: 'all 0.15s ease',
    opacity: disabled || loading ? 0.6 : 1,
    outline: 'none',
    position: 'relative',
    overflow: 'hidden',
    transform: isPressed && !disabled && !loading ? 'scale(0.97)' : 'scale(1)',
    ...style,
  };

  // Variant styles
  const variantStyles = {
    primary: {
      backgroundColor: '#007bff',
      color: '#ffffff',
    },
    secondary: {
      backgroundColor: '#6c757d',
      color: '#ffffff',
    },
    danger: {
      backgroundColor: '#dc3545',
      color: '#ffffff',
    },
    ghost: {
      backgroundColor: 'transparent',
      color: '#007bff',
      border: '1px solid #007bff',
    },
  };

  // Size styles
  const sizeStyles = {
    small: {
      padding: '4px 12px',
      fontSize: '12px',
      minHeight: '28px',
    },
    medium: {
      padding: '8px 16px',
      fontSize: '14px',
      minHeight: '36px',
    },
    large: {
      padding: '12px 24px',
      fontSize: '16px',
      minHeight: '44px',
    },
  };

  const combinedStyles = {
    ...baseStyles,
    ...variantStyles[variant],
    ...sizeStyles[size],
  };

  // Handle ripple effect
  const createRipple = useCallback((e) => {
    if (!ripple || disabled || loading) return;
    
    const button = e.currentTarget;
    const rect = button.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    const x = e.clientX - rect.left - size / 2;
    const y = e.clientY - rect.top - size / 2;
    
    setRippleStyle({
      width: size,
      height: size,
      left: x,
      top: y,
    });
    
    // Clear ripple after animation
    setTimeout(() => setRippleStyle(null), 600);
  }, [ripple, disabled, loading]);

  const handleMouseDown = useCallback(() => {
    if (!disabled && !loading) {
      setIsPressed(true);
    }
  }, [disabled, loading]);

  const handleMouseUp = useCallback(() => {
    setIsPressed(false);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setIsPressed(false);
  }, []);

  const handleClick = (e) => {
    if (disabled || loading) {
      e.preventDefault();
      return;
    }
    createRipple(e);
    if (onClick) {
      onClick(e);
    }
  };

  const rippleElementStyle = rippleStyle ? {
    position: 'absolute',
    borderRadius: '50%',
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
    pointerEvents: 'none',
    animation: 'qr-ripple 0.6s ease-out',
    ...rippleStyle,
  } : null;

  return (
    <>
      <style>
        {`
          @keyframes qr-ripple {
            from {
              transform: scale(0);
              opacity: 1;
            }
            to {
              transform: scale(2);
              opacity: 0;
            }
          }
          
          .qr-button:hover:not(:disabled) {
            filter: brightness(1.1);
          }
          
          .qr-button:focus-visible {
            box-shadow: 0 0 0 3px rgba(0, 123, 255, 0.3);
          }
        `}
      </style>
      <button
        type={type}
        style={combinedStyles}
        onClick={handleClick}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        disabled={disabled || loading}
        className={`qr-button qr-button--${variant} qr-button--${size} ${className}`}
        {...rest}
      >
        {rippleStyle && <span style={rippleElementStyle} />}
        {loading && (
          <span style={{ marginRight: '8px' }}>
            <LoadingSpinner />
          </span>
        )}
        {children}
      </button>
    </>
  );
};

/**
 * Loading Spinner Component
 */
const LoadingSpinner = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 16 16"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    style={{ animation: 'spin 1s linear infinite' }}
  >
    <circle
      cx="8"
      cy="8"
      r="6"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeDasharray="30 10"
    />
    <style>
      {`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}
    </style>
  </svg>
);

Button.propTypes = {
  children: PropTypes.node.isRequired,
  variant: PropTypes.oneOf(['primary', 'secondary', 'danger', 'ghost']),
  size: PropTypes.oneOf(['small', 'medium', 'large']),
  disabled: PropTypes.bool,
  loading: PropTypes.bool,
  onClick: PropTypes.func,
  className: PropTypes.string,
  type: PropTypes.oneOf(['button', 'submit', 'reset']),
  style: PropTypes.object,
  ripple: PropTypes.bool,
};

export default Button;
