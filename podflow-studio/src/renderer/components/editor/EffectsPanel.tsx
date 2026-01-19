import { memo, useState, useEffect, useMemo } from 'react';
import { 
  Sparkles, 
  Sliders, 
  Type, 
  Palette, 
  Volume2,
  Video,
  ChevronDown,
  ChevronRight,
  Search,
  Wand2,
  Zap,
  Captions,
  Music,
  Film,
  TrendingUp,
  Mic,
  Image as ImageIcon,
  Check,
  AlertCircle,
  X,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react';
import { IconButton, Button } from '../ui';
import type { Clip, AppliedEffect } from '../../types';
import { useStore } from '../../stores/store';

interface EffectsPanelProps {
  selectedClip: Clip | null;
  className?: string;
  onApplyAiEffect?: (effect: string, clipId: string) => void;
  onApplyEffect?: (effect: string, category: 'video' | 'audio' | 'text', clipId: string) => void;
}

function EffectsPanel({ selectedClip, className, onApplyAiEffect, onApplyEffect }: EffectsPanelProps) {
  const { addClipEffect, removeClipEffect, toggleClipEffect, updateClipEffectParams } = useStore();
  
  const [activeTab, setActiveTab] = useState<'effects' | 'properties' | 'applied'>('effects');
  const [expandedCategories, setExpandedCategories] = useState({
    ai: true,
    video: true,
    audio: true,
    text: false,
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [applyingEffect, setApplyingEffect] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Get applied effects from the selected clip
  const appliedEffects = useMemo(() => {
    if (!selectedClip?.appliedEffects) return new Set<string>();
    return new Set(selectedClip.appliedEffects.map(e => `${e.category}-${e.effectId}`));
  }, [selectedClip?.appliedEffects]);

  // Auto-hide toast after 3 seconds
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const toggleCategory = (category: keyof typeof expandedCategories) => {
    setExpandedCategories(prev => ({ ...prev, [category]: !prev[category] }));
  };

  const handleAiEffect = async (effect: string) => {
    if (!selectedClip) {
      setToast({ message: 'Select a clip first', type: 'error' });
      return;
    }
    
    setApplyingEffect(effect);
    try {
      // Call external handler if provided
      if (onApplyAiEffect) {
        await onApplyAiEffect(effect, selectedClip.id);
      }
      
      // Add to clip's applied effects in store
      const effectName = aiQuickOptions.find(o => o.id === effect)?.name || effect;
      const newEffect: AppliedEffect = {
        id: `effect_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        effectId: effect,
        category: 'ai',
        name: effectName,
        enabled: true,
        parameters: {},
      };
      addClipEffect(selectedClip.id, newEffect);
      
      setToast({ message: `${effectName} applied!`, type: 'success' });
    } catch (err) {
      console.error(`Failed to apply ${effect}:`, err);
      setToast({ message: `Failed to apply effect`, type: 'error' });
    } finally {
      setApplyingEffect(null);
    }
  };

  const handleStandardEffect = async (effectId: string, category: 'video' | 'audio' | 'text') => {
    if (!selectedClip) {
      setToast({ message: 'Select a clip first', type: 'error' });
      return;
    }
    
    const effectKey = `${category}-${effectId}`;
    setApplyingEffect(effectKey);
    
    try {
      // Check if effect is already applied
      const existingEffect = selectedClip.appliedEffects?.find(
        e => e.category === category && e.effectId === effectId
      );
      
      if (existingEffect) {
        // Remove the effect
        removeClipEffect(selectedClip.id, existingEffect.id);
        const allEffects = [...videoEffects, ...audioEffects, ...textEffects];
        const effect = allEffects.find(e => e.id === effectId);
        setToast({ message: `${effect?.name || effectId} removed`, type: 'success' });
      } else {
        // Add the effect
        if (onApplyEffect) {
          await onApplyEffect(effectId, category, selectedClip.id);
        }
        
        const allEffects = [...videoEffects, ...audioEffects, ...textEffects];
        const effect = allEffects.find(e => e.id === effectId);
        const effectName = effect?.name || effectId;
        
        const newEffect: AppliedEffect = {
          id: `effect_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          effectId,
          category,
          name: effectName,
          enabled: true,
          parameters: getDefaultParams(effectId),
        };
        addClipEffect(selectedClip.id, newEffect);
        
        setToast({ message: `${effectName} applied!`, type: 'success' });
      }
    } catch (err) {
      console.error(`Failed to apply ${effectId}:`, err);
      setToast({ message: `Failed to apply effect`, type: 'error' });
    } finally {
      setApplyingEffect(null);
    }
  };

  // Get default parameters for effects
  const getDefaultParams = (effectId: string): Record<string, number | string | boolean> => {
    switch (effectId) {
      case 'brightness-contrast':
        return { brightness: 0, contrast: 0 };
      case 'color-correction':
        return { temperature: 0, tint: 0, saturation: 100 };
      case 'blur':
        return { amount: 0 };
      case 'sharpen':
        return { amount: 50 };
      case 'noise-reduction':
        return { strength: 50 };
      case 'volume':
        return { level: 100 };
      case 'eq':
        return { bass: 0, mid: 0, treble: 0 };
      case 'noise-gate':
        return { threshold: -40, ratio: 2 };
      case 'compressor':
        return { threshold: -20, ratio: 4, attack: 10, release: 100 };
      default:
        return {};
    }
  };

  const aiQuickOptions = [
    { 
      id: 'auto-color', 
      name: 'Auto Color', 
      icon: Palette, 
      description: 'AI-powered color correction',
      category: 'video'
    },
    { 
      id: 'auto-audio', 
      name: 'Auto Audio', 
      icon: Volume2, 
      description: 'Enhance audio levels & clarity',
      category: 'audio'
    },
    { 
      id: 'auto-captions', 
      name: 'Auto Captions', 
      icon: Captions, 
      description: 'Generate captions with AI',
      category: 'text'
    },
    { 
      id: 'auto-pacing', 
      name: 'Auto Pacing', 
      icon: TrendingUp, 
      description: 'Optimize clip pacing',
      category: 'video'
    },
    { 
      id: 'auto-transitions', 
      name: 'Smart Transitions', 
      icon: Film, 
      description: 'AI-suggested transitions',
      category: 'video'
    },
    { 
      id: 'auto-broll', 
      name: 'B-Roll Suggestions', 
      icon: ImageIcon, 
      description: 'Suggest B-roll moments',
      category: 'video'
    },
    { 
      id: 'auto-music', 
      name: 'Music Match', 
      icon: Music, 
      description: 'Match music to clip mood',
      category: 'audio'
    },
    { 
      id: 'auto-enhance', 
      name: 'One-Click Enhance', 
      icon: Sparkles, 
      description: 'Apply all AI enhancements',
      category: 'all'
    },
  ];

  const videoEffects = [
    { id: 'brightness-contrast', name: 'Brightness & Contrast', icon: Sliders, description: 'Adjust brightness and contrast levels' },
    { id: 'color-correction', name: 'Color Correction', icon: Palette, description: 'Apply color grading and correction' },
    { id: 'blur', name: 'Blur', icon: Sparkles, description: 'Add blur effect to video' },
    { id: 'sharpen', name: 'Sharpen', icon: Sparkles, description: 'Sharpen video details' },
    { id: 'noise-reduction', name: 'Noise Reduction', icon: Sparkles, description: 'Reduce video noise and grain' },
  ];

  const audioEffects = [
    { id: 'volume', name: 'Volume', icon: Volume2, description: 'Adjust audio volume levels' },
    { id: 'eq', name: 'EQ', icon: Sliders, description: 'Equalize audio frequencies' },
    { id: 'noise-gate', name: 'Noise Gate', icon: Volume2, description: 'Remove background noise' },
    { id: 'compressor', name: 'Compressor', icon: Sliders, description: 'Compress dynamic range' },
  ];

  const textEffects = [
    { id: 'title', name: 'Title', icon: Type, description: 'Add title text overlay' },
    { id: 'lower-third', name: 'Lower Third', icon: Type, description: 'Add lower third graphic' },
    { id: 'caption', name: 'Caption', icon: Type, description: 'Add caption text' },
  ];

  return (
    <div className={`h-full flex flex-col bg-sz-bg-secondary border-l border-sz-border ${className} relative no-select`}>
      {/* Toast Notification */}
      {toast && (
        <div 
          className={`absolute top-2 left-2 right-2 z-50 px-3 py-2 rounded-md shadow-lg flex items-center gap-2 text-xs font-medium transition-all ${
            toast.type === 'success' 
              ? 'bg-sz-success text-white' 
              : 'bg-sz-danger text-white'
          }`}
          style={{ animation: 'toast-enter 0.2s ease-out' }}
        >
          {toast.type === 'success' ? (
            <Check className="w-3.5 h-3.5 flex-shrink-0" />
          ) : (
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
          )}
          <span>{toast.message}</span>
        </div>
      )}
      <style>{`
        @keyframes toast-enter {
          from { opacity: 0; transform: translateY(-8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
      
      {/* Header with Tabs */}
      <div className="flex-shrink-0 border-b border-sz-border">
        <div className="flex">
          <button
            onClick={() => setActiveTab('effects')}
            className={`flex-1 px-2 py-2 text-xs font-medium transition-colors ${
              activeTab === 'effects'
                ? 'bg-sz-bg border-b-2 border-sz-accent text-sz-text'
                : 'bg-sz-bg-secondary text-sz-text-secondary hover:text-sz-text'
            }`}
          >
            Effects
          </button>
          <button
            onClick={() => setActiveTab('applied')}
            className={`flex-1 px-2 py-2 text-xs font-medium transition-colors relative ${
              activeTab === 'applied'
                ? 'bg-sz-bg border-b-2 border-sz-accent text-sz-text'
                : 'bg-sz-bg-secondary text-sz-text-secondary hover:text-sz-text'
            }`}
          >
            Applied
            {selectedClip?.appliedEffects && selectedClip.appliedEffects.length > 0 && (
              <span className="ml-1 px-1 py-0.5 text-[10px] bg-sz-accent text-white rounded">
                {selectedClip.appliedEffects.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('properties')}
            className={`flex-1 px-2 py-2 text-xs font-medium transition-colors ${
              activeTab === 'properties'
                ? 'bg-sz-bg border-b-2 border-sz-accent text-sz-text'
                : 'bg-sz-bg-secondary text-sz-text-secondary hover:text-sz-text'
            }`}
          >
            Properties
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {activeTab === 'effects' ? (
          <>
            {/* Search */}
            <div className="p-2 border-b border-sz-border">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-sz-text-muted" />
                <input
                  type="text"
                  placeholder="Search effects..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-7 pr-2 py-1 text-xs bg-sz-bg border border-sz-border rounded text-sz-text placeholder-sz-text-muted focus:outline-none focus:ring-1 focus:ring-sz-accent"
                />
              </div>
            </div>

            {/* AI Quick Options */}
            <div className="px-2 py-1 border-b border-sz-border/50 bg-gradient-to-b from-sz-accent/5 to-transparent">
              <button
                onClick={() => toggleCategory('ai')}
                className="w-full flex items-center gap-1 px-2 py-1.5 text-xs font-medium text-sz-text-secondary hover:bg-sz-bg-tertiary rounded transition-colors"
              >
                {expandedCategories.ai ? (
                  <ChevronDown className="w-3 h-3" />
                ) : (
                  <ChevronRight className="w-3 h-3" />
                )}
                <Wand2 className="w-3.5 h-3.5 text-sz-accent" />
                <span className="text-sz-accent font-semibold">AI Quick Options</span>
                <span className="ml-auto text-[10px] text-sz-text-muted bg-sz-accent/20 px-1.5 py-0.5 rounded">
                  {aiQuickOptions.length}
                </span>
              </button>
              
              {expandedCategories.ai && (
                <div className="ml-6 mt-2 mb-2">
                  <div className="grid grid-cols-2 gap-1.5">
                    {aiQuickOptions.map((option) => {
                      const Icon = option.icon;
                      const isApplying = applyingEffect === option.id;
                      const isApplied = appliedEffects.has(`ai-${option.id}`);
                      const isDisabled = !selectedClip || isApplying;
                      const filtered = searchQuery 
                        ? option.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          option.description.toLowerCase().includes(searchQuery.toLowerCase())
                        : true;
                      
                      if (!filtered) return null;
                      
                      return (
                        <button
                          key={option.id}
                          onClick={() => handleAiEffect(option.id)}
                          disabled={isDisabled}
                          className={`group relative px-2 py-2 rounded border transition-all ${
                            isApplied
                              ? 'border-sz-success/50 bg-sz-success/10 hover:bg-sz-success/20'
                              : isDisabled
                                ? 'border-sz-border/30 bg-sz-bg-tertiary opacity-60 cursor-not-allowed'
                                : 'border-sz-border/50 bg-sz-bg hover:bg-sz-bg-tertiary hover:border-sz-accent/50 cursor-pointer'
                          }`}
                          title={!selectedClip ? 'Select a clip first' : isApplied ? `${option.name} applied - click to reapply` : option.description}
                        >
                          {/* Applied checkmark badge */}
                          {isApplied && !isApplying && (
                            <div className="absolute -top-1 -right-1 w-4 h-4 bg-sz-success rounded-full flex items-center justify-center">
                              <Check className="w-2.5 h-2.5 text-white" />
                            </div>
                          )}
                          <div className="flex flex-col items-center gap-1">
                            {isApplying ? (
                              <div className="w-4 h-4 border-2 border-sz-accent border-t-transparent rounded-full animate-spin" />
                            ) : (
                              <Icon className={`w-4 h-4 transition-transform ${
                                isApplied
                                  ? 'text-sz-success'
                                  : isDisabled 
                                    ? 'text-sz-text-muted' 
                                    : 'text-sz-accent group-hover:scale-110'
                              }`} />
                            )}
                            <span className={`text-[10px] text-center leading-tight ${
                              isApplied ? 'text-sz-success font-medium' : isDisabled ? 'text-sz-text-muted' : 'text-sz-text'
                            }`}>
                              {option.name}
                            </span>
                          </div>
                          {isApplying && (
                            <div className="absolute inset-0 bg-sz-accent/10 rounded flex items-center justify-center">
                              <span className="text-[8px] text-sz-accent font-medium">Applying...</span>
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                  {!selectedClip && (
                    <div className="mt-2 px-2 py-1.5 text-center text-[10px] text-sz-text-muted bg-sz-bg-tertiary/50 rounded border border-sz-border/30">
                      Select a clip from the timeline to apply effects
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Video Effects */}
            <div className="px-2 py-1">
              <button
                onClick={() => toggleCategory('video')}
                className="w-full flex items-center gap-1 px-2 py-1.5 text-xs font-medium text-sz-text-secondary hover:bg-sz-bg-tertiary rounded transition-colors"
              >
                {expandedCategories.video ? (
                  <ChevronDown className="w-3 h-3" />
                ) : (
                  <ChevronRight className="w-3 h-3" />
                )}
                <Video className="w-3.5 h-3.5" />
                <span>Video</span>
              </button>
              
              {expandedCategories.video && (
                <div className="ml-6 mt-1 space-y-0.5">
                  {videoEffects.map((effect) => {
                    const Icon = effect.icon;
                    const effectKey = `video-${effect.id}`;
                    const isApplying = applyingEffect === effectKey;
                    const isApplied = appliedEffects.has(effectKey);
                    const filtered = searchQuery 
                      ? effect.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        effect.description.toLowerCase().includes(searchQuery.toLowerCase())
                      : true;
                    
                    if (!filtered) return null;
                    
                    return (
                      <button
                        key={effect.id}
                        onClick={() => handleStandardEffect(effect.id, 'video')}
                        disabled={!selectedClip || isApplying}
                        title={!selectedClip ? 'Select a clip first' : effect.description}
                        className={`w-full px-2 py-1.5 rounded transition-all group text-left ${
                          !selectedClip 
                            ? 'opacity-50 cursor-not-allowed' 
                            : isApplied
                              ? 'bg-sz-accent/20 border border-sz-accent/50 hover:bg-sz-accent/30'
                              : 'hover:bg-sz-bg-tertiary cursor-pointer'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          {isApplying ? (
                            <div className="w-3.5 h-3.5 border-2 border-sz-accent border-t-transparent rounded-full animate-spin flex-shrink-0" />
                          ) : (
                            <Icon className={`w-3.5 h-3.5 flex-shrink-0 ${isApplied ? 'text-sz-accent' : 'text-sz-text-muted group-hover:text-sz-text'}`} />
                          )}
                          <span className={`text-xs ${isApplied ? 'text-sz-accent font-medium' : 'text-sz-text'}`}>{effect.name}</span>
                          {isApplied && (
                            <span className="ml-auto text-[10px] text-sz-accent">ON</span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Audio Effects */}
            <div className="px-2 py-1 border-t border-sz-border/50">
              <button
                onClick={() => toggleCategory('audio')}
                className="w-full flex items-center gap-1 px-2 py-1.5 text-xs font-medium text-sz-text-secondary hover:bg-sz-bg-tertiary rounded transition-colors"
              >
                {expandedCategories.audio ? (
                  <ChevronDown className="w-3 h-3" />
                ) : (
                  <ChevronRight className="w-3 h-3" />
                )}
                <Volume2 className="w-3.5 h-3.5" />
                <span>Audio</span>
              </button>
              
              {expandedCategories.audio && (
                <div className="ml-6 mt-1 space-y-0.5">
                  {audioEffects.map((effect) => {
                    const Icon = effect.icon;
                    const effectKey = `audio-${effect.id}`;
                    const isApplying = applyingEffect === effectKey;
                    const isApplied = appliedEffects.has(effectKey);
                    const filtered = searchQuery 
                      ? effect.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        effect.description.toLowerCase().includes(searchQuery.toLowerCase())
                      : true;
                    
                    if (!filtered) return null;
                    
                    return (
                      <button
                        key={effect.id}
                        onClick={() => handleStandardEffect(effect.id, 'audio')}
                        disabled={!selectedClip || isApplying}
                        title={!selectedClip ? 'Select a clip first' : effect.description}
                        className={`w-full px-2 py-1.5 rounded transition-all group text-left ${
                          !selectedClip 
                            ? 'opacity-50 cursor-not-allowed' 
                            : isApplied
                              ? 'bg-sz-accent/20 border border-sz-accent/50 hover:bg-sz-accent/30'
                              : 'hover:bg-sz-bg-tertiary cursor-pointer'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          {isApplying ? (
                            <div className="w-3.5 h-3.5 border-2 border-sz-accent border-t-transparent rounded-full animate-spin flex-shrink-0" />
                          ) : (
                            <Icon className={`w-3.5 h-3.5 flex-shrink-0 ${isApplied ? 'text-sz-accent' : 'text-sz-text-muted group-hover:text-sz-text'}`} />
                          )}
                          <span className={`text-xs ${isApplied ? 'text-sz-accent font-medium' : 'text-sz-text'}`}>{effect.name}</span>
                          {isApplied && (
                            <span className="ml-auto text-[10px] text-sz-accent">ON</span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Text Effects */}
            <div className="px-2 py-1 border-t border-sz-border/50">
              <button
                onClick={() => toggleCategory('text')}
                className="w-full flex items-center gap-1 px-2 py-1.5 text-xs font-medium text-sz-text-secondary hover:bg-sz-bg-tertiary rounded transition-colors"
              >
                {expandedCategories.text ? (
                  <ChevronDown className="w-3 h-3" />
                ) : (
                  <ChevronRight className="w-3 h-3" />
                )}
                <Type className="w-3.5 h-3.5" />
                <span>Text</span>
              </button>
              
              {expandedCategories.text && (
                <div className="ml-6 mt-1 space-y-0.5">
                  {textEffects.map((effect) => {
                    const Icon = effect.icon;
                    const effectKey = `text-${effect.id}`;
                    const isApplying = applyingEffect === effectKey;
                    const isApplied = appliedEffects.has(effectKey);
                    const filtered = searchQuery 
                      ? effect.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        effect.description.toLowerCase().includes(searchQuery.toLowerCase())
                      : true;
                    
                    if (!filtered) return null;
                    
                    return (
                      <button
                        key={effect.id}
                        onClick={() => handleStandardEffect(effect.id, 'text')}
                        disabled={!selectedClip || isApplying}
                        title={!selectedClip ? 'Select a clip first' : effect.description}
                        className={`w-full px-2 py-1.5 rounded transition-all group text-left ${
                          !selectedClip 
                            ? 'opacity-50 cursor-not-allowed' 
                            : isApplied
                              ? 'bg-sz-accent/20 border border-sz-accent/50 hover:bg-sz-accent/30'
                              : 'hover:bg-sz-bg-tertiary cursor-pointer'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          {isApplying ? (
                            <div className="w-3.5 h-3.5 border-2 border-sz-accent border-t-transparent rounded-full animate-spin flex-shrink-0" />
                          ) : (
                            <Icon className={`w-3.5 h-3.5 flex-shrink-0 ${isApplied ? 'text-sz-accent' : 'text-sz-text-muted group-hover:text-sz-text'}`} />
                          )}
                          <span className={`text-xs ${isApplied ? 'text-sz-accent font-medium' : 'text-sz-text'}`}>{effect.name}</span>
                          {isApplied && (
                            <span className="ml-auto text-[10px] text-sz-accent">ON</span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        ) : activeTab === 'applied' ? (
          /* Applied Effects Tab */
          <div className="p-3 space-y-3">
            {selectedClip ? (
              selectedClip.appliedEffects && selectedClip.appliedEffects.length > 0 ? (
                <>
                  <div className="text-xs text-sz-text-muted mb-2">
                    {selectedClip.appliedEffects.length} effect{selectedClip.appliedEffects.length !== 1 ? 's' : ''} applied
                  </div>
                  {selectedClip.appliedEffects.map((effect) => (
                    <div
                      key={effect.id}
                      className={`p-2 rounded border transition-colors ${
                        effect.enabled
                          ? 'bg-sz-bg-tertiary border-sz-border'
                          : 'bg-sz-bg border-sz-border/50 opacity-60'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => toggleClipEffect(selectedClip.id, effect.id)}
                            className="text-sz-text-secondary hover:text-sz-text transition-colors"
                            title={effect.enabled ? 'Disable effect' : 'Enable effect'}
                          >
                            {effect.enabled ? (
                              <ToggleRight className="w-4 h-4 text-sz-accent" />
                            ) : (
                              <ToggleLeft className="w-4 h-4" />
                            )}
                          </button>
                          <span className="text-xs font-medium text-sz-text">{effect.name}</span>
                          <span className={`text-[10px] px-1 py-0.5 rounded ${
                            effect.category === 'ai' ? 'bg-sz-accent/20 text-sz-accent' :
                            effect.category === 'video' ? 'bg-blue-500/20 text-blue-400' :
                            effect.category === 'audio' ? 'bg-emerald-500/20 text-emerald-400' :
                            'bg-purple-500/20 text-purple-400'
                          }`}>
                            {effect.category}
                          </span>
                        </div>
                        <button
                          onClick={() => removeClipEffect(selectedClip.id, effect.id)}
                          className="p-1 text-sz-text-muted hover:text-red-400 transition-colors rounded hover:bg-red-500/10"
                          title="Remove effect"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                      {/* Effect parameters */}
                      {effect.parameters && Object.keys(effect.parameters).length > 0 && (
                        <div className="space-y-2 mt-2 pt-2 border-t border-sz-border/50">
                          {Object.entries(effect.parameters).map(([key, value]) => (
                            <div key={key} className="flex items-center gap-2">
                              <label className="text-[10px] text-sz-text-muted capitalize w-16">{key}</label>
                              {typeof value === 'boolean' ? (
                                <button
                                  onClick={() => updateClipEffectParams(selectedClip.id, effect.id, { [key]: !value })}
                                  className={`px-2 py-0.5 text-[10px] rounded ${
                                    value ? 'bg-sz-accent text-white' : 'bg-sz-bg-tertiary text-sz-text-secondary'
                                  }`}
                                >
                                  {value ? 'On' : 'Off'}
                                </button>
                              ) : typeof value === 'number' ? (
                                <input
                                  type="range"
                                  min={key.includes('threshold') ? -60 : 0}
                                  max={key.includes('threshold') ? 0 : 100}
                                  value={value}
                                  onChange={(e) => updateClipEffectParams(selectedClip.id, effect.id, { [key]: Number(e.target.value) })}
                                  className="flex-1 h-1"
                                />
                              ) : (
                                <input
                                  type="text"
                                  value={String(value)}
                                  onChange={(e) => updateClipEffectParams(selectedClip.id, effect.id, { [key]: e.target.value })}
                                  className="flex-1 px-1 py-0.5 text-[10px] bg-sz-bg border border-sz-border rounded text-sz-text"
                                />
                              )}
                              {typeof value === 'number' && (
                                <span className="text-[10px] text-sz-text-muted w-8 text-right">{value}</span>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </>
              ) : (
                <div className="text-center py-8">
                  <Sparkles className="w-8 h-8 mx-auto mb-2 text-sz-text-muted" />
                  <p className="text-xs text-sz-text-muted">
                    No effects applied to this clip
                  </p>
                  <p className="text-[10px] text-sz-text-muted mt-1">
                    Add effects from the Effects tab
                  </p>
                </div>
              )
            ) : (
              <div className="text-center py-8">
                <p className="text-xs text-sz-text-muted">
                  Select a clip to view applied effects
                </p>
              </div>
            )}
          </div>
        ) : (
          /* Properties Tab */
          <div className="p-3 space-y-4">
            {selectedClip ? (
              <>
                {/* Clip Info */}
                <div>
                  <h3 className="text-xs font-semibold text-sz-text-secondary uppercase mb-2">
                    Clip Info
                  </h3>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-sz-text-muted">Duration:</span>
                      <span className="text-sz-text">{selectedClip.duration.toFixed(2)}s</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sz-text-muted">Start:</span>
                      <span className="text-sz-text">{selectedClip.startTime.toFixed(2)}s</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sz-text-muted">End:</span>
                      <span className="text-sz-text">{selectedClip.endTime.toFixed(2)}s</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sz-text-muted">Score:</span>
                      <span className="text-sz-text font-semibold">{Math.round(selectedClip.finalScore)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sz-text-muted">Pattern:</span>
                      <span className="text-sz-text">{selectedClip.pattern}</span>
                    </div>
                  </div>
                </div>

                {/* Motion */}
                <div>
                  <h3 className="text-xs font-semibold text-sz-text-secondary uppercase mb-2">
                    Motion
                  </h3>
                  <div className="space-y-2">
                    <div>
                      <label className="text-xs text-sz-text-muted block mb-1">Position X</label>
                      <input
                        type="number"
                        defaultValue={0}
                        className="w-full px-2 py-1 text-xs bg-sz-bg border border-sz-border rounded text-sz-text"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-sz-text-muted block mb-1">Position Y</label>
                      <input
                        type="number"
                        defaultValue={0}
                        className="w-full px-2 py-1 text-xs bg-sz-bg border border-sz-border rounded text-sz-text"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-sz-text-muted block mb-1">Scale</label>
                      <input
                        type="number"
                        defaultValue={100}
                        className="w-full px-2 py-1 text-xs bg-sz-bg border border-sz-border rounded text-sz-text"
                      />
                    </div>
                  </div>
                </div>

                {/* Opacity */}
                <div>
                  <h3 className="text-xs font-semibold text-sz-text-secondary uppercase mb-2">
                    Opacity
                  </h3>
                  <div>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      defaultValue={100}
                      className="w-full"
                    />
                    <div className="flex justify-between text-xs text-sz-text-muted mt-1">
                      <span>0%</span>
                      <span>100%</span>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="text-center py-8">
                <p className="text-xs text-sz-text-muted">
                  Select a clip to view properties
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default memo(EffectsPanel);
