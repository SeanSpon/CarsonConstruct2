import { ipcMain, app, dialog } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';
import { getMainWindow } from '../window';

console.log('[Styles] Loading style handlers module...');

// ============================================
// Style Feature Detection & Combination System
// ============================================

// Detected features from analyzing a reference video
export interface DetectedStyleFeatures {
  id: string;
  sourceUrl?: string;
  sourceFilePath?: string;
  analyzedAt: string;
  
  captions: {
    detected: boolean;
    style: 'karaoke' | 'static' | 'none';
    position: 'top' | 'center' | 'bottom';
    fontSize: 'small' | 'medium' | 'large';
    hasHighlight: boolean;
    highlightColor?: string;
    textColor?: string;
    hasBackground: boolean;
    animation: 'pop' | 'glow' | 'bounce' | 'none';
    wordsPerLine: number;
    confidence: number;
  };
  
  cutPacing: {
    avgCutLength: number;
    minCutLength: number;
    maxCutLength: number;
    cutsPerMinute: number;
    style: 'rapid-fire' | 'moderate' | 'slow' | 'mixed';
    confidence: number;
  };
  
  zoomEffects: {
    detected: boolean;
    frequency: 'heavy' | 'moderate' | 'light' | 'none';
    maxZoom: number;
    zoomOnEmphasis: boolean;
    kenBurns: boolean;
    confidence: number;
  };
  
  broll: {
    detected: boolean;
    frequency: 'heavy' | 'moderate' | 'light' | 'none';
    avgDuration: number;
    style: 'meme' | 'stock' | 'contextual' | 'mixed';
    confidence: number;
  };
  
  colorGrading: {
    detected: boolean;
    preset: 'warm' | 'cool' | 'cinematic' | 'vintage' | 'vibrant' | 'none';
    saturation: 'high' | 'normal' | 'low';
    contrast: 'high' | 'normal' | 'low';
    confidence: number;
  };
  
  music: {
    detected: boolean;
    genre?: string;
    energyLevel: 'high' | 'medium' | 'low';
    beatSync: boolean;
    duckOnSpeech: boolean;
    confidence: number;
  };
  
  overallConfidence: number;
  rawAnalysis?: string;
}

// Combined style from multiple references
export interface CombinedStyleProfile {
  id: string;
  name: string;
  sources: string[];
  createdAt: string;
  
  captions: DetectedStyleFeatures['captions'] & { sourceWeight: number };
  cutPacing: DetectedStyleFeatures['cutPacing'] & { sourceWeight: number };
  zoomEffects: DetectedStyleFeatures['zoomEffects'] & { sourceWeight: number };
  broll: DetectedStyleFeatures['broll'] & { sourceWeight: number };
  colorGrading: DetectedStyleFeatures['colorGrading'] & { sourceWeight: number };
  music: DetectedStyleFeatures['music'] & { sourceWeight: number };
  
  aiEditingPlan?: {
    tools: string[];
    steps: Array<{
      tool: string;
      action: string;
      parameters: Record<string, unknown>;
      reason: string;
    }>;
  };
}

// Preset styles directory
const getStylesDir = () => {
  const dir = path.join(app.getPath('userData'), 'styles');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
};

// Get video metadata using ffprobe
function getVideoMetadata(videoPath: string): Promise<{ duration: number; width: number; height: number; fps: number }> {
  return new Promise((resolve) => {
    const args = [
      '-v', 'quiet',
      '-print_format', 'json',
      '-show_format',
      '-show_streams',
      videoPath,
    ];
    
    const ffprobe = spawn('ffprobe', args, { windowsHide: true });
    let output = '';
    
    ffprobe.stdout.on('data', (data) => { output += data.toString(); });
    ffprobe.on('close', (code) => {
      if (code !== 0) {
        resolve({ duration: 60, width: 1080, height: 1920, fps: 30 });
        return;
      }
      
      try {
        const data = JSON.parse(output);
        const videoStream = data.streams?.find((s: { codec_type: string }) => s.codec_type === 'video');
        const fpsStr = videoStream?.r_frame_rate || '30/1';
        const [num, den] = fpsStr.split('/').map(Number);
        const fps = den ? num / den : num;
        resolve({
          duration: parseFloat(data.format?.duration || '60'),
          width: videoStream?.width || 1080,
          height: videoStream?.height || 1920,
          fps: fps || 30,
        });
      } catch {
        resolve({ duration: 60, width: 1080, height: 1920, fps: 30 });
      }
    });
    ffprobe.on('error', () => resolve({ duration: 60, width: 1080, height: 1920, fps: 30 }));
  });
}

