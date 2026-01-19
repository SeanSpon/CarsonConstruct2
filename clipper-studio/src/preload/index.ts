import { contextBridge, ipcRenderer } from 'electron';

// Types for the API
export interface FileSelection {
  path: string;
  name: string;
  size: number;
}

export interface FileValidation {
  valid: boolean;
  duration: number;
  error: string | null;
}

export interface DetectionProgress {
  step: string;
  progress: number;
  message: string;
}

export interface DetectionResult {
  clips: DetectedClip[];
  waveform: number[];
}

export interface DetectedClip {
  id: string;
  startTime: number;
  endTime: number;
  score: number;
  pattern: string;
  patternLabel: string;
  hookStrength: number;
  status: 'pending' | 'accepted' | 'rejected';
  trimStartOffset: number;
  trimEndOffset: number;
}

export interface ExportProgress {
  current: number;
  total: number;
  clipId: string;
}

export interface ExportResult {
  success: boolean;
  outputDir: string;
  clipCount?: number;
  errors?: string[];
}

export interface ProjectCreateResult {
  success: boolean;
  projectPath?: string;
  projectName?: string;
  projectFile?: string;
  error?: string;
}

// Expose protected methods to renderer via window.api
const api = {
  // Project operations
  getDefaultProjectsDir: (): Promise<string> =>
    ipcRenderer.invoke('get-default-projects-dir'),
  
  selectProjectLocation: (defaultPath?: string): Promise<string | null> =>
    ipcRenderer.invoke('select-project-location', defaultPath),
  
  createProject: (data: { name: string; location: string }): Promise<ProjectCreateResult> =>
    ipcRenderer.invoke('create-project', data),

  // File operations
  selectFile: (): Promise<FileSelection | null> => 
    ipcRenderer.invoke('select-file'),
  
  validateFile: (filePath: string): Promise<FileValidation> => 
    ipcRenderer.invoke('validate-file', filePath),
  
  selectOutputDir: (): Promise<string | null> => 
    ipcRenderer.invoke('select-output-dir'),

  // Detection operations
  startDetection: (filePath: string): Promise<{ success: boolean; error?: string }> => 
    ipcRenderer.invoke('start-detection', filePath),
  
  cancelDetection: (): Promise<{ success: boolean; error?: string }> => 
    ipcRenderer.invoke('cancel-detection'),

  // Detection event listeners
  onDetectionProgress: (callback: (data: DetectionProgress) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, data: DetectionProgress) => callback(data);
    ipcRenderer.on('detection-progress', listener);
    return () => ipcRenderer.removeListener('detection-progress', listener);
  },

  onDetectionComplete: (callback: (data: DetectionResult) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, data: DetectionResult) => callback(data);
    ipcRenderer.on('detection-complete', listener);
    return () => ipcRenderer.removeListener('detection-complete', listener);
  },

  onDetectionError: (callback: (data: { error: string }) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, data: { error: string }) => callback(data);
    ipcRenderer.on('detection-error', listener);
    return () => ipcRenderer.removeListener('detection-error', listener);
  },

  // Export operations
  exportClips: (data: { sourceFile: string; clips: any[]; outputDir: string }): Promise<{ success: boolean; outputDir: string }> => 
    ipcRenderer.invoke('export-clips', data),

  onExportProgress: (callback: (data: ExportProgress) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, data: ExportProgress) => callback(data);
    ipcRenderer.on('export-progress', listener);
    return () => ipcRenderer.removeListener('export-progress', listener);
  },

  onExportComplete: (callback: (data: ExportResult) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, data: ExportResult) => callback(data);
    ipcRenderer.on('export-complete', listener);
    return () => ipcRenderer.removeListener('export-complete', listener);
  },

  // Utility
  openFolder: (path: string): Promise<{ success: boolean; error?: string }> => 
    ipcRenderer.invoke('open-folder', path),
};

contextBridge.exposeInMainWorld('api', api);

// TypeScript declaration for the window object
declare global {
  interface Window {
    api: typeof api;
  }
}
