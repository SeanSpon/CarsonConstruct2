import { useState } from 'react';
import { useStore } from '../../stores/store';
import type { CaptionCustomization, SFXEffect, SFXType } from '../../types';

interface CaptionSettingsPopoverProps {
  onClose: () => void;
}

const FONT_OPTIONS = [
  { value: 'Montserrat', label: 'Montserrat' },
  { value: 'Roboto', label: 'Roboto' },
  { value: 'Bebas Neue', label: 'Bebas Neue' },
  { value: 'Impact', label: 'Impact' },
  { value: 'Arial', label: 'Arial' },
] as const;

const SIZE_OPTIONS = [
  { value: 'small', label: 'Small', preview: 'Aa' },
  { value: 'medium', label: 'Medium', preview: 'Aa' },
  { value: 'large', label: 'Large', preview: 'Aa' },
  { value: 'xl', label: 'Extra Large', preview: 'Aa' },
] as const;

const WEIGHT_OPTIONS = [
  { value: 'normal', label: 'Normal' },
  { value: 'bold', label: 'Bold' },
  { value: 'black', label: 'Black' },
] as const;

const ANIMATION_OPTIONS = [
  { value: 'none', label: 'None', icon: '—' },
  { value: 'pop', label: 'Pop', icon: '💥' },
  { value: 'typewriter', label: 'Typewriter', icon: '⌨️' },
  { value: 'bounce', label: 'Bounce', icon: '🔄' },
  { value: 'glow', label: 'Glow', icon: '✨' },
] as const;

const POSITION_OPTIONS = [
  { value: 'top', label: 'Top' },
  { value: 'center', label: 'Center' },
  { value: 'bottom', label: 'Bottom' },
] as const;

const SFX_DESCRIPTIONS: Record<SFXType, { label: string; icon: string; description: string }> = {
  'zoom-pulse': { label: 'Zoom Pulse', icon: '🔍', description: 'Quick zoom effect on emphasis' },
  'shake': { label: 'Screen Shake', icon: '📳', description: 'Subtle shake for impact' },
  'flash': { label: 'Flash', icon: '⚡', description: 'Quick white flash effect' },
  'bass-boost': { label: 'Bass Boost', icon: '🔊', description: 'Audio bass enhancement' },
  'reverb-tail': { label: 'Reverb Tail', icon: '🎵', description: 'Echo/reverb effect on audio' },
  'whoosh': { label: 'Whoosh', icon: '💨', description: 'Transition swoosh sound' },
  'impact': { label: 'Impact', icon: '💥', description: 'Heavy impact sound effect' },
};