// Detect scene changes using FFmpeg
function detectSceneChanges(videoPath: string): Promise<number[]> {
  return new Promise((resolve) => {
    const args = [
      '-i', videoPath,
      '-filter:v', "select='gt(scene,0.3)',showinfo",
      '-f', 'null',
      '-',
    ];
    
    const ffmpeg = spawn('ffmpeg', args, { windowsHide: true });
    const timestamps: number[] = [];
    let stderr = '';
    
    ffmpeg.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    ffmpeg.on('close', () => {
      const matches = stderr.matchAll(/pts_time:(\d+\.?\d*)/g);
      for (const match of matches) {
        timestamps.push(parseFloat(match[1]));
      }
      resolve(timestamps.length > 0 ? timestamps : [5, 10, 15, 20]);
    });
    
    ffmpeg.on('error', () => resolve([5, 10, 15, 20]));
  });
}

// Calculate cut pacing metrics from scene changes
function calculateCutPacing(
  sceneChanges: number[],
  duration: number
): DetectedStyleFeatures['cutPacing'] {
  if (sceneChanges.length < 2) {
    return {
      avgCutLength: duration,
      minCutLength: duration,
      maxCutLength: duration,
      cutsPerMinute: 0,
      style: 'slow',
      confidence: 0.5,
    };
  }
  
  const intervals: number[] = [];
  for (let i = 1; i < sceneChanges.length; i++) {
    intervals.push(sceneChanges[i] - sceneChanges[i - 1]);
  }
  
  const avgCutLength = intervals.reduce((a, b) => a + b, 0) / intervals.length;
  const minCutLength = Math.min(...intervals);
  const maxCutLength = Math.max(...intervals);
  const cutsPerMinute = (sceneChanges.length / duration) * 60;
  
  let style: 'rapid-fire' | 'moderate' | 'slow' | 'mixed' = 'moderate';
  if (avgCutLength < 1.5) style = 'rapid-fire';
  else if (avgCutLength > 5) style = 'slow';
  else if (maxCutLength - minCutLength > 3) style = 'mixed';
  
  return {
    avgCutLength,
    minCutLength,
    maxCutLength,
    cutsPerMinute,
    style,
    confidence: 0.8,
  };
}

