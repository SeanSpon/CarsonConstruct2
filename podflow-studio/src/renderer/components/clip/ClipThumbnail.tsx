import { memo, useState } from 'react';
import { Play, Check, X } from 'lucide-react';
import type { Clip } from '../../types';
import { ScoreBadge } from '../ui';

export interface ClipThumbnailProps {
  clip: Clip;
  actualDuration: number;
}

function ClipThumbnail({ clip, actualDuration }: ClipThumbnailProps) {
  const [isPlaying, setIsPlaying] = useState(false);

  return (
    <div className="relative aspect-video bg-sz-bg flex items-center justify-center group overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-sz-bg-tertiary to-sz-bg" />
      
      {/* Play button */}
      <button
        onClick={() => setIsPlaying(!isPlaying)}
        className="relative w-12 h-12 rounded-full bg-sz-bg-hover/80 backdrop-blur-sm flex items-center justify-center transition-all duration-200 group-hover:scale-110 group-hover:bg-sz-accent"
      >
        <Play className="w-5 h-5 text-sz-text group-hover:text-sz-bg ml-0.5" fill="currentColor" />
      </button>

      {/* Score Badge */}
      <div className="absolute top-2 left-2">
        <ScoreBadge score={clip.finalScore || clip.score} size="sm" />
      </div>

      {/* Duration Badge */}
      <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded bg-black/70 backdrop-blur-sm text-[10px] text-white font-medium tabular-nums">
        {Math.round(actualDuration)}s
      </div>

      {/* Status indicator */}
      {clip.status === 'accepted' && (
        <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-sz-success flex items-center justify-center shadow-lg">
          <Check className="w-3.5 h-3.5 text-white" />
        </div>
      )}
      {clip.status === 'rejected' && (
        <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-sz-danger flex items-center justify-center">
          <X className="w-3.5 h-3.5 text-white" />
        </div>
      )}
    </div>
  );
}

export default memo(ClipThumbnail);
