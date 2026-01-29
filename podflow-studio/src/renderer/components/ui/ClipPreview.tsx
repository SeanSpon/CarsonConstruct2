/**
 * ClipPreview - Enhanced clip preview player with export options
 */
import React, { useRef, useState, useEffect } from 'react';

interface ClipData {
  path: string;
  index: number;
  duration: number;
  story_score?: number;
  has_setup?: boolean;
  has_conflict?: boolean;
  has_payoff?: boolean;
  text_preview?: string;
}

interface ExportFormat {
  id: string;
  name: string;
  icon: string;
}

interface ClipPreviewProps {
  clip: ClipData;
  onExport?: (formatId: string) => void;
  onReject?: () => void;
  onNext?: () => void;
  onPrevious?: () => void;
  totalClips: number;
  showNavigation?: boolean;
}

const EXPORT_FORMATS: ExportFormat[] = [
  { id: 'instagram_reel', name: 'Instagram Reel', icon: '📸' },
  { id: 'tiktok', name: 'TikTok', icon: '🎵' },
  { id: 'youtube_shorts', name: 'YouTube Shorts', icon: '▶️' },
  { id: 'twitter', name: 'Twitter/X', icon: '𝕏' },
  { id: 'high_quality', name: 'High Quality', icon: '⭐' },
];

export const ClipPreview: React.FC<ClipPreviewProps> = ({
  clip,
  onExport,
  onReject,
  onNext,
  onPrevious,
  totalClips,
  showNavigation = true
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);

  useEffect(() => {
    // Reset video when clip changes
    if (videoRef.current) {
      videoRef.current.load();
      setIsPlaying(false);
      setCurrentTime(0);
    }
  }, [clip.path]);

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleExport = (formatId: string) => {
    setShowExportMenu(false);
    onExport?.(formatId);
  };

  return (
    <div className="flex flex-col bg-zinc-900 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-zinc-800">
        <h2 className="text-lg font-semibold text-white">
          Clip {clip.index} of {totalClips}
        </h2>
        {clip.story_score !== undefined && (
          <div className="flex items-center gap-1 px-3 py-1 bg-amber-500/20 rounded-full">
            <span className="text-amber-400">⭐</span>
            <span className="text-sm font-medium text-amber-300">
              {clip.story_score.toFixed(0)}
            </span>
          </div>
        )}
      </div>

      {/* Video Container */}
      <div className="relative aspect-[9/16] max-h-[70vh] bg-black">
        <video
          ref={videoRef}
          src={clip.path.startsWith('file://') ? clip.path : `file://${clip.path}`}
          className="w-full h-full object-contain cursor-pointer"
          onClick={togglePlay}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onEnded={() => setIsPlaying(false)}
          onTimeUpdate={handleTimeUpdate}
        />

        {/* Play/Pause Overlay */}
        <div
          className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 hover:opacity-100 transition-opacity cursor-pointer"
          onClick={togglePlay}
        >
          <button className="w-16 h-16 flex items-center justify-center bg-white/20 hover:bg-white/30 backdrop-blur rounded-full transition-colors">
            <span className="text-3xl">{isPlaying ? '⏸️' : '▶️'}</span>
          </button>
        </div>

        {/* Time Display */}
        <div className="absolute bottom-4 left-4 px-3 py-1 bg-black/60 backdrop-blur rounded-lg">
          <span className="text-sm text-white font-mono">
            {formatTime(currentTime)} / {formatTime(clip.duration)}
          </span>
        </div>
      </div>

      {/* Clip Details */}
      <div className="p-4 border-t border-zinc-800">
        {/* Story Elements */}
        {(clip.has_setup !== undefined || clip.has_conflict !== undefined || clip.has_payoff !== undefined) && (
          <div className="flex flex-wrap gap-2 mb-3">
            <span className={`px-2 py-1 text-xs rounded-full ${
              clip.has_setup 
                ? 'bg-green-500/20 text-green-400' 
                : 'bg-zinc-800 text-zinc-500'
            }`}>
              📖 Setup {clip.has_setup ? '✓' : '✗'}
            </span>
            <span className={`px-2 py-1 text-xs rounded-full ${
              clip.has_conflict 
                ? 'bg-orange-500/20 text-orange-400' 
                : 'bg-zinc-800 text-zinc-500'
            }`}>
              ⚡ Conflict {clip.has_conflict ? '✓' : '✗'}
            </span>
            <span className={`px-2 py-1 text-xs rounded-full ${
              clip.has_payoff 
                ? 'bg-blue-500/20 text-blue-400' 
                : 'bg-zinc-800 text-zinc-500'
            }`}>
              🎯 Payoff {clip.has_payoff ? '✓' : '✗'}
            </span>
          </div>
        )}

        {/* Text Preview */}
        {clip.text_preview && (
          <p className="text-sm text-zinc-400 line-clamp-3 mb-4">
            &ldquo;{clip.text_preview}&rdquo;
          </p>
        )}

        {/* Actions */}
        <div className="flex items-center gap-3">
          {showNavigation && onPrevious && (
            <button
              onClick={onPrevious}
              disabled={clip.index <= 1}
              className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-white transition-colors"
            >
              ← Prev
            </button>
          )}

          {onReject && (
            <button
              onClick={onReject}
              className="px-4 py-2 bg-red-600/20 hover:bg-red-600/30 border border-red-500/50 rounded-lg text-red-400 transition-colors"
            >
              ❌ Reject
            </button>
          )}

          {/* Export Dropdown */}
          {onExport && (
            <div className="relative flex-1">
              <button
                onClick={() => setShowExportMenu(!showExportMenu)}
                className="w-full px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-white font-medium transition-colors"
              >
                💾 Export
              </button>

              {showExportMenu && (
                <div className="absolute bottom-full left-0 right-0 mb-2 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl overflow-hidden z-10">
                  {EXPORT_FORMATS.map((format) => (
                    <button
                      key={format.id}
                      onClick={() => handleExport(format.id)}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-zinc-700 text-left transition-colors"
                    >
                      <span className="text-xl">{format.icon}</span>
                      <span className="text-white">{format.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {showNavigation && onNext && (
            <button
              onClick={onNext}
              disabled={clip.index >= totalClips}
              className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-white transition-colors"
            >
              Next →
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ClipPreview;
