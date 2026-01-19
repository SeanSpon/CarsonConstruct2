/**
 * Premiere Pro / NLE Export Utilities
 * 
 * Generates FCP XML, EDL, and markers CSV files for import into:
 * - Adobe Premiere Pro
 * - DaVinci Resolve
 * - Final Cut Pro
 * - Avid Media Composer
 * - And other NLEs
 */

import * as fs from 'fs';
import * as path from 'path';
import { ipcMain } from 'electron';
import { getMainWindow } from '../window';

// Types for NLE export
interface NLEClip {
  id: string;
  name: string;
  startTime: number;
  endTime: number;
  duration: number;
  pattern?: string;
  finalScore?: number;
  category?: string;
  hookText?: string;
  trimStartOffset?: number;
  trimEndOffset?: number;
}

interface NLEDeadSpace {
  id: string;
  startTime: number;
  endTime: number;
  duration: number;
  remove: boolean;
}

interface NLEExportData {
  sourceFile: string;
  sequenceName: string;
  clips: NLEClip[];
  deadSpaces: NLEDeadSpace[];
  outputDir: string;
  frameRate: number;
  dropFrame: boolean;
  videoDuration: number;
  videoWidth?: number;
  videoHeight?: number;
}

// ============================================================================
// TIMECODE UTILITIES
// ============================================================================

/**
 * Convert seconds to SMPTE timecode (HH:MM:SS:FF)
 */
function secondsToTimecode(seconds: number, frameRate: number, dropFrame: boolean = false): string {
  const totalFrames = Math.round(seconds * frameRate);
  return framesToTimecode(totalFrames, frameRate, dropFrame);
}

/**
 * Convert frame count to SMPTE timecode
 */
function framesToTimecode(totalFrames: number, frameRate: number, dropFrame: boolean = false): string {
  const fps = Math.round(frameRate);
  let frames = totalFrames;
  
  // Drop frame calculation (for 29.97 and 59.94 fps)
  if (dropFrame && (fps === 30 || fps === 60)) {
    const dropFrames = fps === 30 ? 2 : 4;
    const framesPerMin = fps * 60 - dropFrames;
    const framesPer10Min = framesPerMin * 10 + dropFrames;
    
    const d = Math.floor(frames / framesPer10Min);
    const m = frames % framesPer10Min;
    
    if (m > dropFrames) {
      frames += dropFrames * 9 * d + dropFrames * Math.floor((m - dropFrames) / framesPerMin);
    } else {
      frames += dropFrames * 9 * d;
    }
  }
  
  const separator = dropFrame ? ';' : ':';
  const ff = frames % fps;
  const ss = Math.floor(frames / fps) % 60;
  const mm = Math.floor(frames / (fps * 60)) % 60;
  const hh = Math.floor(frames / (fps * 60 * 60));
  
  return `${hh.toString().padStart(2, '0')}:${mm.toString().padStart(2, '0')}:${ss.toString().padStart(2, '0')}${separator}${ff.toString().padStart(2, '0')}`;
}

/**
 * Convert seconds to frame count
 */
function secondsToFrames(seconds: number, frameRate: number): number {
  return Math.round(seconds * frameRate);
}

// ============================================================================
// FCP XML EXPORT (Final Cut Pro XML - Compatible with Premiere, Resolve, FCP)
// ============================================================================

/**
 * Generate FCP XML 1.0 format sequence
 * This format is widely compatible with Premiere Pro, DaVinci Resolve, and Final Cut Pro
 */
