import React from 'react';
import PropTypes from 'prop-types';

/**
 * LoadingSpinner Component
 * 
 * A reusable loading spinner with different sizes and colors.
 * Requirements: 17.1, 17.5
 * 
 * @param {Object} props - Component props
 * @param {string} props.size - Spinner size: 'small', 'medium', 'large'
 * @param {string} props.color - Spinner color (CSS color value)
 * @param {string} props.className - Additional CSS classes
 */
const LoadingSpinner = ({
  size = 'medium',
  color = '#1890ff',
  className = ''
}) => {
  const sizeMap = {
    small: 16,
    medium: 24,
    large: 32
  };

  const spinnerSize = sizeMap[size] || sizeMap.medium;

  const spinnerStyles = {
    display: 'inline-block',
    width: spinnerSize,
    height: spinnerSize,
    animation: 'qr-spin 1s linear infinite'
  };

  return (
    <>
      <style>
        {`
          @keyframes qr-spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}
      </style>
      <svg
        style={spinnerStyles}
        className={`qr-loading-spinner ${className}`}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <circle
          cx="12"
          cy="12"
          r="10"
          stroke={color}
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray="50 30"
          opacity="0.9"
        />
      </svg>
    </>
  );
};

LoadingSpinner.propTypes = {
  size: PropTypes.oneOf(['small', 'medium', 'large']),
  color: PropTypes.string,
  className: PropTypes.string
};

export default LoadingSpinner;
