import { useMemo, useState, useEffect } from 'react';
import type { HistoryProject, HistoryClip } from '../../stores/historyStore';
import { CaptionStyleSelector, type CaptionStyle } from './CaptionStyleSelector';

type TranscriptLike = {
  segments?: Array<{ text: string; start: number; end: number }>;
  text?: string;
  words?: Array<{ word: string; start: number; end: number }>;
};

type TimeInterval = { start: number; end: number };

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function mergeIntervals(intervals: TimeInterval[], gapThresholdSeconds: number): TimeInterval[] {
  const normalized = intervals
    .filter((i) => Number.isFinite(i.start) && Number.isFinite(i.end) && i.end > i.start)
    .map((i) => ({ start: i.start, end: i.end }))
    .sort((a, b) => a.start - b.start);

  if (normalized.length === 0) return [];

  const merged: TimeInterval[] = [];
  let current = normalized[0];
  for (let idx = 1; idx < normalized.length; idx += 1) {
    const next = normalized[idx];
    if (next.start <= current.end + gapThresholdSeconds) {
      current = { start: current.start, end: Math.max(current.end, next.end) };
      continue;
    }
    merged.push(current);
    current = next;
  }
  merged.push(current);
  return merged;
}

function chooseTickStepSeconds(durationSeconds: number): number {
  if (durationSeconds <= 10 * 60) return 60;
  if (durationSeconds <= 30 * 60) return 2 * 60;
  if (durationSeconds <= 2 * 60 * 60) return 5 * 60;
  return 10 * 60;
}

