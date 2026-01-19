import { memo, forwardRef, useEffect, useRef, useImperativeHandle, useCallback, useState } from 'react';
import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, Maximize2 } from 'lucide-react';
import type { Project, Clip } from '../../types';
import { formatTimestamp } from '../../types';
import { IconButton } from '../ui';

interface VideoPreviewProps {
  project: Project;
  selectedClip: Clip | null;
  currentTime: number;
  isPlaying: boolean;
  onTimeUpdate: (time: number) => void;
  onPlayPause: () => void;
  onPlayingChange: (playing: boolean) => void;
}

const VideoPreview = forwardRef<HTMLVideoElement, VideoPreviewProps>(
  ({ project, selectedClip, currentTime, isPlaying, onTimeUpdate, onPlayPause, onPlayingChange }, ref) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [isMuted, setIsMuted] = useState(false);

    // Forward ref
    useImperativeHandle(ref, () => videoRef.current as HTMLVideoElement);

    // Video source
    const videoSrc = `file:///${project.filePath.replace(/\\/g, '/')}`;

    // Handle time update
    const handleTimeUpdate = useCallback(() => {
      if (videoRef.current) {
        onTimeUpdate(videoRef.current.currentTime);
      }
    }, [onTimeUpdate]);

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
      <div className="flex flex-col items-center">
        {/* Video container */}
        <div className="relative w-full max-w-3xl bg-black rounded-sz-lg overflow-hidden border border-sz-border">
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

          {/* Selected clip indicator */}
          {selectedClip && (
            <div className="absolute top-3 left-3 px-2 py-1 bg-black/80 rounded text-xs text-sz-text backdrop-blur-sm">
              <span className="text-sz-text-muted">Clip: </span>
              <span className="font-medium">{selectedClip.title || `Clip ${selectedClip.id.split('_')[1]}`}</span>
            </div>
          )}

          {/* Time display */}
          <div className="absolute bottom-3 right-3 px-2 py-1 bg-black/80 rounded text-xs font-mono text-sz-text backdrop-blur-sm">
            {formatTimestamp(currentTime)} / {formatTimestamp(project.duration)}
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2 mt-3">
          <IconButton
            icon={<SkipBack className="w-4 h-4" />}
            variant="ghost"
            size="sm"
            tooltip="Skip back 5s"
            onClick={handleSkipBack}
          />
          <button
            onClick={onPlayPause}
            className="w-10 h-10 rounded-full bg-sz-accent hover:bg-sz-accent-hover flex items-center justify-center transition-colors"
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
            tooltip="Skip forward 5s"
            onClick={handleSkipForward}
          />
          
          <div className="w-px h-5 bg-sz-border mx-2" />
          
          <IconButton
            icon={isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            variant="ghost"
            size="sm"
            tooltip={isMuted ? "Unmute" : "Mute"}
            onClick={handleToggleMute}
          />
          <IconButton
            icon={<Maximize2 className="w-4 h-4" />}
            variant="ghost"
            size="sm"
            tooltip="Fullscreen"
            onClick={handleFullscreen}
          />
        </div>
      </div>
    );
  }
);

VideoPreview.displayName = 'VideoPreview';

export default memo(VideoPreview);
