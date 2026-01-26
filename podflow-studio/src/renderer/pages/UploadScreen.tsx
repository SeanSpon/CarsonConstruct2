/**
 * 🟩 SCREEN 1: UPLOAD / START
 * 
 * Purpose: Begin a run
 * User thought: "I'm starting something."
 * 
 * ALLOWED:
 * - Upload video(s)
 * - Optional transcript
 * - One button: Start
 * 
 * NOT ALLOWED:
 * - Settings
 * - Toggles
 * - Advanced options
 * - Anything that makes the user think
 */

import { useCallback, useState } from 'react';
import { useStore } from '../stores/store';
import type { Project } from '../types';

interface UploadScreenProps {
  onStartProcessing: () => void;
}

export function UploadScreen({ onStartProcessing }: UploadScreenProps) {
  const { project, setProject } = useStore();
  const [isDragging, setIsDragging] = useState(false);

  const handleSelectFile = useCallback(async () => {
    try {
      const result = await window.api.selectFile();
      if (result) {
        // Validate and create proper Project object
        const validation = await window.api.validateFile(result.path);
        if (validation?.valid) {
          setProject({
            filePath: result.path,
            fileName: result.name || result.path.split(/[\\/]/).pop() || 'Unknown',
            duration: validation.duration || 0,
            size: result.size || 0,
            resolution: validation.resolution,
            width: validation.width,
            height: validation.height,
            fps: validation.fps,
          } as Project);
        }
      }
    } catch (err) {
      console.error('File selection error:', err);
    }
  }, [setProject]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = Array.from(e.dataTransfer.files);
    const videoFile = files.find(f => 
      f.type.startsWith('video/') || 
      f.name.endsWith('.mp4') || 
      f.name.endsWith('.mov')
    );
    
    if (videoFile) {
      // Validate the file path
      const filePath = (videoFile as any).path;
      if (filePath) {
        const result = await window.api.validateFile(filePath);
        if (result?.valid) {
          setProject({
            filePath: filePath,
            fileName: videoFile.name,
            duration: result.duration || 0,
            size: videoFile.size,
            resolution: result.resolution,
            width: result.width,
            height: result.height,
            fps: result.fps,
          } as Project);
        }
      }
    }
  }, [setProject]);

  const handleStart = useCallback(() => {
    if (project) {
      onStartProcessing();
    }
  }, [project, onStartProcessing]);

  const handleClearProject = useCallback(() => {
    setProject(null);
  }, [setProject]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-zinc-950 p-8">
      {/* Header */}
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold text-white mb-2">
          PodFlow Studio
        </h1>
        <p className="text-zinc-400 text-lg">
          Turn podcasts into viral clips
        </p>
      </div>

      {/* Upload Area */}
      {!project ? (
        <div
          onClick={handleSelectFile}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`
            w-full max-w-2xl h-80 rounded-2xl border-2 border-dashed 
            flex flex-col items-center justify-center cursor-pointer
            transition-all duration-200
            ${isDragging 
              ? 'border-violet-500 bg-violet-500/10' 
              : 'border-zinc-700 hover:border-zinc-500 bg-zinc-900/50'
            }
          `}
        >
          <div className="text-6xl mb-4">🎬</div>
          <p className="text-xl text-white font-medium mb-2">
            Drop your podcast video here
          </p>
          <p className="text-zinc-500">
            or click to browse
          </p>
          <p className="text-zinc-600 text-sm mt-4">
            MP4, MOV supported
          </p>
        </div>
      ) : (
        /* Video Selected State */
        <div className="w-full max-w-2xl">
          <div className="bg-zinc-900 rounded-2xl p-8 border border-zinc-800">
            {/* File Info */}
            <div className="flex items-center gap-4 mb-8">
              <div className="w-16 h-16 bg-zinc-800 rounded-xl flex items-center justify-center">
                <span className="text-3xl">🎬</span>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-medium text-white truncate">
                  {project.fileName}
                </h3>
                <p className="text-zinc-500 text-sm">
                  {formatDuration(project.duration)} • {formatFileSize(project.size)}
                </p>
              </div>
              <button
                onClick={handleClearProject}
                className="p-2 text-zinc-500 hover:text-white transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Start Button - The ONE button */}
            <button
              onClick={handleStart}
              className="
                w-full py-4 rounded-xl font-semibold text-lg
                bg-violet-600 hover:bg-violet-500 text-white
                transition-all duration-200
                flex items-center justify-center gap-3
              "
            >
              <span>Find Clips</span>
              <span>→</span>
            </button>
          </div>

          {/* Reassurance text */}
          <p className="text-center text-zinc-600 text-sm mt-6">
            We'll automatically transcribe and find the best moments
          </p>
        </div>
      )}

      {/* Footer branding (Rule #8: Quiet but present) */}
      <div className="absolute bottom-6 text-zinc-700 text-sm">
        Powered by SeeZee Studios
      </div>
    </div>
  );
}

// Utility functions (can move to shared utils later)
function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}
