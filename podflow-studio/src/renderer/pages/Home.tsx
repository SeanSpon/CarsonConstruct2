import { useState } from 'react';
import type { DragEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileVideo, Upload, Loader2, AlertCircle, Sparkles, Clock, Trash2, FolderOpen } from 'lucide-react';
import { useStore } from '../stores/store';
import { formatFileSize, formatDuration } from '../types';

export default function Home() {
  const navigate = useNavigate();
  const { 
    project, 
    setProject, 
    clearProject, 
    recentProjects, 
    removeRecentProject 
  } = useStore();
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const supportedDropExtensions = ['mp4', 'mov'];

  const validateAndSetProject = async (filePath: string, fileName: string, size: number) => {
    const validation = await window.api.validateFile(filePath);
    
    if (!validation.valid) {
      setError(validation.error || 'Invalid video file');
      return false;
    }

    setProject({
      filePath,
      fileName,
      size,
      duration: validation.duration || 0,
    });

    return true;
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

      await validateAndSetProject(file.path, file.name, file.size);
    } catch (err) {
      setError(String(err));
    } finally {
      setIsLoading(false);
    }
  };

  const handleDragOver = (event: DragEvent<HTMLButtonElement>) => {
    event.preventDefault();

    if (isLoading) {
      return;
    }

    event.dataTransfer.dropEffect = 'copy';
    setIsDragging(true);
  };

  const handleDragEnter = (event: DragEvent<HTMLButtonElement>) => {
    event.preventDefault();

    if (!isLoading) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (event: DragEvent<HTMLButtonElement>) => {
    if (isLoading) {
      return;
    }

    const nextTarget = event.relatedTarget as Node | null;
    if (nextTarget && event.currentTarget.contains(nextTarget)) {
      return;
    }

    setIsDragging(false);
  };

  const handleDrop = async (event: DragEvent<HTMLButtonElement>) => {
    event.preventDefault();

    if (isLoading) {
      return;
    }

    setIsDragging(false);
    const droppedFile = event.dataTransfer.files?.[0];

    if (!droppedFile) {
      return;
    }

    const extension = droppedFile.name.split('.').pop()?.toLowerCase();
    if (!extension || !supportedDropExtensions.includes(extension)) {
      setError('Drag-and-drop supports .mp4 and .mov files.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await validateAndSetProject(droppedFile.path, droppedFile.name, droppedFile.size);
    } catch (err) {
      setError(String(err));
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenRecent = async (filePath: string) => {
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
      
      // Get file size - we'll estimate from duration if not available
      setProject({
        filePath,
        fileName,
        size: 0, // Size will be re-read if needed
        duration: validation.duration || 0,
      });
    } catch (err) {
      setError(String(err));
    } finally {
      setIsLoading(false);
    }
  };

  const handleAnalyze = () => {
    if (project) {
      navigate('/clips');
    }
  };

  const handleClear = () => {
    clearProject();
    setError(null);
  };

  return (
    <div className="min-h-full flex flex-col items-center justify-center p-8">
      {/* Hero Section */}
      <div className="text-center mb-10">
        <div className="flex items-center justify-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-600 flex items-center justify-center">
            <Sparkles className="w-6 h-6 text-white" />
          </div>
        </div>
        <h1 className="text-3xl font-bold mb-2">
          Welcome to <span className="text-violet-400">PodFlow Studio</span>
        </h1>
        <p className="text-zinc-400 text-lg max-w-md mx-auto">
          AI-powered clip detection for podcasters. Find viral moments, remove dead space, export clean clips.
        </p>
      </div>

      {/* Main Content */}
      <div className="w-full max-w-2xl">
        {!project ? (
          <>
            {/* File Selection */}
            <button
              onClick={handleSelectFile}
              onDragEnter={handleDragEnter}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              disabled={isLoading}
              className={`
                w-full border-2 border-dashed rounded-2xl p-10 text-center 
                transition-all duration-200 cursor-pointer mb-6
                ${isLoading 
                  ? 'border-zinc-700 bg-zinc-900/50 cursor-wait' 
                  : isDragging
                    ? 'border-violet-500 bg-violet-500/10'
                    : 'border-zinc-700 hover:border-violet-500 hover:bg-violet-500/5 bg-zinc-900/30'
                }
              `}
            >
              {isLoading ? (
                <div className="flex flex-col items-center gap-4">
                  <Loader2 className="w-12 h-12 text-violet-500 animate-spin" />
                  <p className="text-zinc-300">Reading file...</p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-4">
                  <div className="w-16 h-16 rounded-full bg-zinc-800 flex items-center justify-center">
                    <FileVideo className="w-8 h-8 text-zinc-400" />
                  </div>
                  <div>
                    <p className="text-xl font-medium text-zinc-200">
                      {isDragging ? 'Drop your podcast video' : 'Select your podcast video'}
                    </p>
                    <p className="text-sm text-zinc-500 mt-2">
                      Drag and drop a .mp4 or .mov, or choose a file (MP4, MOV, WEBM, MKV).
                    </p>
                  </div>
                  <div className="mt-2 px-6 py-3 bg-violet-600 hover:bg-violet-500 rounded-lg font-medium text-white transition-colors">
                    <Upload className="w-4 h-4 inline-block mr-2" />
                    Choose File
                  </div>
                </div>
              )}
            </button>

            {/* Recent Projects */}
            {recentProjects.length > 0 && (
              <div className="mt-8">
                <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  Recent Projects
                </h2>
                <div className="space-y-2">
                  {recentProjects.slice(0, 5).map((recent) => (
                    <div
                      key={recent.filePath}
                      className="flex items-center gap-3 p-3 rounded-lg bg-zinc-900 hover:bg-zinc-800 transition-colors group"
                    >
                      <div className="w-10 h-10 rounded-lg bg-zinc-800 flex items-center justify-center flex-shrink-0">
                        <FileVideo className="w-5 h-5 text-zinc-500" />
                      </div>
                      <button
                        onClick={() => handleOpenRecent(recent.filePath)}
                        className="flex-1 text-left min-w-0"
                      >
                        <p className="text-sm font-medium text-zinc-200 truncate">
                          {recent.fileName}
                        </p>
                        <p className="text-xs text-zinc-500">
                          {formatDuration(recent.duration)} • {new Date(recent.lastOpened).toLocaleDateString()}
                        </p>
                      </button>
                      <button
                        onClick={() => removeRecentProject(recent.filePath)}
                        className="p-2 opacity-0 group-hover:opacity-100 hover:bg-zinc-700 rounded transition-all"
                      >
                        <Trash2 className="w-4 h-4 text-zinc-500" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          /* Selected File Display */
          <div className="border border-zinc-800 rounded-2xl p-6 bg-zinc-900/50">
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-xl bg-violet-500/10 flex items-center justify-center flex-shrink-0">
                <FileVideo className="w-7 h-7 text-violet-400" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-zinc-100 truncate">{project.fileName}</h3>
                <div className="flex items-center gap-4 mt-1 text-sm text-zinc-400">
                  {project.size > 0 && <span>{formatFileSize(project.size)}</span>}
                  <span>•</span>
                  <span>{formatDuration(project.duration)}</span>
                </div>
              </div>
              <button
                onClick={handleClear}
                className="text-zinc-500 hover:text-zinc-300 text-sm px-3 py-1 hover:bg-zinc-800 rounded"
              >
                Change
              </button>
            </div>

            {/* Analyze button */}
            <button
              onClick={handleAnalyze}
              className="w-full mt-6 py-4 bg-violet-600 hover:bg-violet-500 rounded-xl font-semibold text-white text-lg transition-colors flex items-center justify-center gap-2"
            >
              <Sparkles className="w-5 h-5" />
              Start Analysis
            </button>
          </div>
        )}

        {/* Error display */}
        {error && (
          <div className="mt-4 p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-red-400 font-medium">Error</p>
              <p className="text-red-300/80 text-sm mt-1">{error}</p>
            </div>
          </div>
        )}
      </div>

      {/* Feature highlights */}
      <div className="mt-16 grid grid-cols-3 gap-8 text-center max-w-2xl">
        <div>
          <div className="text-3xl mb-2">🎯</div>
          <h3 className="font-semibold text-zinc-200">Smart Detection</h3>
          <p className="text-sm text-zinc-500">3 viral patterns + AI</p>
        </div>
        <div>
          <div className="text-3xl mb-2">✂️</div>
          <h3 className="font-semibold text-zinc-200">Auto Edit</h3>
          <p className="text-sm text-zinc-500">Remove dead space</p>
        </div>
        <div>
          <div className="text-3xl mb-2">📦</div>
          <h3 className="font-semibold text-zinc-200">Clean Export</h3>
          <p className="text-sm text-zinc-500">Ready to post clips</p>
        </div>
      </div>
    </div>
  );
}
