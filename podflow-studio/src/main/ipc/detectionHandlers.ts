import { ipcMain, app } from 'electron';
import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { getMainWindow } from '../window';
import { JobStore } from '../jobs/jobStore';

// Get ffmpeg path from ffmpeg-static
let ffmpegPath: string;
try {
  ffmpegPath = require('ffmpeg-static') as string;
  console.log('[Detection] Loaded ffmpeg-static successfully:', ffmpegPath);
} catch (err) {
  console.log('[Detection] Failed to load ffmpeg-static:', err);
  ffmpegPath = 'ffmpeg';
}
console.log('[Detection] Using FFmpeg at:', ffmpegPath);

// Store active detection processes
const activeProcesses = new Map<string, ChildProcess>();
const progressState = new Map<string, { lastSentAt: number; lastProgress: number; lastMessage: string }>();
const PROGRESS_MIN_INTERVAL_MS = 100;
const PROGRESS_MIN_DELTA = 1;

// Lazy initialization - jobStore created on first use after app is ready
let jobStore: JobStore | null = null;
function getJobStore(): JobStore {
  if (!jobStore) {
    jobStore = new JobStore(path.join(app.getPath('userData'), 'jobs'));
  }
  return jobStore;
}

const jobQueue: Array<{
  projectId: string;
  filePath: string;
  settings: DetectionSettings;
  durationSeconds?: number;
}> = [];
let activeJobId: string | null = null;

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

const estimateAiCost = (durationSeconds = 0, targetCount = 10) => {
  const minutes = durationSeconds / 60;
  const whisperCost = minutes * 0.006;
  const gptCost = targetCount * 0.002;
  const total = whisperCost + gptCost;
  return { whisperCost, gptCost, total };
};

const hashFile = async (filePath: string) => {
  return new Promise<string>((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('error', reject);
    stream.on('end', () => resolve(hash.digest('hex')));
  });
};

const buildJobSteps = (useAi: boolean) => [
  { name: 'detect', status: 'pending' as const, updatedAt: Date.now() },
  { name: 'transcribe', status: useAi ? ('pending' as const) : ('skipped' as const), updatedAt: Date.now() },
  { name: 'ai_enrich', status: useAi ? ('pending' as const) : ('skipped' as const), updatedAt: Date.now() },
];

