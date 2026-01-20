import { ipcMain, shell, app } from 'electron';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import os from 'os';
import crypto from 'crypto';
import { getMainWindow } from '../window';

// Use bundled ffmpeg for reliability (no system dependency)
// eslint-disable-next-line @typescript-eslint/no-var-requires
let ffmpegPath: string;
try {
  // ffmpeg-static provides the path to a bundled ffmpeg binary
  ffmpegPath = require('ffmpeg-static') as string;
} catch {
  // Fallback to system ffmpeg if bundled version not available
  ffmpegPath = 'ffmpeg';
}
console.log('[Export] Using FFmpeg at:', ffmpegPath);

interface ExportClip {
  id: string;
  startTime: number;
  endTime: number;
  trimStartOffset: number;
  trimEndOffset: number;
  title?: string;
  hookText?: string;
  category?: string;
}

interface AudioTrack {
  id: string;
  type: 'main' | 'broll' | 'sfx' | 'music';
  filePath?: string;
  startTime: number;
  endTime: number;
  volume: number; // 0-100 where 100 = 0dB
  fadeIn?: number;
  fadeOut?: number;
}

// Volume level presets (in dB)
const VOLUME_PRESETS = {
  main: 0,      // Full volume
  broll: -12,   // Background ambience
  sfx: -6,      // Sound effects
  music: -18,   // Background music
};

// Hash a file (used to locate cached transcript from detection)
const hashFile = async (filePath: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('error', reject);
    stream.on('end', () => resolve(hash.digest('hex')));
  });
};

interface DeadSpace {
  id: string;
  startTime: number;
  endTime: number;
  remove: boolean;
}

type TransitionType = 'none' | 'crossfade' | 'dip-to-black';

interface TransitionSettings {
  type: TransitionType;
  duration: number; // seconds (0.5 - 2.0)
}

interface ExportSettings {
  format: 'mp4' | 'mov';
  mode: 'fast' | 'accurate';
  exportClips: boolean;
  exportClipsCompilation: boolean;
  exportFullVideo: boolean;
  transition: TransitionSettings;
}

// Export clips
ipcMain.handle('export-clips', async (_event, data: {
  sourceFile: string;
  clips: ExportClip[];
  deadSpaces: DeadSpace[];
  outputDir: string;
  settings: ExportSettings;
}) => {
  const { sourceFile, clips, deadSpaces, outputDir, settings } = data;
  const win = getMainWindow();
  
  console.log('[Export Handler] Received export request:');
  console.log('  - Source:', sourceFile);
  console.log('  - Output:', outputDir);
  console.log('  - Clips:', clips.length);
  console.log('  - Settings:', JSON.stringify(settings, null, 2));
  
  if (!win) {
    return { success: false, error: 'Window not found' };
  }

  // Ensure output directory exists
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const errors: string[] = [];
  let completed = 0;
  const totalTasks = (settings.exportClips ? clips.length : 0) + 
    (settings.exportClipsCompilation ? 1 : 0) + 
    (settings.exportFullVideo ? 1 : 0);

  console.log('[Export Handler] Total tasks:', totalTasks);
  console.log('[Export Handler] Will export individual clips?', settings.exportClips);

  // Export individual clips
  if (settings.exportClips) {
    console.log('[Export Handler] Starting individual clip export...');
    for (let i = 0; i < clips.length; i++) {
      const clip = clips[i];
      const actualStart = clip.startTime + clip.trimStartOffset;
      const actualEnd = clip.endTime + clip.trimEndOffset;
      const duration = actualEnd - actualStart;
      
      // Create filename from title or clip ID
      const safeName = (clip.title || `clip_${clip.id}`)
        .replace(/[^a-zA-Z0-9]/g, '_')
        .substring(0, 50);
      const outputFile = path.join(outputDir, `${safeName}.${settings.format}`);

      console.log(`[Export Handler] Exporting clip ${i + 1}/${clips.length}:`, outputFile);

      win.webContents.send('export-progress', {
        current: completed + 1,
        total: totalTasks,
        clipName: clip.title || `Clip ${i + 1}`,
        type: 'clip',
      });

      try {
        await exportSingleClip(sourceFile, outputFile, actualStart, duration, settings.mode);
        console.log(`[Export Handler] ✓ Clip ${i + 1} exported successfully`);
        
        // Write metadata sidecar JSON
        if (clip.title || clip.hookText || clip.category) {
          const metadataFile = path.join(outputDir, `${safeName}.json`);
          fs.writeFileSync(metadataFile, JSON.stringify({
            title: clip.title,
            hookText: clip.hookText,
            category: clip.category,
            startTime: actualStart,
            endTime: actualEnd,
            duration,
          }, null, 2));
        }
        
        completed++;
      } catch (err) {
        console.error(`[Export Handler] ✗ Clip ${i + 1} failed:`, err);
        errors.push(`Failed to export ${clip.title || clip.id}: ${err}`);
      }
    }
  }

  // Export clips compilation (all clips joined with transitions)
  if (settings.exportClipsCompilation && clips.length > 0) {
    win.webContents.send('export-progress', {
      current: completed + 1,
      total: totalTasks,
      clipName: 'Clips compilation',
      type: 'compilation',
    });

    try {
      const outputFile = path.join(outputDir, `clips_compilation.${settings.format}`);
      await exportClipsCompilation(
        sourceFile, 
        outputFile, 
        clips, 
        settings.transition, 
        settings.mode,
        (percent, message) => {
          win.webContents.send('export-progress', {
            current: completed + 1,
            total: totalTasks,
            clipName: message,
            type: 'compilation',
            percent,
          });
        }
      );
      completed++;
    } catch (err) {
      errors.push(`Failed to export clips compilation: ${err}`);
    }
  }

  // Export full video with dead spaces removed
  if (settings.exportFullVideo) {
    win.webContents.send('export-progress', {
      current: completed + 1,
      total: totalTasks,
      clipName: 'Full video (dead space removed)',
      type: 'full',
    });

    try {
      const outputFile = path.join(outputDir, `edited_full.${settings.format}`);
      await exportWithDeadSpacesRemoved(sourceFile, outputFile, deadSpaces, settings.mode);
      completed++;
    } catch (err) {
      errors.push(`Failed to export full video: ${err}`);
    }
  }

  // Send completion
  console.log(`[Export Handler] ✅ Export complete! ${completed} files saved to:`, outputDir);
  win.webContents.send('export-complete', {
    success: errors.length === 0,
    outputDir,
    clipCount: completed,
    errors,
  });

  // Open the folder automatically
  if (errors.length === 0 && completed > 0) {
    console.log('[Export Handler] Opening output folder...');
    shell.openPath(outputDir);
  }

  return { success: errors.length === 0, outputDir };
});

// Export single clip
function exportSingleClip(
  sourceFile: string,
  outputFile: string,
  startTime: number,
  duration: number,
  mode: 'fast' | 'accurate'
): Promise<void> {
  return new Promise((resolve, reject) => {
    const args = [
      '-y',
      '-ss', startTime.toString(),
      '-i', sourceFile,
      '-t', duration.toString(),
    ];

    if (mode === 'fast') {
      // Stream copy - fast but keyframe-aligned (boundary timing can drift)
      args.push('-c', 'copy', '-avoid_negative_ts', 'make_zero');
    } else {
      // Re-encode - slower but frame-accurate cuts
      args.push(
        '-c:v', 'libx264',
        '-preset', 'fast',
        '-crf', '23',
        '-c:a', 'aac',
        '-b:a', '192k'
      );
    }

    args.push(outputFile);

    const ffmpeg = spawn(ffmpegPath, args, { windowsHide: true });
    let errorOutput = '';

    ffmpeg.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });

    ffmpeg.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        // If fast mode failed, try accurate mode as fallback
        if (mode === 'fast') {
          console.log('Fast export failed, falling back to accurate mode');
          exportSingleClip(sourceFile, outputFile, startTime, duration, 'accurate')
            .then(resolve)
            .catch(reject);
        } else {
          reject(new Error(errorOutput || `FFmpeg exited with code ${code}`));
        }
      }
    });

    ffmpeg.on('error', (err) => {
      reject(err);
    });
  });
}

