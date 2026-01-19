import { ipcMain } from 'electron';
import path from 'path';
import { spawn } from 'child_process';
import { getMainWindow } from '../window';

interface AiEffectRequest {
  effect: string;
  clipId: string;
  clip: {
    id: string;
    startTime: number;
    endTime: number;
    duration: number;
    [key: string]: any;
  };
  projectPath: string;
}

// Map effect IDs to Python scripts/functions
const EFFECT_HANDLERS: Record<string, { script: string; type: 'ai' | 'video' | 'audio' | 'text'; args?: (req: AiEffectRequest) => string[] }> = {
  // AI Quick Options
  'auto-color': {
    script: 'ai_effects.py',
    type: 'ai',
    args: (req) => ['color-correction', req.projectPath, req.clip.startTime.toString(), req.clip.endTime.toString()],
  },
  'auto-audio': {
    script: 'ai_effects.py',
    type: 'ai',
    args: (req) => ['audio-enhance', req.projectPath, req.clip.startTime.toString(), req.clip.endTime.toString()],
  },
  'auto-captions': {
    script: 'ai_effects.py',
    type: 'ai',
    args: (req) => ['generate-captions', req.projectPath, req.clip.startTime.toString(), req.clip.endTime.toString()],
  },
  'auto-pacing': {
    script: 'ai_effects.py',
    type: 'ai',
    args: (req) => ['optimize-pacing', req.projectPath, req.clip.startTime.toString(), req.clip.endTime.toString()],
  },
  'auto-transitions': {
    script: 'ai_effects.py',
    type: 'ai',
    args: (req) => ['suggest-transitions', req.projectPath, req.clip.startTime.toString(), req.clip.endTime.toString()],
  },
  'auto-broll': {
    script: 'ai_effects.py',
    type: 'ai',
    args: (req) => ['suggest-broll', req.projectPath, req.clip.startTime.toString(), req.clip.endTime.toString()],
  },
  'auto-music': {
    script: 'ai_effects.py',
    type: 'ai',
    args: (req) => ['match-music', req.projectPath, req.clip.startTime.toString(), req.clip.endTime.toString()],
  },
  'auto-enhance': {
    script: 'ai_effects.py',
    type: 'ai',
    args: (req) => ['full-enhance', req.projectPath, req.clip.startTime.toString(), req.clip.endTime.toString()],
  },
  
  // Video Effects
  'video-brightness-contrast': {
    script: 'effects.py',
    type: 'video',
    args: (req) => ['brightness-contrast', req.projectPath, req.clip.startTime.toString(), req.clip.endTime.toString()],
  },
  'video-color-correction': {
    script: 'effects.py',
    type: 'video',
    args: (req) => ['color-correction', req.projectPath, req.clip.startTime.toString(), req.clip.endTime.toString()],
  },
  'video-blur': {
    script: 'effects.py',
    type: 'video',
    args: (req) => ['blur', req.projectPath, req.clip.startTime.toString(), req.clip.endTime.toString()],
  },
  'video-sharpen': {
    script: 'effects.py',
    type: 'video',
    args: (req) => ['sharpen', req.projectPath, req.clip.startTime.toString(), req.clip.endTime.toString()],
  },
  'video-noise-reduction': {
    script: 'effects.py',
    type: 'video',
    args: (req) => ['noise-reduction', req.projectPath, req.clip.startTime.toString(), req.clip.endTime.toString()],
  },
  
  // Audio Effects
  'audio-volume': {
    script: 'effects.py',
    type: 'audio',
    args: (req) => ['volume', req.projectPath, req.clip.startTime.toString(), req.clip.endTime.toString()],
  },
  'audio-eq': {
    script: 'effects.py',
    type: 'audio',
    args: (req) => ['eq', req.projectPath, req.clip.startTime.toString(), req.clip.endTime.toString()],
  },
  'audio-noise-gate': {
    script: 'effects.py',
    type: 'audio',
    args: (req) => ['noise-gate', req.projectPath, req.clip.startTime.toString(), req.clip.endTime.toString()],
  },
  'audio-compressor': {
    script: 'effects.py',
    type: 'audio',
    args: (req) => ['compressor', req.projectPath, req.clip.startTime.toString(), req.clip.endTime.toString()],
  },
  
  // Text Effects
  'text-title': {
    script: 'effects.py',
    type: 'text',
    args: (req) => ['title', req.projectPath, req.clip.startTime.toString(), req.clip.endTime.toString()],
  },
  'text-lower-third': {
    script: 'effects.py',
    type: 'text',
    args: (req) => ['lower-third', req.projectPath, req.clip.startTime.toString(), req.clip.endTime.toString()],
  },
  'text-caption': {
    script: 'effects.py',
    type: 'text',
    args: (req) => ['caption', req.projectPath, req.clip.startTime.toString(), req.clip.endTime.toString()],
  },
};

// Get human-readable effect name
function getEffectDisplayName(effectId: string): string {
  const names: Record<string, string> = {
    // AI
    'auto-color': 'Auto Color',
    'auto-audio': 'Auto Audio',
    'auto-captions': 'Auto Captions',
    'auto-pacing': 'Auto Pacing',
    'auto-transitions': 'Smart Transitions',
    'auto-broll': 'B-Roll Suggestions',
    'auto-music': 'Music Match',
    'auto-enhance': 'One-Click Enhance',
    // Video
    'video-brightness-contrast': 'Brightness & Contrast',
    'video-color-correction': 'Color Correction',
    'video-blur': 'Blur',
    'video-sharpen': 'Sharpen',
    'video-noise-reduction': 'Noise Reduction',
    // Audio
    'audio-volume': 'Volume',
    'audio-eq': 'EQ',
    'audio-noise-gate': 'Noise Gate',
    'audio-compressor': 'Compressor',
    // Text
    'text-title': 'Title',
    'text-lower-third': 'Lower Third',
    'text-caption': 'Caption',
  };
  return names[effectId] || effectId;
}

export function registerAiEffectsHandlers() {
  ipcMain.handle('apply-ai-effect', async (_event, request: AiEffectRequest) => {
    try {
      const effectHandler = EFFECT_HANDLERS[request.effect];
      if (!effectHandler) {
        return {
          success: false,
          error: `Unknown effect: ${request.effect}`,
        };
      }

      const effectType = effectHandler.type;
      const displayName = getEffectDisplayName(request.effect);
      
      console.log(`[Effects] Applying ${effectType} effect "${displayName}" to clip ${request.clipId}`);
      
      // TODO: Implement actual Python script execution for real processing
      // const pythonScript = path.join(__dirname, '../../python', effectHandler.script);
      // const args = effectHandler.args ? effectHandler.args(request) : [];
      // const process = spawn('python', [pythonScript, ...args]);
      
      // Simulate processing delay (faster for standard effects, slower for AI)
      const delay = effectType === 'ai' ? 800 : 300;
      await new Promise(resolve => setTimeout(resolve, delay));

      return {
        success: true,
        effect: request.effect,
        effectType,
        displayName,
        clipId: request.clipId,
        message: `Applied ${displayName} successfully`,
      };
    } catch (error) {
      console.error(`[Effects] Error applying ${request.effect}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  console.log('[Effects] IPC handlers registered');
}
