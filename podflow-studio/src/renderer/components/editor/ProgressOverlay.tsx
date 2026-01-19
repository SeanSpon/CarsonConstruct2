import { memo } from 'react';
import { X } from 'lucide-react';
import type { DetectionProgress } from '../../types';
import { Button } from '../ui';

interface ProgressOverlayProps {
  progress: DetectionProgress;
  onCancel: () => void;
}

function ProgressOverlay({ progress, onCancel }: ProgressOverlayProps) {
  return (
    <div className="fixed inset-0 bg-sz-bg/90 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="w-full max-w-md mx-4 bg-sz-bg-secondary rounded-sz-lg border border-sz-border p-6 shadow-sz-float">
        {/* Logo animation */}
        <div className="text-center mb-6">
          <div className="flex items-center justify-center gap-0 mb-4 animate-sz-pulse">
            <span className="text-2xl font-bold text-sz-text tracking-wide">SEE</span>
            <span className="mx-1.5 px-2 py-0.5 bg-sz-accent rounded text-xs font-bold text-white tracking-wide">
              STUDIO
            </span>
            <span className="text-2xl font-bold text-sz-text tracking-wide">ZEE</span>
          </div>
        </div>

        {/* Progress info */}
        <div className="text-center mb-6">
          <h3 className="text-lg font-semibold text-sz-text mb-2">
            Finding Viral Moments
          </h3>
          <p className="text-sm text-sz-text-secondary">
            {progress.message}
          </p>
        </div>

        {/* Progress bar */}
        <div className="mb-4">
          <div className="h-2 bg-sz-bg rounded-full overflow-hidden">
            <div
              className="h-full bg-sz-accent rounded-full transition-all duration-300"
              style={{ width: `${progress.percent}%` }}
            />
          </div>
          <div className="flex justify-between mt-2 text-xs text-sz-text-muted">
            <span>{Math.round(progress.percent)}%</span>
            <span>Analyzing...</span>
          </div>
        </div>

        {/* Status message */}
        <p className="text-center text-xs text-sz-text-muted mb-6">
          This may take a few minutes for longer videos
        </p>

        {/* Cancel button */}
        <div className="flex justify-center">
          <Button
            variant="ghost"
            size="sm"
            leftIcon={<X className="w-4 h-4" />}
            onClick={onCancel}
          >
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}

export default memo(ProgressOverlay);
