/**
 * 🟨 SCREEN 2: PROCESSING (THE MOST IMPORTANT SCREEN)
 * 
 * Purpose: Build trust
 * User thought: "This thing knows what it's doing."
 * 
 * This screen:
 * - Shows progress as HUMAN STEPS
 * - Never shows logs
 * - Never shows percentages unless meaningful
 * - Never feels "stuck"
 * 
 * This screen exists ONLY to reassure.
 * 
 * Rule #3: Progress is a story, not a bar
 */

import { useMemo } from 'react';
import { 
  type ProcessingStage, 
  STAGE_LABELS, 
  STAGE_ORDER,
} from '../types';

interface ProcessingScreenProps {
  currentStage: ProcessingStage;
  error?: string | null;
  onCancel?: () => void;
}

export function ProcessingScreen({ 
  currentStage, 
  error,
  onCancel,
}: ProcessingScreenProps) {
  
  // Get current stage index for progress display
  const currentStageIndex = useMemo(() => {
    return STAGE_ORDER.indexOf(currentStage);
  }, [currentStage]);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-zinc-950 p-8">
        <div className="text-center max-w-md">
          <div className="text-6xl mb-6">😔</div>
          <h2 className="text-2xl font-bold text-white mb-4">
            Something went wrong
          </h2>
          <p className="text-zinc-400 mb-8">
            We couldn't process your video. This sometimes happens with unusual formats.
          </p>
          <button
            onClick={onCancel}
            className="px-6 py-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-zinc-950 p-8">
      {/* Header */}
      <div className="text-center mb-16">
        <h1 className="text-3xl font-bold text-white mb-2">
          Working on your clips
        </h1>
        <p className="text-zinc-500">
          This usually takes a few minutes
        </p>
      </div>

      {/* Stage Timeline - Vertical progress */}
      <div className="w-full max-w-md">
        {STAGE_ORDER.map((stage, index) => {
          const isComplete = index < currentStageIndex;
          const isCurrent = index === currentStageIndex;
          const isPending = index > currentStageIndex;

          return (
            <div 
              key={stage}
              className="flex items-start gap-4 mb-6 last:mb-0"
            >
              {/* Stage indicator */}
              <div className="flex flex-col items-center">
                <div 
                  className={`
                    w-10 h-10 rounded-full flex items-center justify-center
                    transition-all duration-500
                    ${isComplete 
                      ? 'bg-emerald-500/20 text-emerald-400' 
                      : isCurrent
                        ? 'bg-violet-500/20 text-violet-400 ring-2 ring-violet-500/50 ring-offset-2 ring-offset-zinc-950'
                        : 'bg-zinc-800 text-zinc-600'
                    }
                  `}
                >
                  {isComplete ? (
                    <CheckIcon />
                  ) : isCurrent ? (
                    <PulsingDot />
                  ) : (
                    <span className="text-sm font-medium">{index + 1}</span>
                  )}
                </div>
                {/* Connecting line */}
                {index < STAGE_ORDER.length - 1 && (
                  <div 
                    className={`
                      w-0.5 h-6 mt-2
                      ${isComplete ? 'bg-emerald-500/50' : 'bg-zinc-800'}
                    `}
                  />
                )}
              </div>

              {/* Stage label */}
              <div className="flex-1 pt-2">
                <p 
                  className={`
                    font-medium transition-colors duration-300
                    ${isComplete 
                      ? 'text-zinc-400' 
                      : isCurrent 
                        ? 'text-white' 
                        : 'text-zinc-600'
                    }
                  `}
                >
                  {STAGE_LABELS[stage]}
                </p>
                {isCurrent && (
                  <p className="text-zinc-500 text-sm mt-1 animate-pulse">
                    Working...
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Cancel button (subtle) */}
      {onCancel && (
        <button
          onClick={onCancel}
          className="mt-16 text-zinc-600 hover:text-zinc-400 text-sm transition-colors"
        >
          Cancel
        </button>
      )}

      {/* Footer branding */}
      <div className="absolute bottom-6 text-zinc-700 text-sm">
        Powered by SeeZee Studios
      </div>
    </div>
  );
}

// Simple check icon
function CheckIcon() {
  return (
    <svg 
      className="w-5 h-5" 
      fill="none" 
      viewBox="0 0 24 24" 
      stroke="currentColor"
    >
      <path 
        strokeLinecap="round" 
        strokeLinejoin="round" 
        strokeWidth={2} 
        d="M5 13l4 4L19 7" 
      />
    </svg>
  );
}

// Animated pulsing dot for current stage
function PulsingDot() {
  return (
    <div className="relative">
      <div className="w-3 h-3 bg-violet-500 rounded-full" />
      <div className="absolute inset-0 w-3 h-3 bg-violet-500 rounded-full animate-ping" />
    </div>
  );
}
