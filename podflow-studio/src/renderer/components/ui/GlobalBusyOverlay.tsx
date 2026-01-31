import { useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useStore } from '../../stores/store';
import { useHistoryStore } from '../../stores/historyStore';
import { LoadingOverlay, ProgressLoader } from './LoadingState';

function getRootForPortal(): HTMLElement {
  return document.body;
}

export default function GlobalBusyOverlay() {
  const {
    hasHydrated,
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
  } = useStore();

  const { hasHydrated: historyHasHydrated } = useHistoryStore();

  const isStartingUp = !hasHydrated || !historyHasHydrated;

  const exportPercent = useMemo(() => {
    if (!exportProgress || !exportProgress.total) return 0;
    return Math.max(0, Math.min(100, (exportProgress.current / exportProgress.total) * 100));
  }, [exportProgress]);

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

  const node = useMemo(() => {
    if (isStartingUp) {
      return (
        <div className="fixed inset-0 z-[9999]">
          <LoadingOverlay message="Warming up… loading settings & history" />
        </div>
      );
    }

    if (isDetecting) {
      return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-sz-bg/90 backdrop-blur-sm">
          <ProgressLoader
            percent={detectionProgress?.percent || 0}
            message={detectionProgress?.message || 'Detecting clips…'}
            subMessage={transcriptSource ? `Transcript source: ${transcriptSource}` : undefined}
            onCancel={handleCancelDetection}
            className="w-full max-w-md mx-6"
          />
        </div>
      );
    }

    if (isExporting) {
      const message = exportProgress
        ? `Exporting ${exportProgress.current} / ${exportProgress.total} clips…`
        : 'Exporting clips…';

      return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-sz-bg/90 backdrop-blur-sm">
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
  }, [
    isStartingUp,
    isDetecting,
    detectionProgress?.percent,
    detectionProgress?.message,
    transcriptSource,
    handleCancelDetection,
    isExporting,
    exportPercent,
    exportProgress,
  ]);

  if (!node) return null;

  return createPortal(node, getRootForPortal());
}
