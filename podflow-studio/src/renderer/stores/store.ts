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
  EditingPreferences,
  CameraInput,
  CameraCut,
  SpeakerSegment,
  AudioTrack,
  TimelineGroup,
  TimelineMarker,
  HistoryEntry,
  ClipSpeed,
  ClipColorLabel,
  AppliedEffect,
  ReelExportSettings,
  ReelCaptionSettings,
  QACheck,
  MVPDetectionSettings,
  MVPExportSettings,
} from '../types';
import {
  DEFAULT_REEL_CAPTION_SETTINGS,
  DEFAULT_MVP_DETECTION_SETTINGS,
  DEFAULT_MVP_EXPORT_SETTINGS,
} from '../types';
import { HistoryState, captureHistoryState } from './historyMiddleware';

interface RecentProject {
  filePath: string;
  fileName: string;
  duration: number;
  lastOpened: number;
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
  
  // Multi-camera (simplified, kept for compatibility)
  cameras: CameraInput[];
  cameraCuts: CameraCut[];
  speakerSegments: SpeakerSegment[];
  
  // Audio mixing
  audioTracks: AudioTrack[];
  
  // Timeline groups
  timelineGroups: TimelineGroup[];
  
  // Timeline markers
  markers: TimelineMarker[];
  
  // Edit modes
  editMode: 'select' | 'ripple' | 'roll' | 'slip' | 'slide' | 'razor';
  insertMode: 'insert' | 'overwrite';
  
  // Detection state
  isDetecting: boolean;
  detectionProgress: DetectionProgress | null;
  detectionError: string | null;
  
  // Pending detection results (awaiting user review)
  pendingDetectionResults: {
    clips: Clip[];
    deadSpaces: DeadSpace[];
    transcript: Transcript | null;
  } | null;
  
  // Results
  clips: Clip[];
  suggestedClips: Clip[];
  showSourceLayer: boolean;
  deadSpaces: DeadSpace[];
  transcript: Transcript | null;
  
  // Settings
  settings: DetectionSettings;
  exportSettings: ExportSettings;
  reelExportSettings: ReelExportSettings;
  mvpDetectionSettings: MVPDetectionSettings;
  mvpExportSettings: MVPExportSettings;
  
  // QA checks
  qaChecks: QACheck[];
  
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
  
  // Project file state
  projectFilePath: string | null;
  lastAutoSaveTime: number | null;
  
  // Undo/Redo
  past: HistoryState[];
  future: HistoryState[];
  
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
  
  // Actions - Multi-camera (simplified)
  setCameras: (cameras: CameraInput[]) => void;
  setCameraCuts: (cuts: CameraCut[]) => void;
  setSpeakerSegments: (segments: SpeakerSegment[]) => void;
  
  // Actions - Audio
  setAudioTracks: (tracks: AudioTrack[]) => void;
  
  // Actions - QA Checks
  setQAChecks: (checks: QACheck[]) => void;
  
  // Actions - Timeline Groups
  setTimelineGroups: (groups: TimelineGroup[]) => void;
  groupClips: (clipIds: string[], groupName?: string) => void;
  ungroupClips: (groupId: string) => void;
  
  // Actions - Markers
  addMarker: (marker: TimelineMarker) => void;
  removeMarker: (markerId: string) => void;
  updateMarker: (markerId: string, updates: Partial<TimelineMarker>) => void;
  
  // Actions - Edit modes
  setEditMode: (mode: 'select' | 'ripple' | 'roll' | 'slip' | 'slide' | 'razor') => void;
  setInsertMode: (mode: 'insert' | 'overwrite') => void;
  
