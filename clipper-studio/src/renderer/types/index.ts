// Two patterns. Done right.
export type ViralPattern = 'payoff' | 'monologue';

export type ClipStatus = 'pending' | 'accepted' | 'rejected';

export interface DetectedClip {
  id: string;
  startTime: number;      // seconds
  endTime: number;        // seconds
  score: number;          // 0-100 final viral score (with hook multiplier applied)
  pattern: ViralPattern;  // 'payoff' or 'monologue'
  patternLabel: string;   // "Payoff Moment" or "Energy Monologue"
  description: string;    // e.g. "2.3s pause → energy spike"
  hookStrength: number;   // 0-100 (how strong is the first 3 sec)
  status: ClipStatus;
  trimStartOffset: number;
  trimEndOffset: number;
}

export interface FileInfo {
  path: string;
  name: string;
  size: number;
  duration: number;
  valid: boolean;
}

export interface DetectionProgress {
  step: string;           // 'extracting' | 'features' | 'payoff' | 'monologue' | 'scoring'
  progress: number;       // 0-100
  message: string;        // "Detecting payoff moments..."
}

export interface ExportProgress {
  current: number;
  total: number;
  clipId: string;
}

// Pattern info for UI display
export const PATTERN_INFO: Record<ViralPattern, { label: string; description: string; emoji: string }> = {
  payoff: {
    label: 'Payoff Moment',
    description: 'Silence → punchline/reveal',
    emoji: '🎯',
  },
  monologue: {
    label: 'Energy Monologue',
    description: 'Sustained high-energy rant',
    emoji: '🔥',
  },
};

// Helper to format seconds to MM:SS
export function formatTime(seconds: number): string {
  if (seconds < 0) seconds = 0;
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Helper to format file size
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

// Helper to format duration
export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  if (hours > 0) {
    return `${hours}h ${mins}m ${secs}s`;
  }
  return `${mins}m ${secs}s`;
}
