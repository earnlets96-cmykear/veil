/**
 * Accessible Divider / Separator Component for VEIL.
 */

import React from 'react';

export interface DividerProps {
  orientation?: 'horizontal' | 'vertical';
  label?: string;
  className?: string;
}

export const Divider: React.FC<DividerProps> = ({
  orientation = 'horizontal',
  label,
  className = '',
}) => {
  if (label && orientation === 'horizontal') {
    return (
      <div
        className={`veil-divider-with-label ${className}`.trim()}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--veil-space-3)',
          margin: 'var(--veil-space-3) 0',
          color: 'var(--veil-text-muted)',
          fontSize: 'var(--veil-text-xs)',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}
        role="separator"
      >
        <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--veil-border)' }} />
        <span>{label}</span>
        <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--veil-border)' }} />
      </div>
    );
  }

  return (
    <div
      className={`${orientation === 'vertical' ? 'veil-divider-vertical' : 'veil-divider'} ${className}`.trim()}
      role="separator"
      aria-orientation={orientation}
    />
  );
};
