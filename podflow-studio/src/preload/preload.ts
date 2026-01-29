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
  resolution?: string;
  width?: number;
  height?: number;
  fps?: number;
  thumbnailPath?: string;
  bitrate?: number;
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

export type TransitionType = 'none' | 'crossfade' | 'dip-to-black';

export interface TransitionSettings {
  type: TransitionType;
  duration: number;
}

export interface ExportSettings {
  format: 'mp4' | 'mov';
  mode: 'fast' | 'accurate';
  exportClips: boolean;
  exportClipsCompilation: boolean;
  exportFullVideo: boolean;
  transition: TransitionSettings;
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
  speakers: unknown[];
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

  // Upload transcript
  uploadTranscript: (data: { projectId: string; videoHash: string }): Promise<{ success: boolean; segmentCount?: number; error?: string }> =>
    ipcRenderer.invoke('upload-transcript', data),

  // Extract waveform data from video/audio file
  extractWaveform: (filePath: string, numPoints?: number): Promise<{
    success: boolean;
    waveform?: number[];
    error?: string;
  }> => ipcRenderer.invoke('extract-waveform', filePath, numPoints || 500),

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
  
  // Auto-Edit Export: remove dead spaces + burn captions
  exportAutoEdit: (data: {
    sourceFile: string;
    outputDir: string;
    deadSpaces: Array<{ id: string; startTime: number; endTime: number; remove: boolean }>;
    transcript: { segments: Array<{ start: number; end: number; text: string }>; words?: unknown[]; text?: string } | null;
    videoDuration: number;
    burnCaptions: boolean;
    captionStyle?: 'viral' | 'minimal' | 'bold';
  }): Promise<{ success: boolean; outputDir?: string; outputFile?: string; error?: string }> =>
    ipcRenderer.invoke('export-auto-edit', data),
  
  openFolder: (path: string): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke('open-folder', path),

  // Load cached transcript for a file
  loadCachedTranscript: (filePath: string): Promise<{
    success: boolean;
    transcript?: { segments?: Array<{ text: string; start: number; end: number }>; text?: string; words?: Array<{ word: string; start: number; end: number }> };
    error?: string;
  }> => ipcRenderer.invoke('load-cached-transcript', filePath),

  // Vertical Reel Export (9:16 with captions)
  exportVerticalReel: (data: {
    sourceFile: string;
    outputDir: string;
    clipId: string;
    startTime: number;
    endTime: number;
    title?: string;
    transcript?: {
      words?: Array<{
        word: string;
        start: number;
        end: number;
      }>;
      segments?: Array<{
        text: string;
        start: number;
        end: number;
      }>;
    };
    captionSettings: {
      enabled: boolean;
      style: 'viral' | 'minimal' | 'bold';
      fontSize: number;
      position: 'bottom' | 'center';
    };
    inputWidth: number;
    inputHeight: number;
  }): Promise<{
    success: boolean;
    outputFile?: string;
    error?: string;
  }> => ipcRenderer.invoke('export-vertical-reel', data),

  // Batch vertical reel export
  exportVerticalReelsBatch: (data: {
    sourceFile: string;
    outputDir: string;
    clips: Array<{
      id: string;
      startTime: number;
      endTime: number;
      trimStartOffset: number;
      trimEndOffset: number;
      title?: string;
    }>;
    transcript?: {
      words?: Array<{
        word: string;
        start: number;
        end: number;
      }>;
      segments?: Array<{
        text: string;
        start: number;
        end: number;
      }>;
    };
    captionSettings: {
      enabled: boolean;
      style: 'viral' | 'minimal' | 'bold';
      fontSize: number;
      position: 'bottom' | 'center';
    };
    inputWidth: number;
    inputHeight: number;
  }): Promise<{
    success: boolean;
    total: number;
    successCount: number;
    results: Array<{
      clipId: string;
      success: boolean;
      outputFile?: string;
      error?: string;
    }>;
    outputDir?: string;
    error?: string;
  }> => ipcRenderer.invoke('export-vertical-reels-batch', data),

