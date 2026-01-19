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
  QACheck,
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
  
  // Recent projects (persisted)
  recentProjects: RecentProject[];
  
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
  
  addRecentProject: (project: RecentProject) => void;
  removeRecentProject: (filePath: string) => void;
  
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
  exportFullVideo: false,
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
      recentProjects: [],

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
        clips: [],
        deadSpaces: [],
        transcript: null,
        detectionProgress: null,
        detectionError: null,
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
        isDetecting: false,
        detectionProgress: null,
        detectionError: null,
        clips: [],
        deadSpaces: [],
        transcript: null,
        isExporting: false,
        exportProgress: null,
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
      }),
    }
  )
);
