import { memo } from 'react';

interface SliderInputProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  showValue?: boolean;
  className?: string;
}

function SliderInput({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  showValue = true,
  className = '',
}: SliderInputProps) {
  const percentage = ((value - min) / (max - min)) * 100;

  return (
    <div className={className}>
      <div className="flex items-center justify-between mb-2">
        <label className="text-xs font-medium text-sz-text-secondary">{label}</label>
        {showValue && (
          <span className="text-sm font-semibold text-sz-text tabular-nums">{value}</span>
        )}
      </div>
      <div className="relative">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(parseInt(e.target.value, 10))}
          className="w-full h-1.5 bg-sz-bg-hover rounded-full appearance-none cursor-pointer"
          style={{
            background: `linear-gradient(to right, #DC2626 ${percentage}%, #21262D ${percentage}%)`,
          }}
        />
      </div>
      <div className="flex justify-between mt-1">
        <span className="text-[10px] text-sz-text-muted">{min}</span>
        <span className="text-[10px] text-sz-text-muted">{max}</span>
      </div>
    </div>
  );
}

export default memo(SliderInput);
