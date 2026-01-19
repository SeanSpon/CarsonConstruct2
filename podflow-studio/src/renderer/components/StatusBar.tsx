import { memo, useMemo } from 'react';
import { useStore } from '../stores/store';
import { formatDuration } from '../types';
import { Circle, Loader2, Check, AlertCircle } from 'lucide-react';

function StatusBar() {
  const { project, isDetecting, detectionProgress, clips, deadSpaces, isExporting, exportProgress } = useStore();

  const { acceptedClips, totalClips, deadSpacesToRemove } = useMemo(() => ({
    acceptedClips: clips.filter(c => c.status === 'accepted').length,
    totalClips: clips.length,
    deadSpacesToRemove: deadSpaces.filter(ds => ds.remove).length,
  }), [clips, deadSpaces]);

  // Determine current status
  const status = useMemo(() => {
    if (isExporting && exportProgress) {
      return {
        icon: <Loader2 className="w-3 h-3 animate-spin" />,
        text: `Exporting ${exportProgress.current}/${exportProgress.total}...`,
        color: 'text-sz-accent',
        bgColor: 'bg-sz-accent-muted',
      };
    }
    if (isDetecting) {
      return {
        icon: <Loader2 className="w-3 h-3 animate-spin" />,
        text: detectionProgress?.message || 'Processing...',
        color: 'text-sz-accent',
        bgColor: 'bg-sz-accent-muted',
      };
    }
    if (acceptedClips > 0) {
      return {
        icon: <Check className="w-3 h-3" />,
        text: `${acceptedClips} clips ready`,
        color: 'text-sz-success',
        bgColor: 'bg-sz-success-muted',
      };
    }
    return {
      icon: <Circle className="w-2 h-2 fill-current" />,
      text: 'Ready',
      color: 'text-sz-text-muted',
      bgColor: '',
    };
  }, [isDetecting, isExporting, detectionProgress, exportProgress, acceptedClips]);

  return (
    <footer className="h-7 bg-sz-bg border-t border-sz-border px-3 flex items-center text-[11px] select-none">
      {/* Left section - Status indicator */}
      <div className="flex items-center gap-2 flex-1">
        <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded ${status.bgColor} ${status.color}`}>
          {status.icon}
          <span className="font-medium">{status.text}</span>
        </div>
      </div>

      {/* Center section - Project info */}
      {project && (
        <div className="flex items-center gap-3 text-sz-text-muted">
          <span className="text-sz-text-secondary font-medium">{project.fileName}</span>
          <span className="text-sz-border-light">|</span>
          <span>{formatDuration(project.duration)}</span>
          {totalClips > 0 && (
            <>
              <span className="text-sz-border-light">|</span>
              <span>
                <span className="text-sz-success">{acceptedClips}</span>
                <span className="text-sz-text-muted">/{totalClips} clips</span>
              </span>
            </>
          )}
          {deadSpacesToRemove > 0 && (
            <>
              <span className="text-sz-border-light">|</span>
              <span>{deadSpacesToRemove} cuts</span>
            </>
          )}
        </div>
      )}

      {/* Right section - Version */}
      <div className="flex-1 text-right text-sz-text-muted">
        <span className="opacity-50">v1.0.0</span>
      </div>
    </footer>
  );
}

export default memo(StatusBar);
