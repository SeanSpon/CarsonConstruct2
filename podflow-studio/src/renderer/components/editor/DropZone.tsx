import { memo, useState, useCallback, useEffect } from 'react';
import { FileVideo, Plus, FolderOpen, Trash2, Film, ChevronRight, Sparkles } from 'lucide-react';
import { LoadingState } from '../ui';
import { formatDuration } from '../../types';
import NewProjectModal from './NewProjectModal';

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
  onProjectCreated?: (projectPath: string, projectName: string) => void;
  autoShowNewProjectModal?: boolean;
  onModalClosed?: () => void;
}

function DropZone({
  isLoading,
  error,
  recentProjects,
  onSelectFile,
  onOpenRecent,
  onRemoveRecent,
  onFileDrop,
  onProjectCreated,
  autoShowNewProjectModal,
  onModalClosed,
}: DropZoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [showNewProjectModal, setShowNewProjectModal] = useState(false);

  // Auto-show modal when triggered from parent (e.g., from menu bar "New Project")
  useEffect(() => {
    if (autoShowNewProjectModal) {
      setShowNewProjectModal(true);
    }
  }, [autoShowNewProjectModal]);

  const handleCreateProject = async (name: string, location: string) => {
    const result = await window.api.createProject({ name, location });
    
    if (!result.success) {
      throw new Error(result.error || 'Failed to create project');
    }

    setShowNewProjectModal(false);
    
    // Notify parent that project was created
    if (onProjectCreated && result.projectPath && result.projectName) {
      onProjectCreated(result.projectPath, result.projectName);
    }
    
    // After creating project, prompt user to select a file
    onSelectFile();
  };

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

      {/* Right Panel - Main Content */}
      <div className={`flex-1 flex flex-col items-center justify-center p-12 transition-all duration-200 ${isDragOver ? 'bg-sz-accent/5' : ''}`}>
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
            onClick={() => setShowNewProjectModal(true)}
            disabled={isLoading}
            className={`w-full flex items-center gap-4 p-4 rounded-sz-lg transition-all group ${
              isDragOver 
                ? 'bg-sz-accent scale-[1.02] ring-2 ring-sz-accent ring-offset-2 ring-offset-sz-bg' 
                : 'bg-sz-accent hover:bg-sz-accent-hover'
            }`}
          >
            <div className="w-11 h-11 rounded-sz bg-white/10 flex items-center justify-center">
              {isLoading ? (
                <LoadingState size="sm" />
              ) : (
                <Sparkles className="w-5 h-5 text-white" />
              )}
            </div>
            <div className="text-left">
              <p className="font-semibold text-white">
                {isDragOver ? 'Drop to Import' : 'New Project'}
              </p>
              <p className="text-xs text-white/60">Create a project folder and import videos</p>
            </div>
          </button>

          {/* Open File Button */}
          <button
            onClick={onSelectFile}
            disabled={isLoading}
            className="w-full flex items-center gap-4 p-4 bg-sz-bg-secondary hover:bg-sz-bg-tertiary border border-sz-border rounded-sz-lg transition-colors group"
          >
            <div className="w-11 h-11 rounded-sz bg-sz-bg-tertiary flex items-center justify-center group-hover:bg-sz-bg-hover">
              <FolderOpen className="w-5 h-5 text-sz-text-muted group-hover:text-sz-text-secondary" />
            </div>
            <div className="text-left">
              <p className="font-semibold text-sz-text">Open File</p>
              <p className="text-xs text-sz-text-muted">MP4, MOV, WEBM, MKV</p>
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
          {isDragOver 
            ? 'Release to import your video file' 
            : 'All processing happens locally on your machine. Nothing is uploaded.'}
        </p>
      </div>

      {/* New Project Modal */}
      <NewProjectModal
        isOpen={showNewProjectModal}
        onClose={() => {
          setShowNewProjectModal(false);
          onModalClosed?.();
        }}
        onCreateProject={handleCreateProject}
      />
    </div>
  );
}

export default memo(DropZone);