export function CaptionSettingsPopover({ onClose }: CaptionSettingsPopoverProps) {
  const captionCustomization = useStore((state) => state.captionCustomization);
  const updateCaptionCustomization = useStore((state) => state.updateCaptionCustomization);
  const [activeTab, setActiveTab] = useState<'style' | 'sfx'>('style');

  const handleColorChange = (key: keyof Pick<CaptionCustomization, 'primaryColor' | 'highlightColor' | 'outlineColor'>, value: string) => {
    updateCaptionCustomization({ [key]: value });
  };

  const handleSFXToggle = (type: SFXType) => {
    const newEffects = captionCustomization.sfxEffects.map((effect) =>
      effect.type === type ? { ...effect, enabled: !effect.enabled } : effect
    );
    updateCaptionCustomization({ sfxEffects: newEffects });
  };

  const handleSFXIntensity = (type: SFXType, intensity: number) => {
    const newEffects = captionCustomization.sfxEffects.map((effect) =>
      effect.type === type ? { ...effect, intensity } : effect
    );
    updateCaptionCustomization({ sfxEffects: newEffects });
  };

  const getEffectByType = (type: SFXType): SFXEffect => {
    return captionCustomization.sfxEffects.find((e) => e.type === type) || { type, enabled: false, intensity: 50 };
  };

  return (
    <div className="absolute top-full right-0 mt-2 w-96 bg-sz-bg-secondary border border-sz-border rounded-xl shadow-2xl z-30 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-sz-border bg-sz-bg-tertiary">
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5 text-sz-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span className="font-semibold">Caption Settings</span>
        </div>
        <button
          onClick={onClose}
          className="p-1 hover:bg-sz-bg rounded-lg transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-sz-border">
        <button
          onClick={() => setActiveTab('style')}
          className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'style'
              ? 'text-sz-accent border-b-2 border-sz-accent bg-sz-bg-tertiary/50'
              : 'text-sz-text-muted hover:text-sz-text hover:bg-sz-bg-tertiary/30'
          }`}
        >
          🎨 Style
        </button>
        <button
          onClick={() => setActiveTab('sfx')}
          className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'sfx'
              ? 'text-sz-accent border-b-2 border-sz-accent bg-sz-bg-tertiary/50'
              : 'text-sz-text-muted hover:text-sz-text hover:bg-sz-bg-tertiary/30'
          }`}
        >
          ✨ SFX Effects
        </button>
      </div>

      {/* Content */}
      <div className="max-h-[400px] overflow-y-auto p-4 space-y-4">
        {activeTab === 'style' ? (
          <>
            {/* Font Family */}
            <div className="space-y-2">
              <label className="block text-xs font-medium text-sz-text-muted uppercase tracking-wide">Font</label>
              <select
                value={captionCustomization.fontFamily}
                onChange={(e) => updateCaptionCustomization({ fontFamily: e.target.value as CaptionCustomization['fontFamily'] })}
                className="w-full px-3 py-2 bg-sz-bg border border-sz-border rounded-lg text-sm focus:ring-2 focus:ring-sz-accent focus:border-transparent"
              >
                {FONT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            {/* Font Size */}
            <div className="space-y-2">
              <label className="block text-xs font-medium text-sz-text-muted uppercase tracking-wide">Size</label>
              <div className="grid grid-cols-4 gap-2">
                {SIZE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => updateCaptionCustomization({ fontSize: opt.value })}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      captionCustomization.fontSize === opt.value
                        ? 'bg-sz-accent text-white'
                        : 'bg-sz-bg border border-sz-border hover:bg-sz-bg-tertiary'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Font Weight */}
            <div className="space-y-2">
              <label className="block text-xs font-medium text-sz-text-muted uppercase tracking-wide">Weight</label>
              <div className="grid grid-cols-3 gap-2">
                {WEIGHT_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => updateCaptionCustomization({ fontWeight: opt.value })}
                    className={`px-3 py-2 rounded-lg text-sm transition-colors ${
                      captionCustomization.fontWeight === opt.value
                        ? 'bg-sz-accent text-white'
                        : 'bg-sz-bg border border-sz-border hover:bg-sz-bg-tertiary'
                    }`}
                    style={{ fontWeight: opt.value === 'black' ? 900 : opt.value }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Colors */}
            <div className="space-y-2">
              <label className="block text-xs font-medium text-sz-text-muted uppercase tracking-wide">Colors</label>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <span className="text-xs text-sz-text-muted">Text</span>
                  <div className="relative">
                    <input
                      type="color"
                      value={captionCustomization.primaryColor}
                      onChange={(e) => handleColorChange('primaryColor', e.target.value)}
                      className="w-full h-8 rounded-lg cursor-pointer border border-sz-border"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <span className="text-xs text-sz-text-muted">Highlight</span>
                  <input
                    type="color"
                    value={captionCustomization.highlightColor}
                    onChange={(e) => handleColorChange('highlightColor', e.target.value)}
                    className="w-full h-8 rounded-lg cursor-pointer border border-sz-border"
                  />
                </div>
                <div className="space-y-1">
                  <span className="text-xs text-sz-text-muted">Outline</span>
                  <input
                    type="color"
                    value={captionCustomization.outlineColor}
                    onChange={(e) => handleColorChange('outlineColor', e.target.value)}
                    className="w-full h-8 rounded-lg cursor-pointer border border-sz-border"
                  />
                </div>
              </div>
            </div>

            {/* Outline Width */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-sz-text-muted uppercase tracking-wide">Outline Width</label>
                <span className="text-xs text-sz-text-muted">{captionCustomization.outlineWidth}px</span>
              </div>
              <input
                type="range"
                min="0"
                max="10"
                value={captionCustomization.outlineWidth}
                onChange={(e) => updateCaptionCustomization({ outlineWidth: Number(e.target.value) })}
                className="w-full h-2 bg-sz-bg rounded-lg appearance-none cursor-pointer accent-sz-accent"
              />
            </div>

            {/* Shadow Intensity */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-sz-text-muted uppercase tracking-wide">Shadow</label>
                <span className="text-xs text-sz-text-muted">{captionCustomization.shadowIntensity}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={captionCustomization.shadowIntensity}
                onChange={(e) => updateCaptionCustomization({ shadowIntensity: Number(e.target.value) })}
                className="w-full h-2 bg-sz-bg rounded-lg appearance-none cursor-pointer accent-sz-accent"
              />
            </div>

            {/* Animation */}
            <div className="space-y-2">
              <label className="block text-xs font-medium text-sz-text-muted uppercase tracking-wide">Animation</label>
              <div className="grid grid-cols-5 gap-2">
                {ANIMATION_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => updateCaptionCustomization({ animation: opt.value })}
                    className={`flex flex-col items-center gap-1 px-2 py-2 rounded-lg text-xs transition-colors ${
                      captionCustomization.animation === opt.value
                        ? 'bg-sz-accent text-white'
                        : 'bg-sz-bg border border-sz-border hover:bg-sz-bg-tertiary'
                    }`}
                    title={opt.label}
                  >
                    <span className="text-lg">{opt.icon}</span>
                    <span className="truncate w-full text-center">{opt.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Position */}
            <div className="space-y-2">
              <label className="block text-xs font-medium text-sz-text-muted uppercase tracking-wide">Position</label>
              <div className="grid grid-cols-3 gap-2">
                {POSITION_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => updateCaptionCustomization({ verticalPosition: opt.value })}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      captionCustomization.verticalPosition === opt.value
                        ? 'bg-sz-accent text-white'
                        : 'bg-sz-bg border border-sz-border hover:bg-sz-bg-tertiary'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </>
        ) : (
          <>
            {/* SFX Enable Toggle */}
            <div className="flex items-center justify-between p-3 bg-sz-bg rounded-lg border border-sz-border">
              <div>
                <span className="font-medium">Enable SFX Effects</span>
                <p className="text-xs text-sz-text-muted mt-1">
                  Add visual & audio effects to make clips more engaging
                </p>
              </div>
              <button
                onClick={() => updateCaptionCustomization({ sfxEnabled: !captionCustomization.sfxEnabled })}
                className={`relative w-12 h-6 rounded-full transition-colors ${
                  captionCustomization.sfxEnabled ? 'bg-sz-accent' : 'bg-sz-bg-tertiary'
                }`}
              >
                <div
                  className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                    captionCustomization.sfxEnabled ? 'translate-x-7' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* SFX Effects List */}
            <div className={`space-y-3 transition-opacity ${captionCustomization.sfxEnabled ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
              <p className="text-xs text-sz-text-muted">
                Toggle effects to add them during export. Adjust intensity for each effect.
              </p>
              
              {Object.entries(SFX_DESCRIPTIONS).map(([type, info]) => {
                const effect = getEffectByType(type as SFXType);
                return (
                  <div
                    key={type}
                    className={`p-3 rounded-lg border transition-colors ${
                      effect.enabled
                        ? 'bg-sz-accent/10 border-sz-accent/50'
                        : 'bg-sz-bg border-sz-border hover:border-sz-border-hover'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{info.icon}</span>
                        <div>
                          <span className="font-medium text-sm">{info.label}</span>
                          <p className="text-xs text-sz-text-muted">{info.description}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => handleSFXToggle(type as SFXType)}
                        className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                          effect.enabled
                            ? 'bg-sz-accent text-white'
                            : 'bg-sz-bg-tertiary text-sz-text-muted hover:text-sz-text'
                        }`}
                      >
                        {effect.enabled ? 'ON' : 'OFF'}
                      </button>
                    </div>
                    
                    {effect.enabled && (
                      <div className="flex items-center gap-3 mt-3">
                        <span className="text-xs text-sz-text-muted w-16">Intensity</span>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={effect.intensity}
                          onChange={(e) => handleSFXIntensity(type as SFXType, Number(e.target.value))}
                          className="flex-1 h-2 bg-sz-bg-tertiary rounded-lg appearance-none cursor-pointer accent-sz-accent"
                        />
                        <span className="text-xs text-sz-text-muted w-8 text-right">{effect.intensity}%</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Info Box */}
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 text-xs space-y-1">
              <p className="font-semibold text-yellow-400">⚠️ SFX Preview</p>
              <p className="text-sz-text-muted">
                SFX effects will be rendered into exported clips. Preview coming soon!
              </p>
            </div>
          </>
        )}
      </div>

      {/* Preview Footer */}
      <div className="border-t border-sz-border p-3 bg-sz-bg-tertiary/50">
        <div className="flex items-center justify-center">
          <div
            className="px-4 py-2 rounded-lg bg-black/80 inline-block"
            style={{
              fontFamily: captionCustomization.fontFamily,
              fontSize: captionCustomization.fontSize === 'small' ? '14px' :
                       captionCustomization.fontSize === 'medium' ? '18px' :
                       captionCustomization.fontSize === 'large' ? '22px' : '26px',
              fontWeight: captionCustomization.fontWeight === 'black' ? 900 :
                         captionCustomization.fontWeight === 'bold' ? 700 : 400,
              color: captionCustomization.primaryColor,
              textShadow: `
                -${captionCustomization.outlineWidth}px -${captionCustomization.outlineWidth}px 0 ${captionCustomization.outlineColor},
                ${captionCustomization.outlineWidth}px -${captionCustomization.outlineWidth}px 0 ${captionCustomization.outlineColor},
                -${captionCustomization.outlineWidth}px ${captionCustomization.outlineWidth}px 0 ${captionCustomization.outlineColor},
                ${captionCustomization.outlineWidth}px ${captionCustomization.outlineWidth}px 0 ${captionCustomization.outlineColor},
                0 ${captionCustomization.shadowIntensity / 10}px ${captionCustomization.shadowIntensity / 5}px rgba(0,0,0,${captionCustomization.shadowIntensity / 100})
              `,
            }}
          >
            PREVIEW <span style={{ color: captionCustomization.highlightColor }}>TEXT</span>
          </div>
        </div>
      </div>
    </div>
  );
}