  // Clip project persistence
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

  // Vertical reel export progress
  onVerticalReelProgress: (callback: (data: {
    clipId: string;
    percent: number;
    message: string;
  }) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: { clipId: string; percent: number; message: string }) => callback(data);
    ipcRenderer.on('vertical-reel-progress', handler);
    return () => ipcRenderer.removeListener('vertical-reel-progress', handler);
  },

  // Project File Operations
  projectSaveAs: (projectData: string): Promise<{
    success: boolean;
    filePath?: string;
    canceled?: boolean;
    error?: string;
  }> => ipcRenderer.invoke('project-save-as', projectData),
  
  projectSave: (filePath: string, projectData: string): Promise<{
    success: boolean;
    filePath?: string;
    error?: string;
  }> => ipcRenderer.invoke('project-save', filePath, projectData),
  
  projectOpen: (): Promise<{
    success: boolean;
    filePath?: string;
    content?: string;
    canceled?: boolean;
    error?: string;
  }> => ipcRenderer.invoke('project-open'),
  
  projectLoad: (filePath: string): Promise<{
    success: boolean;
    filePath?: string;
    content?: string;
    error?: string;
  }> => ipcRenderer.invoke('project-load', filePath),
  
  projectGetRecent: (): Promise<{
    success: boolean;
    projects?: Array<{
      filePath: string;
      name: string;
      modifiedAt: string;
    }>;
    error?: string;
  }> => ipcRenderer.invoke('project-get-recent'),
  
  projectRemoveRecent: (filePath: string): Promise<{
    success: boolean;
    error?: string;
  }> => ipcRenderer.invoke('project-remove-recent', filePath),

  // Preview
  previewClipsCompilation: (data: {
    sourceFile: string;
    clips: Array<{
      id: string;
      startTime: number;
      endTime: number;
      trimStartOffset: number;
      trimEndOffset: number;
      title?: string;
    }>;
    transition: TransitionSettings;
  }): Promise<{
    success: boolean;
    previewFile?: string;
    error?: string;
  }> => ipcRenderer.invoke('preview-clips-compilation', data),
  
  cleanupPreview: (previewFile: string): Promise<{
    success: boolean;
    error?: string;
  }> => ipcRenderer.invoke('cleanup-preview', previewFile),
  
  onPreviewProgress: (callback: (data: { percent: number; message: string }) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: { percent: number; message: string }) => callback(data);
    ipcRenderer.on('preview-progress', handler);
    return () => ipcRenderer.removeListener('preview-progress', handler);
  },

  // Premiere Pro / NLE Export (keep for professional users)
  exportFcpXml: (data: {
    sourceFile: string;
    sequenceName: string;
    clips: Array<{
      id: string;
      name: string;
      startTime: number;
      endTime: number;
      duration: number;
      pattern?: string;
      finalScore?: number;
      trimStartOffset?: number;
      trimEndOffset?: number;
    }>;
    deadSpaces: Array<{
      id: string;
      startTime: number;
      endTime: number;
      duration: number;
      remove: boolean;
    }>;
    outputDir: string;
    frameRate: number;
    dropFrame: boolean;
    videoDuration: number;
    videoWidth?: number;
    videoHeight?: number;
  }): Promise<{ success: boolean; path?: string; error?: string }> =>
    ipcRenderer.invoke('export-fcp-xml', data),

  exportMarkersCsv: (data: {
    sourceFile: string;
    sequenceName: string;
    clips: Array<{
      id: string;
      name: string;
      startTime: number;
      endTime: number;
      duration: number;
      pattern?: string;
      finalScore?: number;
      trimStartOffset?: number;
      trimEndOffset?: number;
    }>;
    deadSpaces: Array<{
      id: string;
      startTime: number;
      endTime: number;
      duration: number;
      remove: boolean;
    }>;
    outputDir: string;
    frameRate: number;
    dropFrame: boolean;
    videoDuration: number;
  }): Promise<{ success: boolean; path?: string; error?: string }> =>
    ipcRenderer.invoke('export-markers-csv', data),

  // MVP Vertical Export
  exportMvpClips: (data: {
    sourceFile: string;
    clips: Array<{
      clip_id: string;
      start: number;
      end: number;
      duration: number;
      captionStyle?: 'viral' | 'minimal' | 'bold';
    }>;
    transcript: {
      segments?: Array<{ start: number; end: number; text: string }>;
      words?: Array<{ word: string; start: number; end: number }>;
    };
    outputDir: string;
    inputWidth: number;
    inputHeight: number;
    settings: {
      format: 'mp4' | 'mov';
      vertical: boolean;
      targetWidth: number;
      targetHeight: number;
      burnCaptions: boolean;
      captionStyle?: {
        fontName: string;
        fontSize: number;
        outline: number;
        shadow: number;
      };
    };
  }): Promise<{
    success: boolean;
    outputDir?: string;
    clips?: Array<{
      clipId: string;
      path: string;
      captionedPath?: string;
    }>;
    errors?: string[];
  }> => ipcRenderer.invoke('export-mvp-clips', data),

  // Get video dimensions
  getVideoDimensions: (filePath: string): Promise<{
    success: boolean;
    width?: number;
    height?: number;
    error?: string;
  }> => ipcRenderer.invoke('get-video-dimensions', filePath),

  // Window controls
  windowMinimize: () => ipcRenderer.send('window-minimize'),
  windowMaximize: () => ipcRenderer.send('window-maximize'),
  windowClose: () => ipcRenderer.send('window-close'),

  // Instagram/TikTok download
  instagramCheckYtdlp: (): Promise<{ available: boolean }> =>
    ipcRenderer.invoke('instagram-check-ytdlp'),
  
  instagramDownload: (data: { url: string }): Promise<{
    success: boolean;
    filePath?: string;
    fileName?: string;
    size?: number;
    videoId?: string;
    error?: string;
  }> => ipcRenderer.invoke('instagram-download', data),
  
  tiktokDownload: (data: { url: string }): Promise<{
    success: boolean;
    filePath?: string;
    fileName?: string;
    size?: number;
    error?: string;
  }> => ipcRenderer.invoke('tiktok-download', data),

  // Style analysis
  styleAnalyze: (data: { filePath: string; url?: string }): Promise<{
    success: boolean;
    features?: unknown;
    filePath?: string;
    error?: string;
  }> => ipcRenderer.invoke('style-analyze', data),
  
  styleAnalyzeCombine: (data: {
    files: Array<{ filePath: string; url?: string; weight?: number }>;
    name?: string;
  }): Promise<{
    success: boolean;
    combinedStyle?: unknown;
    individualStyles?: unknown[];
    filePath?: string;
    error?: string;
  }> => ipcRenderer.invoke('style-analyze-combine', data),

  // Multi-camera file selection
  selectCameraFiles: (): Promise<{
    success: boolean;
    files: Array<{
      id: string;
      name: string;
      filePath: string;
      fileName: string;
      size: number;
      isMain: boolean;
    }>;
    error?: string;
  }> => ipcRenderer.invoke('select-camera-files'),

  // ========================================
  // Project Storage & History
  // ========================================
  
  listProjects: (options?: { status?: string }): Promise<Array<{
    id: string;
    created_at: string;
    source_video_name: string;
    status: 'processing' | 'complete' | 'error';
    clips: unknown[];
    total_clips: number;
  }>> => ipcRenderer.invoke('list-projects', options),

  getProject: (projectId: string): Promise<{
    id: string;
    created_at: string;
    source_video: string;
    source_video_name: string;
    status: string;
    clips: unknown[];
    config: unknown;
  } | null> => ipcRenderer.invoke('get-project', projectId),

  deleteProject: (projectId: string): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke('delete-project', projectId),

  getStorageStats: (): Promise<{
    total_projects: number;
    total_clips: number;
    total_size_mb: number;
    total_size_gb: number;
  }> => ipcRenderer.invoke('get-storage-stats'),

  getProjectsDir: (): Promise<string> => ipcRenderer.invoke('get-projects-dir'),

  // ========================================
  // Style Presets
  // ========================================

  getStylePresets: (): Promise<Array<{
    id: string;
    name: string;
    description: string;
    emoji: string;
  }>> => ipcRenderer.invoke('get-style-presets'),

  getStyleDetails: (styleId: string): Promise<{
    name: string;
    description: string;
    emoji: string;
    cuts_per_minute: number;
    caption_style: string;
    caption_fontsize: number;
    caption_color: string;
    min_duration: number;
    max_duration: number;
    [key: string]: unknown;
  } | null> => ipcRenderer.invoke('get-style-details', styleId),

  saveCustomStyle: (style: Record<string, unknown>): Promise<{ success: boolean; filepath?: string; error?: string }> =>
    ipcRenderer.invoke('save-custom-style', style),

  getExportFormats: (): Promise<Array<{
    id: string;
    name: string;
    description: string;
    resolution: string;
    fps: number;
    max_duration: number | null;
  }>> => ipcRenderer.invoke('get-export-formats'),

  // ========================================
  // Secure Storage (API Keys)
  // ========================================
  
  secureStorageAvailable: (): Promise<boolean> =>
    ipcRenderer.invoke('secure-storage-available'),
  
  secureStorageSet: (key: string, value: string): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke('secure-storage-set', key, value),
  
  secureStorageGet: (key: string): Promise<{ success: boolean; value: string | null; error?: string }> =>
    ipcRenderer.invoke('secure-storage-get', key),
  
  secureStorageHas: (key: string): Promise<boolean> =>
    ipcRenderer.invoke('secure-storage-has', key),
  
  secureStorageDelete: (key: string): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke('secure-storage-delete', key),
  
  secureStorageList: (): Promise<string[]> =>
    ipcRenderer.invoke('secure-storage-list'),
});

