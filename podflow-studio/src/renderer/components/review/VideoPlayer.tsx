import { memo, forwardRef, useEffect, useRef, useImperativeHandle, useState } from 'react';
import { Play, Pause } from 'lucide-react';
import type { ClipProject } from '../../review/clipProject';
import { Button } from '../ui';

export interface VideoPlayerRef {
  play: () => void;
  pause: () => void;
  seekTo: (time: number) => void;
  getCurrentTime: () => number;
}

export interface VideoPlayerProps {
  src: string;
  clipProject: ClipProject;
  onTimeUpdate?: (time: number) => void;
  className?: string;
}

const VideoPlayer = forwardRef<VideoPlayerRef, VideoPlayerProps>(
  ({ src, clipProject, onTimeUpdate, className = '' }, ref) => {
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentCaption, setCurrentCaption] = useState('');

    // Expose methods to parent
    useImperativeHandle(ref, () => ({
      play: () => {
        if (videoRef.current) {
          videoRef.current.currentTime = clipProject.edit.in;
          videoRef.current.play();
          setIsPlaying(true);
        }
      },
      pause: () => {
        videoRef.current?.pause();
        setIsPlaying(false);
      },
      seekTo: (time: number) => {
        if (videoRef.current) {
          videoRef.current.currentTime = time;
        }
      },
      getCurrentTime: () => videoRef.current?.currentTime || 0,
    }));

    // RAF-based playback enforcement: loop video within In/Out bounds
    useEffect(() => {
      const v = videoRef.current;
      if (!v || !clipProject) return;

      let raf = 0;

      const tick = () => {
        if (!videoRef.current || !clipProject) return;
        const t = videoRef.current.currentTime;

        // If outside segment bounds, snap back to In
        if (t < clipProject.edit.in || t > clipProject.edit.out) {
          videoRef.current.currentTime = clipProject.edit.in;
        }

        // Loop at out point
        if (!videoRef.current.paused && t >= clipProject.edit.out - 0.05) {
          videoRef.current.currentTime = clipProject.edit.in;
          videoRef.current.play().catch(() => {});
        }

        raf = requestAnimationFrame(tick);
      };

      raf = requestAnimationFrame(tick);
      return () => cancelAnimationFrame(raf);
    }, [clipProject?.edit.in, clipProject?.edit.out]);

    // Handle time update for captions
    const handleTimeUpdate = () => {
      if (!clipProject || !videoRef.current) return;
      const time = videoRef.current.currentTime;

      onTimeUpdate?.(time);

      if (clipProject.captions.enabled) {
        const segment = clipProject.captions.segments.find(
          (s) => time >= s.start && time <= s.end
        );
        setCurrentCaption(segment?.text || '');
      } else {
        setCurrentCaption('');
      }
    };

    const handlePlay = () => {
      if (!clipProject || !videoRef.current) return;
      videoRef.current.currentTime = clipProject.edit.in;
      videoRef.current.play();
      setIsPlaying(true);
    };

    const handlePause = () => {
      videoRef.current?.pause();
      setIsPlaying(false);
    };

    return (
      <div className={`space-y-3 ${className}`}>
        <div className="relative rounded-sz-lg overflow-hidden border border-sz-border bg-black">
          <video
            ref={videoRef}
            src={src}
            className="w-full"
            onTimeUpdate={handleTimeUpdate}
          />
          {clipProject.captions.enabled && currentCaption && (
            <div className="absolute bottom-4 w-full flex justify-center px-4">
              <div className="px-4 py-2 bg-black/80 text-white text-base font-medium rounded-sz max-w-[90%] text-center backdrop-blur-sm">
                {currentCaption}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="secondary"
            size="sm"
            onClick={isPlaying ? handlePause : handlePlay}
            leftIcon={isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          >
            {isPlaying ? 'Pause' : 'Play'}
          </Button>
          <div className="text-xs text-sz-text-secondary tabular-nums">
            In {clipProject.edit.in.toFixed(2)}s → Out {clipProject.edit.out.toFixed(2)}s
          </div>
        </div>
      </div>
    );
  }
);

VideoPlayer.displayName = 'VideoPlayer';

export default memo(VideoPlayer);
