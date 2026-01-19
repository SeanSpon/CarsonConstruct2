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
} from '../types';

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
  
  // Actions - Project Setup
  setProject: (project: Project | null) => void;
  clearProject: () => void;
  setCurrentJobId: (jobId: string | null) => void;
  setLastJobId: (jobId: string | null) => void;
  setSetupComplete: (complete: boolean) => void;
  setEditingPreferences: (preferences: EditingPreferences | null) => void;
  
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
  
  // Actions - Clip editing
  splitClipAtTime: (clipId: string, splitTime: number) => void;
  duplicateClip: (clipId: string) => void;
  deleteClip: (clipId: string) => void;
  moveClip: (clipId: string, newStartTime: number) => void;
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
  
  updateDeadSpaceRemove: (deadSpaceId: string, remove: boolean) => void;
  setAllDeadSpacesRemove: (remove: boolean) => void;
  
  updateSettings: (settings: Partial<DetectionSettings>) => void;
  updateExportSettings: (settings: Partial<ExportSettings>) => void;
  
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
  
  reset: () => void;
}

const defaultSettings: DetectionSettings = {
  targetCount: 10,
  minDuration: 15,
  maxDuration: 90,
  skipIntro: 90,
  skipOutro: 60,
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

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      // Initial state
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
      settings: defaultSettings,
      exportSettings: defaultExportSettings,
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
        }
      },
      
      clearProject: () => set({
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
      
      addCameraCut: (cut) => set((state) => ({
        cameraCuts: [...state.cameraCuts, cut].sort((a, b) => a.startTime - b.startTime),
      })),
      
      removeCameraCut: (cutId) => set((state) => ({
        cameraCuts: state.cameraCuts.filter((c) => c.id !== cutId),
      })),
      
      updateCameraCut: (cutId, updates) => set((state) => ({
        cameraCuts: state.cameraCuts.map((c) =>
          c.id === cutId ? { ...c, ...updates } : c
        ),
      })),
      
      setSpeakerSegments: (speakerSegments) => set({ speakerSegments }),
      
      // Audio actions
      setAudioTracks: (audioTracks) => set({ audioTracks }),
      
      addAudioTrack: (track) => set((state) => ({
        audioTracks: [...state.audioTracks, track],
      })),
      
      removeAudioTrack: (trackId) => set((state) => ({
        audioTracks: state.audioTracks.filter((t) => t.id !== trackId),
      })),
      
      updateAudioTrack: (trackId, updates) => set((state) => ({
        audioTracks: state.audioTracks.map((t) =>
          t.id === trackId ? { ...t, ...updates } : t
        ),
      })),
      
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
      
      addTimelineGroup: (group) => set((state) => ({
        timelineGroups: [...state.timelineGroups, group],
      })),
      
      removeTimelineGroup: (groupId) => set((state) => ({
        timelineGroups: state.timelineGroups.filter((g) => g.id !== groupId),
        clips: state.clips.map((c) =>
          c.groupId === groupId ? { ...c, groupId: undefined } : c
        ),
      })),
      
      updateTimelineGroup: (groupId, updates) => set((state) => ({
        timelineGroups: state.timelineGroups.map((g) =>
          g.id === groupId ? { ...g, ...updates } : g
        ),
      })),
      
      groupClips: (clipIds, groupName) => {
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
      
      ungroupClips: (groupId) => set((state) => ({
        timelineGroups: state.timelineGroups.filter((g) => g.id !== groupId),
        clips: state.clips.map((c) =>
          c.groupId === groupId ? { ...c, groupId: undefined } : c
        ),
      })),
      
      // Clip editing actions
      splitClipAtTime: (clipId, splitTime) => set((state) => {
        const clip = state.clips.find((c) => c.id === clipId);
        if (!clip) return state;
        
        // Ensure split time is within clip bounds
        const effectiveStart = clip.startTime + clip.trimStartOffset;
        const effectiveEnd = clip.endTime + clip.trimEndOffset;
        if (splitTime <= effectiveStart || splitTime >= effectiveEnd) return state;
        
        const newClipId = `clip_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        
        // First part: original clip with adjusted end
        const firstPart: Clip = {
          ...clip,
          endTime: splitTime,
          trimEndOffset: 0,
          duration: splitTime - clip.startTime - clip.trimStartOffset,
        };
        
        // Second part: new clip starting at split point
        const secondPart: Clip = {
          ...clip,
          id: newClipId,
          startTime: splitTime,
          trimStartOffset: 0,
          duration: effectiveEnd - splitTime,
          title: clip.title ? `${clip.title} (2)` : undefined,
        };
        
        return {
          clips: state.clips.flatMap((c) =>
            c.id === clipId ? [firstPart, secondPart] : [c]
          ).sort((a, b) => a.startTime - b.startTime),
        };
      }),
      
      duplicateClip: (clipId) => set((state) => {
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
      }),
      
      deleteClip: (clipId) => set((state) => ({
        clips: state.clips.filter((c) => c.id !== clipId),
      })),
      
      moveClip: (clipId, newStartTime) => set((state) => {
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
      }),
      
      // Project file state actions
      setProjectFilePath: (projectFilePath) => set({ projectFilePath }),
      setLastAutoSaveTime: (lastAutoSaveTime) => set({ lastAutoSaveTime }),
      
      addClipEffect: (clipId, effect) => set((state) => ({
        clips: state.clips.map((c) =>
          c.id === clipId
            ? { ...c, appliedEffects: [...(c.appliedEffects || []), effect] }
            : c
        ),
      })),
      
      removeClipEffect: (clipId, effectId) => set((state) => ({
        clips: state.clips.map((c) =>
          c.id === clipId
            ? { ...c, appliedEffects: (c.appliedEffects || []).filter((e) => e.id !== effectId) }
            : c
        ),
      })),
      
      toggleClipEffect: (clipId, effectId) => set((state) => ({
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
      })),
      
      updateClipEffectParams: (clipId, effectId, params) => set((state) => ({
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
      })),

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
      updateClipStatus: (clipId, status) => set((state) => ({
        clips: state.clips.map((clip) =>
          clip.id === clipId ? { ...clip, status } : clip
        ),
      })),
      
      updateClipTrim: (clipId, trimStartOffset, trimEndOffset) => set((state) => ({
        clips: state.clips.map((clip) =>
          clip.id === clipId ? { ...clip, trimStartOffset, trimEndOffset } : clip
        ),
      })),

      // Dead space actions
      updateDeadSpaceRemove: (deadSpaceId, remove) => set((state) => ({
        deadSpaces: state.deadSpaces.map((ds) =>
          ds.id === deadSpaceId ? { ...ds, remove } : ds
        ),
      })),
      
      setAllDeadSpacesRemove: (remove) => set((state) => ({
        deadSpaces: state.deadSpaces.map((ds) => ({ ...ds, remove })),
      })),

      // Settings actions
      updateSettings: (newSettings) => set((state) => ({
        settings: { ...state.settings, ...newSettings },
      })),
      
      updateExportSettings: (newSettings) => set((state) => ({
        exportSettings: { ...state.exportSettings, ...newSettings },
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
      }),
    }),
    {
      name: 'podflow-studio-storage',
      partialize: (state) => ({
        settings: state.settings,
        exportSettings: state.exportSettings,
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
      }),
    }
  )
);
