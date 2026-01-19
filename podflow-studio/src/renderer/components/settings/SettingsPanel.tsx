import { memo, useState } from 'react';
import { Settings, ChevronDown, ChevronUp, Sparkles, Key, Info } from 'lucide-react';
import { useStore } from '../../stores/store';
import { estimateAiCost, formatCost } from '../../types';
import { Card, CardContent, Toggle } from '../ui';
import SliderInput from './SliderInput';
import NumberRangeInput from './NumberRangeInput';

function SettingsPanel() {
  const { settings, updateSettings, project } = useStore();
  const [isExpanded, setIsExpanded] = useState(true);
  const [showApiKeyInput, setShowApiKeyInput] = useState(false);
  const costEstimate = project ? estimateAiCost(project.duration, settings.targetCount) : null;

  return (
    <Card noPadding className="border-sz-border">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-sz-bg-hover transition-colors rounded-t-sz-lg"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-sz bg-sz-accent-muted flex items-center justify-center">
            <Settings className="w-4 h-4 text-sz-accent" />
          </div>
          <span className="font-medium text-sz-text text-sm">Detection Settings</span>
        </div>
        {isExpanded ? (
          <ChevronUp className="w-4 h-4 text-sz-text-muted" />
        ) : (
          <ChevronDown className="w-4 h-4 text-sz-text-muted" />
        )}
      </button>

      {/* Content */}
      {isExpanded && (
        <CardContent className="space-y-5 border-t border-sz-border">
          {/* Target clip count */}
          <SliderInput
            label="Target Clips"
            value={settings.targetCount}
            onChange={(value) => updateSettings({ targetCount: value })}
            min={5}
            max={25}
          />

          {/* Clip duration range */}
          <NumberRangeInput
            label="Clip Duration (seconds)"
            minValue={settings.minDuration}
            maxValue={settings.maxDuration}
            onMinChange={(value) => updateSettings({ minDuration: value })}
            onMaxChange={(value) => updateSettings({ maxDuration: value })}
            minLimit={10}
            maxLimit={180}
          />

          {/* Skip intro/outro */}
          <NumberRangeInput
            label="Skip Intro/Outro (seconds)"
            minValue={settings.skipIntro}
            maxValue={settings.skipOutro}
            onMinChange={(value) => updateSettings({ skipIntro: value })}
            onMaxChange={(value) => updateSettings({ skipOutro: value })}
            minLimit={0}
            maxLimit={300}
            minLabel="Intro"
            maxLabel="Outro"
          />

          {/* AI Enhancement Toggle */}
          <div className="pt-4 border-t border-sz-border">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-sz bg-purple-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Sparkles className="w-4 h-4 text-purple-400" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-sz-text">AI Enhancement</label>
                  <Toggle
                    checked={settings.useAiEnhancement}
                    onChange={(e) => updateSettings({ useAiEnhancement: e.target.checked })}
                    size="sm"
                  />
                </div>
                <p className="text-xs text-sz-text-muted mt-1">
                  {costEstimate
                    ? `Generate titles, validate quality • Est. ${formatCost(costEstimate.total)}`
                    : 'Generate titles, validate quality'}
                </p>

                {/* API Key Input */}
                {settings.useAiEnhancement && (
                  <div className="mt-3">
                    {!showApiKeyInput ? (
                      <button
                        onClick={() => setShowApiKeyInput(true)}
                        className="flex items-center gap-1.5 text-xs text-sz-text-secondary hover:text-sz-accent transition-colors"
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
                          className="w-full px-3 py-2 bg-sz-bg rounded-sz text-sz-text text-sm border border-sz-border focus:border-sz-accent focus:outline-none focus:ring-1 focus:ring-sz-accent/30"
                        />
                        <p className="text-[10px] text-sz-text-muted flex items-center gap-1">
                          <Info className="w-3 h-3" />
                          Get your key at platform.openai.com
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
}

export default memo(SettingsPanel);
