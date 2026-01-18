import { useState, useEffect } from 'react';
import { X, Loader2, FolderOpen, CheckCircle, AlertCircle } from 'lucide-react';
import { useProjectStore } from '../stores/projectStore';
import { DetectedClip } from '../types';

interface ExportModalProps {
  clips: DetectedClip[];
  onClose: () => void;
}

type ExportState = 'idle' | 'selecting' | 'exporting' | 'complete' | 'error';

export default function ExportModal({ clips, onClose }: ExportModalProps) {
  const { filePath, setExporting, setExportProgress, exportProgress } = useProjectStore();
  const [state, setState] = useState<ExportState>('idle');
  const [outputDir, setOutputDir] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Set up export progress listener
    const unsubProgress = window.api.onExportProgress((data) => {
      setExportProgress({ current: data.current, total: data.total });
    });

    const unsubComplete = window.api.onExportComplete((data) => {
      setExporting(false);
      setExportProgress(null);
      
      if (data.success) {
        setOutputDir(data.outputDir);
        setState('complete');
      } else {
        setError(data.errors?.join('\n') || 'Export failed');
        setState('error');
      }
    });

    return () => {
      unsubProgress();
      unsubComplete();
    };
  }, [setExporting, setExportProgress]);

  const handleSelectFolder = async () => {
    setState('selecting');
    const dir = await window.api.selectOutputDir();
    
    if (!dir) {
      setState('idle');
      return;
    }

    setOutputDir(dir);
    await startExport(dir);
  };

  const startExport = async (dir: string) => {
    if (!filePath) return;

    setState('exporting');
    setExporting(true);

    const clipsToExport = clips.map(clip => ({
      id: clip.id,
      startTime: clip.startTime,
      endTime: clip.endTime,
      trimStartOffset: clip.trimStartOffset,
      trimEndOffset: clip.trimEndOffset,
    }));

    await window.api.exportClips({
      sourceFile: filePath,
      clips: clipsToExport,
      outputDir: dir,
    });
  };

  const handleOpenFolder = async () => {
    if (outputDir) {
      await window.api.openFolder(outputDir);
    }
  };

  const progress = exportProgress ? Math.round((exportProgress.current / exportProgress.total) * 100) : 0;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-zinc-900 rounded-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-zinc-800">
          <h2 className="text-lg font-semibold text-zinc-100">Export Clips</h2>
          {state !== 'exporting' && (
            <button
              onClick={onClose}
              className="p-2 hover:bg-zinc-800 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-zinc-400" />
            </button>
          )}
        </div>

        {/* Content */}
        <div className="p-6">
          {state === 'idle' && (
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-violet-500/10 flex items-center justify-center mx-auto mb-4">
                <FolderOpen className="w-8 h-8 text-violet-400" />
              </div>
              <p className="text-zinc-300 mb-2">
                Ready to export <span className="font-semibold text-violet-400">{clips.length}</span> clips
              </p>
              <p className="text-sm text-zinc-500 mb-6">
                Choose where to save your clips
              </p>
              <button
                onClick={handleSelectFolder}
                className="w-full py-3 bg-violet-600 hover:bg-violet-500 rounded-lg font-semibold text-white transition-colors"
              >
                Choose Folder
              </button>
            </div>
          )}

          {state === 'selecting' && (
            <div className="text-center py-8">
              <Loader2 className="w-12 h-12 text-violet-500 animate-spin mx-auto mb-4" />
              <p className="text-zinc-400">Selecting folder...</p>
            </div>
          )}

          {state === 'exporting' && (
            <div className="text-center">
              <Loader2 className="w-12 h-12 text-violet-500 animate-spin mx-auto mb-4" />
              <p className="text-zinc-300 mb-2">
                Exporting clip {exportProgress?.current || 0} of {exportProgress?.total || clips.length}
              </p>
              <div className="w-full bg-zinc-800 rounded-full h-2 mb-2 overflow-hidden">
                <div
                  className="bg-violet-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-sm text-zinc-500">{progress}%</p>
            </div>
          )}

          {state === 'complete' && (
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8 text-emerald-400" />
              </div>
              <p className="text-zinc-300 mb-2">
                Successfully exported <span className="font-semibold text-emerald-400">{clips.length}</span> clips!
              </p>
              <p className="text-sm text-zinc-500 mb-6 truncate px-4">
                {outputDir}
              </p>
              <div className="flex gap-3">
                <button
                  onClick={handleOpenFolder}
                  className="flex-1 py-3 bg-violet-600 hover:bg-violet-500 rounded-lg font-semibold text-white transition-colors flex items-center justify-center gap-2"
                >
                  <FolderOpen className="w-4 h-4" />
                  Open Folder
                </button>
                <button
                  onClick={onClose}
                  className="flex-1 py-3 bg-zinc-800 hover:bg-zinc-700 rounded-lg font-semibold text-zinc-300 transition-colors"
                >
                  Done
                </button>
              </div>
            </div>
          )}

          {state === 'error' && (
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="w-8 h-8 text-red-400" />
              </div>
              <p className="text-zinc-300 mb-2">Export Failed</p>
              <p className="text-sm text-red-400 mb-6">{error}</p>
              <div className="flex gap-3">
                <button
                  onClick={() => setState('idle')}
                  className="flex-1 py-3 bg-violet-600 hover:bg-violet-500 rounded-lg font-semibold text-white transition-colors"
                >
                  Try Again
                </button>
                <button
                  onClick={onClose}
                  className="flex-1 py-3 bg-zinc-800 hover:bg-zinc-700 rounded-lg font-semibold text-zinc-300 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
