import { memo, useState, useCallback, useRef, useEffect } from 'react';
import { 
  Send, 
  Sparkles, 
  Video, 
  Music, 
  Zap, 
  Clock, 
  Image as ImageIcon,
  Link as LinkIcon,
  Check,
  X,
  RefreshCw,
  Bot,
  User,
} from 'lucide-react';

export interface EditingIntent {
  style: string;
  pacing: 'fast' | 'moderate' | 'slow';
  bRollSuggestions: string[];
  musicMood: string | null;
  effects: string[];
  targetPlatform: 'tiktok' | 'youtube' | 'instagram' | 'general';
  captionsEnabled: boolean;
  zoomEffects: boolean;
  transitionStyle: 'cut' | 'fade' | 'dynamic';
}

interface Message {
  id: string;
  type: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  intent?: Partial<EditingIntent>;
}

interface EditingChatbotProps {
  onIntentChange: (intent: EditingIntent) => void;
  initialPrompt?: string;
  referenceVideoUrl?: string;
  className?: string;
}

const defaultIntent: EditingIntent = {
  style: 'engaging',
  pacing: 'moderate',
  bRollSuggestions: [],
  musicMood: null,
  effects: [],
  targetPlatform: 'general',
  captionsEnabled: true,
  zoomEffects: false,
  transitionStyle: 'cut',
};

const suggestionPrompts = [
  { icon: <Zap className="w-4 h-4" />, text: "Make it energetic with fast cuts" },
  { icon: <Clock className="w-4 h-4" />, text: "Keep it calm and cinematic" },
  { icon: <Video className="w-4 h-4" />, text: "Optimize for TikTok/Reels" },
  { icon: <Music className="w-4 h-4" />, text: "Add upbeat background music" },
  { icon: <ImageIcon className="w-4 h-4" />, text: "Include B-roll at topic changes" },
  { icon: <Sparkles className="w-4 h-4" />, text: "Add zoom effects on key moments" },
];

function parseUserIntent(message: string): Partial<EditingIntent> {
  const intent: Partial<EditingIntent> = {};
  const lowerMessage = message.toLowerCase();

  // Detect pacing
  if (lowerMessage.includes('fast') || lowerMessage.includes('quick') || lowerMessage.includes('energetic') || lowerMessage.includes('snappy')) {
    intent.pacing = 'fast';
  } else if (lowerMessage.includes('slow') || lowerMessage.includes('calm') || lowerMessage.includes('cinematic') || lowerMessage.includes('relaxed')) {
    intent.pacing = 'slow';
  }

  // Detect platform
  if (lowerMessage.includes('tiktok') || lowerMessage.includes('tik tok')) {
    intent.targetPlatform = 'tiktok';
    if (!intent.pacing) intent.pacing = 'fast';
  } else if (lowerMessage.includes('youtube')) {
    intent.targetPlatform = 'youtube';
  } else if (lowerMessage.includes('instagram') || lowerMessage.includes('reels')) {
    intent.targetPlatform = 'instagram';
    if (!intent.pacing) intent.pacing = 'fast';
  }

  // Detect effects
  const effects: string[] = [];
  if (lowerMessage.includes('zoom')) {
    effects.push('zoom');
    intent.zoomEffects = true;
  }
  if (lowerMessage.includes('shake') || lowerMessage.includes('camera shake')) {
    effects.push('camera-shake');
  }
  if (lowerMessage.includes('blur') || lowerMessage.includes('motion blur')) {
    effects.push('motion-blur');
  }
  if (effects.length > 0) intent.effects = effects;

  // Detect music mood
  if (lowerMessage.includes('upbeat') || lowerMessage.includes('energetic music')) {
    intent.musicMood = 'upbeat';
  } else if (lowerMessage.includes('chill') || lowerMessage.includes('relaxing')) {
    intent.musicMood = 'chill';
  } else if (lowerMessage.includes('dramatic') || lowerMessage.includes('intense')) {
    intent.musicMood = 'dramatic';
  }

  // Detect captions
  if (lowerMessage.includes('caption') || lowerMessage.includes('subtitle')) {
    intent.captionsEnabled = true;
  }
  if (lowerMessage.includes('no caption') || lowerMessage.includes('without caption')) {
    intent.captionsEnabled = false;
  }

  // Detect B-roll
  if (lowerMessage.includes('b-roll') || lowerMessage.includes('broll') || lowerMessage.includes('cutaway')) {
    intent.bRollSuggestions = ['topic-change', 'emphasis'];
  }

  // Detect transitions
  if (lowerMessage.includes('fade') || lowerMessage.includes('crossfade')) {
    intent.transitionStyle = 'fade';
  } else if (lowerMessage.includes('dynamic') || lowerMessage.includes('creative transition')) {
    intent.transitionStyle = 'dynamic';
  }

  // Extract style description
  intent.style = message.trim();

  return intent;
}

