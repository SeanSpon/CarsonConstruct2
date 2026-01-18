import { useState } from 'react';
import { Settings, ChevronDown, ChevronUp, Sparkles, Key } from 'lucide-react';
import { useStore } from '../stores/store';

export default function SettingsPanel() {
  const { settings, updateSettings } = useStore();
  const [isExpanded, setIsExpanded] = useState(true);
  const [showApiKeyInput, setShowApiKeyInput] = useState(false);

  return (
    <div className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-zinc-800/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Settings className="w-4 h-4 text-zinc-400" />
          <span className="font-medium text-zinc-200">Detection Settings</span>
        </div>
        {isExpanded ? (
          <ChevronUp className="w-4 h-4 text-zinc-500" />
        ) : (
          <ChevronDown className="w-4 h-4 text-zinc-500" />
        )}
      </button>

      {/* Content */}
      {isExpanded && (
        <div className="px-4 pb-4 space-y-5">
          {/* Target clip count */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm text-zinc-400">Target Clips</label>
              <span className="text-sm font-medium text-violet-400">{settings.targetCount}</span>
            </div>
            <input
              type="range"
              min="5"
              max="25"
              value={settings.targetCount}
              onChange={(e) => updateSettings({ targetCount: parseInt(e.target.value) })}
              className="w-full h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-violet-500"
            />
            <div className="flex justify-between text-xs text-zinc-600 mt-1">
              <span>5</span>
              <span>25</span>
            </div>
          </div>

          {/* Clip duration range */}
          <div>
            <label className="text-sm text-zinc-400 mb-2 block">Clip Duration (seconds)</label>
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <input
                  type="number"
                  min="10"
                  max="60"
                  value={settings.minDuration}
                  onChange={(e) => updateSettings({ minDuration: parseInt(e.target.value) || 15 })}
                  className="w-full px-3 py-2 bg-zinc-800 rounded-lg text-zinc-200 text-sm border border-zinc-700 focus:border-violet-500 focus:outline-none"
                />
                <span className="text-[10px] text-zinc-600 mt-1 block">Min</span>
              </div>
              <span className="text-zinc-600">–</span>
              <div className="flex-1">
                <input
                  type="number"
                  min="30"
                  max="180"
                  value={settings.maxDuration}
                  onChange={(e) => updateSettings({ maxDuration: parseInt(e.target.value) || 90 })}
                  className="w-full px-3 py-2 bg-zinc-800 rounded-lg text-zinc-200 text-sm border border-zinc-700 focus:border-violet-500 focus:outline-none"
                />
                <span className="text-[10px] text-zinc-600 mt-1 block">Max</span>
              </div>
            </div>
          </div>

          {/* Skip intro/outro */}
          <div>
            <label className="text-sm text-zinc-400 mb-2 block">Skip Intro/Outro (seconds)</label>
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <input
                  type="number"
                  min="0"
                  max="300"
                  value={settings.skipIntro}
                  onChange={(e) => updateSettings({ skipIntro: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 bg-zinc-800 rounded-lg text-zinc-200 text-sm border border-zinc-700 focus:border-violet-500 focus:outline-none"
                />
                <span className="text-[10px] text-zinc-600 mt-1 block">Intro</span>
              </div>
              <div className="flex-1">
                <input
                  type="number"
                  min="0"
                  max="300"
                  value={settings.skipOutro}
                  onChange={(e) => updateSettings({ skipOutro: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 bg-zinc-800 rounded-lg text-zinc-200 text-sm border border-zinc-700 focus:border-violet-500 focus:outline-none"
                />
                <span className="text-[10px] text-zinc-600 mt-1 block">Outro</span>
              </div>
            </div>
          </div>

          {/* AI Enhancement Toggle */}
          <div className="pt-2 border-t border-zinc-800">
            <label className="flex items-start gap-3 cursor-pointer">
              <div className="relative mt-0.5">
                <input
                  type="checkbox"
                  checked={settings.useAiEnhancement}
                  onChange={(e) => updateSettings({ useAiEnhancement: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-10 h-6 bg-zinc-700 rounded-full peer peer-checked:bg-violet-600 transition-colors"></div>
                <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-transform peer-checked:translate-x-4"></div>
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-violet-400" />
                  <span className="font-medium text-zinc-200">AI Enhancement</span>
                </div>
                <p className="text-xs text-zinc-500 mt-0.5">
                  Generate titles, validate quality (~$0.50/video)
                </p>
              </div>
            </label>

            {/* API Key Input */}
            {settings.useAiEnhancement && (
              <div className="mt-3 ml-13">
                {!showApiKeyInput ? (
                  <button
                    onClick={() => setShowApiKeyInput(true)}
                    className="flex items-center gap-2 text-xs text-zinc-400 hover:text-violet-400 transition-colors"
                  >
                    <Key className="w-3 h-3" />
                    {settings.openaiApiKey ? 'Change API Key' : 'Add OpenAI API Key'}
                  </button>
                ) : (
                  <div className="space-y-2">
                    <input
                      type="password"
                      placeholder="sk-..."
                      value={settings.openaiApiKey || ''}
                      onChange={(e) => updateSettings({ openaiApiKey: e.target.value })}
                      className="w-full px-3 py-2 bg-zinc-800 rounded-lg text-zinc-200 text-sm border border-zinc-700 focus:border-violet-500 focus:outline-none"
                    />
                    <p className="text-[10px] text-zinc-600">
                      Get your key at platform.openai.com
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
