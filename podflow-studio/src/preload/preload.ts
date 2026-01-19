import { contextBridge, ipcRenderer } from 'electron';

// Type definitions for the API
export interface FileInfo {
  path: string;
  name: string;
  size: number;
}

export interface FileValidation {
  valid: boolean;
  duration?: number;
  format?: string;
  error?: string;
}

export interface DetectionSettings {
  targetCount: number;
  minDuration: number;
  maxDuration: number;
  skipIntro: number;
  skipOutro: number;
  useAiEnhancement: boolean;
  openaiApiKey?: string;
  debug?: boolean;
}

export interface ExportSettings {
  format: 'mp4' | 'mov';
  mode: 'fast' | 'accurate';
  exportClips: boolean;
  exportFullVideo: boolean;
}

export interface DetectionProgress {
  projectId: string;
  progress: number;
  message: string;
}

export interface DetectionResult {
  projectId: string;
  clips: unknown[];
  deadSpaces: unknown[];
  transcript: unknown | null;
}

export interface DetectionError {
  projectId: string;
  error: string;
}

export interface ExportProgress {
  current: number;
  total: number;
  clipName: string;
  type: 'clip' | 'full';
}

export interface ExportResult {
  success: boolean;
  outputDir: string;
  clipCount?: number;
  errors?: string[];
}

// Expose API to renderer
contextBridge.exposeInMainWorld('api', {
  // File operations
  selectFile: (): Promise<FileInfo | null> => 
    ipcRenderer.invoke('select-file'),
  
  validateFile: (filePath: string): Promise<FileValidation> => 
    ipcRenderer.invoke('validate-file', filePath),
  
  selectOutputDir: (): Promise<string | null> => 
    ipcRenderer.invoke('select-output-dir'),

  // Detection
  startDetection: (
    projectId: string,
    filePath: string,
    settings: DetectionSettings,
    durationSeconds?: number,
  ): Promise<{ success: boolean; error?: string; queued?: boolean }> =>
    ipcRenderer.invoke('start-detection', { projectId, filePath, settings, durationSeconds }),
  
  cancelDetection: (projectId: string): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke('cancel-detection', projectId),

  // Export
  exportClips: (data: {
    sourceFile: string;
    clips: unknown[];
    deadSpaces: unknown[];
    outputDir: string;
    settings: ExportSettings;
  }): Promise<{ success: boolean; outputDir?: string; error?: string }> =>
    ipcRenderer.invoke('export-clips', data),
  
  openFolder: (path: string): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke('open-folder', path),

  saveClipProject: (jobId: string, clipId: string, payload: unknown): Promise<{ success: boolean; path?: string; error?: string }> =>
    ipcRenderer.invoke('save-clip-project', { jobId, clipId, payload }),

  loadClipProject: (jobId: string, clipId: string): Promise<{ success: boolean; payload?: unknown; error?: string }> =>
    ipcRenderer.invoke('load-clip-project', { jobId, clipId }),

  // Event listeners
  onDetectionProgress: (callback: (data: DetectionProgress) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: DetectionProgress) => callback(data);
    ipcRenderer.on('detection-progress', handler);
    return () => ipcRenderer.removeListener('detection-progress', handler);
  },

  onDetectionComplete: (callback: (data: DetectionResult) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: DetectionResult) => callback(data);
    ipcRenderer.on('detection-complete', handler);
    return () => ipcRenderer.removeListener('detection-complete', handler);
  },

  onDetectionError: (callback: (data: DetectionError) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: DetectionError) => callback(data);
    ipcRenderer.on('detection-error', handler);
    return () => ipcRenderer.removeListener('detection-error', handler);
  },

  onExportProgress: (callback: (data: ExportProgress) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: ExportProgress) => callback(data);
    ipcRenderer.on('export-progress', handler);
    return () => ipcRenderer.removeListener('export-progress', handler);
  },

  onExportComplete: (callback: (data: ExportResult) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: ExportResult) => callback(data);
    ipcRenderer.on('export-complete', handler);
    return () => ipcRenderer.removeListener('export-complete', handler);
  },
});

// Type declaration for the window object
declare global {
  interface Window {
    api: {
      selectFile: () => Promise<FileInfo | null>;
      validateFile: (filePath: string) => Promise<FileValidation>;
      selectOutputDir: () => Promise<string | null>;
      startDetection: (
        projectId: string,
        filePath: string,
        settings: DetectionSettings,
        durationSeconds?: number,
      ) => Promise<{ success: boolean; error?: string; queued?: boolean }>;
      cancelDetection: (projectId: string) => Promise<{ success: boolean; error?: string }>;
      exportClips: (data: {
        sourceFile: string;
        clips: unknown[];
        deadSpaces: unknown[];
        outputDir: string;
        settings: ExportSettings;
      }) => Promise<{ success: boolean; outputDir?: string; error?: string }>;
      openFolder: (path: string) => Promise<{ success: boolean; error?: string }>;
      saveClipProject: (jobId: string, clipId: string, payload: unknown) => Promise<{ success: boolean; path?: string; error?: string }>;
      loadClipProject: (jobId: string, clipId: string) => Promise<{ success: boolean; payload?: unknown; error?: string }>;
      onDetectionProgress: (callback: (data: DetectionProgress) => void) => () => void;
      onDetectionComplete: (callback: (data: DetectionResult) => void) => () => void;
      onDetectionError: (callback: (data: DetectionError) => void) => () => void;
      onExportProgress: (callback: (data: ExportProgress) => void) => () => void;
      onExportComplete: (callback: (data: ExportResult) => void) => () => void;
    };
  }
}
