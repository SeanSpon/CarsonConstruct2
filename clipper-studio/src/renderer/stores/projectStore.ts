import { create } from 'zustand';
import { DetectedClip, ClipStatus, FileInfo, DetectionProgress } from '../types';

interface ProjectState {
  // Project info
  projectName: string | null;
  projectPath: string | null;
  projectFile: string | null;

  // File info
  filePath: string | null;
  fileName: string | null;
  fileSize: number;
  fileDuration: number;

  // Detection state
  isDetecting: boolean;
  detectionProgress: DetectionProgress | null;
  detectionError: string | null;

  // Clips
  clips: DetectedClip[];
  waveform: number[];

  // Export state
  isExporting: boolean;
  exportProgress: { current: number; total: number } | null;

  // Actions
  setProject: (info: { name: string; path: string; file: string }) => void;
  clearProject: () => void;
  setFile: (info: FileInfo) => void;
  clearFile: () => void;
  
  setDetecting: (isDetecting: boolean) => void;
  setDetectionProgress: (progress: DetectionProgress | null) => void;
  setDetectionError: (error: string | null) => void;
  
  setClips: (clips: DetectedClip[], waveform: number[]) => void;
  updateClipStatus: (clipId: string, status: ClipStatus) => void;
  updateClipTrim: (clipId: string, trimStartOffset: number, trimEndOffset: number) => void;
  
  setExporting: (isExporting: boolean) => void;
  setExportProgress: (progress: { current: number; total: number } | null) => void;
  
  reset: () => void;
}

const initialState = {
  projectName: null,
  projectPath: null,
  projectFile: null,
  filePath: null,
  fileName: null,
  fileSize: 0,
  fileDuration: 0,
  isDetecting: false,
  detectionProgress: null,
  detectionError: null,
  clips: [],
  waveform: [],
  isExporting: false,
  exportProgress: null,
};

export const useProjectStore = create<ProjectState>((set) => ({
  ...initialState,

  setProject: (info: { name: string; path: string; file: string }) => set({
    projectName: info.name,
    projectPath: info.path,
    projectFile: info.file,
  }),

  clearProject: () => set({
    projectName: null,
    projectPath: null,
    projectFile: null,
    filePath: null,
    fileName: null,
    fileSize: 0,
    fileDuration: 0,
  }),

  setFile: (info: FileInfo) => set({
    filePath: info.path,
    fileName: info.name,
    fileSize: info.size,
    fileDuration: info.duration,
  }),

  clearFile: () => set({
    filePath: null,
    fileName: null,
    fileSize: 0,
    fileDuration: 0,
  }),

  setDetecting: (isDetecting: boolean) => set({ isDetecting }),

  setDetectionProgress: (progress: DetectionProgress | null) => set({ 
    detectionProgress: progress,
    detectionError: null,
  }),

  setDetectionError: (error: string | null) => set({ 
    detectionError: error,
    isDetecting: false,
  }),

  setClips: (clips: DetectedClip[], waveform: number[]) => set({ 
    clips, 
    waveform,
    isDetecting: false,
    detectionProgress: null,
  }),

  updateClipStatus: (clipId: string, status: ClipStatus) => set((state) => ({
    clips: state.clips.map((clip) =>
      clip.id === clipId ? { ...clip, status } : clip
    ),
  })),

  updateClipTrim: (clipId: string, trimStartOffset: number, trimEndOffset: number) => set((state) => ({
    clips: state.clips.map((clip) =>
      clip.id === clipId ? { ...clip, trimStartOffset, trimEndOffset } : clip
    ),
  })),

  setExporting: (isExporting: boolean) => set({ isExporting }),

  setExportProgress: (progress: { current: number; total: number } | null) => set({ 
    exportProgress: progress 
  }),

  reset: () => set(initialState),
}));
