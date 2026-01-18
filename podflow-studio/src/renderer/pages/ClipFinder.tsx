import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Play, AlertCircle, Check, X, Filter, ArrowRight } from 'lucide-react';
import { useStore } from '../stores/store';
import SettingsPanel from '../components/SettingsPanel';
import ProgressBar from '../components/ProgressBar';
import ClipCard from '../components/ClipCard';

type FilterStatus = 'all' | 'pending' | 'accepted' | 'rejected';

export default function ClipFinder() {
  const navigate = useNavigate();
  const {
    project,
    clips,
    isDetecting,
    detectionProgress,
    detectionError,
    settings,
    setDetecting,
    setDetectionError,
  } = useStore();

  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [hasStartedDetection, setHasStartedDetection] = useState(false);

  // Redirect if no project
  useEffect(() => {
    if (!project) {
      navigate('/');
    }
  }, [project, navigate]);

  const handleStartDetection = async () => {
    if (!project) return;

    setDetecting(true);
    setDetectionError(null);
    setHasStartedDetection(true);

    try {
      const result = await window.api.startDetection(
        `project_${Date.now()}`,
        project.filePath,
        settings
      );

      if (!result.success) {
        setDetectionError(result.error || 'Failed to start detection');
      }
    } catch (err) {
      setDetectionError(String(err));
      setDetecting(false);
    }
  };

  const handleCancelDetection = async () => {
    await window.api.cancelDetection(`project_${Date.now()}`);
    setDetecting(false);
  };

  // Filter clips
  const filteredClips = clips.filter((clip) => {
    if (filterStatus === 'all') return true;
    return clip.status === filterStatus;
  });

  const acceptedCount = clips.filter((c) => c.status === 'accepted').length;
  const rejectedCount = clips.filter((c) => c.status === 'rejected').length;
  const pendingCount = clips.filter((c) => c.status === 'pending').length;

  if (!project) return null;

  // Show initial state (no detection started yet)
  const showInitialState = !hasStartedDetection && clips.length === 0 && !isDetecting;

  return (
    <div className="min-h-full">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-zinc-950/95 backdrop-blur border-b border-zinc-800">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-zinc-100">Clip Finder</h1>
              <p className="text-sm text-zinc-500">{project.fileName}</p>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-3">
              {clips.length > 0 && !isDetecting && (
                <>
                  <button
                    onClick={handleStartDetection}
                    className="px-4 py-2 text-sm text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded-lg transition-colors"
                  >
                    Re-analyze
                  </button>
                  <button
                    onClick={() => navigate('/edit')}
                    className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-lg font-medium transition-colors"
                  >
                    Continue to Edit
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Stats bar */}
          {clips.length > 0 && (
            <div className="flex items-center gap-6 mt-4">
              <button
                onClick={() => setFilterStatus('all')}
                className={`flex items-center gap-2 text-sm ${
                  filterStatus === 'all' ? 'text-violet-400' : 'text-zinc-400 hover:text-zinc-300'
                }`}
              >
                <Filter className="w-4 h-4" />
                All ({clips.length})
              </button>
              <button
                onClick={() => setFilterStatus('accepted')}
                className={`flex items-center gap-2 text-sm ${
                  filterStatus === 'accepted' ? 'text-emerald-400' : 'text-zinc-400 hover:text-zinc-300'
                }`}
              >
                <Check className="w-4 h-4" />
                Accepted ({acceptedCount})
              </button>
              <button
                onClick={() => setFilterStatus('rejected')}
                className={`flex items-center gap-2 text-sm ${
                  filterStatus === 'rejected' ? 'text-red-400' : 'text-zinc-400 hover:text-zinc-300'
                }`}
              >
                <X className="w-4 h-4" />
                Rejected ({rejectedCount})
              </button>
              <button
                onClick={() => setFilterStatus('pending')}
                className={`flex items-center gap-2 text-sm ${
                  filterStatus === 'pending' ? 'text-zinc-200' : 'text-zinc-400 hover:text-zinc-300'
                }`}
              >
                Pending ({pendingCount})
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Main content */}
      <div className="p-6">
        {/* Initial state - show settings and start button */}
        {showInitialState && (
          <div className="max-w-xl mx-auto space-y-6">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-zinc-100 mb-2">Find Viral Clips</h2>
              <p className="text-zinc-400">
                Configure detection settings and start the analysis
              </p>
            </div>

            <SettingsPanel />

            <button
              onClick={handleStartDetection}
              className="w-full py-4 bg-violet-600 hover:bg-violet-500 rounded-xl font-semibold text-white text-lg transition-colors flex items-center justify-center gap-2"
            >
              <Play className="w-5 h-5" />
              Find Clips
            </button>
          </div>
        )}

        {/* Detection in progress */}
        {isDetecting && detectionProgress && (
          <div className="max-w-xl mx-auto">
            <ProgressBar
              percent={detectionProgress.percent}
              message={detectionProgress.message}
              onCancel={handleCancelDetection}
            />
          </div>
        )}

        {/* Error state */}
        {detectionError && !isDetecting && (
          <div className="max-w-xl mx-auto mb-6">
            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-red-400 font-medium">Detection Failed</p>
                <p className="text-red-300/80 text-sm mt-1">{detectionError}</p>
                <button
                  onClick={handleStartDetection}
                  className="mt-3 px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg text-sm transition-colors"
                >
                  Try Again
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Clips grid */}
        {clips.length > 0 && !isDetecting && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredClips.map((clip) => (
              <ClipCard key={clip.id} clip={clip} videoPath={project.filePath} />
            ))}
          </div>
        )}

        {/* Empty state after filtering */}
        {clips.length > 0 && filteredClips.length === 0 && (
          <div className="text-center py-16">
            <p className="text-zinc-400">No clips match the current filter</p>
            <button
              onClick={() => setFilterStatus('all')}
              className="mt-2 text-violet-400 hover:text-violet-300"
            >
              Show all clips
            </button>
          </div>
        )}

        {/* No clips found state */}
        {hasStartedDetection && clips.length === 0 && !isDetecting && !detectionError && (
          <div className="text-center py-16">
            <p className="text-zinc-400 mb-2">No clips detected</p>
            <p className="text-zinc-500 text-sm mb-4">
              Try adjusting the settings and run detection again
            </p>
            <button
              onClick={() => setHasStartedDetection(false)}
              className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg"
            >
              Adjust Settings
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
