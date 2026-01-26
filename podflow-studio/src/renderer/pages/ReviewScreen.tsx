/**
 * Screen 3: Review
 * User reviews and selects clips to export
 * 
 * Rule #2: 3 SCREENS ONLY
 * This screen is the final decision point before export
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import type { FC } from 'react';
import type { Clip, Transcript } from '../types';
import { CaptionOverlay } from '../components/ui/CaptionOverlay';
import { CaptionStyleSelector } from '../components/ui/CaptionStyleSelector';
import { ClipTypeSelector } from '../components/ui/ClipTypeSelector';

interface ReviewScreenProps {
  clips: Clip[];
  transcript: Transcript | null;
  videoPath: string;
  onClipStatusChange: (clipId: string, status: 'pending' | 'approved' | 'rejected') => void;
  onExportClip: (clip: Clip) => void;
  onExportAll: () => void;
  onBack: () => void;
  captionStyle: 'viral' | 'minimal' | 'bold';
  isExporting?: boolean;
}

export const ReviewScreen: FC<ReviewScreenProps> = ({ 
  clips, 
  transcript, 
  videoPath,
  onClipStatusChange,
  onExportClip,
  onExportAll,
  onBack,
  captionStyle: initialCaptionStyle,
  isExporting = false,
}) => {
  const [currentClipIndex, setCurrentClipIndex] = useState(0);
  const [selectedMood, setSelectedMood] = useState<string>('all');
  const [showCaptions, setShowCaptions] = useState(true);
  const [captionStyle, setCaptionStyle] = useState<'viral' | 'minimal' | 'bold'>(initialCaptionStyle);
  const [currentTime, setCurrentTime] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Filter clips by mood
  const filteredClips = selectedMood === 'all' 
    ? clips 
    : clips.filter(c => c.mood === selectedMood);

  const currentClip = filteredClips[currentClipIndex];
  const acceptedClips = clips.filter(c => c.status === 'approved');

  // Navigation
  const goToNextClip = useCallback(() => {
    if (currentClipIndex < filteredClips.length - 1) {
      setCurrentClipIndex(i => i + 1);
    }
  }, [currentClipIndex, filteredClips.length]);

  const goToPrevClip = useCallback(() => {
    if (currentClipIndex > 0) {
      setCurrentClipIndex(i => i - 1);
    }
  }, [currentClipIndex]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') goToNextClip();
      if (e.key === 'ArrowLeft') goToPrevClip();
      if (e.key === 'a' || e.key === 'A') {
        if (currentClip) onClipStatusChange(currentClip.id, 'approved');
      }
      if (e.key === 'r' || e.key === 'R') {
        if (currentClip) onClipStatusChange(currentClip.id, 'rejected');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [goToNextClip, goToPrevClip, currentClip, onClipStatusChange]);

  // Seek to clip start when clip changes
  useEffect(() => {
    if (videoRef.current && currentClip) {
      const startTime = currentClip.startTime + (currentClip.trimStartOffset || 0);
      videoRef.current.currentTime = startTime;
      videoRef.current.play().catch(() => {});
    }
  }, [currentClip?.id]);

  // Handle no clips
  if (clips.length === 0) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-zinc-950 text-white">
        <div className="text-6xl mb-4">🔍</div>
        <h2 className="text-2xl font-bold mb-2">No clips detected</h2>
        <p className="text-zinc-400 mb-6">Try adjusting detection settings</p>
        <button
          onClick={onBack}
          className="px-6 py-3 bg-purple-600 hover:bg-purple-500 rounded-lg font-medium transition-colors"
        >
          ← Back to Upload
        </button>
      </div>
    );
  }

  // Handle no filtered clips
  if (filteredClips.length === 0) {
    return (
      <div className="h-screen w-screen flex flex-col bg-zinc-950 text-white">
        <div className="p-4 border-b border-zinc-800 flex items-center gap-4">
          <button onClick={onBack} className="p-2 hover:bg-zinc-800 rounded-lg">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </button>
          <ClipTypeSelector selectedMood={selectedMood} onMoodChange={setSelectedMood} />
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="text-6xl mb-4">🔍</div>
            <h3 className="text-xl font-semibold mb-2">No clips match this filter</h3>
            <button
              onClick={() => setSelectedMood('all')}
              className="px-6 py-3 bg-purple-600 hover:bg-purple-500 rounded-lg font-medium"
            >
              View All Clips
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!currentClip) return null;

  const effectiveStart = currentClip.startTime + (currentClip.trimStartOffset || 0);
  const effectiveEnd = currentClip.endTime + (currentClip.trimEndOffset || 0);
  const duration = effectiveEnd - effectiveStart;

  return (
    <div className="h-screen w-screen flex flex-col bg-zinc-950 text-white">
      {/* Top Bar */}
      <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-2 hover:bg-zinc-800 rounded-lg transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </button>
          <ClipTypeSelector selectedMood={selectedMood} onMoodChange={(mood) => {
            setSelectedMood(mood);
            setCurrentClipIndex(0);
          }} />
          <CaptionStyleSelector selectedStyle={captionStyle} onStyleChange={setCaptionStyle} />
        </div>
        <div className="text-sm text-zinc-400">
          {filteredClips.length} clips {selectedMood !== 'all' && `(${clips.length} total)`}
        </div>
      </div>

      {/* Video Preview */}
      <div className="flex-1 flex items-center justify-center bg-black p-4 relative min-h-0">
        <video
          ref={videoRef}
          src={videoPath ? `file://${videoPath}` : undefined}
          className="max-h-full max-w-full object-contain"
          controls={false}
          onTimeUpdate={(e) => {
            const time = e.currentTarget.currentTime;
            setCurrentTime(time);
            if (time >= effectiveEnd && videoRef.current) {
              videoRef.current.currentTime = effectiveStart;
            }
          }}
          onClick={() => {
            if (videoRef.current) {
              if (videoRef.current.paused) videoRef.current.play();
              else videoRef.current.pause();
            }
          }}
        />
        {showCaptions && (
          <CaptionOverlay
            transcript={transcript}
            currentTime={currentTime}
            clipStart={effectiveStart}
            clipEnd={effectiveEnd}
            captionStyle={captionStyle}
            show={showCaptions}
          />
        )}
      </div>

      {/* Clip Info & Controls */}
      <div className="p-6 bg-zinc-900 border-t border-zinc-800">
        <div className="max-w-2xl mx-auto space-y-4">
          {/* Clip Counter & Info */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <p className="text-sm font-semibold text-purple-400">
                Clip {currentClipIndex + 1} of {filteredClips.length}
              </p>
              {currentClip.mood && (
                <span className="px-3 py-1 text-xs font-medium bg-purple-600/20 text-purple-400 rounded-full">
                  {currentClip.mood}
                </span>
              )}
              {currentClip.status === 'approved' && (
                <span className="px-2 py-1 text-xs bg-green-600/20 text-green-400 rounded">✓ Accepted</span>
              )}
              {currentClip.status === 'rejected' && (
                <span className="px-2 py-1 text-xs bg-red-600/20 text-red-400 rounded">✗ Rejected</span>
              )}
            </div>
            <p className="text-sm text-zinc-400">
              {Math.floor(duration)}s • Score: {Math.round(currentClip.finalScore || 0)}
            </p>
          </div>

          {/* Title */}
          {currentClip.title && (
            <p className="font-semibold text-lg">{currentClip.title}</p>
          )}

          {/* Caption Toggle */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showCaptions}
              onChange={(e) => setShowCaptions(e.target.checked)}
              className="w-4 h-4 accent-purple-600"
            />
            <span className="text-sm">Show Captions</span>
          </label>

          {/* Accept/Reject Buttons */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => onClipStatusChange(currentClip.id, 'approved')}
              className={`flex-1 py-3 px-4 rounded-lg font-semibold transition-all ${
                currentClip.status === 'approved'
                  ? 'bg-green-600 text-white'
                  : 'bg-zinc-800 text-white hover:bg-green-600'
              }`}
            >
              {currentClip.status === 'approved' ? '✓ Accepted' : '✓ Accept (A)'}
            </button>
            <button
              onClick={() => onClipStatusChange(currentClip.id, 'rejected')}
              className={`flex-1 py-3 px-4 rounded-lg font-semibold transition-all ${
                currentClip.status === 'rejected'
                  ? 'bg-red-600 text-white'
                  : 'bg-zinc-800 text-white hover:bg-red-600'
              }`}
            >
              {currentClip.status === 'rejected' ? '✗ Rejected' : '✗ Reject (R)'}
            </button>
          </div>

          {/* Export Buttons */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => onExportClip(currentClip)}
              disabled={isExporting}
              className="flex-1 py-3 px-4 bg-purple-600 text-white rounded-lg font-semibold hover:bg-purple-500 disabled:opacity-50 transition-colors"
            >
              Export This Clip
            </button>
            {acceptedClips.length > 0 && (
              <button
                onClick={onExportAll}
                disabled={isExporting}
                className="flex-1 py-3 px-4 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-500 disabled:opacity-50 transition-colors"
              >
                Export All ({acceptedClips.length})
              </button>
            )}
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-center gap-4 pt-4 border-t border-zinc-800">
            <button
              onClick={goToPrevClip}
              disabled={currentClipIndex === 0}
              className="px-6 py-2 bg-zinc-800 rounded-lg hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              ← Prev
            </button>
            <span className="text-sm text-zinc-400">
              {currentClipIndex + 1} / {filteredClips.length}
            </span>
            <button
              onClick={goToNextClip}
              disabled={currentClipIndex === filteredClips.length - 1}
              className="px-6 py-2 bg-zinc-800 rounded-lg hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Next →
            </button>
          </div>
          <p className="text-xs text-zinc-500 text-center">Use arrow keys to navigate • A to accept • R to reject</p>
        </div>
      </div>
    </div>
  );
};
