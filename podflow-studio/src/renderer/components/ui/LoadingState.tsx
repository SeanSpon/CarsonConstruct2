import { memo, type ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import Button from './Button';

// Simple loading spinner
export interface LoadingStateProps {
  message?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

function LoadingState({ message, size = 'md', className = '' }: LoadingStateProps) {
  const sizeStyles = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
  };

  return (
    <div className={`flex flex-col items-center gap-3 ${className}`}>
      <Loader2 className={`${sizeStyles[size]} text-sz-accent animate-spin`} />
      {message && (
        <p className="text-sm text-sz-text-secondary animate-pulse">{message}</p>
      )}
    </div>
  );
}

export default memo(LoadingState);

// Full-screen loading overlay
export interface LoadingOverlayProps {
  message?: string;
  logo?: ReactNode;
}

export const LoadingOverlay = memo(function LoadingOverlay({ message, logo }: LoadingOverlayProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-sz-bg/90 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-6 p-8">
        {logo ? (
          <div className="animate-sz-pulse">{logo}</div>
        ) : (
          <div className="flex items-center gap-0 animate-sz-pulse">
            <span className="text-xl font-bold text-sz-text tracking-wide">SEE</span>
            <span className="mx-1.5 px-2 py-0.5 bg-sz-accent rounded text-xs font-bold text-white tracking-wide">
              STUDIO
            </span>
            <span className="text-xl font-bold text-sz-text tracking-wide">ZEE</span>
          </div>
        )}
        <Loader2 className="w-6 h-6 text-sz-accent animate-spin" />
        {message && (
          <p className="text-sz-text-secondary text-sm">{message}</p>
        )}
      </div>
    </div>
  );
});

// Progress loader with cancel option
export interface ProgressLoaderProps {
  percent: number;
  message?: string;
  subMessage?: string;
  onCancel?: () => void;
  className?: string;
}

export const ProgressLoader = memo(function ProgressLoader({
  percent,
  message,
  subMessage,
  onCancel,
  className = '',
}: ProgressLoaderProps) {
  return (
    <div className={`bg-sz-bg-secondary border border-sz-border rounded-sz-lg p-8 ${className}`}>
      <div className="flex flex-col items-center text-center">
        {/* Animated logo */}
        <div className="flex items-center gap-0 mb-6 animate-sz-pulse">
          <span className="text-lg font-bold text-sz-text tracking-wide">SEE</span>
          <span className="mx-1.5 px-2 py-0.5 bg-sz-accent rounded text-xs font-bold text-white tracking-wide">
            STUDIO
          </span>
          <span className="text-lg font-bold text-sz-text tracking-wide">ZEE</span>
        </div>

        {/* Progress bar */}
        <div className="w-full max-w-sm mb-4">
          <div className="h-1.5 bg-sz-bg-hover rounded-full overflow-hidden">
            <div
              className="h-full bg-sz-accent rounded-full transition-all duration-300 ease-out"
              style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
            />
          </div>
        </div>

        {/* Percentage */}
        <p className="text-2xl font-bold text-sz-text mb-2">
          {Math.round(percent)}%
        </p>

        {/* Message */}
        {message && (
          <p className="text-sz-text-secondary text-sm mb-1">{message}</p>
        )}
        {subMessage && (
          <p className="text-sz-text-muted text-xs">{subMessage}</p>
        )}

        {/* Cancel button */}
        {onCancel && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onCancel}
            className="mt-6"
          >
            Cancel
          </Button>
        )}
      </div>
    </div>
  );
});
