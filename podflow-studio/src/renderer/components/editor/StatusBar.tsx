import { memo, useMemo } from 'react';
import { Zap } from 'lucide-react';
import { Button } from '../ui';
import type { Clip, Project } from '../../types';

interface StatusBarProps {
  project: Project | null;
  clips: Clip[];
  isDetecting: boolean;
  isExporting: boolean;
  onAnalyze: () => void;
  onExportAll: () => void;
}

function StatusBar({
  project,
  clips,
  isDetecting,
  isExporting,
  onAnalyze,
  onExportAll,
}: StatusBarProps) {
  const { acceptedCount, rejectedCount, pendingCount } = useMemo(() => ({
    acceptedCount: clips.filter(c => c.status === 'accepted').length,
    rejectedCount: clips.filter(c => c.status === 'rejected').length,
    pendingCount: clips.filter(c => c.status === 'pending').length,
  }), [clips]);

  const statusText = useMemo(() => {
    if (isDetecting) return 'Analyzing...';
    if (isExporting) return 'Exporting...';
    if (!project) return 'Ready';
    if (clips.length === 0) return 'Ready to analyze';
    return 'Ready';
  }, [project, clips.length, isDetecting, isExporting]);

  const statusColor = useMemo(() => {
    if (isDetecting || isExporting) return 'bg-sz-warning';
    return 'bg-sz-success';
  }, [isDetecting, isExporting]);

  return (
    <footer className="h-8 bg-sz-bg-secondary border-t border-sz-border flex items-center justify-between px-4 text-xs select-none">
      {/* Left: Status */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <div className={`w-2 h-2 rounded-full ${statusColor}`} />
          <span className="text-sz-text-secondary">{statusText}</span>
        </div>
        
        {clips.length > 0 && (
          <div className="flex items-center gap-2 text-sz-text-muted">
            <span>•</span>
            <span>{clips.length} clips</span>
            {acceptedCount > 0 && (
              <>
                <span>•</span>
                <span className="text-sz-success">{acceptedCount} accepted</span>
              </>
            )}
            {rejectedCount > 0 && (
              <>
                <span>•</span>
                <span className="text-sz-text-muted">{rejectedCount} rejected</span>
              </>
            )}
            {pendingCount > 0 && (
              <>
                <span>•</span>
                <span className="text-sz-warning">{pendingCount} pending</span>
              </>
            )}
          </div>
        )}
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-2">
        {project && clips.length === 0 && !isDetecting && (
          <Button
            variant="primary"
            size="xs"
            leftIcon={<Zap className="w-3 h-3" />}
            onClick={onAnalyze}
          >
            Analyze
          </Button>
        )}
        
        {acceptedCount > 0 && !isExporting && (
          <Button
            variant="primary"
            size="xs"
            onClick={onExportAll}
          >
            Export All ({acceptedCount})
          </Button>
        )}
      </div>
    </footer>
  );
}

export default memo(StatusBar);
