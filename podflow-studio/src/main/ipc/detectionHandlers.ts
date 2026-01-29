import { ipcMain, app } from 'electron';
import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { getMainWindow } from '../window';

// Get ffmpeg path from ffmpeg-static
let ffmpegPath: string;
try {
  ffmpegPath = require('ffmpeg-static') as string;
  console.log('[Detection] Loaded ffmpeg-static:', ffmpegPath);
} catch (err) {
  console.log('[Detection] Failed to load ffmpeg-static:', err);
  ffmpegPath = 'ffmpeg';
}

// Store active detection processes
const activeProcesses = new Map<string, ChildProcess>();
const progressState = new Map<string, { lastSentAt: number; lastProgress: number; lastMessage: string }>();
const stdoutBuffers = new Map<string, string>();
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

const hashFile = async (filePath: string) => {
  return new Promise<string>((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('error', reject);
    stream.on('end', () => resolve(hash.digest('hex')));
  });
};

const startJob = async (data: {
  projectId: string;
  filePath: string;
  settings: DetectionSettings;
  durationSeconds?: number;
}) => {
  const { projectId, filePath, settings, durationSeconds } = data;
  console.log('[Detection] startJob called for projectId:', projectId, 'duration:', durationSeconds);
  const win = getMainWindow();
  if (!win) {
    console.log('[Detection] startJob: Window not found');
    return { success: false, error: 'Window not found' };
  }

  const inputHash = await hashFile(filePath);
  const cacheDir = path.join(app.getPath('userData'), 'cache', inputHash);
  const aiCacheDir = path.join(cacheDir, 'ai');
  
  // Also check for transcript saved with filename (from modal upload)
  const filename = path.basename(filePath);
  const filenameCacheDir = path.join(app.getPath('userData'), 'cache', filename);
  const transcriptPath = path.join(cacheDir, 'transcript.json');
  const filenameTranscriptPath = path.join(filenameCacheDir, 'transcript.json');
  
  // Check which transcript to use (prefer inputHash, fallback to filename)
  let selectedTranscriptPath = transcriptPath;
  if (!fs.existsSync(transcriptPath) && fs.existsSync(filenameTranscriptPath)) {
    console.log('[Detection] Found transcript with filename cache, copying to input hash cache');
    fs.mkdirSync(cacheDir, { recursive: true });
    const content = fs.readFileSync(filenameTranscriptPath, 'utf-8');
    fs.writeFileSync(transcriptPath, content);
    selectedTranscriptPath = transcriptPath;
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
    ? path.join(appPath, 'src/worker')
    : path.join(process.resourcesPath, 'worker');

  const pythonScript = path.join(pythonDir, 'detector.py');

  // Prepare settings JSON
  // Relax defaults to ensure clips are produced and force recompute every run
  const relaxedSettings = {
    targetCount: settings.targetCount ?? 20,
    minDuration: settings.minDuration ?? 8,
    maxDuration: settings.maxDuration ?? 300,
    skipIntro: settings.skipIntro ?? 0,
    skipOutro: settings.skipOutro ?? 0,
    useAiEnhancement: settings.useAiEnhancement ?? false,
    openaiApiKey: settings.openaiApiKey,
    debug: settings.debug ?? false,
  };

  const settingsJson = JSON.stringify({
    mvp_mode: true,
    target_count: relaxedSettings.targetCount,
    min_duration: relaxedSettings.minDuration,
    max_duration: relaxedSettings.maxDuration,
    skip_intro: relaxedSettings.skipIntro,
    skip_outro: relaxedSettings.skipOutro,
    use_ai_enhancement: relaxedSettings.useAiEnhancement,
    openai_api_key: relaxedSettings.openaiApiKey || process.env.OPENAI_API_KEY || '',
    debug: relaxedSettings.debug,
    force_rerun: true, // ensure all stages rerun and ignore stale caches
    cache_dir: cacheDir,
    job_dir: cacheDir,
    ai_cache_dir: aiCacheDir,
    input_hash: inputHash,
    ffmpeg_path: ffmpegPath,
    top_n: relaxedSettings.targetCount,
    video_duration: durationSeconds || 0, // CRITICAL: pass duration to Python
  });
  
  console.log('[Detection] Settings:', {
    hasApiKey: !!settings.openaiApiKey,
    apiKeyLength: settings.openaiApiKey?.length || 0,
    targetCount: settings.targetCount,
    durationSeconds: durationSeconds,
  });

  console.log('[Detection] Starting:', pythonScript);

  // Spawn Python process
  const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
  let pythonProcess: ChildProcess;
  try {
    pythonProcess = spawn(pythonCmd, ['-u', pythonScript, filePath, settingsJson], {
      cwd: pythonDir,
      env: {
        ...process.env,
        PYTHONUNBUFFERED: '1',
      },
    });
    console.log('[Detection] Python process started, PID:', pythonProcess.pid);
  } catch (spawnError: unknown) {
    const errMsg = spawnError instanceof Error ? spawnError.message : String(spawnError);
    console.error('[Detection] Failed to spawn Python:', errMsg);
    win.webContents.send('detection-error', { 
      projectId, 
      error: `Python not found. Please install Python 3.8+ and restart the app.` 
    });
    return { success: false, error: errMsg };
  }

  activeProcesses.set(projectId, pythonProcess);
  stdoutBuffers.set(projectId, '');

  // Handle stdout
  pythonProcess.stdout.on('data', (data) => {
    const buffer = (stdoutBuffers.get(projectId) || '') + data.toString();
    const parts = buffer.split('\n');
    const incompleteData = parts.pop() || '';
    stdoutBuffers.set(projectId, incompleteData);
    
    const lines = parts.filter((line: string) => line.trim());

    for (const line of lines) {
      if (line.startsWith('PROGRESS:')) {
        const parts = line.substring(9).split(':');
        const progress = parseInt(parts[0], 10);
        const message = parts.slice(1).join(':').trim();
        
        // DEBUG: Log all progress messages
        console.log(`[Detection] Progress ${progress}%: ${message}`);

        const now = Date.now();
        const state = progressState.get(projectId) || { lastSentAt: 0, lastProgress: 0, lastMessage: '' };
        const progressDelta = Math.abs(progress - state.lastProgress);
        const messageChanged = message !== state.lastMessage;
        const shouldSend =
          messageChanged ||
          progressDelta >= PROGRESS_MIN_DELTA ||
          now - state.lastSentAt >= PROGRESS_MIN_INTERVAL_MS;

        if (shouldSend) {
          win.webContents.send('detection-progress', { projectId, progress, message });
          progressState.set(projectId, { lastSentAt: now, lastProgress: progress, lastMessage: message });
        }
      } else if (line.startsWith('RESULT:')) {
        try {
          const jsonStr = line.substring(7);
          const result = JSON.parse(jsonStr);
          console.log('[Detection] Complete:', result.clips?.length || 0, 'clips');
          win.webContents.send('detection-complete', {
            projectId,
            clips: result.clips || [],
            deadSpaces: result.deadSpaces || [],
            transcript: result.transcript || null,
            speakers: result.speakers || [],
          });
        } catch (e) {
          console.error('[Detection] Failed to parse result:', e);
          win.webContents.send('detection-error', { projectId, error: 'Failed to parse results' });
        }
      } else if (line.startsWith('ERROR:')) {
        const errorMessage = line.substring(6).trim();
        console.error('[Detection] Error:', errorMessage);
        win.webContents.send('detection-error', { projectId, error: errorMessage });
      }
    }
  });

  // Handle stderr
  pythonProcess.stderr.on('data', (data) => {
    const errorMessage = data.toString();
    console.error('[Detection] stderr:', errorMessage);
    if (errorMessage.includes('Error') || errorMessage.includes('Exception')) {
      win.webContents.send('detection-error', { projectId, error: errorMessage });
    }
  });

  // Handle process exit
  pythonProcess.on('close', (code) => {
    console.log('[Detection] Process exited with code:', code);
    
    // Process remaining buffered data
    const remainingData = stdoutBuffers.get(projectId) || '';
    if (remainingData.trim() && remainingData.startsWith('RESULT:')) {
      try {
        const jsonStr = remainingData.substring(7);
        const result = JSON.parse(jsonStr);
        win.webContents.send('detection-complete', {
          projectId,
          clips: result.clips || [],
          deadSpaces: result.deadSpaces || [],
          transcript: result.transcript || null,
          speakers: result.speakers || [],
        });
      } catch (e) {
        console.error('[Detection] Failed to parse final result:', e);
      }
    }
    
    activeProcesses.delete(projectId);
    progressState.delete(projectId);
    stdoutBuffers.delete(projectId);

    if (code !== 0 && code !== null) {
      win.webContents.send('detection-error', {
        projectId,
        error: `Detection process exited with code ${code}`,
      });
    }
  });

  pythonProcess.on('error', (err) => {
    console.error('[Detection] Process error:', err.message);
    activeProcesses.delete(projectId);
    win.webContents.send('detection-error', {
      projectId,
      error: `Failed to start Python: ${err.message}`,
    });
  });

  return { success: true };
};

// Start detection process
ipcMain.handle('start-detection', async (_event, data: {
  projectId: string;
  filePath: string;
  settings: DetectionSettings;
  durationSeconds?: number;
}) => {
  console.log('[Detection] Handler called with:', { projectId: data.projectId, filePath: data.filePath, durationSeconds: data.durationSeconds });
  const win = getMainWindow();
  if (!win) {
    console.log('[Detection] Window not found');
    return { success: false, error: 'Window not found' };
  }
  console.log('[Detection] Calling startJob');
  return startJob(data);
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