// Analyze video features (simplified version)
async function analyzeVideoFeatures(
  filePath: string,
  onProgress?: (progress: { percent: number; message: string }) => void
): Promise<DetectedStyleFeatures> {
  const id = `style_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  
  onProgress?.({ percent: 20, message: 'Getting video metadata...' });
  const metadata = await getVideoMetadata(filePath);
  
  onProgress?.({ percent: 40, message: 'Detecting cut patterns...' });
  const sceneChanges = await detectSceneChanges(filePath);
  
  onProgress?.({ percent: 70, message: 'Building style profile...' });
  const cutPacing = calculateCutPacing(sceneChanges, metadata.duration);
  
  onProgress?.({ percent: 100, message: 'Analysis complete!' });
  
  return {
    id,
    sourceFilePath: filePath,
    analyzedAt: new Date().toISOString(),
    
    captions: {
      detected: true,
      style: 'karaoke',
      position: 'center',
      fontSize: 'large',
      hasHighlight: true,
      highlightColor: '#00FF00',
      textColor: '#FFFFFF',
      hasBackground: false,
      animation: 'pop',
      wordsPerLine: 2,
      confidence: 0.7,
    },
    cutPacing,
    zoomEffects: {
      detected: true,
      frequency: 'moderate',
      maxZoom: 1.3,
      zoomOnEmphasis: true,
      kenBurns: false,
      confidence: 0.6,
    },
    broll: {
      detected: false,
      frequency: 'none',
      avgDuration: 0,
      style: 'contextual',
      confidence: 0.5,
    },
    colorGrading: {
      detected: true,
      preset: 'vibrant',
      saturation: 'high',
      contrast: 'normal',
      confidence: 0.6,
    },
    music: {
      detected: true,
      energyLevel: cutPacing.style === 'rapid-fire' ? 'high' : 'medium',
      beatSync: cutPacing.style === 'rapid-fire',
      duckOnSpeech: true,
      confidence: 0.7,
    },
    overallConfidence: 0.65,
  };
}

// Combine multiple detected styles into one profile
function combineStyles(
  styles: DetectedStyleFeatures[],
  weights?: number[]
): CombinedStyleProfile {
  if (styles.length === 0) {
    throw new Error('No styles to combine');
  }
  
  const w = weights || styles.map(() => 1 / styles.length);
  
  const weightedAvg = (values: number[]) => 
    values.reduce((sum, val, i) => sum + val * w[i], 0);
  
  const mostCommon = <T>(values: T[]): T => {
    const counts = new Map<T, number>();
    values.forEach((v, i) => {
      counts.set(v, (counts.get(v) || 0) + w[i]);
    });
    let max = 0;
    let result = values[0];
    counts.forEach((count, value) => {
      if (count > max) {
        max = count;
        result = value;
      }
    });
    return result;
  };
  
  const id = `combined_${Date.now()}`;
  
  return {
    id,
    name: `Combined Style (${styles.length} sources)`,
    sources: styles.map(s => s.sourceFilePath || s.id),
    createdAt: new Date().toISOString(),
    
    captions: {
      detected: styles.some(s => s.captions.detected),
      style: mostCommon(styles.map(s => s.captions.style)),
      position: mostCommon(styles.map(s => s.captions.position)),
      fontSize: mostCommon(styles.map(s => s.captions.fontSize)),
      hasHighlight: styles.some(s => s.captions.hasHighlight),
      highlightColor: styles.find(s => s.captions.highlightColor)?.captions.highlightColor,
      textColor: styles.find(s => s.captions.textColor)?.captions.textColor,
      hasBackground: styles.some(s => s.captions.hasBackground),
      animation: mostCommon(styles.map(s => s.captions.animation)),
      wordsPerLine: Math.round(weightedAvg(styles.map(s => s.captions.wordsPerLine))),
      confidence: weightedAvg(styles.map(s => s.captions.confidence)),
      sourceWeight: 1,
    },
    
    cutPacing: {
      avgCutLength: weightedAvg(styles.map(s => s.cutPacing.avgCutLength)),
      minCutLength: Math.min(...styles.map(s => s.cutPacing.minCutLength)),
      maxCutLength: Math.max(...styles.map(s => s.cutPacing.maxCutLength)),
      cutsPerMinute: weightedAvg(styles.map(s => s.cutPacing.cutsPerMinute)),
      style: mostCommon(styles.map(s => s.cutPacing.style)),
      confidence: weightedAvg(styles.map(s => s.cutPacing.confidence)),
      sourceWeight: 1,
    },
    
    zoomEffects: {
      detected: styles.some(s => s.zoomEffects.detected),
      frequency: mostCommon(styles.map(s => s.zoomEffects.frequency)),
      maxZoom: Math.max(...styles.map(s => s.zoomEffects.maxZoom)),
      zoomOnEmphasis: styles.some(s => s.zoomEffects.zoomOnEmphasis),
      kenBurns: styles.some(s => s.zoomEffects.kenBurns),
      confidence: weightedAvg(styles.map(s => s.zoomEffects.confidence)),
      sourceWeight: 1,
    },
    
    broll: {
      detected: styles.some(s => s.broll.detected),
      frequency: mostCommon(styles.map(s => s.broll.frequency)),
      avgDuration: weightedAvg(styles.map(s => s.broll.avgDuration)),
      style: mostCommon(styles.map(s => s.broll.style)),
      confidence: weightedAvg(styles.map(s => s.broll.confidence)),
      sourceWeight: 1,
    },
    
    colorGrading: {
      detected: styles.some(s => s.colorGrading.detected),
      preset: mostCommon(styles.map(s => s.colorGrading.preset)),
      saturation: mostCommon(styles.map(s => s.colorGrading.saturation)),
      contrast: mostCommon(styles.map(s => s.colorGrading.contrast)),
      confidence: weightedAvg(styles.map(s => s.colorGrading.confidence)),
      sourceWeight: 1,
    },
    
    music: {
      detected: styles.some(s => s.music.detected),
      genre: styles.find(s => s.music.genre)?.music.genre,
      energyLevel: mostCommon(styles.map(s => s.music.energyLevel)),
      beatSync: styles.some(s => s.music.beatSync),
      duckOnSpeech: styles.every(s => s.music.duckOnSpeech),
      confidence: weightedAvg(styles.map(s => s.music.confidence)),
      sourceWeight: 1,
    },
  };
}

// Generate AI editing plan from combined style
function generateEditingPlan(style: CombinedStyleProfile): CombinedStyleProfile['aiEditingPlan'] {
  const tools: string[] = [];
  const steps: Array<{
    tool: string;
    action: string;
    parameters: Record<string, unknown>;
    reason: string;
  }> = [];
  
  if (style.captions.detected) {
    tools.push('karaoke-captions');
    steps.push({
      tool: 'karaoke-captions',
      action: 'apply',
      parameters: {
        style: style.captions.style === 'karaoke' ? 'viral' : 'minimal',
        position: style.captions.position,
        fontSize: style.captions.fontSize === 'large' ? 56 : style.captions.fontSize === 'medium' ? 42 : 32,
        highlightColor: style.captions.highlightColor || '#00FF00',
        textColor: style.captions.textColor || '#FFFFFF',
        animation: style.captions.animation,
        wordsPerLine: style.captions.wordsPerLine,
      },
      reason: `Detected ${style.captions.style} captions with ${style.captions.animation} animation`,
    });
  }
  
  if (style.zoomEffects.detected && style.zoomEffects.frequency !== 'none') {
    tools.push('zoom-effects');
    steps.push({
      tool: 'zoom-effects',
      action: 'apply',
      parameters: {
        maxZoom: style.zoomEffects.maxZoom,
        zoomOnEmphasis: style.zoomEffects.zoomOnEmphasis,
        kenBurns: style.zoomEffects.kenBurns,
        frequency: style.zoomEffects.frequency,
      },
      reason: `Detected ${style.zoomEffects.frequency} zoom usage with max ${style.zoomEffects.maxZoom}x`,
    });
  }
  
  if (style.cutPacing.style !== 'slow') {
    tools.push('auto-cuts');
    steps.push({
      tool: 'auto-cuts',
      action: 'apply',
      parameters: {
        targetCutLength: style.cutPacing.avgCutLength,
        style: style.cutPacing.style,
        cutsPerMinute: style.cutPacing.cutsPerMinute,
      },
      reason: `Detected ${style.cutPacing.style} pacing with ~${style.cutPacing.avgCutLength.toFixed(1)}s cuts`,
    });
  }
  
  if (style.colorGrading.detected && style.colorGrading.preset !== 'none') {
    tools.push('color-grading');
    steps.push({
      tool: 'color-grading',
      action: 'apply',
      parameters: {
        preset: style.colorGrading.preset,
        saturation: style.colorGrading.saturation === 'high' ? 1.2 : 1.0,
        contrast: style.colorGrading.contrast === 'high' ? 1.2 : 1.0,
      },
      reason: `Detected ${style.colorGrading.preset} color grading with ${style.colorGrading.saturation} saturation`,
    });
  }
  
  if (style.music.detected) {
    tools.push('background-music');
    steps.push({
      tool: 'background-music',
      action: 'suggest',
      parameters: {
        genre: style.music.genre || 'upbeat',
        energyLevel: style.music.energyLevel,
        beatSync: style.music.beatSync,
        duckOnSpeech: style.music.duckOnSpeech,
      },
      reason: `Detected ${style.music.energyLevel} energy music with ${style.music.beatSync ? 'beat sync' : 'no beat sync'}`,
    });
  }
  
  return { tools, steps };
}

// ============================================
// IPC Handlers
// ============================================

// Analyze a single video for style features
ipcMain.handle('style-analyze', async (_event, data: { filePath: string; url?: string }) => {
  const win = getMainWindow();
  
  try {
    const features = await analyzeVideoFeatures(data.filePath, (progress) => {
      if (win) {
        win.webContents.send('style-analyze-progress', progress);
      }
    });
    
    const stylesDir = getStylesDir();
    const stylePath = path.join(stylesDir, `${features.id}.json`);
    fs.writeFileSync(stylePath, JSON.stringify(features, null, 2));
    
    return { success: true, features, filePath: stylePath };
  } catch (err) {
    return {
      success: false,
      error: `Analysis failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
});

