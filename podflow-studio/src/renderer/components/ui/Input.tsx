import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react';

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: string;
  error?: string;
  hint?: string;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
}

const sizes = {
  sm: 'h-7 text-xs px-2',
  md: 'h-9 text-sm px-3',
  lg: 'h-11 text-base px-4',
};

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, leftIcon, rightIcon, size = 'md', className = '', ...props }, ref) => {
    const hasError = !!error;

    return (
      <div className="space-y-1.5">
        {label && (
          <label className="block text-xs font-medium text-sz-text-secondary">
            {label}
          </label>
        )}
        <div className="relative">
          {leftIcon && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-sz-text-muted">
              {leftIcon}
            </div>
          )}
          <input
            ref={ref}
            className={`
              w-full bg-sz-bg border rounded-sz text-sz-text
              placeholder:text-sz-text-muted
              transition-colors duration-sz-fast
              focus:outline-none focus:border-sz-accent focus:ring-1 focus:ring-sz-accent/30
              disabled:opacity-50 disabled:cursor-not-allowed
              ${sizes[size]}
              ${leftIcon ? 'pl-10' : ''}
              ${rightIcon ? 'pr-10' : ''}
              ${hasError ? 'border-sz-danger focus:border-sz-danger focus:ring-sz-danger/30' : 'border-sz-border'}
              ${className}
            `}
            {...props}
          />
          {rightIcon && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-sz-text-muted">
              {rightIcon}
            </div>
          )}
        </div>
        {(error || hint) && (
          <p className={`text-xs ${hasError ? 'text-sz-danger' : 'text-sz-text-muted'}`}>
            {error || hint}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

export interface NumberInputProps extends Omit<InputProps, 'type'> {
  min?: number;
  max?: number;
  step?: number;
}

export const NumberInput = forwardRef<HTMLInputElement, NumberInputProps>(
  ({ min, max, step = 1, ...props }, ref) => {
    return (
      <Input
        ref={ref}
        type="number"
        min={min}
        max={max}
        step={step}
        {...props}
      />
    );
  }
);

NumberInput.displayName = 'NumberInput';

export default Input;
