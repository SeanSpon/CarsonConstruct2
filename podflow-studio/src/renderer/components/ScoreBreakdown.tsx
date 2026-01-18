import { useState } from 'react';
import { ChevronDown, ChevronUp, CheckCircle, XCircle, Info } from 'lucide-react';
import type { Clip } from '../types';

interface ScoreBreakdownProps {
  clip: Clip;
}

export default function ScoreBreakdown({ clip }: ScoreBreakdownProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  const breakdown = clip.clipworthiness;
  
  if (!breakdown) {
    return null;
  }

  const { hardGates, softScores, weights } = breakdown;

  // Calculate which factors contributed most
  const topFactors = Object.entries(softScores || {})
    .filter(([key]) => !key.includes('_score') || softScores[key] > 0)
    .sort(([, a], [, b]) => (b as number) - (a as number))
    .slice(0, 3);

  return (
    <div className="mt-2 border-t border-zinc-800 pt-2">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-2 text-xs text-zinc-400 hover:text-zinc-300 w-full justify-between group"
      >
        <span className="flex items-center gap-1.5">
          <Info className="w-3.5 h-3.5" />
          Why this clip?
        </span>
        {isExpanded ? (
          <ChevronUp className="w-4 h-4 text-zinc-500 group-hover:text-zinc-400" />
        ) : (
          <ChevronDown className="w-4 h-4 text-zinc-500 group-hover:text-zinc-400" />
        )}
      </button>

      {isExpanded && (
        <div className="mt-3 space-y-3 animate-in slide-in-from-top-2 duration-200">
          {/* Hard Gates Section */}
          <div>
            <h4 className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-1.5">
              Quality Gates
            </h4>
            <div className="space-y-1">
              {hardGates && Object.entries(hardGates).map(([gate, passed]) => (
                <div key={gate} className="flex items-center gap-2">
                  {passed ? (
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                  ) : (
                    <XCircle className="w-3.5 h-3.5 text-red-500" />
                  )}
                  <span className={`text-xs ${passed ? 'text-zinc-400' : 'text-red-400'}`}>
                    {formatGateName(gate)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Soft Scores Section */}
          <div>
            <h4 className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-1.5">
              Score Components
            </h4>
            <div className="space-y-1.5">
              {/* Pattern Score */}
              {clip.algorithmScore !== undefined && (
                <ScoreBar
                  label="Pattern Detection"
                  score={clip.algorithmScore}
                  weight={weights?.pattern}
                  color="violet"
                />
              )}
              
              {/* Hook Score */}
              {softScores?.hook_score !== undefined && (
                <ScoreBar
                  label="Hook Strength"
                  score={softScores.hook_score}
                  weight={weights?.hook}
                  color="amber"
                />
              )}
              
              {/* Coherence Score */}
              {softScores?.coherence_score !== undefined && (
                <ScoreBar
                  label="Boundary Coherence"
                  score={softScores.coherence_score}
                  weight={weights?.coherence}
                  color="blue"
                />
              )}
            </div>
          </div>

          {/* Final Score Explanation */}
          <div className="pt-2 border-t border-zinc-800/50">
            <div className="flex items-center justify-between">
              <span className="text-xs text-zinc-400">Weighted Final Score</span>
              <span className="text-sm font-bold text-zinc-200">
                {Math.round(clip.finalScore)}%
              </span>
            </div>
            {weights && (
              <p className="text-[10px] text-zinc-600 mt-1">
                Pattern ({Math.round((weights.pattern || 0) * 100)}%) + 
                Hook ({Math.round((weights.hook || 0) * 100)}%) + 
                Coherence ({Math.round((weights.coherence || 0) * 100)}%)
              </p>
            )}
          </div>

          {/* AI Enhancement Info */}
          {clip.aiQualityMultiplier && clip.aiQualityMultiplier !== 1.0 && (
            <div className="pt-2 border-t border-zinc-800/50">
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-zinc-500">AI Multiplier:</span>
                <span className={`text-xs font-medium ${
                  clip.aiQualityMultiplier > 1 ? 'text-emerald-400' : 'text-amber-400'
                }`}>
                  {clip.aiQualityMultiplier.toFixed(2)}x
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface ScoreBarProps {
  label: string;
  score: number;
  weight?: number;
  color: 'violet' | 'amber' | 'blue' | 'emerald';
}

function ScoreBar({ label, score, weight, color }: ScoreBarProps) {
  const colorClasses = {
    violet: 'bg-violet-500',
    amber: 'bg-amber-500',
    blue: 'bg-blue-500',
    emerald: 'bg-emerald-500',
  };

  const normalizedScore = Math.min(100, Math.max(0, score));

  return (
    <div className="space-y-0.5">
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-zinc-500">{label}</span>
        <span className="text-[10px] text-zinc-400">
          {Math.round(normalizedScore)}
          {weight !== undefined && (
            <span className="text-zinc-600 ml-1">
              (×{(weight * 100).toFixed(0)}%)
            </span>
          )}
        </span>
      </div>
      <div className="h-1 bg-zinc-800 rounded-full overflow-hidden">
        <div
          className={`h-full ${colorClasses[color]} rounded-full transition-all duration-300`}
          style={{ width: `${normalizedScore}%` }}
        />
      </div>
    </div>
  );
}

function formatGateName(gate: string): string {
  const names: Record<string, string> = {
    speech_ratio: 'Enough speech detected',
    flatness: 'Not music/noise',
    speech_seconds: 'Minimum speech duration',
  };
  return names[gate] || gate.replace(/_/g, ' ');
}
