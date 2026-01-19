import { memo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, X, Play, Clock, ChevronLeft, ChevronRight } from 'lucide-react';
import type { Clip } from '../../types';
import { useStore } from '../../stores/store';
import { formatDuration } from '../../types';
import { ScoreBadge, PatternBadge, IconButton, Button } from '../ui';

export interface ClipCardProps {
  clip: Clip;
  videoPath: string;
}

function ClipCard({ clip, videoPath }: ClipCardProps) {
  const navigate = useNavigate();
  const { updateClipStatus, updateClipTrim, lastJobId } = useStore();

  const actualStart = clip.startTime + clip.trimStartOffset;
  const actualEnd = clip.endTime + clip.trimEndOffset;
  const actualDuration = actualEnd - actualStart;

  const handleAccept = useCallback(() => {
    updateClipStatus(clip.id, clip.status === 'accepted' ? 'pending' : 'accepted');
  }, [clip.id, clip.status, updateClipStatus]);

  const handleReject = useCallback(() => {
    updateClipStatus(clip.id, clip.status === 'rejected' ? 'pending' : 'rejected');
  }, [clip.id, clip.status, updateClipStatus]);

  const handleReview = useCallback(() => {
    if (!lastJobId) {
      window.alert('Please run detection before opening Review Mode.');
      return;
    }
    navigate(`/review/${clip.id}?job=${lastJobId}`);
  }, [clip.id, lastJobId, navigate]);

  const handleTrimStart = useCallback((delta: number) => {
    const newOffset = clip.trimStartOffset + delta;
    if (clip.startTime + newOffset >= 0 && newOffset < clip.duration) {
      updateClipTrim(clip.id, newOffset, clip.trimEndOffset);
    }
  }, [clip.id, clip.startTime, clip.duration, clip.trimStartOffset, clip.trimEndOffset, updateClipTrim]);

  const handleTrimEnd = useCallback((delta: number) => {
    const newOffset = clip.trimEndOffset + delta;
    if (newOffset > -clip.duration + 5) {
      updateClipTrim(clip.id, clip.trimStartOffset, newOffset);
    }
  }, [clip.id, clip.duration, clip.trimStartOffset, clip.trimEndOffset, updateClipTrim]);

  return (
    <div
      className={`
        group relative rounded-sz-lg border overflow-hidden transition-all duration-200
        ${clip.status === 'accepted' 
          ? 'border-sz-success/50 bg-sz-success-muted/30 shadow-sm shadow-sz-success/10' 
          : clip.status === 'rejected'
            ? 'border-sz-border opacity-50'
            : 'border-sz-border bg-sz-bg-secondary hover:border-sz-accent/30 hover:shadow-sz-glow'
        }
      `}
    >
      {/* Thumbnail / Preview Area */}
      <div className="relative aspect-video bg-sz-bg">
        {/* Placeholder gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-sz-bg-tertiary to-sz-bg" />
        
        {/* Duration badge */}
        <div className="absolute bottom-2 right-2 flex items-center gap-1 px-2 py-0.5 bg-black/70 rounded text-[10px] font-medium text-white">
          <Clock className="w-3 h-3" />
          {formatDuration(actualDuration)}
        </div>

        {/* Score badge */}
        <div className="absolute top-2 right-2">
          <ScoreBadge score={clip.finalScore} size="sm" />
        </div>

        {/* Status indicator */}
        {clip.status === 'accepted' && (
          <div className="absolute top-2 left-2 w-6 h-6 rounded-full bg-sz-success flex items-center justify-center">
            <Check className="w-3.5 h-3.5 text-white" />
          </div>
        )}
        {clip.status === 'rejected' && (
          <div className="absolute top-2 left-2 w-6 h-6 rounded-full bg-sz-danger flex items-center justify-center">
            <X className="w-3.5 h-3.5 text-white" />
          </div>
        )}

        {/* Play button overlay */}
        <button
          onClick={handleReview}
          className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40"
        >
          <div className="w-12 h-12 rounded-full bg-sz-accent flex items-center justify-center shadow-lg">
            <Play className="w-5 h-5 text-sz-bg ml-0.5" />
          </div>
        </button>
      </div>

      {/* Content */}
      <div className="p-3 space-y-3">
        {/* Title and category */}
        <div>
          <h3 className="text-sm font-medium text-sz-text truncate">
            {clip.title || `Clip ${clip.id.split('_')[1] || '1'}`}
          </h3>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs text-sz-text-muted">
              {formatDuration(actualStart)} - {formatDuration(actualEnd)}
            </span>
            {clip.category && <PatternBadge pattern={clip.category} />}
          </div>
        </div>

        {/* Hook text preview */}
        {clip.hookText && (
          <p className="text-xs text-sz-text-secondary truncate-2 leading-relaxed">
            "{clip.hookText}"
          </p>
        )}

        {/* Trim controls (compact) */}
        {(clip.trimStartOffset !== 0 || clip.trimEndOffset !== 0) && (
          <div className="flex items-center justify-between text-[10px] text-sz-text-muted bg-sz-bg rounded-sz px-2 py-1">
            <span>Trim: {clip.trimStartOffset >= 0 ? '+' : ''}{clip.trimStartOffset.toFixed(1)}s / {clip.trimEndOffset >= 0 ? '+' : ''}{clip.trimEndOffset.toFixed(1)}s</span>
          </div>
        )}

        {/* Quick trim buttons */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-0.5">
            <IconButton
              icon={<ChevronLeft className="w-3 h-3" />}
              size="xs"
              variant="ghost"
              tooltip="Trim start earlier"
              onClick={() => handleTrimStart(-1)}
            />
            <IconButton
              icon={<ChevronRight className="w-3 h-3" />}
              size="xs"
              variant="ghost"
              tooltip="Trim start later"
              onClick={() => handleTrimStart(1)}
            />
            <span className="text-[10px] text-sz-text-muted mx-1">|</span>
            <IconButton
              icon={<ChevronLeft className="w-3 h-3" />}
              size="xs"
              variant="ghost"
              tooltip="Trim end earlier"
              onClick={() => handleTrimEnd(-1)}
            />
            <IconButton
              icon={<ChevronRight className="w-3 h-3" />}
              size="xs"
              variant="ghost"
              tooltip="Trim end later"
              onClick={() => handleTrimEnd(1)}
            />
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          <Button
            variant={clip.status === 'accepted' ? 'success' : 'secondary'}
            size="sm"
            onClick={handleAccept}
            leftIcon={<Check className="w-3.5 h-3.5" />}
            className="flex-1"
          >
            {clip.status === 'accepted' ? 'Accepted' : 'Accept'}
          </Button>
          <Button
            variant={clip.status === 'rejected' ? 'danger' : 'ghost'}
            size="sm"
            onClick={handleReject}
            leftIcon={<X className="w-3.5 h-3.5" />}
          >
            {clip.status === 'rejected' ? 'Rejected' : 'Reject'}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default memo(ClipCard);
