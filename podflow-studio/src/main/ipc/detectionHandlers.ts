import { ipcMain, app } from 'electron';
import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import { getMainWindow } from '../window';

// Store active detection processes
const activeProcesses = new Map<string, ChildProcess>();
const progressState = new Map<string, { lastSentAt: number; lastProgress: number; lastMessage: string }>();
const PROGRESS_MIN_INTERVAL_MS = 100;
const PROGRESS_MIN_DELTA = 1;

interface DetectionSettings {
  targetCount: number;
  minDuration: number;
  maxDuration: number;
  skipIntro: number;
  skipOutro: number;
  useAiEnhancement: boolean;
  openaiApiKey?: string;
  debug?: boolean;
}

// Start detection process
ipcMain.handle('start-detection', async (_event, data: {
  projectId: string;
  filePath: string;
  settings: DetectionSettings;
}) => {
  const { projectId, filePath, settings } = data;
  const win = getMainWindow();
  
  if (!win) {
    return { success: false, error: 'Window not found' };
  }

  // Cancel any existing detection for this project
  if (activeProcesses.has(projectId)) {
    activeProcesses.get(projectId)?.kill();
    activeProcesses.delete(projectId);
  }

  // Get the Python script path
  const appPath = app.getAppPath();
  const isDev = !app.isPackaged;
  const pythonDir = isDev
    ? path.join(appPath, 'src/python')
    : path.join(process.resourcesPath, 'python');
  
  const pythonScript = path.join(pythonDir, 'detector.py');
  
  // Prepare settings JSON
  const settingsJson = JSON.stringify({
    target_count: settings.targetCount,
    min_duration: settings.minDuration,
    max_duration: settings.maxDuration,
    skip_intro: settings.skipIntro,
    skip_outro: settings.skipOutro,
    use_ai_enhancement: settings.useAiEnhancement,
    openai_api_key: settings.openaiApiKey || process.env.OPENAI_API_KEY || '',
    debug: settings.debug || false,
  });

  // Spawn Python process
  const pythonProcess = spawn('python', [pythonScript, filePath, settingsJson], {
    cwd: pythonDir,
    env: {
      ...process.env,
      PYTHONUNBUFFERED: '1',
    },
  });

  activeProcesses.set(projectId, pythonProcess);

  // Handle stdout - progress and results
  pythonProcess.stdout.on('data', (data) => {
    const lines = data.toString().split('\n').filter((line: string) => line.trim());
    
    for (const line of lines) {
      if (line.startsWith('PROGRESS:')) {
        const parts = line.substring(9).split(':');
        const progress = parseInt(parts[0], 10);
        const message = parts.slice(1).join(':').trim();

        const now = Date.now();
        const state = progressState.get(projectId) || { lastSentAt: 0, lastProgress: 0, lastMessage: '' };
        const progressDelta = Math.abs(progress - state.lastProgress);
        const messageChanged = message !== state.lastMessage;
        const shouldSend =
          messageChanged ||
          progressDelta >= PROGRESS_MIN_DELTA ||
          now - state.lastSentAt >= PROGRESS_MIN_INTERVAL_MS;

        if (shouldSend) {
          win.webContents.send('detection-progress', {
            projectId,
            progress,
            message,
          });
          progressState.set(projectId, {
            lastSentAt: now,
            lastProgress: progress,
            lastMessage: message,
          });
        }
      } else if (line.startsWith('RESULT:')) {
        try {
          const result = JSON.parse(line.substring(7));
          win.webContents.send('detection-complete', {
            projectId,
            clips: result.clips || [],
            deadSpaces: result.deadSpaces || [],
            transcript: result.transcript || null,
          });
        } catch (e) {
          console.error('Failed to parse detection result:', e);
          win.webContents.send('detection-error', {
            projectId,
            error: 'Failed to parse detection results',
          });
        }
      }
    }
  });

  // Handle stderr - errors
  pythonProcess.stderr.on('data', (data) => {
    const errorMessage = data.toString();
    console.error('Python stderr:', errorMessage);
    
    // Only send critical errors, not warnings
    if (errorMessage.includes('Error') || errorMessage.includes('Exception')) {
      win.webContents.send('detection-error', {
        projectId,
        error: errorMessage,
      });
    }
  });

  // Handle process exit
  pythonProcess.on('close', (code) => {
    activeProcesses.delete(projectId);
    progressState.delete(projectId);
    
    if (code !== 0 && code !== null) {
      win.webContents.send('detection-error', {
        projectId,
        error: `Detection process exited with code ${code}`,
      });
    }
  });

  pythonProcess.on('error', (err) => {
    activeProcesses.delete(projectId);
    win.webContents.send('detection-error', {
      projectId,
      error: `Failed to start Python: ${err.message}. Make sure Python is installed.`,
    });
  });

  return { success: true };
});

// Cancel detection
ipcMain.handle('cancel-detection', async (_event, projectId: string) => {
  const process = activeProcesses.get(projectId);
  if (process) {
    process.kill();
    activeProcesses.delete(projectId);
    return { success: true };
  }
  return { success: false, error: 'No active detection found' };
});
