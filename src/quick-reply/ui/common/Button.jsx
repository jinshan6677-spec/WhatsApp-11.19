import React from 'react';
import PropTypes from 'prop-types';

/**
 * Button Component
 * 
 * A reusable button component with different variants and states.
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
  ...rest
}) => {
  const baseStyles = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: 'none',
    borderRadius: '4px',
    cursor: disabled || loading ? 'not-allowed' : 'pointer',
    fontFamily: 'inherit',
    fontWeight: 500,
    transition: 'all 0.2s ease',
    opacity: disabled || loading ? 0.6 : 1,
    outline: 'none',
    ...style,
  };

  // Variant styles
  const variantStyles = {
    primary: {
      backgroundColor: '#007bff',
      color: '#ffffff',
      ':hover': {
        backgroundColor: '#0056b3',
      },
    },
    secondary: {
      backgroundColor: '#6c757d',
      color: '#ffffff',
      ':hover': {
        backgroundColor: '#545b62',
      },
    },
    danger: {
      backgroundColor: '#dc3545',
      color: '#ffffff',
      ':hover': {
        backgroundColor: '#c82333',
      },
    },
    ghost: {
      backgroundColor: 'transparent',
      color: '#007bff',
      border: '1px solid #007bff',
      ':hover': {
        backgroundColor: '#f8f9fa',
      },
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

  const handleClick = (e) => {
    if (disabled || loading) {
      e.preventDefault();
      return;
    }
    if (onClick) {
      onClick(e);
    }
  };

  return (
    <button
      type={type}
      style={combinedStyles}
      onClick={handleClick}
      disabled={disabled || loading}
      className={`qr-button qr-button--${variant} qr-button--${size} ${className}`}
      {...rest}
    >
      {loading && (
        <span style={{ marginRight: '8px' }}>
          <LoadingSpinner />
        </span>
      )}
      {children}
    </button>
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
};

export default Button;
