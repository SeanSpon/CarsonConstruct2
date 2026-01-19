import { memo } from 'react';
import { Scissors, Sparkles, Wand2, Check, X } from 'lucide-react';
import { Card, CardContent, Button } from '../ui';
import type { Patch } from '../../review/clipProject';
import { summarizePatch } from '../../review/clipProject';

export interface PatchPanelProps {
  pendingPatch: Patch | null;
  onGeneratePatch: (type: 'tight' | 'caption' | 'preset') => void;
  onApplyPatch: () => void;
  onRejectPatch: () => void;
}

function PatchPanel({
  pendingPatch,
  onGeneratePatch,
  onApplyPatch,
  onRejectPatch,
}: PatchPanelProps) {
  return (
    <div className="space-y-4">
      {/* Patch Generator */}
      <Card noPadding>
        <CardContent className="p-4 space-y-3">
          <h3 className="text-xs font-semibold text-sz-text-muted uppercase tracking-wider">AI Suggestions</h3>
          <button
            onClick={() => onGeneratePatch('tight')}
            className="w-full px-3 py-2 bg-sz-bg-tertiary hover:bg-sz-bg-hover text-sz-text rounded-sz flex items-center gap-2 text-sm transition-colors"
          >
            <Scissors className="w-4 h-4 text-sz-accent" />
            Tighten Cut Points
          </button>
          <button
            onClick={() => onGeneratePatch('caption')}
            className="w-full px-3 py-2 bg-sz-bg-tertiary hover:bg-sz-bg-hover text-sz-text rounded-sz flex items-center gap-2 text-sm transition-colors"
          >
            <Sparkles className="w-4 h-4 text-purple-400" />
            Emphasize Captions
          </button>
          <button
            onClick={() => onGeneratePatch('preset')}
            className="w-full px-3 py-2 bg-sz-bg-tertiary hover:bg-sz-bg-hover text-sz-text rounded-sz flex items-center gap-2 text-sm transition-colors"
          >
            <Wand2 className="w-4 h-4 text-amber-400" />
            Apply Shorts Preset
          </button>
        </CardContent>
      </Card>

      {/* Pending Patch */}
      {pendingPatch && (
        <Card noPadding className="border-sz-accent/30 bg-sz-accent-muted/20">
          <CardContent className="p-4 space-y-3">
            <h3 className="text-xs font-semibold text-sz-accent uppercase tracking-wider">Pending Change</h3>
            <p className="text-sm text-sz-text">{pendingPatch.label}</p>
            <ul className="text-xs text-sz-text-secondary space-y-1">
              {summarizePatch(pendingPatch).map((line) => (
                <li key={line}>• {line}</li>
              ))}
            </ul>
            <div className="flex gap-2 pt-2">
              <Button
                variant="primary"
                size="sm"
                onClick={onApplyPatch}
                leftIcon={<Check className="w-3.5 h-3.5" />}
                fullWidth
              >
                Apply
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={onRejectPatch}
                leftIcon={<X className="w-3.5 h-3.5" />}
              >
                Reject
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default memo(PatchPanel);
