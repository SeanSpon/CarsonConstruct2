/**
 * ProjectHistory - Display and manage project history
 */
import React, { useState, useEffect, useCallback } from 'react';

interface Project {
  id: string;
  created_at: string;
  source_video_name: string;
  status: 'processing' | 'complete' | 'error';
  clips: unknown[];
  total_clips?: number;
}

interface StorageStats {
  total_projects: number;
  total_clips: number;
  total_size_mb: number;
  total_size_gb: number;
}

interface ProjectHistoryProps {
  onSelectProject?: (project: Project) => void;
  onClose?: () => void;
}

export const ProjectHistory: React.FC<ProjectHistoryProps> = ({
  onSelectProject,
  onClose
}) => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const [stats, setStats] = useState<StorageStats | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const loadProjects = useCallback(async () => {
    setLoading(true);
    try {
      const projectList = await window.api.listProjects({
        status: filter === 'all' ? undefined : filter
      });
      setProjects(projectList || []);
    } catch (err) {
      console.error('Failed to load projects:', err);
      setProjects([]);
    }
    setLoading(false);
  }, [filter]);

  const loadStats = useCallback(async () => {
    try {
      const storageStats = await window.api.getStorageStats();
      setStats(storageStats);
    } catch (err) {
      console.error('Failed to load storage stats:', err);
    }
  }, []);

  useEffect(() => {
    loadProjects();
    loadStats();
  }, [loadProjects, loadStats]);

  const handleDeleteProject = async (projectId: string) => {
    try {
      await window.api.deleteProject(projectId);
      setConfirmDelete(null);
      loadProjects();
      loadStats();
    } catch (err) {
      console.error('Failed to delete project:', err);
    }
  };

  const formatDate = (isoDate: string) => {
    try {
      const date = new Date(isoDate);
      return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { 
        hour: '2-digit', 
        minute: '2-digit' 
      });
    } catch {
      return isoDate;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'complete':
        return '✅';
      case 'processing':
        return '🔄';
      case 'error':
        return '❌';
      default:
        return '❓';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'complete':
        return 'border-l-green-500 bg-green-500/5';
      case 'processing':
        return 'border-l-orange-500 bg-orange-500/5';
      case 'error':
        return 'border-l-red-500 bg-red-500/5';
      default:
        return 'border-l-zinc-500';
    }
  };

  return (
    <div className="flex flex-col h-full bg-zinc-900 text-white">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-zinc-700">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          📚 Project History
        </h2>
        {onClose && (
          <button
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-700 rounded-lg transition-colors"
          >
            ✕
          </button>
        )}
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 p-4 border-b border-zinc-800">
        {['all', 'complete', 'processing', 'error'].map((tab) => (
          <button
            key={tab}
            onClick={() => setFilter(tab)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === tab
                ? 'bg-indigo-600 text-white'
                : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-white'
            }`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Storage Stats */}
      {stats && (
        <div className="p-4 bg-zinc-800/50 border-b border-zinc-700">
          <div className="flex gap-6 text-sm text-zinc-400">
            <span>
              📁 {stats.total_projects} projects
            </span>
            <span>
              🎬 {stats.total_clips} clips
            </span>
            <span>
              💾 {stats.total_size_gb > 1 
                ? `${stats.total_size_gb.toFixed(2)} GB` 
                : `${stats.total_size_mb.toFixed(1)} MB`}
            </span>
          </div>
        </div>
      )}

      {/* Projects List */}
      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="flex items-center justify-center h-32 text-zinc-400">
            <span className="animate-pulse">Loading projects...</span>
          </div>
        ) : projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-zinc-500">
            <span className="text-4xl mb-2">📭</span>
            <p>No projects yet</p>
            <p className="text-sm">Generate your first clips to see them here</p>
          </div>
        ) : (
          <div className="space-y-3">
            {projects.map((project) => (
              <div
                key={project.id}
                className={`relative p-4 rounded-lg border-l-4 cursor-pointer transition-all hover:translate-x-1 hover:shadow-lg ${getStatusColor(project.status)}`}
                onClick={() => onSelectProject?.(project)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium truncate pr-4">
                      {project.source_video_name}
                    </h3>
                    <div className="flex items-center gap-3 mt-1 text-sm text-zinc-400">
                      <span>📅 {formatDate(project.created_at)}</span>
                      <span>🎬 {project.total_clips || project.clips?.length || 0} clips</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      project.status === 'complete' ? 'bg-green-500/20 text-green-400' :
                      project.status === 'processing' ? 'bg-orange-500/20 text-orange-400' :
                      'bg-red-500/20 text-red-400'
                    }`}>
                      {getStatusIcon(project.status)} {project.status}
                    </span>
                    
                    {confirmDelete === project.id ? (
                      <div className="flex gap-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteProject(project.id);
                          }}
                          className="px-2 py-1 text-xs bg-red-600 hover:bg-red-500 rounded transition-colors"
                        >
                          Confirm
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setConfirmDelete(null);
                          }}
                          className="px-2 py-1 text-xs bg-zinc-600 hover:bg-zinc-500 rounded transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setConfirmDelete(project.id);
                        }}
                        className="p-1.5 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"
                        title="Delete project"
                      >
                        🗑️
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ProjectHistory;
