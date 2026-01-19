import { memo, useState, useEffect, useCallback, useRef } from 'react';
import { 
  FolderOpen, 
  Film, 
  Music, 
  Image, 
  FileVideo, 
  ChevronDown, 
  ChevronRight,
  Search,
  Clock,
  HardDrive,
  Save,
  FolderInput,
  Plus,
  Trash2,
  RotateCcw,
  AlertCircle,
  CheckCircle2
} from 'lucide-react';
import { useStore } from '../../stores/store';
import { formatDuration } from '../../types';
import { IconButton, Button } from '../ui';
import { 
  createProjectFile, 
  loadProjectFile, 
  serializeProjectFile, 
  parseProjectFile,
  getSuggestedFilename,
  type UIState 
} from '../../stores/projectFile';

interface RecentProjectFile {
  filePath: string;
  name: string;
  modifiedAt: string;
}

interface ProjectPanelProps {
  className?: string;
  onUIStateLoaded?: (uiState: UIState) => void;
}

function ProjectPanel({ className, onUIStateLoaded }: ProjectPanelProps) {
  const { project, clips, clearProject } = useStore();
  const [expandedSections, setExpandedSections] = useState({
    project: true,
    recent: true,
    media: true,
    sequences: false,
  });
  const [searchQuery, setSearchQuery] = useState('');
  
  // Project file state
  const [projectFilePath, setProjectFilePath] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [lastSaveTime, setLastSaveTime] = useState<Date | null>(null);
  const [recentProjects, setRecentProjects] = useState<RecentProjectFile[]>([]);
  const [saveError, setSaveError] = useState<string | null>(null);
  
  // Auto-save timer
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedStateRef = useRef<string | null>(null);

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const acceptedClips = clips.filter(c => c.status === 'accepted');
  const rejectedClips = clips.filter(c => c.status === 'rejected');
  const pendingClips = clips.filter(c => c.status === 'pending');

  // Load recent projects on mount
  useEffect(() => {
    const loadRecent = async () => {
      try {
        const result = await window.api.projectGetRecent();
        if (result.success && result.projects) {
          setRecentProjects(result.projects);
        }
      } catch (err) {
        console.error('Failed to load recent projects:', err);
      }
    };
    loadRecent();
  }, []);

  // Track unsaved changes
  useEffect(() => {
    if (project) {
      const currentState = serializeProjectFile(createProjectFile());
      if (lastSavedStateRef.current && currentState !== lastSavedStateRef.current) {
        setHasUnsavedChanges(true);
      }
    }
  }, [project, clips]);

  // Auto-save every 60 seconds if there are changes
  useEffect(() => {
    if (!project || !hasUnsavedChanges) return;

    autoSaveTimerRef.current = setInterval(async () => {
      if (hasUnsavedChanges && project) {
        try {
          const projectId = project.filePath.replace(/[^a-zA-Z0-9]/g, '_');
          const projectData = serializeProjectFile(createProjectFile());
          await window.api.projectAutoSave(projectId, projectData);
          console.log('[AutoSave] Project auto-saved');
        } catch (err) {
          console.error('[AutoSave] Failed:', err);
        }
      }
    }, 60000); // 60 seconds

    return () => {
      if (autoSaveTimerRef.current) {
        clearInterval(autoSaveTimerRef.current);
      }
    };
  }, [project, hasUnsavedChanges]);

  // Save project
  const handleSave = useCallback(async () => {
    if (!project) return;
    
    setIsSaving(true);
    setSaveError(null);
    
    try {
      const projectData = serializeProjectFile(createProjectFile());
      
      let result;
      if (projectFilePath) {
        // Save to existing path
        result = await window.api.projectSave(projectFilePath, projectData);
      } else {
        // Save with dialog
        result = await window.api.projectSaveAs(projectData);
      }
      
      if (result.success && result.filePath) {
        setProjectFilePath(result.filePath);
        setLastSaveTime(new Date());
        setHasUnsavedChanges(false);
        lastSavedStateRef.current = projectData;
        
        // Clear auto-save
        const projectId = project.filePath.replace(/[^a-zA-Z0-9]/g, '_');
        await window.api.projectClearAutoSave(projectId);
        
        // Refresh recent projects
        const recentResult = await window.api.projectGetRecent();
        if (recentResult.success && recentResult.projects) {
          setRecentProjects(recentResult.projects);
        }
      } else if (!result.canceled) {
        setSaveError(result.error || 'Failed to save project');
      }
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsSaving(false);
    }
  }, [project, projectFilePath]);

  // Save As
  const handleSaveAs = useCallback(async () => {
    if (!project) return;
    
    setIsSaving(true);
    setSaveError(null);
    
    try {
      const projectData = serializeProjectFile(createProjectFile());
      const result = await window.api.projectSaveAs(projectData);
      
      if (result.success && result.filePath) {
        setProjectFilePath(result.filePath);
        setLastSaveTime(new Date());
        setHasUnsavedChanges(false);
        lastSavedStateRef.current = projectData;
        
        // Refresh recent projects
        const recentResult = await window.api.projectGetRecent();
        if (recentResult.success && recentResult.projects) {
          setRecentProjects(recentResult.projects);
        }
      } else if (!result.canceled) {
        setSaveError(result.error || 'Failed to save project');
      }
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsSaving(false);
    }
  }, [project]);

  // Open project
  const handleOpen = useCallback(async () => {
    setIsLoading(true);
    setSaveError(null);
    
    try {
      const result = await window.api.projectOpen();
      
      if (result.success && result.content && result.filePath) {
        const projectFile = parseProjectFile(result.content);
        const uiState = loadProjectFile(projectFile);
        
        setProjectFilePath(result.filePath);
        setLastSaveTime(new Date(projectFile.meta.modifiedAt));
        setHasUnsavedChanges(false);
        lastSavedStateRef.current = result.content;
        
        // Notify parent of UI state
        if (onUIStateLoaded) {
          onUIStateLoaded(uiState);
        }
        
        // Refresh recent projects
        const recentResult = await window.api.projectGetRecent();
        if (recentResult.success && recentResult.projects) {
          setRecentProjects(recentResult.projects);
        }
      } else if (!result.canceled) {
        setSaveError(result.error || 'Failed to open project');
      }
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  }, [onUIStateLoaded]);

  // Load recent project
  const handleLoadRecent = useCallback(async (filePath: string) => {
    setIsLoading(true);
    setSaveError(null);
    
    try {
      const result = await window.api.projectLoad(filePath);
      
      if (result.success && result.content) {
        const projectFile = parseProjectFile(result.content);
        const uiState = loadProjectFile(projectFile);
        
        setProjectFilePath(result.filePath || filePath);
        setLastSaveTime(new Date(projectFile.meta.modifiedAt));
        setHasUnsavedChanges(false);
        lastSavedStateRef.current = result.content;
        
        // Notify parent of UI state
        if (onUIStateLoaded) {
          onUIStateLoaded(uiState);
        }
      } else {
        setSaveError(result.error || 'Failed to load project');
        // Remove from recent if file doesn't exist
        await window.api.projectRemoveRecent(filePath);
        setRecentProjects(prev => prev.filter(p => p.filePath !== filePath));
      }
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  }, [onUIStateLoaded]);

  // Remove recent project
  const handleRemoveRecent = useCallback(async (filePath: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await window.api.projectRemoveRecent(filePath);
    setRecentProjects(prev => prev.filter(p => p.filePath !== filePath));
  }, []);

  // New project
  const handleNewProject = useCallback(() => {
    clearProject();
    setProjectFilePath(null);
    setLastSaveTime(null);
    setHasUnsavedChanges(false);
    lastSavedStateRef.current = null;
  }, [clearProject]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (e.shiftKey) {
          handleSaveAs();
        } else {
          handleSave();
        }
      }
      
      if ((e.ctrlKey || e.metaKey) && e.key === 'o') {
        e.preventDefault();
        handleOpen();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSave, handleSaveAs, handleOpen]);

  return (
    <div className={`h-full flex flex-col bg-sz-bg-secondary border-r border-sz-border ${className} no-select`}>
      {/* Header */}
      <div className="px-3 py-2 border-b border-sz-border flex-shrink-0">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-sz-text uppercase tracking-wider">
            Project
          </span>
          <div className="flex items-center gap-1">
            {hasUnsavedChanges && (
              <span className="w-2 h-2 rounded-full bg-amber-400" title="Unsaved changes" />
            )}
            <IconButton
              icon={<Plus className="w-3.5 h-3.5" />}
              variant="ghost"
              size="xs"
              tooltip="New Project"
              onClick={handleNewProject}
            />
            <IconButton
              icon={<FolderInput className="w-3.5 h-3.5" />}
              variant="ghost"
              size="xs"
              tooltip="Open Project (Ctrl+O)"
              onClick={handleOpen}
              disabled={isLoading}
            />
            <IconButton
              icon={<Save className="w-3.5 h-3.5" />}
              variant="ghost"
              size="xs"
              tooltip={projectFilePath ? "Save (Ctrl+S)" : "Save As (Ctrl+S)"}
              onClick={handleSave}
              disabled={isSaving || !project}
            />
          </div>
        </div>
        
        {/* Status bar */}
        {saveError && (
          <div className="flex items-center gap-1 px-2 py-1 bg-red-500/10 rounded text-[10px] text-red-400 mb-2">
            <AlertCircle className="w-3 h-3" />
            {saveError}
          </div>
        )}
        
        {lastSaveTime && !saveError && (
          <div className="flex items-center gap-1 text-[10px] text-sz-text-muted mb-2">
            <CheckCircle2 className="w-3 h-3 text-green-400" />
            Saved {lastSaveTime.toLocaleTimeString()}
          </div>
        )}
        
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-sz-text-muted" />
          <input
            type="text"
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-7 pr-2 py-1 text-xs bg-sz-bg border border-sz-border rounded text-sz-text placeholder-sz-text-muted focus:outline-none focus:ring-1 focus:ring-sz-accent"
          />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {/* Recent Projects */}
        {recentProjects.length > 0 && (
          <div className="px-2 py-1 border-b border-sz-border/50">
            <button
              onClick={() => toggleSection('recent')}
              className="w-full flex items-center gap-1 px-2 py-1.5 text-xs font-medium text-sz-text-secondary hover:bg-sz-bg-tertiary rounded transition-colors"
            >
              {expandedSections.recent ? (
                <ChevronDown className="w-3 h-3" />
              ) : (
                <ChevronRight className="w-3 h-3" />
              )}
              <Clock className="w-3.5 h-3.5" />
              <span>Recent Projects</span>
              <span className="ml-auto text-[10px] text-sz-text-muted bg-sz-bg-tertiary px-1.5 py-0.5 rounded">
                {recentProjects.length}
              </span>
            </button>
            
            {expandedSections.recent && (
              <div className="ml-4 mt-1 space-y-0.5 max-h-40 overflow-y-auto">
                {recentProjects.slice(0, 5).map((recent) => (
                  <div
                    key={recent.filePath}
                    onClick={() => handleLoadRecent(recent.filePath)}
                    className="px-2 py-1.5 rounded hover:bg-sz-bg-tertiary cursor-pointer group flex items-center gap-2"
                  >
                    <FileVideo className="w-3.5 h-3.5 text-sz-accent flex-shrink-0" />
                    <div className="flex-1 min-w-0 allow-select">
                      <div className="text-xs text-sz-text truncate">{recent.name}</div>
                      <div className="text-[10px] text-sz-text-muted truncate">
                        {new Date(recent.modifiedAt).toLocaleDateString()}
                      </div>
                    </div>
                    <button
                      onClick={(e) => handleRemoveRecent(recent.filePath, e)}
                      className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-red-500/20 rounded transition-opacity"
                    >
                      <Trash2 className="w-3 h-3 text-red-400" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Project Files */}
        <div className="px-2 py-1">
          <button
            onClick={() => toggleSection('project')}
            className="w-full flex items-center gap-1 px-2 py-1.5 text-xs font-medium text-sz-text-secondary hover:bg-sz-bg-tertiary rounded transition-colors"
          >
            {expandedSections.project ? (
              <ChevronDown className="w-3 h-3" />
            ) : (
              <ChevronRight className="w-3 h-3" />
            )}
            <FolderOpen className="w-3.5 h-3.5" />
            <span>Project Files</span>
          </button>
          
          {expandedSections.project && (
            <div className="ml-6 mt-1 space-y-0.5">
              {project ? (
                <>
                  {/* Current project file */}
                  {projectFilePath && (
                    <div className="px-2 py-1.5 rounded bg-sz-accent/10 border border-sz-accent/30">
                      <div className="flex items-center gap-2">
                        <FileVideo className="w-3.5 h-3.5 text-sz-accent flex-shrink-0" />
                        <div className="flex-1 min-w-0 allow-select">
                          <div className="text-xs text-sz-text truncate flex items-center gap-1">
                            {projectFilePath.split(/[\\/]/).pop()}
                            {hasUnsavedChanges && <span className="text-amber-400">*</span>}
                          </div>
                          <div className="text-[10px] text-sz-text-muted mt-0.5">
                            Project file
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {/* Source video */}
                  <div className="px-2 py-1.5 rounded hover:bg-sz-bg-tertiary cursor-pointer group">
                    <div className="flex items-center gap-2">
                      <FileVideo className="w-3.5 h-3.5 text-sz-text-muted flex-shrink-0" />
                      <div className="flex-1 min-w-0 allow-select">
                        <div className="text-xs text-sz-text truncate">{project.fileName}</div>
                        <div className="flex items-center gap-2 text-[10px] text-sz-text-muted mt-0.5">
                          <span className="flex items-center gap-0.5">
                            <Clock className="w-3 h-3" />
                            {formatDuration(project.duration)}
                          </span>
                          {project.resolution && (
                            <>
                              <span>•</span>
                              <span>{project.resolution}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="px-2 py-4 text-center text-xs text-sz-text-muted">
                  No project open
                </div>
              )}
            </div>
          )}
        </div>

        {/* Media Browser */}
        <div className="px-2 py-1 border-t border-sz-border/50">
          <button
            onClick={() => toggleSection('media')}
            className="w-full flex items-center gap-1 px-2 py-1.5 text-xs font-medium text-sz-text-secondary hover:bg-sz-bg-tertiary rounded transition-colors"
          >
            {expandedSections.media ? (
              <ChevronDown className="w-3 h-3" />
            ) : (
              <ChevronRight className="w-3 h-3" />
            )}
            <Film className="w-3.5 h-3.5" />
            <span>Media</span>
          </button>
          
          {expandedSections.media && (
            <div className="ml-6 mt-1 space-y-0.5">
              {/* Video Clips */}
              <div className="px-2 py-1.5 rounded hover:bg-sz-bg-tertiary cursor-pointer group">
                <div className="flex items-center gap-2">
                  <Film className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-sz-text">Video Clips</div>
                    <div className="text-[10px] text-sz-text-muted mt-0.5">
                      {clips.length} clips
                    </div>
                  </div>
                </div>
              </div>

              {/* Accepted Clips */}
              {acceptedClips.length > 0 && (
                <div className="px-2 py-1.5 rounded hover:bg-sz-bg-tertiary cursor-pointer group">
                  <div className="flex items-center gap-2">
                    <div className="w-3.5 h-3.5 rounded bg-green-500/20 flex items-center justify-center flex-shrink-0">
                      <div className="w-2 h-2 rounded-full bg-green-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-sz-text">Accepted</div>
                      <div className="text-[10px] text-sz-text-muted mt-0.5">
                        {acceptedClips.length} clips
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Pending Clips */}
              {pendingClips.length > 0 && (
                <div className="px-2 py-1.5 rounded hover:bg-sz-bg-tertiary cursor-pointer group">
                  <div className="flex items-center gap-2">
                    <div className="w-3.5 h-3.5 rounded bg-amber-500/20 flex items-center justify-center flex-shrink-0">
                      <div className="w-2 h-2 rounded-full bg-amber-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-sz-text">Pending</div>
                      <div className="text-[10px] text-sz-text-muted mt-0.5">
                        {pendingClips.length} clips
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Rejected Clips */}
              {rejectedClips.length > 0 && (
                <div className="px-2 py-1.5 rounded hover:bg-sz-bg-tertiary cursor-pointer group">
                  <div className="flex items-center gap-2">
                    <div className="w-3.5 h-3.5 rounded bg-red-500/20 flex items-center justify-center flex-shrink-0">
                      <div className="w-2 h-2 rounded-full bg-red-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-sz-text">Rejected</div>
                      <div className="text-[10px] text-sz-text-muted mt-0.5">
                        {rejectedClips.length} clips
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Audio */}
              <div className="px-2 py-1.5 rounded hover:bg-sz-bg-tertiary cursor-pointer group">
                <div className="flex items-center gap-2">
                  <Music className="w-3.5 h-3.5 text-purple-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-sz-text">Audio</div>
                    <div className="text-[10px] text-sz-text-muted mt-0.5">
                      Source audio
                    </div>
                  </div>
                </div>
              </div>

              {/* B-Roll */}
              <div className="px-2 py-1.5 rounded hover:bg-sz-bg-tertiary cursor-pointer group">
                <div className="flex items-center gap-2">
                  <Image className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-sz-text">B-Roll</div>
                    <div className="text-[10px] text-sz-text-muted mt-0.5">
                      No media
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Sequences */}
        <div className="px-2 py-1 border-t border-sz-border/50">
          <button
            onClick={() => toggleSection('sequences')}
            className="w-full flex items-center gap-1 px-2 py-1.5 text-xs font-medium text-sz-text-secondary hover:bg-sz-bg-tertiary rounded transition-colors"
          >
            {expandedSections.sequences ? (
              <ChevronDown className="w-3 h-3" />
            ) : (
              <ChevronRight className="w-3 h-3" />
            )}
            <Film className="w-3.5 h-3.5" />
            <span>Sequences</span>
          </button>
          
          {expandedSections.sequences && (
            <div className="ml-6 mt-1 space-y-0.5">
              {project && (
                <div className="px-2 py-1.5 rounded hover:bg-sz-bg-tertiary cursor-pointer group">
                  <div className="flex items-center gap-2">
                    <Film className="w-3.5 h-3.5 text-sz-accent flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-sz-text">Sequence 01</div>
                      <div className="text-[10px] text-sz-text-muted mt-0.5">
                        {formatDuration(project.duration)}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="px-3 py-2 border-t border-sz-border flex-shrink-0">
        <div className="flex items-center gap-2 text-[10px] text-sz-text-muted">
          <HardDrive className="w-3 h-3" />
          <span className="truncate">
            {projectFilePath 
              ? projectFilePath.split(/[\\/]/).slice(0, -1).join('/') 
              : project 
                ? project.filePath.split(/[\\/]/).slice(0, -1).join('/')
                : 'No project'}
          </span>
        </div>
      </div>
    </div>
  );
}

export default memo(ProjectPanel);
