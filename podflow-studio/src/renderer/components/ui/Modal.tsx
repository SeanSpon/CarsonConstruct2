import { memo, useEffect, type ReactNode } from 'react';
import { X } from 'lucide-react';
import IconButton from './IconButton';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  showCloseButton?: boolean;
  closeOnOverlayClick?: boolean;
  closeOnEscape?: boolean;
  className?: string;
}

const sizeStyles = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  full: 'max-w-4xl',
};

function Modal({
  isOpen,
  onClose,
  title,
  description,
  children,
  size = 'md',
  showCloseButton = true,
  closeOnOverlayClick = true,
  closeOnEscape = true,
  className = '',
}: ModalProps) {
  // Handle escape key
  useEffect(() => {
    if (!closeOnEscape || !isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, closeOnEscape, onClose]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-sz-fade-in"
        onClick={closeOnOverlayClick ? onClose : undefined}
      />

      {/* Modal content */}
      <div
        className={`
          relative w-full ${sizeStyles[size]}
          bg-sz-bg-secondary border border-sz-border rounded-sz-lg
          shadow-sz-float animate-sz-slide-up
          ${className}
        `}
      >
        {/* Header */}
        {(title || showCloseButton) && (
          <div className="flex items-start justify-between gap-4 px-6 py-4 border-b border-sz-border">
            <div className="flex-1 min-w-0">
              {title && (
                <h2 className="text-lg font-semibold text-sz-text">{title}</h2>
              )}
              {description && (
                <p className="text-sm text-sz-text-secondary mt-1">{description}</p>
              )}
            </div>
            {showCloseButton && (
              <IconButton
                icon={<X className="w-4 h-4" />}
                variant="ghost"
                size="sm"
                onClick={onClose}
                tooltip="Close"
              />
            )}
          </div>
        )}

        {/* Body */}
        <div className="px-6 py-4">
          {children}
        </div>
      </div>
    </div>
  );
}

export default memo(Modal);

// Modal footer helper
export interface ModalFooterProps {
  children: ReactNode;
  className?: string;
}

export const ModalFooter = memo(function ModalFooter({ children, className = '' }: ModalFooterProps) {
  return (
    <div className={`flex items-center justify-end gap-3 pt-4 border-t border-sz-border mt-4 -mx-6 -mb-4 px-6 py-4 bg-sz-bg-tertiary ${className}`}>
      {children}
    </div>
  );
});

// Slide-in panel (from right)
export interface SlideInPanelProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  width?: 'sm' | 'md' | 'lg';
  className?: string;
}

const panelWidths = {
  sm: 'w-80',
  md: 'w-96',
  lg: 'w-[480px]',
};

export const SlideInPanel = memo(function SlideInPanel({
  isOpen,
  onClose,
  title,
  children,
  width = 'md',
  className = '',
}: SlideInPanelProps) {
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
    }
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/50 animate-sz-fade-in"
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className={`
          relative ${panelWidths[width]} h-full
          bg-sz-bg-secondary border-l border-sz-border
          animate-sz-slide-in-right overflow-hidden flex flex-col
          ${className}
        `}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-4 px-4 py-3 border-b border-sz-border flex-shrink-0">
          {title && (
            <h2 className="text-sm font-semibold text-sz-text">{title}</h2>
          )}
          <IconButton
            icon={<X className="w-4 h-4" />}
            variant="ghost"
            size="sm"
            onClick={onClose}
            tooltip="Close"
          />
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {children}
        </div>
      </div>
    </div>
  );
});
