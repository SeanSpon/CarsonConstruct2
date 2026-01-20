import { memo } from 'react';
import { Check, X, Download, Copy, Link } from 'lucide-react';
import type { Clip } from '../../types';
import { Button } from '../ui';

interface QuickActionsProps {
  clip: Clip;
  onAccept: () => void;
  onReject: () => void;
  onExport: () => void;
}

const patternLabels: Record<string, string> = {
  payoff: 'Payoff',
  monologue: 'Monologue',
  laughter: 'Laughter',
  debate: 'Debate',
};

const patternColors: Record<string, string> = {
  payoff: 'bg-[#00D9FF]/20 text-[#00D9FF] border-[#00D9FF]/30',
  monologue: 'bg-[#A855F7]/20 text-[#A855F7] border-[#A855F7]/30',
  laughter: 'bg-[#FACC15]/20 text-[#FACC15] border-[#FACC15]/30',
  debate: 'bg-[#F97316]/20 text-[#F97316] border-[#F97316]/30',
};

function QuickActions({ clip, onAccept, onReject, onExport }: QuickActionsProps) {
  const handleCopyTitle = () => {
    if (clip.title) {
      navigator.clipboard.writeText(clip.title);
    }
  };

  const handleCopyHook = () => {
    if (clip.hookText) {
      navigator.clipboard.writeText(clip.hookText);
    }
  };

  return (
    <div className="bg-sz-bg-secondary rounded-sz-lg border border-sz-border p-4">
      {/* Clip Info Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <span className={`px-3 py-1.5 rounded-md text-sm font-semibold border ${patternColors[clip.pattern] || patternColors.payoff}`}>
            {clip.patternLabel || patternLabels[clip.pattern] || clip.pattern}
          </span>
          <div className="flex items-center gap-2">
            <span className="text-xs text-sz-text-muted font-medium">Quality Score:</span>
            <div className="px-3 py-1.5 rounded-md bg-sz-accent/10 border border-sz-accent/30">
              <span className="text-base font-bold text-sz-accent">
                {Math.round(clip.finalScore)}/100
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Title/Description */}
      {clip.title && (
        <div className="mb-4 p-3 bg-sz-bg-tertiary/50 rounded-md border border-sz-border/50">
          <p className="text-sm font-medium text-sz-text leading-relaxed">
            {clip.title}
          </p>
        </div>
      )}

      {/* Hook Text */}
      {clip.hookText && (
        <div className="mb-4 p-3 bg-gradient-to-r from-sz-accent/5 to-purple-500/5 rounded-md border border-sz-accent/20">
          <div className="flex items-start gap-2">
            <span className="text-xs font-bold text-sz-accent uppercase tracking-wider mt-0.5">Hook:</span>
            <p className="text-sm text-sz-text-secondary leading-relaxed flex-1">
              "{clip.hookText}"
            </p>
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Button
            variant={clip.status === 'accepted' ? 'success' : 'secondary'}
            size="md"
            leftIcon={<Check className="w-4 h-4" />}
            onClick={onAccept}
            className="min-w-[120px]"
          >
            {clip.status === 'accepted' ? 'Accepted ✓' : 'Accept'}
          </Button>
          
          <Button
            variant={clip.status === 'rejected' ? 'danger' : 'ghost'}
            size="md"
            leftIcon={<X className="w-4 h-4" />}
            onClick={onReject}
            className="min-w-[120px]"
          >
            {clip.status === 'rejected' ? 'Rejected' : 'Reject'}
          </Button>
        </div>

        <div className="flex items-center gap-2">
          {clip.title && (
            <Button
              variant="ghost"
              size="sm"
              leftIcon={<Copy className="w-4 h-4" />}
              onClick={handleCopyTitle}
              title="Copy title to clipboard"
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
              title="Copy hook to clipboard"
            >
              Copy Hook
            </Button>
          )}

          <div className="w-px h-6 bg-sz-border mx-1" />

          <Button
            variant="primary"
            size="md"
            leftIcon={<Download className="w-4 h-4" />}
            onClick={onExport}
            title="Export this clip"
          >
            Export Clip
          </Button>
        </div>
      </div>

      {/* Keyboard shortcuts hint */}
      <div className="mt-3 pt-3 border-t border-sz-border/50">
        <div className="flex items-center justify-center gap-6 text-xs text-sz-text-muted">
          <span><kbd className="px-1.5 py-0.5 bg-sz-bg-tertiary rounded text-[10px] font-mono">A</kbd> Accept</span>
          <span><kbd className="px-1.5 py-0.5 bg-sz-bg-tertiary rounded text-[10px] font-mono">R</kbd> Reject</span>
          <span><kbd className="px-1.5 py-0.5 bg-sz-bg-tertiary rounded text-[10px] font-mono">←</kbd> <kbd className="px-1.5 py-0.5 bg-sz-bg-tertiary rounded text-[10px] font-mono">→</kbd> Navigate</span>
          <span><kbd className="px-1.5 py-0.5 bg-sz-bg-tertiary rounded text-[10px] font-mono">Space</kbd> Play/Pause</span>
        </div>
      </div>
    </div>
  );
}

export default memo(QuickActions);
