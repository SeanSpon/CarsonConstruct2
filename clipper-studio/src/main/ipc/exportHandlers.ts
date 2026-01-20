import { ipcMain, BrowserWindow, shell } from 'electron';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';

interface ExportClip {
  id: string;
  startTime: number;
  endTime: number;
  trimStartOffset: number;
  trimEndOffset: number;
}

// Export clips using FFmpeg
ipcMain.handle('export-clips', async (event, data: { 
  sourceFile: string; 
  clips: ExportClip[]; 
  outputDir: string;
}) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win) return { success: false, error: 'Window not found' };

  const { sourceFile, clips, outputDir } = data;
  
  // Ensure output directory exists
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  let completed = 0;
  const total = clips.length;
  const errors: string[] = [];

  for (const clip of clips) {
    const actualStart = clip.startTime + clip.trimStartOffset;
    const actualEnd = clip.endTime + clip.trimEndOffset;
    const duration = actualEnd - actualStart;
    
    const outputFile = path.join(outputDir, `clip_${clip.id}.mp4`);

    // Send progress update
    win.webContents.send('export-progress', {
      current: completed + 1,
      total,
      clipId: clip.id,
    });

    try {
      await exportSingleClip(sourceFile, outputFile, actualStart, duration);
      completed++;
    } catch (err) {
      errors.push(`Failed to export clip ${clip.id}: ${err}`);
    }
  }

  if (errors.length > 0) {
    win.webContents.send('export-complete', {
      success: false,
      outputDir,
      errors,
    });
  } else {
    win.webContents.send('export-complete', {
      success: true,
      outputDir,
      clipCount: completed,
    });
  }

  return { success: errors.length === 0, outputDir };
});

function exportSingleClip(
  sourceFile: string, 
  outputFile: string, 
  startTime: number, 
  duration: number
): Promise<void> {
  return new Promise((resolve, reject) => {
    // Use -c copy for stream copy (keyframe-aligned cuts)
    const ffmpeg = spawn('ffmpeg', [
      '-y', // Overwrite output
      '-ss', startTime.toString(),
      '-i', sourceFile,
      '-t', duration.toString(),
      '-c', 'copy', // Fast copy, no re-encode
      '-avoid_negative_ts', 'make_zero',
      outputFile
    ]);

    let errorOutput = '';

    ffmpeg.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });

    ffmpeg.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(errorOutput || `FFmpeg exited with code ${code}`));
      }
    });

    ffmpeg.on('error', (err) => {
      reject(err);
    });
  });
}

// Open folder in file explorer
ipcMain.handle('open-folder', async (_event, folderPath: string) => {
  try {
    await shell.openPath(folderPath);
    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
});
