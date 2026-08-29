/**
 * Accessible Loading Spinner Component for VEIL.
 *
 * Minimal, GPU-accelerated CSS loading indicator matching Signal/Telegram design aesthetics.
 */

import React from 'react';

export type SpinnerSize = 'xs' | 'sm' | 'md' | 'lg';

export interface SpinnerProps {
  size?: SpinnerSize;
  color?: string;
  className?: string;
  'aria-label'?: string;
}

export const Spinner: React.FC<SpinnerProps> = ({
  size = 'md',
  color,
  className = '',
  'aria-label': ariaLabel = 'Loading...',
}) => {
  const customStyle: React.CSSProperties = color
    ? { borderTopColor: color, borderColor: `${color}33` }
    : {};

  return (
    <span
      className={`veil-spinner veil-spinner-${size} ${className}`.trim()}
      style={customStyle}
      role="status"
      aria-label={ariaLabel}
      aria-busy="true"
    />
  );
};