// Export full video with dead spaces removed using concat filter
function exportWithDeadSpacesRemoved(
  sourceFile: string,
  outputFile: string,
  deadSpaces: DeadSpace[],
  mode: 'fast' | 'accurate'
): Promise<void> {
  return new Promise((resolve, reject) => {
    // Filter to only remove dead spaces marked for removal
    const spacesToRemove = deadSpaces
      .filter(ds => ds.remove)
      .sort((a, b) => a.startTime - b.startTime);

    if (spacesToRemove.length === 0) {
      // No dead spaces to remove, just copy the file
      const ffmpeg = spawn(ffmpegPath, ['-y', '-i', sourceFile, '-c', 'copy', outputFile], { windowsHide: true });
      
      ffmpeg.on('close', (code) => {
        if (code === 0) resolve();
        else reject(new Error(`FFmpeg exited with code ${code}`));
      });
      
      ffmpeg.on('error', reject);
      return;
    }

    // Build segments to keep
    const segments: { start: number; end: number }[] = [];
    let currentStart = 0;

    for (const space of spacesToRemove) {
      if (space.startTime > currentStart) {
        segments.push({ start: currentStart, end: space.startTime });
      }
      currentStart = space.endTime;
    }

    // Add final segment (from last dead space to end)
    // We'll use a large number and let FFmpeg handle the actual end
    segments.push({ start: currentStart, end: 999999 });

    // Build FFmpeg complex filter
    const filterParts: string[] = [];
    const concatInputs: string[] = [];

    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      filterParts.push(`[0:v]trim=start=${seg.start}:end=${seg.end},setpts=PTS-STARTPTS[v${i}]`);
      filterParts.push(`[0:a]atrim=start=${seg.start}:end=${seg.end},asetpts=PTS-STARTPTS[a${i}]`);
      concatInputs.push(`[v${i}][a${i}]`);
    }

    const filterComplex = filterParts.join(';') + 
      `;${concatInputs.join('')}concat=n=${segments.length}:v=1:a=1[outv][outa]`;

    const args = [
      '-y',
      '-i', sourceFile,
      '-filter_complex', filterComplex,
      '-map', '[outv]',
      '-map', '[outa]',
    ];

    if (mode === 'accurate') {
      args.push(
        '-c:v', 'libx264',
        '-preset', 'fast',
        '-crf', '23',
        '-c:a', 'aac',
        '-b:a', '192k'
      );
    }

    args.push(outputFile);

    const ffmpeg = spawn(ffmpegPath, args, { windowsHide: true });
    let errorOutput = '';

    ffmpeg.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });

    ffmpeg.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(errorOutput || `FFmpeg exited with code ${code}`));
      }
    });

    ffmpeg.on('error', reject);
  });
}

// Export clips compilation with transitions
function exportClipsCompilation(
  sourceFile: string,
  outputFile: string,
  clips: ExportClip[],
  transition: TransitionSettings,
  mode: 'fast' | 'accurate',
  onProgress?: (percent: number, message: string) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (clips.length === 0) {
      reject(new Error('No clips to compile'));
      return;
    }

    // Sort clips by start time
    const sortedClips = [...clips].sort((a, b) => {
      const aStart = a.startTime + a.trimStartOffset;
      const bStart = b.startTime + b.trimStartOffset;
      return aStart - bStart;
    });

    // Calculate clip durations and build segments
    const segments = sortedClips.map(clip => ({
      start: clip.startTime + clip.trimStartOffset,
      end: clip.endTime + clip.trimEndOffset,
      duration: (clip.endTime + clip.trimEndOffset) - (clip.startTime + clip.trimStartOffset),
    }));

    // If only one clip, just extract it
    if (segments.length === 1) {
      const seg = segments[0];
      const args = [
        '-y',
        '-ss', seg.start.toString(),
        '-i', sourceFile,
        '-t', seg.duration.toString(),
        '-c:v', 'libx264',
        '-preset', 'fast',
        '-crf', '23',
        '-c:a', 'aac',
        '-b:a', '192k',
        outputFile
      ];

      const ffmpeg = spawn(ffmpegPath, args, { windowsHide: true });
      let errorOutput = '';

      ffmpeg.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      ffmpeg.on('close', (code) => {
        if (code === 0) resolve();
        else reject(new Error(errorOutput || `FFmpeg exited with code ${code}`));
      });

      ffmpeg.on('error', reject);
      return;
    }

    // Build FFmpeg filter based on transition type
    const transitionDuration = transition.duration;
    const filterParts: string[] = [];
    
    if (transition.type === 'none') {
      // Simple concatenation without transitions
      const concatInputs: string[] = [];
      
      for (let i = 0; i < segments.length; i++) {
        const seg = segments[i];
        filterParts.push(`[0:v]trim=start=${seg.start}:end=${seg.end},setpts=PTS-STARTPTS[v${i}]`);
        filterParts.push(`[0:a]atrim=start=${seg.start}:end=${seg.end},asetpts=PTS-STARTPTS[a${i}]`);
        concatInputs.push(`[v${i}][a${i}]`);
      }
      
      filterParts.push(`${concatInputs.join('')}concat=n=${segments.length}:v=1:a=1[outv][outa]`);
    } else if (transition.type === 'crossfade') {
      // Crossfade transitions using xfade filter
      // First, trim all clips
      for (let i = 0; i < segments.length; i++) {
        const seg = segments[i];
        filterParts.push(`[0:v]trim=start=${seg.start}:end=${seg.end},setpts=PTS-STARTPTS[v${i}]`);
        filterParts.push(`[0:a]atrim=start=${seg.start}:end=${seg.end},asetpts=PTS-STARTPTS[a${i}]`);
      }
      
      // Apply xfade between consecutive clips
      let lastVideoLabel = 'v0';
      let lastAudioLabel = 'a0';
      let runningDuration = segments[0].duration;
      
      for (let i = 1; i < segments.length; i++) {
        const offset = runningDuration - transitionDuration;
        const newVideoLabel = i === segments.length - 1 ? 'outv' : `xv${i}`;
        const newAudioLabel = i === segments.length - 1 ? 'outa' : `xa${i}`;
        
        // Video crossfade
        filterParts.push(
          `[${lastVideoLabel}][v${i}]xfade=transition=fade:duration=${transitionDuration}:offset=${offset.toFixed(3)}[${newVideoLabel}]`
        );
        
        // Audio crossfade
        filterParts.push(
          `[${lastAudioLabel}][a${i}]acrossfade=d=${transitionDuration}:c1=tri:c2=tri[${newAudioLabel}]`
        );
        
        lastVideoLabel = newVideoLabel;
        lastAudioLabel = newAudioLabel;
        runningDuration = offset + segments[i].duration;
      }
    } else if (transition.type === 'dip-to-black') {
      // Dip to black transitions
      // First, trim all clips and add fade out/in
      const halfTransition = transitionDuration / 2;
      
      for (let i = 0; i < segments.length; i++) {
        const seg = segments[i];
        const fadeOutStart = seg.duration - halfTransition;
        
        // Video: fade out at end, fade in at start (except first/last)
        let videoFilter = `[0:v]trim=start=${seg.start}:end=${seg.end},setpts=PTS-STARTPTS`;
        if (i > 0) {
          videoFilter += `,fade=t=in:st=0:d=${halfTransition}`;
        }
        if (i < segments.length - 1) {
          videoFilter += `,fade=t=out:st=${fadeOutStart.toFixed(3)}:d=${halfTransition}`;
        }
        videoFilter += `[v${i}]`;
        filterParts.push(videoFilter);
        
        // Audio: fade out at end, fade in at start (except first/last)
        let audioFilter = `[0:a]atrim=start=${seg.start}:end=${seg.end},asetpts=PTS-STARTPTS`;
        if (i > 0) {
          audioFilter += `,afade=t=in:st=0:d=${halfTransition}`;
        }
        if (i < segments.length - 1) {
          audioFilter += `,afade=t=out:st=${fadeOutStart.toFixed(3)}:d=${halfTransition}`;
        }
        audioFilter += `[a${i}]`;
        filterParts.push(audioFilter);
      }
      
      // Concatenate with brief black gap
      const concatInputs: string[] = [];
      for (let i = 0; i < segments.length; i++) {
        concatInputs.push(`[v${i}][a${i}]`);
      }
      filterParts.push(`${concatInputs.join('')}concat=n=${segments.length}:v=1:a=1[outv][outa]`);
    }

    const filterComplex = filterParts.join(';');
    
    const args = [
      '-y',
      '-i', sourceFile,
      '-filter_complex', filterComplex,
      '-map', '[outv]',
      '-map', '[outa]',
      '-c:v', 'libx264',
      '-preset', mode === 'fast' ? 'ultrafast' : 'fast',
      '-crf', '23',
      '-c:a', 'aac',
      '-b:a', '192k',
      outputFile
    ];

    console.log('[Export] Clips compilation FFmpeg args:', args.join(' '));

    const ffmpeg = spawn(ffmpegPath, args, { windowsHide: true });
    let errorOutput = '';

    ffmpeg.stderr.on('data', (data) => {
      const str = data.toString();
      errorOutput += str;
      
      // Parse progress from FFmpeg output
      const timeMatch = str.match(/time=(\d+):(\d+):(\d+)/);
      if (timeMatch && onProgress) {
        const hours = parseInt(timeMatch[1]);
        const mins = parseInt(timeMatch[2]);
        const secs = parseInt(timeMatch[3]);
        const currentTime = hours * 3600 + mins * 60 + secs;
        const totalDuration = segments.reduce((sum, s) => sum + s.duration, 0);
        const percent = Math.min(100, Math.round((currentTime / totalDuration) * 100));
        onProgress(percent, `Rendering compilation... ${percent}%`);
      }
    });

    ffmpeg.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        console.error('[Export] FFmpeg error:', errorOutput);
        reject(new Error(errorOutput || `FFmpeg exited with code ${code}`));
      }
    });

    ffmpeg.on('error', reject);
  });
}

