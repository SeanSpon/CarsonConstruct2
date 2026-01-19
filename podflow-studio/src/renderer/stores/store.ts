import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { 
  Project, 
  Clip, 
  DeadSpace, 
  Transcript, 
  DetectionSettings, 
  DetectionProgress,
  ExportSettings,
  TransitionSettings,
  EditingPreferences,
  CameraInput,
  CameraCut,
  SpeakerSegment,
  AudioTrack,
  QACheck,
  TimelineGroup,
  AppliedEffect,
  TimelineMarker,
  HistoryEntry,
  ClipSpeed,
  ClipColorLabel,
  MediaLibraryItem,
  MediaLibraryItemType,
} from '../types';
import { HistoryState, captureHistoryState } from './historyMiddleware';

interface RecentProject {
  filePath: string;
  fileName: string;
  duration: number;
  lastOpened: number;
}

// AI Provider Settings (for capability router)
interface AISettings {
  anthropicApiKey?: string;
  openaiApiKey?: string;
  geminiApiKey?: string;
  ollamaHost?: string;
}

// Media Library State
interface MediaLibraryState {
  items: MediaLibraryItem[];
  isLoading: boolean;
  libraryPath: string | null;
  error: string | null;
}

interface AppState {
  // Current project
  project: Project | null;
  currentJobId: string | null;
  lastJobId: string | null;
  
  // Source audio waveform for timeline display
  sourceWaveform: number[] | null;
  isExtractingWaveform: boolean;
  
  // Project setup flow
  setupComplete: boolean;
  editingPreferences: EditingPreferences | null;
  
  // Multi-camera
  cameras: CameraInput[];
  cameraCuts: CameraCut[];
  speakerSegments: SpeakerSegment[];
  
  // Audio mixing
  audioTracks: AudioTrack[];
  
  // QA checks
  qaChecks: QACheck[];
  qaRunning: boolean;
  
  // Timeline groups
  timelineGroups: TimelineGroup[];
  
  // Timeline markers (Premiere Pro-style)
  markers: TimelineMarker[];
  
  // Edit modes (Premiere Pro-style)
  editMode: 'select' | 'ripple' | 'roll' | 'slip' | 'slide' | 'razor';
  insertMode: 'insert' | 'overwrite'; // Insert pushes clips, overwrite replaces
  
  // Detection state
  isDetecting: boolean;
  detectionProgress: DetectionProgress | null;
  detectionError: string | null;
  
  // Results
  clips: Clip[];
  deadSpaces: DeadSpace[];
  transcript: Transcript | null;
  
  // Settings
  settings: DetectionSettings;
  exportSettings: ExportSettings;
  aiSettings: AISettings;
  
  // Export state
  isExporting: boolean;
  exportProgress: { current: number; total: number; clipName: string } | null;
  lastExportDir: string | null;
  
  // Preview state
  isPreviewRendering: boolean;
  previewProgress: { percent: number; message: string } | null;
  previewFilePath: string | null;
  
  // Recent projects (persisted)
  recentProjects: RecentProject[];
  
  // Session state (persisted for restoration)
  lastRoute: string | null;
  
  // Media Library
  mediaLibrary: MediaLibraryState;
  
  // Actions - Project Setup
  setProject: (project: Project | null) => void;
  clearProject: () => void;
  setCurrentJobId: (jobId: string | null) => void;
  setLastJobId: (jobId: string | null) => void;
  setSetupComplete: (complete: boolean) => void;
  setEditingPreferences: (preferences: EditingPreferences | null) => void;
  
  // Actions - Source Waveform
  setSourceWaveform: (waveform: number[] | null) => void;
  setExtractingWaveform: (extracting: boolean) => void;
  
  // Actions - Multi-camera
  setCameras: (cameras: CameraInput[]) => void;
  addCamera: (camera: CameraInput) => void;
  removeCamera: (cameraId: string) => void;
  updateCamera: (cameraId: string, updates: Partial<CameraInput>) => void;
  setCameraCuts: (cuts: CameraCut[]) => void;
  addCameraCut: (cut: CameraCut) => void;
  removeCameraCut: (cutId: string) => void;
  updateCameraCut: (cutId: string, updates: Partial<CameraCut>) => void;
  setSpeakerSegments: (segments: SpeakerSegment[]) => void;
  
  // Actions - Audio
  setAudioTracks: (tracks: AudioTrack[]) => void;
  addAudioTrack: (track: AudioTrack) => void;
  removeAudioTrack: (trackId: string) => void;
  updateAudioTrack: (trackId: string, updates: Partial<AudioTrack>) => void;
  toggleAudioSolo: (trackId: string) => void; // Solo this track, mute others
  
  // Actions - QA
  setQAChecks: (checks: QACheck[]) => void;
  setQARunning: (running: boolean) => void;
  markQACheckFixed: (checkId: string) => void;
  
