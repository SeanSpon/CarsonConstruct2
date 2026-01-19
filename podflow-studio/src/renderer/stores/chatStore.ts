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
}

// Tool categories for UI organization
export type ToolCategory = 'analysis' | 'action' | 'basic';

export interface ToolDefinition {
  name: string;
  description: string;
  category: ToolCategory;
  icon?: string;
}

// Available tools that the AI can use - organized by category
export const AVAILABLE_TOOLS: ToolDefinition[] = [
  // Analysis tools - Use algorithms to understand content
  {
    name: 'analyze_clip_quality',
    description: 'Run algorithmic analysis on a clip to get quality metrics, hook strength, energy, speech density, and clipworthiness breakdown',
    category: 'analysis',
    icon: 'sparkles',
  },
  {
    name: 'analyze_energy_curve',
    description: 'Get the energy/loudness profile over time to find peaks, buildups, and drops',
    category: 'analysis',
    icon: 'activity',
  },
  {
    name: 'analyze_speech_patterns',
    description: 'Analyze speech patterns including rate, pauses, sentence boundaries for finding natural cut points',
    category: 'analysis',
    icon: 'message-square',
  },
  {
    name: 'find_optimal_boundaries',
    description: 'Use VAD and speech analysis to find optimal start/end points that avoid mid-word cuts',
    category: 'analysis',
    icon: 'scissors',
  },
  {
    name: 'detect_highlights',
    description: 'Run highlight detection algorithms to find viral moments (payoff, monologue, laughter patterns)',
    category: 'analysis',
    icon: 'zap',
  },
  {
    name: 'compare_clips',
    description: 'Compare clips algorithmically based on hook strength, pacing, energy, and viral potential',
    category: 'analysis',
    icon: 'git-compare',
  },
  
  // Action tools - Make changes based on analysis
  {
    name: 'smart_trim_clip',
    description: 'Intelligently trim a clip using algorithms (tighten, extend hook, sentence boundaries, energy peaks)',
    category: 'action',
    icon: 'crop',
  },
  {
    name: 'auto_review_clips',
    description: 'Automatically review and accept/reject clips based on quality thresholds',
    category: 'action',
    icon: 'check-check',
  },
  {
    name: 'suggest_clip_order',
    description: 'Suggest optimal clip order for compilation based on pacing and energy arc',
    category: 'action',
    icon: 'list-ordered',
  },
  
  // Basic tools - Simple operations
  {
    name: 'seek_to_time',
    description: 'Seek video to a timestamp',
    category: 'basic',
    icon: 'clock',
  },
  {
    name: 'select_clip',
    description: 'Select a clip by ID or index',
    category: 'basic',
    icon: 'mouse-pointer',
  },
  {
    name: 'set_clip_status',
    description: 'Set clip status (accept/reject/pending)',
    category: 'basic',
    icon: 'check-circle',
  },
  {
    name: 'trim_clip',
    description: 'Manually adjust trim offsets',
    category: 'basic',
    icon: 'scissors',
  },
  {
    name: 'get_project_state',
    description: 'Get current project state with all clips and scores',
    category: 'basic',
    icon: 'info',
  },
  {
    name: 'get_transcript',
    description: 'Get transcript for a time range or clip',
    category: 'basic',
    icon: 'file-text',
  },
  {
    name: 'play_pause',
    description: 'Toggle or control video playback',
    category: 'basic',
    icon: 'play',
  },
];

interface ChatState {
  // Messages
  messages: ChatMessage[];
  
  // State
  isLoading: boolean;
  isStreaming: boolean;
  error: string | null;
  
  // Settings
  apiKey: string | null;
  model: string;
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
  setApiKey: (key: string | null) => void;
  setModel: (model: string) => void;
  setShowThinking: (show: boolean) => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  // Initial state
  messages: [],
  isLoading: false,
  isStreaming: false,
  error: null,
  apiKey: null,
  model: 'claude-sonnet-4-20250514',
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
  
  setApiKey: (apiKey) => set({ apiKey }),
  
  setModel: (model) => set({ model }),
  
  setShowThinking: (showThinking) => set({ showThinking }),
}));
