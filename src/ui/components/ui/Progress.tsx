/**
 * Accessible Progress Bar Component for VEIL.
 */

import React from 'react';

export interface ProgressProps {
  value?: number; // 0 - 100
  max?: number;
  indeterminate?: boolean;
  className?: string;
  'aria-label'?: string;
}

export const Progress: React.FC<ProgressProps> = ({
  value = 0,
  max = 100,
  indeterminate = false,
  className = '',
  'aria-label': ariaLabel = 'Progress',
}) => {
  const percentage = Math.min(100, Math.max(0, (value / max) * 100));

  return (
    <div
      className={`veil-voice-progress-bar ${className}`.trim()}
      role="progressbar"
      aria-valuenow={indeterminate ? undefined : Math.round(percentage)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={ariaLabel}
    >
      <div
        className="veil-voice-progress-fill"
        style={{
          width: indeterminate ? '100%' : `${percentage}%`,
        }}
      />
    </div>
  );
};