  // Actions - Timeline Groups
  setTimelineGroups: (groups: TimelineGroup[]) => void;
  addTimelineGroup: (group: TimelineGroup) => void;
  removeTimelineGroup: (groupId: string) => void;
  updateTimelineGroup: (groupId: string, updates: Partial<TimelineGroup>) => void;
  groupClips: (clipIds: string[], groupName?: string) => void;
  ungroupClips: (groupId: string) => void;
  
  // Actions - Markers
  addMarker: (marker: TimelineMarker) => void;
  removeMarker: (markerId: string) => void;
  updateMarker: (markerId: string, updates: Partial<TimelineMarker>) => void;
  goToMarker: (markerId: string) => number; // Returns marker time
  
  // Actions - Edit modes
  setEditMode: (mode: 'select' | 'ripple' | 'roll' | 'slip' | 'slide' | 'razor') => void;
  setInsertMode: (mode: 'insert' | 'overwrite') => void;
  
  // Actions - Clip editing
  splitClipAtTime: (clipId: string, splitTime: number) => void;
  duplicateClip: (clipId: string) => void;
  deleteClip: (clipId: string, ripple?: boolean) => void; // Ripple delete closes gaps
  moveClip: (clipId: string, newStartTime: number) => void;
  setClipSpeed: (clipId: string, speed: ClipSpeed) => void;
  setClipColorLabel: (clipId: string, color: ClipColorLabel) => void;
  setClipOpacity: (clipId: string, opacity: number) => void;
  setClipVolume: (clipId: string, volume: number) => void;
  setClipAudioDucking: (clipId: string, ducking: { enabled: boolean; targetVolume: number; fadeTime: number }) => void;
  addClipEffect: (clipId: string, effect: AppliedEffect) => void;
  removeClipEffect: (clipId: string, effectId: string) => void;
  toggleClipEffect: (clipId: string, effectId: string) => void;
  updateClipEffectParams: (clipId: string, effectId: string, params: Record<string, number | string | boolean>) => void;
  
  // Project file state
  projectFilePath: string | null;
  setProjectFilePath: (path: string | null) => void;
  lastAutoSaveTime: number | null;
  setLastAutoSaveTime: (time: number | null) => void;
  
  // Actions - Detection
  setDetecting: (isDetecting: boolean) => void;
  setDetectionProgress: (progress: DetectionProgress | null) => void;
  setDetectionError: (error: string | null) => void;
  
  setResults: (clips: Clip[], deadSpaces: DeadSpace[], transcript: Transcript | null) => void;
  
  updateClipStatus: (clipId: string, status: Clip['status']) => void;
  updateClipTrim: (clipId: string, trimStartOffset: number, trimEndOffset: number) => void;
  updateClipHook: (clipId: string, hookText: string, title?: string) => void;
  
  updateDeadSpaceRemove: (deadSpaceId: string, remove: boolean) => void;
  setAllDeadSpacesRemove: (remove: boolean) => void;
  
  updateSettings: (settings: Partial<DetectionSettings>) => void;
  updateExportSettings: (settings: Partial<ExportSettings>) => void;
  updateAiSettings: (settings: Partial<AISettings>) => void;
  
  setExporting: (isExporting: boolean) => void;
  setExportProgress: (progress: { current: number; total: number; clipName: string } | null) => void;
  setLastExportDir: (dir: string | null) => void;
  
  // Preview actions
  setPreviewRendering: (isRendering: boolean) => void;
  setPreviewProgress: (progress: { percent: number; message: string } | null) => void;
  setPreviewFilePath: (filePath: string | null) => void;
  
  addRecentProject: (project: RecentProject) => void;
  removeRecentProject: (filePath: string) => void;
  
  setLastRoute: (route: string | null) => void;
  
  // Actions - Media Library
  loadMediaLibrary: () => Promise<void>;
  importToMediaLibrary: (type: MediaLibraryItemType, filePaths?: string[]) => Promise<MediaLibraryItem[]>;
  removeFromMediaLibrary: (id: string, deleteFile?: boolean) => Promise<void>;
  updateMediaLibraryItem: (id: string, updates: Partial<MediaLibraryItem>) => Promise<void>;
  searchMediaLibrary: (query: string, type?: MediaLibraryItemType) => Promise<MediaLibraryItem[]>;
  openMediaLibraryFolder: (subfolder?: string) => Promise<void>;
  
  // Undo/Redo
  past: HistoryState[];
  future: HistoryState[];
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
  _addHistory: (state: HistoryState) => void;
  
  reset: () => void;
}

const defaultSettings: DetectionSettings = {
  targetCount: 10,
  minDuration: 15,
  maxDuration: 90,
  skipIntro: 30,  // Reduced from 90s for flexibility with shorter videos
  skipOutro: 30,  // Reduced from 60s for flexibility with shorter videos
  useAiEnhancement: true,
};

