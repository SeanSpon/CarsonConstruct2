import { memo, useState, useCallback, useEffect, useRef } from 'react';
import { useStore } from '../../stores/store';
import { useChatStore } from '../../stores/chatStore';
import { estimateAiCost, formatCost } from '../../types';
import { createProjectFile, serializeProjectFile, loadProjectFile, parseProjectFile } from '../../stores/projectFile';
import type { Clip, QACheck, AudioTrack } from '../../types';
import { ConfirmModal, AlertModal } from '../ui';
import { AlertTriangle, Info, Keyboard, Sparkles } from 'lucide-react';

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
    // Undo/Redo
    undo,
    redo,
    canUndo,
    canRedo,
    // Project file state
    projectFilePath: storedProjectFilePath,
    setProjectFilePath: setStoredProjectFilePath,
    setLastAutoSaveTime,
    // Source waveform
    sourceWaveform,
    setSourceWaveform,
    isExtractingWaveform,
    setExtractingWaveform,
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
  const [showQAPanel, setShowQAPanel] = useState(false);
  
  // Custom modal state (replaces window.confirm/alert)
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    onCancel?: () => void;
    variant?: 'default' | 'danger';
  }>({ isOpen: false, title: '', message: '', onConfirm: () => {} });
  
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
  
  // Use projectFilePath from store (synced with stored project)
  const projectFilePath = storedProjectFilePath;
  const setProjectFilePath = setStoredProjectFilePath;
  
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Get selected clip
  const selectedClip = clips.find(c => c.id === selectedClipId) || null;

  // Auto-create source clip if project exists but no clips
  // This ensures the timeline always has something selectable
  useEffect(() => {
    if (project && project.duration > 0 && clips.length === 0) {
      // Use store's setResults to create a source clip
      const { setResults } = useStore.getState();
      const sourceClip = {
        id: `source_${Date.now()}`,
        startTime: 0,
        endTime: project.duration,
        duration: project.duration,
        pattern: 'monologue' as const,
        patternLabel: 'Source',
        description: 'Full source video',
        algorithmScore: 0,
        hookStrength: 0,
        hookMultiplier: 1,
        finalScore: 0,
        trimStartOffset: 0,
        trimEndOffset: 0,
        status: 'pending' as const,
        title: project.fileName?.replace(/\.[^/.]+$/, '') || 'Source',
      };
      setResults([sourceClip], [], null);
    }
  }, [project, clips.length]);

  // Auto-select first clip when clips change
  useEffect(() => {
    if (clips.length > 0 && !selectedClipId) {
      setSelectedClipId(clips[0].id);
    }
  }, [clips, selectedClipId]);

  // Note: Auto-save is now handled by ProjectPanel to avoid duplicate intervals

  // Extract waveform when project is loaded
  useEffect(() => {
    const extractWaveform = async () => {
      if (!project?.filePath) {
        setSourceWaveform(null);
        return;
      }
      
      // Don't re-extract if we already have waveform for this file
      if (sourceWaveform && sourceWaveform.length > 0) {
        return;
      }
      
      setExtractingWaveform(true);
      console.log('[EditorView] Extracting waveform for:', project.filePath);
      
      try {
        // Use more points for longer videos (scales with duration)
        const numPoints = Math.min(2000, Math.max(500, Math.ceil(project.duration / 2)));
        const result = await window.api.extractWaveform(project.filePath, numPoints);
        
        if (result.success && result.waveform) {
          console.log('[EditorView] Waveform extracted:', result.waveform.length, 'points');
          setSourceWaveform(result.waveform);
        } else {
          console.warn('[EditorView] Waveform extraction failed:', result.error);
        }
      } catch (err) {
        console.error('[EditorView] Waveform extraction error:', err);
      } finally {
        setExtractingWaveform(false);
      }
    };
    
    extractWaveform();
  }, [project?.filePath]); // Only re-run when file path changes

  // Check for recovery on mount (only once per project)
  const recoveryCheckedRef = useRef<string | null>(null);
  
  useEffect(() => {
    const checkRecovery = async () => {
      if (!project) return;
      
      const projectId = project.filePath.replace(/[^a-zA-Z0-9]/g, '_').slice(-50);
      
      // Skip if we already checked recovery for this project
      if (recoveryCheckedRef.current === projectId) {
        return;
      }
      
      recoveryCheckedRef.current = projectId;
      
      try {
        const result = await window.api.projectCheckRecovery(projectId);
        if (result.success && result.hasRecovery && result.content) {
          const recoveryDate = result.recoveryDate 
            ? new Date(result.recoveryDate).toLocaleString() 
            : 'unknown time';
          const recoveryContent = result.content;
          
          setConfirmModal({
            isOpen: true,
            title: 'Recover Auto-Save?',
            message: `Found an auto-saved project from ${recoveryDate}.\n\nWould you like to recover it?`,
            onConfirm: async () => {
              try {
                const projectFile = parseProjectFile(recoveryContent);
                const uiState = loadProjectFile(projectFile);
                handleUIStateLoaded(uiState);
                console.log('[Recovery] Recovered project from auto-save');
                // Clear the auto-save after successful recovery
                await window.api.projectClearAutoSave(projectId);
              } catch (err) {
                console.error('[Recovery] Failed to load recovery file:', err);
              }
            },
            onCancel: async () => {
              // Clear the auto-save if user declines recovery
              await window.api.projectClearAutoSave(projectId);
              console.log('[Recovery] User declined recovery, auto-save cleared');
            },
          });
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

  // Actually run detection (after confirmation)
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
      console.error('[Detection] Error starting detection:', err);
      setDetectionError(String(err));
      setDetecting(false);
    }
  }, [project, settings, setCurrentJobId, setDetectionError, setDetecting]);

  // Start detection
  const handleStartDetection = useCallback(async () => {
    if (!project) return;

    setDetecting(true);
    setDetectionError(null);

    // Confirm AI enhancement cost if enabled
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

  // ========================================
  // View Menu Handlers (must be before keyboard shortcuts)
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
  
  // New Project - clear current project and show modal
  const handleNewProject = useCallback(() => {
    const clearAllState = () => {
      useStore.getState().clearProject();
      useChatStore.getState().clearMessages(); // Clear chat history for new project
      setProjectFilePath(null);
      setSelectedClipId(null);
      // Trigger showing the new project modal
      setShowNewProjectModalTrigger(true);
    };
    
    if (project) {
      setConfirmModal({
        isOpen: true,
        title: 'Create New Project?',
        message: 'Any unsaved changes will be lost. Are you sure you want to create a new project?',
        variant: 'danger',
        onConfirm: clearAllState,
      });
      return;
    }
    clearAllState();
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
    setAlertModal({
      isOpen: true,
      title: 'Keyboard Shortcuts',
      message: `Space - Play/Pause
A - Accept clip
R - Reject clip
Left/Right Arrow - Seek (Shift for 5s)
Tab - Next clip
Shift+Tab - Previous clip
Ctrl+Z - Undo
Ctrl+Shift+Z - Redo
Ctrl+S - Save project
Ctrl+Shift+S - Save As
Ctrl+O - Open project
Ctrl+N - New project
Ctrl+J - Toggle AI Chat`,
      variant: 'info',
    });
  }, []);
  
  const handleShowAbout = useCallback(() => {
    setAlertModal({
      isOpen: true,
      title: 'About PodFlow Studio',
      message: `AI-powered podcast clip detection and editing.

Version 1.0.0

All processing happens locally on your machine. Nothing is uploaded to external servers.`,
      variant: 'info',
    });
  }, []);
  
  const handleShowDocs = useCallback(() => {
    setAlertModal({
      isOpen: true,
      title: 'PodFlow Studio Documentation',
      message: `GETTING STARTED
1. Import a video or audio file (File > Import Video or drag & drop)
2. The project auto-saves to a .podflow file next to your video
3. Use AI detection to find clip-worthy moments

PANELS
• Project Panel (left) - Browse files, recent projects, media library
• Effects Panel (right) - Apply AI effects and video/audio adjustments
• AI Chat (right) - Ask the AI assistant for editing help
• QA Panel - Quality check your clips before export

KEYBOARD SHORTCUTS
Space        Play/Pause
A            Accept clip
R            Reject clip
Tab          Next clip
Shift+Tab    Previous clip
Left/Right   Seek 1s (Shift for 5s)
Ctrl+S       Save project
Ctrl+Shift+S Save As
Ctrl+O       Open project
Ctrl+N       New project
Ctrl+J       Toggle AI Chat
Ctrl+Z       Undo
Ctrl+Shift+Z Redo

PROJECT FILES
• .podflow files contain your full project state
• Auto-saves every 30 seconds
• Projects are saved next to your source video

AI DETECTION
• Finds engaging moments in podcasts/videos
• Detects patterns like hooks, debates, stories
• Generates titles and hook text for clips

EXPORT OPTIONS
• Individual clips as separate files
• Clips compilation (all clips joined)
• Full video with dead spaces removed
• Export to Premiere Pro (FCP XML, EDL)`,
      variant: 'info',
    });
  }, []);
  
  // Undo/Redo handlers
  const handleUndo = useCallback(() => {
    undo();
  }, [undo]);
  
  const handleRedo = useCallback(() => {
    redo();
  }, [redo]);

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
  
  const handleChatShowExportPreview = useCallback((_clipIds: string[]) => {
    // The clipIds parameter is provided for context, but the export modal
    // will show all accepted clips (which create_vod_compilation already set)
    const acceptedClips = clips.filter(c => c.status === 'accepted');
    if (acceptedClips.length > 0) {
      setShowExportPreview(true);
    }
  }, [clips]);
  
  const getChatCurrentTime = useCallback(() => currentTime, [currentTime]);
  const getChatSelectedClipId = useCallback(() => selectedClipId, [selectedClipId]);
  const getChatIsPlaying = useCallback(() => isPlaying, [isPlaying]);

  // ========================================
  // Keyboard shortcuts (must be after all handlers)
  // ========================================
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
        case 'z':
        case 'Z':
          // Ctrl+Z: Undo, Ctrl+Shift+Z: Redo
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            if (e.shiftKey) {
              handleRedo();
            } else {
              handleUndo();
            }
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
    handleUndo,
    handleRedo,
    selectedClipId,
    selectedClip,
    clips,
    project,
  ]);

  // Determine view state
  const hasProject = !!project;
  const hasClips = clips.length > 0;
  
  // State to trigger showing the new project modal in DropZone
  const [showNewProjectModalTrigger, setShowNewProjectModalTrigger] = useState(false);

  // Handle project created from DropZone
  const handleProjectCreated = useCallback((projectPath: string, projectName: string) => {
    console.log('[EditorView] Project created:', projectName, 'at', projectPath);
    // The project file was created, but we still need to import a video
    // The DropZone will call onSelectFile after this
    setShowNewProjectModalTrigger(false);
  }, []);

  return (
    <div className="h-screen w-screen flex flex-col bg-sz-bg text-sz-text overflow-hidden">
      <Header 
        onSettingsClick={() => setShowSettings(true)}
        onHelpClick={handleShowShortcuts}
        onDocsClick={handleShowDocs}
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
        onUndo={handleUndo}
        onRedo={handleRedo}
        canUndo={canUndo()}
        canRedo={canRedo()}
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
            onProjectCreated={handleProjectCreated}
            autoShowNewProjectModal={showNewProjectModalTrigger}
            onModalClosed={() => setShowNewProjectModalTrigger(false)}
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
                  waveformData={sourceWaveform || undefined}
                  isExtractingWaveform={isExtractingWaveform}
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
                  onShowExportPreview={handleChatShowExportPreview}
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

      {/* Confirm Modal */}
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        onClose={() => {
          confirmModal.onCancel?.();
          setConfirmModal(prev => ({ ...prev, isOpen: false }));
        }}
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
        icon={alertModal.variant === 'info' ? <Info className="w-5 h-5" /> : <Keyboard className="w-5 h-5" />}
      />

      {/* AI Cost Confirmation Modal */}
      {aiCostModal && (
        <ConfirmModal
          isOpen={aiCostModal.isOpen}
          onClose={() => {
            setAiCostModal(null);
            setDetecting(false);
          }}
          onConfirm={aiCostModal.onConfirm}
          title="Start AI Analysis?"
          message={`Ready to analyze your video with AI-powered detection.

Estimated cost: ${formatCost(aiCostModal.estimate.total)}
  • Transcription (Whisper): ${formatCost(aiCostModal.estimate.whisperCost)}
  • Content analysis (GPT): ${formatCost(aiCostModal.estimate.gptCost)}

Proceed with AI-powered detection?`}
          confirmText="Start Analysis"
          cancelText="Cancel"
          icon={<Sparkles className="w-5 h-5" />}
        />
      )}
    </div>
  );
}

export default memo(EditorView);
