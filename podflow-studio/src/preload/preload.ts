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

  // QA Checks
  runQAChecks: (data: {
    clips: Array<{
      id: string;
      startTime: number;
      endTime: number;
      title?: string;
    }>;
    deadSpaces: Array<{
      id: string;
      startTime: number;
      endTime: number;
      duration: number;
      remove: boolean;
    }>;
    transcript?: {
      words?: Array<{
        word: string;
        start: number;
        end: number;
      }>;
    };
    duration: number;
  }): Promise<{
    success: boolean;
    passed?: boolean;
    issues?: Array<{
      id: string;
      type: string;
      severity: 'error' | 'warning' | 'info';
      timestamp?: number;
      message: string;
      autoFixable: boolean;
    }>;
    errorCount?: number;
    warningCount?: number;
    infoCount?: number;
    error?: string;
  }> => ipcRenderer.invoke('run-qa-checks', data),

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

  // Cloud / Google Drive
  checkCloudAuth: (): Promise<{ isAuthenticated: boolean; hasCredentials: boolean }> =>
    ipcRenderer.invoke('cloud-check-auth'),
  
  startCloudAuth: (): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke('cloud-start-auth'),
  
  signOutCloud: (): Promise<{ success: boolean }> =>
    ipcRenderer.invoke('cloud-sign-out'),
  
  uploadToCloud: (data: {
    files: Array<{ filePath: string; fileName?: string }>;
    folderId?: string;
    folderName?: string;
  }): Promise<{
    success: boolean;
    totalFiles: number;
    successCount: number;
    results: Array<{
      filePath: string;
      success: boolean;
      fileId?: string;
      webViewLink?: string;
      error?: string;
    }>;
  }> => ipcRenderer.invoke('cloud-upload-batch', data),
  
  getCloudShareLink: (fileId: string): Promise<{ success: boolean; link?: string; error?: string }> =>
    ipcRenderer.invoke('cloud-get-link', fileId),
  
  onCloudUploadProgress: (callback: (data: {
    bytesUploaded: number;
    totalBytes: number;
    percentage: number;
    currentFile?: number;
    totalFiles?: number;
    fileName?: string;
  }) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: any) => callback(data);
    ipcRenderer.on('cloud-upload-progress', handler);
    return () => ipcRenderer.removeListener('cloud-upload-progress', handler);
  },

  // Export with audio mixing
  exportWithAudioMix: (data: {
    sourceFile: string;
    outputFile: string;
    startTime: number;
    endTime: number;
    audioTracks: Array<{
      id: string;
      type: 'main' | 'broll' | 'sfx' | 'music';
      filePath?: string;
      startTime: number;
      endTime: number;
      volume: number;
      fadeIn?: number;
      fadeOut?: number;
    }>;
    mode: 'fast' | 'accurate';
  }): Promise<{ success: boolean; outputFile?: string; error?: string }> =>
    ipcRenderer.invoke('export-with-audio-mix', data),

  // ========================================
  // Premiere Pro / NLE Export Functions
  // ========================================

  // Export to FCP XML (compatible with Premiere Pro, DaVinci Resolve, Final Cut Pro)
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
      category?: string;
      hookText?: string;
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

  // Export to EDL (universal NLE format)
  exportEdl: (data: {
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
      hookText?: string;
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
    ipcRenderer.invoke('export-edl', data),

  // Export markers CSV (for Premiere Pro marker import)
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
      category?: string;
      hookText?: string;
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

  // Export Premiere Pro markers JSON
  exportPremiereMarkers: (data: {
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
      category?: string;
      hookText?: string;
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
    ipcRenderer.invoke('export-premiere-markers', data),

  // Export all NLE formats at once
  exportAllNleFormats: (data: {
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
      category?: string;
      hookText?: string;
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
  }): Promise<{
    success: boolean;
    totalFormats?: number;
    successCount?: number;
    results?: Array<{
      format: string;
      success: boolean;
      path?: string;
      error?: string;
    }>;
    outputDir?: string;
    error?: string;
  }> => ipcRenderer.invoke('export-all-nle-formats', data),

  // Event listener for NLE export progress
  onNleExportProgress: (callback: (data: { format: string; status: string }) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: any) => callback(data);
    ipcRenderer.on('nle-export-progress', handler);
    return () => ipcRenderer.removeListener('nle-export-progress', handler);
  },

  // AI Effects
  applyAiEffect: (data: {
    effect: string;
    clipId: string;
    clip: {
      id: string;
      startTime: number;
      endTime: number;
      duration: number;
      [key: string]: any;
    };
    projectPath: string;
  }): Promise<{
    success: boolean;
    effect?: string;
    clipId?: string;
    message?: string;
    error?: string;
  }> => ipcRenderer.invoke('apply-ai-effect', data),

  // ========================================
  // Project File Operations
  // ========================================
  
  // Save project with dialog
  projectSaveAs: (projectData: string): Promise<{
    success: boolean;
    filePath?: string;
    canceled?: boolean;
    error?: string;
  }> => ipcRenderer.invoke('project-save-as', projectData),
  
  // Save project to existing path
  projectSave: (filePath: string, projectData: string): Promise<{
    success: boolean;
    filePath?: string;
    error?: string;
  }> => ipcRenderer.invoke('project-save', filePath, projectData),
  
  // Open project with dialog
  projectOpen: (): Promise<{
    success: boolean;
    filePath?: string;
    content?: string;
    canceled?: boolean;
    error?: string;
  }> => ipcRenderer.invoke('project-open'),
  
  // Load project from path
  projectLoad: (filePath: string): Promise<{
    success: boolean;
    filePath?: string;
    content?: string;
    error?: string;
  }> => ipcRenderer.invoke('project-load', filePath),
  
  // Auto-save project
  projectAutoSave: (projectId: string, projectData: string): Promise<{
    success: boolean;
    filePath?: string;
    error?: string;
  }> => ipcRenderer.invoke('project-autosave', projectId, projectData),
  
  // Check for auto-save recovery
  projectCheckRecovery: (projectId: string): Promise<{
    success: boolean;
    hasRecovery?: boolean;
    filePath?: string;
    content?: string;
    recoveryDate?: string;
    error?: string;
  }> => ipcRenderer.invoke('project-check-recovery', projectId),
  
  // Clear auto-save after manual save
  projectClearAutoSave: (projectId: string): Promise<{
    success: boolean;
    error?: string;
  }> => ipcRenderer.invoke('project-clear-autosave', projectId),
  
  // Get recent projects
  projectGetRecent: (): Promise<{
    success: boolean;
    projects?: Array<{
      filePath: string;
      name: string;
      modifiedAt: string;
    }>;
    error?: string;
  }> => ipcRenderer.invoke('project-get-recent'),
  
  // Remove from recent projects
  projectRemoveRecent: (filePath: string): Promise<{
    success: boolean;
    error?: string;
  }> => ipcRenderer.invoke('project-remove-recent', filePath),

  // ========================================
  // Preview Functions
  // ========================================
  
  // Preview clips compilation (quick low-res render)
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
  
  // Clean up preview file
  cleanupPreview: (previewFile: string): Promise<{
    success: boolean;
    error?: string;
  }> => ipcRenderer.invoke('cleanup-preview', previewFile),
  
  // Event listener for preview progress
  onPreviewProgress: (callback: (data: { percent: number; message: string }) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: { percent: number; message: string }) => callback(data);
    ipcRenderer.on('preview-progress', handler);
    return () => ipcRenderer.removeListener('preview-progress', handler);
  },

  // ========================================
  // AI Chat Functions
  // ========================================
  
  // Chat with AI (supports tool calling)
  chatWithAI: (data: {
    messages: Array<{
      role: 'user' | 'assistant' | 'system';
      content: string;
    }>;
    model: string;
    apiKey: string;
    tools?: boolean;
    systemPrompt?: string;
  }): Promise<{
    success: boolean;
    content?: string;
    thinking?: string;
    toolCalls?: Array<{
      name: string;
      arguments: Record<string, unknown>;
    }>;
    requiresToolResults?: boolean;
    error?: string;
  }> => ipcRenderer.invoke('chat-with-ai', data),
  
  // Continue chat with tool results
  chatContinueWithTools: (data: {
    messages: Array<{
      role: 'user' | 'assistant' | 'system';
      content: string;
    }>;
    toolResults: Array<{
      toolName: string;
      result: unknown;
    }>;
    model: string;
    apiKey: string;
    systemPrompt?: string;
  }): Promise<{
    success: boolean;
    content?: string;
    thinking?: string;
    toolCalls?: Array<{
      name: string;
      arguments: Record<string, unknown>;
    }>;
    requiresToolResults?: boolean;
    error?: string;
  }> => ipcRenderer.invoke('chat-continue-with-tools', data),
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
      runQAChecks: (data: {
        clips: Array<{
          id: string;
          startTime: number;
          endTime: number;
          title?: string;
        }>;
        deadSpaces: Array<{
          id: string;
          startTime: number;
          endTime: number;
          duration: number;
          remove: boolean;
        }>;
        transcript?: {
          words?: Array<{
            word: string;
            start: number;
            end: number;
          }>;
        };
        duration: number;
      }) => Promise<{
        success: boolean;
        passed?: boolean;
        issues?: Array<{
          id: string;
          type: string;
          severity: 'error' | 'warning' | 'info';
          timestamp?: number;
          message: string;
          autoFixable: boolean;
        }>;
        errorCount?: number;
        warningCount?: number;
        infoCount?: number;
        error?: string;
      }>;
      onDetectionProgress: (callback: (data: DetectionProgress) => void) => () => void;
      onDetectionComplete: (callback: (data: DetectionResult) => void) => () => void;
      onDetectionError: (callback: (data: DetectionError) => void) => () => void;
      onExportProgress: (callback: (data: ExportProgress) => void) => () => void;
      onExportComplete: (callback: (data: ExportResult) => void) => () => void;
      // Cloud
      checkCloudAuth: () => Promise<{ isAuthenticated: boolean; hasCredentials: boolean }>;
      startCloudAuth: () => Promise<{ success: boolean; error?: string }>;
      signOutCloud: () => Promise<{ success: boolean }>;
      uploadToCloud: (data: {
        files: Array<{ filePath: string; fileName?: string }>;
        folderId?: string;
        folderName?: string;
      }) => Promise<{
        success: boolean;
        totalFiles: number;
        successCount: number;
        results: Array<{
          filePath: string;
          success: boolean;
          fileId?: string;
          webViewLink?: string;
          error?: string;
        }>;
      }>;
      getCloudShareLink: (fileId: string) => Promise<{ success: boolean; link?: string; error?: string }>;
      onCloudUploadProgress: (callback: (data: {
        bytesUploaded: number;
        totalBytes: number;
        percentage: number;
        currentFile?: number;
        totalFiles?: number;
        fileName?: string;
      }) => void) => () => void;
      // Audio mix export
      exportWithAudioMix: (data: {
        sourceFile: string;
        outputFile: string;
        startTime: number;
        endTime: number;
        audioTracks: Array<{
          id: string;
          type: 'main' | 'broll' | 'sfx' | 'music';
          filePath?: string;
          startTime: number;
          endTime: number;
          volume: number;
          fadeIn?: number;
          fadeOut?: number;
        }>;
        mode: 'fast' | 'accurate';
      }) => Promise<{ success: boolean; outputFile?: string; error?: string }>;
      
      // Premiere Pro / NLE Export
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
          category?: string;
          hookText?: string;
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
      }) => Promise<{ success: boolean; path?: string; error?: string }>;
      
      exportEdl: (data: {
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
          hookText?: string;
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
      }) => Promise<{ success: boolean; path?: string; error?: string }>;
      
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
          category?: string;
          hookText?: string;
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
      }) => Promise<{ success: boolean; path?: string; error?: string }>;
      
      exportPremiereMarkers: (data: {
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
          category?: string;
          hookText?: string;
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
      }) => Promise<{ success: boolean; path?: string; error?: string }>;
      
      exportAllNleFormats: (data: {
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
          category?: string;
          hookText?: string;
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
      }) => Promise<{
        success: boolean;
        totalFormats?: number;
        successCount?: number;
        results?: Array<{
          format: string;
          success: boolean;
          path?: string;
          error?: string;
        }>;
        outputDir?: string;
        error?: string;
      }>;
      
      onNleExportProgress: (callback: (data: { format: string; status: string }) => void) => () => void;
      
      // AI Effects
      applyAiEffect: (data: {
        effect: string;
        clipId: string;
        clip: {
          id: string;
          startTime: number;
          endTime: number;
          duration: number;
          [key: string]: any;
        };
        projectPath: string;
      }) => Promise<{
        success: boolean;
        effect?: string;
        clipId?: string;
        message?: string;
        error?: string;
      }>;
      
      // Project File Operations
      projectSaveAs: (projectData: string) => Promise<{
        success: boolean;
        filePath?: string;
        canceled?: boolean;
        error?: string;
      }>;
      projectSave: (filePath: string, projectData: string) => Promise<{
        success: boolean;
        filePath?: string;
        error?: string;
      }>;
      projectOpen: () => Promise<{
        success: boolean;
        filePath?: string;
        content?: string;
        canceled?: boolean;
        error?: string;
      }>;
      projectLoad: (filePath: string) => Promise<{
        success: boolean;
        filePath?: string;
        content?: string;
        error?: string;
      }>;
      projectAutoSave: (projectId: string, projectData: string) => Promise<{
        success: boolean;
        filePath?: string;
        error?: string;
      }>;
      projectCheckRecovery: (projectId: string) => Promise<{
        success: boolean;
        hasRecovery?: boolean;
        filePath?: string;
        content?: string;
        recoveryDate?: string;
        error?: string;
      }>;
      projectClearAutoSave: (projectId: string) => Promise<{
        success: boolean;
        error?: string;
      }>;
      projectGetRecent: () => Promise<{
        success: boolean;
        projects?: Array<{
          filePath: string;
          name: string;
          modifiedAt: string;
        }>;
        error?: string;
      }>;
      projectRemoveRecent: (filePath: string) => Promise<{
        success: boolean;
        error?: string;
      }>;
      
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
      }) => Promise<{
        success: boolean;
        previewFile?: string;
        error?: string;
      }>;
      cleanupPreview: (previewFile: string) => Promise<{
        success: boolean;
        error?: string;
      }>;
      onPreviewProgress: (callback: (data: { percent: number; message: string }) => void) => () => void;
      
      // AI Chat
      chatWithAI: (data: {
        messages: Array<{
          role: 'user' | 'assistant' | 'system';
          content: string;
        }>;
        model: string;
        apiKey: string;
        tools?: boolean;
        systemPrompt?: string;
      }) => Promise<{
        success: boolean;
        content?: string;
        thinking?: string;
        toolCalls?: Array<{
          name: string;
          arguments: Record<string, unknown>;
        }>;
        requiresToolResults?: boolean;
        error?: string;
      }>;
      chatContinueWithTools: (data: {
        messages: Array<{
          role: 'user' | 'assistant' | 'system';
          content: string;
        }>;
        toolResults: Array<{
          toolName: string;
          result: unknown;
        }>;
        model: string;
        apiKey: string;
        systemPrompt?: string;
      }) => Promise<{
        success: boolean;
        content?: string;
        thinking?: string;
        toolCalls?: Array<{
          name: string;
          arguments: Record<string, unknown>;
        }>;
        requiresToolResults?: boolean;
        error?: string;
      }>;
    };
  }
}
