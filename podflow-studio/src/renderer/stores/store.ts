import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { 
  Project, 
  Clip, 
  DeadSpace, 
  Transcript, 
  DetectionSettings, 
  DetectionProgress,
  ExportSettings 
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
  
  // Actions
  setProject: (project: Project | null) => void;
  clearProject: () => void;
  
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
        clips: [],
        deadSpaces: [],
        transcript: null,
        detectionProgress: null,
        detectionError: null,
      }),

      // Detection actions
      setDetecting: (isDetecting) => set({ isDetecting }),
      
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
      }),
    }
  )
);
