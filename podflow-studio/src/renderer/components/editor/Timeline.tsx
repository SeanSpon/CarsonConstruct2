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
  Copy,
  Trash2,
  Group,
  Ungroup,
  Plus,
  FileAudio,
  MoreVertical,
} from 'lucide-react';
import type { Clip, CameraCut, AudioTrack, DeadSpace, SpeakerSegment, TimelineGroup } from '../../types';
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
  deadSpaces?: DeadSpace[];
  speakerSegments?: SpeakerSegment[];
  cameraCuts?: CameraCut[];
  audioTracks?: AudioTrack[];
  timelineGroups?: TimelineGroup[];
  selectedClipId: string | null;
  selectedClipIds?: string[]; // Support multi-select
  waveformData?: number[];
  onSeek: (time: number) => void;
  onSelectClip: (clipId: string) => void;
  onMultiSelectClip?: (clipId: string, addToSelection: boolean) => void;
  onMoveClip?: (clipId: string, newStartTime: number) => void;
  onSplitClip?: (clipId: string, splitTime: number) => void;
  onDuplicateClip?: (clipId: string) => void;
  onDeleteClip?: (clipId: string) => void;
  onGroupClips?: (clipIds: string[], groupName?: string) => void;
  onUngroupClips?: (groupId: string) => void;
  onAddAudioTrack?: () => void;
  onRemoveAudioTrack?: (trackId: string) => void;
  onUpdateAudioTrack?: (trackId: string, updates: Partial<AudioTrack>) => void;
  hasClips: boolean;
  isDetecting?: boolean;
  onAnalyze?: () => void;
  // Source video info for displaying on timeline
  sourceVideoName?: string;
  thumbnailPath?: string;
}

const defaultTracks: Track[] = [
  { id: 'video', name: 'Video', type: 'video', icon: <Video className="w-3.5 h-3.5" />, visible: true, locked: false, height: 64 },
  { id: 'audio', name: 'Audio', type: 'audio', icon: <Volume2 className="w-3.5 h-3.5" />, visible: true, locked: false, height: 36 },
  { id: 'broll', name: 'B-Roll', type: 'broll', icon: <Image className="w-3.5 h-3.5" />, visible: true, locked: false, height: 36 },
  { id: 'music', name: 'Music', type: 'music', icon: <Music className="w-3.5 h-3.5" />, visible: true, locked: false, height: 28 },
];

