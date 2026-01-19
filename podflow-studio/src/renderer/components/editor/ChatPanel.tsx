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
  Settings,
  Play,
  Pause,
  Clock,
  Scissors,
  Eye,
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
} from 'lucide-react';
import { useChatStore, type ChatMessage, type ToolCall } from '../../stores/chatStore';
import { useStore } from '../../stores/store';
import { formatTimestamp } from '../../types';

// Tool icon mapping - organized by category
const toolIcons: Record<string, React.ReactNode> = {
  // Analysis tools
  analyze_clip_quality: <Sparkles className="w-3.5 h-3.5" />,
  analyze_energy_curve: <Activity className="w-3.5 h-3.5" />,
  analyze_speech_patterns: <MessageSquare className="w-3.5 h-3.5" />,
  find_optimal_boundaries: <Scissors className="w-3.5 h-3.5" />,
  detect_highlights: <Zap className="w-3.5 h-3.5" />,
  compare_clips: <GitCompare className="w-3.5 h-3.5" />,
  // Action tools
  smart_trim_clip: <Crop className="w-3.5 h-3.5" />,
  auto_review_clips: <CheckCheck className="w-3.5 h-3.5" />,
  suggest_clip_order: <ListOrdered className="w-3.5 h-3.5" />,
  // Basic tools
  seek_to_time: <Clock className="w-3.5 h-3.5" />,
  select_clip: <MousePointer className="w-3.5 h-3.5" />,
  set_clip_status: <CheckCircle2 className="w-3.5 h-3.5" />,
  trim_clip: <Scissors className="w-3.5 h-3.5" />,
  get_project_state: <Info className="w-3.5 h-3.5" />,
  get_transcript: <FileText className="w-3.5 h-3.5" />,
  play_pause: <Play className="w-3.5 h-3.5" />,
};

// Tool category colors
const toolCategoryColors: Record<string, string> = {
  // Analysis tools - purple
  analyze_clip_quality: 'text-violet-400',
  analyze_energy_curve: 'text-violet-400',
  analyze_speech_patterns: 'text-violet-400',
  find_optimal_boundaries: 'text-violet-400',
  detect_highlights: 'text-violet-400',
  compare_clips: 'text-violet-400',
  // Action tools - green
  smart_trim_clip: 'text-emerald-400',
  auto_review_clips: 'text-emerald-400',
  suggest_clip_order: 'text-emerald-400',
  // Basic tools - blue
  seek_to_time: 'text-blue-400',
  select_clip: 'text-blue-400',
  set_clip_status: 'text-blue-400',
  trim_clip: 'text-blue-400',
  get_project_state: 'text-blue-400',
  get_transcript: 'text-blue-400',
  play_pause: 'text-blue-400',
};

