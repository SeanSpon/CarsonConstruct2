/**
 * ClipBot MVP Pipeline Handlers
 * 
 * IPC handlers for the story-first clip generation pipeline.
 * Spawns Python clip_generator.py and streams progress to renderer.
 */

import { ipcMain, app, dialog } from 'electron';
import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import fs from 'fs';
import { getMainWindow } from '../window';

// Store active clip generation jobs
const activeJobs = new Map<string, ChildProcess>();
const stdoutBuffers = new Map<string, string>();

export interface ClipbotConfig {
  whisperModel?: string;
  minDuration?: number;
  maxDuration?: number;
  maxClips?: number;
  minStoryScore?: number;
  captionStyle?: 'word_by_word' | 'three_word_chunks';
  cutsPerMinute?: number;
  stylePreset?: 'viral_fast' | 'storytelling' | 'educational' | 'raw_authentic' | 'hype';
}

export interface ClipbotResult {
  path: string;
  filename: string;
  index: number;
  duration: number;
  story_score: number;
  has_setup: boolean;
  has_conflict: boolean;
  has_payoff: boolean;
  engagement_score: number;
  word_count: number;
  text_preview: string;
  source_start: number;
  source_end: number;
}

/**
 * Register ClipBot IPC handlers
 */
export function registerClipbotHandlers() {
  console.log('[ClipBot] Registering handlers');

  // Select video file for clip generation
  ipcMain.handle('clipbot-select-video', async () => {
    const result = await dialog.showOpenDialog({
      title: 'Select Video for Clip Generation',
      properties: ['openFile'],
      filters: [
        { name: 'Videos', extensions: ['mp4', 'mov', 'avi', 'mkv', 'webm', 'm4v'] }
      ]
    });

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    const filePath = result.filePaths[0];
    const stats = fs.statSync(filePath);

    return {
      path: filePath,
      name: path.basename(filePath),
      size: stats.size,
    };
  });

  // Select output directory
  ipcMain.handle('clipbot-select-output-dir', async () => {
    const result = await dialog.showOpenDialog({
      title: 'Select Output Directory',
      properties: ['openDirectory', 'createDirectory'],
    });

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    return result.filePaths[0];
  });

  // Start clip generation job
  ipcMain.handle('clipbot-generate', async (event, data: {
    jobId: string;
    videoPath: string;
    outputDir: string;
    config?: ClipbotConfig;
  }) => {
    const { jobId, videoPath, outputDir, config } = data;
    const win = getMainWindow();

    if (!win) {
      return { success: false, error: 'Window not found' };
    }

    if (!fs.existsSync(videoPath)) {
      return { success: false, error: 'Video file not found' };
    }

    // Cancel any existing job with same ID
    if (activeJobs.has(jobId)) {
      const existingProcess = activeJobs.get(jobId);
      existingProcess?.kill();
      activeJobs.delete(jobId);
    }

    // Prepare output directory
    const jobOutputDir = outputDir || path.join(app.getPath('userData'), 'clipbot_output', jobId);
    fs.mkdirSync(jobOutputDir, { recursive: true });

    // Get Python script path
    const appPath = app.getAppPath();
    const isDev = !app.isPackaged;
    const pythonDir = isDev
      ? path.join(appPath, 'src/python')
      : path.join(process.resourcesPath, 'python');

    const pythonScript = path.join(pythonDir, 'pipeline', 'clip_generator.py');

    // Check if script exists
    if (!fs.existsSync(pythonScript)) {
      console.error('[ClipBot] Script not found:', pythonScript);
      return { success: false, error: `Pipeline script not found: ${pythonScript}` };
    }

    // Build config JSON
    const pipelineConfig = {
      whisper_model: config?.whisperModel || 'base',
      min_duration: config?.minDuration || 15,
      max_duration: config?.maxDuration || 90,
      max_clips: config?.maxClips || 10,
      min_story_score: config?.minStoryScore || 40,
      caption_style: config?.captionStyle || 'three_word_chunks',
      cuts_per_minute: config?.cutsPerMinute || 10,
      style_preset: config?.stylePreset || 'storytelling',
    };

    const configJson = JSON.stringify(pipelineConfig);

    console.log('[ClipBot] Starting job:', { jobId, videoPath, outputDir: jobOutputDir });
    console.log('[ClipBot] Config:', pipelineConfig);

    // Spawn Python process
    const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
    let pythonProcess: ChildProcess;

    try {
      pythonProcess = spawn(pythonCmd, ['-u', pythonScript, videoPath, jobOutputDir, configJson], {
        cwd: pythonDir,
        env: {
          ...process.env,
          PYTHONUNBUFFERED: '1',
        },
      });

      console.log('[ClipBot] Process started, PID:', pythonProcess.pid);
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error('[ClipBot] Failed to spawn Python:', errMsg);
      return { success: false, error: `Failed to start Python: ${errMsg}` };
    }

    activeJobs.set(jobId, pythonProcess);
    stdoutBuffers.set(jobId, '');

    // Handle stdout
    pythonProcess.stdout?.on('data', (data) => {
      const buffer = (stdoutBuffers.get(jobId) || '') + data.toString();
      const lines = buffer.split('\n');
      const incompleteLine = lines.pop() || '';
      stdoutBuffers.set(jobId, incompleteLine);

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        if (trimmed.startsWith('PROGRESS:')) {
          // Parse: PROGRESS:50:Message here
          const parts = trimmed.substring(9).split(':');
          const percent = parseInt(parts[0], 10);
          const message = parts.slice(1).join(':').trim();

          console.log(`[ClipBot] Progress: ${percent}% - ${message}`);
          win.webContents.send('clipbot-progress', { jobId, percent, message });
        } else if (trimmed.startsWith('RESULT:')) {
          // Parse results JSON
          try {
            const jsonStr = trimmed.substring(7);
            const clips: ClipbotResult[] = JSON.parse(jsonStr);

            console.log('[ClipBot] Complete:', clips.length, 'clips');
            win.webContents.send('clipbot-complete', {
              jobId,
              clips,
              outputDir: jobOutputDir,
            });
          } catch (parseErr) {
            console.error('[ClipBot] Failed to parse result:', parseErr);
            win.webContents.send('clipbot-error', {
              jobId,
              error: 'Failed to parse clip generation results',
            });
          }
        } else if (trimmed.startsWith('ERROR:')) {
          const errorMessage = trimmed.substring(6).trim();
          console.error('[ClipBot] Error:', errorMessage);
          win.webContents.send('clipbot-error', { jobId, error: errorMessage });
        }
      }
    });

    // Handle stderr
    pythonProcess.stderr?.on('data', (data) => {
      const errorText = data.toString();
      console.error('[ClipBot] stderr:', errorText);

      // Only send critical errors to frontend
      if (errorText.includes('Error') || errorText.includes('Exception') || errorText.includes('Traceback')) {
        // Don't send moviepy/ffmpeg warnings
        if (!errorText.includes('UserWarning') && !errorText.includes('deprecated')) {
          win.webContents.send('clipbot-error', { jobId, error: errorText });
        }
      }
    });

    // Handle process exit
    pythonProcess.on('close', (code) => {
      console.log('[ClipBot] Process exited with code:', code);

      // Process any remaining buffered data
      const remaining = stdoutBuffers.get(jobId) || '';
      if (remaining.trim().startsWith('RESULT:')) {
        try {
          const jsonStr = remaining.trim().substring(7);
          const clips: ClipbotResult[] = JSON.parse(jsonStr);
          win.webContents.send('clipbot-complete', {
            jobId,
            clips,
            outputDir: jobOutputDir,
          });
        } catch {
          // Ignore parse errors
        }
      }

      activeJobs.delete(jobId);
      stdoutBuffers.delete(jobId);

      if (code !== 0 && code !== null) {
        win.webContents.send('clipbot-error', {
          jobId,
          error: `Clip generation process exited with code ${code}`,
        });
      }
    });

    pythonProcess.on('error', (err) => {
      console.error('[ClipBot] Process error:', err.message);
      activeJobs.delete(jobId);
      win.webContents.send('clipbot-error', {
        jobId,
        error: `Failed to start clip generation: ${err.message}`,
      });
    });

    return {
      success: true,
      jobId,
      outputDir: jobOutputDir,
    };
  });

  // Cancel clip generation job
  ipcMain.handle('clipbot-cancel', async (_event, jobId: string) => {
    const process = activeJobs.get(jobId);
    if (process) {
      process.kill();
      activeJobs.delete(jobId);
      stdoutBuffers.delete(jobId);
      return { success: true };
    }
    return { success: false, error: 'Job not found' };
  });

  // Get job status
  ipcMain.handle('clipbot-status', async (_event, jobId: string) => {
    return {
      running: activeJobs.has(jobId),
    };
  });

  // Export single clip to user-selected location
  ipcMain.handle('clipbot-export-clip', async (_event, data: {
    sourcePath: string;
    suggestedName?: string;
  }) => {
    const { sourcePath, suggestedName } = data;

    if (!fs.existsSync(sourcePath)) {
      return { success: false, error: 'Clip file not found' };
    }

    const result = await dialog.showSaveDialog({
      title: 'Export Clip',
      defaultPath: suggestedName || path.basename(sourcePath),
      filters: [
        { name: 'Video', extensions: ['mp4'] }
      ]
    });

    if (result.canceled || !result.filePath) {
      return { success: false, canceled: true };
    }

    try {
      fs.copyFileSync(sourcePath, result.filePath);
      return {
        success: true,
        path: result.filePath,
      };
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      return { success: false, error: `Failed to export clip: ${errMsg}` };
    }
  });

  // Open output folder in file manager
  ipcMain.handle('clipbot-open-folder', async (_event, folderPath: string) => {
    const { shell } = require('electron');
    
    if (!fs.existsSync(folderPath)) {
      return { success: false, error: 'Folder not found' };
    }

    try {
      await shell.openPath(folderPath);
      return { success: true };
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      return { success: false, error: errMsg };
    }
  });

  console.log('[ClipBot] Handlers registered');
}
