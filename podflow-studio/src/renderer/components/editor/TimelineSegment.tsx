import { memo, useMemo } from 'react';
import type { Clip } from '../../types';

interface TimelineSegmentProps {
  clip: Clip;
  duration: number;
  isSelected: boolean;
  onClick: () => void;
}

// Pattern to color mapping
const patternColors: Record<string, { bg: string; border: string; text: string }> = {
  payoff: {
    bg: 'bg-sz-pattern-payoff/40',
    border: 'border-sz-pattern-payoff',
    text: 'text-sz-pattern-payoff',
  },
  monologue: {
    bg: 'bg-sz-pattern-monologue/40',
    border: 'border-sz-pattern-monologue',
    text: 'text-sz-pattern-monologue',
  },
  laughter: {
    bg: 'bg-sz-pattern-laughter/40',
    border: 'border-sz-pattern-laughter',
    text: 'text-sz-pattern-laughter',
  },
  debate: {
    bg: 'bg-sz-pattern-debate/40',
    border: 'border-sz-pattern-debate',
    text: 'text-sz-pattern-debate',
  },
};

function TimelineSegment({ clip, duration, isSelected, onClick }: TimelineSegmentProps) {
  // Calculate position and width
  const style = useMemo(() => {
    const startPercent = (clip.startTime / duration) * 100;
    const widthPercent = ((clip.endTime - clip.startTime) / duration) * 100;
    
    return {
      left: `${startPercent}%`,
      width: `${Math.max(0.5, widthPercent)}%`, // Minimum width for visibility
    };
  }, [clip.startTime, clip.endTime, duration]);

  // Get colors based on pattern
  const colors = patternColors[clip.pattern] || patternColors.payoff;

  return (
    <button
      onClick={onClick}
      className={`
        absolute top-4 bottom-4 rounded-sm border-2 transition-all duration-150
        hover:scale-y-110 hover:z-10 group
        ${colors.bg} ${colors.border}
        ${isSelected 
          ? 'ring-2 ring-white/50 scale-y-110 z-10' 
          : 'opacity-80 hover:opacity-100'
        }
      `}
      style={style}
      title={clip.title || `${clip.pattern} clip`}
    >
      {/* Score badge */}
      <div className={`
        absolute -top-2 right-0 px-1 py-0.5 rounded text-[8px] font-bold
        bg-sz-bg border ${colors.border} ${colors.text}
        opacity-0 group-hover:opacity-100 transition-opacity
      `}>
        {Math.round(clip.finalScore)}
      </div>

      {/* Status indicator */}
      {clip.status === 'accepted' && (
        <div className="absolute -top-1 -left-1 w-2.5 h-2.5 bg-sz-success rounded-full border border-sz-bg" />
      )}
      {clip.status === 'rejected' && (
        <div className="absolute -top-1 -left-1 w-2.5 h-2.5 bg-sz-danger rounded-full border border-sz-bg" />
      )}
    </button>
  );
}

export default memo(TimelineSegment);
