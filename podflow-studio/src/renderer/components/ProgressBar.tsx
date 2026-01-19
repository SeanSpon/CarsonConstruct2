import { memo } from 'react';

interface ProgressBarProps {
  percent: number;
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'success' | 'danger';
  className?: string;
}

function ProgressBar({ 
  percent, 
  showLabel = false, 
  size = 'md',
  variant = 'default',
  className = '' 
}: ProgressBarProps) {
  const normalizedPercent = Math.min(100, Math.max(0, percent));
  
  const sizeClasses = {
    sm: 'h-1',
    md: 'h-1.5',
    lg: 'h-2',
  };

  const variantClasses = {
    default: 'bg-sz-accent',
    success: 'bg-sz-success',
    danger: 'bg-sz-danger',
  };

  return (
    <div className={className}>
      <div className={`w-full bg-sz-bg-hover rounded-full overflow-hidden ${sizeClasses[size]}`}>
        <div
          className={`h-full ${variantClasses[variant]} rounded-full transition-all duration-300 ease-out`}
          style={{ width: `${normalizedPercent}%` }}
        />
      </div>
      {showLabel && (
        <div className="flex justify-between mt-1">
          <span className="text-[10px] text-sz-text-muted">Progress</span>
          <span className="text-[10px] text-sz-text-secondary tabular-nums">{Math.round(normalizedPercent)}%</span>
        </div>
      )}
    </div>
  );
}

export default memo(ProgressBar);
