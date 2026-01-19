import { memo, useRef, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Download } from 'lucide-react';
import type { Clip } from '../../types';
import { Button, IconButton } from '../ui';
import ClipThumbnail from './ClipThumbnail';

interface ClipStripProps {
  clips: Clip[];
  selectedClipId: string | null;
  onSelectClip: (clipId: string) => void;
  onExportAll: () => void;
}

function ClipStrip({ clips, selectedClipId, onSelectClip, onExportAll }: ClipStripProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const acceptedCount = clips.filter(c => c.status === 'accepted').length;

  // Scroll controls
  const handleScrollLeft = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: -300, behavior: 'smooth' });
    }
  }, []);

  const handleScrollRight = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: 300, behavior: 'smooth' });
    }
  }, []);

  return (
    <div className="bg-sz-bg-secondary rounded-sz-lg border border-sz-border overflow-hidden h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-sz-border flex-shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-sz-text-secondary uppercase tracking-wider">
            Clips
          </span>
          <span className="text-xs text-sz-text-muted">
            ({clips.length} total)
          </span>
        </div>
        
        <div className="flex items-center gap-2">
          <IconButton
            icon={<ChevronLeft className="w-4 h-4" />}
            variant="ghost"
            size="xs"
            onClick={handleScrollLeft}
          />
          <IconButton
            icon={<ChevronRight className="w-4 h-4" />}
            variant="ghost"
            size="xs"
            onClick={handleScrollRight}
          />
          
          {acceptedCount > 0 && (
            <Button
              variant="primary"
              size="xs"
              leftIcon={<Download className="w-3 h-3" />}
              onClick={onExportAll}
            >
              Export All ({acceptedCount})
            </Button>
          )}
        </div>
      </div>

      {/* Clip cards - horizontal scroll */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-x-auto overflow-y-hidden p-3"
      >
        <div className="flex gap-3 h-full">
          {clips.map((clip) => (
            <ClipThumbnail
              key={clip.id}
              clip={clip}
              isSelected={clip.id === selectedClipId}
              onClick={() => onSelectClip(clip.id)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export default memo(ClipStrip);
