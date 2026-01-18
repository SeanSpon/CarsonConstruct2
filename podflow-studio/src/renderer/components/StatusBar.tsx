import { useStore } from '../stores/store';
import { formatDuration, formatFileSize } from '../types';
import { CheckCircle2, Loader2, AlertCircle, FileVideo } from 'lucide-react';

export default function StatusBar() {
  const { project, isDetecting, detectionProgress, clips, deadSpaces, isExporting } = useStore();

  const acceptedClips = clips.filter(c => c.status === 'accepted').length;
  const totalClips = clips.length;
  const deadSpacesToRemove = deadSpaces.filter(ds => ds.remove).length;

  // Determine current status
  let statusIcon = <FileVideo className="w-3.5 h-3.5 text-zinc-500" />;
  let statusText = 'Ready';
  let statusColor = 'text-zinc-500';

  if (isDetecting) {
    statusIcon = <Loader2 className="w-3.5 h-3.5 text-violet-400 animate-spin" />;
    statusText = detectionProgress?.message || 'Analyzing...';
    statusColor = 'text-violet-400';
  } else if (isExporting) {
    statusIcon = <Loader2 className="w-3.5 h-3.5 text-emerald-400 animate-spin" />;
    statusText = 'Exporting...';
    statusColor = 'text-emerald-400';
  } else if (totalClips > 0) {
    statusIcon = <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />;
    statusText = `${acceptedClips}/${totalClips} clips accepted`;
    statusColor = 'text-emerald-400';
  }

  return (
    <footer className="h-8 bg-zinc-900 border-t border-zinc-800 px-4 flex items-center text-xs">
      {/* Project info */}
      <div className="flex items-center gap-4 flex-1">
        {project ? (
          <>
            <div className="flex items-center gap-2 text-zinc-400">
              <FileVideo className="w-3.5 h-3.5" />
              <span className="font-medium text-zinc-300">{project.fileName}</span>
            </div>
            <span className="text-zinc-600">•</span>
            <span className="text-zinc-500">{formatDuration(project.duration)}</span>
            <span className="text-zinc-600">•</span>
            <span className="text-zinc-500">{formatFileSize(project.size)}</span>
          </>
        ) : (
          <span className="text-zinc-500">No project loaded</span>
        )}
      </div>

      {/* Stats */}
      {totalClips > 0 && (
        <div className="flex items-center gap-4 mr-4">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="text-zinc-400">{acceptedClips} accepted</span>
          </div>
          {deadSpacesToRemove > 0 && (
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-red-500" />
              <span className="text-zinc-400">{deadSpacesToRemove} dead spaces</span>
            </div>
          )}
        </div>
      )}

      {/* Status */}
      <div className={`flex items-center gap-1.5 ${statusColor}`}>
        {statusIcon}
        <span>{statusText}</span>
      </div>
    </footer>
  );
}
