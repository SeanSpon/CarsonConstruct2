import { memo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { IconButton } from '../ui';

export interface TrimControlsProps {
  trimStartOffset: number;
  trimEndOffset: number;
  onTrimStart: (delta: number) => void;
  onTrimEnd: (delta: number) => void;
  step?: number;
  compact?: boolean;
}

function TrimControls({
  trimStartOffset,
  trimEndOffset,
  onTrimStart,
  onTrimEnd,
  step = 5,
  compact = false,
}: TrimControlsProps) {
  if (compact) {
    return (
      <div className="flex items-center gap-4">
        <TrimControl
          label="Start"
          value={trimStartOffset}
          onDecrease={() => onTrimStart(-step)}
          onIncrease={() => onTrimStart(step)}
          compact
        />
        <TrimControl
          label="End"
          value={trimEndOffset}
          onDecrease={() => onTrimEnd(-step)}
          onIncrease={() => onTrimEnd(step)}
          compact
        />
      </div>
    );
  }

  return (
    <div className="flex items-center gap-8">
      <TrimControl
        label="Trim Start"
        value={trimStartOffset}
        onDecrease={() => onTrimStart(-step)}
        onIncrease={() => onTrimStart(step)}
      />
      <TrimControl
        label="Trim End"
        value={trimEndOffset}
        onDecrease={() => onTrimEnd(-step)}
        onIncrease={() => onTrimEnd(step)}
      />
    </div>
  );
}

interface TrimControlProps {
  label: string;
  value: number;
  onDecrease: () => void;
  onIncrease: () => void;
  compact?: boolean;
}

function TrimControl({ label, value, onDecrease, onIncrease, compact }: TrimControlProps) {
  return (
    <div className="flex items-center gap-1.5">
      <span className={`text-sz-text-muted ${compact ? 'text-[10px] w-6' : 'text-xs w-16'}`}>
        {label}
      </span>
      <IconButton
        icon={<ChevronLeft className={compact ? 'w-3 h-3' : 'w-4 h-4'} />}
        size={compact ? 'xs' : 'sm'}
        variant="ghost"
        onClick={onDecrease}
        tooltip={`Decrease ${label.toLowerCase()}`}
      />
      <span className={`text-sz-text-secondary tabular-nums text-center ${compact ? 'text-[10px] w-8' : 'text-xs w-12'}`}>
        {value >= 0 ? '+' : ''}{value}s
      </span>
      <IconButton
        icon={<ChevronRight className={compact ? 'w-3 h-3' : 'w-4 h-4'} />}
        size={compact ? 'xs' : 'sm'}
        variant="ghost"
        onClick={onIncrease}
        tooltip={`Increase ${label.toLowerCase()}`}
      />
    </div>
  );
}

export default memo(TrimControls);
