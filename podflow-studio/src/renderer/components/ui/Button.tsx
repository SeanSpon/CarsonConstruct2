import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Loader2 } from 'lucide-react';

const variants = {
  primary: 'bg-sz-accent text-sz-bg hover:bg-sz-accent-hover active:bg-sz-accent-hover shadow-sm',
  secondary: 'bg-sz-bg-tertiary text-sz-text border border-sz-border hover:bg-sz-bg-hover hover:border-sz-border-light',
  ghost: 'text-sz-text-secondary hover:text-sz-text hover:bg-sz-bg-hover',
  danger: 'bg-sz-danger text-white hover:bg-red-500',
  success: 'bg-sz-success text-white hover:bg-emerald-400',
  outline: 'border border-sz-border text-sz-text-secondary hover:text-sz-text hover:bg-sz-bg-hover hover:border-sz-border-light',
} as const;

const sizes = {
  xs: 'px-2 py-1 text-xs h-6',
  sm: 'px-3 py-1.5 text-xs h-7',
  md: 'px-4 py-2 text-sm h-9',
  lg: 'px-5 py-2.5 text-sm h-10',
  xl: 'px-6 py-3 text-base h-12',
} as const;

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
  isLoading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  fullWidth?: boolean;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      isLoading = false,
      leftIcon,
      rightIcon,
      fullWidth = false,
      disabled,
      className = '',
      children,
      ...props
    },
    ref
  ) => {
    const isDisabled = disabled || isLoading;

    return (
      <button
        ref={ref}
        disabled={isDisabled}
        className={`
          inline-flex items-center justify-center gap-2 rounded-sz font-medium
          transition-all duration-sz-fast
          focus:outline-none focus:ring-2 focus:ring-sz-accent/40 focus:ring-offset-1 focus:ring-offset-sz-bg
          ${variants[variant]}
          ${sizes[size]}
          ${fullWidth ? 'w-full' : ''}
          ${isDisabled ? 'opacity-50 cursor-not-allowed pointer-events-none' : ''}
          ${className}
        `}
        {...props}
      >
        {isLoading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : leftIcon ? (
          leftIcon
        ) : null}
        {children}
        {!isLoading && rightIcon}
      </button>
    );
  }
);

Button.displayName = 'Button';

export default Button;
