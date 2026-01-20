// Project type for editing workflow
export type ProjectType = 'short-form' | 'long-form' | 'long-form-clips';

// Camera input for multi-cam editing (simplified)
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
  volume: number;
  fadeIn?: number;
  fadeOut?: number;
  muted?: boolean;
  solo?: boolean;
  locked?: boolean;
  waveformData?: number[];
}

// Timeline marker
export interface TimelineMarker {
  id: string;
  time: number;
  duration?: number;
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
  itemIds: string[];
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
  speed: number;
  reverse?: boolean;
  ripple?: boolean;
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

// QA check result (simplified)
export interface QACheck {
  id: string;
  type: 'audio-level' | 'mid-word-cut' | 'speaker-visibility' | 'silence' | 'sync';
  severity: 'error' | 'warning' | 'info';
  timestamp?: number;
  message: string;
  autoFixable: boolean;
  fixed?: boolean;
}

// Platform types for virality scoring
export type SocialPlatform = 'youtube' | 'instagram' | 'tiktok';

// MVP Candidate types
export type MVPCandidateType = 'energy_spike' | 'silence_to_spike' | 'laughter_like';

// MVP Score Breakdown - the new deterministic scoring formula
export interface MVPScoreBreakdown {
  energy_lift: number;      // 0-35 pts: median dB lift vs previous 20s
  peak_strength: number;    // 0-25 pts: peak dB delta from baseline
  speech_density: number;   // 0-20 pts: transcript coverage ratio
  contrast_bonus: number;   // 0-15 pts: silence_to_spike only
  length_penalty: number;   // -10 to 0: clips outside 15-30s range
  speech_ratio?: number;    // Debug: actual speech ratio
  lift_db?: number;         // Debug: actual dB lift
}

// MVP Source Candidate info
export interface MVPSourceCandidate {
  type: MVPCandidateType;
  t_peak: number;
  meta?: {
    baseline_db?: number;
    peak_db?: number;
    sustained_s?: number;
    silence_len?: number;
    burst_count?: number;
  };
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
  
  // MVP Scoring (new deterministic formula)
  score_breakdown?: MVPScoreBreakdown;
  source_candidate?: MVPSourceCandidate;
  snapped?: boolean;
  snap_reason?: string;
  
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

  // Platform Virality Scoring
  meanVirality?: number;
  bestPlatform?: SocialPlatform;
  platformScores?: Record<SocialPlatform, number>;

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
  groupId?: string;
  locked?: boolean;
  appliedEffects?: AppliedEffect[];
  colorLabel?: ClipColorLabel;
  speed?: ClipSpeed;
  opacity?: number;
  volume?: number;
  audioDucking?: {
    enabled: boolean;
    targetVolume: number;
    fadeTime: number;
  };
}

// Dead space detected for auto-edit
export interface DeadSpace {
  id: string;
  startTime: number;
  endTime: number;
  duration: number;
  remove: boolean;
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
  debug?: boolean;
  
  // MVP Mode settings
  mvpMode?: boolean;
  jobDir?: string;
  forceRerun?: boolean;
}

// MVP Detection Parameters (deterministic pipeline)
export interface MVPDetectionSettings {
  // Feature extraction
  hopS: number;                    // 0.10s default (10 fps)
  rmsWindowS: number;              // 0.40s default
  baselineWindowS: number;         // 20.0s default
  silenceThresholdDb: number;      // -35 dB default
  
  // Detection thresholds
  spikeThresholdDb: number;        // +8 dB over baseline
  spikeSustainS: number;           // 0.7s minimum
  silenceRunS: number;             // 1.2s before contrast
  contrastWindowS: number;         // 2.0s after silence
  laughterZRms: number;            // 1.5 z-score
  laughterGapS: number;            // 0.3s max gap
  laughterMinS: number;            // 1.0s min duration
  
  // Clip selection
  clipLengths: number[];           // [12, 18, 24, 35]
  minClipS: number;                // 8s
  maxClipS: number;                // 45s
  snapWindowS: number;             // 2.0s boundary snap
  startPaddingS: number;           // 0.6s
  endPaddingS: number;             // 0.8s
  
  // De-duplication
  iouThreshold: number;            // 0.6
  topN: number;                    // 10
}

// Default MVP detection settings
export const DEFAULT_MVP_DETECTION_SETTINGS: MVPDetectionSettings = {
  hopS: 0.10,
  rmsWindowS: 0.40,
  baselineWindowS: 20.0,
  silenceThresholdDb: -35,
  spikeThresholdDb: 8.0,
  spikeSustainS: 0.7,
  silenceRunS: 1.2,
  contrastWindowS: 2.0,
  laughterZRms: 1.5,
  laughterGapS: 0.3,
  laughterMinS: 1.0,
  clipLengths: [12, 18, 24, 35],
  minClipS: 8,
  maxClipS: 45,
  snapWindowS: 2.0,
  startPaddingS: 0.6,
  endPaddingS: 0.8,
  iouThreshold: 0.6,
  topN: 10,
};

// MVP Export Settings
export interface MVPExportSettings {
  format: 'mp4' | 'mov';
  vertical: boolean;
  targetWidth: number;
  targetHeight: number;
  burnCaptions: boolean;
  captionStyle: {
    fontName: string;
    fontSize: number;
    outline: number;
    shadow: number;
    maxChars: number;
    maxLines: number;
  };
}

// Default MVP export settings (1080x1920 vertical)
export const DEFAULT_MVP_EXPORT_SETTINGS: MVPExportSettings = {
  format: 'mp4',
  vertical: true,
  targetWidth: 1080,
  targetHeight: 1920,
  burnCaptions: true,
  captionStyle: {
    fontName: 'Arial Black',
    fontSize: 72,
    outline: 4,
    shadow: 2,
    maxChars: 32,
    maxLines: 2,
  },
};

// Transition types for clip compilation
export type TransitionType = 'none' | 'crossfade' | 'dip-to-black';

export interface TransitionSettings {
  type: TransitionType;
  duration: number;
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

// Vertical Reel Export Settings (MVP focus)
export type ReelPlatform = 'tiktok' | 'instagram' | 'youtube-shorts';
export type ReelCaptionStyle = 'viral' | 'minimal' | 'bold';
export type ReelCaptionPosition = 'bottom' | 'center';

export interface ReelCaptionSettings {
  enabled: boolean;
  style: ReelCaptionStyle;
  fontSize: number;
  fontColor: string;
  highlightColor: string;
  position: ReelCaptionPosition;
}

export interface ReelExportSettings {
  platform: ReelPlatform;
  width: number;
  height: number;
  captions: ReelCaptionSettings;
}

// Platform presets for vertical export
export const REEL_PLATFORM_PRESETS: Record<ReelPlatform, { maxDuration: number; bitrate: number }> = {
  'tiktok': { maxDuration: 180, bitrate: 8 },
  'instagram': { maxDuration: 90, bitrate: 8 },
  'youtube-shorts': { maxDuration: 60, bitrate: 10 },
};

export const DEFAULT_REEL_CAPTION_SETTINGS: ReelCaptionSettings = {
  enabled: true,
  style: 'viral',
  fontSize: 56,
  fontColor: '#FFFFFF',
  highlightColor: '#00FF00',
  position: 'bottom',
};

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
