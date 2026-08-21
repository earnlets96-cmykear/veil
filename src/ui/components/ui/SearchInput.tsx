/**
 * Reusable Search Input Component for VEIL.
 *
 * Includes magnifying search icon and accessible clear button.
 */

import React, { forwardRef } from 'react';
import { Input, InputProps } from './Input.tsx';

export interface SearchInputProps extends Omit<InputProps, 'type' | 'leadingIcon' | 'trailingAction'> {
  onClear?: () => void;
}

export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(({
  value,
  onClear,
  placeholder = 'Search contacts, messages & groups...',
  ...rest
}, ref) => {
  const hasValue = Boolean(value && String(value).length > 0);

  const clearButton = hasValue && onClear ? (
    <button
      type="button"
      className="veil-icon-btn"
      style={{ width: '28px', height: '28px', minWidth: '28px', minHeight: '28px', fontSize: '0.8rem' }}
      onClick={onClear}
      aria-label="Clear search text"
      title="Clear search"
    >
      ✕
    </button>
  ) : undefined;

  return (
    <Input
      ref={ref}
      type="search"
      leadingIcon="🔍"
      trailingAction={clearButton}
      value={value}
      placeholder={placeholder}
      aria-label={rest['aria-label'] || 'Search conversation history'}
      {...rest}
    />
  );
});

SearchInput.displayName = 'SearchInput';
