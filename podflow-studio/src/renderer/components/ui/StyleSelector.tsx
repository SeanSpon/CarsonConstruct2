/**
 * StyleSelector - Visual style preset selector
 */
import React, { useState, useEffect } from 'react';

interface StylePreset {
  id: string;
  name: string;
  description: string;
  emoji: string;
}

interface StyleSelectorProps {
  selectedStyle: string;
  onSelect: (styleId: string) => void;
  compact?: boolean;
}

export const StyleSelector: React.FC<StyleSelectorProps> = ({
  selectedStyle,
  onSelect,
  compact = false
}) => {
  const [presets, setPresets] = useState<StylePreset[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCustomize, setShowCustomize] = useState(false);

  useEffect(() => {
    loadPresets();
  }, []);

  const loadPresets = async () => {
    setLoading(true);
    try {
      const presetList = await window.api.getStylePresets();
      setPresets(presetList || []);
    } catch (err) {
      console.error('Failed to load style presets:', err);
      // Fallback to hardcoded presets
      setPresets([
        { id: 'viral_fast', name: 'Viral Fast', description: 'High energy, rapid cuts', emoji: '⚡' },
        { id: 'storytelling', name: 'Storytelling', description: 'Slower pace, narrative flow', emoji: '📖' },
        { id: 'educational', name: 'Educational', description: 'Clear, professional', emoji: '🎓' },
        { id: 'raw_authentic', name: 'Raw & Authentic', description: 'Minimal editing', emoji: '🎥' },
        { id: 'hype', name: 'Hype', description: 'Maximum energy', emoji: '🔥' },
        { id: 'minimal_clean', name: 'Minimal Clean', description: 'Subtle, elegant', emoji: '✨' },
      ]);
    }
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8 text-zinc-400">
        <span className="animate-pulse">Loading styles...</span>
      </div>
    );
  }

  if (compact) {
    return (
      <div className="flex flex-wrap gap-2">
        {presets.map((preset) => (
          <button
            key={preset.id}
            onClick={() => onSelect(preset.id)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all ${
              selectedStyle === preset.id
                ? 'bg-indigo-600 text-white ring-2 ring-indigo-400 ring-offset-2 ring-offset-zinc-900'
                : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-white'
            }`}
          >
            <span className="text-lg">{preset.emoji}</span>
            <span className="font-medium">{preset.name}</span>
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="p-6 bg-zinc-900/50 rounded-xl border border-zinc-800">
      {/* Header */}
      <div className="text-center mb-6">
        <h3 className="text-lg font-semibold text-white mb-1">
          🎨 Choose Your Style
        </h3>
        <p className="text-sm text-zinc-400">
          Pick a pre-made style or customize your own
        </p>
      </div>

      {/* Presets Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
        {presets.map((preset) => (
          <button
            key={preset.id}
            onClick={() => onSelect(preset.id)}
            className={`relative p-4 rounded-xl text-center transition-all ${
              selectedStyle === preset.id
                ? 'bg-gradient-to-br from-indigo-600/30 to-purple-600/30 border-2 border-indigo-500 shadow-lg shadow-indigo-500/20'
                : 'bg-zinc-800/50 border-2 border-transparent hover:border-zinc-600 hover:bg-zinc-800'
            }`}
          >
            {/* Selected Badge */}
            {selectedStyle === preset.id && (
              <div className="absolute top-2 right-2 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                <span className="text-xs font-bold text-white">✓</span>
              </div>
            )}
            
            {/* Emoji */}
            <div className="text-4xl mb-2">{preset.emoji}</div>
            
            {/* Name */}
            <h4 className={`font-medium mb-1 ${
              selectedStyle === preset.id ? 'text-white' : 'text-zinc-200'
            }`}>
              {preset.name}
            </h4>
            
            {/* Description */}
            <p className={`text-xs ${
              selectedStyle === preset.id ? 'text-indigo-200' : 'text-zinc-400'
            }`}>
              {preset.description}
            </p>
          </button>
        ))}
      </div>

      {/* Advanced Customization Button */}
      <button
        onClick={() => setShowCustomize(!showCustomize)}
        className="w-full py-3 px-4 border-2 border-dashed border-indigo-500/50 rounded-xl text-indigo-400 hover:border-indigo-500 hover:text-indigo-300 hover:bg-indigo-500/10 transition-all"
      >
        ⚙️ Advanced Customization
      </button>

      {/* Customization Panel (placeholder) */}
      {showCustomize && (
        <div className="mt-4 p-4 bg-zinc-800/50 rounded-xl text-center text-zinc-400">
          <p className="mb-2">Advanced customization coming soon...</p>
          <p className="text-sm">For now, pick a preset that&apos;s closest to what you want!</p>
        </div>
      )}
    </div>
  );
};

export default StyleSelector;
