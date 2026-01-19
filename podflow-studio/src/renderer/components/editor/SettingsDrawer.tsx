import { memo, useCallback } from 'react';
import { X, Sliders, Brain, Download, Palette } from 'lucide-react';
import { useStore } from '../../stores/store';
import { Button, Toggle, Input } from '../ui';
import { SliderInput, NumberRangeInput } from '../settings';

interface SettingsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

function SettingsDrawer({ isOpen, onClose }: SettingsDrawerProps) {
  const { settings, exportSettings, updateSettings, updateExportSettings } = useStore();

  const handleTargetCountChange = useCallback((value: number) => {
    updateSettings({ targetCount: value });
  }, [updateSettings]);

  const handleMinDurationChange = useCallback((value: number) => {
    updateSettings({ minDuration: value });
  }, [updateSettings]);

  const handleMaxDurationChange = useCallback((value: number) => {
    updateSettings({ maxDuration: value });
  }, [updateSettings]);

  const handleSkipIntroChange = useCallback((value: number) => {
    updateSettings({ skipIntro: value });
  }, [updateSettings]);

  const handleSkipOutroChange = useCallback((value: number) => {
    updateSettings({ skipOutro: value });
  }, [updateSettings]);

  const handleAiToggle = useCallback((enabled: boolean) => {
    updateSettings({ useAiEnhancement: enabled });
  }, [updateSettings]);

  const handleApiKeyChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    updateSettings({ openaiApiKey: e.target.value });
  }, [updateSettings]);

  const handleFormatChange = useCallback((format: 'mp4' | 'mov') => {
    updateExportSettings({ format });
  }, [updateExportSettings]);

  const handleModeChange = useCallback((mode: 'fast' | 'accurate') => {
    updateExportSettings({ mode });
  }, [updateExportSettings]);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed top-0 right-0 bottom-0 w-80 bg-sz-bg-secondary border-l border-sz-border z-50 flex flex-col animate-sz-slide-in-right">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-sz-border">
          <h2 className="text-lg font-semibold text-sz-text">Settings</h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {/* Detection Settings */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <Sliders className="w-4 h-4 text-sz-accent" />
              <h3 className="text-sm font-medium text-sz-text">Detection</h3>
            </div>

            <div className="space-y-4">
              <SliderInput
                label="Target Clips"
                value={settings.targetCount}
                min={5}
                max={30}
                step={1}
                onChange={handleTargetCountChange}
              />

              <NumberRangeInput
                label="Duration Range (seconds)"
                minValue={settings.minDuration}
                maxValue={settings.maxDuration}
                minLimit={5}
                maxLimit={180}
                onMinChange={handleMinDurationChange}
                onMaxChange={handleMaxDurationChange}
              />

              <SliderInput
                label="Skip Intro (seconds)"
                value={settings.skipIntro}
                min={0}
                max={300}
                step={10}
                onChange={handleSkipIntroChange}
              />

              <SliderInput
                label="Skip Outro (seconds)"
                value={settings.skipOutro}
                min={0}
                max={300}
                step={10}
                onChange={handleSkipOutroChange}
              />
            </div>
          </section>

          {/* AI Enhancement */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <Brain className="w-4 h-4 text-sz-accent" />
              <h3 className="text-sm font-medium text-sz-text">AI Enhancement</h3>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-sz-text">Enable AI Analysis</p>
                  <p className="text-xs text-sz-text-muted">
                    Get titles, hooks, and quality scores
                  </p>
                </div>
                <Toggle
                  checked={settings.useAiEnhancement}
                  onChange={handleAiToggle}
                />
              </div>

              {settings.useAiEnhancement && (
                <div>
                  <label className="block text-xs text-sz-text-secondary mb-1.5">
                    OpenAI API Key
                  </label>
                  <input
                    type="password"
                    value={settings.openaiApiKey || ''}
                    onChange={handleApiKeyChange}
                    placeholder="sk-..."
                    className="input text-sm"
                  />
                  <p className="text-[10px] text-sz-text-muted mt-1">
                    Required for AI features. Costs ~$0.01/minute of video.
                  </p>
                </div>
              )}
            </div>
          </section>

          {/* Export Settings */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <Download className="w-4 h-4 text-sz-accent" />
              <h3 className="text-sm font-medium text-sz-text">Export</h3>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs text-sz-text-secondary mb-2">
                  Format
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleFormatChange('mp4')}
                    className={`
                      flex-1 py-2 px-3 rounded-sz text-sm font-medium transition-colors
                      ${exportSettings.format === 'mp4'
                        ? 'bg-sz-accent text-sz-bg'
                        : 'bg-sz-bg-tertiary text-sz-text-secondary hover:text-sz-text'
                      }
                    `}
                  >
                    MP4
                  </button>
                  <button
                    onClick={() => handleFormatChange('mov')}
                    className={`
                      flex-1 py-2 px-3 rounded-sz text-sm font-medium transition-colors
                      ${exportSettings.format === 'mov'
                        ? 'bg-sz-accent text-sz-bg'
                        : 'bg-sz-bg-tertiary text-sz-text-secondary hover:text-sz-text'
                      }
                    `}
                  >
                    MOV
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs text-sz-text-secondary mb-2">
                  Quality
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleModeChange('fast')}
                    className={`
                      flex-1 py-2 px-3 rounded-sz text-sm transition-colors
                      ${exportSettings.mode === 'fast'
                        ? 'bg-sz-accent text-sz-bg'
                        : 'bg-sz-bg-tertiary text-sz-text-secondary hover:text-sz-text'
                      }
                    `}
                  >
                    <span className="font-medium">Fast</span>
                    <span className="block text-[10px] opacity-70">Stream copy</span>
                  </button>
                  <button
                    onClick={() => handleModeChange('accurate')}
                    className={`
                      flex-1 py-2 px-3 rounded-sz text-sm transition-colors
                      ${exportSettings.mode === 'accurate'
                        ? 'bg-sz-accent text-sz-bg'
                        : 'bg-sz-bg-tertiary text-sz-text-secondary hover:text-sz-text'
                      }
                    `}
                  >
                    <span className="font-medium">Accurate</span>
                    <span className="block text-[10px] opacity-70">Re-encode</span>
                  </button>
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-sz-border">
          <p className="text-[10px] text-sz-text-muted text-center">
            SeeZee Clip Studios v1.0.0
          </p>
        </div>
      </div>
    </>
  );
}

export default memo(SettingsDrawer);
