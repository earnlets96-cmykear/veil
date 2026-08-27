/**
 * Reusable Toast Notification Component & Context System for VEIL.
 *
 * Implements non-blocking, accessible toast stack with duplicate prevention,
 * automatic dismissal, manual close, and SVG iconography.
 */

import React, { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react';
import { CheckCircleIcon, AlertCircleIcon, InfoIcon, CloseIcon } from '../icons/index.ts';

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
        return <CheckCircleIcon size={20} color="var(--veil-success)" />;
      case 'warning':
        return <AlertCircleIcon size={20} color="var(--veil-warning)" />;
      case 'error':
        return <AlertCircleIcon size={20} color="var(--veil-danger)" />;
      case 'info':
      default:
        return <InfoIcon size={20} color="var(--veil-info)" />;
    }
  };

  const isError = toast.type === 'error';

  return (
    <div
      className={`veil-toast veil-toast-${toast.type}`}
      role={isError ? 'alert' : 'status'}
      aria-live={isError ? 'assertive' : 'polite'}
      aria-atomic="true"
    >
      <div className="veil-toast-icon" aria-hidden="true">
        {getIcon()}
      </div>
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
        <CloseIcon size={16} />
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
      const id = `toast_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      setToasts((prev) => {
        // Prevent exact duplicate spamming
        const isDuplicate = prev.some((t) => t.message === message && t.type === type);
        if (isDuplicate) return prev;
        return [...prev.slice(-4), { id, type, title, message, durationMs }];
      });
      return id;
    },
    []
  );

  return (
    <ToastContext.Provider value={{ showToast, dismissToast, clearAllToasts }}>
      {children}
      <div className="veil-toast-container" aria-label="Notifications" role="region">
        {toasts.map((toast) => (
          <Toast key={toast.id} toast={toast} onDismiss={dismissToast} />
        ))}
      </div>
    </ToastContext.Provider>
  );
};