// Export with audio mixing support
ipcMain.handle('export-with-audio-mix', async (_event, data: {
  sourceFile: string;
  outputFile: string;
  startTime: number;
  endTime: number;
  audioTracks: AudioTrack[];
  mode: 'fast' | 'accurate';
}) => {
  const { sourceFile, outputFile, startTime, endTime, audioTracks, mode } = data;
  
  return new Promise((resolve, reject) => {
    const duration = endTime - startTime;
    
    // Build audio filter chain
    const audioFilters: string[] = [];
    const additionalInputs: string[] = [];
    const mixInputs: string[] = [];
    let inputIndex = 1; // 0 is the main video
    
    // Process main audio first
    const mainTrack = audioTracks.find(t => t.type === 'main');
    if (mainTrack) {
      const volumeDb = volumeToDb(mainTrack.volume);
      const volumeRatio = dbToRatio(volumeDb);
      let mainFilter = `[0:a]volume=${volumeRatio}`;
      
      if (mainTrack.fadeIn && mainTrack.fadeIn > 0) {
        mainFilter += `,afade=t=in:st=0:d=${mainTrack.fadeIn}`;
      }
      if (mainTrack.fadeOut && mainTrack.fadeOut > 0) {
        mainFilter += `,afade=t=out:st=${duration - mainTrack.fadeOut}:d=${mainTrack.fadeOut}`;
      }
      
      mainFilter += '[main]';
      audioFilters.push(mainFilter);
      mixInputs.push('[main]');
    } else {
      audioFilters.push('[0:a]acopy[main]');
      mixInputs.push('[main]');
    }
    
    // Process additional audio tracks
    for (const track of audioTracks) {
      if (track.type === 'main' || !track.filePath) continue;
      
      additionalInputs.push(track.filePath);
      const trackLabel = `track${inputIndex}`;
      const volumeDb = VOLUME_PRESETS[track.type] || volumeToDb(track.volume);
      const volumeRatio = dbToRatio(volumeDb);
      
      let trackFilter = `[${inputIndex}:a]`;
      
      // Trim to segment
      if (track.startTime > 0 || track.endTime > 0) {
        const trackDuration = track.endTime - track.startTime;
        trackFilter += `atrim=start=0:end=${trackDuration},asetpts=PTS-STARTPTS,`;
      }
      
      // Delay to start position
      if (track.startTime > 0) {
        const delayMs = Math.round(track.startTime * 1000);
        trackFilter += `adelay=${delayMs}|${delayMs},`;
      }
      
      // Volume
      trackFilter += `volume=${volumeRatio}`;
      
      // Fades
      if (track.fadeIn && track.fadeIn > 0) {
        trackFilter += `,afade=t=in:st=0:d=${track.fadeIn}`;
      }
      if (track.fadeOut && track.fadeOut > 0) {
        const fadeStart = (track.endTime - track.startTime) - track.fadeOut;
        trackFilter += `,afade=t=out:st=${fadeStart}:d=${track.fadeOut}`;
      }
      
      trackFilter += `[${trackLabel}]`;
      audioFilters.push(trackFilter);
      mixInputs.push(`[${trackLabel}]`);
      inputIndex++;
    }
    
    // Mix all tracks
    if (mixInputs.length > 1) {
      audioFilters.push(
        `${mixInputs.join('')}amix=inputs=${mixInputs.length}:duration=longest:normalize=0[aout]`
      );
    } else {
      // Rename single track to output
      const lastFilter = audioFilters[audioFilters.length - 1];
      audioFilters[audioFilters.length - 1] = lastFilter.replace('[main]', '[aout]');
    }
    
    // Build FFmpeg command
    const args = [
      '-y',
      '-ss', startTime.toString(),
      '-i', sourceFile,
      '-t', duration.toString(),
    ];
    
    // Add additional audio inputs
    for (const input of additionalInputs) {
      args.push('-i', input);
    }
    
    // Add filter complex
    const filterComplex = audioFilters.join(';');
    args.push('-filter_complex', filterComplex);
    args.push('-map', '0:v', '-map', '[aout]');
    
    // Encoding options
    if (mode === 'accurate') {
      args.push(
        '-c:v', 'libx264',
        '-preset', 'fast',
        '-crf', '23',
        '-c:a', 'aac',
        '-b:a', '192k'
      );
    } else {
      args.push(
        '-c:v', 'copy',
        '-c:a', 'aac',
        '-b:a', '192k'
      );
    }
    
    args.push(outputFile);
    
    const ffmpeg = spawn(ffmpegPath, args, { windowsHide: true });
    let errorOutput = '';
    
    ffmpeg.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });
    
    ffmpeg.on('close', (code) => {
      if (code === 0) {
        resolve({ success: true, outputFile });
      } else {
        reject(new Error(errorOutput || `FFmpeg exited with code ${code}`));
      }
    });
    
    ffmpeg.on('error', reject);
  });
});

