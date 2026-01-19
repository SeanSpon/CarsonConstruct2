import { memo } from 'react';
import { Check, X, Scissors, Download, Copy, Link } from 'lucide-react';
import type { Clip } from '../../types';
import { Button, Badge } from '../ui';

interface QuickActionsProps {
  clip: Clip;
  onAccept: () => void;
  onReject: () => void;
  onTrim?: () => void;
  onExport: () => void;
}

// Pattern to display name mapping
const patternLabels: Record<string, string> = {
  payoff: 'Payoff',
  monologue: 'Monologue',
  laughter: 'Laughter',
  debate: 'Debate',
};

// Pattern to color mapping
const patternColors: Record<string, string> = {
  payoff: 'bg-[#00D9FF]/20 text-[#00D9FF] border-[#00D9FF]/30',
  monologue: 'bg-[#A855F7]/20 text-[#A855F7] border-[#A855F7]/30',
  laughter: 'bg-[#FACC15]/20 text-[#FACC15] border-[#FACC15]/30',
  debate: 'bg-[#F97316]/20 text-[#F97316] border-[#F97316]/30',
};

function QuickActions({ clip, onAccept, onReject, onTrim, onExport }: QuickActionsProps) {
  // Copy title to clipboard
  const handleCopyTitle = () => {
    if (clip.title) {
      navigator.clipboard.writeText(clip.title);
    }
  };

  // Copy hook to clipboard
  const handleCopyHook = () => {
    if (clip.hookText) {
      navigator.clipboard.writeText(clip.hookText);
    }
  };

  return (
    <div className="bg-sz-bg-secondary rounded-sz-lg border border-sz-border p-3">
      <div className="flex items-center justify-between gap-4">
        {/* Action buttons */}
        <div className="flex items-center gap-2">
          <Button
            variant={clip.status === 'accepted' ? 'success' : 'secondary'}
            size="sm"
            leftIcon={<Check className="w-4 h-4" />}
            onClick={onAccept}
          >
            {clip.status === 'accepted' ? 'Accepted' : 'Accept'}
          </Button>
          
          <Button
            variant={clip.status === 'rejected' ? 'danger' : 'ghost'}
            size="sm"
            leftIcon={<X className="w-4 h-4" />}
            onClick={onReject}
          >
            {clip.status === 'rejected' ? 'Rejected' : 'Reject'}
          </Button>

          <div className="w-px h-6 bg-sz-border mx-1" />

          {onTrim && (
            <Button
              variant="ghost"
              size="sm"
              leftIcon={<Scissors className="w-4 h-4" />}
              onClick={onTrim}
            >
              Trim
            </Button>
          )}

          <Button
            variant="ghost"
            size="sm"
            leftIcon={<Download className="w-4 h-4" />}
            onClick={onExport}
          >
            Export Clip
          </Button>

          {clip.title && (
            <Button
              variant="ghost"
              size="sm"
              leftIcon={<Copy className="w-4 h-4" />}
              onClick={handleCopyTitle}
              title="Copy title"
            >
              Copy Title
            </Button>
          )}

          {clip.hookText && (
            <Button
              variant="ghost"
              size="sm"
              leftIcon={<Link className="w-4 h-4" />}
              onClick={handleCopyHook}
              title="Copy hook"
            >
              Copy Hook
            </Button>
          )}
        </div>

        {/* Clip info */}
        <div className="flex items-center gap-3">
          {/* Score */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-sz-text-muted">Score:</span>
            <div className="flex items-center gap-1">
              <div className="w-8 h-8 rounded-full border-2 border-sz-accent flex items-center justify-center">
                <span className="text-sm font-bold text-sz-accent">
                  {Math.round(clip.finalScore)}
                </span>
              </div>
            </div>
          </div>

          {/* Pattern badge */}
          <span className={`
            px-2 py-1 rounded text-xs font-medium border
            ${patternColors[clip.pattern] || patternColors.payoff}
          `}>
            {patternLabels[clip.pattern] || clip.pattern}
          </span>

          {/* Complete thought badge */}
          {clip.completeThought && (
            <span className="px-2 py-1 rounded text-xs font-medium bg-sz-success/20 text-sz-success border border-sz-success/30">
              Complete
            </span>
          )}
        </div>
      </div>

      {/* Hook text preview */}
      {clip.hookText && (
        <div className="mt-2 pt-2 border-t border-sz-border">
          <p className="text-xs text-sz-text-secondary truncate">
            <span className="text-sz-text-muted">Hook: </span>
            "{clip.hookText}"
          </p>
        </div>
      )}
    </div>
  );
}

export default memo(QuickActions);
