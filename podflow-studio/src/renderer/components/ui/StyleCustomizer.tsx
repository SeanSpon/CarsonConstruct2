/**
 * StyleCustomizer - Advanced style customization panel
 */
import React, { useState, useEffect } from 'react';

interface CustomizationSettings {
  cuts_per_minute: number;
  caption_fontsize: number;
  caption_color: string;
  effect_intensity: number;
  min_duration: number;
  max_duration: number;
}

interface StyleCustomizerProps {
  baseStyle: string;
  onSave: (settings: CustomizationSettings) => void;
  onCancel: () => void;
}

export const StyleCustomizer: React.FC<StyleCustomizerProps> = ({
  baseStyle,
  onSave,
  onCancel
}) => {
  const [settings, setSettings] = useState<CustomizationSettings>({
    cuts_per_minute: 10,
    caption_fontsize: 65,
    caption_color: '#ffffff',
    effect_intensity: 0.08,
    min_duration: 20,
    max_duration: 60
  });
  const [styleName, setStyleName] = useState('');

  useEffect(() => {
    // Load base style settings
    loadBaseStyle();
  }, [baseStyle]);

  const loadBaseStyle = async () => {
    try {
      const styleDetails = await window.api.getStyleDetails(baseStyle);
      if (styleDetails) {
        setSettings({
          cuts_per_minute: styleDetails.cuts_per_minute || 10,
          caption_fontsize: styleDetails.caption_fontsize || 65,
          caption_color: styleDetails.caption_color || '#ffffff',
          effect_intensity: styleDetails.effect_intensity || 0.08,
          min_duration: styleDetails.min_duration || 20,
          max_duration: styleDetails.max_duration || 60
        });
        setStyleName(styleDetails.name || baseStyle);
      }
    } catch (err) {
      console.error('Failed to load base style:', err);
    }
  };

  const updateSetting = <K extends keyof CustomizationSettings>(
    key: K,
    value: CustomizationSettings[K]
  ) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <div className="bg-zinc-800 rounded-xl p-6">
      <h3 className="text-lg font-semibold text-white mb-1">
        🎛️ Customize Style
      </h3>
      <p className="text-sm text-zinc-400 mb-6">
        Based on: <span className="text-indigo-400">{styleName}</span>
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* Editing Pace */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <label className="text-sm font-medium text-zinc-300">
              Editing Pace
            </label>
            <span className="text-sm text-indigo-400">
              {settings.cuts_per_minute} cuts/min
            </span>
          </div>
          <input
            type="range"
            min="3"
            max="20"
            value={settings.cuts_per_minute}
            onChange={(e) => updateSetting('cuts_per_minute', parseInt(e.target.value))}
            className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
          />
          <div className="flex justify-between text-xs text-zinc-500">
            <span>Slow</span>
            <span>Fast</span>
          </div>
        </div>

        {/* Caption Size */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <label className="text-sm font-medium text-zinc-300">
              Caption Size
            </label>
            <span className="text-sm text-indigo-400">
              {settings.caption_fontsize}px
            </span>
          </div>
          <input
            type="range"
            min="40"
            max="100"
            value={settings.caption_fontsize}
            onChange={(e) => updateSetting('caption_fontsize', parseInt(e.target.value))}
            className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
          />
          <div className="flex justify-between text-xs text-zinc-500">
            <span>Small</span>
            <span>Large</span>
          </div>
        </div>

        {/* Caption Color */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-zinc-300">
            Caption Color
          </label>
          <div className="flex items-center gap-3 p-3 bg-zinc-900 rounded-lg">
            <input
              type="color"
              value={settings.caption_color}
              onChange={(e) => updateSetting('caption_color', e.target.value)}
              className="w-12 h-12 rounded-lg cursor-pointer border-0"
            />
            <span className="font-mono text-sm text-zinc-400 uppercase">
              {settings.caption_color}
            </span>
          </div>
        </div>

        {/* Effect Intensity */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <label className="text-sm font-medium text-zinc-300">
              Effect Intensity
            </label>
            <span className="text-sm text-indigo-400">
              {(settings.effect_intensity * 100).toFixed(0)}%
            </span>
          </div>
          <input
            type="range"
            min="0"
            max="0.20"
            step="0.01"
            value={settings.effect_intensity}
            onChange={(e) => updateSetting('effect_intensity', parseFloat(e.target.value))}
            className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
          />
          <div className="flex justify-between text-xs text-zinc-500">
            <span>Subtle</span>
            <span>Intense</span>
          </div>
        </div>

        {/* Clip Duration Range */}
        <div className="md:col-span-2 space-y-2">
          <label className="text-sm font-medium text-zinc-300">
            Clip Duration Range
          </label>
          <div className="flex items-center gap-4 p-3 bg-zinc-900 rounded-lg">
            <div className="flex items-center gap-2">
              <span className="text-xs text-zinc-500">Min</span>
              <input
                type="number"
                min="10"
                max="60"
                value={settings.min_duration}
                onChange={(e) => updateSetting('min_duration', parseInt(e.target.value) || 10)}
                className="w-20 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-center focus:outline-none focus:border-indigo-500"
              />
              <span className="text-xs text-zinc-500">sec</span>
            </div>
            
            <span className="text-zinc-500">to</span>
            
            <div className="flex items-center gap-2">
              <span className="text-xs text-zinc-500">Max</span>
              <input
                type="number"
                min="20"
                max="180"
                value={settings.max_duration}
                onChange={(e) => updateSetting('max_duration', parseInt(e.target.value) || 60)}
                className="w-20 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-center focus:outline-none focus:border-indigo-500"
              />
              <span className="text-xs text-zinc-500">sec</span>
            </div>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3 justify-end">
        <button
          onClick={onCancel}
          className="px-6 py-2 bg-zinc-700 hover:bg-zinc-600 rounded-lg text-white transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={() => onSave(settings)}
          className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-white font-medium transition-colors"
        >
          Save Custom Style
        </button>
      </div>
    </div>
  );
};

export default StyleCustomizer;
