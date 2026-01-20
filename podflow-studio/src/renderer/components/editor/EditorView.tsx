import { memo, useState, useCallback, useEffect, useRef } from 'react';
import { useStore } from '../../stores/store';
import { estimateAiCost, formatCost } from '../../types';
import { createProjectFile, serializeProjectFile, loadProjectFile, parseProjectFile } from '../../stores/projectFile';
import type { Clip } from '../../types';
import { ConfirmModal, AlertModal } from '../ui';
import { AlertTriangle, Info, Sparkles } from 'lucide-react';

import Header from './Header';
import DropZone from './DropZone';
import StatusBar from './StatusBar';
import VideoPreview from './VideoPreview';
import Timeline from './Timeline';
import QuickActions from './QuickActions';
import ClipStrip from './ClipStrip';
import ProgressOverlay from './ProgressOverlay';
import ExportPreviewModal from './ExportPreviewModal';
import SettingsModal from './SettingsModal';

function EditorView() {
  const {
    project,
    setProject,
    clips,
    deadSpaces,
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
    // Undo/Redo
    undo,
    redo,
    canUndo,
    canRedo,
    // Project file state
    projectFilePath: storedProjectFilePath,
    setProjectFilePath: setStoredProjectFilePath,
  } = useStore();

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  const [showExportPreview, setShowExportPreview] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  
  // Custom modal state
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    variant?: 'default' | 'danger';
  }>({ isOpen: false, title: '', message: '', onConfirm: () => { /* intentionally empty */ } });
  
  const [alertModal, setAlertModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    variant?: 'info' | 'success' | 'warning' | 'error';
  }>({ isOpen: false, title: '', message: '' });
  
  const [aiCostModal, setAiCostModal] = useState<{
    isOpen: boolean;
    estimate: { whisperCost: number; gptCost: number; total: number };
    onConfirm: () => void;
  } | null>(null);
  
  const projectFilePath = storedProjectFilePath;
  const setProjectFilePath = setStoredProjectFilePath;
  
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
        resolution: validation.resolution,
        width: validation.width,
        height: validation.height,
        fps: validation.fps,
        thumbnailPath: validation.thumbnailPath,
        bitrate: validation.bitrate,
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
        resolution: validation.resolution,
        width: validation.width,
        height: validation.height,
        fps: validation.fps,
        thumbnailPath: validation.thumbnailPath,
        bitrate: validation.bitrate,
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
        resolution: validation.resolution,
        width: validation.width,
        height: validation.height,
        fps: validation.fps,
        thumbnailPath: validation.thumbnailPath,
        bitrate: validation.bitrate,
      });
    } catch (err) {
      setError(String(err));
    } finally {
      setIsLoading(false);
    }
  }, [removeRecentProject, setProject]);

  // Run detection
  const runDetection = useCallback(async () => {
    if (!project) return;

    const jobId = `job_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    setCurrentJobId(jobId);

    try {
      const result = await window.api.startDetection(
        jobId,
        project.filePath,
        settings,
        project.duration
      );

      if (!result.success) {
        setDetectionError(result.error || 'Failed to start detection');
      }
    } catch (err) {
      console.error('[Detection] Error:', err);
      setDetectionError(String(err));
      setDetecting(false);
    }
  }, [project, settings, setCurrentJobId, setDetectionError, setDetecting]);

  // Start detection
  const handleStartDetection = useCallback(async () => {
    if (!project) return;

    setDetecting(true);
    setDetectionError(null);

    // Confirm AI cost if enabled
    if (settings.useAiEnhancement && project.duration > 0) {
      const estimate = estimateAiCost(project.duration, settings.targetCount);
      setAiCostModal({
        isOpen: true,
        estimate,
        onConfirm: () => {
          setAiCostModal(null);
          runDetection();
        },
      });
      return;
    }

    runDetection();
  }, [project, settings, setDetecting, setDetectionError, runDetection]);

  // Cancel detection
  const handleCancelDetection = useCallback(async () => {
    if (!currentJobId) return;
    await window.api.cancelDetection(currentJobId);
    setDetecting(false);
  }, [currentJobId, setDetecting]);

  // Show export preview
  const handleShowExportPreview = useCallback(() => {
    const acceptedClips = clips.filter(c => c.status === 'accepted');
    if (acceptedClips.length > 0) {
      setShowExportPreview(true);
    }
  }, [clips]);

  // Export clips
  const handleExportFromPreview = useCallback(async (selectedClipIds: string[], options?: { vertical: boolean; platform: string; captionsEnabled: boolean; captionStyle: string }) => {
    if (!project) return;
    
    const clipsToExport = clips.filter(c => selectedClipIds.includes(c.id));
    if (clipsToExport.length === 0) return;

    setShowExportPreview(false);

    try {
      const outputDir = await window.api.selectOutputDir();
      if (!outputDir) return;

      // Use vertical reel export if requested
      if (options?.vertical) {
        const transcript = useStore.getState().transcript;
        await window.api.exportVerticalReelsBatch({
          sourceFile: project.filePath,
          outputDir,
          clips: clipsToExport.map(c => ({
            id: c.id,
            startTime: c.startTime + c.trimStartOffset,
            endTime: c.endTime + c.trimEndOffset,
            trimStartOffset: 0,
            trimEndOffset: 0,
            title: c.title,
          })),
          transcript: transcript || undefined,
          captionSettings: {
            enabled: options.captionsEnabled && !!transcript,
            style: options.captionStyle as 'viral' | 'minimal' | 'bold',
            fontSize: 56,
            position: 'bottom',
          },
          inputWidth: project.width || 1920,
          inputHeight: project.height || 1080,
        });
      } else {
        // Standard export
        await window.api.exportClips({
          sourceFile: project.filePath,
          clips: clipsToExport.map(c => ({
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
      }
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

  // Video controls
  const handleTimeUpdate = useCallback((time: number) => {
    setCurrentTime(time);
  }, []);

  const handleTimelineSeek = useCallback((time: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      setCurrentTime(time);
    }
  }, []);

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

  // File menu handlers
  const handleNewProject = useCallback(() => {
    if (project) {
      setConfirmModal({
        isOpen: true,
        title: 'Create New Project?',
        message: 'Any unsaved changes will be lost.',
        variant: 'danger',
        onConfirm: () => {
          useStore.getState().clearProject();
          setProjectFilePath(null);
          setSelectedClipId(null);
        },
      });
      return;
    }
    useStore.getState().clearProject();
  }, [project]);
  
  const handleOpenProjectFile = useCallback(async () => {
    try {
      const result = await window.api.projectOpen();
      if (result.canceled || !result.success) return;
      
      if (result.content && result.filePath) {
        const projectFile = parseProjectFile(result.content);
        loadProjectFile(projectFile);
        setProjectFilePath(result.filePath);
      }
    } catch (err) {
      console.error('Failed to open project:', err);
      setError('Failed to open project file');
    }
  }, []);
  
  const handleSaveProject = useCallback(async () => {
    if (!project) return;
    
    const projectFile = createProjectFile({ selectedClipId, currentTime });
    const json = serializeProjectFile(projectFile);
    
    if (projectFilePath) {
      await window.api.projectSave(projectFilePath, json);
    } else {
      const result = await window.api.projectSaveAs(json);
      if (result.success && result.filePath) {
        setProjectFilePath(result.filePath);
      }
    }
  }, [project, projectFilePath, selectedClipId, currentTime, setProjectFilePath]);
  
  const handleSaveProjectAs = useCallback(async () => {
    if (!project) return;
    
    const projectFile = createProjectFile({ selectedClipId, currentTime });
    const json = serializeProjectFile(projectFile);
    
    const result = await window.api.projectSaveAs(json);
    if (result.success && result.filePath) {
      setProjectFilePath(result.filePath);
    }
  }, [project, selectedClipId, currentTime, setProjectFilePath]);

  const handleShowShortcuts = useCallback(() => {
    setAlertModal({
      isOpen: true,
      title: 'Keyboard Shortcuts',
      message: `Space - Play/Pause
A - Accept clip
R - Reject clip
Tab - Next clip
Shift+Tab - Previous clip
Left/Right - Seek 1s (Shift for 5s)
Ctrl+S - Save project
Ctrl+E - Export accepted clips`,
      variant: 'info',
    });
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      switch (e.key) {
        case ' ':
          e.preventDefault();
          handlePlayPause();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          if (videoRef.current) {
            videoRef.current.currentTime = Math.max(0, videoRef.current.currentTime - (e.shiftKey ? 5 : 1));
          }
          break;
        case 'ArrowRight':
          e.preventDefault();
          if (videoRef.current && project) {
            videoRef.current.currentTime = Math.min(project.duration, videoRef.current.currentTime + (e.shiftKey ? 5 : 1));
          }
          break;
        case 'a':
        case 'A':
          if (selectedClipId) handleAccept();
          break;
        case 'r':
        case 'R':
          if (selectedClipId) handleReject();
          break;
        case 'Tab':
          if (clips.length > 0) {
            e.preventDefault();
            const currentIndex = clips.findIndex(c => c.id === selectedClipId);
            const nextIndex = e.shiftKey
              ? (currentIndex <= 0 ? clips.length - 1 : currentIndex - 1)
              : (currentIndex >= clips.length - 1 ? 0 : currentIndex + 1);
            handleSelectClip(clips[nextIndex].id);
          }
          break;
        case 's':
        case 'S':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            if (e.shiftKey) handleSaveProjectAs();
            else handleSaveProject();
          }
          break;
        case 'e':
        case 'E':
          if ((e.ctrlKey || e.metaKey) && clips.filter(c => c.status === 'accepted').length > 0) {
            e.preventDefault();
            handleShowExportPreview();
          }
          break;
        case 'z':
        case 'Z':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            if (e.shiftKey) redo();
            else undo();
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handlePlayPause, handleAccept, handleReject, handleSelectClip, handleSaveProject, handleSaveProjectAs, handleShowExportPreview, undo, redo, selectedClipId, clips, project]);

  const hasProject = !!project;
  const hasClips = clips.length > 0;

  return (
    <div className="h-screen w-screen flex flex-col bg-sz-bg text-sz-text overflow-hidden">
      <Header 
        onHelpClick={handleShowShortcuts}
        onSettingsClick={() => setShowSettings(true)}
        onNewProject={handleNewProject}
        onOpenProject={handleOpenProjectFile}
        onSave={handleSaveProject}
        onSaveAs={handleSaveProjectAs}
        onImportVideo={handleSelectFile}
        onExit={() => window.close()}
        recentProjects={recentProjects}
        onOpenRecent={handleOpenRecent}
        onUndo={undo}
        onRedo={redo}
        canUndo={canUndo()}
        canRedo={canRedo()}
        onAcceptClip={handleAccept}
        onRejectClip={handleReject}
        hasSelectedClip={!!selectedClip}
      />

      <main className="flex-1 flex flex-col overflow-hidden min-h-0">
        {!hasProject ? (
          <DropZone
            isLoading={isLoading}
            error={error || detectionError}
            recentProjects={recentProjects}
            onSelectFile={handleSelectFile}
            onOpenRecent={handleOpenRecent}
            onRemoveRecent={removeRecentProject}
            onFileDrop={handleFileDrop}
          />
        ) : (
          <div className="flex-1 flex flex-col overflow-hidden p-4 gap-3">
            {/* Video Preview */}
            <div className="flex-shrink-0">
              <div className="max-w-4xl mx-auto">
                <VideoPreview
                  ref={videoRef}
                  project={project}
                  selectedClip={selectedClip}
                  clips={clips}
                  currentTime={currentTime}
                  isPlaying={isPlaying}
                  onTimeUpdate={handleTimeUpdate}
                  onPlayPause={handlePlayPause}
                  onPlayingChange={setIsPlaying}
                />
              </div>
            </div>

            {/* Quick Actions */}
            {hasClips && selectedClip && (
              <div className="flex-shrink-0">
                <div className="max-w-4xl mx-auto">
                  <QuickActions
                    clip={selectedClip}
                    onAccept={handleAccept}
                    onReject={handleReject}
                    onExport={() => handleExportClip(selectedClip)}
                  />
                </div>
              </div>
            )}

            {/* Timeline */}
            <div className="flex-shrink-0">
              <Timeline
                duration={project.duration}
                currentTime={currentTime}
                clips={clips}
                deadSpaces={deadSpaces}
                selectedClipId={selectedClipId}
                onSeek={handleTimelineSeek}
                onSelectClip={handleSelectClip}
                hasClips={hasClips}
                isDetecting={isDetecting}
                onAnalyze={handleStartDetection}
              />
            </div>

            {/* Clip Strip */}
            {hasClips && (
              <div className="flex-1 min-h-0 overflow-hidden">
                <ClipStrip
                  clips={clips}
                  selectedClipId={selectedClipId}
                  onSelectClip={handleSelectClip}
                  onExportAll={handleShowExportPreview}
                />
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
        onExportAll={handleShowExportPreview}
      />

      {/* Progress Overlay */}
      {isDetecting && detectionProgress && (
        <ProgressOverlay
          progress={detectionProgress}
          onCancel={handleCancelDetection}
        />
      )}

      {/* Export Preview Modal */}
      {showExportPreview && (
        <ExportPreviewModal
          clips={clips}
          hasTranscript={!!useStore.getState().transcript}
          onExport={handleExportFromPreview}
          onClose={() => setShowExportPreview(false)}
        />
      )}

      {/* Confirm Modal */}
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
        onConfirm={confirmModal.onConfirm}
        title={confirmModal.title}
        message={confirmModal.message}
        variant={confirmModal.variant}
        icon={<AlertTriangle className="w-5 h-5" />}
      />

      {/* Alert Modal */}
      <AlertModal
        isOpen={alertModal.isOpen}
        onClose={() => setAlertModal(prev => ({ ...prev, isOpen: false }))}
        title={alertModal.title}
        message={alertModal.message}
        variant={alertModal.variant}
        icon={<Info className="w-5 h-5" />}
      />

      {/* AI Cost Modal */}
      {aiCostModal && (
        <ConfirmModal
          isOpen={aiCostModal.isOpen}
          onClose={() => {
            setAiCostModal(null);
            setDetecting(false);
          }}
          onConfirm={aiCostModal.onConfirm}
          title="Start AI Analysis?"
          message={`Estimated cost: ${formatCost(aiCostModal.estimate.total)}
  • Transcription: ${formatCost(aiCostModal.estimate.whisperCost)}
  • Analysis: ${formatCost(aiCostModal.estimate.gptCost)}`}
          confirmText="Start"
          cancelText="Cancel"
          icon={<Sparkles className="w-5 h-5" />}
        />
      )}

      {/* Settings Modal */}
      <SettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
      />
    </div>
  );
}

export default memo(EditorView);
