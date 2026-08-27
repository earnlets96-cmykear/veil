/**
 * Reusable Password Input with Show/Hide Toggle.
 * Uses SVG Eye/EyeOff icons.
 */

import React, { useState, forwardRef } from 'react';
import { Input, InputProps } from './Input.tsx';
import { EyeIcon, EyeOffIcon } from '../icons/index.ts';

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
      className="veil-icon-btn veil-visibility-btn"
      onClick={toggleVisibility}
      aria-label={isVisible ? 'Hide passphrase' : 'Show passphrase'}
      title={isVisible ? 'Hide passphrase' : 'Show passphrase'}
      tabIndex={0}
    >
      {isVisible ? <EyeOffIcon size={18} /> : <EyeIcon size={18} />}
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
