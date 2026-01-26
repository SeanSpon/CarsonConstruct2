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

import React, { useCallback } from 'react';
import type { FC } from 'react';
import { useStore } from '../stores/store';

interface UploadScreenProps {
  onStartProcessing?: () => void;
}

export const UploadScreen: FC<UploadScreenProps> = ({ onStartProcessing }) => {
  const { project, isDetecting } = useStore();
  
  // Prevent double-click by disabling during detection
  const handleStart = useCallback(() => {
    if (isDetecting) return; // Already processing
    onStartProcessing?.();
  }, [isDetecting, onStartProcessing]);

  return (
    <div className="upload-screen">
      <h1>Upload Video</h1>
      <p>Select a video file to analyze</p>
      
      {/* Start button - disabled while detecting */}
      <button
        onClick={handleStart}
        disabled={isDetecting || !project}
        className={`px-6 py-3 rounded-lg font-medium transition-colors ${
          isDetecting || !project
            ? 'bg-gray-400 text-gray-600 cursor-not-allowed'
            : 'bg-blue-600 text-white hover:bg-blue-700'
        }`}
      >
        {isDetecting ? 'Processing...' : 'Start Detection'}
      </button>
      
      {/* Components will be added here */}
    </div>
  );
};
