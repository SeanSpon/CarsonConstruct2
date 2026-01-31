import { ipcMain, dialog, app } from 'electron';
import path from 'path';
import fs from 'fs';

type TranscriptSegment = { start: number; end: number; text: string };
type TranscriptPayload = { segments: TranscriptSegment[]; words: unknown[]; text: string };

// Parse SRT format
function parseSRT(content: string): TranscriptPayload {
  const segments: TranscriptSegment[] = [];
  const blocks = content.trim().split(/\n\s*\n/);
  
  for (const block of blocks) {
    const lines = block.trim().split('\n');
    if (lines.length < 3) continue;
    
    const timeLine = lines[1];
    const textLines = lines.slice(2);
    
    const timeMatch = timeLine.match(/([\d:,]+)\s*-->\s*([\d:,]+)/);
    if (!timeMatch) continue;
    
    const start = parseTimestamp(timeMatch[1].replace(',', '.'));
    const end = parseTimestamp(timeMatch[2].replace(',', '.'));
    const text = textLines.join(' ').trim();
    
    segments.push({ start, end, text });
  }
  
  return {
    segments,
    words: [],
    text: segments.map(s => s.text).join(' ')
  };
}

// Parse VTT format
function parseVTT(content: string): TranscriptPayload {
  const lines = content.split('\n');
  const segments: TranscriptSegment[] = [];
  
  let i = 0;
  while (i < lines.length) {
    const line = lines[i].trim();
    
    if (line.includes('-->')) {
      const timeMatch = line.match(/([\d:.]+)\s*-->\s*([\d:.]+)/);
      if (timeMatch) {
        const start = parseTimestamp(timeMatch[1]);
        const end = parseTimestamp(timeMatch[2]);
        
        const textLines: string[] = [];
        i++;
        while (i < lines.length && lines[i].trim() && !lines[i].includes('-->')) {
          textLines.push(lines[i].trim());
          i++;
        }
        
        const text = textLines.join(' ').trim();
        if (text) {
          segments.push({ start, end, text });
        }
      }
    }
    i++;
  }
  
  return {
    segments,
    words: [],
    text: segments.map(s => s.text).join(' ')
  };
}

// Parse timestamp (handles HH:MM:SS.mmm or MM:SS.mmm)
function parseTimestamp(timestamp: string): number {
  const parts = timestamp.split(':');
  let seconds = 0;
  
  if (parts.length === 3) {
    // HH:MM:SS.mmm
    seconds = parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60 + parseFloat(parts[2]);
  } else if (parts.length === 2) {
    // MM:SS.mmm
    seconds = parseInt(parts[0]) * 60 + parseFloat(parts[1]);
  } else {
    seconds = parseFloat(timestamp);
  }
  
  return seconds;
}

export function registerTranscriptHandlers() {
  console.log('[Transcript] Registering transcript handlers...');

  // Handle transcript upload
  ipcMain.handle('upload-transcript', async (_, data: { projectId: string; videoHash: string }) => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [
        { name: 'Transcript Files', extensions: ['srt', 'vtt', 'json', 'txt'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    });

    if (result.canceled || !result.filePaths.length) {
      return { success: false, error: 'No file selected' };
    }

    const transcriptPath = result.filePaths[0];
    console.log('[Transcript] File selected:', transcriptPath);

    try {
      const content = fs.readFileSync(transcriptPath, 'utf-8');
      const ext = path.extname(transcriptPath).toLowerCase();
      
      let transcript: TranscriptPayload;
      if (ext === '.json') {
        const parsed: unknown = JSON.parse(content);
        const maybe = parsed as { segments?: unknown; words?: unknown; text?: unknown };
        transcript = {
          segments: Array.isArray(maybe.segments) ? (maybe.segments as TranscriptSegment[]) : [],
          words: Array.isArray(maybe.words) ? maybe.words : [],
          text: typeof maybe.text === 'string' ? maybe.text : '',
        };
      } else if (ext === '.srt') {
        transcript = parseSRT(content);
      } else if (ext === '.vtt') {
        transcript = parseVTT(content);
      } else {
        return { success: false, error: 'Unsupported file format. Use SRT, VTT, or JSON.' };
      }

      // Save to cache using the same hash
      const videoHash = data.videoHash;
      const cacheDir = path.join(app.getPath('userData'), 'cache', videoHash);
      fs.mkdirSync(cacheDir, { recursive: true });
      const outputPath = path.join(cacheDir, 'transcript.json');
      fs.writeFileSync(outputPath, JSON.stringify(transcript, null, 2));

      console.log('[Transcript] Saved to cache:', outputPath);
      console.log('[Transcript] Video hash used:', videoHash);
      console.log('[Transcript] Segments loaded:', transcript.segments?.length || 0);
      return { success: true, segmentCount: transcript.segments?.length || 0 };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('[Transcript] Upload error:', message);
      return { success: false, error: message };
    }
  });
}
