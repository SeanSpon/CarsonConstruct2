/**
 * Project File Manager
 * 
 * Handles saving/loading .podflow project files that contain:
 * - Full project state (clips, dead spaces, transcript)
 * - UI state (timeline zoom, selected clip, panel sizes)
 * - Editing preferences and settings
 * - Cached AI results
 */

import { useStore } from './store';
import type {
  Project,
  Clip,
  DeadSpace,
  Transcript,
  EditingPreferences,
  CameraInput,
  CameraCut,
  SpeakerSegment,
  AudioTrack,
  QACheck,
  DetectionSettings,
  ExportSettings,
  TimelineGroup,
} from '../types';

// Project file format version for migration support
// INCREMENT THIS when adding new fields to ProjectFile interface!
// Then add migration logic in parseProjectFile() below.
const PROJECT_FILE_VERSION = '1.2.0';

// Version history:
// 1.0.0 - Initial release
// 1.1.0 - Added effects panel tab, expanded categories, proper defaults
// 1.2.0 - Added timelineGroups, clip effects, audio track enhancements

// UI state to persist
export interface UIState {
  timelineZoom: number;
  selectedClipId: string | null;
  currentTime: number;
  isPlaying: boolean;
  showQAPanel: boolean;
  effectsPanelTab: 'effects' | 'properties';
  expandedCategories: {
    ai: boolean;
    video: boolean;
    audio: boolean;
    text: boolean;
  };
}

// Full project file structure
export interface ProjectFile {
  version: string;
  meta: {
    name: string;
    createdAt: string;
    modifiedAt: string;
    projectFilePath?: string;
  };
  
  // Source video
  source: Project | null;
  
  // Detection results
  clips: Clip[];
  deadSpaces: DeadSpace[];
  transcript: Transcript | null;
  
  // Editing setup
  editingPreferences: EditingPreferences | null;
  setupComplete: boolean;
  
  // Multi-camera
  cameras: CameraInput[];
  cameraCuts: CameraCut[];
  speakerSegments: SpeakerSegment[];
  
  // Audio
  audioTracks: AudioTrack[];
  
  // Timeline groups
  timelineGroups: TimelineGroup[];
  
  // QA
  qaChecks: QACheck[];
  
  // Settings
  detectionSettings: DetectionSettings;
  exportSettings: ExportSettings;
  
  // UI State
  uiState: UIState;
  
  // Cache for AI results (to avoid re-processing)
  cache: {
    aiEnhancements?: Record<string, any>;
    waveformData?: number[];
    thumbnails?: string[];
  };
}

// Default UI state
const defaultUIState: UIState = {
  timelineZoom: 1,
  selectedClipId: null,
  currentTime: 0,
  isPlaying: false,
  showQAPanel: false,
  effectsPanelTab: 'effects',
  expandedCategories: {
    ai: true,
    video: true,
    audio: true,
    text: false,
  },
};

/**
 * Create a project file object from current store state
 */
export function createProjectFile(uiState?: Partial<UIState>): ProjectFile {
  const state = useStore.getState();
  
  return {
    version: PROJECT_FILE_VERSION,
    meta: {
      name: state.project?.fileName || 'Untitled Project',
      createdAt: new Date().toISOString(),
      modifiedAt: new Date().toISOString(),
    },
    source: state.project,
    clips: state.clips,
    deadSpaces: state.deadSpaces,
    transcript: state.transcript,
    editingPreferences: state.editingPreferences,
    setupComplete: state.setupComplete,
    cameras: state.cameras,
    cameraCuts: state.cameraCuts,
    speakerSegments: state.speakerSegments,
    audioTracks: state.audioTracks,
    timelineGroups: state.timelineGroups,
    qaChecks: state.qaChecks,
    detectionSettings: state.settings,
    exportSettings: state.exportSettings,
    uiState: { ...defaultUIState, ...uiState },
    cache: {},
  };
}

/**
 * Load a project file into the store
 * Handles missing/null fields gracefully for backwards compatibility
 */
