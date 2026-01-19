/**
 * Camera Handlers - IPC handlers for multi-camera editing
 * 
 * Handles camera switching logic via Python backend.
 */

import { ipcMain, app } from 'electron';
import { spawn } from 'child_process';
import path from 'path';

interface CameraInput {
  id: string;
  name: string;
  filePath: string;
  speakerId?: string;
  isMain: boolean;
  isReaction?: boolean;
}

interface SpeakerSegment {
  speakerId: string;
  speakerLabel?: string;
  startTime: number;
  endTime: number;
  confidence?: number;
}

interface CameraCut {
  id: string;
  cameraId: string;
  startTime: number;
  endTime: number;
  reason: string;
  confidence: number;
  duration: number;
}

interface CameraSwitchingResult {
  cuts: CameraCut[];
  totalDuration: number;
  cutCount: number;
  averageCutLength: number;
  camerasUsed: string[];
}

// Generate camera cuts from speaker diarization
ipcMain.handle('generate-camera-cuts', async (_event, data: {
  cameras: CameraInput[];
  speakerSegments: SpeakerSegment[];
  speakerToCamera: Record<string, string>;
  totalDuration: number;
  pacing?: 'fast' | 'moderate' | 'slow';
  minCutDuration?: number;
  maxCutDuration?: number;
  reactionShotProbability?: number;
}) => {
  console.log('[CameraHandlers] generate-camera-cuts invoked with', data.cameras.length, 'cameras');
  
  const {
    cameras,
    speakerSegments,
    speakerToCamera,
    totalDuration,
    pacing = 'moderate',
    minCutDuration = 2.0,
    maxCutDuration = 30.0,
    reactionShotProbability = 0.15,
  } = data;

  // Get Python script path
  const appPath = app.getAppPath();
  const isDev = !app.isPackaged;
  const pythonDir = isDev
    ? path.join(appPath, 'src/python')
    : path.join(process.resourcesPath, 'python');

  // Use inline Python to call the camera_switcher module
  const pythonScript = `
import sys
import json
sys.path.insert(0, r"${pythonDir.replace(/\\/g, '\\\\')}")

from editing.camera_switcher import generate_camera_cuts

# Parse input
cameras = json.loads(r'''${JSON.stringify(cameras.map(c => ({
    id: c.id,
    name: c.name,
    file_path: c.filePath,
    speaker_id: c.speakerId,
    is_main: c.isMain,
    is_reaction: c.isReaction || false,
  })))}''')

speaker_segments = json.loads(r'''${JSON.stringify(speakerSegments.map(s => ({
    speaker_id: s.speakerId,
    speaker_label: s.speakerLabel || s.speakerId,
    start_time: s.startTime,
    end_time: s.endTime,
    confidence: s.confidence || 0.9,
  })))}''')

speaker_to_camera = json.loads(r'''${JSON.stringify(speakerToCamera)}''')

# Generate cuts
result = generate_camera_cuts(
    cameras=cameras,
    speaker_segments=speaker_segments,
    speaker_to_camera=speaker_to_camera,
    total_duration=${totalDuration},
    pacing="${pacing}",
    min_cut_duration=${minCutDuration},
    max_cut_duration=${maxCutDuration},
    reaction_shot_probability=${reactionShotProbability},
)

# Output as JSON
output = result.to_dict()
# Convert snake_case to camelCase for JS
output['totalDuration'] = output.pop('total_duration')
output['cutCount'] = output.pop('cut_count')
output['averageCutLength'] = output.pop('average_cut_length')
output['camerasUsed'] = output.pop('cameras_used')

# Convert cut fields
for cut in output['cuts']:
    cut['cameraId'] = cut.pop('camera_id')
    cut['startTime'] = cut.pop('start_time')
    cut['endTime'] = cut.pop('end_time')

print(json.dumps(output))
`;

  return new Promise<{ success: boolean; result?: CameraSwitchingResult; error?: string }>((resolve) => {
    try {
      const python = spawn('python', ['-c', pythonScript], {
        cwd: pythonDir,
        env: {
          ...process.env,
          PYTHONUNBUFFERED: '1',
        },
      });

      let output = '';
      let errorOutput = '';

      python.stdout.on('data', (data) => {
        output += data.toString();
      });

      python.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      python.on('close', (code) => {
        if (code !== 0) {
          console.error('[CameraHandlers] Python error:', errorOutput);
          resolve({
            success: false,
            error: `Camera switching failed: ${errorOutput || 'Unknown error'}`,
          });
          return;
        }

        try {
          const result = JSON.parse(output.trim());
          console.log('[CameraHandlers] Generated', result.cutCount, 'camera cuts');
          resolve({ success: true, result });
        } catch (e) {
          console.error('[CameraHandlers] Failed to parse result:', e);
          resolve({
            success: false,
            error: 'Failed to parse camera cuts result',
          });
        }
      });

      python.on('error', (err) => {
        console.error('[CameraHandlers] Python spawn error:', err);
        resolve({
          success: false,
          error: `Failed to run Python: ${err.message}`,
        });
      });

      // Timeout after 30 seconds
      setTimeout(() => {
        python.kill();
        resolve({
          success: false,
          error: 'Camera switching timed out',
        });
      }, 30000);

    } catch (err) {
      resolve({
        success: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  });
});

// Auto-generate speaker-to-camera mapping based on speaking time
ipcMain.handle('auto-map-speakers-to-cameras', async (_event, data: {
  cameras: CameraInput[];
  speakerSegments: SpeakerSegment[];
}) => {
  const { cameras, speakerSegments } = data;
  
  // Calculate speaking time per speaker
  const speakingTime: Record<string, number> = {};
  for (const seg of speakerSegments) {
    speakingTime[seg.speakerId] = (speakingTime[seg.speakerId] || 0) + (seg.endTime - seg.startTime);
  }
  
  // Sort speakers by speaking time (most to least)
  const sortedSpeakers = Object.entries(speakingTime)
    .sort(([, a], [, b]) => b - a)
    .map(([id]) => id);
  
  // Get non-main cameras for assignment
  const assignableCameras = cameras.filter(c => !c.isMain);
  
  // Map speakers to cameras
  const speakerToCamera: Record<string, string> = {};
  
  for (let i = 0; i < sortedSpeakers.length; i++) {
    const speakerId = sortedSpeakers[i];
    
    if (i < assignableCameras.length) {
      // Assign to a dedicated camera
      speakerToCamera[speakerId] = assignableCameras[i].id;
    } else {
      // Fall back to main camera (wide shot)
      const mainCamera = cameras.find(c => c.isMain);
      if (mainCamera) {
        speakerToCamera[speakerId] = mainCamera.id;
      }
    }
  }
  
  return {
    success: true,
    speakerToCamera,
    speakerStats: Object.entries(speakingTime).map(([id, time]) => ({
      speakerId: id,
      speakingTime: Math.round(time * 10) / 10,
      assignedCamera: speakerToCamera[id] || null,
    })),
  };
});

console.log('[CameraHandlers] Registered camera handlers');

export function registerCameraHandlers(): void {
  // Handlers are auto-registered via ipcMain.handle above
  console.log('[CameraHandlers] Camera handlers ready');
}