function generateFCPXML(data: NLEExportData): string {
  const {
    sourceFile,
    sequenceName,
    clips,
    deadSpaces,
    frameRate,
    videoDuration,
    videoWidth = 1920,
    videoHeight = 1080,
  } = data;
  
  const fileName = path.basename(sourceFile);
  const filePathUri = `file://localhost/${sourceFile.replace(/\\/g, '/').replace(/^([A-Z]):/, '$1%3A')}`;
  const totalFrames = secondsToFrames(videoDuration, frameRate);
  const fps = Math.round(frameRate);
  const timebase = fps;
  const ntsc = frameRate === 29.97 || frameRate === 23.976 || frameRate === 59.94;
  
  // Generate unique IDs
  const sequenceId = `sequence-${Date.now()}`;
  const masterClipId = `masterclip-1`;
  const fileId = `file-1`;
  
  // Build clip items for the sequence
  let clipItems = '';
  let markerItems = '';
  
  // Add clips as markers and timeline regions
  clips.forEach((clip, index) => {
    const actualStart = clip.startTime + (clip.trimStartOffset || 0);
    const actualEnd = clip.endTime + (clip.trimEndOffset || 0);
    const startFrame = secondsToFrames(actualStart, frameRate);
    const endFrame = secondsToFrames(actualEnd, frameRate);
    const duration = endFrame - startFrame;
    
    // Add as marker
    markerItems += `
        <marker>
          <comment>${escapeXml(clip.hookText || clip.pattern || 'Clip')}</comment>
          <name>${escapeXml(clip.name || `Clip ${index + 1}`)}</name>
          <in>${startFrame}</in>
          <out>${endFrame}</out>
        </marker>`;
    
    // Add as clipitem on track
    clipItems += `
          <clipitem id="clipitem-${index + 1}">
            <name>${escapeXml(clip.name || `Clip ${index + 1}`)}</name>
            <enabled>TRUE</enabled>
            <duration>${duration}</duration>
            <start>${startFrame}</start>
            <end>${endFrame}</end>
            <in>${startFrame}</in>
            <out>${endFrame}</out>
            <masterclipid>${masterClipId}</masterclipid>
            <file id="${fileId}-ref-${index}">
              <name>${escapeXml(fileName)}</name>
              <pathurl>${escapeXml(filePathUri)}</pathurl>
            </file>
            <labels>
              <label2>${getClipColor(clip.pattern)}</label2>
            </labels>
          </clipitem>`;
  });
  
  // Add dead spaces as markers (red color)
  deadSpaces.filter(ds => ds.remove).forEach((ds, index) => {
    const startFrame = secondsToFrames(ds.startTime, frameRate);
    const endFrame = secondsToFrames(ds.endTime, frameRate);
    
    markerItems += `
        <marker>
          <comment>Dead Space - ${ds.duration.toFixed(1)}s</comment>
          <name>Dead Space ${index + 1}</name>
          <in>${startFrame}</in>
          <out>${endFrame}</out>
          <color>Red</color>
        </marker>`;
  });
  
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE xmeml>
<xmeml version="5">
  <sequence id="${sequenceId}">
    <name>${escapeXml(sequenceName)}</name>
    <duration>${totalFrames}</duration>
    <rate>
      <timebase>${timebase}</timebase>
      <ntsc>${ntsc ? 'TRUE' : 'FALSE'}</ntsc>
    </rate>
    <timecode>
      <rate>
        <timebase>${timebase}</timebase>
        <ntsc>${ntsc ? 'TRUE' : 'FALSE'}</ntsc>
      </rate>
      <string>00:00:00:00</string>
      <frame>0</frame>
      <displayformat>NDF</displayformat>
    </timecode>
    <in>-1</in>
    <out>-1</out>
    <media>
      <video>
        <format>
          <samplecharacteristics>
            <width>${videoWidth}</width>
            <height>${videoHeight}</height>
            <anamorphic>FALSE</anamorphic>
            <pixelaspectratio>square</pixelaspectratio>
            <fielddominance>none</fielddominance>
            <rate>
              <timebase>${timebase}</timebase>
              <ntsc>${ntsc ? 'TRUE' : 'FALSE'}</ntsc>
            </rate>
          </samplecharacteristics>
        </format>
        <track>
          <clipitem id="main-clip">
            <name>${escapeXml(fileName)}</name>
            <enabled>TRUE</enabled>
            <duration>${totalFrames}</duration>
            <start>0</start>
            <end>${totalFrames}</end>
            <in>0</in>
            <out>${totalFrames}</out>
            <masterclipid>${masterClipId}</masterclipid>
            <file id="${fileId}">
              <name>${escapeXml(fileName)}</name>
              <pathurl>${escapeXml(filePathUri)}</pathurl>
              <duration>${totalFrames}</duration>
              <rate>
                <timebase>${timebase}</timebase>
                <ntsc>${ntsc ? 'TRUE' : 'FALSE'}</ntsc>
              </rate>
              <media>
                <video>
                  <samplecharacteristics>
                    <width>${videoWidth}</width>
                    <height>${videoHeight}</height>
                  </samplecharacteristics>
                </video>
                <audio>
                  <channelcount>2</channelcount>
                </audio>
              </media>
            </file>
            ${markerItems}
          </clipitem>
        </track>
        <track>
          <enabled>TRUE</enabled>
          <locked>FALSE</locked>
          ${clipItems}
        </track>
      </video>
      <audio>
        <numOutputChannels>2</numOutputChannels>
        <format>
          <samplecharacteristics>
            <depth>16</depth>
            <samplerate>48000</samplerate>
          </samplecharacteristics>
        </format>
        <track>
          <clipitem id="audio-main">
            <name>${escapeXml(fileName)}</name>
            <enabled>TRUE</enabled>
            <duration>${totalFrames}</duration>
            <start>0</start>
            <end>${totalFrames}</end>
            <in>0</in>
            <out>${totalFrames}</out>
            <masterclipid>${masterClipId}</masterclipid>
            <file id="${fileId}-audio"/>
          </clipitem>
        </track>
      </audio>
    </media>
  </sequence>
</xmeml>`;
  
  return xml;
}

/**
 * Escape special XML characters
 */
function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Get FCP XML color label based on clip pattern
 */
function getClipColor(pattern?: string): string {
  switch (pattern) {
    case 'payoff': return 'Violet';
    case 'monologue': return 'Blue';
    case 'laughter': return 'Green';
    case 'debate': return 'Orange';
    default: return 'Yellow';
  }
}

// ============================================================================
// EDL EXPORT (Edit Decision List - Universal NLE Format)
// ============================================================================

/**
 * Generate CMX 3600 EDL format
 * Most universal format, supported by virtually all NLEs
 */
function generateEDL(data: NLEExportData): string {
  const {
    sourceFile,
    sequenceName,
    clips,
    frameRate,
    dropFrame,
  } = data;
  
  const fileName = path.basename(sourceFile, path.extname(sourceFile));
  const reelName = fileName.substring(0, 8).toUpperCase().replace(/[^A-Z0-9]/g, '');
  
  let edl = `TITLE: ${sequenceName}\n`;
  edl += `FCM: ${dropFrame ? 'DROP FRAME' : 'NON-DROP FRAME'}\n\n`;
  
  // Sort clips by start time
  const sortedClips = [...clips].sort((a, b) => a.startTime - b.startTime);
  
  let recordIn = 0; // Running record timeline position
  
  sortedClips.forEach((clip, index) => {
    const editNum = (index + 1).toString().padStart(3, '0');
    const actualStart = clip.startTime + (clip.trimStartOffset || 0);
    const actualEnd = clip.endTime + (clip.trimEndOffset || 0);
    const clipDuration = actualEnd - actualStart;
    
    const sourceIn = secondsToTimecode(actualStart, frameRate, dropFrame);
    const sourceOut = secondsToTimecode(actualEnd, frameRate, dropFrame);
    const recordInTC = secondsToTimecode(recordIn, frameRate, dropFrame);
    const recordOutTC = secondsToTimecode(recordIn + clipDuration, frameRate, dropFrame);
    
    // CMX 3600 format: EDIT# REEL CHANNEL TRANS SOURCE_IN SOURCE_OUT RECORD_IN RECORD_OUT
    edl += `${editNum}  ${reelName || 'AX'}       V     C        ${sourceIn} ${sourceOut} ${recordInTC} ${recordOutTC}\n`;
    
    // Add comment with clip info
    if (clip.name || clip.hookText) {
      edl += `* FROM CLIP NAME: ${clip.name || 'Untitled'}\n`;
    }
    if (clip.hookText) {
      edl += `* COMMENT: ${clip.hookText}\n`;
    }
    if (clip.pattern) {
      edl += `* PATTERN: ${clip.pattern}\n`;
    }
    if (clip.finalScore) {
      edl += `* SCORE: ${clip.finalScore.toFixed(1)}\n`;
    }
    edl += '\n';
    
    recordIn += clipDuration;
  });
  
  return edl;
}

// ============================================================================
// MARKERS CSV EXPORT (For Premiere Pro Marker Import)
// ============================================================================

/**
 * Generate CSV format markers for Premiere Pro
 * Can be imported via Premiere's marker import feature
 */
function generateMarkersCSV(data: NLEExportData): string {
  const { clips, deadSpaces, frameRate } = data;
  
  // CSV header for Premiere Pro marker import
  let csv = 'Marker Name,Description,In,Out,Duration,Marker Type\n';
  
  // Add clips as markers
  clips.forEach((clip, index) => {
    const actualStart = clip.startTime + (clip.trimStartOffset || 0);
    const actualEnd = clip.endTime + (clip.trimEndOffset || 0);
    const duration = actualEnd - actualStart;
    
    const inTC = secondsToTimecode(actualStart, frameRate, false);
    const outTC = secondsToTimecode(actualEnd, frameRate, false);
    const durationTC = secondsToTimecode(duration, frameRate, false);
    
    const name = escapeCSV(clip.name || `Clip ${index + 1}`);
    const description = escapeCSV(
      [
        clip.hookText || '',
        clip.pattern ? `Pattern: ${clip.pattern}` : '',
        clip.finalScore ? `Score: ${clip.finalScore.toFixed(1)}` : '',
        clip.category || '',
      ].filter(Boolean).join(' | ')
    );
    
    csv += `${name},${description},${inTC},${outTC},${durationTC},Comment\n`;
  });
  
  // Add dead spaces as markers
  deadSpaces.filter(ds => ds.remove).forEach((ds, index) => {
    const inTC = secondsToTimecode(ds.startTime, frameRate, false);
    const outTC = secondsToTimecode(ds.endTime, frameRate, false);
    const durationTC = secondsToTimecode(ds.duration, frameRate, false);
    
    const name = `Dead Space ${index + 1}`;
    const description = `Silence/dead air - ${ds.duration.toFixed(1)} seconds`;
    
    csv += `${name},${description},${inTC},${outTC},${durationTC},Comment\n`;
  });
  
  return csv;
}

/**
 * Escape CSV field value
 */
function escapeCSV(str: string): string {
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

// ============================================================================
// PREMIERE PRO MARKER FILE (.prproj marker format)
// ============================================================================

/**
 * Generate Premiere Pro compatible marker JSON
 * This can be imported via Premiere's ExtendScript or third-party plugins
 */
function generatePremiereMarkers(data: NLEExportData): string {
  const { clips, deadSpaces, frameRate, sequenceName } = data;
  
  const markers: Array<{
    name: string;
    comment: string;
    start: number;
    end: number;
    startTimecode: string;
    endTimecode: string;
    duration: number;
    color: string;
    type: string;
    metadata: Record<string, unknown>;
  }> = [];
  
  // Add clips as markers
  clips.forEach((clip, index) => {
    const actualStart = clip.startTime + (clip.trimStartOffset || 0);
    const actualEnd = clip.endTime + (clip.trimEndOffset || 0);
    
    markers.push({
      name: clip.name || `Clip ${index + 1}`,
      comment: clip.hookText || clip.pattern || 'Detected clip',
      start: actualStart,
      end: actualEnd,
      startTimecode: secondsToTimecode(actualStart, frameRate, false),
      endTimecode: secondsToTimecode(actualEnd, frameRate, false),
      duration: actualEnd - actualStart,
      color: getPremiereColor(clip.pattern),
      type: 'comment',
      metadata: {
        pattern: clip.pattern,
        finalScore: clip.finalScore,
        category: clip.category,
        hookText: clip.hookText,
        algorithmDetected: true,
      },
    });
  });
  
  // Add dead spaces as red markers
  deadSpaces.filter(ds => ds.remove).forEach((ds, index) => {
    markers.push({
      name: `Dead Space ${index + 1}`,
      comment: `Silence/dead air - ${ds.duration.toFixed(1)}s`,
      start: ds.startTime,
      end: ds.endTime,
      startTimecode: secondsToTimecode(ds.startTime, frameRate, false),
      endTimecode: secondsToTimecode(ds.endTime, frameRate, false),
      duration: ds.duration,
      color: 'Red',
      type: 'comment',
      metadata: {
        isDeadSpace: true,
        markedForRemoval: ds.remove,
      },
    });
  });
  
  const output = {
    version: '1.0',
    generator: 'PodFlow Studio',
    exportDate: new Date().toISOString(),
    sequenceName: sequenceName,
    frameRate: frameRate,
    markers: markers,
  };
  
  return JSON.stringify(output, null, 2);
}

/**
 * Get Premiere Pro marker color based on pattern
 */
function getPremiereColor(pattern?: string): string {
  switch (pattern) {
    case 'payoff': return 'Purple';
    case 'monologue': return 'Blue';
    case 'laughter': return 'Green';
    case 'debate': return 'Orange';
    default: return 'Yellow';
  }
}

// ============================================================================
// IPC HANDLERS
// ============================================================================

// Export to FCP XML
ipcMain.handle('export-fcp-xml', async (_event, data: NLEExportData) => {
  try {
    const xml = generateFCPXML(data);
    const outputPath = path.join(data.outputDir, `${data.sequenceName || 'sequence'}.xml`);
    
    if (!fs.existsSync(data.outputDir)) {
      fs.mkdirSync(data.outputDir, { recursive: true });
    }
    
    fs.writeFileSync(outputPath, xml, 'utf8');
    
    return { success: true, path: outputPath };
  } catch (err) {
    return { success: false, error: String(err) };
  }
});

// Export to EDL
ipcMain.handle('export-edl', async (_event, data: NLEExportData) => {
  try {
    const edl = generateEDL(data);
    const outputPath = path.join(data.outputDir, `${data.sequenceName || 'sequence'}.edl`);
    
    if (!fs.existsSync(data.outputDir)) {
      fs.mkdirSync(data.outputDir, { recursive: true });
    }
    
    fs.writeFileSync(outputPath, edl, 'utf8');
    
    return { success: true, path: outputPath };
  } catch (err) {
    return { success: false, error: String(err) };
  }
});

// Export markers CSV
ipcMain.handle('export-markers-csv', async (_event, data: NLEExportData) => {
  try {
    const csv = generateMarkersCSV(data);
    const outputPath = path.join(data.outputDir, `${data.sequenceName || 'markers'}_markers.csv`);
    
    if (!fs.existsSync(data.outputDir)) {
      fs.mkdirSync(data.outputDir, { recursive: true });
    }
    
    fs.writeFileSync(outputPath, csv, 'utf8');
    
    return { success: true, path: outputPath };
  } catch (err) {
    return { success: false, error: String(err) };
  }
});

// Export Premiere markers JSON
ipcMain.handle('export-premiere-markers', async (_event, data: NLEExportData) => {
  try {
    const json = generatePremiereMarkers(data);
    const outputPath = path.join(data.outputDir, `${data.sequenceName || 'markers'}_premiere_markers.json`);
    
    if (!fs.existsSync(data.outputDir)) {
      fs.mkdirSync(data.outputDir, { recursive: true });
    }
    
    fs.writeFileSync(outputPath, json, 'utf8');
    
    return { success: true, path: outputPath };
  } catch (err) {
    return { success: false, error: String(err) };
  }
});

// Export all NLE formats at once
ipcMain.handle('export-all-nle-formats', async (_event, data: NLEExportData) => {
  const win = getMainWindow();
  const results: { format: string; success: boolean; path?: string; error?: string }[] = [];
  
  try {
    if (!fs.existsSync(data.outputDir)) {
      fs.mkdirSync(data.outputDir, { recursive: true });
    }
    
    const baseName = data.sequenceName || 'sequence';
    
    // Export FCP XML
    win?.webContents.send('nle-export-progress', { format: 'FCP XML', status: 'exporting' });
    try {
      const xml = generateFCPXML(data);
      const xmlPath = path.join(data.outputDir, `${baseName}.xml`);
      fs.writeFileSync(xmlPath, xml, 'utf8');
      results.push({ format: 'fcp-xml', success: true, path: xmlPath });
    } catch (err) {
      results.push({ format: 'fcp-xml', success: false, error: String(err) });
    }
    
    // Export EDL
    win?.webContents.send('nle-export-progress', { format: 'EDL', status: 'exporting' });
    try {
      const edl = generateEDL(data);
      const edlPath = path.join(data.outputDir, `${baseName}.edl`);
      fs.writeFileSync(edlPath, edl, 'utf8');
      results.push({ format: 'edl', success: true, path: edlPath });
    } catch (err) {
      results.push({ format: 'edl', success: false, error: String(err) });
    }
    
    // Export Markers CSV
    win?.webContents.send('nle-export-progress', { format: 'Markers CSV', status: 'exporting' });
    try {
      const csv = generateMarkersCSV(data);
      const csvPath = path.join(data.outputDir, `${baseName}_markers.csv`);
      fs.writeFileSync(csvPath, csv, 'utf8');
      results.push({ format: 'markers-csv', success: true, path: csvPath });
    } catch (err) {
      results.push({ format: 'markers-csv', success: false, error: String(err) });
    }
    
    // Export Premiere Markers JSON
    win?.webContents.send('nle-export-progress', { format: 'Premiere Markers', status: 'exporting' });
    try {
      const json = generatePremiereMarkers(data);
      const jsonPath = path.join(data.outputDir, `${baseName}_premiere_markers.json`);
      fs.writeFileSync(jsonPath, json, 'utf8');
      results.push({ format: 'premiere-markers', success: true, path: jsonPath });
    } catch (err) {
      results.push({ format: 'premiere-markers', success: false, error: String(err) });
    }
    
    win?.webContents.send('nle-export-progress', { format: 'All', status: 'complete' });
    
    const successCount = results.filter(r => r.success).length;
    return {
      success: successCount > 0,
      totalFormats: results.length,
      successCount,
      results,
      outputDir: data.outputDir,
    };
  } catch (err) {
    return { success: false, error: String(err), results };
  }
});

console.log('[PremiereExport] NLE export handlers registered');
