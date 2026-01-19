import { memo, useState, useCallback } from 'react';
import { FileVideo, Upload, Clock, Trash2 } from 'lucide-react';
import { Button, LoadingState } from '../ui';
import { formatDuration } from '../../types';

interface RecentProject {
  filePath: string;
  fileName: string;
  duration: number;
  lastOpened: number;
}

interface DropZoneProps {
  isLoading: boolean;
  error: string | null;
  recentProjects: RecentProject[];
  onSelectFile: () => void;
  onOpenRecent: (filePath: string) => void;
  onRemoveRecent: (filePath: string) => void;
  onFileDrop: (filePath: string) => void;
}

function DropZone({
  isLoading,
  error,
  recentProjects,
  onSelectFile,
  onOpenRecent,
  onRemoveRecent,
  onFileDrop,
}: DropZoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];
      // Check if it's a video file
      if (file.type.startsWith('video/') || /\.(mp4|mov|webm|mkv)$/i.test(file.name)) {
        onFileDrop(file.path);
      }
    }
  }, [onFileDrop]);

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 bg-sz-bg">
      <div className="w-full max-w-xl">
        {/* Logo & Brand */}
        <div className="text-center mb-10">
          <div className="flex items-center justify-center gap-0 mb-4">
            <span className="text-4xl font-bold text-sz-text tracking-wide">SEE</span>
            <span className="mx-2 px-3 py-1.5 bg-sz-accent rounded text-sm font-bold text-white tracking-wide">
              STUDIO
            </span>
            <span className="text-4xl font-bold text-sz-text tracking-wide">ZEE</span>
          </div>
          <h2 className="text-xl font-semibold text-sz-text mb-2">Clip Studios</h2>
          <p className="text-sz-text-secondary text-sm">
            AI-powered clip detection for content creators
          </p>
        </div>

        {/* Drop Zone */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`
            w-full border-2 border-dashed rounded-sz-lg p-12 text-center 
            transition-all duration-200 group
            ${isLoading
              ? 'border-sz-border bg-sz-bg-secondary'
              : isDragOver
                ? 'border-sz-accent bg-sz-accent-muted scale-[1.02]'
                : 'border-sz-border-light hover:border-sz-accent/50 hover:bg-sz-bg-secondary bg-sz-bg'
            }
          `}
        >
          {isLoading ? (
            <div className="flex flex-col items-center gap-4">
              <LoadingState message="Reading file..." size="lg" />
            </div>
          ) : (
            <div className="flex flex-col items-center gap-4">
              <div className={`
                w-16 h-16 rounded-sz-lg flex items-center justify-center transition-all duration-200
                ${isDragOver 
                  ? 'bg-sz-accent text-sz-bg scale-110' 
                  : 'bg-sz-bg-tertiary text-sz-text-muted group-hover:bg-sz-bg-hover group-hover:text-sz-accent'
                }
              `}>
                <FileVideo className="w-8 h-8" />
              </div>
              <div>
                <p className="text-lg font-medium text-sz-text mb-1">
                  {isDragOver ? 'Drop your video here' : 'Drop your podcast video'}
                </p>
                <p className="text-sm text-sz-text-muted">
                  or click to browse • MP4, MOV, WEBM, MKV supported
                </p>
              </div>
              <Button
                variant="primary"
                size="lg"
                leftIcon={<Upload className="w-4 h-4" />}
                className="mt-2"
                onClick={onSelectFile}
                disabled={isLoading}
              >
                Select File
              </Button>
            </div>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="mt-4 bg-sz-danger-muted border border-sz-danger/30 rounded-sz p-4">
            <p className="text-sm text-sz-danger">{error}</p>
          </div>
        )}

        {/* Recent Projects */}
        {recentProjects.length > 0 && (
          <div className="mt-10">
            <div className="flex items-center gap-2 mb-3">
              <Clock className="w-4 h-4 text-sz-text-muted" />
              <span className="text-xs font-medium text-sz-text-muted uppercase tracking-wider">
                Recent Projects
              </span>
            </div>
            <div className="space-y-1.5">
              {recentProjects.slice(0, 5).map((recent) => (
                <div
                  key={recent.filePath}
                  className="flex items-center gap-3 p-3 rounded-sz bg-sz-bg-secondary hover:bg-sz-bg-tertiary transition-colors group border border-transparent hover:border-sz-border"
                >
                  <div className="w-10 h-10 rounded-sz bg-sz-bg-tertiary group-hover:bg-sz-bg-hover flex items-center justify-center flex-shrink-0 transition-colors">
                    <FileVideo className="w-5 h-5 text-sz-text-muted group-hover:text-sz-accent transition-colors" />
                  </div>
                  <button
                    onClick={() => onOpenRecent(recent.filePath)}
                    className="flex-1 text-left min-w-0"
                  >
                    <p className="text-sm text-sz-text font-medium truncate">
                      {recent.fileName}
                    </p>
                    <p className="text-xs text-sz-text-muted">
                      {formatDuration(recent.duration)} • {new Date(recent.lastOpened).toLocaleDateString()}
                    </p>
                  </button>
                  <button
                    onClick={() => onRemoveRecent(recent.filePath)}
                    className="p-2 opacity-0 group-hover:opacity-100 hover:bg-sz-bg-hover rounded-sz transition-all"
                  >
                    <Trash2 className="w-4 h-4 text-sz-text-muted hover:text-sz-danger" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default memo(DropZone);
