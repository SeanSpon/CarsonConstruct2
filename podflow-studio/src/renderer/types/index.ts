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
  startTime: number;
  endTime: number;
  volume: number; // 0-100, where 100 = 0dB
  fadeIn?: number;
  fadeOut?: number;
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
  debug?: boolean;
}

// Export settings
export interface ExportSettings {
  format: 'mp4' | 'mov';
  mode: 'fast' | 'accurate';
  exportClips: boolean;
  exportFullVideo: boolean;
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
