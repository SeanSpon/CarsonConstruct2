import { ipcMain, BrowserWindow, app } from 'electron';
import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import fs from 'fs';

let detectionProcess: ChildProcess | null = null;
const PROGRESS_MIN_INTERVAL_MS = 100;
const PROGRESS_MIN_DELTA = 1;
let progressThrottle = { lastSentAt: 0, lastProgress: 0, lastStep: '' };

// Get the path to the Python scripts
function getPythonScriptPath(): string {
  // Check multiple possible locations
  const possiblePaths = [
    // Development: relative to the built main.js
    path.join(__dirname, '..', '..', 'src', 'python'),
    // Development: from project root
    path.join(app.getAppPath(), 'src', 'python'),
    // Production: bundled with app
    path.join(process.resourcesPath || '', 'python'),
    // Fallback: current directory
    path.join(process.cwd(), 'src', 'python'),
  ];

  for (const p of possiblePaths) {
    const detectorPath = path.join(p, 'detector.py');
    if (fs.existsSync(detectorPath)) {
      return p;
    }
  }

  // Default to first option (development path)
  return possiblePaths[0];
}

// Start detection process
ipcMain.handle('start-detection', async (event, filePath: string) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win) return { success: false, error: 'Window not found' };

  const pythonPath = getPythonScriptPath();
  const detectorScript = path.join(pythonPath, 'detector.py');

  // Check if script exists
  if (!fs.existsSync(detectorScript)) {
    return { 
      success: false, 
      error: `Python detector not found at: ${detectorScript}. Make sure the Python scripts are in src/python/` 
    };
  }

  console.log('Starting detection with script:', detectorScript);
  console.log('Video file:', filePath);

  // Spawn Python process
  detectionProcess = spawn('python', [detectorScript, filePath], {
    cwd: pythonPath,
    env: {
      ...process.env,
      PYTHONUNBUFFERED: '1',  // Force unbuffered output
    },
  });

  let outputBuffer = '';
  progressThrottle = { lastSentAt: 0, lastProgress: 0, lastStep: '' };

  detectionProcess.stdout?.on('data', (data) => {
    outputBuffer += data.toString();
    
    // Process complete lines
    const lines = outputBuffer.split('\n');
    outputBuffer = lines.pop() || ''; // Keep incomplete line in buffer
    
    for (const line of lines) {
      if (!line.trim()) continue;
      
      try {
        const message = JSON.parse(line);
        
        if (message.type === 'progress') {
          const now = Date.now();
          const progressDelta = Math.abs(message.progress - progressThrottle.lastProgress);
          const stepChanged = message.step !== progressThrottle.lastStep;
          const shouldSend =
            stepChanged ||
            progressDelta >= PROGRESS_MIN_DELTA ||
            now - progressThrottle.lastSentAt >= PROGRESS_MIN_INTERVAL_MS;

          if (shouldSend) {
            win.webContents.send('detection-progress', {
              step: message.step,
              progress: message.progress,
              message: message.message,
            });
            progressThrottle = {
              lastSentAt: now,
              lastProgress: message.progress,
              lastStep: message.step,
            };
          }
        } else if (message.type === 'complete') {
          win.webContents.send('detection-complete', {
            clips: message.clips || [],
            waveform: message.waveform || [],
          });
        } else if (message.type === 'error') {
          win.webContents.send('detection-error', {
            error: message.error,
          });
        }
      } catch {
        // Non-JSON output, log it
        console.log('Python output:', line);
      }
    }
  });

  detectionProcess.stderr?.on('data', (data) => {
    const errorText = data.toString();
    console.error('Python stderr:', errorText);
    
    // Don't send every stderr message as an error (librosa logs warnings)
    // Only send if it looks like an actual error
    if (errorText.toLowerCase().includes('error') || 
        errorText.toLowerCase().includes('traceback') ||
        errorText.toLowerCase().includes('exception')) {
      // Don't send here, wait for process to exit
    }
  });

  detectionProcess.on('close', (code) => {
    console.log('Python process exited with code:', code);
    
    // Process any remaining buffered output
    if (outputBuffer.trim()) {
      try {
        const message = JSON.parse(outputBuffer);
        if (message.type === 'complete') {
          win.webContents.send('detection-complete', {
            clips: message.clips || [],
            waveform: message.waveform || [],
          });
        } else if (message.type === 'error') {
          win.webContents.send('detection-error', {
            error: message.error,
          });
        }
      } catch {
        // Ignore
      }
    }
    
    if (code !== 0 && code !== null) {
      // Only send error if we haven't already sent a complete/error message
      win.webContents.send('detection-error', {
        error: `Detection process exited with code ${code}. Make sure Python and required packages (librosa, numpy, scipy) are installed.`,
      });
    }
    detectionProcess = null;
  });

  detectionProcess.on('error', (err) => {
    console.error('Failed to start Python:', err);
    win.webContents.send('detection-error', {
      error: `Failed to start Python: ${err.message}. Please ensure Python is installed and in your PATH.`,
    });
    detectionProcess = null;
  });

  return { success: true };
});

// Cancel detection process
ipcMain.handle('cancel-detection', async () => {
  if (detectionProcess) {
    detectionProcess.kill('SIGTERM');
    detectionProcess = null;
    return { success: true };
  }
  return { success: false, error: 'No detection process running' };
});
