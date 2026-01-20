import { memo } from 'react';
import { Search, Check, Download, Sparkles, Clock, CheckCircle2 } from 'lucide-react';
import { Button } from '../ui';

interface WorkflowBarProps {
  hasProject: boolean;
  hasClips: boolean;
  acceptedCount: number;
  pendingCount: number;
  isDetecting: boolean;
  onDetect: () => void;
  onExportAll: () => void;
}

function WorkflowBar({
  hasProject,
  hasClips,
  acceptedCount,
  pendingCount,
  isDetecting,
  onDetect,
  onExportAll,
}: WorkflowBarProps) {
  // Determine current workflow step
  const currentStep = !hasProject ? 0 : !hasClips ? 1 : acceptedCount > 0 ? 3 : 2;

  return (
    <div className="bg-sz-bg-secondary border-b border-sz-border px-6 py-3">
      <div className="flex items-center justify-between gap-6">
        {/* Workflow Steps */}
        <div className="flex items-center gap-4">
          {/* Step 1: Load Video */}
          <div className="flex items-center gap-2">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-sm transition-all ${
              currentStep >= 1 
                ? 'bg-sz-accent/20 border-2 border-sz-accent text-sz-accent' 
                : 'bg-sz-bg-tertiary border border-sz-border text-sz-text-muted'
            }`}>
              {currentStep > 1 ? <CheckCircle2 className="w-4 h-4" /> : '1'}
            </div>
            <span className={`text-sm font-medium ${
              currentStep >= 1 ? 'text-sz-text' : 'text-sz-text-muted'
            }`}>
              Load Video
            </span>
          </div>

          <div className={`w-12 h-px ${currentStep >= 2 ? 'bg-sz-accent' : 'bg-sz-border'}`} />

          {/* Step 2: Detect Clips */}
          <div className="flex items-center gap-2">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-sm transition-all ${
              currentStep >= 2 
                ? 'bg-sz-accent/20 border-2 border-sz-accent text-sz-accent' 
                : 'bg-sz-bg-tertiary border border-sz-border text-sz-text-muted'
            }`}>
              {currentStep > 2 ? <CheckCircle2 className="w-4 h-4" /> : '2'}
            </div>
            <span className={`text-sm font-medium ${
              currentStep >= 2 ? 'text-sz-text' : 'text-sz-text-muted'
            }`}>
              Detect Clips
            </span>
          </div>

          <div className={`w-12 h-px ${currentStep >= 3 ? 'bg-sz-accent' : 'bg-sz-border'}`} />

          {/* Step 3: Review */}
          <div className="flex items-center gap-2">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-sm transition-all ${
              currentStep >= 3 
                ? 'bg-sz-accent/20 border-2 border-sz-accent text-sz-accent' 
                : 'bg-sz-bg-tertiary border border-sz-border text-sz-text-muted'
            }`}>
              {currentStep > 3 ? <CheckCircle2 className="w-4 h-4" /> : '3'}
            </div>
            <span className={`text-sm font-medium ${
              currentStep >= 3 ? 'text-sz-text' : 'text-sz-text-muted'
            }`}>
              Review & Accept
            </span>
          </div>

          <div className={`w-12 h-px ${currentStep >= 4 ? 'bg-sz-accent' : 'bg-sz-border'}`} />

          {/* Step 4: Export */}
          <div className="flex items-center gap-2">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-sm transition-all ${
              currentStep >= 4 
                ? 'bg-sz-accent/20 border-2 border-sz-accent text-sz-accent' 
                : 'bg-sz-bg-tertiary border border-sz-border text-sz-text-muted'
            }`}>
              4
            </div>
            <span className={`text-sm font-medium ${
              currentStep >= 4 ? 'text-sz-text' : 'text-sz-text-muted'
            }`}>
              Export
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3">
          {/* Status indicators */}
          {hasClips && (
            <div className="flex items-center gap-4 mr-4">
              {pendingCount > 0 && (
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-yellow-400" />
                  <span className="text-sm text-sz-text-muted">
                    {pendingCount} to review
                  </span>
                </div>
              )}
              {acceptedCount > 0 && (
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-400" />
                  <span className="text-sm text-sz-text">
                    {acceptedCount} accepted
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Show reminder if no API key and has project but no clips */}
          {hasProject && !hasClips && !isDetecting && (
            <div className="flex items-center gap-2 text-xs text-yellow-400 bg-yellow-400/10 px-3 py-1.5 rounded-md">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Need AI? Add OpenAI key in Settings</span>
            </div>
          )}

          {/* ALWAYS show Analyze/Detect button when there's a project */}
          {hasProject && !isDetecting && (
            <Button
              variant="primary"
              size="lg"
              leftIcon={<Search className="w-5 h-5" />}
              onClick={onDetect}
              className="shadow-lg shadow-sz-accent/20"
            >
              {hasClips ? 'Re-Analyze' : 'Analyze Video'}
            </Button>
          )}

          {/* Export button only when clips are accepted */}
          {hasClips && acceptedCount > 0 && (
            <Button
              variant="success"
              size="lg"
              leftIcon={<Download className="w-5 h-5" />}
              onClick={onExportAll}
              className="shadow-lg shadow-green-500/20"
            >
              Export {acceptedCount} Clip{acceptedCount !== 1 ? 's' : ''}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export default memo(WorkflowBar);
