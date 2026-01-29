/**
 * IPC handlers for project storage and history management
 */
import { ipcMain, app } from 'electron';
import { spawn } from 'child_process';
import path from 'path';

// Get the path to Python scripts
function getPythonScriptPath(scriptName: string): string {
  // In development, scripts are in src/worker/scripts
  // In production, they're bundled with the app
  const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
  
  if (isDev) {
    return path.join(__dirname, '../../worker/scripts', scriptName);
  }
  
  return path.join(process.resourcesPath, 'worker/scripts', scriptName);
}

// Get projects directory path
function getProjectsDir(): string {
  return path.join(app.getPath('userData'), 'projects');
}

// Python command based on platform
const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';

export function registerProjectHandlers() {
  console.log('[IPC] Registering project handlers');
  
  /**
   * List all projects
   */
  ipcMain.handle('list-projects', async (_event, options?: { status?: string }) => {
    return new Promise((resolve, reject) => {
      const status = options?.status || 'all';
      const scriptPath = getPythonScriptPath('list_projects.py');
      
      const python = spawn(pythonCmd, [scriptPath, status], {
        env: {
          ...process.env,
          PODFLOW_PROJECTS_DIR: getProjectsDir()
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
            console.error('[IPC] Failed to parse projects:', err);
            resolve([]);
          }
        } else {
          console.error('[IPC] list-projects failed:', errorOutput);
          resolve([]);
        }
      });
      
      python.on('error', (err) => {
        console.error('[IPC] list-projects spawn error:', err);
        resolve([]);
      });
    });
  });
  
  /**
   * Get a single project by ID
   */
  ipcMain.handle('get-project', async (_event, projectId: string) => {
    return new Promise((resolve, reject) => {
      if (!projectId) {
        resolve(null);
        return;
      }
      
      const scriptPath = getPythonScriptPath('get_project.py');
      
      const python = spawn(pythonCmd, [scriptPath, projectId], {
        env: {
          ...process.env,
          PODFLOW_PROJECTS_DIR: getProjectsDir()
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
            const data = JSON.parse(output);
            if (data.error) {
              resolve(null);
            } else {
              resolve(data);
            }
          } catch (err) {
            console.error('[IPC] Failed to parse project:', err);
            resolve(null);
          }
        } else {
          console.error('[IPC] get-project failed:', errorOutput);
          resolve(null);
        }
      });
      
      python.on('error', (err) => {
        console.error('[IPC] get-project spawn error:', err);
        resolve(null);
      });
    });
  });
  
  /**
   * Delete a project by ID
   */
  ipcMain.handle('delete-project', async (_event, projectId: string) => {
    return new Promise((resolve, reject) => {
      if (!projectId) {
        resolve({ success: false, error: 'No project ID provided' });
        return;
      }
      
      const scriptPath = getPythonScriptPath('delete_project.py');
      
      const python = spawn(pythonCmd, [scriptPath, projectId], {
        env: {
          ...process.env,
          PODFLOW_PROJECTS_DIR: getProjectsDir()
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
          console.error('[IPC] delete-project failed:', errorOutput);
          resolve({ success: false, error: errorOutput });
        }
      });
      
      python.on('error', (err) => {
        console.error('[IPC] delete-project spawn error:', err);
        resolve({ success: false, error: err.message });
      });
    });
  });
  
  /**
   * Get storage statistics
   */
  ipcMain.handle('get-storage-stats', async () => {
    return new Promise((resolve, reject) => {
      const scriptPath = getPythonScriptPath('storage_stats.py');
      
      const python = spawn(pythonCmd, [scriptPath], {
        env: {
          ...process.env,
          PODFLOW_PROJECTS_DIR: getProjectsDir()
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
            console.error('[IPC] Failed to parse stats:', err);
            resolve({
              total_projects: 0,
              total_clips: 0,
              total_size_mb: 0,
              total_size_gb: 0
            });
          }
        } else {
          console.error('[IPC] get-storage-stats failed:', errorOutput);
          resolve({
            total_projects: 0,
            total_clips: 0,
            total_size_mb: 0,
            total_size_gb: 0
          });
        }
      });
      
      python.on('error', (err) => {
        console.error('[IPC] get-storage-stats spawn error:', err);
        resolve({
          total_projects: 0,
          total_clips: 0,
          total_size_mb: 0,
          total_size_gb: 0
        });
      });
    });
  });
  
  /**
   * Get projects directory path
   */
  ipcMain.handle('get-projects-dir', async () => {
    return getProjectsDir();
  });
  
  console.log('[IPC] Project handlers registered');
}
