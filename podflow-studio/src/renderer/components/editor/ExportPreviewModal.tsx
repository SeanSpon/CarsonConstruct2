import { memo, useMemo, useState, useEffect, useCallback } from 'react';
import { X, Download, Clock, Film, Check, FileVideo, Zap, CheckCircle2, Cloud, Loader2 } from 'lucide-react';
import type { Clip, ExportSettings } from '../../types';
import { formatDuration } from '../../types';
import { Button } from '../ui';
import CloudExport from './CloudExport';

interface ExportPreviewModalProps {
  clips: Clip[];
  exportSettings: ExportSettings;
  onExport: (selectedClipIds: string[]) => void;
  onClose: () => void;
}

function ExportPreviewModal({ clips, exportSettings, onExport, onClose }: ExportPreviewModalProps) {
  // Track which clips are selected for export (default: all accepted)
  const acceptedClips = useMemo(() => clips.filter(c => c.status === 'accepted'), [clips]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(acceptedClips.map(c => c.id))
  );
  
  // Cloud export state
  const [isCloudAuthenticated, setIsCloudAuthenticated] = useState(false);
  const [showCloudExport, setShowCloudExport] = useState(false);
  const [exportedFiles, setExportedFiles] = useState<Array<{ path: string; name: string }>>([]);
  
  // Check cloud auth on mount
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const result = await window.api.checkCloudAuth();
        setIsCloudAuthenticated(result.isAuthenticated);
      } catch (err) {
        console.error('Failed to check cloud auth:', err);
      }
    };
    checkAuth();
  }, []);

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

  // Calculate totals for selected clips
  const { selectedClips, totalDuration, estimatedSize } = useMemo(() => {
    const selected = acceptedClips.filter(c => selectedIds.has(c.id));
    const duration = selected.reduce((sum, c) => {
      const actualDuration = (c.endTime + c.trimEndOffset) - (c.startTime + c.trimStartOffset);
      return sum + actualDuration;
    }, 0);
    // Rough estimate: ~10MB per minute for 1080p
    const size = (duration / 60) * 10;
    return {
      selectedClips: selected,
      totalDuration: duration,
      estimatedSize: size,
    };
  }, [acceptedClips, selectedIds]);

  const handleExport = () => {
    if (selectedClips.length > 0) {
      onExport(Array.from(selectedIds));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="relative w-full max-w-2xl mx-4 max-h-[85vh] flex flex-col bg-sz-bg rounded-lg overflow-hidden shadow-2xl border border-sz-border">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-sz-border">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-sz-accent/20 rounded-lg flex items-center justify-center">
              <Download className="w-5 h-5 text-sz-accent" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-sz-text">Export Preview</h2>
              <p className="text-xs text-sz-text-muted">Review clips before exporting</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-sz-bg-hover rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-sz-text-muted" />
          </button>
        </div>

        {/* Summary Stats */}
        <div className="px-5 py-3 bg-sz-bg-secondary border-b border-sz-border">
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
        </div>

        {/* Clip Selection */}
        <div className="flex-1 overflow-hidden flex flex-col min-h-0">
          {/* Select All/None */}
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

          {/* Clip List */}
          <div className="flex-1 overflow-y-auto px-5 py-3">
            <div className="space-y-2">
              {acceptedClips.map((clip, index) => {
                const isSelected = selectedIds.has(clip.id);
                const clipDuration = (clip.endTime + clip.trimEndOffset) - (clip.startTime + clip.trimStartOffset);
                
                return (
                  <button
                    key={clip.id}
                    onClick={() => toggleClip(clip.id)}
                    className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-all text-left ${
                      isSelected
                        ? 'bg-sz-accent/10 border-sz-accent/30 hover:bg-sz-accent/15'
                        : 'bg-sz-bg-tertiary border-sz-border hover:bg-sz-bg-hover opacity-60'
                    }`}
                  >
                    {/* Selection Checkbox */}
                    <div className={`w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 transition-colors ${
                      isSelected ? 'bg-sz-accent' : 'bg-sz-bg border border-sz-border-light'
                    }`}>
                      {isSelected && <Check className="w-3 h-3 text-sz-bg" />}
                    </div>

                    {/* Clip Number */}
                    <div className="w-7 h-7 bg-sz-bg rounded-md flex items-center justify-center flex-shrink-0">
                      <span className="text-xs font-bold text-sz-text-secondary">{index + 1}</span>
                    </div>

                    {/* Clip Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-sz-text truncate">
                          {clip.title || `Clip ${index + 1}`}
                        </span>
                        {clip.category && (
                          <span className="text-[10px] px-1.5 py-0.5 bg-sz-bg rounded text-sz-text-muted">
                            {clip.category}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-0.5">
                        <span className="text-xs text-sz-text-muted">
                          {formatDuration(clip.startTime + clip.trimStartOffset)} - {formatDuration(clip.endTime + clip.trimEndOffset)}
                        </span>
                        <span className="text-xs text-sz-text-secondary">
                          {formatDuration(clipDuration)}
                        </span>
                      </div>
                    </div>

                    {/* Score */}
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
            </div>
          </div>
        </div>

        {/* Export Settings Summary */}
        <div className="px-5 py-3 bg-sz-bg-secondary border-t border-sz-border">
          <div className="flex items-center gap-4 text-xs text-sz-text-muted">
            <div className="flex items-center gap-1.5">
              <FileVideo className="w-3.5 h-3.5" />
              <span className="uppercase font-medium">{exportSettings.format}</span>
            </div>
            <div className="flex items-center gap-1.5">
              {exportSettings.mode === 'fast' ? (
                <Zap className="w-3.5 h-3.5 text-yellow-400" />
              ) : (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              )}
              <span className="capitalize">{exportSettings.mode} mode</span>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between px-5 py-4 border-t border-sz-border">
          <div className="flex items-center gap-2">
            {isCloudAuthenticated && (
              <button
                onClick={() => setShowCloudExport(true)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-sz-text-secondary hover:text-sz-text hover:bg-sz-bg-tertiary transition-colors"
                title="Upload to Google Drive after export"
              >
                <Cloud className="w-4 h-4" />
                <span>Cloud Export</span>
              </button>
            )}
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
              Export {selectedClips.length} Clip{selectedClips.length !== 1 ? 's' : ''}
            </Button>
          </div>
        </div>
        
        {/* Cloud Export Panel */}
        {showCloudExport && exportedFiles.length > 0 && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <CloudExport
              files={exportedFiles}
              onClose={() => {
                setShowCloudExport(false);
                setExportedFiles([]);
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}

export default memo(ExportPreviewModal);
