import { ipcMain, dialog } from 'electron';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';

// Select file via native dialog
ipcMain.handle('select-file', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [
      { name: 'Videos', extensions: ['mp4', 'mov', 'webm', 'mkv', 'avi'] }
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

// Validate file and get duration using FFprobe
ipcMain.handle('validate-file', async (_event, filePath: string) => {
  return new Promise((resolve) => {
    const ffprobe = spawn('ffprobe', [
      '-v', 'error',
      '-show_entries', 'format=duration',
      '-of', 'json',
      filePath
    ]);

    let output = '';
    let errorOutput = '';

    ffprobe.stdout.on('data', (data) => {
      output += data.toString();
    });

    ffprobe.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });

    ffprobe.on('close', (code) => {
      if (code !== 0) {
        resolve({
          valid: false,
          duration: 0,
          error: errorOutput || 'Failed to read video file'
        });
        return;
      }

      try {
        const json = JSON.parse(output);
        const duration = parseFloat(json.format?.duration || '0');
        resolve({
          valid: true,
          duration,
          error: null
        });
      } catch {
        resolve({
          valid: false,
          duration: 0,
          error: 'Failed to parse video metadata'
        });
      }
    });

    ffprobe.on('error', (err) => {
      resolve({
        valid: false,
        duration: 0,
        error: `FFprobe not found: ${err.message}. Please install FFmpeg.`
      });
    });
  });
});

// Select output directory
ipcMain.handle('select-output-dir', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory', 'createDirectory']
  });

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  return result.filePaths[0];
});