// Helper: Convert 0-100 volume to dB
function volumeToDb(volume: number): number {
  if (volume <= 0) return -60; // Effectively silent
  if (volume >= 100) return 0;
  // Logarithmic scale: 50 = -6dB, 25 = -12dB, etc.
  return 20 * Math.log10(volume / 100);
}

// Helper: Convert dB to linear ratio
function dbToRatio(db: number): number {
  return Math.pow(10, db / 20);
}

// Open folder in file explorer
ipcMain.handle('open-folder', async (_event, folderPath: string) => {
  try {
    // Check if it's a file or directory
    const stat = fs.statSync(folderPath);
    if (stat.isDirectory()) {
      await shell.openPath(folderPath);
    } else {
      // If it's a file, show it in folder (highlights the file)
      shell.showItemInFolder(folderPath);
    }
    return { success: true };
  } catch (err) {
    // Fallback to just opening the path
    try {
      await shell.openPath(folderPath);
      return { success: true };
    } catch (e) {
      return { success: false, error: String(e) };
    }
  }
});

// Preview clips compilation - quick low-res render
ipcMain.handle('preview-clips-compilation', async (_event, data: {
  sourceFile: string;
  clips: ExportClip[];
  transition: TransitionSettings;
}) => {
  const { sourceFile, clips, transition } = data;
  const win = getMainWindow();
  
  if (!win) {
    return { success: false, error: 'Window not found' };
  }

  if (clips.length === 0) {
    return { success: false, error: 'No clips to preview' };
  }

  // Create temp file for preview
  const tempDir = app.getPath('temp');
  const previewFile = path.join(tempDir, `podflow_preview_${Date.now()}.mp4`);

  // Sort clips by start time
  const sortedClips = [...clips].sort((a, b) => {
    const aStart = a.startTime + a.trimStartOffset;
    const bStart = b.startTime + b.trimStartOffset;
    return aStart - bStart;
  });

  // Calculate segments
  const segments = sortedClips.map(clip => ({
    start: clip.startTime + clip.trimStartOffset,
    end: clip.endTime + clip.trimEndOffset,
    duration: (clip.endTime + clip.trimEndOffset) - (clip.startTime + clip.trimStartOffset),
  }));

  return new Promise((resolve) => {
    // Build filter for 480p preview with transitions
    const filterParts: string[] = [];
    const transitionDuration = transition.duration;
    
    if (transition.type === 'none' || segments.length === 1) {
      // Simple concatenation
      const concatInputs: string[] = [];
      
      for (let i = 0; i < segments.length; i++) {
        const seg = segments[i];
        // Scale to 480p and trim
        filterParts.push(`[0:v]trim=start=${seg.start}:end=${seg.end},setpts=PTS-STARTPTS,scale=-2:480[v${i}]`);
        filterParts.push(`[0:a]atrim=start=${seg.start}:end=${seg.end},asetpts=PTS-STARTPTS[a${i}]`);
        concatInputs.push(`[v${i}][a${i}]`);
      }
      
      filterParts.push(`${concatInputs.join('')}concat=n=${segments.length}:v=1:a=1[outv][outa]`);
    } else if (transition.type === 'crossfade') {
      // Crossfade with 480p scaling
      for (let i = 0; i < segments.length; i++) {
        const seg = segments[i];
        filterParts.push(`[0:v]trim=start=${seg.start}:end=${seg.end},setpts=PTS-STARTPTS,scale=-2:480[v${i}]`);
        filterParts.push(`[0:a]atrim=start=${seg.start}:end=${seg.end},asetpts=PTS-STARTPTS[a${i}]`);
      }
      
      let lastVideoLabel = 'v0';
      let lastAudioLabel = 'a0';
      let runningDuration = segments[0].duration;
      
      for (let i = 1; i < segments.length; i++) {
        const offset = runningDuration - transitionDuration;
        const newVideoLabel = i === segments.length - 1 ? 'outv' : `xv${i}`;
        const newAudioLabel = i === segments.length - 1 ? 'outa' : `xa${i}`;
        
        filterParts.push(
          `[${lastVideoLabel}][v${i}]xfade=transition=fade:duration=${transitionDuration}:offset=${offset.toFixed(3)}[${newVideoLabel}]`
        );
        filterParts.push(
          `[${lastAudioLabel}][a${i}]acrossfade=d=${transitionDuration}:c1=tri:c2=tri[${newAudioLabel}]`
        );
        
        lastVideoLabel = newVideoLabel;
        lastAudioLabel = newAudioLabel;
        runningDuration = offset + segments[i].duration;
      }
    } else if (transition.type === 'dip-to-black') {
      // Dip to black with 480p scaling
      const halfTransition = transitionDuration / 2;
      
      for (let i = 0; i < segments.length; i++) {
        const seg = segments[i];
        const fadeOutStart = seg.duration - halfTransition;
        
        let videoFilter = `[0:v]trim=start=${seg.start}:end=${seg.end},setpts=PTS-STARTPTS,scale=-2:480`;
        if (i > 0) {
          videoFilter += `,fade=t=in:st=0:d=${halfTransition}`;
        }
        if (i < segments.length - 1) {
          videoFilter += `,fade=t=out:st=${fadeOutStart.toFixed(3)}:d=${halfTransition}`;
        }
        videoFilter += `[v${i}]`;
        filterParts.push(videoFilter);
        
        let audioFilter = `[0:a]atrim=start=${seg.start}:end=${seg.end},asetpts=PTS-STARTPTS`;
        if (i > 0) {
          audioFilter += `,afade=t=in:st=0:d=${halfTransition}`;
        }
        if (i < segments.length - 1) {
          audioFilter += `,afade=t=out:st=${fadeOutStart.toFixed(3)}:d=${halfTransition}`;
        }
        audioFilter += `[a${i}]`;
        filterParts.push(audioFilter);
      }
      
      const concatInputs: string[] = [];
      for (let i = 0; i < segments.length; i++) {
        concatInputs.push(`[v${i}][a${i}]`);
      }
      filterParts.push(`${concatInputs.join('')}concat=n=${segments.length}:v=1:a=1[outv][outa]`);
    }

    const filterComplex = filterParts.join(';');
    
    const args = [
      '-y',
      '-i', sourceFile,
      '-filter_complex', filterComplex,
      '-map', '[outv]',
      '-map', '[outa]',
      '-c:v', 'libx264',
      '-preset', 'ultrafast',
      '-crf', '28', // Lower quality for faster preview
      '-c:a', 'aac',
      '-b:a', '128k',
      previewFile
    ];

    console.log('[Preview] Starting preview render...');

    const ffmpeg = spawn(ffmpegPath, args, { windowsHide: true });
    let errorOutput = '';

    ffmpeg.stderr.on('data', (data) => {
      const str = data.toString();
      errorOutput += str;
      
      // Parse progress
      const timeMatch = str.match(/time=(\d+):(\d+):(\d+)/);
      if (timeMatch) {
        const hours = parseInt(timeMatch[1]);
        const mins = parseInt(timeMatch[2]);
        const secs = parseInt(timeMatch[3]);
        const currentTime = hours * 3600 + mins * 60 + secs;
        const totalDuration = segments.reduce((sum, s) => sum + s.duration, 0);
        const percent = Math.min(100, Math.round((currentTime / totalDuration) * 100));
        
        win.webContents.send('preview-progress', {
          percent,
          message: `Rendering preview... ${percent}%`,
        });
      }
    });

    ffmpeg.on('close', (code) => {
      if (code === 0) {
        console.log('[Preview] Preview render complete:', previewFile);
        resolve({ success: true, previewFile });
      } else {
        console.error('[Preview] FFmpeg error:', errorOutput);
        resolve({ success: false, error: errorOutput || `FFmpeg exited with code ${code}` });
      }
    });

    ffmpeg.on('error', (err) => {
      resolve({ success: false, error: String(err) });
    });
  });
});

