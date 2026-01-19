import { memo, useCallback, useRef, useState, useMemo, useEffect } from 'react';
import { 
  ZoomIn, 
  ZoomOut, 
  Maximize2, 
  Zap, 
  Scissors, 
  Volume2,
  VolumeX,
  Video,
  Music,
  Image,
  Lock,
  Unlock,
  Eye,
  EyeOff,
  GripVertical,
} from 'lucide-react';
import type { Clip, CameraCut, AudioTrack } from '../../types';
import { formatDuration } from '../../types';
import { IconButton, Button } from '../ui';
import TimelineSegment from './TimelineSegment';

interface Track {
  id: string;
  name: string;
  type: 'video' | 'audio' | 'broll' | 'music';
  icon: React.ReactNode;
  visible: boolean;
  locked: boolean;
  height: number; // Track height in pixels
}

interface TimelineProps {
  duration: number;
  currentTime: number;
  clips: Clip[];
  cameraCuts?: CameraCut[];
  audioTracks?: AudioTrack[];
  selectedClipId: string | null;
  waveformData?: number[];
  onSeek: (time: number) => void;
  onSelectClip: (clipId: string) => void;
  onMoveClip?: (clipId: string, newStartTime: number) => void;
  onSplitAtPlayhead?: () => void;
  hasClips: boolean;
  onAnalyze: () => void;
  isDetecting: boolean;
}

const defaultTracks: Track[] = [
  { id: 'video', name: 'Video', type: 'video', icon: <Video className="w-3.5 h-3.5" />, visible: true, locked: false, height: 48 },
  { id: 'audio', name: 'Audio', type: 'audio', icon: <Volume2 className="w-3.5 h-3.5" />, visible: true, locked: false, height: 36 },
  { id: 'broll', name: 'B-Roll', type: 'broll', icon: <Image className="w-3.5 h-3.5" />, visible: true, locked: false, height: 36 },
  { id: 'music', name: 'Music', type: 'music', icon: <Music className="w-3.5 h-3.5" />, visible: true, locked: false, height: 28 },
];

