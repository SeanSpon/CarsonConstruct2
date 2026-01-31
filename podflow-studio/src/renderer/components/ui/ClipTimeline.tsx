import type { Clip } from '../../types';
import { formatDuration } from '../../types';

export interface ClipTimelineProps {
  durationSeconds: number;
  clips: Clip[];
  currentClipId?: string;
  playheadSeconds?: number;
  onSelectClip: (clipId: string) => void;
}

function clipColorClass(status: Clip['status'], isActive: boolean): string {
  if (isActive) return 'bg-sz-accent/80 hover:bg-sz-accent/90 ring-2 ring-white/30';
  switch (status) {
    case 'accepted':
      return 'bg-emerald-500/60 hover:bg-emerald-500/75';
    case 'rejected':
      return 'bg-red-500/55 hover:bg-red-500/70';
    default:
      return 'bg-blue-500/45 hover:bg-blue-500/60';
  }
}

export function ClipTimeline({
  durationSeconds,
  clips,
  currentClipId,
  playheadSeconds,
  onSelectClip,
}: ClipTimelineProps) {
  const duration = Math.max(0.001, durationSeconds || 0);
  const playhead = Math.max(0, Math.min(duration, playheadSeconds ?? 0));

  return (
    <div className="pointer-events-auto">
      <div className="flex items-center justify-between text-[11px] text-white/70 mb-1">
        <div>Timeline</div>
        <div className="tabular-nums">{formatDuration(playhead)} / {formatDuration(duration)}</div>
      </div>

      <div className="relative w-full h-20 rounded-xl overflow-hidden border border-white/10 bg-black/35 backdrop-blur-sm">
        {/* Clickable segments */}
        {clips.map((clip) => {
          const leftPct = (Math.max(0, Math.min(duration, clip.startTime)) / duration) * 100;
          const widthPct = (Math.max(0, Math.min(duration, clip.endTime)) - Math.max(0, Math.min(duration, clip.startTime))) / duration * 100;
          const isActive = clip.id === currentClipId;

          // Keep tiny clips touchable
          const minWidthPx = 10;

          return (
            <button
              key={clip.id}
              type="button"
              className={
                `absolute top-2 bottom-2 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-sz-accent/60 ` +
                clipColorClass(clip.status, isActive)
              }
              style={{ left: `${leftPct}%`, width: `${Math.max(widthPct, 0)}%`, minWidth: minWidthPx }}
              onClick={() => onSelectClip(clip.id)}
              title={`${clip.title?.trim() ? clip.title : clip.patternLabel || 'Clip'} • ${formatDuration(clip.startTime)} - ${formatDuration(clip.endTime)}`}
              aria-label={`Select clip from ${formatDuration(clip.startTime)} to ${formatDuration(clip.endTime)}`}
            />
          );
        })}

        {/* Playhead */}
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-white/85"
          style={{ left: `${(playhead / duration) * 100}%` }}
        />

        {/* Start/End labels */}
        <div className="absolute left-3 bottom-1 text-[10px] text-white/60 tabular-nums">0:00</div>
        <div className="absolute right-3 bottom-1 text-[10px] text-white/60 tabular-nums">{formatDuration(duration)}</div>
      </div>

      <div className="mt-1 text-[11px] text-white/60">
        Tap a segment to open its transcript on the right.
      </div>
    </div>
  );
}
