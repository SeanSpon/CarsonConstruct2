import type { Clip, Transcript } from '../types';

export type ExportPreset = '9:16' | '1:1' | '16:9';

export interface CaptionSegment {
  start: number;
  end: number;
  text: string;
}

export interface ClipProject {
  id: string;
  jobId: string;
  clipId: string;
  source: {
    filePath: string;
    inputHash?: string;
  };
  originalRange: {
    start: number;
    end: number;
  };
  edit: {
    in: number;
    out: number;
    internalCuts: Array<{ id: string; start: number; end: number }>;
  };
  captions: {
    enabled: boolean;
    segments: CaptionSegment[];
  };
  exportPreset: ExportPreset;
  patchHistory: Patch[];
  createdAt: number;
  updatedAt: number;
}

export type PatchOp =
  | { type: 'set_in_out'; start: number; end: number }
  | { type: 'nudge_in'; delta: number }
  | { type: 'nudge_out'; delta: number }
  | { type: 'add_internal_cut'; start: number; end: number }
  | { type: 'remove_internal_cut'; id: string }
  | { type: 'set_export_preset'; preset: ExportPreset }
  | { type: 'replace_captions'; segments: CaptionSegment[] }
  | { type: 'toggle_captions'; enabled: boolean }
  | { type: 'emphasize_caption_words'; style: 'uppercase'; words: string[] };

export interface Patch {
  id: string;
  label: string;
  source: 'ai' | 'user';
  createdAt: number;
  ops: PatchOp[];
}

export const createClipProject = (
  jobId: string,
  clip: Clip,
  filePath: string,
  transcript: Transcript | null
): ClipProject => {
  const captions = transcript ? buildCaptionSegments(transcript, clip.startTime, clip.endTime) : [];
  return {
    id: `${jobId}_${clip.id}`,
    jobId,
    clipId: clip.id,
    source: { filePath },
    originalRange: {
      start: clip.startTime,
      end: clip.endTime,
    },
    edit: {
      in: clip.startTime + (clip.trimStartOffset || 0),
      out: clip.endTime + (clip.trimEndOffset || 0),
      internalCuts: [],
    },
    captions: {
      enabled: true,
      segments: captions,
    },
    exportPreset: '9:16',
    patchHistory: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
};

export const applyPatch = (project: ClipProject, patch: Patch): ClipProject => {
  let next = { ...project };

  for (const op of patch.ops) {
    switch (op.type) {
      case 'set_in_out':
        next = { ...next, edit: { ...next.edit, in: op.start, out: op.end } };
        break;
      case 'nudge_in':
        next = { ...next, edit: { ...next.edit, in: next.edit.in + op.delta } };
        break;
      case 'nudge_out':
        next = { ...next, edit: { ...next.edit, out: next.edit.out + op.delta } };
        break;
      case 'add_internal_cut':
        next = {
          ...next,
          edit: {
            ...next.edit,
            internalCuts: [
              ...next.edit.internalCuts,
              { id: `cut_${Date.now()}`, start: op.start, end: op.end },
            ],
          },
        };
        break;
      case 'remove_internal_cut':
        next = {
          ...next,
          edit: {
            ...next.edit,
            internalCuts: next.edit.internalCuts.filter((cut) => cut.id !== op.id),
          },
        };
        break;
      case 'set_export_preset':
        next = { ...next, exportPreset: op.preset };
        break;
      case 'replace_captions':
        next = { ...next, captions: { ...next.captions, segments: op.segments } };
        break;
      case 'toggle_captions':
        next = { ...next, captions: { ...next.captions, enabled: op.enabled } };
        break;
      case 'emphasize_caption_words':
        next = {
          ...next,
          captions: {
            ...next.captions,
            segments: next.captions.segments.map((segment) => ({
              ...segment,
              text: emphasizeWords(segment.text, op.words, op.style),
            })),
          },
        };
        break;
      default:
        break;
    }
  }

  return {
    ...next,
    patchHistory: [...next.patchHistory, patch],
    updatedAt: Date.now(),
  };
};

export const buildCaptionSegments = (
  transcript: Transcript,
  start: number,
  end: number
): CaptionSegment[] => {
  if (!transcript?.words?.length) return [];
  const words = transcript.words.filter((w) => w.start >= start && w.end <= end);
  if (!words.length) return [];

  const segments: CaptionSegment[] = [];
  let bucket: string[] = [];
  let segStart = words[0].start;
  let segEnd = words[0].end;

  words.forEach((word, index) => {
    bucket.push(word.word);
    segEnd = word.end;

    const isLast = index === words.length - 1;
    const duration = segEnd - segStart;
    if (bucket.length >= 8 || duration >= 2.5 || isLast) {
      segments.push({
        start: segStart,
        end: segEnd,
        text: bucket.join(' ').trim(),
      });
      bucket = [];
      if (!isLast && words[index + 1]) {
        segStart = words[index + 1].start;
        segEnd = words[index + 1].end;
      }
    }
  });

  return segments;
};

export const summarizePatch = (patch: Patch) => {
  return patch.ops.map((op) => {
    switch (op.type) {
      case 'set_in_out':
        return `Set in/out to ${op.start.toFixed(2)}s → ${op.end.toFixed(2)}s`;
      case 'nudge_in':
        return `Nudge in by ${op.delta.toFixed(2)}s`;
      case 'nudge_out':
        return `Nudge out by ${op.delta.toFixed(2)}s`;
      case 'add_internal_cut':
        return `Add internal cut ${op.start.toFixed(2)}s → ${op.end.toFixed(2)}s`;
      case 'remove_internal_cut':
        return `Remove internal cut ${op.id}`;
      case 'set_export_preset':
        return `Set export preset ${op.preset}`;
      case 'replace_captions':
        return `Replace captions (${op.segments.length} segments)`;
      case 'toggle_captions':
        return op.enabled ? 'Enable captions' : 'Disable captions';
      case 'emphasize_caption_words':
        return `Emphasize words (${op.words.slice(0, 4).join(', ')})`;
      default:
        return 'Apply patch op';
    }
  });
};

const emphasizeWords = (text: string, words: string[], style: 'uppercase') => {
  if (!words.length) return text;
  const set = new Set(words.map((w) => w.toLowerCase()));
  return text
    .split(' ')
    .map((token) => {
      const clean = token.replace(/[^\w']/g, '');
      if (set.has(clean.toLowerCase())) {
        return style === 'uppercase' ? token.toUpperCase() : token;
      }
      return token;
    })
    .join(' ');
};
