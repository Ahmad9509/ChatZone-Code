import React, { useEffect, useState } from 'react';

interface ToastProps {
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
  duration?: number;
  onDismiss?: () => void;
}

export const Toast: React.FC<ToastProps> = ({
  message,
  type,
  duration = 5000,
  onDismiss,
}) => {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
      onDismiss?.();
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onDismiss]);

  if (!isVisible) return null;

  const bgColor =
    type === 'success'
      ? 'bg-green-50'
      : type === 'error'
        ? 'bg-red-50'
        : type === 'warning'
          ? 'bg-yellow-50'
          : 'bg-blue-50';

  const textColor =
    type === 'success'
      ? 'text-green-700'
      : type === 'error'
        ? 'text-red-700'
        : type === 'warning'
          ? 'text-yellow-700'
          : 'text-blue-700';

  const borderColor =
    type === 'success'
      ? 'border-green-200'
      : type === 'error'
        ? 'border-red-200'
        : type === 'warning'
          ? 'border-yellow-200'
          : 'border-blue-200';

  const iconEmoji =
    type === 'success' ? '✓' : type === 'error' ? '✕' : type === 'warning' ? '⚠' : 'ℹ';

  return (
    <div
      className={`fixed bottom-6 right-6 ${bgColor} ${textColor} border ${borderColor} rounded-lg px-4 py-3 shadow-lg flex items-center gap-3 max-w-sm animate-fade-in z-50`}
      role="alert"
    >
      <span className="text-lg">{iconEmoji}</span>
      <span className="text-sm font-medium">{message}</span>
      <button
        onClick={() => {
          setIsVisible(false);
          onDismiss?.();
        }}
        className="ml-auto text-lg leading-none hover:opacity-70 transition-opacity"
      >
        ×
      </button>
    </div>
  );
};

/**
 * Toast container for managing multiple toasts
 */
interface ToastManagerProps {
  toasts: Array<ToastProps & { id: string }>;
  onRemove: (id: string) => void;
}

export const ToastContainer: React.FC<ToastManagerProps> = ({ toasts, onRemove }) => {
  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2">
      {toasts.map((toast) => (
        <Toast
          key={toast.id}
          message={toast.message}
          type={toast.type}
          duration={toast.duration}
          onDismiss={() => onRemove(toast.id)}
        />
      ))}
    </div>
  );
};
