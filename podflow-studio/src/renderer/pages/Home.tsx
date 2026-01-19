import { useState, useCallback, memo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileVideo, Plus, FolderOpen, Trash2, ArrowRight, ChevronRight, Film } from 'lucide-react';
import { useStore } from '../stores/store';
import { formatFileSize, formatDuration } from '../types';
import { Button, LoadingState } from '../components/ui';

function Home() {
  const navigate = useNavigate();
  const {
    project,
    clips,
    setProject,
    clearProject,
    recentProjects,
    removeRecentProject,
  } = useStore();

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSelectFile = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const file = await window.api.selectFile();

      if (!file) {
        setIsLoading(false);
        return;
      }

      const validation = await window.api.validateFile(file.path);

      if (!validation.valid) {
        setError(validation.error || 'Invalid video file');
        setIsLoading(false);
        return;
      }

      setProject({
        filePath: file.path,
        fileName: file.name,
        size: file.size,
        duration: validation.duration || 0,
      });
    } catch (err) {
      setError(String(err));
    } finally {
      setIsLoading(false);
    }
  }, [setProject]);

  const handleOpenRecent = useCallback(async (filePath: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const validation = await window.api.validateFile(filePath);

      if (!validation.valid) {
        setError('File no longer exists or is invalid');
        removeRecentProject(filePath);
        setIsLoading(false);
        return;
      }

      const fileName = filePath.split(/[\\/]/).pop() || 'Unknown';

      setProject({
        filePath,
        fileName,
        size: 0,
        duration: validation.duration || 0,
      });
    } catch (err) {
      setError(String(err));
    } finally {
      setIsLoading(false);
    }
  }, [removeRecentProject, setProject]);

  const handleAnalyze = useCallback(() => {
    if (project) {
      navigate('/clips');
    }
  }, [project, navigate]);

  const handleClear = useCallback(() => {
    clearProject();
    setError(null);
  }, [clearProject]);

  // Format relative date for recent projects
  const formatRelativeDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString();
  };

  // Auto-restore session: navigate to last route if project exists
  useEffect(() => {
    const state = useStore.getState();
    if (project && state.lastRoute && state.lastRoute !== '/') {
      // Validate project file still exists before navigating
      window.api.validateFile(project.filePath).then((validation) => {
        if (validation.valid) {
          console.log('[Home] Restoring session, navigating to:', state.lastRoute);
          navigate(state.lastRoute);
        } else {
          // File no longer exists, clear project
          useStore.getState().clearProject();
        }
      }).catch(() => {
        // Error validating, clear project
        useStore.getState().clearProject();
      });
    } else if (project && clips.length > 0) {
      // Project has clips, navigate to edit page
      navigate('/edit');
    } else if (project) {
      // Project exists but no clips, navigate to clips page
      navigate('/clips');
    }
  }, [project, navigate]);

  return (
    <div className="min-h-full flex bg-sz-bg">
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
                <RecentProjectItem
                  key={recent.filePath}
                  recent={recent}
                  onOpen={handleOpenRecent}
                  onRemove={removeRecentProject}
                  formatRelativeDate={formatRelativeDate}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right Panel - Main Content */}
      <div className="flex-1 flex flex-col items-center justify-center p-12">
        {!project ? (
          <>
            {/* Logo */}
            <div className="mb-10 text-center">
              <div className="flex items-center justify-center gap-0 mb-3">
                <span className="text-2xl font-bold text-sz-text tracking-wide">SEE</span>
                <span className="mx-2 px-2 py-0.5 bg-sz-accent rounded text-xs font-bold text-white tracking-wide">
                  STUDIO
                </span>
                <span className="text-2xl font-bold text-sz-text tracking-wide">ZEE</span>
              </div>
              <p className="text-sz-text-muted text-sm">AI-powered clip detection for content creators</p>
            </div>

            {/* Action Buttons */}
            <div className="w-full max-w-sm space-y-3">
              {/* New Project Button */}
              <button
                onClick={handleSelectFile}
                disabled={isLoading}
                className="w-full flex items-center gap-4 p-4 bg-sz-accent hover:bg-sz-accent-hover rounded-sz-lg transition-colors group"
              >
                <div className="w-11 h-11 rounded-sz bg-white/10 flex items-center justify-center">
                  {isLoading ? (
                    <LoadingState size="sm" />
                  ) : (
                    <Plus className="w-5 h-5 text-white" />
                  )}
                </div>
                <div className="text-left">
                  <p className="font-semibold text-white">New Project</p>
                  <p className="text-xs text-white/60">Import a video or audio file to analyze</p>
                </div>
              </button>

              {/* Open File Button */}
              <button
                onClick={handleSelectFile}
                disabled={isLoading}
                className="w-full flex items-center gap-4 p-4 bg-sz-bg-secondary hover:bg-sz-bg-tertiary border border-sz-border rounded-sz-lg transition-colors group"
              >
                <div className="w-11 h-11 rounded-sz bg-sz-bg-tertiary flex items-center justify-center group-hover:bg-sz-bg-hover">
                  <FolderOpen className="w-5 h-5 text-sz-text-muted group-hover:text-sz-text-secondary" />
                </div>
                <div className="text-left">
                  <p className="font-semibold text-sz-text">Open File</p>
                  <p className="text-xs text-sz-text-muted">Video & Audio: MP4, MOV, MP3, WAV, AAC</p>
                </div>
              </button>

              {/* Error */}
              {error && (
                <div className="bg-sz-danger-muted border border-sz-danger/30 rounded-sz p-3">
                  <p className="text-sm text-sz-danger">{error}</p>
                </div>
              )}
            </div>

            {/* Tip */}
            <p className="mt-10 text-xs text-sz-text-muted/60 text-center max-w-xs">
              All processing happens locally on your machine. Nothing is uploaded.
            </p>
          </>
        ) : (
          /* Selected File Card */
          <div className="w-full max-w-sm animate-sz-fade-in">
            {/* Logo */}
            <div className="text-center mb-8">
              <div className="flex items-center justify-center gap-0 mb-3">
                <span className="text-lg font-bold text-sz-text tracking-wide">SEE</span>
                <span className="mx-1.5 px-2 py-0.5 bg-sz-accent rounded text-xs font-bold text-white tracking-wide">
                  STUDIO
                </span>
                <span className="text-lg font-bold text-sz-text tracking-wide">ZEE</span>
              </div>
              <h2 className="text-lg font-semibold text-sz-text">Ready to Analyze</h2>
            </div>

            {/* File Card */}
            <div className="bg-sz-bg-secondary border border-sz-border rounded-sz-lg p-5">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-sz bg-sz-accent-muted flex items-center justify-center flex-shrink-0">
                  <FileVideo className="w-6 h-6 text-sz-accent" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-sz-text truncate">{project.fileName}</h3>
                  <div className="flex items-center gap-3 mt-1 text-sm text-sz-text-secondary">
                    {project.size > 0 && <span>{formatFileSize(project.size)}</span>}
                    {project.size > 0 && <span className="text-sz-border-light">•</span>}
                    <span>{formatDuration(project.duration)}</span>
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={handleClear}>
                  Change
                </Button>
              </div>

              {/* Analyze Button */}
              <Button
                variant="primary"
                size="lg"
                fullWidth
                onClick={handleAnalyze}
                rightIcon={<ArrowRight className="w-4 h-4" />}
                className="mt-5"
              >
                Start Analysis
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Memoized recent project item
interface RecentProjectItemProps {
  recent: {
    filePath: string;
    fileName: string;
    duration: number;
    lastOpened: number;
  };
  onOpen: (filePath: string) => void;
  onRemove: (filePath: string) => void;
  formatRelativeDate: (timestamp: number) => string;
}

const RecentProjectItem = memo(function RecentProjectItem({
  recent,
  onOpen,
  onRemove,
  formatRelativeDate,
}: RecentProjectItemProps) {
  return (
    <div className="flex items-center gap-3 px-4 py-2.5 hover:bg-sz-bg-tertiary transition-colors group">
      <div className="w-9 h-9 rounded bg-sz-bg-tertiary flex items-center justify-center flex-shrink-0">
        <Film className="w-4 h-4 text-sz-text-muted" />
      </div>
      <button
        onClick={() => onOpen(recent.filePath)}
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
          onRemove(recent.filePath);
        }}
        className="p-1.5 opacity-0 group-hover:opacity-100 hover:bg-sz-bg-hover rounded transition-all"
      >
        <Trash2 className="w-3.5 h-3.5 text-sz-text-muted hover:text-sz-danger" />
      </button>
    </div>
  );
});

export default memo(Home);
