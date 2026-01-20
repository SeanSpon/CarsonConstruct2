import { memo } from 'react';
import { CheckCircle, Clock, Zap, FileText, User, X } from 'lucide-react';
import type { Clip, DeadSpace, Transcript } from '../../types';
import { Button } from '../ui';

interface DetectionSummaryModalProps {
  clips: Clip[];
  deadSpaces: DeadSpace[];
  transcript: Transcript | null;
  onAccept: () => void;
  onReject: () => void;
}

function DetectionSummaryModal({ clips, deadSpaces, transcript, onAccept, onReject }: DetectionSummaryModalProps) {
  const totalDuration = clips.reduce((sum, c) => sum + (c.endTime - c.startTime), 0);
  const avgScore = clips.length > 0 ? clips.reduce((sum, c) => sum + c.finalScore, 0) / clips.length : 0;
  const deadSpaceDuration = deadSpaces.reduce((sum, ds) => sum + (ds.endTime - ds.startTime), 0);
  const highScoreClips = clips.filter(c => c.finalScore >= 80).length;
  const mediumScoreClips = clips.filter(c => c.finalScore >= 60 && c.finalScore < 80).length;
  const lowScoreClips = clips.filter(c => c.finalScore < 60).length;

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="relative w-full max-w-3xl mx-4 max-h-[90vh] flex flex-col bg-sz-bg rounded-lg overflow-hidden shadow-2xl border border-sz-border">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-sz-border bg-gradient-to-r from-sz-accent/20 to-transparent">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-sz-accent/20 rounded-lg flex items-center justify-center">
              <Zap className="w-6 h-6 text-sz-accent" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-sz-text">AI Detection Complete</h2>
              <p className="text-sm text-sz-text-muted">Review the analysis before proceeding</p>
            </div>
          </div>
          <button onClick={onReject} className="p-2 hover:bg-sz-bg-hover rounded-lg transition-colors">
            <X className="w-5 h-5 text-sz-text-muted" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Summary Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 bg-sz-bg-secondary rounded-lg border border-sz-border">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="w-4 h-4 text-green-400" />
                <span className="text-xs font-medium text-sz-text-muted uppercase">Clips Found</span>
              </div>
              <p className="text-2xl font-bold text-sz-text">{clips.length}</p>
            </div>

            <div className="p-4 bg-sz-bg-secondary rounded-lg border border-sz-border">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="w-4 h-4 text-blue-400" />
                <span className="text-xs font-medium text-sz-text-muted uppercase">Total Time</span>
              </div>
              <p className="text-2xl font-bold text-sz-text">{formatTime(totalDuration)}</p>
            </div>

            <div className="p-4 bg-sz-bg-secondary rounded-lg border border-sz-border">
              <div className="flex items-center gap-2 mb-2">
                <Zap className="w-4 h-4 text-sz-accent" />
                <span className="text-xs font-medium text-sz-text-muted uppercase">Avg Score</span>
              </div>
              <p className="text-2xl font-bold text-sz-text">{Math.round(avgScore)}</p>
            </div>

            <div className="p-4 bg-sz-bg-secondary rounded-lg border border-sz-border">
              <div className="flex items-center gap-2 mb-2">
                <FileText className="w-4 h-4 text-purple-400" />
                <span className="text-xs font-medium text-sz-text-muted uppercase">Dead Space</span>
              </div>
              <p className="text-2xl font-bold text-sz-text">{formatTime(deadSpaceDuration)}</p>
            </div>
          </div>

          {/* Score Distribution */}
          <div className="p-4 bg-sz-bg-secondary rounded-lg border border-sz-border">
            <h3 className="text-sm font-semibold text-sz-text mb-3">Clip Quality Distribution</h3>
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <span className="text-xs text-sz-text-muted w-20">High (80+)</span>
                <div className="flex-1 h-2 bg-sz-bg-hover rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-green-500 transition-all duration-500" 
                    style={{ width: `${clips.length > 0 ? (highScoreClips / clips.length) * 100 : 0}%` }}
                  />
                </div>
                <span className="text-sm font-medium text-sz-text w-12 text-right">{highScoreClips}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-sz-text-muted w-20">Medium (60-79)</span>
                <div className="flex-1 h-2 bg-sz-bg-hover rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-yellow-500 transition-all duration-500" 
                    style={{ width: `${clips.length > 0 ? (mediumScoreClips / clips.length) * 100 : 0}%` }}
                  />
                </div>
                <span className="text-sm font-medium text-sz-text w-12 text-right">{mediumScoreClips}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-sz-text-muted w-20">Low (&lt;60)</span>
                <div className="flex-1 h-2 bg-sz-bg-hover rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-red-500 transition-all duration-500" 
                    style={{ width: `${clips.length > 0 ? (lowScoreClips / clips.length) * 100 : 0}%` }}
                  />
                </div>
                <span className="text-sm font-medium text-sz-text w-12 text-right">{lowScoreClips}</span>
              </div>
            </div>
          </div>

          {/* Transcript Info */}
          {transcript && (
            <div className="p-4 bg-sz-bg-secondary rounded-lg border border-sz-border">
              <div className="flex items-center gap-2 mb-2">
                <FileText className="w-4 h-4 text-sz-accent" />
                <h3 className="text-sm font-semibold text-sz-text">Transcript</h3>
              </div>
              <p className="text-sm text-sz-text-muted">
                {transcript.segments?.length || 0} segments transcribed
              </p>
            </div>
          )}

          {/* Top Clips Preview */}
          <div>
            <h3 className="text-sm font-semibold text-sz-text mb-3">Top 5 Clips</h3>
            <div className="space-y-2">
              {clips
                .sort((a, b) => b.finalScore - a.finalScore)
                .slice(0, 5)
                .map((clip, idx) => (
                  <div 
                    key={clip.id} 
                    className="p-3 bg-sz-bg-secondary rounded-lg border border-sz-border hover:border-sz-accent/50 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-lg font-bold text-sz-text-muted">#{idx + 1}</span>
                        <div>
                          <p className="text-sm font-medium text-sz-text">{clip.title || `Clip ${clip.id}`}</p>
                          <p className="text-xs text-sz-text-muted">
                            {formatTime(clip.startTime)} - {formatTime(clip.endTime)} 
                            <span className="mx-2">•</span>
                            {formatTime(clip.endTime - clip.startTime)} duration
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                          clip.finalScore >= 80 ? 'bg-green-500/20 text-green-400' :
                          clip.finalScore >= 60 ? 'bg-yellow-500/20 text-yellow-400' :
                          'bg-red-500/20 text-red-400'
                        }`}>
                          {Math.round(clip.finalScore)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-sz-border bg-sz-bg-secondary">
          <Button variant="ghost" onClick={onReject}>
            Cancel
          </Button>
          <Button variant="success" size="lg" leftIcon={<CheckCircle className="w-4 h-4" />} onClick={onAccept}>
            Accept & Continue
          </Button>
        </div>
      </div>
    </div>
  );
}

export default memo(DetectionSummaryModal);
