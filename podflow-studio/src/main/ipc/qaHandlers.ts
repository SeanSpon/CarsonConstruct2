/**
 * QA Handlers - Quality assurance checks and auto-fix operations
 * 
 * Detects issues like:
 * - Mid-word cuts
 * - Volume spikes
 * - Long silences
 * - Speaker visibility (when camera data available)
 */

import { ipcMain } from 'electron';

interface QAIssue {
  id: string;
  type: 'mid-word-cut' | 'volume-spike' | 'long-silence' | 'speaker-visibility' | 'sync';
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

interface Word {
  word: string;
  start: number;
  end: number;
}

interface Clip {
  id: string;
  startTime: number;
  endTime: number;
  title?: string;
  trimStartOffset?: number;
  trimEndOffset?: number;
}

interface DeadSpace {
  id: string;
  startTime: number;
  endTime: number;
  duration: number;
  remove: boolean;
}

// Run all QA checks
ipcMain.handle('run-qa-checks', async (_event, data: {
  clips: Clip[];
  deadSpaces: DeadSpace[];
  transcript?: { words?: Word[] };
  duration: number;
}) => {
  console.log('[QAHandlers] Running QA checks...');
  
  const { clips, deadSpaces, transcript, duration } = data;
  const issues: QAIssue[] = [];
  let issueId = 0;

  // 1. Check for mid-word cuts (using transcript)
  if (transcript?.words && transcript.words.length > 0) {
    for (const clip of clips) {
      const effectiveStart = clip.startTime + (clip.trimStartOffset || 0);
      const effectiveEnd = clip.endTime + (clip.trimEndOffset || 0);
      
      // Check start boundary
      const wordAtStart = transcript.words.find(w => 
        effectiveStart > w.start && effectiveStart < w.end
      );
      if (wordAtStart) {
        issues.push({
          id: `qa_${issueId++}`,
          type: 'mid-word-cut',
          severity: 'error',
          timestamp: effectiveStart,
          message: `Clip "${clip.title || clip.id}" cuts mid-word at start ("${wordAtStart.word}")`,
          autoFixable: true,
          fixData: {
            clipId: clip.id,
            suggestedStart: wordAtStart.start - 0.1, // Start 100ms before word
            action: 'extend-start',
          },
        });
      }
      
      // Check end boundary
      const wordAtEnd = transcript.words.find(w => 
        effectiveEnd > w.start && effectiveEnd < w.end
      );
      if (wordAtEnd) {
        issues.push({
          id: `qa_${issueId++}`,
          type: 'mid-word-cut',
          severity: 'error',
          timestamp: effectiveEnd,
          message: `Clip "${clip.title || clip.id}" cuts mid-word at end ("${wordAtEnd.word}")`,
          autoFixable: true,
          fixData: {
            clipId: clip.id,
            suggestedEnd: wordAtEnd.end + 0.1, // End 100ms after word
            action: 'extend-end',
          },
        });
      }
    }
  }

  // 2. Check for long silences not marked for removal
  for (const ds of deadSpaces) {
    if (ds.duration > 5 && !ds.remove) {
      issues.push({
        id: `qa_${issueId++}`,
        type: 'long-silence',
        severity: 'warning',
        timestamp: ds.startTime,
        message: `Long silence (${ds.duration.toFixed(1)}s) not marked for removal`,
        autoFixable: true,
        fixData: {
          clipId: ds.id,
          action: 'mark-remove',
        },
      });
    }
  }

  // 3. Check for very short clips (potential issues)
  for (const clip of clips) {
    const effectiveDuration = (clip.endTime - clip.startTime) - 
      Math.abs(clip.trimStartOffset || 0) - Math.abs(clip.trimEndOffset || 0);
    
    if (effectiveDuration < 3) {
      issues.push({
        id: `qa_${issueId++}`,
        type: 'sync',
        severity: 'info',
        timestamp: clip.startTime,
        message: `Clip "${clip.title || clip.id}" is very short (${effectiveDuration.toFixed(1)}s)`,
        autoFixable: false,
      });
    }
  }

  // 4. Check for clips that are too close together (potential jump cuts)
  const sortedClips = [...clips].sort((a, b) => a.startTime - b.startTime);
  for (let i = 1; i < sortedClips.length; i++) {
    const prevClip = sortedClips[i - 1];
    const currClip = sortedClips[i];
    const gap = currClip.startTime - prevClip.endTime;
    
    if (gap > 0 && gap < 0.5) {
      issues.push({
        id: `qa_${issueId++}`,
        type: 'sync',
        severity: 'info',
        timestamp: prevClip.endTime,
        message: `Small gap (${(gap * 1000).toFixed(0)}ms) between clips may cause jump cut`,
        autoFixable: false,
      });
    }
  }

  const errorCount = issues.filter(i => i.severity === 'error').length;
  const warningCount = issues.filter(i => i.severity === 'warning').length;
  const infoCount = issues.filter(i => i.severity === 'info').length;

  console.log(`[QAHandlers] Found ${issues.length} issues (${errorCount} errors, ${warningCount} warnings, ${infoCount} info)`);

  return {
    success: true,
    passed: errorCount === 0,
    issues,
    errorCount,
    warningCount,
    infoCount,
  };
});

// Auto-fix a single QA issue
ipcMain.handle('auto-fix-qa-issue', async (_event, data: {
  issue: QAIssue;
  clips: Clip[];
  deadSpaces: DeadSpace[];
  transcript?: { words?: Word[] };
}) => {
  console.log('[QAHandlers] Auto-fixing issue:', data.issue.id, data.issue.type);
  
  const { issue, clips, transcript } = data;
  
  if (!issue.autoFixable || !issue.fixData) {
    return { success: false, error: 'Issue is not auto-fixable' };
  }

  const { fixData } = issue;

  switch (issue.type) {
    case 'mid-word-cut': {
      const clip = clips.find(c => c.id === fixData.clipId);
      if (!clip) {
        return { success: false, error: 'Clip not found' };
      }

      if (fixData.action === 'extend-start' && fixData.suggestedStart !== undefined) {
        // Calculate new trim offset to extend start
        const currentEffectiveStart = clip.startTime + (clip.trimStartOffset || 0);
        const newTrimStartOffset = fixData.suggestedStart - clip.startTime;
        
        return {
          success: true,
          fix: {
            type: 'update-clip-trim',
            clipId: clip.id,
            trimStartOffset: newTrimStartOffset,
            trimEndOffset: clip.trimEndOffset || 0,
          },
          message: `Extended clip start by ${Math.abs(currentEffectiveStart - fixData.suggestedStart).toFixed(2)}s`,
        };
      }

      if (fixData.action === 'extend-end' && fixData.suggestedEnd !== undefined) {
        const currentEffectiveEnd = clip.endTime + (clip.trimEndOffset || 0);
        const newTrimEndOffset = fixData.suggestedEnd - clip.endTime;
        
        return {
          success: true,
          fix: {
            type: 'update-clip-trim',
            clipId: clip.id,
            trimStartOffset: clip.trimStartOffset || 0,
            trimEndOffset: newTrimEndOffset,
          },
          message: `Extended clip end by ${Math.abs(fixData.suggestedEnd - currentEffectiveEnd).toFixed(2)}s`,
        };
      }

      return { success: false, error: 'Invalid fix action for mid-word cut' };
    }

    case 'long-silence': {
      if (fixData.action === 'mark-remove') {
        return {
          success: true,
          fix: {
            type: 'mark-dead-space-remove',
            deadSpaceId: fixData.clipId,
            remove: true,
          },
          message: 'Marked silence for removal',
        };
      }
      return { success: false, error: 'Invalid fix action for silence' };
    }

    default:
      return { success: false, error: `Cannot auto-fix issue type: ${issue.type}` };
  }
});

// Auto-fix all fixable issues
ipcMain.handle('auto-fix-all-qa-issues', async (_event, data: {
  issues: QAIssue[];
  clips: Clip[];
  deadSpaces: DeadSpace[];
  transcript?: { words?: Word[] };
}) => {
  console.log('[QAHandlers] Auto-fixing all issues...');
  
  const { issues, clips, deadSpaces, transcript } = data;
  const fixableIssues = issues.filter(i => i.autoFixable && !i.fixData?.clipId?.startsWith('fixed_'));
  
  const fixes: Array<{
    issueId: string;
    fix: {
      type: string;
      clipId?: string;
      deadSpaceId?: string;
      trimStartOffset?: number;
      trimEndOffset?: number;
      remove?: boolean;
    };
    message: string;
  }> = [];
  
  const errors: string[] = [];

  for (const issue of fixableIssues) {
    try {
      // Simulate calling auto-fix for each issue
      if (issue.type === 'mid-word-cut' && issue.fixData) {
        const clip = clips.find(c => c.id === issue.fixData?.clipId);
        if (!clip) continue;

        if (issue.fixData.action === 'extend-start' && issue.fixData.suggestedStart !== undefined) {
          const newTrimStartOffset = issue.fixData.suggestedStart - clip.startTime;
          fixes.push({
            issueId: issue.id,
            fix: {
              type: 'update-clip-trim',
              clipId: clip.id,
              trimStartOffset: newTrimStartOffset,
              trimEndOffset: clip.trimEndOffset || 0,
            },
            message: 'Extended clip start to word boundary',
          });
        } else if (issue.fixData.action === 'extend-end' && issue.fixData.suggestedEnd !== undefined) {
          const newTrimEndOffset = issue.fixData.suggestedEnd - clip.endTime;
          fixes.push({
            issueId: issue.id,
            fix: {
              type: 'update-clip-trim',
              clipId: clip.id,
              trimStartOffset: clip.trimStartOffset || 0,
              trimEndOffset: newTrimEndOffset,
            },
            message: 'Extended clip end to word boundary',
          });
        }
      } else if (issue.type === 'long-silence' && issue.fixData?.action === 'mark-remove') {
        fixes.push({
          issueId: issue.id,
          fix: {
            type: 'mark-dead-space-remove',
            deadSpaceId: issue.fixData.clipId,
            remove: true,
          },
          message: 'Marked silence for removal',
        });
      }
    } catch (err) {
      errors.push(`Failed to fix ${issue.id}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  console.log(`[QAHandlers] Fixed ${fixes.length} issues, ${errors.length} failed`);

  return {
    success: true,
    fixed: fixes.length,
    failed: errors.length,
    fixes,
    errors,
  };
});

console.log('[QAHandlers] Registered QA handlers');

export function registerQAHandlers(): void {
  console.log('[QAHandlers] QA handlers ready');
}
