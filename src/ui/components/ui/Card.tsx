/**
 * Reusable Surface & Card Components for VEIL.
 */

import React, { HTMLAttributes, ReactNode, forwardRef } from 'react';

export type CardVariant = 'default' | 'elevated' | 'danger' | 'success' | 'warning';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
  interactive?: boolean;
  children?: ReactNode;
}

export const Card = forwardRef<HTMLDivElement, CardProps>(({
  variant = 'default',
  interactive = false,
  className = '',
  children,
  onClick,
  onKeyDown,
  tabIndex,
  role,
  ...rest
}, ref) => {
  const variantClass = variant !== 'default' ? `veil-card-${variant}` : '';
  const interactiveClass = interactive ? 'veil-card-interactive' : '';

  const isClickable = interactive || Boolean(onClick);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (isClickable && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      onClick?.(e as any);
    }
    onKeyDown?.(e);
  };

  return (
    <div
      ref={ref}
      className={`veil-card ${variantClass} ${interactiveClass} ${className}`.trim()}
      role={role || (isClickable ? 'button' : undefined)}
      tabIndex={isClickable ? (tabIndex ?? 0) : tabIndex}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      {...rest}
    >
      {children}
    </div>
  );
});

Card.displayName = 'Card';

export interface GlassCardProps extends HTMLAttributes<HTMLDivElement> {
  children?: ReactNode;
}

export const GlassCard = forwardRef<HTMLDivElement, GlassCardProps>(({
  className = '',
  children,
  ...rest
}, ref) => {
  return (
    <div
      ref={ref}
      className={`veil-card-glass ${className}`.trim()}
      {...rest}
    >
      {children}
    </div>
  );
});

GlassCard.displayName = 'GlassCard';
