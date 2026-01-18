import { useState } from 'react';
import { Check, X, Minus, Plus, Play, Flame } from 'lucide-react';
import type { Clip } from '../types';
import { formatTimestamp, getScoreLabel, getScoreColor } from '../types';
import { useStore } from '../stores/store';

interface ClipCardProps {
  clip: Clip;
  videoPath: string;
}

export default function ClipCard({ clip, videoPath }: ClipCardProps) {
  const { updateClipStatus, updateClipTrim } = useStore();
  const [isPlaying, setIsPlaying] = useState(false);

  const handleAccept = () => {
    updateClipStatus(clip.id, clip.status === 'accepted' ? 'pending' : 'accepted');
  };

  const handleReject = () => {
    updateClipStatus(clip.id, clip.status === 'rejected' ? 'pending' : 'rejected');
  };

  const handleTrimStart = (delta: number) => {
    const newOffset = clip.trimStartOffset + delta;
    // Don't allow trim to go past clip boundaries
    if (clip.startTime + newOffset >= 0 && newOffset < clip.duration) {
      updateClipTrim(clip.id, newOffset, clip.trimEndOffset);
    }
  };

  const handleTrimEnd = (delta: number) => {
    const newOffset = clip.trimEndOffset + delta;
    // Don't allow end to go before start
    if (newOffset > -clip.duration + 5) {
      updateClipTrim(clip.id, clip.trimStartOffset, newOffset);
    }
  };

  const actualStart = clip.startTime + clip.trimStartOffset;
  const actualEnd = clip.endTime + clip.trimEndOffset;
  const actualDuration = actualEnd - actualStart;

  const scoreLabel = getScoreLabel(clip.finalScore);
  const scoreColor = getScoreColor(clip.finalScore);

  // Pattern colors
  const patternColors = {
    payoff: 'bg-violet-500/20 text-violet-400 border-violet-500/30',
    monologue: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    laughter: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    debate: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  };

  const patternColor = patternColors[clip.pattern] || patternColors.payoff;

  return (
    <div 
      className={`
        relative rounded-xl border bg-zinc-900/80 overflow-hidden transition-all
        ${clip.status === 'accepted' ? 'border-emerald-500/50 ring-1 ring-emerald-500/20' : ''}
        ${clip.status === 'rejected' ? 'border-red-500/30 opacity-50' : ''}
        ${clip.status === 'pending' ? 'border-zinc-800 hover:border-zinc-700' : ''}
      `}
    >
      {/* Video Preview Area */}
      <div className="relative aspect-video bg-zinc-950 flex items-center justify-center group">
        <button 
          onClick={() => setIsPlaying(!isPlaying)}
          className="w-14 h-14 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
        >
          <Play className="w-6 h-6 text-white ml-1" fill="white" />
        </button>
        
        {/* Score Badge */}
        <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-sm">
          <Flame className={`w-4 h-4 ${scoreColor}`} />
          <span className={`text-sm font-bold ${scoreColor}`}>{Math.round(clip.finalScore)}%</span>
        </div>

        {/* Duration Badge */}
        <div className="absolute top-3 right-3 px-2 py-1 rounded bg-black/60 backdrop-blur-sm text-xs text-zinc-300">
          {Math.round(actualDuration)}s
        </div>

        {/* Status indicator */}
        {clip.status === 'accepted' && (
          <div className="absolute bottom-3 right-3 w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center">
            <Check className="w-5 h-5 text-white" />
          </div>
        )}
        {clip.status === 'rejected' && (
          <div className="absolute bottom-3 right-3 w-8 h-8 rounded-full bg-red-500 flex items-center justify-center">
            <X className="w-5 h-5 text-white" />
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4">
        {/* Pattern Badge + Category */}
        <div className="flex items-center gap-2 mb-2">
          <span className={`px-2 py-0.5 text-xs font-medium rounded border ${patternColor}`}>
            {clip.patternLabel}
          </span>
          {clip.category && (
            <span className="px-2 py-0.5 text-xs font-medium rounded bg-zinc-800 text-zinc-400">
              {clip.category}
            </span>
          )}
        </div>

        {/* Title (AI generated) or Description */}
        <h3 className="text-sm font-semibold text-zinc-100 mb-1 line-clamp-2">
          {clip.title || clip.description}
        </h3>

        {/* Hook text (AI generated) */}
        {clip.hookText && (
          <p className="text-xs text-violet-400 italic mb-2">"{clip.hookText}"</p>
        )}

        {/* Score label */}
        <p className={`text-xs ${scoreColor} mb-2`}>{scoreLabel}</p>

        {/* Quality indicators (AI) */}
        {(clip.isComplete !== undefined || clip.startsClean !== undefined) && (
          <div className="flex gap-1.5 mb-2">
            {clip.isComplete && (
              <span className="px-1.5 py-0.5 bg-emerald-500/10 text-emerald-400 text-[10px] rounded">
                Complete
              </span>
            )}
            {clip.startsClean && clip.endsClean && (
              <span className="px-1.5 py-0.5 bg-blue-500/10 text-blue-400 text-[10px] rounded">
                Clean
              </span>
            )}
          </div>
        )}

        {/* Timestamp */}
        <p className="text-xs text-zinc-500 mb-3">
          {formatTimestamp(actualStart)} – {formatTimestamp(actualEnd)}
        </p>

        {/* Transcript preview */}
        {clip.transcript && (
          <p className="text-xs text-zinc-500 line-clamp-2 mb-3 italic">
            "{clip.transcript}"
          </p>
        )}

        {/* Trim controls */}
        <div className="flex items-center gap-3 mb-4">
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-zinc-500 w-8">Start</span>
            <button
              onClick={() => handleTrimStart(-5)}
              className="w-6 h-6 rounded bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center"
            >
              <Minus className="w-3 h-3 text-zinc-400" />
            </button>
            <span className="text-xs text-zinc-400 w-10 text-center">
              {clip.trimStartOffset > 0 ? '+' : ''}{clip.trimStartOffset}s
            </span>
            <button
              onClick={() => handleTrimStart(5)}
              className="w-6 h-6 rounded bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center"
            >
              <Plus className="w-3 h-3 text-zinc-400" />
            </button>
          </div>

          <div className="flex items-center gap-1">
            <span className="text-[10px] text-zinc-500 w-6">End</span>
            <button
              onClick={() => handleTrimEnd(-5)}
              className="w-6 h-6 rounded bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center"
            >
              <Minus className="w-3 h-3 text-zinc-400" />
            </button>
            <span className="text-xs text-zinc-400 w-10 text-center">
              {clip.trimEndOffset > 0 ? '+' : ''}{clip.trimEndOffset}s
            </span>
            <button
              onClick={() => handleTrimEnd(5)}
              className="w-6 h-6 rounded bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center"
            >
              <Plus className="w-3 h-3 text-zinc-400" />
            </button>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2">
          <button
            onClick={handleAccept}
            className={`
              flex-1 py-2.5 rounded-lg font-medium text-sm flex items-center justify-center gap-2 transition-colors
              ${clip.status === 'accepted' 
                ? 'bg-emerald-600 text-white' 
                : 'bg-zinc-800 hover:bg-emerald-600/20 text-zinc-300 hover:text-emerald-400'
              }
            `}
          >
            <Check className="w-4 h-4" />
            Accept
          </button>
          <button
            onClick={handleReject}
            className={`
              flex-1 py-2.5 rounded-lg font-medium text-sm flex items-center justify-center gap-2 transition-colors
              ${clip.status === 'rejected' 
                ? 'bg-red-600 text-white' 
                : 'bg-zinc-800 hover:bg-red-600/20 text-zinc-300 hover:text-red-400'
              }
            `}
          >
            <X className="w-4 h-4" />
            Reject
          </button>
        </div>
      </div>
    </div>
  );
}
