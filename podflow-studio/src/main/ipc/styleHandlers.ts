/**
 * IPC handlers for style presets and customization
 */
import { ipcMain, app } from 'electron';
import { spawn } from 'child_process';
import path from 'path';

// Get the path to Python scripts
function getPythonScriptPath(scriptName: string): string {
  const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
  
  if (isDev) {
    return path.join(__dirname, '../../python/scripts', scriptName);
  }
  
  return path.join(process.resourcesPath, 'python/scripts', scriptName);
}

// Get custom styles directory path
function getCustomStylesDir(): string {
  return path.join(app.getPath('userData'), 'custom_styles');
}

// Python command based on platform
const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';

export function registerStyleHandlers() {
  console.log('[IPC] Registering style handlers');
  
  /**
   * Get all style presets
   */
  ipcMain.handle('get-style-presets', async () => {
    return new Promise((resolve, reject) => {
      const scriptPath = getPythonScriptPath('list_styles.py');
      
      const python = spawn(pythonCmd, [scriptPath]);
      
      let output = '';
      let errorOutput = '';
      
      python.stdout.on('data', (data) => {
        output += data.toString();
      });
      
      python.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });
      
      python.on('close', (code) => {
        if (code === 0) {
          try {
            resolve(JSON.parse(output));
          } catch (err) {
            console.error('[IPC] Failed to parse style presets:', err);
            resolve([]);
          }
        } else {
          console.error('[IPC] get-style-presets failed:', errorOutput);
          resolve([]);
        }
      });
      
      python.on('error', (err) => {
        console.error('[IPC] get-style-presets spawn error:', err);
        resolve([]);
      });
    });
  });
  
  /**
   * Get details for a specific style
   */
  ipcMain.handle('get-style-details', async (_event, styleId: string) => {
    return new Promise((resolve, reject) => {
      if (!styleId) {
        resolve(null);
        return;
      }
      
      const scriptPath = getPythonScriptPath('get_style.py');
      
      const python = spawn(pythonCmd, [scriptPath, styleId]);
      
      let output = '';
      let errorOutput = '';
      
      python.stdout.on('data', (data) => {
        output += data.toString();
      });
      
      python.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });
      
      python.on('close', (code) => {
        if (code === 0) {
          try {
            const data = JSON.parse(output);
            if (data.error) {
              resolve(null);
            } else {
              resolve(data);
            }
          } catch (err) {
            console.error('[IPC] Failed to parse style details:', err);
            resolve(null);
          }
        } else {
          console.error('[IPC] get-style-details failed:', errorOutput);
          resolve(null);
        }
      });
      
      python.on('error', (err) => {
        console.error('[IPC] get-style-details spawn error:', err);
        resolve(null);
      });
    });
  });
  
  /**
   * Save a custom style
   */
  ipcMain.handle('save-custom-style', async (_event, customStyle: Record<string, unknown>) => {
    return new Promise((resolve, reject) => {
      if (!customStyle) {
        resolve({ success: false, error: 'No style data provided' });
        return;
      }
      
      const scriptPath = getPythonScriptPath('save_custom_style.py');
      const styleJson = JSON.stringify(customStyle);
      
      const python = spawn(pythonCmd, [scriptPath, styleJson], {
        env: {
          ...process.env,
          PODFLOW_CUSTOM_STYLES_DIR: getCustomStylesDir()
        }
      });
      
      let output = '';
      let errorOutput = '';
      
      python.stdout.on('data', (data) => {
        output += data.toString();
      });
      
      python.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });
      
      python.on('close', (code) => {
        if (code === 0) {
          try {
            resolve(JSON.parse(output));
          } catch (err) {
            resolve({ success: true });
          }
        } else {
          console.error('[IPC] save-custom-style failed:', errorOutput);
          resolve({ success: false, error: errorOutput });
        }
      });
      
      python.on('error', (err) => {
        console.error('[IPC] save-custom-style spawn error:', err);
        resolve({ success: false, error: err.message });
      });
    });
  });
  
  /**
   * Get export format presets
   */
  ipcMain.handle('get-export-formats', async () => {
    return new Promise((resolve, reject) => {
      const scriptPath = getPythonScriptPath('list_export_formats.py');
      
      const python = spawn(pythonCmd, [scriptPath]);
      
      let output = '';
      let errorOutput = '';
      
      python.stdout.on('data', (data) => {
        output += data.toString();
      });
      
      python.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });
      
      python.on('close', (code) => {
        if (code === 0) {
          try {
            resolve(JSON.parse(output));
          } catch (err) {
            console.error('[IPC] Failed to parse export formats:', err);
            resolve([]);
          }
        } else {
          console.error('[IPC] get-export-formats failed:', errorOutput);
          resolve([]);
        }
      });
      
      python.on('error', (err) => {
        console.error('[IPC] get-export-formats spawn error:', err);
        resolve([]);
      });
    });
  });
  
  console.log('[IPC] Style handlers registered');
}
