/**
 * Accessible Loading Spinner Component for VEIL.
 */

import React from 'react';

export type SpinnerSize = 'sm' | 'md' | 'lg';

export interface SpinnerProps {
  size?: SpinnerSize;
  className?: string;
  'aria-label'?: string;
}

export const Spinner: React.FC<SpinnerProps> = ({
  size = 'md',
  className = '',
  'aria-label': ariaLabel = 'Loading...',
}) => {
  return (
    <span
      className={`veil-spinner veil-spinner-${size} ${className}`.trim()}
      role="status"
      aria-label={ariaLabel}
      aria-busy="true"
    />
  );
};
