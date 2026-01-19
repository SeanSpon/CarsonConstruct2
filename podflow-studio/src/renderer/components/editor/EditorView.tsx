import { memo, useState, useCallback, useEffect, useRef } from 'react';
import { useStore } from '../../stores/store';
import { estimateAiCost, formatCost } from '../../types';
import type { Clip, EditingPreferences } from '../../types';

import Header from './Header';
import DropZone from './DropZone';
import StatusBar from './StatusBar';
import VideoPreview from './VideoPreview';
import Timeline from './Timeline';
import QuickActions from './QuickActions';
import ClipStrip from './ClipStrip';
import ProgressOverlay from './ProgressOverlay';
import SettingsDrawer from './SettingsDrawer';
import ProjectSetup from './ProjectSetup';

function EditorView() {
  const {
    project,
    setProject,
    clearProject,
    clips,
    isDetecting,
    detectionProgress,
    detectionError,
    isExporting,
    settings,
    exportSettings,
    recentProjects,
    removeRecentProject,
    setDetecting,
    setDetectionError,
    setCurrentJobId,
    currentJobId,
    updateClipStatus,
    lastJobId,
    setupComplete,
    setSetupComplete,
    editingPreferences,
    setEditingPreferences,
    setCameras,
  } = useStore();

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Get selected clip
  const selectedClip = clips.find(c => c.id === selectedClipId) || null;

  // Auto-select first clip when clips change
  useEffect(() => {
    if (clips.length > 0 && !selectedClipId) {
      setSelectedClipId(clips[0].id);
    }
  }, [clips, selectedClipId]);

  // Handle file selection
  const handleSelectFile = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const file = await window.api.selectFile();
      if (!file) {
        setIsLoading(false);
        return;
      }

      const validation = await window.api.validateFile(file.path);
      if (!validation.valid) {
        setError(validation.error || 'Invalid video file');
        setIsLoading(false);
        return;
      }

      setProject({
        filePath: file.path,
        fileName: file.name,
        size: file.size,
        duration: validation.duration || 0,
      });
    } catch (err) {
      setError(String(err));
    } finally {
      setIsLoading(false);
    }
  }, [setProject]);

  // Handle file drop
  const handleFileDrop = useCallback(async (filePath: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const validation = await window.api.validateFile(filePath);
      if (!validation.valid) {
        setError(validation.error || 'Invalid video file');
        setIsLoading(false);
        return;
      }

      const fileName = filePath.split(/[\\/]/).pop() || 'Unknown';
      setProject({
        filePath,
        fileName,
        size: 0,
        duration: validation.duration || 0,
      });
    } catch (err) {
      setError(String(err));
    } finally {
      setIsLoading(false);
    }
  }, [setProject]);

  // Handle opening recent project
  const handleOpenRecent = useCallback(async (filePath: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const validation = await window.api.validateFile(filePath);
      if (!validation.valid) {
        setError('File no longer exists or is invalid');
        removeRecentProject(filePath);
        setIsLoading(false);
        return;
      }

      const fileName = filePath.split(/[\\/]/).pop() || 'Unknown';
      setProject({
        filePath,
        fileName,
        size: 0,
        duration: validation.duration || 0,
      });
    } catch (err) {
      setError(String(err));
    } finally {
      setIsLoading(false);
    }
  }, [removeRecentProject, setProject]);

  // Start detection
  const handleStartDetection = useCallback(async () => {
    // #region agent log
    console.log('[DEBUG] handleStartDetection called, project:', !!project);
    fetch('http://127.0.0.1:7244/ingest/35756edc-cf7d-4d9e-ab6e-5b8765ec420b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'EditorView.tsx:handleStartDetection:START',message:'Function entry',data:{hasProject:!!project},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'E'})}).catch(()=>{});
    // #endregion
    if (!project) return;

    setDetecting(true);
    setDetectionError(null);

    // #region agent log
    console.log('[DEBUG] About to check AI enhancement, useAiEnhancement:', settings.useAiEnhancement, 'duration:', project.duration);
    fetch('http://127.0.0.1:7244/ingest/35756edc-cf7d-4d9e-ab6e-5b8765ec420b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'EditorView.tsx:handleStartDetection:beforeConfirm',message:'Before confirm check',data:{useAiEnhancement:settings.useAiEnhancement,duration:project.duration},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'E'})}).catch(()=>{});
    // #endregion

    if (settings.useAiEnhancement && project.duration > 0) {
      const estimate = estimateAiCost(project.duration, settings.targetCount);
      const confirmed = window.confirm(
        `Estimated AI cost: ${formatCost(estimate.total)} (Whisper ${formatCost(estimate.whisperCost)} + GPT ${formatCost(estimate.gptCost)}). Continue?`
      );
      // #region agent log
      console.log('[DEBUG] confirm result:', confirmed);
      fetch('http://127.0.0.1:7244/ingest/35756edc-cf7d-4d9e-ab6e-5b8765ec420b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'EditorView.tsx:handleStartDetection:afterConfirm',message:'After confirm dialog',data:{confirmed},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'E'})}).catch(()=>{});
      // #endregion
      if (!confirmed) {
        setDetecting(false);
        return;
      }
    }

    const jobId = `job_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    setCurrentJobId(jobId);

    // #region agent log
    fetch('http://127.0.0.1:7244/ingest/35756edc-cf7d-4d9e-ab6e-5b8765ec420b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'EditorView.tsx:handleStartDetection',message:'Calling startDetection',data:{jobId,filePath:project.filePath},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'D'})}).catch(()=>{});
    // #endregion

    try {
      const result = await window.api.startDetection(
        jobId,
        project.filePath,
        settings,
        project.duration
      );

      // #region agent log
      fetch('http://127.0.0.1:7244/ingest/35756edc-cf7d-4d9e-ab6e-5b8765ec420b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'EditorView.tsx:handleStartDetection:result',message:'Got result from startDetection',data:{result},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'D'})}).catch(()=>{});
      // #endregion

      if (!result.success) {
        setDetectionError(result.error || 'Failed to start detection');
      }
    } catch (err) {
      // #region agent log
      fetch('http://127.0.0.1:7244/ingest/35756edc-cf7d-4d9e-ab6e-5b8765ec420b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'EditorView.tsx:handleStartDetection:error',message:'startDetection threw error',data:{error:String(err)},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'D'})}).catch(()=>{});
      // #endregion
      setDetectionError(String(err));
      setDetecting(false);
    }
  }, [project, settings, setDetecting, setDetectionError, setCurrentJobId]);

  // Cancel detection
  const handleCancelDetection = useCallback(async () => {
    if (!currentJobId) return;
    await window.api.cancelDetection(currentJobId);
    setDetecting(false);
  }, [currentJobId, setDetecting]);

  // Export all accepted clips
  const handleExportAll = useCallback(async () => {
    if (!project) return;
    
    const acceptedClips = clips.filter(c => c.status === 'accepted');
    if (acceptedClips.length === 0) return;

    try {
      const outputDir = await window.api.selectOutputDir();
      if (!outputDir) return;

      await window.api.exportClips({
        sourceFile: project.filePath,
        clips: acceptedClips.map(c => ({
          id: c.id,
          startTime: c.startTime + c.trimStartOffset,
          endTime: c.endTime + c.trimEndOffset,
          trimStartOffset: 0,
          trimEndOffset: 0,
          title: c.title,
          hookText: c.hookText,
          category: c.category,
        })),
        deadSpaces: [],
        outputDir,
        settings: exportSettings,
      });
    } catch (err) {
      console.error('Export failed:', err);
    }
  }, [project, clips, exportSettings]);

  // Export single clip
  const handleExportClip = useCallback(async (clip: Clip) => {
    if (!project) return;

    try {
      const outputDir = await window.api.selectOutputDir();
      if (!outputDir) return;

      await window.api.exportClips({
        sourceFile: project.filePath,
        clips: [{
          id: clip.id,
          startTime: clip.startTime + clip.trimStartOffset,
          endTime: clip.endTime + clip.trimEndOffset,
          trimStartOffset: 0,
          trimEndOffset: 0,
          title: clip.title,
          hookText: clip.hookText,
          category: clip.category,
        }],
        deadSpaces: [],
        outputDir,
        settings: exportSettings,
      });
    } catch (err) {
      console.error('Export failed:', err);
    }
  }, [project, exportSettings]);

  // Handle clip selection
  const handleSelectClip = useCallback((clipId: string) => {
    setSelectedClipId(clipId);
    const clip = clips.find(c => c.id === clipId);
    if (clip && videoRef.current) {
      videoRef.current.currentTime = clip.startTime;
    }
  }, [clips]);

  // Handle accept/reject
  const handleAccept = useCallback(() => {
    if (selectedClipId) {
      const clip = clips.find(c => c.id === selectedClipId);
      if (clip) {
        updateClipStatus(selectedClipId, clip.status === 'accepted' ? 'pending' : 'accepted');
      }
    }
  }, [selectedClipId, clips, updateClipStatus]);

  const handleReject = useCallback(() => {
    if (selectedClipId) {
      const clip = clips.find(c => c.id === selectedClipId);
      if (clip) {
        updateClipStatus(selectedClipId, clip.status === 'rejected' ? 'pending' : 'rejected');
      }
    }
  }, [selectedClipId, clips, updateClipStatus]);

  // Video time update
  const handleTimeUpdate = useCallback((time: number) => {
    setCurrentTime(time);
  }, []);

  // Timeline seek
  const handleTimelineSeek = useCallback((time: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      setCurrentTime(time);
    }
  }, []);

  // Play/Pause
  const handlePlayPause = useCallback(() => {
    if (videoRef.current) {
      if (videoRef.current.paused) {
        videoRef.current.play();
        setIsPlaying(true);
      } else {
        videoRef.current.pause();
        setIsPlaying(false);
      }
    }
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      switch (e.key) {
        case ' ':
          // Space: Play/pause
          e.preventDefault();
          handlePlayPause();
          break;
        case 'ArrowLeft':
          // Left arrow: Seek back
          e.preventDefault();
          if (videoRef.current) {
            const delta = e.shiftKey ? 5 : 1;
            videoRef.current.currentTime = Math.max(0, videoRef.current.currentTime - delta);
          }
          break;
        case 'ArrowRight':
          // Right arrow: Seek forward
          e.preventDefault();
          if (videoRef.current && project) {
            const delta = e.shiftKey ? 5 : 1;
            videoRef.current.currentTime = Math.min(project.duration, videoRef.current.currentTime + delta);
          }
          break;
        case 'a':
        case 'A':
          // A: Accept selected clip
          if (selectedClipId) {
            handleAccept();
          }
          break;
        case 'r':
        case 'R':
          // R: Reject selected clip
          if (selectedClipId) {
            handleReject();
          }
          break;
        case 'e':
        case 'E':
          // E: Export selected clip (Ctrl/Cmd+E: Export all)
          if ((e.ctrlKey || e.metaKey) && clips.filter(c => c.status === 'accepted').length > 0) {
            e.preventDefault();
            handleExportAll();
          } else if (selectedClip) {
            handleExportClip(selectedClip);
          }
          break;
        case 'Tab':
          // Tab: Next clip, Shift+Tab: Previous clip
          if (clips.length > 0) {
            e.preventDefault();
            const currentIndex = clips.findIndex(c => c.id === selectedClipId);
            let nextIndex;
            if (e.shiftKey) {
              nextIndex = currentIndex <= 0 ? clips.length - 1 : currentIndex - 1;
            } else {
              nextIndex = currentIndex >= clips.length - 1 ? 0 : currentIndex + 1;
            }
            handleSelectClip(clips[nextIndex].id);
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    handlePlayPause,
    handleAccept,
    handleReject,
    handleExportAll,
    handleExportClip,
    handleSelectClip,
    selectedClipId,
    selectedClip,
    clips,
    project,
  ]);

  // Handle project setup complete
  const handleSetupComplete = useCallback((preferences: EditingPreferences) => {
    setEditingPreferences(preferences);
    if (preferences.cameras.length > 0) {
      setCameras(preferences.cameras);
    }
    setSetupComplete(true);
  }, [setEditingPreferences, setCameras, setSetupComplete]);

  // Handle going back from setup
  const handleSetupBack = useCallback(() => {
    clearProject();
  }, [clearProject]);

  // Determine view state
  const hasProject = !!project;
  const hasClips = clips.length > 0;
  const needsSetup = hasProject && !setupComplete;

  return (
    <div className="h-screen flex flex-col bg-sz-bg text-sz-text overflow-hidden">
      <Header 
        onSettingsClick={() => setShowSettings(true)}
      />

      <main className="flex-1 flex flex-col overflow-hidden">
        {!hasProject ? (
          // Empty state - Drop zone
          <DropZone
            isLoading={isLoading}
            error={error || detectionError}
            recentProjects={recentProjects}
            onSelectFile={handleSelectFile}
            onOpenRecent={handleOpenRecent}
            onRemoveRecent={removeRecentProject}
            onFileDrop={handleFileDrop}
          />
        ) : needsSetup ? (
          // Project setup flow
          <ProjectSetup
            onComplete={handleSetupComplete}
            onBack={handleSetupBack}
            initialPreferences={editingPreferences || undefined}
          />
        ) : (
          // Editor view
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Video Preview */}
            <div className="flex-shrink-0 p-4 pb-2">
              <VideoPreview
                ref={videoRef}
                project={project}
                selectedClip={selectedClip}
                currentTime={currentTime}
                isPlaying={isPlaying}
                onTimeUpdate={handleTimeUpdate}
                onPlayPause={handlePlayPause}
                onPlayingChange={setIsPlaying}
              />
            </div>

            {/* Quick Actions */}
            {hasClips && selectedClip && (
              <div className="flex-shrink-0 px-4 pb-2">
                <QuickActions
                  clip={selectedClip}
                  onAccept={handleAccept}
                  onReject={handleReject}
                  onExport={() => handleExportClip(selectedClip)}
                />
              </div>
            )}

            {/* Timeline */}
            <div className="flex-shrink-0 px-4 pb-2">
              <Timeline
                duration={project.duration}
                currentTime={currentTime}
                clips={clips}
                selectedClipId={selectedClipId}
                onSeek={handleTimelineSeek}
                onSelectClip={handleSelectClip}
                hasClips={hasClips}
                onAnalyze={handleStartDetection}
                isDetecting={isDetecting}
              />
            </div>

            {/* Clip Strip */}
            {hasClips && (
              <div className="flex-1 min-h-0 px-4 pb-2 overflow-hidden">
                <ClipStrip
                  clips={clips}
                  selectedClipId={selectedClipId}
                  onSelectClip={handleSelectClip}
                  onExportAll={handleExportAll}
                />
              </div>
            )}

            {/* Analyze prompt when no clips */}
            {!hasClips && !isDetecting && (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <p className="text-sz-text-secondary mb-4">
                    Video loaded. Click Analyze to find viral moments.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      <StatusBar
        project={project}
        clips={clips}
        isDetecting={isDetecting}
        isExporting={isExporting}
        onAnalyze={handleStartDetection}
        onExportAll={handleExportAll}
      />

      {/* Progress Overlay */}
      {isDetecting && detectionProgress && (
        <ProgressOverlay
          progress={detectionProgress}
          onCancel={handleCancelDetection}
        />
      )}

      {/* Settings Drawer */}
      <SettingsDrawer
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
      />
    </div>
  );
}

export default memo(EditorView);
