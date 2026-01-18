import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Package, FolderOpen, Loader2, CheckCircle2, AlertCircle, Film, Scissors, Zap, Settings2 } from 'lucide-react';
import { useStore } from '../stores/store';
import { formatDuration } from '../types';

export default function Export() {
  const navigate = useNavigate();
  const {
    project,
    clips,
    deadSpaces,
    exportSettings,
    updateExportSettings,
    isExporting,
    exportProgress,
    lastExportDir,
    setExporting,
  } = useStore();

  const [outputDir, setOutputDir] = useState<string | null>(lastExportDir);
  const [exportComplete, setExportComplete] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  // Redirect if no project
  useEffect(() => {
    if (!project) {
      navigate('/');
    }
  }, [project, navigate]);

  const acceptedClips = clips.filter((c) => c.status === 'accepted');
  const deadSpacesToRemove = deadSpaces.filter((ds) => ds.remove);
  const totalClipDuration = acceptedClips.reduce((sum, c) => {
    const actualDuration = (c.endTime + c.trimEndOffset) - (c.startTime + c.trimStartOffset);
    return sum + actualDuration;
  }, 0);
  const deadSpaceTime = deadSpacesToRemove.reduce((sum, ds) => sum + ds.duration, 0);

  const handleSelectOutputDir = async () => {
    const dir = await window.api.selectOutputDir();
    if (dir) {
      setOutputDir(dir);
    }
  };

  const handleExport = async () => {
    if (!outputDir || !project) return;

    setExporting(true);
    setExportComplete(false);
    setExportError(null);

    try {
      const result = await window.api.exportClips({
        sourceFile: project.filePath,
        clips: acceptedClips.map((c) => ({
          id: c.id,
          startTime: c.startTime,
          endTime: c.endTime,
          trimStartOffset: c.trimStartOffset,
          trimEndOffset: c.trimEndOffset,
          title: c.title,
          hookText: c.hookText,
          category: c.category,
        })),
        deadSpaces: deadSpacesToRemove.map((ds) => ({
          id: ds.id,
          startTime: ds.startTime,
          endTime: ds.endTime,
          remove: ds.remove,
        })),
        outputDir,
        settings: exportSettings,
      });

      if (result.success) {
        setExportComplete(true);
      } else {
        setExportError(result.error || 'Export failed');
      }
    } catch (err) {
      setExportError(String(err));
    } finally {
      setExporting(false);
    }
  };

  const handleOpenFolder = async () => {
    if (outputDir) {
      await window.api.openFolder(outputDir);
    }
  };

  if (!project) return null;

  const canExport = outputDir && (
    (exportSettings.exportClips && acceptedClips.length > 0) ||
    (exportSettings.exportFullVideo)
  );

  return (
    <div className="min-h-full">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-zinc-950/95 backdrop-blur border-b border-zinc-800">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-zinc-100">Export</h1>
              <p className="text-sm text-zinc-500">{project.fileName}</p>
            </div>
          </div>
        </div>
      </header>

      <div className="p-6 max-w-3xl mx-auto">
        {/* Export Complete State */}
        {exportComplete && (
          <div className="mb-6 p-6 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-full bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                <CheckCircle2 className="w-6 h-6 text-emerald-400" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-emerald-400 mb-1">Export Complete!</h3>
                <p className="text-sm text-emerald-300/80 mb-4">
                  Your files have been exported successfully.
                </p>
                <button
                  onClick={handleOpenFolder}
                  className="flex items-center gap-2 px-4 py-2 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 rounded-lg transition-colors"
                >
                  <FolderOpen className="w-4 h-4" />
                  Open Folder
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Export Error State */}
        {exportError && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-red-400 font-medium">Export Failed</p>
              <p className="text-red-300/80 text-sm mt-1">{exportError}</p>
            </div>
          </div>
        )}

        {/* Export Progress */}
        {isExporting && exportProgress && (
          <div className="mb-6 bg-zinc-900 rounded-xl border border-zinc-800 p-6">
            <div className="flex items-center gap-3 mb-4">
              <Loader2 className="w-5 h-5 text-violet-500 animate-spin" />
              <span className="font-medium text-zinc-200">
                Exporting {exportProgress.current} of {exportProgress.total}...
              </span>
            </div>
            <div className="h-3 bg-zinc-800 rounded-full overflow-hidden mb-2">
              <div 
                className="h-full bg-gradient-to-r from-violet-600 to-fuchsia-600 transition-all duration-300"
                style={{ width: `${(exportProgress.current / exportProgress.total) * 100}%` }}
              />
            </div>
            <p className="text-sm text-zinc-400">{exportProgress.clipName}</p>
          </div>
        )}

        {/* What to Export */}
        <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-6 mb-6">
          <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-4">
            What to Export
          </h2>

          {/* Export Clips Option */}
          <label className="flex items-start gap-4 p-4 rounded-lg hover:bg-zinc-800/50 cursor-pointer mb-3">
            <input
              type="checkbox"
              checked={exportSettings.exportClips}
              onChange={(e) => updateExportSettings({ exportClips: e.target.checked })}
              className="w-5 h-5 mt-0.5 rounded border-zinc-600 bg-zinc-800 text-violet-500 focus:ring-violet-500"
            />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <Film className="w-4 h-4 text-violet-400" />
                <span className="font-medium text-zinc-200">Export Accepted Clips</span>
              </div>
              <p className="text-sm text-zinc-500 mt-1">
                {acceptedClips.length} clip{acceptedClips.length !== 1 ? 's' : ''} • {formatDuration(totalClipDuration)} total
              </p>
              {acceptedClips.length === 0 && (
                <p className="text-xs text-amber-400 mt-1">
                  No clips accepted yet - go back to Clip Finder
                </p>
              )}
            </div>
          </label>

          {/* Export Full Video Option */}
          <label className="flex items-start gap-4 p-4 rounded-lg hover:bg-zinc-800/50 cursor-pointer">
            <input
              type="checkbox"
              checked={exportSettings.exportFullVideo}
              onChange={(e) => updateExportSettings({ exportFullVideo: e.target.checked })}
              className="w-5 h-5 mt-0.5 rounded border-zinc-600 bg-zinc-800 text-violet-500 focus:ring-violet-500"
            />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <Scissors className="w-4 h-4 text-emerald-400" />
                <span className="font-medium text-zinc-200">Export Full Video (Dead Space Removed)</span>
              </div>
              <p className="text-sm text-zinc-500 mt-1">
                Removes {deadSpacesToRemove.length} dead space{deadSpacesToRemove.length !== 1 ? 's' : ''} • {formatDuration(deadSpaceTime)} cut
              </p>
              {deadSpacesToRemove.length === 0 && (
                <p className="text-xs text-zinc-500 mt-1">
                  No dead spaces marked for removal
                </p>
              )}
            </div>
          </label>
        </div>

        {/* Export Settings */}
        <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-6 mb-6">
          <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-4 flex items-center gap-2">
            <Settings2 className="w-4 h-4" />
            Settings
          </h2>

          {/* Format */}
          <div className="mb-5">
            <label className="text-sm text-zinc-400 mb-2 block">Format</label>
            <div className="flex gap-3">
              <button
                onClick={() => updateExportSettings({ format: 'mp4' })}
                className={`flex-1 py-3 rounded-lg font-medium transition-colors ${
                  exportSettings.format === 'mp4'
                    ? 'bg-violet-600 text-white'
                    : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                }`}
              >
                MP4
              </button>
              <button
                onClick={() => updateExportSettings({ format: 'mov' })}
                className={`flex-1 py-3 rounded-lg font-medium transition-colors ${
                  exportSettings.format === 'mov'
                    ? 'bg-violet-600 text-white'
                    : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                }`}
              >
                MOV
              </button>
            </div>
          </div>

          {/* Mode */}
          <div>
            <label className="text-sm text-zinc-400 mb-2 block">Export Mode</label>
            <div className="flex gap-3">
              <button
                onClick={() => updateExportSettings({ mode: 'fast' })}
                className={`flex-1 p-4 rounded-lg text-left transition-colors ${
                  exportSettings.mode === 'fast'
                    ? 'bg-violet-600/20 border border-violet-500/50'
                    : 'bg-zinc-800 border border-transparent hover:bg-zinc-700'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Zap className={`w-4 h-4 ${exportSettings.mode === 'fast' ? 'text-violet-400' : 'text-zinc-400'}`} />
                  <span className={`font-medium ${exportSettings.mode === 'fast' ? 'text-violet-300' : 'text-zinc-300'}`}>
                    Fast
                  </span>
                </div>
                <p className="text-xs text-zinc-500">
                  Stream copy (keyframe cuts). Timing may drift a few frames at boundaries.
                </p>
              </button>
              <button
                onClick={() => updateExportSettings({ mode: 'accurate' })}
                className={`flex-1 p-4 rounded-lg text-left transition-colors ${
                  exportSettings.mode === 'accurate'
                    ? 'bg-violet-600/20 border border-violet-500/50'
                    : 'bg-zinc-800 border border-transparent hover:bg-zinc-700'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <CheckCircle2 className={`w-4 h-4 ${exportSettings.mode === 'accurate' ? 'text-violet-400' : 'text-zinc-400'}`} />
                  <span className={`font-medium ${exportSettings.mode === 'accurate' ? 'text-violet-300' : 'text-zinc-300'}`}>
                    Accurate
                  </span>
                </div>
                <p className="text-xs text-zinc-500">
                  Re-encode for frame-accurate cuts. Slower but frame-perfect.
                </p>
              </button>
            </div>
          </div>
        </div>

        {/* Output Directory */}
        <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-6 mb-6">
          <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-4">
            Output Location
          </h2>

          <button
            onClick={handleSelectOutputDir}
            className="w-full p-4 border-2 border-dashed border-zinc-700 hover:border-violet-500 rounded-lg text-left transition-colors"
          >
            {outputDir ? (
              <div>
                <p className="text-sm text-zinc-300 font-medium">Selected folder:</p>
                <p className="text-xs text-zinc-500 mt-1 truncate">{outputDir}</p>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <FolderOpen className="w-5 h-5 text-zinc-500" />
                <div>
                  <p className="text-sm text-zinc-300">Choose output folder</p>
                  <p className="text-xs text-zinc-500">Click to select where to save exported files</p>
                </div>
              </div>
            )}
          </button>
        </div>

        {/* Export Button */}
        <button
          onClick={handleExport}
          disabled={!canExport || isExporting}
          className={`
            w-full py-4 rounded-xl font-semibold text-lg flex items-center justify-center gap-2 transition-colors
            ${canExport && !isExporting
              ? 'bg-violet-600 hover:bg-violet-500 text-white'
              : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
            }
          `}
        >
          {isExporting ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Exporting...
            </>
          ) : (
            <>
              <Package className="w-5 h-5" />
              Export
            </>
          )}
        </button>

        {!canExport && !isExporting && (
          <p className="text-center text-sm text-zinc-500 mt-3">
            {!outputDir 
              ? 'Select an output folder to continue' 
              : 'Select at least one export option'
            }
          </p>
        )}
      </div>
    </div>
  );
}
