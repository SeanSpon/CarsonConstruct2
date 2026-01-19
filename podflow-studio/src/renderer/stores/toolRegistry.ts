/**
 * Tool Registry - Central registration for all tools in the application
 * 
 * Both UI buttons and AI chat use the same tools through this registry.
 * This is the "Cursor for Premiere Pro" pattern - one unified system.
 */

import { create } from 'zustand';

// ============================================
// TYPES
// ============================================

export type ToolCategory = 
  | 'analysis'    // Analyze clips, detect patterns
  | 'effects'     // Apply video/audio effects
  | 'editing'     // Trim, split, merge clips
  | 'export'      // Export clips/compilations
  | 'ui'          // Control the UI (show panels, highlight)
  | 'project'     // Project operations (save, load)
  | 'playback';   // Video playback control

export interface ToolParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  description: string;
  required?: boolean;
  default?: unknown;
  enum?: string[];
}

export interface ToolDefinition {
  name: string;
  description: string;
  category: ToolCategory;
  parameters: ToolParameter[];
  execute: (args: Record<string, unknown>, context: ToolContext) => Promise<ToolResult>;
  // For AI tool calling - which provider capability is needed
  requiredCapability?: 'text_completion' | 'vision' | 'transcription' | 'image_generation';
}

export interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
  // For UI feedback
  message?: string;
  // If the tool wants to show something in the UI
  uiAction?: {
    type: 'highlight' | 'scroll' | 'select' | 'show_panel' | 'toast';
    target?: string;
    options?: Record<string, unknown>;
  };
}

export interface ToolContext {
  // Current project state
  projectPath?: string;
  clips: unknown[];
  selectedClipId?: string;
  currentTime: number;
  isPlaying: boolean;
  transcript?: unknown;
  
  // Callbacks to update UI
  onSeekToTime?: (time: number) => void;
  onSelectClip?: (clipId: string) => void;
  onUpdateClipStatus?: (clipId: string, status: 'accepted' | 'rejected' | 'pending') => void;
  onUpdateClipTrim?: (clipId: string, trimStart: number, trimEnd: number) => void;
  onShowPanel?: (panel: string) => void;
  onPlayVideo?: () => void;
  onPauseVideo?: () => void;
  onHighlight?: (elementId: string) => void;
  onToast?: (message: string, type: 'success' | 'error' | 'info') => void;
}

// ============================================
// ACTION BUS - Dispatch actions from anywhere
// ============================================

type ActionListener = (action: string, args: Record<string, unknown>) => void;

class ActionBus {
  private listeners: Set<ActionListener> = new Set();
  
  subscribe(listener: ActionListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
  
  dispatch(action: string, args: Record<string, unknown> = {}): void {
    this.listeners.forEach(listener => listener(action, args));
  }
}

export const actionBus = new ActionBus();

// ============================================
// TOOL REGISTRY STORE
// ============================================

interface ToolRegistryState {
  tools: Map<string, ToolDefinition>;
  context: ToolContext;
  
  // Actions
  registerTool: (tool: ToolDefinition) => void;
  unregisterTool: (name: string) => void;
  getTool: (name: string) => ToolDefinition | undefined;
  getToolsByCategory: (category: ToolCategory) => ToolDefinition[];
  getAllTools: () => ToolDefinition[];
  executeTool: (name: string, args: Record<string, unknown>) => Promise<ToolResult>;
  setContext: (context: Partial<ToolContext>) => void;
  
