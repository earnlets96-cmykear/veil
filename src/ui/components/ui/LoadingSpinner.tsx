/**
 * Reusable Minimal Loading Spinner Component for VEIL.
 *
 * Implements an accessible, GPU-accelerated CSS spinner
 * with configurable sizes and accent-aware theming.
 */

import React from 'react';
import { Spinner, SpinnerSize } from './Spinner.tsx';

export interface LoadingSpinnerProps {
  size?: SpinnerSize;
  color?: string;
  className?: string;
  label?: string;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'md',
  color,
  className = '',
  label = 'Loading...',
}) => {
  return (
    <Spinner
      size={size}
      color={color}
      className={className}
      aria-label={label}
    />
  );
};
