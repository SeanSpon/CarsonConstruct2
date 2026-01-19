import { StateCreator, StoreMutatorIdentifier } from 'zustand';

// Define what state should be tracked for undo/redo
export interface HistoryState {
  clips: any[];
  deadSpaces: any[];
  cameraCuts: any[];
  audioTracks: any[];
  timelineGroups: any[];
  markers: any[]; // Timeline markers
}

interface HistorySlice {
  past: HistoryState[];
  future: HistoryState[];
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
  _addHistory: (state: HistoryState) => void;
}

type Write<T, U> = Omit<T, keyof U> & U;
type Cast<T, U> = T extends U ? T : U;

// History middleware for undo/redo
export const historyMiddleware = <
  T extends HistorySlice,
  Mps extends [StoreMutatorIdentifier, unknown][] = [],
  Mcs extends [StoreMutatorIdentifier, unknown][] = []
>(
  config: StateCreator<T, Mps, Mcs>
) => (
  set: (partial: T | Partial<T> | ((state: T) => T | Partial<T>), replace?: boolean) => void,
  get: () => T,
  api: any
): T => {
  const historySlice: HistorySlice = {
    past: [],
    future: [],
    
    undo: () => {
      const { past, future, clips, deadSpaces, cameraCuts, audioTracks, timelineGroups, markers } = get();
      if (past.length === 0) return;
      
      const previous = past[past.length - 1];
      const newPast = past.slice(0, -1);
      
      // Save current state to future
      const current: HistoryState = { clips, deadSpaces, cameraCuts, audioTracks, timelineGroups, markers };
      
      set({
        ...previous,
        past: newPast,
        future: [current, ...future],
      } as Partial<T>);
    },
    
    redo: () => {
      const { past, future, clips, deadSpaces, cameraCuts, audioTracks, timelineGroups, markers } = get();
      if (future.length === 0) return;
      
      const next = future[0];
      const newFuture = future.slice(1);
      
      // Save current state to past
      const current: HistoryState = { clips, deadSpaces, cameraCuts, audioTracks, timelineGroups, markers };
      
      set({
        ...next,
        past: [...past, current],
        future: newFuture,
      } as Partial<T>);
    },
    
    canUndo: () => {
      return get().past.length > 0;
    },
    
    canRedo: () => {
      return get().future.length > 0;
    },
    
    _addHistory: (state: HistoryState) => {
      const { past } = get();
      set({
        past: [...past, state],
        future: [], // Clear future when new action is performed
      } as Partial<T>);
    },
  };

  // Create the base state from config
  const baseState = config(
    (partial, replace) => {
      const state = get();
      const newState = typeof partial === 'function' ? partial(state) : partial;
      
      // Track history for specific actions
      // We'll manually call _addHistory from actions that should be tracked
      set(newState as T, replace);
    },
    get,
    api
  );

  return {
    ...baseState,
    ...historySlice,
  } as T;
};

// Helper to capture current history state
export const captureHistoryState = (state: any): HistoryState => ({
  clips: JSON.parse(JSON.stringify(state.clips || [])),
  deadSpaces: JSON.parse(JSON.stringify(state.deadSpaces || [])),
  cameraCuts: JSON.parse(JSON.stringify(state.cameraCuts || [])),
  audioTracks: JSON.parse(JSON.stringify(state.audioTracks || [])),
  timelineGroups: JSON.parse(JSON.stringify(state.timelineGroups || [])),
  markers: JSON.parse(JSON.stringify(state.markers || [])),
});
