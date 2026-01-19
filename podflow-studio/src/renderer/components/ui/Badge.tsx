import { forwardRef, type HTMLAttributes } from 'react';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'accent' | 'success' | 'danger' | 'warning' | 'muted';
  size?: 'sm' | 'md';
}

const variants = {
  default: 'bg-sz-bg-hover text-sz-text-secondary',
  accent: 'bg-sz-accent-muted text-sz-accent',
  success: 'bg-sz-success-muted text-sz-success',
  danger: 'bg-sz-danger-muted text-sz-danger',
  warning: 'bg-sz-warning-muted text-sz-warning',
  muted: 'bg-sz-bg-tertiary text-sz-text-muted',
};

const sizes = {
  sm: 'px-1.5 py-0.5 text-[10px]',
  md: 'px-2 py-0.5 text-xs',
};

const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  ({ variant = 'default', size = 'md', className = '', children, ...props }, ref) => {
    return (
      <span
        ref={ref}
        className={`
          inline-flex items-center gap-1 font-medium rounded
          ${variants[variant]}
          ${sizes[size]}
          ${className}
        `}
        {...props}
      >
        {children}
      </span>
    );
  }
);

Badge.displayName = 'Badge';

// Pattern badge for clip categories
export interface PatternBadgeProps {
  pattern: string;
  className?: string;
}

const patternColors: Record<string, { bg: string; text: string }> = {
  hook: { bg: 'bg-purple-500/20', text: 'text-purple-400' },
  payoff: { bg: 'bg-amber-500/20', text: 'text-amber-400' },
  monologue: { bg: 'bg-blue-500/20', text: 'text-blue-400' },
  debate: { bg: 'bg-rose-500/20', text: 'text-rose-400' },
  laughter: { bg: 'bg-emerald-500/20', text: 'text-emerald-400' },
  silence: { bg: 'bg-slate-500/20', text: 'text-slate-400' },
  default: { bg: 'bg-sz-bg-hover', text: 'text-sz-text-secondary' },
};

export function PatternBadge({ pattern, className = '' }: PatternBadgeProps) {
  const colors = patternColors[pattern.toLowerCase()] || patternColors.default;
  
  return (
    <span
      className={`
        inline-flex items-center px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide rounded
        ${colors.bg} ${colors.text}
        ${className}
      `}
    >
      {pattern}
    </span>
  );
}

// Status badge for clip status
export interface StatusBadgeProps {
  status: 'pending' | 'accepted' | 'rejected';
  className?: string;
}

export function StatusBadge({ status, className = '' }: StatusBadgeProps) {
  const statusStyles = {
    pending: 'bg-sz-bg-hover text-sz-text-secondary',
    accepted: 'bg-sz-success-muted text-sz-success',
    rejected: 'bg-sz-danger-muted text-sz-danger',
  };

  return (
    <span
      className={`
        inline-flex items-center px-2 py-0.5 text-xs font-medium rounded
        ${statusStyles[status]}
        ${className}
      `}
    >
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

// Score badge with visual indicator
export interface ScoreBadgeProps {
  score: number;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  className?: string;
}

export function ScoreBadge({ score, size = 'md', showLabel = false, className = '' }: ScoreBadgeProps) {
  const getScoreColor = (s: number) => {
    if (s >= 80) return { bg: 'bg-sz-success-muted', text: 'text-sz-success', ring: 'ring-sz-success/30' };
    if (s >= 60) return { bg: 'bg-sz-accent-muted', text: 'text-sz-accent', ring: 'ring-sz-accent/30' };
    if (s >= 40) return { bg: 'bg-sz-warning-muted', text: 'text-sz-warning', ring: 'ring-sz-warning/30' };
    return { bg: 'bg-sz-bg-hover', text: 'text-sz-text-secondary', ring: 'ring-sz-border' };
  };

  const colors = getScoreColor(score);
  
  const sizeStyles = {
    sm: 'w-7 h-7 text-[10px]',
    md: 'w-9 h-9 text-xs',
    lg: 'w-12 h-12 text-sm',
  };

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div
        className={`
          ${sizeStyles[size]}
          rounded-full flex items-center justify-center font-bold
          ${colors.bg} ${colors.text} ring-1 ${colors.ring}
        `}
      >
        {Math.round(score)}
      </div>
      {showLabel && (
        <span className="text-xs text-sz-text-secondary">Score</span>
      )}
    </div>
  );
}

export default Badge;
