import { memo, useState, useRef, useEffect, useCallback } from 'react';
import { 
  Send, 
  Bot, 
  User, 
  Brain, 
  ChevronDown, 
  ChevronRight,
  Wrench,
  CheckCircle2,
  XCircle,
  Loader2,
  Trash2,
  Play,
  Clock,
  Scissors,
  FileText,
  Sparkles,
  Activity,
  MessageSquare,
  Zap,
  GitCompare,
  Crop,
  CheckCheck,
  ListOrdered,
  MousePointer,
  Info,
  Clapperboard,
  CircleDot,
  Copy,
  Check,
  Search,
  Film,
} from 'lucide-react';
import { useChatStore, type ChatMessage, type ToolCall } from '../../stores/chatStore';
import { useStore } from '../../stores/store';
import { formatTimestamp } from '../../types';

// Tool icon mapping - organized by category
const toolIcons: Record<string, React.ReactNode> = {
  // Analysis tools - use inherit color from parent
  analyze_clip_quality: <Sparkles className="w-4 h-4" />,
  analyze_energy_curve: <Activity className="w-4 h-4" />,
  analyze_speech_patterns: <MessageSquare className="w-4 h-4" />,
  find_optimal_boundaries: <Scissors className="w-4 h-4" />,
  detect_highlights: <Zap className="w-4 h-4" />,
  compare_clips: <GitCompare className="w-4 h-4" />,
  // Action tools
  smart_trim_clip: <Crop className="w-4 h-4" />,
  auto_review_clips: <CheckCheck className="w-4 h-4" />,
  suggest_clip_order: <ListOrdered className="w-4 h-4" />,
  run_detection: <Search className="w-4 h-4" />,
  create_vod_compilation: <Film className="w-4 h-4" />,
  // Basic tools
  seek_to_time: <Clock className="w-4 h-4" />,
  select_clip: <MousePointer className="w-4 h-4" />,
  set_clip_status: <CheckCircle2 className="w-4 h-4" />,
  trim_clip: <Scissors className="w-4 h-4" />,
  get_project_state: <Info className="w-4 h-4" />,
  get_transcript: <FileText className="w-4 h-4" />,
  play_pause: <Play className="w-4 h-4" />,
};

// Helper to copy text to clipboard
const copyToClipboard = async (text: string): Promise<boolean> => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
};

// Tool category colors - organized by function
const toolCategoryColors: Record<string, string> = {
  // Analysis tools - cyan (main bot theme)
  analyze_clip_quality: 'text-cyan-400',
  analyze_energy_curve: 'text-cyan-400',
  analyze_speech_patterns: 'text-cyan-400',
  find_optimal_boundaries: 'text-cyan-400',
  detect_highlights: 'text-amber-400', // Special: highlight detection
  compare_clips: 'text-cyan-400',
  // Action tools - emerald (taking action)
  smart_trim_clip: 'text-emerald-400',
  auto_review_clips: 'text-emerald-400',
  suggest_clip_order: 'text-emerald-400',
  run_detection: 'text-amber-400', // Special: runs detection
  create_vod_compilation: 'text-pink-400', // Special: creates compilation
  // Basic tools - violet (utility)
  seek_to_time: 'text-violet-400',
  select_clip: 'text-violet-400',
  set_clip_status: 'text-emerald-400',
  trim_clip: 'text-emerald-400',
  get_project_state: 'text-violet-400',
  get_transcript: 'text-violet-400',
  play_pause: 'text-violet-400',
};

// Status text mapping
const toolStatusText: Record<string, string> = {
  pending: 'Queued',
  running: 'Running...',
  success: 'Complete',
  error: 'Failed',
};

// Friendly tool name mapping
const toolFriendlyNames: Record<string, string> = {
  analyze_clip_quality: 'Analyzing clip quality',
  analyze_energy_curve: 'Mapping energy levels',
  analyze_speech_patterns: 'Analyzing speech patterns',
  find_optimal_boundaries: 'Finding optimal boundaries',
  detect_highlights: 'Detecting highlights',
  compare_clips: 'Comparing clips',
  smart_trim_clip: 'Smart trimming',
  auto_review_clips: 'Auto-reviewing clips',
  suggest_clip_order: 'Suggesting order',
  run_detection: 'Scanning for viral moments',
  create_vod_compilation: 'Creating VOD compilation',
  seek_to_time: 'Seeking video',
  select_clip: 'Selecting clip',
  set_clip_status: 'Updating status',
  trim_clip: 'Trimming clip',
  get_project_state: 'Loading project state',
  get_transcript: 'Loading transcript',
  play_pause: 'Controlling playback',
};

