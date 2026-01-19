import { create } from 'zustand';

// Tool call types
export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
  result?: unknown;
  status: 'pending' | 'running' | 'success' | 'error';
  error?: string;
}

// Message types
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  // For assistant messages
  thinking?: string;
  thinkingCollapsed?: boolean;
  toolCalls?: ToolCall[];
  isStreaming?: boolean;
  // Which provider generated this message
  provider?: string;
  model?: string;
}

// Tool categories for UI organization
export type ToolCategory = 'analysis' | 'action' | 'basic' | 'ui';

export interface ToolDefinition {
  name: string;
  description: string;
  category: ToolCategory;
  icon?: string;
}

// Available tools that the AI can use
export const AVAILABLE_TOOLS: ToolDefinition[] = [
  // Analysis tools
  { name: 'analyze_clip_quality', description: 'Analyze clip quality metrics', category: 'analysis', icon: 'sparkles' },
  { name: 'analyze_energy_curve', description: 'Get energy profile over time', category: 'analysis', icon: 'activity' },
  { name: 'analyze_speech_patterns', description: 'Analyze speech rate and pauses', category: 'analysis', icon: 'message-square' },
  { name: 'find_optimal_boundaries', description: 'Find optimal clip boundaries', category: 'analysis', icon: 'scissors' },
  { name: 'detect_highlights', description: 'Filter existing clips by criteria', category: 'analysis', icon: 'zap' },
  { name: 'compare_clips', description: 'Compare clips', category: 'analysis', icon: 'git-compare' },
  
  // Action tools
  { name: 'run_detection', description: 'Start AI clip detection pipeline', category: 'action', icon: 'search' },
  { name: 'create_vod_compilation', description: 'Create VOD from clips with transitions', category: 'action', icon: 'film' },
  { name: 'smart_trim_clip', description: 'Intelligently trim clip', category: 'action', icon: 'crop' },
  { name: 'auto_review_clips', description: 'Auto accept/reject clips', category: 'action', icon: 'check-check' },
  { name: 'suggest_clip_order', description: 'Suggest clip ordering', category: 'action', icon: 'list-ordered' },
  
  // UI control tools
  { name: 'show_panel', description: 'Show a UI panel', category: 'ui', icon: 'layout' },
  { name: 'highlight_element', description: 'Highlight an element', category: 'ui', icon: 'pointer' },
  
  // Basic tools
  { name: 'seek_to_time', description: 'Seek video', category: 'basic', icon: 'clock' },
  { name: 'select_clip', description: 'Select a clip', category: 'basic', icon: 'mouse-pointer' },
  { name: 'set_clip_status', description: 'Set clip status', category: 'basic', icon: 'check-circle' },
  { name: 'trim_clip', description: 'Adjust trim offsets', category: 'basic', icon: 'scissors' },
  { name: 'get_project_state', description: 'Get project state', category: 'basic', icon: 'info' },
  { name: 'get_transcript', description: 'Get transcript', category: 'basic', icon: 'file-text' },
  { name: 'play_pause', description: 'Control playback', category: 'basic', icon: 'play' },
];

interface ChatState {
  // Messages
  messages: ChatMessage[];
  
  // State
  isLoading: boolean;
  isStreaming: boolean;
  error: string | null;
  
  // Provider tracking (auto-selected)
  lastUsedProvider: string | null;
  lastUsedModel: string | null;
  availableProviders: string[];
  
  // Settings
  showThinking: boolean;
  
  // Actions
  addMessage: (message: Omit<ChatMessage, 'id' | 'timestamp'>) => string;
  updateMessage: (id: string, updates: Partial<ChatMessage>) => void;
  appendToMessage: (id: string, content: string) => void;
  appendThinking: (id: string, thinking: string) => void;
  addToolCall: (messageId: string, toolCall: Omit<ToolCall, 'id' | 'status'>) => string;
  updateToolCall: (messageId: string, toolCallId: string, updates: Partial<ToolCall>) => void;
  toggleThinking: (messageId: string) => void;
  clearMessages: () => void;
  setLoading: (loading: boolean) => void;
  setStreaming: (streaming: boolean) => void;
  setError: (error: string | null) => void;
  setLastUsedProvider: (provider: string | null, model?: string | null) => void;
  setAvailableProviders: (providers: string[]) => void;
  setShowThinking: (show: boolean) => void;
}

export const useChatStore = create<ChatState>((set) => ({
  // Initial state
  messages: [],
  isLoading: false,
  isStreaming: false,
  error: null,
  lastUsedProvider: null,
  lastUsedModel: null,
  availableProviders: [],
  showThinking: true,
  
  // Actions
  addMessage: (message) => {
    const id = `msg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const newMessage: ChatMessage = {
      ...message,
      id,
      timestamp: Date.now(),
    };
    set((state) => ({
      messages: [...state.messages, newMessage],
    }));
    return id;
  },
  
  updateMessage: (id, updates) => {
    set((state) => ({
      messages: state.messages.map((msg) =>
        msg.id === id ? { ...msg, ...updates } : msg
      ),
    }));
  },
  
  appendToMessage: (id, content) => {
    set((state) => ({
      messages: state.messages.map((msg) =>
        msg.id === id ? { ...msg, content: msg.content + content } : msg
      ),
    }));
  },
  
  appendThinking: (id, thinking) => {
    set((state) => ({
      messages: state.messages.map((msg) =>
        msg.id === id ? { ...msg, thinking: (msg.thinking || '') + thinking } : msg
      ),
    }));
  },
  
  addToolCall: (messageId, toolCall) => {
    const toolCallId = `tool_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const newToolCall: ToolCall = {
      ...toolCall,
      id: toolCallId,
      status: 'pending',
    };
    set((state) => ({
      messages: state.messages.map((msg) =>
        msg.id === messageId
          ? { ...msg, toolCalls: [...(msg.toolCalls || []), newToolCall] }
          : msg
      ),
    }));
    return toolCallId;
  },
  
  updateToolCall: (messageId, toolCallId, updates) => {
    set((state) => ({
      messages: state.messages.map((msg) =>
        msg.id === messageId
          ? {
              ...msg,
              toolCalls: msg.toolCalls?.map((tc) =>
                tc.id === toolCallId ? { ...tc, ...updates } : tc
              ),
            }
          : msg
      ),
    }));
  },
  
  toggleThinking: (messageId) => {
    set((state) => ({
      messages: state.messages.map((msg) =>
        msg.id === messageId
          ? { ...msg, thinkingCollapsed: !msg.thinkingCollapsed }
          : msg
      ),
    }));
  },
  
  clearMessages: () => {
    set({ messages: [], error: null });
  },
  
  setLoading: (isLoading) => set({ isLoading }),
  
  setStreaming: (isStreaming) => set({ isStreaming }),
  
  setError: (error) => set({ error }),
  
  setLastUsedProvider: (provider, model = null) => set({ 
    lastUsedProvider: provider,
    lastUsedModel: model,
  }),
  
  setAvailableProviders: (providers) => set({ availableProviders: providers }),
  
  setShowThinking: (showThinking) => set({ showThinking }),
}));
