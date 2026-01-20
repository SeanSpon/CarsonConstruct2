import { memo, useMemo, useState } from 'react';
import { 
  X, 
  Download, 
  Clock, 
  Film, 
  Check, 
  FileVideo, 
  Smartphone, 
  MessageSquare,
  Sparkles
} from 'lucide-react';
import type { Clip, ReelPlatform, ReelCaptionStyle } from '../../types';
import { formatDuration, REEL_PLATFORM_PRESETS } from '../../types';
import { Button, Toggle } from '../ui';

interface ExportPreviewModalProps {
  clips: Clip[];
  onExport: (selectedClipIds: string[], options: ExportOptions) => void;
  onClose: () => void;
  hasTranscript: boolean;
}

interface ExportOptions {
  vertical: boolean;
  platform: ReelPlatform;
  captionsEnabled: boolean;
  captionStyle: ReelCaptionStyle;
}

const PLATFORMS: { id: ReelPlatform; name: string; icon: string }[] = [
  { id: 'tiktok', name: 'TikTok', icon: '📱' },
  { id: 'instagram', name: 'Reels', icon: '📷' },
  { id: 'youtube-shorts', name: 'Shorts', icon: '▶️' },
];

const CAPTION_STYLES: { id: ReelCaptionStyle; name: string; preview: string }[] = [
  { id: 'viral', name: 'Viral', preview: 'Green highlight' },
  { id: 'minimal', name: 'Minimal', preview: 'Clean white' },
  { id: 'bold', name: 'Bold', preview: 'Heavy outline' },
];

