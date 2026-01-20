import { ipcMain } from 'electron';

console.log('[QAHandlers] Loading QA handlers module...');

interface QAClip {
  id: string;
  startTime: number;
  endTime: number;
  title?: string;
  trimStartOffset?: number;
  trimEndOffset?: number;
}

interface QADeadSpace {
  id: string;
  startTime: number;
  endTime: number;
  duration: number;
  remove: boolean;
}

interface QAIssue {
  id: string;
  type: string;
  severity: 'error' | 'warning' | 'info';
  timestamp?: number;
  message: string;
  autoFixable: boolean;
  fixData?: {
    clipId?: string;
    suggestedStart?: number;
    suggestedEnd?: number;
    action?: string;
  };
}

// Run QA checks on clips
ipcMain.handle('run-qa-checks', async (_event, data: {
  clips: QAClip[];
  deadSpaces: QADeadSpace[];
  transcript?: { words?: Array<{ word: string; start: number; end: number }> };
  duration: number;
}) => {
  try {
    const issues: QAIssue[] = [];
    let errorCount = 0;
    let warningCount = 0;
    let infoCount = 0;
    
    // Check for overlapping clips
    const sortedClips = [...data.clips].sort((a, b) => a.startTime - b.startTime);
    for (let i = 0; i < sortedClips.length - 1; i++) {
      const current = sortedClips[i];
      const next = sortedClips[i + 1];
      if (current.endTime > next.startTime) {
        issues.push({
          id: `overlap_${current.id}_${next.id}`,
          type: 'overlap',
          severity: 'error',
          timestamp: current.startTime,
          message: `Clips "${current.title || current.id}" and "${next.title || next.id}" overlap`,
          autoFixable: false,
        });
        errorCount++;
      }
    }
    
    // Check for very short clips
    for (const clip of data.clips) {
      const duration = clip.endTime - clip.startTime;
      if (duration < 5) {
        issues.push({
          id: `short_${clip.id}`,
          type: 'short-clip',
          severity: 'warning',
          timestamp: clip.startTime,
          message: `Clip "${clip.title || clip.id}" is very short (${duration.toFixed(1)}s)`,
          autoFixable: false,
        });
        warningCount++;
      }
    }
    
    // Check for clips near video boundaries
    for (const clip of data.clips) {
      if (clip.startTime < 2) {
        issues.push({
          id: `boundary_start_${clip.id}`,
          type: 'boundary',
          severity: 'info',
          timestamp: clip.startTime,
          message: `Clip "${clip.title || clip.id}" starts at the very beginning`,
          autoFixable: false,
        });
        infoCount++;
      }
      if (clip.endTime > data.duration - 2) {
        issues.push({
          id: `boundary_end_${clip.id}`,
          type: 'boundary',
          severity: 'info',
          timestamp: clip.endTime,
          message: `Clip "${clip.title || clip.id}" ends at the very end`,
          autoFixable: false,
        });
        infoCount++;
      }
    }
    
    return {
      success: true,
      passed: errorCount === 0,
      issues,
      errorCount,
      warningCount,
      infoCount,
    };
  } catch (err) {
    return {
      success: false,
      error: String(err),
    };
  }
});

// Auto-fix a single QA issue
ipcMain.handle('auto-fix-qa-issue', async (_event, data: {
  issue: QAIssue;
  clips: QAClip[];
  deadSpaces: QADeadSpace[];
  transcript?: { words?: Array<{ word: string; start: number; end: number }> };
}) => {
  try {
    // Most issues aren't auto-fixable in this simple implementation
    return {
      success: false,
      error: 'This issue cannot be automatically fixed',
    };
  } catch (err) {
    return {
      success: false,
      error: String(err),
    };
  }
});

// Auto-fix all fixable QA issues
ipcMain.handle('auto-fix-all-qa-issues', async (_event, data: {
  issues: QAIssue[];
  clips: QAClip[];
  deadSpaces: QADeadSpace[];
  transcript?: { words?: Array<{ word: string; start: number; end: number }> };
}) => {
  return {
    success: true,
    fixed: 0,
    failed: 0,
    fixes: [],
    errors: [],
  };
});

console.log('[QAHandlers] Registered QA handlers');