export function loadProjectFile(projectFile: ProjectFile): UIState {
  const {
    setProject,
    setResults,
    setEditingPreferences,
    setSetupComplete,
    setCameras,
    setCameraCuts,
    setSpeakerSegments,
    setAudioTracks,
    setTimelineGroups,
    setQAChecks,
    updateSettings,
    updateExportSettings,
  } = useStore.getState();
  
  console.log(`[Project] Loading project file v${projectFile.version}`);
  
  // Load source video (required for editor to function)
  if (projectFile.source) {
    setProject(projectFile.source);
  } else {
    console.warn('[Project] No source video in project file');
  }
  
  // Load detection results with null-safety
  setResults(
    Array.isArray(projectFile.clips) ? projectFile.clips : [],
    Array.isArray(projectFile.deadSpaces) ? projectFile.deadSpaces : [],
    projectFile.transcript ?? null
  );
  
  // Load editing preferences with null-safety
  setEditingPreferences(projectFile.editingPreferences ?? null);
  setSetupComplete(projectFile.setupComplete ?? false);
  
  // Load multi-camera with null-safety
  setCameras(Array.isArray(projectFile.cameras) ? projectFile.cameras : []);
  setCameraCuts(Array.isArray(projectFile.cameraCuts) ? projectFile.cameraCuts : []);
  setSpeakerSegments(Array.isArray(projectFile.speakerSegments) ? projectFile.speakerSegments : []);
  
  // Load audio tracks with null-safety
  setAudioTracks(Array.isArray(projectFile.audioTracks) ? projectFile.audioTracks : []);
  
  // Load timeline groups with null-safety
  setTimelineGroups(Array.isArray(projectFile.timelineGroups) ? projectFile.timelineGroups : []);
  
  // Load QA checks with null-safety
  setQAChecks(Array.isArray(projectFile.qaChecks) ? projectFile.qaChecks : []);
  
  // Load detection settings with defaults for missing fields
  if (projectFile.detectionSettings) {
    updateSettings({
      targetCount: projectFile.detectionSettings.targetCount ?? 10,
      minDuration: projectFile.detectionSettings.minDuration ?? 15,
      maxDuration: projectFile.detectionSettings.maxDuration ?? 90,
      skipIntro: projectFile.detectionSettings.skipIntro ?? 90,
      skipOutro: projectFile.detectionSettings.skipOutro ?? 60,
      useAiEnhancement: projectFile.detectionSettings.useAiEnhancement ?? true,
      openaiApiKey: projectFile.detectionSettings.openaiApiKey,
      debug: projectFile.detectionSettings.debug,
    });
  }
  
  // Load export settings with defaults for missing fields
  if (projectFile.exportSettings) {
    updateExportSettings({
      format: projectFile.exportSettings.format ?? 'mp4',
      mode: projectFile.exportSettings.mode ?? 'fast',
      exportClips: projectFile.exportSettings.exportClips ?? true,
      exportFullVideo: projectFile.exportSettings.exportFullVideo ?? false,
    });
  }
  
  // Return UI state with all required fields, filling in defaults
  const uiState = projectFile.uiState ?? defaultUIState;
  return {
    timelineZoom: uiState.timelineZoom ?? 1,
    selectedClipId: uiState.selectedClipId ?? null,
    currentTime: uiState.currentTime ?? 0,
    isPlaying: uiState.isPlaying ?? false,
    showQAPanel: uiState.showQAPanel ?? false,
    effectsPanelTab: uiState.effectsPanelTab ?? 'effects',
    expandedCategories: {
      ai: uiState.expandedCategories?.ai ?? true,
      video: uiState.expandedCategories?.video ?? true,
      audio: uiState.expandedCategories?.audio ?? true,
      text: uiState.expandedCategories?.text ?? false,
    },
  };
}

/**
 * Serialize project file to JSON string
 */
export function serializeProjectFile(projectFile: ProjectFile): string {
  return JSON.stringify(projectFile, null, 2);
}

/**
 * Parse project file from JSON string with migration support
 */
