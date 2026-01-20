import { memo, useState, useCallback } from 'react';
import { 
  Trash2, 
  Film, 
  ChevronRight,
  Upload,
  Sparkles,
  Zap,
} from 'lucide-react';
import { LoadingState } from '../ui';
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
      if (file.type.startsWith('video/') || /\.(mp4|mov|webm|mkv)$/i.test(file.name)) {
        onFileDrop(file.path);
      }
    }
  }, [onFileDrop]);

  const formatRelativeDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString();
  };

  return (
    <div 
      className="flex-1 flex bg-sz-bg"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Left Panel - Recent Projects */}
      <div className="w-72 bg-sz-bg-secondary border-r border-sz-border flex flex-col">
        <div className="p-5 border-b border-sz-border">
          <h2 className="text-xs font-semibold text-sz-text-muted uppercase tracking-wider">Recent</h2>
        </div>
        
        <div className="flex-1 overflow-y-auto">
          {recentProjects.length === 0 ? (
            <div className="p-5 text-center text-sz-text-muted text-sm">
              No recent projects
            </div>
          ) : (
            <div className="py-1">
              {recentProjects.slice(0, 10).map((recent) => (
                <div
                  key={recent.filePath}
                  className="flex items-center gap-3 px-4 py-2.5 hover:bg-sz-bg-tertiary transition-colors group"
                >
                  <div className="w-9 h-9 rounded bg-sz-bg-tertiary flex items-center justify-center flex-shrink-0">
                    <Film className="w-4 h-4 text-sz-text-muted" />
                  </div>
                  <button
                    onClick={() => onOpenRecent(recent.filePath)}
                    className="flex-1 text-left min-w-0"
                  >
                    <p className="text-sm text-sz-text truncate font-medium">
                      {recent.fileName}
                    </p>
                    <p className="text-xs text-sz-text-muted mt-0.5">
                      {formatRelativeDate(recent.lastOpened)} • {formatDuration(recent.duration)}
                    </p>
                  </button>
                  <ChevronRight className="w-4 h-4 text-sz-text-muted/50 opacity-0 group-hover:opacity-100 transition-opacity" />
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemoveRecent(recent.filePath);
                    }}
                    className="p-1.5 opacity-0 group-hover:opacity-100 hover:bg-sz-bg-hover rounded transition-all"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-sz-text-muted hover:text-sz-danger" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right Panel - Main Import Area */}
      <div className={`flex-1 flex flex-col items-center justify-center p-8 transition-all duration-200 ${isDragOver ? 'bg-sz-accent/5' : ''}`}>
        <div className="max-w-md w-full text-center space-y-6">
          {/* Header */}
          <div className="space-y-2">
            <div className="flex items-center justify-center gap-2">
              <Sparkles className="w-8 h-8 text-sz-accent" />
            </div>
            <h1 className="text-2xl font-bold text-sz-text">Find Viral Clips</h1>
            <p className="text-sz-text-muted">
              Drop your podcast video to find the best moments
            </p>
          </div>

          {/* Drop Zone */}
          <button
            onClick={onSelectFile}
            disabled={isLoading}
            className={`w-full aspect-[16/9] flex flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed transition-all ${
              isDragOver 
                ? 'border-sz-accent bg-sz-accent/10' 
                : 'border-sz-border hover:border-sz-accent/50 hover:bg-sz-bg-tertiary'
            } ${isLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
          >
            {isLoading ? (
              <LoadingState size="lg" message="Loading video..." />
            ) : (
              <>
                <div className={`w-16 h-16 rounded-full flex items-center justify-center transition-colors ${
                  isDragOver ? 'bg-sz-accent/20' : 'bg-sz-bg-tertiary'
                }`}>
                  <Upload className={`w-8 h-8 ${isDragOver ? 'text-sz-accent' : 'text-sz-text-muted'}`} />
                </div>
                <div>
                  <p className="text-sz-text font-medium">
                    {isDragOver ? 'Release to import' : 'Drop video here or click to browse'}
                  </p>
                  <p className="text-xs text-sz-text-muted mt-1">
                    MP4, MOV, MKV, WebM supported
                  </p>
                </div>
              </>
            )}
          </button>

          {/* Features */}
          <div className="flex items-center justify-center gap-6 text-xs text-sz-text-muted">
            <div className="flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-sz-accent" />
              <span>AI-Powered Detection</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-purple-400" />
              <span>Score & Rank Clips</span>
            </div>
          </div>

          {/* Error Display */}
          {error && (
            <div className="bg-sz-danger/10 border border-sz-danger/30 rounded-lg p-3">
              <p className="text-sm text-sz-danger">{error}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default memo(DropZone);