// Type declaration for the window object
declare global {
  interface Window {
    api: {
      selectFile: () => Promise<FileInfo | null>;
      validateFile: (filePath: string) => Promise<FileValidation>;
      selectOutputDir: () => Promise<string | null>;
      uploadTranscript: (data: { projectId: string; videoHash: string }) => Promise<{ success: boolean; segmentCount?: number; error?: string }>;
      extractWaveform: (filePath: string, numPoints?: number) => Promise<{
        success: boolean;
        waveform?: number[];
        error?: string;
      }>;
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
      exportAutoEdit: (data: {
        sourceFile: string;
        outputDir: string;
        deadSpaces: Array<{ id: string; startTime: number; endTime: number; remove: boolean }>;
        transcript: { segments: Array<{ start: number; end: number; text: string }>; words?: unknown[]; text?: string } | null;
        videoDuration: number;
        burnCaptions: boolean;
        captionStyle?: 'viral' | 'minimal' | 'bold';
      }) => Promise<{ success: boolean; outputDir?: string; outputFile?: string; error?: string }>;
      openFolder: (path: string) => Promise<{ success: boolean; error?: string }>;
      loadCachedTranscript: (filePath: string) => Promise<{
        success: boolean;
        transcript?: { segments?: Array<{ text: string; start: number; end: number }>; text?: string; words?: Array<{ word: string; start: number; end: number }> };
        error?: string;
      }>;
      exportVerticalReel: (data: {
        sourceFile: string;
        outputDir: string;
        clipId: string;
        startTime: number;
        endTime: number;
        title?: string;
        transcript?: {
          words?: Array<{ word: string; start: number; end: number }>;
          segments?: Array<{ text: string; start: number; end: number }>;
        };
        captionSettings: {
          enabled: boolean;
          style: 'viral' | 'minimal' | 'bold';
          fontSize: number;
          position: 'bottom' | 'center';
        };
        inputWidth: number;
        inputHeight: number;
      }) => Promise<{ success: boolean; outputFile?: string; error?: string }>;
      exportVerticalReelsBatch: (data: {
        sourceFile: string;
        outputDir: string;
        clips: Array<{
          id: string;
          startTime: number;
          endTime: number;
          trimStartOffset: number;
          trimEndOffset: number;
          title?: string;
        }>;
        transcript?: {
          words?: Array<{ word: string; start: number; end: number }>;
          segments?: Array<{ text: string; start: number; end: number }>;
        };
        captionSettings: {
          enabled: boolean;
          style: 'viral' | 'minimal' | 'bold';
          fontSize: number;
          position: 'bottom' | 'center';
        };
        inputWidth: number;
        inputHeight: number;
      }) => Promise<{
        success: boolean;
        total: number;
        successCount: number;
        results: Array<{
          clipId: string;
          success: boolean;
          outputFile?: string;
          error?: string;
        }>;
        outputDir?: string;
        error?: string;
      }>;
      saveClipProject: (jobId: string, clipId: string, payload: unknown) => Promise<{ success: boolean; path?: string; error?: string }>;
      loadClipProject: (jobId: string, clipId: string) => Promise<{ success: boolean; payload?: unknown; error?: string }>;
      onDetectionProgress: (callback: (data: DetectionProgress) => void) => () => void;
      onDetectionComplete: (callback: (data: DetectionResult) => void) => () => void;
      onDetectionError: (callback: (data: DetectionError) => void) => () => void;
      onExportProgress: (callback: (data: ExportProgress) => void) => () => void;
      onExportComplete: (callback: (data: ExportResult) => void) => () => void;
      onVerticalReelProgress: (callback: (data: { clipId: string; percent: number; message: string }) => void) => () => void;
      projectSaveAs: (projectData: string) => Promise<{ success: boolean; filePath?: string; canceled?: boolean; error?: string }>;
      projectSave: (filePath: string, projectData: string) => Promise<{ success: boolean; filePath?: string; error?: string }>;
      projectOpen: () => Promise<{ success: boolean; filePath?: string; content?: string; canceled?: boolean; error?: string }>;
      projectLoad: (filePath: string) => Promise<{ success: boolean; filePath?: string; content?: string; error?: string }>;
      projectGetRecent: () => Promise<{ success: boolean; projects?: Array<{ filePath: string; name: string; modifiedAt: string }>; error?: string }>;
      projectRemoveRecent: (filePath: string) => Promise<{ success: boolean; error?: string }>;
      previewClipsCompilation: (data: {
        sourceFile: string;
        clips: Array<{ id: string; startTime: number; endTime: number; trimStartOffset: number; trimEndOffset: number; title?: string }>;
        transition: TransitionSettings;
      }) => Promise<{ success: boolean; previewFile?: string; error?: string }>;
      cleanupPreview: (previewFile: string) => Promise<{ success: boolean; error?: string }>;
      onPreviewProgress: (callback: (data: { percent: number; message: string }) => void) => () => void;
      exportFcpXml: (data: {
        sourceFile: string;
        sequenceName: string;
        clips: Array<{ id: string; name: string; startTime: number; endTime: number; duration: number; pattern?: string; finalScore?: number; trimStartOffset?: number; trimEndOffset?: number }>;
        deadSpaces: Array<{ id: string; startTime: number; endTime: number; duration: number; remove: boolean }>;
        outputDir: string;
        frameRate: number;
        dropFrame: boolean;
        videoDuration: number;
        videoWidth?: number;
        videoHeight?: number;
      }) => Promise<{ success: boolean; path?: string; error?: string }>;
      exportMarkersCsv: (data: {
        sourceFile: string;
        sequenceName: string;
        clips: Array<{ id: string; name: string; startTime: number; endTime: number; duration: number; pattern?: string; finalScore?: number; trimStartOffset?: number; trimEndOffset?: number }>;
        deadSpaces: Array<{ id: string; startTime: number; endTime: number; duration: number; remove: boolean }>;
        outputDir: string;
        frameRate: number;
        dropFrame: boolean;
        videoDuration: number;
      }) => Promise<{ success: boolean; path?: string; error?: string }>;
      exportMvpClips: (data: {
        sourceFile: string;
        clips: Array<{ clip_id: string; start: number; end: number; duration: number }>;
        transcript: { segments?: Array<{ start: number; end: number; text: string }> };
        outputDir: string;
        inputWidth: number;
        inputHeight: number;
        settings: {
          format: 'mp4' | 'mov';
          vertical: boolean;
          targetWidth: number;
          targetHeight: number;
          burnCaptions: boolean;
          captionStyle?: { fontName: string; fontSize: number; outline: number; shadow: number };
        };
      }) => Promise<{
        success: boolean;
        outputDir?: string;
        clips?: Array<{ clipId: string; path: string; captionedPath?: string }>;
        errors?: string[];
      }>;
      getVideoDimensions: (filePath: string) => Promise<{ success: boolean; width?: number; height?: number; error?: string }>;
      windowMinimize: () => void;
      windowMaximize: () => void;
      windowClose: () => void;
      instagramCheckYtdlp: () => Promise<{ available: boolean }>;
      instagramDownload: (data: { url: string }) => Promise<{ success: boolean; filePath?: string; fileName?: string; size?: number; videoId?: string; error?: string }>;
      tiktokDownload: (data: { url: string }) => Promise<{ success: boolean; filePath?: string; fileName?: string; size?: number; error?: string }>;
      styleAnalyze: (data: { filePath: string; url?: string }) => Promise<{ success: boolean; features?: unknown; filePath?: string; error?: string }>;
      styleAnalyzeCombine: (data: { files: Array<{ filePath: string; url?: string; weight?: number }>; name?: string }) => Promise<{ success: boolean; combinedStyle?: unknown; individualStyles?: unknown[]; filePath?: string; error?: string }>;
      selectCameraFiles: () => Promise<{ success: boolean; files: Array<{ id: string; name: string; filePath: string; fileName: string; size: number; isMain: boolean }>; error?: string }>;
      // Project Storage & History
      listProjects: (options?: { status?: string }) => Promise<Array<{ id: string; created_at: string; source_video_name: string; status: 'processing' | 'complete' | 'error'; clips: unknown[]; total_clips: number }>>;
      getProject: (projectId: string) => Promise<{ id: string; created_at: string; source_video: string; source_video_name: string; status: string; clips: unknown[]; config: unknown } | null>;
      deleteProject: (projectId: string) => Promise<{ success: boolean; error?: string }>;
      getStorageStats: () => Promise<{ total_projects: number; total_clips: number; total_size_mb: number; total_size_gb: number }>;
      getProjectsDir: () => Promise<string>;
      // Style Presets
      getStylePresets: () => Promise<Array<{ id: string; name: string; description: string; emoji: string }>>;
      getStyleDetails: (styleId: string) => Promise<{ name: string; description: string; emoji: string; cuts_per_minute: number; caption_style: string; caption_fontsize: number; caption_color: string; min_duration: number; max_duration: number; [key: string]: unknown } | null>;
      saveCustomStyle: (style: Record<string, unknown>) => Promise<{ success: boolean; filepath?: string; error?: string }>;
      getExportFormats: () => Promise<Array<{ id: string; name: string; description: string; resolution: string; fps: number; max_duration: number | null }>>;
      // Secure Storage (API Keys)
      secureStorageAvailable: () => Promise<boolean>;
      secureStorageSet: (key: string, value: string) => Promise<{ success: boolean; error?: string }>;
      secureStorageGet: (key: string) => Promise<{ success: boolean; value: string | null; error?: string }>;
      secureStorageHas: (key: string) => Promise<boolean>;
      secureStorageDelete: (key: string) => Promise<{ success: boolean; error?: string }>;
      secureStorageList: () => Promise<string[]>;
    };
  }
}
