// Project type for editing workflow
export type ProjectType = 'short-form' | 'long-form' | 'long-form-clips';

// Camera input for multi-cam editing
export interface CameraInput {
  id: string;
  name: string;
  filePath: string;
  speakerName?: string;
  isMain: boolean;
}

// Editing preferences set during project setup
export interface EditingPreferences {
  projectType: ProjectType;
  bRollEnabled: boolean;
  referenceVideoUrl: string;
  editingPrompt: string;
  pacingStyle: 'fast' | 'moderate' | 'slow' | 'match-reference';
  cameras: CameraInput[];
}

// Speaker segment from diarization
export interface SpeakerSegment {
  speakerId: string;
  speakerName?: string;
  startTime: number;
  endTime: number;
  confidence: number;
}

// Camera cut decision
export interface CameraCut {
  id: string;
  cameraId: string;
  startTime: number;
  endTime: number;
  reason: 'speaker-change' | 'reaction-shot' | 'variety' | 'manual';
}

// Audio track for mixing
export interface AudioTrack {
  id: string;
  type: 'main' | 'broll' | 'sfx' | 'music';
  filePath?: string;
  fileName?: string;
  startTime: number;
  endTime: number;
  duration?: number;
  volume: number; // 0-100, where 100 = 0dB
  fadeIn?: number;
  fadeOut?: number;
  muted?: boolean;
  solo?: boolean; // When true, only solo tracks play
  locked?: boolean;
  waveformData?: number[];
  // Audio ducking - auto-lower when speech detected
  duckWhenSpeech?: {
    enabled: boolean;
    targetVolume: number; // % to reduce to
    fadeTime: number; // seconds for fade
  };
}

// Timeline marker (Premiere Pro-style)
export interface TimelineMarker {
  id: string;
  time: number;
  duration?: number; // For range markers
  name: string;
  comment?: string;
  color: 'green' | 'red' | 'purple' | 'orange' | 'yellow' | 'blue' | 'cyan' | 'pink';
  type: 'comment' | 'chapter' | 'ad-read' | 'key-moment' | 'segmentation';
}

// Clip color label for organization
export type ClipColorLabel = 'red' | 'orange' | 'yellow' | 'green' | 'cyan' | 'blue' | 'purple' | 'pink' | 'none';

// Timeline item group for nesting
export interface TimelineGroup {
  id: string;
  name: string;
  color: string;
  itemIds: string[]; // IDs of clips/audio tracks in this group
  collapsed?: boolean;
  locked?: boolean;
}

// Edit history entry for undo/redo
export interface HistoryEntry {
  id: string;
  timestamp: number;
  action: string;
  description: string;
  canUndo: boolean;
  canRedo: boolean;
}

// Speed/Duration settings for clips
export interface ClipSpeed {
  speed: number; // 0.25x to 4x
  reverse?: boolean;
  ripple?: boolean; // Adjust adjacent clips
  frameBlending?: boolean;
}

// Applied effect on a clip/track
export interface AppliedEffect {
  id: string;
  effectId: string;
  category: 'ai' | 'video' | 'audio' | 'text';
  name: string;
  enabled: boolean;
  parameters?: Record<string, number | string | boolean>;
}

// Timeline track configuration
export interface TimelineTrack {
  id: string;
  name: string;
  type: 'video' | 'audio' | 'broll' | 'music' | 'text';
  visible: boolean;
  locked: boolean;
  height: number;
  muted?: boolean;
  solo?: boolean; // Premiere Pro-style: only solo tracks are audible
  targetedForEdit?: boolean; // Enable/disable track for editing operations
}

// QA check result
export interface QACheck {
  id: string;
  type: 'audio-level' | 'mid-word-cut' | 'speaker-visibility' | 'silence' | 'sync';
  severity: 'error' | 'warning' | 'info';
  timestamp?: number;
  message: string;
  autoFixable: boolean;
  fixed?: boolean;
}

// Clip detected by algorithm
export interface Clip {
  id: string;
  startTime: number;
  endTime: number;
  duration: number;
  
  // Algorithm detection
  pattern: 'payoff' | 'monologue' | 'laughter' | 'debate';
  patternLabel: string;
  description: string;
  algorithmScore: number;
  hookStrength: number;
  hookMultiplier: number;
  
  // AI Enhancement (optional)
  transcript?: string;
  isComplete?: boolean;
  startsClean?: boolean;
  endsClean?: boolean;
  title?: string;
  hookText?: string;
  category?: string;
  sentiment?: 'positive' | 'negative' | 'neutral';
  aiQualityMultiplier?: number;
  completeThought?: boolean;
  flags?: string[];
  qualityMultiplier?: number;
  
  // Final score
  finalScore: number;

  // Clipworthiness breakdown (optional)
  clipworthiness?: {
    hardGates: Record<string, boolean>;
    softScores: Record<string, number>;
    weights: Record<string, number>;
    finalScore: number;
  };
  
