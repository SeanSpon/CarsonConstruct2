/**
 * Screen 1: Upload
 * User provides video input and optionally transcript
 * 
 * Rule #2: 3 SCREENS ONLY
 * This screen focuses on input collection
 * 
 * 🔒 LOCKED: Button is DISABLED while isDetecting=true
 * This prevents double-start bugs
 */

import React, { useCallback, useState } from 'react';
import type { FC } from 'react';
import { useStore } from '../stores/store';
import { VideoAndTranscriptModal } from '../components/ui/VideoAndTranscriptModal';
import { SettingsModal } from '../components/ui/SettingsModal';

interface UploadScreenProps {
  onStartProcessing?: () => void;
}

export const UploadScreen: FC<UploadScreenProps> = ({ onStartProcessing }) => {
  const { project, setProject, isDetecting, settings } = useStore();
  const [showModal, setShowModal] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  
  // Handle video upload confirmation
  const handleVideoConfirm = useCallback(async (data: { videoPath: string; videoName: string; videoSize: number; videoHash: string }) => {
    try {
      // Validate and get video metadata
      const validation = await window.api.validateFile(data.videoPath);
      if (!validation.valid) {
        console.error('Invalid video file:', validation.error);
        return;
      }

      console.log('[UploadScreen] Video validated:', {
        duration: validation.duration,
        resolution: validation.resolution,
        width: validation.width,
        height: validation.height,
      });

      // Set project in store - duration is directly on validation, not in metadata
      setProject({
        filePath: data.videoPath,
        fileName: data.videoName,
        duration: validation.duration || 0,
        size: data.videoSize,
        thumbnailPath: validation.thumbnailPath || '',
        resolution: validation.resolution || '',
        width: validation.width || 1920,
        height: validation.height || 1080,
        fps: validation.fps || 30,
        bitrate: validation.bitrate || 0,
      });

      setShowModal(false);
    } catch (err) {
      console.error('Error setting up project:', err);
    }
  }, [setProject]);
  
  // Prevent double-click by disabling during detection
  const handleStart = useCallback(() => {
    if (isDetecting) return; // Already processing
    onStartProcessing?.();
  }, [isDetecting, onStartProcessing]);

  return (
    <div className="h-screen w-screen flex flex-col items-center justify-center bg-zinc-950 text-white p-8">
      {/* Settings button in corner */}
      <button
        onClick={() => setShowSettings(true)}
        className="absolute top-4 right-4 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-sm flex items-center gap-2 transition-colors"
      >
        ⚙️ Settings
        {!settings.openaiApiKey && (
          <span className="px-2 py-0.5 bg-yellow-600/20 text-yellow-400 text-xs rounded">No API Key</span>
        )}
      </button>

      <div className="max-w-2xl w-full space-y-8 text-center">
        <div className="space-y-4">
          <h1 className="text-4xl font-bold">Upload Video</h1>
          <p className="text-xl text-zinc-400">Select a video file to analyze</p>
        </div>

        {!project ? (
          <button
            onClick={() => setShowModal(true)}
            className="px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white text-lg font-medium rounded-lg transition-colors"
          >
            📹 Choose Video File
          </button>
        ) : (
          <div className="space-y-6">
            <div className="p-6 bg-zinc-900 border border-zinc-800 rounded-lg">
              <p className="text-lg font-medium text-green-400 mb-2">✓ Video Ready</p>
              <p className="text-sm text-zinc-400">{project.fileName}</p>
              <p className="text-xs text-zinc-500 mt-1">
                {project.duration.toFixed(1)}s • {project.resolution}
              </p>
              <button
                onClick={() => {
                  setProject(null);
                  setShowModal(true);
                }}
                className="mt-3 text-sm text-zinc-400 hover:text-white transition-colors"
              >
                Change video
              </button>
            </div>

            <button
              onClick={handleStart}
              disabled={isDetecting}
              className={`px-8 py-4 rounded-lg text-lg font-medium transition-colors ${
                isDetecting
                  ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                  : 'bg-green-600 hover:bg-green-700 text-white'
              }`}
            >
              {isDetecting ? 'Processing...' : 'Start Detection'}
            </button>
          </div>
        )}
      </div>

      {showModal && (
        <VideoAndTranscriptModal
          onConfirm={handleVideoConfirm}
          onCancel={() => setShowModal(false)}
        />
      )}

      {showSettings && (
        <SettingsModal onClose={() => setShowSettings(false)} />
      )}
    </div>
  );
};
