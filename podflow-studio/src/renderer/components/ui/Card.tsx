import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'bordered' | 'elevated' | 'interactive';
  noPadding?: boolean;
}

const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ variant = 'default', noPadding = false, className = '', children, ...props }, ref) => {
    const variantStyles = {
      default: 'bg-sz-bg-secondary border border-sz-border',
      bordered: 'bg-sz-bg-secondary border-2 border-sz-border-light',
      elevated: 'bg-sz-bg-secondary border border-sz-border shadow-sz-float',
      interactive: 'bg-sz-bg-secondary border border-sz-border hover:border-sz-accent/30 hover:shadow-sz-glow transition-all duration-sz-normal cursor-pointer',
    };

    return (
      <div
        ref={ref}
        className={`
          rounded-sz-lg overflow-hidden
          ${variantStyles[variant]}
          ${noPadding ? '' : 'p-4'}
          ${className}
        `}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Card.displayName = 'Card';

export interface CardHeaderProps extends HTMLAttributes<HTMLDivElement> {
  title?: string;
  subtitle?: string;
  action?: ReactNode;
  noBorder?: boolean;
}

const CardHeader = forwardRef<HTMLDivElement, CardHeaderProps>(
  ({ title, subtitle, action, noBorder = false, className = '', children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={`
          px-4 py-3
          ${noBorder ? '' : 'border-b border-sz-border'}
          ${className}
        `}
        {...props}
      >
        {children || (
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0 flex-1">
              {title && (
                <h3 className="font-semibold text-sz-text truncate">{title}</h3>
              )}
              {subtitle && (
                <p className="text-sm text-sz-text-secondary mt-0.5 truncate">{subtitle}</p>
              )}
            </div>
            {action && <div className="flex-shrink-0">{action}</div>}
          </div>
        )}
      </div>
    );
  }
);

CardHeader.displayName = 'CardHeader';

export interface CardContentProps extends HTMLAttributes<HTMLDivElement> {
  noPadding?: boolean;
}

const CardContent = forwardRef<HTMLDivElement, CardContentProps>(
  ({ noPadding = false, className = '', children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={`${noPadding ? '' : 'p-4'} ${className}`}
        {...props}
      >
        {children}
      </div>
    );
  }
);

CardContent.displayName = 'CardContent';

export interface CardFooterProps extends HTMLAttributes<HTMLDivElement> {
  noBorder?: boolean;
}

const CardFooter = forwardRef<HTMLDivElement, CardFooterProps>(
  ({ noBorder = false, className = '', children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={`
          px-4 py-3
          ${noBorder ? '' : 'border-t border-sz-border'}
          ${className}
        `}
        {...props}
      >
        {children}
      </div>
    );
  }
);

CardFooter.displayName = 'CardFooter';

export { Card, CardHeader, CardContent, CardFooter };
export default Card;