function Timeline({
  duration,
  currentTime,
  clips,
  cameraCuts,
  audioTracks,
  selectedClipId,
  waveformData,
  onSeek,
  onSelectClip,
  onMoveClip,
  onSplitAtPlayhead,
  hasClips,
  onAnalyze,
  isDetecting,
}: TimelineProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const trackContainerRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [tracks, setTracks] = useState<Track[]>(defaultTracks);
  const [draggedClip, setDraggedClip] = useState<string | null>(null);
  const [dragStartX, setDragStartX] = useState(0);
  const [dragStartTime, setDragStartTime] = useState(0);
  const [isRazorMode, setIsRazorMode] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Skip if in input field
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      
      switch (e.key.toLowerCase()) {
        case 'j': // Rewind / slow down
          e.preventDefault();
          setPlaybackRate(prev => Math.max(-2, prev - 0.5));
          break;
        case 'k': // Pause
          e.preventDefault();
          setPlaybackRate(0);
          break;
        case 'l': // Fast forward / speed up
          e.preventDefault();
          setPlaybackRate(prev => Math.min(2, prev + 0.5));
          break;
        case ' ': // Space - toggle play/pause
          e.preventDefault();
          setPlaybackRate(prev => prev === 0 ? 1 : 0);
          break;
        case 'c': // Razor tool
          if (e.ctrlKey || e.metaKey) {
            // Cmd/Ctrl+C is copy, don't interfere
          } else {
            e.preventDefault();
            setIsRazorMode(prev => !prev);
          }
          break;
        case 'arrowleft':
          e.preventDefault();
          onSeek(Math.max(0, currentTime - (e.shiftKey ? 10 : 1)));
          break;
        case 'arrowright':
          e.preventDefault();
          onSeek(Math.min(duration, currentTime + (e.shiftKey ? 10 : 1)));
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentTime, duration, onSeek]);

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
    const markers: { time: number; label: string; major: boolean }[] = [];
    const majorInterval = duration > 3600 ? 600 : duration > 600 ? 60 : 30;
    const minorInterval = majorInterval / 4;
    
    for (let t = 0; t <= duration; t += minorInterval) {
      markers.push({
        time: t,
        label: formatDuration(t),
        major: t % majorInterval === 0,
      });
    }
    return markers;
  }, [duration]);

  // Calculate total track height
  const totalTrackHeight = useMemo(() => {
    return tracks.filter(t => t.visible).reduce((acc, t) => acc + t.height, 0);
  }, [tracks]);

  // Handle click on timeline
  const handleTimelineClick = useCallback((e: React.MouseEvent) => {
    if (!containerRef.current || duration === 0) return;
    
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const scrollLeft = trackContainerRef.current?.scrollLeft || 0;
    const totalX = x + scrollLeft;
    const percentage = totalX / (rect.width * zoom);
    const time = percentage * duration;
    
    if (isRazorMode && onSplitAtPlayhead) {
      onSeek(Math.max(0, Math.min(duration, time)));
      onSplitAtPlayhead();
    } else {
      onSeek(Math.max(0, Math.min(duration, time)));
    }
  }, [duration, zoom, onSeek, isRazorMode, onSplitAtPlayhead]);

  // Drag handlers for clips
  const handleDragStart = useCallback((clipId: string, e: React.MouseEvent) => {
    const track = tracks.find(t => t.type === 'video');
    if (track?.locked) return;
    
    setDraggedClip(clipId);
    setDragStartX(e.clientX);
    const clip = clips.find(c => c.id === clipId);
    if (clip) setDragStartTime(clip.startTime);
  }, [tracks, clips]);

  const handleDragMove = useCallback((e: React.MouseEvent) => {
    if (!draggedClip || !containerRef.current || !onMoveClip) return;
    
    const deltaX = e.clientX - dragStartX;
    const containerWidth = containerRef.current.offsetWidth;
    const deltaTime = (deltaX / containerWidth) * duration / zoom;
    const newTime = Math.max(0, Math.min(duration, dragStartTime + deltaTime));
    
    onMoveClip(draggedClip, newTime);
  }, [draggedClip, dragStartX, dragStartTime, duration, zoom, onMoveClip]);

  const handleDragEnd = useCallback(() => {
    setDraggedClip(null);
  }, []);

  // Track controls
  const toggleTrackVisibility = useCallback((trackId: string) => {
    setTracks(prev => prev.map(t => 
      t.id === trackId ? { ...t, visible: !t.visible } : t
    ));
  }, []);

  const toggleTrackLock = useCallback((trackId: string) => {
    setTracks(prev => prev.map(t => 
      t.id === trackId ? { ...t, locked: !t.locked } : t
    ));
  }, []);

  // Zoom controls
  const handleZoomIn = useCallback(() => {
    setZoom(prev => Math.min(10, prev + 0.5));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoom(prev => Math.max(0.5, prev - 0.5));
  }, []);

  const handleFit = useCallback(() => {
    setZoom(1);
  }, []);

  // Render waveform
  const renderWaveform = useCallback((data: number[], trackHeight: number) => {
    if (!data || data.length === 0) return null;
    
    const points: string[] = [];
    const width = 100;
    const stepWidth = width / data.length;
    
    data.forEach((value, i) => {
      const x = i * stepWidth;
      const y = trackHeight / 2 - (value * trackHeight / 2);
      points.push(`${x},${y}`);
    });
    
    // Mirror for full waveform
    const mirroredPoints = [...data].reverse().map((value, i) => {
      const x = (data.length - 1 - i) * stepWidth;
      const y = trackHeight / 2 + (value * trackHeight / 2);
      return `${x},${y}`;
    });
    
    return (
      <svg 
        className="absolute inset-0 w-full h-full opacity-50"
        preserveAspectRatio="none"
        viewBox={`0 0 ${width} ${trackHeight}`}
      >
        <polygon
          points={[...points, ...mirroredPoints].join(' ')}
          fill="currentColor"
          className="text-emerald-500"
        />
      </svg>
    );
  }, []);

  return (
    <div className="bg-sz-bg-secondary rounded-sz-lg border border-sz-border overflow-hidden flex flex-col">
      {/* Timeline header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-sz-border">
        <div className="flex items-center gap-4">
          <span className="text-xs font-medium text-sz-text-secondary uppercase tracking-wider">
            Timeline
          </span>
          
          {/* Razor tool toggle */}
          <button
            onClick={() => setIsRazorMode(!isRazorMode)}
            className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors ${
              isRazorMode 
                ? 'bg-sz-accent text-white' 
                : 'bg-sz-bg-tertiary text-sz-text-secondary hover:text-sz-text'
            }`}
            title="Razor tool (C)"
          >
            <Scissors className="w-3.5 h-3.5" />
            Razor
          </button>
          
          {/* Playback rate indicator */}
          {playbackRate !== 1 && (
            <span className={`text-xs px-2 py-0.5 rounded ${
              playbackRate === 0 ? 'bg-amber-500/20 text-amber-400' : 'bg-blue-500/20 text-blue-400'
            }`}>
              {playbackRate === 0 ? 'Paused' : `${playbackRate > 0 ? '+' : ''}${playbackRate}x`}
            </span>
          )}
        </div>
        
        <div className="flex items-center gap-1">
          <IconButton
            icon={<ZoomOut className="w-3.5 h-3.5" />}
            variant="ghost"
            size="xs"
            tooltip="Zoom out"
            onClick={handleZoomOut}
            disabled={zoom <= 0.5}
          />
          <span className="text-[10px] text-sz-text-muted w-10 text-center">
            {Math.round(zoom * 100)}%
          </span>
          <IconButton
            icon={<ZoomIn className="w-3.5 h-3.5" />}
            variant="ghost"
            size="xs"
            tooltip="Zoom in"
            onClick={handleZoomIn}
            disabled={zoom >= 10}
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

      {/* Timeline body */}
      <div className="flex flex-1 min-h-0">
        {/* Track labels */}
        <div className="w-28 flex-shrink-0 border-r border-sz-border bg-sz-bg">
          {/* Time ruler header */}
          <div className="h-6 border-b border-sz-border" />
          
          {/* Track labels */}
          {tracks.filter(t => t.visible).map((track) => (
            <div
              key={track.id}
              className="flex items-center justify-between px-2 border-b border-sz-border/50"
              style={{ height: track.height }}
            >
              <div className="flex items-center gap-1.5">
                <GripVertical className="w-3 h-3 text-sz-text-muted cursor-grab" />
                <span className="text-sz-text-secondary">{track.icon}</span>
                <span className="text-xs text-sz-text truncate">{track.name}</span>
              </div>
              <div className="flex items-center gap-0.5">
                <button
                  onClick={() => toggleTrackVisibility(track.id)}
                  className="p-0.5 rounded hover:bg-sz-bg-tertiary"
                  title={track.visible ? 'Hide' : 'Show'}
                >
                  {track.visible ? (
                    <Eye className="w-3 h-3 text-sz-text-muted" />
                  ) : (
                    <EyeOff className="w-3 h-3 text-sz-text-muted" />
                  )}
                </button>
                <button
                  onClick={() => toggleTrackLock(track.id)}
                  className="p-0.5 rounded hover:bg-sz-bg-tertiary"
                  title={track.locked ? 'Unlock' : 'Lock'}
                >
                  {track.locked ? (
                    <Lock className="w-3 h-3 text-amber-400" />
                  ) : (
                    <Unlock className="w-3 h-3 text-sz-text-muted" />
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Tracks area */}
        <div 
          ref={trackContainerRef}
          className="flex-1 overflow-x-auto overflow-y-hidden"
          onMouseMove={draggedClip ? handleDragMove : undefined}
          onMouseUp={handleDragEnd}
          onMouseLeave={handleDragEnd}
        >
          <div
            ref={containerRef}
            className={`relative ${isRazorMode ? 'cursor-crosshair' : 'cursor-pointer'}`}
            style={{ 
              width: `${timelineWidth}%`,
              minWidth: '100%',
            }}
            onClick={handleTimelineClick}
          >
            {/* Time ruler */}
            <div className="h-6 border-b border-sz-border bg-sz-bg-tertiary relative">
              {timeMarkers.map((marker, i) => (
                <div
                  key={i}
                  className="absolute top-0 bottom-0"
                  style={{ left: `${(marker.time / duration) * 100}%` }}
                >
                  <div className={`h-full ${marker.major ? 'border-l border-sz-border' : 'border-l border-sz-border/30'}`} />
                  {marker.major && (
                    <span className="absolute -top-0.5 left-1 text-[9px] text-sz-text-muted whitespace-nowrap">
                      {marker.label}
                    </span>
                  )}
                </div>
              ))}
            </div>

            {/* Tracks */}
            {tracks.filter(t => t.visible).map((track) => (
              <div
                key={track.id}
                className="relative border-b border-sz-border/50 bg-sz-bg"
                style={{ height: track.height }}
              >
                {/* Video track - show clips */}
                {track.type === 'video' && hasClips && clips.map((clip) => (
                  <div
                    key={clip.id}
                    className={`absolute top-1 bottom-1 rounded cursor-pointer transition-all ${
                      clip.id === selectedClipId 
                        ? 'ring-2 ring-sz-accent z-10' 
                        : ''
                    } ${draggedClip === clip.id ? 'opacity-70' : ''}`}
                    style={{
                      left: `${(clip.startTime / duration) * 100}%`,
                      width: `${((clip.endTime - clip.startTime) / duration) * 100}%`,
                    }}
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      handleDragStart(clip.id, e);
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!isRazorMode) onSelectClip(clip.id);
                    }}
                  >
                    <TimelineSegment
                      clip={clip}
                      duration={duration}
                      isSelected={clip.id === selectedClipId}
                      onClick={() => {}}
                      compact
                    />
                  </div>
                ))}

                {/* Camera cuts track */}
                {track.type === 'video' && cameraCuts?.map((cut, i) => (
                  <div
                    key={cut.id}
                    className="absolute top-0 h-1 bg-violet-500"
                    style={{
                      left: `${(cut.startTime / duration) * 100}%`,
                      width: `${((cut.endTime - cut.startTime) / duration) * 100}%`,
                    }}
                    title={`Camera: ${cut.cameraId}`}
                  />
                ))}

                {/* Audio track - show waveform */}
                {track.type === 'audio' && waveformData && (
                  <div className="absolute inset-0">
                    {renderWaveform(waveformData, track.height)}
                  </div>
                )}

                {/* Music/B-Roll tracks - show audio tracks */}
                {(track.type === 'music' || track.type === 'broll') && audioTracks?.filter(at => 
                  (track.type === 'music' && at.type === 'music') ||
                  (track.type === 'broll' && at.type === 'broll')
                ).map((audioTrack) => (
                  <div
                    key={audioTrack.id}
                    className={`absolute top-1 bottom-1 rounded ${
                      track.type === 'music' ? 'bg-violet-500/30 border border-violet-500/50' : 'bg-emerald-500/30 border border-emerald-500/50'
                    }`}
                    style={{
                      left: `${(audioTrack.startTime / duration) * 100}%`,
                      width: `${((audioTrack.endTime - audioTrack.startTime) / duration) * 100}%`,
                    }}
                  >
                    <span className="text-[9px] px-1 truncate text-white/70">
                      {audioTrack.filePath?.split(/[\\/]/).pop() || 'Audio'}
                    </span>
                  </div>
                ))}

                {/* Analyze overlay for video track */}
                {track.type === 'video' && !hasClips && !isDetecting && (
                  <div className="absolute inset-0 flex items-center justify-center bg-sz-bg/80">
                    <Button
                      variant="primary"
                      size="sm"
                      leftIcon={<Zap className="w-4 h-4" />}
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
              </div>
            ))}

            {/* Playhead */}
            <div
              className="absolute top-0 w-0.5 bg-sz-accent z-30 pointer-events-none"
              style={{ 
                left: `${playheadPosition}%`,
                height: `calc(100%)`,
              }}
            >
              {/* Playhead head */}
              <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-3 h-3 bg-sz-accent rotate-45 rounded-sm" />
            </div>
          </div>
        </div>
      </div>

      {/* Time ruler footer */}
      <div className="h-6 border-t border-sz-border bg-sz-bg-tertiary px-3 flex items-center justify-between">
        <span className="text-[10px] font-mono text-sz-text-muted">
          {formatDuration(currentTime)} / {formatDuration(duration)}
        </span>
        <div className="flex items-center gap-2 text-[10px] text-sz-text-muted">
          <span>J/K/L: Playback</span>
          <span>•</span>
          <span>C: Razor</span>
          <span>•</span>
          <span>←/→: Seek</span>
        </div>
      </div>
    </div>
  );
}

export default memo(Timeline);
