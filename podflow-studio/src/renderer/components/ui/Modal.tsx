import { useEffect, useRef, ReactNode } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg';
  showCloseButton?: boolean;
}

export function Modal({ 
  isOpen, 
  onClose, 
  title, 
  children, 
  size = 'md',
  showCloseButton = true 
}: ModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  // Focus trap
  useEffect(() => {
    if (isOpen && modalRef.current) {
      const focusableElements = modalRef.current.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      const firstEl = focusableElements[0] as HTMLElement;
      firstEl?.focus();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const sizeClasses = {
    sm: 'max-w-sm',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div 
        ref={modalRef}
        className={`relative bg-sz-bg-secondary border border-sz-border rounded-sz-lg shadow-2xl w-full ${sizeClasses[size]} mx-4 animate-sz-fade-in`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? 'modal-title' : undefined}
      >
        {/* Header */}
        {(title || showCloseButton) && (
          <div className="flex items-center justify-between px-6 py-4 border-b border-sz-border">
            {title && (
              <h2 id="modal-title" className="text-lg font-semibold text-sz-text">{title}</h2>
            )}
            {showCloseButton && (
              <button
                onClick={onClose}
                className="p-1 text-sz-text-muted hover:text-sz-text hover:bg-sz-bg-tertiary rounded-sz transition-colors ml-auto"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        )}

        {/* Content */}
        {children}
      </div>
    </div>
  );
}

// Confirm Modal - replaces window.confirm
interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'default' | 'danger';
  icon?: ReactNode;
}

export function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'default',
  icon,
}: ConfirmModalProps) {
  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleConfirm();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onKeyDown={handleKeyDown}>
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative bg-sz-bg-secondary border border-sz-border rounded-sz-lg shadow-2xl w-full max-w-md mx-4 animate-sz-fade-in">
        {/* Content */}
        <div className="p-6">
          <div className="flex gap-4">
            {icon && (
              <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                variant === 'danger' ? 'bg-sz-danger-muted text-sz-danger' : 'bg-sz-accent-muted text-sz-accent'
              }`}>
                {icon}
              </div>
            )}
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-sz-text mb-2">{title}</h3>
              <p className="text-sm text-sz-text-secondary whitespace-pre-wrap">{message}</p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-sz-border bg-sz-bg-tertiary/50 rounded-b-sz-lg">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sz-text-muted hover:text-sz-text font-medium transition-colors"
          >
            {cancelText}
          </button>
          <button
            onClick={handleConfirm}
            className={`px-5 py-2 font-semibold rounded-sz transition-colors ${
              variant === 'danger'
                ? 'bg-sz-danger hover:bg-sz-danger/90 text-white'
                : 'bg-sz-accent hover:bg-sz-accent-hover text-white'
            }`}
            autoFocus
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

// Alert Modal - replaces window.alert
interface AlertModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  message: string;
  buttonText?: string;
  variant?: 'info' | 'success' | 'warning' | 'error';
  icon?: ReactNode;
}

export function AlertModal({
  isOpen,
  onClose,
  title,
  message,
  buttonText = 'OK',
  variant = 'info',
  icon,
}: AlertModalProps) {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === 'Escape') {
      onClose();
    }
  };

  if (!isOpen) return null;

  const variantStyles = {
    info: 'bg-sz-accent-muted text-sz-accent',
    success: 'bg-green-500/10 text-green-500',
    warning: 'bg-yellow-500/10 text-yellow-500',
    error: 'bg-sz-danger-muted text-sz-danger',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onKeyDown={handleKeyDown}>
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative bg-sz-bg-secondary border border-sz-border rounded-sz-lg shadow-2xl w-full max-w-md mx-4 animate-sz-fade-in">
        {/* Content */}
        <div className="p-6">
          <div className="flex gap-4">
            {icon && (
              <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${variantStyles[variant]}`}>
                {icon}
              </div>
            )}
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-sz-text mb-2">{title}</h3>
              <p className="text-sm text-sz-text-secondary whitespace-pre-wrap">{message}</p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end px-6 py-4 border-t border-sz-border bg-sz-bg-tertiary/50 rounded-b-sz-lg">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-sz-accent hover:bg-sz-accent-hover text-white font-semibold rounded-sz transition-colors"
            autoFocus
          >
            {buttonText}
          </button>
        </div>
      </div>
    </div>
  );
}

// Modal Footer - helper component for consistent footer styling
export interface ModalFooterProps {
  children: ReactNode;
  className?: string;
}

export function ModalFooter({ children, className = '' }: ModalFooterProps) {
  return (
    <div className={`flex items-center justify-end gap-3 px-6 py-4 border-t border-sz-border bg-sz-bg-tertiary/50 rounded-b-sz-lg ${className}`}>
      {children}
    </div>
  );
}

// Slide-in Panel - for settings drawers, side panels, etc.
export interface SlideInPanelProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  side?: 'left' | 'right';
  width?: string;
}

export function SlideInPanel({
  isOpen,
  onClose,
  title,
  children,
  side = 'right',
  width = 'w-96',
}: SlideInPanelProps) {
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Panel */}
      <div 
        className={`absolute ${side}-0 top-0 bottom-0 ${width} bg-sz-bg-secondary border-${side === 'right' ? 'l' : 'r'} border-sz-border shadow-2xl flex flex-col animate-sz-slide-in-${side}`}
      >
        {/* Header */}
        {title && (
          <div className="flex items-center justify-between px-6 py-4 border-b border-sz-border flex-shrink-0">
            <h2 className="text-lg font-semibold text-sz-text">{title}</h2>
            <button
              onClick={onClose}
              className="p-1 text-sz-text-muted hover:text-sz-text hover:bg-sz-bg-tertiary rounded-sz transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {children}
        </div>
      </div>
    </div>
  );
}

// Export types
export type { ModalProps, ConfirmModalProps, AlertModalProps };

// Default export for backward compatibility
export default Modal;