// Clean up preview file
ipcMain.handle('cleanup-preview', async (_event, previewFile: string) => {
  try {
    if (fs.existsSync(previewFile)) {
      fs.unlinkSync(previewFile);
    }
    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
});

// ============================================
// MVP Vertical Export (9:16) with Captions
// ============================================

interface MVPExportSettings {
  format: 'mp4' | 'mov';
  vertical: boolean;
  targetWidth: number;
  targetHeight: number;
  burnCaptions: boolean;
  captionStyle?: {
    fontName: string;
    fontSize: number;
    outline: number;
    shadow: number;
  };
}

interface MVPClip {
  clip_id: string;
  start: number;
  end: number;
  duration: number;
  captionStyle?: 'viral' | 'minimal' | 'bold';
}

/**
 * Get FFmpeg filter for resolution-agnostic 9:16 center crop.
 * 
 * Method: crop at native height to 9:16, then scale to target.
 * This handles any input resolution correctly.
 */
function getVerticalCropFilter(
  inputWidth: number,
  inputHeight: number,
  targetWidth: number = 1080,
  targetHeight: number = 1920
): string {
  // Calculate crop width at native height
  // crop_w = in_h * 9/16
  const cropWidth = Math.round(inputHeight * 9 / 16);
  const cropX = Math.round((inputWidth - cropWidth) / 2);
  
  // Ensure crop doesn't exceed input width
  const safeCropWidth = Math.min(cropWidth, inputWidth);
  const safeCropX = Math.max(0, Math.round((inputWidth - safeCropWidth) / 2));
  
  // Filter chain:
  // 1. Crop to 9:16 at native resolution (centered)
  // 2. Scale to target 1080x1920
  return `crop=${safeCropWidth}:${inputHeight}:${safeCropX}:0,scale=${targetWidth}:${targetHeight}`;
}

/**
 * Generate ASS subtitle file for a clip.
 */
type TranscriptSegment = { start: number; end: number; text: string };
type TranscriptWord = { word: string; start: number; end: number };

function buildSegmentsFromWords(
  words: TranscriptWord[] = [],
  gapThreshold = 0.6,
  maxWordsPerSegment = 12
): TranscriptSegment[] {
  const segments: TranscriptSegment[] = [];
  let buffer: TranscriptWord[] = [];

  const flush = () => {
    if (buffer.length === 0) return;
    const text = buffer.map(w => w.word).join(' ').trim();
    if (!text) {
      buffer = [];
      return;
    }
    segments.push({
      start: buffer[0].start,
      end: buffer[buffer.length - 1].end,
      text,
    });
    buffer = [];
  };

  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    const prev = buffer[buffer.length - 1];
    const gap = prev ? w.start - prev.end : 0;
    const shouldBreak = gap > gapThreshold || buffer.length >= maxWordsPerSegment;

    if (shouldBreak) {
      flush();
    }
    buffer.push(w);
  }

  flush();
  return segments;
}

async function generateASSFile(
  transcript: { segments?: TranscriptSegment[]; words?: TranscriptWord[] },
  clipStart: number,
  clipEnd: number,
  outputPath: string,
  settings?: { maxChars?: number; maxLines?: number; fontSize?: number; fontName?: string; outline?: number; shadow?: number }
): Promise<void> {
  const maxChars = settings?.maxChars || 32;
  const maxLines = settings?.maxLines || 2;
  const fontSize = settings?.fontSize || 72;
  const fontName = settings?.fontName || 'Arial Black';
  const outline = settings?.outline ?? 4;
  const shadow = settings?.shadow ?? 2;
  
  console.log('[Caption] Generating ASS file:', { 
    outputPath, 
    clipStart, 
    clipEnd, 
    fontSize, 
    fontName,
    outline,
    shadow,
    hasSegments: transcript?.segments?.length || 0,
    hasWords: transcript?.words?.length || 0,
  });
  
  // ASS header for vertical video (1080x1920)
  // Alignment: 2 = bottom-center, MarginV: 80 = 80px from bottom
  const header = `[Script Info]
Title: Clip Captions
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
WrapStyle: 0
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,${fontName},${fontSize},&H00FFFFFF,&H000000FF,&H00000000,&H80000000,-1,0,0,0,100,100,0,0,1,${outline},${shadow},2,40,40,80,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;
  
  const events: string[] = [];
  const segments: TranscriptSegment[] =
    (transcript.segments && transcript.segments.length > 0)
      ? transcript.segments
      : buildSegmentsFromWords(transcript.words || []);
  
  console.log('[Caption] Using', segments.length, 'segments to generate captions');
  
  for (const seg of segments) {
    const segStart = seg.start;
    const segEnd = seg.end;
    
    // Skip segments outside clip window
    if (segEnd < clipStart || segStart > clipEnd) {
      continue;
    }
    
    // Adjust times relative to clip start
    const relStart = Math.max(0, segStart - clipStart);
    const relEnd = Math.min(clipEnd - clipStart, segEnd - clipStart);
    
    // Skip if too short
    if (relEnd - relStart < 0.1) {
      continue;
    }
    
    // Get and wrap text
    const text = seg.text.trim();
    if (!text) continue;
    
    const wrapped = wrapText(text, maxChars, maxLines);
    
    // Format times as H:MM:SS.cc
    const startStr = formatASSTime(relStart);
    const endStr = formatASSTime(relEnd);
    
    // ASS uses \N for line breaks
    const assText = wrapped.replace(/\n/g, '\\N');
    
    console.log('[Caption] Event:', { text: text.substring(0, 50), startStr, endStr });
    events.push(`Dialogue: 0,${startStr},${endStr},Default,,0,0,0,,${assText}`);
  }
  
  // Write ASS file
  const content = header + events.join('\n') + (events.length > 0 ? '\n' : '');
  console.log('[Caption] Generated', events.length, 'caption events');
  console.log('[Caption] ASS file size:', content.length, 'bytes');
  
  // Log first 500 chars of ASS file for debugging
  console.log('[Caption] ASS file content preview:', content.substring(0, 500));
  
  fs.writeFileSync(outputPath, content, 'utf-8');
  
  // Verify file was written
  const fileSize = fs.statSync(outputPath).size;
  console.log('[Caption] ASS file written successfully. Disk size:', fileSize, 'bytes');
  
  if (fileSize === 0) {
    console.error('[Caption] ⚠️ WARNING: ASS file is empty!');
  }
}

function wrapText(text: string, maxChars: number, maxLines: number): string {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let currentLine: string[] = [];
  let currentLen = 0;
  
  for (const word of words) {
    const wordLen = word.length;
    const spaceNeeded = currentLine.length > 0 ? 1 : 0;
    
    if (currentLen + wordLen + spaceNeeded > maxChars) {
      if (currentLine.length > 0) {
        lines.push(currentLine.join(' '));
        if (lines.length >= maxLines) break;
      }
      currentLine = [word];
      currentLen = wordLen;
    } else {
      currentLine.push(word);
      currentLen += wordLen + spaceNeeded;
    }
  }
  
  if (currentLine.length > 0 && lines.length < maxLines) {
    lines.push(currentLine.join(' '));
  }
  
  return lines.join('\n');
}

function formatASSTime(seconds: number): string {
  if (seconds < 0) seconds = 0;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const cs = Math.floor((seconds % 1) * 100);
  return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${cs.toString().padStart(2, '0')}`;
}

