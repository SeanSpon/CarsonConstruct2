import { useState } from 'react';
import { useStore } from '../../stores/store';

interface SettingsModalProps {
  onClose: () => void;
}

export function SettingsModal({ onClose }: SettingsModalProps) {
  const openaiApiKey = useStore((state) => state.openaiApiKey);
  const setOpenaiApiKey = useStore((state) => state.setOpenaiApiKey);
  const [apiKey, setApiKey] = useState(openaiApiKey || '');
  const [showKey, setShowKey] = useState(false);
  const [saved, setSaved] = useState(false);

  const maskApiKey = (key: string) => {
    if (key.length <= 8) return key;
    const start = key.substring(0, 4);
    const end = key.substring(key.length - 4);
    return `${start}...${end}`;
  };

  const handleSave = () => {
    setOpenaiApiKey(apiKey.trim() || null);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-sz-bg text-sz-text rounded-2xl border border-sz-border shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-sz-border bg-sz-bg-secondary">
          <h3 className="text-lg font-bold">⚙️ Settings</h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-sz-bg-tertiary rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
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
                For AI-generated clip titles & hooks, plus Whisper transcription for captions. Get your key from{' '}
                <a
                  href="https://platform.openai.com/api-keys"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sz-accent hover:underline"
                >
                  platform.openai.com
                </a>
              </p>
              <div className="relative">
                <input
                  type={showKey ? 'text' : 'password'}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="sk-..."
                  className="w-full px-4 py-3 bg-sz-bg-secondary border border-sz-border rounded-lg focus:outline-none focus:ring-2 focus:ring-sz-accent pr-20"
                />
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1 text-xs bg-sz-bg-tertiary hover:bg-sz-bg border border-sz-border rounded transition-colors"
                >
                  {showKey ? '🙈' : '👁️'}
                </button>
              </div>
            </div>

            {/* Show masked key if saved */}
            {openaiApiKey && (
              <div className="text-xs text-sz-text-muted">
                Current: <code className="bg-sz-bg-secondary px-2 py-1 rounded">{maskApiKey(openaiApiKey)}</code>
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
