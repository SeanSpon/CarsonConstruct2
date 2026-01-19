import { memo, useState, useCallback, useRef, useEffect } from 'react';
import { 
  Play, 
  Pause, 
  Download, 
  Smartphone, 
  Monitor, 
  Square,
  Type,
  Music,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Check,
  RefreshCw,
  Scissors,
  Volume2,
  ZoomIn,
} from 'lucide-react';
import { useStore } from '../../stores/store';
import type { Clip } from '../../types';

interface ClipEditorProps {
  clip: Clip;
  sourceFilePath: string;
  onExport: (clip: Clip, options: ClipExportOptions) => void;
  onNext?: () => void;
  onPrevious?: () => void;
  hasNext?: boolean;
  hasPrevious?: boolean;
  className?: string;
}

export interface ClipExportOptions {
  aspectRatio: '16:9' | '9:16' | '1:1' | '4:5';
  captionsEnabled: boolean;
  captionStyle: 'modern' | 'minimal' | 'bold' | 'animated';
  musicEnabled: boolean;
  musicPath?: string;
  musicVolume: number;
  zoomEffects: boolean;
  transitionIn: 'none' | 'fade' | 'zoom';
  transitionOut: 'none' | 'fade' | 'zoom';
}

const aspectRatioOptions = [
  { value: '16:9', label: 'YouTube', icon: <Monitor className="w-4 h-4" />, dimensions: '1920x1080' },
  { value: '9:16', label: 'TikTok/Reels', icon: <Smartphone className="w-4 h-4" />, dimensions: '1080x1920' },
  { value: '1:1', label: 'Instagram', icon: <Square className="w-4 h-4" />, dimensions: '1080x1080' },
  { value: '4:5', label: 'IG Feed', icon: <Square className="w-4 h-4" />, dimensions: '1080x1350' },
];

const captionStyles = [
  { value: 'modern', label: 'Modern', description: 'Clean, sans-serif' },
  { value: 'minimal', label: 'Minimal', description: 'Subtle, lowercase' },
  { value: 'bold', label: 'Bold', description: 'Large, impactful' },
  { value: 'animated', label: 'Animated', description: 'Word-by-word' },
];

