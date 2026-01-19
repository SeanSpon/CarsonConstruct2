import { useEffect } from 'react';
import { EditorView } from './components/editor';
import { useStore } from './stores/store';
import type { Clip, DeadSpace, Transcript } from './types';

function App() {
  const { 
    setDetectionProgress, 
    setDetectionError, 
    setResults,
    setExportProgress,
    setExporting,
    setLastExportDir,
    currentJobId,
    setCurrentJobId,
    setLastJobId,
  } = useStore();

  // Set up IPC listeners
  useEffect(() => {
    // Detection progress
    const unsubProgress = window.api.onDetectionProgress((data) => {
      if (currentJobId && data.projectId !== currentJobId) return;
      setDetectionProgress({
        percent: data.progress,
        message: data.message,
      });
    });

    // Detection complete
    const unsubComplete = window.api.onDetectionComplete((data) => {
      if (currentJobId && data.projectId !== currentJobId) return;
      const clips = (data.clips as Clip[]).map((clip, index) => ({
        ...clip,
        id: clip.id || `clip_${index + 1}`,
        status: 'pending' as const,
        trimStartOffset: clip.trimStartOffset || 0,
        trimEndOffset: clip.trimEndOffset || 0,
      }));

      const deadSpaces = (data.deadSpaces as DeadSpace[]).map((ds, index) => ({
        ...ds,
        id: ds.id || `dead_${index + 1}`,
        remove: true, // Default to remove
      }));

      setResults(clips, deadSpaces, data.transcript as Transcript | null);
      setCurrentJobId(null);
      setLastJobId(data.projectId);
    });

    // Detection error
    const unsubError = window.api.onDetectionError((data) => {
      if (currentJobId && data.projectId !== currentJobId) return;
      setDetectionError(data.error);
      setCurrentJobId(null);
    });

    // Export progress
    const unsubExportProgress = window.api.onExportProgress((data) => {
      setExportProgress({
        current: data.current,
        total: data.total,
        clipName: data.clipName,
      });
    });

    // Export complete
    const unsubExportComplete = window.api.onExportComplete((data) => {
      setExporting(false);
      setExportProgress(null);
      if (data.success) {
        setLastExportDir(data.outputDir);
      }
    });

    return () => {
      unsubProgress();
      unsubComplete();
      unsubError();
      unsubExportProgress();
      unsubExportComplete();
    };
  }, [
    setDetectionProgress,
    setDetectionError,
    setResults,
    setExportProgress,
    setExporting,
    setLastExportDir,
    currentJobId,
    setCurrentJobId,
    setLastJobId,
  ]);

  return <EditorView />;
}

export default App;
