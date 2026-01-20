import { memo } from 'react';
import { Check, X, Clock } from 'lucide-react';
import type { Clip } from '../../types';
import { formatDuration } from '../../types';

interface ClipThumbnailProps {
  clip: Clip;
  isSelected: boolean;
  onClick: () => void;
}

// Pattern to color mapping
const patternColors: Record<string, string> = {
  payoff: 'border-[#00D9FF]',
  monologue: 'border-[#A855F7]',
  laughter: 'border-[#FACC15]',
  debate: 'border-[#F97316]',
};

const patternBgColors: Record<string, string> = {
  payoff: 'bg-[#00D9FF]',
  monologue: 'bg-[#A855F7]',
  laughter: 'bg-[#FACC15]',
  debate: 'bg-[#F97316]',
};

// Fallback pattern labels (short form for thumbnails)
const patternLabelsFallback: Record<string, string> = {
  payoff: 'Payoff',
  monologue: 'Mono',
  laughter: 'Laugh',
  debate: 'Debate',
};

function ClipThumbnail({ clip, isSelected, onClick }: ClipThumbnailProps) {
  const actualDuration = (clip.endTime - clip.startTime) + clip.trimStartOffset - clip.trimEndOffset;

  return (
    <button
      onClick={onClick}
      className={`
        flex-shrink-0 w-32 h-full rounded-sz overflow-hidden
        border-2 transition-all duration-150 group
        ${isSelected
          ? `${patternColors[clip.pattern] || 'border-sz-accent'} ring-2 ring-white/20 scale-[1.02]`
          : 'border-sz-border hover:border-sz-border-light'
        }
        ${clip.status === 'rejected' ? 'opacity-50' : ''}
      `}
    >
      {/* Thumbnail area */}
      <div className="relative aspect-video bg-sz-bg">
        {/* Gradient placeholder */}
        <div className={`
          absolute inset-0 opacity-30
          ${patternBgColors[clip.pattern] || 'bg-sz-accent'}
        `} />
        
        {/* Score badge */}
        <div className="absolute top-1 right-1 px-1.5 py-0.5 bg-black/80 rounded text-[10px] font-bold text-white">
          {Math.round(clip.finalScore)}
        </div>

        {/* Status indicator */}
        {clip.status === 'accepted' && (
          <div className="absolute top-1 left-1 w-4 h-4 bg-sz-success rounded-full flex items-center justify-center">
            <Check className="w-2.5 h-2.5 text-white" />
          </div>
        )}
        {clip.status === 'rejected' && (
          <div className="absolute top-1 left-1 w-4 h-4 bg-sz-danger rounded-full flex items-center justify-center">
            <X className="w-2.5 h-2.5 text-white" />
          </div>
        )}
        {clip.status === 'pending' && (
          <div className="absolute top-1 left-1 w-4 h-4 bg-sz-warning rounded-full flex items-center justify-center">
            <span className="text-[8px] font-bold text-white">?</span>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-2 bg-sz-bg-tertiary">
        {/* Title - display actual clip title if available */}
        {clip.title && (
          <div className={`
            text-[10px] font-medium truncate mb-0.5
            ${isSelected ? 'text-sz-text' : 'text-sz-text-secondary'}
          `} title={clip.title}>
            {clip.title}
          </div>
        )}
        
        {/* Duration + Pattern */}
        <div className="flex items-center gap-1.5 text-[10px] text-sz-text-muted">
          <div className="flex items-center gap-0.5">
            <Clock className="w-2.5 h-2.5" />
            {formatDuration(actualDuration)}
          </div>
          <span className="text-sz-text-muted/50">·</span>
          <span className={`truncate ${patternColors[clip.pattern]?.replace('border-', 'text-') || 'text-sz-accent'}`}>
            {clip.patternLabel || patternLabelsFallback[clip.pattern] || clip.pattern}
          </span>
        </div>
      </div>
    </button>
  );
}

export default memo(ClipThumbnail);