function Timeline({
  duration,
  currentTime,
  clips,
  deadSpaces = [],
  speakerSegments = [],
  cameraCuts,
  audioTracks = [],
  timelineGroups = [],
  selectedClipId,
  selectedClipIds = [],
  waveformData,
  onSeek,
  onSelectClip,
  onMultiSelectClip,
  onMoveClip,
  onSplitClip,
  onDuplicateClip,
  onDeleteClip,
  onGroupClips,
  onUngroupClips,
  onAddAudioTrack,
  onRemoveAudioTrack,
  onUpdateAudioTrack,
  hasClips,
  isDetecting = false,
  onAnalyze,
  sourceVideoName,
  thumbnailPath,
}: TimelineProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const trackContainerRef = useRef<HTMLDivElement>(null);
  const isWheelZoomingRef = useRef(false);
  const [zoom, setZoom] = useState(1);
  const [tracks, setTracks] = useState<Track[]>(defaultTracks);
  const [draggedClip, setDraggedClip] = useState<string | null>(null);
  const [dragStartX, setDragStartX] = useState(0);
  const [dragStartTime, setDragStartTime] = useState(0);
  const [hasDragged, setHasDragged] = useState(false); // Track if actual drag occurred
  const justFinishedDragRef = useRef(false); // Prevent click after drag
  const [isRazorMode, setIsRazorMode] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; clipId?: string; trackId?: string } | null>(null);
  const [selectedAudioTrackId, setSelectedAudioTrackId] = useState<string | null>(null);
  
  // Calculate base timeline width based on duration
  // Minimum 100% width of container, scales up for longer videos
  // At zoom=1: short videos (<10min) fill container, longer videos get more width
  const BASE_TIMELINE_WIDTH = useMemo(() => {
    // At minimum, timeline should be 800px
    // For videos longer than 10 minutes, add more width
    const minWidth = 800;
    const pixelsPerMinute = 50; // 50px per minute of content
    const durationMinutes = duration / 60;
    const calculatedWidth = Math.max(minWidth, durationMinutes * pixelsPerMinute);
    return calculatedWidth;
  }, [duration]);

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
        case 's': // Split at playhead
          if (!e.ctrlKey && !e.metaKey) {
            e.preventDefault();
            // Find clip at current time and split it
            const clipAtPlayhead = clips.find(c => 
              currentTime >= c.startTime + c.trimStartOffset && 
              currentTime <= c.endTime + c.trimEndOffset
            );
            if (clipAtPlayhead && onSplitClip) {
              onSplitClip(clipAtPlayhead.id, currentTime);
            }
          }
          break;
        case 'd': // Duplicate
          if (!e.ctrlKey && !e.metaKey && selectedClipId && onDuplicateClip) {
            e.preventDefault();
            onDuplicateClip(selectedClipId);
          }
          break;
        case 'delete':
        case 'backspace':
          if (selectedClipId && onDeleteClip) {
            e.preventDefault();
            onDeleteClip(selectedClipId);
          }
          break;
        case 'g': // Group selected
          if ((e.ctrlKey || e.metaKey) && selectedClipIds.length > 1 && onGroupClips) {
            e.preventDefault();
            onGroupClips(selectedClipIds);
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

  // Calculate timeline width based on zoom (in pixels)
  const timelineWidth = useMemo(() => {
    return BASE_TIMELINE_WIDTH * zoom;
  }, [zoom]);
  
  // Preserve scroll position when zooming (zoom towards center of viewport)
  // Skip if zooming via wheel (wheel handler manages its own scroll)
  useEffect(() => {
    // Skip if wheel zoom is active
    if (isWheelZoomingRef.current) {
      return;
    }
    
    if (!trackContainerRef.current || !containerRef.current) return;
    
    const scrollContainer = trackContainerRef.current;
    const container = containerRef.current;
    
    // Calculate center of viewport in timeline coordinates
    const oldWidth = container.offsetWidth || timelineWidth;
    if (oldWidth === 0) return;
    
    const viewportCenter = scrollContainer.scrollLeft + scrollContainer.clientWidth / 2;
    const centerRatio = viewportCenter / oldWidth;
    
    // After zoom, adjust scroll to keep center point stable
    requestAnimationFrame(() => {
      if (!trackContainerRef.current || !containerRef.current) return;
      const newScrollContainer = trackContainerRef.current;
      const newContainer = containerRef.current;
      const newWidth = newContainer.offsetWidth || timelineWidth;
      
      if (newWidth > newScrollContainer.clientWidth && newWidth > 0) {
        const newCenter = centerRatio * newWidth;
        newScrollContainer.scrollLeft = Math.max(0, newCenter - newScrollContainer.clientWidth / 2);
      }
    });
  }, [zoom, timelineWidth]);

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
    // Close context menu on click
    setContextMenu(null);
    
    if (!containerRef.current || !trackContainerRef.current || duration === 0) {
      return;
    }
    
    const scrollContainer = trackContainerRef.current;
    const scrollContainerRect = scrollContainer.getBoundingClientRect();
    const scrollLeft = scrollContainer.scrollLeft;
    
    // Calculate click position relative to scroll container, then add scroll offset
    // This gives us the position within the full content
    const xInViewport = e.clientX - scrollContainerRect.left;
    const x = xInViewport + scrollLeft;
    
    // Use the content's actual scrollable width for percentage calculation
    // scrollWidth gives us the full content width regardless of minWidth CSS
    const contentWidth = containerRef.current.scrollWidth;
    const percentage = x / contentWidth;
    const time = percentage * duration;
    
    if (isRazorMode && onSplitClip) {
      // Find clip at this time and split it
      const clipAtTime = clips.find(c => 
        time >= c.startTime + c.trimStartOffset && 
        time <= c.endTime + c.trimEndOffset
      );
      if (clipAtTime) {
        onSplitClip(clipAtTime.id, time);
      }
      onSeek(Math.max(0, Math.min(duration, time)));
    } else {
      onSeek(Math.max(0, Math.min(duration, time)));
    }
  }, [duration, onSeek, isRazorMode, onSplitClip, clips]);

  // Handle right-click context menu
  const handleContextMenu = useCallback((e: React.MouseEvent, clipId?: string, trackId?: string) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      clipId,
      trackId,
    });
  }, []);

  // Close context menu when clicking outside
  useEffect(() => {
    const handleClickOutside = () => setContextMenu(null);
    if (contextMenu) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [contextMenu]);

  // Drag handlers for clips
  const handleDragStart = useCallback((clipId: string, e: React.MouseEvent) => {
    const track = tracks.find(t => t.type === 'video');
    if (track?.locked) return;
    
    setDraggedClip(clipId);
    setDragStartX(e.clientX);
    setHasDragged(false); // Reset drag tracking
    const clip = clips.find(c => c.id === clipId);
    if (clip) setDragStartTime(clip.startTime);
  }, [tracks, clips]);

  const handleDragMove = useCallback((e: React.MouseEvent) => {
    if (!draggedClip || !containerRef.current || !onMoveClip) return;
    
    const deltaX = e.clientX - dragStartX;
    
    // Only start dragging after moving more than 5 pixels (drag threshold)
    if (Math.abs(deltaX) < 5 && !hasDragged) return;
    
    setHasDragged(true); // Mark that actual drag occurred
    
    // Calculate time delta based on content's scrollable width for consistency
    const contentWidth = containerRef.current.scrollWidth;
    const deltaTime = (deltaX / contentWidth) * duration;
    const newTime = Math.max(0, Math.min(duration, dragStartTime + deltaTime));
    
    onMoveClip(draggedClip, newTime);
  }, [draggedClip, dragStartX, dragStartTime, duration, onMoveClip, hasDragged]);

  const handleDragEnd = useCallback(() => {
    // If we actually dragged, set flag to prevent click from selecting
    if (hasDragged) {
      justFinishedDragRef.current = true;
      // Reset the flag after a short delay (to allow click event to check it)
      setTimeout(() => {
        justFinishedDragRef.current = false;
      }, 0);
    }
    setDraggedClip(null);
    setHasDragged(false);
  }, [hasDragged]);

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

  // Zoom controls (scroll preservation handled by useEffect)
  const handleZoomIn = useCallback(() => {
    setZoom(prev => Math.min(10, prev + 0.5));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoom(prev => Math.max(0.5, prev - 0.5));
  }, []);

  const handleFit = useCallback(() => {
    setZoom(1);
  }, []);
  
  // Mouse wheel zoom and scroll support
  // Use native event listener for non-passive handling (allows preventDefault)
  useEffect(() => {
    const trackContainer = trackContainerRef.current;
    if (!trackContainer) return;

    const handleWheel = (e: WheelEvent) => {
      // Zoom when Ctrl/Cmd is held
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        if (!trackContainerRef.current || !containerRef.current) return;
        
        const scrollContainer = trackContainerRef.current;
        const container = containerRef.current;
        
        // Get mouse position relative to timeline
        const rect = container.getBoundingClientRect();
        const oldWidth = container.offsetWidth || BASE_TIMELINE_WIDTH * zoom;
        const mouseX = e.clientX - rect.left + scrollContainer.scrollLeft;
        const mouseRatio = mouseX / oldWidth;
        
        // Calculate zoom delta
        const delta = e.deltaY > 0 ? -0.1 : 0.1;
        const newZoom = Math.max(0.5, Math.min(10, zoom + delta));
        
        // Mark that we're zooming via wheel to prevent useEffect from interfering
        isWheelZoomingRef.current = true;
        
        // Update zoom
        setZoom(newZoom);
        
        // After zoom, adjust scroll to keep mouse position stable
        // Use double RAF to ensure DOM has updated
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            if (!trackContainerRef.current || !containerRef.current) return;
            const newContainer = containerRef.current;
            const newScrollContainer = trackContainerRef.current;
            const newWidth = newContainer.offsetWidth || (BASE_TIMELINE_WIDTH * newZoom);
            
            if (newWidth > newScrollContainer.clientWidth) {
              const newMouseX = mouseRatio * newWidth;
              newScrollContainer.scrollLeft = Math.max(0, newMouseX - (e.clientX - rect.left));
            }
            
            // Reset flag after scroll adjustment
            isWheelZoomingRef.current = false;
          });
        });
        return;
      }
      
      // Shift+scroll = convert vertical scroll to horizontal scroll
      if (e.shiftKey) {
        e.preventDefault();
        trackContainer.scrollLeft += e.deltaY;
        return;
      }
      
      // Determine scroll direction from deltas
      const absX = Math.abs(e.deltaX);
      const absY = Math.abs(e.deltaY);
      
      // Explicit horizontal scroll (trackpad two-finger horizontal swipe)
      // Let browser handle naturally
      if (absX > absY) {
        return;
      }
      
      // Vertical scroll (mouse wheel) - convert to horizontal scroll for timeline
      // This is the expected behavior for timeline scrolling
      if (absY > 0) {
        e.preventDefault();
        trackContainer.scrollLeft += e.deltaY;
        return;
      }
    };

    // Add as non-passive to allow preventDefault
    trackContainer.addEventListener('wheel', handleWheel, { passive: false });
    
    return () => {
      trackContainer.removeEventListener('wheel', handleWheel);
    };
  }, [zoom]);

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
    <div className="bg-sz-bg-secondary rounded-sz-lg border border-sz-border overflow-hidden flex flex-col no-select">
      {/* Timeline header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-sz-border">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-sz-text-secondary uppercase tracking-wider mr-2">
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
            title="Razor tool (C) - Click on clips to split"
          >
            <Scissors className="w-3.5 h-3.5" />
            Razor
          </button>

          {/* Split at playhead */}
          <button
            onClick={() => {
              const clipAtPlayhead = clips.find(c => 
                currentTime >= c.startTime + c.trimStartOffset && 
                currentTime <= c.endTime + c.trimEndOffset
              );
              if (clipAtPlayhead && onSplitClip) {
                onSplitClip(clipAtPlayhead.id, currentTime);
              }
            }}
            disabled={!clips.some(c => 
              currentTime >= c.startTime + c.trimStartOffset && 
              currentTime <= c.endTime + c.trimEndOffset
            )}
            className="flex items-center gap-1 px-2 py-1 rounded text-xs bg-sz-bg-tertiary text-sz-text-secondary hover:text-sz-text hover:bg-sz-bg disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            title="Split at playhead (S)"
          >
            <Scissors className="w-3.5 h-3.5" />
            Split
          </button>

          {/* Duplicate */}
          {selectedClipId && onDuplicateClip && (
            <button
              onClick={() => onDuplicateClip(selectedClipId)}
              className="flex items-center gap-1 px-2 py-1 rounded text-xs bg-sz-bg-tertiary text-sz-text-secondary hover:text-sz-text hover:bg-sz-bg transition-colors"
              title="Duplicate clip (D)"
            >
              <Copy className="w-3.5 h-3.5" />
              Duplicate
            </button>
          )}

          {/* Group */}
          {selectedClipIds.length > 1 && onGroupClips && (
            <button
              onClick={() => onGroupClips(selectedClipIds)}
              className="flex items-center gap-1 px-2 py-1 rounded text-xs bg-sz-bg-tertiary text-sz-text-secondary hover:text-sz-text hover:bg-sz-bg transition-colors"
              title="Group selected clips (Ctrl+G)"
            >
              <Group className="w-3.5 h-3.5" />
              Group
            </button>
          )}

          {/* Add Audio */}
          {onAddAudioTrack && (
            <button
              onClick={onAddAudioTrack}
              className="flex items-center gap-1 px-2 py-1 rounded text-xs bg-sz-bg-tertiary text-sz-text-secondary hover:text-sz-text hover:bg-sz-bg transition-colors"
              title="Add audio track"
            >
              <Plus className="w-3.5 h-3.5" />
              <FileAudio className="w-3.5 h-3.5" />
            </button>
          )}
          
          {/* Playback rate indicator */}
          {playbackRate !== 1 && (
            <span className={`text-xs px-2 py-0.5 rounded ${
              playbackRate === 0 ? 'bg-amber-500/20 text-amber-400' : 'bg-blue-500/20 text-blue-400'
            }`}>
              {playbackRate === 0 ? 'Paused' : `${playbackRate > 0 ? '+' : ''}${playbackRate}x`}
            </span>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          {/* Analyze Video button - always visible in header when applicable */}
          {duration > 0 && !hasClips && !isDetecting && onAnalyze && (
            <Button
              variant="primary"
              size="sm"
              leftIcon={<Zap className="w-3.5 h-3.5" />}
              onClick={onAnalyze}
            >
              Analyze Video
            </Button>
          )}
          
          {/* Detecting indicator in header */}
          {isDetecting && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-sz-bg-tertiary rounded border border-sz-border">
              <div className="w-3 h-3 border-2 border-sz-accent border-t-transparent rounded-full animate-spin" />
              <span className="text-xs text-sz-text-secondary">Analyzing...</span>
            </div>
          )}
          
          <div className="w-px h-5 bg-sz-border mx-1" />
          
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
          className="flex-1 overflow-x-auto overflow-y-hidden min-w-0 no-select"
          onMouseMove={draggedClip ? handleDragMove : undefined}
          onMouseUp={handleDragEnd}
          onMouseLeave={handleDragEnd}
        >
          <div
            ref={containerRef}
            className={`relative ${isRazorMode ? 'cursor-crosshair' : 'cursor-pointer'}`}
            style={{ 
              width: `${timelineWidth}px`,
              minWidth: '100%', // Always fill container, scroll only when zoomed
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
                {/* Source video clip - always show when we have a video loaded */}
                {track.type === 'video' && duration > 0 && (
                  <div
                    className="absolute top-1 bottom-1 left-0 right-0 rounded bg-gradient-to-b from-blue-600/80 to-blue-700/80 border border-blue-500/60 overflow-hidden"
                    title={sourceVideoName || 'Source video'}
                  >
                    {/* Video clip header bar */}
                    <div className="absolute top-0 left-0 right-0 h-3 bg-blue-500/40 flex items-center px-1.5 gap-1">
                      <Video className="w-2.5 h-2.5 text-blue-100" />
                      <span className="text-[8px] text-blue-100 font-medium truncate">
                        {sourceVideoName || 'Video'}
                      </span>
                    </div>
                    {/* Thumbnail strip effect - visual indication of video content */}
                    <div className="absolute bottom-0 left-0 right-0 h-[calc(100%-12px)] flex">
                      {Array.from({ length: Math.min(20, Math.ceil(duration / 30)) }).map((_, i) => (
                        <div
                          key={i}
                          className="flex-1 border-r border-blue-400/20 last:border-r-0"
                          style={{
                            background: `linear-gradient(180deg, rgba(59,130,246,0.1) 0%, rgba(37,99,235,0.2) 100%)`,
                          }}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Dead spaces (silence) - show as red zones overlaid on video */}
                {track.type === 'video' && deadSpaces.filter(ds => ds.remove).map((ds) => (
                  <div
                    key={ds.id}
                    className="absolute top-1 bottom-1 rounded bg-red-500/40 border border-red-500/60 pointer-events-none z-20"
                    style={{
                      left: `${(ds.startTime / duration) * 100}%`,
                      width: `${((ds.endTime - ds.startTime) / duration) * 100}%`,
                    }}
                    title={`Dead space: ${ds.duration.toFixed(1)}s`}
                  >
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-[8px] text-red-200 font-medium">
                        {ds.duration > 5 ? `${ds.duration.toFixed(0)}s` : ''}
                      </span>
                    </div>
                  </div>
                ))}

                {/* Detected clips - show as highlighted regions on top of video */}
                {track.type === 'video' && hasClips && clips.map((clip) => {
                  const group = clip.groupId ? timelineGroups.find(g => g.id === clip.groupId) : null;
                  const isSelected = clip.id === selectedClipId || selectedClipIds.includes(clip.id);
                  
                  return (
                    <div
                      key={clip.id}
                      className={`absolute top-0 bottom-0 cursor-pointer transition-all z-10 ${
                        isSelected
                          ? 'ring-2 ring-sz-accent ring-offset-1 ring-offset-sz-bg z-20' 
                          : ''
                      } ${draggedClip === clip.id ? 'opacity-70' : ''} ${clip.locked ? 'cursor-not-allowed' : ''}`}
                      style={{
                        left: `${(clip.startTime / duration) * 100}%`,
                        width: `${((clip.endTime - clip.startTime) / duration) * 100}%`,
                      }}
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        if (!clip.locked) handleDragStart(clip.id, e);
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        // Don't select if we just finished dragging
                        if (justFinishedDragRef.current) return;
                        if (isRazorMode && onSplitClip) {
                          // Calculate click position as time using scroll container for accuracy
                          const scrollContainerRect = trackContainerRef.current?.getBoundingClientRect();
                          const scrollLeft = trackContainerRef.current?.scrollLeft || 0;
                          const contentWidth = containerRef.current?.scrollWidth || 1;
                          if (scrollContainerRect) {
                            const xInViewport = e.clientX - scrollContainerRect.left;
                            const x = xInViewport + scrollLeft;
                            const clickTime = (x / contentWidth) * duration;
                            onSplitClip(clip.id, clickTime);
                          }
                        } else if (e.ctrlKey || e.metaKey) {
                          // Multi-select with Ctrl/Cmd
                          onMultiSelectClip?.(clip.id, true);
                        } else {
                          onSelectClip(clip.id);
                        }
                      }}
                      onContextMenu={(e) => handleContextMenu(e, clip.id)}
                    >
                      {/* Group color indicator */}
                      {group && (
                        <div 
                          className="absolute top-0 left-0 right-0 h-1 rounded-t-sm"
                          style={{ backgroundColor: group.color }}
                          title={`Group: ${group.name}`}
                        />
                      )}
                      {/* Clip highlight overlay */}
                      <div className={`absolute rounded-sm border-2 ${
                        clip.status === 'accepted' 
                          ? 'bg-emerald-500/30 border-emerald-400' 
                          : clip.status === 'rejected'
                          ? 'bg-red-500/30 border-red-400'
                          : 'bg-amber-500/30 border-amber-400'
                      }`}
                      style={{
                        top: group ? '4px' : 0,
                        bottom: 0,
                        left: 0,
                        right: 0,
                      }}
                      >
                        {/* Clip label */}
                        <div className="absolute -top-4 left-0 px-1 py-0.5 bg-sz-bg-secondary rounded text-[8px] text-sz-text whitespace-nowrap border border-sz-border flex items-center gap-1">
                          {clip.locked && <Lock className="w-2 h-2 text-amber-400" />}
                          {clip.title || `Clip ${clip.id.split('_')[1] || ''}`}
                          {clip.appliedEffects && clip.appliedEffects.length > 0 && (
                            <span className="text-sz-accent">fx</span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}

                {/* Camera cuts track */}
                {track.type === 'video' && cameraCuts?.map((cut, i) => (
                  <div
                    key={cut.id}
                    className="absolute top-0 h-1 bg-violet-500 z-30"
                    style={{
                      left: `${(cut.startTime / duration) * 100}%`,
                      width: `${((cut.endTime - cut.startTime) / duration) * 100}%`,
                    }}
                    title={`Camera: ${cut.cameraId}`}
                  />
                ))}

                {/* Audio track - show main waveform from source video */}
                {track.type === 'audio' && waveformData && (
                  <div className="absolute inset-0">
                    {renderWaveform(waveformData, track.height)}
                  </div>
                )}

                {/* Audio track - show imported audio files (MP3s etc) */}
                {track.type === 'audio' && audioTracks.filter(at => at.type === 'main' || at.type === 'sfx').map((audioTrack) => (
                  <div
                    key={audioTrack.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedAudioTrackId(audioTrack.id);
                    }}
                    onContextMenu={(e) => handleContextMenu(e, undefined, audioTrack.id)}
                    className={`absolute top-1 bottom-1 rounded cursor-pointer transition-all ${
                      selectedAudioTrackId === audioTrack.id
                        ? 'ring-2 ring-sz-accent ring-offset-1 ring-offset-sz-bg'
                        : ''
                    } ${audioTrack.muted ? 'opacity-50' : ''}`}
                    style={{
                      left: `${(audioTrack.startTime / duration) * 100}%`,
                      width: `${((audioTrack.endTime - audioTrack.startTime) / duration) * 100}%`,
                      background: 'linear-gradient(180deg, rgba(16,185,129,0.4) 0%, rgba(16,185,129,0.6) 100%)',
                      border: '1px solid rgba(16,185,129,0.7)',
                    }}
                    title={`${audioTrack.fileName || 'Audio'} (${audioTrack.volume}%)`}
                  >
                    {/* Audio clip header */}
                    <div className="absolute top-0 left-0 right-0 h-3 bg-emerald-500/40 flex items-center px-1.5 gap-1">
                      <FileAudio className="w-2.5 h-2.5 text-emerald-100" />
                      <span className="text-[8px] text-emerald-100 font-medium truncate flex-1">
                        {audioTrack.fileName || 'Audio'}
                      </span>
                      {audioTrack.muted && <VolumeX className="w-2.5 h-2.5 text-red-300" />}
                    </div>
                    {/* Waveform visualization */}
                    {audioTrack.waveformData && (
                      <div className="absolute bottom-0 left-0 right-0 h-[calc(100%-12px)]">
                        {renderWaveform(audioTrack.waveformData, track.height - 12)}
                      </div>
                    )}
                    {!audioTrack.waveformData && (
                      <div className="absolute bottom-1 left-1 right-1 h-[calc(100%-16px)] flex items-center justify-center">
                        <div className="flex gap-0.5">
                          {Array.from({ length: 20 }).map((_, i) => (
                            <div
                              key={i}
                              className="w-0.5 bg-emerald-400/60 rounded-full"
                              style={{ height: `${Math.random() * 80 + 20}%` }}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}

                {/* Audio track - show speaker segments */}
                {track.type === 'audio' && speakerSegments.length > 0 && speakerSegments.map((seg, i) => {
                  // Color-code speakers
                  const speakerColors = [
                    'bg-blue-500/40 border-blue-500',
                    'bg-emerald-500/40 border-emerald-500',
                    'bg-purple-500/40 border-purple-500',
                    'bg-amber-500/40 border-amber-500',
                  ];
                  const speakerIndex = parseInt(seg.speakerId.replace(/\D/g, '') || '0') % speakerColors.length;
                  const colorClass = speakerColors[speakerIndex];
                  
                  return (
                    <div
                      key={`speaker-${i}`}
                      className={`absolute top-0 h-full rounded-sm border ${colorClass} pointer-events-none`}
                      style={{
                        left: `${(seg.startTime / duration) * 100}%`,
                        width: `${((seg.endTime - seg.startTime) / duration) * 100}%`,
                      }}
                      title={`${seg.speakerName}: ${seg.startTime.toFixed(1)}s - ${seg.endTime.toFixed(1)}s`}
                    >
                      <span className="absolute top-0 left-0.5 text-[8px] text-white/80 truncate max-w-full">
                        {seg.speakerName}
                      </span>
                    </div>
                  );
                })}

                {/* Music/B-Roll tracks - show audio tracks */}
                {(track.type === 'music' || track.type === 'broll') && audioTracks.filter(at => 
                  (track.type === 'music' && at.type === 'music') ||
                  (track.type === 'broll' && at.type === 'broll')
                ).map((audioTrack) => {
                  const isMusic = track.type === 'music';
                  const bgColor = isMusic ? 'violet' : 'cyan';
                  return (
                    <div
                      key={audioTrack.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedAudioTrackId(audioTrack.id);
                      }}
                      onContextMenu={(e) => handleContextMenu(e, undefined, audioTrack.id)}
                      className={`absolute top-1 bottom-1 rounded cursor-pointer transition-all ${
                        selectedAudioTrackId === audioTrack.id
                          ? 'ring-2 ring-sz-accent ring-offset-1 ring-offset-sz-bg'
                          : ''
                      } ${audioTrack.muted ? 'opacity-50' : ''}`}
                      style={{
                        left: `${(audioTrack.startTime / duration) * 100}%`,
                        width: `${((audioTrack.endTime - audioTrack.startTime) / duration) * 100}%`,
                        background: isMusic 
                          ? 'linear-gradient(180deg, rgba(139,92,246,0.4) 0%, rgba(139,92,246,0.6) 100%)'
                          : 'linear-gradient(180deg, rgba(6,182,212,0.4) 0%, rgba(6,182,212,0.6) 100%)',
                        border: isMusic 
                          ? '1px solid rgba(139,92,246,0.7)'
                          : '1px solid rgba(6,182,212,0.7)',
                      }}
                      title={`${audioTrack.fileName || audioTrack.filePath?.split(/[\\/]/).pop() || 'Audio'} (${audioTrack.volume}%)`}
                    >
                      {/* Track header */}
                      <div className={`absolute top-0 left-0 right-0 h-3 flex items-center px-1.5 gap-1 ${
                        isMusic ? 'bg-violet-500/40' : 'bg-cyan-500/40'
                      }`}>
                        {isMusic ? (
                          <Music className="w-2.5 h-2.5 text-violet-100" />
                        ) : (
                          <Image className="w-2.5 h-2.5 text-cyan-100" />
                        )}
                        <span className={`text-[8px] font-medium truncate flex-1 ${
                          isMusic ? 'text-violet-100' : 'text-cyan-100'
                        }`}>
                          {audioTrack.fileName || audioTrack.filePath?.split(/[\\/]/).pop() || 'Track'}
                        </span>
                        {audioTrack.muted && <VolumeX className="w-2.5 h-2.5 text-red-300" />}
                      </div>
                      {/* Waveform or placeholder */}
                      <div className="absolute bottom-0 left-0 right-0 h-[calc(100%-12px)] flex items-center justify-center px-1">
                        {audioTrack.waveformData ? (
                          renderWaveform(audioTrack.waveformData, track.height - 12)
                        ) : (
                          <div className="flex gap-0.5 h-full items-end pb-1">
                            {Array.from({ length: 12 }).map((_, i) => (
                              <div
                                key={i}
                                className={`w-0.5 rounded-full ${isMusic ? 'bg-violet-400/60' : 'bg-cyan-400/60'}`}
                                style={{ height: `${Math.random() * 60 + 20}%` }}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}

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
          <span>S: Split</span>
          <span>•</span>
          <span>D: Duplicate</span>
          <span>•</span>
          <span>C: Razor</span>
          <span>•</span>
          <span>←/→: Seek</span>
        </div>
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <div
          className="fixed z-50 bg-sz-bg-secondary border border-sz-border rounded-md shadow-lg py-1 min-w-[160px]"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          {contextMenu.clipId && (
            <>
              <button
                onClick={() => {
                  if (onSplitClip) onSplitClip(contextMenu.clipId!, currentTime);
                  setContextMenu(null);
                }}
                className="w-full px-3 py-1.5 text-xs text-left text-sz-text hover:bg-sz-bg-tertiary flex items-center gap-2"
              >
                <Scissors className="w-3.5 h-3.5" />
                Split at Playhead
              </button>
              <button
                onClick={() => {
                  if (onDuplicateClip) onDuplicateClip(contextMenu.clipId!);
                  setContextMenu(null);
                }}
                className="w-full px-3 py-1.5 text-xs text-left text-sz-text hover:bg-sz-bg-tertiary flex items-center gap-2"
              >
                <Copy className="w-3.5 h-3.5" />
                Duplicate
              </button>
              <div className="h-px bg-sz-border my-1" />
              {selectedClipIds.length > 1 && onGroupClips && (
                <button
                  onClick={() => {
                    onGroupClips(selectedClipIds);
                    setContextMenu(null);
                  }}
                  className="w-full px-3 py-1.5 text-xs text-left text-sz-text hover:bg-sz-bg-tertiary flex items-center gap-2"
                >
                  <Group className="w-3.5 h-3.5" />
                  Group Selected
                </button>
              )}
              {clips.find(c => c.id === contextMenu.clipId)?.groupId && onUngroupClips && (
                <button
                  onClick={() => {
                    const clip = clips.find(c => c.id === contextMenu.clipId);
                    if (clip?.groupId) onUngroupClips(clip.groupId);
                    setContextMenu(null);
                  }}
                  className="w-full px-3 py-1.5 text-xs text-left text-sz-text hover:bg-sz-bg-tertiary flex items-center gap-2"
                >
                  <Ungroup className="w-3.5 h-3.5" />
                  Ungroup
                </button>
              )}
              <div className="h-px bg-sz-border my-1" />
              <button
                onClick={() => {
                  if (onDeleteClip) onDeleteClip(contextMenu.clipId!);
                  setContextMenu(null);
                }}
                className="w-full px-3 py-1.5 text-xs text-left text-red-400 hover:bg-sz-bg-tertiary flex items-center gap-2"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete
              </button>
            </>
          )}
          {contextMenu.trackId && (
            <>
              <button
                onClick={() => {
                  const track = audioTracks.find(t => t.id === contextMenu.trackId);
                  if (track && onUpdateAudioTrack) {
                    onUpdateAudioTrack(contextMenu.trackId!, { muted: !track.muted });
                  }
                  setContextMenu(null);
                }}
                className="w-full px-3 py-1.5 text-xs text-left text-sz-text hover:bg-sz-bg-tertiary flex items-center gap-2"
              >
                {audioTracks.find(t => t.id === contextMenu.trackId)?.muted ? (
                  <>
                    <Volume2 className="w-3.5 h-3.5" />
                    Unmute
                  </>
                ) : (
                  <>
                    <VolumeX className="w-3.5 h-3.5" />
                    Mute
                  </>
                )}
              </button>
              <div className="h-px bg-sz-border my-1" />
              <button
                onClick={() => {
                  if (onRemoveAudioTrack) onRemoveAudioTrack(contextMenu.trackId!);
                  setContextMenu(null);
                }}
                className="w-full px-3 py-1.5 text-xs text-left text-red-400 hover:bg-sz-bg-tertiary flex items-center gap-2"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Remove
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default memo(Timeline);
