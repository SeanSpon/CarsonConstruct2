import { memo, useState, useCallback, useEffect, useRef } from 'react';
import { useStore } from '../../stores/store';
import { estimateAiCost, formatCost } from '../../types';
import { createProjectFile, serializeProjectFile, loadProjectFile, parseProjectFile } from '../../stores/projectFile';
import type { Clip, QACheck, AudioTrack } from '../../types';

import Header from './Header';
import DropZone from './DropZone';
import StatusBar from './StatusBar';
import VideoPreview from './VideoPreview';
import Timeline from './Timeline';
import QuickActions from './QuickActions';
import ClipStrip from './ClipStrip';
import ProgressOverlay from './ProgressOverlay';
import SettingsDrawer from './SettingsDrawer';
import QAPanel from './QAPanel';
import ProjectPanel from './ProjectPanel';
import EffectsPanel from './EffectsPanel';
import ExportPreviewModal from './ExportPreviewModal';
import ChatPanel from './ChatPanel';

function EditorView() {
  const {
    project,
    setProject,
    clips,
    deadSpaces,
    speakerSegments,
    audioTracks,
    timelineGroups,
    transcript,
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
    updateDeadSpaceRemove,
    updateClipTrim,
    qaChecks,
    setQAChecks,
    setQARunning,
    markQACheckFixed,
    // New actions
    splitClipAtTime,
    duplicateClip,
    deleteClip,
    moveClip,
    groupClips,
    ungroupClips,
    addAudioTrack,
    removeAudioTrack,
    updateAudioTrack,
    addClipEffect,
    removeClipEffect,
    toggleClipEffect,
    // Project file state
    projectFilePath: storedProjectFilePath,
    setProjectFilePath: setStoredProjectFilePath,
    setLastAutoSaveTime,
  } = useStore();

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  const [selectedClipIds, setSelectedClipIds] = useState<string[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [showExportPreview, setShowExportPreview] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  
  // Panel visibility state for View menu
  const [showProjectPanel, setShowProjectPanel] = useState(true);
  const [showEffectsPanel, setShowEffectsPanel] = useState(true);
  const [showChatPanel, setShowChatPanel] = useState(false);
  
  // Use projectFilePath from store (synced with stored project)
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

  // Auto-save every 60 seconds when project has changes
  useEffect(() => {
    if (!project) return;

    const autoSaveInterval = setInterval(async () => {
      // Generate a project ID from the file path
      const projectId = project.filePath.replace(/[^a-zA-Z0-9]/g, '_').slice(-50);
      
      const projectFile = createProjectFile({
        selectedClipId,
        currentTime,
        showQAPanel,
      });
      const json = serializeProjectFile(projectFile);
      
      try {
        const result = await window.api.projectAutoSave(projectId, json);
        if (result.success) {
          setLastAutoSaveTime(Date.now());
          console.log('[AutoSave] Project auto-saved at', new Date().toLocaleTimeString());
        }
      } catch (err) {
        console.error('[AutoSave] Failed to auto-save:', err);
      }
    }, 60000); // Auto-save every 60 seconds

    return () => clearInterval(autoSaveInterval);
  }, [project, clips, deadSpaces, selectedClipId, currentTime, showQAPanel, setLastAutoSaveTime]);

  // Check for recovery on mount
  useEffect(() => {
    const checkRecovery = async () => {
      if (!project) return;
      
      const projectId = project.filePath.replace(/[^a-zA-Z0-9]/g, '_').slice(-50);
      
      try {
        const result = await window.api.projectCheckRecovery(projectId);
        if (result.success && result.hasRecovery && result.content) {
          const recoveryDate = result.recoveryDate 
            ? new Date(result.recoveryDate).toLocaleString() 
            : 'unknown time';
          
          const shouldRecover = window.confirm(
            `Found auto-saved project from ${recoveryDate}.\n\nWould you like to recover it?`
          );
          
          if (shouldRecover) {
            try {
              const projectFile = parseProjectFile(result.content);
              const uiState = loadProjectFile(projectFile);
              handleUIStateLoaded(uiState);
              console.log('[Recovery] Recovered project from auto-save');
            } catch (err) {
              console.error('[Recovery] Failed to load recovery file:', err);
            }
          } else {
            // Clear the auto-save if user declines
            await window.api.projectClearAutoSave(projectId);
          }
        }
      } catch (err) {
        console.error('[Recovery] Failed to check for recovery:', err);
      }
    };
    
    // Only check once when project loads
    checkRecovery();
  }, [project?.filePath]); // Only run when project file path changes

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

  // Start detection
  const handleStartDetection = useCallback(async () => {
    if (!project) return;

    setDetecting(true);
    setDetectionError(null);

    // Confirm AI enhancement cost if enabled
    if (settings.useAiEnhancement && project.duration > 0) {
      const estimate = estimateAiCost(project.duration, settings.targetCount);
      const confirmed = window.confirm(
        `🚀 Ready to analyze your video with AI?\n\nEstimated cost: ${formatCost(estimate.total)}\n  • Transcription (Whisper): ${formatCost(estimate.whisperCost)}\n  • Content analysis (GPT): ${formatCost(estimate.gptCost)}\n\nProceed with AI-powered detection?`
      );
      if (!confirmed) {
        setDetecting(false);
        return;
      }
    }

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
      console.error('[Detection] Error starting detection:', err);
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

  // Show export preview modal
  const handleShowExportPreview = useCallback(() => {
    const acceptedClips = clips.filter(c => c.status === 'accepted');
    if (acceptedClips.length > 0) {
      setShowExportPreview(true);
    }
  }, [clips]);

  // Export clips (called from preview modal with selected IDs)
  const handleExportFromPreview = useCallback(async (selectedClipIds: string[]) => {
    if (!project) return;
    
    const clipsToExport = clips.filter(c => selectedClipIds.includes(c.id));
    if (clipsToExport.length === 0) return;

    setShowExportPreview(false);

    try {
      const outputDir = await window.api.selectOutputDir();
      if (!outputDir) return;

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
    } catch (err) {
      console.error('Export failed:', err);
    }
  }, [project, clips, exportSettings]);

  // Export all accepted clips (legacy, for keyboard shortcut)
  const handleExportAll = useCallback(async () => {
    handleShowExportPreview();
  }, [handleShowExportPreview]);

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
    setSelectedClipIds([clipId]); // Reset multi-select to just this clip
    const clip = clips.find(c => c.id === clipId);
    if (clip && videoRef.current) {
      videoRef.current.currentTime = clip.startTime;
    }
  }, [clips]);

  // Handle multi-select
  const handleMultiSelectClip = useCallback((clipId: string, addToSelection: boolean) => {
    if (addToSelection) {
      setSelectedClipIds(prev => {
        if (prev.includes(clipId)) {
          // Remove from selection
          const newSelection = prev.filter(id => id !== clipId);
          if (newSelection.length > 0) {
            setSelectedClipId(newSelection[newSelection.length - 1]);
          } else {
            setSelectedClipId(null);
          }
          return newSelection;
        } else {
          // Add to selection
          setSelectedClipId(clipId);
          return [...prev, clipId];
        }
      });
    } else {
      setSelectedClipId(clipId);
      setSelectedClipIds([clipId]);
    }
  }, []);

  // Handle split clip
  const handleSplitClip = useCallback((clipId: string, splitTime: number) => {
    splitClipAtTime(clipId, splitTime);
  }, [splitClipAtTime]);

  // Handle duplicate clip
  const handleDuplicateClip = useCallback((clipId: string) => {
    duplicateClip(clipId);
  }, [duplicateClip]);

  // Handle delete clip
  const handleDeleteClip = useCallback((clipId: string) => {
    // Deselect if this clip was selected
    if (selectedClipId === clipId) {
      setSelectedClipId(null);
    }
    setSelectedClipIds(prev => prev.filter(id => id !== clipId));
    // Actually delete from store
    deleteClip(clipId);
  }, [selectedClipId, deleteClip]);

  // Handle group clips
  const handleGroupClips = useCallback((clipIds: string[], groupName?: string) => {
    groupClips(clipIds, groupName);
  }, [groupClips]);

  // Handle ungroup clips
  const handleUngroupClips = useCallback((groupId: string) => {
    ungroupClips(groupId);
  }, [ungroupClips]);

  // Handle move clip on timeline
  const handleMoveClip = useCallback((clipId: string, newStartTime: number) => {
    moveClip(clipId, newStartTime);
  }, [moveClip]);

  // Handle add audio track
  const handleAddAudioTrack = useCallback(async () => {
    try {
      // Open file picker for audio
      const file = await window.api.selectFile();
      if (!file) return;
      
      // Validate it's an audio file
      const isAudio = /\.(mp3|wav|aac|m4a|ogg|flac)$/i.test(file.path);
      if (!isAudio) {
        setError('Please select an audio file (MP3, WAV, AAC, etc.)');
        return;
      }
      
      // Add the audio track
      const newTrack = {
        id: `audio_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        type: 'main' as const,
        filePath: file.path,
        fileName: file.name,
        startTime: 0,
        endTime: project?.duration || 60, // Default to project duration
        volume: 100,
        muted: false,
        locked: false,
      };
      addAudioTrack(newTrack);
    } catch (err) {
      console.error('Failed to add audio track:', err);
      setError('Failed to add audio track');
    }
  }, [addAudioTrack, project]);

  // Handle remove audio track
  const handleRemoveAudioTrack = useCallback((trackId: string) => {
    removeAudioTrack(trackId);
  }, [removeAudioTrack]);

  // Handle update audio track
  const handleUpdateAudioTrack = useCallback((trackId: string, updates: Partial<typeof audioTracks[0]>) => {
    updateAudioTrack(trackId, updates);
  }, [updateAudioTrack]);

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
        case 'j':
        case 'J':
          // Ctrl+J: Toggle AI Chat panel
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            handleToggleChatPanel();
          }
          break;
        case 's':
        case 'S':
          // Ctrl+S: Save, Ctrl+Shift+S: Save As
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            if (e.shiftKey) {
              handleSaveProjectAs();
            } else {
              handleSaveProject();
            }
          }
          break;
        case 'o':
        case 'O':
          // Ctrl+O: Open project
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            handleOpenProjectFile();
          }
          break;
        case 'n':
        case 'N':
          // Ctrl+N: New project
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            handleNewProject();
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
    handleToggleChatPanel,
    handleSaveProject,
    handleSaveProjectAs,
    handleOpenProjectFile,
    handleNewProject,
    selectedClipId,
    selectedClip,
    clips,
    project,
  ]);

  // QA Check handlers
  const [showQAPanel, setShowQAPanel] = useState(false);

  // Handle UI state loaded from project file
  const handleUIStateLoaded = useCallback((uiState: {
    timelineZoom?: number;
    selectedClipId?: string | null;
    currentTime?: number;
    isPlaying?: boolean;
    showQAPanel?: boolean;
  }) => {
    if (uiState.selectedClipId) {
      setSelectedClipId(uiState.selectedClipId);
    }
    if (typeof uiState.currentTime === 'number' && videoRef.current) {
      videoRef.current.currentTime = uiState.currentTime;
      setCurrentTime(uiState.currentTime);
    }
    if (typeof uiState.showQAPanel === 'boolean') {
      setShowQAPanel(uiState.showQAPanel);
    }
    console.log('[EditorView] UI state loaded from project file:', uiState);
  }, []);

  const handleRunQAChecks = useCallback(async () => {
    if (!project) return;
    
    setQARunning(true);
    try {
      const result = await window.api.runQAChecks({
        clips: clips.map(c => ({
          id: c.id,
          startTime: c.startTime + (c.trimStartOffset || 0),
          endTime: c.endTime + (c.trimEndOffset || 0),
          title: c.title,
        })),
        deadSpaces: deadSpaces.map(ds => ({
          id: ds.id,
          startTime: ds.startTime,
          endTime: ds.endTime,
          duration: ds.duration,
          remove: ds.remove,
        })),
        transcript: transcript || undefined,
        duration: project.duration,
      });

      if (result.success && result.issues) {
        const qaIssues: QACheck[] = result.issues.map(issue => ({
          id: issue.id,
          type: issue.type as QACheck['type'],
          severity: issue.severity,
          timestamp: issue.timestamp,
          message: issue.message,
          autoFixable: issue.autoFixable,
          fixed: false,
        }));
        setQAChecks(qaIssues);
      }
    } catch (err) {
      console.error('QA check failed:', err);
    } finally {
      setQARunning(false);
    }
  }, [project, clips, deadSpaces, transcript, setQARunning, setQAChecks]);

  const handleFixQAIssue = useCallback((checkId: string) => {
    const check = qaChecks.find(c => c.id === checkId);
    if (!check) return;

    // Apply auto-fix based on issue type
    if (check.type === 'silence' && check.timestamp !== undefined) {
      // Find and mark the dead space for removal
      const ds = deadSpaces.find(d => 
        check.timestamp! >= d.startTime && check.timestamp! <= d.endTime
      );
      if (ds) {
        updateDeadSpaceRemove(ds.id, true);
      }
    } else if (check.type === 'mid-word-cut' && check.timestamp !== undefined) {
      // Find the clip and adjust its boundary
      const clip = clips.find(c => 
        Math.abs(c.startTime - check.timestamp!) < 0.5 ||
        Math.abs(c.endTime - check.timestamp!) < 0.5
      );
      if (clip && transcript?.words) {
        // Snap to nearest word boundary
        const words = transcript.words;
        let nearestBoundary = check.timestamp;
        let minDistance = Infinity;
        
        for (const word of words) {
          const startDist = Math.abs(word.start - check.timestamp!);
          const endDist = Math.abs(word.end - check.timestamp!);
          
          if (startDist < minDistance) {
            minDistance = startDist;
            nearestBoundary = word.start;
          }
          if (endDist < minDistance) {
            minDistance = endDist;
            nearestBoundary = word.end;
          }
        }

        // Adjust the clip trim
        if (Math.abs(clip.startTime - check.timestamp!) < 0.5) {
          updateClipTrim(clip.id, nearestBoundary - clip.startTime, clip.trimEndOffset);
        } else if (Math.abs(clip.endTime - check.timestamp!) < 0.5) {
          updateClipTrim(clip.id, clip.trimStartOffset, nearestBoundary - clip.endTime);
        }
      }
    }

    markQACheckFixed(checkId);
  }, [qaChecks, deadSpaces, clips, transcript, updateDeadSpaceRemove, updateClipTrim, markQACheckFixed]);

  const handleFixAllQAIssues = useCallback(() => {
    const fixableIssues = qaChecks.filter(c => c.autoFixable && !c.fixed);
    for (const issue of fixableIssues) {
      handleFixQAIssue(issue.id);
    }
  }, [qaChecks, handleFixQAIssue]);

  const handleJumpToQATimestamp = useCallback((timestamp: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = timestamp;
      setCurrentTime(timestamp);
    }
  }, []);

  // Handle AI effect application
  const handleApplyAiEffect = useCallback(async (effect: string, clipId: string) => {
    if (!project || !selectedClip) return;
    
    try {
      const result = await window.api.applyAiEffect({
        effect,
        clipId,
        clip: selectedClip,
        projectPath: project.filePath,
      });
      
      if (result.success) {
        // Update clip with AI-enhanced properties
        // This would typically update the clip in the store
        console.log(`Applied ${effect} to clip ${clipId}`, result);
      } else {
        console.error(`Failed to apply ${effect}:`, result.error);
      }
    } catch (err) {
      console.error(`Error applying AI effect ${effect}:`, err);
    }
  }, [project, selectedClip]);

  // Handle standard effect application (video/audio/text)
  const handleApplyEffect = useCallback(async (effectId: string, category: 'video' | 'audio' | 'text', clipId: string) => {
    if (!project || !selectedClip) return;
    
    try {
      const result = await window.api.applyAiEffect({
        effect: `${category}-${effectId}`,
        clipId,
        clip: selectedClip,
        projectPath: project.filePath,
      });
      
      if (result.success) {
        console.log(`Applied ${category} effect ${effectId} to clip ${clipId}`, result);
      } else {
        console.error(`Failed to apply ${category} effect ${effectId}:`, result.error);
      }
    } catch (err) {
      console.error(`Error applying ${category} effect ${effectId}:`, err);
    }
  }, [project, selectedClip]);

  // ========================================
  // File Menu Handlers
  // ========================================
  
  // New Project - clear current project
  const handleNewProject = useCallback(() => {
    if (project) {
      const confirmed = window.confirm('Create a new project? Any unsaved changes will be lost.');
      if (!confirmed) return;
    }
    useStore.getState().clearProject();
    setProjectFilePath(null);
    setSelectedClipId(null);
  }, [project]);
  
  // Open Project (.podflow file)
  const handleOpenProjectFile = useCallback(async () => {
    try {
      const result = await window.api.projectOpen();
      if (result.canceled || !result.success) return;
      
      if (result.content && result.filePath) {
        const projectFile = parseProjectFile(result.content);
        const uiState = loadProjectFile(projectFile);
        setProjectFilePath(result.filePath);
        handleUIStateLoaded(uiState);
      }
    } catch (err) {
      console.error('Failed to open project:', err);
      setError('Failed to open project file');
    }
  }, [handleUIStateLoaded]);
  
  // Save Project
  const handleSaveProject = useCallback(async () => {
    if (!project) return;
    
    const projectFile = createProjectFile({
      selectedClipId,
      currentTime,
      showQAPanel,
    });
    const json = serializeProjectFile(projectFile);
    
    let saveSuccess = false;
    
    if (projectFilePath) {
      // Save to existing path
      const result = await window.api.projectSave(projectFilePath, json);
      if (result.success) {
        console.log('[EditorView] Project saved to:', result.filePath);
        saveSuccess = true;
      } else {
        console.error('[EditorView] Save failed:', result.error);
      }
    } else {
      // No existing path, do Save As
      const result = await window.api.projectSaveAs(json);
      if (result.success && result.filePath) {
        setProjectFilePath(result.filePath);
        console.log('[EditorView] Project saved as:', result.filePath);
        saveSuccess = true;
      }
    }
    
    // Clear auto-save after successful manual save
    if (saveSuccess) {
      const projectId = project.filePath.replace(/[^a-zA-Z0-9]/g, '_').slice(-50);
      try {
        await window.api.projectClearAutoSave(projectId);
        console.log('[EditorView] Auto-save cleared after manual save');
      } catch (err) {
        console.error('[EditorView] Failed to clear auto-save:', err);
      }
    }
  }, [project, projectFilePath, selectedClipId, currentTime, showQAPanel, setProjectFilePath]);
  
  // Save Project As
  const handleSaveProjectAs = useCallback(async () => {
    if (!project) return;
    
    const projectFile = createProjectFile({
      selectedClipId,
      currentTime,
      showQAPanel,
    });
    const json = serializeProjectFile(projectFile);
    
    const result = await window.api.projectSaveAs(json);
    if (result.success && result.filePath) {
      setProjectFilePath(result.filePath);
      console.log('[EditorView] Project saved as:', result.filePath);
      
      // Clear auto-save after successful save
      const projectId = project.filePath.replace(/[^a-zA-Z0-9]/g, '_').slice(-50);
      try {
        await window.api.projectClearAutoSave(projectId);
      } catch (err) {
        console.error('[EditorView] Failed to clear auto-save:', err);
      }
    }
  }, [project, selectedClipId, currentTime, showQAPanel, setProjectFilePath]);
  
  // Exit application
  const handleExit = useCallback(() => {
    window.close();
  }, []);
  
  // ========================================
  // View Menu Handlers
  // ========================================
  
  const handleToggleProjectPanel = useCallback(() => {
    setShowProjectPanel(prev => !prev);
  }, []);
  
  const handleToggleEffectsPanel = useCallback(() => {
    setShowEffectsPanel(prev => !prev);
  }, []);
  
  const handleToggleQAPanel = useCallback(() => {
    setShowQAPanel(prev => !prev);
  }, []);
  
  const handleToggleChatPanel = useCallback(() => {
    setShowChatPanel(prev => !prev);
  }, []);
  
  // TODO: Implement zoom handlers (would need timeline zoom state)
  const handleZoomIn = useCallback(() => {
    console.log('Zoom in - not implemented yet');
  }, []);
  
  const handleZoomOut = useCallback(() => {
    console.log('Zoom out - not implemented yet');
  }, []);
  
  const handleResetZoom = useCallback(() => {
    console.log('Reset zoom - not implemented yet');
  }, []);
  
  // Help Menu Handlers
  const handleShowShortcuts = useCallback(() => {
    alert('Keyboard Shortcuts:\n\nSpace - Play/Pause\nA - Accept clip\nR - Reject clip\nLeft/Right Arrow - Seek\nTab - Next clip\nShift+Tab - Previous clip\nCtrl+S - Save\nCtrl+Shift+S - Save As');
  }, []);
  
  const handleShowAbout = useCallback(() => {
    alert('PodFlow Studio\n\nAI-powered podcast clip detection and editing.\n\nVersion 1.0.0');
  }, []);

  // ========================================
  // Chat Panel Callbacks (for tool execution)
  // ========================================
  
  const handleChatSeekToTime = useCallback((time: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      setCurrentTime(time);
    }
  }, []);
  
  const handleChatSelectClip = useCallback((clipId: string) => {
    handleSelectClip(clipId);
  }, [handleSelectClip]);
  
  const handleChatTrimClip = useCallback((clipId: string, trimStart: number, trimEnd: number) => {
    updateClipTrim(clipId, trimStart, trimEnd);
  }, [updateClipTrim]);
  
  const handleChatPlayVideo = useCallback(() => {
    if (videoRef.current && videoRef.current.paused) {
      videoRef.current.play();
      setIsPlaying(true);
    }
  }, []);
  
  const handleChatPauseVideo = useCallback(() => {
    if (videoRef.current && !videoRef.current.paused) {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  }, []);
  
  const getChatCurrentTime = useCallback(() => currentTime, [currentTime]);
  const getChatSelectedClipId = useCallback(() => selectedClipId, [selectedClipId]);
  const getChatIsPlaying = useCallback(() => isPlaying, [isPlaying]);

  // Determine view state
  const hasProject = !!project;
  const hasClips = clips.length > 0;

  return (
    <div className="h-screen w-screen flex flex-col bg-sz-bg text-sz-text overflow-hidden">
      <Header 
        onSettingsClick={() => setShowSettings(true)}
        // File menu
        onNewProject={handleNewProject}
        onOpenProject={handleOpenProjectFile}
        onSave={handleSaveProject}
        onSaveAs={handleSaveProjectAs}
        onImportVideo={handleSelectFile}
        onExit={handleExit}
        recentProjects={recentProjects}
        onOpenRecent={handleOpenRecent}
        // Edit menu
        onAcceptClip={handleAccept}
        onRejectClip={handleReject}
        hasSelectedClip={!!selectedClip}
        // View menu
        showQAPanel={showQAPanel}
        onToggleQAPanel={handleToggleQAPanel}
        showEffectsPanel={showEffectsPanel}
        onToggleEffectsPanel={handleToggleEffectsPanel}
        showProjectPanel={showProjectPanel}
        onToggleProjectPanel={handleToggleProjectPanel}
        showChatPanel={showChatPanel}
        onToggleChatPanel={handleToggleChatPanel}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onResetZoom={handleResetZoom}
        // Help menu
        onShowShortcuts={handleShowShortcuts}
        onShowAbout={handleShowAbout}
      />

      <main className="flex-1 flex flex-col overflow-hidden min-h-0">
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
        ) : (
          // Editor view - Three panel layout (Premiere Pro style)
          <div className="flex-1 flex overflow-hidden min-h-0 w-full">
            {/* Left Panel - Project/Media Browser */}
            {/* Scales proportionally: 16% of width, clamped between 200-320px */}
            {showProjectPanel && (
              <div className="w-[16%] min-w-[200px] max-w-[320px] flex-shrink-0 h-full overflow-hidden">
                <ProjectPanel onUIStateLoaded={handleUIStateLoaded} />
              </div>
            )}

            {/* Center Panel - Video Preview, Timeline, Clips */}
            <div className="flex-1 flex flex-col overflow-hidden min-w-0 min-h-0">
              {/* Video Preview - constrained max-width for ultrawide */}
              <div className="flex-shrink-0 p-4 pb-2">
                <div className="max-w-[1200px] mx-auto">
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
              </div>

              {/* Quick Actions */}
              {hasClips && selectedClip && (
                <div className="flex-shrink-0 px-4 pb-2">
                  <div className="max-w-[1200px] mx-auto">
                    <QuickActions
                      clip={selectedClip}
                      onAccept={handleAccept}
                      onReject={handleReject}
                      onExport={() => handleExportClip(selectedClip)}
                      onToggleQA={() => setShowQAPanel(!showQAPanel)}
                      showQAPanel={showQAPanel}
                      qaIssueCount={qaChecks.filter(c => !c.fixed).length}
                    />
                  </div>
                </div>
              )}

              {/* Timeline */}
              <div className="flex-shrink-0 px-4 pb-2">
                <Timeline
                  duration={project.duration}
                  currentTime={currentTime}
                  clips={clips}
                  deadSpaces={deadSpaces}
                  speakerSegments={speakerSegments}
                  audioTracks={audioTracks}
                  timelineGroups={timelineGroups}
                  selectedClipId={selectedClipId}
                  selectedClipIds={selectedClipIds}
                  onSeek={handleTimelineSeek}
                  onSelectClip={handleSelectClip}
                  onMultiSelectClip={handleMultiSelectClip}
                  onMoveClip={handleMoveClip}
                  onSplitClip={handleSplitClip}
                  onDuplicateClip={handleDuplicateClip}
                  onDeleteClip={handleDeleteClip}
                  onGroupClips={handleGroupClips}
                  onUngroupClips={handleUngroupClips}
                  onAddAudioTrack={handleAddAudioTrack}
                  onRemoveAudioTrack={handleRemoveAudioTrack}
                  onUpdateAudioTrack={handleUpdateAudioTrack}
                  hasClips={hasClips}
                  isDetecting={isDetecting}
                  onAnalyze={handleStartDetection}
                  sourceVideoName={project.fileName}
                  thumbnailPath={project.thumbnailPath}
                />
              </div>

              {/* Clip Strip + QA Panel */}
              {hasClips && (
                <div className="flex-1 min-h-0 px-4 pb-2 overflow-hidden flex gap-4">
                  <div className={`flex-1 overflow-hidden ${showQAPanel ? 'w-2/3' : 'w-full'}`}>
                    <ClipStrip
                      clips={clips}
                      selectedClipId={selectedClipId}
                      onSelectClip={handleSelectClip}
                      onExportAll={handleShowExportPreview}
                    />
                  </div>
                  {showQAPanel && (
                    <div className="w-1/3 max-w-sm">
                      <QAPanel
                        onRunChecks={handleRunQAChecks}
                        onFixIssue={handleFixQAIssue}
                        onFixAll={handleFixAllQAIssues}
                        onJumpToTimestamp={handleJumpToQATimestamp}
                        className="h-full"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Right Panel - Effects/Properties */}
            {/* Scales proportionally: 18% of width, clamped between 220-400px */}
            {showEffectsPanel && (
              <div className="w-[18%] min-w-[220px] max-w-[400px] flex-shrink-0 h-full overflow-hidden">
                <EffectsPanel 
                  selectedClip={selectedClip} 
                  onApplyAiEffect={handleApplyAiEffect}
                  onApplyEffect={handleApplyEffect}
                />
              </div>
            )}
            
            {/* Chat Panel - AI Assistant */}
            {showChatPanel && (
              <div className="w-[20%] min-w-[280px] max-w-[420px] flex-shrink-0 h-full overflow-hidden p-2">
                <ChatPanel
                  className="h-full"
                  onSeekToTime={handleChatSeekToTime}
                  onSelectClip={handleChatSelectClip}
                  onTrimClip={handleChatTrimClip}
                  onPlayVideo={handleChatPlayVideo}
                  onPauseVideo={handleChatPauseVideo}
                  getCurrentTime={getChatCurrentTime}
                  getSelectedClipId={getChatSelectedClipId}
                  getIsPlaying={getChatIsPlaying}
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

      {/* Settings Drawer */}
      <SettingsDrawer
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
      />

      {/* Export Preview Modal */}
      {showExportPreview && (
        <ExportPreviewModal
          clips={clips}
          exportSettings={exportSettings}
          onExport={handleExportFromPreview}
          onClose={() => setShowExportPreview(false)}
        />
      )}
    </div>
  );
}

export default memo(EditorView);
