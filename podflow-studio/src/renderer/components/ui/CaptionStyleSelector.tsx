import { useState } from 'react';

export type CaptionStyle = 'viral' | 'minimal' | 'bold';

interface CaptionStyleSelectorProps {
  selectedStyle: CaptionStyle;
  onStyleChange: (style: CaptionStyle) => void;
}

const STYLE_OPTIONS: Array<{ value: CaptionStyle; label: string; description: string; preview: string }> = [
  { 
    value: 'viral', 
    label: 'Viral', 
    description: 'Eye-catching, bold captions with thick outlines',
    preview: 'BIG & BOLD'
  },
  { 
    value: 'minimal', 
    label: 'Minimal', 
    description: 'Clean, subtle captions for professional content',
    preview: 'Clean & Simple'
  },
  { 
    value: 'bold', 
    label: 'Bold', 
    description: 'Extra thick outlines for maximum readability',
    preview: 'SUPER BOLD'
  },
];

export function CaptionStyleSelector({ selectedStyle, onStyleChange }: CaptionStyleSelectorProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const selectedOption = STYLE_OPTIONS.find(opt => opt.value === selectedStyle) || STYLE_OPTIONS[0];

  return (
    <div className="relative">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-2 px-4 py-2 bg-sz-bg-secondary border border-sz-border rounded-lg hover:bg-sz-bg-tertiary transition-colors"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
        </svg>
        <span className="font-medium">{selectedOption.label} Captions</span>
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
          <div className="absolute top-full mt-2 w-80 bg-sz-bg-secondary border border-sz-border rounded-lg shadow-lg z-20 overflow-hidden">
            {STYLE_OPTIONS.map((option) => (
              <button
                key={option.value}
                onClick={() => {
                  onStyleChange(option.value);
                  setIsExpanded(false);
                }}
                className={`w-full px-4 py-3 flex items-start gap-3 hover:bg-sz-bg-tertiary transition-colors ${
                  selectedStyle === option.value ? 'bg-sz-bg-tertiary border-l-4 border-sz-accent' : ''
                }`}
              >
                <div className="flex-1 text-left">
                  <div className="font-medium">{option.label}</div>
                  <div className="text-sm text-sz-text-muted mt-1">{option.description}</div>
                  <div className={`mt-2 px-2 py-1 rounded text-xs inline-block ${
                    option.value === 'viral' ? 'bg-black text-white font-black border-2 border-white' :
                    option.value === 'minimal' ? 'bg-white text-black font-normal' :
                    'bg-black text-white font-black border-4 border-white'
                  }`}>
                    {option.preview}
                  </div>
                </div>
                {selectedStyle === option.value && (
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
