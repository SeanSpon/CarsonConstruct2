import { ipcMain, shell } from 'electron';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { getMainWindow } from '../window';

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

  try {
    // Check if source file exists
    if (!fs.existsSync(sourceFile)) {
      win.webContents.send('export-complete', {
        success: false,
        outputDir,
        errors: [`Source file not found: ${sourceFile}`],
      });
      return { success: false, error: 'Source file not found' };
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
  } catch (err) {
    // Catch any unexpected errors during export
    const errorMsg = err instanceof Error ? err.message : String(err);
    win.webContents.send('export-complete', {
      success: false,
      outputDir,
      errors: [`Export failed: ${errorMsg}`],
    });
    return { success: false, error: errorMsg };
  }
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

    const ffmpeg = spawn('ffmpeg', args);
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
      const ffmpeg = spawn('ffmpeg', ['-y', '-i', sourceFile, '-c', 'copy', outputFile]);
      
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

    const ffmpeg = spawn('ffmpeg', args);
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

// Open folder in file explorer
ipcMain.handle('open-folder', async (_event, folderPath: string) => {
  try {
    await shell.openPath(folderPath);
    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
});
