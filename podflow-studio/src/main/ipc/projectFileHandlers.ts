import { ipcMain, dialog, app } from 'electron';
import fs from 'fs/promises';
import path from 'path';
import { getMainWindow } from '../window';

// Project file extension
const PROJECT_EXTENSION = '.podflow';
const PROJECT_FILTER = { name: 'PodFlow Project', extensions: ['podflow'] };

// Auto-save directory
const getAutoSaveDir = () => path.join(app.getPath('userData'), 'autosave');

// Recent projects file
const getRecentProjectsPath = () => path.join(app.getPath('userData'), 'recent-projects.json');

interface ProjectFileMeta {
  filePath: string;
  name: string;
  modifiedAt: string;
}

export function registerProjectFileHandlers() {
  
  // Save project file (with dialog)
  ipcMain.handle('project-save-as', async (_event, projectData: string) => {
    try {
      const mainWindow = getMainWindow();
      if (!mainWindow) {
        return { success: false, error: 'No main window' };
      }
      
      const result = await dialog.showSaveDialog(mainWindow, {
        title: 'Save Project',
        defaultPath: 'untitled.podflow',
        filters: [PROJECT_FILTER],
      });
      
      if (result.canceled || !result.filePath) {
        return { success: false, canceled: true };
      }
      
      let filePath = result.filePath;
      if (!filePath.endsWith(PROJECT_EXTENSION)) {
        filePath += PROJECT_EXTENSION;
      }
      
      await fs.writeFile(filePath, projectData, 'utf-8');
      
      // Add to recent projects
      await addRecentProject({ filePath, name: path.basename(filePath), modifiedAt: new Date().toISOString() });
      
      return { success: true, filePath };
    } catch (error) {
      console.error('[Project] Save error:', error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });
  
  // Save project file (to existing path)
  ipcMain.handle('project-save', async (_event, filePath: string, projectData: string) => {
    try {
      await fs.writeFile(filePath, projectData, 'utf-8');
      
      // Update recent projects
      await addRecentProject({ filePath, name: path.basename(filePath), modifiedAt: new Date().toISOString() });
      
      return { success: true, filePath };
    } catch (error) {
      console.error('[Project] Save error:', error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });
  
  // Open project file (with dialog)
  ipcMain.handle('project-open', async () => {
    try {
      const mainWindow = getMainWindow();
      if (!mainWindow) {
        return { success: false, error: 'No main window' };
      }
      
      const result = await dialog.showOpenDialog(mainWindow, {
        title: 'Open Project',
        filters: [PROJECT_FILTER],
        properties: ['openFile'],
      });
      
      if (result.canceled || result.filePaths.length === 0) {
        return { success: false, canceled: true };
      }
      
      const filePath = result.filePaths[0];
      const content = await fs.readFile(filePath, 'utf-8');
      
      // Add to recent projects
      await addRecentProject({ filePath, name: path.basename(filePath), modifiedAt: new Date().toISOString() });
      
      return { success: true, filePath, content };
    } catch (error) {
      console.error('[Project] Open error:', error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });
  
  // Load project from specific path
  ipcMain.handle('project-load', async (_event, filePath: string) => {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      
      // Add to recent projects
      await addRecentProject({ filePath, name: path.basename(filePath), modifiedAt: new Date().toISOString() });
      
      return { success: true, filePath, content };
    } catch (error) {
      console.error('[Project] Load error:', error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });
  
  // Auto-save project
  ipcMain.handle('project-autosave', async (_event, projectId: string, projectData: string) => {
    try {
      const autoSaveDir = getAutoSaveDir();
      await fs.mkdir(autoSaveDir, { recursive: true });
      
      const filePath = path.join(autoSaveDir, `${projectId}.podflow.autosave`);
      await fs.writeFile(filePath, projectData, 'utf-8');
      
      return { success: true, filePath };
    } catch (error) {
      console.error('[Project] Auto-save error:', error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });
  
  // Check for auto-save recovery
  ipcMain.handle('project-check-recovery', async (_event, projectId: string) => {
    try {
      const autoSaveDir = getAutoSaveDir();
      const filePath = path.join(autoSaveDir, `${projectId}.podflow.autosave`);
      
      try {
        const stats = await fs.stat(filePath);
        const content = await fs.readFile(filePath, 'utf-8');
        return { 
          success: true, 
          hasRecovery: true, 
          filePath, 
          content,
          recoveryDate: stats.mtime.toISOString(),
        };
      } catch {
        return { success: true, hasRecovery: false };
      }
    } catch (error) {
      console.error('[Project] Recovery check error:', error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });
  
  // Delete auto-save (after successful manual save)
  ipcMain.handle('project-clear-autosave', async (_event, projectId: string) => {
    try {
      const autoSaveDir = getAutoSaveDir();
      const filePath = path.join(autoSaveDir, `${projectId}.podflow.autosave`);
      
      try {
        await fs.unlink(filePath);
      } catch {
        // File doesn't exist, that's fine
      }
      
      return { success: true };
    } catch (error) {
      console.error('[Project] Clear auto-save error:', error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });
  
  // Get recent projects
  ipcMain.handle('project-get-recent', async () => {
    try {
      const recentPath = getRecentProjectsPath();
      try {
        const content = await fs.readFile(recentPath, 'utf-8');
        const projects = JSON.parse(content) as ProjectFileMeta[];
        
        // Filter out non-existent files
        const validProjects: ProjectFileMeta[] = [];
        for (const project of projects) {
          try {
            await fs.access(project.filePath);
            validProjects.push(project);
          } catch {
            // File no longer exists, skip it
          }
        }
        
        return { success: true, projects: validProjects };
      } catch {
        return { success: true, projects: [] };
      }
    } catch (error) {
      console.error('[Project] Get recent error:', error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });
  
  // Remove from recent projects
  ipcMain.handle('project-remove-recent', async (_event, filePath: string) => {
    try {
      const recentPath = getRecentProjectsPath();
      let projects: ProjectFileMeta[] = [];
      
      try {
        const content = await fs.readFile(recentPath, 'utf-8');
        projects = JSON.parse(content);
      } catch {
        // No file yet
      }
      
      projects = projects.filter(p => p.filePath !== filePath);
      await fs.writeFile(recentPath, JSON.stringify(projects, null, 2), 'utf-8');
      
      return { success: true };
    } catch (error) {
      console.error('[Project] Remove recent error:', error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });
  
  console.log('[Project] File handlers registered');
}

// Helper to add to recent projects
async function addRecentProject(project: ProjectFileMeta) {
  const recentPath = getRecentProjectsPath();
  let projects: ProjectFileMeta[] = [];
  
  try {
    const content = await fs.readFile(recentPath, 'utf-8');
    projects = JSON.parse(content);
  } catch {
    // No file yet
  }
  
  // Remove existing entry for this path
  projects = projects.filter(p => p.filePath !== project.filePath);
  
  // Add to front
  projects.unshift(project);
  
  // Keep only 20 recent projects
  projects = projects.slice(0, 20);
  
  await fs.writeFile(recentPath, JSON.stringify(projects, null, 2), 'utf-8');
}
