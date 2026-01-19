import { useState, memo } from 'react';
import { ChevronDown, ChevronUp, CheckCircle, XCircle, Info, Sparkles } from 'lucide-react';
import type { Clip } from '../types';

interface ScoreBreakdownProps {
  clip: Clip;
  compact?: boolean;
}

function ScoreBreakdown({ clip, compact = false }: ScoreBreakdownProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const breakdown = clip.clipworthiness;

  if (!breakdown) {
    return null;
  }

  const { hardGates, softScores, weights } = breakdown;

  if (compact) {
    return (
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full text-left"
      >
        <div className="flex items-center justify-between text-xs text-sz-text-muted hover:text-sz-text-secondary transition-colors">
          <span className="flex items-center gap-1">
            <Info className="w-3 h-3" />
            Score details
          </span>
          {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </div>
        {isExpanded && <BreakdownContent clip={clip} hardGates={hardGates} softScores={softScores} weights={weights} />}
      </button>
    );
  }

  return (
    <div className="border-t border-sz-border pt-3 mt-3">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-2 text-xs text-sz-text-secondary hover:text-sz-text w-full justify-between group"
      >
        <span className="flex items-center gap-1.5">
          <Info className="w-3.5 h-3.5" />
          Why this clip?
        </span>
        {isExpanded ? (
          <ChevronUp className="w-4 h-4 text-sz-text-muted group-hover:text-sz-text-secondary" />
        ) : (
          <ChevronDown className="w-4 h-4 text-sz-text-muted group-hover:text-sz-text-secondary" />
        )}
      </button>

      {isExpanded && (
        <BreakdownContent clip={clip} hardGates={hardGates} softScores={softScores} weights={weights} />
      )}
    </div>
  );
}

interface BreakdownContentProps {
  clip: Clip;
  hardGates?: Record<string, boolean>;
  softScores?: Record<string, number>;
  weights?: Record<string, number>;
}

const BreakdownContent = memo(function BreakdownContent({ clip, hardGates, softScores, weights }: BreakdownContentProps) {
  return (
    <div className="mt-3 space-y-3 animate-sz-fade-in">
      {/* Hard Gates Section */}
      {hardGates && Object.keys(hardGates).length > 0 && (
        <div>
          <h4 className="text-[10px] font-semibold text-sz-text-muted uppercase tracking-wider mb-1.5">
            Quality Gates
          </h4>
          <div className="space-y-1">
            {Object.entries(hardGates).map(([gate, passed]) => (
              <div key={gate} className="flex items-center gap-2">
                {passed ? (
                  <CheckCircle className="w-3 h-3 text-sz-success" />
                ) : (
                  <XCircle className="w-3 h-3 text-sz-danger" />
                )}
                <span className={`text-[11px] ${passed ? 'text-sz-text-secondary' : 'text-sz-danger'}`}>
                  {formatGateName(gate)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Soft Scores Section */}
      {(clip.algorithmScore !== undefined || softScores) && (
        <div>
          <h4 className="text-[10px] font-semibold text-sz-text-muted uppercase tracking-wider mb-1.5">
            Score Components
          </h4>
          <div className="space-y-2">
            {clip.algorithmScore !== undefined && (
              <ScoreBar
                label="Pattern Detection"
                score={clip.algorithmScore}
                weight={weights?.pattern}
                color="violet"
              />
            )}

            {softScores?.hook_score !== undefined && (
              <ScoreBar
                label="Hook Strength"
                score={softScores.hook_score}
                weight={weights?.hook}
                color="amber"
              />
            )}

            {softScores?.coherence_score !== undefined && (
              <ScoreBar
                label="Boundary Coherence"
                score={softScores.coherence_score}
                weight={weights?.coherence}
                color="cyan"
              />
            )}
          </div>
        </div>
      )}

      {/* Final Score */}
      <div className="pt-2 border-t border-sz-border">
        <div className="flex items-center justify-between">
          <span className="text-xs text-sz-text-secondary">Final Score</span>
          <span className="text-sm font-bold text-sz-text tabular-nums">
            {Math.round(clip.finalScore || clip.score)}%
          </span>
        </div>
        {weights && (
          <p className="text-[10px] text-sz-text-muted mt-1">
            Pattern ({Math.round((weights.pattern || 0) * 100)}%) +
            Hook ({Math.round((weights.hook || 0) * 100)}%) +
            Coherence ({Math.round((weights.coherence || 0) * 100)}%)
          </p>
        )}
      </div>

      {/* AI Enhancement Info */}
      {clip.aiQualityMultiplier && clip.aiQualityMultiplier !== 1.0 && (
        <div className="pt-2 border-t border-sz-border">
          <div className="flex items-center gap-2">
            <Sparkles className="w-3 h-3 text-purple-400" />
            <span className="text-[10px] text-sz-text-muted">AI Multiplier:</span>
            <span className={`text-xs font-medium ${
              clip.aiQualityMultiplier > 1 ? 'text-sz-success' : 'text-sz-warning'
            }`}>
              {clip.aiQualityMultiplier.toFixed(2)}x
            </span>
          </div>
        </div>
      )}
    </div>
  );
});

interface ScoreBarProps {
  label: string;
  score: number;
  weight?: number;
  color: 'violet' | 'amber' | 'cyan' | 'emerald';
}

const ScoreBar = memo(function ScoreBar({ label, score, weight, color }: ScoreBarProps) {
  const colorClasses = {
    violet: 'bg-violet-500',
    amber: 'bg-amber-500',
    cyan: 'bg-sz-accent',
    emerald: 'bg-sz-success',
  };

  const normalizedScore = Math.min(100, Math.max(0, score));

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-sz-text-muted">{label}</span>
        <span className="text-[10px] text-sz-text-secondary tabular-nums">
          {Math.round(normalizedScore)}
          {weight !== undefined && (
            <span className="text-sz-text-muted ml-1">
              (×{(weight * 100).toFixed(0)}%)
            </span>
          )}
        </span>
      </div>
      <div className="h-1 bg-sz-bg-hover rounded-full overflow-hidden">
        <div
          className={`h-full ${colorClasses[color]} rounded-full transition-all duration-300`}
          style={{ width: `${normalizedScore}%` }}
        />
      </div>
    </div>
  );
});

function formatGateName(gate: string): string {
  const names: Record<string, string> = {
    speech_ratio: 'Enough speech detected',
    flatness: 'Not music/noise',
    speech_seconds: 'Minimum speech duration',
  };
  return names[gate] || gate.replace(/_/g, ' ');
}

export default memo(ScoreBreakdown);
