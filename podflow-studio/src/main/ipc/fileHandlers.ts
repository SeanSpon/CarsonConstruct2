import { ipcMain, dialog, BrowserWindow } from 'electron';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';

// Select video file
ipcMain.handle('select-file', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [
      { name: 'Video Files', extensions: ['mp4', 'mov', 'webm', 'mkv', 'avi'] },
    ],
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

// Validate video file with FFprobe
ipcMain.handle('validate-file', async (_event, filePath: string) => {
  return new Promise((resolve) => {
    const ffprobe = spawn('ffprobe', [
      '-v', 'quiet',
      '-print_format', 'json',
      '-show_format',
      '-show_streams',
      filePath,
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
          error: 'Could not read video file. Make sure FFmpeg is installed.',
        });
        return;
      }

      try {
        const info = JSON.parse(output);
        const duration = parseFloat(info.format?.duration || '0');
        const hasVideo = info.streams?.some((s: { codec_type: string }) => s.codec_type === 'video');
        const hasAudio = info.streams?.some((s: { codec_type: string }) => s.codec_type === 'audio');

        if (!hasVideo) {
          resolve({ valid: false, error: 'File does not contain video' });
          return;
        }

        if (!hasAudio) {
          resolve({ valid: false, error: 'File does not contain audio' });
          return;
        }

        resolve({
          valid: true,
          duration,
          format: info.format?.format_name,
        });
      } catch (e) {
        resolve({
          valid: false,
          error: 'Failed to parse video information',
        });
      }
    });

    ffprobe.on('error', (err) => {
      resolve({
        valid: false,
        error: `FFprobe not found. Please install FFmpeg: ${err.message}`,
      });
    });
  });
});

// Select output directory
ipcMain.handle('select-output-dir', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory', 'createDirectory'],
  });

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  return result.filePaths[0];
});
