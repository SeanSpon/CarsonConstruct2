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
} from 'lucide-react';
import { useStore } from '../../stores/store';
import type { CameraInput, SpeakerSegment } from '../../types';

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
  } = useStore();

  const [selectedCamera, setSelectedCamera] = useState<string | null>(null);
  const [linkingMode, setLinkingMode] = useState(false);

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

  const handleAddCamera = useCallback(async () => {
    try {
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
    }
  }, [cameras.length, addCamera]);

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
        </div>
        <button
          onClick={handleAddCamera}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-sz-accent text-white text-sm hover:bg-sz-accent-hover transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Camera
        </button>
      </div>

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

      {/* Instructions */}
      {cameras.length > 0 && uniqueSpeakers.length === 0 && (
        <div className="px-4 py-3 border-t border-sz-border">
          <p className="text-xs text-sz-text-muted">
            Run detection to identify speakers, then link each speaker to their camera.
          </p>
        </div>
      )}
    </div>
  );
}

export default memo(MultiCamPanel);
