/**
 * Reusable Password Input with Show/Hide Toggle.
 *
 * Preserves zero-knowledge privacy: never logs or exposes passphrase memory.
 * Accessible with explicit aria-label for the visibility toggle.
 */

import React, { useState, forwardRef } from 'react';
import { Input, InputProps } from './Input.tsx';

export interface PasswordInputProps extends Omit<InputProps, 'type' | 'trailingAction'> {
  showToggle?: boolean;
}

export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(({
  showToggle = true,
  placeholder = '••••••••••••',
  ...rest
}, ref) => {
  const [isVisible, setIsVisible] = useState(false);

  const toggleVisibility = () => {
    setIsVisible((prev) => !prev);
  };

  const toggleButton = showToggle ? (
    <button
      type="button"
      className="veil-icon-btn"
      style={{ width: '32px', height: '32px', minWidth: '32px', minHeight: '32px', fontSize: '0.9rem' }}
      onClick={toggleVisibility}
      aria-label={isVisible ? 'Hide passphrase' : 'Show passphrase'}
      title={isVisible ? 'Hide passphrase' : 'Show passphrase'}
      tabIndex={0}
    >
      {isVisible ? '🙈' : '👁️'}
    </button>
  ) : undefined;

  return (
    <Input
      ref={ref}
      type={isVisible ? 'text' : 'password'}
      placeholder={placeholder}
      trailingAction={toggleButton}
      autoComplete="off"
      autoCorrect="off"
      autoCapitalize="off"
      spellCheck="false"
      {...rest}
    />
  );
});

PasswordInput.displayName = 'PasswordInput';
