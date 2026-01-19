import { memo, forwardRef, useEffect, useRef, useImperativeHandle, useCallback, useState } from 'react';
import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, Maximize2 } from 'lucide-react';
import type { Project, Clip } from '../../types';
import { formatTimestamp } from '../../types';
import { IconButton } from '../ui';

interface VideoPreviewProps {
  project: Project;
  selectedClip: Clip | null;
  clips: Clip[]; // All clips on timeline
  currentTime: number;
  isPlaying: boolean;
  onTimeUpdate: (time: number) => void;
  onPlayPause: () => void;
  onPlayingChange: (playing: boolean) => void;
}

const VideoPreview = forwardRef<HTMLVideoElement, VideoPreviewProps>(
  ({ project, selectedClip, clips, currentTime, isPlaying, onTimeUpdate, onPlayPause, onPlayingChange }, ref) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [isMuted, setIsMuted] = useState(false);

    // Forward ref
    useImperativeHandle(ref, () => videoRef.current as HTMLVideoElement);

    // Video source
    const videoSrc = `file:///${project.filePath.replace(/\\/g, '/')}`;

    // Handle time update with timeline-aware playback
    const handleTimeUpdate = useCallback(() => {
      if (!videoRef.current) return;
      
      const time = videoRef.current.currentTime;
      onTimeUpdate(time);
      
      // Timeline-aware playback: respect clip boundaries
      if (clips.length > 0 && !videoRef.current.paused) {
        // Sort clips by start time for sequential playback
        const sortedClips = [...clips].sort((a, b) => a.startTime - b.startTime);
        
        // Find the current clip (considering trim offsets)
        const currentClip = sortedClips.find(clip => {
          const effectiveStart = clip.startTime + (clip.trimStartOffset || 0);
          const effectiveEnd = clip.endTime + (clip.trimEndOffset || 0);
          return time >= effectiveStart && time < effectiveEnd;
        });
        
        if (currentClip) {
          // Inside a clip - check if we've reached its end
          const effectiveEnd = currentClip.endTime + (currentClip.trimEndOffset || 0);
          
          // Use a small threshold (50ms) to detect end of clip
          if (time >= effectiveEnd - 0.05) {
            const currentIndex = sortedClips.findIndex(c => c.id === currentClip.id);
            
            if (currentIndex < sortedClips.length - 1) {
              // Jump to the start of the next clip
              const nextClip = sortedClips[currentIndex + 1];
              const nextStart = nextClip.startTime + (nextClip.trimStartOffset || 0);
              videoRef.current.currentTime = nextStart;
            } else {
              // Last clip - pause at the end
              videoRef.current.pause();
            }
          }
        } else {
          // Outside all clips - jump to the next clip or pause
          const nextClip = sortedClips.find(clip => {
            const effectiveStart = clip.startTime + (clip.trimStartOffset || 0);
            return effectiveStart > time;
          });
          
          if (nextClip) {
            // Jump to the next clip
            const nextStart = nextClip.startTime + (nextClip.trimStartOffset || 0);
            videoRef.current.currentTime = nextStart;
          } else {
            // No more clips - pause
            videoRef.current.pause();
          }
        }
      }
    }, [onTimeUpdate, clips]);

    // Handle play/pause state changes
    const handlePlay = useCallback(() => {
      onPlayingChange(true);
    }, [onPlayingChange]);

    const handlePause = useCallback(() => {
      onPlayingChange(false);
    }, [onPlayingChange]);

    // Seek controls
    const handleSkipBack = useCallback(() => {
      if (videoRef.current) {
        videoRef.current.currentTime = Math.max(0, videoRef.current.currentTime - 5);
      }
    }, []);

    const handleSkipForward = useCallback(() => {
      if (videoRef.current) {
        videoRef.current.currentTime = Math.min(project.duration, videoRef.current.currentTime + 5);
      }
    }, [project.duration]);

    // Toggle mute
    const handleToggleMute = useCallback(() => {
      if (videoRef.current) {
        videoRef.current.muted = !videoRef.current.muted;
        setIsMuted(videoRef.current.muted);
      }
    }, []);

    // Fullscreen
    const handleFullscreen = useCallback(() => {
      if (videoRef.current) {
        videoRef.current.requestFullscreen?.();
      }
    }, []);

    // Seek to selected clip when it changes
    useEffect(() => {
      if (selectedClip && videoRef.current) {
        videoRef.current.currentTime = selectedClip.startTime;
      }
    }, [selectedClip?.id]);

    return (
      <div className="flex flex-col no-select">
        {/* Video container */}
        <div className="relative w-full bg-black rounded-sz-lg overflow-hidden border border-sz-border shadow-lg">
          <div className="aspect-video">
            <video
              ref={videoRef}
              src={videoSrc}
              className="w-full h-full object-contain"
              onTimeUpdate={handleTimeUpdate}
              onPlay={handlePlay}
              onPause={handlePause}
              onClick={onPlayPause}
            />
          </div>

          {/* Overlay info */}
          <div className="absolute inset-0 pointer-events-none">
            {/* Selected clip indicator */}
            {selectedClip && (
              <div className="absolute top-3 left-3 px-3 py-1.5 bg-black/90 rounded-md text-xs text-sz-text backdrop-blur-sm border border-sz-border/50">
                <span className="text-sz-text-muted">Clip: </span>
                <span className="font-semibold">{selectedClip.title || `Clip ${selectedClip.id.split('_')[1]}`}</span>
              </div>
            )}

            {/* Time display */}
            <div className="absolute bottom-3 right-3 px-3 py-1.5 bg-black/90 rounded-md text-xs font-mono text-sz-text backdrop-blur-sm border border-sz-border/50">
              <span className="text-sz-text">{formatTimestamp(currentTime)}</span>
              <span className="text-sz-text-muted"> / </span>
              <span className="text-sz-text-muted">{formatTimestamp(project.duration)}</span>
            </div>

            {/* Resolution badge */}
            {project.resolution && (
              <div className="absolute top-3 right-3 px-2 py-1 bg-black/90 rounded-md text-[10px] text-sz-text-muted backdrop-blur-sm border border-sz-border/50">
                {project.resolution}
                {project.fps && ` @ ${project.fps}fps`}
              </div>
            )}
          </div>
        </div>

        {/* Enhanced Controls */}
        <div className="mt-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <IconButton
              icon={<SkipBack className="w-4 h-4" />}
              variant="ghost"
              size="sm"
              tooltip="Skip back 5s (Shift+←)"
              onClick={handleSkipBack}
            />
            <button
              onClick={(e) => {
                e.preventDefault();
                onPlayPause();
              }}
              className="w-10 h-10 rounded-full bg-sz-accent hover:bg-sz-accent-hover flex items-center justify-center transition-colors shadow-md"
            >
              {isPlaying ? (
                <Pause className="w-5 h-5 text-sz-bg" />
              ) : (
                <Play className="w-5 h-5 text-sz-bg ml-0.5" />
              )}
            </button>
            <IconButton
              icon={<SkipForward className="w-4 h-4" />}
              variant="ghost"
              size="sm"
              tooltip="Skip forward 5s (Shift+→)"
              onClick={handleSkipForward}
            />
            
            <div className="w-px h-5 bg-sz-border mx-2" />
            
            <IconButton
              icon={isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              variant="ghost"
              size="sm"
              tooltip={isMuted ? "Unmute (M)" : "Mute (M)"}
              onClick={handleToggleMute}
            />
          </div>

          <div className="flex items-center gap-2">
            <IconButton
              icon={<Maximize2 className="w-4 h-4" />}
              variant="ghost"
              size="sm"
              tooltip="Fullscreen (F)"
              onClick={handleFullscreen}
            />
          </div>
        </div>
      </div>
    );
  }
);

VideoPreview.displayName = 'VideoPreview';

export default memo(VideoPreview);
