import { forwardRef, type InputHTMLAttributes } from 'react';

export interface ToggleProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'size'> {
  label?: string;
  description?: string;
  size?: 'sm' | 'md';
}

const Toggle = forwardRef<HTMLInputElement, ToggleProps>(
  ({ label, description, size = 'md', className = '', ...props }, ref) => {
    const sizeStyles = {
      sm: {
        track: 'w-7 h-4',
        thumb: 'w-3 h-3 peer-checked:translate-x-3',
      },
      md: {
        track: 'w-9 h-5',
        thumb: 'w-4 h-4 peer-checked:translate-x-4',
      },
    };

    const styles = sizeStyles[size];

    if (!label && !description) {
      // Simple toggle without label
      return (
        <label className={`relative inline-flex cursor-pointer ${className}`}>
          <input
            ref={ref}
            type="checkbox"
            className="sr-only peer"
            {...props}
          />
          <div
            className={`
              ${styles.track}
              bg-sz-bg-hover border border-sz-border rounded-full
              peer-checked:bg-sz-accent peer-checked:border-sz-accent
              peer-focus-visible:ring-2 peer-focus-visible:ring-sz-accent/30
              peer-disabled:opacity-50 peer-disabled:cursor-not-allowed
              transition-colors duration-150
            `}
          />
          <div
            className={`
              ${styles.thumb}
              absolute top-0.5 left-0.5
              bg-sz-text-secondary rounded-full
              peer-checked:bg-white
              transition-all duration-150
            `}
          />
        </label>
      );
    }

    return (
      <label className={`flex items-start gap-3 cursor-pointer group ${className}`}>
        <div className="relative flex-shrink-0 mt-0.5">
          <input
            ref={ref}
            type="checkbox"
            className="sr-only peer"
            {...props}
          />
          <div
            className={`
              ${styles.track}
              bg-sz-bg-hover border border-sz-border rounded-full
              peer-checked:bg-sz-accent peer-checked:border-sz-accent
              peer-focus-visible:ring-2 peer-focus-visible:ring-sz-accent/30
              peer-disabled:opacity-50 peer-disabled:cursor-not-allowed
              transition-colors duration-150
            `}
          />
          <div
            className={`
              ${styles.thumb}
              absolute top-0.5 left-0.5
              bg-sz-text-secondary rounded-full
              peer-checked:bg-white
              transition-all duration-150
            `}
          />
        </div>
        {(label || description) && (
          <div className="flex-1 min-w-0">
            {label && (
              <span className="block text-sm font-medium text-sz-text group-hover:text-sz-text">
                {label}
              </span>
            )}
            {description && (
              <span className="block text-xs text-sz-text-muted mt-0.5">
                {description}
              </span>
            )}
          </div>
        )}
      </label>
    );
  }
);

Toggle.displayName = 'Toggle';

export default Toggle;
