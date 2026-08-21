/**
 * Reusable Toast Notification Component & Context System for VEIL.
 *
 * Implements non-blocking, accessible toast stack with duplicate prevention,
 * automatic dismissal, manual close, and screen reader announcements.
 */

import React, { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react';

export type ToastType = 'success' | 'info' | 'warning' | 'error';

export interface ToastItem {
  id: string;
  type: ToastType;
  title?: string;
  message: string;
  durationMs?: number;
}

export interface ToastContextValue {
  showToast: (options: { type?: ToastType; title?: string; message: string; durationMs?: number }) => string;
  dismissToast: (id: string) => void;
  clearAllToasts: () => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export const useToast = (): ToastContextValue => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

export const Toast: React.FC<{
  toast: ToastItem;
  onDismiss: (id: string) => void;
}> = ({ toast, onDismiss }) => {
  useEffect(() => {
    const duration = toast.durationMs ?? 4000;
    if (duration > 0) {
      const timer = setTimeout(() => {
        onDismiss(toast.id);
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [toast.id, toast.durationMs, onDismiss]);

  const getIcon = () => {
    switch (toast.type) {
      case 'success':
        return '✓';
      case 'warning':
        return '⚠️';
      case 'error':
        return '✕';
      case 'info':
      default:
        return 'ℹ️';
    }
  };

  return (
    <div
      className={`veil-toast veil-toast-${toast.type}`}
      role="status"
      aria-live={toast.type === 'error' ? 'assertive' : 'polite'}
    >
      <span className="veil-toast-icon" aria-hidden="true">
        {getIcon()}
      </span>
      <div className="veil-toast-content">
        {toast.title && <div className="veil-toast-title">{toast.title}</div>}
        <div className="veil-toast-message">{toast.message}</div>
      </div>
      <button
        type="button"
        className="veil-toast-close"
        onClick={() => onDismiss(toast.id)}
        aria-label="Dismiss notification"
      >
        ✕
      </button>
    </div>
  );
};

export const ToastProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const clearAllToasts = useCallback(() => {
    setToasts([]);
  }, []);

  const showToast = useCallback(
    ({
      type = 'info',
      title,
      message,
      durationMs = 4000,
    }: {
      type?: ToastType;
      title?: string;
      message: string;
      durationMs?: number;
    }) => {
      const id = `toast_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

      setToasts((prev) => {
        // Prevent duplicate toasts with the exact same message within active stack
        const isDuplicate = prev.some((t) => t.message === message && t.type === type);
        if (isDuplicate) return prev;

        // Limit stack to maximum 4 visible toasts
        const next = [...prev, { id, type, title, message, durationMs }];
        return next.slice(-4);
      });

      return id;
    },
    []
  );

  return (
    <ToastContext.Provider value={{ showToast, dismissToast, clearAllToasts }}>
      {children}
      <div className="veil-toast-container" aria-label="Notifications">
        {toasts.map((toast) => (
          <Toast key={toast.id} toast={toast} onDismiss={dismissToast} />
        ))}
      </div>
    </ToastContext.Provider>
  );
};
