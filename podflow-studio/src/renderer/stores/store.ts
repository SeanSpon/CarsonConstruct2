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
  // Hydration
  hasHydrated: boolean;
  setHasHydrated: (hasHydrated: boolean) => void;

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
  transcriptAvailable: boolean;
  transcriptError: string | null;
  transcriptSource: string | null;
  
  // Settings (minimal)
  settings: DetectionSettings;
  openaiApiKey: string | null;
  setOpenaiApiKey: (key: string | null) => void;
  
  // Export
  isExporting: boolean;
  exportProgress: { current: number; total: number; clipName: string } | null;
  lastExportDir: string | null;
  captionStyle: 'viral' | 'minimal' | 'bold';
  setCaptionStyle: (style: 'viral' | 'minimal' | 'bold') => void;
  
  // Actions
  setProject: (project: Project | null) => void;
  clearProject: () => void;
  setCurrentJobId: (jobId: string | null) => void;
  setLastJobId: (jobId: string | null) => void;
  
  setDetecting: (isDetecting: boolean) => void;
  setDetectionProgress: (progress: DetectionProgress | null) => void;
  setDetectionError: (error: string | null) => void;

  setTranscriptMeta: (meta: {
    transcriptAvailable?: boolean;
    transcriptError?: string | null;
    transcriptSource?: string | null;
  }) => void;
  
  setResults: (
    clips: Clip[],
    deadSpaces: DeadSpace[],
    transcript: Transcript | null,
    transcriptMeta?: {
      transcriptAvailable?: boolean;
      transcriptError?: string | null;
      transcriptSource?: string | null;
    }
  ) => void;
  updateClipStatus: (clipId: string, status: Clip['status']) => void;
  updateClipTrim: (clipId: string, trimStartOffset: number, trimEndOffset: number) => void;
  
  setExporting: (isExporting: boolean) => void;
  setExportProgress: (progress: { current: number; total: number; clipName: string } | null) => void;
  setLastExportDir: (dir: string | null) => void;
  
  reset: () => void;
}

const defaultSettings: DetectionSettings = {
  targetCount: 10,
  minDuration: 45,
  maxDuration: 180,
  skipIntro: 30,
  skipOutro: 30,
  useAiEnhancement: true,
};

export const useStore = create<AppState>()(
  persist(
    (set) => ({
      // Initial state
      hasHydrated: false,
      project: null,
      currentJobId: null,
      lastJobId: null,
      isDetecting: false,
      detectionProgress: null,
      detectionError: null,
      clips: [],
      deadSpaces: [],
      transcript: null,
      transcriptAvailable: false,
      transcriptError: null,
      transcriptSource: null,
      settings: defaultSettings,
      isExporting: false,
      exportProgress: null,
      lastExportDir: null,
      captionStyle: 'viral',
      openaiApiKey: null,

      // Actions
      setHasHydrated: (hasHydrated) => set({ hasHydrated }),
      setProject: (project) => set({ project }),
      setOpenaiApiKey: (openaiApiKey) => set({ openaiApiKey }),
      
      clearProject: () => set({
        project: null,
        currentJobId: null,
        lastJobId: null,
        clips: [],
        deadSpaces: [],
        transcript: null,
        transcriptAvailable: false,
        transcriptError: null,
        transcriptSource: null,
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

      setTranscriptMeta: (meta) => set({
        transcriptAvailable: meta.transcriptAvailable ?? false,
        transcriptError: meta.transcriptError ?? null,
        transcriptSource: meta.transcriptSource ?? null,
      }),
      
      setResults: (clips, deadSpaces, transcript, transcriptMeta) => set({
        clips,
        deadSpaces,
        transcript,
        transcriptAvailable: transcriptMeta?.transcriptAvailable ?? !!(transcript && transcript.segments && transcript.segments.length),
        transcriptError: transcriptMeta?.transcriptError ?? null,
        transcriptSource: transcriptMeta?.transcriptSource ?? null,
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
      setCaptionStyle: (captionStyle) => set({ captionStyle }),

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
        transcriptAvailable: false,
        transcriptError: null,
        transcriptSource: null,
        isExporting: false,
        exportProgress: null,
      }),
    }),
    {
      name: 'podflow-storage',
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
      partialize: (state) => ({
        settings: state.settings,
        lastExportDir: state.lastExportDir,
        clips: state.clips,
        transcript: state.transcript,
        transcriptAvailable: state.transcriptAvailable,
        transcriptError: state.transcriptError,
        transcriptSource: state.transcriptSource,
        captionStyle: state.captionStyle,
        openaiApiKey: state.openaiApiKey,
      }),
    }
  )
);
