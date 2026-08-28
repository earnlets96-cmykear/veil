/**
 * Reusable Button Component for VEIL Design System.
 *
 * Implements accessible interactive states, minimum touch targets (>=44px),
 * loading spinner, focus indicators, and strict token adherence.
 */

import React, { ButtonHTMLAttributes, ReactNode } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'panic' | 'ghost';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  loading?: boolean;
  leftIcon?: ReactNode;
  icon?: ReactNode;
  rightIcon?: ReactNode;
  fullWidth?: boolean;
  children?: ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  isLoading = false,
  loading = false,
  leftIcon,
  icon,
  rightIcon,
  fullWidth = false,
  disabled = false,
  className = '',
  children,
  ...rest
}) => {
  const isBusy = isLoading || loading;
  const effectiveLeftIcon = leftIcon || icon;
  const variantClass = `veil-btn-${variant}`;
  const sizeClass = `veil-btn-${size}`;
  const widthClass = fullWidth ? 'veil-btn-full' : '';

  return (
    <button
      type="button"
      className={`veil-btn ${variantClass} ${sizeClass} ${widthClass} ${className}`.trim()}
      disabled={disabled || isBusy}
      aria-busy={isBusy ? 'true' : undefined}
      {...rest}
    >
      {isBusy ? (
        <span className="veil-spinner veil-spinner-sm" aria-hidden="true" />
      ) : (
        effectiveLeftIcon && <span className="veil-btn-icon-slot" aria-hidden="true">{effectiveLeftIcon}</span>
      )}
      <span>{children}</span>
      {!isBusy && rightIcon && (
        <span className="veil-btn-icon-slot" aria-hidden="true">{rightIcon}</span>
      )}
    </button>
  );
};