const defaultExportSettings: ExportSettings = {
  format: 'mp4',
  mode: 'fast',
  exportClips: false,           // Individual clip files (disabled by default)
  exportClipsCompilation: true,  // All clips joined into one video
  exportFullVideo: true,         // Full video with dead spaces removed
  transition: {
    type: 'crossfade',
    duration: 0.5,
  },
};

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      // Initial state
      project: null,
      currentJobId: null,
      lastJobId: null,
      sourceWaveform: null,
      isExtractingWaveform: false,
      setupComplete: false,
      editingPreferences: null,
      cameras: [],
      cameraCuts: [],
      speakerSegments: [],
      audioTracks: [],
      qaChecks: [],
      qaRunning: false,
      timelineGroups: [],
      markers: [],
      editMode: 'select',
      insertMode: 'insert',
      isDetecting: false,
      detectionProgress: null,
      detectionError: null,
      clips: [],
      deadSpaces: [],
      transcript: null,
      settings: defaultSettings,
      exportSettings: defaultExportSettings,
      aiSettings: {},
      isExporting: false,
      exportProgress: null,
      lastExportDir: null,
      isPreviewRendering: false,
      previewProgress: null,
      previewFilePath: null,
      recentProjects: [],
      lastRoute: null,
      projectFilePath: null,
      lastAutoSaveTime: null,
      mediaLibrary: {
        items: [],
        isLoading: false,
        libraryPath: null,
        error: null,
      },
      
      // History state
      past: [],
      future: [],

      // Project actions
      setProject: (project) => {
        set({ project });
        if (project) {
          get().addRecentProject({
            filePath: project.filePath,
            fileName: project.fileName,
            duration: project.duration,
            lastOpened: Date.now(),
          });
          
          // Auto-create a source clip if no clips exist yet
          // This allows immediate editing without running AI detection
          const currentClips = get().clips;
          if (currentClips.length === 0 && project.duration > 0) {
            const sourceClip: Clip = {
              id: `source_${Date.now()}`,
              startTime: 0,
              endTime: project.duration,
              duration: project.duration,
              pattern: 'monologue',
              patternLabel: 'Source',
              description: 'Full source video',
              algorithmScore: 0,
              hookStrength: 0,
              hookMultiplier: 1,
              finalScore: 0,
              trimStartOffset: 0,
              trimEndOffset: 0,
              status: 'pending',
              title: project.fileName?.replace(/\.[^/.]+$/, '') || 'Source',
            };
            set({ clips: [sourceClip] });
          }
        }
      },
      
      clearProject: () => set({
        project: null,
        currentJobId: null,
        lastJobId: null,
        sourceWaveform: null,
        isExtractingWaveform: false,
        setupComplete: false,
        editingPreferences: null,
        cameras: [],
        cameraCuts: [],
        speakerSegments: [],
        audioTracks: [],
        qaChecks: [],
        timelineGroups: [],
        clips: [],
        deadSpaces: [],
        transcript: null,
        detectionProgress: null,
        detectionError: null,
        lastRoute: null,
      }),
      
      setSetupComplete: (setupComplete) => set({ setupComplete }),
      
      setEditingPreferences: (editingPreferences) => set({ editingPreferences }),
      
      // Source waveform actions
      setSourceWaveform: (sourceWaveform) => set({ sourceWaveform }),
      setExtractingWaveform: (isExtractingWaveform) => set({ isExtractingWaveform }),
      
      // Multi-camera actions
      setCameras: (cameras) => set({ cameras }),
      
      addCamera: (camera) => set((state) => ({
        cameras: [...state.cameras, camera],
      })),
      
      removeCamera: (cameraId) => set((state) => ({
        cameras: state.cameras.filter((c) => c.id !== cameraId),
      })),
      
      updateCamera: (cameraId, updates) => set((state) => ({
        cameras: state.cameras.map((c) =>
          c.id === cameraId ? { ...c, ...updates } : c
        ),
      })),
      
      setCameraCuts: (cameraCuts) => set({ cameraCuts }),
      
      addCameraCut: (cut) => {
        const state = get();
        // Save history before making changes
        get()._addHistory(captureHistoryState(state));
        
        set((state) => ({
          cameraCuts: [...state.cameraCuts, cut].sort((a, b) => a.startTime - b.startTime),
        }));
      },
      
      removeCameraCut: (cutId) => {
        const state = get();
        // Save history before making changes
        get()._addHistory(captureHistoryState(state));
        
        set((state) => ({
          cameraCuts: state.cameraCuts.filter((c) => c.id !== cutId),
        }));
      },
      
      updateCameraCut: (cutId, updates) => {
        const state = get();
        // Save history before making changes
        get()._addHistory(captureHistoryState(state));
        
        set((state) => ({
          cameraCuts: state.cameraCuts.map((c) =>
            c.id === cutId ? { ...c, ...updates } : c
          ),
        }));
      },
      
      setSpeakerSegments: (speakerSegments) => set({ speakerSegments }),
      
      // Audio actions
      setAudioTracks: (audioTracks) => set({ audioTracks }),
      
      addAudioTrack: (track) => {
        const state = get();
        // Save history before making changes
        get()._addHistory(captureHistoryState(state));
        
        set((state) => ({
          audioTracks: [...state.audioTracks, track],
        }));
      },
      
      removeAudioTrack: (trackId) => {
        const state = get();
        // Save history before making changes
        get()._addHistory(captureHistoryState(state));
        
        set((state) => ({
          audioTracks: state.audioTracks.filter((t) => t.id !== trackId),
        }));
      },
      
      updateAudioTrack: (trackId, updates) => {
        const state = get();
        // Save history before making changes
        get()._addHistory(captureHistoryState(state));
        
        set((state) => ({
          audioTracks: state.audioTracks.map((t) =>
            t.id === trackId ? { ...t, ...updates } : t
          ),
        }));
      },
      
      toggleAudioSolo: (trackId) => {
        const state = get();
        const track = state.audioTracks.find((t) => t.id === trackId);
        if (!track) return;
        
        // Toggle solo on this track
        const newSoloState = !track.solo;
        
        set((state) => ({
          audioTracks: state.audioTracks.map((t) =>
            t.id === trackId ? { ...t, solo: newSoloState } : t
          ),
        }));
      },
      
      // QA actions
      setQAChecks: (qaChecks) => set({ qaChecks }),
      
      setQARunning: (qaRunning) => set({ qaRunning }),
      
      markQACheckFixed: (checkId) => set((state) => ({
        qaChecks: state.qaChecks.map((c) =>
          c.id === checkId ? { ...c, fixed: true } : c
        ),
      })),
      
      // Timeline groups actions
      setTimelineGroups: (timelineGroups) => set({ timelineGroups }),
      
      addTimelineGroup: (group) => {
        const state = get();
        // Save history before making changes
        get()._addHistory(captureHistoryState(state));
        
        set((state) => ({
          timelineGroups: [...state.timelineGroups, group],
        }));
      },
      
      removeTimelineGroup: (groupId) => {
        const state = get();
        // Save history before making changes
        get()._addHistory(captureHistoryState(state));
        
        set((state) => ({
          timelineGroups: state.timelineGroups.filter((g) => g.id !== groupId),
          clips: state.clips.map((c) =>
            c.groupId === groupId ? { ...c, groupId: undefined } : c
          ),
        }));
      },
      
      updateTimelineGroup: (groupId, updates) => {
        const state = get();
        // Save history before making changes
        get()._addHistory(captureHistoryState(state));
        
        set((state) => ({
          timelineGroups: state.timelineGroups.map((g) =>
            g.id === groupId ? { ...g, ...updates } : g
          ),
        }));
      },
      
      groupClips: (clipIds, groupName) => {
        const state = get();
        // Save history before making changes
        get()._addHistory(captureHistoryState(state));
        
        const groupId = `group_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        const colors = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6', '#3b82f6', '#8b5cf6', '#ec4899'];
        const color = colors[Math.floor(Math.random() * colors.length)];
        
        set((state) => ({
          timelineGroups: [...state.timelineGroups, {
            id: groupId,
            name: groupName || `Group ${state.timelineGroups.length + 1}`,
            color,
            itemIds: clipIds,
          }],
          clips: state.clips.map((c) =>
            clipIds.includes(c.id) ? { ...c, groupId } : c
          ),
        }));
      },
      
      ungroupClips: (groupId) => {
        const state = get();
        // Save history before making changes
        get()._addHistory(captureHistoryState(state));
        
        set((state) => ({
          timelineGroups: state.timelineGroups.filter((g) => g.id !== groupId),
          clips: state.clips.map((c) =>
            c.groupId === groupId ? { ...c, groupId: undefined } : c
          ),
        }));
      },
      
      // Marker actions
      addMarker: (marker) => {
        const state = get();
        get()._addHistory(captureHistoryState(state));
        
        set((state) => ({
          markers: [...state.markers, marker].sort((a, b) => a.time - b.time),
        }));
      },
      
      removeMarker: (markerId) => {
        const state = get();
        get()._addHistory(captureHistoryState(state));
        
        set((state) => ({
          markers: state.markers.filter((m) => m.id !== markerId),
        }));
      },
      
      updateMarker: (markerId, updates) => {
        const state = get();
        get()._addHistory(captureHistoryState(state));
        
        set((state) => ({
          markers: state.markers.map((m) =>
            m.id === markerId ? { ...m, ...updates } : m
          ),
        }));
      },
      
      goToMarker: (markerId) => {
        const marker = get().markers.find((m) => m.id === markerId);
        return marker?.time || 0;
      },
      
      // Edit mode actions
      setEditMode: (editMode) => set({ editMode }),
      
      setInsertMode: (insertMode) => set({ insertMode }),
      
      // Clip editing actions
      splitClipAtTime: (clipId, splitTime) => {
        const state = get();
        // Save history before making changes
        get()._addHistory(captureHistoryState(state));
        
        set((state) => {
          const clip = state.clips.find((c) => c.id === clipId);
          if (!clip) return state;
          
          // Calculate the actual playback boundaries (after trim offsets)
          const effectiveStart = clip.startTime + (clip.trimStartOffset || 0);
          const effectiveEnd = clip.endTime + (clip.trimEndOffset || 0);
          
          // Ensure split time is within the playable clip bounds
          if (splitTime <= effectiveStart || splitTime >= effectiveEnd) return state;
          
          const newClipId = `clip_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
          
          // Calculate how far into the SOURCE video we are at the split point
          // The split happens at a timeline position, but we need to map it to source video position
          // Distance into the visible clip (from effective start)
          const distanceIntoClip = splitTime - clip.startTime;
          
          // Source video position at split = original source start + distance into clip
          const sourcePositionAtSplit = clip.startTime + (clip.trimStartOffset || 0) + distanceIntoClip;
          
          // First part: from original source start to split position
          // Timeline: clip.startTime to splitTime
          // Source: (clip.startTime + trimStartOffset) to sourcePositionAtSplit
          const firstPart: Clip = {
            ...clip,
            endTime: splitTime,
            trimStartOffset: clip.trimStartOffset || 0, // Keep original start trim
            trimEndOffset: sourcePositionAtSplit - splitTime, // Trim to split point
            duration: splitTime - clip.startTime,
          };
          
          // Second part: from split position to original source end
          // Timeline: splitTime to clip.endTime
          // Source: sourcePositionAtSplit to (clip.endTime + trimEndOffset)
          const secondPart: Clip = {
            ...clip,
            id: newClipId,
            startTime: splitTime,
            endTime: clip.endTime,
            trimStartOffset: sourcePositionAtSplit - splitTime, // Start from split point in source
            trimEndOffset: clip.trimEndOffset || 0, // Keep original end trim
            duration: clip.endTime - splitTime,
            title: clip.title ? `${clip.title} (2)` : undefined,
          };
          
          return {
            clips: state.clips.flatMap((c) =>
              c.id === clipId ? [firstPart, secondPart] : [c]
            ).sort((a, b) => a.startTime - b.startTime),
          };
        });
      },
      
      duplicateClip: (clipId) => {
        const state = get();
        // Save history before making changes
        get()._addHistory(captureHistoryState(state));
        
        set((state) => {
          const clip = state.clips.find((c) => c.id === clipId);
          if (!clip) return state;
          
          const newClipId = `clip_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
          const newClip: Clip = {
            ...clip,
            id: newClipId,
            startTime: clip.endTime + 0.1, // Place right after original
            endTime: clip.endTime + 0.1 + clip.duration,
            title: clip.title ? `${clip.title} (copy)` : undefined,
            status: 'pending',
          };
          
          return {
            clips: [...state.clips, newClip].sort((a, b) => a.startTime - b.startTime),
          };
        });
      },
      
      deleteClip: (clipId, ripple = false) => {
        const state = get();
        // Save history before making changes
        get()._addHistory(captureHistoryState(state));
        
        const clip = state.clips.find((c) => c.id === clipId);
        if (!clip) return;
        
        set((state) => {
          let newClips = state.clips.filter((c) => c.id !== clipId);
          
          // Ripple delete: move all clips after deleted clip backward to close gap
          if (ripple) {
            const deletedDuration = clip.endTime - clip.startTime;
            newClips = newClips.map((c) =>
              c.startTime > clip.startTime
                ? {
                    ...c,
                    startTime: c.startTime - deletedDuration,
                    endTime: c.endTime - deletedDuration,
                  }
                : c
            );
          }
          
          return { clips: newClips };
        });
      },
      
      moveClip: (clipId, newStartTime) => {
        const state = get();
        // Save history before making changes
        get()._addHistory(captureHistoryState(state));
        
        set((state) => {
          const clip = state.clips.find((c) => c.id === clipId);
          if (!clip) return state;
          
          const duration = clip.endTime - clip.startTime;
          return {
            clips: state.clips.map((c) =>
              c.id === clipId
                ? { ...c, startTime: newStartTime, endTime: newStartTime + duration }
                : c
            ).sort((a, b) => a.startTime - b.startTime),
          };
        });
      },
      
      // Premiere Pro-style clip property actions
      setClipSpeed: (clipId, speed) => {
        const state = get();
        get()._addHistory(captureHistoryState(state));
        
        set((state) => {
          const clip = state.clips.find((c) => c.id === clipId);
          if (!clip) return state;
          
          // Calculate new duration based on speed
          const originalDuration = clip.endTime - clip.startTime;
          const newDuration = originalDuration / speed.speed;
          
          return {
            clips: state.clips.map((c) => {
              if (c.id === clipId) {
                let updatedClip = { ...c, speed, duration: newDuration };
                
                // If ripple mode, adjust end time
                if (speed.ripple) {
                  updatedClip.endTime = updatedClip.startTime + newDuration;
                  
                  // Shift all clips after this one
                  const timeDelta = newDuration - originalDuration;
                  return updatedClip;
                }
                
                return updatedClip;
              }
              
              // Ripple: shift clips after current clip
              if (speed.ripple && c.startTime > clip.startTime) {
                const timeDelta = (originalDuration / speed.speed) - originalDuration;
                return {
                  ...c,
                  startTime: c.startTime + timeDelta,
                  endTime: c.endTime + timeDelta,
                };
              }
              
              return c;
            }).sort((a, b) => a.startTime - b.startTime),
          };
        });
      },
      
      setClipColorLabel: (clipId, colorLabel) => {
        const state = get();
        get()._addHistory(captureHistoryState(state));
        
        set((state) => ({
          clips: state.clips.map((c) =>
            c.id === clipId ? { ...c, colorLabel } : c
          ),
        }));
      },
      
      setClipOpacity: (clipId, opacity) => {
        set((state) => ({
          clips: state.clips.map((c) =>
            c.id === clipId ? { ...c, opacity } : c
          ),
        }));
      },
      
      setClipVolume: (clipId, volume) => {
        set((state) => ({
          clips: state.clips.map((c) =>
            c.id === clipId ? { ...c, volume } : c
          ),
        }));
      },
      
      setClipAudioDucking: (clipId, audioDucking) => {
        const state = get();
        get()._addHistory(captureHistoryState(state));
        
        set((state) => ({
          clips: state.clips.map((c) =>
            c.id === clipId ? { ...c, audioDucking } : c
          ),
        }));
      },
      
      // Project file state actions
      setProjectFilePath: (projectFilePath) => set({ projectFilePath }),
      setLastAutoSaveTime: (lastAutoSaveTime) => set({ lastAutoSaveTime }),
      
      addClipEffect: (clipId, effect) => {
        const state = get();
        // Save history before making changes
        get()._addHistory(captureHistoryState(state));
        
        set((state) => ({
          clips: state.clips.map((c) =>
            c.id === clipId
              ? { ...c, appliedEffects: [...(c.appliedEffects || []), effect] }
              : c
          ),
        }));
      },
      
      removeClipEffect: (clipId, effectId) => {
        const state = get();
        // Save history before making changes
        get()._addHistory(captureHistoryState(state));
        
        set((state) => ({
          clips: state.clips.map((c) =>
            c.id === clipId
              ? { ...c, appliedEffects: (c.appliedEffects || []).filter((e) => e.id !== effectId) }
              : c
          ),
        }));
      },
      
      toggleClipEffect: (clipId, effectId) => {
        const state = get();
        // Save history before making changes
        get()._addHistory(captureHistoryState(state));
        
        set((state) => ({
          clips: state.clips.map((c) =>
            c.id === clipId
              ? {
                  ...c,
                  appliedEffects: (c.appliedEffects || []).map((e) =>
                    e.id === effectId ? { ...e, enabled: !e.enabled } : e
                  ),
                }
              : c
          ),
        }));
      },
      
      updateClipEffectParams: (clipId, effectId, params) => {
        const state = get();
        // Save history before making changes
        get()._addHistory(captureHistoryState(state));
        
        set((state) => ({
          clips: state.clips.map((c) =>
            c.id === clipId
              ? {
                  ...c,
                  appliedEffects: (c.appliedEffects || []).map((e) =>
                    e.id === effectId ? { ...e, parameters: { ...e.parameters, ...params } } : e
                  ),
                }
              : c
          ),
        }));
      },

      // Detection actions
      setDetecting: (isDetecting) => set({ isDetecting }),

      setCurrentJobId: (currentJobId) => set({ currentJobId }),
      setLastJobId: (lastJobId) => set({ lastJobId }),
      
      setDetectionProgress: (detectionProgress) => set({ 
        detectionProgress,
        detectionError: null,
      }),
      
      setDetectionError: (detectionError) => set({ 
        detectionError,
        isDetecting: false,
        detectionProgress: null,
      }),

      // Results actions
      setResults: (clips, deadSpaces, transcript) => set({
        clips,
        deadSpaces,
        transcript,
        isDetecting: false,
        detectionProgress: null,
      }),

      // Clip actions
      updateClipStatus: (clipId, status) => {
        const state = get();
        // Save history before making changes
        get()._addHistory(captureHistoryState(state));
        
        set((state) => ({
          clips: state.clips.map((clip) =>
            clip.id === clipId ? { ...clip, status } : clip
          ),
        }));
      },
      
      updateClipTrim: (clipId, trimStartOffset, trimEndOffset) => {
        const state = get();
        // Save history before making changes
        get()._addHistory(captureHistoryState(state));
        
        set((state) => ({
          clips: state.clips.map((clip) =>
            clip.id === clipId ? { ...clip, trimStartOffset, trimEndOffset } : clip
          ),
        }));
      },
      
      updateClipHook: (clipId, hookText, title) => {
        const state = get();
        // Save history before making changes
        get()._addHistory(captureHistoryState(state));
        
        set((state) => ({
          clips: state.clips.map((clip) =>
            clip.id === clipId 
              ? { ...clip, hookText, ...(title ? { title } : {}) } 
              : clip
          ),
        }));
      },

      // Dead space actions
      updateDeadSpaceRemove: (deadSpaceId, remove) => {
        const state = get();
        // Save history before making changes
        get()._addHistory(captureHistoryState(state));
        
        set((state) => ({
          deadSpaces: state.deadSpaces.map((ds) =>
            ds.id === deadSpaceId ? { ...ds, remove } : ds
          ),
        }));
      },
      
      setAllDeadSpacesRemove: (remove) => {
        const state = get();
        // Save history before making changes
        get()._addHistory(captureHistoryState(state));
        
        set((state) => ({
          deadSpaces: state.deadSpaces.map((ds) => ({ ...ds, remove })),
        }));
      },

      // Settings actions
      updateSettings: (newSettings) => set((state) => ({
        settings: { ...state.settings, ...newSettings },
      })),
      
      updateExportSettings: (newSettings) => set((state) => ({
        exportSettings: { ...state.exportSettings, ...newSettings },
      })),
      
      updateAiSettings: (newSettings) => set((state) => ({
        aiSettings: { ...state.aiSettings, ...newSettings },
      })),

      // Export actions
      setExporting: (isExporting) => set({ isExporting }),
      
      setExportProgress: (exportProgress) => set({ exportProgress }),
      
      setLastExportDir: (lastExportDir) => set({ lastExportDir }),
      
      // Preview actions
      setPreviewRendering: (isPreviewRendering) => set({ isPreviewRendering }),
      
      setPreviewProgress: (previewProgress) => set({ previewProgress }),
      
      setPreviewFilePath: (previewFilePath) => set({ previewFilePath }),

      // Recent projects
      addRecentProject: (project) => set((state) => {
        const filtered = state.recentProjects.filter(
          (p) => p.filePath !== project.filePath
        );
        return {
          recentProjects: [project, ...filtered].slice(0, 10),
        };
      }),
      
      removeRecentProject: (filePath) => set((state) => ({
        recentProjects: state.recentProjects.filter((p) => p.filePath !== filePath),
      })),

      // Session state
      setLastRoute: (lastRoute) => set({ lastRoute }),
      
      // Media Library actions
      loadMediaLibrary: async () => {
        set((state) => ({
          mediaLibrary: { ...state.mediaLibrary, isLoading: true, error: null },
        }));
        
        try {
          const result = await window.api.mediaLibraryGetItems();
          if (result.success) {
            set((state) => ({
              mediaLibrary: {
                ...state.mediaLibrary,
                items: result.items,
                libraryPath: result.libraryPath || null,
                isLoading: false,
              },
            }));
          } else {
            set((state) => ({
              mediaLibrary: {
                ...state.mediaLibrary,
                isLoading: false,
                error: result.error || 'Failed to load library',
              },
            }));
          }
        } catch (err) {
          set((state) => ({
            mediaLibrary: {
              ...state.mediaLibrary,
              isLoading: false,
              error: err instanceof Error ? err.message : String(err),
            },
          }));
        }
      },
      
      importToMediaLibrary: async (type, filePaths) => {
        set((state) => ({
          mediaLibrary: { ...state.mediaLibrary, isLoading: true, error: null },
        }));
        
        try {
          const result = await window.api.mediaLibraryImport({ type, filePaths });
          
          if (result.success && !result.canceled) {
            // Validate imported items to get metadata
            for (const item of result.items) {
              try {
                const validation = await window.api.validateFile(item.libraryPath);
                if (validation.valid) {
                  await window.api.mediaLibraryUpdateItem({
                    id: item.id,
                    updates: {
                      duration: validation.duration,
                      resolution: validation.resolution,
                      width: validation.width,
                      height: validation.height,
                      fps: validation.fps,
                      thumbnailPath: validation.thumbnailPath,
                    },
                  });
                  
                  // Update local item
                  item.duration = validation.duration;
                  item.resolution = validation.resolution;
                  item.width = validation.width;
                  item.height = validation.height;
                  item.fps = validation.fps;
                  item.thumbnailPath = validation.thumbnailPath;
                }
              } catch (err) {
                console.error('[MediaLibrary] Failed to validate imported item:', err);
              }
            }
            
            // Add new items to state
            set((state) => ({
              mediaLibrary: {
                ...state.mediaLibrary,
                items: [...state.mediaLibrary.items, ...result.items],
                isLoading: false,
              },
            }));
            
            return result.items;
          }
          
          set((state) => ({
            mediaLibrary: {
              ...state.mediaLibrary,
              isLoading: false,
              error: result.error,
            },
          }));
          
          return [];
        } catch (err) {
          set((state) => ({
            mediaLibrary: {
              ...state.mediaLibrary,
              isLoading: false,
              error: err instanceof Error ? err.message : String(err),
            },
          }));
          return [];
        }
      },
      
      removeFromMediaLibrary: async (id, deleteFile = true) => {
        try {
          const result = await window.api.mediaLibraryRemove({ id, deleteFile });
          if (result.success) {
            set((state) => ({
              mediaLibrary: {
                ...state.mediaLibrary,
                items: state.mediaLibrary.items.filter((item) => item.id !== id),
              },
            }));
          }
        } catch (err) {
          console.error('[MediaLibrary] Failed to remove item:', err);
        }
      },
      
      updateMediaLibraryItem: async (id, updates) => {
        try {
          const result = await window.api.mediaLibraryUpdateItem({ id, updates });
          if (result.success && result.item) {
            set((state) => ({
              mediaLibrary: {
                ...state.mediaLibrary,
                items: state.mediaLibrary.items.map((item) =>
                  item.id === id ? { ...item, ...updates } : item
                ),
              },
            }));
          }
        } catch (err) {
          console.error('[MediaLibrary] Failed to update item:', err);
        }
      },
      
      searchMediaLibrary: async (query, type) => {
        try {
          const result = await window.api.mediaLibrarySearch({ query, type });
          return result.success ? result.items : [];
        } catch (err) {
          console.error('[MediaLibrary] Search failed:', err);
          return [];
        }
      },
      
      openMediaLibraryFolder: async (subfolder) => {
        try {
          await window.api.mediaLibraryOpenFolder(subfolder);
        } catch (err) {
          console.error('[MediaLibrary] Failed to open folder:', err);
        }
      },
      
      // Undo/Redo actions
      undo: () => {
        const state = get();
        if (state.past.length === 0) return;
        
        const previous = state.past[state.past.length - 1];
        const newPast = state.past.slice(0, -1);
        
        // Save current state to future
        const current = captureHistoryState(state);
        
        set({
          ...previous,
          past: newPast,
          future: [current, ...state.future],
        });
      },
      
      redo: () => {
        const state = get();
        if (state.future.length === 0) return;
        
        const next = state.future[0];
        const newFuture = state.future.slice(1);
        
        // Save current state to past
        const current = captureHistoryState(state);
        
        set({
          ...next,
          past: [...state.past, current],
          future: newFuture,
        });
      },
      
      canUndo: () => get().past.length > 0,
      
      canRedo: () => get().future.length > 0,
      
      _addHistory: (historyState: HistoryState) => {
        const state = get();
        set({
          past: [...state.past, historyState],
          future: [], // Clear future when new action is performed
        });
      },

      // Reset
      reset: () => set({
        project: null,
        currentJobId: null,
        lastJobId: null,
        setupComplete: false,
        editingPreferences: null,
        cameras: [],
        cameraCuts: [],
        speakerSegments: [],
        audioTracks: [],
        qaChecks: [],
        qaRunning: false,
        timelineGroups: [],
        isDetecting: false,
        detectionProgress: null,
        detectionError: null,
        clips: [],
        deadSpaces: [],
        transcript: null,
        isExporting: false,
        exportProgress: null,
        isPreviewRendering: false,
        previewProgress: null,
        previewFilePath: null,
        past: [],
        future: [],
      }),
    }),
    {
      name: 'podflow-studio-storage',
      partialize: (state) => ({
        settings: state.settings,
        exportSettings: state.exportSettings,
        aiSettings: state.aiSettings,
        recentProjects: state.recentProjects,
        lastExportDir: state.lastExportDir,
        // Persist last editing preferences for quick start
        editingPreferences: state.editingPreferences,
        // Persist session state for restoration
        project: state.project,
        clips: state.clips,
        deadSpaces: state.deadSpaces,
        transcript: state.transcript,
        setupComplete: state.setupComplete,
        cameras: state.cameras,
        cameraCuts: state.cameraCuts,
        speakerSegments: state.speakerSegments,
        audioTracks: state.audioTracks,
        qaChecks: state.qaChecks,
        timelineGroups: state.timelineGroups,
        lastRoute: state.lastRoute,
        // Project file state
        projectFilePath: state.projectFilePath,
        lastAutoSaveTime: state.lastAutoSaveTime,
        // Media library - persist items for offline use
        mediaLibrary: state.mediaLibrary,
        // Note: past/future (history) are intentionally NOT persisted
      }),
    }
  )
);
