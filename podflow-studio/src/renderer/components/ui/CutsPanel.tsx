import { useEffect, useMemo, useState } from 'react';
import type { Clip, Transcript } from '../../types';
import { formatDuration, getScoreLabel } from '../../types';
import { ScoreBadge, StatusBadge } from './Badge';
import Button from './Button';
import { buildTranscriptSnippetForRange, getClipEffectiveRangeSeconds } from '../../utils/clipTranscript';

export interface CutsPanelProps {
  clips: Clip[];
  currentClipId?: string;
  onSelectClip: (clipId: string) => void;
  transcript?: Transcript | null;
  transcriptAvailable?: boolean;
  transcriptError?: string | null;
}

function statusAccent(status: Clip['status']): { bar: string; bg: string; hover: string } {
  switch (status) {
    case 'accepted':
      return { bar: 'bg-green-500', bg: 'bg-green-500/5', hover: 'hover:bg-green-500/10' };
    case 'rejected':
      return { bar: 'bg-red-500', bg: 'bg-red-500/5', hover: 'hover:bg-red-500/10' };
    default:
      return { bar: 'bg-sz-border', bg: 'bg-transparent', hover: 'hover:bg-sz-bg-hover' };
  }
}

export function CutsPanel({ clips, currentClipId, onSelectClip, transcript, transcriptAvailable, transcriptError }: CutsPanelProps) {
  const acceptedCount = clips.filter(c => c.status === 'accepted').length;
  const rejectedCount = clips.filter(c => c.status === 'rejected').length;
  const pendingCount = clips.length - acceptedCount - rejectedCount;

  const [showFullTranscript, setShowFullTranscript] = useState(false);

  const currentClip = useMemo(
    () => clips.find((c) => c.id === currentClipId) || null,
    [clips, currentClipId]
  );

  // Collapse transcript view when changing selection
  useEffect(() => {
    setShowFullTranscript(false);
  }, [currentClipId]);

  const clipTranscript = useMemo(() => {
    if (!currentClip) return { text: '', segmentCount: 0, source: 'none' as const };
    if (currentClip.transcript && currentClip.transcript.trim()) {
      return { text: currentClip.transcript.trim(), segmentCount: 0, source: 'ai' as const };
    }
    const range = getClipEffectiveRangeSeconds(currentClip);
    const snippet = buildTranscriptSnippetForRange(transcript, range, { maxChars: 12000 });
    return { ...snippet, source: 'global' as const };
  }, [currentClip, transcript]);

  const handleCopyTranscript = async () => {
    if (!clipTranscript.text) return;
    try {
      await navigator.clipboard.writeText(clipTranscript.text);
    } catch {
      // clipboard can be blocked in some contexts; user can still select/copy manually
    }
  };

  return (
    <aside className="w-96 max-w-[28rem] bg-sz-bg-secondary border-l border-sz-border flex flex-col min-h-0 flex-1">
      <div className="p-4 border-b border-sz-border">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold tracking-wide uppercase text-sz-text-muted">Cuts</h3>
          <div className="text-xs text-sz-text-muted">{clips.length} total</div>
        </div>
        <div className="mt-3 flex items-center gap-2 flex-wrap">
          <span className="text-xs px-2 py-1 rounded bg-sz-success-muted text-sz-success">{acceptedCount} accepted</span>
          <span className="text-xs px-2 py-1 rounded bg-sz-danger-muted text-sz-danger">{rejectedCount} rejected</span>
          <span className="text-xs px-2 py-1 rounded bg-sz-bg-hover text-sz-text-secondary">{pendingCount} pending</span>
        </div>
      </div>

      <div className="flex-1 min-h-0 flex flex-col">
        {/* Clip List (scrollable) */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          {clips.map((clip, idx) => {
            const isCurrent = clip.id === currentClipId;
            const accent = statusAccent(clip.status);
            const score = Math.round(clip.finalScore || 0);

            return (
              <button
                key={clip.id}
                type="button"
                onClick={() => onSelectClip(clip.id)}
                className={
                  `w-full text-left px-4 py-3 border-b border-sz-border transition-colors ${accent.hover} ` +
                  (isCurrent ? `bg-sz-bg-hover ring-1 ring-sz-accent/40` : accent.bg)
                }
              >
                <div className="flex items-start gap-3">
                  <div className={`w-1.5 self-stretch rounded ${accent.bar}`} />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold truncate">
                          {clip.title?.trim() ? clip.title : `Clip ${idx + 1}`}
                        </div>
                        <div className="mt-0.5 text-xs text-sz-text-muted">
                          {formatDuration(Math.max(0, clip.endTime - clip.startTime))}
                          {clip.mood ? ` • ${clip.mood}` : ''}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <ScoreBadge score={score} size="sm" />
                        <StatusBadge status={clip.status} />
                      </div>
                    </div>

                    <div className="mt-2 text-xs text-sz-text-secondary">
                      {getScoreLabel(score)}
                    </div>
                  </div>
                </div>
              </button>
            );
          })}

          {clips.length === 0 && (
            <div className="p-6 text-sm text-sz-text-muted">No cuts yet.</div>
          )}
        </div>

        {/* Selected Clip Details (fills to bottom) */}
        <div className="border-t border-sz-border bg-sz-bg-secondary p-4 flex flex-col min-h-0">
        {!currentClip ? (
          <div className="text-sm text-sz-text-muted">Select a clip to see transcript.</div>
        ) : (
          <div className="flex flex-col min-h-0 gap-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-semibold truncate">
                  {currentClip.title?.trim() ? currentClip.title : 'Clip details'}
                </div>
                <div className="mt-0.5 text-xs text-sz-text-muted">
                  {formatDuration(Math.max(0, currentClip.endTime - currentClip.startTime))}
                  {currentClip.patternLabel ? ` • ${currentClip.patternLabel}` : ''}
                  {currentClip.mood ? ` • ${currentClip.mood}` : ''}
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <Button
                  type="button"
                  variant="secondary"
                  size="xs"
                  onClick={handleCopyTranscript}
                  disabled={!clipTranscript.text}
                >
                  Copy
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  onClick={() => setShowFullTranscript((v) => !v)}
                  disabled={!clipTranscript.text}
                >
                  {showFullTranscript ? 'Collapse' : 'Expand'}
                </Button>
              </div>
            </div>

            {currentClip.description?.trim() ? (
              <div className="text-xs text-sz-text-secondary">
                {currentClip.description}
              </div>
            ) : null}

            <div className="rounded-lg border border-sz-border bg-sz-bg p-3 flex flex-col min-h-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <div className="text-xs font-semibold text-sz-text-muted uppercase tracking-wide">Transcript</div>
                <div className="text-[11px] text-sz-text-muted">
                  {clipTranscript.source === 'ai' ? 'AI snippet' : clipTranscript.source === 'global' ? 'From transcript' : '—'}
                </div>
              </div>

              {transcriptError ? (
                <div className="mt-2 text-xs text-sz-danger">{transcriptError}</div>
              ) : null}

              {clipTranscript.text ? (
                <div className={`mt-2 w-full flex-1 min-h-0 rounded-md bg-sz-bg-tertiary border border-sz-border px-3 py-2 text-xs leading-relaxed text-sz-text-secondary ${showFullTranscript ? 'overflow-y-auto' : 'overflow-hidden'}`}>
                  <p className="whitespace-pre-wrap">
                    {showFullTranscript ? clipTranscript.text : clipTranscript.text.slice(0, 500) + (clipTranscript.text.length > 500 ? '…' : '')}
                  </p>
                </div>
              ) : (
                <div className="mt-2 text-xs text-sz-text-muted">
                  {transcriptAvailable === false && !transcript ? 'Transcript not available for this project.' : 'No transcript loaded for this clip.'}
                </div>
              )}
            </div>
          </div>
        )}
        </div>
      </div>
    </aside>
  );
}