  // For AI - get tool definitions in the format AI providers expect
  getToolDefinitionsForAI: () => Array<{
    name: string;
    description: string;
    input_schema: {
      type: 'object';
      properties: Record<string, unknown>;
      required?: string[];
    };
  }>;
}

export const useToolRegistry = create<ToolRegistryState>((set, get) => ({
  tools: new Map(),
  context: {
    clips: [],
    currentTime: 0,
    isPlaying: false,
  },
  
  registerTool: (tool) => {
    set((state) => {
      const newTools = new Map(state.tools);
      newTools.set(tool.name, tool);
      return { tools: newTools };
    });
  },
  
  unregisterTool: (name) => {
    set((state) => {
      const newTools = new Map(state.tools);
      newTools.delete(name);
      return { tools: newTools };
    });
  },
  
  getTool: (name) => {
    return get().tools.get(name);
  },
  
  getToolsByCategory: (category) => {
    return Array.from(get().tools.values()).filter(t => t.category === category);
  },
  
  getAllTools: () => {
    return Array.from(get().tools.values());
  },
  
  executeTool: async (name, args) => {
    const tool = get().tools.get(name);
    if (!tool) {
      return { success: false, error: `Tool not found: ${name}` };
    }
    
    try {
      const result = await tool.execute(args, get().context);
      
      // Dispatch to action bus so UI can react
      actionBus.dispatch(`tool:${name}:complete`, { args, result });
      
      return result;
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Unknown error';
      return { success: false, error };
    }
  },
  
  setContext: (contextUpdate) => {
    set((state) => ({
      context: { ...state.context, ...contextUpdate },
    }));
  },
  
  getToolDefinitionsForAI: () => {
    const tools = get().getAllTools();
    return tools.map(tool => ({
      name: tool.name,
      description: tool.description,
      input_schema: {
        type: 'object' as const,
        properties: tool.parameters.reduce((acc, param) => {
          acc[param.name] = {
            type: param.type,
            description: param.description,
            ...(param.enum ? { enum: param.enum } : {}),
            ...(param.default !== undefined ? { default: param.default } : {}),
          };
          return acc;
        }, {} as Record<string, unknown>),
        required: tool.parameters.filter(p => p.required).map(p => p.name),
      },
    }));
  },
}));

// ============================================
// BUILT-IN TOOLS
// ============================================

// Helper to register all built-in tools
export function registerBuiltInTools(): void {
  const { registerTool } = useToolRegistry.getState();
  
  // -----------------------------------------
  // PLAYBACK TOOLS
  // -----------------------------------------
  
  registerTool({
    name: 'seek_to_time',
    description: 'Seek the video to a specific timestamp',
    category: 'playback',
    parameters: [
      { name: 'time', type: 'number', description: 'Time in seconds', required: true },
    ],
    execute: async (args, context) => {
      const time = args.time as number;
      context.onSeekToTime?.(time);
      return { 
        success: true, 
        message: `Seeked to ${formatTime(time)}`,
        uiAction: { type: 'scroll', target: 'timeline' },
      };
    },
  });
  
  registerTool({
    name: 'play_pause',
    description: 'Control video playback',
    category: 'playback',
    parameters: [
      { name: 'action', type: 'string', description: 'play, pause, or toggle', enum: ['play', 'pause', 'toggle'], default: 'toggle' },
    ],
    execute: async (args, context) => {
      const action = (args.action as string) || 'toggle';
      if (action === 'play' || (action === 'toggle' && !context.isPlaying)) {
        context.onPlayVideo?.();
        return { success: true, message: 'Playing video' };
      } else {
        context.onPauseVideo?.();
        return { success: true, message: 'Paused video' };
      }
    },
  });
  
  // -----------------------------------------
  // CLIP SELECTION TOOLS
  // -----------------------------------------
  
  registerTool({
    name: 'select_clip',
    description: 'Select a clip by ID or index',
    category: 'editing',
    parameters: [
      { name: 'clipId', type: 'string', description: 'Clip ID to select' },
      { name: 'clipIndex', type: 'number', description: 'Clip index (0-based)' },
    ],
    execute: async (args, context) => {
      const clipId = args.clipId as string | undefined;
      const clipIndex = args.clipIndex as number | undefined;
      
      let targetId = clipId;
      if (!targetId && clipIndex !== undefined) {
        const clip = (context.clips as Array<{ id: string }>)[clipIndex];
        targetId = clip?.id;
      }
      
      if (!targetId) {
        return { success: false, error: 'Clip not found' };
      }
      
      context.onSelectClip?.(targetId);
      return { 
        success: true, 
        message: `Selected clip`,
        uiAction: { type: 'select', target: targetId },
      };
    },
  });
  
  registerTool({
    name: 'set_clip_status',
    description: 'Accept, reject, or reset clips',
    category: 'editing',
    parameters: [
      { name: 'clipIds', type: 'array', description: 'Array of clip IDs', required: true },
      { name: 'status', type: 'string', description: 'Status to set', enum: ['accepted', 'rejected', 'pending'], required: true },
    ],
    execute: async (args, context) => {
      const clipIds = args.clipIds as string[];
      const status = args.status as 'accepted' | 'rejected' | 'pending';
      
      clipIds.forEach(id => context.onUpdateClipStatus?.(id, status));
      
      return { 
        success: true, 
        message: `Set ${clipIds.length} clip(s) to ${status}`,
        data: { clipIds, status },
      };
    },
  });
  
  registerTool({
    name: 'trim_clip',
    description: 'Adjust trim offsets for a clip',
    category: 'editing',
    parameters: [
      { name: 'clipId', type: 'string', description: 'Clip ID (uses selected if not provided)' },
      { name: 'trimStartOffset', type: 'number', description: 'Seconds to add/remove from start', default: 0 },
      { name: 'trimEndOffset', type: 'number', description: 'Seconds to add/remove from end', default: 0 },
    ],
    execute: async (args, context) => {
      const clipId = (args.clipId as string) || context.selectedClipId;
      if (!clipId) {
        return { success: false, error: 'No clip selected' };
      }
      
      const trimStart = (args.trimStartOffset as number) || 0;
      const trimEnd = (args.trimEndOffset as number) || 0;
      
      context.onUpdateClipTrim?.(clipId, trimStart, trimEnd);
      
      return { 
        success: true, 
        message: `Trimmed clip (start: ${trimStart >= 0 ? '+' : ''}${trimStart}s, end: ${trimEnd >= 0 ? '+' : ''}${trimEnd}s)`,
      };
    },
  });
  
  // -----------------------------------------
  // UI CONTROL TOOLS
  // -----------------------------------------
  
  registerTool({
    name: 'show_panel',
    description: 'Show or hide a panel in the UI',
    category: 'ui',
    parameters: [
      { name: 'panel', type: 'string', description: 'Panel to show', enum: ['effects', 'settings', 'chat', 'timeline', 'clips'], required: true },
      { name: 'visible', type: 'boolean', description: 'Show or hide', default: true },
    ],
    execute: async (args, context) => {
      const panel = args.panel as string;
      context.onShowPanel?.(panel);
      return { 
        success: true, 
        message: `Showing ${panel} panel`,
        uiAction: { type: 'show_panel', target: panel },
      };
    },
  });
  
  registerTool({
    name: 'highlight_element',
    description: 'Highlight an element in the UI to draw attention',
    category: 'ui',
    parameters: [
      { name: 'elementId', type: 'string', description: 'Element to highlight (clipId, button name, etc.)', required: true },
      { name: 'duration', type: 'number', description: 'How long to highlight in ms', default: 2000 },
    ],
    execute: async (args, context) => {
      const elementId = args.elementId as string;
      context.onHighlight?.(elementId);
      return { 
        success: true, 
        message: `Highlighting ${elementId}`,
        uiAction: { type: 'highlight', target: elementId, options: { duration: args.duration } },
      };
    },
  });
  
  registerTool({
    name: 'show_toast',
    description: 'Show a toast notification to the user',
    category: 'ui',
    parameters: [
      { name: 'message', type: 'string', description: 'Message to display', required: true },
      { name: 'type', type: 'string', description: 'Toast type', enum: ['success', 'error', 'info'], default: 'info' },
    ],
    execute: async (args, context) => {
      const message = args.message as string;
      const type = (args.type as 'success' | 'error' | 'info') || 'info';
      context.onToast?.(message, type);
      return { 
        success: true, 
        uiAction: { type: 'toast', options: { message, type } },
      };
    },
  });
  
  // -----------------------------------------
  // PROJECT/STATE TOOLS
  // -----------------------------------------
  
  registerTool({
    name: 'get_project_state',
    description: 'Get current project state including clips, scores, and status',
    category: 'project',
    parameters: [
      { name: 'includeTranscript', type: 'boolean', description: 'Include full transcript', default: false },
    ],
    execute: async (args, context) => {
      const clips = context.clips as Array<{
        id: string;
        title?: string;
        startTime: number;
        endTime: number;
        duration: number;
        pattern?: string;
        finalScore?: number;
        hookStrength?: number;
        status?: string;
      }>;
      
      const accepted = clips.filter(c => c.status === 'accepted').length;
      const rejected = clips.filter(c => c.status === 'rejected').length;
      const pending = clips.filter(c => c.status === 'pending').length;
      
      return {
        success: true,
        data: {
          projectPath: context.projectPath,
          currentTime: context.currentTime,
          selectedClipId: context.selectedClipId,
          clips: {
            total: clips.length,
            accepted,
            rejected,
            pending,
            list: clips.map((c, i) => ({
              index: i,
              id: c.id,
              title: c.title,
              startTime: c.startTime,
              endTime: c.endTime,
              duration: c.duration,
              pattern: c.pattern,
              score: c.finalScore,
              hookStrength: c.hookStrength,
              status: c.status,
            })),
          },
          transcript: args.includeTranscript ? context.transcript : { available: !!context.transcript },
        },
      };
    },
  });
  
  registerTool({
    name: 'get_transcript',
    description: 'Get transcript text for a time range or clip',
    category: 'project',
    parameters: [
      { name: 'clipId', type: 'string', description: 'Get transcript for specific clip' },
      { name: 'startTime', type: 'number', description: 'Start time in seconds' },
      { name: 'endTime', type: 'number', description: 'End time in seconds' },
    ],
    execute: async (args, context) => {
      if (!context.transcript) {
        return { success: false, error: 'No transcript available' };
      }
      
      const transcript = context.transcript as { words?: Array<{ word: string; start: number; end: number }> };
      if (!transcript.words) {
        return { success: false, error: 'Transcript has no word-level data' };
      }
      
      let startTime = args.startTime as number | undefined;
      let endTime = args.endTime as number | undefined;
      
      // If clipId provided, get times from clip
      if (args.clipId) {
        const clip = (context.clips as Array<{ id: string; startTime: number; endTime: number }>)
          .find(c => c.id === args.clipId);
        if (clip) {
          startTime = clip.startTime;
          endTime = clip.endTime;
        }
      }
      
      if (startTime === undefined || endTime === undefined) {
        return { success: false, error: 'Must provide clipId or startTime/endTime' };
      }
      
      const words = transcript.words.filter(w => w.start >= startTime! && w.end <= endTime!);
      const text = words.map(w => w.word).join(' ');
      
      return {
        success: true,
        data: {
          startTime,
          endTime,
          text,
          wordCount: words.length,
        },
      };
    },
  });
}

// ============================================
// HELPERS
// ============================================

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}
