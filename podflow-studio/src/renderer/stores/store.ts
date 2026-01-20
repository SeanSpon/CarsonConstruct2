import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { 
  Project, 
  Clip, 
  DeadSpace, 
  Transcript, 
  DetectionSettings, 
  DetectionProgress,
} from '../types';

interface AppState {
  // Project
  project: Project | null;
  currentJobId: string | null;
  lastJobId: string | null;
  
  // Detection
  isDetecting: boolean;
  detectionProgress: DetectionProgress | null;
  detectionError: string | null;
  
  // Results
  clips: Clip[];
  deadSpaces: DeadSpace[];
  transcript: Transcript | null;
  
  // Settings (minimal)
  settings: DetectionSettings;
  
  // Export
  isExporting: boolean;
  exportProgress: { current: number; total: number; clipName: string } | null;
  lastExportDir: string | null;
  
  // Actions
  setProject: (project: Project | null) => void;
  clearProject: () => void;
  setCurrentJobId: (jobId: string | null) => void;
  setLastJobId: (jobId: string | null) => void;
  
  setDetecting: (isDetecting: boolean) => void;
  setDetectionProgress: (progress: DetectionProgress | null) => void;
  setDetectionError: (error: string | null) => void;
  
  setResults: (clips: Clip[], deadSpaces: DeadSpace[], transcript: Transcript | null) => void;
  updateClipStatus: (clipId: string, status: Clip['status']) => void;
  updateClipTrim: (clipId: string, trimStartOffset: number, trimEndOffset: number) => void;
  
  setExporting: (isExporting: boolean) => void;
  setExportProgress: (progress: { current: number; total: number; clipName: string } | null) => void;
  setLastExportDir: (dir: string | null) => void;
  
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

export const useStore = create<AppState>()(
  persist(
    (set) => ({
      // Initial state
      project: null,
      currentJobId: null,
      lastJobId: null,
      isDetecting: false,
      detectionProgress: null,
      detectionError: null,
      clips: [],
      deadSpaces: [],
      transcript: null,
      settings: defaultSettings,
      isExporting: false,
      exportProgress: null,
      lastExportDir: null,

      // Actions
      setProject: (project) => set({ project }),
      
      clearProject: () => set({
        project: null,
        currentJobId: null,
        lastJobId: null,
        clips: [],
        deadSpaces: [],
        transcript: null,
        detectionProgress: null,
        detectionError: null,
      }),
      
      setCurrentJobId: (currentJobId) => set({ currentJobId }),
      setLastJobId: (lastJobId) => set({ lastJobId }),
      
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
      
      setResults: (clips, deadSpaces, transcript) => set({
        clips,
        deadSpaces,
        transcript,
        isDetecting: false,
        detectionProgress: null,
      }),
      
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

      setExporting: (isExporting) => set({ isExporting }),
      setExportProgress: (exportProgress) => set({ exportProgress }),
      setLastExportDir: (lastExportDir) => set({ lastExportDir }),

      reset: () => set({
        project: null,
        currentJobId: null,
        lastJobId: null,
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
      name: 'podflow-storage',
      partialize: (state) => ({
        settings: state.settings,
        lastExportDir: state.lastExportDir,
      }),
    }
  )
);
