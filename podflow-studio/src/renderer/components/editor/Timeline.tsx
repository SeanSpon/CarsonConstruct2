import { memo, useCallback, useRef, useState, useMemo } from 'react';
import { ZoomIn, ZoomOut, Maximize2, Zap } from 'lucide-react';
import type { Clip } from '../../types';
import { formatDuration } from '../../types';
import { IconButton, Button } from '../ui';
import TimelineSegment from './TimelineSegment';

interface TimelineProps {
  duration: number;
  currentTime: number;
  clips: Clip[];
  selectedClipId: string | null;
  onSeek: (time: number) => void;
  onSelectClip: (clipId: string) => void;
  hasClips: boolean;
  onAnalyze: () => void;
  isDetecting: boolean;
}

function Timeline({
  duration,
  currentTime,
  clips,
  selectedClipId,
  onSeek,
  onSelectClip,
  hasClips,
  onAnalyze,
  isDetecting,
}: TimelineProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);

  // Calculate timeline width based on zoom
  const timelineWidth = useMemo(() => {
    return Math.max(100, 100 * zoom);
  }, [zoom]);

  // Calculate playhead position
  const playheadPosition = useMemo(() => {
    if (duration === 0) return 0;
    return (currentTime / duration) * 100;
  }, [currentTime, duration]);

  // Generate time markers
  const timeMarkers = useMemo(() => {
    const markers: { time: number; label: string }[] = [];
    const interval = duration > 3600 ? 600 : duration > 600 ? 60 : 30; // 10min, 1min, or 30s intervals
    
    for (let t = 0; t <= duration; t += interval) {
      markers.push({
        time: t,
        label: formatDuration(t),
      });
    }
    return markers;
  }, [duration]);

  // Handle click on timeline
  const handleTimelineClick = useCallback((e: React.MouseEvent) => {
    if (!containerRef.current || duration === 0) return;
    
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = x / rect.width;
    const time = percentage * duration;
    
    onSeek(Math.max(0, Math.min(duration, time)));
  }, [duration, onSeek]);

  // Zoom controls
  const handleZoomIn = useCallback(() => {
    setZoom(prev => Math.min(5, prev + 0.5));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoom(prev => Math.max(1, prev - 0.5));
  }, []);

  const handleFit = useCallback(() => {
    setZoom(1);
  }, []);

  return (
    <div className="bg-sz-bg-secondary rounded-sz-lg border border-sz-border overflow-hidden">
      {/* Timeline header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-sz-border">
        <span className="text-xs font-medium text-sz-text-secondary uppercase tracking-wider">
          Timeline
        </span>
        <div className="flex items-center gap-1">
          <IconButton
            icon={<ZoomOut className="w-3.5 h-3.5" />}
            variant="ghost"
            size="xs"
            tooltip="Zoom out"
            onClick={handleZoomOut}
            disabled={zoom <= 1}
          />
          <span className="text-[10px] text-sz-text-muted w-8 text-center">
            {Math.round(zoom * 100)}%
          </span>
          <IconButton
            icon={<ZoomIn className="w-3.5 h-3.5" />}
            variant="ghost"
            size="xs"
            tooltip="Zoom in"
            onClick={handleZoomIn}
            disabled={zoom >= 5}
          />
          <IconButton
            icon={<Maximize2 className="w-3.5 h-3.5" />}
            variant="ghost"
            size="xs"
            tooltip="Fit to window"
            onClick={handleFit}
          />
        </div>
      </div>

      {/* Timeline track */}
      <div className="relative h-20 overflow-x-auto">
        <div
          ref={containerRef}
          className="relative h-full cursor-crosshair"
          style={{ width: `${timelineWidth}%` }}
          onClick={handleTimelineClick}
        >
          {/* Background grid */}
          <div className="absolute inset-0 bg-sz-bg">
            {timeMarkers.map((marker, i) => (
              <div
                key={i}
                className="absolute top-0 bottom-0 border-l border-sz-border/50"
                style={{ left: `${(marker.time / duration) * 100}%` }}
              >
                <span className="absolute top-1 left-1 text-[9px] text-sz-text-muted">
                  {marker.label}
                </span>
              </div>
            ))}
          </div>

          {/* Clip segments */}
          {hasClips && clips.map((clip) => (
            <TimelineSegment
              key={clip.id}
              clip={clip}
              duration={duration}
              isSelected={clip.id === selectedClipId}
              onClick={() => onSelectClip(clip.id)}
            />
          ))}

          {/* Analyze button overlay when no clips */}
          {!hasClips && !isDetecting && (
            <div className="absolute inset-0 flex items-center justify-center bg-sz-bg/80">
              <Button
                variant="primary"
                size="lg"
                leftIcon={<Zap className="w-5 h-5" />}
                onClick={(e) => {
                  e.stopPropagation();
                  onAnalyze();
                }}
                className="animate-pulse"
              >
                Analyze Video
              </Button>
            </div>
          )}

          {/* Playhead */}
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-sz-accent z-20 pointer-events-none"
            style={{ left: `${playheadPosition}%` }}
          >
            {/* Playhead head */}
            <div className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-sz-accent rotate-45 rounded-sm" />
          </div>
        </div>
      </div>

      {/* Time ruler */}
      <div className="h-5 border-t border-sz-border bg-sz-bg-tertiary px-2 flex items-center">
        <span className="text-[10px] font-mono text-sz-text-muted">
          {formatDuration(currentTime)} / {formatDuration(duration)}
        </span>
      </div>
    </div>
  );
}

export default memo(Timeline);
