import { memo, useMemo, useState } from 'react';
import { X, Download, Check, Play } from 'lucide-react';
import type { Clip } from '../../types';
import { Button } from '../ui';

interface ExportPreviewModalProps {
  clips: Clip[];
  onExport: (selectedClipIds: string[], options: any) => void;
  onClose: () => void;
  hasTranscript: boolean;
  videoPath?: string;
}

function ExportPreviewModal({ clips, onExport, onClose, videoPath }: ExportPreviewModalProps) {
  const acceptedClips = useMemo(() => clips.filter(c => c.status === 'accepted'), [clips]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(acceptedClips.map(c => c.id))
  );

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

  const selectedClips = acceptedClips.filter(c => selectedIds.has(c.id));

  const handleExport = () => {
    if (selectedClips.length > 0) {
      // Vertical reel export with clean minimal captions
      onExport(Array.from(selectedIds), { vertical: true, platform: 'tiktok', captionsEnabled: true, captionStyle: 'minimal' });
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="relative w-full max-w-2xl mx-4 max-h-[90vh] flex flex-col bg-sz-bg rounded-lg overflow-hidden shadow-2xl border border-sz-border">
        <div className="flex items-center justify-between px-5 py-4 border-b border-sz-border">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-sz-accent/20 rounded-lg flex items-center justify-center">
              <Download className="w-5 h-5 text-sz-accent" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-sz-text">Export Clips</h2>
              <p className="text-xs text-sz-text-muted">Select clips to export</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-sz-bg-hover rounded-lg transition-colors">
            <X className="w-5 h-5 text-sz-text-muted" />
          </button>
        </div>

        <div className="px-5 py-3 bg-sz-bg-secondary border-b border-sz-border">
          <div className="flex items-center justify-between">
            <span className="text-sm text-sz-text">
              <span className="font-medium">{selectedClips.length}</span> of {acceptedClips.length} selected
            </span>
            <div className="flex gap-2">
              <button onClick={selectAll} className="text-xs text-sz-accent hover:underline">Select All</button>
              <span className="text-xs text-sz-text-muted">|</span>
              <button onClick={deselectAll} className="text-xs text-sz-text-muted hover:text-sz-text hover:underline">Deselect All</button>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-3 min-h-0">
          {acceptedClips.map((clip) => {
            const isSelected = selectedIds.has(clip.id);
            const duration = ((clip.endTime + clip.trimEndOffset) - (clip.startTime + clip.trimStartOffset)).toFixed(1);
            const startTime = (clip.startTime + clip.trimStartOffset).toFixed(1);
            
            return (
              <div key={clip.id} onClick={() => toggleClip(clip.id)} className={`p-4 rounded-lg border cursor-pointer transition-all ${isSelected ? 'bg-sz-accent/10 border-sz-accent' : 'bg-sz-bg-secondary border-sz-border hover:bg-sz-bg-hover'}`}>
                <div className="flex items-center gap-3">
                  <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${isSelected ? 'bg-sz-accent border-sz-accent' : 'border-sz-border'}`}>
                    {isSelected && <Check className="w-3 h-3 text-white" />}
                  </div>
                  
                  {/* Video preview thumbnail */}
                  {videoPath && (
                    <div className="relative w-24 h-16 bg-black rounded overflow-hidden flex-shrink-0 group">
                      <video 
                        src={`file://${videoPath}#t=${startTime}`}
                        className="w-full h-full object-cover"
                        preload="metadata"
                        muted
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <Play className="w-6 h-6 text-white" />
                      </div>
                    </div>
                  )}
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium text-sz-text">{clip.id}</span>
                      <span className="text-xs text-sz-text-muted">{duration}s</span>
                      <span className={`text-xs px-2 py-0.5 rounded ${clip.finalScore > 0 ? 'bg-sz-accent/20 text-sz-accent' : 'bg-red-500/20 text-red-400'}`}>Score: {Math.round(clip.finalScore)}</span>
                    </div>
                    {clip.title && <p className="text-xs text-sz-text-muted truncate">{clip.title}</p>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-between px-5 py-4 border-t border-sz-border bg-sz-bg-secondary">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="success" size="lg" leftIcon={<Download className="w-4 h-4" />} onClick={handleExport} disabled={selectedClips.length === 0}>
            Export {selectedClips.length} Clip{selectedClips.length !== 1 ? 's' : ''}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default memo(ExportPreviewModal);
