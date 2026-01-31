import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '../../stores/store';
import { ProgressLoader } from './LoadingState';

/**
 * Global loading/progress overlay that shows during detection and export.
 * Renders directly (no portal) to guarantee visibility.
 */
export default function GlobalBusyOverlay() {
  const {
    isDetecting,
    detectionProgress,
    transcriptSource,
    currentJobId,
    setCurrentJobId,
    setDetecting,
    setDetectionProgress,
    setDetectionError,
    isExporting,
    exportProgress,
    detectionLogs,
    clearDetectionLogs,
  } = useStore();

  const [showLogs, setShowLogs] = useState(true);
  const [followLogs, setFollowLogs] = useState(true);
  const logScrollRef = useRef<HTMLDivElement | null>(null);

  const recentLogs = useMemo(() => {
    const tail = detectionLogs.slice(-40);
    return tail;
  }, [detectionLogs]);

  useEffect(() => {
    if (!showLogs || !followLogs) return;
    const el = logScrollRef.current;
    if (!el) return;
    // Defer until after paint so height is updated
    const id = window.setTimeout(() => {
      try {
        el.scrollTop = el.scrollHeight;
      } catch {
        // ignore
      }
    }, 0);
    return () => window.clearTimeout(id);
  }, [recentLogs.length, showLogs, followLogs]);

  const handleCancelDetection = useCallback(async () => {
    if (!currentJobId) return;
    try {
      await window.api.cancelDetection(currentJobId);
    } catch {
      // ignore
    } finally {
      setCurrentJobId(null);
      setDetecting(false);
      setDetectionProgress(null);
      setDetectionError('Detection cancelled');
    }
  }, [currentJobId, setCurrentJobId, setDetecting, setDetectionProgress, setDetectionError]);

  // Only show the full-screen overlay while actively detecting.
  // Logs are useful, but they should never resurrect a finished job.
  const shouldShowDetection = isDetecting || !!detectionProgress;

  // Show detection overlay
  if (shouldShowDetection) {
    return (
      <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm">
        <div className="h-full w-full p-4 sm:p-6 flex items-center justify-center">
          <div className="w-full max-w-6xl">
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
              <div className="lg:col-span-2">
                <ProgressLoader
                  percent={detectionProgress?.percent || 0}
                  message={detectionProgress?.message || 'Detecting clips…'}
                  subMessage={transcriptSource ? `Transcript source: ${transcriptSource}` : undefined}
                  onCancel={handleCancelDetection}
                  className="w-full"
                />
              </div>

              <div className="lg:col-span-3">
                <div className="bg-sz-bg-secondary border border-sz-border rounded-sz-lg overflow-hidden">
                  <div className="px-4 py-3 border-b border-sz-border flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-sz-text">Live logs</div>
                      <div className="text-xs text-sz-text-muted truncate">
                        {currentJobId ? `Job ${currentJobId}` : 'Waiting for job…'}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        className="text-xs px-2 py-1 rounded bg-sz-bg-tertiary hover:bg-sz-bg-hover"
                        onClick={() => setShowLogs((v) => !v)}
                      >
                        {showLogs ? 'Hide' : 'Show'}
                      </button>
                      <button
                        className={`text-xs px-2 py-1 rounded ${followLogs ? 'bg-sz-accent text-white' : 'bg-sz-bg-tertiary hover:bg-sz-bg-hover'}`}
                        onClick={() => setFollowLogs((v) => !v)}
                        disabled={!showLogs}
                        title="Auto-scroll"
                      >
                        Follow
                      </button>
                      <button
                        className="text-xs px-2 py-1 rounded bg-sz-bg-tertiary hover:bg-sz-bg-hover"
                        onClick={() => clearDetectionLogs()}
                      >
                        Clear
                      </button>
                      <button
                        className="text-xs px-2 py-1 rounded bg-sz-bg-tertiary hover:bg-sz-bg-hover"
                        onClick={async () => {
                          try {
                            const text = detectionLogs
                              .slice(-400)
                              .map((l) => `[${new Date(l.ts).toLocaleTimeString()}] ${l.stream.toUpperCase()}: ${l.line}`)
                              .join('\n');
                            await navigator.clipboard.writeText(text);
                          } catch {
                            // ignore
                          }
                        }}
                        disabled={detectionLogs.length === 0}
                      >
                        Copy
                      </button>
                    </div>
                  </div>

                  {showLogs ? (
                    <div
                      ref={logScrollRef}
                      className="h-[280px] sm:h-[340px] lg:h-[420px] overflow-auto bg-black/40 p-3 font-mono text-[11px] leading-relaxed"
                    >
                      {recentLogs.length === 0 ? (
                        <div className="text-sz-text-muted">(no log lines yet)</div>
                      ) : (
                        recentLogs.map((l, idx) => (
                          <div key={`${l.ts}_${idx}`} className="flex items-start gap-2 py-0.5">
                            <span
                              className={`mt-[1px] shrink-0 rounded px-1.5 py-0.5 text-[10px] leading-none ${
                                l.stream === 'stderr'
                                  ? 'bg-red-500/20 text-red-200'
                                  : 'bg-sz-accent/20 text-sz-text'
                              }`}
                            >
                              {l.stream}
                            </span>
                            <span className={l.stream === 'stderr' ? 'text-red-200 whitespace-pre-wrap break-words' : 'text-sz-text-secondary whitespace-pre-wrap break-words'}>
                              {l.line}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  ) : (
                    <div className="p-4 text-sm text-sz-text-muted">Logs hidden.</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Show export overlay
  if (isExporting) {
    const exportPercent = exportProgress?.total
      ? Math.max(0, Math.min(100, (exportProgress.current / exportProgress.total) * 100))
      : 0;
    const message = exportProgress
      ? `Exporting ${exportProgress.current} / ${exportProgress.total} clips…`
      : 'Exporting clips…';

    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm">
        <ProgressLoader
          percent={exportPercent}
          message={message}
          subMessage={exportProgress?.clipName || 'Rendering video + captions'}
          className="w-full max-w-md mx-6"
        />
      </div>
    );
  }

  return null;
}
