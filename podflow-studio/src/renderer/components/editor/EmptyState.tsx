import { memo } from 'react';
import { Search, Sparkles, Zap } from 'lucide-react';
import { Button } from '../ui';

interface EmptyStateProps {
  onDetect: () => void;
  isDetecting: boolean;
}

function EmptyState({ onDetect, isDetecting }: EmptyStateProps) {
  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="max-w-lg text-center space-y-6">
        {/* Icon */}
        <div className="flex justify-center">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-sz-accent/20 to-purple-500/20 border-2 border-sz-accent/30 flex items-center justify-center">
            <Search className="w-10 h-10 text-sz-accent" />
          </div>
        </div>

        {/* Heading */}
        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-sz-text">
            Ready to Find Viral Clips?
          </h2>
          <p className="text-sm text-sz-text-muted leading-relaxed">
            Your video is loaded. Click the button below to automatically detect the best moments for social media clips.
          </p>
        </div>

        {/* CTA Button */}
        <Button
          variant="primary"
          size="xl"
          leftIcon={<Search className="w-5 h-5" />}
          onClick={onDetect}
          disabled={isDetecting}
          className="shadow-lg shadow-sz-accent/20"
        >
          {isDetecting ? 'Detecting...' : 'Detect Clips'}
        </Button>

        {/* Features List */}
        <div className="mt-8 pt-6 border-t border-sz-border/50">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-sz-accent/10 flex items-center justify-center flex-shrink-0">
                <Zap className="w-4 h-4 text-sz-accent" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-sz-text mb-1">Smart Detection</h3>
                <p className="text-xs text-sz-text-muted">Finds payoff moments, monologues, debates & laughter</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-sz-accent/10 flex items-center justify-center flex-shrink-0">
                <Sparkles className="w-4 h-4 text-sz-accent" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-sz-text mb-1">AI Enhancement</h3>
                <p className="text-xs text-sz-text-muted">Optional AI titles, hooks & virality scoring</p>
              </div>
            </div>
          </div>
        </div>

        {/* Tip */}
        <div className="mt-6 p-3 bg-sz-bg-secondary/50 rounded-lg border border-sz-border/50">
          <p className="text-xs text-sz-text-muted">
            💡 <span className="font-medium">Tip:</span> Detection takes 30-60 seconds for a 1-hour video
          </p>
        </div>
      </div>
    </div>
  );
}

export default memo(EmptyState);