function resolveCaptionStyle(
  style?: 'viral' | 'minimal' | 'bold',
  fallback?: { fontName?: string; fontSize?: number; outline?: number; shadow?: number }
): { fontName: string; fontSize: number; outline: number; shadow: number } {
  switch (style) {
    case 'minimal':
      return { fontName: 'Arial', fontSize: 56, outline: 2, shadow: 1 };
    case 'bold':
      return { fontName: 'Arial Black', fontSize: 84, outline: 6, shadow: 3 };
    case 'viral':
      return { fontName: 'Arial Black', fontSize: 72, outline: 4, shadow: 2 };
    default:
      return {
        fontName: fallback?.fontName || 'Arial Black',
        fontSize: fallback?.fontSize || 72,
        outline: fallback?.outline ?? 4,
        shadow: fallback?.shadow ?? 2,
      };
  }
}

/**
 * Export a single clip with vertical crop and optional caption burning.
 */
function exportVerticalClip(
  sourceFile: string,
  outputFile: string,
  clipStart: number,
  clipEnd: number,
  inputWidth: number,
  inputHeight: number,
  assFile: string | null,
  settings: MVPExportSettings
): Promise<void> {
  return new Promise((resolve, reject) => {
    const duration = clipEnd - clipStart;
    const cropFilter = getVerticalCropFilter(
      inputWidth,
      inputHeight,
      settings.targetWidth,
      settings.targetHeight
    );
    
    // Build filter chain
    let videoFilter = cropFilter;
    let debugInfo = {
      cropFilter,
      assFile,
      burnCaptions: settings.burnCaptions,
    };
    
    // Add caption burning if ASS file provided
    if (assFile && settings.burnCaptions) {
      // Verify ASS file exists before adding to filter
      if (!fs.existsSync(assFile)) {
        console.error('[MVP Export] ❌ ASS file does not exist:', assFile);
        return reject(new Error(`ASS file not found: ${assFile}`));
      }
      
      const assFileSize = fs.statSync(assFile).size;
      console.log('[MVP Export] ASS file exists, size:', assFileSize, 'bytes');
      
      // Read and log ASS file content to debug
      if (assFileSize > 0) {
        try {
          const assContent = fs.readFileSync(assFile, 'utf-8');
          const lineCount = assContent.split('\n').length;
          console.log('[MVP Export] ASS file has', lineCount, 'lines');
          if (assContent.includes('Dialogue:')) {
            const dialogueCount = assContent.match(/Dialogue:/g)?.length || 0;
            console.log('[MVP Export] ASS file has', dialogueCount, 'dialogue events');
          } else {
            console.warn('[MVP Export] ⚠️ ASS file has NO dialogue events!');
          }
        } catch (readErr) {
          console.error('[MVP Export] Failed to read ASS file:', readErr);
        }
      }
      
      // On Windows/macOS, use forward slashes. FFmpeg subtitles filter needs quotes and colon escaping.
      let escapedPath = assFile.replace(/\\/g, '/');
      // For libass filter on macOS, escape colons in timestamps
      escapedPath = escapedPath.replace(/:/g, '\\:');
      videoFilter += `,subtitles='${escapedPath}'`;
      debugInfo['escapedPath'] = escapedPath;
      debugInfo['finalFilter'] = videoFilter;
      
      console.log('[MVP Export] Subtitle filter added:', {
        originalPath: assFile,
        escapedPath,
        fullFilter: videoFilter,
      });
      console.log('[MVP Export] ASS file exists:', fs.existsSync(assFile));
    } else {
      console.log('[MVP Export] No ASS file or captions disabled', { assFile, burnCaptions: settings.burnCaptions });
    }
    
    const args = [
      '-y',
      '-ss', clipStart.toString(),
      '-i', sourceFile,
      '-t', duration.toString(),
      '-vf', videoFilter,
      '-c:v', 'libx264',
      '-preset', 'fast',
      '-crf', '23',
      '-c:a', 'aac',
      '-b:a', '192k',
      outputFile
    ];
    
    console.log('[MVP Export] FFmpeg command:', 'ffmpeg', args.join(' '));
    console.log('[MVP Export] Debug info:', debugInfo);
    
    const ffmpeg = spawn(ffmpegPath, args, { windowsHide: true });
    let errorOutput = '';
    let stdoutOutput = '';
    
    ffmpeg.stdout?.on('data', (data) => {
      stdoutOutput += data.toString();
    });
    
    ffmpeg.stderr.on('data', (data) => {
      const chunk = data.toString();
      errorOutput += chunk;
      
      // Log subtitle filter errors if present
      if (chunk.includes('subtitles') || chunk.includes('ass') || chunk.includes('libass')) {
        console.log('[MVP Export] FFmpeg subtitle log:', chunk);
      }
    });
    
    ffmpeg.on('close', (code) => {
      if (code === 0) {
        console.log('[MVP Export] ✅ Export successful:', outputFile);
        resolve();
      } else {
        console.error('[MVP Export] ❌ FFmpeg error (code', code + ')');
        console.error('[MVP Export] Error output:', errorOutput);
        reject(new Error(errorOutput || `FFmpeg exited with code ${code}`));
      }
    });
    
    ffmpeg.on('error', (err) => {
      console.error('[MVP Export] ❌ FFmpeg spawn error:', err);
      reject(err);
    });
  });
}