  // User adjustments
  trimStartOffset: number;
  trimEndOffset: number;
  status: 'pending' | 'accepted' | 'rejected';
  
  // Editing state
  groupId?: string; // Group this clip belongs to
  locked?: boolean;
  appliedEffects?: AppliedEffect[];
  colorLabel?: ClipColorLabel;
  speed?: ClipSpeed;
  opacity?: number; // 0-100
  volume?: number; // 0-100, for audio control
  audioDucking?: {
    enabled: boolean;
    targetVolume: number; // % to reduce to (e.g., 20 = reduce to 20%)
    fadeTime: number; // seconds for fade in/out
  };
}

// Dead space detected for auto-edit
export interface DeadSpace {
  id: string;
  startTime: number;
  endTime: number;
  duration: number;
  remove: boolean; // User toggle: true = remove, false = keep
}

// Transcript from Whisper
export interface Transcript {
  text: string;
  words: Array<{
    word: string;
    start: number;
    end: number;
  }>;
  segments: Array<{
    text: string;
    start: number;
    end: number;
  }>;
}

// Project info
export interface Project {
  filePath: string;
  fileName: string;
  duration: number;
  size: number;
  // Video metadata
  resolution?: string;
  width?: number;
  height?: number;
  fps?: number;
  thumbnailPath?: string;
  bitrate?: number;
}

// Detection settings
export interface DetectionSettings {
  targetCount: number;
  minDuration: number;
  maxDuration: number;
  skipIntro: number;
  skipOutro: number;
  useAiEnhancement: boolean;
  openaiApiKey?: string;
  // AI Provider settings (for chat assistant)
  anthropicApiKey?: string;
  geminiApiKey?: string;
  ollamaHost?: string;
  debug?: boolean;
}

// Transition types for clip compilation
export type TransitionType = 'none' | 'crossfade' | 'dip-to-black';

export interface TransitionSettings {
  type: TransitionType;
  duration: number; // seconds (0.5 - 2.0)
}

// Export settings
export interface ExportSettings {
  format: 'mp4' | 'mov';
  mode: 'fast' | 'accurate';
  exportClips: boolean;
  exportClipsCompilation: boolean;
  exportFullVideo: boolean;
  transition: TransitionSettings;
}

// Premiere Pro / NLE export settings
export type NLEExportFormat = 'fcp-xml' | 'edl' | 'markers-csv' | 'premiere-markers';

export interface NLEExportSettings {
  format: NLEExportFormat;
  includeClips: boolean;
  includeDeadSpaces: boolean;
  sequenceName?: string;
  frameRate: number;
  dropFrame: boolean;
}

// Premiere Pro marker colors
export type PremiereMarkerColor = 
  | 'green' | 'red' | 'purple' | 'orange' | 'yellow' 
  | 'white' | 'blue' | 'cyan' | 'pink' | 'lavender';

export interface PremiereMarker {
  name: string;
  comment: string;
  startTime: number;
  duration: number;
  color: PremiereMarkerColor;
  markerType: 'comment' | 'chapter' | 'segmentation' | 'weblink';
}

// Detection progress
export interface DetectionProgress {
  percent: number;
  message: string;
}

export interface AiCostEstimate {
  whisperCost: number;
  gptCost: number;
  total: number;
}

// Utility functions
export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

export function formatTimestamp(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 100);
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function getScoreLabel(score: number): string {
  if (score >= 90) return 'High viral potential';
  if (score >= 80) return 'Strong clip';
  if (score >= 70) return 'Good clip';
  if (score >= 60) return 'Decent clip';
  return 'Review manually';
}

export function getScoreColor(score: number): string {
  if (score >= 90) return 'text-emerald-400';
  if (score >= 80) return 'text-violet-400';
  if (score >= 70) return 'text-blue-400';
  if (score >= 60) return 'text-yellow-400';
  return 'text-zinc-400';
}

export function estimateAiCost(durationSeconds: number, targetCount: number): AiCostEstimate {
  const minutes = durationSeconds / 60;
  const whisperCost = minutes * 0.006;
  const gptCost = targetCount * 0.002;
  const total = whisperCost + gptCost;
  return { whisperCost, gptCost, total };
}

export function formatCost(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

// Media Library Types
export type MediaLibraryItemType = 'video' | 'audio' | 'broll' | 'music' | 'sfx';

export interface MediaLibraryItem {
  id: string;
  name: string;
  fileName: string;
  originalPath: string; // Where the file was imported from
  libraryPath: string; // Path in the media library
  type: MediaLibraryItemType;
  size: number;
  duration?: number;
  resolution?: string;
  width?: number;
  height?: number;
  fps?: number;
  thumbnailPath?: string;
  addedAt: string;
  tags?: string[];
}

export interface MediaLibraryStats {
  totalItems: number;
  totalSize: number;
  countByType: Record<MediaLibraryItemType, number>;
  libraryPath: string;
  createdAt: string;
  updatedAt: string;
}