const startJob = async (data: {
  projectId: string;
  filePath: string;
  settings: DetectionSettings;
  durationSeconds?: number;
}) => {
  // #region agent log
  console.log('=== [Detection] startJob ENTERED ===');
  // #endregion
  const { projectId, filePath, settings, durationSeconds } = data;
  const win = getMainWindow();
  if (!win) {
    return { success: false, error: 'Window not found' };
  }

  const inputHash = await hashFile(filePath);
  const cacheDir = path.join(app.getPath('userData'), 'cache', inputHash);
  const aiCacheDir = path.join(cacheDir, 'ai');

  const jobSteps = buildJobSteps(settings.useAiEnhancement);
  getJobStore().create({
    id: projectId,
    inputPath: filePath,
    inputHash,
    status: 'running',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    steps: jobSteps,
    costEstimate: settings.useAiEnhancement ? estimateAiCost(durationSeconds, settings.targetCount) : undefined,
    outputs: {
      cacheDir,
      detectionsCache: path.join(cacheDir, 'detections.json'),
      transcriptCache: path.join(cacheDir, 'transcript.json'),
      aiCache: path.join(cacheDir, 'ai_clips.json'),
    },
  });
  getJobStore().updateStep(projectId, 'detect', { status: 'running' });

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
    cache_dir: cacheDir,
    ai_cache_dir: aiCacheDir,
    input_hash: inputHash,
    ffmpeg_path: ffmpegPath,
  });

  // #region agent log
  debugLog('detectionHandlers.ts:startJob:spawn', 'About to spawn Python', { pythonScript, pythonDir, settingsJson: settingsJson.substring(0, 200) }, 'B');
  console.log('[Detection] About to spawn Python:', pythonScript);
  console.log('[Detection] File path:', filePath);
  console.log('[Detection] FFmpeg path being passed:', ffmpegPath);
  // #endregion

  // Spawn Python process
  let pythonProcess: ChildProcess;
  try {
    pythonProcess = spawn('python', [pythonScript, filePath, settingsJson], {
      cwd: pythonDir,
      env: {
        ...process.env,
        PYTHONUNBUFFERED: '1',
      },
    });
    // #region agent log
    console.log('[Detection] spawn() returned, pid:', pythonProcess.pid);
    debugLog('detectionHandlers.ts:spawn:returned', 'spawn() returned', { pid: pythonProcess.pid, connected: pythonProcess.connected }, 'F');
    // #endregion
  } catch (spawnError: unknown) {
    // #region agent log
    const errMsg = spawnError instanceof Error ? spawnError.message : String(spawnError);
    console.log('[Detection] spawn() threw exception:', errMsg);
    debugLog('detectionHandlers.ts:spawn:exception', 'spawn() threw', { error: errMsg }, 'F');
    // #endregion
    getJobStore().update(projectId, { status: 'failed', error: errMsg });
    win.webContents.send('detection-error', { projectId, error: `Python spawn failed: ${errMsg}` });
    return { success: false, error: errMsg };
  }

  activeProcesses.set(projectId, pythonProcess);
  activeJobId = projectId;

  // #region agent log
  debugLog('detectionHandlers.ts:pythonProcess:spawned', 'Python process spawned', { pid: pythonProcess.pid }, 'F');
  console.log('[Detection] Python process spawned with PID:', pythonProcess.pid);
  // #endregion

  // Handle stdout - progress and results
  pythonProcess.stdout.on('data', (data) => {
    const fullOutput = data.toString();
    const lines = fullOutput.split('\n').filter((line: string) => line.trim());

    // Log all lines for debugging
    for (const line of lines) {
      if (line.startsWith('DEBUG:')) {
        console.log('[Detection]', line);
      } else if (line.startsWith('ERROR:') || line.startsWith('PROGRESS:') || line.startsWith('RESULT:')) {
        console.log('[Detection] Python stdout:', line.substring(0, 300));
      }
    }

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

        if (message.toLowerCase().includes('transcrib')) {
          getJobStore().updateStep(projectId, 'transcribe', { status: 'running', message });
        }
        if (message.toLowerCase().includes('translator') || message.toLowerCase().includes('ai')) {
          getJobStore().updateStep(projectId, 'ai_enrich', { status: 'running', message });
        }

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
          getJobStore().updateStep(projectId, 'detect', { status: 'done' });
          if (settings.useAiEnhancement) {
            getJobStore().updateStep(projectId, 'transcribe', { status: 'done' });
            getJobStore().updateStep(projectId, 'ai_enrich', { status: 'done' });
          }
          getJobStore().update(projectId, { status: 'done' });
          win.webContents.send('detection-complete', {
            projectId,
            clips: result.clips || [],
            deadSpaces: result.deadSpaces || [],
            transcript: result.transcript || null,
          });
        } catch (e) {
          console.error('Failed to parse detection result:', e);
          getJobStore().update(projectId, { status: 'failed', error: 'Failed to parse detection results' });
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
    // #region agent log
    debugLog('detectionHandlers.ts:pythonProcess:stderr', 'Got stderr', { data: errorMessage.substring(0, 500) }, 'F');
    // #endregion

    // Only send critical errors, not warnings
    if (errorMessage.includes('Error') || errorMessage.includes('Exception')) {
      getJobStore().update(projectId, { status: 'failed', error: errorMessage });
      win.webContents.send('detection-error', {
        projectId,
        error: errorMessage,
      });
    }
  });

  // Handle process exit
  pythonProcess.on('close', (code) => {
    // #region agent log
    console.log('[Detection] Python process closed with code:', code);
    debugLog('detectionHandlers.ts:pythonProcess:close', 'Process closed', { code }, 'F');
    // #endregion
    activeProcesses.delete(projectId);
    progressState.delete(projectId);
    activeJobId = null;

    if (code !== 0 && code !== null) {
      getJobStore().update(projectId, { status: 'failed', error: `Detection process exited with code ${code}` });
      win.webContents.send('detection-error', {
        projectId,
        error: `Detection process exited with code ${code}`,
      });
    }

    if (jobQueue.length > 0) {
      const nextJob = jobQueue.shift();
      if (nextJob) {
        startJob(nextJob);
      }
    }
  });

  pythonProcess.on('error', (err) => {
    // #region agent log
    debugLog('detectionHandlers.ts:pythonProcess:error', 'Python spawn failed', { error: err.message }, 'C');
    // #endregion
    activeProcesses.delete(projectId);
    activeJobId = null;
    getJobStore().update(projectId, { status: 'failed', error: err.message });
    win.webContents.send('detection-error', {
      projectId,
      error: `Failed to start Python: ${err.message}. Make sure Python is installed.`,
    });
  });

  return { success: true };
};

// #region agent log
const debugLog = (location: string, message: string, data: Record<string, unknown>, hypothesisId: string) => { fetch('http://127.0.0.1:7243/ingest/5a29b418-6eb9-4d45-b489-cbbacb9ac2f5',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location,message,data,timestamp:Date.now(),sessionId:'debug-session',hypothesisId})}).catch(()=>{}); };
// #endregion

// Start detection process
ipcMain.handle('start-detection', async (_event, data: {
  projectId: string;
  filePath: string;
  settings: DetectionSettings;
  durationSeconds?: number;
}) => {
  // #region agent log
  debugLog('detectionHandlers.ts:start-detection', 'Handler invoked', { projectId: data.projectId, filePath: data.filePath, hasSettings: !!data.settings }, 'A');
  // #endregion
  const { projectId, filePath, settings, durationSeconds } = data;
  const win = getMainWindow();

  if (!win) {
    return { success: false, error: 'Window not found' };
  }

  if (activeJobId) {
    getJobStore().create({
      id: projectId,
      inputPath: filePath,
      inputHash: '',
      status: 'queued',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      steps: buildJobSteps(settings.useAiEnhancement),
      costEstimate: settings.useAiEnhancement ? estimateAiCost(durationSeconds, settings.targetCount) : undefined,
    });
    jobQueue.push({ projectId, filePath, settings, durationSeconds });
    win.webContents.send('detection-progress', {
      projectId,
      progress: 0,
      message: 'Queued: waiting for active job to finish...',
    });
    return { success: true, queued: true };
  }

  return startJob({ projectId, filePath, settings, durationSeconds });
});

// Cancel detection
ipcMain.handle('cancel-detection', async (_event, projectId: string) => {
  const queuedIndex = jobQueue.findIndex((job) => job.projectId === projectId);
  if (queuedIndex >= 0) {
    jobQueue.splice(queuedIndex, 1);
    getJobStore().update(projectId, { status: 'canceled' });
    return { success: true };
  }
  const process = activeProcesses.get(projectId);
  if (process) {
    process.kill();
    activeProcesses.delete(projectId);
    getJobStore().update(projectId, { status: 'canceled' });
    return { success: true };
  }
  return { success: false, error: 'No active detection found' };
});
