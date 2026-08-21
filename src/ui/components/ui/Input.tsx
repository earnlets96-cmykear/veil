/**
 * Reusable Accessible Form Input Component for VEIL Design System.
 *
 * Supports labels, helper text, inline error validation, leading icons,
 * and trailing actions with consistent touch targets.
 */

import React, { InputHTMLAttributes, ReactNode, forwardRef, useId } from 'react';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  helperText?: string;
  errorText?: string;
  leadingIcon?: ReactNode;
  trailingAction?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(({
  label,
  helperText,
  errorText,
  leadingIcon,
  trailingAction,
  id,
  className = '',
  required,
  disabled,
  ...rest
}, ref) => {
  const generatedId = useId();
  const inputId = id || generatedId;
  const errorId = `${inputId}-error`;
  const helperId = `${inputId}-helper`;

  const hasError = Boolean(errorText);

  return (
    <div className="veil-input-group">
      {label && (
        <label htmlFor={inputId} className="veil-input-label">
          <span>{label}</span>
          {required && <span style={{ color: 'var(--veil-danger)' }} aria-hidden="true">*</span>}
        </label>
      )}

      <div className="veil-input-wrapper">
        {leadingIcon && (
          <span className="veil-input-leading-icon" aria-hidden="true">
            {leadingIcon}
          </span>
        )}

        <input
          ref={ref}
          id={inputId}
          className={`veil-input ${leadingIcon ? 'veil-input-has-leading' : ''} ${
            trailingAction ? 'veil-input-has-trailing' : ''
          } ${hasError ? 'veil-input-error' : ''} ${className}`.trim()}
          required={required}
          disabled={disabled}
          aria-invalid={hasError ? 'true' : undefined}
          aria-describedby={
            hasError ? errorId : helperText ? helperId : undefined
          }
          {...rest}
        />

        {trailingAction && (
          <span className="veil-input-trailing-action">
            {trailingAction}
          </span>
        )}
      </div>

      {hasError ? (
        <div id={errorId} className="veil-input-error-text" role="alert">
          <span aria-hidden="true">⚠️</span>
          <span>{errorText}</span>
        </div>
      ) : helperText ? (
        <div id={helperId} className="veil-input-helper-text">
          {helperText}
        </div>
      ) : null}
    </div>
  );
});

Input.displayName = 'Input';
