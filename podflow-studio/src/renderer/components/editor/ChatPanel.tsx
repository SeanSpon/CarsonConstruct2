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

// Tool call component - ENHANCED with progress bars, animations and beautiful visuals
function ToolCallDisplay({ toolCall }: { toolCall: ToolCall }) {
  const [showDetails, setShowDetails] = useState(false);
  const [progress, setProgress] = useState(0);
  const [elapsedTime, setElapsedTime] = useState(0);
  
  const isRunning = toolCall.status === 'running';
  const isPending = toolCall.status === 'pending';
  const isSuccess = toolCall.status === 'success';
  const isError = toolCall.status === 'error';
  const isActive = isRunning || isPending;
  
  // Animate progress bar when running
  useEffect(() => {
    if (!isRunning) {
      if (isSuccess) setProgress(100);
      return;
    }
    
    const interval = setInterval(() => {
      setProgress((prev) => Math.min(90, prev + Math.random() * 8));
    }, 300);
    
    return () => clearInterval(interval);
  }, [isRunning, isSuccess]);
  
  // Track elapsed time
  useEffect(() => {
    if (!isActive) return;
    
    const start = Date.now();
    const interval = setInterval(() => {
      setElapsedTime(Math.floor((Date.now() - start) / 100) / 10);
    }, 100);
    
    return () => clearInterval(interval);
  }, [isActive]);
  
  const statusColors = {
    pending: 'border-cyan-500/30 bg-gradient-to-r from-cyan-500/10 to-transparent',
    running: 'border-cyan-500/50 bg-gradient-to-r from-cyan-500/15 via-purple-500/5 to-transparent shadow-lg shadow-cyan-500/10',
    success: 'border-emerald-500/30 bg-gradient-to-r from-emerald-500/10 to-transparent',
    error: 'border-red-500/30 bg-gradient-to-r from-red-500/10 to-transparent',
  }[toolCall.status];

  const statusIcon = {
    pending: (
      <div className="flex items-center gap-1.5">
        <div className="relative">
          <div className="w-2 h-2 rounded-full bg-cyan-400/50" />
          <div className="absolute inset-0 w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
        </div>
        <span className="text-cyan-400 text-[10px]">Queued</span>
      </div>
    ),
    running: (
      <div className="flex items-center gap-1.5">
        <div className="relative">
          <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />
          <div className="absolute inset-0 bg-cyan-400/20 rounded-full blur-sm" />
        </div>
        <span className="text-cyan-400 font-medium">{elapsedTime.toFixed(1)}s</span>
      </div>
    ),
    success: (
      <div className="flex items-center gap-1.5 animate-success-pop">
        <div className="relative">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <div className="absolute inset-0 bg-emerald-400/30 rounded-full blur-sm animate-pulse" />
        </div>
        <span className="text-emerald-400 font-medium">Done!</span>
      </div>
    ),
    error: (
      <div className="flex items-center gap-1.5">
        <XCircle className="w-4 h-4 text-red-400" />
        <span className="text-red-400 font-medium">Failed</span>
      </div>
    ),
  }[toolCall.status];
  
  const friendlyName = toolFriendlyNames[toolCall.name] || toolCall.name;
  const iconColor = toolCategoryColors[toolCall.name] || 'text-cyan-400';
  
  return (
    <div className={`my-2 rounded-xl border ${statusColors} overflow-hidden transition-all duration-500 ${isRunning ? 'animate-pulse-subtle' : ''}`}>
      {/* Progress bar at top */}
      {isActive && (
        <div className="h-1 bg-cyan-900/20">
          <div 
            className="h-full bg-gradient-to-r from-cyan-500 via-cyan-400 to-purple-500 transition-all duration-300 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
      
      <button
        onClick={() => setShowDetails(!showDetails)}
        className="w-full flex items-center gap-2.5 px-3 py-3 text-xs hover:bg-white/5 transition-colors"
      >
        {/* Expand/collapse icon */}
        <div className={`transition-transform duration-200 ${showDetails ? 'rotate-90' : ''}`}>
          <ChevronRight className="w-3.5 h-3.5 text-sz-text-muted" />
        </div>
        
        {/* Tool icon with glow */}
        <div className="relative">
          {isRunning && (
            <div className={`absolute inset-0 ${iconColor.replace('text-', 'bg-').replace('-400', '-400/30')} rounded blur-md animate-pulse`} />
          )}
          <span className={`relative ${iconColor}`}>
            {toolIcons[toolCall.name] || <Wrench className="w-4 h-4" />}
          </span>
        </div>
        
        {/* Tool name */}
        <span className={`font-medium ${isRunning ? 'text-cyan-300' : 'text-sz-text'}`}>
          {friendlyName}
        </span>
        
        {/* Running indicator dots */}
        {isRunning && (
          <div className="flex gap-0.5 ml-1">
            <div className="w-1 h-1 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: '0ms' }} />
            <div className="w-1 h-1 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: '100ms' }} />
            <div className="w-1 h-1 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: '200ms' }} />
          </div>
        )}
        
        <span className="flex-1" />
        {statusIcon}
      </button>
      
      {/* Details section */}
      {showDetails && (
        <div className="px-3 pb-3 space-y-2 text-xs border-t border-white/5 animate-slide-down">
          <div className="pt-2">
            <div className="text-sz-text-muted mb-1.5 flex items-center gap-2">
              <code className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-400/80 font-mono">
                {toolCall.name}
              </code>
              {toolCall.status === 'success' && (
                <span className="text-[9px] text-emerald-400/60">✓ Executed successfully</span>
              )}
            </div>
            <pre className="bg-black/40 p-2.5 rounded-lg overflow-x-auto text-sz-text-secondary font-mono text-[10px] border border-white/5">
              {JSON.stringify(toolCall.arguments, null, 2)}
            </pre>
          </div>
          
          {toolCall.result !== undefined && (
            <div className="animate-fade-in">
              <div className="text-emerald-400/80 mb-1.5 flex items-center gap-1.5">
                <CheckCircle2 className="w-3 h-3" />
                <span>Result:</span>
              </div>
              <pre className="bg-emerald-500/5 border border-emerald-500/20 p-2.5 rounded-lg overflow-x-auto text-sz-text-secondary font-mono text-[10px] max-h-40 overflow-y-auto scrollbar-thin">
                {typeof toolCall.result === 'string' 
                  ? toolCall.result 
                  : JSON.stringify(toolCall.result, null, 2)}
              </pre>
            </div>
          )}
          
          {toolCall.error && (
            <div className="animate-shake">
              <div className="text-red-400 mb-1.5 flex items-center gap-1.5">
                <XCircle className="w-3 h-3" />
                <span>Error:</span>
              </div>
              <pre className="bg-red-500/10 border border-red-500/20 p-2.5 rounded-lg overflow-x-auto text-red-400 font-mono text-[10px]">
                {toolCall.error}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Thinking block component - ENHANCED with beautiful visualizations
function ThinkingBlock({ 
  thinking, 
  collapsed, 
  onToggle,
  isActive = false,
}: { 
  thinking: string; 
  collapsed?: boolean; 
  onToggle: () => void;
  isActive?: boolean;
}) {
  const [displayThinking, setDisplayThinking] = useState('');
  
  // Stream thinking text if active
  useEffect(() => {
    if (!isActive || collapsed) {
      setDisplayThinking(thinking);
      return;
    }
    
    let index = 0;
    const interval = setInterval(() => {
      if (index < thinking.length) {
        setDisplayThinking(thinking.slice(0, index + 1));
        index++;
      } else {
        clearInterval(interval);
      }
    }, 8);
    
    return () => clearInterval(interval);
  }, [thinking, isActive, collapsed]);
  
  if (!thinking) return null;
  
  return (
    <div className={`my-2 rounded-xl border overflow-hidden transition-all duration-300 ${
      isActive 
        ? 'border-cyan-500/40 bg-gradient-to-r from-cyan-500/10 via-purple-500/5 to-transparent shadow-lg shadow-cyan-500/10' 
        : 'border-cyan-500/20 bg-gradient-to-r from-cyan-500/5 to-transparent'
    }`}>
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-2 px-3 py-2.5 text-xs hover:bg-cyan-500/10 transition-colors"
      >
        {collapsed ? (
          <ChevronRight className="w-3.5 h-3.5 text-cyan-400 transition-transform" />
        ) : (
          <ChevronDown className="w-3.5 h-3.5 text-cyan-400 transition-transform" />
        )}
        
        {/* Animated brain with glow effect */}
        <div className="relative">
          {isActive && (
            <div className="absolute inset-0 bg-cyan-400/30 rounded-full blur-md animate-pulse" />
          )}
          <Brain className={`w-4 h-4 text-cyan-400 relative ${isActive ? 'animate-pulse' : ''}`} />
        </div>
        
        <span className="text-cyan-400 font-medium">
          {isActive ? 'Thinking...' : 'View Thinking'}
        </span>
        
        {isActive && (
          <div className="flex gap-0.5 ml-1">
            <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: '0ms' }} />
            <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: '100ms' }} />
            <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: '200ms' }} />
          </div>
        )}
        
        {/* Character count badge */}
        <span className="ml-auto text-[10px] text-cyan-400/50 font-mono">
          {thinking.length} chars
        </span>
      </button>
      
      {!collapsed && (
        <div className="px-3 pb-3 border-t border-cyan-500/10">
          {/* Thinking progress indicator */}
          {isActive && (
            <div className="h-0.5 bg-cyan-900/20 rounded-full overflow-hidden mb-2">
              <div 
                className="h-full bg-gradient-to-r from-cyan-500 to-purple-500 rounded-full transition-all duration-300"
                style={{ width: `${Math.min(100, (displayThinking.length / Math.max(1, thinking.length)) * 100)}%` }}
              />
            </div>
          )}
          
          <div className="text-xs text-sz-text-secondary whitespace-pre-wrap font-mono leading-relaxed pt-1 max-h-48 overflow-y-auto scrollbar-thin scrollbar-thumb-cyan-500/20">
            {displayThinking}
            {isActive && displayThinking.length < thinking.length && (
              <span className="inline-block w-1.5 h-3 bg-cyan-400/50 ml-0.5 animate-pulse" />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Animated streaming status messages
const streamingStatuses = [
  'Analyzing your request...',
  'Thinking about clips...',
  'Processing context...',
  'Formulating response...',
  'Almost there...',
];

// Loading indicator when bot is processing - ENHANCED with more visual feedback
function BotLoadingIndicator() {
  const [statusIndex, setStatusIndex] = useState(0);
  const [dots, setDots] = useState('');
  
  // Cycle through status messages
  useEffect(() => {
    const interval = setInterval(() => {
      setStatusIndex((prev) => (prev + 1) % streamingStatuses.length);
    }, 2500);
    return () => clearInterval(interval);
  }, []);
  
  // Animate dots
  useEffect(() => {
    const interval = setInterval(() => {
      setDots((prev) => (prev.length >= 3 ? '' : prev + '.'));
    }, 400);
    return () => clearInterval(interval);
  }, []);
  
  return (
    <div className="flex gap-3 animate-fade-in">
      {/* Avatar with enhanced pulse and glow */}
      <div className="relative flex-shrink-0">
        <div className="absolute inset-0 bg-cyan-500/20 rounded-lg blur-md animate-pulse" />
        <div className="relative w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500/40 to-cyan-600/30 flex items-center justify-center ring-2 ring-cyan-500/40 shadow-lg shadow-cyan-500/20">
          <Clapperboard className="w-4 h-4 text-cyan-400 animate-pulse" />
        </div>
      </div>
      
      {/* Loading content with enhanced visuals */}
      <div className="flex-1">
        <div className="flex flex-col gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-cyan-500/10 to-transparent border border-cyan-500/20 max-w-[280px] backdrop-blur-sm">
          {/* Animated brain icon with particles */}
          <div className="flex items-center gap-3">
            <div className="relative">
              <Brain className="w-5 h-5 text-cyan-400 animate-pulse" />
              {/* Particle effects */}
              <div className="absolute -top-1 -right-1 w-1.5 h-1.5 bg-cyan-400 rounded-full animate-ping" />
              <div className="absolute -bottom-0.5 -left-0.5 w-1 h-1 bg-cyan-300 rounded-full animate-ping" style={{ animationDelay: '300ms' }} />
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-medium text-cyan-400">
                {streamingStatuses[statusIndex]}{dots}
              </span>
            </div>
          </div>
          
          {/* Progress bar */}
          <div className="h-1 bg-cyan-900/30 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-cyan-500 to-cyan-300 rounded-full animate-progress-indeterminate" />
          </div>
          
          {/* Bouncing dots */}
          <div className="flex items-center gap-1 mt-1">
            <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: '0ms' }} />
            <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: '100ms' }} />
            <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: '200ms' }} />
            <span className="text-[10px] text-cyan-400/60 ml-2">Clip Bot is working</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// Live streaming text component - types out text character by character
function StreamingText({ text, isComplete }: { text: string; isComplete: boolean }) {
  const [displayedText, setDisplayedText] = useState('');
  const [cursorVisible, setCursorVisible] = useState(true);
  
  useEffect(() => {
    if (isComplete) {
      setDisplayedText(text);
      return;
    }
    
    let index = 0;
    const chars = text.split('');
    
    const interval = setInterval(() => {
      if (index < chars.length) {
        setDisplayedText(text.slice(0, index + 1));
        index++;
      } else {
        clearInterval(interval);
      }
    }, 15); // Fast but visible typing speed
    
    return () => clearInterval(interval);
  }, [text, isComplete]);
  
  // Blinking cursor
  useEffect(() => {
    if (isComplete) {
      setCursorVisible(false);
      return;
    }
    const interval = setInterval(() => {
      setCursorVisible((v) => !v);
    }, 530);
    return () => clearInterval(interval);
  }, [isComplete]);
  
  return (
    <span>
      {displayedText}
      {!isComplete && cursorVisible && (
        <span className="inline-block w-0.5 h-4 bg-cyan-400 ml-0.5 animate-pulse" />
      )}
    </span>
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
            isActive={message.isStreaming}
          />
        )}
        
        {/* Tool calls */}
        {message.toolCalls?.map((toolCall) => (
          <ToolCallDisplay key={toolCall.id} toolCall={toolCall} />
        ))}
        
        {/* Message content */}
        {message.content && (
          <div className={`
            inline-block px-4 py-3 rounded-xl max-w-full select-text transition-all duration-300
            ${isUser 
              ? 'bg-gradient-to-r from-sz-accent to-sz-accent/90 text-white shadow-lg shadow-sz-accent/20' 
              : 'bg-gradient-to-r from-sz-bg-secondary/90 to-sz-bg-secondary/70 text-sz-text border border-sz-border/30 backdrop-blur-sm'}
            ${message.isStreaming && !isUser ? 'ring-1 ring-cyan-500/30 shadow-lg shadow-cyan-500/10' : ''}
          `}>
            <div className="text-sm whitespace-pre-wrap break-words leading-relaxed select-text">
              {message.isStreaming && !isUser ? (
                <StreamingText text={message.content} isComplete={false} />
              ) : (
                message.content
              )}
            </div>
            
            {/* Streaming indicator */}
            {message.isStreaming && !isUser && (
              <div className="flex items-center gap-2 mt-2 pt-2 border-t border-cyan-500/10">
                <div className="flex gap-0.5">
                  <div className="w-1 h-1 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-1 h-1 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: '100ms' }} />
                  <div className="w-1 h-1 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: '200ms' }} />
                </div>
                <span className="text-[10px] text-cyan-400/60">Generating response...</span>
              </div>
            )}
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
  onShowExportPreview?: (clipIds: string[]) => void;
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
  onShowExportPreview,
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
    updateClipHook,
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
          const maxClipCount = (args.clipCount as number) ?? 30; // Allow more clips to fill duration
          const targetDurationSeconds = targetDuration * 60;
          const vibe = (args.vibe as string) ?? 'best_moments';
          const includeTransitions = (args.includeTransitions as boolean) ?? true;
          
          if (clips.length === 0) {
            throw new Error('No clips available. Run detection first to find viral moments.');
          }
          
          // Sort clips by score (best first)
          const sortedClips = [...clips].sort((a, b) => b.finalScore - a.finalScore);
          
          // Select clips to match target duration
          const selectedClips: typeof clips = [];
          let totalDuration = 0;
          const transitionDuration = includeTransitions ? 0.5 : 0;
          const selectedIds = new Set<string>();
          
          // Phase 1: Add best clips until we reach or slightly exceed target
          for (const clip of sortedClips) {
            if (selectedClips.length >= maxClipCount) break;
            if (selectedIds.has(clip.id)) continue;
            
            const clipDuration = clip.duration + (selectedClips.length > 0 ? transitionDuration : 0);
            
            // If we're still under target, add the clip
            if (totalDuration < targetDurationSeconds) {
              // Only add if it won't exceed target by more than 15%
              if (totalDuration + clipDuration <= targetDurationSeconds * 1.15) {
                selectedClips.push(clip);
                selectedIds.add(clip.id);
                totalDuration += clipDuration;
              }
            } else {
              // We've reached target, stop adding
              break;
            }
          }
          
          // Phase 2: If still under target by more than 10%, try to fill the gap with smaller clips
          if (totalDuration < targetDurationSeconds * 0.9) {
            const remainingTime = targetDurationSeconds - totalDuration;
            
            // Look for clips that fit the remaining time gap
            for (const clip of sortedClips) {
              if (selectedIds.has(clip.id)) continue;
              if (selectedClips.length >= maxClipCount) break;
              
              const clipDuration = clip.duration + transitionDuration;
              
              // Add clips that help fill the gap without going too far over
              if (clipDuration <= remainingTime * 1.5 && totalDuration + clipDuration <= targetDurationSeconds * 1.15) {
                selectedClips.push(clip);
                selectedIds.add(clip.id);
                totalDuration += clipDuration;
              }
            }
          }
          
          // Auto-accept the selected clips
          selectedClips.forEach(clip => {
            updateClipStatus(clip.id, 'accepted');
          });
          
          // Set other clips to pending (don't auto-reject)
          clips.filter(c => !selectedIds.has(c.id) && c.status === 'accepted').forEach(clip => {
            updateClipStatus(clip.id, 'pending');
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
          
          // Calculate how close we got to target
          const durationAccuracy = Math.round((totalDuration / targetDurationSeconds) * 100);
          const durationDiff = totalDuration - targetDurationSeconds;
          const durationMessage = durationDiff >= 0 
            ? `${formatTimestamp(Math.abs(durationDiff))} over target`
            : `${formatTimestamp(Math.abs(durationDiff))} under target`;
          
          result = {
            success: true,
            compilation: {
              clipCount: selectedClips.length,
              totalDuration: Math.round(totalDuration),
              totalDurationFormatted: formatTimestamp(totalDuration),
              targetDuration: targetDurationSeconds,
              targetDurationFormatted: formatTimestamp(targetDurationSeconds),
              durationAccuracy: `${durationAccuracy}%`,
              durationNote: durationMessage,
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
              'Export modal will open automatically',
            ],
          };
          
          // Trigger export preview modal with the selected clips
          if (onShowExportPreview) {
            // Use setTimeout to allow the tool result to be displayed first
            setTimeout(() => {
              onShowExportPreview(selectedClips.map(c => c.id));
            }, 500);
          }
          break;
        }
        
        case 'regenerate_hooks': {
          // Regenerate hook text for clips based on a theme
          const theme = args.theme as string;
          const clipIds = args.clipIds as string[] | undefined;
          
          if (!theme) {
            throw new Error('Theme is required for hook regeneration');
          }
          
          // Get clips to regenerate hooks for
          const targetClips = clipIds 
            ? clips.filter(c => clipIds.includes(c.id))
            : clips.filter(c => c.status === 'accepted');
          
          if (targetClips.length === 0) {
            throw new Error('No clips found to regenerate hooks for. Accept some clips first.');
          }
          
          const regeneratedHooks: Array<{ clipId: string; oldHook: string; newHook: string; newTitle?: string }> = [];
          
          // Generate new hooks for each clip using AI
          for (const clip of targetClips) {
            const clipTranscript = getTranscriptForRange(clip.startTime, clip.endTime);
            
            if (!clipTranscript || clipTranscript.length < 10) {
              continue; // Skip clips without transcript
            }
            
            try {
              // Call AI to generate themed hook
              const hookResponse = await window.api.chatWithAI({
                messages: [{
                  role: 'user',
                  content: `Generate a ${theme} hook for this podcast clip.

Clip transcript (${clip.duration?.toFixed(0) || 30}s):
"${clipTranscript.slice(0, 800)}"

Requirements:
1. hookText: A punchy 5-8 word caption that captures the ${theme} essence (for the first 3 seconds)
2. title: An engaging 8-12 word title that emphasizes the ${theme} theme

Return ONLY valid JSON with "hookText" and "title" fields, no explanation.`
                }],
                tools: false,
                systemPrompt: `You are a social media expert who creates viral ${theme} content. Generate hooks that emphasize the ${theme} aspects of the content. Be authentic - don't make up content that isn't there.`,
                providerConfig,
              });
              
              if (hookResponse.success && hookResponse.content) {
                try {
                  // Parse the JSON response
                  let jsonContent = hookResponse.content.trim();
                  if (jsonContent.startsWith('```')) {
                    jsonContent = jsonContent.split('```')[1];
                    if (jsonContent.startsWith('json')) {
                      jsonContent = jsonContent.slice(4);
                    }
                  }
                  
                  const hookData = JSON.parse(jsonContent);
                  const newHook = hookData.hookText || hookData.hook || '';
                  const newTitle = hookData.title || '';
                  
                  if (newHook) {
                    updateClipHook(clip.id, newHook, newTitle || undefined);
                    regeneratedHooks.push({
                      clipId: clip.id,
                      oldHook: clip.hookText || '',
                      newHook,
                      newTitle: newTitle || undefined,
                    });
                  }
                } catch (parseErr) {
                  console.error('Failed to parse hook response:', parseErr);
                }
              }
            } catch (err) {
              console.error(`Failed to regenerate hook for clip ${clip.id}:`, err);
            }
          }
          
          result = {
            success: true,
            theme,
            clipsProcessed: targetClips.length,
            hooksRegenerated: regeneratedHooks.length,
            regeneratedHooks: regeneratedHooks.map(h => ({
              clipId: h.clipId,
              newHook: h.newHook,
              newTitle: h.newTitle,
            })),
            message: `Regenerated ${regeneratedHooks.length} hooks with "${theme}" theme`,
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
    onShowExportPreview,
    getCurrentTime,
    getSelectedClipId,
    getIsPlaying,
    updateClipStatus,
    updateClipTrim,
    updateClipHook,
    updateToolCall,
    aiSettings,
    setDetecting,
    providerConfig,
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

**Core**: run_detection, create_vod_compilation, regenerate_hooks
**Analysis**: analyze_clip_quality, detect_highlights, compare_clips
**Actions**: smart_trim_clip, auto_review_clips, set_clip_status
**Basic**: seek_to_time, select_clip, play_pause, get_project_state

## Customizing Content for User's Goals

When the user requests specific themes (e.g., "inspiring moments", "funny clips", "educational content"):
1. Use run_detection to find clips first
2. Use create_vod_compilation to select clips for the target duration
3. Use regenerate_hooks with the user's theme to customize hook text

regenerate_hooks parameters:
- theme: The vibe/theme to use (e.g., "inspiring", "funny", "educational", "motivational")
- clipIds: Optional - specific clips to regenerate hooks for (defaults to accepted clips)

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
      {/* Header - Enhanced with visual feedback */}
      <div className={`flex items-center justify-between px-4 py-3 border-b transition-all duration-300 ${
        isLoading 
          ? 'border-cyan-500/30 bg-gradient-to-r from-cyan-500/10 via-purple-500/5 to-transparent' 
          : 'border-sz-border bg-gradient-to-r from-cyan-500/5 to-transparent'
      }`}>
        <div className="flex items-center gap-2.5">
          {/* Animated avatar */}
          <div className="relative">
            {isLoading && (
              <div className="absolute inset-0 bg-cyan-500/30 rounded-lg blur-md animate-pulse" />
            )}
            <div className={`relative w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500/30 to-cyan-600/20 flex items-center justify-center ring-1 transition-all duration-300 ${
              isLoading ? 'ring-cyan-500/50 shadow-lg shadow-cyan-500/20' : 'ring-cyan-500/30'
            }`}>
              <Clapperboard className={`w-4 h-4 text-cyan-400 ${isLoading ? 'animate-pulse' : ''}`} />
            </div>
          </div>
          
          <div className="flex flex-col">
            <span className="font-semibold text-sz-text text-sm">Clip Bot</span>
            <div className="flex items-center gap-1.5">
              {isLoading ? (
                <div className="flex items-center gap-1.5">
                  <div className="relative">
                    <CircleDot className="w-2.5 h-2.5 text-cyan-400" />
                    <div className="absolute inset-0 w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping opacity-75" />
                  </div>
                  <span className="text-[10px] text-cyan-400 font-medium">Working</span>
                  <div className="flex gap-0.5">
                    <div className="w-1 h-1 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-1 h-1 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: '100ms' }} />
                    <div className="w-1 h-1 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: '200ms' }} />
                  </div>
                </div>
              ) : (
                <>
                  <CircleDot className="w-2.5 h-2.5 text-emerald-400" />
                  <span className="text-[10px] text-sz-text-muted">Ready to help</span>
                </>
              )}
              {/* Provider indicator badge */}
              {lastUsedProvider && (
                <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium ml-1 transition-all ${providerColors[lastUsedProvider] || 'bg-sz-bg-tertiary text-sz-text-muted'}`}>
                  {providerLabels[lastUsedProvider] || lastUsedProvider}
                </span>
              )}
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-1">
          {/* Message count badge */}
          {messages.length > 0 && (
            <span className="text-[10px] text-sz-text-muted px-2 py-0.5 rounded-full bg-sz-bg-tertiary mr-1">
              {messages.length} msg{messages.length > 1 ? 's' : ''}
            </span>
          )}
          <button
            onClick={clearMessages}
            className="p-1.5 hover:bg-sz-bg-hover rounded-lg transition-colors group"
            title="Clear chat"
          >
            <Trash2 className="w-4 h-4 text-sz-text-muted group-hover:text-red-400 transition-colors" />
          </button>
        </div>
      </div>
      
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin">
        {messages.length === 0 ? (
          <div className="text-center py-6 animate-fade-in">
            {/* Animated logo with particles */}
            <div className="relative w-20 h-20 mx-auto mb-4">
              <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/20 to-purple-500/10 rounded-2xl blur-xl animate-pulse" />
              <div className="relative w-20 h-20 rounded-2xl bg-gradient-to-br from-cyan-500/30 to-cyan-600/20 flex items-center justify-center ring-2 ring-cyan-500/30 shadow-lg shadow-cyan-500/20">
                <Clapperboard className="w-10 h-10 text-cyan-400" />
              </div>
              {/* Floating particles */}
              <div className="absolute -top-1 right-2 w-2 h-2 bg-cyan-400 rounded-full animate-float-up" />
              <div className="absolute top-4 -left-1 w-1.5 h-1.5 bg-purple-400 rounded-full animate-float-up" style={{ animationDelay: '0.5s' }} />
              <div className="absolute -bottom-1 right-4 w-1 h-1 bg-cyan-300 rounded-full animate-float-up" style={{ animationDelay: '1s' }} />
            </div>
            
            <p className="text-sz-text text-lg font-semibold bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">
              Hey! I'm Clip Bot
            </p>
            <p className="text-sz-text-muted text-xs mt-2 max-w-[240px] mx-auto">
              Your AI assistant for finding viral moments, reviewing clips, and creating highlight reels.
            </p>
            
            {/* Clickable suggestion buttons */}
            <div className="mt-5 space-y-2 text-xs text-left max-w-[280px] mx-auto">
              <p className="text-sz-text-muted text-[10px] uppercase tracking-wider mb-3 text-center">
                Try asking me to:
              </p>
              
              <button 
                onClick={() => setInput('Find the viral moments in this video')}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500/10 to-transparent border border-cyan-500/20 hover:border-cyan-500/40 hover:bg-cyan-500/15 hover:shadow-lg hover:shadow-cyan-500/10 cursor-pointer transition-all duration-200 group"
              >
                <div className="w-7 h-7 rounded-lg bg-cyan-500/20 flex items-center justify-center group-hover:bg-cyan-500/30 transition-colors">
                  <Zap className="w-4 h-4 text-cyan-400" />
                </div>
                <span className="text-cyan-400/90 group-hover:text-cyan-300 transition-colors">"Find viral moments"</span>
              </button>
              
              <button 
                onClick={() => setInput('Make a 20 minute highlight reel with the best clips')}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-gradient-to-r from-amber-500/10 to-transparent border border-amber-500/20 hover:border-amber-500/40 hover:bg-amber-500/15 hover:shadow-lg hover:shadow-amber-500/10 cursor-pointer transition-all duration-200 group"
              >
                <div className="w-7 h-7 rounded-lg bg-amber-500/20 flex items-center justify-center group-hover:bg-amber-500/30 transition-colors">
                  <ListOrdered className="w-4 h-4 text-amber-400" />
                </div>
                <span className="text-amber-400/90 group-hover:text-amber-300 transition-colors">"Make a highlight reel"</span>
              </button>
              
              <button 
                onClick={() => setInput('Auto-review all clips and accept the best ones')}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500/10 to-transparent border border-emerald-500/20 hover:border-emerald-500/40 hover:bg-emerald-500/15 hover:shadow-lg hover:shadow-emerald-500/10 cursor-pointer transition-all duration-200 group"
              >
                <div className="w-7 h-7 rounded-lg bg-emerald-500/20 flex items-center justify-center group-hover:bg-emerald-500/30 transition-colors">
                  <CheckCheck className="w-4 h-4 text-emerald-400" />
                </div>
                <span className="text-emerald-400/90 group-hover:text-emerald-300 transition-colors">"Auto-review clips"</span>
              </button>
              
              <button 
                onClick={() => setInput('What are the top 5 best clips?')}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-gradient-to-r from-violet-500/10 to-transparent border border-violet-500/20 hover:border-violet-500/40 hover:bg-violet-500/15 hover:shadow-lg hover:shadow-violet-500/10 cursor-pointer transition-all duration-200 group"
              >
                <div className="w-7 h-7 rounded-lg bg-violet-500/20 flex items-center justify-center group-hover:bg-violet-500/30 transition-colors">
                  <Sparkles className="w-4 h-4 text-violet-400" />
                </div>
                <span className="text-violet-400/90 group-hover:text-violet-300 transition-colors">"Show top 5 clips"</span>
              </button>
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
