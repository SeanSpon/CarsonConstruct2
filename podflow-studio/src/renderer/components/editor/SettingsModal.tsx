import { memo, useState, useEffect } from 'react';
import { X, Key, Zap, Save, Clock, Film } from 'lucide-react';
import { useStore } from '../../stores/store';
import { Button, Input, Toggle } from '../ui';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const { settings, updateSettings } = useStore();
  
  // Detection settings
  const [apiKey, setApiKey] = useState(settings.openaiApiKey || '');
  const [useAi, setUseAi] = useState(settings.useAiEnhancement);
  const [targetCount, setTargetCount] = useState(settings.targetCount);
  const [minDuration, setMinDuration] = useState(settings.minDuration);
  const [maxDuration, setMaxDuration] = useState(settings.maxDuration);
  const [skipIntro, setSkipIntro] = useState(settings.skipIntro);
  const [skipOutro, setSkipOutro] = useState(settings.skipOutro);

  useEffect(() => {
    if (isOpen) {
      setApiKey(settings.openaiApiKey || '');
      setUseAi(settings.useAiEnhancement);
      setTargetCount(settings.targetCount);
      setMinDuration(settings.minDuration);
      setMaxDuration(settings.maxDuration);
      setSkipIntro(settings.skipIntro);
      setSkipOutro(settings.skipOutro);
    }
  }, [isOpen, settings]);

  const handleSave = () => {
    updateSettings({
      useAiEnhancement: useAi,
      targetCount,
      minDuration,
      maxDuration,
      skipIntro,
      skipOutro,
      openaiApiKey: apiKey || undefined,
    });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-md mx-4 bg-sz-bg rounded-lg shadow-2xl border border-sz-border">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-sz-border">
          <h2 className="text-base font-semibold text-sz-text">Settings</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-sz-bg-hover rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-sz-text-muted" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-5">
          {/* AI Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-medium text-sz-text">
              <Zap className="w-4 h-4 text-sz-accent" />
              AI Enhancement
            </div>
            
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-sz-text">Enable AI Analysis</p>
                <p className="text-xs text-sz-text-muted">Uses Whisper for transcription</p>
              </div>
              <Toggle checked={useAi} onChange={setUseAi} />
            </div>

            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm text-sz-text">
                <Key className="w-4 h-4 text-sz-text-muted" />
                OpenAI API Key
              </label>
              <Input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk-..."
                className="font-mono text-sm"
              />
              <p className="text-xs text-sz-text-muted">
                Required for transcription & captions. Get one at{' '}
                <a 
                  href="https://platform.openai.com/api-keys" 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="text-sz-accent hover:underline"
                >
                  platform.openai.com/api-keys
                </a>
              </p>
            </div>
          </div>

          {/* Detection Settings */}
          <div className="space-y-4 pt-4 border-t border-sz-border">
            <div className="flex items-center gap-2 text-sm font-medium text-sz-text">
              <Film className="w-4 h-4 text-violet-400" />
              Detection Settings
            </div>
            
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="text-xs text-sz-text-muted">Target Clips</label>
                <Input
                  type="number"
                  value={targetCount}
                  onChange={(e) => setTargetCount(Number(e.target.value))}
                  min={1}
                  max={50}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-sz-text-muted">Min Duration</label>
                <Input
                  type="number"
                  value={minDuration}
                  onChange={(e) => setMinDuration(Number(e.target.value))}
                  min={8}
                  max={120}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-sz-text-muted">Max Duration</label>
                <Input
                  type="number"
                  value={maxDuration}
                  onChange={(e) => setMaxDuration(Number(e.target.value))}
                  min={30}
                  max={300}
                />
              </div>
            </div>
          </div>

          {/* Skip Settings */}
          <div className="space-y-4 pt-4 border-t border-sz-border">
            <div className="flex items-center gap-2 text-sm font-medium text-sz-text">
              <Clock className="w-4 h-4 text-yellow-400" />
              Skip Intro/Outro
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs text-sz-text-muted">Skip Intro (seconds)</label>
                <Input
                  type="number"
                  value={skipIntro}
                  onChange={(e) => setSkipIntro(Number(e.target.value))}
                  min={0}
                  max={300}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-sz-text-muted">Skip Outro (seconds)</label>
                <Input
                  type="number"
                  value={skipOutro}
                  onChange={(e) => setSkipOutro(Number(e.target.value))}
                  min={0}
                  max={300}
                />
              </div>
            </div>
            <p className="text-xs text-sz-text-muted">
              Skip the first and last N seconds when detecting clips
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-5 py-4 border-t border-sz-border">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSave} leftIcon={<Save className="w-4 h-4" />}>
            Save
          </Button>
        </div>
      </div>
    </div>
  );
}

export default memo(SettingsModal);
