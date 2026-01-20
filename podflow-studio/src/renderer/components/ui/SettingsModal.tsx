import { useState } from 'react';
import { useStore } from '../../stores/store';

interface SettingsModalProps {
  onClose: () => void;
}

export function SettingsModal({ onClose }: SettingsModalProps) {
  const settings = useStore((state) => state.settings);
  const [apiKey, setApiKey] = useState(settings.openaiApiKey || '');
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    useStore.setState({
      settings: {
        ...settings,
        openaiApiKey: apiKey,
      },
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-sz-bg text-sz-text rounded-2xl border border-sz-border shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-sz-border bg-sz-bg-secondary">
          <h3 className="text-lg font-semibold">Settings</h3>
          <button
            onClick={onClose}
            className="px-3 py-2 rounded-lg bg-sz-bg-tertiary hover:bg-sz-bg"
          >
            Close
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* OpenAI API Key */}
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-semibold mb-2">
                OpenAI API Key
              </label>
              <p className="text-xs text-sz-text-muted mb-3">
                For Whisper transcription to enable captions on exported clips. Get your key from{' '}
                <a
                  href="https://platform.openai.com/api-keys"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sz-accent hover:underline"
                >
                  platform.openai.com
                </a>
              </p>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk-proj-..."
                className="w-full px-4 py-2 bg-sz-bg-secondary border border-sz-border rounded-lg text-sz-text placeholder-sz-text-muted focus:outline-none focus:border-sz-accent"
              />
            </div>

            {/* Show masked key if saved */}
            {settings.openaiApiKey && (
              <div className="text-xs text-sz-text-muted bg-sz-bg-secondary px-3 py-2 rounded">
                Current: {settings.openaiApiKey.substring(0, 10)}...
                {settings.openaiApiKey.substring(settings.openaiApiKey.length - 5)}
              </div>
            )}
          </div>

          {/* Save Button */}
          <button
            onClick={handleSave}
            className={`w-full px-4 py-3 rounded-lg font-semibold transition-colors ${
              saved
                ? 'bg-green-600 text-white'
                : 'bg-sz-accent hover:bg-sz-accent-hover text-white'
            }`}
          >
            {saved ? '✓ Saved' : 'Save Settings'}
          </button>

          {/* Info */}
          <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 text-sm space-y-2">
            <p className="font-semibold">ℹ️ How Captions Work</p>
            <ul className="text-xs text-sz-text-muted space-y-1 list-disc list-inside">
              <li>Add your OpenAI API key above</li>
              <li>Re-run detection on a new video</li>
              <li>Captions will be generated automatically</li>
              <li>Exported clips will include burned-in captions</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
