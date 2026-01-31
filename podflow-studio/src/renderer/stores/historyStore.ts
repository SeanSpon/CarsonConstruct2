import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface DetectedClip {
  id: string;
  startTime: number;
  endTime: number;
  duration: number;
  title?: string;
  mood?: string;
  pattern?: string;
  patternLabel?: string;
  description?: string;
  algorithmScore?: number;
  finalScore?: number;
  hookStrength?: number;
  hookMultiplier?: number;
  status?: 'pending' | 'accepted' | 'rejected';
  captionStyle?: 'viral' | 'minimal' | 'bold';
}

export interface HistoryProject {
  id: string;
  fileName: string;
  filePath: string;
  duration: number;
  createdAt: number;
  clipCount: number;
  acceptedCount: number;
  exportedCount?: number;
  thumbnailPath?: string;
  lastExportDir?: string;
  size?: number;
  resolution?: string;
  width?: number;
  height?: number;
  fps?: number;
  bitrate?: number;
  transcript?: unknown;
  transcriptAvailable?: boolean;
  transcriptError?: string | null;
  transcriptSource?: string | null;
  detectedClips?: DetectedClip[];
}

export interface HistoryClip {
  id: string;
  projectId: string;
  title: string;
  startTime: number;
  endTime: number;
  duration: number;
  mood?: string;
  exportedAt?: number;
  exportPath?: string;
  thumbnailPath?: string;
  captionStyle?: 'viral' | 'minimal' | 'bold';
}

interface HistoryState {
  hasHydrated: boolean;
  setHasHydrated: (hasHydrated: boolean) => void;

  projects: HistoryProject[];
  clips: HistoryClip[];
  
  addProject: (project: Omit<HistoryProject, 'id' | 'createdAt'>) => string;
  updateProject: (id: string, updates: Partial<HistoryProject>) => void;
  removeProject: (id: string) => void;
  
  addClip: (clip: Omit<HistoryClip, 'id'>) => void;
  updateClip: (id: string, updates: Partial<HistoryClip>) => void;
  getProjectClips: (projectId: string) => HistoryClip[];
  getProject: (projectId: string) => HistoryProject | undefined;
  
  clearHistory: () => void;
}

export const useHistoryStore = create<HistoryState>()(
  persist(
    (set, get) => ({
      hasHydrated: false,
      projects: [],
      clips: [],

      setHasHydrated: (hasHydrated) => set({ hasHydrated }),
      
      addProject: (project) => {
        const id = `proj_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const newProject: HistoryProject = {
          ...project,
          id,
          createdAt: Date.now(),
        };
        set(state => ({
          projects: [newProject, ...state.projects].slice(0, 50), // Keep last 50 projects
        }));
        return id;
      },
      
      updateProject: (id, updates) => {
        set(state => ({
          projects: state.projects.map(p =>
            p.id === id ? { ...p, ...updates } : p
          ),
        }));
      },
      
      removeProject: (id) => {
        set(state => ({
          projects: state.projects.filter(p => p.id !== id),
          clips: state.clips.filter(c => c.projectId !== id),
        }));
      },
      
      addClip: (clip) => {
        const id = `clip_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const newClip: HistoryClip = { ...clip, id };
        set(state => ({
          clips: [newClip, ...state.clips].slice(0, 500), // Keep last 500 clips
        }));
      },
      
      updateClip: (id, updates) => {
        set(state => ({
          clips: state.clips.map(c =>
            c.id === id ? { ...c, ...updates } : c
          ),
        }));
      },
      
      getProjectClips: (projectId) => {
        return get().clips.filter(c => c.projectId === projectId);
      },

      getProject: (projectId) => {
        return get().projects.find(p => p.id === projectId);
      },
      
      clearHistory: () => {
        set({ projects: [], clips: [] });
      },
    }),
    {
      name: 'podflow-history',
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
      version: 1,
    }
  )
);
