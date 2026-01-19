import { ipcMain, app } from 'electron';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const getProjectsDir = () => path.join(app.getPath('userData'), 'projects');

ipcMain.handle('save-clip-project', async (_event, data: {
  jobId: string;
  clipId: string;
  payload: unknown;
}) => {
  try {
    const dir = path.join(getProjectsDir(), data.jobId);
    fs.mkdirSync(dir, { recursive: true });
    const filePath = path.join(dir, `${data.clipId}.json`);
    fs.writeFileSync(filePath, JSON.stringify(data.payload, null, 2));
    return { success: true, path: filePath };
  } catch (error) {
    return { success: false, error: String(error) };
  }
});

ipcMain.handle('load-clip-project', async (_event, data: { jobId: string; clipId: string }) => {
  try {
    const filePath = path.join(getProjectsDir(), data.jobId, `${data.clipId}.json`);
    if (!fs.existsSync(filePath)) {
      return { success: true, payload: null };
    }
    const raw = fs.readFileSync(filePath, 'utf-8');
    const payload = JSON.parse(raw);
    return { success: true, payload };
  } catch (error) {
    return { success: false, error: String(error) };
  }
});

// QA Check handler - runs client-side checks for now
// Can be extended to call Python QA module for more complex checks
interface QACheckData {
  clips: Array<{
    id: string;
    startTime: number;
    endTime: number;
    title?: string;
  }>;
  deadSpaces: Array<{
    id: string;
    startTime: number;
    endTime: number;
    duration: number;
    remove: boolean;
  }>;
  transcript?: {
    words?: Array<{
      word: string;
      start: number;
      end: number;
    }>;
  };
  duration: number;
}

interface QAIssue {
  id: string;
  type: string;
  severity: 'error' | 'warning' | 'info';
  timestamp?: number;
  message: string;
  autoFixable: boolean;
}

ipcMain.handle('run-qa-checks', async (_event, data: QACheckData) => {
  try {
    const issues: QAIssue[] = [];
    let issueId = 0;

    // Check 1: Long silence gaps (> 3s silence that isn't marked for removal)
    const keptDeadSpaces = data.deadSpaces.filter(ds => !ds.remove);
    for (const ds of keptDeadSpaces) {
      if (ds.duration > 3) {
        issueId++;
        issues.push({
          id: `qa_${issueId}`,
          type: 'silence',
          severity: ds.duration > 5 ? 'warning' : 'info',
          timestamp: ds.startTime,
          message: `Long silence (${ds.duration.toFixed(1)}s) not marked for removal`,
          autoFixable: true,
        });
      }
    }

    // Check 2: Mid-word cuts (if transcript available)
    if (data.transcript?.words && data.transcript.words.length > 0) {
      const words = data.transcript.words;
      
      for (const clip of data.clips) {
        // Check start time - are we cutting in the middle of a word?
        for (const word of words) {
          // Check if clip start is in the middle of a word
          if (clip.startTime > word.start && clip.startTime < word.end) {
            issueId++;
            issues.push({
              id: `qa_${issueId}`,
              type: 'mid-word-cut',
              severity: 'error',
              timestamp: clip.startTime,
              message: `Clip "${clip.title || clip.id}" starts mid-word ("${word.word}")`,
              autoFixable: true,
            });
            break;
          }
          
          // Check if clip end is in the middle of a word
          if (clip.endTime > word.start && clip.endTime < word.end) {
            issueId++;
            issues.push({
              id: `qa_${issueId}`,
              type: 'mid-word-cut',
              severity: 'error',
              timestamp: clip.endTime,
              message: `Clip "${clip.title || clip.id}" ends mid-word ("${word.word}")`,
              autoFixable: true,
            });
            break;
          }
        }
      }
    }

    // Check 3: Very short clips (< 5s)
    for (const clip of data.clips) {
      const duration = clip.endTime - clip.startTime;
      if (duration < 5) {
        issueId++;
        issues.push({
          id: `qa_${issueId}`,
          type: 'duration',
          severity: 'warning',
          timestamp: clip.startTime,
          message: `Clip "${clip.title || clip.id}" is very short (${duration.toFixed(1)}s)`,
          autoFixable: false,
        });
      }
    }

    // Check 4: Clips that extend beyond video duration
    for (const clip of data.clips) {
      if (clip.endTime > data.duration) {
        issueId++;
        issues.push({
          id: `qa_${issueId}`,
          type: 'duration',
          severity: 'error',
          timestamp: clip.endTime,
          message: `Clip "${clip.title || clip.id}" extends beyond video duration`,
          autoFixable: true,
        });
      }
    }

    const errorCount = issues.filter(i => i.severity === 'error').length;
    const warningCount = issues.filter(i => i.severity === 'warning').length;
    const infoCount = issues.filter(i => i.severity === 'info').length;

    return {
      success: true,
      passed: errorCount === 0,
      issues,
      errorCount,
      warningCount,
      infoCount,
    };
  } catch (error) {
    return { success: false, error: String(error), issues: [] };
  }
});