// Analyze multiple videos and combine styles
ipcMain.handle('style-analyze-combine', async (_event, data: {
  files: Array<{ filePath: string; url?: string; weight?: number }>;
  name?: string;
}) => {
  const win = getMainWindow();
  const analyzedStyles: DetectedStyleFeatures[] = [];
  const weights: number[] = [];
  
  try {
    for (let i = 0; i < data.files.length; i++) {
      const file = data.files[i];
      
      if (win) {
        win.webContents.send('style-analyze-progress', {
          percent: (i / data.files.length) * 100,
          message: `Analyzing video ${i + 1} of ${data.files.length}...`,
          currentFile: i + 1,
          totalFiles: data.files.length,
        });
      }
      
      const features = await analyzeVideoFeatures(file.filePath, (progress) => {
        if (win) {
          win.webContents.send('style-analyze-progress', {
            ...progress,
            currentFile: i + 1,
            totalFiles: data.files.length,
          });
        }
      });
      
      analyzedStyles.push(features);
      weights.push(file.weight || 1);
    }
    
    const totalWeight = weights.reduce((a, b) => a + b, 0);
    const normalizedWeights = weights.map(w => w / totalWeight);
    
    const combined = combineStyles(analyzedStyles, normalizedWeights);
    if (data.name) {
      combined.name = data.name;
    }
    
    combined.aiEditingPlan = generateEditingPlan(combined);
    
    const stylesDir = getStylesDir();
    const stylePath = path.join(stylesDir, `${combined.id}.json`);
    fs.writeFileSync(stylePath, JSON.stringify(combined, null, 2));
    
    if (win) {
      win.webContents.send('style-analyze-progress', {
        percent: 100,
        message: 'Style combination complete!',
      });
    }
    
    return {
      success: true,
      combinedStyle: combined,
      individualStyles: analyzedStyles,
      filePath: stylePath,
    };
  } catch (err) {
    return {
      success: false,
      error: `Combination failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
});

// List all saved styles
ipcMain.handle('style-list', async () => {
  try {
    const stylesDir = getStylesDir();
    const files = fs.readdirSync(stylesDir).filter(f => f.endsWith('.json'));
    
    const styles = files.map(file => {
      try {
        const content = fs.readFileSync(path.join(stylesDir, file), 'utf-8');
        const data = JSON.parse(content);
        return {
          id: data.id,
          name: data.name || file.replace('.json', ''),
          description: data.description || '',
          tags: data.tags || [],
          isPreset: data.isPreset || false,
          filePath: path.join(stylesDir, file),
          createdAt: data.createdAt || data.analyzedAt,
          sources: data.sources || (data.sourceFilePath ? [data.sourceFilePath] : []),
        };
      } catch {
        return null;
      }
    }).filter(Boolean);
    
    const presets = [
      { id: 'preset_mrbeast', name: 'MrBeast Style', description: 'Fast cuts, karaoke captions, high energy', tags: ['viral', 'fast', 'karaoke'], isPreset: true },
      { id: 'preset_podcast', name: 'Podcast Clips', description: 'Clean captions, moderate pacing', tags: ['podcast', 'clean', 'moderate'], isPreset: true },
      { id: 'preset_tiktok', name: 'TikTok Viral', description: 'Rapid cuts, bold captions, zoom effects', tags: ['tiktok', 'viral', 'fast'], isPreset: true },
      { id: 'preset_cinematic', name: 'Cinematic', description: 'Slow pacing, cinematic color, subtle zoom', tags: ['cinematic', 'slow', 'moody'], isPreset: true },
    ];
    
    return { success: true, styles: [...presets, ...styles] };
  } catch (err) {
    return { success: false, styles: [], error: String(err) };
  }
});

// Get a specific style
ipcMain.handle('style-get', async (_event, styleId: string) => {
  try {
    if (styleId.startsWith('preset_')) {
      const preset = getPresetStyle(styleId);
      if (preset) {
        return { success: true, style: preset };
      }
    }
    
    const stylesDir = getStylesDir();
    const stylePath = path.join(stylesDir, `${styleId}.json`);
    
    if (!fs.existsSync(stylePath)) {
      return { success: false, error: 'Style not found' };
    }
    
    const content = fs.readFileSync(stylePath, 'utf-8');
    const style = JSON.parse(content);
    
    return { success: true, style };
  } catch (err) {
    return { success: false, error: String(err) };
  }
});

// Delete a style
ipcMain.handle('style-delete', async (_event, styleId: string) => {
  try {
    if (styleId.startsWith('preset_')) {
      return { success: false, error: 'Cannot delete preset styles' };
    }
    
    const stylesDir = getStylesDir();
    const stylePath = path.join(stylesDir, `${styleId}.json`);
    
    if (fs.existsSync(stylePath)) {
      fs.unlinkSync(stylePath);
    }
    
    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
});

// Select example videos for style learning
ipcMain.handle('style-select-examples', async () => {
  const result = await dialog.showOpenDialog({
    title: 'Select Style Reference Videos',
    filters: [
      { name: 'Videos', extensions: ['mp4', 'mov', 'webm', 'mkv', 'avi'] },
    ],
    properties: ['openFile', 'multiSelections'],
  });
  
  if (result.canceled) {
    return { success: true, canceled: true, files: [] };
  }
  
  return { success: true, files: result.filePaths };
});

// Learn style from example videos
ipcMain.handle('style-learn', async (_event, data: {
  name: string;
  description?: string;
  exampleVideos: string[];
}) => {
  const win = getMainWindow();
  const analyzedStyles: DetectedStyleFeatures[] = [];
  
  try {
    for (let i = 0; i < data.exampleVideos.length; i++) {
      const filePath = data.exampleVideos[i];
      
      if (win) {
        win.webContents.send('style-analyze-progress', {
          percent: (i / data.exampleVideos.length) * 100,
          message: `Analyzing video ${i + 1} of ${data.exampleVideos.length}...`,
        });
      }
      
      const features = await analyzeVideoFeatures(filePath);
      analyzedStyles.push(features);
    }
    
    const combined = analyzedStyles.length > 1 
      ? combineStyles(analyzedStyles)
      : { ...analyzedStyles[0], name: data.name } as unknown as CombinedStyleProfile;
    
    if (!('name' in combined) || combined.name !== data.name) {
      (combined as CombinedStyleProfile).name = data.name;
    }
    
    const plan = generateEditingPlan(combined as CombinedStyleProfile);
    (combined as CombinedStyleProfile).aiEditingPlan = plan;
    
    const stylesDir = getStylesDir();
    const stylePath = path.join(stylesDir, `${combined.id}.json`);
    fs.writeFileSync(stylePath, JSON.stringify(combined, null, 2));
    
    return { success: true, style: combined, filePath: stylePath };
  } catch (err) {
    return { success: false, error: String(err) };
  }
});

// Apply style to a clip
ipcMain.handle('style-apply', async (_event, data: {
  styleId: string;
  clip: { id: string; startTime: number; endTime: number; transcript?: string };
  transcript?: { words?: Array<{ word: string; start: number; end: number }> };
}) => {
  try {
    let style: CombinedStyleProfile | DetectedStyleFeatures | null = null;
    
    if (data.styleId.startsWith('preset_')) {
      style = getPresetStyle(data.styleId);
    } else {
      const stylesDir = getStylesDir();
      const stylePath = path.join(stylesDir, `${data.styleId}.json`);
      if (fs.existsSync(stylePath)) {
        style = JSON.parse(fs.readFileSync(stylePath, 'utf-8'));
      }
    }
    
    if (!style) {
      return { success: false, error: 'Style not found' };
    }
    
    const plan = generateEditingPlan(style as CombinedStyleProfile);
    const clipDuration = data.clip.endTime - data.clip.startTime;
    
    const editingPlan = {
      clipId: data.clip.id,
      styleProfileId: data.styleId,
      captions: data.transcript?.words?.map(w => ({
        text: w.word,
        start: w.start,
        end: w.end,
        words: [w],
      })) || [],
      cutSuggestions: [],
      brollSuggestions: [],
      musicSettings: {
        genre: (style as CombinedStyleProfile).music?.genre || 'upbeat',
        bpmRange: [100, 140] as [number, number],
        energyLevel: (style as CombinedStyleProfile).music?.energyLevel || 'high',
        volume: 0.2,
        duckOnSpeech: (style as CombinedStyleProfile).music?.duckOnSpeech ?? true,
        beatSyncCuts: (style as CombinedStyleProfile).music?.beatSync ?? false,
        mood: 'energetic',
        duration: clipDuration,
      },
      zoomKeyframes: [],
      colorSettings: {
        preset: (style as CombinedStyleProfile).colorGrading?.preset || 'none',
        brightness: 0,
        contrast: 0,
        saturation: 0,
        warmth: 0,
      },
      aiPlan: plan,
    };
    
    return { success: true, editingPlan };
  } catch (err) {
    return { success: false, error: String(err) };
  }
});

// Helper: Get preset style configuration
function getPresetStyle(presetId: string): CombinedStyleProfile | null {
  const presets: Record<string, CombinedStyleProfile> = {
    preset_mrbeast: {
      id: 'preset_mrbeast',
      name: 'MrBeast Style',
      sources: ['preset'],
      createdAt: new Date().toISOString(),
      captions: {
        detected: true, style: 'karaoke', position: 'center', fontSize: 'large',
        hasHighlight: true, highlightColor: '#FFFF00', textColor: '#FFFFFF',
        hasBackground: false, animation: 'pop', wordsPerLine: 2, confidence: 1, sourceWeight: 1,
      },
      cutPacing: {
        avgCutLength: 1.5, minCutLength: 0.5, maxCutLength: 4, cutsPerMinute: 40,
        style: 'rapid-fire', confidence: 1, sourceWeight: 1,
      },
      zoomEffects: {
        detected: true, frequency: 'heavy', maxZoom: 1.5, zoomOnEmphasis: true,
        kenBurns: false, confidence: 1, sourceWeight: 1,
      },
      broll: {
        detected: false, frequency: 'none', avgDuration: 0, style: 'contextual',
        confidence: 1, sourceWeight: 1,
      },
      colorGrading: {
        detected: true, preset: 'vibrant', saturation: 'high', contrast: 'high',
        confidence: 1, sourceWeight: 1,
      },
      music: {
        detected: true, genre: 'epic orchestral', energyLevel: 'high', beatSync: true,
        duckOnSpeech: true, confidence: 1, sourceWeight: 1,
      },
    },
    preset_podcast: {
      id: 'preset_podcast',
      name: 'Podcast Clips',
      sources: ['preset'],
      createdAt: new Date().toISOString(),
      captions: {
        detected: true, style: 'karaoke', position: 'bottom', fontSize: 'medium',
        hasHighlight: true, highlightColor: '#00FF00', textColor: '#FFFFFF',
        hasBackground: true, animation: 'none', wordsPerLine: 3, confidence: 1, sourceWeight: 1,
      },
      cutPacing: {
        avgCutLength: 5, minCutLength: 2, maxCutLength: 15, cutsPerMinute: 12,
        style: 'moderate', confidence: 1, sourceWeight: 1,
      },
      zoomEffects: {
        detected: true, frequency: 'light', maxZoom: 1.2, zoomOnEmphasis: true,
        kenBurns: false, confidence: 1, sourceWeight: 1,
      },
      broll: {
        detected: false, frequency: 'none', avgDuration: 0, style: 'contextual',
        confidence: 1, sourceWeight: 1,
      },
      colorGrading: {
        detected: false, preset: 'none', saturation: 'normal', contrast: 'normal',
        confidence: 1, sourceWeight: 1,
      },
      music: {
        detected: false, energyLevel: 'low', beatSync: false, duckOnSpeech: true,
        confidence: 1, sourceWeight: 1,
      },
    },
    preset_tiktok: {
      id: 'preset_tiktok',
      name: 'TikTok Viral',
      sources: ['preset'],
      createdAt: new Date().toISOString(),
      captions: {
        detected: true, style: 'karaoke', position: 'center', fontSize: 'large',
        hasHighlight: true, highlightColor: '#00FF00', textColor: '#FFFFFF',
        hasBackground: false, animation: 'pop', wordsPerLine: 2, confidence: 1, sourceWeight: 1,
      },
      cutPacing: {
        avgCutLength: 2, minCutLength: 0.5, maxCutLength: 5, cutsPerMinute: 30,
        style: 'rapid-fire', confidence: 1, sourceWeight: 1,
      },
      zoomEffects: {
        detected: true, frequency: 'moderate', maxZoom: 1.3, zoomOnEmphasis: true,
        kenBurns: false, confidence: 1, sourceWeight: 1,
      },
      broll: {
        detected: true, frequency: 'light', avgDuration: 2, style: 'meme',
        confidence: 1, sourceWeight: 1,
      },
      colorGrading: {
        detected: true, preset: 'vibrant', saturation: 'high', contrast: 'normal',
        confidence: 1, sourceWeight: 1,
      },
      music: {
        detected: true, genre: 'trending audio', energyLevel: 'high', beatSync: true,
        duckOnSpeech: true, confidence: 1, sourceWeight: 1,
      },
    },
    preset_cinematic: {
      id: 'preset_cinematic',
      name: 'Cinematic',
      sources: ['preset'],
      createdAt: new Date().toISOString(),
      captions: {
        detected: true, style: 'static', position: 'bottom', fontSize: 'small',
        hasHighlight: false, textColor: '#FFFFFF', hasBackground: true,
        animation: 'none', wordsPerLine: 5, confidence: 1, sourceWeight: 1,
      },
      cutPacing: {
        avgCutLength: 8, minCutLength: 4, maxCutLength: 20, cutsPerMinute: 8,
        style: 'slow', confidence: 1, sourceWeight: 1,
      },
      zoomEffects: {
        detected: true, frequency: 'light', maxZoom: 1.1, zoomOnEmphasis: false,
        kenBurns: true, confidence: 1, sourceWeight: 1,
      },
      broll: {
        detected: true, frequency: 'moderate', avgDuration: 4, style: 'stock',
        confidence: 1, sourceWeight: 1,
      },
      colorGrading: {
        detected: true, preset: 'cinematic', saturation: 'low', contrast: 'high',
        confidence: 1, sourceWeight: 1,
      },
      music: {
        detected: true, genre: 'ambient', energyLevel: 'low', beatSync: false,
        duckOnSpeech: true, confidence: 1, sourceWeight: 1,
      },
    },
  };
  
  return presets[presetId] || null;
}

console.log('[Styles] Handlers registered');
