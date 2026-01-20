import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileVideo, Plus, FolderOpen, Loader2, AlertCircle, Clock, Film, ChevronRight, Sparkles } from 'lucide-react';
import { useProjectStore } from '../stores/projectStore';
import { formatFileSize, formatDuration } from '../types';
import NewProjectModal from '../components/NewProjectModal';

interface RecentProject {
  name: string;
  path: string;
  date: string;
  duration?: number;
}

export default function SelectFile() {
  const navigate = useNavigate();
  const { 
    projectName, 
    projectPath, 
    filePath, 
    fileName, 
    fileSize, 
    fileDuration, 
    setProject,
    setFile, 
    clearFile,
    clearProject,
  } = useProjectStore();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recentProjects, setRecentProjects] = useState<RecentProject[]>([]);
  const [showNewProjectModal, setShowNewProjectModal] = useState(false);

  // #region agent log
  const debugLog = (location: string, message: string, data: any, hypothesisId: string) => {
    fetch('http://127.0.0.1:7243/ingest/5a29b418-6eb9-4d45-b489-cbbacb9ac2f5',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location,message,data,timestamp:Date.now(),sessionId:'debug-session',hypothesisId})}).catch(()=>{});
  };
  // #endregion

  // Load recent projects on mount
  useEffect(() => {
    // Mock recent projects - in production this would come from localStorage or IPC
    const mockRecent: RecentProject[] = [
      { name: 'podcast_episode_47.mp4', path: 'C:/Videos/podcast_episode_47.mp4', date: '2026-01-18', duration: 7200 },
      { name: 'interview_john_doe.mov', path: 'C:/Videos/interview_john_doe.mov', date: '2026-01-15', duration: 3600 },
      { name: 'weekly_roundup_12.mp4', path: 'C:/Videos/weekly_roundup_12.mp4', date: '2026-01-10', duration: 5400 },
    ];
    setRecentProjects(mockRecent);
  }, []);

  const handleCreateProject = async (name: string, location: string) => {
    // #region agent log
    debugLog('SelectFile.tsx:handleCreateProject', 'Create project called', { name, location }, 'C');
    // #endregion
    const result = await window.api.createProject({ name, location });
    // #region agent log
    debugLog('SelectFile.tsx:handleCreateProject', 'Create project result', { result }, 'C');
    // #endregion
    
    if (!result.success) {
      throw new Error(result.error || 'Failed to create project');
    }

    // Set project in store
    setProject({
      name: result.projectName!,
      path: result.projectPath!,
      file: result.projectFile!,
    });
    // #region agent log
    debugLog('SelectFile.tsx:handleCreateProject', 'Project set in store, closing modal', { projectName: result.projectName }, 'E');
    // #endregion

    setShowNewProjectModal(false);
  };

  const handleSelectFile = async () => {
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

      setFile({
        path: file.path,
        name: file.name,
        size: file.size,
        duration: validation.duration,
        valid: true,
      });
    } catch (err) {
      setError(String(err));
    } finally {
      setIsLoading(false);
    }
  };

  const handleAnalyze = () => {
    if (filePath) {
      navigate('/processing');
    }
  };

  const handleClear = () => {
    clearFile();
    setError(null);
  };

  const handleBackToStart = () => {
    clearProject();
    setError(null);
  };

  const handleOpenRecent = async (project: RecentProject) => {
    setIsLoading(true);
    setError(null);
    try {
      const validation = await window.api.validateFile(project.path);
      if (!validation.valid) {
        setError(`Could not open "${project.name}": File may have been moved or deleted`);
        setIsLoading(false);
        return;
      }
      setFile({
        path: project.path,
        name: project.name,
        size: 0,
        duration: validation.duration,
        valid: true,
      });
    } catch (err) {
      setError(String(err));
    } finally {
      setIsLoading(false);
    }
  };

  const formatRelativeDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="min-h-screen flex">
      {/* Left Panel - Recent Projects */}
      <div className="w-80 bg-zinc-900/50 border-r border-zinc-800 flex flex-col">
        <div className="p-6 border-b border-zinc-800">
          <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">Recent</h2>
        </div>
        
        <div className="flex-1 overflow-y-auto">
          {recentProjects.length === 0 ? (
            <div className="p-6 text-center text-zinc-500 text-sm">
              No recent projects
            </div>
          ) : (
            <div className="py-2">
              {recentProjects.map((project, index) => (
                <button
                  key={index}
                  onClick={() => handleOpenRecent(project)}
                  disabled={isLoading}
                  className="w-full px-4 py-3 flex items-center gap-3 hover:bg-zinc-800/50 transition-colors text-left group"
                >
                  <div className="w-10 h-10 rounded bg-zinc-800 flex items-center justify-center flex-shrink-0">
                    <Film className="w-5 h-5 text-zinc-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-zinc-200 truncate font-medium">{project.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Clock className="w-3 h-3 text-zinc-600" />
                      <span className="text-xs text-zinc-500">{formatRelativeDate(project.date)}</span>
                      {project.duration && (
                        <>
                          <span className="text-zinc-700">•</span>
                          <span className="text-xs text-zinc-500">{formatDuration(project.duration)}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-zinc-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right Panel - Main Content */}
      <div className="flex-1 flex flex-col items-center justify-center p-12">
        {/* Logo */}
        <div className="mb-12 text-center">
          <h1 className="text-3xl font-bold text-zinc-100 mb-2">
            Clipper <span className="text-violet-400">Studio</span>
          </h1>
          <p className="text-zinc-500 text-sm">AI-powered clip detection for content creators</p>
        </div>

        {!projectPath ? (
          /* No Project - Show New Project / Open options */
          <div className="w-full max-w-md space-y-4">
            {/* New Project Button */}
            <button
              onClick={() => {
                // #region agent log
                debugLog('SelectFile.tsx:NewProjectBtn', 'New Project button clicked', { currentModalState: showNewProjectModal }, 'A');
                // #endregion
                setShowNewProjectModal(true);
              }}
              disabled={isLoading}
              className="w-full flex items-center gap-4 p-4 bg-violet-600 hover:bg-violet-500 rounded-lg transition-colors group"
            >
              <div className="w-12 h-12 rounded-lg bg-violet-500/30 flex items-center justify-center">
                <Sparkles className="w-6 h-6 text-white" />
              </div>
              <div className="text-left">
                <p className="font-semibold text-white">New Project</p>
                <p className="text-sm text-violet-200/70">Create a project folder and import videos</p>
              </div>
            </button>

            {/* Open Project Button */}
            <button
              onClick={handleSelectFile}
              disabled={isLoading}
              className="w-full flex items-center gap-4 p-4 bg-zinc-800/50 hover:bg-zinc-800 border border-zinc-700 rounded-lg transition-colors group"
            >
              <div className="w-12 h-12 rounded-lg bg-zinc-700/50 flex items-center justify-center">
                {isLoading ? (
                  <Loader2 className="w-6 h-6 text-zinc-400 animate-spin" />
                ) : (
                  <FolderOpen className="w-6 h-6 text-zinc-400 group-hover:text-zinc-300" />
                )}
              </div>
              <div className="text-left">
                <p className="font-semibold text-zinc-200">Quick Open</p>
                <p className="text-sm text-zinc-500">Open a video or audio file directly</p>
              </div>
            </button>

            {/* Error display */}
            {error && (
              <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-red-400 font-medium text-sm">Error</p>
                  <p className="text-red-300/80 text-xs mt-1">{error}</p>
                </div>
              </div>
            )}
          </div>
        ) : !filePath ? (
          /* Project Created - Import Files */
          <div className="w-full max-w-lg space-y-6">
            {/* Project Header */}
            <div className="text-center">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-violet-500/10 border border-violet-500/20 rounded-full mb-4">
                <div className="w-2 h-2 rounded-full bg-violet-400"></div>
                <span className="text-sm text-violet-300 font-medium">{projectName}</span>
              </div>
              <h2 className="text-xl font-semibold text-zinc-100 mb-2">Import Source File</h2>
              <p className="text-zinc-500 text-sm">Select a video or audio file to analyze for viral clips</p>
            </div>

            {/* Import Area */}
            <button
              onClick={handleSelectFile}
              disabled={isLoading}
              className="w-full border-2 border-dashed border-zinc-700 hover:border-violet-500/50 rounded-xl p-10 transition-all hover:bg-violet-500/5 group"
            >
              <div className="flex flex-col items-center gap-4">
                <div className="w-16 h-16 rounded-xl bg-zinc-800 group-hover:bg-violet-500/10 flex items-center justify-center transition-colors">
                  {isLoading ? (
                    <Loader2 className="w-8 h-8 text-violet-400 animate-spin" />
                  ) : (
                    <Plus className="w-8 h-8 text-zinc-500 group-hover:text-violet-400 transition-colors" />
                  )}
                </div>
                <div className="text-center">
                  <p className="font-medium text-zinc-300 group-hover:text-zinc-100 transition-colors">
                    Click to select a media file
                  </p>
                  <p className="text-sm text-zinc-500 mt-1">Video: MP4, MOV, WEBM, MKV • Audio: MP3, WAV, AAC, FLAC</p>
                </div>
              </div>
            </button>

            {/* Back button */}
            <div className="text-center">
              <button
                onClick={handleBackToStart}
                className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                ← Back to start
              </button>
            </div>

            {/* Error display */}
            {error && (
              <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-red-400 font-medium text-sm">Error</p>
                  <p className="text-red-300/80 text-xs mt-1">{error}</p>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* File Selected - Ready to Analyze */
          <div className="w-full max-w-md">
            {/* Project indicator */}
            {projectName && (
              <div className="text-center mb-6">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-violet-500/10 border border-violet-500/20 rounded-full">
                  <div className="w-2 h-2 rounded-full bg-violet-400"></div>
                  <span className="text-sm text-violet-300 font-medium">{projectName}</span>
                </div>
              </div>
            )}

            <div className="border border-zinc-700 rounded-lg p-5 bg-zinc-800/30">
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 rounded-lg bg-violet-500/10 flex items-center justify-center flex-shrink-0">
                  <FileVideo className="w-7 h-7 text-violet-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-zinc-100 truncate">{fileName}</h3>
                  <div className="flex items-center gap-3 mt-1 text-sm text-zinc-400">
                    <span>{formatFileSize(fileSize)}</span>
                    <span className="text-zinc-600">•</span>
                    <span>{formatDuration(fileDuration)}</span>
                  </div>
                </div>
                <button
                  onClick={handleClear}
                  className="text-zinc-500 hover:text-zinc-300 text-xs font-medium"
                >
                  Change
                </button>
              </div>

              <button
                onClick={handleAnalyze}
                className="w-full mt-5 py-3 bg-violet-600 hover:bg-violet-500 rounded-lg font-semibold text-white transition-colors flex items-center justify-center gap-2"
              >
                Start Analysis
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {error && (
              <div className="mt-4 p-4 bg-red-500/10 border border-red-500/20 rounded-lg flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-red-400 font-medium text-sm">Error</p>
                  <p className="text-red-300/80 text-xs mt-1">{error}</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Quick Tips */}
        <div className="mt-12 text-center max-w-sm">
          <p className="text-xs text-zinc-600">
            Tip: Clipper Studio analyzes your video locally — nothing is uploaded to the cloud.
          </p>
        </div>
      </div>

      {/* New Project Modal */}
      <NewProjectModal
        isOpen={showNewProjectModal}
        onClose={() => setShowNewProjectModal(false)}
        onCreateProject={handleCreateProject}
      />
    </div>
  );
}
