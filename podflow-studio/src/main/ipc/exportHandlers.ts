import { ipcMain, shell } from 'electron';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
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

interface DeadSpace {
  id: string;
  startTime: number;
  endTime: number;
  remove: boolean;
}

interface ExportSettings {
  format: 'mp4' | 'mov';
  mode: 'fast' | 'accurate';
  exportClips: boolean;
  exportFullVideo: boolean;
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
  
  if (!win) {
    return { success: false, error: 'Window not found' };
  }

  // Ensure output directory exists
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const errors: string[] = [];
  let completed = 0;
  const totalTasks = (settings.exportClips ? clips.length : 0) + (settings.exportFullVideo ? 1 : 0);

  // Export individual clips
  if (settings.exportClips) {
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

      win.webContents.send('export-progress', {
        current: completed + 1,
        total: totalTasks,
        clipName: clip.title || `Clip ${i + 1}`,
        type: 'clip',
      });

      try {
        await exportSingleClip(sourceFile, outputFile, actualStart, duration, settings.mode);
        
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
        errors.push(`Failed to export ${clip.title || clip.id}: ${err}`);
      }
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
  win.webContents.send('export-complete', {
    success: errors.length === 0,
    outputDir,
    clipCount: completed,
    errors,
  });

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
