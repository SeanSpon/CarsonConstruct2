import { useEffect, useRef, useState, useCallback } from 'react';
import { useStore } from './stores/store';
import type { Clip, Transcript } from './types';

// 3 screens only: Home, Review, Export
type Screen = 'home' | 'review' | 'export';

function App() {
  const { 
    project,
    setProject,
    clips,
    setDetectionProgress, 
    setDetectionError, 
    setDetecting,
    isDetecting,
    detectionProgress,
    detectionError,
    setResults,
    updateClipStatus,
    updateClipTrim,
    setExportProgress,
    setExporting,
    isExporting,
    exportProgress,
    setLastExportDir,
    lastExportDir,
    currentJobId,
    setCurrentJobId,
    setLastJobId,
    settings,
  } = useStore();

  const [screen, setScreen] = useState<Screen>('home');
  const [currentClipIndex, setCurrentClipIndex] = useState(0);
  const [exportedClips, setExportedClips] = useState<string[]>([]);
  const [showCaptions, setShowCaptions] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);
  const currentJobIdRef = useRef<string | null>(currentJobId);

  useEffect(() => {
    currentJobIdRef.current = currentJobId;
  }, [currentJobId]);

  // IPC listeners
  useEffect(() => {
    const unsubProgress = window.api.onDetectionProgress((data) => {
      const jobId = currentJobIdRef.current;
      if (jobId && data.projectId !== jobId) return;
      setDetectionProgress({
        percent: data.progress,
        message: data.message,
      });
    });

    const unsubComplete = window.api.onDetectionComplete((data) => {
      const jobId = currentJobIdRef.current;
      if (jobId && data.projectId !== jobId) return;
      
      const rawClips = Array.isArray(data.clips) ? data.clips : [];
      const clips = (rawClips as Clip[]).map((clip, index) => ({
        ...clip,
        id: clip.id || `clip_${index + 1}`,
        status: 'pending' as const,
        trimStartOffset: clip.trimStartOffset || 0,
        trimEndOffset: clip.trimEndOffset || 0,
      }));

      setResults(clips, [], data.transcript as Transcript | null);
      setCurrentJobId(null);
      setLastJobId(data.projectId);
      
      if (clips.length > 0) {
        setScreen('review');
        setCurrentClipIndex(0);
      }
    });

    const unsubError = window.api.onDetectionError((data) => {
      const jobId = currentJobIdRef.current;
      if (jobId && data.projectId !== jobId) return;
      setDetectionError(data.error);
      setCurrentJobId(null);
    });

    const unsubExportProgress = window.api.onExportProgress((data) => {
      setExportProgress({
        current: data.current,
        total: data.total,
        clipName: data.clipName,
      });
    });

    const unsubExportComplete = window.api.onExportComplete((data) => {
      setExporting(false);
      setExportProgress(null);
      if (data.success) {
        setLastExportDir(data.outputDir);
        setExportedClips(prev => [...prev, `${data.clipCount} clips exported`]);
      }
    });

    return () => {
      unsubProgress();
      unsubComplete();
      unsubError();
      unsubExportProgress();
      unsubExportComplete();
    };
  }, [setDetectionProgress, setDetectionError, setResults, setExportProgress, setExporting, setLastExportDir, setCurrentJobId, setLastJobId]);

  // Handle file selection
  const handleSelectFile = useCallback(async () => {
    try {
      const file = await window.api.selectFile();
      if (!file) return;

      const validation = await window.api.validateFile(file.path);
      if (!validation.valid) return;

      setProject({
        filePath: file.path,
        fileName: file.name,
        size: file.size,
        duration: validation.duration || 0,
        resolution: validation.resolution,
        width: validation.width,
        height: validation.height,
        fps: validation.fps,
        thumbnailPath: validation.thumbnailPath,
        bitrate: validation.bitrate,
      });
    } catch (err) {
      console.error('File selection error:', err);
    }
  }, [setProject]);

  // Start detection
  const handleGenerate = useCallback(async () => {
    if (!project) return;

    const jobId = `job_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    setCurrentJobId(jobId);
    setDetecting(true);
    setDetectionError(null);

    try {
      const result = await window.api.startDetection(
        jobId,
        project.filePath,
        settings,
        project.duration
      );

      if (!result.success) {
        setDetectionError(result.error || 'Failed to start detection');
        setDetecting(false);
      }
    } catch (err) {
      setDetectionError(String(err));
      setDetecting(false);
    }
  }, [project, settings, setCurrentJobId, setDetecting, setDetectionError]);

  // Current clip
  const currentClip = clips[currentClipIndex];
  const acceptedClips = clips.filter(c => c.status === 'accepted');

  // Navigation
  const goToNextClip = useCallback(() => {
    if (currentClipIndex < clips.length - 1) {
      setCurrentClipIndex(currentClipIndex + 1);
    }
  }, [currentClipIndex, clips.length]);

  const goToPrevClip = useCallback(() => {
    if (currentClipIndex > 0) {
      setCurrentClipIndex(currentClipIndex - 1);
    }
  }, [currentClipIndex]);

  // Accept/Reject
  const handleAccept = useCallback(() => {
    if (currentClip) {
      updateClipStatus(currentClip.id, currentClip.status === 'accepted' ? 'pending' : 'accepted');
    }
  }, [currentClip, updateClipStatus]);

  const handleReject = useCallback(() => {
    if (currentClip) {
      updateClipStatus(currentClip.id, currentClip.status === 'rejected' ? 'pending' : 'rejected');
      goToNextClip();
    }
  }, [currentClip, updateClipStatus, goToNextClip]);

  // Export single clip
  const handleExportClip = useCallback(async () => {
    if (!project || !currentClip) return;

    try {
      const outputDir = await window.api.selectOutputDir();
      if (!outputDir) return;

      setScreen('export');
      setExporting(true);

      await window.api.exportClips({
        sourceFile: project.filePath,
        clips: [{
          id: currentClip.id,
          startTime: currentClip.startTime + currentClip.trimStartOffset,
          endTime: currentClip.endTime + currentClip.trimEndOffset,
          trimStartOffset: 0,
          trimEndOffset: 0,
          title: currentClip.title,
        }],
        deadSpaces: [],
        outputDir,
        settings: { exportClips: true, format: 'mp4', mode: 'fast' },
      });
    } catch (err) {
      console.error('Export failed:', err);
      setExporting(false);
    }
  }, [project, currentClip, setExporting]);

  // Export all accepted
  const handleExportAll = useCallback(async () => {
    if (!project || acceptedClips.length === 0) return;

    try {
      const outputDir = await window.api.selectOutputDir();
      if (!outputDir) return;

      setScreen('export');
      setExporting(true);

      await window.api.exportClips({
        sourceFile: project.filePath,
        clips: acceptedClips.map(clip => ({
          id: clip.id,
          startTime: clip.startTime + clip.trimStartOffset,
          endTime: clip.endTime + clip.trimEndOffset,
          trimStartOffset: 0,
          trimEndOffset: 0,
          title: clip.title,
        })),
        deadSpaces: [],
        outputDir,
        settings: { exportClips: true, format: 'mp4', mode: 'fast' },
      });
    } catch (err) {
      console.error('Export failed:', err);
      setExporting(false);
    }
  }, [project, acceptedClips, setExporting]);

  // Open export folder
  const handleOpenFolder = useCallback(() => {
    if (lastExportDir) {
      window.api.openFolder(lastExportDir);
    }
  }, [lastExportDir]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (screen !== 'review') return;
      if (e.target instanceof HTMLInputElement) return;

      switch (e.key) {
        case ' ':
          e.preventDefault();
          if (videoRef.current) {
            if (videoRef.current.paused) videoRef.current.play();
            else videoRef.current.pause();
          }
          break;
        case 'a':
        case 'A':
          handleAccept();
          break;
        case 'r':
        case 'R':
          handleReject();
          break;
        case 'ArrowLeft':
          goToPrevClip();
          break;
        case 'ArrowRight':
          goToNextClip();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [screen, handleAccept, handleReject, goToNextClip, goToPrevClip]);

  // Seek video when clip changes
  useEffect(() => {
    if (currentClip && videoRef.current) {
      videoRef.current.currentTime = currentClip.startTime + currentClip.trimStartOffset;
    }
  }, [currentClip]);

  // ========================================
  // SCREEN 1: HOME
  // ========================================
  if (screen === 'home') {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-sz-bg text-sz-text p-8">
        <div className="max-w-md w-full space-y-8 text-center">
          <h1 className="text-3xl font-bold">PodFlow</h1>
          <p className="text-sz-text-muted">Find the best clips in your podcast</p>

          {/* File Picker */}
          <button
            onClick={handleSelectFile}
            className="w-full p-8 border-2 border-dashed border-sz-border rounded-xl hover:border-sz-accent hover:bg-sz-bg-secondary transition-colors"
          >
            {project ? (
              <div className="space-y-2">
                <p className="font-medium">{project.fileName}</p>
                <p className="text-sm text-sz-text-muted">
                  {Math.floor(project.duration / 60)}:{String(Math.floor(project.duration % 60)).padStart(2, '0')}
                </p>
              </div>
            ) : (
              <p className="text-sz-text-muted">Click to select video</p>
            )}
          </button>

          {/* Generate Button */}
          <button
            onClick={handleGenerate}
            disabled={!project || isDetecting}
            className="w-full py-4 px-6 bg-sz-accent text-white font-semibold rounded-lg hover:bg-sz-accent-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isDetecting ? (
              <span>
                {detectionProgress?.message || 'Processing...'}
                {detectionProgress?.percent !== undefined && ` ${Math.round(detectionProgress.percent)}%`}
              </span>
            ) : (
              'Generate Clips'
            )}
          </button>

          {detectionError && (
            <p className="text-sm text-red-500">{detectionError}</p>
          )}
        </div>
      </div>
    );
  }

  // ========================================
  // SCREEN 2: REVIEW
  // ========================================
  if (screen === 'review' && currentClip) {
    const effectiveStart = currentClip.startTime + currentClip.trimStartOffset;
    const effectiveEnd = currentClip.endTime + currentClip.trimEndOffset;
    const duration = effectiveEnd - effectiveStart;

    return (
      <div className="h-screen w-screen flex flex-col bg-sz-bg text-sz-text">
        {/* Video Preview */}
        <div className="flex-1 flex items-center justify-center bg-black p-4">
          <video
            ref={videoRef}
            src={project ? `file://${project.filePath}` : undefined}
            className="max-h-full max-w-full"
            controls={false}
            onClick={() => {
              if (videoRef.current) {
                if (videoRef.current.paused) videoRef.current.play();
                else videoRef.current.pause();
              }
            }}
          />
        </div>

        {/* Clip Info & Controls */}
        <div className="p-6 bg-sz-bg-secondary border-t border-sz-border">
          <div className="max-w-2xl mx-auto space-y-4">
            {/* Clip Counter */}
            <div className="flex items-center justify-between">
              <p className="text-sm text-sz-text-muted">
                Clip {currentClipIndex + 1} of {clips.length}
              </p>
              <p className="text-sm text-sz-text-muted">
                {Math.floor(duration)}s • Score: {Math.round(currentClip.finalScore || 0)}
              </p>
            </div>

            {/* Title */}
            {currentClip.title && (
              <p className="font-medium">{currentClip.title}</p>
            )}

            {/* Captions Toggle */}
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showCaptions}
                onChange={(e) => setShowCaptions(e.target.checked)}
                className="w-4 h-4"
              />
              <span className="text-sm">Show Captions</span>
            </label>

            {/* Trim Controls */}
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <label className="text-xs text-sz-text-muted">Start Trim</label>
                <input
                  type="range"
                  min={-5}
                  max={5}
                  step={0.1}
                  value={currentClip.trimStartOffset}
                  onChange={(e) => updateClipTrim(currentClip.id, parseFloat(e.target.value), currentClip.trimEndOffset)}
                  className="w-full"
                />
                <p className="text-xs text-sz-text-muted">{currentClip.trimStartOffset.toFixed(1)}s</p>
              </div>
              <div className="flex-1">
                <label className="text-xs text-sz-text-muted">End Trim</label>
                <input
                  type="range"
                  min={-5}
                  max={5}
                  step={0.1}
                  value={currentClip.trimEndOffset}
                  onChange={(e) => updateClipTrim(currentClip.id, currentClip.trimStartOffset, parseFloat(e.target.value))}
                  className="w-full"
                />
                <p className="text-xs text-sz-text-muted">{currentClip.trimEndOffset.toFixed(1)}s</p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-3">
              <button
                onClick={handleAccept}
                className={`flex-1 py-3 px-4 rounded-lg font-medium transition-colors ${
                  currentClip.status === 'accepted'
                    ? 'bg-green-600 text-white'
                    : 'bg-sz-bg-tertiary hover:bg-green-600 hover:text-white'
                }`}
              >
                {currentClip.status === 'accepted' ? 'Accepted ✓' : 'Accept (A)'}
              </button>
              <button
                onClick={handleReject}
                className={`flex-1 py-3 px-4 rounded-lg font-medium transition-colors ${
                  currentClip.status === 'rejected'
                    ? 'bg-red-600 text-white'
                    : 'bg-sz-bg-tertiary hover:bg-red-600 hover:text-white'
                }`}
              >
                {currentClip.status === 'rejected' ? 'Rejected' : 'Reject (R)'}
              </button>
              <button
                onClick={handleExportClip}
                className="py-3 px-6 bg-sz-accent text-white rounded-lg font-medium hover:bg-sz-accent-hover transition-colors"
              >
                Export
              </button>
            </div>

            {/* Navigation + Export All */}
            <div className="flex items-center justify-between pt-4 border-t border-sz-border">
              <div className="flex items-center gap-2">
                <button
                  onClick={goToPrevClip}
                  disabled={currentClipIndex === 0}
                  className="px-4 py-2 bg-sz-bg-tertiary rounded-lg disabled:opacity-50"
                >
                  ← Prev
                </button>
                <button
                  onClick={goToNextClip}
                  disabled={currentClipIndex === clips.length - 1}
                  className="px-4 py-2 bg-sz-bg-tertiary rounded-lg disabled:opacity-50"
                >
                  Next →
                </button>
              </div>
              
              {acceptedClips.length > 0 && (
                <button
                  onClick={handleExportAll}
                  className="px-6 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-500 transition-colors"
                >
                  Export All ({acceptedClips.length})
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ========================================
  // SCREEN 3: EXPORT
  // ========================================
  if (screen === 'export') {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-sz-bg text-sz-text p-8">
        <div className="max-w-md w-full space-y-6 text-center">
          <h1 className="text-2xl font-bold">
            {isExporting ? 'Exporting...' : 'Export Complete'}
          </h1>

          {/* Progress */}
          {isExporting && exportProgress && (
            <div className="space-y-2">
              <div className="w-full h-2 bg-sz-bg-tertiary rounded-full overflow-hidden">
                <div
                  className="h-full bg-sz-accent transition-all"
                  style={{ width: `${(exportProgress.current / exportProgress.total) * 100}%` }}
                />
              </div>
              <p className="text-sm text-sz-text-muted">
                {exportProgress.current} of {exportProgress.total} clips
              </p>
              {exportProgress.clipName && (
                <p className="text-sm">{exportProgress.clipName}</p>
              )}
            </div>
          )}

          {/* Exported Clips List */}
          {!isExporting && exportedClips.length > 0 && (
            <div className="text-left bg-sz-bg-secondary rounded-lg p-4">
              <p className="text-sm font-medium mb-2">Exported:</p>
              {exportedClips.map((item, i) => (
                <p key={i} className="text-sm text-sz-text-muted">• {item}</p>
              ))}
            </div>
          )}

          {/* Open Folder */}
          {!isExporting && lastExportDir && (
            <button
              onClick={handleOpenFolder}
              className="w-full py-3 px-6 bg-sz-accent text-white rounded-lg font-medium hover:bg-sz-accent-hover transition-colors"
            >
              Open Folder
            </button>
          )}

          {/* Back to Review */}
          {!isExporting && (
            <button
              onClick={() => setScreen('review')}
              className="w-full py-3 px-6 bg-sz-bg-tertiary rounded-lg hover:bg-sz-bg-hover transition-colors"
            >
              Back to Review
            </button>
          )}
        </div>
      </div>
    );
  }

  // Fallback
  return (
    <div className="h-screen w-screen flex items-center justify-center bg-sz-bg text-sz-text">
      <p>Loading...</p>
    </div>
  );
}

export default App;