function ExportPreviewModal({ clips, onExport, onClose, hasTranscript }: ExportPreviewModalProps) {
  const acceptedClips = useMemo(() => clips.filter(c => c.status === 'accepted'), [clips]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(acceptedClips.map(c => c.id))
  );

  // Export options
  const [exportVertical, setExportVertical] = useState(true);
  const [platform, setPlatform] = useState<ReelPlatform>('tiktok');
  const [captionsEnabled, setCaptionsEnabled] = useState(hasTranscript);
  const [captionStyle, setCaptionStyle] = useState<ReelCaptionStyle>('viral');

  const toggleClip = (clipId: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(clipId)) {
        next.delete(clipId);
      } else {
        next.add(clipId);
      }
      return next;
    });
  };

  const selectAll = () => {
    setSelectedIds(new Set(acceptedClips.map(c => c.id)));
  };

  const deselectAll = () => {
    setSelectedIds(new Set());
  };

  const { selectedClips, totalDuration, estimatedSize, maxDurationWarning } = useMemo(() => {
    const selected = acceptedClips.filter(c => selectedIds.has(c.id));
    const duration = selected.reduce((sum, c) => {
      const actualDuration = (c.endTime + c.trimEndOffset) - (c.startTime + c.trimStartOffset);
      return sum + actualDuration;
    }, 0);
    const size = (duration / 60) * 10;
    
    // Check for clips exceeding platform max duration
    const platformMax = REEL_PLATFORM_PRESETS[platform].maxDuration;
    const tooLong = selected.filter(c => {
      const dur = (c.endTime + c.trimEndOffset) - (c.startTime + c.trimStartOffset);
      return dur > platformMax;
    });

    return {
      selectedClips: selected,
      totalDuration: duration,
      estimatedSize: size,
      maxDurationWarning: tooLong.length > 0 ? 
        `${tooLong.length} clip(s) exceed ${platform} max of ${platformMax}s` : null,
    };
  }, [acceptedClips, selectedIds, platform]);

  const handleExport = () => {
    if (selectedClips.length > 0) {
      onExport(Array.from(selectedIds), {
        vertical: exportVertical,
        platform,
        captionsEnabled: captionsEnabled && hasTranscript,
        captionStyle,
      });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="relative w-full max-w-2xl mx-4 max-h-[90vh] flex flex-col bg-sz-bg rounded-lg overflow-hidden shadow-2xl border border-sz-border">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-sz-border">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-sz-accent/20 rounded-lg flex items-center justify-center">
              <Download className="w-5 h-5 text-sz-accent" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-sz-text">Export Vertical Reels</h2>
              <p className="text-xs text-sz-text-muted">9:16 format for social platforms</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-sz-bg-hover rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-sz-text-muted" />
          </button>
        </div>

        {/* Export Options */}
        <div className="px-5 py-4 bg-sz-bg-secondary border-b border-sz-border space-y-4">
          {/* Platform Selection */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-medium text-sz-text">
              <Smartphone className="w-4 h-4 text-violet-400" />
              Platform
            </label>
            <div className="flex gap-2">
              {PLATFORMS.map(p => (
                <button
                  key={p.id}
                  onClick={() => setPlatform(p.id)}
                  className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg border transition-all ${
                    platform === p.id
                      ? 'bg-sz-accent/15 border-sz-accent text-sz-text'
                      : 'bg-sz-bg border-sz-border text-sz-text-muted hover:bg-sz-bg-hover'
                  }`}
                >
                  <span>{p.icon}</span>
                  <span className="text-sm font-medium">{p.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Caption Options */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm font-medium text-sz-text">
                <MessageSquare className="w-4 h-4 text-emerald-400" />
                Auto Captions
              </label>
              <Toggle 
                checked={captionsEnabled && hasTranscript} 
                onChange={setCaptionsEnabled}
                disabled={!hasTranscript}
              />
            </div>
            
            {!hasTranscript && (
              <p className="text-xs text-yellow-400 bg-yellow-400/10 px-3 py-2 rounded-lg">
                No transcript available. Run detection with OpenAI API key to enable captions.
              </p>
            )}

            {captionsEnabled && hasTranscript && (
              <div className="flex gap-2">
                {CAPTION_STYLES.map(s => (
                  <button
                    key={s.id}
                    onClick={() => setCaptionStyle(s.id)}
                    className={`flex-1 px-3 py-2 rounded-lg border transition-all ${
                      captionStyle === s.id
                        ? 'bg-emerald-500/15 border-emerald-500 text-sz-text'
                        : 'bg-sz-bg border-sz-border text-sz-text-muted hover:bg-sz-bg-hover'
                    }`}
                  >
                    <div className="text-sm font-medium">{s.name}</div>
                    <div className="text-xs opacity-70">{s.preview}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Summary Stats */}
        <div className="px-5 py-3 bg-sz-bg-tertiary border-b border-sz-border">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <Film className="w-4 h-4 text-sz-accent" />
              <span className="text-sm text-sz-text">
                <span className="font-medium">{selectedClips.length}</span>
                <span className="text-sz-text-muted"> / {acceptedClips.length} clips</span>
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-violet-400" />
              <span className="text-sm text-sz-text">
                <span className="font-medium">{formatDuration(totalDuration)}</span>
                <span className="text-sz-text-muted"> total</span>
              </span>
            </div>
            <div className="flex items-center gap-2">
              <FileVideo className="w-4 h-4 text-emerald-400" />
              <span className="text-sm text-sz-text">
                <span className="font-medium">~{estimatedSize.toFixed(0)} MB</span>
                <span className="text-sz-text-muted"> estimated</span>
              </span>
            </div>
          </div>
          {maxDurationWarning && (
            <p className="text-xs text-yellow-400 mt-2">{maxDurationWarning}</p>
          )}
        </div>

        {/* Clip Selection */}
        <div className="flex-1 overflow-hidden flex flex-col min-h-0">
          <div className="px-5 py-2 flex items-center justify-between border-b border-sz-border/50">
            <span className="text-xs font-medium text-sz-text-secondary uppercase tracking-wider">
              Clips to Export
            </span>
            <div className="flex gap-2">
              <button
                onClick={selectAll}
                className="text-xs text-sz-accent hover:text-sz-accent-hover transition-colors"
              >
                Select all
              </button>
              <span className="text-sz-text-muted">|</span>
              <button
                onClick={deselectAll}
                className="text-xs text-sz-text-muted hover:text-sz-text transition-colors"
              >
                Deselect all
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-3">
            <div className="space-y-2">
              {acceptedClips.map((clip, index) => {
                const isSelected = selectedIds.has(clip.id);
                const clipDuration = (clip.endTime + clip.trimEndOffset) - (clip.startTime + clip.trimStartOffset);
                const platformMax = REEL_PLATFORM_PRESETS[platform].maxDuration;
                const exceedsMax = clipDuration > platformMax;
                
                return (
                  <button
                    key={clip.id}
                    onClick={() => toggleClip(clip.id)}
                    className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-all text-left ${
                      isSelected
                        ? exceedsMax 
                          ? 'bg-yellow-500/10 border-yellow-500/30 hover:bg-yellow-500/15'
                          : 'bg-sz-accent/10 border-sz-accent/30 hover:bg-sz-accent/15'
                        : 'bg-sz-bg-tertiary border-sz-border hover:bg-sz-bg-hover opacity-60'
                    }`}
                  >
                    <div className={`w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 transition-colors ${
                      isSelected 
                        ? exceedsMax ? 'bg-yellow-500' : 'bg-sz-accent' 
                        : 'bg-sz-bg border border-sz-border-light'
                    }`}>
                      {isSelected && <Check className="w-3 h-3 text-sz-bg" />}
                    </div>

                    <div className="w-7 h-7 bg-sz-bg rounded-md flex items-center justify-center flex-shrink-0">
                      <span className="text-xs font-bold text-sz-text-secondary">{index + 1}</span>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-sz-text truncate">
                          {clip.title || `Clip ${index + 1}`}
                        </span>
                        {clip.score_breakdown && (
                          <span className="text-[10px] px-1.5 py-0.5 bg-sz-accent/20 rounded text-sz-accent">
                            MVP
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-0.5">
                        <span className="text-xs text-sz-text-muted">
                          {formatDuration(clip.startTime + clip.trimStartOffset)} - {formatDuration(clip.endTime + clip.trimEndOffset)}
                        </span>
                        <span className={`text-xs ${exceedsMax ? 'text-yellow-400' : 'text-sz-text-secondary'}`}>
                          {formatDuration(clipDuration)}
                          {exceedsMax && ` (>${platformMax}s)`}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 flex-shrink-0">
                      <span className={`text-sm font-bold ${
                        clip.finalScore >= 85 ? 'text-emerald-400' :
                        clip.finalScore >= 70 ? 'text-violet-400' :
                        'text-sz-text-secondary'
                      }`}>
                        {clip.finalScore}
                      </span>
                    </div>
                  </button>
                );
              })}

              {acceptedClips.length === 0 && (
                <div className="text-center py-8 text-sz-text-muted">
                  <Sparkles className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>No accepted clips to export</p>
                  <p className="text-xs mt-1">Accept clips from the timeline first</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between px-5 py-4 border-t border-sz-border">
          <div className="text-xs text-sz-text-muted">
            Output: 1080x1920 MP4 {captionsEnabled && hasTranscript ? 'with captions' : ''}
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="secondary"
              size="md"
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="md"
              disabled={selectedClips.length === 0}
              onClick={handleExport}
              leftIcon={<Download className="w-4 h-4" />}
            >
              Export {selectedClips.length} Reel{selectedClips.length !== 1 ? 's' : ''}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default memo(ExportPreviewModal);