  // Actions - Clip editing
  splitClipAtTime: (clipId: string, splitTime: number) => void;
  duplicateClip: (clipId: string) => void;
  deleteClip: (clipId: string, ripple?: boolean) => void;
  moveClip: (clipId: string, newStartTime: number) => void;
  setClipSpeed: (clipId: string, speed: ClipSpeed) => void;
  setClipColorLabel: (clipId: string, color: ClipColorLabel) => void;
  setClipOpacity: (clipId: string, opacity: number) => void;
  setClipVolume: (clipId: string, volume: number) => void;
  addClipEffect: (clipId: string, effect: AppliedEffect) => void;
  removeClipEffect: (clipId: string, effectId: string) => void;
  toggleClipEffect: (clipId: string, effectId: string) => void;
  
  // Project file state actions
  setProjectFilePath: (path: string | null) => void;
  setLastAutoSaveTime: (time: number | null) => void;
  
  // Actions - Detection
  setDetecting: (isDetecting: boolean) => void;
  setDetectionProgress: (progress: DetectionProgress | null) => void;
  setDetectionError: (error: string | null) => void;
  
  setPendingDetectionResults: (results: { clips: Clip[]; deadSpaces: DeadSpace[]; transcript: Transcript | null } | null) => void;
  acceptPendingResults: () => void;
  rejectPendingResults: () => void;
  
  setResults: (clips: Clip[], deadSpaces: DeadSpace[], transcript: Transcript | null) => void;
  
  // Actions - Suggested Clips
  setSuggestedClips: (clips: Clip[]) => void;
  addSuggestedClipToTimeline: (clipId: string) => void;
  addAllSuggestedClipsToTimeline: () => void;
  clearSuggestedClips: () => void;
  
  // Actions - Source Layer
  setShowSourceLayer: (show: boolean) => void;
  deleteSourceLayer: () => void;
  rippleDeleteGaps: () => void;
  
  updateClipStatus: (clipId: string, status: Clip['status']) => void;
  updateClipTrim: (clipId: string, trimStartOffset: number, trimEndOffset: number) => void;
  updateClipHook: (clipId: string, hookText: string, title?: string) => void;
  updateClipPatternLabel: (clipId: string, patternLabel: string) => void;
  
  updateDeadSpaceRemove: (deadSpaceId: string, remove: boolean) => void;
  setAllDeadSpacesRemove: (remove: boolean) => void;
  
  updateSettings: (settings: Partial<DetectionSettings>) => void;
  updateExportSettings: (settings: Partial<ExportSettings>) => void;
  updateReelExportSettings: (settings: Partial<ReelExportSettings>) => void;
  updateReelCaptionSettings: (settings: Partial<ReelCaptionSettings>) => void;
  updateMvpDetectionSettings: (settings: Partial<MVPDetectionSettings>) => void;
  updateMvpExportSettings: (settings: Partial<MVPExportSettings>) => void;
  
  setExporting: (isExporting: boolean) => void;
  setExportProgress: (progress: { current: number; total: number; clipName: string } | null) => void;
  setLastExportDir: (dir: string | null) => void;
  
  // Preview actions
  setPreviewRendering: (isRendering: boolean) => void;
  setPreviewProgress: (progress: { percent: number; message: string } | null) => void;
  setPreviewFilePath: (filePath: string | null) => void;
  
  addRecentProject: (project: RecentProject) => void;
  removeRecentProject: (filePath: string) => void;
  
  // Undo/Redo
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
  maxDuration: 60,
  skipIntro: 30,
  skipOutro: 30,
  useAiEnhancement: true,
};

const defaultExportSettings: ExportSettings = {
  format: 'mp4',
  mode: 'fast',
  exportClips: true,
  exportClipsCompilation: false,
  exportFullVideo: false,
  transition: {
    type: 'crossfade',
    duration: 0.5,
  },
};

