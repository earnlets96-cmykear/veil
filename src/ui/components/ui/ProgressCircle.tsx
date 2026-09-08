/**
 * Circular Progress Indicator for VEIL.
 * Used for file upload/download progress visualization.
 */

import React from 'react';
import { CloseIcon } from '../icons/index.ts';

export interface ProgressCircleProps {
  /** Progress percentage 0-100. Use -1 for indeterminate (spinning). */
  percent?: number;
  /** Circle diameter in pixels */
  size?: number;
  /** Stroke color */
  color?: string;
  /** Track (background) color */
  trackColor?: string;
  /** Stroke width */
  strokeWidth?: number;
  /** Show cancel X in center */
  showCancel?: boolean;
  /** Cancel click handler */
  onCancel?: () => void;
}

export const ProgressCircle: React.FC<ProgressCircleProps> = ({
  percent = -1,
  size = 36,
  color = 'var(--veil-accent-primary, #14b8a6)',
  trackColor = 'rgba(255, 255, 255, 0.15)',
  strokeWidth = 3,
  showCancel = false,
  onCancel,
}) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const isIndeterminate = percent < 0;
  const clampedPercent = Math.max(0, Math.min(100, percent));
  const dashOffset = isIndeterminate
    ? circumference * 0.75
    : circumference - (clampedPercent / 100) * circumference;

  return (
    <div
      className="veil-progress-circle"
      style={{
        width: size,
        height: size,
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
      role="progressbar"
      aria-valuenow={isIndeterminate ? undefined : clampedPercent}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={isIndeterminate ? 'Loading...' : `${clampedPercent}% complete`}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        style={{
          transform: 'rotate(-90deg)',
          animation: isIndeterminate ? 'veil-progress-spin 1.2s linear infinite' : undefined,
        }}
      >
        {/* Background track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={trackColor}
          strokeWidth={strokeWidth}
        />
        {/* Progress arc */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          style={{
            transition: isIndeterminate ? 'none' : 'stroke-dashoffset 0.3s ease',
          }}
        />
      </svg>

      {/* Cancel button overlay */}
      {showCancel && onCancel && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onCancel();
          }}
          aria-label="Cancel transfer"
          style={{
            position: 'absolute',
            inset: 0,
            background: 'none',
            border: 'none',
            color: 'rgba(255, 255, 255, 0.8)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: `${size * 0.35}px`,
            fontWeight: 700,
            lineHeight: 1,
          }}
        >
          <CloseIcon size={Math.round(size * 0.4)} color="rgba(255, 255, 255, 0.8)" />
        </button>
      )}

      <style>{`
        @keyframes veil-progress-spin {
          from { transform: rotate(-90deg); }
          to { transform: rotate(270deg); }
        }
      `}</style>
    </div>
  );
};