// Export MVP vertical clips with captions
ipcMain.handle('export-mvp-clips', async (_event, data: {
  sourceFile: string;
  clips: MVPClip[];
  transcript: { segments?: Array<{ start: number; end: number; text: string }>; words?: Array<{ word: string; start: number; end: number }> };
  outputDir: string;
  inputWidth: number;
  inputHeight: number;
  settings: MVPExportSettings;
}) => {
  const { sourceFile, clips, transcript, outputDir, inputWidth, inputHeight, settings } = data;
  const win = getMainWindow();
  
  console.log('[MVP Export] 🚀 Starting MVP export:', { 
    clipCount: clips.length, 
    burnCaptions: settings.burnCaptions, 
    hasTranscript: !!transcript,
    transcriptSegmentCount: transcript?.segments?.length || 0,
    transcriptWordCount: transcript?.words?.length || 0,
  });
  
  if (!win) {
    console.error('[MVP Export] ❌ Window not found');
    return { success: false, error: 'Window not found' };
  }

  // Create output directories
  const clipsDir = path.join(outputDir, 'clips');
  fs.mkdirSync(clipsDir, { recursive: true });
  
  // Ensure we have a transcript; if missing, try to load from cached detection output
  let effectiveTranscript = transcript || { segments: [], words: [] };
  const hasTranscript =
    effectiveTranscript &&
    ((effectiveTranscript.segments && effectiveTranscript.segments.length > 0) ||
     (effectiveTranscript.words && effectiveTranscript.words.length > 0));

  console.log('[MVP Export] Transcript check:', {
    hasSegments: effectiveTranscript?.segments?.length,
    hasWords: effectiveTranscript?.words?.length,
    willLookInCache: !hasTranscript,
  });

  if (!hasTranscript) {
    try {
      const inputHash = await hashFile(sourceFile);
      const cacheDir = path.join(app.getPath('userData'), 'cache', inputHash);
      const transcriptPath = path.join(cacheDir, 'transcript.json');
      console.log('[MVP Export] 🔍 Looking for cached transcript at:', transcriptPath);
      if (fs.existsSync(transcriptPath)) {
        const raw = JSON.parse(fs.readFileSync(transcriptPath, 'utf-8'));
        effectiveTranscript = raw;
        console.log('[MVP Export] ✅ Loaded transcript from cache:', { segments: raw?.segments?.length, words: raw?.words?.length });
      } else {
        console.warn('[MVP Export] ⚠️ No transcript found in cache; captions will be empty');
      }
    } catch (err) {
      console.warn('[MVP Export] ⚠️ Failed to load cached transcript:', err);
    }
  }

  const errors: string[] = [];
  const results: Array<{ clipId: string; path: string; captionedPath?: string }> = [];
  
  for (let i = 0; i < clips.length; i++) {
    const clip = clips[i];
    const clipId = clip.clip_id || `clip_${(i + 1).toString().padStart(3, '0')}`;
    
    console.log(`\n[MVP Export] Processing clip ${i + 1}/${clips.length}: ${clipId}`);
    console.log('[MVP Export] Clip details:', { 
      start: clip.start, 
      end: clip.end, 
      duration: clip.end - clip.start,
      captionStyle: clip.captionStyle,
    });
    
    win.webContents.send('export-progress', {
      current: i + 1,
      total: clips.length,
      clipName: clipId,
      type: 'mvp-clip',
    });
    
    try {
      const outputFile = path.join(clipsDir, `${clipId}.${settings.format}`);
      
      // Generate ASS file first if captions are enabled
      let assFile: string | null = null;
      if (settings.burnCaptions && effectiveTranscript && (
        (effectiveTranscript.segments && effectiveTranscript.segments.length > 0) ||
        (effectiveTranscript.words && effectiveTranscript.words.length > 0)
      )) {
        assFile = path.join(clipsDir, `${clipId}.ass`);
        
        console.log('[MVP Export] 🎬 Captions enabled. Effective transcript:', {
          segments: effectiveTranscript.segments?.length || 0,
          words: effectiveTranscript.words?.length || 0,
        });

        const clipCaptionStyle = resolveCaptionStyle(
          clip.captionStyle,
          settings.captionStyle
        );
        
        console.log('[MVP Export] Caption style:', clipCaptionStyle);
        
        // Generate ASS file
        await generateASSFile(
          effectiveTranscript,
          clip.start,
          clip.end,
          assFile,
          {
            maxChars: 32,
            maxLines: 2,
            fontSize: clipCaptionStyle.fontSize,
            fontName: clipCaptionStyle.fontName,
            outline: clipCaptionStyle.outline,
            shadow: clipCaptionStyle.shadow,
          }
        );
        
        console.log('[MVP Export] ✅ ASS file generated:', assFile);
      } else {
        console.log('[MVP Export] ⊘ Captions disabled or no transcript', {
          burnCaptions: settings.burnCaptions,
          hasSegments: effectiveTranscript?.segments?.length || 0,
          hasWords: effectiveTranscript?.words?.length || 0,
        });
      }
      
      // Export clip with captions if assFile was generated
      console.log('[MVP Export] Starting FFmpeg export...');
      await exportVerticalClip(
        sourceFile,
        outputFile,
        clip.start,
        clip.end,
        inputWidth,
        inputHeight,
        assFile,
        settings
      );
      
      console.log('[MVP Export] ✅ Clip export successful:', outputFile);
      
      const result: { clipId: string; path: string; captionedPath?: string } = {
        clipId,
        path: outputFile,
      };
      
      results.push(result);
    } catch (err) {
      const errMsg = `Failed to export ${clipId}: ${err}`;
      errors.push(errMsg);
      console.error(`[MVP Export] ❌ ${errMsg}`);
    }
  }
  
  // Send completion
  console.log('[MVP Export] 🎉 Export complete!', { 
    successful: results.length, 
    total: clips.length, 
    errors: errors.length 
  });
  
  win.webContents.send('export-complete', {
    success: errors.length === 0,
    outputDir: clipsDir,
    clipCount: results.length,
    errors,
  });
  
  return {
    success: errors.length === 0,
    outputDir: clipsDir,
    clips: results,
    errors,
  };
});

// ============================================
// Vertical Reel Export API (matches preload.ts)
// ============================================

interface VerticalReelExportData {
  sourceFile: string;
  outputDir: string;
  clipId: string;
  startTime: number;
  endTime: number;
  title?: string;
  transcript?: {
    words?: Array<{ word: string; start: number; end: number }>;
    segments?: Array<{ text: string; start: number; end: number }>;
  };
  captionSettings: {
    enabled: boolean;
    style: 'viral' | 'minimal' | 'bold';
    fontSize: number;
    position: 'bottom' | 'center';
  };
  inputWidth: number;
  inputHeight: number;
}

interface VerticalReelBatchData {
  sourceFile: string;
  outputDir: string;
  clips: Array<{
    id: string;
    startTime: number;
    endTime: number;
    trimStartOffset: number;
    trimEndOffset: number;
    title?: string;
  }>;
  transcript?: {
    words?: Array<{ word: string; start: number; end: number }>;
    segments?: Array<{ text: string; start: number; end: number }>;
  };
  captionSettings: {
    enabled: boolean;
    style: 'viral' | 'minimal' | 'bold';
    fontSize: number;
    position: 'bottom' | 'center';
  };
  inputWidth: number;
  inputHeight: number;
}

// Get style colors for ASS captions
function getStyleColors(style: 'viral' | 'minimal' | 'bold'): {
  primary: string;
  outline: number;
  shadow: number;
} {
  switch (style) {
    case 'viral':
      return { primary: '&H00FFFFFF', outline: 4, shadow: 2 };
    case 'minimal':
      return { primary: '&H00FFFFFF', outline: 2, shadow: 1 };
    case 'bold':
      return { primary: '&H00FFFFFF', outline: 5, shadow: 3 };
    default:
      return { primary: '&H00FFFFFF', outline: 4, shadow: 2 };
  }
}

