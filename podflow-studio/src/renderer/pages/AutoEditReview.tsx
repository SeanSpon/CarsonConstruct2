/**
 * Auto-Edit Review Screen
 * 
 * Shows a preview of the automatically cleaned video.
 * Dead spaces are marked on a timeline.
 * User can preview and export ONE cleaned video.
 */

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import type { FC } from 'react';
import type { Clip, Transcript, DeadSpace } from '../types';
import { CaptionOverlay } from '../components/ui/CaptionOverlay';

interface AutoEditReviewProps {
  clips: Clip[];           // Keep sections (the good parts)
  deadSpaces: DeadSpace[]; // Sections to remove
  transcript: Transcript | null;
  videoPath: string;
  videoDuration: number;
  onBack: () => void;
  onExport: () => void;
  isExporting?: boolean;
}

// Represents a segment in the edited video
interface EditSegment {
  originalStart: number;
  originalEnd: number;
  editedStart: number; // Position in the final edited video
  editedEnd: number;
  isKept: boolean;
}

export const AutoEditReview: FC<AutoEditReviewProps> = ({
  clips,
  deadSpaces,
  transcript,
  videoPath,
  videoDuration,
  onBack,
  onExport,
  isExporting = false,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showCaptions, setShowCaptions] = useState(true);
  
  // Build the edit timeline: merge clips into continuous "keep" segments
  const editTimeline = useMemo(() => {
    // If no dead spaces detected, keep the whole video
    if (!deadSpaces || deadSpaces.length === 0) {
      return [{
        originalStart: 0,
        originalEnd: videoDuration,
        editedStart: 0,
        editedEnd: videoDuration,
        isKept: true,
      }];
    }
    
    // Sort dead spaces by start time
    const sortedDeadSpaces = [...deadSpaces].sort((a, b) => a.startTime - b.startTime);
    
    // Build keep segments (inverse of dead spaces)
    const segments: EditSegment[] = [];
    let lastEnd = 0;
    let editedTime = 0;
    
    for (const dead of sortedDeadSpaces) {
      // Add kept segment before this dead space
      if (dead.startTime > lastEnd) {
        const duration = dead.startTime - lastEnd;
        segments.push({
          originalStart: lastEnd,
          originalEnd: dead.startTime,
          editedStart: editedTime,
          editedEnd: editedTime + duration,
          isKept: true,
        });
        editedTime += duration;
      }
      lastEnd = dead.endTime;
    }
    
    // Add final segment after last dead space
    if (lastEnd < videoDuration) {
      const duration = videoDuration - lastEnd;
      segments.push({
        originalStart: lastEnd,
        originalEnd: videoDuration,
        editedStart: editedTime,
        editedEnd: editedTime + duration,
        isKept: true,
      });
    }
    
    return segments;
  }, [deadSpaces, videoDuration]);
  
  // Calculate total edited duration
  const editedDuration = useMemo(() => {
    return editTimeline.reduce((sum, seg) => sum + (seg.editedEnd - seg.editedStart), 0);
  }, [editTimeline]);
  
  // Time saved
  const timeSaved = videoDuration - editedDuration;
  const percentSaved = videoDuration > 0 ? (timeSaved / videoDuration) * 100 : 0;
  
  // Find which segment we're in based on original video time
  const findSegmentAtTime = useCallback((time: number) => {
    return editTimeline.find(seg => 
      time >= seg.originalStart && time < seg.originalEnd
    );
  }, [editTimeline]);
  
  // Skip dead spaces during playback
  useEffect(() => {
    if (!videoRef.current || !isPlaying) return;
    
    const checkAndSkip = () => {
      const time = videoRef.current?.currentTime || 0;
      const segment = findSegmentAtTime(time);
      
      // If we're in a dead space, skip to next kept segment
      if (!segment) {
        const nextKept = editTimeline.find(seg => seg.originalStart > time);
        if (nextKept && videoRef.current) {
          videoRef.current.currentTime = nextKept.originalStart;
        }
      }
    };
    
    const interval = setInterval(checkAndSkip, 100);
    return () => clearInterval(interval);
  }, [isPlaying, editTimeline, findSegmentAtTime]);
  
  const handlePlayPause = () => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play();
      setIsPlaying(true);
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  };
  
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };
  
  return (
    <div className="h-screen w-screen flex flex-col bg-zinc-950 text-white">
      {/* Info Banner - No dead spaces detected */}
      {(!deadSpaces || deadSpaces.length === 0) && (
        <div className="bg-amber-900/50 border-b border-amber-700 px-4 py-2 text-amber-200 text-sm flex items-center gap-2">
          <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>No dead air detected in this video. The audio is continuous with minimal silence.</span>
        </div>
      )}
      
      {/* Info Banner - No transcript */}
      {(!transcript || !transcript.segments || transcript.segments.length === 0) && (
        <div className="bg-blue-900/50 border-b border-blue-700 px-4 py-2 text-blue-200 text-sm flex items-center gap-2">
          <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          <span>No captions available. Add an OpenAI API key in Settings for auto-transcription.</span>
        </div>
      )}
      
      {/* Top Bar */}
      <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button 
            onClick={onBack} 
            className="p-2 hover:bg-zinc-800 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </button>
          <h1 className="text-xl font-semibold">Auto-Edit Preview</h1>
        </div>
        
        {/* Stats */}
        <div className="flex items-center gap-6 text-sm">
          <div className="text-zinc-400">
            Original: <span className="text-white font-medium">{formatTime(videoDuration)}</span>
          </div>
          <div className="text-zinc-400">
            Edited: <span className="text-green-400 font-medium">{formatTime(editedDuration)}</span>
          </div>
          <div className="text-zinc-400">
            Removed: <span className="text-red-400 font-medium">{formatTime(timeSaved)} ({percentSaved.toFixed(0)}%)</span>
          </div>
        </div>
      </div>

      {/* Video Preview */}
      <div className="flex-1 flex items-center justify-center bg-black p-4 relative min-h-0">
        <video
          ref={videoRef}
          src={videoPath ? `file://${videoPath}` : undefined}
          className="max-h-full max-w-full object-contain rounded-lg"
          controls={false}
          onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onClick={handlePlayPause}
        />
        
        {showCaptions && transcript && (
          <CaptionOverlay
            transcript={transcript}
            currentTime={currentTime}
            clipStart={0}
            clipEnd={videoDuration}
            captionStyle="minimal"
            show={showCaptions}
          />
        )}
        
        {/* Play overlay */}
        {!isPlaying && (
          <div 
            className="absolute inset-0 flex items-center justify-center bg-black/30 cursor-pointer"
            onClick={handlePlayPause}
          >
            <div className="w-20 h-20 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-sm">
              <svg className="w-10 h-10 text-white ml-1" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z"/>
              </svg>
            </div>
          </div>
        )}
      </div>

      {/* Timeline */}
      <div className="p-4 bg-zinc-900 border-t border-zinc-800">
        <div className="max-w-4xl mx-auto space-y-4">
          {/* Timeline visualization */}
          <div className="relative h-12 bg-zinc-800 rounded-lg overflow-hidden">
            {/* Kept segments (green) */}
            {editTimeline.map((seg, i) => (
              <div
                key={i}
                className="absolute h-full bg-green-600/60"
                style={{
                  left: `${(seg.originalStart / videoDuration) * 100}%`,
                  width: `${((seg.originalEnd - seg.originalStart) / videoDuration) * 100}%`,
                }}
              />
            ))}
            
            {/* Dead spaces (red) - shown as gaps */}
            {deadSpaces?.map((dead, i) => (
              <div
                key={`dead-${i}`}
                className="absolute h-full bg-red-600/40"
                style={{
                  left: `${(dead.startTime / videoDuration) * 100}%`,
                  width: `${((dead.endTime - dead.startTime) / videoDuration) * 100}%`,
                }}
              />
            ))}
            
            {/* Current position */}
            <div 
              className="absolute h-full w-0.5 bg-white"
              style={{ left: `${(currentTime / videoDuration) * 100}%` }}
            />
          </div>
          
          {/* Legend */}
          <div className="flex items-center justify-center gap-6 text-xs text-zinc-400">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-green-600/60 rounded" />
              <span>Keeping</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-red-600/40 rounded" />
              <span>Removing (dead air)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Controls */}
      <div className="p-6 bg-zinc-900 border-t border-zinc-800">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={showCaptions}
                onChange={(e) => setShowCaptions(e.target.checked)}
                className="w-4 h-4 rounded"
              />
              Show captions
            </label>
          </div>
          
          <button
            onClick={onExport}
            disabled={isExporting}
            className={`px-8 py-3 rounded-lg font-semibold text-lg transition-colors ${
              isExporting
                ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                : 'bg-green-600 hover:bg-green-500 text-white'
            }`}
          >
            {isExporting ? 'Exporting...' : '✓ Export Cleaned Video'}
          </button>
        </div>
      </div>
    </div>
  );
};
