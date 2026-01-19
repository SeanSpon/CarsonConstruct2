import { memo, useMemo, useState, useCallback } from 'react';
import { Film, Monitor, CheckCircle2 } from 'lucide-react';
import { Button } from '../ui';
import { formatDuration } from '../../types';
import type { Clip, Project } from '../../types';

interface StatusBarProps {
  project: Project | null;
  clips: Clip[];
  isDetecting: boolean;
  isExporting: boolean;
  onExportAll: () => void;
}

function StatusBar({
  project,
  clips,
  isDetecting,
  isExporting,
  onExportAll,
}: StatusBarProps) {
  const [nleExporting, setNleExporting] = useState(false);
  const [nleExported, setNleExported] = useState(false);

  const { acceptedCount, rejectedCount, pendingCount, acceptedClips } = useMemo(() => ({
    acceptedCount: clips.filter(c => c.status === 'accepted').length,
    rejectedCount: clips.filter(c => c.status === 'rejected').length,
    pendingCount: clips.filter(c => c.status === 'pending').length,
    acceptedClips: clips.filter(c => c.status === 'accepted'),
  }), [clips]);

  // Quick export to Premiere Pro (all formats)
  const handleQuickPremiereExport = useCallback(async () => {
    if (!project || acceptedClips.length === 0) return;

    setNleExporting(true);
    setNleExported(false);

    try {
      const outputDir = await window.api.selectOutputDir();
      if (!outputDir) {
        setNleExporting(false);
        return;
      }

      const nleClips = acceptedClips.map((c) => ({
        id: c.id,
        name: c.title || `Clip ${c.id}`,
        startTime: c.startTime,
        endTime: c.endTime,
        duration: c.duration,
        pattern: c.pattern,
        finalScore: c.finalScore,
        category: c.category,
        hookText: c.hookText,
        trimStartOffset: c.trimStartOffset,
        trimEndOffset: c.trimEndOffset,
      }));

      const result = await window.api.exportAllNleFormats({
        sourceFile: project.filePath,
        sequenceName: project.fileName.replace(/\.[^/.]+$/, ''),
        clips: nleClips,
        deadSpaces: [],
        outputDir,
        frameRate: project.fps || 30,
        dropFrame: project.fps === 29.97 || project.fps === 59.94,
        videoDuration: project.duration,
        videoWidth: project.width,
        videoHeight: project.height,
      });

      if (result.success) {
        setNleExported(true);
        // Open the folder
        await window.api.openFolder(outputDir);
        // Reset after 3 seconds
        setTimeout(() => setNleExported(false), 3000);
      }
    } catch (err) {
      console.error('Premiere export failed:', err);
    } finally {
      setNleExporting(false);
    }
  }, [project, acceptedClips]);

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
      {/* Left: Status + Video Metadata */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <div className={`w-2 h-2 rounded-full ${statusColor}`} />
          <span className="text-sz-text-secondary">{statusText}</span>
        </div>
        
        {/* Video metadata */}
        {project && (
          <div className="flex items-center gap-2 text-sz-text-muted">
            <span>•</span>
            <Film className="w-3 h-3" />
            <span>{formatDuration(project.duration)}</span>
            {project.resolution && (
              <>
                <span>•</span>
                <span>{project.resolution}</span>
              </>
            )}
            {project.fps && (
              <>
                <span>•</span>
                <span>{project.fps}fps</span>
              </>
            )}
          </div>
        )}
        
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
        {acceptedCount > 0 && !isExporting && !nleExporting && (
          <>
            {/* Quick Premiere Export Button */}
            <Button
              variant="ghost"
              size="xs"
              leftIcon={nleExported ? <CheckCircle2 className="w-3 h-3 text-sz-success" /> : <Monitor className="w-3 h-3" />}
              onClick={handleQuickPremiereExport}
              disabled={nleExporting}
              className={nleExported ? 'text-sz-success' : ''}
            >
              {nleExported ? 'Exported!' : 'Premiere'}
            </Button>
            
            {/* Export All Button */}
            <Button
              variant="primary"
              size="xs"
              onClick={onExportAll}
            >
              Export All ({acceptedCount})
            </Button>
          </>
        )}
        
        {nleExporting && (
          <span className="text-xs text-sz-text-muted animate-pulse">
            Exporting to Premiere...
          </span>
        )}
      </div>
    </footer>
  );
}

export default memo(StatusBar);
