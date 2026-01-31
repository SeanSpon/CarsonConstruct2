import { useState } from 'react';
import { useHistoryStore } from '../../stores/historyStore';
import { HistoryProjectDetail } from './HistoryProjectDetail';

function filePathToFileUrl(filePath: string): string {
  const trimmed = filePath.trim();
  if (trimmed.startsWith('file://')) return trimmed;

  const normalized = trimmed.replace(/%/g, '%25').replace(/\\/g, '/');
  const withLeadingSlash = normalized.startsWith('/') ? normalized : `/${normalized}`;
  const encoded = encodeURI(withLeadingSlash)
    .replace(/#/g, '%23')
    .replace(/\?/g, '%3F');
  return `file://${encoded}`;
}

interface HistoryScreenProps {
  onBack: () => void;
  onLoadProject: (projectId: string) => void;
}

export function HistoryScreen({ onBack, onLoadProject }: HistoryScreenProps) {
  const { projects, removeProject, getProjectClips, updateClip } = useHistoryStore();
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    if (hours > 0) {
      return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
    });
  };

  const handleDelete = (e: React.MouseEvent, projectId: string) => {
    e.stopPropagation();
    if (confirm('Delete this project and all its clips from history?')) {
      removeProject(projectId);
    }
  };

  const selectedProject = selectedProjectId ? projects.find(p => p.id === selectedProjectId) : null;
  const selectedClips = selectedProject ? getProjectClips(selectedProject.id) : [];

  if (projects.length === 0) {
    return (
      <div className="h-screen w-screen flex flex-col min-h-0 bg-sz-bg text-sz-text">
        {/* Header */}
        <div className="p-6 border-b border-sz-border">
          <div className="flex items-center gap-4">
            <button
              onClick={onBack}
              className="p-2 hover:bg-sz-bg-secondary rounded-lg transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </button>
            <h2 className="text-2xl font-bold">History</h2>
          </div>
        </div>

        {/* Empty State */}
        <div className="flex-1 flex flex-col items-center justify-center p-8">
          <div className="text-center space-y-4 max-w-md">
            <div className="text-6xl">📁</div>
            <h3 className="text-xl font-semibold">No Projects Yet</h3>
            <p className="text-sz-text-muted">
              Your processed videos and generated clips will appear here
            </p>
            <button
              onClick={onBack}
              className="px-6 py-3 bg-sz-accent text-white rounded-lg hover:bg-sz-accent-hover transition-colors"
            >
              Get Started
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen flex flex-col min-h-0 bg-sz-bg text-sz-text">
      {/* Header */}
      <div className="p-6 border-b border-sz-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={onBack}
              className="p-2 hover:bg-sz-bg-secondary rounded-lg transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </button>
            <div>
              <h2 className="text-2xl font-bold">History</h2>
              <p className="text-sm text-sz-text-muted">{projects.length} projects</p>
            </div>
          </div>
        </div>
      </div>

      {/* Projects Grid */}
      <div className="flex-1 min-h-0 overflow-y-auto p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-w-7xl mx-auto">
          {projects.map((project) => {
            const projectClips = getProjectClips(project.id);
            const exportedClips = projectClips.filter(c => c.exportedAt).length;
            
            return (
              <div
                key={project.id}
                className="bg-sz-bg-secondary border border-sz-border rounded-lg overflow-hidden hover:border-sz-accent transition-colors cursor-pointer group"
                onClick={() => setSelectedProjectId(project.id)}
              >
                {/* Thumbnail */}
                <div className="aspect-video bg-sz-bg-tertiary flex items-center justify-center relative">
                  {project.thumbnailPath ? (
                    <img
                      src={filePathToFileUrl(project.thumbnailPath)}
                      alt={project.fileName}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="text-6xl opacity-30">🎬</div>
                  )}
                  <div className="absolute top-2 right-2 px-2 py-1 bg-black/70 text-white text-xs rounded">
                    {formatDuration(project.duration)}
                  </div>
                </div>

                {/* Info */}
                <div className="p-4 space-y-3">
                  <div>
                    <h3 className="font-semibold truncate group-hover:text-sz-accent transition-colors">
                      {project.fileName}
                    </h3>
                    <p className="text-xs text-sz-text-muted">
                      {formatDate(project.createdAt)}
                    </p>
                  </div>

                  {/* Stats */}
                  <div className="flex items-center gap-4 text-sm">
                    <div className="flex items-center gap-1">
                      <span className="text-sz-text-muted">📋</span>
                      <span>{project.clipCount || 0} clips</span>
                    </div>
                    {exportedClips > 0 && (
                      <div className="flex items-center gap-1">
                        <span className="text-sz-text-muted">✓</span>
                        <span>{exportedClips} exported</span>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 pt-2 border-t border-sz-border">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onLoadProject(project.id);
                      }}
                      className="flex-1 px-3 py-1.5 text-sm bg-sz-accent text-white rounded hover:bg-sz-accent-hover transition-colors"
                    >
                      Load in Review
                    </button>
                    {project.lastExportDir && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          window.api?.openFolder(project.lastExportDir!);
                        }}
                        className="px-3 py-1.5 text-sm bg-sz-bg-tertiary hover:bg-sz-bg rounded transition-colors"
                      >
                        Open Folder
                      </button>
                    )}
                    <button
                      onClick={(e) => handleDelete(e, project.id)}
                      className="px-3 py-1.5 text-sm text-red-400 hover:bg-red-400/10 rounded transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      {selectedProject && (
        <HistoryProjectDetail
          project={selectedProject}
          clips={selectedClips}
          onClose={() => setSelectedProjectId(null)}
          onLoadProject={(id) => {
            setSelectedProjectId(null);
            onLoadProject(id);
          }}
          onUpdateClipStyle={(clipId, style) => updateClip(clipId, { captionStyle: style })}
        />
      )}
    </div>
  );
}
