import { memo, useCallback, useRef, useState } from 'react';
import { Zap } from 'lucide-react';
import type { Clip, DeadSpace } from '../../types';
import { formatDuration } from '../../types';
import { Button } from '../ui';

interface TimelineProps {
  duration: number;
  currentTime: number;
  clips: Clip[];
  deadSpaces?: DeadSpace[];
  selectedClipId: string | null;
  onSeek: (time: number) => void;
  onSelectClip: (clipId: string) => void;
  hasClips: boolean;
  isDetecting?: boolean;
  onAnalyze?: () => void;
}

const patternColors: Record<string, string> = {
  payoff: '#00D9FF',
  monologue: '#A855F7',
  laughter: '#FACC15',
  debate: '#F97316',
};

function Timeline({
  duration,
  currentTime,
  clips,
  deadSpaces = [],
  selectedClipId,
  onSeek,
  onSelectClip,
  hasClips,
  isDetecting = false,
  onAnalyze,
}: TimelineProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Calculate playhead position
  const playheadPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  // Handle click on timeline to seek
  const handleTimelineClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percent = Math.max(0, Math.min(1, x / rect.width));
    const time = percent * duration;
    onSeek(time);
  }, [duration, onSeek]);

  // Handle drag on timeline
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    setIsDragging(true);
    handleTimelineClick(e);
  }, [handleTimelineClick]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging) return;
    handleTimelineClick(e);
  }, [isDragging, handleTimelineClick]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Generate time markers
  const generateTimeMarkers = () => {
    const markers: number[] = [];
    const interval = duration > 3600 ? 600 : duration > 600 ? 60 : 30;
    for (let t = 0; t <= duration; t += interval) {
      markers.push(t);
    }
    return markers;
  };

  const timeMarkers = generateTimeMarkers();

  return (
    <div className="bg-sz-bg-secondary rounded-sz-lg border border-sz-border overflow-hidden">
      {/* Header with analyze button */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-sz-border">
        <div className="flex items-center gap-3">
          <span className="text-xs text-sz-text-muted">Timeline</span>
          <span className="text-xs text-sz-text-secondary">
            {formatDuration(currentTime)} / {formatDuration(duration)}
          </span>
        </div>
        
        {!hasClips && onAnalyze && (
          <Button
            variant="primary"
            size="sm"
            leftIcon={<Zap className="w-4 h-4" />}
            onClick={onAnalyze}
            loading={isDetecting}
          >
            {isDetecting ? 'Analyzing...' : 'Find Clips'}
          </Button>
        )}
      </div>

      {/* Timeline track */}
      <div 
        ref={containerRef}
        className="relative h-24 bg-sz-bg cursor-crosshair select-none"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {/* Time markers */}
        <div className="absolute inset-x-0 top-0 h-5 bg-sz-bg-secondary/50 border-b border-sz-border/50 flex items-end">
          {timeMarkers.map((time) => (
            <div
              key={time}
              className="absolute flex flex-col items-center"
              style={{ left: `${(time / duration) * 100}%` }}
            >
              <span className="text-[9px] text-sz-text-muted mb-0.5">
                {formatDuration(time)}
              </span>
              <div className="w-px h-1.5 bg-sz-border" />
            </div>
          ))}
        </div>

        {/* Dead spaces (gray regions) */}
        {deadSpaces.map((ds) => (
          <div
            key={ds.id}
            className="absolute top-5 bottom-0 bg-sz-bg-tertiary/30"
            style={{
              left: `${(ds.startTime / duration) * 100}%`,
              width: `${((ds.endTime - ds.startTime) / duration) * 100}%`,
            }}
          />
        ))}

        {/* Clips */}
        {clips.map((clip) => {
          const left = (clip.startTime / duration) * 100;
          const width = ((clip.endTime - clip.startTime) / duration) * 100;
          const isSelected = clip.id === selectedClipId;
          const color = patternColors[clip.pattern] || patternColors.payoff;
          
          return (
            <div
              key={clip.id}
              className={`absolute top-6 bottom-1 rounded cursor-pointer transition-all ${
                isSelected ? 'ring-2 ring-white ring-offset-1 ring-offset-sz-bg z-10' : 'hover:brightness-110'
              } ${clip.status === 'accepted' ? 'opacity-100' : clip.status === 'rejected' ? 'opacity-30' : 'opacity-70'}`}
              style={{
                left: `${left}%`,
                width: `${Math.max(width, 0.5)}%`,
                backgroundColor: color,
              }}
              onClick={(e) => {
                e.stopPropagation();
                onSelectClip(clip.id);
              }}
            >
              {/* Clip label */}
              {width > 3 && (
                <div className="absolute inset-x-1 top-1 overflow-hidden">
                  <span className="text-[10px] font-medium text-white/90 truncate block">
                    {clip.title || clip.patternLabel || clip.pattern}
                  </span>
                </div>
              )}
            </div>
          );
        })}

        {/* Playhead */}
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-white z-20 pointer-events-none"
          style={{ left: `${playheadPercent}%` }}
        >
          {/* Playhead top marker */}
          <div className="absolute -top-0 left-1/2 -translate-x-1/2 w-2.5 h-2.5 bg-white rounded-full" />
        </div>
      </div>
    </div>
  );
}

export default memo(Timeline);