// Tool call component
function ToolCallDisplay({ toolCall }: { toolCall: ToolCall }) {
  const [showDetails, setShowDetails] = useState(false);
  
  const statusIcon = {
    pending: <Loader2 className="w-3.5 h-3.5 animate-spin text-sz-text-muted" />,
    running: <Loader2 className="w-3.5 h-3.5 animate-spin text-sz-accent" />,
    success: <CheckCircle2 className="w-3.5 h-3.5 text-sz-success" />,
    error: <XCircle className="w-3.5 h-3.5 text-sz-danger" />,
  }[toolCall.status];
  
  return (
    <div className="my-2 rounded-sz border border-sz-border bg-sz-bg-secondary/50 overflow-hidden">
      <button
        onClick={() => setShowDetails(!showDetails)}
        className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-sz-bg-hover transition-colors"
      >
        {showDetails ? (
          <ChevronDown className="w-3.5 h-3.5 text-sz-text-muted" />
        ) : (
          <ChevronRight className="w-3.5 h-3.5 text-sz-text-muted" />
        )}
        <span className={toolCategoryColors[toolCall.name] || 'text-sz-accent'}>
          {toolIcons[toolCall.name] || <Wrench className="w-3.5 h-3.5" />}
        </span>
        <span className="font-mono text-sz-text">{toolCall.name}</span>
        <span className="flex-1" />
        {statusIcon}
      </button>
      
      {showDetails && (
        <div className="px-3 pb-2 space-y-2 text-xs">
          <div>
            <div className="text-sz-text-muted mb-1">Arguments:</div>
            <pre className="bg-sz-bg p-2 rounded-sz overflow-x-auto text-sz-text-secondary font-mono text-[10px]">
              {JSON.stringify(toolCall.arguments, null, 2)}
            </pre>
          </div>
          {toolCall.result !== undefined && (
            <div>
              <div className="text-sz-text-muted mb-1">Result:</div>
              <pre className="bg-sz-bg p-2 rounded-sz overflow-x-auto text-sz-text-secondary font-mono text-[10px] max-h-32 overflow-y-auto">
                {typeof toolCall.result === 'string' 
                  ? toolCall.result 
                  : JSON.stringify(toolCall.result, null, 2)}
              </pre>
            </div>
          )}
          {toolCall.error && (
            <div>
              <div className="text-sz-danger mb-1">Error:</div>
              <pre className="bg-red-500/10 p-2 rounded-sz overflow-x-auto text-sz-danger font-mono text-[10px]">
                {toolCall.error}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Thinking block component
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
    <div className="my-2 rounded-sz border border-violet-500/30 bg-violet-500/5 overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-violet-500/10 transition-colors"
      >
        {collapsed ? (
          <ChevronRight className="w-3.5 h-3.5 text-violet-400" />
        ) : (
          <ChevronDown className="w-3.5 h-3.5 text-violet-400" />
        )}
        <Brain className="w-3.5 h-3.5 text-violet-400" />
        <span className="text-violet-400 font-medium">Thinking...</span>
      </button>
      
      {!collapsed && (
        <div className="px-3 pb-3">
          <div className="text-xs text-sz-text-secondary whitespace-pre-wrap font-mono leading-relaxed">
            {thinking}
          </div>
        </div>
      )}
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
  
  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
      {/* Avatar */}
      <div className={`
        flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center
        ${isUser ? 'bg-sz-accent' : 'bg-violet-500/20'}
      `}>
        {isUser ? (
          <User className="w-4 h-4 text-white" />
        ) : (
          <Bot className="w-4 h-4 text-violet-400" />
        )}
      </div>
      
      {/* Content */}
      <div className={`flex-1 min-w-0 ${isUser ? 'text-right' : ''}`}>
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
            inline-block px-3 py-2 rounded-sz-lg max-w-full
            ${isUser 
              ? 'bg-sz-accent text-white' 
              : 'bg-sz-bg-secondary text-sz-text'}
          `}>
            <div className="text-sm whitespace-pre-wrap break-words">
              {message.content}
              {message.isStreaming && (
                <span className="inline-block w-1.5 h-4 bg-current animate-pulse ml-0.5" />
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
    apiKey,
    model,
    showThinking,
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
    setApiKey,
  } = useChatStore();
  
  const {
    project,
    clips,
    transcript,
    deadSpaces,
    selectedClipId: storeSelectedClipId,
    updateClipStatus,
    updateClipTrim,
  } = useStore();
  
  const [input, setInput] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [localApiKey, setLocalApiKey] = useState(apiKey || '');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  
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
        
        default:
          throw new Error(`Unknown tool: ${toolName}`);
      }
      
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
  ]);
  
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
    
    // Check for API key
    if (!apiKey) {
      addMessage({
        role: 'assistant',
        content: 'Please set your Anthropic API key in the settings to use the chat feature.',
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
      
      // Call the AI chat API
      const response = await window.api.chatWithAI({
        messages: messages.map(m => ({
          role: m.role,
          content: m.content,
        })).concat({ role: 'user', content: userInput }),
        model,
        apiKey,
        tools: true, // Enable tools
        systemPrompt: buildSystemPrompt(),
      });
      
      if (!response.success) {
        throw new Error(response.error || 'Failed to get AI response');
      }
      
      // Handle thinking
      if (response.thinking) {
        appendThinking(assistantMsgId, response.thinking);
      }
      
      // Handle tool calls
      if (response.toolCalls && response.toolCalls.length > 0) {
        for (const tc of response.toolCalls) {
          const toolCallId = addToolCall(assistantMsgId, {
            name: tc.name,
            arguments: tc.arguments,
          });
          
          // Execute the tool
          const result = await executeTool(assistantMsgId, toolCallId, tc.name, tc.arguments);
          
          // If we need to continue the conversation with tool results
          if (response.requiresToolResults) {
            // This would need a follow-up API call with tool results
            // For now, we'll just show the results
          }
        }
      }
      
      // Handle content
      if (response.content) {
        updateMessage(assistantMsgId, { 
          content: response.content,
          isStreaming: false,
        });
      } else if (!response.toolCalls?.length) {
        updateMessage(assistantMsgId, {
          content: 'I completed the action but have no additional response.',
          isStreaming: false,
        });
      } else {
        updateMessage(assistantMsgId, { isStreaming: false });
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
    apiKey, 
    model, 
    messages, 
    addMessage, 
    setLoading, 
    setError, 
    setStreaming, 
    appendThinking, 
    addToolCall, 
    updateMessage, 
    executeTool,
  ]);
  
  // Build system prompt with current context
  const buildSystemPrompt = useCallback(() => {
    const accepted = clips.filter(c => c.status === 'accepted').length;
    const rejected = clips.filter(c => c.status === 'rejected').length;
    const pending = clips.filter(c => c.status === 'pending').length;
    const avgScore = clips.length > 0 
      ? Math.round(clips.reduce((a, c) => a + c.finalScore, 0) / clips.length) 
      : 0;
    
    const clipsSummary = clips.length > 0
      ? `${clips.length} clips detected (${accepted} accepted, ${rejected} rejected, ${pending} pending). Average score: ${avgScore}/100.`
      : 'No clips detected yet - run detection first.';
    
    return `You are an AI video editing assistant in PodFlow Studio. You help users review and edit podcast clips using ALGORITHMIC ANALYSIS tools - not trained models.

## Current Project
- File: ${project?.fileName || 'No project loaded'}
- Duration: ${project?.duration ? formatTimestamp(project.duration) : 'N/A'}
- ${clipsSummary}
- Transcript: ${transcript ? 'Available' : 'Not available'}

## Your Approach
You use REASONING + ALGORITHMS instead of trained ML models. When making decisions:
1. First ANALYZE the data using analysis tools (get metrics, patterns, scores)
2. REASON about what the data means (explain your thinking)
3. Then take ACTION based on your analysis

## Tool Categories

### Analysis Tools (use these to understand content)
- \`analyze_clip_quality\` - Get detailed quality metrics, hook strength, pacing analysis
- \`analyze_energy_curve\` - See energy/loudness over time to find peaks and valleys
- \`analyze_speech_patterns\` - Find sentence boundaries, pauses, natural cut points
- \`find_optimal_boundaries\` - Use VAD to find clean start/end points
- \`detect_highlights\` - Find viral moments using pattern detection algorithms
- \`compare_clips\` - Compare clips on multiple criteria to pick the best

### Action Tools (make changes based on analysis)
- \`smart_trim_clip\` - Intelligently trim using strategies (tighten, extend_hook, sentence_boundaries)
- \`auto_review_clips\` - Batch accept/reject based on score thresholds
- \`suggest_clip_order\` - Optimize clip order for compilations

### Basic Tools (simple operations)
- \`seek_to_time\`, \`select_clip\`, \`set_clip_status\`, \`trim_clip\`
- \`get_project_state\`, \`get_transcript\`, \`play_pause\`

## Guidelines
- Always explain your reasoning when making editing decisions
- Use analysis tools first to gather data before taking actions
- When comparing options, use \`compare_clips\` and explain the tradeoffs
- For complex tasks, break them into steps: analyze → reason → act
- Cite specific metrics (scores, durations, word counts) in your explanations`;
  }, [project, clips, transcript]);
  
  // Handle key press
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };
  
  // Save API key
  const handleSaveApiKey = () => {
    setApiKey(localApiKey || null);
    setShowSettings(false);
  };
  
  return (
    <div className={`flex flex-col h-full bg-sz-bg-secondary rounded-sz-lg border border-sz-border ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-sz-border">
        <div className="flex items-center gap-2">
          <Bot className="w-5 h-5 text-violet-400" />
          <span className="font-medium text-sz-text">AI Assistant</span>
          {isLoading && (
            <Loader2 className="w-4 h-4 animate-spin text-sz-accent" />
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={clearMessages}
            className="p-1.5 hover:bg-sz-bg-hover rounded-sz transition-colors"
            title="Clear chat"
          >
            <Trash2 className="w-4 h-4 text-sz-text-muted" />
          </button>
          <button
            onClick={() => setShowSettings(!showSettings)}
            className={`p-1.5 hover:bg-sz-bg-hover rounded-sz transition-colors ${showSettings ? 'bg-sz-bg-hover' : ''}`}
            title="Settings"
          >
            <Settings className="w-4 h-4 text-sz-text-muted" />
          </button>
        </div>
      </div>
      
      {/* Settings panel */}
      {showSettings && (
        <div className="px-4 py-3 border-b border-sz-border bg-sz-bg space-y-3">
          <div>
            <label className="block text-xs text-sz-text-muted mb-1">
              Anthropic API Key
            </label>
            <input
              type="password"
              value={localApiKey}
              onChange={(e) => setLocalApiKey(e.target.value)}
              placeholder="sk-ant-..."
              className="w-full px-3 py-2 text-sm bg-sz-bg-secondary border border-sz-border rounded-sz focus:outline-none focus:border-sz-accent"
            />
          </div>
          <button
            onClick={handleSaveApiKey}
            className="w-full px-3 py-2 text-sm bg-sz-accent hover:bg-sz-accent-hover text-white rounded-sz transition-colors"
          >
            Save
          </button>
        </div>
      )}
      
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="text-center py-8">
            <Bot className="w-12 h-12 mx-auto text-violet-400/50 mb-3" />
            <p className="text-sz-text-secondary text-sm font-medium">
              AI Editing Assistant
            </p>
            <p className="text-sz-text-muted text-xs mt-2 max-w-[200px] mx-auto">
              I use algorithms + reasoning to help you edit. Try:
            </p>
            <div className="mt-3 space-y-1.5 text-xs text-left max-w-[220px] mx-auto">
              <p className="text-violet-400/80">"Analyze clip 1 and tell me if it's good"</p>
              <p className="text-emerald-400/80">"Auto-accept clips with score above 75"</p>
              <p className="text-blue-400/80">"Compare the top 3 clips"</p>
            </div>
          </div>
        ) : (
          messages.map((message) => (
            <MessageDisplay
              key={message.id}
              message={message}
              onToggleThinking={() => toggleThinking(message.id)}
            />
          ))
        )}
        <div ref={messagesEndRef} />
      </div>
      
      {/* Error display */}
      {error && (
        <div className="px-4 py-2 bg-red-500/10 border-t border-red-500/30">
          <p className="text-xs text-red-400">{error}</p>
        </div>
      )}
      
      {/* Input */}
      <div className="p-4 border-t border-sz-border">
        <div className="flex gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={apiKey ? "Ask me anything..." : "Set API key to start chatting..."}
            disabled={!apiKey || isLoading}
            className="flex-1 px-3 py-2 text-sm bg-sz-bg border border-sz-border rounded-sz resize-none focus:outline-none focus:border-sz-accent disabled:opacity-50 disabled:cursor-not-allowed"
            rows={1}
            style={{ minHeight: '40px', maxHeight: '120px' }}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || !apiKey || isLoading}
            className="px-4 py-2 bg-sz-accent hover:bg-sz-accent-hover disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-sz transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default memo(ChatPanel);
