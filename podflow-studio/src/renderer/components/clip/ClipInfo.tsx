import { memo } from 'react';
import type { Clip } from '../../types';
import { formatTimestamp } from '../../types';
import { Badge, PatternBadge } from '../ui';

export interface ClipInfoProps {
  clip: Clip;
  actualStart: number;
  actualEnd: number;
}

function ClipInfo({ clip, actualStart, actualEnd }: ClipInfoProps) {
  const completeThought = clip.completeThought ?? clip.isComplete;
  const qualityMultiplier = clip.qualityMultiplier ?? clip.aiQualityMultiplier;

  return (
    <div className="space-y-2">
      {/* Pattern Badge + Quality indicators */}
      <div className="flex flex-wrap items-center gap-1.5">
        {clip.patternLabel && (
          <PatternBadge pattern={clip.patternLabel} />
        )}
        {clip.category && (
          <Badge variant="muted">{clip.category}</Badge>
        )}
        {completeThought !== undefined && (
          <Badge variant={completeThought ? 'success' : 'warning'} size="sm">
            {completeThought ? 'Complete' : 'Partial'}
          </Badge>
        )}
        {typeof qualityMultiplier === 'number' && !Number.isNaN(qualityMultiplier) && (
          <Badge variant="accent" size="sm">x{qualityMultiplier.toFixed(2)}</Badge>
        )}
      </div>

      {/* Title */}
      <h3 className="text-sm font-medium text-sz-text line-clamp-2">
        {clip.title || clip.description || `Clip at ${formatTimestamp(actualStart)}`}
      </h3>

      {/* Hook text */}
      {clip.hookText && (
        <p className="text-xs text-purple-400 italic truncate-2">"{clip.hookText}"</p>
      )}

      {/* Timestamp */}
      <p className="text-xs text-sz-text-muted tabular-nums">
        {formatTimestamp(actualStart)} – {formatTimestamp(actualEnd)}
      </p>

      {/* Transcript preview */}
      {clip.transcript && (
        <p className="text-xs text-sz-text-muted line-clamp-2 italic">
          "{clip.transcript}"
        </p>
      )}
    </div>
  );
}

export default memo(ClipInfo);
