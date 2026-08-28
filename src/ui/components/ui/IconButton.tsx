/**
 * Reusable Icon-Only Button Component for VEIL Design System.
 *
 * Enforces mandatory aria-label for screen reader accessibility,
 * minimum 44x44px touch target, and loading/disabled states.
 */

import React, { ButtonHTMLAttributes, ReactNode } from 'react';

export type IconButtonVariant = 'ghost' | 'primary' | 'secondary' | 'danger';
export type IconButtonSize = 'sm' | 'md' | 'lg';

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  'aria-label'?: string;
  ariaLabel?: string;
  variant?: IconButtonVariant;
  size?: IconButtonSize;
  isLoading?: boolean;
  icon: ReactNode;
}

export const IconButton: React.FC<IconButtonProps> = ({
  'aria-label': ariaLabelAttr,
  ariaLabel,
  variant = 'ghost',
  size = 'md',
  isLoading = false,
  disabled = false,
  icon,
  className = '',
  title,
  ...rest
}) => {
  const effectiveAriaLabel = ariaLabelAttr || ariaLabel || title || 'button';
  const variantClass = `veil-icon-btn-${variant}`;
  const sizeClass = `veil-icon-btn-${size}`;

  return (
    <button
      type="button"
      className={`veil-icon-btn ${variantClass} ${sizeClass} ${className}`.trim()}
      aria-label={effectiveAriaLabel}
      title={title || effectiveAriaLabel}
      disabled={disabled || isLoading}
      aria-busy={isLoading ? 'true' : undefined}
      {...rest}
    >
      {isLoading ? (
        <span className="veil-spinner veil-spinner-sm" aria-hidden="true" />
      ) : (
        icon
      )}
    </button>
  );
};
