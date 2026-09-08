/**
 * Radial Progress Circle Component for VEIL.
 *
 * SVG-based circular progress indicator with animated stroke
 * for displaying upload/download progress with optional size labels.
 */

import React from 'react';

export interface ProgressCircleProps {
  percent: number;
  size?: number;
  strokeWidth?: number;
  totalBytes?: number;
  loadedBytes?: number;
  variant?: 'upload' | 'download';
  className?: string;
}

const formatBytes = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export const ProgressCircle: React.FC<ProgressCircleProps> = ({
  percent,
  size = 48,
  strokeWidth = 3,
  totalBytes,
  loadedBytes,
  variant = 'download',
  className = '',
}) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clampedPercent = Math.max(0, Math.min(100, percent));
  const dashOffset = circumference - (clampedPercent / 100) * circumference;
  const center = size / 2;

  const accentColor = variant === 'upload'
    ? 'var(--veil-accent-primary, #14b8a6)'
    : 'var(--veil-accent-primary, #14b8a6)';

  const showSizeLabel = totalBytes !== undefined && totalBytes > 0;

  return (
    <div
      className={`veil-progress-circle ${className}`.trim()}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
      role="progressbar"
      aria-valuenow={Math.round(clampedPercent)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`${variant === 'upload' ? 'Uploading' : 'Downloading'} ${Math.round(clampedPercent)}%`}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        style={{ position: 'absolute', top: 0, left: 0, transform: 'rotate(-90deg)' }}
      >
        {/* Background track */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="rgba(255, 255, 255, 0.12)"
          strokeWidth={strokeWidth}
        />
        {/* Progress arc */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={accentColor}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          style={{
            transition: 'stroke-dashoffset 0.3s ease-out',
          }}
        />
      </svg>

      {/* Center text */}
      <div
        style={{
          position: 'relative',
          zIndex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0px',
        }}
      >
        <span
          style={{
            fontSize: `${Math.max(9, size * 0.22)}px`,
            fontWeight: 700,
            color: '#ffffff',
            fontVariantNumeric: 'tabular-nums',
            lineHeight: 1.1,
          }}
        >
          {Math.round(clampedPercent)}%
        </span>
        {showSizeLabel && (
          <span
            style={{
              fontSize: `${Math.max(7, size * 0.14)}px`,
              color: 'rgba(255, 255, 255, 0.55)',
              lineHeight: 1,
              whiteSpace: 'nowrap',
            }}
          >
            {loadedBytes !== undefined ? formatBytes(loadedBytes) : ''}/{formatBytes(totalBytes!)}
          </span>
        )}
      </div>
    </div>
  );
};