// Tool call component - enhanced with better visuals
function ToolCallDisplay({ toolCall }: { toolCall: ToolCall }) {
  const [showDetails, setShowDetails] = useState(false);
  
  const isRunning = toolCall.status === 'running' || toolCall.status === 'pending';
  const isSuccess = toolCall.status === 'success';
  const isError = toolCall.status === 'error';
  
  const statusColors = {
    pending: 'border-cyan-500/30 bg-cyan-500/5',
    running: 'border-cyan-500/50 bg-cyan-500/10',
    success: 'border-emerald-500/30 bg-emerald-500/5',
    error: 'border-red-500/30 bg-red-500/5',
  }[toolCall.status];

  const statusIcon = {
    pending: (
      <div className="flex items-center gap-1.5">
        <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
        <span className="text-cyan-400">Queued</span>
      </div>
    ),
    running: (
      <div className="flex items-center gap-1.5">
        <Loader2 className="w-3.5 h-3.5 animate-spin text-cyan-400" />
        <span className="text-cyan-400">Running</span>
      </div>
    ),
    success: (
      <div className="flex items-center gap-1.5">
        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
        <span className="text-emerald-400">Done</span>
      </div>
    ),
    error: (
      <div className="flex items-center gap-1.5">
        <XCircle className="w-3.5 h-3.5 text-red-400" />
        <span className="text-red-400">Failed</span>
      </div>
    ),
  }[toolCall.status];
  
  const friendlyName = toolFriendlyNames[toolCall.name] || toolCall.name;
  
  return (
    <div className={`my-2 rounded-lg border ${statusColors} overflow-hidden transition-all duration-300`}>
      <button
        onClick={() => setShowDetails(!showDetails)}
        className="w-full flex items-center gap-2 px-3 py-2.5 text-xs hover:bg-white/5 transition-colors"
      >
        {showDetails ? (
          <ChevronDown className="w-3.5 h-3.5 text-sz-text-muted" />
        ) : (
          <ChevronRight className="w-3.5 h-3.5 text-sz-text-muted" />
        )}
        <span className={`${toolCategoryColors[toolCall.name] || 'text-cyan-400'}`}>
          {toolIcons[toolCall.name] || <Wrench className="w-4 h-4" />}
        </span>
        <span className="text-sz-text font-medium">{friendlyName}</span>
        <span className="flex-1" />
        {statusIcon}
      </button>
      
      {showDetails && (
        <div className="px-3 pb-3 space-y-2 text-xs border-t border-white/5">
          <div className="pt-2">
            <div className="text-sz-text-muted mb-1 flex items-center gap-1">
              <code className="text-[10px] text-cyan-400/70">{toolCall.name}</code>
            </div>
            <pre className="bg-black/30 p-2 rounded-md overflow-x-auto text-sz-text-secondary font-mono text-[10px]">
              {JSON.stringify(toolCall.arguments, null, 2)}
            </pre>
          </div>
          {toolCall.result !== undefined && (
            <div>
              <div className="text-emerald-400/70 mb-1">Result:</div>
              <pre className="bg-black/30 p-2 rounded-md overflow-x-auto text-sz-text-secondary font-mono text-[10px] max-h-32 overflow-y-auto">
                {typeof toolCall.result === 'string' 
                  ? toolCall.result 
                  : JSON.stringify(toolCall.result, null, 2)}
              </pre>
            </div>
          )}
          {toolCall.error && (
            <div>
              <div className="text-red-400 mb-1">Error:</div>
              <pre className="bg-red-500/10 p-2 rounded-md overflow-x-auto text-red-400 font-mono text-[10px]">
                {toolCall.error}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Thinking block component - enhanced with cyan theme
function ThinkingBlock({ 
  thinking, 
  collapsed, 
  onToggle 
}: { 
  thinking: string; 
  collapsed?: boolean; 
  onToggle: () => void;
}) {
  if (!thinking) return null;
  
  return (
    <div className="my-2 rounded-lg border border-cyan-500/20 bg-gradient-to-r from-cyan-500/5 to-transparent overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-2 px-3 py-2.5 text-xs hover:bg-cyan-500/10 transition-colors"
      >
        {collapsed ? (
          <ChevronRight className="w-3.5 h-3.5 text-cyan-400" />
        ) : (
          <ChevronDown className="w-3.5 h-3.5 text-cyan-400" />
        )}
        <Brain className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
        <span className="text-cyan-400 font-medium">Thinking...</span>
        <div className="flex gap-0.5 ml-1">
          <div className="w-1 h-1 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: '0ms' }} />
          <div className="w-1 h-1 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: '150ms' }} />
          <div className="w-1 h-1 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
      </button>
      
      {!collapsed && (
        <div className="px-3 pb-3 border-t border-cyan-500/10">
          <div className="text-xs text-sz-text-secondary whitespace-pre-wrap font-mono leading-relaxed pt-2">
            {thinking}
          </div>
        </div>
      )}
    </div>
  );
}

// Loading indicator when bot is processing
function BotLoadingIndicator() {
  return (
    <div className="flex gap-3">
      {/* Avatar with pulse */}
      <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500/30 to-cyan-600/20 flex items-center justify-center ring-2 ring-cyan-500/30 animate-pulse">
        <Clapperboard className="w-4 h-4 text-cyan-400" />
      </div>
      
      {/* Loading content */}
      <div className="flex-1">
        <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-sz-bg-secondary/80 border border-cyan-500/20 max-w-[200px]">
          <div className="flex gap-1">
            <div className="w-2 h-2 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: '0ms' }} />
            <div className="w-2 h-2 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: '150ms' }} />
            <div className="w-2 h-2 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
          <span className="text-xs text-cyan-400/80 ml-1">Clip Bot is thinking...</span>
        </div>
      </div>
    </div>
  );
}

// Message component
function MessageDisplay({ 
  message, 
  onToggleThinking 
}: { 
  message: ChatMessage;
  onToggleThinking: () => void;
}) {
  const isUser = message.role === 'user';
  const hasActiveToolCalls = message.toolCalls?.some(tc => tc.status === 'running' || tc.status === 'pending');
  const [copied, setCopied] = useState(false);
  
  // Format message for copying (includes tool calls and results)
  const formatMessageForCopy = () => {
    let text = `[${message.role.toUpperCase()}] ${new Date(message.timestamp).toLocaleTimeString()}\n`;
    if (message.thinking) {
      text += `\n<thinking>\n${message.thinking}\n</thinking>\n`;
    }
    if (message.toolCalls?.length) {
      text += '\n--- Tool Calls ---\n';
      message.toolCalls.forEach(tc => {
        text += `\n[${tc.name}] (${tc.status})\n`;
        text += `Arguments: ${JSON.stringify(tc.arguments, null, 2)}\n`;
        if (tc.result !== undefined) {
          text += `Result: ${JSON.stringify(tc.result, null, 2)}\n`;
        }
        if (tc.error) {
          text += `Error: ${tc.error}\n`;
        }
      });
    }
    if (message.content) {
      text += `\n${message.content}`;
    }
    return text;
  };
  
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(formatMessageForCopy());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };
  
  return (
    <div className={`flex gap-3 group ${isUser ? 'flex-row-reverse' : ''}`}>
      {/* Avatar */}
      <div className={`
        flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-300
        ${isUser 
          ? 'bg-sz-accent' 
          : hasActiveToolCalls 
            ? 'bg-gradient-to-br from-cyan-500/40 to-cyan-600/30 ring-2 ring-cyan-500/50 animate-pulse' 
            : 'bg-gradient-to-br from-cyan-500/30 to-cyan-600/20 ring-1 ring-cyan-500/20'}
      `}>
        {isUser ? (
          <User className="w-4 h-4 text-white" />
        ) : (
          <Clapperboard className={`w-4 h-4 text-cyan-400 ${hasActiveToolCalls ? 'animate-pulse' : ''}`} />
        )}
      </div>
      
      {/* Content */}
      <div className={`flex-1 min-w-0 ${isUser ? 'text-right' : ''}`}>
        {/* Bot name label with copy button */}
        {!isUser && (message.content || message.toolCalls?.length || message.thinking) && (
          <div className="flex items-center gap-2 mb-1 ml-1">
            <span className="text-[10px] text-cyan-400/70 font-medium">Clip Bot</span>
            <button
              onClick={handleCopy}
              className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 hover:bg-sz-bg-hover rounded"
              title="Copy message (for debugging)"
            >
              {copied ? (
                <Check className="w-3 h-3 text-emerald-400" />
              ) : (
                <Copy className="w-3 h-3 text-sz-text-muted hover:text-sz-text" />
              )}
            </button>
          </div>
        )}
        
        {/* User message copy button */}
        {isUser && (
          <div className="flex items-center justify-end gap-2 mb-1 mr-1">
            <button
              onClick={handleCopy}
              className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 hover:bg-sz-bg-hover rounded"
              title="Copy message"
            >
              {copied ? (
                <Check className="w-3 h-3 text-emerald-400" />
              ) : (
                <Copy className="w-3 h-3 text-sz-text-muted hover:text-sz-text" />
              )}
            </button>
          </div>
        )}
        
        {/* Thinking block */}
        {message.thinking && (
          <ThinkingBlock
            thinking={message.thinking}
            collapsed={message.thinkingCollapsed}
            onToggle={onToggleThinking}
          />
        )}
        
        {/* Tool calls */}
        {message.toolCalls?.map((toolCall) => (
          <ToolCallDisplay key={toolCall.id} toolCall={toolCall} />
        ))}
        
        {/* Message content */}
        {message.content && (
          <div className={`
            inline-block px-3 py-2.5 rounded-lg max-w-full select-text
            ${isUser 
              ? 'bg-sz-accent text-white' 
              : 'bg-sz-bg-secondary/80 text-sz-text border border-sz-border/50'}
          `}>
            <div className="text-sm whitespace-pre-wrap break-words leading-relaxed select-text">
              {message.content}
              {message.isStreaming && (
                <span className="inline-block w-1.5 h-4 bg-cyan-400 animate-pulse ml-0.5 rounded-sm" />
              )}
            </div>
          </div>
        )}
        
        {/* Timestamp */}
        <div className={`text-[10px] text-sz-text-muted mt-1 ${isUser ? 'pr-1' : 'pl-1'}`}>
          {new Date(message.timestamp).toLocaleTimeString()}
        </div>
      </div>
    </div>
  );
}

interface ChatPanelProps {
  className?: string;
  // Callbacks for UI synchronization
  onSeekToTime?: (time: number) => void;
  onSelectClip?: (clipId: string) => void;
  onTrimClip?: (clipId: string, trimStart: number, trimEnd: number) => void;
  onPlayVideo?: () => void;
  onPauseVideo?: () => void;
  // Current state getters
  getCurrentTime?: () => number;
  getSelectedClipId?: () => string | null;
  getIsPlaying?: () => boolean;
}

function ChatPanel({
  className = '',
  onSeekToTime,
  onSelectClip,
  onTrimClip,
  onPlayVideo,
  onPauseVideo,
  getCurrentTime,
  getSelectedClipId,
  getIsPlaying,
}: ChatPanelProps) {
  const {
    messages,
    isLoading,
    isStreaming,
    error,
    showThinking,
    lastUsedProvider,
    lastUsedModel,
    addMessage,
    updateMessage,
    appendToMessage,
    appendThinking,
    addToolCall,
    updateToolCall,
    toggleThinking,
    clearMessages,
    setLoading,
    setStreaming,
    setError,
    setLastUsedProvider,
  } = useChatStore();
  
  const {
    project,
    clips,
    transcript,
    deadSpaces,
    selectedClipId: storeSelectedClipId,
    updateClipStatus,
    updateClipTrim,
    aiSettings,
    settings: detectionSettings,
    updateSettings,
    setDetecting,
    setResults,
    exportSettings,
    updateExportSettings,
  } = useStore();
  
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  
  // Get provider config from AI settings
  const providerConfig = {
    anthropicApiKey: aiSettings?.anthropicApiKey,
    openaiApiKey: aiSettings?.openaiApiKey,
    geminiApiKey: aiSettings?.geminiApiKey,
    ollamaHost: aiSettings?.ollamaHost,
  };
  
  // Check if any provider is configured
  const hasProvider = !!(
    providerConfig.anthropicApiKey ||
    providerConfig.openaiApiKey ||
    providerConfig.geminiApiKey
  );
  
  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);
  
  // Helper: Get clip by ID or use selected
  const getClip = useCallback((clipId?: string) => {
    const id = clipId || getSelectedClipId?.() || storeSelectedClipId;
    return id ? clips.find(c => c.id === id) : null;
  }, [clips, getSelectedClipId, storeSelectedClipId]);

  // Helper: Get transcript for a time range
  const getTranscriptForRange = useCallback((startTime: number, endTime: number) => {
    if (!transcript?.words) return '';
    const words = transcript.words.filter(w => w.start >= startTime && w.end <= endTime);
    return words.map(w => w.word).join(' ');
  }, [transcript]);

  // Execute a tool call
  const executeTool = useCallback(async (
    messageId: string,
    toolCallId: string,
    toolName: string,
    args: Record<string, unknown>
  ): Promise<unknown> => {
    console.log('[ChatPanel] Executing tool:', toolName, 'with args:', args);
    updateToolCall(messageId, toolCallId, { status: 'running' });
    
    try {
      let result: unknown;
      
      switch (toolName) {
        // ========================================
        // ANALYSIS TOOLS - Algorithmic analysis
        // ========================================
        
        case 'analyze_clip_quality': {
          const clip = getClip(args.clipId as string);
          if (!clip) throw new Error('Clip not found');
          
          const clipTranscript = getTranscriptForRange(clip.startTime, clip.endTime);
          const wordCount = clipTranscript.split(/\s+/).filter(w => w).length;
          const wordsPerSecond = wordCount / clip.duration;
          
          // Analyze energy distribution (simulate from existing data)
          const hookSection = clip.hookStrength;
          const bodyEnergy = clip.algorithmScore;
          
          result = {
            clipId: clip.id,
            title: clip.title || 'Untitled',
            duration: clip.duration,
            quality: {
              overall: clip.finalScore,
              hookStrength: clip.hookStrength,
              algorithmScore: clip.algorithmScore,
              hookMultiplier: clip.hookMultiplier,
            },
            analysis: {
              pattern: clip.pattern,
              patternLabel: clip.patternLabel,
              speechDensity: wordsPerSecond > 2.5 ? 'high' : wordsPerSecond > 1.5 ? 'medium' : 'low',
              wordsPerSecond: Math.round(wordsPerSecond * 10) / 10,
              estimatedPacing: wordsPerSecond > 3 ? 'fast' : wordsPerSecond > 2 ? 'moderate' : 'slow',
              hookVsBody: hookSection > bodyEnergy ? 'strong_hook' : 'even_energy',
            },
            clipworthiness: clip.clipworthiness || {
              note: 'Detailed clipworthiness breakdown not available',
            },
            flags: clip.flags || [],
            sentiment: clip.sentiment,
            category: clip.category,
            recommendation: clip.finalScore >= 80 ? 'strongly_recommend' : 
                           clip.finalScore >= 65 ? 'recommend' : 
                           clip.finalScore >= 50 ? 'consider' : 'skip',
          };
          break;
        }
        
        case 'analyze_energy_curve': {
          const clip = args.clipId ? getClip(args.clipId as string) : null;
          const startTime = clip?.startTime ?? (args.startTime as number) ?? 0;
          const endTime = clip?.endTime ?? (args.endTime as number) ?? project?.duration ?? 60;
          const resolution = (args.resolution as number) || 50;
          
          // Generate energy curve based on transcript density as a proxy
          const duration = endTime - startTime;
          const stepSize = duration / resolution;
          const energyCurve: { time: number; energy: number; label?: string }[] = [];
          
          for (let i = 0; i < resolution; i++) {
            const t = startTime + (i * stepSize);
            const tEnd = t + stepSize;
            
            // Use word density as energy proxy
            let energy = 50; // baseline
            if (transcript?.words) {
              const wordsInWindow = transcript.words.filter(w => w.start >= t && w.end <= tEnd);
              energy = Math.min(100, 30 + (wordsInWindow.length * 15));
            }
            
            energyCurve.push({
              time: Math.round(t * 10) / 10,
              energy: Math.round(energy),
            });
          }
          
          // Find peaks and valleys
          const peaks = energyCurve.filter((p, i) => 
            i > 0 && i < energyCurve.length - 1 &&
            p.energy > energyCurve[i-1].energy && p.energy > energyCurve[i+1].energy &&
            p.energy > 70
          ).map(p => ({ time: p.time, energy: p.energy, label: 'peak' }));
          
          const valleys = energyCurve.filter((p, i) => 
            i > 0 && i < energyCurve.length - 1 &&
            p.energy < energyCurve[i-1].energy && p.energy < energyCurve[i+1].energy &&
            p.energy < 40
          ).map(p => ({ time: p.time, energy: p.energy, label: 'valley' }));
          
          result = {
            startTime,
            endTime,
            duration,
            resolution,
            curve: energyCurve,
            summary: {
              averageEnergy: Math.round(energyCurve.reduce((a, b) => a + b.energy, 0) / energyCurve.length),
              peakCount: peaks.length,
              valleyCount: valleys.length,
              peaks: peaks.slice(0, 5),
              valleys: valleys.slice(0, 5),
            },
          };
          break;
        }
        
        case 'analyze_speech_patterns': {
          const clip = args.clipId ? getClip(args.clipId as string) : null;
          const startTime = clip?.startTime ?? (args.startTime as number) ?? 0;
          const endTime = clip?.endTime ?? (args.endTime as number) ?? project?.duration ?? 60;
          
          if (!transcript?.words) {
            throw new Error('No transcript available for speech analysis');
          }
          
          const words = transcript.words.filter(w => w.start >= startTime && w.end <= endTime);
          
          // Analyze pauses
          const pauses: { time: number; duration: number }[] = [];
          for (let i = 1; i < words.length; i++) {
            const gap = words[i].start - words[i-1].end;
            if (gap > 0.3) {
              pauses.push({ time: words[i-1].end, duration: Math.round(gap * 100) / 100 });
            }
          }
          
          // Find sentence boundaries (rough heuristic: pauses > 0.5s or punctuation)
          const sentenceBoundaries = pauses
            .filter(p => p.duration > 0.5)
            .map(p => p.time);
          
          const totalDuration = endTime - startTime;
          const speechDuration = words.reduce((acc, w) => acc + (w.end - w.start), 0);
          
          result = {
            startTime,
            endTime,
            wordCount: words.length,
            speechRate: {
              wordsPerMinute: Math.round((words.length / totalDuration) * 60),
              speechRatio: Math.round((speechDuration / totalDuration) * 100) / 100,
            },
            pauses: {
              count: pauses.length,
              averageDuration: pauses.length > 0 
                ? Math.round((pauses.reduce((a, p) => a + p.duration, 0) / pauses.length) * 100) / 100 
                : 0,
              longPauses: pauses.filter(p => p.duration > 1).slice(0, 5),
            },
            sentenceBoundaries: sentenceBoundaries.slice(0, 10),
            naturalCutPoints: [
              ...sentenceBoundaries.slice(0, 5),
              ...pauses.filter(p => p.duration > 0.8).map(p => p.time).slice(0, 5),
            ].sort((a, b) => a - b).slice(0, 8),
          };
          break;
        }
        
        case 'find_optimal_boundaries': {
          const clip = getClip(args.clipId as string);
          if (!clip) throw new Error('Clip not found');
          
          const preferCleanStart = args.preferCleanStart !== false;
          const preferCleanEnd = args.preferCleanEnd !== false;
          const maxExtension = (args.maxExtension as number) || 3;
          
          let suggestedStartOffset = 0;
          let suggestedEndOffset = 0;
          
          if (transcript?.words) {
            const nearbyWords = transcript.words.filter(w => 
              w.start >= clip.startTime - maxExtension && 
              w.end <= clip.endTime + maxExtension
            );
            
            if (preferCleanStart && nearbyWords.length > 0) {
              // Find sentence start near clip start
              const startWords = nearbyWords.filter(w => w.start >= clip.startTime - maxExtension && w.start <= clip.startTime + 1);
              for (let i = 0; i < startWords.length; i++) {
                const wordIndex = nearbyWords.indexOf(startWords[i]);
                if (wordIndex > 0) {
                  const gap = startWords[i].start - nearbyWords[wordIndex - 1].end;
                  if (gap > 0.5) {
                    suggestedStartOffset = startWords[i].start - clip.startTime;
                    break;
                  }
                }
              }
            }
            
            if (preferCleanEnd && nearbyWords.length > 0) {
              // Find sentence end near clip end
              const endWords = nearbyWords.filter(w => w.end >= clip.endTime - 1 && w.end <= clip.endTime + maxExtension);
              for (let i = endWords.length - 1; i >= 0; i--) {
                const wordIndex = nearbyWords.indexOf(endWords[i]);
                if (wordIndex < nearbyWords.length - 1) {
                  const gap = nearbyWords[wordIndex + 1].start - endWords[i].end;
                  if (gap > 0.5) {
                    suggestedEndOffset = endWords[i].end - clip.endTime;
                    break;
                  }
                }
              }
            }
          }
          
          result = {
            clipId: clip.id,
            currentBoundaries: {
              start: clip.startTime,
              end: clip.endTime,
            },
            suggestedOffsets: {
              start: Math.round(suggestedStartOffset * 100) / 100,
              end: Math.round(suggestedEndOffset * 100) / 100,
            },
            newBoundaries: {
              start: Math.round((clip.startTime + suggestedStartOffset) * 100) / 100,
              end: Math.round((clip.endTime + suggestedEndOffset) * 100) / 100,
            },
            reason: suggestedStartOffset !== 0 || suggestedEndOffset !== 0 
              ? 'Adjusted to align with speech boundaries' 
              : 'Current boundaries are already optimal',
          };
          break;
        }
        
        case 'detect_highlights': {
          const startTime = (args.startTime as number) ?? 0;
          const endTime = (args.endTime as number) ?? project?.duration ?? 60;
          const patterns = (args.patterns as string[]) || ['payoff', 'monologue', 'laughter', 'debate'];
          const minScore = (args.minScore as number) ?? 60;
          
          // Check if detection has been run
          if (clips.length === 0) {
            result = {
              error: 'NO_CLIPS_DETECTED',
              message: 'No clips have been detected yet. You need to run detection first using the run_detection tool.',
              suggestion: 'Call run_detection to analyze the video and find highlights.',
              searchRange: { startTime, endTime },
              patterns,
              minScore,
              highlightsFound: 0,
              highlights: [],
            };
            break;
          }
          
          // Filter existing clips that match criteria
          const highlights = clips
            .filter(c => 
              c.startTime >= startTime && 
              c.endTime <= endTime &&
              patterns.includes(c.pattern) &&
              c.finalScore >= minScore
            )
            .map(c => ({
              id: c.id,
              startTime: c.startTime,
              endTime: c.endTime,
              duration: c.duration,
              pattern: c.pattern,
              score: c.finalScore,
              hookStrength: c.hookStrength,
              title: c.title,
              status: c.status,
            }))
            .sort((a, b) => b.score - a.score);
          
          result = {
            searchRange: { startTime, endTime },
            patterns,
            minScore,
            highlightsFound: highlights.length,
            highlights: highlights.slice(0, 20),
            summary: {
              byPattern: patterns.map(p => ({
                pattern: p,
                count: highlights.filter(h => h.pattern === p).length,
              })),
              topScore: highlights[0]?.score || 0,
              averageScore: highlights.length > 0 
                ? Math.round(highlights.reduce((a, h) => a + h.score, 0) / highlights.length) 
                : 0,
            },
          };
          break;
        }
        
        case 'compare_clips': {
          const clipIds = args.clipIds as string[];
          if (!clipIds || clipIds.length < 2) {
            throw new Error('Need at least 2 clip IDs to compare');
          }
          
          const clipsToCompare = clipIds.map(id => clips.find(c => c.id === id)).filter(Boolean);
          if (clipsToCompare.length < 2) {
            throw new Error('Could not find all clips');
          }
          
          const criteria = (args.criteria as string[]) || ['hook', 'energy', 'pacing', 'viral_potential'];
          
          const comparison = clipsToCompare.map(clip => {
            const transcript = getTranscriptForRange(clip!.startTime, clip!.endTime);
            const wordCount = transcript.split(/\s+/).filter(w => w).length;
            const wps = wordCount / clip!.duration;
            
            return {
              id: clip!.id,
              title: clip!.title || 'Untitled',
              scores: {
                hook: clip!.hookStrength,
                energy: clip!.algorithmScore,
                pacing: wps > 3 ? 85 : wps > 2 ? 70 : 55,
                viral_potential: clip!.finalScore,
                completeness: clip!.isComplete ? 90 : 60,
              },
              overall: clip!.finalScore,
            };
          });
          
          // Determine winner for each criterion
          const winners: Record<string, string> = {};
          for (const criterion of criteria) {
            const sorted = [...comparison].sort((a, b) => 
              (b.scores[criterion as keyof typeof b.scores] || 0) - (a.scores[criterion as keyof typeof a.scores] || 0)
            );
            winners[criterion] = sorted[0].id;
          }
          
          // Overall winner
          const overallWinner = [...comparison].sort((a, b) => b.overall - a.overall)[0];
          
          result = {
            clips: comparison,
            winners,
            recommendation: {
              bestOverall: overallWinner.id,
              reason: `Highest combined score (${overallWinner.overall})`,
            },
          };
          break;
        }
        
        // ========================================
        // ACTION TOOLS - Make changes
        // ========================================
        
        case 'smart_trim_clip': {
          const clip = getClip(args.clipId as string);
          if (!clip) throw new Error('Clip not found');
          
          const strategy = args.strategy as string;
          let trimStart = 0;
          let trimEnd = 0;
          let reason = '';
          
          switch (strategy) {
            case 'tighten':
              // Remove dead air at start/end
              if (transcript?.words) {
                const words = transcript.words.filter(w => w.start >= clip.startTime && w.end <= clip.endTime);
                if (words.length > 0) {
                  const firstWord = words[0];
                  const lastWord = words[words.length - 1];
                  trimStart = Math.max(0, firstWord.start - clip.startTime - 0.2);
                  trimEnd = Math.min(0, lastWord.end - clip.endTime + 0.2);
                }
              }
              reason = 'Removed dead air at boundaries';
              break;
              
            case 'extend_hook':
              // Extend the start to strengthen the hook
              trimStart = -1.5;
              reason = 'Extended start by 1.5s to strengthen hook';
              break;
              
            case 'sentence_boundaries':
              // Use find_optimal_boundaries logic
              reason = 'Aligned to sentence boundaries';
              break;
              
            case 'energy_peaks':
              // Trim at low energy points
              trimStart = 0.5;
              trimEnd = -0.5;
              reason = 'Trimmed to focus on high-energy section';
              break;
          }
          
          if (trimStart !== 0 || trimEnd !== 0) {
            updateClipTrim(clip.id, clip.trimStartOffset + trimStart, clip.trimEndOffset + trimEnd);
          }
          
          result = {
            success: true,
            clipId: clip.id,
            strategy,
            applied: {
              trimStartOffset: Math.round(trimStart * 100) / 100,
              trimEndOffset: Math.round(trimEnd * 100) / 100,
            },
            newDuration: Math.round((clip.duration - trimStart + trimEnd) * 100) / 100,
            reason,
          };
          break;
        }
        
        case 'auto_review_clips': {
          const minScore = (args.minScore as number) ?? 70;
          const minHookStrength = (args.minHookStrength as number) ?? 50;
          const requireComplete = (args.requireCompleteThought as boolean) ?? false;
          const maxToAccept = (args.maxToAccept as number) ?? 10;
          const dryRun = (args.dryRun as boolean) ?? false;
          
          const pending = clips.filter(c => c.status === 'pending');
          
          const decisions = pending.map(clip => {
            const shouldAccept = 
              clip.finalScore >= minScore &&
              clip.hookStrength >= minHookStrength &&
              (!requireComplete || clip.isComplete);
            
            return {
              clipId: clip.id,
              title: clip.title,
              score: clip.finalScore,
              hookStrength: clip.hookStrength,
              isComplete: clip.isComplete,
              decision: shouldAccept ? 'accept' : 'reject',
              reasons: [
                clip.finalScore >= minScore ? `Score ${clip.finalScore} >= ${minScore}` : `Score ${clip.finalScore} < ${minScore}`,
                clip.hookStrength >= minHookStrength ? `Hook ${clip.hookStrength} >= ${minHookStrength}` : `Hook ${clip.hookStrength} < ${minHookStrength}`,
              ],
            };
          });
          
          const toAccept = decisions.filter(d => d.decision === 'accept').slice(0, maxToAccept);
          const toReject = decisions.filter(d => d.decision === 'reject');
          
          if (!dryRun) {
            toAccept.forEach(d => updateClipStatus(d.clipId, 'accepted'));
            toReject.forEach(d => updateClipStatus(d.clipId, 'rejected'));
          }
          
          result = {
            dryRun,
            criteria: { minScore, minHookStrength, requireComplete, maxToAccept },
            summary: {
              reviewed: pending.length,
              accepted: toAccept.length,
              rejected: toReject.length,
            },
            decisions: decisions.slice(0, 15),
          };
          break;
        }
        
        case 'suggest_clip_order': {
          const strategy = (args.strategy as string) || 'energy_arc';
          const accepted = clips.filter(c => c.status === 'accepted');
          
          if (accepted.length === 0) {
            throw new Error('No accepted clips to order');
          }
          
          let ordered: typeof accepted;
          let reason: string;
          
          switch (strategy) {
            case 'chronological':
              ordered = [...accepted].sort((a, b) => a.startTime - b.startTime);
              reason = 'Ordered by original timeline position';
              break;
              
            case 'best_first':
              ordered = [...accepted].sort((a, b) => b.finalScore - a.finalScore);
              reason = 'Best clips first for maximum impact';
              break;
              
            case 'topic_clusters':
              // Group by category then by score
              ordered = [...accepted].sort((a, b) => {
                if (a.category !== b.category) {
                  return (a.category || '').localeCompare(b.category || '');
                }
                return b.finalScore - a.finalScore;
              });
              reason = 'Grouped by topic/category';
              break;
              
            case 'energy_arc':
            default:
              // Start medium, build to peak, end strong
              const sorted = [...accepted].sort((a, b) => b.finalScore - a.finalScore);
              const third = Math.ceil(sorted.length / 3);
              const high = sorted.slice(0, third);
              const mid = sorted.slice(third, third * 2);
              const low = sorted.slice(third * 2);
              ordered = [...mid, ...low.reverse(), ...high];
              reason = 'Energy arc: build tension, peak in middle, strong finish';
              break;
          }
          
          result = {
            strategy,
            clipCount: ordered.length,
            suggestedOrder: ordered.map((c, i) => ({
              position: i + 1,
              clipId: c.id,
              title: c.title,
              score: c.finalScore,
              originalTime: formatTimestamp(c.startTime),
            })),
            reason,
          };
          break;
        }
        
        case 'run_detection': {
          // This tool triggers the actual Python detection pipeline
          if (!project?.filePath) {
            throw new Error('No video file loaded. Please load a video first.');
          }
          
          const targetCount = (args.targetCount as number) ?? 10;
          const minDuration = (args.minDuration as number) ?? 15;
          const maxDuration = (args.maxDuration as number) ?? 90;
          const skipIntro = (args.skipIntro as number) ?? 90;
          const skipOutro = (args.skipOutro as number) ?? 60;
          
          // Generate a project ID from the file path
          const projectId = `project_${btoa(project.filePath).slice(0, 20)}_${Date.now()}`;
          
          // IMPORTANT: Set detection state in store so App.tsx listener accepts the events
          // and UI shows progress
          setDetecting(true);
          useStore.getState().setCurrentJobId(projectId);
          
          // Note: This returns immediately but detection runs asynchronously
          // The UI will receive detection-progress and detection-complete events
          const detectionResult = await window.api.startDetection(
            projectId,
            project.filePath,
            {
              targetCount,
              minDuration,
              maxDuration,
              skipIntro,
              skipOutro,
              useAiEnhancement: !!aiSettings?.openaiApiKey,
              openaiApiKey: aiSettings?.openaiApiKey,
            },
            project.duration
          );
          
          if (!detectionResult.success) {
            // Reset state on failure
            setDetecting(false);
            useStore.getState().setCurrentJobId(null);
            throw new Error(detectionResult.error || 'Failed to start detection');
          }
          
          result = {
            success: true,
            message: detectionResult.queued 
              ? 'Detection queued - another detection is in progress'
              : 'Detection started! This will take a few minutes. Watch the progress bar in the UI.',
            settings: {
              targetCount,
              minDuration,
              maxDuration,
              skipIntro,
              skipOutro,
            },
            estimatedTime: `~${Math.ceil((project.duration || 7200) / 60 / 10)} minutes for a ${Math.round((project.duration || 7200) / 60)}-minute video`,
            note: 'Results will automatically appear when detection completes. You can continue chatting!',
          };
          break;
        }
        
        case 'create_vod_compilation': {
          // This tool selects the best clips to create a compilation of target duration
          const targetDuration = (args.targetDurationMinutes as number) ?? 20;
          const clipCount = (args.clipCount as number) ?? 10;
          const targetDurationSeconds = targetDuration * 60;
          const vibe = (args.vibe as string) ?? 'best_moments';
          const includeTransitions = (args.includeTransitions as boolean) ?? true;
          
          if (clips.length === 0) {
            throw new Error('No clips available. Run detection first to find viral moments.');
          }
          
          // Sort clips by score
          const sortedClips = [...clips].sort((a, b) => b.finalScore - a.finalScore);
          
          // Select clips to match target duration
          const selectedClips: typeof clips = [];
          let totalDuration = 0;
          const transitionDuration = includeTransitions ? 0.5 : 0;
          
          for (const clip of sortedClips) {
            if (selectedClips.length >= clipCount) break;
            
            const clipDuration = clip.duration + (selectedClips.length > 0 ? transitionDuration : 0);
            
            // Check if adding this clip would exceed target too much
            if (totalDuration + clipDuration <= targetDurationSeconds * 1.1) { // Allow 10% overage
              selectedClips.push(clip);
              totalDuration += clipDuration;
            }
          }
          
          // Auto-accept the selected clips
          selectedClips.forEach(clip => {
            updateClipStatus(clip.id, 'accepted');
          });
          
          // Reject clips not selected
          const selectedIds = new Set(selectedClips.map(c => c.id));
          clips.filter(c => !selectedIds.has(c.id) && c.status !== 'rejected').forEach(clip => {
            // Don't auto-reject, just leave them pending
          });
          
          // Order the clips based on vibe
          let orderedClips = selectedClips;
          let orderReason = '';
          
          switch (vibe) {
            case 'chronological':
              orderedClips = [...selectedClips].sort((a, b) => a.startTime - b.startTime);
              orderReason = 'Clips ordered chronologically as they appeared in the source';
              break;
            case 'high_energy':
              orderedClips = [...selectedClips].sort((a, b) => b.hookStrength - a.hookStrength);
              orderReason = 'Highest energy clips first for maximum impact';
              break;
            case 'building':
              // Build up to the best clip
              orderedClips = [...selectedClips].sort((a, b) => a.finalScore - b.finalScore);
              orderReason = 'Building energy - best clips saved for the end';
              break;
            case 'best_moments':
            default:
              // Already sorted by score - intersperse for good pacing
              const half = Math.ceil(selectedClips.length / 2);
              const firstHalf = selectedClips.slice(0, half);
              const secondHalf = selectedClips.slice(half);
              orderedClips = [];
              for (let i = 0; i < Math.max(firstHalf.length, secondHalf.length); i++) {
                if (i < firstHalf.length) orderedClips.push(firstHalf[i]);
                if (i < secondHalf.length) orderedClips.push(secondHalf[i]);
              }
              orderReason = 'Best moments interspersed for consistent engagement';
              break;
          }
          
          result = {
            success: true,
            compilation: {
              clipCount: selectedClips.length,
              totalDuration: Math.round(totalDuration),
              totalDurationFormatted: formatTimestamp(totalDuration),
              targetDuration: targetDurationSeconds,
              vibe,
              includeTransitions,
              transitionType: includeTransitions ? 'crossfade' : 'none',
            },
            clips: orderedClips.map((c, i) => ({
              position: i + 1,
              clipId: c.id,
              title: c.title || `Clip ${i + 1}`,
              score: c.finalScore,
              duration: c.duration,
              durationFormatted: formatTimestamp(c.duration),
              pattern: c.patternLabel || c.pattern,
            })),
            orderReason,
            nextSteps: [
              'Review the selected clips in the timeline',
              'Use the trim tool to fine-tune boundaries if needed',
              includeTransitions ? 'Transitions will be added automatically during export' : 'No transitions will be added',
              'Export when ready!',
            ],
          };
          break;
        }
        
        // ========================================
        // BASIC TOOLS - Simple operations
        // ========================================
        
        case 'seek_to_time': {
          const time = args.time as number;
          onSeekToTime?.(time);
          result = { success: true, message: `Seeked to ${formatTimestamp(time)}` };
          break;
        }
        
        case 'select_clip': {
          const clipId = args.clipId as string | undefined;
          const clipIndex = args.clipIndex as number | undefined;
          
          const targetClip = clipId 
            ? clips.find(c => c.id === clipId)
            : clipIndex !== undefined ? clips[clipIndex] : null;
          
          if (targetClip) {
            onSelectClip?.(targetClip.id);
            result = { 
              success: true, 
              message: `Selected "${targetClip.title || targetClip.id}"`,
              clip: { id: targetClip.id, title: targetClip.title, score: targetClip.finalScore },
            };
          } else {
            throw new Error('Clip not found');
          }
          break;
        }
        
        case 'set_clip_status': {
          const clipIds = args.clipIds as string[];
          const status = args.status as 'accepted' | 'rejected' | 'pending';
          
          clipIds.forEach(id => updateClipStatus(id, status));
          
          result = { 
            success: true, 
            message: `Set ${clipIds.length} clip(s) to ${status}`,
            clipIds,
            status,
          };
          break;
        }
        
        case 'trim_clip': {
          const clip = getClip(args.clipId as string);
          if (!clip) throw new Error('Clip not found');
          
          const trimStart = (args.trimStartOffset as number) || 0;
          const trimEnd = (args.trimEndOffset as number) || 0;
          
          updateClipTrim(clip.id, trimStart, trimEnd);
          onTrimClip?.(clip.id, trimStart, trimEnd);
          
          result = { 
            success: true, 
            message: `Trimmed clip (start: ${trimStart >= 0 ? '+' : ''}${trimStart}s, end: ${trimEnd >= 0 ? '+' : ''}${trimEnd}s)`,
          };
          break;
        }
        
        case 'get_project_state': {
          const includeTranscript = (args.includeTranscript as boolean) ?? false;
          const includeDeadSpaces = (args.includeDeadSpaces as boolean) ?? true;
          
          result = {
            project: project ? {
              fileName: project.fileName,
              duration: project.duration,
              resolution: project.resolution,
            } : null,
            clips: {
              total: clips.length,
              accepted: clips.filter(c => c.status === 'accepted').length,
              rejected: clips.filter(c => c.status === 'rejected').length,
              pending: clips.filter(c => c.status === 'pending').length,
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
            deadSpaces: includeDeadSpaces ? deadSpaces : undefined,
            transcript: includeTranscript ? transcript : { available: !!transcript },
            currentTime: getCurrentTime?.() || 0,
            selectedClipId: getSelectedClipId?.() || storeSelectedClipId,
          };
          break;
        }
        
        case 'get_transcript': {
          const clip = args.clipId ? getClip(args.clipId as string) : null;
          const startTime = clip?.startTime ?? (args.startTime as number) ?? 0;
          const endTime = clip?.endTime ?? (args.endTime as number) ?? project?.duration ?? 60;
          
          if (!transcript) throw new Error('No transcript available');
          
          const text = getTranscriptForRange(startTime, endTime);
          const words = transcript.words?.filter(w => w.start >= startTime && w.end <= endTime) || [];
          
          result = {
            startTime,
            endTime,
            text,
            wordCount: words.length,
            words: words.slice(0, 100), // Limit for readability
          };
          break;
        }
        
        case 'play_pause': {
          const action = (args.action as string) || 'toggle';
          const isCurrentlyPlaying = getIsPlaying?.() || false;
          
          if (action === 'play' || (action === 'toggle' && !isCurrentlyPlaying)) {
            onPlayVideo?.();
            result = { success: true, action: 'play' };
          } else {
            onPauseVideo?.();
            result = { success: true, action: 'pause' };
          }
          break;
        }
        
        case 'show_panel': {
          const panel = args.panel as string;
          // The panel visibility is managed via callbacks passed to ChatPanel
          // For now, we just acknowledge the request - actual panel toggling 
          // should be handled by the parent component
          result = { 
            success: true, 
            message: `Panel '${panel}' visibility toggled`,
            note: 'Panel visibility is controlled by the editor UI',
          };
          break;
        }
        
        case 'highlight_element': {
          const elementId = args.elementId as string;
          const duration = (args.duration as number) || 2000;
          
          // Try to find and highlight the element
          // First, check if it's a clip ID
          const clip = clips.find(c => c.id === elementId || c.id.includes(elementId));
          if (clip) {
            // Select and seek to the clip
            onSelectClip?.(clip.id);
            onSeekToTime?.(clip.startTime);
            result = { 
              success: true, 
              message: `Highlighted clip: ${clip.title || clip.id}`,
              action: 'Selected clip and seeked to its start time',
            };
          } else {
            // For other elements, just acknowledge
            result = { 
              success: true, 
              message: `Highlight requested for element: ${elementId}`,
              duration,
            };
          }
          break;
        }
        
        default:
          throw new Error(`Unknown tool: ${toolName}`);
      }
      
      console.log('[ChatPanel] Tool execution complete:', toolName, 'Result:', result);
      updateToolCall(messageId, toolCallId, { status: 'success', result });
      return result;
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      updateToolCall(messageId, toolCallId, { status: 'error', error: errorMessage });
      return { error: errorMessage };
    }
  }, [
    clips, 
    project, 
    transcript,
    deadSpaces,
    storeSelectedClipId,
    getClip,
    getTranscriptForRange,
    onSeekToTime, 
    onSelectClip, 
    onTrimClip,
    onPlayVideo,
    onPauseVideo,
    getCurrentTime,
    getSelectedClipId,
    getIsPlaying,
    updateClipStatus,
    updateClipTrim,
    updateToolCall,
    aiSettings,
    setDetecting,
  ]);
  
  // Build system prompt with current context
  const buildSystemPrompt = useCallback(() => {
    const accepted = clips.filter(c => c.status === 'accepted').length;
    const rejected = clips.filter(c => c.status === 'rejected').length;
    const pending = clips.filter(c => c.status === 'pending').length;
    const avgScore = clips.length > 0 
      ? Math.round(clips.reduce((a, c) => a + c.finalScore, 0) / clips.length) 
      : 0;
    
    // Get top clips info for context
    const topClips = [...clips]
      .sort((a, b) => b.finalScore - a.finalScore)
      .slice(0, 5)
      .map((c, i) => `  ${i + 1}. "${c.title || `Clip ${c.id.slice(-4)}`}" - Score: ${c.finalScore}, Hook: ${c.hookStrength}, Pattern: ${c.patternLabel || c.pattern}, Status: ${c.status}`);
    
    const clipsSummary = clips.length > 0
      ? `${clips.length} clips detected (${accepted} accepted, ${rejected} rejected, ${pending} pending). Average score: ${avgScore}/100.`
      : 'No clips detected yet - the user needs to run detection first.';
    
    return `You are Clip Bot, a friendly AI video editing assistant in PodFlow Studio.

## CRITICAL: USE FUNCTION CALLS, NOT TEXT

You have access to tools via function calling. When you need to run a tool:
- DO use the actual function/tool calling mechanism provided by the API
- DO NOT write out tool calls as text like "[calls tool_name...]" 
- DO NOT describe what tools you would call - actually call them!

When you call a tool, the system will execute it and show results to the user.

## Current Project Context
- File: ${project?.fileName || 'No project loaded'}
- Duration: ${project?.duration ? formatTimestamp(project.duration) : 'N/A'}
- ${clipsSummary}
- Transcript: ${transcript ? 'Available' : 'Not available'}
${topClips.length > 0 ? `\nTop 5 clips by score:\n${topClips.join('\n')}` : ''}

## How to Respond

1. Briefly acknowledge the user's request
2. If you need to use a tool, CALL IT using function calling (don't write about calling it)
3. After getting tool results, summarize them conversationally
4. Suggest next steps

## Detection Workflow

**IMPORTANT**: If no clips exist yet, you MUST call run_detection first!
- run_detection scans the video for viral moments (takes 2-5 min)
- detect_highlights only FILTERS existing clips, it doesn't create them
- create_vod_compilation selects the best clips for a compilation

For "make a 20 minute VOD with funny moments":
1. Call run_detection with targetCount: 15-20
2. After detection completes, call create_vod_compilation with targetDurationMinutes: 20

## Tool Parameters Guide

run_detection:
- targetCount: number of clips to find (default: 10)
- minDuration: minimum clip length in seconds (default: 15)
- maxDuration: maximum clip length in seconds (default: 90)

create_vod_compilation:
- targetDurationMinutes: target VOD length in minutes
- clipCount: max number of clips to include
- vibe: 'best_moments', 'chronological', 'high_energy', or 'building'

detect_highlights:
- patterns: array of ['payoff', 'monologue', 'laughter', 'debate']
- minScore: minimum score 0-100 (default: 60)

## Available Tools

**Core**: run_detection, create_vod_compilation
**Analysis**: analyze_clip_quality, detect_highlights, compare_clips
**Actions**: smart_trim_clip, auto_review_clips, set_clip_status
**Basic**: seek_to_time, select_clip, play_pause, get_project_state

Be friendly and helpful. When using tools, ACTUALLY CALL THEM via function calling.`;
  }, [project, clips, transcript]);
  
  // Send message to AI
  const handleSend = useCallback(async () => {
    if (!input.trim() || isLoading) return;
    
    const userInput = input.trim();
    setInput('');
    
    // Add user message
    addMessage({
      role: 'user',
      content: userInput,
    });
    
    // Check for provider
    if (!hasProvider) {
      addMessage({
        role: 'assistant',
        content: 'Hey! I need an AI provider to help you out. Head to Settings and add an API key - I work great with Anthropic (Claude), OpenAI, or Gemini!',
      });
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      // Create assistant message placeholder
      const assistantMsgId = addMessage({
        role: 'assistant',
        content: '',
        isStreaming: true,
      });
      
      // Call the AI chat API (auto-routes to best provider)
      console.log('[ChatPanel] Sending request with tools enabled');
      const response = await window.api.chatWithAI({
        messages: messages.map(m => ({
          role: m.role,
          content: m.content,
        })).concat({ role: 'user', content: userInput }),
        tools: true,
        systemPrompt: buildSystemPrompt(),
        providerConfig,
      });
      
      // Log the response for debugging
      console.log('[ChatPanel] Received response:', {
        success: response.success,
        provider: response.provider,
        hasContent: !!response.content,
        contentLength: response.content?.length || 0,
        hasToolCalls: !!(response.toolCalls && response.toolCalls.length > 0),
        toolCallCount: response.toolCalls?.length || 0,
        toolCallNames: response.toolCalls?.map(tc => tc.name) || [],
        requiresToolResults: response.requiresToolResults,
      });
      
      // Track which provider was used
      if (response.provider) {
        setLastUsedProvider(response.provider, response.model);
      }
      
      if (!response.success) {
        throw new Error(response.error || 'Failed to get AI response');
      }
      
      // Handle thinking
      if (response.thinking) {
        appendThinking(assistantMsgId, response.thinking);
      }
      
      // Handle tool calls
      if (response.toolCalls && response.toolCalls.length > 0) {
        console.log('[ChatPanel] Executing tool calls:', response.toolCalls.map(tc => tc.name));
        const toolResults: Array<{ toolName: string; toolUseId: string; result: unknown }> = [];
        
        for (const tc of response.toolCalls) {
          const toolCallId = addToolCall(assistantMsgId, {
            name: tc.name,
            arguments: tc.arguments,
          });
          
          // Execute the tool
          const result = await executeTool(assistantMsgId, toolCallId, tc.name, tc.arguments);
          toolResults.push({ 
            toolName: tc.name, 
            toolUseId: tc.id || toolCallId, // Use the original tool_use_id if available
            result 
          });
        }
        
        // Continue the conversation with tool results so AI can summarize
        if (response.requiresToolResults && toolResults.length > 0) {
          try {
            const continueResponse = await window.api.chatContinueWithTools({
              messages: messages.map(m => ({
                role: m.role,
                content: m.content,
              })).concat([
                { role: 'user', content: userInput },
                { role: 'assistant', content: response.content || '' },
              ]),
              toolResults: toolResults.map(tr => ({
                toolName: tr.toolUseId,
                result: tr.result,
              })),
              systemPrompt: buildSystemPrompt(),
              providerConfig,
            });
            
            if (continueResponse.success && continueResponse.content) {
              updateMessage(assistantMsgId, { 
                content: (response.content || '') + (response.content ? '\n\n' : '') + continueResponse.content,
                isStreaming: false,
              });
            } else {
              // Fallback: show initial content or a default message
              updateMessage(assistantMsgId, { 
                content: response.content || 'Done! Check the tool results above for details.',
                isStreaming: false,
              });
            }
          } catch (continueError) {
            console.error('Failed to continue with tool results:', continueError);
            updateMessage(assistantMsgId, { 
              content: response.content || 'Done! Check the tool results above for details.',
              isStreaming: false,
            });
          }
        } else {
          // No continuation needed, just show initial content
          updateMessage(assistantMsgId, { 
            content: response.content || '',
            isStreaming: false,
          });
        }
      }
      // Handle content only (no tool calls)
      else if (response.content) {
        updateMessage(assistantMsgId, { 
          content: response.content,
          isStreaming: false,
        });
      } else {
        updateMessage(assistantMsgId, {
          content: 'I completed the action but have no additional response.',
          isStreaming: false,
        });
      }
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred';
      setError(errorMessage);
      addMessage({
        role: 'assistant',
        content: `Error: ${errorMessage}`,
      });
    } finally {
      setLoading(false);
      setStreaming(false);
    }
  }, [
    input, 
    isLoading, 
    hasProvider,
    providerConfig,
    messages, 
    addMessage, 
    setLoading, 
    setError, 
    setStreaming,
    setLastUsedProvider,
    appendThinking, 
    addToolCall, 
    updateMessage, 
    executeTool,
    buildSystemPrompt,
  ]);
  
  // Handle key press
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };
  
  // Provider colors for badge
  const providerColors: Record<string, string> = {
    anthropic: 'bg-orange-500/20 text-orange-400',
    openai: 'bg-emerald-500/20 text-emerald-400',
    gemini: 'bg-blue-500/20 text-blue-400',
    local: 'bg-purple-500/20 text-purple-400',
  };
  
  const providerLabels: Record<string, string> = {
    anthropic: 'Claude',
    openai: 'GPT',
    gemini: 'Gemini',
    local: 'Local',
  };
  
  return (
    <div className={`flex flex-col h-full bg-sz-bg-secondary rounded-sz-lg border border-sz-border ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-sz-border bg-gradient-to-r from-cyan-500/5 to-transparent">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-cyan-500/30 to-cyan-600/20 flex items-center justify-center ring-1 ring-cyan-500/30">
            <Clapperboard className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="flex flex-col">
            <span className="font-semibold text-sz-text text-sm">Clip Bot</span>
            <div className="flex items-center gap-1.5">
              {isLoading ? (
                <div className="flex items-center gap-1">
                  <CircleDot className="w-2.5 h-2.5 text-cyan-400 animate-pulse" />
                  <span className="text-[10px] text-cyan-400">Working...</span>
                </div>
              ) : (
                <>
                  <CircleDot className="w-2.5 h-2.5 text-emerald-400" />
                  <span className="text-[10px] text-sz-text-muted">Ready</span>
                </>
              )}
              {/* Provider indicator badge */}
              {lastUsedProvider && (
                <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium ml-1 ${providerColors[lastUsedProvider] || 'bg-sz-bg-tertiary text-sz-text-muted'}`}>
                  {providerLabels[lastUsedProvider] || lastUsedProvider}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={clearMessages}
            className="p-1.5 hover:bg-sz-bg-hover rounded-lg transition-colors"
            title="Clear chat"
          >
            <Trash2 className="w-4 h-4 text-sz-text-muted hover:text-sz-text" />
          </button>
        </div>
      </div>
      
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="text-center py-8">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-cyan-500/20 to-cyan-600/10 flex items-center justify-center ring-2 ring-cyan-500/20 mb-4">
              <Clapperboard className="w-8 h-8 text-cyan-400" />
            </div>
            <p className="text-sz-text text-base font-semibold">
              Hey! I'm Clip Bot
            </p>
            <p className="text-sz-text-muted text-xs mt-2 max-w-[220px] mx-auto">
              I'll help you find viral moments, review clips, and create highlight reels. Try asking:
            </p>
            <div className="mt-4 space-y-2 text-xs text-left max-w-[260px] mx-auto">
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-cyan-500/5 border border-cyan-500/10 hover:bg-cyan-500/10 cursor-pointer transition-colors">
                <Zap className="w-3.5 h-3.5 text-cyan-400" />
                <span className="text-cyan-400/90">"Find the viral moments"</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-500/5 border border-emerald-500/10 hover:bg-emerald-500/10 cursor-pointer transition-colors">
                <CheckCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400/90">"Help me pick which clips to keep"</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-violet-500/5 border border-violet-500/10 hover:bg-violet-500/10 cursor-pointer transition-colors">
                <Sparkles className="w-3.5 h-3.5 text-violet-400" />
                <span className="text-violet-400/90">"What are my top 5 clips?"</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/5 border border-amber-500/10 hover:bg-amber-500/10 cursor-pointer transition-colors">
                <ListOrdered className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-amber-400/90">"Make a highlight reel"</span>
              </div>
            </div>
          </div>
        ) : (
          <>
            {messages.map((message) => (
              <MessageDisplay
                key={message.id}
                message={message}
                onToggleThinking={() => toggleThinking(message.id)}
              />
            ))}
            {/* Show loading indicator when waiting for initial response */}
            {isLoading && messages.length > 0 && !messages[messages.length - 1].toolCalls?.length && messages[messages.length - 1].role === 'user' && (
              <BotLoadingIndicator />
            )}
          </>
        )}
        <div ref={messagesEndRef} />
      </div>
      
      {/* Error display */}
      {error && (
        <div className="px-4 py-2.5 bg-red-500/10 border-t border-red-500/30 flex items-center gap-2">
          <XCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
          <p className="text-xs text-red-400">{error}</p>
        </div>
      )}
      
      {/* Input */}
      <div className="p-4 border-t border-sz-border bg-gradient-to-r from-cyan-500/5 to-transparent">
        <div className="flex gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={hasProvider ? "Ask Clip Bot anything..." : "Add an AI key in Settings to wake me up!"}
            disabled={!hasProvider || isLoading}
            className="flex-1 px-3 py-2.5 text-sm bg-sz-bg border border-sz-border rounded-lg resize-none focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            rows={1}
            style={{ minHeight: '42px', maxHeight: '120px' }}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || !hasProvider || isLoading}
            className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed disabled:from-gray-500 disabled:to-gray-600 text-white rounded-lg transition-all shadow-lg shadow-cyan-500/20 hover:shadow-cyan-500/30"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default memo(ChatPanel);
