/**
 * Screen 2: Processing
 * System analyzes the video and generates clips
 * 
 * Rule #2: 3 SCREENS ONLY
 * This screen shows progress during pipeline execution
 * 
 * UX: Spotify-style animated lyrics showing what's happening
 */

import React, { useEffect, useState, useMemo } from 'react';
import type { FC } from 'react';
import type { ProcessingStage } from '../types';

interface ProcessingScreenProps {
  currentStage?: ProcessingStage;
  detectionProgress?: { percent: number; message: string } | null;
  error?: string;
  onCancel?: () => void;
}

// Engaging descriptions for each stage
const STAGE_LINES: Record<string, string[]> = {
  preparing: [
    '🎬 Loading your video...',
    '✨ Analyzing video format',
    '🔄 Extracting audio track',
    '⚙️ Optimizing for processing',
    '✅ Ready to listen',
  ],
  listening: [
    '👂 Tuning in to your audio',
    '🎙️ Detecting speech patterns',
    '🌊 Analyzing sound waves',
    '📍 Marking key moments',
    '✅ Audio analysis complete',
  ],
  understanding: [
    '🧠 Understanding the narrative',
    '📖 Mapping story structure',
    '🎯 Finding pacing breaks',
    '⚡ Identifying energy shifts',
    '✅ Story analysis done',
  ],
  detecting: [
    '🔍 Hunting for great moments',
    '⭐ Finding the punchlines',
    '🎪 Spotting comedic beats',
    '🔊 Detecting sound spikes',
    '🧩 Building your clips',
    '✅ Clips ready',
  ],
  finalizing: [
    '🎞️ Assembling your results',
    '📋 Organizing clips',
    '🏆 Ranking by quality',
    '✨ Adding metadata',
    '🚀 Almost there...',
    '✅ Complete!',
  ],
};

export const ProcessingScreen: FC<ProcessingScreenProps> = ({ 
  currentStage = 'preparing',
  detectionProgress,
  error,
  onCancel 
}) => {
  const [lineIndex, setLineIndex] = useState(0);
  const [displayProgress, setDisplayProgress] = useState(0);
  
  // Get the current lines for this stage
  const lines = STAGE_LINES[currentStage] || STAGE_LINES.preparing;
  
  // Update line index based on detection progress
  useEffect(() => {
    if (detectionProgress?.percent) {
      // Map 0-100 to line index (0 to lines.length - 1)
      const newIndex = Math.floor((detectionProgress.percent / 100) * lines.length);
      setLineIndex(Math.min(newIndex, lines.length - 1));
      setDisplayProgress(detectionProgress.percent);
    }
  }, [detectionProgress, lines.length]);

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
    <div className="h-screen w-screen flex flex-col items-center justify-center bg-gradient-to-b from-zinc-950 via-blue-950/10 to-zinc-950 overflow-hidden">
      {/* Animated lyrics-style container */}
      <div className="flex-1 flex flex-col items-center justify-center px-8 max-w-2xl w-full space-y-8">
        
        {/* Previous lines - faded and small */}
        <div className="h-24 flex flex-col justify-end gap-2 opacity-40">
          {lines.slice(Math.max(0, lineIndex - 2), lineIndex).map((line, i) => (
            <div
              key={i}
              className="text-lg text-zinc-500 transform transition-all duration-500"
              style={{
                fontSize: `${12 + i * 4}px`,
                opacity: 0.3 + i * 0.15,
              }}
            >
              {line}
            </div>
          ))}
        </div>

        {/* Current line - big and focused */}
        <div className="text-center py-12">
          <div className="text-6xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-cyan-300 to-blue-500 animate-pulse min-h-24 flex items-center justify-center">
            {lines[lineIndex]}
          </div>
        </div>

        {/* Next lines - faded and approaching */}
        <div className="h-24 flex flex-col justify-start gap-2 opacity-40">
          {lines.slice(lineIndex + 1, Math.min(lineIndex + 3, lines.length)).map((line, i) => (
            <div
              key={i}
              className="text-lg text-zinc-600 transform transition-all duration-500"
              style={{
                fontSize: `${18 - i * 4}px`,
                opacity: 0.2 - i * 0.1,
              }}
            >
              {line}
            </div>
          ))}
        </div>
      </div>

      {/* Progress info at bottom */}
      <div className="w-full max-w-2xl px-8 py-12 space-y-6">
        
        {/* Progress bar */}
        <div>
          <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden mb-3">
            <div
              className="h-full bg-gradient-to-r from-cyan-500 via-blue-500 to-blue-600 rounded-full transition-all duration-300"
              style={{ width: `${Math.min(displayProgress, 100)}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-zinc-500">{Math.round(Math.min(displayProgress, 100))}%</span>
            {detectionProgress?.message && (
              <span className="text-zinc-400 text-xs">{detectionProgress.message}</span>
            )}
          </div>
        </div>

        {/* Stage indicator */}
        <div className="flex items-center justify-center gap-2 text-sm text-zinc-500">
          <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
          <span>{currentStage.charAt(0).toUpperCase() + currentStage.slice(1)}</span>
        </div>

        {/* Cancel button */}
        {onCancel && (
          <div className="flex justify-center">
            <button
              onClick={onCancel}
              className="px-4 py-2 text-sm text-zinc-400 hover:text-zinc-200 transition-colors border border-zinc-700 hover:border-zinc-500 rounded-lg"
            >
              Cancel
            </button>
          </div>
        )}
      </div>

      {/* Ambient glow effect */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl" />
      </div>
    </div>
  );
};
