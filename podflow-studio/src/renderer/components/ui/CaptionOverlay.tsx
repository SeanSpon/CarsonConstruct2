import { useEffect, useState } from 'react';
import type { Transcript } from '../../types';

interface CaptionOverlayProps {
  transcript: Transcript | null;
  currentTime: number;
  clipStart: number;
  clipEnd: number;
  captionStyle: 'viral' | 'minimal' | 'bold';
  show: boolean;
}

export function CaptionOverlay({
  transcript,
  currentTime,
  captionStyle,
  show,
}: CaptionOverlayProps) {
  const [displayText, setDisplayText] = useState<string>('');

  useEffect(() => {
    if (!show || !transcript || !transcript.segments) {
      setDisplayText('');
      return;
    }

    // Find the segment that contains the current time
    const segment = transcript.segments.find(
      (seg) => seg.start <= currentTime && seg.end >= currentTime
    );

    if (!segment) {
      setDisplayText('');
      return;
    }

    // For viral style with word-level timing, highlight current word
    if (captionStyle === 'viral' && transcript.words) {
      const currentWord = transcript.words.find(
        (w) => w.start <= currentTime && w.end >= currentTime
      );
      
      if (currentWord) {
        // Get words in the current segment
        const segmentWords = transcript.words.filter(
          (w) => w.start >= segment.start && w.end <= segment.end
        );
        
        // Build text with highlighted current word
        const text = segmentWords.map((w) => {
          if (w.word === currentWord.word && Math.abs(w.start - currentWord.start) < 0.1) {
            return `<span class="caption-highlight">${w.word}</span>`;
          }
          return w.word;
        }).join(' ');
        
        setDisplayText(text);
        return;
      }
    }

    // For other styles or fallback, just show the segment text
    setDisplayText(segment.text || '');
  }, [show, transcript, currentTime, captionStyle]);

  if (!show || !displayText) {
    return null;
  }

  // Style classes based on caption style
  const styleClasses = {
    viral: 'caption-viral',
    minimal: 'caption-minimal',
    bold: 'caption-bold',
  }[captionStyle];

  return (
    <div className={`caption-overlay ${styleClasses}`}>
      <div
        className="caption-text"
        dangerouslySetInnerHTML={{ __html: displayText }}
      />
    </div>
  );
}
