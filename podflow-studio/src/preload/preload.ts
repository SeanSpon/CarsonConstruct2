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
  // AI Provider settings (for chat assistant)
  anthropicApiKey?: string;
  geminiApiKey?: string;
  ollamaHost?: string;
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

// Project creation result type
export interface ProjectCreateResult {
  success: boolean;
  projectPath?: string;
  projectName?: string;
  projectFile?: string;
  error?: string;
}

// Media Library types
export type MediaLibraryItemType = 'video' | 'audio' | 'broll' | 'music' | 'sfx';

export interface MediaLibraryItem {
  id: string;
  name: string;
  fileName: string;
  originalPath: string;
  libraryPath: string;
  type: MediaLibraryItemType;
  size: number;
  duration?: number;
  resolution?: string;
  width?: number;
  height?: number;
  fps?: number;
  thumbnailPath?: string;
  addedAt: string;
  tags?: string[];
}

// Expose API to renderer
contextBridge.exposeInMainWorld('api', {
  // Project operations
  getDefaultProjectsDir: (): Promise<string> =>
    ipcRenderer.invoke('get-default-projects-dir'),
  
  selectProjectLocation: (defaultPath?: string): Promise<string | null> =>
    ipcRenderer.invoke('select-project-location', defaultPath),
  
  createProject: (data: { name: string; location: string }): Promise<ProjectCreateResult> =>
    ipcRenderer.invoke('create-project', data),

  // File operations
  selectFile: (): Promise<FileInfo | null> => 
    ipcRenderer.invoke('select-file'),
  
  validateFile: (filePath: string): Promise<FileValidation> => 
    ipcRenderer.invoke('validate-file', filePath),
  
  selectOutputDir: (): Promise<string | null> => 
    ipcRenderer.invoke('select-output-dir'),

  // Extract waveform data from video/audio file
  extractWaveform: (filePath: string, numPoints?: number): Promise<{
    success: boolean;
    waveform?: number[];
    error?: string;
  }> => ipcRenderer.invoke('extract-waveform', filePath, numPoints || 500),

  // Multi-camera file operations
  selectCameraFiles: (): Promise<{
    success: boolean;
    files: Array<{
      id: string;
      name: string;
      filePath: string;
      fileName: string;
      size: number;
      speakerName?: string;
      isMain: boolean;
    }>;
    error?: string;
  }> => ipcRenderer.invoke('select-camera-files'),
  
  validateCameraFiles: (filePaths: string[]): Promise<{
    success: boolean;
    files: Array<{
      filePath: string;
      valid: boolean;
      duration?: number;
      resolution?: string;
      width?: number;
      height?: number;
      fps?: number;
      error?: string;
    }>;
    error?: string;
  }> => ipcRenderer.invoke('validate-camera-files', filePaths),

  // Camera switching
  generateCameraCuts: (data: {
    cameras: Array<{
      id: string;
      name: string;
      filePath: string;
      speakerId?: string;
      isMain: boolean;
      isReaction?: boolean;
    }>;
    speakerSegments: Array<{
      speakerId: string;
      speakerLabel?: string;
      startTime: number;
      endTime: number;
      confidence?: number;
    }>;
    speakerToCamera: Record<string, string>;
    totalDuration: number;
    pacing?: 'fast' | 'moderate' | 'slow';
    minCutDuration?: number;
    maxCutDuration?: number;
    reactionShotProbability?: number;
  }): Promise<{
    success: boolean;
    result?: {
      cuts: Array<{
        id: string;
        cameraId: string;
        startTime: number;
        endTime: number;
        reason: string;
        confidence: number;
        duration: number;
      }>;
      totalDuration: number;
      cutCount: number;
      averageCutLength: number;
      camerasUsed: string[];
    };
    error?: string;
  }> => ipcRenderer.invoke('generate-camera-cuts', data),

  autoMapSpeakersToCameras: (data: {
    cameras: Array<{
      id: string;
      name: string;
      filePath: string;
      speakerId?: string;
      isMain: boolean;
    }>;
    speakerSegments: Array<{
      speakerId: string;
      startTime: number;
      endTime: number;
    }>;
  }): Promise<{
    success: boolean;
    speakerToCamera: Record<string, string>;
    speakerStats: Array<{
      speakerId: string;
      speakingTime: number;
      assignedCamera: string | null;
    }>;
  }> => ipcRenderer.invoke('auto-map-speakers-to-cameras', data),

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

  // Auto-fix a single QA issue
  autoFixQAIssue: (data: {
    issue: {
      id: string;
      type: string;
      severity: 'error' | 'warning' | 'info';
      timestamp?: number;
      message: string;
      autoFixable: boolean;
      fixData?: {
        clipId?: string;
        suggestedStart?: number;
        suggestedEnd?: number;
        action?: string;
      };
    };
    clips: Array<{
      id: string;
      startTime: number;
      endTime: number;
      title?: string;
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
    transcript?: {
      words?: Array<{
        word: string;
        start: number;
        end: number;
      }>;
    };
  }): Promise<{
    success: boolean;
    fix?: {
      type: string;
      clipId?: string;
      deadSpaceId?: string;
      trimStartOffset?: number;
      trimEndOffset?: number;
      remove?: boolean;
    };
    message?: string;
    error?: string;
  }> => ipcRenderer.invoke('auto-fix-qa-issue', data),

  // Auto-fix all fixable QA issues
  autoFixAllQAIssues: (data: {
    issues: Array<{
      id: string;
      type: string;
      severity: 'error' | 'warning' | 'info';
      timestamp?: number;
      message: string;
      autoFixable: boolean;
      fixData?: {
        clipId?: string;
        suggestedStart?: number;
        suggestedEnd?: number;
        action?: string;
      };
    }>;
    clips: Array<{
      id: string;
      startTime: number;
      endTime: number;
      title?: string;
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
    transcript?: {
      words?: Array<{
        word: string;
        start: number;
        end: number;
      }>;
    };
  }): Promise<{
    success: boolean;
    fixed: number;
    failed: number;
    fixes: Array<{
      issueId: string;
      fix: {
        type: string;
        clipId?: string;
        deadSpaceId?: string;
        trimStartOffset?: number;
        trimEndOffset?: number;
        remove?: boolean;
      };
      message: string;
    }>;
    errors: string[];
  }> => ipcRenderer.invoke('auto-fix-all-qa-issues', data),

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
  // AI Chat Functions (Auto-routing)
  // ========================================
  
  // Update AI provider configuration
  chatUpdateConfig: (config: {
    anthropicApiKey?: string;
    openaiApiKey?: string;
    geminiApiKey?: string;
    ollamaHost?: string;
  }): Promise<{
    success: boolean;
    availableProviders: string[];
  }> => ipcRenderer.invoke('chat-update-config', config),
  
  // Get available AI providers
  chatGetProviders: (): Promise<{
    available: string[];
    chatProvider: string | null;
    transcriptionProvider: string | null;
    visionProvider: string | null;
  }> => ipcRenderer.invoke('chat-get-providers'),
  
  // Chat with AI (auto-routes to best provider)
  chatWithAI: (data: {
    messages: Array<{
      role: 'user' | 'assistant' | 'system';
      content: string;
    }>;
    tools?: boolean;
    systemPrompt?: string;
    providerConfig?: {
      anthropicApiKey?: string;
      openaiApiKey?: string;
      geminiApiKey?: string;
      ollamaHost?: string;
    };
  }): Promise<{
    success: boolean;
    content?: string;
    thinking?: string;
    toolCalls?: Array<{
      id: string;
      name: string;
      arguments: Record<string, unknown>;
    }>;
    requiresToolResults?: boolean;
    error?: string;
    provider?: string;
    model?: string;
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
    systemPrompt?: string;
    providerConfig?: {
      anthropicApiKey?: string;
      openaiApiKey?: string;
      geminiApiKey?: string;
      ollamaHost?: string;
    };
  }): Promise<{
    success: boolean;
    content?: string;
    thinking?: string;
    toolCalls?: Array<{
      id: string;
      name: string;
      arguments: Record<string, unknown>;
    }>;
    requiresToolResults?: boolean;
    error?: string;
    provider?: string;
    model?: string;
  }> => ipcRenderer.invoke('chat-continue-with-tools', data),

  // ========================================
  // Media Library Functions
  // ========================================
  
  // Get library path
  mediaLibraryGetPath: (): Promise<string> =>
    ipcRenderer.invoke('media-library-get-path'),
  
  // Get all items in the library
  mediaLibraryGetItems: (): Promise<{
    success: boolean;
    items: MediaLibraryItem[];
    libraryPath?: string;
    error?: string;
  }> => ipcRenderer.invoke('media-library-get-items'),
  
  // Import files to library
  mediaLibraryImport: (data: {
    type: MediaLibraryItemType;
    filePaths?: string[];
  }): Promise<{
    success: boolean;
    items: MediaLibraryItem[];
    canceled?: boolean;
    errors?: string[];
    error?: string;
  }> => ipcRenderer.invoke('media-library-import', data),
  
  // Update media item metadata
  mediaLibraryUpdateItem: (data: {
    id: string;
    updates: Partial<MediaLibraryItem>;
  }): Promise<{
    success: boolean;
    item?: MediaLibraryItem;
    error?: string;
  }> => ipcRenderer.invoke('media-library-update-item', data),
  
  // Remove item from library
  mediaLibraryRemove: (data: {
    id: string;
    deleteFile?: boolean;
  }): Promise<{
    success: boolean;
    error?: string;
  }> => ipcRenderer.invoke('media-library-remove', data),
  
  // Open library folder in file explorer
  mediaLibraryOpenFolder: (subfolder?: string): Promise<{
    success: boolean;
    error?: string;
  }> => ipcRenderer.invoke('media-library-open-folder', subfolder),
  
  // Get library statistics
  mediaLibraryGetStats: (): Promise<{
    success: boolean;
    stats?: {
      totalItems: number;
      totalSize: number;
      countByType: Record<MediaLibraryItemType, number>;
      libraryPath: string;
      createdAt: string;
      updatedAt: string;
    };
    error?: string;
  }> => ipcRenderer.invoke('media-library-get-stats'),
  
  // Search library
  mediaLibrarySearch: (data: {
    query: string;
    type?: MediaLibraryItemType;
  }): Promise<{
    success: boolean;
    items: MediaLibraryItem[];
    error?: string;
  }> => ipcRenderer.invoke('media-library-search', data),
  
  // Add tags to item
  mediaLibraryAddTags: (data: {
    id: string;
    tags: string[];
  }): Promise<{
    success: boolean;
    tags?: string[];
    error?: string;
  }> => ipcRenderer.invoke('media-library-add-tags', data),
});

// Type declaration for the window object
declare global {
  interface Window {
    api: {
      // Project operations
      getDefaultProjectsDir: () => Promise<string>;
      selectProjectLocation: (defaultPath?: string) => Promise<string | null>;
      createProject: (data: { name: string; location: string }) => Promise<ProjectCreateResult>;
      selectFile: () => Promise<FileInfo | null>;
      validateFile: (filePath: string) => Promise<FileValidation>;
      selectOutputDir: () => Promise<string | null>;
      extractWaveform: (filePath: string, numPoints?: number) => Promise<{
        success: boolean;
        waveform?: number[];
        error?: string;
      }>;
      // Multi-camera operations
      selectCameraFiles: () => Promise<{
        success: boolean;
        files: Array<{
          id: string;
          name: string;
          filePath: string;
          fileName: string;
          size: number;
          speakerName?: string;
          isMain: boolean;
        }>;
        error?: string;
      }>;
      validateCameraFiles: (filePaths: string[]) => Promise<{
        success: boolean;
        files: Array<{
          filePath: string;
          valid: boolean;
          duration?: number;
          resolution?: string;
          width?: number;
          height?: number;
          fps?: number;
          error?: string;
        }>;
        error?: string;
      }>;
      // Camera switching
      generateCameraCuts: (data: {
        cameras: Array<{
          id: string;
          name: string;
          filePath: string;
          speakerId?: string;
          isMain: boolean;
          isReaction?: boolean;
        }>;
        speakerSegments: Array<{
          speakerId: string;
          speakerLabel?: string;
          startTime: number;
          endTime: number;
          confidence?: number;
        }>;
        speakerToCamera: Record<string, string>;
        totalDuration: number;
        pacing?: 'fast' | 'moderate' | 'slow';
        minCutDuration?: number;
        maxCutDuration?: number;
        reactionShotProbability?: number;
      }) => Promise<{
        success: boolean;
        result?: {
          cuts: Array<{
            id: string;
            cameraId: string;
            startTime: number;
            endTime: number;
            reason: string;
            confidence: number;
            duration: number;
          }>;
          totalDuration: number;
          cutCount: number;
          averageCutLength: number;
          camerasUsed: string[];
        };
        error?: string;
      }>;
      autoMapSpeakersToCameras: (data: {
        cameras: Array<{
          id: string;
          name: string;
          filePath: string;
          speakerId?: string;
          isMain: boolean;
        }>;
        speakerSegments: Array<{
          speakerId: string;
          startTime: number;
          endTime: number;
        }>;
      }) => Promise<{
        success: boolean;
        speakerToCamera: Record<string, string>;
        speakerStats: Array<{
          speakerId: string;
          speakingTime: number;
          assignedCamera: string | null;
        }>;
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
      autoFixQAIssue: (data: {
        issue: {
          id: string;
          type: string;
          severity: 'error' | 'warning' | 'info';
          timestamp?: number;
          message: string;
          autoFixable: boolean;
          fixData?: {
            clipId?: string;
            suggestedStart?: number;
            suggestedEnd?: number;
            action?: string;
          };
        };
        clips: Array<{
          id: string;
          startTime: number;
          endTime: number;
          title?: string;
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
        transcript?: {
          words?: Array<{
            word: string;
            start: number;
            end: number;
          }>;
        };
      }) => Promise<{
        success: boolean;
        fix?: {
          type: string;
          clipId?: string;
          deadSpaceId?: string;
          trimStartOffset?: number;
          trimEndOffset?: number;
          remove?: boolean;
        };
        message?: string;
        error?: string;
      }>;
      autoFixAllQAIssues: (data: {
        issues: Array<{
          id: string;
          type: string;
          severity: 'error' | 'warning' | 'info';
          timestamp?: number;
          message: string;
          autoFixable: boolean;
          fixData?: {
            clipId?: string;
            suggestedStart?: number;
            suggestedEnd?: number;
            action?: string;
          };
        }>;
        clips: Array<{
          id: string;
          startTime: number;
          endTime: number;
          title?: string;
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
        transcript?: {
          words?: Array<{
            word: string;
            start: number;
            end: number;
          }>;
        };
      }) => Promise<{
        success: boolean;
        fixed: number;
        failed: number;
        fixes: Array<{
          issueId: string;
          fix: {
            type: string;
            clipId?: string;
            deadSpaceId?: string;
            trimStartOffset?: number;
            trimEndOffset?: number;
            remove?: boolean;
          };
          message: string;
        }>;
        errors: string[];
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
      
      // AI Chat (Auto-routing)
      chatUpdateConfig: (config: {
        anthropicApiKey?: string;
        openaiApiKey?: string;
        geminiApiKey?: string;
        ollamaHost?: string;
      }) => Promise<{
        success: boolean;
        availableProviders: string[];
      }>;
      chatGetProviders: () => Promise<{
        available: string[];
        chatProvider: string | null;
        transcriptionProvider: string | null;
        visionProvider: string | null;
      }>;
      chatWithAI: (data: {
        messages: Array<{
          role: 'user' | 'assistant' | 'system';
          content: string;
        }>;
        tools?: boolean;
        systemPrompt?: string;
        providerConfig?: {
          anthropicApiKey?: string;
          openaiApiKey?: string;
          geminiApiKey?: string;
          ollamaHost?: string;
        };
      }) => Promise<{
        success: boolean;
        content?: string;
        thinking?: string;
        toolCalls?: Array<{
          id: string;
          name: string;
          arguments: Record<string, unknown>;
        }>;
        requiresToolResults?: boolean;
        error?: string;
        provider?: string;
        model?: string;
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
        systemPrompt?: string;
        providerConfig?: {
          anthropicApiKey?: string;
          openaiApiKey?: string;
          geminiApiKey?: string;
          ollamaHost?: string;
        };
      }) => Promise<{
        success: boolean;
        content?: string;
        thinking?: string;
        toolCalls?: Array<{
          id: string;
          name: string;
          arguments: Record<string, unknown>;
        }>;
        requiresToolResults?: boolean;
        error?: string;
        provider?: string;
        model?: string;
      }>;
      
      // Media Library
      mediaLibraryGetPath: () => Promise<string>;
      mediaLibraryGetItems: () => Promise<{
        success: boolean;
        items: MediaLibraryItem[];
        libraryPath?: string;
        error?: string;
      }>;
      mediaLibraryImport: (data: {
        type: MediaLibraryItemType;
        filePaths?: string[];
      }) => Promise<{
        success: boolean;
        items: MediaLibraryItem[];
        canceled?: boolean;
        errors?: string[];
        error?: string;
      }>;
      mediaLibraryUpdateItem: (data: {
        id: string;
        updates: Partial<MediaLibraryItem>;
      }) => Promise<{
        success: boolean;
        item?: MediaLibraryItem;
        error?: string;
      }>;
      mediaLibraryRemove: (data: {
        id: string;
        deleteFile?: boolean;
      }) => Promise<{
        success: boolean;
        error?: string;
      }>;
      mediaLibraryOpenFolder: (subfolder?: string) => Promise<{
        success: boolean;
        error?: string;
      }>;
      mediaLibraryGetStats: () => Promise<{
        success: boolean;
        stats?: {
          totalItems: number;
          totalSize: number;
          countByType: Record<MediaLibraryItemType, number>;
          libraryPath: string;
          createdAt: string;
          updatedAt: string;
        };
        error?: string;
      }>;
      mediaLibrarySearch: (data: {
        query: string;
        type?: MediaLibraryItemType;
      }) => Promise<{
        success: boolean;
        items: MediaLibraryItem[];
        error?: string;
      }>;
      mediaLibraryAddTags: (data: {
        id: string;
        tags: string[];
      }) => Promise<{
        success: boolean;
        tags?: string[];
        error?: string;
      }>;
    };
  }
}
