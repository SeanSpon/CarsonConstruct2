import { HashRouter, Routes, Route } from 'react-router-dom';
import { useEffect } from 'react';
import Sidebar from './components/Sidebar';
import StatusBar from './components/StatusBar';
import Home from './pages/Home';
import ClipFinder from './pages/ClipFinder';
import AutoEdit from './pages/AutoEdit';
import Export from './pages/Export';
import { useStore } from './stores/store';
import type { Clip, DeadSpace, Transcript } from './types';

function AppContent() {
  const { 
    setDetectionProgress, 
    setDetectionError, 
    setResults,
    setExportProgress,
    setExporting,
    setLastExportDir,
  } = useStore();

  // Set up IPC listeners
  useEffect(() => {
    // Detection progress
    const unsubProgress = window.api.onDetectionProgress((data) => {
      setDetectionProgress({
        percent: data.progress,
        message: data.message,
      });
    });

    // Detection complete
    const unsubComplete = window.api.onDetectionComplete((data) => {
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
    });

    // Detection error
    const unsubError = window.api.onDetectionError((data) => {
      setDetectionError(data.error);
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
  }, [setDetectionProgress, setDetectionError, setResults, setExportProgress, setExporting, setLastExportDir]);

  return (
    <div className="h-screen flex flex-col bg-zinc-950 text-zinc-100">
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-auto">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/clips" element={<ClipFinder />} />
            <Route path="/edit" element={<AutoEdit />} />
            <Route path="/export" element={<Export />} />
          </Routes>
        </main>
      </div>
      <StatusBar />
    </div>
  );
}

export default function App() {
  return (
    <HashRouter>
      <AppContent />
    </HashRouter>
  );
}
