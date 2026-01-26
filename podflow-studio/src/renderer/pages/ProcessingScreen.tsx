/**
 * Screen 2: Processing
 * System analyzes the video and generates clips
 * 
 * Rule #2: 3 SCREENS ONLY
 * This screen shows progress during pipeline execution
 * 
 * UX: "Professional editor at work" - calm, confident, steady progress
 */

import React, { useEffect, useState } from 'react';
import type { FC } from 'react';
import type { ProcessingStage } from '../types';

interface ProcessingScreenProps {
  currentStage?: ProcessingStage;
  error?: string;
  onCancel?: () => void;
}

// Map stages to human-readable descriptions and stage numbers
const STAGE_CONFIG: Record<ProcessingStage, { label: string; description: string; order: number }> = {
  preparing: { label: 'Preparing your video', description: 'Optimizing for analysis', order: 1 },
  listening: { label: 'Listening to the conversation', description: 'Extracting audio and speech', order: 2 },
  understanding: { label: 'Understanding the story', description: 'Analyzing narrative flow', order: 3 },
  detecting: { label: 'Finding strong moments', description: 'Identifying key clips', order: 4 },
  finalizing: { label: 'Finalizing results', description: 'Preparing your clips', order: 5 },
};

export const ProcessingScreen: FC<ProcessingScreenProps> = ({ 
  currentStage = 'preparing',
  error,
  onCancel 
}) => {
  const [displayProgress, setDisplayProgress] = useState(20);
  const stageConfig = STAGE_CONFIG[currentStage] || STAGE_CONFIG.preparing;

  // Animate progress bar smoothly
  useEffect(() => {
    const stageOrder = stageConfig.order;
    const baseProgress = (stageOrder - 1) * 18;
    const targetProgress = Math.min(baseProgress + 20, 95);
    
    const interval = setInterval(() => {
      setDisplayProgress((prev) => {
        if (prev >= targetProgress) return prev;
        return prev + Math.random() * 3;
      });
    }, 300);

    return () => clearInterval(interval);
  }, [currentStage, stageConfig.order]);

  if (error) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-zinc-950">
        <div className="max-w-md text-center">
          <div className="text-red-500 text-5xl mb-4">⚠️</div>
          <h1 className="text-2xl font-bold text-white mb-2">Something went wrong</h1>
          <p className="text-zinc-400 mb-6">{error}</p>
          {onCancel && (
            <button
              onClick={onCancel}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            >
              Start Over
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen flex items-center justify-center bg-zinc-950">
      <div className="max-w-lg w-full px-8">
        {/* Logo / Branding */}
        <div className="mb-16 text-center">
          <div className="text-2xl font-bold text-white tracking-tight">
            SeeZee Studios
          </div>
          <div className="text-xs text-zinc-500 mt-1">Professional Podcast Editing</div>
        </div>

        {/* Main Status */}
        <div className="mb-12">
          <h1 className="text-4xl font-bold text-white mb-2 leading-tight">
            {stageConfig.label}
          </h1>
          <p className="text-lg text-zinc-400">
            {stageConfig.description}
          </p>
        </div>

        {/* Progress Bar */}
        <div className="mb-8">
          <div className="h-1 bg-zinc-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full transition-all duration-300 ease-out"
              style={{ width: `${Math.min(displayProgress, 100)}%` }}
            />
          </div>
          <div className="mt-2 text-sm text-zinc-500">
            {Math.round(Math.min(displayProgress, 100))}%
          </div>
        </div>

        {/* Stage Indicators */}
        <div className="mb-12 space-y-2">
          {Object.entries(STAGE_CONFIG).map(([stageKey, config]) => {
            const isActive = stageKey === currentStage;
            const isPast = config.order < stageConfig.order;
            
            return (
              <div key={stageKey} className="flex items-center gap-3">
                <div
                  className={`w-2 h-2 rounded-full transition-all ${
                    isPast
                      ? 'bg-blue-500'
                      : isActive
                      ? 'bg-blue-500 scale-125'
                      : 'bg-zinc-700'
                  }`}
                />
                <span
                  className={`text-sm ${
                    isPast
                      ? 'text-zinc-500 line-through'
                      : isActive
                      ? 'text-white font-medium'
                      : 'text-zinc-600'
                  }`}
                >
                  {config.label}
                </span>
              </div>
            );
          })}
        </div>

        {/* Reassurance Text */}
        <div className="text-center">
          <p className="text-sm text-zinc-500 mb-6">
            This typically takes 2–5 minutes depending on episode length.
          </p>
          
          {onCancel && (
            <button
              onClick={onCancel}
              className="px-4 py-2 text-sm text-zinc-400 hover:text-zinc-200 transition-colors border border-zinc-700 hover:border-zinc-500 rounded-lg"
            >
              Cancel
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
