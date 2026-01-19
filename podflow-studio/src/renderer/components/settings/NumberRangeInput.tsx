import { memo } from 'react';

interface NumberRangeInputProps {
  label: string;
  minValue: number;
  maxValue: number;
  onMinChange: (value: number) => void;
  onMaxChange: (value: number) => void;
  minLimit: number;
  maxLimit: number;
  minLabel?: string;
  maxLabel?: string;
  className?: string;
}

function NumberRangeInput({
  label,
  minValue,
  maxValue,
  onMinChange,
  onMaxChange,
  minLimit,
  maxLimit,
  minLabel = 'Min',
  maxLabel = 'Max',
  className = '',
}: NumberRangeInputProps) {
  return (
    <div className={className}>
      <label className="block text-xs font-medium text-sz-text-secondary mb-2">{label}</label>
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <div className="text-[10px] text-sz-text-muted mb-1">{minLabel}</div>
          <input
            type="number"
            min={minLimit}
            max={maxValue - 1}
            value={minValue}
            onChange={(e) => onMinChange(parseInt(e.target.value, 10) || minLimit)}
            className="w-full px-3 py-1.5 bg-sz-bg rounded-sz text-sz-text text-sm border border-sz-border focus:border-sz-accent focus:outline-none focus:ring-1 focus:ring-sz-accent/30 tabular-nums"
          />
        </div>
        <div className="text-sz-text-muted text-xs mt-4">to</div>
        <div className="flex-1">
          <div className="text-[10px] text-sz-text-muted mb-1">{maxLabel}</div>
          <input
            type="number"
            min={minValue + 1}
            max={maxLimit}
            value={maxValue}
            onChange={(e) => onMaxChange(parseInt(e.target.value, 10) || maxLimit)}
            className="w-full px-3 py-1.5 bg-sz-bg rounded-sz text-sz-text text-sm border border-sz-border focus:border-sz-accent focus:outline-none focus:ring-1 focus:ring-sz-accent/30 tabular-nums"
          />
        </div>
      </div>
    </div>
  );
}

export default memo(NumberRangeInput);
