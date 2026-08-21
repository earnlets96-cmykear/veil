/**
 * Reusable Badge & Status Indicator Components for VEIL.
 */

import React, { HTMLAttributes, ReactNode } from 'react';

export type BadgeVariant = 'secure' | 'success' | 'info' | 'warning' | 'danger' | 'neutral';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  children: ReactNode;
}

export const Badge: React.FC<BadgeProps> = ({
  variant = 'neutral',
  className = '',
  children,
  ...rest
}) => {
  const variantClass = variant !== 'neutral' ? `veil-badge-${variant}` : '';

  return (
    <span
      className={`veil-badge ${variantClass} ${className}`.trim()}
      {...rest}
    >
      {children}
    </span>
  );
};

export type NetworkStatusType = 'online' | 'offline' | 'connecting' | 'secure' | 'warning' | 'error';

export interface StatusIndicatorProps {
  status: NetworkStatusType;
  label?: string;
  className?: string;
}

export const StatusIndicator: React.FC<StatusIndicatorProps> = ({
  status,
  label,
  className = '',
}) => {
  const getStatusColor = () => {
    switch (status) {
      case 'online':
      case 'secure':
        return 'var(--veil-success)';
      case 'connecting':
      case 'warning':
        return 'var(--veil-warning)';
      case 'error':
        return 'var(--veil-danger)';
      case 'offline':
      default:
        return 'var(--veil-text-muted)';
    }
  };

  const defaultLabel = () => {
    switch (status) {
      case 'online':
      case 'secure':
        return 'Encrypted & Online';
      case 'connecting':
        return 'Connecting...';
      case 'warning':
        return 'Degraded Network';
      case 'error':
        return 'Network Error';
      case 'offline':
      default:
        return 'Offline / Queued';
    }
  };

  const displayText = label !== undefined ? label : defaultLabel();

  return (
    <div
      className={`veil-status-indicator ${className}`.trim()}
      style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
    >
      <span
        style={{
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          backgroundColor: getStatusColor(),
          boxShadow: `0 0 6px ${getStatusColor()}`,
          flexShrink: 0,
        }}
        aria-hidden="true"
      />
      {displayText && (
        <span style={{ fontSize: 'var(--veil-text-xs)', color: 'var(--veil-text-muted)' }}>
          {displayText}
        </span>
      )}
    </div>
  );
};
