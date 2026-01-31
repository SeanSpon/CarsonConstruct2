import { useState } from 'react';

export type ClipMood = 'all' | 'impactful' | 'funny' | 'serious' | 'somber' | 'energetic' | 'revealing';

interface ClipTypeSelectorProps {
  selectedMood: ClipMood;
  onMoodChange: (mood: ClipMood) => void;
}

const MOOD_OPTIONS: Array<{ value: ClipMood; label: string; emoji: string; description: string }> = [
  { value: 'all', label: 'All Clips', emoji: '🎬', description: 'Show all detected clips' },
  { value: 'impactful', label: 'Impactful', emoji: '💥', description: 'High energy, bold moments' },
  { value: 'funny', label: 'Funny', emoji: '😂', description: 'Comedic, laughter-filled' },
  { value: 'serious', label: 'Serious', emoji: '🎯', description: 'Important, focused topics' },
  { value: 'somber', label: 'Somber', emoji: '🌙', description: 'Reflective, contemplative' },
  { value: 'energetic', label: 'Energetic', emoji: '⚡', description: 'Fast-paced, high intensity' },
  { value: 'revealing', label: 'Revealing', emoji: '💡', description: 'Insights, payoffs, reveals' },
];

export function ClipTypeSelector({ selectedMood, onMoodChange }: ClipTypeSelectorProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const selectedOption = MOOD_OPTIONS.find(opt => opt.value === selectedMood) || MOOD_OPTIONS[0];

  return (
    <div className="relative">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-2 px-4 py-2 bg-sz-bg-secondary border border-sz-border rounded-lg hover:bg-sz-bg-tertiary transition-colors"
      >
        <span className="text-xl">{selectedOption.emoji}</span>
        <span className="font-medium">{selectedOption.label}</span>
        <svg
          className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isExpanded && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsExpanded(false)}
          />
          <div className="absolute top-full mt-2 w-72 bg-sz-bg-secondary border border-sz-border rounded-lg shadow-lg z-20 overflow-hidden">
            {MOOD_OPTIONS.map((option) => (
              <button
                key={option.value}
                onClick={() => {
                  onMoodChange(option.value);
                  setIsExpanded(false);
                }}
                className={`w-full px-4 py-3 flex items-start gap-3 hover:bg-sz-bg-tertiary transition-colors ${
                  selectedMood === option.value ? 'bg-sz-bg-tertiary' : ''
                }`}
              >
                <span className="text-2xl">{option.emoji}</span>
                <div className="flex-1 text-left">
                  <div className="font-medium">{option.label}</div>
                  <div className="text-sm text-sz-text-muted">{option.description}</div>
                </div>
                {selectedMood === option.value && (
                  <svg className="w-5 h-5 text-sz-accent" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