// Generate ASS file with style settings
async function generateStyledASSFile(
  transcript: VerticalReelExportData['transcript'],
  clipStart: number,
  clipEnd: number,
  outputPath: string,
  captionSettings: VerticalReelExportData['captionSettings']
): Promise<void> {
  const maxChars = 32;
  const maxLines = 2;
  const fontSize = captionSettings.fontSize || 56;
  const styleColors = getStyleColors(captionSettings.style);
  const marginV = captionSettings.position === 'center' ? 0 : 150;
  const alignment = captionSettings.position === 'center' ? 5 : 2;
  
  const header = `[Script Info]
Title: Vertical Reel Captions
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
WrapStyle: 0
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial Black,${fontSize},${styleColors.primary},&H000000FF,&H00000000,&H80000000,-1,0,0,0,100,100,0,0,1,${styleColors.outline},${styleColors.shadow},${alignment},40,40,${marginV},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

  const events: string[] = [];
  const segments = transcript?.segments || [];
  
  for (const seg of segments) {
    const segStart = seg.start;
    const segEnd = seg.end;
    
    // Skip segments outside clip window
    if (segEnd < clipStart || segStart > clipEnd) {
      continue;
    }
    
    // Adjust times relative to clip start
    const relStart = Math.max(0, segStart - clipStart);
    const relEnd = Math.min(clipEnd - clipStart, segEnd - clipStart);
    
    if (relEnd - relStart < 0.1) continue;
    
    const text = seg.text.trim();
    if (!text) continue;
    
    const wrapped = wrapText(text, maxChars, maxLines);
    const startStr = formatASSTime(relStart);
    const endStr = formatASSTime(relEnd);
    const assText = wrapped.replace(/\n/g, '\\N');
    
    events.push(`Dialogue: 0,${startStr},${endStr},Default,,0,0,0,,${assText}`);
  }
  
  const content = header + events.join('\n') + (events.length > 0 ? '\n' : '');
  fs.writeFileSync(outputPath, content, 'utf-8');
}

// Export single vertical reel
ipcMain.handle('export-vertical-reel', async (_event, data: VerticalReelExportData) => {
  const {
    sourceFile,
    outputDir,
    clipId,
    startTime,
    endTime,
    title,
    transcript,
    captionSettings,
    inputWidth,
    inputHeight,
  } = data;
  
  const win = getMainWindow();
  
  try {
    // Create output directory
    fs.mkdirSync(outputDir, { recursive: true });
    
    // Generate filename
    const safeName = (title || clipId || 'reel')
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .substring(0, 50);
    const outputFile = path.join(outputDir, `${safeName}_vertical.mp4`);
    
    // Generate ASS file if captions enabled
    let assFile: string | null = null;
    if (captionSettings.enabled && transcript?.segments && transcript.segments.length > 0) {
      assFile = path.join(outputDir, `${safeName}.ass`);
      await generateStyledASSFile(transcript, startTime, endTime, assFile, captionSettings);
    }
    
    // Build filter chain
    const cropFilter = getVerticalCropFilter(inputWidth, inputHeight, 1080, 1920);
    let videoFilter = cropFilter;
    
    if (assFile) {
      const safeAssPath = assFile.replace(/\\/g, '/').replace(/:/g, '\\:');
      videoFilter += `,ass='${safeAssPath}'`;
    }
    
    const duration = endTime - startTime;
    
    // Send progress
    if (win) {
      win.webContents.send('vertical-reel-progress', {
        clipId,
        percent: 10,
        message: 'Starting export...',
      });
    }
    
    await new Promise<void>((resolve, reject) => {
      const args = [
        '-y',
        '-ss', startTime.toString(),
        '-i', sourceFile,
        '-t', duration.toString(),
        '-vf', videoFilter,
        '-c:v', 'libx264',
        '-preset', 'fast',
        '-crf', '23',
        '-c:a', 'aac',
        '-b:a', '192k',
        outputFile
      ];
      
      const ffmpeg = spawn(ffmpegPath, args, { windowsHide: true });
      let errorOutput = '';
      
      ffmpeg.stderr.on('data', (chunk) => {
        const str = chunk.toString();
        errorOutput += str;
        
        // Parse progress
        const timeMatch = str.match(/time=(\d+):(\d+):(\d+)/);
        if (timeMatch && win) {
          const hours = parseInt(timeMatch[1]);
          const mins = parseInt(timeMatch[2]);
          const secs = parseInt(timeMatch[3]);
          const currentTime = hours * 3600 + mins * 60 + secs;
          const percent = Math.min(95, Math.round((currentTime / duration) * 100));
          
          win.webContents.send('vertical-reel-progress', {
            clipId,
            percent,
            message: `Rendering ${percent}%...`,
          });
        }
      });
      
      ffmpeg.on('close', (code) => {
        if (code === 0) {
          if (win) {
            win.webContents.send('vertical-reel-progress', {
              clipId,
              percent: 100,
              message: 'Complete',
            });
          }
          resolve();
        } else {
          reject(new Error(errorOutput || `FFmpeg exited with code ${code}`));
        }
      });
      
      ffmpeg.on('error', reject);
    });
    
    return { success: true, outputFile };
  } catch (err) {
    console.error('[Vertical Reel Export] Error:', err);
    return { success: false, error: String(err) };
  }
});

// Export batch of vertical reels
ipcMain.handle('export-vertical-reels-batch', async (_event, data: VerticalReelBatchData) => {
  const {
    sourceFile,
    outputDir,
    clips,
    transcript,
    captionSettings,
    inputWidth,
    inputHeight,
  } = data;
  
  const win = getMainWindow();
  
  // Create output directory
  fs.mkdirSync(outputDir, { recursive: true });
  
  const results: Array<{
    clipId: string;
    success: boolean;
    outputFile?: string;
    error?: string;
  }> = [];
  
  let successCount = 0;
  
  for (let i = 0; i < clips.length; i++) {
    const clip = clips[i];
    const actualStart = clip.startTime + (clip.trimStartOffset || 0);
    const actualEnd = clip.endTime + (clip.trimEndOffset || 0);
    
    // Send overall progress
    if (win) {
      win.webContents.send('export-progress', {
        current: i + 1,
        total: clips.length,
        clipName: clip.title || clip.id,
        type: 'vertical-reel',
      });
    }
    
    try {
      const result = await (ipcMain as any)._events['export-vertical-reel'][0](
        null,
        {
          sourceFile,
          outputDir,
          clipId: clip.id,
          startTime: actualStart,
          endTime: actualEnd,
          title: clip.title,
          transcript,
          captionSettings,
          inputWidth,
          inputHeight,
        }
      );
      
      if (result.success) {
        successCount++;
        results.push({
          clipId: clip.id,
          success: true,
          outputFile: result.outputFile,
        });
      } else {
        results.push({
          clipId: clip.id,
          success: false,
          error: result.error,
        });
      }
    } catch (err) {
      results.push({
        clipId: clip.id,
        success: false,
        error: String(err),
      });
    }
  }
  
  // Send completion
  if (win) {
    win.webContents.send('export-complete', {
      success: successCount === clips.length,
      outputDir,
      clipCount: successCount,
      errors: results.filter(r => !r.success).map(r => r.error || 'Unknown error'),
    });
  }
  
  return {
    success: successCount === clips.length,
    total: clips.length,
    successCount,
    results,
    outputDir,
  };
});

// Get video dimensions for crop calculation
ipcMain.handle('get-video-dimensions', async (_event, filePath: string) => {
  return new Promise((resolve) => {
    // Use ffprobe to get dimensions
    let ffprobePath: string;
    try {
      ffprobePath = require('ffprobe-static').path as string;
    } catch {
      ffprobePath = 'ffprobe';
    }
    
    const args = [
      '-v', 'error',
      '-select_streams', 'v:0',
      '-show_entries', 'stream=width,height',
      '-of', 'json',
      filePath
    ];
    
    const ffprobe = spawn(ffprobePath, args, { windowsHide: true });
    let stdout = '';
    let stderr = '';
    
    ffprobe.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    ffprobe.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    ffprobe.on('close', (code) => {
      if (code === 0) {
        try {
          const result = JSON.parse(stdout);
          const stream = result.streams?.[0];
          if (stream) {
            resolve({
              success: true,
              width: stream.width,
              height: stream.height,
            });
          } else {
            resolve({ success: false, error: 'No video stream found' });
          }
        } catch (e) {
          resolve({ success: false, error: `Failed to parse ffprobe output: ${e}` });
        }
      } else {
        resolve({ success: false, error: stderr || `ffprobe exited with code ${code}` });
      }
    });
    
    ffprobe.on('error', (err) => {
      resolve({ success: false, error: String(err) });
    });
  });
});