interface HistoryProjectDetailProps {
  project: HistoryProject;
  clips: HistoryClip[];
  onClose: () => void;
  onLoadProject: (projectId: string) => void;
  onUpdateClipStyle: (clipId: string, style: CaptionStyle) => void;
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds)) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function HistoryProjectDetail({
  project,
  clips,
  onClose,
  onLoadProject,
  onUpdateClipStyle,
}: HistoryProjectDetailProps) {
  const [scrubTime, setScrubTime] = useState(0);
  const [transcript, setTranscript] = useState<TranscriptLike | null>((project.transcript || null) as TranscriptLike | null);
  const [loadingTranscript, setLoadingTranscript] = useState(false);

  // Try to load transcript from cache if not in project record
  useEffect(() => {
    const loadTranscriptFromCache = async () => {
      if (transcript) return; // Already have it
      if (!project.filePath) return;

      setLoadingTranscript(true);
      try {
        // Ask main process to load cached transcript
        const result = await window.api.loadCachedTranscript(project.filePath);
        if (result.success && result.transcript) {
          setTranscript(result.transcript);
        }
      } catch (err) {
        console.warn('Failed to load cached transcript:', err);
      } finally {
        setLoadingTranscript(false);
      }
    };

    loadTranscriptFromCache();
  }, [project.filePath, transcript]);

  const transcriptSegments = transcript?.segments || [];
  const transcriptText = transcript?.text || '';

  const duration = useMemo(() => {
    const projectDuration = project.duration || 0;
    const maxClipEnd = clips.reduce((max, c) => Math.max(max, c.endTime || 0), 0);
    const maxTranscriptEnd = transcriptSegments.reduce((max, seg) => Math.max(max, seg.end || 0), 0);
    return Math.max(projectDuration, maxClipEnd, maxTranscriptEnd);
  }, [clips, project.duration, transcriptSegments]);

  const activeClip = useMemo(
    () => clips.find(c => scrubTime >= c.startTime && scrubTime <= c.endTime),
    [clips, scrubTime]
  );

  const speechBlocks = useMemo(() => {
    if (transcriptSegments.length === 0) return [];
    const merged = mergeIntervals(
      transcriptSegments.map((s) => ({ start: s.start, end: s.end })),
      0.25
    );
    const maxDuration = Math.max(duration, 1);
    return merged
      .map((b) => ({ start: clamp(b.start, 0, maxDuration), end: clamp(b.end, 0, maxDuration) }))
      .filter((b) => b.end > b.start);
  }, [duration, transcriptSegments]);

  const timelineTicks = useMemo(() => {
    const maxDuration = Math.max(duration, 1);
    const step = chooseTickStepSeconds(maxDuration);
    const maxTicks = 12;
    const raw: Array<{ t: number; label: string }> = [];
    for (let t = 0; t <= maxDuration; t += step) {
      raw.push({ t, label: formatTime(t) });
      if (raw.length >= maxTicks) break;
    }
    if (raw.length > 0 && raw[raw.length - 1].t < maxDuration) {
      raw.push({ t: maxDuration, label: formatTime(maxDuration) });
    }
    return raw;
  }, [duration]);

  const transcriptCoveragePercent = useMemo(() => {
    if (duration <= 0 || speechBlocks.length === 0) return 0;
    const coveredSeconds = speechBlocks.reduce((sum, b) => sum + (b.end - b.start), 0);
    return Math.round((coveredSeconds / duration) * 100);
  }, [duration, speechBlocks]);

  return (
    <div className="fixed inset-0 z-40 bg-black/70 flex items-center justify-center p-6">
      <div className="w-full max-w-6xl bg-sz-bg text-sz-text rounded-2xl border border-sz-border shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-sz-border bg-sz-bg-secondary">
          <div>
            <h3 className="text-xl font-semibold">{project.fileName}</h3>
            <p className="text-sm text-sz-text-muted">Full transcript & timeline</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => onLoadProject(project.id)}
              className="px-4 py-2 bg-sz-accent text-white rounded-lg hover:bg-sz-accent-hover transition-colors"
            >
              Load in Review
            </button>
            <button
              onClick={onClose}
              className="px-3 py-2 rounded-lg bg-sz-bg-tertiary hover:bg-sz-bg"
            >
              Close
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-0">
          {/* Left side: Timeline + clips */}
          <div className="p-6 space-y-4 border-r border-sz-border flex flex-col">
            <div className="flex items-center justify-between mb-2">
              <div className="font-semibold">Timeline</div>
              <div className="text-sm text-sz-text-muted">{formatTime(scrubTime)} / {formatTime(duration)}</div>
            </div>

            <div className="flex items-center justify-between text-xs text-sz-text-muted">
              <div>
                Clips: {clips.length} • Transcript: {loadingTranscript ? 'loading…' : (transcriptSegments.length > 0 ? `${transcriptCoveragePercent}% coverage` : 'none')}
              </div>
              <div>
                Created: {new Date(project.createdAt).toLocaleString()}
              </div>
            </div>

            {/* Scrubber */}
            <input
              type="range"
              min={0}
              max={Math.max(duration, 1)}
              step={0.1}
              value={Math.min(scrubTime, duration)}
              onChange={(e) => setScrubTime(parseFloat(e.target.value))}
              className="w-full"
            />

            {/* Clip map */}
            <div className="relative w-full h-14 bg-sz-bg-tertiary rounded-lg overflow-hidden border border-sz-border">
              {/* Ticks */}
              {timelineTicks.map((tick, idx) => {
                const left = (tick.t / Math.max(duration, 1)) * 100;
                return (
                  <div key={`${tick.t}-${idx}`} className="absolute inset-y-0" style={{ left: `${left}%` }}>
                    <div className="absolute top-0 bottom-0 w-px bg-white/10" />
                    {idx === 0 || idx === timelineTicks.length - 1 || idx % 2 === 0 ? (
                      <div className="absolute -top-5 -translate-x-1/2 text-[10px] text-sz-text-muted whitespace-nowrap">
                        {tick.label}
                      </div>
                    ) : null}
                  </div>
                );
              })}

              {/* Transcript speech coverage */}
              {speechBlocks.map((block, idx) => {
                const left = (block.start / Math.max(duration, 1)) * 100;
                const width = ((block.end - block.start) / Math.max(duration, 1)) * 100;
                return (
                  <div
                    key={`${block.start}-${block.end}-${idx}`}
                    className="absolute top-0 h-full bg-emerald-400/15"
                    style={{ left: `${left}%`, width: `${width}%` }}
                    title={`Speech: ${formatTime(block.start)} - ${formatTime(block.end)}`}
                    onMouseEnter={() => setScrubTime(block.start)}
                    onClick={() => setScrubTime(block.start)}
                  />
                );
              })}

              {clips.map((clip) => {
                const left = (clip.startTime / Math.max(duration, 1)) * 100;
                const width = ((clip.endTime - clip.startTime) / Math.max(duration, 1)) * 100;
                const isActive = activeClip?.id === clip.id;
                return (
                  <div
                    key={clip.id}
                    className={`absolute top-0 h-full ${isActive ? 'bg-sz-accent/70' : 'bg-blue-500/50'} hover:bg-sz-accent/60 transition-colors cursor-pointer`}
                    style={{ left: `${left}%`, width: `${width}%` }}
                    title={`${clip.title} (${formatTime(clip.startTime)} - ${formatTime(clip.endTime)})`}
                    onClick={() => setScrubTime(clip.startTime)}
                    onMouseEnter={() => setScrubTime(clip.startTime)}
                  />
                );
              })}
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-white/80"
                style={{ left: `${(Math.min(scrubTime, duration) / Math.max(duration, 1)) * 100}%` }}
              />
            </div>

            <div className="flex items-center gap-4 text-xs text-sz-text-muted">
              <div className="flex items-center gap-2">
                <span className="inline-block w-3 h-3 rounded bg-emerald-400/30 border border-emerald-400/30" />
                Speech
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-block w-3 h-3 rounded bg-blue-500/50 border border-blue-500/40" />
                Clips
              </div>
            </div>

            {/* Video Preview - Coming Soon */}
            {activeClip && project.filePath && (
              <div className="mt-4 space-y-3">
                <div className="text-sm font-semibold">Selected: {activeClip.title || activeClip.id}</div>
                <div className="w-full rounded-lg bg-sz-bg-tertiary border border-sz-border p-8 flex flex-col items-center justify-center text-center space-y-2" style={{ aspectRatio: '16 / 9', maxHeight: '280px' }}>
                  <svg className="w-12 h-12 text-sz-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-sm text-sz-text-muted">Video preview coming soon</p>
                  <p className="text-xs text-sz-text-muted">Use "Load in Review" to preview clips</p>
                </div>
                <div className="text-xs text-sz-text-muted text-center">
                  Clip: {formatTime(activeClip.startTime)} - {formatTime(activeClip.endTime)} ({formatTime(activeClip.endTime - activeClip.startTime)})
                </div>
              </div>
            )}

            {/* Clip list with caption style editing */}
            <div className="space-y-3 max-h-72 overflow-y-auto pr-1 flex-1">
              {clips.map((clip) => (
                <div 
                  key={clip.id} 
                  className={`p-3 rounded-lg border cursor-pointer transition-colors ${activeClip?.id === clip.id ? 'border-sz-accent bg-sz-bg-tertiary' : 'border-sz-border bg-sz-bg-secondary hover:bg-sz-bg-tertiary'}`}
                  onClick={() => setScrubTime(clip.startTime)}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium truncate">{clip.title || clip.id}</div>
                      <div className="text-xs text-sz-text-muted">{formatTime(clip.startTime)} - {formatTime(clip.endTime)}</div>
                    </div>
                    <span className="text-xs px-2 py-1 rounded bg-sz-bg-tertiary">{clip.mood || 'impactful'}</span>
                  </div>
                  <div className="mt-3">
                    <CaptionStyleSelector
                      selectedStyle={(clip.captionStyle as CaptionStyle) || 'viral'}
                      onStyleChange={(style) => onUpdateClipStyle(clip.id, style)}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right side: Transcript */}
          <div className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="font-semibold">Transcript</div>
              <div className="text-sm text-sz-text-muted">
                {loadingTranscript ? 'Loading...' : `Segments: ${transcriptSegments.length}`}
              </div>
            </div>

            <div className="h-[420px] overflow-y-auto bg-sz-bg-secondary border border-sz-border rounded-lg p-4 space-y-3">
              {loadingTranscript ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-sz-text-muted">Loading transcript...</div>
                </div>
              ) : transcriptSegments.length > 0 ? (
                transcriptSegments.map((seg: { text: string; start: number; end: number }, idx: number) => (
                  <div 
                    key={`${seg.start}-${idx}`} 
                    className={`space-y-1 p-2 rounded cursor-pointer transition-colors ${scrubTime >= seg.start && scrubTime <= seg.end ? 'bg-sz-bg-tertiary border-l-2 border-sz-accent pl-3' : 'hover:bg-sz-bg-tertiary/50'}`}
                    onClick={() => setScrubTime(seg.start)}
                  >
                    <div className="text-xs text-sz-text-muted">{formatTime(seg.start)} - {formatTime(seg.end)}</div>
                    <div className="text-sm leading-relaxed">{seg.text}</div>
                  </div>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-center space-y-3">
                  <div className="text-4xl">📝</div>
                  <div>
                    <p className="text-sz-text-muted text-sm">
                      {transcriptText || 'No transcript available for this project.'}
                    </p>
                    {!transcript && (
                      <p className="text-xs text-sz-text-muted mt-2">
                        Re-run detection to generate a transcript with captions.
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