const defaultReelExportSettings: ReelExportSettings = {
  platform: 'tiktok',
  width: 1080,
  height: 1920,
  captions: { ...DEFAULT_REEL_CAPTION_SETTINGS },
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
      timelineGroups: [],
      markers: [],
      editMode: 'select',
      insertMode: 'insert',
      isDetecting: false,
      detectionProgress: null,
      detectionError: null,
      pendingDetectionResults: null,
      clips: [],
      suggestedClips: [],
      showSourceLayer: true,
      deadSpaces: [],
      transcript: null,
      settings: defaultSettings,
      exportSettings: defaultExportSettings,
      reelExportSettings: defaultReelExportSettings,
      mvpDetectionSettings: DEFAULT_MVP_DETECTION_SETTINGS,
      mvpExportSettings: DEFAULT_MVP_EXPORT_SETTINGS,
      qaChecks: [],
      isExporting: false,
      exportProgress: null,
      lastExportDir: null,
      isPreviewRendering: false,
      previewProgress: null,
      previewFilePath: null,
      recentProjects: [],
      projectFilePath: null,
      lastAutoSaveTime: null,
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
        timelineGroups: [],
        clips: [],
        suggestedClips: [],
        showSourceLayer: true,
        deadSpaces: [],
        transcript: null,
        detectionProgress: null,
        detectionError: null,
      }),
      
      setSetupComplete: (setupComplete) => set({ setupComplete }),
      setEditingPreferences: (editingPreferences) => set({ editingPreferences }),
      
      // Source waveform actions
      setSourceWaveform: (sourceWaveform) => set({ sourceWaveform }),
      setExtractingWaveform: (isExtractingWaveform) => set({ isExtractingWaveform }),
      
      // Multi-camera actions (simplified)
      setCameras: (cameras) => set({ cameras }),
      setCameraCuts: (cameraCuts) => set({ cameraCuts }),
      setSpeakerSegments: (speakerSegments) => set({ speakerSegments }),
      
      // Audio actions
      setAudioTracks: (audioTracks) => set({ audioTracks }),
      
      // QA Checks actions
      setQAChecks: (qaChecks) => set({ qaChecks }),
      
      // Timeline groups actions
      setTimelineGroups: (timelineGroups) => set({ timelineGroups }),
      
      groupClips: (clipIds, groupName) => {
        const state = get();
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
      
      // Edit mode actions
      setEditMode: (editMode) => set({ editMode }),
      setInsertMode: (insertMode) => set({ insertMode }),
      
      // Clip editing actions
      splitClipAtTime: (clipId, splitTime) => {
        const state = get();
        get()._addHistory(captureHistoryState(state));
        
        set((state) => {
          const clip = state.clips.find((c) => c.id === clipId);
          if (!clip) return state;
          
          const effectiveStart = clip.startTime + (clip.trimStartOffset || 0);
          const effectiveEnd = clip.endTime + (clip.trimEndOffset || 0);
          
          if (splitTime <= effectiveStart || splitTime >= effectiveEnd) return state;
          
          const newClipId = `clip_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
          const distanceIntoClip = splitTime - clip.startTime;
          const sourcePositionAtSplit = clip.startTime + (clip.trimStartOffset || 0) + distanceIntoClip;
          
          const firstPart: Clip = {
            ...clip,
            endTime: splitTime,
            trimStartOffset: clip.trimStartOffset || 0,
            trimEndOffset: sourcePositionAtSplit - splitTime,
            duration: splitTime - clip.startTime,
          };
          
          const secondPart: Clip = {
            ...clip,
            id: newClipId,
            startTime: splitTime,
            endTime: clip.endTime,
            trimStartOffset: sourcePositionAtSplit - splitTime,
            trimEndOffset: clip.trimEndOffset || 0,
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
        get()._addHistory(captureHistoryState(state));
        
        set((state) => {
          const clip = state.clips.find((c) => c.id === clipId);
          if (!clip) return state;
          
          const newClipId = `clip_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
          const newClip: Clip = {
            ...clip,
            id: newClipId,
            startTime: clip.endTime + 0.1,
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
        get()._addHistory(captureHistoryState(state));
        
        const clip = state.clips.find((c) => c.id === clipId);
        if (!clip) return;
        
        set((state) => {
          let newClips = state.clips.filter((c) => c.id !== clipId);
          
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
      
      setClipSpeed: (clipId, speed) => {
        const state = get();
        get()._addHistory(captureHistoryState(state));
        
        set((state) => {
          const clip = state.clips.find((c) => c.id === clipId);
          if (!clip) return state;
          
          const originalDuration = clip.endTime - clip.startTime;
          const newDuration = originalDuration / speed.speed;
          
          return {
            clips: state.clips.map((c) => {
              if (c.id === clipId) {
                return { ...c, speed, duration: newDuration };
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
      
      // Project file state actions
      setProjectFilePath: (projectFilePath) => set({ projectFilePath }),
      setLastAutoSaveTime: (lastAutoSaveTime) => set({ lastAutoSaveTime }),
      
      addClipEffect: (clipId, effect) => {
        const state = get();
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
      
      // Pending results actions
      setPendingDetectionResults: (results) => set({ 
        pendingDetectionResults: results,
        isDetecting: false,
        detectionProgress: null,
      }),
      
      acceptPendingResults: () => {
        const state = get();
        if (!state.pendingDetectionResults) return;
        
        const { clips, deadSpaces, transcript } = state.pendingDetectionResults;
        const existingUserClips = state.clips.filter(c => c.id.startsWith('user_'));
        
        set({
          suggestedClips: clips,
          clips: existingUserClips.length > 0 ? existingUserClips : [],
          deadSpaces,
          transcript,
          pendingDetectionResults: null,
        });
      },
      
      rejectPendingResults: () => set({ 
        pendingDetectionResults: null,
        isDetecting: false,
      }),

      // Results actions
      setResults: (clips, deadSpaces, transcript) => {
        const state = get();
        const existingUserClips = state.clips.filter(c => c.id.startsWith('user_'));
        
        set({
          suggestedClips: clips,
          clips: existingUserClips.length > 0 ? existingUserClips : [],
          deadSpaces,
          transcript,
          isDetecting: false,
          detectionProgress: null,
        });
      },
      
      // Suggested Clips actions
      setSuggestedClips: (suggestedClips) => set({ suggestedClips }),
      
      addSuggestedClipToTimeline: (clipId) => {
        const state = get();
        const suggestedClip = state.suggestedClips.find(c => c.id === clipId);
        if (!suggestedClip) return;
        
        const timelineClip: Clip = {
          ...suggestedClip,
          id: `user_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          status: 'accepted',
        };
        
        set({
          suggestedClips: state.suggestedClips.filter(c => c.id !== clipId),
          clips: [...state.clips, timelineClip].sort((a, b) => a.startTime - b.startTime),
        });
      },
      
      addAllSuggestedClipsToTimeline: () => {
        const state = get();
        
        const newTimelineClips = state.suggestedClips.map((clip, index) => ({
          ...clip,
          id: `user_${Date.now()}_${index}_${Math.random().toString(36).slice(2, 6)}`,
          status: 'accepted' as const,
        }));
        
        set({
          suggestedClips: [],
          clips: [...state.clips, ...newTimelineClips].sort((a, b) => a.startTime - b.startTime),
        });
      },
      
      clearSuggestedClips: () => set({ suggestedClips: [] }),
      
      // Source Layer actions
      setShowSourceLayer: (showSourceLayer) => set({ showSourceLayer }),
      
      deleteSourceLayer: () => {
        set({ showSourceLayer: false });
      },
      
      rippleDeleteGaps: () => {
        const state = get();
        const clips = [...state.clips].sort((a, b) => a.startTime - b.startTime);
        
        if (clips.length === 0) return;
        
        get()._addHistory(captureHistoryState(state));
        
        let currentTime = 0;
        const rippledClips = clips.map(clip => {
          const duration = (clip.endTime + (clip.trimEndOffset || 0)) - (clip.startTime + (clip.trimStartOffset || 0));
          const newClip = {
            ...clip,
            startTime: currentTime,
            endTime: currentTime + duration,
            trimStartOffset: 0,
            trimEndOffset: 0,
          };
          currentTime += duration;
          return newClip;
        });
        
        set({ clips: rippledClips });
      },

      // Clip actions
      updateClipStatus: (clipId, status) => {
        const state = get();
        get()._addHistory(captureHistoryState(state));
        set((state) => ({
          clips: state.clips.map((clip) =>
            clip.id === clipId ? { ...clip, status } : clip
          ),
        }));
      },
      
      updateClipTrim: (clipId, trimStartOffset, trimEndOffset) => {
        const state = get();
        get()._addHistory(captureHistoryState(state));
        set((state) => ({
          clips: state.clips.map((clip) =>
            clip.id === clipId ? { ...clip, trimStartOffset, trimEndOffset } : clip
          ),
        }));
      },
      
      updateClipHook: (clipId, hookText, title) => {
        const state = get();
        get()._addHistory(captureHistoryState(state));
        set((state) => ({
          clips: state.clips.map((clip) =>
            clip.id === clipId 
              ? { ...clip, hookText, ...(title ? { title } : {}) } 
              : clip
          ),
        }));
      },
      
      updateClipPatternLabel: (clipId, patternLabel) => {
        const state = get();
        get()._addHistory(captureHistoryState(state));
        set((state) => ({
          clips: state.clips.map((clip) =>
            clip.id === clipId ? { ...clip, patternLabel } : clip
          ),
        }));
      },

      // Dead space actions
      updateDeadSpaceRemove: (deadSpaceId, remove) => {
        const state = get();
        get()._addHistory(captureHistoryState(state));
        set((state) => ({
          deadSpaces: state.deadSpaces.map((ds) =>
            ds.id === deadSpaceId ? { ...ds, remove } : ds
          ),
        }));
      },
      
      setAllDeadSpacesRemove: (remove) => {
        const state = get();
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
      
      updateReelExportSettings: (newSettings) => set((state) => ({
        reelExportSettings: { ...state.reelExportSettings, ...newSettings },
      })),
      
      updateReelCaptionSettings: (newSettings) => set((state) => ({
        reelExportSettings: {
          ...state.reelExportSettings,
          captions: { ...state.reelExportSettings.captions, ...newSettings },
        },
      })),
      
      // MVP Settings
      updateMvpDetectionSettings: (newSettings) => set((state) => ({
        mvpDetectionSettings: { ...state.mvpDetectionSettings, ...newSettings },
      })),
      
      updateMvpExportSettings: (newSettings) => set((state) => ({
        mvpExportSettings: { ...state.mvpExportSettings, ...newSettings },
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
      
      // Undo/Redo actions
      undo: () => {
        const state = get();
        if (state.past.length === 0) return;
        
        const previous = state.past[state.past.length - 1];
        const newPast = state.past.slice(0, -1);
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
          future: [],
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
        timelineGroups: [],
        isDetecting: false,
        detectionProgress: null,
        detectionError: null,
        clips: [],
        suggestedClips: [],
        showSourceLayer: true,
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
        reelExportSettings: state.reelExportSettings,
        recentProjects: state.recentProjects,
        lastExportDir: state.lastExportDir,
        editingPreferences: state.editingPreferences,
        project: state.project,
        clips: state.clips,
        suggestedClips: state.suggestedClips,
        showSourceLayer: state.showSourceLayer,
        deadSpaces: state.deadSpaces,
        transcript: state.transcript,
        setupComplete: state.setupComplete,
        cameras: state.cameras,
        cameraCuts: state.cameraCuts,
        speakerSegments: state.speakerSegments,
        audioTracks: state.audioTracks,
        timelineGroups: state.timelineGroups,
        qaChecks: state.qaChecks,
        projectFilePath: state.projectFilePath,
        lastAutoSaveTime: state.lastAutoSaveTime,
      }),
    }
  )
);
