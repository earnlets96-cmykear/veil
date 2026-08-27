/**
 * Accessible Empty State Component for VEIL.
 * Uses SVG vector iconography.
 */

import React, { ReactNode } from 'react';
import { ShieldIcon } from '../icons/index.ts';

export interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  action,
  className = '',
}) => {
  const defaultIcon = <ShieldIcon size={48} color="var(--veil-accent-primary)" />;

  return (
    <div className={`veil-empty-state ${className}`.trim()} role="region" aria-label={title}>
      <div className="veil-empty-icon" aria-hidden="true">
        {icon || defaultIcon}
      </div>
      <h3 style={{ fontSize: 'var(--veil-text-lg)', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--veil-text-primary)' }}>
        {title}
      </h3>
      {description && (
        <p style={{ fontSize: 'var(--veil-text-sm)', color: 'var(--veil-text-secondary)', maxWidth: '360px', marginBottom: action ? '1rem' : 0 }}>
          {description}
        </p>
      )}
      {action && (
        <div style={{ marginTop: '0.75rem' }}>
          {action}
        </div>
      )}
    </div>
  );
};