function generateResponse(intent: Partial<EditingIntent>): string {
  const parts: string[] = [];

  if (intent.pacing === 'fast') {
    parts.push("I'll use quick cuts to keep the energy high");
  } else if (intent.pacing === 'slow') {
    parts.push("I'll let the shots breathe for a cinematic feel");
  }

  if (intent.targetPlatform && intent.targetPlatform !== 'general') {
    parts.push(`optimized for ${intent.targetPlatform === 'tiktok' ? 'TikTok' : intent.targetPlatform === 'instagram' ? 'Instagram Reels' : 'YouTube'}`);
  }

  if (intent.zoomEffects) {
    parts.push("with zoom effects on key moments");
  }

  if (intent.musicMood) {
    parts.push(`and ${intent.musicMood} background music`);
  }

  if (intent.captionsEnabled) {
    parts.push("with auto-generated captions");
  }

  if (parts.length === 0) {
    return "Got it! I'll edit your video with a balanced, engaging style. Feel free to add more specific instructions.";
  }

  return `Perfect! I'll edit your video ${parts.join(', ')}. Anything else you'd like to adjust?`;
}

function EditingChatbot({ onIntentChange, initialPrompt, referenceVideoUrl, className }: EditingChatbotProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      type: 'assistant',
      content: "Hi! I'm your AI editing assistant. Tell me how you'd like your video edited - describe the style, pacing, effects, or share a reference video for me to match.",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState(initialPrompt || '');
  const [currentIntent, setCurrentIntent] = useState<EditingIntent>(defaultIntent);
  const [isProcessing, setIsProcessing] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Handle reference video URL
  useEffect(() => {
    if (referenceVideoUrl && !messages.find(m => m.content.includes(referenceVideoUrl))) {
      const newMessage: Message = {
        id: `ref_${Date.now()}`,
        type: 'system',
        content: `Reference video added: ${referenceVideoUrl}`,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, newMessage]);
      
      // Add assistant response
      setTimeout(() => {
        const responseMessage: Message = {
          id: `resp_${Date.now()}`,
          type: 'assistant',
          content: "Great! I'll analyze this reference video and match its editing style. You can still customize specific aspects if you'd like.",
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, responseMessage]);
      }, 500);
    }
  }, [referenceVideoUrl, messages]);

  const handleSend = useCallback(() => {
    if (!input.trim() || isProcessing) return;

    const userMessage: Message = {
      id: `user_${Date.now()}`,
      type: 'user',
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsProcessing(true);

    // Parse intent from user message
    setTimeout(() => {
      const parsedIntent = parseUserIntent(userMessage.content);
      const mergedIntent = { ...currentIntent, ...parsedIntent };
      
      setCurrentIntent(mergedIntent);
      onIntentChange(mergedIntent);

      const assistantMessage: Message = {
        id: `assistant_${Date.now()}`,
        type: 'assistant',
        content: generateResponse(parsedIntent),
        timestamp: new Date(),
        intent: parsedIntent,
      };

      setMessages(prev => [...prev, assistantMessage]);
      setIsProcessing(false);
    }, 800);
  }, [input, isProcessing, currentIntent, onIntentChange]);

  const handleSuggestionClick = useCallback((suggestion: string) => {
    setInput(suggestion);
    inputRef.current?.focus();
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  const handleReset = useCallback(() => {
    setCurrentIntent(defaultIntent);
    onIntentChange(defaultIntent);
    setMessages([
      {
        id: 'welcome',
        type: 'assistant',
        content: "Let's start fresh! Tell me how you'd like your video edited.",
        timestamp: new Date(),
      },
    ]);
  }, [onIntentChange]);

  return (
    <div className={`flex flex-col h-full bg-sz-bg-secondary rounded-xl border border-sz-border ${className || ''}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-sz-border">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-sz-accent/20 flex items-center justify-center">
            <Bot className="w-4 h-4 text-sz-accent" />
          </div>
          <div>
            <h3 className="font-medium text-sz-text text-sm">Editing Assistant</h3>
            <p className="text-xs text-sz-text-muted">Describe your style</p>
          </div>
        </div>
        <button
          onClick={handleReset}
          className="p-2 rounded-lg hover:bg-sz-bg-tertiary text-sz-text-secondary hover:text-sz-text transition-colors"
          title="Reset conversation"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex gap-3 ${message.type === 'user' ? 'flex-row-reverse' : ''}`}
          >
            {message.type !== 'system' && (
              <div className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center ${
                message.type === 'user' 
                  ? 'bg-sz-accent' 
                  : 'bg-sz-bg-tertiary'
              }`}>
                {message.type === 'user' ? (
                  <User className="w-3.5 h-3.5 text-white" />
                ) : (
                  <Bot className="w-3.5 h-3.5 text-sz-accent" />
                )}
              </div>
            )}
            <div
              className={`max-w-[80%] px-4 py-2.5 rounded-2xl ${
                message.type === 'user'
                  ? 'bg-sz-accent text-white rounded-br-md'
                  : message.type === 'system'
                  ? 'bg-sz-bg-tertiary text-sz-text-secondary text-sm mx-auto text-center rounded-lg'
                  : 'bg-sz-bg-tertiary text-sz-text rounded-bl-md'
              }`}
            >
              <p className="text-sm leading-relaxed">{message.content}</p>
              {message.intent && Object.keys(message.intent).length > 1 && (
                <div className="mt-2 pt-2 border-t border-white/10 flex flex-wrap gap-1">
                  {message.intent.pacing && (
                    <span className="px-2 py-0.5 rounded-full text-xs bg-white/10">
                      {message.intent.pacing} pacing
                    </span>
                  )}
                  {message.intent.targetPlatform && message.intent.targetPlatform !== 'general' && (
                    <span className="px-2 py-0.5 rounded-full text-xs bg-white/10">
                      {message.intent.targetPlatform}
                    </span>
                  )}
                  {message.intent.zoomEffects && (
                    <span className="px-2 py-0.5 rounded-full text-xs bg-white/10">
                      zoom effects
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
        {isProcessing && (
          <div className="flex gap-3">
            <div className="w-7 h-7 rounded-full bg-sz-bg-tertiary flex items-center justify-center">
              <Bot className="w-3.5 h-3.5 text-sz-accent" />
            </div>
            <div className="px-4 py-3 rounded-2xl rounded-bl-md bg-sz-bg-tertiary">
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-sz-text-muted rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 bg-sz-text-muted rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 bg-sz-text-muted rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Suggestions */}
      {messages.length <= 2 && (
        <div className="px-4 pb-3">
          <p className="text-xs text-sz-text-muted mb-2">Try saying:</p>
          <div className="flex flex-wrap gap-2">
            {suggestionPrompts.map((prompt, i) => (
              <button
                key={i}
                onClick={() => handleSuggestionClick(prompt.text)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-sz-bg-tertiary text-sz-text-secondary text-xs hover:bg-sz-bg hover:text-sz-text transition-colors"
              >
                {prompt.icon}
                {prompt.text}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Current Intent Summary */}
      {currentIntent.pacing !== 'moderate' || currentIntent.zoomEffects || currentIntent.musicMood || currentIntent.targetPlatform !== 'general' ? (
        <div className="px-4 pb-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-sz-text-muted">Current style:</span>
            {currentIntent.pacing !== 'moderate' && (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-emerald-500/20 text-emerald-400">
                <Check className="w-3 h-3" />
                {currentIntent.pacing}
              </span>
            )}
            {currentIntent.targetPlatform !== 'general' && (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-violet-500/20 text-violet-400">
                <Check className="w-3 h-3" />
                {currentIntent.targetPlatform}
              </span>
            )}
            {currentIntent.zoomEffects && (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-blue-500/20 text-blue-400">
                <Check className="w-3 h-3" />
                zoom
              </span>
            )}
            {currentIntent.musicMood && (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-amber-500/20 text-amber-400">
                <Check className="w-3 h-3" />
                {currentIntent.musicMood} music
              </span>
            )}
          </div>
        </div>
      ) : null}

      {/* Input */}
      <div className="p-4 border-t border-sz-border">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Describe how you want it edited..."
            className="flex-1 px-4 py-2.5 rounded-xl bg-sz-bg-tertiary border border-sz-border text-sz-text text-sm placeholder:text-sz-text-muted focus:outline-none focus:border-sz-accent"
            disabled={isProcessing}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isProcessing}
            className="px-4 py-2.5 rounded-xl bg-sz-accent text-white hover:bg-sz-accent-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default memo(EditingChatbot);
