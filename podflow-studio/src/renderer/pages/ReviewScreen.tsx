/**
 * 🟦 SCREEN 3: REVIEW RESULTS
 * 
 * Purpose: Decide what to keep
 * User thought: "These are good."
 * 
 * ALLOWED:
 * - Clip preview
 * - Confidence label
 * - Approve / Reject
 * - Export
 * 
 * NOT ALLOWED:
 * - Editing
 * - Timelines
 * - Fixing clips
 * - Tuning AI
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { 
  type Clip, 
  type Transcript,
  type ClipConfidence,
  getConfidenceLabel,
  CONFIDENCE_COLORS,
  CONFIDENCE_LABELS,
  formatDuration,
} from '../types';
import { CaptionOverlay } from '../components/ui/CaptionOverlay';

interface ReviewScreenProps {
  clips: Clip[];
  transcript: Transcript | null;
  videoPath: string;
  onClipStatusChange: (clipId: string, status: 'pending' | 'accepted' | 'rejected') => void;
  onExportClip: (clip: Clip) => void;
  onExportAll: () => void;
  onBack: () => void;
  captionStyle: 'viral' | 'minimal' | 'bold';
  isExporting?: boolean;
}

export function ReviewScreen({
  clips,
  transcript,
  videoPath,
  onClipStatusChange,
  onExportClip,
  onExportAll,
  onBack,
  captionStyle,
  isExporting = false,
}: ReviewScreenProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [showCaptions, setShowCaptions] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);

  const currentClip = clips[currentIndex];
  const acceptedClips = clips.filter(c => c.status === 'accepted');
  const acceptedCount = acceptedClips.length;

  // Seek video when clip changes
  useEffect(() => {
    if (currentClip && videoRef.current) {
      const startTime = currentClip.startTime + (currentClip.trimStartOffset || 0);
      videoRef.current.currentTime = startTime;
    }
  }, [currentClip]);

  // Update current time for captions
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => {
      setCurrentTime(video.currentTime);
      
      // Loop within clip bounds
      if (currentClip) {
        const endTime = currentClip.endTime + (currentClip.trimEndOffset || 0);
        if (video.currentTime >= endTime) {
          const startTime = currentClip.startTime + (currentClip.trimStartOffset || 0);
          video.currentTime = startTime;
        }
      }
    };

    video.addEventListener('timeupdate', handleTimeUpdate);
    return () => video.removeEventListener('timeupdate', handleTimeUpdate);
  }, [currentClip]);

  // Navigation
  const goToNext = useCallback(() => {
    if (currentIndex < clips.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  }, [currentIndex, clips.length]);

  const goToPrev = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  }, [currentIndex]);

  // Actions
  const handleApprove = useCallback(() => {
    if (currentClip) {
      const newStatus = currentClip.status === 'accepted' ? 'pending' : 'accepted';
      onClipStatusChange(currentClip.id, newStatus);
    }
  }, [currentClip, onClipStatusChange]);

  const handleReject = useCallback(() => {
    if (currentClip) {
      const newStatus = currentClip.status === 'rejected' ? 'pending' : 'rejected';
      onClipStatusChange(currentClip.id, newStatus);
      goToNext();
    }
  }, [currentClip, onClipStatusChange, goToNext]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;

      switch (e.key) {
        case ' ':
          e.preventDefault();
          if (videoRef.current) {
            if (videoRef.current.paused) videoRef.current.play();
            else videoRef.current.pause();
          }
          break;
        case 'a':
        case 'A':
          handleApprove();
          break;
        case 'r':
        case 'R':
          handleReject();
          break;
        case 'ArrowLeft':
          goToPrev();
          break;
        case 'ArrowRight':
          goToNext();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleApprove, handleReject, goToNext, goToPrev]);

  // No clips state (Rule #6: System can say "no")
  if (clips.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-zinc-950 p-8">
        <div className="text-center max-w-md">
          <div className="text-6xl mb-6">🎯</div>
          <h2 className="text-2xl font-bold text-white mb-4">
            No clips found
          </h2>
          <p className="text-zinc-400 mb-2">
            We analyzed your video but didn't find moments that meet our quality bar.
          </p>
          <p className="text-zinc-500 text-sm mb-8">
            This means the content may be better suited for longer-form editing.
          </p>
          <button
            onClick={onBack}
            className="px-6 py-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white transition-colors"
          >
            Try Another Video
          </button>
        </div>
      </div>
    );
  }

  if (!currentClip) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-zinc-950">
        <p className="text-zinc-500">Loading...</p>
      </div>
    );
  }

  const confidence = getConfidenceLabel(currentClip.finalScore);
  const clipStart = currentClip.startTime + (currentClip.trimStartOffset || 0);
  const clipEnd = currentClip.endTime + (currentClip.trimEndOffset || 0);
  const duration = clipEnd - clipStart;

  return (
    <div className="flex flex-col min-h-screen bg-zinc-950 text-white">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
        <button
          onClick={onBack}
          className="p-2 hover:bg-zinc-800 rounded-lg transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
        </button>

        <div className="text-sm text-zinc-500">
          {currentIndex + 1} of {clips.length}
          {acceptedCount > 0 && (
            <span className="ml-2 text-emerald-400">
              • {acceptedCount} approved
            </span>
          )}
        </div>

        {/* Export button */}
        <button
          onClick={onExportAll}
          disabled={acceptedCount === 0 || isExporting}
          className={`
            px-4 py-2 rounded-lg font-medium text-sm transition-colors
            ${acceptedCount > 0 && !isExporting
              ? 'bg-violet-600 hover:bg-violet-500 text-white'
              : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
            }
          `}
        >
          {isExporting ? 'Exporting...' : `Export ${acceptedCount} Clips`}
        </button>
      </div>

      {/* Main content */}
      <div className="flex-1 flex">
        {/* Video Preview */}
        <div className="flex-1 flex flex-col">
          <div className="flex-1 relative bg-black flex items-center justify-center">
            <video
              ref={videoRef}
              src={videoPath}
              className="max-h-full max-w-full"
              autoPlay
              muted
            />
            
            {/* Caption overlay */}
            {showCaptions && transcript && (
              <div className="absolute bottom-8 left-0 right-0 flex justify-center">
                <CaptionOverlay
                  transcript={transcript}
                  currentTime={currentTime}
                  clipStart={clipStart}
                  clipEnd={clipEnd}
                  captionStyle={captionStyle}
                  show={showCaptions}
                />
              </div>
            )}

            {/* Clip info overlay */}
            <div className="absolute top-4 left-4 flex items-center gap-2">
              <span className={`px-2 py-1 rounded text-xs font-medium ${CONFIDENCE_COLORS[confidence]} bg-zinc-900/80`}>
                {CONFIDENCE_LABELS[confidence]}
              </span>
              <span className="px-2 py-1 rounded text-xs text-zinc-300 bg-zinc-900/80">
                {formatDuration(duration)}
              </span>
            </div>
          </div>

          {/* Controls */}
          <div className="p-6 border-t border-zinc-800">
            <div className="flex items-center justify-center gap-4">
              {/* Previous */}
              <button
                onClick={goToPrev}
                disabled={currentIndex === 0}
                className="p-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>

              {/* Reject */}
              <button
                onClick={handleReject}
                className={`
                  px-8 py-4 rounded-xl font-semibold transition-all
                  ${currentClip.status === 'rejected'
                    ? 'bg-red-600 text-white ring-2 ring-red-400'
                    : 'bg-zinc-800 hover:bg-red-600/20 text-zinc-300 hover:text-red-400'
                  }
                `}
              >
                Reject (R)
              </button>

              {/* Approve */}
              <button
                onClick={handleApprove}
                className={`
                  px-8 py-4 rounded-xl font-semibold transition-all
                  ${currentClip.status === 'accepted'
                    ? 'bg-emerald-600 text-white ring-2 ring-emerald-400'
                    : 'bg-zinc-800 hover:bg-emerald-600/20 text-zinc-300 hover:text-emerald-400'
                  }
                `}
              >
                Approve (A)
              </button>

              {/* Next */}
              <button
                onClick={goToNext}
                disabled={currentIndex === clips.length - 1}
                className="p-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>

            {/* Keyboard hints */}
            <p className="text-center text-zinc-600 text-xs mt-4">
              ← → to navigate • Space to play/pause • A to approve • R to reject
            </p>
          </div>
        </div>

        {/* Clip list sidebar */}
        <div className="w-72 border-l border-zinc-800 overflow-y-auto">
          <div className="p-4">
            <h3 className="text-sm font-medium text-zinc-400 mb-3">All Clips</h3>
            <div className="space-y-2">
              {clips.map((clip, index) => {
                const clipConfidence = getConfidenceLabel(clip.finalScore);
                const isActive = index === currentIndex;
                
                return (
                  <button
                    key={clip.id}
                    onClick={() => setCurrentIndex(index)}
                    className={`
                      w-full p-3 rounded-lg text-left transition-colors
                      ${isActive 
                        ? 'bg-violet-600/20 border border-violet-500/50' 
                        : 'bg-zinc-900 hover:bg-zinc-800 border border-transparent'
                      }
                    `}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium">
                        Clip {index + 1}
                      </span>
                      <StatusBadge status={clip.status} />
                    </div>
                    <div className="flex items-center gap-2 text-xs text-zinc-500">
                      <span className={CONFIDENCE_COLORS[clipConfidence]}>
                        {CONFIDENCE_LABELS[clipConfidence]}
                      </span>
                      <span>•</span>
                      <span>{formatDuration(clip.duration)}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Footer branding */}
      <div className="absolute bottom-4 left-4 text-zinc-700 text-sm">
        Powered by SeeZee Studios
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: 'pending' | 'accepted' | 'rejected' }) {
  if (status === 'accepted') {
    return (
      <span className="px-2 py-0.5 rounded text-xs bg-emerald-600/20 text-emerald-400">
        ✓
      </span>
    );
  }
  if (status === 'rejected') {
    return (
      <span className="px-2 py-0.5 rounded text-xs bg-red-600/20 text-red-400">
        ✗
      </span>
    );
  }
  return null;
}
