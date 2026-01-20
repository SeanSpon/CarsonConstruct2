import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';

const variants = {
  default: 'text-sz-text-secondary hover:text-sz-text hover:bg-sz-bg-hover',
  accent: 'text-sz-accent hover:text-sz-accent-hover hover:bg-sz-accent-muted',
  ghost: 'text-sz-text-muted hover:text-sz-text-secondary hover:bg-sz-bg-hover',
  danger: 'text-sz-text-secondary hover:text-sz-danger hover:bg-sz-danger-muted',
  success: 'text-sz-text-secondary hover:text-sz-success hover:bg-sz-success-muted',
} as const;

const sizes = {
  xs: 'w-6 h-6',
  sm: 'w-7 h-7',
  md: 'w-8 h-8',
  lg: 'w-10 h-10',
} as const;

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: ReactNode;
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
  tooltip?: string;
  isActive?: boolean;
}

const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  (
    {
      icon,
      variant = 'default',
      size = 'md',
      tooltip,
      isActive = false,
      disabled,
      className = '',
      ...props
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        disabled={disabled}
        title={tooltip}
        className={`
          inline-flex items-center justify-center rounded-sz
          transition-colors duration-sz-fast
          focus:outline-none focus:ring-2 focus:ring-sz-accent/40 focus:ring-offset-1 focus:ring-offset-sz-bg
          ${variants[variant]}
          ${sizes[size]}
          ${isActive ? 'bg-sz-bg-hover text-sz-text' : ''}
          ${disabled ? 'opacity-50 cursor-not-allowed pointer-events-none' : ''}
          ${className}
        `}
        {...props}
      >
        {icon}
      </button>
    );
  }
);

IconButton.displayName = 'IconButton';

export default IconButton;
