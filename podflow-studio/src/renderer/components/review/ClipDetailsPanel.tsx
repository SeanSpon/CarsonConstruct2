import { memo } from 'react';
import { Card, CardContent, ScoreBadge, PatternBadge } from '../ui';
import type { Clip } from '../../types';
import type { ClipProject } from '../../review/clipProject';

export interface ClipDetailsPanelProps {
  clip: Clip;
  clipProject: ClipProject;
}

function ClipDetailsPanel({ clip, clipProject }: ClipDetailsPanelProps) {
  return (
    <Card noPadding>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold text-sz-text-muted uppercase tracking-wider">Clip Details</h3>
          <ScoreBadge score={clip.finalScore || clip.score} size="sm" />
        </div>

        <div>
          <p className="text-sm font-medium text-sz-text">{clip.title || clip.description || 'Untitled Clip'}</p>
          {clip.category && (
            <div className="mt-2">
              <PatternBadge pattern={clip.category} />
            </div>
          )}
        </div>

        <div className="space-y-1 text-xs">
          <div className="flex justify-between">
            <span className="text-sz-text-muted">Original</span>
            <span className="text-sz-text-secondary tabular-nums">
              {clip.startTime.toFixed(2)}s → {clip.endTime.toFixed(2)}s
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-sz-text-muted">Current</span>
            <span className="text-sz-text tabular-nums">
              {clipProject.edit.in.toFixed(2)}s → {clipProject.edit.out.toFixed(2)}s
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-sz-text-muted">Duration</span>
            <span className="text-sz-accent tabular-nums">
              {(clipProject.edit.out - clipProject.edit.in).toFixed(2)}s
            </span>
          </div>
        </div>

        {clip.hookText && (
          <div className="pt-3 border-t border-sz-border">
            <p className="text-[10px] text-sz-text-muted uppercase tracking-wide mb-1">Hook</p>
            <p className="text-xs text-purple-400 italic">"{clip.hookText}"</p>
          </div>
        )}

        {clip.transcript && (
          <div className="pt-3 border-t border-sz-border">
            <p className="text-[10px] text-sz-text-muted uppercase tracking-wide mb-1">Transcript</p>
            <p className="text-xs text-sz-text-secondary line-clamp-3">"{clip.transcript}"</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default memo(ClipDetailsPanel);