function ClipEditor({
  clip,
  sourceFilePath,
  onExport,
  onNext,
  onPrevious,
  hasNext,
  hasPrevious,
  className,
}: ClipEditorProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [isExporting, setIsExporting] = useState(false);
  
  // Export options state
  const [aspectRatio, setAspectRatio] = useState<ClipExportOptions['aspectRatio']>('9:16');
  const [captionsEnabled, setCaptionsEnabled] = useState(true);
  const [captionStyle, setCaptionStyle] = useState<ClipExportOptions['captionStyle']>('modern');
  const [musicEnabled, setMusicEnabled] = useState(false);
  const [musicVolume, setMusicVolume] = useState(30);
  const [zoomEffects, setZoomEffects] = useState(false);
  const [transitionIn, setTransitionIn] = useState<'none' | 'fade' | 'zoom'>('none');
  const [transitionOut, setTransitionOut] = useState<'none' | 'fade' | 'zoom'>('fade');

  // Derived values
  const clipDuration = clip.endTime - clip.startTime + clip.trimStartOffset + clip.trimEndOffset;
  const actualStart = clip.startTime + clip.trimStartOffset;
  const actualEnd = clip.endTime + clip.trimEndOffset;

  // Set video to clip start on mount
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.currentTime = actualStart;
    }
  }, [clip.id, actualStart]);

  // Handle play/pause
  const handlePlayPause = useCallback(() => {
    if (!videoRef.current) return;
    
    if (isPlaying) {
      videoRef.current.pause();
    } else {
      // Ensure we start from clip start
      if (videoRef.current.currentTime < actualStart || videoRef.current.currentTime > actualEnd) {
        videoRef.current.currentTime = actualStart;
      }
      videoRef.current.play();
    }
    setIsPlaying(!isPlaying);
  }, [isPlaying, actualStart, actualEnd]);

  // Handle time update
  const handleTimeUpdate = useCallback(() => {
    if (!videoRef.current) return;
    
    const time = videoRef.current.currentTime;
    setCurrentTime(time);
    
    // Loop within clip bounds
    if (time >= actualEnd) {
      videoRef.current.currentTime = actualStart;
      videoRef.current.pause();
      setIsPlaying(false);
    }
  }, [actualStart, actualEnd]);

  // Handle export
  const handleExport = useCallback(() => {
    setIsExporting(true);
    
    const options: ClipExportOptions = {
      aspectRatio,
      captionsEnabled,
      captionStyle,
      musicEnabled,
      musicVolume,
      zoomEffects,
      transitionIn,
      transitionOut,
    };
    
    onExport(clip, options);
    
    // Simulate export completion
    setTimeout(() => setIsExporting(false), 1000);
  }, [clip, onExport, aspectRatio, captionsEnabled, captionStyle, musicEnabled, musicVolume, zoomEffects, transitionIn, transitionOut]);

  // Format time
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className={`flex flex-col h-full bg-sz-bg ${className || ''}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-sz-border">
        <div className="flex items-center gap-4">
          <button
            onClick={onPrevious}
            disabled={!hasPrevious}
            className="p-2 rounded-lg hover:bg-sz-bg-secondary disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="w-5 h-5 text-sz-text" />
          </button>
          
          <div>
            <h2 className="font-semibold text-sz-text">{clip.title || `Clip ${clip.id}`}</h2>
            <p className="text-xs text-sz-text-secondary">
              {formatTime(clipDuration)} • {clip.pattern}
            </p>
          </div>
          
          <button
            onClick={onNext}
            disabled={!hasNext}
            className="p-2 rounded-lg hover:bg-sz-bg-secondary disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronRight className="w-5 h-5 text-sz-text" />
          </button>
        </div>
        
        <button
          onClick={handleExport}
          disabled={isExporting}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-sz-accent text-white hover:bg-sz-accent-hover disabled:opacity-50 transition-colors"
        >
          {isExporting ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : (
            <Download className="w-4 h-4" />
          )}
          Export Clip
        </button>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Video Preview */}
        <div className="flex-1 flex flex-col p-4">
          <div 
            className="relative flex-1 bg-black rounded-xl overflow-hidden flex items-center justify-center"
            style={{
              aspectRatio: aspectRatio.replace(':', '/'),
              maxHeight: '100%',
            }}
          >
            <video
              ref={videoRef}
              src={`file://${sourceFilePath}`}
              className="max-w-full max-h-full object-contain"
              onTimeUpdate={handleTimeUpdate}
              onEnded={() => setIsPlaying(false)}
            />
            
            {/* Play overlay */}
            <button
              onClick={handlePlayPause}
              className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 hover:opacity-100 transition-opacity"
            >
              <div className="w-16 h-16 rounded-full bg-white/90 flex items-center justify-center">
                {isPlaying ? (
                  <Pause className="w-8 h-8 text-sz-bg" />
                ) : (
                  <Play className="w-8 h-8 text-sz-bg ml-1" />
                )}
              </div>
            </button>
            
            {/* Caption preview */}
            {captionsEnabled && clip.transcript && (
              <div className="absolute bottom-4 left-4 right-4 text-center">
                <div className={`inline-block px-4 py-2 rounded-lg ${
                  captionStyle === 'bold' 
                    ? 'bg-black text-white text-xl font-bold'
                    : captionStyle === 'minimal'
                    ? 'text-white/90 text-sm lowercase'
                    : 'bg-black/70 text-white text-base'
                }`}>
                  {clip.hookText || clip.transcript.slice(0, 50)}...
                </div>
              </div>
            )}
          </div>
          
          {/* Playback controls */}
          <div className="flex items-center gap-4 mt-4">
            <button
              onClick={handlePlayPause}
              className="p-2 rounded-lg bg-sz-bg-secondary hover:bg-sz-bg-tertiary transition-colors"
            >
              {isPlaying ? (
                <Pause className="w-5 h-5 text-sz-text" />
              ) : (
                <Play className="w-5 h-5 text-sz-text" />
              )}
            </button>
            
            <div className="flex-1">
              <div className="h-1 bg-sz-bg-tertiary rounded-full overflow-hidden">
                <div 
                  className="h-full bg-sz-accent transition-all"
                  style={{
                    width: `${((currentTime - actualStart) / clipDuration) * 100}%`
                  }}
                />
              </div>
            </div>
            
            <span className="text-sm text-sz-text-secondary font-mono">
              {formatTime(Math.max(0, currentTime - actualStart))} / {formatTime(clipDuration)}
            </span>
          </div>
        </div>

        {/* Options Panel */}
        <div className="w-80 border-l border-sz-border bg-sz-bg-secondary overflow-y-auto">
          <div className="p-4 space-y-6">
            {/* Aspect Ratio */}
            <div>
              <label className="text-sm font-medium text-sz-text mb-3 block">
                Aspect Ratio
              </label>
              <div className="grid grid-cols-2 gap-2">
                {aspectRatioOptions.map(option => (
                  <button
                    key={option.value}
                    onClick={() => setAspectRatio(option.value as any)}
                    className={`p-3 rounded-lg border-2 text-left transition-colors ${
                      aspectRatio === option.value
                        ? 'border-sz-accent bg-sz-accent/10'
                        : 'border-sz-border bg-sz-bg-tertiary hover:border-sz-border-light'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      {option.icon}
                      <span className="text-sm font-medium text-sz-text">{option.label}</span>
                    </div>
                    <span className="text-xs text-sz-text-muted">{option.dimensions}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Captions */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="flex items-center gap-2 text-sm font-medium text-sz-text">
                  <Type className="w-4 h-4" />
                  Captions
                </label>
                <button
                  onClick={() => setCaptionsEnabled(!captionsEnabled)}
                  className={`relative w-10 h-5 rounded-full transition-colors ${
                    captionsEnabled ? 'bg-sz-accent' : 'bg-sz-bg-tertiary'
                  }`}
                >
                  <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                    captionsEnabled ? 'left-5' : 'left-0.5'
                  }`} />
                </button>
              </div>
              
              {captionsEnabled && (
                <div className="grid grid-cols-2 gap-2">
                  {captionStyles.map(style => (
                    <button
                      key={style.value}
                      onClick={() => setCaptionStyle(style.value as any)}
                      className={`p-2 rounded-lg border text-left transition-colors ${
                        captionStyle === style.value
                          ? 'border-sz-accent bg-sz-accent/10'
                          : 'border-sz-border hover:border-sz-border-light'
                      }`}
                    >
                      <span className="text-xs font-medium text-sz-text block">{style.label}</span>
                      <span className="text-xs text-sz-text-muted">{style.description}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Music */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="flex items-center gap-2 text-sm font-medium text-sz-text">
                  <Music className="w-4 h-4" />
                  Background Music
                </label>
                <button
                  onClick={() => setMusicEnabled(!musicEnabled)}
                  className={`relative w-10 h-5 rounded-full transition-colors ${
                    musicEnabled ? 'bg-sz-accent' : 'bg-sz-bg-tertiary'
                  }`}
                >
                  <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                    musicEnabled ? 'left-5' : 'left-0.5'
                  }`} />
                </button>
              </div>
              
              {musicEnabled && (
                <div className="space-y-3">
                  <button className="w-full p-3 rounded-lg border border-dashed border-sz-border hover:border-sz-accent text-sm text-sz-text-secondary hover:text-sz-text transition-colors">
                    + Select Music File
                  </button>
                  
                  <div className="flex items-center gap-3">
                    <Volume2 className="w-4 h-4 text-sz-text-secondary" />
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={musicVolume}
                      onChange={(e) => setMusicVolume(Number(e.target.value))}
                      className="flex-1"
                    />
                    <span className="text-xs text-sz-text-muted w-8">{musicVolume}%</span>
                  </div>
                </div>
              )}
            </div>

            {/* Effects */}
            <div>
              <label className="text-sm font-medium text-sz-text mb-3 block">
                Effects
              </label>
              <div className="space-y-2">
                <button
                  onClick={() => setZoomEffects(!zoomEffects)}
                  className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                    zoomEffects
                      ? 'border-sz-accent bg-sz-accent/10'
                      : 'border-sz-border hover:border-sz-border-light'
                  }`}
                >
                  <ZoomIn className="w-4 h-4 text-sz-text-secondary" />
                  <span className="flex-1 text-sm text-sz-text text-left">Zoom Effects</span>
                  {zoomEffects && <Check className="w-4 h-4 text-sz-accent" />}
                </button>
              </div>
            </div>

            {/* Transitions */}
            <div>
              <label className="text-sm font-medium text-sz-text mb-3 block">
                Transitions
              </label>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-xs text-sz-text-muted block mb-2">In</span>
                  <select
                    value={transitionIn}
                    onChange={(e) => setTransitionIn(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-lg bg-sz-bg-tertiary border border-sz-border text-sm text-sz-text"
                  >
                    <option value="none">None</option>
                    <option value="fade">Fade In</option>
                    <option value="zoom">Zoom In</option>
                  </select>
                </div>
                <div>
                  <span className="text-xs text-sz-text-muted block mb-2">Out</span>
                  <select
                    value={transitionOut}
                    onChange={(e) => setTransitionOut(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-lg bg-sz-bg-tertiary border border-sz-border text-sm text-sz-text"
                  >
                    <option value="none">None</option>
                    <option value="fade">Fade Out</option>
                    <option value="zoom">Zoom Out</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Score info */}
            <div className="p-3 rounded-lg bg-sz-bg-tertiary">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-sz-text-muted">Viral Score</span>
                <span className="text-sm font-bold text-emerald-400">
                  {Math.round(clip.finalScore)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-sz-text-muted">Hook Strength</span>
                <span className="text-sm font-medium text-sz-text">
                  {Math.round(clip.hookStrength)}%
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default memo(ClipEditor);
