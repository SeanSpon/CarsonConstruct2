import type { Transcript } from '../types';

function normalizeWhitespace(text: string): string {
  return text
    .replace(/\s+/g, ' ')
    .replace(/\s+([.,!?;:])/g, '$1')
    .trim();
}

export function getClipEffectiveRangeSeconds(clip: { startTime: number; endTime: number; trimStartOffset?: number; trimEndOffset?: number }): {
  start: number;
  end: number;
} {
  const start = (clip.startTime || 0) + (clip.trimStartOffset || 0);
  const end = (clip.endTime || 0) + (clip.trimEndOffset || 0);
  return {
    start: Math.max(0, Math.min(start, end)),
    end: Math.max(0, Math.max(start, end)),
  };
}

export function buildTranscriptSnippetForRange(
  transcript: Transcript | null | undefined,
  range: { start: number; end: number },
  options?: {
    maxChars?: number;
    preferSegments?: boolean;
  }
): { text: string; segmentCount: number } {
  if (!transcript) return { text: '', segmentCount: 0 };

  const start = Number.isFinite(range.start) ? range.start : 0;
  const end = Number.isFinite(range.end) ? range.end : 0;
  if (end <= start) return { text: '', segmentCount: 0 };

  const preferSegments = options?.preferSegments ?? true;

  if (preferSegments && Array.isArray(transcript.segments) && transcript.segments.length > 0) {
    const selected = transcript.segments.filter((s) => {
      if (!Number.isFinite(s.start) || !Number.isFinite(s.end)) return false;
      return s.end >= start && s.start <= end;
    });

    const combined = normalizeWhitespace(selected.map((s) => s.text || '').join(' '));
    const maxChars = options?.maxChars;
    if (typeof maxChars === 'number' && maxChars > 0 && combined.length > maxChars) {
      return { text: combined.slice(0, maxChars).trimEnd() + '…', segmentCount: selected.length };
    }
    return { text: combined, segmentCount: selected.length };
  }

  // Fallback to word-level transcript if segments are missing
  if (Array.isArray(transcript.words) && transcript.words.length > 0) {
    const selectedWords = transcript.words.filter((w) => {
      if (!Number.isFinite(w.start) || !Number.isFinite(w.end)) return false;
      return w.end >= start && w.start <= end;
    });

    const combined = normalizeWhitespace(selectedWords.map((w) => w.word || '').join(' '));
    const maxChars = options?.maxChars;
    if (typeof maxChars === 'number' && maxChars > 0 && combined.length > maxChars) {
      return { text: combined.slice(0, maxChars).trimEnd() + '…', segmentCount: 0 };
    }

    return { text: combined, segmentCount: 0 };
  }

  // Last resort
  const maxChars = options?.maxChars;
  const normalized = normalizeWhitespace(transcript.text || '');
  if (typeof maxChars === 'number' && maxChars > 0 && normalized.length > maxChars) {
    return { text: normalized.slice(0, maxChars).trimEnd() + '…', segmentCount: 0 };
  }
  return { text: normalized, segmentCount: 0 };
}