export function parseProjectFile(json: string): ProjectFile {
  const data = JSON.parse(json);
  
  // Version migration - handles loading older project files
  const originalVersion = data.version || '1.0.0';
  
  if (originalVersion !== PROJECT_FILE_VERSION) {
    console.log(`[Project] Migrating from v${originalVersion} to v${PROJECT_FILE_VERSION}`);
    
    // Migration from 1.0.0 to 1.1.0
    if (!data.version || data.version === '1.0.0') {
      // Ensure all required fields exist with defaults
      data.clips = data.clips || [];
      data.deadSpaces = data.deadSpaces || [];
      data.transcript = data.transcript || null;
      data.editingPreferences = data.editingPreferences || null;
      data.setupComplete = data.setupComplete ?? false;
      data.cameras = data.cameras || [];
      data.cameraCuts = data.cameraCuts || [];
      data.speakerSegments = data.speakerSegments || [];
      data.audioTracks = data.audioTracks || [];
      data.qaChecks = data.qaChecks || [];
      
      // Ensure detection settings have all fields
      data.detectionSettings = {
        targetCount: 10,
        minDuration: 15,
        maxDuration: 90,
        skipIntro: 90,
        skipOutro: 60,
        useAiEnhancement: true,
        ...data.detectionSettings,
      };
      
      // Ensure export settings have all fields
      data.exportSettings = {
        format: 'mp4',
        mode: 'fast',
        exportClips: true,
        exportFullVideo: false,
        ...data.exportSettings,
      };
      
      // Ensure UI state has all new fields
      data.uiState = {
        timelineZoom: 1,
        selectedClipId: null,
        currentTime: 0,
        isPlaying: false,
        showQAPanel: false,
        effectsPanelTab: 'effects',
        expandedCategories: {
          ai: true,
          video: true,
          audio: true,
          text: false,
        },
        ...data.uiState,
      };
      
      // Ensure expandedCategories exists in uiState
      if (data.uiState && !data.uiState.expandedCategories) {
        data.uiState.expandedCategories = {
          ai: true,
          video: true,
          audio: true,
          text: false,
        };
      }
      
      // Ensure effectsPanelTab exists
      if (data.uiState && !data.uiState.effectsPanelTab) {
        data.uiState.effectsPanelTab = 'effects';
      }
      
      // Ensure cache exists
      data.cache = data.cache || {};
      
      // Ensure meta exists
      data.meta = data.meta || {
        name: 'Untitled Project',
        createdAt: new Date().toISOString(),
        modifiedAt: new Date().toISOString(),
      };
      
      data.version = '1.1.0';
    }
    
    // Migration from 1.1.0 to 1.2.0
    if (data.version === '1.1.0') {
      // Add timelineGroups
      data.timelineGroups = data.timelineGroups || [];
      
      // Ensure clips have new fields (groupId, locked, appliedEffects)
      if (Array.isArray(data.clips)) {
        data.clips = data.clips.map((clip: any) => ({
          ...clip,
          groupId: clip.groupId ?? undefined,
          locked: clip.locked ?? false,
          appliedEffects: clip.appliedEffects ?? [],
        }));
      }
      
      // Ensure audio tracks have new fields (fileName, muted, locked, waveformData)
      if (Array.isArray(data.audioTracks)) {
        data.audioTracks = data.audioTracks.map((track: any) => ({
          ...track,
          fileName: track.fileName ?? track.filePath?.split(/[\\/]/).pop(),
          muted: track.muted ?? false,
          locked: track.locked ?? false,
          waveformData: track.waveformData ?? undefined,
        }));
      }
      
      data.version = '1.2.0';
    }
  }
  
  // Final validation - ensure all required fields exist
  return {
    version: data.version || PROJECT_FILE_VERSION,
    meta: data.meta || { name: 'Untitled', createdAt: new Date().toISOString(), modifiedAt: new Date().toISOString() },
    source: data.source || null,
    clips: data.clips || [],
    deadSpaces: data.deadSpaces || [],
    transcript: data.transcript || null,
    editingPreferences: data.editingPreferences || null,
    setupComplete: data.setupComplete ?? false,
    cameras: data.cameras || [],
    cameraCuts: data.cameraCuts || [],
    speakerSegments: data.speakerSegments || [],
    audioTracks: data.audioTracks || [],
    timelineGroups: data.timelineGroups || [],
    qaChecks: data.qaChecks || [],
    detectionSettings: data.detectionSettings || { targetCount: 10, minDuration: 15, maxDuration: 90, skipIntro: 90, skipOutro: 60, useAiEnhancement: true },
    exportSettings: data.exportSettings || { format: 'mp4', mode: 'fast', exportClips: true, exportFullVideo: false },
    uiState: data.uiState || defaultUIState,
    cache: data.cache || {},
  } as ProjectFile;
}

/**
 * Get suggested filename for project
 */
export function getSuggestedFilename(): string {
  const state = useStore.getState();
  if (state.project?.fileName) {
    // Remove video extension and add .podflow
    const baseName = state.project.fileName.replace(/\.[^/.]+$/, '');
    return `${baseName}.podflow`;
  }
  return 'untitled.podflow';
}

/**
 * Check if project has unsaved changes
 */
export function hasUnsavedChanges(savedProject: ProjectFile | null): boolean {
  if (!savedProject) return true;
  
  const current = createProjectFile();
  
  // Compare key fields (excluding timestamps and UI state)
  return (
    JSON.stringify(current.clips) !== JSON.stringify(savedProject.clips) ||
    JSON.stringify(current.deadSpaces) !== JSON.stringify(savedProject.deadSpaces) ||
    JSON.stringify(current.editingPreferences) !== JSON.stringify(savedProject.editingPreferences)
  );
}
