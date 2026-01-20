import { memo, type ReactNode } from 'react';
import { AlertCircle, CheckCircle2, Info, XCircle } from 'lucide-react';
import Button, { type ButtonProps } from './Button';

export interface EmptyStateProps {
  icon?: ReactNode;
  title?: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
    variant?: ButtonProps['variant'];
  };
  className?: string;
  children?: ReactNode;
}

function EmptyState({
  icon,
  title,
  description,
  action,
  className = '',
  children,
}: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center py-16 px-8 text-center ${className}`}>
      {icon && (
        <div className="w-16 h-16 rounded-xl bg-sz-bg-tertiary border border-sz-border flex items-center justify-center mb-6 text-sz-text-muted">
          {icon}
        </div>
      )}
      {title && (
        <h3 className="text-lg font-semibold text-sz-text mb-2">{title}</h3>
      )}
      {description && (
        <p className="text-sm text-sz-text-secondary max-w-sm mb-6">{description}</p>
      )}
      {action && (
        <Button
          variant={action.variant || 'secondary'}
          onClick={action.onClick}
        >
          {action.label}
        </Button>
      )}
      {children}
    </div>
  );
}

export default memo(EmptyState);

// Error state
export interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  className?: string;
}

export const ErrorState = memo(function ErrorState({
  title = 'Something went wrong',
  message,
  onRetry,
  className = '',
}: ErrorStateProps) {
  return (
    <div className={`bg-sz-danger-muted border border-sz-danger/30 rounded-sz-lg p-4 ${className}`}>
      <div className="flex gap-3">
        <XCircle className="w-5 h-5 text-sz-danger flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-semibold text-sz-danger">{title}</h4>
          <p className="text-sm text-sz-danger/80 mt-1">{message}</p>
          {onRetry && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onRetry}
              className="mt-3 text-sz-danger hover:text-sz-danger hover:bg-sz-danger/10"
            >
              Try Again
            </Button>
          )}
        </div>
      </div>
    </div>
  );
});

// Success state
export interface SuccessStateProps {
  title?: string;
  message: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

export const SuccessState = memo(function SuccessState({
  title = 'Success',
  message,
  action,
  className = '',
}: SuccessStateProps) {
  return (
    <div className={`bg-sz-success-muted border border-sz-success/30 rounded-sz-lg p-4 ${className}`}>
      <div className="flex gap-3">
        <CheckCircle2 className="w-5 h-5 text-sz-success flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-semibold text-sz-success">{title}</h4>
          <p className="text-sm text-sz-success/80 mt-1">{message}</p>
          {action && (
            <Button
              variant="ghost"
              size="sm"
              onClick={action.onClick}
              className="mt-3 text-sz-success hover:text-sz-success hover:bg-sz-success/10"
            >
              {action.label}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
});

// Info state
export interface InfoStateProps {
  title?: string;
  message: string;
  className?: string;
}

export const InfoState = memo(function InfoState({
  title,
  message,
  className = '',
}: InfoStateProps) {
  return (
    <div className={`bg-sz-accent-muted border border-sz-accent/30 rounded-sz-lg p-4 ${className}`}>
      <div className="flex gap-3">
        <Info className="w-5 h-5 text-sz-accent flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          {title && (
            <h4 className="text-sm font-semibold text-sz-accent">{title}</h4>
          )}
          <p className={`text-sm text-sz-accent/80 ${title ? 'mt-1' : ''}`}>{message}</p>
        </div>
      </div>
    </div>
  );
});

// Warning state
export interface WarningStateProps {
  title?: string;
  message: string;
  className?: string;
}

export const WarningState = memo(function WarningState({
  title,
  message,
  className = '',
}: WarningStateProps) {
  return (
    <div className={`bg-sz-warning-muted border border-sz-warning/30 rounded-sz-lg p-4 ${className}`}>
      <div className="flex gap-3">
        <AlertCircle className="w-5 h-5 text-sz-warning flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          {title && (
            <h4 className="text-sm font-semibold text-sz-warning">{title}</h4>
          )}
          <p className={`text-sm text-sz-warning/80 ${title ? 'mt-1' : ''}`}>{message}</p>
        </div>
      </div>
    </div>
  );
});
