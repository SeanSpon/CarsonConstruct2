import { memo, useState, useCallback } from 'react';
import { 
  Camera, 
  User, 
  Plus, 
  Trash2, 
  Star, 
  StarOff,
  Play,
  Video,
  Mic,
  Link2,
  Unlink,
  Wand2,
  Scissors,
  Loader2,
  ChevronDown,
  ChevronRight,
  RefreshCw,
} from 'lucide-react';
import { useStore } from '../../stores/store';
import type { CameraInput, SpeakerSegment, CameraCut } from '../../types';

interface MultiCamPanelProps {
  className?: string;
}

function MultiCamPanel({ className }: MultiCamPanelProps) {
  const {
    cameras,
    setCameras,
    addCamera,
    removeCamera,
    updateCamera,
    speakerSegments,
    cameraCuts,
    setCameraCuts,
    project,
  } = useStore();

  const [selectedCamera, setSelectedCamera] = useState<string | null>(null);
  const [linkingMode, setLinkingMode] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isAutoMapping, setIsAutoMapping] = useState(false);
  const [showCuts, setShowCuts] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get unique speakers from segments
  const uniqueSpeakers = Array.from(
    new Set(speakerSegments.map(s => s.speakerId))
  ).map(id => ({
    id,
    name: speakerSegments.find(s => s.speakerId === id)?.speakerName || id,
    totalTime: speakerSegments
      .filter(s => s.speakerId === id)
      .reduce((acc, s) => acc + (s.endTime - s.startTime), 0),
  }));

  // Format time helper
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Add multiple cameras at once
  const handleAddCameras = useCallback(async () => {
    try {
      setError(null);
      const result = await window.api.selectCameraFiles();
      if (result.success && result.files.length > 0) {
        for (let i = 0; i < result.files.length; i++) {
          const file = result.files[i];
          const newCamera: CameraInput = {
            id: file.id,
            name: file.name || `Camera ${cameras.length + i + 1}`,
            filePath: file.filePath,
            isMain: cameras.length === 0 && i === 0,
          };
          addCamera(newCamera);
        }
      }
    } catch (err) {
      console.error('Failed to add cameras:', err);
      setError('Failed to add camera files');
    }
  }, [cameras.length, addCamera]);

  // Add single camera (legacy)
  const handleAddCamera = useCallback(async () => {
    try {
      setError(null);
      const file = await window.api.selectFile();
      if (file) {
        const newCamera: CameraInput = {
          id: `cam_${Date.now()}`,
          name: `Camera ${cameras.length + 1}`,
          filePath: file.path,
          isMain: cameras.length === 0,
        };
        addCamera(newCamera);
      }
    } catch (err) {
      console.error('Failed to add camera:', err);
      setError('Failed to add camera file');
    }
  }, [cameras.length, addCamera]);

  // Auto-map speakers to cameras based on speaking time
  const handleAutoMapSpeakers = useCallback(async () => {
    if (cameras.length < 2 || uniqueSpeakers.length === 0) {
      setError('Need at least 2 cameras and detected speakers to auto-map');
      return;
    }

    setIsAutoMapping(true);
    setError(null);

    try {
      const result = await window.api.autoMapSpeakersToCameras({
        cameras: cameras.map(c => ({
          id: c.id,
          name: c.name,
          filePath: c.filePath,
          speakerId: c.speakerName,
          isMain: c.isMain,
        })),
        speakerSegments: speakerSegments.map(s => ({
          speakerId: s.speakerId,
          startTime: s.startTime,
          endTime: s.endTime,
        })),
      });

      if (result.success) {
        // Update cameras with speaker assignments
        for (const stat of result.speakerStats) {
          if (stat.assignedCamera) {
            updateCamera(stat.assignedCamera, { speakerName: stat.speakerId });
          }
        }
      }
    } catch (err) {
      console.error('Failed to auto-map speakers:', err);
      setError('Failed to auto-map speakers to cameras');
    } finally {
      setIsAutoMapping(false);
    }
  }, [cameras, speakerSegments, uniqueSpeakers.length, updateCamera]);

  // Generate camera cuts from speaker diarization
  const handleGenerateCuts = useCallback(async () => {
    if (cameras.length < 2 || speakerSegments.length === 0) {
      setError('Need cameras and speaker segments to generate cuts');
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      // Build speaker-to-camera mapping
      const speakerToCamera: Record<string, string> = {};
      for (const camera of cameras) {
        if (camera.speakerName) {
          speakerToCamera[camera.speakerName] = camera.id;
        }
      }

      const result = await window.api.generateCameraCuts({
        cameras: cameras.map(c => ({
          id: c.id,
          name: c.name,
          filePath: c.filePath,
          speakerId: c.speakerName,
          isMain: c.isMain,
        })),
        speakerSegments: speakerSegments.map(s => ({
          speakerId: s.speakerId,
          speakerLabel: s.speakerName,
          startTime: s.startTime,
          endTime: s.endTime,
          confidence: s.confidence,
        })),
        speakerToCamera,
        totalDuration: project?.duration || 0,
        pacing: 'moderate',
      });

      if (result.success && result.result) {
        // Convert to CameraCut format and store
        const cuts: CameraCut[] = result.result.cuts.map(c => ({
          id: c.id,
          cameraId: c.cameraId,
          startTime: c.startTime,
          endTime: c.endTime,
          reason: c.reason as CameraCut['reason'],
        }));
        setCameraCuts(cuts);
        setShowCuts(true);
      } else {
        setError(result.error || 'Failed to generate camera cuts');
      }
    } catch (err) {
      console.error('Failed to generate cuts:', err);
      setError('Failed to generate camera cuts');
    } finally {
      setIsGenerating(false);
    }
  }, [cameras, speakerSegments, project?.duration, setCameraCuts]);

  const handleRemoveCamera = useCallback((id: string) => {
    removeCamera(id);
    if (selectedCamera === id) {
      setSelectedCamera(null);
    }
  }, [removeCamera, selectedCamera]);

  const handleSetMain = useCallback((id: string) => {
    setCameras(cameras.map(c => ({
      ...c,
      isMain: c.id === id,
    })));
  }, [cameras, setCameras]);

  const handleLinkSpeaker = useCallback((cameraId: string, speakerId: string | undefined) => {
    updateCamera(cameraId, { speakerName: speakerId });
    setLinkingMode(false);
  }, [updateCamera]);

  const handleNameChange = useCallback((id: string, name: string) => {
    updateCamera(id, { name });
  }, [updateCamera]);

  const getLinkedSpeaker = (camera: CameraInput) => {
    return uniqueSpeakers.find(s => s.id === camera.speakerName);
  };

  return (
    <div className={`flex flex-col bg-sz-bg-secondary rounded-xl border border-sz-border ${className || ''}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-sz-border">
        <div className="flex items-center gap-2">
          <Camera className="w-4 h-4 text-sz-accent" />
          <h3 className="font-medium text-sz-text text-sm">Multi-Camera Setup</h3>
          <span className="px-2 py-0.5 rounded-full text-xs bg-sz-bg-tertiary text-sz-text-secondary">
            {cameras.length} camera{cameras.length !== 1 ? 's' : ''}
          </span>
          {cameraCuts.length > 0 && (
            <span className="px-2 py-0.5 rounded-full text-xs bg-emerald-500/20 text-emerald-400">
              {cameraCuts.length} cuts
            </span>
          )}
        </div>
        <button
          onClick={handleAddCameras}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-sz-accent text-white text-sm hover:bg-sz-accent-hover transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Cameras
        </button>
      </div>

      {/* Error display */}
      {error && (
        <div className="mx-4 mt-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/30">
          <p className="text-xs text-red-400">{error}</p>
        </div>
      )}

      {/* Action buttons */}
      {cameras.length >= 2 && speakerSegments.length > 0 && (
        <div className="flex items-center gap-2 px-4 py-2 border-b border-sz-border">
          <button
            onClick={handleAutoMapSpeakers}
            disabled={isAutoMapping}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-500/20 text-violet-400 text-xs hover:bg-violet-500/30 transition-colors disabled:opacity-50"
          >
            {isAutoMapping ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Wand2 className="w-3.5 h-3.5" />
            )}
            Auto-Map Speakers
          </button>
          <button
            onClick={handleGenerateCuts}
            disabled={isGenerating}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 text-xs hover:bg-emerald-500/30 transition-colors disabled:opacity-50"
          >
            {isGenerating ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Scissors className="w-3.5 h-3.5" />
            )}
            Generate Cuts
          </button>
          {cameraCuts.length > 0 && (
            <button
              onClick={() => setShowCuts(!showCuts)}
              className="flex items-center gap-1 px-2 py-1.5 text-xs text-sz-text-secondary hover:text-sz-text transition-colors"
            >
              {showCuts ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
              {showCuts ? 'Hide Cuts' : 'Show Cuts'}
            </button>
          )}
        </div>
      )}

      {/* Camera List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {cameras.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="w-12 h-12 rounded-full bg-sz-bg-tertiary flex items-center justify-center mb-3">
              <Video className="w-6 h-6 text-sz-text-muted" />
            </div>
            <p className="text-sz-text-secondary text-sm mb-1">No cameras added</p>
            <p className="text-sz-text-muted text-xs">
              Add camera angles for multi-cam editing
            </p>
          </div>
        ) : (
          cameras.map((camera) => {
            const linkedSpeaker = getLinkedSpeaker(camera);
            const isSelected = selectedCamera === camera.id;

            return (
              <div
                key={camera.id}
                className={`p-4 rounded-lg border transition-colors ${
                  isSelected
                    ? 'border-sz-accent bg-sz-accent/5'
                    : 'border-sz-border bg-sz-bg-tertiary hover:border-sz-border-light'
                }`}
                onClick={() => setSelectedCamera(camera.id)}
              >
                <div className="flex items-start gap-3">
                  {/* Preview placeholder */}
                  <div className="w-24 h-16 rounded-lg bg-sz-bg flex items-center justify-center flex-shrink-0 overflow-hidden">
                    {camera.filePath ? (
                      <video
                        src={`file://${camera.filePath}`}
                        className="w-full h-full object-cover"
                        muted
                      />
                    ) : (
                      <Camera className="w-6 h-6 text-sz-text-muted" />
                    )}
                  </div>

                  {/* Camera info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <input
                        type="text"
                        value={camera.name}
                        onChange={(e) => handleNameChange(camera.id, e.target.value)}
                        className="font-medium text-sz-text text-sm bg-transparent border-none focus:outline-none focus:ring-1 focus:ring-sz-accent rounded px-1 -ml-1"
                        onClick={(e) => e.stopPropagation()}
                      />
                      {camera.isMain && (
                        <span className="px-1.5 py-0.5 rounded text-xs bg-amber-500/20 text-amber-400 flex items-center gap-1">
                          <Star className="w-3 h-3" />
                          Main
                        </span>
                      )}
                    </div>

                    {/* File path */}
                    <p className="text-xs text-sz-text-muted truncate mb-2">
                      {camera.filePath ? camera.filePath.split(/[\\/]/).pop() : 'No file selected'}
                    </p>

                    {/* Speaker link */}
                    <div className="flex items-center gap-2">
                      {linkedSpeaker ? (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleLinkSpeaker(camera.id, undefined);
                          }}
                          className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-emerald-500/20 text-emerald-400 text-xs hover:bg-emerald-500/30 transition-colors"
                        >
                          <Link2 className="w-3 h-3" />
                          <User className="w-3 h-3" />
                          {linkedSpeaker.name}
                        </button>
                      ) : (
                        <div className="relative">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setLinkingMode(camera.id === linkingMode ? false : true);
                              setSelectedCamera(camera.id);
                            }}
                            className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-sz-bg text-sz-text-secondary text-xs hover:bg-sz-bg-secondary hover:text-sz-text transition-colors"
                          >
                            <Unlink className="w-3 h-3" />
                            Link to speaker
                          </button>
                          
                          {/* Speaker selection dropdown */}
                          {linkingMode && selectedCamera === camera.id && uniqueSpeakers.length > 0 && (
                            <div className="absolute top-full left-0 mt-1 w-48 rounded-lg bg-sz-bg border border-sz-border shadow-lg z-10 py-1">
                              {uniqueSpeakers.map(speaker => (
                                <button
                                  key={speaker.id}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleLinkSpeaker(camera.id, speaker.id);
                                  }}
                                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-sz-text hover:bg-sz-bg-secondary transition-colors"
                                >
                                  <Mic className="w-4 h-4 text-sz-text-secondary" />
                                  <span className="flex-1 text-left truncate">{speaker.name}</span>
                                  <span className="text-xs text-sz-text-muted">
                                    {Math.round(speaker.totalTime)}s
                                  </span>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col gap-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSetMain(camera.id);
                      }}
                      className={`p-1.5 rounded-md transition-colors ${
                        camera.isMain
                          ? 'text-amber-400 bg-amber-500/20'
                          : 'text-sz-text-muted hover:text-sz-text hover:bg-sz-bg'
                      }`}
                      title={camera.isMain ? 'Main camera' : 'Set as main'}
                    >
                      {camera.isMain ? (
                        <Star className="w-4 h-4" />
                      ) : (
                        <StarOff className="w-4 h-4" />
                      )}
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveCamera(camera.id);
                      }}
                      className="p-1.5 rounded-md text-sz-text-muted hover:text-red-400 hover:bg-red-500/10 transition-colors"
                      title="Remove camera"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Speaker Stats */}
      {uniqueSpeakers.length > 0 && (
        <div className="px-4 py-3 border-t border-sz-border">
          <p className="text-xs text-sz-text-muted mb-2">Detected Speakers</p>
          <div className="flex flex-wrap gap-2">
            {uniqueSpeakers.map(speaker => {
              const linkedCamera = cameras.find(c => c.speakerName === speaker.id);
              return (
                <div
                  key={speaker.id}
                  className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-xs ${
                    linkedCamera
                      ? 'bg-emerald-500/20 text-emerald-400'
                      : 'bg-sz-bg-tertiary text-sz-text-secondary'
                  }`}
                >
                  <User className="w-3 h-3" />
                  <span>{speaker.name}</span>
                  <span className="text-sz-text-muted">
                    ({Math.round(speaker.totalTime / 60)}m)
                  </span>
                  {linkedCamera && (
                    <>
                      <span className="text-sz-text-muted">→</span>
                      <Camera className="w-3 h-3" />
                      <span>{linkedCamera.name}</span>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Camera Cuts Preview */}
      {showCuts && cameraCuts.length > 0 && (
        <div className="px-4 py-3 border-t border-sz-border">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-sz-text-muted">Camera Cuts Timeline</p>
            <button
              onClick={handleGenerateCuts}
              className="flex items-center gap-1 text-xs text-sz-text-secondary hover:text-sz-text transition-colors"
              title="Regenerate cuts"
            >
              <RefreshCw className="w-3 h-3" />
            </button>
          </div>
          <div className="max-h-40 overflow-y-auto space-y-1">
            {cameraCuts.slice(0, 20).map((cut, idx) => {
              const camera = cameras.find(c => c.id === cut.cameraId);
              return (
                <div
                  key={cut.id}
                  className="flex items-center gap-2 px-2 py-1.5 rounded bg-sz-bg-tertiary text-xs"
                >
                  <span className="text-sz-text-muted w-6">#{idx + 1}</span>
                  <span className="text-sz-text-secondary font-mono">
                    {formatTime(cut.startTime)} - {formatTime(cut.endTime)}
                  </span>
                  <span className="flex items-center gap-1 text-sz-text">
                    <Camera className="w-3 h-3" />
                    {camera?.name || cut.cameraId}
                  </span>
                  <span className="text-sz-text-muted ml-auto">
                    {cut.reason}
                  </span>
                </div>
              );
            })}
            {cameraCuts.length > 20 && (
              <p className="text-xs text-sz-text-muted text-center py-1">
                ... and {cameraCuts.length - 20} more cuts
              </p>
            )}
          </div>
        </div>
      )}

      {/* Instructions */}
      {cameras.length > 0 && uniqueSpeakers.length === 0 && (
        <div className="px-4 py-3 border-t border-sz-border">
          <p className="text-xs text-sz-text-muted">
            Run detection to identify speakers, then link each speaker to their camera.
          </p>
        </div>
      )}

      {cameras.length === 0 && (
        <div className="px-4 py-3 border-t border-sz-border">
          <p className="text-xs text-sz-text-muted">
            Add multiple camera angles and link them to speakers for automatic camera switching.
          </p>
        </div>
      )}
    </div>
  );
}

export default memo(MultiCamPanel);
