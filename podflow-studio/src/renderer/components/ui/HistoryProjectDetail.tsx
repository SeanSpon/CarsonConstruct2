import { useMemo, useState, useEffect, useRef } from 'react';
import type { HistoryProject, HistoryClip } from '../../stores/historyStore';
import { CaptionStyleSelector, type CaptionStyle } from './CaptionStyleSelector';

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
  const [transcript, setTranscript] = useState<{ segments?: Array<{ text: string; start: number; end: number }>; text?: string; words?: Array<{ word: string; start: number; end: number }> } | null>((project.transcript || null) as { segments?: Array<{ text: string; start: number; end: number }>; text?: string; words?: Array<{ word: string; start: number; end: number }> } | null);
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

  const duration = project.duration || 0;
  const activeClip = useMemo(() => clips.find(c => scrubTime >= c.startTime && scrubTime <= c.endTime), [clips, scrubTime]);
  const transcriptSegments = transcript?.segments || [];
  const transcriptText = transcript?.text || '';

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
            <div className="relative w-full h-12 bg-sz-bg-tertiary rounded-lg overflow-hidden border border-sz-border">
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
