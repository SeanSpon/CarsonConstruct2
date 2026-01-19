import { ipcMain, dialog } from 'electron';
import { spawn, execSync } from 'child_process';
import path from 'path';
import fs from 'fs';

// Get ffprobe path - try multiple methods
function getFFprobePath(): string | null {
  // Method 1: Try @ffprobe-installer/ffprobe package (best for Electron)
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const ffprobeInstaller = require('@ffprobe-installer/ffprobe');
    const installerPath = ffprobeInstaller?.path || ffprobeInstaller;
    if (installerPath && typeof installerPath === 'string' && fs.existsSync(installerPath)) {
      console.log('[FileHandlers] Using @ffprobe-installer:', installerPath);
      return installerPath;
    } else if (installerPath) {
      console.log('[FileHandlers] @ffprobe-installer path exists but file not found:', installerPath);
    }
  } catch (e) {
    console.log('[FileHandlers] @ffprobe-installer not available:', e);
  }

  // Method 2: Try ffprobe-static package
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const ffprobeStatic = require('ffprobe-static');
    const staticPath = ffprobeStatic?.path || ffprobeStatic;
    if (staticPath && typeof staticPath === 'string' && fs.existsSync(staticPath)) {
      console.log('[FileHandlers] Using ffprobe-static:', staticPath);
      return staticPath;
    } else if (staticPath) {
      console.log('[FileHandlers] ffprobe-static path exists but file not found:', staticPath);
    }
  } catch (e) {
    console.log('[FileHandlers] ffprobe-static not available:', e);
  }

  // Method 3: Direct path lookup in node_modules (fallback when require doesn't work)
  const nodeModulesPaths = [
    // ffprobe-static paths
    path.join(process.cwd(), 'node_modules', 'ffprobe-static', 'bin', 'win32', 'x64', 'ffprobe.exe'),
    path.join(process.cwd(), 'node_modules', 'ffprobe-static', 'bin', 'win32', 'ia32', 'ffprobe.exe'),
    // @ffprobe-installer paths
    path.join(process.cwd(), 'node_modules', '@ffprobe-installer', 'win32-x64', 'ffprobe.exe'),
    path.join(process.cwd(), 'node_modules', '@ffprobe-installer', 'win32-ia32', 'ffprobe.exe'),
  ];

  for (const ffprobePath of nodeModulesPaths) {
    if (fs.existsSync(ffprobePath)) {
      console.log('[FileHandlers] Found ffprobe in node_modules:', ffprobePath);
      return ffprobePath;
    }
  }

  // Method 4: Check common Windows installation paths
  const windowsPaths = [
    'C:\\ffmpeg\\bin\\ffprobe.exe',
    'C:\\Program Files\\ffmpeg\\bin\\ffprobe.exe',
    'C:\\Program Files (x86)\\ffmpeg\\bin\\ffprobe.exe',
    path.join(process.env.LOCALAPPDATA || '', 'ffmpeg', 'bin', 'ffprobe.exe'),
    path.join(process.env.USERPROFILE || '', 'ffmpeg', 'bin', 'ffprobe.exe'),
  ];

  for (const ffprobePath of windowsPaths) {
    if (fs.existsSync(ffprobePath)) {
      console.log('[FileHandlers] Found ffprobe at:', ffprobePath);
      return ffprobePath;
    }
  }

  // Method 5: Check if ffprobe is in PATH
  try {
    const result = execSync('where ffprobe', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
    const foundPath = result.trim().split('\n')[0];
    if (foundPath && fs.existsSync(foundPath)) {
      console.log('[FileHandlers] Found ffprobe in PATH:', foundPath);
      return foundPath;
    }
  } catch (e) {
    console.log('[FileHandlers] ffprobe not found in PATH');
  }

  // No valid path found
  console.log('[FileHandlers] Could not find ffprobe in any location');
  return null;
}

console.log('[FileHandlers] Registering file handlers...');

// Select video file
ipcMain.handle('select-file', async () => {
  console.log('[FileHandlers] select-file handler invoked');
  try {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [
        { name: 'Video Files', extensions: ['mp4', 'mov', 'webm', 'mkv', 'avi'] },
      ],
    });

    console.log('[FileHandlers] Dialog result:', result);

    if (result.canceled || result.filePaths.length === 0) {
      console.log('[FileHandlers] Dialog canceled or no file selected');
      return null;
    }

    const filePath = result.filePaths[0];
    console.log('[FileHandlers] Selected file:', filePath);
    const stats = fs.statSync(filePath);

    const fileInfo = {
      path: filePath,
      name: path.basename(filePath),
      size: stats.size,
    };
    console.log('[FileHandlers] Returning file info:', fileInfo);
    return fileInfo;
  } catch (err) {
    console.error('[FileHandlers] Error in select-file:', err);
    throw err;
  }
});

// Validate video file with FFprobe
console.log('[FileHandlers] Registering validate-file handler...');
ipcMain.handle('validate-file', async (_event, filePath: string) => {
  console.log('[FileHandlers] validate-file handler invoked for:', filePath);
  return new Promise((resolve) => {
    // Get ffprobe path lazily (only when needed)
    const ffprobePath = getFFprobePath();
    
    if (!ffprobePath) {
      console.error('[FileHandlers] FFprobe not found!');
      resolve({
        valid: false,
        error: 'FFprobe not found. Please download FFmpeg from https://ffmpeg.org/download.html and add it to your PATH, or install it to C:\\ffmpeg',
      });
      return;
    }
    console.log('[FileHandlers] FFprobe path found:', ffprobePath);

    console.log('[FileHandlers] Validating file with ffprobe:', ffprobePath);
    
    const ffprobe = spawn(ffprobePath, [
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
      console.log('[FileHandlers] FFprobe exited with code:', code);
      if (code !== 0) {
        console.error('[FileHandlers] FFprobe error output:', errorOutput);
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
      console.error('[FileHandlers] FFprobe spawn error:', err);
      resolve({
        valid: false,
        error: `FFprobe not found. Please download FFmpeg from https://ffmpeg.org/download.html and add it to your PATH, or install it to C:\\ffmpeg`,
      });
    });
  });
});
console.log('[FileHandlers] validate-file handler registered successfully');

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
