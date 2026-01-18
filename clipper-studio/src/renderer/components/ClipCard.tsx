import { useRef, useState } from 'react';
import { Play, Pause, Check, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { useProjectStore } from '../stores/projectStore';
import { DetectedClip, PATTERN_INFO, formatTime, ViralPattern } from '../types';

interface ClipCardProps {
  clip: DetectedClip;
  videoPath: string;
}

export default function ClipCard({ clip, videoPath }: ClipCardProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const { updateClipStatus, updateClipTrim } = useProjectStore();

  const actualStart = clip.startTime + clip.trimStartOffset;
  const actualEnd = clip.endTime + clip.trimEndOffset;
  const duration = actualEnd - actualStart;

  // Get pattern info with fallback
  const patternInfo = PATTERN_INFO[clip.pattern as ViralPattern] || {
    label: clip.patternLabel || 'Clip',
    description: clip.description || '',
    emoji: '📍',
  };

  const togglePlay = () => {
    if (!videoRef.current) return;

    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    } else {
      videoRef.current.currentTime = actualStart;
      videoRef.current.play();
      setIsPlaying(true);
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current && videoRef.current.currentTime >= actualEnd) {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  };

  const handleTrimStart = (delta: number) => {
    const newOffset = clip.trimStartOffset + delta;
    const minAllowed = -clip.startTime; // Can't go before 0
    const maxAllowed = clip.endTime + clip.trimEndOffset - clip.startTime - 5; // At least 5s duration
    
    if (newOffset >= minAllowed && newOffset < maxAllowed) {
      updateClipTrim(clip.id, newOffset, clip.trimEndOffset);
    }
  };

  const handleTrimEnd = (delta: number) => {
    const newOffset = clip.trimEndOffset + delta;
    const minAllowed = clip.trimStartOffset - (clip.endTime - clip.startTime) + 5; // At least 5s duration
    
    if (newOffset > minAllowed) {
      updateClipTrim(clip.id, clip.trimStartOffset, newOffset);
    }
  };

  // Score badge styling
  const getScoreBadge = (score: number) => {
    if (score >= 80) return { emoji: '🔥', color: 'text-orange-400', bg: 'bg-orange-500/10' };
    if (score >= 60) return { emoji: '⚡', color: 'text-yellow-400', bg: 'bg-yellow-500/10' };
    return { emoji: '🤔', color: 'text-zinc-400', bg: 'bg-zinc-500/10' };
  };

  const scoreBadge = getScoreBadge(clip.score);

  // Status styling
  const getStatusStyles = () => {
    switch (clip.status) {
      case 'accepted':
        return 'ring-2 ring-emerald-500/50 bg-emerald-500/5';
      case 'rejected':
        return 'opacity-50';
      default:
        return '';
    }
  };

  // Hook strength display
  const hookStrengthWidth = Math.max(0, Math.min(100, clip.hookStrength || 50));
  const hookStrengthLabel = (clip.hookStrength || 50) >= 65 ? 'Strong' : (clip.hookStrength || 50) >= 35 ? 'Medium' : 'Weak';
  const hookStrengthColor = (clip.hookStrength || 50) >= 65 ? 'bg-emerald-500' : (clip.hookStrength || 50) >= 35 ? 'bg-yellow-500' : 'bg-red-500';

  return (
    <div className={`bg-zinc-900 rounded-xl overflow-hidden transition-all ${getStatusStyles()}`}>
      {/* Video Preview */}
      <div className="relative aspect-video bg-black">
        <video
          ref={videoRef}
          src={videoPath}
          className="w-full h-full object-cover"
          onTimeUpdate={handleTimeUpdate}
          onEnded={() => setIsPlaying(false)}
          onLoadedMetadata={() => {
            if (videoRef.current) {
              videoRef.current.currentTime = actualStart;
            }
          }}
          preload="metadata"
        />
        
        {/* Play/Pause overlay */}
        <button
          onClick={togglePlay}
          className="absolute inset-0 flex items-center justify-center bg-black/30 hover:bg-black/40 transition-colors"
        >
          {isPlaying ? (
            <Pause className="w-14 h-14 text-white drop-shadow-lg" />
          ) : (
            <Play className="w-14 h-14 text-white drop-shadow-lg" />
          )}
        </button>

        {/* Score badge */}
        <div className={`absolute top-3 left-3 px-3 py-1.5 rounded-lg ${scoreBadge.bg} flex items-center gap-1.5`}>
          <span className="text-lg">{scoreBadge.emoji}</span>
          <span className={`text-sm font-bold ${scoreBadge.color}`}>{Math.round(clip.score)}%</span>
        </div>

        {/* Duration badge */}
        <div className="absolute bottom-3 right-3 px-2 py-1 rounded bg-black/70 text-white text-sm font-medium">
          {formatTime(duration)}
        </div>

        {/* Status indicator */}
        {clip.status === 'accepted' && (
          <div className="absolute top-3 right-3 w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center">
            <Check className="w-5 h-5 text-white" />
          </div>
        )}
        {clip.status === 'rejected' && (
          <div className="absolute top-3 right-3 w-8 h-8 rounded-full bg-red-500 flex items-center justify-center">
            <X className="w-5 h-5 text-white" />
          </div>
        )}
      </div>

      {/* Clip Info */}
      <div className="p-4">
        {/* Pattern info */}
        <div className="flex items-center gap-2 mb-1">
          <span className="text-lg">{patternInfo.emoji}</span>
          <span className="font-semibold text-zinc-100">{patternInfo.label}</span>
        </div>
        <p className="text-sm text-zinc-500 mb-3">{clip.description || patternInfo.description}</p>

        {/* Timestamp */}
        <div className="text-sm text-zinc-400 mb-3">
          {formatTime(actualStart)} → {formatTime(actualEnd)}
        </div>

        {/* Hook Strength */}
        <div className="mb-4">
          <div className="flex items-center justify-between text-xs text-zinc-500 mb-1">
            <span>Hook Strength</span>
            <span className={(clip.hookStrength || 50) >= 65 ? 'text-emerald-400' : (clip.hookStrength || 50) >= 35 ? 'text-yellow-400' : 'text-red-400'}>
              {hookStrengthLabel}
            </span>
          </div>
          <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
            <div 
              className={`h-full ${hookStrengthColor} transition-all`}
              style={{ width: `${hookStrengthWidth}%` }}
            />
          </div>
        </div>

        {/* Trim Controls */}
        <div className="flex items-center justify-between mb-4 text-sm">
          <div className="flex items-center gap-1">
            <button
              onClick={() => handleTrimStart(-5)}
              className="p-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-400 transition-colors"
              title="Start 5s earlier"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => handleTrimStart(5)}
              className="p-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-400 transition-colors"
              title="Start 5s later"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <span className="text-zinc-600 ml-1">Start</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-zinc-600 mr-1">End</span>
            <button
              onClick={() => handleTrimEnd(-5)}
              className="p-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-400 transition-colors"
              title="End 5s earlier"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => handleTrimEnd(5)}
              className="p-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-400 transition-colors"
              title="End 5s later"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2">
          <button
            onClick={() => updateClipStatus(clip.id, 'accepted')}
            className={`flex-1 py-2.5 px-4 rounded-lg font-medium flex items-center justify-center gap-2 transition-colors ${
              clip.status === 'accepted'
                ? 'bg-emerald-500 text-white'
                : 'bg-zinc-800 text-zinc-300 hover:bg-emerald-500/20 hover:text-emerald-400'
            }`}
          >
            <Check className="w-4 h-4" />
            Accept
          </button>
          <button
            onClick={() => updateClipStatus(clip.id, 'rejected')}
            className={`flex-1 py-2.5 px-4 rounded-lg font-medium flex items-center justify-center gap-2 transition-colors ${
              clip.status === 'rejected'
                ? 'bg-red-500 text-white'
                : 'bg-zinc-800 text-zinc-300 hover:bg-red-500/20 hover:text-red-400'
            }`}
          >
            <X className="w-4 h-4" />
            Reject
          </button>
        </div>
      </div>
    </div>
  );
}
