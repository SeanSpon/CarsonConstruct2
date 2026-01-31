import { useEffect, useRef, useState, useCallback } from 'react';
import { useStore } from './stores/store';
import { useHistoryStore } from './stores/historyStore';
import { ClipTypeSelector, type ClipMood } from './components/ui/ClipTypeSelector';
import { CaptionStyleSelector } from './components/ui/CaptionStyleSelector';
import { CaptionOverlay } from './components/ui/CaptionOverlay';
import { ProgressLoader } from './components/ui/LoadingState';
import { HistoryScreen } from './components/ui/HistoryScreen';
import { VideoAndTranscriptModal } from './components/ui/VideoAndTranscriptModal';
import { SettingsModal } from './components/ui/SettingsModal';
import type { Clip, Transcript } from './types';

// 4 screens: Home, Review, Export, History
type Screen = 'home' | 'review' | 'export' | 'history';

function App() {
  const { 
    project,
    setProject,
    clips,
    detectionProgress,
    setDetectionProgress, 
    setDetectionError, 
    setDetecting,
    isDetecting,
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
    transcriptAvailable,
    transcriptError,
    transcriptSource,
    setTranscriptMeta,
    captionStyle,
    setCaptionStyle,
    openaiApiKey,
  } = useStore();

  const { addProject, updateProject, addClip: addClipToHistory, getProjectClips, getProject } = useHistoryStore();

  const [screen, setScreen] = useState<Screen>('home');
  const [currentClipIndex, setCurrentClipIndex] = useState(0);
  const [exportedClips, setExportedClips] = useState<string[]>([]);
  const [showCaptions, setShowCaptions] = useState(true);
  const [selectedMood, setSelectedMood] = useState<ClipMood>('all');
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [loadedFromHistory, setLoadedFromHistory] = useState(false);
  const [showVideoTranscriptModal, setShowVideoTranscriptModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const currentJobIdRef = useRef<string | null>(currentJobId);
  const detectingStartedAtRef = useRef<number | null>(null);
  const projectRef = useRef(project);
  const currentProjectIdRef = useRef<string | null>(currentProjectId);

  useEffect(() => {
    currentJobIdRef.current = currentJobId;
  }, [currentJobId]);

  useEffect(() => {
    projectRef.current = project;
  }, [project]);

  useEffect(() => {
    currentProjectIdRef.current = currentProjectId;
  }, [currentProjectId]);

  const ensureMinDetectingTime = useCallback(async (minMs = 400) => {
    const startedAt = detectingStartedAtRef.current;
    if (!startedAt) return;
    const elapsed = Date.now() - startedAt;
    if (elapsed < minMs) {
      await new Promise((resolve) => setTimeout(resolve, minMs - elapsed));
    }
  }, []);

  const handleCancelDetection = useCallback(async () => {
    const jobId = currentJobIdRef.current;
    if (!jobId) return;
    try {
      await window.api.cancelDetection(jobId);
    } catch {
      // ignore
    } finally {
      setCurrentJobId(null);
      setDetecting(false);
      setDetectionProgress(null);
      setDetectionError('Detection cancelled');
    }
  }, [setCurrentJobId, setDetecting, setDetectionProgress, setDetectionError]);

  const detectingOverlay = isDetecting ? (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-sz-bg/90 backdrop-blur-sm">
      <ProgressLoader
        percent={detectionProgress?.percent || 0}
        message={detectionProgress?.message || 'Detecting clips...'}
        subMessage={transcriptSource ? `Transcript source: ${transcriptSource}` : undefined}
        onCancel={handleCancelDetection}
        className="w-full max-w-md mx-6"
      />
    </div>
  ) : null;

  const inferMoodFromPattern = useCallback((pattern: Clip['pattern'] | undefined): Clip['mood'] => {
    switch (pattern) {
      case 'laughter':
        return 'funny';
      case 'debate':
        return 'serious';
      case 'monologue':
        return 'revealing';
      case 'payoff':
      default:
        return 'impactful';
    }
  }, []);

  // Log store hydration on mount
  useEffect(() => {
    console.log('[App Mount] Store hydration check:', {
      clips: clips.length,
      transcriptSegments: transcript?.segments?.length || 0,
      captionStyle: captionStyle,
      screen: screen,
    });
  }, []);

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

    const unsubComplete = window.api.onDetectionComplete(async (data) => {
      const jobId = currentJobIdRef.current;
      if (jobId && data.projectId !== jobId) return;

      await ensureMinDetectingTime();
      
      const transcriptAvailableFromPayload = (data as any).transcriptAvailable as boolean | undefined;
      const transcriptErrorFromPayload = ((data as any).transcriptError as string | null | undefined) ?? null;
      const transcriptSourceFromPayload = ((data as any).transcriptSource as string | null | undefined) ?? null;

      console.log('[App] Detection complete, clips:', data.clips?.length, 'transcript segments:', (data.transcript as any)?.segments?.length);
      const rawClips = Array.isArray(data.clips) ? data.clips : [];
      const clips = (rawClips as Clip[]).map((clip, index) => ({
        ...clip,
        id: clip.id || `clip_${index + 1}`,
        status: 'pending' as const,
        trimStartOffset: clip.trimStartOffset || 0,
        trimEndOffset: clip.trimEndOffset || 0,
        mood: (clip.mood as Clip['mood']) || inferMoodFromPattern((clip as any).pattern),
      }));

      console.log('[App] Processed clips:', clips.length);
      console.log('[App] Transcript received:', data.transcript ? `${(data.transcript as any)?.segments?.length || 0} segments` : 'null');
      setResults(clips, [], data.transcript as Transcript | null, {
        transcriptAvailable: transcriptAvailableFromPayload,
        transcriptError: transcriptErrorFromPayload,
        transcriptSource: transcriptSourceFromPayload,
      });
      setCurrentJobId(null);
      setLastJobId(data.projectId);
      detectingStartedAtRef.current = null;
      
      // Add to history
      const projectForHistory = projectRef.current;
      const projectIdForHistory = currentProjectIdRef.current;
      if (projectForHistory && projectIdForHistory) {
        console.log('[App] Saving transcript to history project:', projectIdForHistory);
        updateProject(projectIdForHistory, {
          clipCount: clips.length,
          acceptedCount: 0,
          transcript: data.transcript || null,
          transcriptAvailable: transcriptAvailableFromPayload,
          transcriptError: transcriptErrorFromPayload,
          transcriptSource: transcriptSourceFromPayload,
        });
      }
      
      if (clips.length > 0) {
        console.log('[App] Setting screen to review');
        setScreen('review');
        setCurrentClipIndex(0);
      } else {
        console.log('[App] No clips returned, staying on home screen');
      }
    });

    const unsubError = window.api.onDetectionError(async (data) => {
      const jobId = currentJobIdRef.current;
      if (jobId && data.projectId !== jobId) return;

      await ensureMinDetectingTime();
      setDetectionError(data.error);
      setCurrentJobId(null);
      detectingStartedAtRef.current = null;
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
  }, [ensureMinDetectingTime, inferMoodFromPattern, setDetectionProgress, setDetectionError, setResults, setExportProgress, setExporting, setLastExportDir, setCurrentJobId, setLastJobId]);

  // Handle file selection
  const handleSelectFile = useCallback(async () => {
    setShowVideoTranscriptModal(true);
  }, []);

  // Start detection (used for other screens, not modal)
  const handleGenerate = useCallback(async () => {
    console.log('[App] handleGenerate called, project:', project?.fileName);
    if (!project) {
      console.log('[App] handleGenerate: No project');
      return;
    }

    const jobId = `job_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    console.log('[App] Starting detection with jobId:', jobId);
    setCurrentJobId(jobId);
    setDetecting(true);
    setDetectionError(null);
    setTranscriptMeta({ transcriptAvailable: false, transcriptError: null, transcriptSource: null });
    detectingStartedAtRef.current = Date.now();

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
      console.log('[App] Calling startDetection API');
      const result = await window.api.startDetection(
        jobId,
        project.filePath,
        { ...settings, openaiApiKey: openaiApiKey || undefined },
        project.duration
      );

      console.log('[App] startDetection result:', result);
      if (!result.success) {
        setDetectionError(result.error || 'Failed to start detection');
        setDetecting(false);
      }
    } catch (err) {
      console.error('[App] startDetection error:', err);
      setDetectionError(String(err));
      setDetecting(false);
    }
  }, [project, settings, openaiApiKey, setCurrentJobId, setDetecting, setDetectionError, setTranscriptMeta, addProject]);

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
      <>
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
          const loadedTranscript = historyProject.transcript || null;
          console.log('[History Load] Loading transcript:', loadedTranscript ? `${(loadedTranscript as any)?.segments?.length || 0} segments` : 'null');
          setResults(loadedClips, [], loadedTranscript, {
            transcriptAvailable: historyProject.transcriptAvailable,
            transcriptError: historyProject.transcriptError ?? null,
            transcriptSource: historyProject.transcriptSource ?? null,
          });
          if (loadedClips[0]?.captionStyle) {
            setCaptionStyle(loadedClips[0].captionStyle);
          }
          setCurrentProjectId(projectId);
          setLoadedFromHistory(true);
          setCurrentClipIndex(0);
          setScreen('review');
          }}
        />
        {detectingOverlay}
      </>
    );
  }

  // ========================================
  // SCREEN 1: HOME
  // ========================================
  if (screen === 'home') {
    return (
      <>
        <div className="h-screen w-screen flex flex-col bg-sz-bg text-sz-text relative">
          {/* Settings and History Buttons - Fixed Top Right */}
          <div className="absolute top-6 right-6 flex gap-2 z-10">
            <button
              onClick={() => setShowSettingsModal(true)}
              className="p-2.5 hover:bg-sz-bg-secondary rounded-lg transition-colors"
              title="Settings"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
            <button
              onClick={() => setScreen('history')}
              className="p-2.5 hover:bg-sz-bg-secondary rounded-lg transition-colors"
              title="View History"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </button>
          </div>

          {/* Main Content - Centered */}
          <div className="flex-1 flex items-center justify-center px-8">
            <div className="max-w-2xl w-full space-y-8">
              {/* Header */}
              <div className="text-center space-y-2">
                <h1 className="text-5xl font-bold tracking-tight">PodFlow ®</h1>
                <p className="text-lg text-sz-text-muted">Find the best clips in your podcast</p>
              </div>

              {/* Workflow Steps */}
              <div className="grid grid-cols-4 gap-4">
                <div className="text-center space-y-2">
                  <div className="w-12 h-12 rounded-full bg-sz-accent text-white flex items-center justify-center text-lg font-bold mx-auto">1</div>
                  <div>
                    <p className="font-semibold text-sm">Upload Video</p>
                    <p className="text-xs text-sz-text-muted mt-1">Select your podcast video file</p>
                  </div>
                </div>
                <div className="text-center space-y-2">
                  <div className="w-12 h-12 rounded-full bg-sz-accent text-white flex items-center justify-center text-lg font-bold mx-auto">2</div>
                  <div>
                    <p className="font-semibold text-sm">Add Transcript</p>
                    <p className="text-xs text-sz-text-muted mt-1">Upload SRT/VTT for captions</p>
                  </div>
                </div>
                <div className="text-center space-y-2">
                  <div className="w-12 h-12 rounded-full bg-sz-accent text-white flex items-center justify-center text-lg font-bold mx-auto">3</div>
                  <div>
                    <p className="font-semibold text-sm">Review Clips</p>
                    <p className="text-xs text-sz-text-muted mt-1">Accept/reject with captions visible</p>
                  </div>
                </div>
                <div className="text-center space-y-2">
                  <div className="w-12 h-12 rounded-full bg-sz-accent text-white flex items-center justify-center text-lg font-bold mx-auto">4</div>
                  <div>
                    <p className="font-semibold text-sm">Export</p>
                    <p className="text-xs text-sz-text-muted mt-1">Save clips with captions burned in</p>
                  </div>
                </div>
              </div>

              {/* New Project Button */}
              <button
                onClick={handleSelectFile}
                className="w-full p-12 border-2 border-dashed border-sz-border rounded-2xl hover:border-sz-accent hover:bg-sz-bg-secondary transition-all group"
              >
                <p className="text-5xl mb-3 group-hover:scale-110 transition-transform">🎬</p>
                <p className="font-bold text-xl mb-1">Start New Project</p>
                <p className="text-sm text-sz-text-muted">Upload video + transcript</p>
              </button>

              {/* Review Clips Button (if clips exist) */}
              {clips.length > 0 && !isDetecting && (
                <button
                  onClick={() => setScreen('review')}
                  className="w-full py-5 px-6 bg-sz-accent text-white font-bold rounded-xl hover:bg-sz-accent-hover transition-all shadow-lg hover:shadow-xl text-lg"
                >
                  📺 Review {clips.length} Detected Clips
                </button>
              )}

          {isDetecting && (
            <div className="space-y-4 bg-sz-bg-secondary rounded-xl p-6 border border-sz-border">
              <div className="flex items-center justify-between">
                <p className="font-semibold">Detecting clips...</p>
                <p className="text-sm text-sz-text-muted">{Math.round(detectionProgress?.percent || 0)}%</p>
              </div>
              <div className="w-full h-3 bg-sz-bg-tertiary rounded-full overflow-hidden">
                <div
                  className="h-full bg-sz-accent transition-all duration-300 ease-out"
                  style={{ width: `${detectionProgress?.percent || 0}%` }}
                />
              </div>
              <p className="text-sm text-sz-text-muted">{detectionProgress?.message || 'Processing...'}</p>
            </div>
          )}

          {detectionError && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
              <p className="text-sm text-red-400">{detectionError}</p>
            </div>
          )}
            </div>
          </div>
        </div>

        {showVideoTranscriptModal && (
        <VideoAndTranscriptModal
          onConfirm={async (data) => {
            console.log('[App] Modal confirmed with:', data);
            try {
              const validation = await window.api.validateFile(data.videoPath);
              if (!validation.valid) {
                alert('Invalid video file');
                return;
              }

              // Create project object from validation data
              const projectData = {
                filePath: data.videoPath,
                fileName: data.videoName,
                size: data.videoSize,
                duration: validation.duration || 0,
                resolution: validation.resolution,
                width: validation.width,
                height: validation.height,
                fps: validation.fps,
                thumbnailPath: validation.thumbnailPath,
                bitrate: validation.bitrate,
                videoHash: data.videoHash,
              };

              // Set project AND start detection immediately with the project data
              setProject(projectData);
              setShowVideoTranscriptModal(false);
              
              // Start detection immediately using the local projectData instead of relying on state
              const jobId = `job_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
              console.log('[App] Starting detection with jobId:', jobId);
              
              setCurrentJobId(jobId);
              setDetecting(true);
              setDetectionError(null);
              setTranscriptMeta({ transcriptAvailable: false, transcriptError: null, transcriptSource: null });
              detectingStartedAtRef.current = Date.now();

              // Add to history
              const projectId = addProject({
                fileName: projectData.fileName,
                filePath: projectData.filePath,
                duration: projectData.duration,
                clipCount: 0,
                acceptedCount: 0,
                thumbnailPath: projectData.thumbnailPath,
                size: projectData.size,
                resolution: projectData.resolution,
                width: projectData.width,
                height: projectData.height,
                fps: projectData.fps,
                bitrate: projectData.bitrate,
              });
              setCurrentProjectId(projectId);

              try {
                console.log('[App] Calling startDetection API');
                const result = await window.api.startDetection(
                  jobId,
                  projectData.filePath,
                  { ...settings, openaiApiKey: openaiApiKey || undefined },
                  projectData.duration
                );

                console.log('[App] startDetection result:', result);
                if (!result.success) {
                  setDetectionError(result.error || 'Failed to start detection');
                  setDetecting(false);
                }
              } catch (err) {
                console.error('[App] startDetection error:', err);
                setDetectionError(String(err));
                setDetecting(false);
              }
            } catch (err: unknown) {
              const errorMessage = err instanceof Error ? err.message : String(err);
              console.error('[App] Modal error:', errorMessage);
              alert('Error: ' + errorMessage);
            }
          }}
          onCancel={() => setShowVideoTranscriptModal(false)}
        />
      )}

      {showSettingsModal && (
        <SettingsModal onClose={() => setShowSettingsModal(false)} />
      )}
        {detectingOverlay}
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
        <>
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
          {detectingOverlay}
        </>
      );
    }

    if (!currentClip) {
      return (
        <>
          <div className="h-screen w-screen flex items-center justify-center bg-sz-bg text-sz-text">
            <div className="text-center space-y-4">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sz-accent mx-auto"></div>
              <p className="text-sz-text-muted">Loading clips...</p>
            </div>
          </div>
          {detectingOverlay}
        </>
      );
    }

    const effectiveStart = currentClip.startTime + currentClip.trimStartOffset;
    const effectiveEnd = currentClip.endTime + currentClip.trimEndOffset;
    const duration = effectiveEnd - effectiveStart;

    return (
      <>
        <div className="h-screen w-screen flex flex-col bg-sz-bg text-sz-text">
          {/* Caption Warning Banner */}
          {showCaptions && (!transcriptAvailable || !transcript || !transcript.segments || transcript.segments.length === 0) && (
            <div className="bg-yellow-500/10 border-b border-yellow-500/30 px-4 py-2 flex items-center gap-2">
              <svg className="w-5 h-5 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span className="text-sm text-yellow-400">
                ⚠️ No transcript available — captions won’t show.
                {transcriptError ? ` ${transcriptError}` : ''}
              </span>
            </div>
          )}
        
        {/* Top Bar with Filter */}
        <div className="p-4 border-b border-sz-border flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => {
                if (loadedFromHistory) {
                  console.log('[Review] Going back to history');
                  setLoadedFromHistory(false);
                  setScreen('history');
                } else {
                  console.log('[Review] Going back to home, current transcript segments:', transcript?.segments?.length || 0);
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
            transcriptAvailable={transcriptAvailable}
            transcriptError={transcriptError}
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
                <p className="text-sm font-semibold text-sz-accent">
                  Clip {currentClipIndex + 1} of {filteredClips.length}
                </p>
                {currentClip.mood && (
                  <span className="px-3 py-1 text-xs font-medium bg-sz-accent/20 text-sz-accent rounded-full">
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
              <p className="font-semibold text-lg">{currentClip.title}</p>
            )}

            {/* Caption Controls - More Prominent */}
            <div className="bg-sz-bg border border-sz-accent/30 rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer flex-1">
                  <input
                    type="checkbox"
                    checked={showCaptions}
                    onChange={(e) => {
                      console.log('[Captions] Toggle to:', e.target.checked);
                      setShowCaptions(e.target.checked);
                    }}
                    className="w-4 h-4 accent-sz-accent"
                  />
                  <span className="text-sm font-medium">
                    {showCaptions ? '📝 Captions ON' : '📝 Captions OFF'}
                  </span>
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-xs bg-sz-accent/20 px-2 py-1 rounded text-sz-accent font-medium">
                    {captionStyle}
                  </span>
                  <button
                    onClick={() => {
                      // Simple cycle through caption styles
                      const styles: Array<'viral' | 'minimal' | 'bold'> = ['viral', 'minimal', 'bold'];
                      const currentIdx = styles.indexOf(captionStyle);
                      const nextIdx = (currentIdx + 1) % styles.length;
                      console.log('[Captions] Switching style from', captionStyle, 'to', styles[nextIdx]);
                      setCaptionStyle(styles[nextIdx]);
                    }}
                    className="text-xs px-2 py-1 bg-sz-bg-tertiary hover:bg-sz-accent/20 rounded transition-colors"
                  >
                    Change Style
                  </button>
                </div>
              </div>
              {(() => {
                const hasSegments = !!(transcript && transcript.segments && transcript.segments.length > 0);
                const available = transcriptAvailable || hasSegments;
                console.log('[Captions] Render check - available:', available, 'segments:', transcript?.segments?.length || 0, 'showCaptions:', showCaptions);
                
                if (showCaptions && available && hasSegments) {
                  return (
                    <p className="text-xs text-green-400">
                      ✓ {transcript.segments.length} transcript segments loaded • Captions will appear on video
                    </p>
                  );
                } else if (!showCaptions) {
                  return (
                    <p className="text-xs text-sz-text-muted">
                      Enable captions to see transcript on the video preview
                    </p>
                  );
                } else {
                  return (
                    <p className="text-xs text-yellow-400">
                      ⚠ No transcript available{transcriptError ? `: ${transcriptError}` : ' — upload transcript file or re-run detection'}
                    </p>
                  );
                }
              })()}
            </div>

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
              <div className="space-y-3">
                <p className="text-xs uppercase tracking-wider text-sz-text-muted font-semibold">Step 1: Accept or Reject</p>
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleAccept}
                    className={`flex-1 py-3 px-4 rounded-lg font-semibold transition-all transform hover:scale-105 ${
                      currentClip.status === 'accepted'
                        ? 'bg-green-600 text-white shadow-lg shadow-green-600/50'
                        : 'bg-sz-bg-tertiary text-sz-text hover:bg-green-600 hover:text-white'
                    }`}
                  >
                    {currentClip.status === 'accepted' ? '✓ Accepted' : '✓ Accept (A)'}
                  </button>
                  <button
                    onClick={handleReject}
                    className={`flex-1 py-3 px-4 rounded-lg font-semibold transition-all transform hover:scale-105 ${
                      currentClip.status === 'rejected'
                        ? 'bg-red-600 text-white shadow-lg shadow-red-600/50'
                        : 'bg-sz-bg-tertiary text-sz-text hover:bg-red-600 hover:text-white'
                    }`}
                  >
                    {currentClip.status === 'rejected' ? '✗ Rejected' : '✗ Reject (R)'}
                  </button>
                </div>
                <p className="text-xs text-sz-text-muted text-center">Use arrow keys to navigate clips →</p>
              </div>
            )}

            {loadedFromHistory && (
              <div className="flex items-center justify-center py-3 px-4 bg-blue-600/20 text-blue-400 rounded-lg border border-blue-600/30">
                <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                Already Exported ✓
              </div>
            )}

            {/* Export Section */}
            {!loadedFromHistory && (
              <div className="bg-sz-bg border-2 border-sz-accent/30 rounded-lg p-4 space-y-3">
                <p className="text-xs uppercase tracking-wider text-sz-accent font-semibold">Step 2: Export Clips</p>
                <div className="flex flex-col gap-2">
                  <button
                    onClick={handleExportClip}
                    className="w-full py-3 px-4 bg-sz-accent text-white rounded-lg font-semibold hover:bg-sz-accent-hover transition-all transform hover:scale-105"
                  >
                    Export This Clip →
                  </button>
                  {acceptedClips.length > 1 && (
                    <button
                      onClick={handleExportAll}
                      className="w-full py-3 px-4 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-500 transition-all transform hover:scale-105"
                    >
                      Export All {acceptedClips.length} Accepted →
                    </button>
                  )}
                </div>
                <p className="text-xs text-sz-text-muted text-center">
                  {acceptedClips.length === 0
                    ? 'Accept clips above to enable export'
                    : acceptedClips.length === 1
                    ? `${acceptedClips.length} clip ready to export`
                    : `${acceptedClips.length} clips ready to export`}
                </p>
              </div>
            )}

            {/* Navigation + Export All */}
            <div className="flex items-center justify-between pt-4 border-t border-sz-border">
              <div className="flex items-center gap-2">
                <button
                  onClick={goToPrevClip}
                  disabled={currentClipIndex === 0}
                  className="px-4 py-2 bg-sz-bg-tertiary rounded-lg hover:bg-sz-bg-hover disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors"
                >
                  ← Prev
                </button>
                <span className="text-xs text-sz-text-muted px-2">
                  {currentClipIndex + 1} / {filteredClips.length}
                </span>
                <button
                  onClick={goToNextClip}
                  disabled={currentClipIndex === clips.length - 1}
                  className="px-4 py-2 bg-sz-bg-tertiary rounded-lg hover:bg-sz-bg-hover disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors"
                >
                  Next →
                </button>
              </div>
              
              {loadedFromHistory && (
                <button
                  onClick={() => setScreen('home')}
                  className="px-6 py-2 bg-sz-accent text-white rounded-lg font-medium hover:bg-sz-accent-hover transition-colors"
                >
                  Done
                </button>
              )}
            </div>
          </div>
        </div>
        </div>
        {detectingOverlay}
      </>
    );
  }

  // ========================================
  // SCREEN 3: EXPORT
  // ========================================
  if (screen === 'export') {
    return (
      <>
        <div className="h-screen w-screen flex flex-col items-center justify-center bg-sz-bg text-sz-text p-8">
          <div className="max-w-md w-full space-y-6 text-center">
          {isExporting ? (
            <>
              <div className="space-y-2 mb-4">
                <div className="text-5xl animate-pulse">🚀</div>
                <h1 className="text-2xl font-bold">Exporting Clips...</h1>
              </div>

              {/* Progress */}
              {exportProgress && (
                <div className="space-y-4 bg-sz-bg-secondary rounded-lg p-6">
                  <div className="w-full h-3 bg-sz-bg-tertiary rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-sz-accent to-green-500 transition-all duration-300"
                      style={{ width: `${(exportProgress.current / exportProgress.total) * 100}%` }}
                    />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-semibold">
                      {exportProgress.current} of {exportProgress.total} clips
                    </p>
                    {exportProgress.clipName && (
                      <p className="text-xs text-sz-text-muted">{exportProgress.clipName}</p>
                    )}
                  </div>
                </div>
              )}
            </>
          ) : (
            <>
              <div className="space-y-2 mb-4">
                <div className="text-5xl">✅</div>
                <h1 className="text-2xl font-bold">Export Complete!</h1>
              </div>

              {/* Exported Clips List */}
              {exportedClips.length > 0 && (
                <div className="text-left bg-green-600/20 border border-green-600/30 rounded-lg p-4 space-y-2">
                  <p className="text-sm font-semibold text-green-400 mb-2">✓ Exported {exportedClips.length} clips with captions</p>
                  {exportedClips.map((item, i) => (
                    <p key={i} className="text-xs text-green-300">
                      • {item}
                    </p>
                  ))}
                </div>
              )}

              {/* Open Folder */}
              {lastExportDir && (
                <button
                  onClick={handleOpenFolder}
                  className="w-full py-3 px-6 bg-sz-accent text-white rounded-lg font-semibold hover:bg-sz-accent-hover transition-all transform hover:scale-105"
                >
                  📁 Open Export Folder
                </button>
              )}

              {/* Navigation Options */}
              <div className="flex flex-col gap-2 pt-4">
                <button
                  onClick={() => {
                    setExportedClips([]);
                    setScreen('review');
                  }}
                  className="w-full py-2 px-6 bg-sz-bg-secondary rounded-lg hover:bg-sz-bg-tertiary transition-colors font-medium"
                >
                  Back to Review
                </button>
                <button
                  onClick={() => {
                    setExportedClips([]);
                    setScreen('home');
                  }}
                  className="w-full py-2 px-6 bg-sz-bg-secondary rounded-lg hover:bg-sz-bg-tertiary transition-colors font-medium"
                >
                  New Project
                </button>
              </div>
            </>
          )}
          </div>
        </div>
        {detectingOverlay}
      </>
    );
  }

  // Fallback
  return (
    <>
      <div className="h-screen w-screen flex items-center justify-center bg-sz-bg text-sz-text">
        <p>Loading...</p>
      </div>
      {detectingOverlay}
      {showVideoTranscriptModal && (
        <VideoAndTranscriptModal
          onConfirm={async (data) => {
            try {
              const validation = await window.api.validateFile(data.videoPath);
              if (!validation.valid) {
                alert('Invalid video file');
                return;
              }

              setProject({
                filePath: data.videoPath,
                fileName: data.videoName,
                size: data.videoSize,
                duration: validation.duration || 0,
                resolution: validation.resolution,
                width: validation.width,
                height: validation.height,
                fps: validation.fps,
                thumbnailPath: validation.thumbnailPath,
                bitrate: validation.bitrate,
                videoHash: data.videoHash,
              });

              setShowVideoTranscriptModal(false);
              handleGenerate();
            } catch (err: unknown) {
              const errorMessage = err instanceof Error ? err.message : String(err);
              console.error('[App] Fallback modal error:', errorMessage);
              alert('Error: ' + errorMessage);
            }
          }}
          onCancel={() => setShowVideoTranscriptModal(false)}
        />
      )}
    </>
  );
}

export default App;
