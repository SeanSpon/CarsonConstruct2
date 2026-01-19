import { ipcMain, dialog, app } from 'electron';
import { spawn, execSync } from 'child_process';
import path from 'path';
import fs from 'fs';

// Get default projects directory (Documents/SeeZee Projects)
ipcMain.handle('get-default-projects-dir', async () => {
  const documentsPath = app.getPath('documents');
  const defaultDir = path.join(documentsPath, 'SeeZee Projects');
  
  // Create if doesn't exist
  if (!fs.existsSync(defaultDir)) {
    fs.mkdirSync(defaultDir, { recursive: true });
  }
  
  return defaultDir;
});

// Select project location directory
ipcMain.handle('select-project-location', async (_event, defaultPath?: string) => {
  const result = await dialog.showOpenDialog({
    title: 'Select Project Location',
    defaultPath: defaultPath || app.getPath('documents'),
    properties: ['openDirectory', 'createDirectory']
  });

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  return result.filePaths[0];
});

// Create a new project folder
ipcMain.handle('create-project', async (_event, data: { name: string; location: string }) => {
  const { name, location } = data;
  
  // Sanitize project name for folder
  const sanitizedName = name.replace(/[<>:"/\\|?*]/g, '').trim();
  if (!sanitizedName) {
    return { success: false, error: 'Invalid project name' };
  }
  
  const projectPath = path.join(location, sanitizedName);
  
  // Check if folder already exists
  if (fs.existsSync(projectPath)) {
    return { success: false, error: 'A project with this name already exists in this location' };
  }
  
  try {
    // Create project folder structure
    fs.mkdirSync(projectPath, { recursive: true });
    fs.mkdirSync(path.join(projectPath, 'exports'), { recursive: true });
    fs.mkdirSync(path.join(projectPath, 'cache'), { recursive: true });
    
    // Create project file placeholder
    const projectFile = {
      version: '1.0.0',
      name: sanitizedName,
      created: new Date().toISOString(),
      modified: new Date().toISOString(),
      sourceFiles: [],
    };
    
    fs.writeFileSync(
      path.join(projectPath, `${sanitizedName}.podflow`),
      JSON.stringify(projectFile, null, 2)
    );
    
    return {
      success: true,
      projectPath,
      projectName: sanitizedName,
      projectFile: path.join(projectPath, `${sanitizedName}.podflow`),
    };
  } catch (err) {
    return {
      success: false,
      error: `Failed to create project: ${err instanceof Error ? err.message : String(err)}`
    };
  }
});

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

// Select video or audio file
ipcMain.handle('select-file', async () => {
  console.log('[FileHandlers] select-file handler invoked');
  try {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [
        { name: 'Media Files', extensions: ['mp4', 'mov', 'webm', 'mkv', 'avi', 'mp3', 'wav', 'aac', 'flac', 'ogg', 'm4a'] },
        { name: 'Video Files', extensions: ['mp4', 'mov', 'webm', 'mkv', 'avi'] },
        { name: 'Audio Files', extensions: ['mp3', 'wav', 'aac', 'flac', 'ogg', 'm4a'] },
        { name: 'All Files', extensions: ['*'] }
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

// Get ffmpeg path - similar to ffprobe
function getFFmpegPath(): string | null {
  // Method 1: Try ffmpeg-static package
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const ffmpegStatic = require('ffmpeg-static');
    if (ffmpegStatic && typeof ffmpegStatic === 'string' && fs.existsSync(ffmpegStatic)) {
      return ffmpegStatic;
    }
  } catch (e) {
    // Not available
  }

  // Method 2: Check common Windows paths
  const windowsPaths = [
    'C:\\ffmpeg\\bin\\ffmpeg.exe',
    'C:\\Program Files\\ffmpeg\\bin\\ffmpeg.exe',
    path.join(process.env.LOCALAPPDATA || '', 'ffmpeg', 'bin', 'ffmpeg.exe'),
  ];

  for (const ffmpegPath of windowsPaths) {
    if (fs.existsSync(ffmpegPath)) {
      return ffmpegPath;
    }
  }

  // Method 3: Check PATH
  try {
    const result = execSync('where ffmpeg', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
    const foundPath = result.trim().split('\n')[0];
    if (foundPath && fs.existsSync(foundPath)) {
      return foundPath;
    }
  } catch (e) {
    // Not in PATH
  }

  return null;
}

// Generate video thumbnail
async function generateThumbnail(filePath: string, outputPath: string, timeOffset = 5): Promise<boolean> {
  const ffmpegPath = getFFmpegPath();
  if (!ffmpegPath) return false;

  return new Promise((resolve) => {
    const ffmpeg = spawn(ffmpegPath, [
      '-y',
      '-ss', String(timeOffset),
      '-i', filePath,
      '-vframes', '1',
      '-q:v', '2',
      '-vf', 'scale=320:-1',
      outputPath,
    ]);

    ffmpeg.on('close', (code) => {
      resolve(code === 0 && fs.existsSync(outputPath));
    });

    ffmpeg.on('error', () => {
      resolve(false);
    });
  });
}

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

    ffprobe.on('close', async (code) => {
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
        
        // Find video and audio streams
        const videoStream = info.streams?.find((s: { codec_type: string }) => s.codec_type === 'video');
        const hasAudio = info.streams?.some((s: { codec_type: string }) => s.codec_type === 'audio');

        // Require at least video OR audio (or both)
        if (!videoStream && !hasAudio) {
          resolve({ valid: false, error: 'File does not contain video or audio' });
          return;
        }

        // Extract resolution and fps (only if video stream exists)
        let width = 0;
        let height = 0;
        let resolution = 'Audio Only';
        let fps = 0;
        
        if (videoStream) {
          width = videoStream.width || 0;
          height = videoStream.height || 0;
          resolution = width && height ? `${width}x${height}` : 'Unknown';
          
          // Parse frame rate (can be "30/1" or "29.97" format)
          if (videoStream.r_frame_rate) {
            const parts = videoStream.r_frame_rate.split('/');
            if (parts.length === 2) {
              fps = Math.round(parseFloat(parts[0]) / parseFloat(parts[1]));
            } else {
              fps = Math.round(parseFloat(videoStream.r_frame_rate));
            }
          }
        }

        // Generate thumbnail (only for video files)
        let thumbnailPath: string | undefined;
        if (videoStream) {
          try {
            const { app } = require('electron');
            const thumbnailDir = path.join(app.getPath('userData'), 'thumbnails');
            if (!fs.existsSync(thumbnailDir)) {
              fs.mkdirSync(thumbnailDir, { recursive: true });
            }
            const thumbnailFile = path.join(thumbnailDir, `${path.basename(filePath, path.extname(filePath))}_thumb.jpg`);
            const thumbOffset = Math.min(5, duration / 2); // 5 seconds in or halfway if short
            const generated = await generateThumbnail(filePath, thumbnailFile, thumbOffset);
            if (generated) {
              thumbnailPath = thumbnailFile;
            }
          } catch (thumbErr) {
            console.log('[FileHandlers] Thumbnail generation failed:', thumbErr);
          }
        }

        resolve({
          valid: true,
          duration,
          format: info.format?.format_name,
          resolution,
          width,
          height,
          fps,
          thumbnailPath,
          bitrate: info.format?.bit_rate ? parseInt(info.format.bit_rate) : undefined,
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

// Select multiple camera files for multi-cam editing
ipcMain.handle('select-camera-files', async () => {
  console.log('[FileHandlers] select-camera-files handler invoked');
  try {
    const result = await dialog.showOpenDialog({
      title: 'Select Camera Files',
      properties: ['openFile', 'multiSelections'],
      filters: [
        { name: 'Video Files', extensions: ['mp4', 'mov', 'webm', 'mkv', 'avi'] },
        { name: 'All Files', extensions: ['*'] }
      ],
    });

    console.log('[FileHandlers] Camera files dialog result:', result);

    if (result.canceled || result.filePaths.length === 0) {
      console.log('[FileHandlers] Dialog canceled or no files selected');
      return { success: true, files: [] };
    }

    // Process each file to get metadata
    const cameraFiles = await Promise.all(
      result.filePaths.map(async (filePath, index) => {
        const stats = fs.statSync(filePath);
        const fileName = path.basename(filePath);
        
        // Generate a unique ID for each camera
        const cameraId = `cam_${Date.now()}_${index}_${Math.random().toString(36).slice(2, 6)}`;
        
        return {
          id: cameraId,
          name: `Camera ${index + 1}`,
          filePath,
          fileName,
          size: stats.size,
          speakerName: undefined,
          isMain: index === 0, // First camera is main by default
        };
      })
    );

    console.log('[FileHandlers] Returning camera files:', cameraFiles.length);
    return { success: true, files: cameraFiles };
  } catch (err) {
    console.error('[FileHandlers] Error in select-camera-files:', err);
    return { 
      success: false, 
      error: err instanceof Error ? err.message : String(err),
      files: [] 
    };
  }
});

// Validate camera files and get their metadata (duration, resolution, etc.)
ipcMain.handle('validate-camera-files', async (_event, filePaths: string[]) => {
  console.log('[FileHandlers] validate-camera-files handler invoked for:', filePaths.length, 'files');
  
  const ffprobePath = getFFprobePath();
  if (!ffprobePath) {
    return { 
      success: false, 
      error: 'FFprobe not found',
      files: [] 
    };
  }

  const results = await Promise.all(
    filePaths.map(async (filePath) => {
      return new Promise<{
        filePath: string;
        valid: boolean;
        duration?: number;
        resolution?: string;
        width?: number;
        height?: number;
        fps?: number;
        error?: string;
      }>((resolve) => {
        const ffprobe = spawn(ffprobePath, [
          '-v', 'quiet',
          '-print_format', 'json',
          '-show_format',
          '-show_streams',
          filePath,
        ]);

        let output = '';
        ffprobe.stdout.on('data', (data) => {
          output += data.toString();
        });

        ffprobe.on('close', (code) => {
          if (code !== 0) {
            resolve({ filePath, valid: false, error: 'Could not read file' });
            return;
          }

          try {
            const info = JSON.parse(output);
            const duration = parseFloat(info.format?.duration || '0');
            const videoStream = info.streams?.find((s: { codec_type: string }) => s.codec_type === 'video');
            
            if (!videoStream) {
              resolve({ filePath, valid: false, error: 'No video stream found' });
              return;
            }

            const width = videoStream.width || 0;
            const height = videoStream.height || 0;
            let fps = 0;
            
            if (videoStream.r_frame_rate) {
              const parts = videoStream.r_frame_rate.split('/');
              if (parts.length === 2) {
                fps = Math.round(parseFloat(parts[0]) / parseFloat(parts[1]));
              } else {
                fps = Math.round(parseFloat(videoStream.r_frame_rate));
              }
            }

            resolve({
              filePath,
              valid: true,
              duration,
              resolution: `${width}x${height}`,
              width,
              height,
              fps,
            });
          } catch {
            resolve({ filePath, valid: false, error: 'Failed to parse metadata' });
          }
        });

        ffprobe.on('error', () => {
          resolve({ filePath, valid: false, error: 'FFprobe error' });
        });
      });
    })
  );

  return {
    success: true,
    files: results,
  };
});

// Extract waveform data from video/audio file
ipcMain.handle('extract-waveform', async (_event, filePath: string, numPoints: number = 500) => {
  console.log('[FileHandlers] extract-waveform handler invoked for:', filePath);
  
  const ffmpegPath = getFFmpegPath();
  if (!ffmpegPath) {
    console.error('[FileHandlers] FFmpeg not found for waveform extraction');
    return { success: false, error: 'FFmpeg not found' };
  }

  return new Promise((resolve) => {
    // Use FFmpeg to extract audio peaks using the astats filter
    // This outputs volume statistics for each audio frame
    const ffmpeg = spawn(ffmpegPath, [
      '-i', filePath,
      '-af', `asetnsamples=n=${Math.ceil(48000 / 10)},astats=metadata=1:reset=1,ametadata=print:key=lavfi.astats.Overall.Peak_level`,
      '-f', 'null',
      '-'
    ], { windowsHide: true });

    let stderrOutput = '';
    const peaks: number[] = [];

    ffmpeg.stderr.on('data', (data) => {
      const text = data.toString();
      stderrOutput += text;
      
      // Parse peak levels from output
      const peakMatches = text.match(/lavfi\.astats\.Overall\.Peak_level=(-?\d+\.?\d*)/g);
      if (peakMatches) {
        for (const match of peakMatches) {
          const value = parseFloat(match.split('=')[1]);
          // Convert dB to linear (0-1 range)
          // -60dB = 0, 0dB = 1
          const linear = Math.max(0, Math.min(1, (value + 60) / 60));
          peaks.push(linear);
        }
      }
    });

    ffmpeg.on('close', (code) => {
      console.log('[FileHandlers] Waveform extraction complete, got', peaks.length, 'peaks');
      
      if (peaks.length === 0) {
        // Fallback: try simpler approach with showwavespic
        extractWaveformFallback(ffmpegPath, filePath, numPoints, resolve);
        return;
      }

      // Downsample to target number of points
      const waveform = downsampleWaveform(peaks, numPoints);
      resolve({ success: true, waveform });
    });

    ffmpeg.on('error', (err) => {
      console.error('[FileHandlers] FFmpeg waveform error:', err);
      resolve({ success: false, error: err.message });
    });

    // Timeout after 60 seconds for very long files
    setTimeout(() => {
      ffmpeg.kill();
      if (peaks.length > 0) {
        const waveform = downsampleWaveform(peaks, numPoints);
        resolve({ success: true, waveform });
      } else {
        resolve({ success: false, error: 'Waveform extraction timed out' });
      }
    }, 60000);
  });
});

// Fallback waveform extraction using volumedetect on segments
function extractWaveformFallback(
  ffmpegPath: string, 
  filePath: string, 
  numPoints: number,
  resolve: (result: { success: boolean; waveform?: number[]; error?: string }) => void
): void {
  // Get duration first, then sample evenly
  const ffprobe = spawn(getFFprobePath() || 'ffprobe', [
    '-v', 'quiet',
    '-show_entries', 'format=duration',
    '-of', 'csv=p=0',
    filePath
  ]);

  let durationStr = '';
  ffprobe.stdout.on('data', (data) => {
    durationStr += data.toString();
  });

  ffprobe.on('close', () => {
    const duration = parseFloat(durationStr.trim()) || 0;
    if (duration <= 0) {
      resolve({ success: false, error: 'Could not determine duration' });
      return;
    }

    // Generate simple waveform by sampling audio levels at intervals
    const segmentDuration = duration / numPoints;
    const waveform: number[] = [];
    let completed = 0;

    // Process in batches to avoid too many processes
    const batchSize = 50;
    let currentBatch = 0;

    const processBatch = () => {
      const startIdx = currentBatch * batchSize;
      const endIdx = Math.min(startIdx + batchSize, numPoints);
      
      const promises: Promise<number>[] = [];
      
      for (let i = startIdx; i < endIdx; i++) {
        const startTime = i * segmentDuration;
        promises.push(getSegmentPeak(ffmpegPath, filePath, startTime, segmentDuration));
      }

      Promise.all(promises).then((results) => {
        for (let i = 0; i < results.length; i++) {
          waveform[startIdx + i] = results[i];
        }
        completed += results.length;
        
        if (completed >= numPoints) {
          resolve({ success: true, waveform });
        } else {
          currentBatch++;
          processBatch();
        }
      });
    };

    processBatch();
  });
}

// Get peak level for a segment
function getSegmentPeak(ffmpegPath: string, filePath: string, startTime: number, duration: number): Promise<number> {
  return new Promise((resolve) => {
    const ffmpeg = spawn(ffmpegPath, [
      '-ss', startTime.toString(),
      '-t', duration.toString(),
      '-i', filePath,
      '-af', 'volumedetect',
      '-f', 'null',
      '-'
    ], { windowsHide: true });

    let output = '';
    ffmpeg.stderr.on('data', (data) => {
      output += data.toString();
    });

    ffmpeg.on('close', () => {
      // Parse max_volume from output
      const match = output.match(/max_volume:\s*(-?\d+\.?\d*)\s*dB/);
      if (match) {
        const db = parseFloat(match[1]);
        // Convert dB to linear (0-1), where -60dB=0, 0dB=1
        const linear = Math.max(0, Math.min(1, (db + 60) / 60));
        resolve(linear);
      } else {
        resolve(0.1); // Default low value if no audio detected
      }
    });

    ffmpeg.on('error', () => resolve(0.1));
    
    // Quick timeout per segment
    setTimeout(() => {
      ffmpeg.kill();
      resolve(0.1);
    }, 2000);
  });
}

// Downsample waveform to target number of points
function downsampleWaveform(peaks: number[], targetPoints: number): number[] {
  if (peaks.length <= targetPoints) {
    // Pad if we have fewer points
    const result = [...peaks];
    while (result.length < targetPoints) {
      result.push(result[result.length - 1] || 0);
    }
    return result;
  }

  const result: number[] = [];
  const ratio = peaks.length / targetPoints;

  for (let i = 0; i < targetPoints; i++) {
    const start = Math.floor(i * ratio);
    const end = Math.floor((i + 1) * ratio);
    let max = 0;
    for (let j = start; j < end && j < peaks.length; j++) {
      max = Math.max(max, peaks[j]);
    }
    result.push(max);
  }

  return result;
}
