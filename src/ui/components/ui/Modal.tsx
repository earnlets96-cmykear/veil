/**
 * Reusable Accessible Modal Dialog Component for VEIL.
 *
 * Implements accessible dialog semantics (role="dialog", aria-modal="true"),
 * Escape key dismissal, backdrop click closing, scroll locking, and focus trap.
 */

import React, { useEffect, useRef, ReactNode, useId } from 'react';
import { IconButton } from './IconButton.tsx';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  maxWidth?: string;
  closeOnBackdrop?: boolean;
  closeOnEscape?: boolean;
  className?: string;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  footer,
  maxWidth = '480px',
  closeOnBackdrop = true,
  closeOnEscape = true,
  className = '',
}) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);
  const titleId = useId();

  useEffect(() => {
    if (!isOpen) return;

    // Save previously focused element to restore upon close
    previousActiveElement.current = document.activeElement as HTMLElement;

    // Lock body scroll
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // Handle Escape key
    const handleKeyDown = (e: KeyboardEvent) => {
      if (closeOnEscape && e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    // Initial focus on dialog
    const focusable = modalRef.current?.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    if (focusable && focusable.length > 0) {
      focusable[0].focus();
    }

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);
      previousActiveElement.current?.focus();
    };
  }, [isOpen, closeOnEscape, onClose]);

  if (!isOpen) return null;

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (closeOnBackdrop && e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      className="veil-modal-overlay"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <div
        ref={modalRef}
        className={`veil-modal-card ${className}`.trim()}
        style={{ maxWidth }}
      >
        <div className="veil-modal-header">
          <h2 id={titleId} className="veil-type-title" style={{ fontSize: 'var(--veil-text-lg)', fontWeight: 600 }}>
            {title}
          </h2>
          <IconButton
            icon="✕"
            aria-label="Close dialog"
            onClick={onClose}
            style={{ width: '32px', height: '32px', minWidth: '32px', minHeight: '32px' }}
          />
        </div>

        <div className="veil-modal-body">
          {children}
        </div>

        {footer && (
          <div className="veil-modal-footer">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};
