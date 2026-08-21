/**
 * Reusable Icon-Only Button Component for VEIL Design System.
 *
 * Enforces mandatory aria-label for screen reader accessibility,
 * minimum 44x44px touch target, and loading/disabled states.
 */

import React, { ButtonHTMLAttributes, ReactNode } from 'react';

export type IconButtonVariant = 'ghost' | 'primary' | 'secondary' | 'danger';

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  'aria-label': string; // Mandatory for a11y
  variant?: IconButtonVariant;
  isLoading?: boolean;
  icon: ReactNode;
}

export const IconButton: React.FC<IconButtonProps> = ({
  'aria-label': ariaLabel,
  variant = 'ghost',
  isLoading = false,
  disabled = false,
  icon,
  className = '',
  title,
  ...rest
}) => {
  const variantClass = `veil-icon-btn-${variant}`;

  return (
    <button
      type="button"
      className={`veil-icon-btn ${variantClass} ${className}`.trim()}
      aria-label={ariaLabel}
      title={title || ariaLabel}
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
