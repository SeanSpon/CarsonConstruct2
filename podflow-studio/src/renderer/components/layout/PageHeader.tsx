import { memo, type ReactNode } from 'react';

export interface PageHeaderProps {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
  compact?: boolean;
}

function PageHeader({
  title,
  subtitle,
  icon,
  actions,
  children,
  className = '',
  compact = false,
}: PageHeaderProps) {
  return (
    <header className={`bg-sz-bg-secondary border-b border-sz-border ${compact ? 'px-4 py-3' : 'px-6 py-4'} ${className}`}>
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          {icon && (
            <div className="w-9 h-9 rounded-sz bg-sz-accent-muted flex items-center justify-center flex-shrink-0">
              <span className="text-sz-accent">{icon}</span>
            </div>
          )}
          <div className="min-w-0">
            <h1 className={`font-semibold text-sz-text truncate ${compact ? 'text-base' : 'text-lg'}`}>
              {title}
            </h1>
            {subtitle && (
              <p className="text-sm text-sz-text-secondary truncate mt-0.5">{subtitle}</p>
            )}
          </div>
        </div>

        {actions && (
          <div className="flex items-center gap-2 flex-shrink-0">
            {actions}
          </div>
        )}
      </div>

      {children && (
        <div className="mt-4">
          {children}
        </div>
      )}
    </header>
  );
}

export default memo(PageHeader);

// Panel header for sidebar panels
export interface PanelHeaderProps {
  title: string;
  action?: ReactNode;
  className?: string;
}

export const PanelHeader = memo(function PanelHeader({
  title,
  action,
  className = '',
}: PanelHeaderProps) {
  return (
    <div className={`flex items-center justify-between px-4 py-3 border-b border-sz-border ${className}`}>
      <h2 className="text-xs font-semibold text-sz-text-secondary uppercase tracking-wider">
        {title}
      </h2>
      {action}
    </div>
  );
});

// Section within a panel
export interface PanelSectionProps {
  title?: string;
  children: ReactNode;
  className?: string;
  noPadding?: boolean;
}

export const PanelSection = memo(function PanelSection({
  title,
  children,
  className = '',
  noPadding = false,
}: PanelSectionProps) {
  return (
    <div className={`${noPadding ? '' : 'p-4'} ${className}`}>
      {title && (
        <h3 className="text-[10px] font-semibold text-sz-text-muted uppercase tracking-wider mb-3">
          {title}
        </h3>
      )}
      {children}
    </div>
  );
});
