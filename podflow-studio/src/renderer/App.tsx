import { useEffect, useRef, useState, useCallback } from 'react';
import { useStore } from './stores/store';
import { useHistoryStore } from './stores/historyStore';
import { ClipTypeSelector, type ClipMood } from './components/ui/ClipTypeSelector';
import { CaptionStyleSelector } from './components/ui/CaptionStyleSelector';
import { CaptionOverlay } from './components/ui/CaptionOverlay';
import { HistoryScreen } from './components/ui/HistoryScreen';
import { SettingsModal } from './components/ui/SettingsModal';
import type { Clip, Transcript } from './types';

// 4 screens: Home, Review, Export, History
type Screen = 'home' | 'review' | 'export' | 'history';

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
    transcript,
    captionStyle,
    setCaptionStyle,
  } = useStore();

  const { addProject, updateProject, addClip: addClipToHistory, getProjectClips, getProject } = useHistoryStore();

  const [screen, setScreen] = useState<Screen>('home');
  const [currentClipIndex, setCurrentClipIndex] = useState(0);
  const [exportedClips, setExportedClips] = useState<string[]>([]);
  const [showCaptions, setShowCaptions] = useState(true);
  const [selectedMood, setSelectedMood] = useState<ClipMood>('all');
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const [loadedFromHistory, setLoadedFromHistory] = useState(false);
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
        mood: clip.mood || 'impactful', // Add mood support
      }));

      setResults(clips, [], data.transcript as Transcript | null);
      setCurrentJobId(null);
      setLastJobId(data.projectId);
      
      // Add to history
      if (project && currentProjectId) {
        updateProject(currentProjectId, {
          clipCount: clips.length,
          acceptedCount: 0,
          transcript: data.transcript || null,
        });
      }
      
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

    // Add to history
    const projectId = addProject({
      fileName: project.fileName,
      filePath: project.filePath,
      duration: project.duration,
      clipCount: 0,
      acceptedCount: 0,
      thumbnailPath: project.thumbnailPath,
      size: project.size,
      resolution: project.resolution,
      width: project.width,
      height: project.height,
      fps: project.fps,
      bitrate: project.bitrate,
    });
    setCurrentProjectId(projectId);

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
  }, [project, settings, setCurrentJobId, setDetecting, setDetectionError, addProject]);

  // Current clip with mood filtering
  const filteredClips = selectedMood === 'all'
    ? clips
    : clips.filter(c => c.mood === selectedMood);
  
  // Reset index if out of bounds after filtering
  useEffect(() => {
    if (currentClipIndex >= filteredClips.length && filteredClips.length > 0) {
      setCurrentClipIndex(0);
    }
  }, [currentClipIndex, filteredClips.length]);
  
  const currentClip = filteredClips[currentClipIndex];
  const acceptedClips = clips.filter(c => c.status === 'accepted');

  // Navigation
  const goToNextClip = useCallback(() => {
    if (currentClipIndex < filteredClips.length - 1) {
      setCurrentClipIndex(currentClipIndex + 1);
    }
  }, [currentClipIndex, filteredClips.length]);

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

  // Export single clip with vertical format and captions
  const handleExportClip = useCallback(async () => {
    if (!project || !currentClip) return;

    try {
      const outputDir = await window.api.selectOutputDir();
      if (!outputDir) return;

      setScreen('export');
      setExporting(true);

      // Map caption style to settings
      const captionSettings = {
        viral: { fontSize: 72, outline: 4, shadow: 2 },
        minimal: { fontSize: 56, outline: 2, shadow: 1 },
        bold: { fontSize: 84, outline: 6, shadow: 3 },
      }[captionStyle] || { fontSize: 72, outline: 4, shadow: 2 };

      // Use MVP vertical export with captions
      await window.api.exportMvpClips({
        sourceFile: project.filePath,
        clips: [{
          clip_id: currentClip.id,
          start: currentClip.startTime + currentClip.trimStartOffset,
          end: currentClip.endTime + currentClip.trimEndOffset,
          duration: (currentClip.endTime + currentClip.trimEndOffset) - (currentClip.startTime + currentClip.trimStartOffset),
          captionStyle: (currentClip.captionStyle || captionStyle) as 'viral' | 'minimal' | 'bold' | undefined,
        }] as Array<{
          clip_id: string;
          start: number;
          end: number;
          duration: number;
          captionStyle?: 'viral' | 'minimal' | 'bold';
        }>,
        transcript: transcript || { segments: [] },
        outputDir,
        inputWidth: project.width || 1920,
        inputHeight: project.height || 1080,
        settings: {
          format: 'mp4',
          vertical: true,
          targetWidth: 1080,
          targetHeight: 1920,
          burnCaptions: true,
          captionStyle: {
            fontName: 'Arial Black',
            ...captionSettings,
          },
        },
      });

      // Update history
      if (currentProjectId) {
        updateProject(currentProjectId, {
          lastExportDir: outputDir,
          exportedCount: 1,
        });
        
        // Save exported clip to history
        addClipToHistory({
          projectId: currentProjectId,
          title: currentClip.title || currentClip.id,
          startTime: currentClip.startTime + currentClip.trimStartOffset,
          endTime: currentClip.endTime + currentClip.trimEndOffset,
          duration: (currentClip.endTime + currentClip.trimEndOffset) - (currentClip.startTime + currentClip.trimStartOffset),
          mood: currentClip.mood,
          exportedAt: Date.now(),
          exportPath: outputDir,
          captionStyle,
        });
      }
    } catch (err) {
      console.error('Export failed:', err);
      setExporting(false);
    }
  }, [project, currentClip, transcript, setExporting, currentProjectId, updateProject, addClipToHistory, captionStyle]);

  // Export all accepted clips with vertical format and captions
  const handleExportAll = useCallback(async () => {
    if (!project || acceptedClips.length === 0) return;

    try {
      const outputDir = await window.api.selectOutputDir();
      if (!outputDir) return;

      setScreen('export');
      setExporting(true);

      // Map caption style to settings
      const captionSettings = {
        viral: { fontSize: 72, outline: 4, shadow: 2 },
        minimal: { fontSize: 56, outline: 2, shadow: 1 },
        bold: { fontSize: 84, outline: 6, shadow: 3 },
      }[captionStyle] || { fontSize: 72, outline: 4, shadow: 2 };

      // Use MVP vertical export with captions
      await window.api.exportMvpClips({
        sourceFile: project.filePath,
        clips: acceptedClips.map(clip => ({
          clip_id: clip.id,
          start: clip.startTime + clip.trimStartOffset,
          end: clip.endTime + clip.trimEndOffset,
          duration: (clip.endTime + clip.trimEndOffset) - (clip.startTime + clip.trimStartOffset),
          captionStyle: clip.captionStyle || captionStyle,
        })),
        transcript: transcript || { segments: [] },
        outputDir,
        inputWidth: project.width || 1920,
        inputHeight: project.height || 1080,
        settings: {
          format: 'mp4',
          vertical: true,
          targetWidth: 1080,
          targetHeight: 1920,
          burnCaptions: true,
          captionStyle: {
            fontName: 'Arial Black',
            ...captionSettings,
          },
        },
      });

      // Update history
      if (currentProjectId) {
        updateProject(currentProjectId, {
          lastExportDir: outputDir,
          exportedCount: acceptedClips.length,
        });
        
        // Save all exported clips to history
        acceptedClips.forEach(clip => {
          addClipToHistory({
            projectId: currentProjectId,
            title: clip.title || clip.id,
            startTime: clip.startTime + clip.trimStartOffset,
            endTime: clip.endTime + clip.trimEndOffset,
            duration: (clip.endTime + clip.trimEndOffset) - (clip.startTime + clip.trimStartOffset),
            mood: clip.mood,
            exportedAt: Date.now(),
            exportPath: outputDir,
            captionStyle,
          });
        });
      }
    } catch (err) {
      console.error('Export failed:', err);
      setExporting(false);
    }
  }, [project, acceptedClips, transcript, setExporting, currentProjectId, updateProject, addClipToHistory, captionStyle]);

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
  // SCREEN: HISTORY
  // ========================================
  if (screen === 'history') {
    return (
      <HistoryScreen
        onBack={() => setScreen('home')}
        onLoadProject={(projectId) => {
          // Load exported clips from history
          const historyClips = getProjectClips(projectId);
          const historyProject = getProject(projectId);
          
          if (!historyProject || historyClips.length === 0) {
            console.log('No exported clips found for project:', projectId);
            setScreen('home');
            return;
          }
          
          // Convert history clips back to regular clips format
          const loadedClips: Clip[] = historyClips.map((clip) => ({
            id: clip.id,
            startTime: clip.startTime,
            endTime: clip.endTime,
            duration: clip.duration,
            pattern: 'payoff' as const,
            patternLabel: clip.title,
            description: `Exported clip`,
            algorithmScore: 100,
            finalScore: 100,
            hookStrength: 75,
            hookMultiplier: 1.0,
            trimStartOffset: 0,
            trimEndOffset: 0,
            status: 'accepted' as const,
            title: clip.title,
            mood: (clip.mood || 'impactful') as 'impactful' | 'funny' | 'serious' | 'somber' | 'energetic' | 'revealing' | undefined,
            captionStyle: clip.captionStyle,
          }));
          
          // Restore project metadata for preview/export context
          setProject({
            filePath: historyProject.filePath,
            fileName: historyProject.fileName,
            duration: historyProject.duration,
            size: historyProject.size ?? 0,
            resolution: historyProject.resolution,
            width: historyProject.width,
            height: historyProject.height,
            fps: historyProject.fps,
            thumbnailPath: historyProject.thumbnailPath,
            bitrate: historyProject.bitrate,
          });
          
          // Set the loaded clips and go to review screen
          setResults(loadedClips, [], historyProject.transcript || null);
          if (loadedClips[0]?.captionStyle) {
            setCaptionStyle(loadedClips[0].captionStyle);
          }
          setCurrentProjectId(projectId);
          setLoadedFromHistory(true);
          setCurrentClipIndex(0);
          setScreen('review');
        }}
      />
    );
  }

  // ========================================
  // SCREEN 1: HOME
  // ========================================
  if (screen === 'home') {
    return (
      <>
        <div className="h-screen w-screen flex flex-col items-center justify-center bg-sz-bg text-sz-text p-8">
          <div className="max-w-md w-full space-y-8 text-center">
          {/* Header with History Button */}
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-3xl font-bold flex-1">PodFlow</h1>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowSettings(true)}
                className="p-2 hover:bg-sz-bg-secondary rounded-lg transition-colors"
                title="Settings"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </button>
              <button
                onClick={() => setScreen('history')}
                className="p-2 hover:bg-sz-bg-secondary rounded-lg transition-colors"
                title="View History"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </button>
            </div>
          </div>
          
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

          {/* Review Clips Button (if clips exist) */}
          {clips.length > 0 && !isDetecting && (
            <div className="pt-4 border-t border-sz-border">
              <button
                onClick={() => setScreen('review')}
                className="w-full py-4 px-6 bg-sz-bg-secondary text-sz-accent font-semibold rounded-lg hover:bg-sz-bg-tertiary border-2 border-sz-accent transition-colors"
              >
                Review {clips.length} Generated Clips
              </button>
            </div>
          )}
        </div>
      </div>
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
      </>
    );
  }

  // ========================================
  // SCREEN 2: REVIEW
  // ========================================
  if (screen === 'review') {
    // Handle no clips after filtering
    if (filteredClips.length === 0) {
      return (
        <div className="h-screen w-screen flex flex-col bg-sz-bg text-sz-text">
          <div className="p-4 border-b border-sz-border flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setScreen('home')}
                className="p-2 hover:bg-sz-bg-secondary rounded-lg transition-colors"
                title="Back to Home"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
              </button>
              <ClipTypeSelector
                selectedMood={selectedMood}
                onMoodChange={(mood) => {
                  setSelectedMood(mood);
                  setCurrentClipIndex(0);
                }}
              />
            </div>
            <div className="text-sm text-sz-text-muted">
              0 clips (0 total)
            </div>
          </div>
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center space-y-4">
              <div className="text-6xl">🔍</div>
              <h3 className="text-xl font-semibold">No clips match this filter</h3>
              <p className="text-sz-text-muted">Try selecting a different mood or view all clips</p>
              <button
                onClick={() => setSelectedMood('all')}
                className="px-6 py-3 bg-sz-accent text-white rounded-lg hover:bg-sz-accent-hover transition-colors"
              >
                View All Clips
              </button>
            </div>
          </div>
        </div>
      );
    }

    if (!currentClip) {
      return (
        <div className="h-screen w-screen flex items-center justify-center bg-sz-bg text-sz-text">
          <p>Loading...</p>
        </div>
      );
    }

    const effectiveStart = currentClip.startTime + currentClip.trimStartOffset;
    const effectiveEnd = currentClip.endTime + currentClip.trimEndOffset;
    const duration = effectiveEnd - effectiveStart;

    return (
      <div className="h-screen w-screen flex flex-col bg-sz-bg text-sz-text">
        {/* Top Bar with Filter */}
        <div className="p-4 border-b border-sz-border flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => {
                if (loadedFromHistory) {
                  setLoadedFromHistory(false);
                  setScreen('history');
                } else {
                  setScreen('home');
                }
              }}
              className="p-2 hover:bg-sz-bg-secondary rounded-lg transition-colors"
              title={loadedFromHistory ? "Back to History" : "Back to Home"}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </button>
            {loadedFromHistory && (
              <div className="px-3 py-1 bg-blue-600/20 text-blue-400 text-sm rounded-lg border border-blue-600/30">
                📂 Viewing Exported Clips
              </div>
            )}
            <ClipTypeSelector
              selectedMood={selectedMood}
              onMoodChange={(mood) => {
                setSelectedMood(mood);
                setCurrentClipIndex(0);
              }}
            />
            <CaptionStyleSelector
              selectedStyle={captionStyle}
              onStyleChange={setCaptionStyle}
            />
          </div>
          <div className="text-sm text-sz-text-muted">
            {filteredClips.length} clips {selectedMood !== 'all' && `(${clips.length} total)`}
          </div>
        </div>

        {/* Video Preview */}
        <div className="flex-1 flex items-center justify-center bg-black p-4 relative">
          <video
            ref={videoRef}
            src={project ? `file://${project.filePath}` : undefined}
            className="max-h-full max-w-full"
            controls={false}
            onTimeUpdate={(e) => {
              const time = e.currentTarget.currentTime;
              setCurrentTime(time);
              // Loop clip when it reaches the end
              if (time >= effectiveEnd && videoRef.current) {
                videoRef.current.currentTime = effectiveStart;
              }
            }}
            onClick={() => {
              if (videoRef.current) {
                if (videoRef.current.paused) videoRef.current.play();
                else videoRef.current.pause();
              }
            }}
          />
          <CaptionOverlay
            transcript={transcript}
            currentTime={currentTime}
            clipStart={effectiveStart}
            clipEnd={effectiveEnd}
            captionStyle={captionStyle}
            show={showCaptions}
          />
        </div>

        {/* Clip Info & Controls */}
        <div className="p-6 bg-sz-bg-secondary border-t border-sz-border">
          <div className="max-w-2xl mx-auto space-y-4">
            {/* Clip Counter & Mood Badge */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <p className="text-sm text-sz-text-muted">
                  Clip {currentClipIndex + 1} of {filteredClips.length}
                </p>
                {currentClip.mood && (
                  <span className="px-2 py-1 text-xs bg-sz-bg-tertiary rounded">
                    {currentClip.mood}
                  </span>
                )}
              </div>
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
            {!loadedFromHistory && (
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
            )}

            {loadedFromHistory && (
              <div className="flex items-center justify-center py-3 px-4 bg-blue-600/20 text-blue-400 rounded-lg border border-blue-600/30">
                <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                Already Exported
              </div>
            )}

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
              
              {!loadedFromHistory && acceptedClips.length > 0 && (
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
    <>
      <div className="h-screen w-screen flex items-center justify-center bg-sz-bg text-sz-text">
        <p>Loading...</p>
      </div>
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
    </>
  );
}

export default App;
