import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Scissors, Trash2, Undo2, ArrowRight, Clock, AlertCircle } from 'lucide-react';
import { useStore } from '../stores/store';
import { formatDuration } from '../types';
import DeadSpaceItem from '../components/DeadSpaceItem';

export default function AutoEdit() {
  const navigate = useNavigate();
  const { project, deadSpaces, clips, setAllDeadSpacesRemove } = useStore();

  // Redirect if no project
  useEffect(() => {
    if (!project) {
      navigate('/');
    }
  }, [project, navigate]);

  if (!project) return null;

  const toRemove = deadSpaces.filter((ds) => ds.remove);
  const toKeep = deadSpaces.filter((ds) => !ds.remove);
  
  const totalRemoveTime = toRemove.reduce((sum, ds) => sum + ds.duration, 0);
  const totalDeadTime = deadSpaces.reduce((sum, ds) => sum + ds.duration, 0);
  
  const acceptedClips = clips.filter((c) => c.status === 'accepted');

  // Show message if no detection has been run
  if (deadSpaces.length === 0 && clips.length === 0) {
    return (
      <div className="min-h-full flex flex-col items-center justify-center p-8">
        <div className="w-16 h-16 rounded-full bg-zinc-800 flex items-center justify-center mb-4">
          <Scissors className="w-8 h-8 text-zinc-500" />
        </div>
        <h2 className="text-xl font-bold text-zinc-100 mb-2">No Dead Spaces Detected</h2>
        <p className="text-zinc-400 text-center max-w-md mb-6">
          Run clip detection first to analyze your video for dead spaces.
        </p>
        <button
          onClick={() => navigate('/clips')}
          className="px-6 py-3 bg-violet-600 hover:bg-violet-500 text-white rounded-lg font-medium transition-colors"
        >
          Go to Clip Finder
        </button>
      </div>
    );
  }

  // Show message if detection ran but no dead spaces found
  if (deadSpaces.length === 0) {
    return (
      <div className="min-h-full flex flex-col items-center justify-center p-8">
        <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center mb-4">
          <Scissors className="w-8 h-8 text-emerald-500" />
        </div>
        <h2 className="text-xl font-bold text-zinc-100 mb-2">No Dead Spaces Found</h2>
        <p className="text-zinc-400 text-center max-w-md mb-6">
          Your video doesn't have any significant dead spaces (silence &gt; 3 seconds).
        </p>
        <button
          onClick={() => navigate('/export')}
          className="flex items-center gap-2 px-6 py-3 bg-violet-600 hover:bg-violet-500 text-white rounded-lg font-medium transition-colors"
        >
          Continue to Export
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-full">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-zinc-950/95 backdrop-blur border-b border-zinc-800">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-zinc-100">Auto Edit</h1>
              <p className="text-sm text-zinc-500">{project.fileName}</p>
            </div>

            <button
              onClick={() => navigate('/export')}
              className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-lg font-medium transition-colors"
            >
              Continue to Export
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Summary Card */}
      <div className="p-6">
        <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-6 mb-6">
          <div className="grid grid-cols-3 gap-6">
            {/* Total dead spaces */}
            <div>
              <div className="flex items-center gap-2 text-zinc-400 mb-1">
                <Clock className="w-4 h-4" />
                <span className="text-sm">Total Dead Space</span>
              </div>
              <p className="text-2xl font-bold text-zinc-100">
                {formatDuration(totalDeadTime)}
              </p>
              <p className="text-xs text-zinc-500 mt-1">
                {deadSpaces.length} silence{deadSpaces.length !== 1 ? 's' : ''} detected
              </p>
            </div>

            {/* To remove */}
            <div>
              <div className="flex items-center gap-2 text-red-400 mb-1">
                <Trash2 className="w-4 h-4" />
                <span className="text-sm">Removing</span>
              </div>
              <p className="text-2xl font-bold text-red-400">
                {formatDuration(totalRemoveTime)}
              </p>
              <p className="text-xs text-zinc-500 mt-1">
                {toRemove.length} silence{toRemove.length !== 1 ? 's' : ''} marked
              </p>
            </div>

            {/* New duration */}
            <div>
              <div className="flex items-center gap-2 text-emerald-400 mb-1">
                <Clock className="w-4 h-4" />
                <span className="text-sm">New Duration</span>
              </div>
              <p className="text-2xl font-bold text-emerald-400">
                {formatDuration(project.duration - totalRemoveTime)}
              </p>
              <p className="text-xs text-zinc-500 mt-1">
                {((totalRemoveTime / project.duration) * 100).toFixed(1)}% shorter
              </p>
            </div>
          </div>

          {/* Bulk actions */}
          <div className="flex items-center gap-3 mt-6 pt-4 border-t border-zinc-800">
            <button
              onClick={() => setAllDeadSpacesRemove(true)}
              className="px-4 py-2 text-sm bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg transition-colors"
            >
              Remove All
            </button>
            <button
              onClick={() => setAllDeadSpacesRemove(false)}
              className="px-4 py-2 text-sm bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg transition-colors"
            >
              Keep All
            </button>
          </div>
        </div>

        {/* Info box */}
        {acceptedClips.length > 0 && (
          <div className="flex items-start gap-3 p-4 bg-violet-500/10 border border-violet-500/20 rounded-xl mb-6">
            <AlertCircle className="w-5 h-5 text-violet-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-violet-300">
                You have {acceptedClips.length} accepted clip{acceptedClips.length !== 1 ? 's' : ''}.
              </p>
              <p className="text-xs text-violet-400/80 mt-1">
                Dead space removal applies to full video export only, not individual clips.
              </p>
            </div>
          </div>
        )}

        {/* Dead space list */}
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-3">
            Dead Spaces
          </h2>
          {deadSpaces.map((ds) => (
            <DeadSpaceItem key={ds.id} deadSpace={ds} />
          ))}
        </div>
      </div>
    </div>
  );
}
