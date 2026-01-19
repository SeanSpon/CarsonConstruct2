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
// Buffer for accumulating stdout data per project (for large JSON outputs)
const stdoutBuffers = new Map<string, string>();
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

  console.log('[Detection] Spawning Python detector:', pythonScript);

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
    console.log('[Detection] Python process started, PID:', pythonProcess.pid);
  } catch (spawnError: unknown) {
    const errMsg = spawnError instanceof Error ? spawnError.message : String(spawnError);
    console.error('[Detection] Failed to spawn Python:', errMsg);
    getJobStore().update(projectId, { status: 'failed', error: errMsg });
    win.webContents.send('detection-error', { projectId, error: `Python spawn failed: ${errMsg}` });
    return { success: false, error: errMsg };
  }

  activeProcesses.set(projectId, pythonProcess);
  activeJobId = projectId;
  // Initialize stdout buffer for this project
  stdoutBuffers.set(projectId, '');

  // Handle stdout - progress and results
  // IMPORTANT: Buffer data to handle large JSON outputs that span multiple data events
  pythonProcess.stdout.on('data', (data) => {
    // Append new data to the buffer
    const buffer = (stdoutBuffers.get(projectId) || '') + data.toString();
    
    // Split by newlines, but keep incomplete lines in the buffer
    const parts = buffer.split('\n');
    // The last element might be incomplete (no trailing newline), keep it buffered
    const incompleteData = parts.pop() || '';
    stdoutBuffers.set(projectId, incompleteData);
    
    // Process complete lines
    const lines = parts.filter((line: string) => line.trim());

    // Log all lines for debugging
    for (const line of lines) {
      if (line.startsWith('DEBUG:')) {
        console.log('[Detection]', line);
      } else if (line.startsWith('ERROR:') || line.startsWith('PROGRESS:')) {
        console.log('[Detection] Python stdout:', line.substring(0, 300));
      } else if (line.startsWith('RESULT:')) {
        console.log('[Detection] Python stdout: RESULT:<json of', line.length - 7, 'chars>');
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
          const jsonStr = line.substring(7);
          console.log('[Detection] Parsing RESULT JSON, length:', jsonStr.length);
          const result = JSON.parse(jsonStr);
          console.log('[Detection] Successfully parsed RESULT with', result.clips?.length || 0, 'clips');
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
            speakers: result.speakers || [],
          });
        } catch (e) {
          console.error('[Detection] Failed to parse detection result:', e);
          console.error('[Detection] JSON string starts with:', line.substring(7, 200));
          console.error('[Detection] JSON string ends with:', line.substring(line.length - 100));
          getJobStore().update(projectId, { status: 'failed', error: 'Failed to parse detection results' });
          win.webContents.send('detection-error', {
            projectId,
            error: 'Failed to parse detection results',
          });
        }
      } else if (line.startsWith('ERROR:')) {
        const errorMessage = line.substring(6).trim();
        console.error('[Detection] Python error:', errorMessage);
        win.webContents.send('detection-error', {
          projectId,
          error: errorMessage,
        });
      }
    }
  });

  // Handle stderr - errors
  pythonProcess.stderr.on('data', (data) => {
    const errorMessage = data.toString();
    console.error('[Detection] Python stderr:', errorMessage);

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
    console.log('[Detection] Python process exited with code:', code);
    
    // Check if there's any remaining data in the buffer (e.g., final RESULT line without trailing newline)
    const remainingData = stdoutBuffers.get(projectId) || '';
    if (remainingData.trim()) {
      console.log('[Detection] Processing remaining buffered data:', remainingData.length, 'chars');
      if (remainingData.startsWith('RESULT:')) {
        try {
          const jsonStr = remainingData.substring(7);
          console.log('[Detection] Parsing final RESULT JSON, length:', jsonStr.length);
          const result = JSON.parse(jsonStr);
          console.log('[Detection] Successfully parsed final RESULT with', result.clips?.length || 0, 'clips');
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
            speakers: result.speakers || [],
          });
        } catch (e) {
          console.error('[Detection] Failed to parse final RESULT:', e);
        }
      }
    }
    
    // Cleanup
    activeProcesses.delete(projectId);
    progressState.delete(projectId);
    stdoutBuffers.delete(projectId);
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
    console.error('[Detection] Python process error:', err.message);
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

// Start detection process
ipcMain.handle('start-detection', async (_event, data: {
  projectId: string;
  filePath: string;
  settings: DetectionSettings;
  durationSeconds?: number;
}) => {
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
