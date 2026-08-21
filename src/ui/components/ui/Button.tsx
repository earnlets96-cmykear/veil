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
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  fullWidth?: boolean;
  children?: ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  isLoading = false,
  leftIcon,
  rightIcon,
  fullWidth = false,
  disabled = false,
  className = '',
  children,
  ...rest
}) => {
  const variantClass = `veil-btn-${variant}`;
  const sizeClass = `veil-btn-${size}`;
  const widthClass = fullWidth ? 'veil-btn-full' : '';

  return (
    <button
      type="button"
      className={`veil-btn ${variantClass} ${sizeClass} ${widthClass} ${className}`.trim()}
      disabled={disabled || isLoading}
      aria-busy={isLoading ? 'true' : undefined}
      {...rest}
    >
      {isLoading ? (
        <span className="veil-spinner veil-spinner-sm" aria-hidden="true" />
      ) : (
        leftIcon && <span className="veil-btn-icon-slot" aria-hidden="true">{leftIcon}</span>
      )}
      <span>{children}</span>
      {!isLoading && rightIcon && (
        <span className="veil-btn-icon-slot" aria-hidden="true">{rightIcon}</span>
      )}
    </button>
  );
};
