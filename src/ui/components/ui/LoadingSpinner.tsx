/**
 * Reusable Animated Loading Spinner Component for VEIL.
 *
 * Implements an accessible, GPU-accelerated SVG stroke spinner
 * with configurable sizes and accent-aware theming.
 */

import React from 'react';

export interface LoadingSpinnerProps {
  size?: 'xs' | 'sm' | 'md' | 'lg';
  color?: string;
  className?: string;
  label?: string;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'md',
  color = 'currentColor',
  className = '',
  label = 'Loading...',
}) => {
  const pixelSizes = {
    xs: 14,
    sm: 18,
    md: 24,
    lg: 36,
  };

  const dim = pixelSizes[size] || 24;
  const strokeWidth = size === 'xs' ? 3 : size === 'sm' ? 3 : 2.5;

  return (
    <div
      role="progressbar"
      aria-label={label}
      className={`veil-loading-spinner-container ${className}`.trim()}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: `${dim}px`,
        height: `${dim}px`,
      }}
    >
      <svg
        width={dim}
        height={dim}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{
          animation: 'veil-spin 0.8s linear infinite',
        }}
      >
        <circle
          cx="12"
          cy="12"
          r="10"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeOpacity="0.2"
        />
        <path
          d="M12 2C6.47715 2 2 6.47715 2 12C2 13.5997 2.37562 15.1116 3.04348 16.4525"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
};
