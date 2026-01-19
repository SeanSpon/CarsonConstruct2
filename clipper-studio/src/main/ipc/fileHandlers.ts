import { ipcMain, dialog, app } from 'electron';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';

// #region agent log
const debugLogPath = 'c:\\Users\\Sean\\Desktop\\donebytmr\\.cursor\\debug.log';
const debugLog = (location: string, message: string, data: any, hypothesisId: string) => {
  try {
    const entry = JSON.stringify({ location, message, data, timestamp: Date.now(), sessionId: 'debug-session', hypothesisId }) + '\n';
    fs.appendFileSync(debugLogPath, entry);
  } catch (e) { /* ignore */ }
};
// #endregion

// Get default projects directory (Documents/Clipper Studio Projects)
ipcMain.handle('get-default-projects-dir', async () => {
  // #region agent log
  debugLog('fileHandlers:get-default-projects-dir', 'Handler called', {}, 'B');
  // #endregion
  const documentsPath = app.getPath('documents');
  const defaultDir = path.join(documentsPath, 'Clipper Studio Projects');
  
  // Create if doesn't exist
  if (!fs.existsSync(defaultDir)) {
    fs.mkdirSync(defaultDir, { recursive: true });
  }
  // #region agent log
  debugLog('fileHandlers:get-default-projects-dir', 'Returning dir', { defaultDir }, 'B');
  // #endregion
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
  // #region agent log
  debugLog('fileHandlers:create-project', 'Handler called', { data }, 'C');
  // #endregion
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
      path.join(projectPath, `${sanitizedName}.clipper`),
      JSON.stringify(projectFile, null, 2)
    );
    
    const result = {
      success: true,
      projectPath,
      projectName: sanitizedName,
      projectFile: path.join(projectPath, `${sanitizedName}.clipper`),
    };
    // #region agent log
    debugLog('fileHandlers:create-project', 'Success', { result }, 'C');
    // #endregion
    return result;
  } catch (err) {
    const errorResult = {
      success: false,
      error: `Failed to create project: ${err instanceof Error ? err.message : String(err)}`
    };
    // #region agent log
    debugLog('fileHandlers:create-project', 'Error', { errorResult }, 'C');
    // #endregion
    return errorResult;
  }
});

// Select file via native dialog
ipcMain.handle('select-file', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [
      { name: 'Media Files', extensions: ['mp4', 'mov', 'webm', 'mkv', 'avi', 'mp3', 'wav', 'aac', 'flac', 'ogg', 'm4a'] },
      { name: 'Video Files', extensions: ['mp4', 'mov', 'webm', 'mkv', 'avi'] },
      { name: 'Audio Files', extensions: ['mp3', 'wav', 'aac', 'flac', 'ogg', 'm4a'] },
      { name: 'All Files', extensions: ['*'] }
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
          error: errorOutput || 'Failed to read media file'
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
          error: 'Failed to parse media file metadata'
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
